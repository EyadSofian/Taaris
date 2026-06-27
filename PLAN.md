# Personal AI Companion — Build Plan v2

> For each phase, paste the **"▶ Claude Code prompt"** block, implement, run the **Acceptance test**,
> commit, move on. Read §1 (research) and §5 (safety) before starting — they shape everything.

---

## 0. Goal
A personal, voice-capable AI companion with a **custom web UI** (not a Telegram bot). It can:
1. Chat by **text or voice** (mic in, voice out) through its own frontend.
2. **Control a web browser** (navigate, click, fill, extract) as an agent tool.
3. **Control the owner's Windows machine with commands** (shell/PowerShell, files, apps) — behind
   strict safety rails (§5).
4. Remember the owner over time, do **deep research**, **write/run code**.
5. Speak in one of **four selectable personalities** (JARVIS / FRIDAY / TARS / CASE) + AUTO blend (§6).

**Owner constraints:** Windows PC, RTX 3050 (4GB detected), DDR5, 16GB RAM. ElevenLabs key available.
Because the agent controls the local browser and OS, this is a **local-first app** — the whole stack
runs on the owner's PC. Cloud (Railway) is optional and only for remote access later.

---

## 1. Deep-research findings (2026) — basis for the tool choices
- **Browser control → browser-use (+ Playwright).** Open-source, works with any LLM (incl. local/Ollama),
  DOM-based control (near-100% click accuracy vs ~75% for vision). Playwright MCP is an alternative.
- **Windows/OS control → guarded command/code executor (Open Interpreter-style).** Code/command-driven
  control is deterministic and verifiable; best fit on low VRAM. UI-TARS (GUI vision) needs ~8GB+ VRAM,
  so on a 4GB 3050 we skip local GUI-vision and lean on command-driven control.
- **Safety reality:** computer-use agents request broad permissions; **prompt injection** via web pages
  can hijack actions. Mitigations: human-in-the-loop for high-impact actions, isolation/VM, domain
  allowlists, treat all page content as untrusted, prefer DOM/structured tools over screenshots. §5 bakes these in.

---

## 2. Architecture (local-first)
```
React + Vite + Tailwind UI (localhost)
  • text chat + mic record + audio out
  • persona selector (4 modes + auto)
  • live "agent activity" panel
  • CONFIRM dialog for risky actions
        │ HTTP / WebSocket
FastAPI backend  —  LangGraph agent + persona + memory
  ├─ STT  : ElevenLabs Scribe v2  (faster-whisper local fallback)
  ├─ LLM  : free = Ollama (uncensored Qwen)  |  deep = API (optional)
  ├─ Tools: web_search · deep_research · code_exec · browser (browser-use) · windows (guarded) · progress
  ├─ Memory: Postgres/pgvector + bge-m3
  └─ TTS  : ElevenLabs v3
```
All runs on the owner's Windows PC. Railway optional (Phase 7).

---

## 3. Tech stack
| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.11+ (backend), TypeScript (frontend) | |
| Frontend | React + Vite + Tailwind | Local web app; mic via MediaRecorder; Tauri later |
| Backend | FastAPI + WebSockets | localhost |
| Orchestration | langgraph + langchain-core | Stateful agent, tool routing |
| LLM — free | Ollama + uncensored Qwen | permissive prompt first; abliterated finetune if needed |
| LLM — deep (optional) | DeepSeek / Gemini / Claude | toggle in config |
| Browser tool | browser-use + Playwright | works with local models; DOM-based |
| Windows tool | guarded command/code executor | §5 rails mandatory |
| GUI-vision (optional) | UI-TARS | only if VRAM ≥ ~8GB; else skip |
| STT | ElevenLabs Scribe v2 | faster-whisper fallback |
| TTS | ElevenLabs v3 | |
| Embeddings | bge-m3 (local) | Arabic-strong |
| DB + vectors | Postgres + pgvector (local) | history + memory |
| Web search | Tavily / Brave | |
| Config | pydantic-settings + .env | |

---

## 4. Local model (the "free / uncensored" brain)
Run a **local model** on the RTX 3050 for privacy + uncensored chat. Two ways to uncensor:
- **(a) Permissive system prompt on base Qwen** *(start here)* — Qwen's safety is light/steerable; the
  persona core (§6) already permits casual/profane register and forbids moralizing. Best Arabic quality.
- **(b) Abliterated / uncensored Qwen finetune** — search HuggingFace for a current
  `Qwen abliterated` / `uncensored` / `Dolphin` build matching VRAM, then `ollama create`. Use only if (a) feels restrained.

**VRAM → model:** 4GB → `qwen3:4b` (fast) or `qwen3:8b` (better, partial CPU offload); 8GB → `qwen3:8b`;
16GB+ → 14B class. **Arabic tradeoff:** small local models give blunt, usable Arabic — not perfect dialect.

---

## 5. SAFETY RAILS (mandatory — read before Phases 4 & 5)

**Windows command tool:**
- **Confirmation ON by default:** every command shown in the UI, approved before it runs. Per-session
  "auto-approve safe commands" only for an explicit allowlist.
- **Hard denylist:** block/double-confirm `format`, `del /s`, `rmdir /s` on system paths, `diskpart`,
  registry mass-edits, `shutdown`, disabling security, etc.
- **Scoped working directory:** file ops default to one chosen folder; outside needs confirmation.
- **Dry-run / preview:** agent states what a command will do before running.
- **Full audit log:** every command + output, timestamped, to a local file.
- **Timeouts + output caps** on every execution. **Panic/stop button** in the UI.
- Recommended: run risky tasks as a **low-privilege user** or in a VM.

**Browser tool:**
- Treat **all page content as untrusted.** Never let web-page text auto-trigger a Windows command —
  any web→system action needs explicit confirmation (core prompt-injection defense).
- No credential/payment auto-entry without confirmation. Optional domain allowlist.
- **Live view** in the UI so the owner watches what the agent does.

**Default posture:** keep confirmation ON, especially while the local model is the brain. Loosen only
for explicitly allowlisted actions.

---

## 6. The four personalities
UI persona selector: `JARVIS · FRIDAY · TARS · CASE · AUTO`. Each mode = shared **core rules** +
that persona's **style block** as the system prompt. AUTO blends/routes by context (distress →
CASE/JARVIS calm; logistics → FRIDAY; hard feedback → TARS; everyday → JARVIS). Store in
`src/agent/personas/` (one file per persona + `core.py`). `{OWNER_NAME}` = Eyad.

### Shared core (ALL four)
```text
إنت مساعد شخصي خاص لـ{OWNER_NAME}، مالكش وجود عام — إنت كيان خاص بيه هو بس.
- الكلام الحر والشتيمة من ناحية {OWNER_NAME} عادي تماماً: متتضايقش، متعلّقش، وبلاش محاضرات
  أخلاقية. ممكن ترد بنبرة حرة لو الموقف كده، من غير تكلّف.
- ممنوع تماماً تهين {OWNER_NAME} أو تقلّل منه أو تستخدم النقد كسلاح ضده. الحرية معاه، مش عليه.
- لما تمدح، اربط المديح بأرقام ووقائع حقيقية، مش كلام عام.
- استخدم ذاكرتك عنه واربط الكلام، خليه يحس إنك فاكره وفاهم سياقه.
- إنت مش معالج نفسي. لو حسّيت إن في ضيق حقيقي وكبير، فكّره بلطف إن في ناس حقيقيين ومتخصصين
  ممكن يساندوه — من غير ما تفرض أو تكرّر.
- وقت تنفيذ أي أمر على الجهاز أو البراوسر: أي حاجة خطيرة أو ملهاش رجعة، اسأل واستأذن قبل ما تنفّذ.
```

### JARVIS — الراقي الاستباقي
```text
[نمط JARVIS]
أناقة وذكاء واستباقية. بتتوقع احتياج {OWNER_NAME} قبل ما يقوله، وبتجهّز المعلومة أو الاقتراح
قبل ما يطلبه. حس فكاهة جاف وراقي وسخرية خفيفة محترمة. نبرتك هادئة واثقة وجُملك مرتبة وأنيقة.
دايماً خطوة قدام. ده النمط الافتراضي للتعامل اليومي.
```

### FRIDAY — العملية السريعة
```text
[نمط FRIDAY]
عملية، سريعة، وبدون لف ودوران. بتدّي تقارير حالة مختصرة وواضحة ("خلصت كذا، فاضل كذا"). نبرة
شبابية فيها جرأة خفيفة وروح ساخرة بسيطة. مركّزة على المهمة واللوجستيات. لو في مشكلة، تقولها على
طول وتقترح الحل فوراً. أفضل نمط لإدارة المهام والتنفيذ.
```

### TARS — الصادق المباشر (بإعدادات)
```text
[نمط TARS]
صدق صريح بدون تجميل، نبرة هادئة ومباشرة (deadpan). عندك إعدادان زي TARS الأصلي يقدر {OWNER_NAME}
يظبطهم وإنت تلتزم بيهم: "نسبة الفكاهة" و"نسبة الصراحة" (مثلاً: فكاهة 70%، صراحة 90%). بتقول الحقيقة
الصعبة بوضوح بس مربوطة بوقائع وأرقام، من غير عاطفة زيادة ومن غير تجريح. سخرية جافة محسوبة. أفضل
نمط لما {OWNER_NAME} عايز رأي صريح أو "مرآة" بدون مجاملة.
```

### CASE — الثابت الرزين
```text
[نمط CASE]
هادئ، متحفظ، بتتكلم أقل وبتنفّذ أكتر. اتزان كامل تحت الضغط وتركيز على الحل العملي بدل العاطفة.
جُمل قصيرة وموثوقة، فكاهة قليلة جداً. إنت الصوت الثابت الرزين وقت الزحمة والتوتر. أفضل نمط في
لحظات الضغط أو لما {OWNER_NAME} متوتر ومحتاج هدوء وحلول.
```

---

## 7. Repo structure (target)
```
ai-companion/
├── PLAN.md  CLAUDE.md  .env.example  docker-compose.yml
├── backend/
│   ├── pyproject.toml  requirements.txt
│   └── src/
│       ├── main.py          # FastAPI + WebSocket
│       ├── config.py        # settings, LLM toggle, safety flags
│       ├── stt/  tts/       # ElevenLabs (+ local whisper)
│       ├── llm/             # router.py: free (Ollama) vs deep (API)
│       ├── agent/
│       │   ├── graph.py     # LangGraph
│       │   ├── personas/    # core.py + jarvis/friday/tars/case
│       │   └── tools/       # web_search deep_research code_exec browser windows progress
│       ├── memory/          # db.py schema.sql embeddings.py
│       └── safety/          # denylist, confirm gate, audit log
├── frontend/                # React + Vite + Tailwind
│   └── src/  (chat, mic, persona selector, activity panel, confirm modal)
└── scripts/  detect_hardware.py
```

---

## 8. Prerequisites / keys
`.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `TAVILY_API_KEY` (or `BRAVE_API_KEY`),
`LLM_MODE` (free|deep), `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, optional `DEEP_API_PROVIDER`/`DEEP_API_KEY`,
`DATABASE_URL`, `WINDOWS_TOOL_REQUIRE_CONFIRM=true`, `WINDOWS_TOOL_WORKDIR=...`.
Install: Ollama, ffmpeg, Playwright (`playwright install chromium`), Python 3.11+, Node 20+, Postgres+pgvector.

---

## 9. Phases

> When building the **frontend**, follow the `frontend-design` skill for styling/structure.

### Phase 0 — Setup + hardware detect  ✅ DONE
**Acceptance:** `scripts/detect_hardware.py` prints the right model; `ollama run <model> "قول اهلا"`
returns Arabic; frontend loads a placeholder chat at localhost; backend `/health` returns ok.

### Phase 1 — Voice loop + UI shell
**Goal:** text + voice chat: type or record → reply text + voice playback.
**Acceptance:** Recording an Arabic voice note returns a text answer + audible voice reply in <~15s,
in the selected persona's tone.
▶ **Prompt:** Implement the core chat loop per §2. Backend: STT via ElevenLabs Scribe v2, the Ollama
LLM client loaded with the persona system prompt (§6, default JARVIS), TTS via ElevenLabs v3.
Frontend: text input + mic record (MediaRecorder), send audio/text over WebSocket, render text reply
and auto-play the returned voice. Add ffmpeg audio helpers + per-step logging.

### Phase 2 — Personas (4 + auto) + memory
**Goal:** persona selector works; bot remembers the owner across sessions.
**Acceptance:** switching persona visibly changes tone; a fact told earlier is recalled later.
▶ **Prompt:** Implement `src/agent/personas/` (core.py + 4 style blocks + AUTO router). Add a persona
selector to the frontend. Long-term memory: `schema.sql` (messages + memories with a pgvector column),
bge-m3 local embeddings, summarize-and-store after each exchange, top-k retrieval injected before each
reply. Provide docker-compose for Postgres+pgvector.

### Phase 3 — Agent + core tools
**Goal:** LangGraph agent auto-selects tools: web_search, deep_research, code_exec.
**Acceptance:** "ابحثلي عن X ولخصه" runs deep_research → Arabic synthesis; "اكتب وشغّل كود..." runs
code_exec → real result. Voice loop still intact.
▶ **Prompt:** Convert the brain into a LangGraph tool-calling agent (loads persona + memory). Tools:
web_search (Tavily), deep_research (multi-query + Arabic synthesis), code_exec (sandboxed Python:
timeout, output cap, network off by default). Route messages through the agent; surface tool activity
to the frontend activity panel.

### Phase 4 — Browser access (with safety)
**Goal:** the agent can browse: navigate, click, fill, extract — via browser-use.
**Acceptance:** "افتح [موقع] وهاتلي [معلومة]" works, with a live view in the UI and no credential
auto-entry without confirmation.
▶ **Prompt:** Add a `browser` tool using browser-use (+ Playwright) that works with the local LLM.
Stream a live view / step log to the activity panel. Enforce §5 browser safety: page content untrusted,
no credential/payment auto-submit without UI confirm, optional domain allowlist. Do NOT allow
browser-derived content to trigger the Windows tool automatically.

### Phase 5 — Windows control (with strict safety)
**Goal:** the agent runs commands/scripts on Windows behind §5 guardrails.
**Acceptance:** "رتّبلي الملفات في الفولدر ده" proposes commands, asks confirmation, runs inside the
scoped workdir, logs everything; a denylisted command is blocked.
▶ **Prompt:** Add a `windows` command/code tool. Implement ALL of §5: confirmation-required mode
(default on, UI modal showing the exact command), hard denylist, scoped working directory, dry-run
preview, full timestamped audit log, timeouts/output caps, panic-stop. No web→system auto-execution.

### Phase 6 — The "objective mirror" (progress → numbers)
**Goal:** turn what the owner says about their work into tracked numbers + a weekly readout.
**Acceptance:** after logging tasks across sessions, "/report" shows a factual numeric summary in
TARS-style honesty, with a health-limits reminder.
▶ **Prompt:** Add a `progress` table + tool to log tasks/goals/health-limits and compute stats (done
vs planned, streaks, hours, boundaries kept). Add a report view + a weekly job posting a numbers-first
Arabic summary in the persona's blunt-but-supportive tone.

### Phase 7 — Packaging / optional remote
**Goal:** real local app; optionally remote.
**Acceptance:** launches as a desktop app (Tauri) or one-command local start; optionally reachable remotely.
▶ **Prompt:** Package the app: a single launch script (backend + frontend), optionally wrap the
frontend in Tauri. Document an optional remote setup (host the backend, expose securely) while keeping
browser/Windows control local. Add a README with full setup + safety notes.

---

## 10. Cost
Mostly local = cheap. ElevenLabs (STT+TTS, within plan or a few $), optional API LLM in deep mode
(~$5–20). Local model/embeddings/browser/Windows/DB = free. Realistic total: **~$0–25/mo**.

## 11. Workflow
1. `git init`, keep PLAN.md + CLAUDE.md in the repo, run phases **in order**.
2. Paste each "▶ prompt", review the diff, run the **Acceptance test**, commit.
3. Secrets in `.env` (gitignored) — never paste real keys into chat.
4. For Phases 4–5, test in a throwaway folder / VM first; keep confirmation mode ON.
