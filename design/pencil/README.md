# PIXY TERMINAL Pencil.dev Brief

This folder is the design handoff for the first Pencil.dev pass.

Use the screens in this order:

1. `chat-screen.md`
2. `dashboard-screen.md`
3. `skills-screen.md`

The product already works. This design pass should polish the visual language without changing the information architecture or the API wiring.

## Non-negotiables

- Desktop and mobile must both feel intentional.
- Keep the current three-screen structure: chat, dashboard, skills.
- Preserve all live data slots already in the app.
- Avoid generic SaaS styling and avoid purple-heavy cyberpunk defaults.
- Dark mode is the primary experience.

## Files the generated design should map back to

- `frontend/components/app-shell.tsx`
- `frontend/components/chat-workspace.tsx`
- `frontend/components/dashboard-panel.tsx`
- `frontend/components/skills-board.tsx`
- `frontend/app/globals.css`

## Recommended visual direction

- Mood: calm command center, not hacker parody
- Palette: graphite, oxidized teal, pale mint, warm amber
- Typography: one expressive display face + one mono support face
- Surfaces: layered glass, subtle grid, strong section hierarchy
- Motion: restrained reveal and panel transitions, no toy micro-animations

## Code handoff rule

When converting Pencil output into code, keep the current data bindings and component responsibilities. This is a visual/system pass, not a product rewrite.
