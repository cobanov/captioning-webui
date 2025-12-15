# Cobanov Captioning

AI-powered image captioning tool using OpenAI vision models.

## Quick Start

```bash
uv sync
uvicorn main:app --reload --port 8000
```

Open `http://127.0.0.1:8000`

## Usage

1. Enter your OpenAI API key
2. Select a folder with images
3. Click "Generate" or "Caption All"

Captions are saved as `.txt` files next to each image.
