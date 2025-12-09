## Themer (TL;DR)

Themer is a drop-in theme module that pairs a WebGL2 backdrop with a HUD control dock and CSS-styled DOM cards. `src/index.js` boots the `ThemerEngine`, which stitches together the renderer, reactive store, UI sliders/toggles, and CSS styler so any host page can gain the theme without touching its own layout.

## AI Doc Update Workflow (TL;DR)

If you're here to brief an AI to update docs/ai_gen, hand it `docs/ai_gen/start_prompt.md`. That prompt tells the assistant to scan the repo, update `whats_changed.md`, and emit a fresh snapshot under `docs/ai_gen/`. Point copilots (and humans needing Styler specifics) to `docs/styler/styler.md`, then reference the most recent `docs/ai_gen/*-snapshot.md` when you need an architectural refresher before editing shaders, UI, or docs.
