# Cosmic Dream Snapshot (2025-12-06c)

## Topology
- **Entry + orchestration.** `src/index.js` instantiates a single `CosmicEngine`, boots once DOM is ready, and exposes `window.CosmicDream` so host pages can poke the engine directly. @cosmic-dream/src/index.js#1-13
- **State + config.** `PARAMS`/`PASS_FLAGS` define every slider/toggle (nebula, dual star passes, membrane experiments); `getDefaults()` seeds the reactive `store` that publishes to renderer/UI/animator subscribers. @cosmic-dream/src/data/config.js#1-55 @cosmic-dream/src/core/state.js#1-34
- **Engine skeleton.** `CosmicEngine` wires `NebulaRenderer`, `HueAnimator`, and `ControlPanel`, listens for resize, and uses an `IntersectionObserver` on the WebGL canvas to pause the RAF loop plus FPS sampling when off-screen. @cosmic-dream/src/core/engine.js#1-75
- **Renderer stack.** `NebulaRenderer` prepends the fullscreen canvas, compiles shader/composite programs via `loadShaderSources()`, caches uniform locations, and renders the star FBO before a composite pass blits to screen (with dummy texture fallback). @cosmic-dream/src/modules/renderer.js#1-252
- **UI Control Panel.** The HUD builds draggable/minimizable groups from `PARAMS`, syncs sliders + numeric min/max boxes, persists config + dock height in `localStorage`, and reports blend mode/FPS/state to the user. @cosmic-dream/src/modules/ui.js#1-444
- **HueAnimator.** Queries `.cd-node-inner` elements (cards in host DOM) and continuously rewrites CSS custom properties so DOM chrome drifts in sync with the HUD aesthetic. @cosmic-dream/src/modules/animator.js#1-23
- **Theme surfaces.** `css/cosmic.css` skins the WebGL canvas, HUD dock, sliders, and `.cd-node-inner` cards so Cosmic Dream can be dropped into arbitrary layouts without conflicting styles. @cosmic-dream/css/cosmic.css#1-279
- **Host/demo glue.** `demo.html` consumes `css/cosmic.css` + `src/index.js` for a stock showcase, while `cosmic.html` ships a self-contained v2.1 plugin (legacy drop-in script + HUD builder) used as reference material for other sites. @cosmic-dream/demo.html#1-63 @cosmic.html#1-717

## Runtime Flow
1. Module load builds the reactive `store` from defaults so all subsystems share the same parameter object. @cosmic-dream/src/data/config.js#1-55 @cosmic-dream/src/core/state.js#1-34
2. `engine.init()` guards against double init, creates renderer/UI/animator, sizes the canvas, registers resize + intersection observers, then starts the RAF loop. @cosmic-dream/src/core/engine.js#19-43
3. Each `loop()` iteration samples FPS, updates HUD telemetry, renders the star pass (skipping if `starEnabled === false`), composites to the default framebuffer, and advances the HueAnimator. @cosmic-dream/src/core/engine.js#55-74 @cosmic-dream/src/modules/renderer.js#176-252 @cosmic-dream/src/modules/animator.js#17-21
4. UI actions (`slider`, `main-val`, min/max inputs, toggles) push updates into the `store`, which fan out to renderer uniforms and other subscribers; save/copy buttons serialize configs for human/AI handoff. @cosmic-dream/src/modules/ui.js#135-255
5. Dock height + configs persist via localStorage, allowing the theme to reload exactly as last edited across runs. @cosmic-dream/src/modules/ui.js#197-244 @cosmic-dream/src/modules/ui.js#333-443

## Shader & Rendering Notes
| Uniform / Concept | Source | Effect |
| --- | --- | --- |
| `u_res`, `u_time` | @cosmic-dream/src/shaders/stars.frag.glsl#6-8 @cosmic-dream/src/modules/renderer.js#61-135 | ShaderPass writes framebuffer size + elapsed seconds so UVs stay aspect-correct and twinkle stays time-based.
| `zoom`, `starDensity`, `starTwinkle`, `starZoom` | @cosmic-dream/src/shaders/stars.frag.glsl#8-96 @cosmic-dream/src/modules/renderer.js#12-205 | Store-driven uniforms control world scaling, lattice population, flicker mix, and UV stretch for the star pass.
| `u_seamDebugEnabled` | @cosmic-dream/src/shaders/stars.frag.glsl#15-114 @cosmic-dream/src/modules/renderer.js#201-205 | Dynamic uniform overlays checkerboard + magenta seam mask so seam regressions are obvious while tuning hashes.
| Toroidal wrapping (`wrapCell`, `wrapDelta`) | @cosmic-dream/src/shaders/stars.frag.glsl#26-75 | Keeps neighbor sampling continuous across STAR_LATTICE borders, reducing seam flicker versus older `fwidth` AA.
| `CompositePass` (`u_starTex`, `u_contrast`) | @cosmic-dream/src/modules/renderer.js#145-173 | Blits the latest star FBO (or dummy) with contrast exponent from the store before the canvas hits the DOM.

## Theme Surfaces & Integration Glue
- **CSS HUD + cards.** `.cd-hud-dock`, `.cd-control`, `.cd-node-inner`, and gradient border animations are defined in `css/cosmic.css`, including pointer-resize handle + mix-blend canvas layering so the backdrop and DOM cards coexist. @cosmic-dream/css/cosmic.css#14-279
- **Drop-in demo shell.** `demo.html` loads the modular engine via `<script type="module" src="./src/index.js"></script>` and supplies a minimal card tree to showcase hue animations. @cosmic-dream/demo.html#8-63
- **Self-contained legacy build.** `cosmic.html` (v2.1) embeds the CSS + HUD + shader logic inline for environments that cannot import the ES-module engine; it still exposes `global.CosmicDream` and mimics the IntersectionObserver pause logic. @cosmic.html#24-715
- **Tauon site wiring.** `templates/layout.html` plus `static/js/log-cards.js` and `static/css/layout.css` provide the Markdown viewer/log styling Cosmic Dream expects when mounted as a theme across the wider site. @templates/layout.html#1-69 @static/js/log-cards.js#1-88 @static/css/layout.css#548-662

## Docs & AI Guidance
- `docs/intro.md` now offers a TL;DR for the drop-in theme plus a miniature guide on pointing AI helpers at `docs/ai_gen`. @cosmic-dream/docs/intro.md#1-7
- `docs/ai_gen/start_prompt.md` was expanded so future doc runs cover runtime stack, CSS/theme surfaces, logs, and integration glue—not just shaders. @cosmic-dream/docs/ai_gen/start_prompt.md#1-57
- `docs/ai_gen/whats_changed.md` (just consumed) tracks deltas between snapshots; the 2025-12-06 entries were folded into this document. @cosmic-dream/docs/ai_gen/whats_changed.md#1-10
- `docs/dora/persisting_problem.md` remains intentionally blank after the seam-log reset—next run must rebuild the seam hypothesis + failed experiments table. @cosmic-dream/docs/dora/persisting_problem.md#1-1

## Open Questions / TODOs
- [ ] Rebuild `docs/dora/persisting_problem.md` with the current seam hypothesis, quantitative failures, and failed shader tweaks so future AI avoids duplicating work. @cosmic-dream/docs/dora/persisting_problem.md#1-1
- [ ] Validate whether the toroidal wrapping + pixel-radius falloff eliminated brightness discontinuities under extreme zoom/density sweeps; log remaining `[stats]` hits if magenta seams persist. @cosmic-dream/src/shaders/stars.frag.glsl#26-114
