"""Ollama chat client (REST via httpx). Disables/strips <think> for reasoning models."""
from __future__ import annotations

import re

import httpx

from src.config import settings

_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


async def chat(messages: list[dict], *, model: str | None = None, temperature: float = 0.7) -> str:
    """Send a chat completion to Ollama and return the assistant's text."""
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model or settings.ollama_model,
        "messages": messages,
        "stream": False,
        "think": False,  # qwen3 etc. — skip reasoning trace
        "options": {"temperature": temperature, "num_ctx": 4096},
    }
    async with httpx.AsyncClient(timeout=180) as client:
        try:
            r = await client.post(url, json=payload)
            r.raise_for_status()
        except httpx.HTTPStatusError:
            # Older Ollama may reject "think"; retry without it.
            payload.pop("think", None)
            r = await client.post(url, json=payload)
            r.raise_for_status()
        data = r.json()

    content = (data.get("message") or {}).get("content", "")
    return _THINK.sub("", content).strip()
