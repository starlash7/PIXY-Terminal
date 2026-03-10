# Screen 2: Dashboard Overview

## Why this screen matters

This screen is the proof layer. It turns hidden Hermes state into visible metrics for the hackathon demo.

## Must-preserve data slots

- Four stat cards
- Demo anchor / walkthrough section
- Memory excerpt panel
- Recent sessions panel
- Runtime notes panel

## Layout intent

- Desktop: metric strip at top, then two stacked rows with asymmetric grids
- Mobile: stat cards become scroll or stacked cards, then content sections follow
- The page should feel like a concise command briefing, not a spreadsheet

## Interaction mood

- A fast "understand the system in 10 seconds" screen
- Metrics must feel punchy
- Sections should be visually differentiated so a demo viewer can track the narrative

## Visual direction

- Stat cards should feel bold and editorial
- Memory section should feel quieter and more intimate
- Demo anchors should look like the operator's presentation script
- Runtime notes should feel transparent and diagnostic

## Mobile behavior

- Stat cards collapse into two columns or vertical stack
- Demo anchors remain easy to scan
- Memory excerpt does not become a giant wall of text

## Pencil.dev prompt

Design a dark, high-end dashboard screen for "PIXY TERMINAL", an AI terminal product built on top of Hermes Agent.

This page is the executive overview. It should immediately communicate:
- this AI has persistent memory
- it is learning skills
- it has session continuity
- it is actually alive right now

Required content blocks:
- a top row of 4 stat cards
- a "demo script anchors" section
- a memory excerpt panel
- a recent sessions panel
- a runtime notes panel

Tone:
- not corporate BI
- not crypto dashboard noise
- more like an operator briefing board with real product taste

Visual direction:
- dark graphite surfaces
- restrained mint accents
- subtle amber notes for attention
- strong hierarchy between stats, narrative blocks, and diagnostics
- typography should feel modern and slightly editorial

Mobile requirement:
- stats stay legible
- sections stack cleanly
- nothing should rely on hover

Avoid:
- overly dense tables
- purple gradients
- default admin dashboard templates

## Code handoff note

Apply the result primarily to:

- `frontend/components/dashboard-panel.tsx`
- `frontend/components/app-shell.tsx`
- `frontend/app/globals.css`
