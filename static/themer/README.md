# Themer

Drop-in WebGL2 backdrop + HUD dock + DOM hue animator. Load one module, inherit the whole vibe.

## TL;DR
- Full-screen nebula + starfield renderer with auto-skinned `[data-styler]` cards.
- Tiny reactive store keeps config, renderer, animator, and HUD in sync.
- Zero build tooling: native ES modules and static assets.

For a one-paragraph primer, see `docs/intro.md`. For fresh AI-ready context dumps, tap `docs/ai_gen/start_prompt.md`.

---

## Highlights
1. **Self-contained surface.** Themer ships its own WebGL canvas, HUD dock, and CSS so any host page can inherit the theme without touching its layout.
2. **Reactive core.** `src/data/config.js` + `src/core/state.js` expose a pub/sub store that feeds slider values into uniforms and DOM hue variables.
3. **Multi-pass render stack.** Nebula and star passes render into FBOs before a composite shader blits to screen; toggles decide which passes run.
4. **Pause-smart loop.** `IntersectionObserver` idles the RAF loop + FPS sampling when the canvas scrolls off-screen, so idle tabs stay cool.
5. **AI-friendly ergonomics.** Config, HUD height, and presets serialize to JSON/localStorage, making it easy to hand sessions between humans and copilots.

---

## Module Map
| Subsystem | Purpose | Files |
| --- | --- | --- |
| Config + defaults | Define sliders, toggles, presets | `src/data/config.js`
| Reactive store | Plain-object state + listeners (`get`, `set`, `setAll`) | `src/core/state.js`
| Engine | Orchestrates renderer, HUD, styler, resize, and visibility | `src/core/engine.js`
| Renderer | Builds `<canvas class="cd-bgCanvas">`, compiles shaders, caches uniforms, renders passes | `src/modules/renderer.js`, `src/shaders/*.glsl`
| Control Panel | Single `.cd-hud-dock` with slider groups, toggles, copy/save, height persistence | `src/modules/ui.js`, `css/themer.css`
| Styler | Walks host DOM, tags candidates with `[data-styler]`, animates hue vars | `src/modules/styler.js`

---

## Runtime Flow
1. **Boot.** `src/index.js` instantiates `ThemerEngine`, waits for DOM readiness, and exposes `window.Themer` for poke-testing.
2. **State seed.** `getDefaults()` builds the initial store object (slider params + `PASS_FLAGS` such as `nebulaEnabled`).
3. **HUD render.** `ControlPanel` reads the store to lay out slider groups, ON/OFF pills, and telemetry (FPS + blend mode). Height + config state persist via `localStorage` keys `themerDockHeight` / `themerConfig`.
4. **Loop.** `engine.loop()` computes `t`, renders enabled passes, composites, and ticks the `Styler`. FPS sampling updates the HUD meta row.
5. **Reactivity.** Slider/number/pill events call `store.set*`, fan out to renderer uniforms, and keep the HUD + DOM glow consistent. Copy/save buttons serialize the store for AI/human hand-off.
6. **Visibility + resize.** IntersectionObserver pauses RAF/FPS when the canvas is off-screen. `resize` events rebuild framebuffers and canvas viewport.

---

## HUD + Card Quick Tour
- Dock hugs the bottom ~95 vw by default and includes a grab handle; height (≥240 px) persists per browser.
- Top bar: FPS, config dirty badge, Save / Copy JSON / Minimize controls.
- Slider groups (Nebula, Experiments…) render independently so widths stay compact; each stack owns its pass toggle pill.
- Any element the Styler tags with `[data-styler]` inherits gradient borders/glow via CSS custom properties that animate every frame.

---

## Integrate It Anywhere
1. **Link CSS**
   ```html
   <link rel="stylesheet" href="/themer/css/themer.css">
   ```
2. **Render cards** – drop your normal Markdown/DOM; Styler auto-tags eligible blocks with `[data-styler]`, so no special class is required.
3. **Load the module**
   ```html
   <script type="module" src="/themer/src/index.js"></script>
   ```

Themer prepends the canvas, mounts the HUD, and begins animating cards automatically.

---

## Extend / Hack
- **Add a parameter.** Create an entry in `PARAMS`, add the matching `uniform u_yourKey` inside the relevant shader, and read it in the renderer—UI wiring happens automatically.
- **Custom presets.** Define presets in `config.js` and apply with `store.setAll(PRESETS.foo)`. Presets serialize with the rest of the store for easy sharing.
- **Alternate control surface.** Keep the store + renderer, swap in a different UI module that subscribes to the same events if you want bespoke tooling or automated sweeps.
- **Experiments.** Toggle nebula-only mode, or new passes by extending `PASS_FLAGS` and handling them inside `renderer.render()`.

---

## Docs & AI Workflow
- `docs/intro.md` gives the fast human primer featured above.
- `docs/ai_gen/start_prompt.md` is the briefing you can hand to any AI copilot; it instructs the assistant to scan the repo, update `docs/ai_gen/whats_changed.md`, and emit a fresh snapshot (e.g., `docs/ai_gen/2025-12-06c-snapshot.md`).
- Keep README, snapshots, and deeper docs (`docs/dataflows/*`, `docs/dora/*`) in sync so future contributors and copilots can reason about shader changes without spelunking.

Have fun—then keep the HUD sliders honest by writing down what you changed.
