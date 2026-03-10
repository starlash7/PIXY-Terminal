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
