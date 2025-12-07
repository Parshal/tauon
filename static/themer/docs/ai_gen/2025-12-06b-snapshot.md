# Cosmic Dream Snapshot (2025-12-06b)

## Topology
- Entry point `src/index.js` instantiates a global `CosmicEngine`, waits for DOM readiness, and immediately boots the renderer/UI stack. @cosmic-dream/src/index.js#1-13
- `CosmicEngine` wires together `NebulaRenderer`, `Styler`, and the HUD `ControlPanel`, installs resize + visibility observers, and manages the RAF loop/fps averaging lifecycle. @cosmic-dream/src/core/engine.js#1-75
- Configuration is centralized in `PARAMS` + `PASS_FLAGS`, with `getDefaults()` seeding the shared `store` (`State` publishes updates to every subscriber). @cosmic-dream/src/data/config.js#1-55 @cosmic-dream/src/core/state.js#1-34
- The HUD `ControlPanel` renders the "Stars" group, binds sliders/toggles to `store.set`, tracks dirty hashes, and persists configs/dock height in `localStorage`. @cosmic-dream/src/modules/ui.js#1-444
- `NebulaRenderer` owns the fullscreen canvas, compiles the star and composite shader passes, injects dynamic uniforms (e.g., `seamDebugEnabled`), and composites to screen with a dummy fallback texture. @cosmic-dream/src/modules/renderer.js#1-252
- `Styler` walks the DOM, tags elements with `[data-styler]`, and continuously drifts CSS custom properties to keep the HUD chrome moving. @cosmic-dream/src/modules/styler.js#1-105

## Runtime Flow
1. Module load builds `store` from defaults so renderer, UI, and animators share one reactive state object. @cosmic-dream/src/data/config.js#1-55 @cosmic-dream/src/core/state.js#1-34
2. `engine.init()` creates renderer/UI/animator instances, registers window resize + canvas `IntersectionObserver`, and calls `start()` once the canvas exists. @cosmic-dream/src/core/engine.js#19-43
3. Each RAF iteration samples FPS, updates the HUD, renders the star/composite passes, and ticks the Styler before scheduling the next frame. @cosmic-dream/src/core/engine.js#55-74
4. `NebulaRenderer.render()` skips the star pass when `starEnabled === false`, otherwise renders to an offscreen FBO, then composites that texture (or the dummy) with the configured contrast exponent. @cosmic-dream/src/modules/renderer.js#176-252

## Shader & Rendering Notes
- `stars.frag.glsl` wraps the hashed lattice toroidally (`wrapCell`/`wrapDelta`) so neighbor fetches stay continuous, and swaps the previous `fwidth` AA for explicit pixel-space discs to stop twinkle flicker along seams. @cosmic-dream/src/shaders/stars.frag.glsl#26-114
- Each sampled star now computes a stable per-cell offset plus pixel-radius falloff; seam debugging overlays a checker + magenta edge mask when `u_seamDebugEnabled > 0.5`. @cosmic-dream/src/shaders/stars.frag.glsl#46-114
- `ShaderPass` automatically pushes `u_res`, `u_time`, `[zoom, starDensity, starTwinkle, starZoom]`, plus the dynamic seam debug uniform set from `store.data`. @cosmic-dream/src/modules/renderer.js#61-205
- `CompositePass` blits the latest star texture (or `dummyTexture`) to the default framebuffer, applying `u_contrast` from config. @cosmic-dream/src/modules/renderer.js#145-252

## Documentation & Logbook Signals
- `docs/dora/persisting_problem.md` is intentionally blank after the log reset; next run must reconstruct the problem statement + catalog of failed seam experiments. @cosmic-dream/docs/dora/persisting_problem.md#1-1
- Site-wide log instructions lean on `[log]`/`[stats]` headings that get auto-wrapped and styled via `static/js/log-cards.js` and `static/css/layout.css`, reinforcing the failure-logbook tone for future seam debugging notes. @cosmic-dream/static/js/log-cards.js#1-88 @cosmic-dream/static/css/layout.css#548-662

## Open Questions / TODOs
- [ ] Rebuild `docs/dora/persisting_problem.md` with the current seam hypothesis, quantitative failures, and which shader tweaks already failed so future AI avoids duplicating work. @cosmic-dream/docs/dora/persisting_problem.md#1-1
- [ ] Validate whether the new toroidal/star falloff changes eliminated brightness discontinuities under extreme zoom or density sweeps; log `[stats]` for any remaining magenta seam hits. @cosmic-dream/src/shaders/stars.frag.glsl#26-114
