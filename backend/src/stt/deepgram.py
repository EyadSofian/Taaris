"""Deepgram speech-to-text (prerecorded) via httpx."""
from __future__ import annotations

import logging

import httpx

from src.config import settings

log = logging.getLogger("taaris.stt")

_URL = "https://api.deepgram.com/v1/listen"

# Browser MediaRecorder may send "audio/webm;codecs=opus" — Deepgram only
# wants the MIME base type, so we strip everything after the semicolon.
def _clean_mime(ct: str) -> str:
    return (ct or "audio/webm").split(";")[0].strip()


async def transcribe(audio: bytes, content_type: str = "audio/webm") -> str:
    """Transcribe audio bytes to text. Returns '' if nothing was recognized."""
    if not settings.deepgram_api_key:
        raise RuntimeError("DEEPGRAM_API_KEY not set")

    if len(audio) < 100:
        log.warning("Audio too short (%d bytes), skipping STT", len(audio))
        return ""

    clean_ct = _clean_mime(content_type)
    log.info("STT request: %d bytes, content_type=%s → %s", len(audio), content_type, clean_ct)

    params = {
        "model": settings.deepgram_model,
        "language": settings.deepgram_language,
        "smart_format": "true",
        "punctuate": "true",
        "detect_language": "true",
    }
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": clean_ct,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(_URL, params=params, headers=headers, content=audio)
        if r.status_code != 200:
            log.error("Deepgram returned %d: %s", r.status_code, r.text[:500])
            r.raise_for_status()
        data = r.json()

    try:
        text = data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
        log.info("STT result: '%s'", text[:100])
        return text
    except (KeyError, IndexError):
        log.warning("STT returned no transcript, response: %s", str(data)[:300])
        return ""
