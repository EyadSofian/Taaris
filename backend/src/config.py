"""Central configuration via pydantic-settings (reads .env / environment)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Loads backend/.env first, then repo-root ../.env; real env vars always win.
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM
    llm_mode: str = "free"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    deep_api_provider: str = ""
    deep_api_key: str = ""

    # Voice — TTS (ElevenLabs)
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_tts_model: str = "eleven_multilingual_v2"

    # Voice — STT (Deepgram)
    deepgram_api_key: str = ""
    deepgram_model: str = "nova-2"
    deepgram_language: str = "ar"

    # Web search
    tavily_api_key: str = ""
    brave_api_key: str = ""

    # Memory
    database_url: str = "postgresql://companion:companion@localhost:5432/companion"
    embedding_model: str = "BAAI/bge-m3"

    # Persona
    owner_name: str = "Eyad"
    default_persona: str = "jarvis"

    # Safety — Windows tool
    windows_tool_require_confirm: bool = True
    windows_tool_workdir: str = "./workspace"
    windows_tool_timeout_sec: int = 30
    windows_tool_output_cap: int = 20000

    # Safety — Browser tool
    browser_headless: bool = False
    browser_domain_allowlist: str = ""

    # Server
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
