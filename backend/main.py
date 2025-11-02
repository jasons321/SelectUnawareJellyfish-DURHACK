from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
from pathlib import Path
import secrets
from typing import Dict, List
from PIL import Image
import imagehash
from collections import defaultdict
import json
import io
import msal
import httpx
import shutil

try:
    from image import ImageProcessor, DataLoader, ImageContainer
except ImportError:
    print("Error: 'image.py' not found. Please ensure it's in the same directory.")
    # Define dummy classes to allow the server to start, but upload will fail
    class ImageProcessor: pass
    class DataLoader: pass
    class ImageContainer: pass

# Create FastAPI instance
app = FastAPI(
    title="Google Drive API Server",
    description="FastAPI server with Google Drive OAuth integration and Picker API support",
    version="2.0.0"
)

origins = [
    "http://localhost:8001",  # React dev server
    "http://127.0.0.1:8001",
    "http://localhost:8001/api/upload",
    "http://localhost:8001/results",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    processor = ImageProcessor()
except Exception as e:
    print(f"Failed to initialise ImageProcessor: {e}")
    print("Gemini features will not work.")
    processor = None

CLIENT_SECRET_FILE = 'client_secret.json'
SCOPES = [
    'https://www.googleapis.com/auth/photoslibrary',
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

ONEDRIVE_SCOPES = [
    'Files.Read',
    'Files.Read.All',
    'User.Read'
]

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'NO_API_KEY')
MICROSOFT_CLIENT_ID = os.getenv('MICROSOFT_CLIENT_ID', 'YOUR_CLIENT_ID')
MICROSOFT_CLIENT_SECRET = os.getenv('MICROSOFT_CLIENT_SECRET', 'YOUR_CLIENT_SECRET')
MICROSOFT_REDIRECT_URI = os.getenv('MICROSOFT_REDIRECT_URI', 'http://localhost:8001/api/auth/onedrive/callback')

AUTHORITY = 'https://login.microsoftonline.com/common'

onedrive_sessions: Dict[str, dict] = {}

sessions: Dict[str, dict] = {}

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

def create_flow(state=None):
    """Create OAuth flow instance"""
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri='http://localhost:8001/api/oauth2callback'
    )
    if state:
        flow.state = state
    return flow

def get_credentials_from_session(session_id: str) -> Credentials:
    """Helper function to reconstruct Credentials from session"""
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    creds_data = sessions[session_id]["credentials"]
    return Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data["token_uri"],
        client_id=creds_data["client_id"],
        client_secret=creds_data["client_secret"],
        scopes=creds_data["scopes"]
    )

def update_session_token(session_id: str, credentials: Credentials):
    """Update session with refreshed token if changed"""
    if credentials.token != sessions[session_id]["credentials"]["token"]:
        sessions[session_id]["credentials"]["token"] = credentials.token

def create_msal_app():
    """Create MSAL confidential client application"""
    return msal.ConfidentialClientApplication(
        MICROSOFT_CLIENT_ID,
        authority=AUTHORITY,
        client_credential=MICROSOFT_CLIENT_SECRET
    )

def get_onedrive_credentials(session_id: str) -> dict:
    """Get OneDrive credentials from session"""
    if not session_id or session_id not in onedrive_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated with OneDrive")
    return onedrive_sessions[session_id]

async def refresh_access_token(session_id: str) -> str:
    """Refresh OneDrive access token if expired"""
    if session_id not in onedrive_sessions:
        raise HTTPException(status_code=401, detail="Session not found")
    
    session = onedrive_sessions[session_id]
    
    # Check if we have a refresh token
    if 'refresh_token' not in session:
        raise HTTPException(status_code=401, detail="No refresh token available")
    
    app = create_msal_app()
    
    result = app.acquire_token_by_refresh_token(
        session['refresh_token'],
        scopes=ONEDRIVE_SCOPES
    )
    
    if 'access_token' in result:
        # Update session with new tokens
        onedrive_sessions[session_id].update({
            'access_token': result['access_token'],
            'refresh_token': result.get('refresh_token', session['refresh_token']),
            'expires_in': result.get('expires_in', 3600)
        })
        return result['access_token']
    else:
        raise HTTPException(status_code=401, detail="Failed to refresh token")


@app.get("/api")
async def root():
    return {"message": "Welcome!"}

@app.get("/api/auth/status")
async def auth_status(request: Request):
    """Check if user is authenticated"""
    session_id = request.cookies.get("session_id")
    
    if session_id and session_id in sessions:
        return {"authenticated": True}
    
    return {"authenticated": False}

@app.get("/api/auth/login")
async def login(request: Request):
    """Initiate OAuth flow"""
    try:
        flow = create_flow()
        
        # Check if user already has a session (re-authentication)
        session_id = request.cookies.get("session_id")
        has_existing_session = session_id and session_id in sessions
        
        # Generate authorisation URL
        # Only force consent if this is the first time or if we don't have a refresh token
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            prompt='select_account' if has_existing_session else 'consent',
            include_granted_scopes='true'  # Only request incremental scopes
        )
        
        # Store state temporarily
        sessions[f"state_{state}"] = {"state": state}
        
        return {"authorization_url": authorization_url}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initiating OAuth: {str(e)}")

@app.get("/api/oauth2callback")
async def oauth2callback(request: Request):
    """Handle OAuth callback"""
    try:
        # Get authorisation code and state from callback
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state parameter")
        
        # Verify state exists
        if f"state_{state}" not in sessions:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Exchange code for credentials
        flow = create_flow(state=state)
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        sessions[session_id] = {
            "credentials": {
                "token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes
            }
        }
        
        # Clean up state session
        del sessions[f"state_{state}"]
        
        # Redirect to frontend with session cookie AND authenticated flag
        response = RedirectResponse(url="/?authenticated=true")
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            max_age=3600 * 24 * 7,  # 7 days
            samesite="lax"
        )
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback error: {str(e)}")


@app.get("/api/auth/logout")
async def logout(request: Request):
    """Logout user"""
    session_id = request.cookies.get("session_id")
    
    if session_id and session_id in sessions:
        del sessions[session_id]
    
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("session_id")
    
    return response

@app.get("/api/auth/picker-token")
async def get_picker_token(request: Request):
    """Get access token for Google Picker API"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        credentials = get_credentials_from_session(session_id)
        
        # Refresh token if expired
        if credentials.expired:
            from google.auth.transport.requests import Request as GoogleRequest
            credentials.refresh(GoogleRequest())
            update_session_token(session_id, credentials)
        
        return {
            "access_token": credentials.token,
            "token_type": "Bearer"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting token: {str(e)}")

@app.get("/api/auth/api-key")
async def get_api_key():
    """Get Google API Key for Picker API"""
    if GOOGLE_API_KEY == 'NO_API_KEY':
        raise HTTPException(
            status_code=500, 
            detail="Google API Key not configured. Set GOOGLE_API_KEY environment variable."
        )
    
    return {"api_key": GOOGLE_API_KEY}

@app.get("/api/drive/files")
async def list_drive_files(request: Request, max_results: int = 10):
    """List files from Google Drive"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        credentials = get_credentials_from_session(session_id)
        
        # Build Drive service
        service = build('drive', 'v3', credentials=credentials, static_discovery=False)
        
        # List files
        results = service.files().list(
            pageSize=max_results,
            fields="nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)"
        ).execute()
        
        items = results.get('files', [])
        
        # Update session with potentially refreshed token
        update_session_token(session_id, credentials)
        
        return {
            "success": True,
            "files": items,
            "count": len(items)
        }
    
    except HttpError as error:
        raise HTTPException(status_code=500, detail=f"Drive API Error: {str(error)}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

SIMILARITY_THRESHOLD =20 # Adjust as needed

@app.post("/api/compute/phash-group")
async def compute_phash_group(images: List[UploadFile] = File(...)):
    """
    Compute pHashes for uploaded images and group visually similar images.
    Only returns groups with more than one image.
    """
    phash_dict = {}

    # Compute pHash for each image
    for img_file in images:
        try:
            contents = await img_file.read()
            image = Image.open(io.BytesIO(contents))
            phash_dict[img_file.filename] = imagehash.phash(image)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Error processing {img_file.filename}: {str(e)}"
            )

    # Create adjacency list for similar images
    adjacency = {fname: set() for fname in phash_dict.keys()}
    filenames = list(phash_dict.keys())

    for i, file1 in enumerate(filenames):
        for j in range(i + 1, len(filenames)):
            file2 = filenames[j]
            if phash_dict[file1] - phash_dict[file2] <= SIMILARITY_THRESHOLD:
                adjacency[file1].add(file2)
                adjacency[file2].add(file1)

    # Find connected components (groups)
    visited = set()
    groups = []

    def dfs(node, group):
        visited.add(node)
        group.append(node)
        for neighbor in adjacency[node]:
            if neighbor not in visited:
                dfs(neighbor, group)

    for fname in filenames:
        if fname not in visited:
            group = []
            dfs(fname, group)
            # Only keep groups with more than 1 image
            if len(group) > 1:
                groups.append(group)

    # Convert phash to string for response
    phash_str = {fname: str(hash_val) for fname, hash_val in phash_dict.items()}

    return {"success": True, "phash": phash_str, "groups": groups}
@app.get("/api/drive/download/{file_id}")
async def download_file(file_id: str, request: Request):
    """Download a file from Google Drive"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        credentials = get_credentials_from_session(session_id)
        service = build('drive', 'v3', credentials=credentials, static_discovery=False)
        
        # Get file metadata
        file_metadata = service.files().get(fileId=file_id, fields='name,mimeType').execute()
        
        # Download file content
        request_obj = service.files().get_media(fileId=file_id)
        file_content = io.BytesIO()
        
        from googleapiclient.http import MediaIoBaseDownload
        downloader = MediaIoBaseDownload(file_content, request_obj)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        # Reset file pointer
        file_content.seek(0)
        
        # Update session with potentially refreshed token
        update_session_token(session_id, credentials)
        
        # Return file as streaming response
        return StreamingResponse(
            file_content,
            media_type=file_metadata.get('mimeType', 'application/octet-stream'),
            headers={
                'Content-Disposition': f'attachment; filename="{file_metadata.get("name", "file")}"'
            }
        )
    
    except HttpError as error:
        if error.resp.status == 404:
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=f"Drive API Error: {str(error)}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")

@app.get("/api/drive/folder-images/{folder_id}")
async def get_folder_images(folder_id: str, request: Request):
    """Get all image files from a folder (recursively)"""
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        credentials = get_credentials_from_session(session_id)
        service = build('drive', 'v3', credentials=credentials, static_discovery=False)
        
        def get_images_recursive(folder_id: str) -> List[dict]:
            """Recursively get all images from folder and subfolders"""
            images = []
            
            # Query for files in this folder
            query = f"'{folder_id}' in parents and trashed=false"
            page_token = None
            
            while True:
                results = service.files().list(
                    q=query,
                    fields="nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink, webViewLink)",
                    pageToken=page_token,
                    pageSize=100
                ).execute()
                
                files = results.get('files', [])
                
                for file in files:
                    mime_type = file.get('mimeType', '')
                    
                    # If it's a folder, recurse into it
                    if mime_type == 'application/vnd.google-apps.folder':
                        images.extend(get_images_recursive(file['id']))
                    
                    # If it's an image, add it to the list
                    elif mime_type.startswith('image/'):
                        images.append({
                            'id': file['id'],
                            'name': file['name'],
                            'mimeType': mime_type,
                            'url': file.get('webViewLink'),
                            'thumbnailUrl': file.get('thumbnailLink'),
                            'sizeBytes': file.get('size')
                        })
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            return images
        
        # Get all images from folder
        images = get_images_recursive(folder_id)
        
        # Update session with potentially refreshed token
        update_session_token(session_id, credentials)
        
        return {
            "success": True,
            "files": images,
            "count": len(images)
        }
    
    except HttpError as error:
        if error.resp.status == 404:
            raise HTTPException(status_code=404, detail="Folder not found")
        raise HTTPException(status_code=500, detail=f"Drive API Error: {str(error)}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting folder images: {str(e)}")
    
@app.get("/api/auth/onedrive/status")
async def onedrive_auth_status(request: Request):
    """Check if user is authenticated with OneDrive"""
    session_id = request.cookies.get("onedrive_session_id")
    
    if session_id and session_id in onedrive_sessions:
        return {"authenticated": True}
    
    return {"authenticated": False}

@app.get("/api/auth/onedrive/login")
async def onedrive_login(request: Request):
    """Initiate OneDrive OAuth flow"""
    try:
        app_client = create_msal_app()
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Build authorization URL
        auth_url = app_client.get_authorization_request_url(
            scopes=ONEDRIVE_SCOPES,
            state=state,
            redirect_uri=MICROSOFT_REDIRECT_URI
        )
        
        # Store state temporarily
        onedrive_sessions[f"state_{state}"] = {"state": state}
        
        return {"authorization_url": auth_url}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error initiating OneDrive OAuth: {str(e)}")

@app.get("/api/auth/onedrive/callback")
async def onedrive_callback(request: Request):
    """Handle OneDrive OAuth callback"""
    try:
        # Get authorization code and state from callback
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        error = request.query_params.get('error')
        
        if error:
            raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state parameter")
        
        # Verify state exists
        if f"state_{state}" not in onedrive_sessions:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Exchange code for token
        app_client = create_msal_app()
        
        result = app_client.acquire_token_by_authorization_code(
            code,
            scopes=ONEDRIVE_SCOPES,
            redirect_uri=MICROSOFT_REDIRECT_URI
        )
        
        if 'access_token' not in result:
            error_desc = result.get('error_description', 'Unknown error')
            raise HTTPException(status_code=400, detail=f"Token exchange failed: {error_desc}")
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        onedrive_sessions[session_id] = {
            'access_token': result['access_token'],
            'refresh_token': result.get('refresh_token'),
            'expires_in': result.get('expires_in', 3600),
            'token_type': result.get('token_type', 'Bearer')
        }
        
        # Clean up state session
        del onedrive_sessions[f"state_{state}"]
        
        # Redirect to frontend with session cookie
        response = RedirectResponse(url="/?authenticated=true")
        response.set_cookie(
            key="onedrive_session_id",
            value=session_id,
            httponly=True,
            max_age=3600 * 24 * 7,  # 7 days
            samesite="lax"
        )
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OneDrive OAuth callback error: {str(e)}")

@app.get("/api/auth/onedrive/logout")
async def onedrive_logout(request: Request):
    """Logout from OneDrive"""
    session_id = request.cookies.get("onedrive_session_id")
    
    if session_id and session_id in onedrive_sessions:
        del onedrive_sessions[session_id]
    
    response = JSONResponse({"message": "Logged out from OneDrive successfully"})
    response.delete_cookie("onedrive_session_id")
    
    return response

@app.get("/api/auth/onedrive/picker-token")
async def get_onedrive_picker_token(request: Request):
    """Get access token for OneDrive Picker"""
    session_id = request.cookies.get("onedrive_session_id")
    
    if not session_id or session_id not in onedrive_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated with OneDrive")
    
    try:
        credentials = get_onedrive_credentials(session_id)
        
        # TODO: Implement token expiry check and refresh if needed
        # For now, return the current token
        
        return {
            "access_token": credentials['access_token'],
            "token_type": credentials.get('token_type', 'Bearer')
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting OneDrive token: {str(e)}")
    
@app.get("/api/auth/onedrive/client-id")
async def get_onedrive_client_id():
    """Get Microsoft Client ID for OneDrive Picker"""
    return {"client_id": MICROSOFT_CLIENT_ID}

@app.get("/api/onedrive/download/{file_id}")
async def download_onedrive_file(file_id: str, request: Request):
    """Download a file from OneDrive"""
    session_id = request.cookies.get("onedrive_session_id")
    
    if not session_id or session_id not in onedrive_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated with OneDrive")
    
    try:
        credentials = get_onedrive_credentials(session_id)
        access_token = credentials['access_token']
        
        # Get file download URL from Microsoft Graph API
        async with httpx.AsyncClient() as client:
            # First, get file metadata
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            graph_url = f'https://graph.microsoft.com/v1.0/me/drive/items/{file_id}'
            response = await client.get(graph_url, headers=headers)
            
            if response.status_code == 401:
                # Token might be expired, try to refresh
                access_token = await refresh_access_token(session_id)
                headers['Authorization'] = f'Bearer {access_token}'
                response = await client.get(graph_url, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get file metadata: {response.text}"
                )
            
            file_data = response.json()
            
            # Get download URL
            download_url = file_data.get('@microsoft.graph.downloadUrl')
            if not download_url:
                raise HTTPException(status_code=404, detail="Download URL not found")
            
            # Download the file
            file_response = await client.get(download_url)
            
            if file_response.status_code != 200:
                raise HTTPException(
                    status_code=file_response.status_code,
                    detail="Failed to download file"
                )
            
            # Return file as streaming response
            return StreamingResponse(
                io.BytesIO(file_response.content),
                media_type=file_data.get('file', {}).get('mimeType', 'application/octet-stream'),
                headers={
                    'Content-Disposition': f'attachment; filename="{file_data.get("name", "file")}"'
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading OneDrive file: {str(e)}")

@app.get("/api/onedrive/folder-images/{folder_id}")
async def get_onedrive_folder_images(folder_id: str, request: Request):
    """Get all image files from a OneDrive folder (recursively)"""
    session_id = request.cookies.get("onedrive_session_id")
    
    if not session_id or session_id not in onedrive_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated with OneDrive")
    
    try:
        credentials = get_onedrive_credentials(session_id)
        access_token = credentials['access_token']
        
        async def get_images_recursive(folder_id: str, client: httpx.AsyncClient) -> list:
            """Recursively get all images from folder and subfolders"""
            images = []
            
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            # Get folder contents
            graph_url = f'https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}/children'
            response = await client.get(graph_url, headers=headers)
            
            if response.status_code == 401:
                # Token might be expired, try to refresh
                new_token = await refresh_access_token(session_id)
                headers['Authorization'] = f'Bearer {new_token}'
                response = await client.get(graph_url, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get folder contents: {response.text}"
                )
            
            items = response.json().get('value', [])
            
            for item in items:
                # If it's a folder, recurse into it
                if 'folder' in item:
                    sub_images = await get_images_recursive(item['id'], client)
                    images.extend(sub_images)
                
                # If it's an image file
                elif 'file' in item:
                    mime_type = item.get('file', {}).get('mimeType', '')
                    if mime_type.startswith('image/'):
                        images.append({
                            'id': item['id'],
                            'name': item['name'],
                            'mimeType': mime_type,
                            'url': item.get('webUrl'),
                            'thumbnailUrl': item.get('thumbnails', [{}])[0].get('large', {}).get('url') if item.get('thumbnails') else None,
                            'sizeBytes': item.get('size')
                        })
            
            return images
        
        # Get all images from folder
        async with httpx.AsyncClient(timeout=30.0) as client:
            images = await get_images_recursive(folder_id, client)
        
        return {
            "success": True,
            "files": images,
            "count": len(images)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting OneDrive folder images: {str(e)}")

@app.post("/api/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Upload images and process them with Gemini Vision Pro.
    Streams results back to the client as Server-Sent Events (SSE).
    """
    if processor is None:
        raise HTTPException(status_code=500, detail="ImageProcessor not initialized. Check Gemini API setup.")
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # CRITICAL FIX: Save files BEFORE creating the generator
    temp_dir = Path("./temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    
    file_count = len(files)
    print(f"Starting upload of {file_count} files...")
    
    try:
        # Save all files immediately
        for i, file in enumerate(files):
            file_path = temp_dir / f"{i}_{file.filename}"
            content = await file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            print(f"Saved: {file.filename} -> {file_path}")
        
    except Exception as e:
        try:
            shutil.rmtree(temp_dir)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to save files: {str(e)}")
    
    async def generate_stream():
        """Generator function that yields SSE events"""
        try:
            yield f"data: {json.dumps({'status': 'uploading', 'message': f'Received {file_count} files'})}\n\n"
            
            for i in range(file_count):
                yield f"data: {json.dumps({'status': 'uploading', 'progress': i + 1, 'total': file_count})}\n\n"
            
            yield f"data: {json.dumps({'status': 'processing', 'message': 'Loading images...'})}\n\n"
            
            data_loader = DataLoader(folder_path=str(temp_dir), objs=None)
            images = data_loader.load_images_from_folder_path()
            
            if not images:
                yield f"data: {json.dumps({'status': 'error', 'message': 'No valid images found'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'processing', 'message': f'Sending {len(images)} images to Gemini...'})}\n\n"
            
            processed_images = processor.gemini_inference(images)
            
            if processed_images is None:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Gemini processing failed'})}\n\n"
                return
            
            for i, img_container in enumerate(processed_images):
                result_data = {
                    'status': 'result',
                    'index': i,
                    'total': len(processed_images),
                    'original_name': os.path.basename(img_container.filepath),
                    'result': img_container.gemini_response
                }
                yield f"data: {json.dumps(result_data)}\n\n"
            
            yield f"data: {json.dumps({'status': 'complete', 'message': 'All images processed successfully'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': f'Processing error: {str(e)}'})}\n\n"
        
        finally:
            try:
                shutil.rmtree(temp_dir)
                print(f"Cleaned up {temp_dir}")
            except Exception as e:
                print(f"Error cleaning up temp files: {e}")
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_file = FRONTEND_DIR / "index.html"
    
    if index_file.exists():
        return FileResponse(index_file)
    else:
        return {"error": "Frontend not built. Run 'npm run build' in the frontend directory."}

if __name__ == "__main__":
    import uvicorn
    
    if not os.path.exists(CLIENT_SECRET_FILE):
        print(f"{CLIENT_SECRET_FILE} not found!")
        exit(1)

    if GOOGLE_API_KEY == 'YOUR_API_KEY_HERE':
        print("GOOGLE_API_KEY not set!")
    
    print("Starting server on http://localhost:8001")
    print(f"Scopes: {', '.join(SCOPES)}")
    
    uvicorn.run(app, host="0.0.0.0", port=8001)