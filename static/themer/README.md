# Themer

Drop-in WebGL2 backdrop + HUD dock + CSS styler. Load one module, inherit the whole vibe. This README stays intentionally lightweight—snapshots under `docs/ai_gen/` capture the dense architecture notes.

## What You Get
- Full-screen starfield renderer that paints behind any host layout.
- HUD control dock with sliders/toggles backed by a tiny reactive store.
- Styler module that tags rich DOM blocks with `[data-styler]` so CSS can apply gradients, borders, and float animations.

For the narrative pitch, read `docs/intro.md`. For AI/human deep dives, jump straight to the latest `docs/ai_gen/*-snapshot.md`.

## Quick Tour of the Modules
- `src/index.js` – boots `ThemerEngine` once DOM is ready and exposes it via `window.Themer` for debugging.
- `src/core/engine.js` – wires renderer, Styler, and HUD together, handles resize + visibility, and runs the RAF loop.
- `src/modules/renderer.js` + `src/shaders/*.glsl` – prep a fullscreen canvas, compile shader passes, and stream store values into uniforms.
- `src/modules/ui.js` – renders the HUD dock (FPS, save/copy, Stars sliders, seam toggle) and syncs it with the store.
- `src/modules/styler.js` – walks the host DOM on a cadence, tags eligible blocks with descriptors (`data-styler="jade-card"`).
- `css/themer.css` – styles the canvas, HUD, and `[data-styler]` cards without touching host layout.

Need heuristics or CSS contracts? See `docs/styler/styler.md`—that file is the Styler canon so this README doesn’t have to be.

## Install (Drop-In)
1. **Link the CSS**
   ```html
   <link rel="stylesheet" href="/themer/css/themer.css">
   ```
2. **Render your normal content** – Styler will auto-detect rich blocks; no custom classes needed.
3. **Load the module**
   ```html
   <script type="module" src="/themer/src/index.js"></script>
   ```

That’s it: Themer prepends the canvas, mounts the HUD, and animates eligible cards automatically.

## Extend or Hack
- Add a slider/toggle by editing `src/data/config.js`; the HUD and renderer wire it up automatically once the shader consumes the uniform.
- Persist or share looks by calling `store.setAll()` with your preferred values (HUD copy/save already uses this path).
- Want different controls? Subscribe to `store` yourself and provide an alternate UI while leaving renderer/styler untouched.

## Docs & Snapshots
- **Human primer:** `docs/intro.md`
- **Styler deep dive:** `docs/styler/styler.md`
- **AI workflow + prompt:** `docs/ai_gen/start_prompt.md`
- **Latest architecture snapshot:** check the newest `docs/ai_gen/*-snapshot.md`

Snapshots replace the verbose sections you might expect here (runtime flow, shader tables, TODOs). Keep README scoped to intent, install, and routing so future updates only touch the docs that are meant to be detailed.
