# PIXY TERMINAL

PIXY TERMINAL is a local web shell for Hermes Agent. The current MVP exposes Hermes through a small FastAPI wrapper and a Next.js frontend with three views:

- Chat
- Dashboard
- Skills

If Hermes is not installed yet, the backend stays usable in explicit simulator mode so the UI can still be developed and demoed without silent failures.

## Demo Runbook

The current presentation target is: "a 2-minute recording can start immediately."

Recommended order:

1. Open `Chat` and submit one real prompt.
2. Open `Skills` and show either a populated library or the intentional empty state.
3. Open `Dashboard` to close with memory, sessions, and runtime proof.
4. Narrow the browser to phone width for a quick responsive pass.

Suggested voiceover:

- "PIXY puts Hermes in a browser shell without hiding runtime truth."
- "Chat stays primary, but memory, sessions, and learned skills stay visible."
- "If the runtime is live, degraded, or simulated, the UI says so explicitly."

Presentation-state checklist:

- Loading: use the global loading shell instead of cutting to a blank screen.
- Error: use the recoverable error route and retry action if something fails.
- Empty: keep the empty skills/session language on screen long enough to explain the product promise.
- Mobile: after the desktop walkthrough, shrink to phone width and show the stacked layout once.

## Structure

```text
frontend/  Next.js app router client + local proxy routes
server/    FastAPI wrapper around Hermes storage and AIAgent
plan.md    Approved hackathon scope and review guardrails
```

## Local Run

### 1. Backend

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Optional environment variables:

- `PIXY_HERMES_HOME` or `HERMES_HOME`: override Hermes storage path
- `PIXY_FRONTEND_ORIGIN`: allowed frontend origin for CORS

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional environment variables:

- `PIXY_BACKEND_URL`: defaults to `http://127.0.0.1:8000`

## Demo Tips

- If Hermes is only available through CLI fallback, keep recording. The runtime badge and diagnostics panel already explain that state.
- If Hermes is unavailable, simulator mode is still demoable because the UI surfaces the fallback explicitly.
- For a quick mobile capture, resize the browser to narrow width instead of switching devices mid-recording.

## Hermes Integration Notes

- Runtime import target: `run_agent.AIAgent`
- Fallback runtime: `hermes chat -q ...` CLI bridge
- Skills source: `~/.hermes/skills`
- Sessions source: `~/.hermes/sessions`
- Memory source: `~/.hermes/memories/MEMORY.md` with fallback to `~/.hermes/MEMORY.md`

## Validation

Run these after setup:

```bash
cd server && source .venv/bin/activate && python -m compileall app
cd frontend && npm run lint && npm run build
```
