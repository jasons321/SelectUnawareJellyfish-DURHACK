from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os
from pathlib import Path

# Create FastAPI instance
app = FastAPI(
    title="My FastAPI Server",
    description="A basic FastAPI server to get started",
    version="1.0.0"
)

# Path to frontend build directory
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

# Mount static files (CSS, JS, images, etc.)
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
else:
    print(f"Warning: Frontend directory not found at {FRONTEND_DIR}")

# Example data model
class Item(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    quantity: int = 0

# API Routes (prefixed with /api)
@app.get("/api")
async def root():
    return {"message": "Welcome to FastAPI!"}

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# GET endpoint with path parameter
@app.get("/api/items/{item_id}")
async def read_item(item_id: int, q: Optional[str] = None):
    result = {"item_id": item_id}
    if q:
        result["q"] = q
    return result

# POST endpoint
@app.post("/api/items/")
async def create_item(item: Item):
    return {
        "message": "Item created successfully",
        "item": item
    }

# PUT endpoint
@app.put("/api/items/{item_id}")
async def update_item(item_id: int, item: Item):
    return {
        "message": f"Item {item_id} updated",
        "item": item
    }

# DELETE endpoint
@app.delete("/api/items/{item_id}")
async def delete_item(item_id: int):
    return {"message": f"Item {item_id} deleted"}

# Serve React App (catch-all route for SPA)
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve the React app for all non-API routes"""
    index_file = FRONTEND_DIR / "index.html"
    
    if index_file.exists():
        return FileResponse(index_file)
    else:
        return {"error": "Frontend not built. Run 'npm run build' in the frontend directory."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)