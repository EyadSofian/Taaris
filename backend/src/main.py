"""FastAPI entrypoint — Taaris voice companion.

Endpoints:
  GET  /health        liveness + config summary
  GET  /api/personas  persona metadata for the selector
  POST /api/chat      {messages, persona} -> {reply, persona_used}   (Ollama)
  POST /api/stt       multipart audio     -> {text}                  (Deepgram)
  POST /api/tts       {text, voice_id?}   -> audio/mpeg              (ElevenLabs)

Run from backend/:  uvicorn src.main:app --reload
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from src.agent.personas.core import PERSONA_META, build_system_prompt
from src.config import settings
from src.llm.ollama_client import chat as ollama_chat
from src.stt.deepgram import transcribe
from src.tts.elevenlabs import synthesize

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("taaris")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "Taaris starting — persona=%s, model=%s, voice=%s",
        settings.default_persona,
        settings.ollama_model,
        bool(settings.elevenlabs_voice_id),
    )
    yield
    log.info("Taaris shutting down")


app = FastAPI(title="Taaris", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── models ──────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    persona: str = "jarvis"


class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None


# ── endpoints ───────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "taaris",
        "version": "0.2.0",
        "model": settings.ollama_model,
        "persona": settings.default_persona,
        "stt": "deepgram" if settings.deepgram_api_key else "disabled",
        "tts": "elevenlabs" if settings.elevenlabs_api_key else "disabled",
    }


@app.get("/api/personas")
async def personas() -> dict:
    return {"default": settings.default_persona, "personas": PERSONA_META}


@app.post("/api/chat")
async def chat(req: ChatRequest) -> dict:
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    user_text = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    system, used = build_system_prompt(req.persona, settings.owner_name, user_text=user_text)
    msgs = [{"role": "system", "content": system}] + [m.model_dump() for m in req.messages]
    try:
        reply = await ollama_chat(msgs)
    except Exception as e:  # noqa: BLE001 - surface upstream error to the client
        log.exception("chat failed")
        raise HTTPException(502, f"LLM error: {e}") from e
    return {"reply": reply, "persona_used": used}


@app.post("/api/stt")
async def stt(file: UploadFile = File(...)) -> dict:
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "empty audio")
    try:
        text = await transcribe(audio, file.content_type or "audio/webm")
    except Exception as e:  # noqa: BLE001
        log.exception("stt failed")
        raise HTTPException(502, f"STT error: {e}") from e
    return {"text": text}


@app.post("/api/tts")
async def tts(req: TTSRequest) -> Response:
    if not req.text.strip():
        raise HTTPException(400, "empty text")
    try:
        audio = await synthesize(req.text, voice_id=req.voice_id)
    except Exception as e:  # noqa: BLE001
        log.exception("tts failed")
        raise HTTPException(502, f"TTS error: {e}") from e
    return Response(content=audio, media_type="audio/mpeg")


def run() -> None:
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )


if __name__ == "__main__":
    run()
