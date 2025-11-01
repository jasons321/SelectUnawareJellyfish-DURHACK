from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse, JSONResponse
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

# Create FastAPI instance
app = FastAPI(
    title="Google Drive API Server",
    description="FastAPI server with Google Drive OAuth integration",
    version="1.0.0"
)

CLIENT_SECRET_FILE = 'client_secret.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

sessions: Dict[str, dict] = {}

# Path to frontend build directory
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

# Mount static files (CSS, JS, images, etc.)
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

@app.get("/api")
async def root():
    return {"message": "Welcome to Google Drive API!"}

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
            # include_granted_scopes='true',
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

@app.get("/api/drive/files")
async def list_drive_files(request: Request, max_results: int = 10):
    """List files from Google Drive"""
    # Check authentication
    session_id = request.cookies.get("session_id")
    
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Get credentials from session
        creds_data = sessions[session_id]["credentials"]
        credentials = Credentials(
            token=creds_data["token"],
            refresh_token=creds_data.get("refresh_token"),
            token_uri=creds_data["token_uri"],
            client_id=creds_data["client_id"],
            client_secret=creds_data["client_secret"],
            scopes=creds_data["scopes"]
        )
        
        # Build Drive service
        service = build('drive', 'v3', credentials=credentials, static_discovery=False)
        
        # List files
        results = service.files().list(
            pageSize=max_results,
            fields="nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)"
        ).execute()
        
        items = results.get('files', [])
        
        # Update session with potentially refreshed token
        if credentials.token != creds_data["token"]:
            sessions[session_id]["credentials"]["token"] = credentials.token
        
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
    
    # Check if client_secret.json exists
    if not os.path.exists(CLIENT_SECRET_FILE):
        print(f"ERROR: {CLIENT_SECRET_FILE} not found!")
        exit(1)
    
    print("Starting server on http://localhost:8001")
    
    uvicorn.run(app, host="0.0.0.0", port=8001)
