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
- Show loading, error, and empty states as first-class product states, not afterthoughts.
- Avoid generic SaaS styling and avoid purple-heavy cyberpunk defaults.
- Dark mode is the primary experience.

## Presentation acceptance

The design handoff should support an immediate 2-minute recording.

- Chat must read as the hero moment.
- Skills must still tell a coherent story when the library is empty.
- Dashboard must close the story with proof, not raw diagnostics noise.
- Mobile width must feel like a deliberate layout, not a squeezed desktop frame.
- State copy must give the presenter something they can say out loud.

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

## State language

Use the same tone across screens:

- Loading: calm, explicit, "preparing the next surface"
- Error: visible and recoverable, never accusatory
- Empty: explain what will appear here later and why it matters in the product story
