# AI Companion

Personal, voice-capable, local-first AI companion with a custom web UI, browser control, guarded
Windows control, long-term memory, and 4 selectable personalities. See **PLAN.md** for the full
build plan and **CLAUDE.md** for project context.

## Status
**Phase 0 complete** — repo scaffolded, backend `/health` + WebSocket echo, React/Vite/Tailwind echo UI,
hardware detection. No STT/LLM/tools yet (those start in Phase 1).

## Prerequisites
- Python 3.10+ (⚠️ **3.11+ required before Phase 4** for browser-use)
- Node 20+
- Ollama (model already present: `qwen3:8b`)
- Docker (for Postgres+pgvector, from Phase 2)
- ffmpeg (needed from Phase 1 — `winget install Gyan.FFmpeg`)

## Quick start

### 0. Hardware check + config
```bash
python scripts/detect_hardware.py
cp .env.example .env          # then fill keys as phases need them
```

### 1. Backend  (terminal A)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate         # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --reload  # -> http://127.0.0.1:8000
```
Check: open http://127.0.0.1:8000/health → `{"status":"ok", ...}`

### 2. Frontend  (terminal B)
```bash
cd frontend
npm install
npm run dev                    # -> http://localhost:5173
```
The UI connects to the backend WebSocket (proxied) and echoes whatever you type.

## Phase 0 acceptance
- [x] `scripts/detect_hardware.py` prints the recommended model
- [x] backend `/health` returns ok
- [x] frontend loads a chat at localhost and echoes over WebSocket
- [ ] `ollama run qwen3:8b "قول اهلا"` returns Arabic  ← run this yourself to confirm the model

## Layout
```
backend/   FastAPI + agent + tools + memory + safety
frontend/  React + Vite + Tailwind UI
scripts/   detect_hardware.py
docker-compose.yml  Postgres + pgvector (Phase 2)
```

## Safety
Browser & Windows control ship with mandatory guardrails (confirmation, denylist, scoped workdir,
audit log, panic-stop). See PLAN.md §5 before using Phases 4–5. Test in a throwaway folder first and
keep confirmation mode ON.
