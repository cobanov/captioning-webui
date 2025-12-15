from typing import List

from fastapi import APIRouter, File, HTTPException
from fastapi.responses import FileResponse

from api.schemas import ScanRequest, ImageItem, CaptionRequest, SaveRequest, DeleteRequest
from api.services import scan_folder_for_images, generate_caption_with_openai, save_caption_file, delete_caption_file

router = APIRouter()

@router.post("/select-folder")
async def select_folder_dialog():
    # Folder picker disabled - use manual path entry
    return {"folder_path": None}

@router.post("/scan", response_model=List[ImageItem])
async def scan_folder(request: ScanRequest):
    return await scan_folder_for_images(request.folder_path)

@router.get("/image")
async def get_image(path: str):
    # Security note: In a real app we should validate this path is within allowed directories
    return FileResponse(path)

@router.post("/caption")
async def generate_caption(request: CaptionRequest):
    caption = await generate_caption_with_openai(request.api_key, request.model, request.image_path)
    return {"caption": caption}

@router.post("/save")
async def save_caption(request: SaveRequest):
    path = await save_caption_file(request.image_path, request.caption_text)
    return {"status": "success", "path": path}

@router.post("/delete")
async def delete_caption(request: DeleteRequest):
    deleted = await delete_caption_file(request.image_path)
    return {"status": "success", "deleted": deleted}
