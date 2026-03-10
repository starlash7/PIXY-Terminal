# PIXY TERMINAL MVP Plan

## Goal

Ship a hackathon-ready Hermes Agent dashboard that makes chat, memory, and skill growth visible in the browser and usable from mobile.

## Priority

### P0

- FastAPI wrapper around Hermes
- Web chat with markdown rendering
- Session visibility from Hermes logs

### P1

- Skills page from Hermes markdown files
- Memory panel from `MEMORY.md`
- Dashboard for demo metrics
- Mobile-responsive layout

### Cut for this iteration

- Scheduler UI
- Slack integration
- Telegram integration
- Keyword cloud and extra analytics

## Guardrails

- Hold scope. Finish P0 and P1 before new features.
- Zero silent failures. Every broken request must produce visible UI feedback.
- Named failures. Backend responses should include structured error codes.
- Observability first. Runtime mode, memory source, and session source must stay visible.
- Local demo wins. Optimize for a reliable local recording before deployment work.

## Current Build

- `server/` exposes `/health`, `/chat`, `/skills`, `/memory`, `/sessions`
- `frontend/` ships `Chat`, `Dashboard`, and `Skills`
- Missing Hermes install falls back to simulator mode with explicit warnings
