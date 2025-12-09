# Themer Snapshot (2025-12-07b)

## Topology & Entry Points
- **Bootstrap + exposure.** `src/index.js` instantiates a singleton `ThemerEngine`, boots once DOMContentLoaded fires (or immediately if the DOM is ready), and publishes it on `window.Themer` for debugging hooks. @static/themer/src/index.js#1-13
- **Config + state.** Slider/toggle ranges live in `data/config.js` (`PARAMS`, `PASS_FLAGS`, `getDefaults()`), while `core/state.js` provides a pub/sub store with `get`, `set`, `setAll`, and `subscribe`. @static/themer/src/data/config.js#1-23 @static/themer/src/core/state.js#1-34
- **Runtime subsystems.** `ThemerEngine` wires the `BackgroundRenderer`, DOM `Styler`, and HUD `ControlPanel`, attaches resize + IntersectionObserver guards, and drives the RAF loop/FPS telemetry. @static/themer/src/core/engine.js#1-79
- **Docs + guidance.** Human TL;DR + AI briefing live under `docs/intro.md`, `docs/styler/styler.md`, and `docs/ai_gen/*` (prompt, rolling changelog, snapshots). @static/themer/docs/intro.md#1-8 @static/themer/docs/styler/styler.md#1-46 @static/themer/docs/ai_gen/start_prompt.md#1-57

## Runtime Flow
1. **State seed** – On module import, `store` is populated via `getDefaults()`, guaranteeing every slider/toggle key exists before UI/render subscriptions fire. @static/themer/src/data/config.js#1-23 @static/themer/src/core/state.js#1-34
2. **Engine init** – `engine.init()` guards against double init, constructs renderer/styler/UI, sizes the canvas, attaches `resize`, and wires an `IntersectionObserver` that pauses rendering when the canvas is off-screen. @static/themer/src/core/engine.js#19-43
3. **RAF loop** – Each `loop()` tick samples FPS (rolling average of the latest 30 frames), updates HUD telemetry, renders the background, and calls both `styler.tick(delta)` (noop placeholder) and `styler.rescan(delta)` to throttle DOM walks. @static/themer/src/core/engine.js#55-77
4. **Renderer passes** – `BackgroundRenderer` prepends a fixed `.cd-bgCanvas`, compiles fullscreen-triangle pipelines via `ShaderPass` + `CompositePass`, streams store uniforms (zoom/density/twinkle/contrast/seam flag), and falls back to a 1×1 dummy texture if stars are disabled. @static/themer/src/modules/renderer.js#1-254
5. **UI feedback loop** – The HUD builds grouped controls from `PARAMS`, syncs slider/number/toggle states via store subscriptions, persists configs + dock height to `localStorage`, and exposes copy/save/minimize affordances. @static/themer/src/modules/ui.js#1-432

## Renderer & Shader Notes
| Concept | Source | Details |
| --- | --- | --- |
| Geometry setup | @static/themer/src/modules/renderer.js#1-44 | Fullscreen triangles are buffered once and bound through a VAO so both passes share identical draw calls. |
| `ShaderPass` uniforms | @static/themer/src/modules/renderer.js#61-137 | Every pass injects `u_res` + `u_time` plus store-driven uniforms (contrast, zoom, density, twinkle). Dynamic uniforms let toggles (`seamDebugEnabled`) push booleans without bloating store keys. |
| Dummy texture fallback | @static/themer/src/modules/renderer.js#189-252 | `createDummyTexture()` produces a 1×1 RGBA tex the composite pass can bind whenever `starEnabled` is false or the star pass cannot render in time. |
| Shader fetch | @static/themer/src/modules/renderer.js#189-211 @static/themer/src/data/shaders.js#1-36 | GLSL sources are fetched once and cached, keeping the module side-effect free besides canvas insertion. |

## Styler System
- **Pipeline.** Styler boots with a configurable `rootSelector`, `minTextLength`, and `scanIntervalMs` (default 5s). `scan()` performs a breadth-first crawl from the root, skipping forbidden tags, filtering block candidates, classifying them, and tagging hits with `data-styler` while tracking descriptors in `this.nodes`. @static/themer/src/modules/styler.js#33-145
- **Classification.** Heading-cluster classifier now drives styling: for each `h2–h6`, it gathers sibling content until the next equal/higher heading, enforces an 80-char minimum, wraps the slice in `section.cd-heading-card`, and tags it `jade-card`. The legacy feature-cluster classifier remains in code but is disabled behind `ENABLE_FEATURE_CLUSTER`. @static/themer/src/modules/styler.js#1-244
- **Rescan cadence.** `rescan(delta)` accumulates elapsed ms between RAF ticks and re-runs `scan()` once `scanIntervalMs` elapses; `tick()` remains a deliberate noop so CSS handles live animation. Heading wrappers guard against duplicate tags via `closest('[data-styler]')`. @static/themer/src/modules/styler.js#66-214 @static/themer/src/core/engine.js#71-75
- **Dev notes.** `docs/styler/styler.md` captures the updated classifier hierarchy, wrapper mechanics, and how to re-enable the legacy classifier for experiments. @static/themer/docs/styler/styler.md#11-46

## Theme Surfaces & Integration
- **CSS contract.** `[data-styler]` cards get gradient borders, inner glows, float animation, and hover lifts; `[data-styler="jade-card"]` adds jade gradients plus `jade-breathe` keyframes, while a `stats` variant is reserved for metric blocks. The HUD dock defines its own typography, blur, and draggable height. @static/themer/css/themer.css#1-320
- **Host wiring.** `templates/layout.html` links layout CSS, Themer CSS, and module entrypoint. `static/js/log-cards.js` rewrites `[log]` headings and optional `[stats]` subsections into predictable DOM sections so Styler heuristics find rich blocks without requiring authors to sprinkle attributes manually. @templates/layout.html#1-72 @static/js/log-cards.js#1-88

## Docs & AI Workflow
- `docs/intro.md` gives humans the TL;DR (drop-in WebGL backdrop + HUD + hue-animated DOM cards) and explains where to find the AI prompt. @static/themer/docs/intro.md#1-8
- `docs/ai_gen/start_prompt.md` spells out the AI runbook: scan runtime + CSS + docs, update `whats_changed.md`, emit snapshots, cite sources, and keep deltas token-efficient. @static/themer/docs/ai_gen/start_prompt.md#1-57
- `docs/styler/styler.md` serves as the Styler-focused deep dive referenced by both humans and copilots so heuristics stay synchronized with code/CSS. @static/themer/docs/styler/styler.md#1-46
- This snapshot plus `whats_changed.md` form the persistent memory under `docs/ai_gen/`; future runs should append rather than overwrite to preserve historical context.

## Recent Changes (since 2025-12-07a)
- Documented the Styler pipeline, heuristics, and backlog separately under `docs/styler/styler.md` so AI/humans no longer have to infer behavior from code alone. @static/themer/docs/styler/styler.md#1-46
- Clarified the doc entrypoint: `docs/intro.md` now links directly to the AI prompt + Styler brief, and the prompt itself calls out Styler docs as required reading. @static/themer/docs/intro.md#1-8 @static/themer/docs/ai_gen/start_prompt.md#1-57

## Open Questions / TODOs
- [ ] Replace periodic rescans with MutationObserver/IntersectionObserver assists once the DOM heuristics stabilize, reducing duplicate traversals on dynamic hosts. @static/themer/src/modules/styler.js#29-123
- [ ] Expand classifier catalog (stats boards, quotes, code islands) and sync CSS roles (e.g., `stats` variant) so `[data-styler]` paints remain semantically meaningful. @static/themer/src/modules/styler.js#4-27 @static/themer/css/themer.css#18-109
- [ ] Add palette/role controls to the HUD once descriptor schema is finalized, piping store values back into Styler rather than patching DOM inline. @static/themer/src/modules/ui.js#1-432 @static/themer/docs/styler/styler.md#35-44
