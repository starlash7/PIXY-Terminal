# PIXY TERMINAL MVP Plan

## Goal

Ship a hackathon-ready Hermes Agent dashboard that makes chat, memory, and skill growth visible in the browser and usable from mobile.

The chat surface must also feel like a live AI presence, not a plain chatbot.

## Priority

### P0

- FastAPI wrapper around Hermes
- Web chat with markdown rendering
- Session visibility from Hermes logs
- Immersive chat shell with a code-only holographic agent presence
- Clear agent state transitions for `idle`, `thinking`, `responding`, and `warning`

### P1

- Skills page from Hermes markdown files
- Memory panel from `MEMORY.md`
- Dashboard for demo metrics
- Mobile-responsive layout
- Higher-fidelity holographic rendering if it does not slow down delivery

### Cut for this iteration

- Scheduler UI
- Slack integration
- Telegram integration
- Keyword cloud and extra analytics
- Asset-heavy avatar pipelines that require custom character art
- Live2D, Spine, or custom 3D avatar production from scratch

## Guardrails

- Hold scope. Finish P0 and P1 before new features.
- Zero silent failures. Every broken request must produce visible UI feedback.
- Named failures. Backend responses should include structured error codes.
- Observability first. Runtime mode, memory source, and session source must stay visible.
- Local demo wins. Optimize for a reliable local recording before deployment work.
- Avoid uncanny valley. Prefer abstract holographic presence over weak human portrait art.
- Code-first visuals. Default to procedural SVG/CSS/WebGL before custom design assets.

## Visual Direction

- Use a Lucy-like abstract holographic entity instead of a literal human portrait.
- The agent should be implied with light, silhouette, orbit rings, scanlines, and a core glow.
- The right-side chat presence must react to chat state changes, not scroll position.
- Thought bubbles and UI copy must expose agent status, not internal chain-of-thought.

## Character Strategy

### Primary Track

- Build the agent as a code-only holographic entity inside the existing chat slot.
- Start with SVG/CSS/Motion-style rendering for speed and reliability.
- Keep the implementation state-driven: `idle -> thinking -> responding -> warning -> idle`.
- Pair the entity with subtle voice spectrum, glow shifts, and short thought/status bubbles.

### Upgrade Track

- If time allows, move the holographic entity to `React Three Fiber + custom shader material`.
- Reuse the same chat state machine so the rendering layer can be swapped without rewiring the app.
- Treat shader/WebGL work as a visual upgrade, not a blocker for the MVP.

## Implementation Notes

- Do not depend on Rive or custom `.riv` assets for the MVP unless a ready-made asset appears.
- Do not block delivery on designer-made portraits or character sheets.
- Prefer reusable building blocks: procedural SVG, blend modes, scanlines, glow fields, and shader layers.
- Keep the chat UI and agent presence tightly coupled so the demo reads as one product.

## Current Build

- `server/` exposes `/health`, `/chat`, `/skills`, `/memory`, `/sessions`
- `frontend/` ships `Chat`, `Dashboard`, and `Skills`
- Missing Hermes install falls back to simulator mode with explicit warnings
- `frontend/` is actively moving from portrait-based character experiments to a code-only holographic agent presence
