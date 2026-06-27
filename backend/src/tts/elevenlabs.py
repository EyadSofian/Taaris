"""ElevenLabs text-to-speech via httpx. Returns mp3 bytes."""
from __future__ import annotations

import httpx

from src.config import settings


async def synthesize(text: str, *, voice_id: str | None = None) -> bytes:
    """Synthesize speech for `text` and return mp3 audio bytes."""
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set")
    vid = voice_id or settings.elevenlabs_voice_id
    if not vid:
        raise RuntimeError("ELEVENLABS_VOICE_ID not set")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": settings.elevenlabs_tts_model,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }
    params = {"output_format": "mp3_44100_128"}
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=headers, params=params, json=payload)
        r.raise_for_status()
        return r.content
