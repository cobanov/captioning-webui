from typing import List, Optional
from pydantic import BaseModel

class ScanRequest(BaseModel):
    folder_path: str

class ImageItem(BaseModel):
    filename: str
    absolute_path: str
    has_caption: bool
    caption_content: Optional[str] = None

class CaptionRequest(BaseModel):
    api_key: str
    model: str
    image_path: str

class SaveRequest(BaseModel):
    image_path: str
    caption_text: str

class DeleteRequest(BaseModel):
    image_path: str
