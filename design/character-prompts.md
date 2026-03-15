# PIXY Character State Prompts

This file defines the source-image generation prompts for the PIXY persona set.
The target is a consistent 4-state portrait series based on the visual feel of `image-v5.png`.

## Generation Rules

- Use the same character identity across every variation.
- Keep the same framing in every render:
  - upper-body portrait
  - centered composition
  - camera at eye level
  - dark hair
  - pale skin
  - clean indoor background
  - no props
  - no phone
  - no hands covering the face
- Keep lighting soft and high-contrast enough for ASCII conversion.
- Do not add any UI overlays, text, HUD, symbols, accessories in front of the face, or objects near the mouth.
- The final images are source plates for PIXY's ASCII persona renderer, not finished posters.

## Recommended Workflow

1. Use `image-v5.png` as the visual identity reference.
2. Lock character identity and composition first.
3. Generate `idle`, `thinking`, `responding`, and `warning` as separate images.
4. Only change expression, eye tension, and light mood between states.

## Recommended Filenames

- `pixy-idle.png`
- `pixy-thinking.png`
- `pixy-responding.png`
- `pixy-warning.png`

Optional:

- `pixy-listening.png`

If these files are present in `.context/attachments`, the frontend will pick them up automatically.

## Negative Prompt

```text
text, UI overlay, HUD, subtitles, watermark, logo, phone, mirror selfie, hands covering face, object in front of face, drink can, microphone, headset, helmet, sunglasses, extreme angle, full body, low contrast, busy background, neon city background, poster composition, heavy accessories, multiple characters, deformed face, asymmetrical eyes, extra fingers
```

## Common Base Prompt

```text
A clean upper-body portrait of a feminine AI companion, based on the same visual identity as the provided reference image, centered composition, same character design across all variations, same hairstyle, same facial proportions, same camera angle, dark long hair, pale skin, soft natural indoor background, no props, no text, no UI overlay, no objects in front of the face, high contrast face lighting, calm cyber-companion aesthetic, designed as a source plate for ASCII terminal art conversion.
```

## Idle

```text
A clean upper-body portrait of a feminine AI companion, based on the same visual identity as the provided reference image, centered composition, same character design across all variations, same hairstyle, same facial proportions, same camera angle, dark long hair, pale skin, soft natural indoor background, no props, no text, no UI overlay, no objects in front of the face, high contrast face lighting, calm cyber-companion aesthetic, designed as a source plate for ASCII terminal art conversion. Neutral expression, relaxed eyes, emotionally steady face, quiet presence, subtle soft light, composed and observant.
```

## Thinking

```text
A clean upper-body portrait of a feminine AI companion, based on the same visual identity as the provided reference image, centered composition, same character design across all variations, same hairstyle, same facial proportions, same camera angle, dark long hair, pale skin, soft natural indoor background, no props, no text, no UI overlay, no objects in front of the face, high contrast face lighting, calm cyber-companion aesthetic, designed as a source plate for ASCII terminal art conversion. Thoughtful expression, slightly narrowed eyes, introspective gaze, subtle shadow contrast, quiet concentration, as if processing memory and reasoning.
```

## Responding

```text
A clean upper-body portrait of a feminine AI companion, based on the same visual identity as the provided reference image, centered composition, same character design across all variations, same hairstyle, same facial proportions, same camera angle, dark long hair, pale skin, soft natural indoor background, no props, no text, no UI overlay, no objects in front of the face, high contrast face lighting, calm cyber-companion aesthetic, designed as a source plate for ASCII terminal art conversion. Engaged expression, slightly brighter eyes, faint confident smile, more vivid face lighting, present and articulate, as if actively replying to the user.
```

## Warning

```text
A clean upper-body portrait of a feminine AI companion, based on the same visual identity as the provided reference image, centered composition, same character design across all variations, same hairstyle, same facial proportions, same camera angle, dark long hair, pale skin, soft natural indoor background, no props, no text, no UI overlay, no objects in front of the face, high contrast face lighting, calm cyber-companion aesthetic, designed as a source plate for ASCII terminal art conversion. Serious warning expression, more tension around the eyes, controlled urgency, slightly colder contrast with a faint amber-red light accent, as if signaling a fallback path or critical issue.
```

## Selection Standard

- Pick the set only if all four images look like the same person at first glance.
- Reject any output where the face identity drifts noticeably between states.
- Reject any output where a prop or hand overlaps the face.
- Reject any output where the background becomes more visually dominant than the face.
