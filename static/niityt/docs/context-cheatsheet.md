# Niityt Quick Context (2025-12-10)
_Aim: reduce future context-gathering by pointing to authoritative sources._

## Runtime Topology
- **Bootstrap** – `static/niityt/main.js`: mounts each `.niityt-canvas`, builds `ProtoState`, `NiitytRenderer`, and `InputController`, then RAF-ticks `state.tick()` → `renderer.render()`.
- **State** – `static/niityt/state.js`: owns grid buffers (`grid`, `cellColors`, `pigments`), timers, toolbelt, fertilizer, and render payload assembly.
- **Renderer** – `static/niityt/renderer.js`: WebGL2 setup, uniform binding list, HUD/toolbelt buffer uploads, layout recalcs.
- **Input** – `static/niityt/input.js`: pointer mapping via `layout.js`, drag placement, wheel & hotkey slot cycling.
- **Shaders** – `static/niityt/shaders/grid.vert.glsl` + `grid.frag.glsl`: fullscreen tri vertex, fragment handles playfield, control band, pointer glows, gutter rails, toolbelt visualization.
- **Docs** – `static/niityt/docs/handbook.md`: living handbook + dated snapshots (see `static/niityt/docs/ai_gen/`).

## Core Constants (`state.js` top section)
- `CONTROL_COST = 12`, `ENERGY_CAP = 120`, `BASE_CHARGE_RATE = 6`.
- `SPREAD_SAMPLES = 2000`.
- HUD/toolbelt sizing: `HUD_ICON_LIMIT = 4`, `TOOLBELT_SLOT_COUNT = 8`, `TOOLBELT_STACK_CAP = 12`.
- Pigments: `PIGMENT_NONE = 0`, `PIGMENT_FERTILIZER = 1`, `PIGMENT_VARIANTS = [2…7]`.
- Caps: `FERTILIZER_MAX = 80`, pickup glow window `RECENT_PICKUP_WINDOW = 1.5` seconds.

## State Flow Highlights (`state.js`)
1. **Constructor**: allocates buffers (`Uint8Array`), sets control band height (`height * 0.08`), seeds energy, timers, toolbelt array, fertilizer counter, and invokes `generatePigmentLayer()`.
2. **`tick(dt)`**: updates time, accumulates energy with spread-based bonus, runs `spread(iterations)` + `healClaimed(dt)` + `updatePickupTimer(dt)`.
3. **`spread()`**: chooses random claimed source, attempts propagation; empty neighbors inherit color via `inheritColorFromSource()` and call `onCellClaimed()` which pushes index, harvests pigment, stamps `cellColors`.
4. **Placement**: `placeControl(x,y)` enforces control band (`y >= height - controlBandHeight`), energy cost, emptiness, then seeds `grid[idx] = 255` and consumes active toolbelt pigment.
5. **Pigment harvesting**: `harvestPigment(idx)` reads `pigments[idx]`; fertilizer increments `this.fertilizer`, colors go through `collectPigment()` stacking logic, then pigment cell is reset.
6. **Toolbelt serialization**: `getToolbeltDescriptors()` splits slots per side via `encodeToolbeltSlice()` producing `Float32Array` fill/color/active/stack buffers used by renderer.
7. **Render payload**: `getRenderPayload(time,pointerActive)` returns textures, layout norms, HUD arrays, toolbelt arrays, fertilizer ratio, pointer info, and recent pickup struct.

## Renderer/Shader Contract (`renderer.js`, `grid.frag.glsl`)
- Textures: `u_grid` (R8 growth values) + `u_cellColors` (color IDs scaled by 1/255).
- Layout uniforms: `u_squareMin`, `u_squareMax` from `computeSquareLayout()` (centered square).
- Dynamic uniforms: `u_time`, `u_bandHeight`, `u_energyNorm`, `u_pointerUv`, `u_pointerActive`.
- HUD/toolbelt arrays: `u_hudLeft/RightValues` (+ counts) and per-side toolbelt fill/colors/active/stacks arrays sized to `HUD_ICON_LIMIT`.
- Fertilizer/pickup cues: `u_fertilizerNorm`, `u_recentPickupColor`, `u_recentPickupStrength`.
- Fragment helpers: `groundColor()`, `playerColor()`, `pigmentPalette()`, `renderBand()`, `renderPointer()`, `renderToolbeltRail()` (handles slot fill, stack ticks, active glow, fertilizer column, pickup glow).

## Input & UX (`input.js`, `layout.js`)
- Pointer move maps screen UV through `computeSquareLayout()` + `mapScreenToSquare()`; only inside square keeps pointer active.
- Dragging while pointerDown continuously calls `state.placeControl()`.
- Scroll wheel cycles toolbelt via `state.shiftActiveSlot(direction)`; numeric keys `1-8` select slots; `Q/E` cycle left/right.

## Docs & Verification Sources
- **Handbook** (`static/niityt/docs/handbook.md`): Invocation prompt, snapshot, TODOs; update date stamp each refresh.
- **TODO plan** (`static/niityt/docs/todo.md`): historical color-capture checklist + open follow-ups (palette packing, slot UX, fertilizer verb).
- **WASM parity** (`wasm/niityt-core/src/lib.rs`): Mirrors state internals; ensure constant changes stay synced.

_Use this sheet as the quick pointer set before diving into feature work._
