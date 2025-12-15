import base64
import glob
import os
from typing import List, Optional

import aiofiles
import httpx
from fastapi import HTTPException

from api.schemas import ImageItem

async def scan_folder_for_images(folder_path: str) -> List[ImageItem]:
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.webp']
    files: List[str] = []
    
    for ext in image_extensions:
        files.extend(glob.glob(os.path.join(folder_path, ext)))
        files.extend(glob.glob(os.path.join(folder_path, ext.upper())))
    
    files = list(set(files))
    files.sort()
    
    images: List[ImageItem] = []
    
    for f in files:
        base_name = os.path.splitext(f)[0]
        caption_path = base_name + ".txt"
        has_caption = os.path.exists(caption_path)
        caption_content: Optional[str] = None
        
        if has_caption:
            async with aiofiles.open(caption_path, mode='r') as cf:
                caption_content = await cf.read()
        
        images.append(ImageItem(
            filename=os.path.basename(f),
            absolute_path=f,
            has_caption=has_caption,
            caption_content=caption_content
        ))
        
    return images

async def generate_caption_with_openai(api_key: str, model: str, image_path: str) -> str:
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
        
    async with aiofiles.open(image_path, "rb") as image_file:
        image_data = await image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Caption this image in a single, detailed, and concise sentence."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_completion_tokens": 4096
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            result = response.json()
            # print(f"\033[94mDEBUG OpenAI Response: {result}\033[0m") # Removed debug print for cleanup
            return result['choices'][0]['message']['content']
        except httpx.HTTPStatusError as exc:
             error_msg = f"OpenAI API Error: {exc.response.text}"
             print(f"\033[91m{error_msg}\033[0m") # Keep error logging
             raise HTTPException(status_code=exc.response.status_code, detail=error_msg)
        except Exception as e:
            print(f"\033[91mUnexpected Error: {str(e)}\033[0m")
            raise HTTPException(status_code=500, detail=str(e))

async def save_caption_file(image_path: str, caption_text: str) -> str:
    base_name = os.path.splitext(image_path)[0]
    caption_path = base_name + ".txt"
    
    try:
        async with aiofiles.open(caption_path, mode='w') as f:
            await f.write(caption_text)
        return caption_path
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def delete_caption_file(image_path: str) -> bool:
    base_name = os.path.splitext(image_path)[0]
    caption_path = base_name + ".txt"
    
    try:
        if os.path.exists(caption_path):
            os.remove(caption_path)
            return True
        return False
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
