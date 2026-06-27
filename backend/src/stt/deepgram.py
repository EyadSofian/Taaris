"""Deepgram speech-to-text (prerecorded) via httpx."""
from __future__ import annotations

import httpx

from src.config import settings

_URL = "https://api.deepgram.com/v1/listen"


async def transcribe(audio: bytes, content_type: str = "audio/webm") -> str:
    """Transcribe audio bytes to text. Returns '' if nothing was recognized."""
    if not settings.deepgram_api_key:
        raise RuntimeError("DEEPGRAM_API_KEY not set")

    params = {
        "model": settings.deepgram_model,
        "language": settings.deepgram_language,
        "smart_format": "true",
        "punctuate": "true",
    }
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": content_type or "audio/webm",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(_URL, params=params, headers=headers, content=audio)
        r.raise_for_status()
        data = r.json()

    try:
        return data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
    except (KeyError, IndexError):
        return ""
