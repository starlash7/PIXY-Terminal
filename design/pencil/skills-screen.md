# Screen 3: Skills Library

## Why this screen matters

This is the clearest product differentiator. It shows that Hermes is not stateless chat; it accumulates reusable skills over time.

## Must-preserve data slots

- Search input
- Skills card grid
- Empty state
- Memory tie-in panel
- Recent sessions panel
- Small narrative panel explaining why skills matter

## Layout intent

- Desktop: main searchable library left, contextual side rail right
- Mobile: search stays near the top, cards stack naturally, side rail moves below
- The skills cards should feel collectible and alive, not like file explorer rows

## Interaction mood

- Curated library, not a dump of markdown files
- Search should feel quick and clear
- Cards should invite browsing

## Visual direction

- Each skill card should have strong title hierarchy
- Metadata should feel subtle but visible
- The side rail should connect skills to memory and session history
- Use structure and contrast rather than excessive decoration

## Mobile behavior

- Search remains easy to reach
- Card layout becomes single-column or compact two-column depending on width
- Side panels stack after the grid

## Pencil.dev prompt

Design a dark responsive web screen for the "PIXY TERMINAL" skills library.

This page shows learned agent skills as a visual product feature. The user should instantly understand that the AI is gaining reusable capabilities over time.

Required content blocks:
- page header
- search input
- skills card grid
- empty state treatment
- side panel explaining why skills matter
- memory tie-in panel
- recent sessions panel

Tone:
- intelligent, premium, curated
- feels like a living library of capabilities
- avoids looking like a plain file browser

Visual direction:
- dark mineral palette
- mint and teal accents
- light editorial typography with mono metadata accents
- tactile cards with clear hierarchy

Mobile requirement:
- search at the top
- cards stack cleanly
- side rail moves below the main library

Avoid:
- list-only layouts
- tiny metadata-heavy cards
- flashy gradients that reduce readability

## Code handoff note

Apply the result primarily to:

- `frontend/components/skills-board.tsx`
- `frontend/components/app-shell.tsx`
- `frontend/app/globals.css`
