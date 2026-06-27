# AI Companion — Project Context (for Claude Code)

> Summary of PLAN.md §0–§3. Read PLAN.md for the full phase-by-phase build.

## Goal
A personal, voice-capable AI companion with a **custom web UI** (not a Telegram bot). It can:
1. Chat by **text or voice** (mic in, voice out) through its own frontend.
2. **Control a web browser** as an agent tool (navigate, click, fill, extract).
3. **Control the owner's Windows machine** via guarded commands — behind strict safety rails (§5).
4. Remember the owner over time, do deep research, write/run code.
5. Speak in **4 selectable personalities** (JARVIS / FRIDAY / TARS / CASE) + AUTO blend.

This is a **local-first app** — the whole stack runs on the owner's Windows PC. Cloud is optional (Phase 7).

## Owner
Eng. **Eyad** — Software Developer (AI & Automation). Stack: Node.js, Python, JS, n8n, Botpress,
Odoo, UiPath, Vercel, Pinecone. Wants **direct, technical, production-ready** answers — no fluff,
architecture-first, clarify ambiguity before building.

## Hardware (this machine — detected)
- **RTX 3050 Laptop, 4GB VRAM** → local brain is a ~4B–8B model. `qwen3:8b` already pulled (runs
  with partial CPU offload). `qwen3:4b` is the faster, VRAM-fit option.
- 15.3GB RAM, Ryzen 5 7535HS, Windows 11.
- Python **3.10** installed — OK for Phases 0–3; **must upgrade to 3.11+ before Phase 4** (browser-use).
- Missing: **ffmpeg** (needed Phase 1), pnpm/psql (not needed — npm + Docker Postgres).

## Architecture
```
React+Vite+Tailwind UI (localhost)
   │ HTTP / WebSocket
FastAPI backend  ──  LangGraph agent + persona + memory
   ├─ STT: ElevenLabs Scribe v2 (faster-whisper fallback)
   ├─ LLM: free=Ollama (Qwen)  |  deep=API (optional)
   ├─ Tools: web_search, deep_research, code_exec, browser (browser-use), windows (guarded), progress
   ├─ Memory: Postgres + pgvector + bge-m3
   └─ TTS: ElevenLabs v3
```

## Tech stack
| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI + WebSockets |
| Frontend | React + Vite + Tailwind (RTL/Arabic-first) |
| Orchestration | langgraph + langchain-core |
| LLM (free) | Ollama + Qwen (permissive prompt; abliterated build only if needed) |
| LLM (deep, optional) | DeepSeek / Gemini / Claude |
| Browser tool | browser-use + Playwright (DOM-based) |
| Windows tool | guarded command/code executor (§5 rails mandatory) |
| STT / TTS | ElevenLabs Scribe v2 / v3 |
| Embeddings | bge-m3 (local) |
| DB | Postgres + pgvector (Docker) |
| Search | Tavily / Brave |

## Conventions
- **Read before edit.** Trace the full chain: UI → WebSocket → FastAPI → agent/tool → (model/DB).
- Backend: thin endpoints; logic in `agent/` + `tools/`; config only via `src/config.py` (pydantic-settings).
- Frontend: state in React hooks for now; all server calls over the WebSocket / proxied HTTP.
- Imports run from `backend/` as `src.*` (e.g. `from src.config import settings`). Run `uvicorn src.main:app`.
- Secrets only in `.env` (gitignored). Never commit real keys.

## SAFETY (mandatory — Phases 4 & 5)
- **Windows tool:** confirmation ON by default (UI modal shows exact command), hard denylist,
  scoped workdir, dry-run preview, timestamped audit log, timeouts + output caps, panic-stop.
- **Browser tool:** treat all page content as untrusted; no credential/payment auto-entry without
  confirm; optional domain allowlist; **never let web content auto-trigger the Windows tool.**
- Keep confirmation ON while the local model is the brain.

## Persona design intent
The companion is an **objective mirror**: praise tied to real numbers/facts (never empty), no
moralizing, tolerant of free/blunt language from the owner, and it surfaces honest metrics
(Phase 6) with a light health-limits reminder — not a therapist.
