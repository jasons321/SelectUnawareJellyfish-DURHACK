from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
import io
from collections import defaultdict
import json
import io

# Create FastAPI instance
app = FastAPI(
    title="Google Drive API Server",
    description="FastAPI server with Google Drive OAuth integration and Picker API support",
    version="2.0.0"
)

CLIENT_SECRET_FILE = 'client_secret.json'
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'NO_API_KEY')

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
async def login():
    """Initiate OAuth flow"""
    try:
        flow = create_flow()
        
        # Generate authorisation URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            prompt='consent'  # Force consent to get refresh token
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
            credentials.refresh(Request())
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
    """
    phash_dict = {}

    # Compute pHash for each image
    for img_file in images:
        try:
            contents = await img_file.read()
            image = Image.open(io.BytesIO(contents))
            phash_dict[img_file.filename] = imagehash.phash(image)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {img_file.filename}: {str(e)}")

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

# Serve React App (catch-all route for SPA)
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
