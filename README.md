# PIXY TERMINAL

PIXY TERMINAL is a local web shell for Hermes Agent. The current MVP exposes Hermes through a small FastAPI wrapper and a Next.js frontend with three views:

- Chat
- Dashboard
- Skills

If Hermes is not installed yet, the backend stays usable in explicit simulator mode so the UI can still be developed and demoed without silent failures.

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

## Hermes Integration Notes

- Runtime import target: `run_agent.AIAgent`
- Skills source: `~/.hermes/skills`
- Sessions source: `~/.hermes/sessions`
- Memory source: `~/.hermes/memories/MEMORY.md` with fallback to `~/.hermes/MEMORY.md`

## Validation

Run these after setup:

```bash
cd server && source .venv/bin/activate && python -m compileall app
cd frontend && npm run lint && npm run build
```
