# Themer Living Handbook
_Last refreshed: 2025-12-09 (run c — update this stamp every run)_

This handbook is the single source of truth for both humans and copilots. It merges the invocation prompt, onboarding README, and the most recent architecture snapshot so every refresh carries forward context while staying token-efficient, and it must remain self-evolving across every section and workflow described here.

---

## 1. Invocation Prompt (copy/adapt verbatim)
**Goal.** Capture a token-efficient, high-signal snapshot of Themer—the drop-in theme module pairing WebGL2 backdrop, HUD dock, and hue-animated DOM chrome—so future AI can reason about renderer, UI, CSS, host integration, and docs without rereading the whole repo. Treat the output as persistent memory aligned with the codebase.

**Scope.** Operate within `tauon/static/themer` focusing on:
1. Runtime stack – `src/index.js`, `core`, `modules`, `data`, `shaders`.
2. Theme surfaces – `css/themer.css`, `themer.html`, `templates/`, `static/` assets hosting the theme.
3. Docs + logs – `docs/intro.md`, `docs/styler/styler.md`, `docs/dora/*`, `docs/ai_gen/*`, and any other narrative/state trackers.
4. Integration glue – store wiring, exports, `window.Themer` + `window.ThemerLegacy`, installation scripts.

**Rules of Engagement.**
1. Read before writing; cite files as `@path#start-end`. Be explicit about unknowns.
2. Minimize tokens; favor bullet lists, tables, enums.
3. Highlight deltas with commit/date/context when possible.
4. Keep docs and code synced; leave TODOs with precise fixes if unsure.
5. Always reference `docs/styler/styler.md` when discussing heuristics.
6. Maintain this file as the living artifact—every run updates relevant sections inline instead of scattering across multiple markdowns.

**Suggested Snapshot Skeleton.**
```
# Themer Snapshot (YYYY-MM-DDx)

## Topology & Entry Points
...

## Runtime Flow
1. ...

## Renderer & Shader Notes
| Uniform | Source | Effect |

## Styler System
...

## Theme Surfaces & Integration
...

## Docs & Workflow
...

## Recent Changes
- ...

## Open Questions / TODOs
- [ ] ...
```
Extend with sections like “UI bindings” or “Known constraints” when needed.

**Procedure Checklist.**
1. `ls` / tree `themer/` for orientation.
2. Read/skim runtime stack + skinning surfaces.
3. Skim `docs/intro.md`, `docs/styler/styler.md`, `docs/dora/*`, and prior snapshots in this handbook.
4. Update the snapshot section (and date stamp) following the skeleton and cite files. Mention which previous snapshot you superseded.
5. Re-read the doc to ensure alignment with inspected code, then summarize changes in chat for the human.

---

## 2. Human Primer (ex-README)
Drop in one module to inherit the whole vibe: WebGL2 starfield backdrop, HUD dock, and CSS-driven Styler that tags rich DOM blocks with `[data-styler]` for gradients, borders, and float animations.

### What You Get
- Full-screen renderer that paints behind any layout.
- HUD control dock backed by a tiny reactive store.
- Styler that auto-detects content clusters and decorates them with jade-themed chrome.
For narrative context, see `docs/intro.md`. For deep dives, continue in this handbook.

### Quick Tour
- `src/index.js` boots `ThemerEngine` once DOM is ready and exposes `window.Themer`.
- `src/core/engine.js` wires renderer, Styler, HUD, handles resize and visibility, and drives the RAF loop.
- `src/modules/renderer.js` + `src/data/shaders.js` prepare the fullscreen canvas, compile shader passes, and stream store uniforms.
- `src/modules/ui.js` renders the dock (FPS, copy/save, sliders, seam toggle) and syncs with the store.
- `src/modules/styler.js` walks the DOM on a cadence, tagging eligible blocks (`data-styler="jade-card"`).
- `css/themer.css` styles canvas, HUD, and cards without touching host layout.
For heuristics/CSS contracts, see `docs/styler/styler.md`.

### Install (Drop-In)
1. Link CSS: `<link rel="stylesheet" href="/themer/css/themer.css">`
2. Render your normal content—Styler auto-detects blocks.
3. Load module: `<script type="module" src="/themer/src/index.js"></script>`
Themer prepends the canvas, mounts the HUD, and animates eligible cards automatically.

### Extend or Hack
- Add sliders/toggles via `src/data/config.js`; HUD + renderer pick them up once shaders consume the uniforms.
- Persist/share looks with `store.setAll()` (HUD copy/save already uses it).
- Need custom controls? Subscribe to `store` yourself while leaving renderer/styler untouched.

---

## 3. Snapshot (2025-12-09a)
_Update this section each run; older snapshots can be archived below if desired._

### Topology & Entry Points
- **Bootstrap + exposure.** `src/index.js` instantiates a singleton `ThemerEngine`, boots once DOMContentLoaded fires (or immediately if the DOM is ready), and publishes it on `window.Themer` for debugging hooks. @static/themer/src/index.js#1-13
- **Config + state.** Slider/toggle ranges live in `data/config.js` (`PARAMS`, `PASS_FLAGS`, `getDefaults()`), while `core/state.js` provides a pub/sub store with `get`, `set`, `setAll`, and `subscribe`. @static/themer/src/data/config.js#1-28 @static/themer/src/core/state.js#1-34
- **Runtime subsystems.** `ThemerEngine` wires the `BackgroundRenderer`, DOM `Styler`, and HUD `ControlPanel`, attaches resize + IntersectionObserver guards, and drives the RAF loop/FPS + GPU telemetry. @static/themer/src/core/engine.js#1-82
- **Docs + guidance.** Human TL;DR + AI briefing live under `docs/intro.md`, `docs/styler/styler.md`, and `docs/ai_gen/*`. @static/themer/docs/intro.md#1-8 @static/themer/docs/styler/styler.md#1-60 @static/themer/docs/ai_gen/start_prompt.md#1-56

### Runtime Flow
1. **State seed.** On import, `store` is populated via `getDefaults()`, ensuring every slider/toggle key exists before UI/render subscriptions fire. @static/themer/src/data/config.js#1-28 @static/themer/src/core/state.js#1-34
2. **Engine init.** `engine.init()` prevents double init, constructs renderer/styler/UI, sizes the canvas, attaches `resize`, and wires an `IntersectionObserver` that pauses rendering when the canvas leaves view. @static/themer/src/core/engine.js#19-43
3. **RAF loop + telemetry.** Each `loop()` tick samples FPS (rolling avg of 30 frames), asks the renderer for GPU timings, updates the HUD, renders the background, runs `styler.tick(delta)` (noop placeholder), then throttles DOM walks via `styler.rescan(delta)` based on `scanIntervalMs`. @static/themer/src/core/engine.js#55-78 @static/themer/src/modules/styler.js#40-79
4. **Renderer passes.** `BackgroundRenderer` prepends `.cd-bgCanvas`, compiles fullscreen-triangle pipelines via `ShaderPass` + `CompositePass`, streams store uniforms (contrast/zoom/density/twinkle/seam debug), instruments GPU time via `EXT_disjoint_timer_query`, falls back to CPU sampling when needed, and always has a 1×1 dummy texture ready when stars are disabled. @static/themer/src/modules/renderer.js#1-447
5. **UI feedback loop.** ControlPanel groups sliders/toggles from `PARAMS`, mirrors store updates, persists configs + dock height to `localStorage`, exposes copy/save/minimize, and now reflects GPU milliseconds next to FPS. @static/themer/src/modules/ui.js#8-478

### Renderer & Shader Notes
| Concept | Source | Details |
| --- | --- | --- |
| Geometry setup | @static/themer/src/modules/renderer.js#1-44 | Fullscreen triangles buffered once and shared via a VAO. |
| `ShaderPass` uniforms | @static/themer/src/modules/renderer.js#61-144 | Injects `u_res`, `u_time`, and store-driven uniforms (`contrast`, `zoom`, `starDensity`, `starTwinkle`, seam debug). |
| Timer instrumentation | @static/themer/src/modules/renderer.js#189-447 | Uses `EXT_disjoint_timer_query` when available, falls back to periodic CPU sampling, and exposes `getStarPassMs()` so the HUD can show GPU cost. |
| Dummy texture fallback | @static/themer/src/modules/renderer.js#233-257 | `createDummyTexture()` provides a 1×1 RGBA tex whenever the star pass is disabled or delayed. |
| Composite contrast | @static/themer/src/modules/renderer.js#146-175 | `CompositePass` binds the star FBO (or dummy) and applies the contrast exponent before writing to the onscreen canvas. |

### HUD & Store Wiring
- **Dock & controls.** HUD renders minimized by default, adds draggable height, copy/save/min buttons, FPS/GPU readouts, and vertical sliders grouped under "Stars" + "CSS Styling" sections. @static/themer/src/modules/ui.js#64-214
- **Persistence.** Config snapshots + dock height persist in `localStorage`; `hashState()` tracks dirty status so "CONFIG SAVED" / "UNSAVED" messaging stays accurate. @static/themer/src/modules/ui.js#379-478
- **Global flags.** `applyGlobalFlags()` toggles body classes (`cd-styler-wobble-off`, `cd-styler-gradient-off`, `cd-styler-glow-off`, `cd-styler-role-jade-off`, `cd-hud-debug`) so CSS can instantly disable animations/gradients/glow or flip the HUD into debug skin. @static/themer/src/modules/ui.js#287-303 @static/themer/css/themer.css#179-236
- **Telemetry.** `setFPS()` and `setGpuTime()` drive the meta bar; renderer timings feed straight into the HUD each frame. @static/themer/src/core/engine.js#55-78 @static/themer/src/modules/ui.js#349-385

### Styler System
- **Pipeline.** Configurable `rootSelector`, `minTextLength`, and `scanIntervalMs` (default 5 s). `scan()` breadth-first crawls from the root, skips forbidden tags, filters block candidates, classifies them, and tags hits with `data-styler` while tracking descriptors in `this.nodes`. @static/themer/src/modules/styler.js#33-152
- **Heading clusters.** Primary classifier walks `h1–h6`, ensures ≥80 chars, wraps each group in `section.cd-heading-card`, moves the heading + following content inside a collapsible chrome, and tags the wrapper `jade-card`. Accessible caret/ARIA wiring keeps nested sections coherent. @static/themer/src/modules/styler.js#155-349 @static/themer/css/themer.css#61-141
- **Legacy feature clusters.** Still present but gated by `ENABLE_FEATURE_CLUSTER` so experiments stay opt-in. @static/themer/src/modules/styler.js#6-38 @static/themer/docs/styler/styler.md#28-37
- **Rescan cadence.** `rescan(delta)` accumulates elapsed ms between RAF ticks and reruns `scan()` when `scanIntervalMs` elapses; `tick()` stays a deliberate noop so CSS handles live animation. @static/themer/src/modules/styler.js#69-143 @static/themer/src/core/engine.js#71-78
- **Playbook.** `docs/styler/styler.md` documents classifier hierarchy, wrapper mechanics, and backlog hooks for future observers/palette wiring. @static/themer/docs/styler/styler.md#8-60

### Theme Surfaces & Integration
- **CSS contract.** `[data-styler]` cards gain gradient borders, inner glows, float animation, and hover lifts; `[data-styler="jade-card"]` adds jade gradients plus `jade-breathe` keyframes, while a `stats` variant is reserved for metric blocks. The HUD dock defines its own typography, blur, debug mode, and draggable height. @static/themer/css/themer.css#1-320
- **Host wiring.** `templates/layout.html` links layout CSS, Themer CSS, and module entrypoint. `static/js/log-cards.js` rewrites `[log]` headings and optional `[stats]` subsections into predictable DOM sections so Styler heuristics find rich blocks without manual attributes. @templates/layout.html#1-72 @static/js/log-cards.js#1-88

### Docs & Workflow
- `docs/intro.md` provides the human TL;DR and points to this handbook. @static/themer/docs/intro.md#1-8
- `docs/styler/styler.md` is the Styler canon for heuristics and CSS contracts. @static/themer/docs/styler/styler.md#1-60
- `docs/ai_gen/start_prompt.md` remains the copy/pasteable AI brief; this handbook stays the single update surface. @static/themer/docs/ai_gen/start_prompt.md#1-56

### Recent Changes (vs 2025-12-07b)
- **GPU timing surfaced.** Renderer now samples `EXT_disjoint_timer_query` (with CPU fallback) and exposes `getStarPassMs()`, while the HUD shows GPU ms beside FPS, making perf regression hunts faster. @static/themer/src/modules/renderer.js#189-447 @static/themer/src/core/engine.js#71-74 @static/themer/src/modules/ui.js#349-385
- **CSS perf toggles.** ControlPanel flag buttons flip body classes to disable wobble/gradients/glow/jade styling or enable HUD debug, aligning UI toggles with CSS fallbacks. @static/themer/src/modules/ui.js#287-303 @static/themer/css/themer.css#179-236
- **Heading card UX polish.** Styler now installs accessible collapsible chrome (ARIA levels, caret button, smooth max-height transitions) around each heading cluster, keeping nested sections readable. @static/themer/src/modules/styler.js#185-349 @static/themer/css/themer.css#61-141

### Open Questions / TODOs
- [ ] Replace periodic rescans with MutationObserver/IntersectionObserver assists once DOM heuristics stabilize, reducing duplicate traversals. @static/themer/src/modules/styler.js#29-123
- [ ] Expand classifier catalog (stats boards, quotes, code islands) and sync CSS roles (`stats` variant) so `[data-styler]` paints stay semantically meaningful. @static/themer/src/modules/styler.js#10-37 @static/themer/css/themer.css#18-175
- [ ] Add palette/role controls to the HUD once descriptor schema is finalized, piping store values back into Styler. @static/themer/src/modules/ui.js#8-385 @static/themer/docs/styler/styler.md#35-57

---

## 4. How to Keep This Handbook Self-Reproducing
1. **Single touchpoint.** Future updates happen here—when the prompt, primer, or snapshot needs edits, modify the respective section and cite sources.
2. **Versioning.** Before editing any part of this handbook (prompt, primer, snapshot, or README notes), duplicate the entire file to `docs/ai_gen/YYYY-MM-DDx-handbook.md` (or similar) so each run leaves a frozen copy; only use sub-sections/appendices here when one run needs multiple inline views (`2025-12-09b`, etc.).
3. **Human friendliness.** Keep the prompt section pristine for copy/paste while ensuring the primer remains approachable.
4. **AI notes.** When finishing a run, mention in chat which sections changed and whether any TODOs were addressed.

Older README/start_prompt files can now point readers to this handbook or be deprecated as needed.
