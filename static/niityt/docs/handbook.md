# Niityt Living Handbook
_Last refreshed: 2025-12-10d (run f — update this stamp every run)_

This handbook is the single source of truth for both humans and copilots. It merges the invocation prompt, onboarding primer, and the most recent architecture snapshot so every refresh carries forward context while staying token-efficient. Keep it self-evolving across every section and workflow described here.

---

## 1. Invocation Prompt (copy/adapt verbatim)
**Goal.** Capture a token-efficient, high-signal snapshot of Niityt—the 128×128 control-grid experiment that renders everything inside a WebGL2 canvas—so future AI can reason about renderer internals, proto-state rules, WASM parity, square-layout HUD plumbing, and host integration without rereading the repo. Treat the output as persistent memory aligned with the codebase.

### 1b. One important note on deepening the details.
Go further than before—document layout math, shader deltas, and payload contracts when they change. Stay concise but keep enough specifics so future agents can patch shaders or states without reopening the full tree. We can always compress later.

**Scope.** Operate within `tauon/static/niityt` (plus the WASM crate) focusing on:
1. Runtime stack – `main.js`, `state.js`, `renderer.js`, `input.js`, `layout.js`, GLSL shaders.
2. Visual surfaces – `static/css/niityt.css`, `templates/components/niityt.html`, body classes, copy.
3. Native core – `wasm/niityt-core/src/lib.rs` (mirrors of JS state, RNG, and spread logic).
4. Docs/logs – this handbook (single touchpoint) plus dated archives in `docs/`.

**Rules of Engagement.**
1. Read before writing; cite files as `@path#start-end`. Flag unknowns.
2. Minimize tokens; lean on bullets, tables, enumerations.
3. Highlight deltas with date/context when possible.
4. Keep docs + code synced; leave TODOs with concrete follow-ups if unsure.
5. When discussing WASM ↔ JS parity, call out which layer is authoritative.
6. Describe layout/HUD assumptions (square min/max, gutters, pointer clamping) whenever they change because the renderer and input share those metrics.
7. When evolving the handbook, adjust this prompt to match the project’s structure—steer, don’t just record.

**Suggested Snapshot Skeleton.**
```
# Niityt Snapshot (YYYY-MM-DDx)

## Topology & Entry Points
...

## Runtime Flow
1. ...

## Renderer & Shader Notes
| Concept | Source | Details |

## State & Mechanics
...

## Integration & Workflow
...

## Recent Changes
- ...

## Open Questions / TODOs
- [ ] ...
```
Extend with sections like “Layout & HUD Surfaces” or “Input & UX” when useful.

**Versioning & Procedure Checklist.**
-1. Prefer not to sling extra commands when capturing archives (Windsurf hates it).
0. Every refresh must produce a dated file named `YYYY-MM-DDx-handbook.md` under `docs/` (e.g., `2025-12-10b-handbook.md`). Never overwrite prior snapshots; append suffixes (`…-10b`) for same-day reruns.
1. `ls` / tree `static/niityt` + `wasm/niityt-core` for orientation.
2. Read/skim `main.js`, `renderer.js`, `state.js`, `input.js`, `layout.js`, shaders, CSS, template, and WASM glue.
3. Update the snapshot (and date stamp) following the skeleton; mention which snapshot you supersede.
4. Re-read the doc to ensure alignment with inspected code, then summarize in chat exactly which sections changed and whether TODOs moved.

---

## 2. Human Primer (ex-README)
Niityt is a self-contained prototype where the entire HUD, grid, and feedback loop live inside a single WebGL2 canvas. Users “seed” energy in a lower control band, the infection spreads outward, and the renderer visualizes charge, energy reserves, pointer hints, and new gutter HUD rails.

### What You Get
- 128×128 proto-grid simulated on the client, with adjustable resolution via `ProtoState`. @static/niityt/state.js#1-206
- WebGL2 renderer that streams the grid as an `R8` texture, remaps it into a centered square, and paints band/energy telemetry entirely in-shader. @static/niityt/renderer.js#51-320 @static/niityt/shaders/grid.frag.glsl#1-177
- Pointer + control interactions handled purely inside the canvas—no DOM HUD—thanks to layout-aware input routing. @static/niityt/input.js#1-70 @static/niityt/layout.js#1-52
- Color-capture + eight-slot toolbelt inventory mirrored into gutter rails, including the fertilizer meter and recent-pickup glow to signal fresh pigments. @static/niityt/state.js#22-395 @static/niityt/renderer.js#117-470 @static/niityt/shaders/grid.frag.glsl#1-229
- Optional WASM core (`wasm/niityt-core`) that mirrors the JS logic for future perf work. @wasm/niityt-core/src/lib.rs#1-235
- Lightweight wrapper + copy ready to embed on `/niityt`. @templates/components/niityt.html#1-17 @app.py#177-232

### Quick Tour
- `main.js` finds every `.niityt-canvas`, instantiates `ProtoState`, `NiitytRenderer`, and `InputController` (honoring any `data-niityt-mode` attribute for sandbox vs duel), then ticks RAF forever. @static/niityt/main.js#1-50
- `state.js` handles energy costs, spread rates, pigment harvesting, fertilizer gains, eight-slot toolbelt stacks, and HUD descriptors. @static/niityt/state.js#1-395
- `layout.js` computes the centered square + gutters and gives helpers for clamped pointer UV mapping. @static/niityt/layout.js#1-52
- `renderer.js` loads GLSL shaders, uploads the grid texture, sends square min/max + HUD arrays, and draws fullscreen triangles. @static/niityt/renderer.js#72-320
- `input.js` maps pointer events to square UVs, tracks drag placement, deactivates when leaving the canvas, and now listens for wheel/number-key shortcuts to cycle toolbelt slots. @static/niityt/input.js#1-99
- Shaders live in `static/niityt/shaders/`. `grid.frag.glsl` now branches between square playfield and gutter rails. @static/niityt/shaders/grid.frag.glsl#1-177
- CSS + template wrap the canvas in a frosted card, set an aspect ratio, and drop in human copy. @static/css/niityt.css#1-28 @templates/components/niityt.html#1-17

### Install (Drop-In)
1. Render the component snippet: `{% include 'components/niityt.html' %}` (see Flask wiring for `/niityt`). @app.py#177-232
2. Serve `/static/niityt/main.js`, `/static/niityt/shaders/*`, `/static/niityt/layout.js`, and `/static/css/niityt.css`.
3. Style overrides are optional; the default wrapper stretches full width with a 16:10 canvas. @static/css/niityt.css#1-28
4. Optional modes: pass `?mode=duel` to `/niityt` or set `data-niityt-mode="duel"` on the canvas to opt a Niityt instance into duel mode; sandbox remains the default.

### Extend or Hack
- Tune grid size or control band heuristics inside `ProtoState` (mirror to WASM if perf becomes critical). @static/niityt/state.js#1-206 @wasm/niityt-core/src/lib.rs#1-235
- Feed external data by swapping `state.tick()` with a WASM export, but keep the render payload contract stable. @static/niityt/main.js#11-30
- Layout tweaks run through `computeSquareLayout()` + shader uniforms; keep renderer/input/state in sync when changing gutters. @static/niityt/layout.js#1-52 @static/niityt/renderer.js#154-320
- Shader experiments live in `shaders/grid.*.glsl`; update uniform bindings when adding cues (e.g., telemetry icons). @static/niityt/shaders/grid.frag.glsl#1-177 @static/niityt/renderer.js#93-320
- Pigment systems: adjust `generatePigmentLayer()`, stack caps, or slot encoding to prototype new color economies—remember to keep `cellColors` + shader palette tables aligned with any new IDs. @static/niityt/state.js#22-395 @static/niityt/shaders/grid.frag.glsl#47-229
- Input experiments (multitouch, keyboard) extend `InputController` and should respect square clamps before calling `state.placeControl()`. @static/niityt/input.js#1-70

### HUD Layout Direction (Square Playfield)
- **Render everything in-canvas.** Keep the “single WebGL UI” pledge by painting HUD rails, playfield, and chrome inside the same WebGL pass; no DOM-side panels. @templates/components/niityt.html#1-17 @static/css/niityt.css#1-28
- **Square playable core.** The infection grid occupies a centered square regardless of aspect ratio. Renderer feeds `u_squareMin/max` and the shader remaps sample UVs into that region, so DPR/resizes stay crisp. @static/niityt/renderer.js#154-320 @static/niityt/shaders/grid.frag.glsl#47-175
- **Icon gutters + toolbelt.** Left rail shows normalized energy/fertilizer/spread icons layered with the first four toolbelt slots; right rail hosts the remaining slots and future diagnostics/boost cues, all rendered through the same `renderToolbeltRail()` geometry. @static/niityt/state.js#239-321 @static/niityt/renderer.js#439-477 @static/niityt/shaders/grid.frag.glsl#168-265
- **Pointer routing.** Input clamps screen UVs into the square before mapping to grid coordinates, while `ProtoState` further gates `placeControl()` through the reach mask and energy checks; you can only plant on in-reach, empty cells even as gutters and aspect ratio shift. @static/niityt/input.js#37-58 @static/niityt/state.js#168-201 @static/niityt/state.js#333-380
- **Next implementation steps.**
  - Feed gutter hover metrics back into `InputController` once gutters gain interactions.
  - Capture screenshots/gifs once HUD rails feel stable.
  - Offer a feature flag to flip between JS + WASM states without touching renderer contracts.

---

## 3. Snapshot (2025-12-10d)
_Supersedes the HUD-centric snapshot (2025-12-10c) by capturing fertilizer boosts, reach visualization, and the refined fertilizer HUD counter._

> Snapshot cue: keep pigment/toolbelt IDs, shader palettes, and renderer uniform contracts synchronized whenever inventories change.

### Topology & Entry Points
- **Route + component.** `/niityt` renders `templates/components/niityt.html`, which wraps the canvas + hint copy and loads `static/niityt/main.js`. @app.py#177-232 @templates/components/niityt.html#1-17
- **Bootstrap.** `main.js` guards against double-mounts, instantiates state/renderer/input per canvas, and starts RAF per node. @static/niityt/main.js#1-50
- **Runtime modules.** Client code lives under `static/niityt/*.js`, including the new `layout.js`. Shaders sit in `static/niityt/shaders`. @static/niityt/layout.js#1-52 @static/niityt/renderer.js#51-320
- **Native parity.** `wasm/niityt-core` mirrors grid math (minus current HUD rails) and remains a future perf path; build outputs live under `static/niityt/pkg/`. @wasm/niityt-core/src/lib.rs#1-235

### Runtime Flow
1. **Discovery.** `bootstrapAll()` queries `.niityt-canvas`, skips already-mounted nodes, and awaits `mountNiityt()` promises. @static/niityt/main.js#33-48
2. **Initialization.** `mountNiityt()` creates `ProtoState`, `NiitytRenderer`, and `InputController`, awaits shader program compilation, and seeds `lastTime` for delta clamping (≤0.2 s). @static/niityt/main.js#7-30
3. **Frame loop.** Each RAF tick computes `delta`, advances `state.tick(delta)` (regen, spread, healing), and hands `renderer.render()` the payload plus `input.pointerActive`. @static/niityt/main.js#18-29 @static/niityt/state.js#28-118
4. **State → renderer contract.** `getRenderPayload()` ships the grid + pigment textures, band height, energy norm, pointer cell, HUD arrays, toolbelt slices, fertilizer meter (both normalized and raw count), recent pickup metadata for shader glows, and now an ownership mask plus a duel match descriptor (mode/finished/winner) for future AI modes. @static/niityt/state.js#209-292
5. **Renderer duties.** `NiitytRenderer` uploads textures, caches uniform locations (including square min/max + HUD arrays), updates layouts on resize, and draws fullscreen triangles. @static/niityt/renderer.js#93-320
6. **Shader branching.** `grid.frag.glsl` differentiates square playfield vs. gutters: square draws infection pixels, band pulses, and pointer glow; gutters draw slot rails driven by HUD arrays. @static/niityt/shaders/grid.frag.glsl#27-175

### Renderer & Shader Notes
| Concept | Source | Details |
| --- | --- | --- |
| Geometry setup | @static/niityt/renderer.js#120-131 | Fullscreen triangle VAO with a single attribute (vec2 clip coordinates). |
| Texture pipeline | @static/niityt/renderer.js#134-208 | Grid uploaded as `R8` using `texImage2D` on size changes and `texSubImage2D` otherwise; nearest filtering keeps pixels sharp. |
| Layout uniforms | @static/niityt/renderer.js#168-320 | Renderer recomputes `computeSquareLayout()` per resize and feeds `u_squareMin/u_squareMax` so shaders can remap UVs. |
| HUD arrays | @static/niityt/renderer.js#291-316 | Two `Float32Array` buffers (left/right) + counts flow into `u_hud*` uniforms; renderer falls back to zeroed arrays if state does not supply them. |
| Pointer cues | @static/niityt/renderer.js#262-289 @static/niityt/shaders/grid.frag.glsl#75-158 | Pointer UV converts grid cells into screen UVs; the shader overlays a reduced-intensity pointer glow gated by `u_pointerActive`. |
| Gutter rails | @static/niityt/shaders/grid.frag.glsl#91-175 | `renderToolbeltRail()` splits gutters into slot bands (up to `HUD_ICON_LIMIT`) and fills them according to normalized values (energy/fertilizer/spread on the left, toolbelt slots on both sides). |
| Reach mask & brightness | @static/niityt/state.js#333-380 @static/niityt/renderer.js#304-320 @static/niityt/shaders/grid.frag.glsl#273-295 | `updateReachField()` writes a reach texture that both gates placements and brightens in-reach cells in the shader, making viable territory legible without extra HUD chrome. |
| Toolbelt + pigment pickups | @static/niityt/renderer.js#308-466 @static/niityt/shaders/grid.frag.glsl#124-189 | Toolbelt slices (fill, color IDs, active flags, stack counts) and fertilizer/pickup uniforms (`u_fertilizerNorm`, `u_recentPickup*`) drive gutter slot fills, stack ticks, pickup glows, and the fertilizer counter overlay. |
| Fertilizer boost halo | @static/niityt/state.js#79-143 @static/niityt/renderer.js#318-517 @static/niityt/shaders/grid.frag.glsl#292-307 | A `fertilizerBoost` descriptor (center UV, radius, strength, color ID) feeds uniforms (`u_fertilizerBoost*`); the fragment shader renders a debug-friendly dark halo over the boosted region whose falloff roughly matches the mechanical radius. |

### State & Mechanics
- **Energy economy.** Control placements cost 12 energy; regen is 6/s with a small claimed-cell bonus, capped at 120. @static/niityt/state.js#1-44
- **Spread + healing.** Each tick samples up to `SPREAD_SAMPLES * dt * bonus` neighbors (bonus scales with claimed cells). Empty targets get seeded with decayed value; existing cells get occasional reinforcement; claimed cells heal up to +6 per tick. @static/niityt/state.js#48-118
- **Pointer + reach gating.** `setPointerFromUV()` clamps normalized UVs into grid coords; `placeControl()` delegates to `isCellInReach()` so you can only plant on in-reach, empty cells with enough energy, decoupling placement rules from a hard control-band threshold. @static/niityt/state.js#168-201 @static/niityt/state.js#333-380
- **Reach field.** `updateReachField()` runs a small-radius flood fill from the bottom row and all claimed cells, producing a `reach` mask that both gates placement and drives a subtle brightness lift in the shader, hinting at where new controls are allowed to grow. @static/niityt/state.js#333-380 @static/niityt/shaders/grid.frag.glsl#273-295
- **HUD descriptors.** `buildHudDescriptors()` normalizes energy, fertilizer, and spread into left-rail icon fills and leaves the right rail available for diagnostics/boost cues. @static/niityt/state.js#301-308
- **Pigment layer + fertilizer.** `generatePigmentLayer()` places 20 white fertilizer seeds plus one of each pigment variant; harvesting fertilizer increments a single global `fertilizer` counter (capped at 80) that drives the fertilizer slot HUD counter. @static/niityt/state.js#381-441
- **Toolbelt slots + selection.** Eight toolbelt slots live across the gutters: a locked base meadow tool, a locked fertilizer slot, and pigment unlocks. Slots are encoded into left/right descriptors for the shader; scroll wheel, `1-8`, and `Q/E` rotate selection, and clicking on either rail selects a slot. @static/niityt/state.js#468-488 @static/niityt/input.js#83-128
- **Fertilizer boosts.** Dropping fertilizer (`dropFertilizer()` via `F` at the pointer) consumes one global fertilizer, anchors a `fertilizerBoost` around the chosen cell, and temporarily increases local spread/reinforcement probabilities inside a radius tuned by `FERTILIZER_BOOST_RADIUS`; the boost strength decays over `FERTILIZER_BOOST_DURATION` seconds. @static/niityt/state.js#79-143
- **WASM parity.** Rust mirrors grid size, energy, spread, and placement rules (minus HUD/toolbelt plumbing) for potential perf toggles. @wasm/niityt-core/src/lib.rs#3-235

### Layout & HUD Surfaces
- `computeSquareLayout()` derives the centered square, gutter padding, and normalized play region; `mapScreenToSquare()` clamps pointer UVs before translating to square UVs. @static/niityt/layout.js#1-52
- Renderer caches the latest layout, exposes `u_squareMin/u_squareMax`, and re-evaluates on every resize or DPR change. @static/niityt/renderer.js#154-320
- Shader helpers convert screen UVs ↔ square UVs, letting the fragment shader branch between square playfield and gutter rails without extra draw calls. @static/niityt/shaders/grid.frag.glsl#47-175
- Gutters now split duties: `renderToolbeltRail()` renders HUD fills, fertilizer column, toolbelt slots, stack ticks, and pickup glows without extra draw calls. Future glyph overlays should reuse the same slot geometry to stay token-light. @static/niityt/shaders/grid.frag.glsl#124-189

### Input & UX
- `InputController` listens for pointer move/down/up/leave, converts screen coords → raw UVs → square-mapped UVs, and sets `pointerActive` only when the cursor is inside the square. Dragging while active auto-places controls. @static/niityt/input.js#1-70
- Leaving the canvas or resizing resets `pointerActive`, preventing stale highlights, while wheel input (passive false) cycles slot focus and `1-8/Q/E` keys snap to specific slots. @static/niityt/input.js#77-97
- Canvas accessibility: `role="img"` and an aria-label are provided in the template; CSS creates a frosted wrapper + hint copy. @templates/components/niityt.html#1-17 @static/css/niityt.css#1-28

### Integration & Workflow
- `render_niityt_page()` wraps the component with explanatory copy and reuses the site-wide layout so `/niityt` behaves like other docs pages. @app.py#177-232
- Static consumers must ship the JS modules, shaders, CSS, and (optionally) WASM pkg; no bundler is required thanks to native ES modules. @static/niityt/main.js#1-50 @static/niityt/pkg/
- When archiving runs, copy this file into `static/niityt/docs/ai_gen/YYYY-MM-DDx-handbook.md` before refreshing the living version.

### Recent Changes (vs 2025-12-10b)
- **Pigment harvesting loop.** `ProtoState` now tracks pigment IDs per cell, fertilizer gains, recent pickup timers, and toolbelt stacks so renderer/shader combos can paint inventory rails. @static/niityt/state.js#22-395
- **Toolbelt uniforms + shader rails.** Renderer streams left/right toolbelt slices plus fertilizer + pickup uniforms, while `renderToolbeltRail()` draws slot fills, stack ticks, and glow cues tied to `recentPickup`. @static/niityt/renderer.js#308-466 @static/niityt/shaders/grid.frag.glsl#124-189
- **Slot UX controls.** `InputController` listens for wheel deltas and `1-8/Q/E` hotkeys to flip the active toolbelt slot without touching the HUD DOM. @static/niityt/input.js#77-97

### Open Questions / TODOs / AI Generated ideas
- [x] Document the GLSL shader structure (square mapping, band pulses, pointer cues, rail fills) inside this handbook; add screenshots later for visual verification. @static/niityt/shaders/grid.frag.glsl#47-175
- [ ] Decide whether JS or WASM state is the source of truth, then expose a feature flag in `main.js` to toggle implementations for perf testing. @static/niityt/main.js#7-30 @wasm/niityt-core/src/lib.rs#1-235
- [ ] Add keyboard/touch affordances (e.g., spacebar placement, multitouch) plus updated accessibility notes in the template. @static/niityt/input.js#1-70 @templates/components/niityt.html#1-17
- [ ] Surface gutter-hover telemetry (e.g., ability descriptions) without breaking the canvas-only aesthetic—consider subtle shader text or DOM overlays that mirror canvas visuals.
- [ ] Implement the color-capture toolbelt loop: ground pigment map + pickups in state, eight-slot inventory with active selection, HUD slot rendering, and shader tinting for planted blooms. @static/niityt/state.js#13-231 @static/niityt/renderer.js#93-320 @static/niityt/shaders/grid.frag.glsl#27-175 @static/niityt/input.js#1-70
- [ ] Capture and link HUD screenshots/gifs once gutters stabilize so future agents can visually verify shader expectations.
- [ ] Add iconography/labels inside toolbelt slots so pigments remain distinguishable when colors converge; consider GLSL distance-field sprites or minimal DOM overlays that mirror shader state. @static/niityt/shaders/grid.frag.glsl#124-189

---

Older README/start_prompt files (if any) should now point readers to this handbook.
