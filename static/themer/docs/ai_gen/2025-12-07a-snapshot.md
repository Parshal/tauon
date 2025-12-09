# Themer Snapshot (2025-12-07a)

## Topology
- **Entry + exposure.** `src/index.js` instantiates a single `ThemerEngine`, boots once DOM is ready (or immediately if already loaded), and exposes it as `window.Themer` so host pages can poke the engine directly. @static/themer/src/index.js#1-14
- **Config + store.** `PARAMS` define `contrast`, `starZoom`, `starDensity`, and `starTwinkle` ranges while `PASS_FLAGS` track booleans such as `starEnabled` and `seamDebugEnabled`; the `State` object seeds defaults, exposes `get/set/setAll`, and multicasts updates to all subscribers. @static/themer/src/data/config.js#1-23 @static/themer/src/core/state.js#1-34
- **Engine skeleton.** `ThemerEngine` wires the renderer, styler, and control panel, guards against double init, attaches resize + IntersectionObserver hooks, and samples FPS so the HUD can report telemetry. @static/themer/src/core/engine.js#1-79
- **Renderer stack.** `BackgroundRenderer` prepends the `.cd-bgCanvas`, compiles shader programs via `ShaderPass` + `CompositePass`, streams store values into uniforms (including seam debug), and keeps a dummy texture handy when passes are disabled. @static/themer/src/modules/renderer.js#1-254
- **Styler.** DOM walker tags eligible blocks with `[data-styler]`, assigns per-role hues (card vs. stats), throttles rescans via `rescan(delta)`, and leaves `tick()` empty so CSS handles continuous animation. @static/themer/src/modules/styler.js#1-115
- **Control Panel.** HUD renders slider/toggle groups from `PARAMS`, persists configs + dock height to `localStorage`, exposes copy/save/minimize controls, and reflects dirty/FPS state. @static/themer/src/modules/ui.js#1-432
- **Theme surfaces.** `css/themer.css` now focuses solely on the canvas, HUD dock, sliders, and `[data-styler]` cards, declaring its own font/color tokens so host layouts remain untouched. @static/themer/css/themer.css#1-281
- **Integration glue.** Tauon’s layout template links both layout + themer CSS, loads helper scripts (zoom, sidebar resize, `[log]` card wrapper), and boots Themer through a `<script type="module">`, making the HUD/canvas available across Markdown views. @templates/layout.html#1-72 @static/js/log-cards.js#1-90 @static/css/layout.css#548-689
- **Docs & prompts.** README + `docs/intro.md` provide the human primer, while `docs/ai_gen/start_prompt.md` and `whats_changed.md` define the AI refresh workflow and rolling delta log. @static/themer/README.md#1-82 @static/themer/docs/intro.md#1-8 @static/themer/docs/ai_gen/start_prompt.md#1-57 @static/themer/docs/ai_gen/whats_changed.md#1-4

## Runtime Flow
1. Module load constructs the reactive store from `getDefaults()`, ensuring every slider/toggle is defined before any subsystem subscribes. @static/themer/src/data/config.js#1-23 @static/themer/src/core/state.js#1-34
2. `engine.init()` guards against double boot, instantiates renderer/styler/UI, sizes the canvas, registers resize + visibility observers, and immediately starts the RAF loop. @static/themer/src/core/engine.js#19-43
3. Each `loop()` iteration samples FPS, updates HUD telemetry, renders the star pass (if enabled), composites to the default framebuffer, and calls both `tick()` (intentional no-op) and `rescan(delta)` on the Styler. @static/themer/src/core/engine.js#55-75 @static/themer/src/modules/styler.js#38-48
4. `BackgroundRenderer` renders fullscreen triangles into an offscreen FBO, injects store-driven uniforms (zoom/density/twinkle), and blits via `CompositePass` with a dummy texture fallback whenever a pass is disabled. @static/themer/src/modules/renderer.js#61-254
5. Control Panel events (slider, number inputs, toggles, save/copy buttons, dock drag) push to the store, which fans updates back into UI controls, renderer uniforms, and persisted storage hashes. @static/themer/src/modules/ui.js#128-417

## Shader & Rendering Notes
| Uniform / Concept | Source | Effect |
| --- | --- | --- |
| `u_res`, `u_time` | @static/themer/src/modules/renderer.js#61-135 | Added by `ShaderPass` so each render pass knows framebuffer size + elapsed seconds for stable UV scaling.
| `u_starDensity`, `u_starTwinkle`, `u_starZoom`, `u_zoom` | @static/themer/src/shaders/stars.frag.glsl#1-118 @static/themer/src/modules/renderer.js#12-125 | Store-driven controls that scale the toroidal lattice, clamp star counts, attenuate twinkle curves, and zoom the field without aliasing seams.
| `u_seamDebugEnabled` | @static/themer/src/modules/renderer.js#201-205 @static/themer/src/shaders/stars.frag.glsl#95-114 | Dynamic uniform toggled from the HUD to overlay checkerboard/magenta seam diagnostics while tuning hashes.
| Composite contrast + dummy fallback | @static/themer/src/modules/renderer.js#145-251 | `CompositePass` binds either the star FBO or a 1×1 dummy texture and applies the `contrast` exponent before writing to the onscreen canvas.

## Theme Surfaces & Integration Glue
- `[data-styler]` nodes receive gradient borders, inner glows, and float animations, with a specialized `[data-styler="stats"]` variant for metric-heavy blocks; hover states deepen the glow while keeping pointer events transparent overlays out of the way. @static/themer/css/themer.css#18-71
- `.cd-hud-dock` defines a fixed, resizable panel (handle, meta row, grouped sliders, toggle pills) using its own font stack, blur, blend-safe colors, and thin scrollbars so it does not inherit site styles. @static/themer/css/themer.css#73-281
- Host templates simply link `/themer/css/themer.css` + `/themer/src/index.js`; Markdown helpers like `log-cards.js` wrap `[log]` headings into stylable sections so Styler + CSS gradients have consistent DOM targets. @templates/layout.html#7-72 @static/js/log-cards.js#1-90

## Docs & AI Guidance
- README pairs a TL;DR with a module map, runtime flow, and integration walkthrough so humans don’t need the legacy demo shell. @static/themer/README.md#1-74
- `docs/intro.md` summarizes the drop-in pitch plus how to point copilots at the AI prompt. @static/themer/docs/intro.md#1-8
- `docs/ai_gen/start_prompt.md` codifies the AI doc procedure (scan runtime/CSS/docs, update `whats_changed.md`, emit snapshots, clear consumed deltas). @static/themer/docs/ai_gen/start_prompt.md#5-53
- `docs/ai_gen/whats_changed.md` remains the staging ground for deltas between full snapshots and should be cleared after each snapshot run. @static/themer/docs/ai_gen/whats_changed.md#1-4

## Recent Changes (since 2025-12-06c)
- Styler now performs structural-only heuristics, drops the legacy hue-spin helpers, and throttles DOM walks via `rescan(delta)`; the engine loop explicitly calls the empty `tick()` plus the new throttled rescan so CSS can own animation. @static/themer/src/modules/styler.js#1-115 @static/themer/src/core/engine.js#55-75
- The deprecated demo shell was removed, and docs (README + AI prompt + prior snapshot guidance) now describe the drop-in workflow strictly as “link CSS + module script,” keeping documentation aligned with the actual bundle. @static/themer/README.md#5-74 @static/themer/docs/ai_gen/start_prompt.md#7-53 @static/themer/docs/ai_gen/2025-12-06c-snapshot.md#3-38
- `css/themer.css` was pruned down to the WebGL canvas, `[data-styler]` cards, and HUD controls, each declaring local typography/colors so the host page’s global reset stays untouched; future role-specific animations will layer on once Styler heuristics settle. @static/themer/css/themer.css#1-281

## Open Questions / TODOs
- [ ] Revisit Styler color assignment + MutationObserver support so hue roles persist without relying on periodic rescans. @static/themer/src/modules/styler.js#1-115
- [ ] Add new role-specific animations or states to the HUD / `[data-styler]` cards once the heuristics harden. @static/themer/css/themer.css#1-281
