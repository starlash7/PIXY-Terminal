# Screen 1: Chat Command Center

## Why this screen comes first

This is the hero screen for the demo. It proves Hermes is usable in a browser and on mobile, and it carries the strongest "personal AI terminal" feeling.

## Must-preserve data slots

- Top runtime label
- Session label
- Conversation transcript
- Prompt textarea
- Primary submit CTA
- Runtime warning panel
- Runtime diagnostics panel
- Memory preview panel
- Recent sessions panel

## Layout intent

- Desktop: two-column composition
- Left: dominant conversation surface
- Right: stacked intelligence rail for warnings, memory, sessions
- Mobile: transcript first, input second, intelligence rail collapses below

## Interaction mood

- Feels like a high-trust control surface
- Spacious enough to read markdown comfortably
- Strong distinction between user bubble and Hermes response
- Runtime state should feel visible, not hidden in tiny badges

## Visual direction

- Background: dark mineral gradient with faint technical grid
- Accent: mint/teal primary, amber for warnings
- Chat container: large rounded panel, not a generic messaging app
- Transcript cards: soft depth, strong contrast, readable spacing
- Input area: looks like a command composer, not a default textarea

## Mobile behavior

- Header condenses into one stack
- Conversation width becomes full bleed inside safe padding
- Right rail becomes stacked cards after the transcript
- Submit CTA remains obvious and thumb-reachable

## Presentation beat

Narration line:

- "This is the command center: live prompt on the left, persistent context on the right."

State treatments:

- Loading: keep transcript hierarchy visible with message-shaped skeletons
- Error: show a recoverable shell-level message, then keep the composer visible if possible
- Empty: initial assistant seed message should explain what PIXY is for before any user message exists

## Pencil.dev prompt

Design a dark, premium web app screen for an AI product called "PIXY TERMINAL".

This screen is the main chat command center. The product is a browser UI for a persistent Hermes AI agent. The feeling should be calm, sharp, and intentional, like a high-trust command deck for a personal operator. Do not make it look like a generic SaaS dashboard or a neon cyberpunk toy.

Create a responsive web screen with:
- a compact top shell/header
- a large conversation panel on the left
- a stacked intelligence rail on the right
- clear runtime state
- visible session context
- a powerful multiline input composer

Required content blocks:
- runtime badge
- session label
- chat transcript with distinct user and assistant styling
- primary prompt composer and submit button
- warning card
- diagnostics card
- memory preview card
- recent sessions card

Visual direction:
- graphite and deep charcoal base
- pale mint / oxidized teal accents
- warm amber warning accents
- elegant display typography plus mono support
- subtle grid texture, layered glass surfaces, clean spacing

Mobile requirement:
- the same screen must work beautifully on phone width
- transcript stays primary
- right rail stacks below the conversation
- input stays prominent and easy to use

Avoid:
- purple-heavy palettes
- default chatbot layout
- basic white cards on dark background
- excessive glow or gamer aesthetics

## Code handoff note

Apply the result primarily to:

- `frontend/components/chat-workspace.tsx`
- `frontend/components/app-shell.tsx`
- `frontend/app/globals.css`

## 10-minute build order

If you are new to canvas tools, do not start with polish. Build the screen in this order.

### Minute 0-2: create the big boxes

- Create one desktop screen frame
- Create one mobile screen frame next to it
- Add a header frame at the top
- Add one main content frame below it
- In desktop, split the main content into:
  - left conversation area
  - right intelligence rail

### Minute 2-4: place the core chat structure

- In the left conversation area, add:
  - runtime/session strip
  - transcript frame
  - composer frame
- In the right rail, stack:
  - warning card
  - diagnostics card
  - memory card
  - recent sessions card

### Minute 4-6: add text placeholders

- Put real labels on every block
- Use simple text first:
  - PIXY TERMINAL
  - Live Hermes CLI
  - Conversation
  - Session
  - Prompt
  - Runtime warning
  - Runtime diagnostics
  - Memory layer
  - Recent sessions

### Minute 6-8: shape the hierarchy

- Make the chat panel clearly dominant
- Make the right rail narrower and stacked
- Give cards consistent padding and corner radius
- Make assistant messages feel more structured than user messages
- Make the composer feel like a strong command input, not a weak form field

### Minute 8-10: do the first polish pass

- Apply the dark graphite base
- Add mint/teal accent color
- Add amber warning accent
- Add subtle surface contrast between page, panel, and card
- Check the mobile frame and stack the right rail below the chat area

## Beginner rule

If you get stuck, do not redesign the whole page. Only ask:

1. What is the biggest frame here?
2. What are the child frames inside it?
3. Which card should the eye see first?

## Paste-ready short prompt

Design a responsive dark web app screen for "PIXY TERMINAL", a browser UI for a persistent Hermes AI agent. This is the main chat command center. Make it feel like a calm, premium operator console, not a generic SaaS dashboard and not neon cyberpunk. Use a dark graphite base, pale mint / oxidized teal accents, and warm amber for warnings. Create a compact header, a dominant left conversation panel, and a narrower right intelligence rail. Required blocks: runtime badge, session label, markdown-friendly chat transcript, strong multiline prompt composer with primary CTA, warning card, diagnostics card, memory preview card, and recent sessions card. On desktop the layout should be two-column with the chat area dominant; on mobile the right rail should stack below the chat and input area. Use layered glass surfaces, subtle grid texture, clear hierarchy, expressive display typography plus mono support, and make the composer feel powerful rather than form-like. Avoid purple-heavy palettes, default chatbot layouts, flat admin dashboard styling, and excessive glow.
