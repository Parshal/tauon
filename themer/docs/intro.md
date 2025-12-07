## Themer (TL;DR)

Themer is a drop-in theme module that pairs a WebGL2 backdrop with a HUD control dock and hue-animated DOM cards. `src/index.js` boots the `ThemerEngine`, which stitches together the renderer, reactive store, UI sliders/toggles, and CSS hue animator so any host page can gain the theme without touching its own layout.

## AI Doc Update Workflow (TL;DR)

If you're here to brief an AI to update docs/ai_gen, hand it `docs/ai_gen/start_prompt.md`. That prompt tells the assistant to scan the repo, update `whats_changed.md`, and emit a fresh snapshot under `docs/ai_gen/`. Use it when you need a current project summary or want an AI copilot to grok the system before editing shaders, UI, or docs.
