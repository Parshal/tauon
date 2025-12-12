# Niityt Living Handbook  
_Last refreshed: 2025-12-11b (update this stamp on every handbook refresh)_

This handbook is the single source of truth for both humans and copilots. It merges:

- **Invocation prompt** for AI agents.
- **Human-readable primer / README**.
- **Current architecture snapshot** of Niityt.

Treat it as *living*: every meaningful code change to Niityt should be reflected here, and every refresh should stay tightly grounded in the repository.

---

## 1. Invocation Prompt (copy/adapt verbatim)

_Use this section as the prompt when invoking an AI copilot for Niityt work._

You are assisting with **Niityt**, a 128×128 control-grid “meadow” that renders its entire HUD and playfield inside a single WebGL2 canvas. Your job is to work on Niityt’s code, shaders, and docs while keeping this **handbook** accurate and compact.

### 1.1 Scope: where to look

Focus on these paths:

- **Runtime (JS, core gameplay)**
  - [static/niityt/main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) – bootstrap and RAF loop. @static/niityt/main.js#1-52
  - [static/niityt/state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0) – [ProtoState](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1): energy, infection spread, flowers, fertilizer, reach, duel mode & AI opponent, render payload. @static/niityt/state.js#1-310
  - [static/niityt/input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0) – pointer, wheel, keyboard, toolbelt clicks. @static/niityt/input.js#1-155
  - [static/niityt/layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0) – centered-square layout + gutters and UV mapping. @static/niityt/layout.js#1-52

- **Rendering (WebGL2 + shaders)**
  - [static/niityt/renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0) – WebGL2 setup, textures, uniforms, HUD/toolbelt uploads, square-layout uniforms. @static/niityt/renderer.js#65-563
  - [static/niityt/shaders/grid.vert.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.vert.glsl:0:0-0:0) – fullscreen triangle vertex shader. @static/niityt/shaders/grid.vert.glsl#1-8
  - [static/niityt/shaders/grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) – fragment shader: playfield, reach brightness, flowers, owner tint, fertilizer halo, gutter rails, toolbelt HUD. @static/niityt/shaders/grid.frag.glsl#1-343

- **Integration & surfaces**
  - [static/css/niityt.css](cci:7://file:///home/void/repo/tauon/static/css/niityt.css:0:0-0:0) – wrapper card, canvas styling, hint text. @static/css/niityt.css#1-28
  - [templates/components/niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0) – `<canvas>` wrapper and script include. @templates/components/niityt.html#1-17
  - [app.py](cci:7://file:///home/void/repo/tauon/app.py:0:0-0:0) – [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0) route and page composition. @app.py#177-235

- **Native / parity**
  - [wasm/niityt-core/src/lib.rs](cci:7://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:0:0-0:0) – Rust mirror of the original JS state loop (grid, energy, spread, healing). JS is currently the authoritative behavior for flowers, fertilizer, reach, toolbelt, and AI. @wasm/niityt-core/src/lib.rs#3-134

- **Docs & planning**
  - [static/niityt/docs/handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) – this living handbook (you are editing it now).
  - `static/niityt/docs/context-cheatsheet.md` – quick runtime/contract digest. @static/niityt/docs/context-cheatsheet.md#1-47
  - [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) – focused TODO and checkpoints; currently centered on AI-opponent work. @static/niityt/docs/todo.md#1-147

Stay within these unless explicitly asked to touch host app infrastructure.

### 1.2 Reading order before you change anything

Before editing **code or this handbook**, follow this order:

1. **Skim this section (Invocation Prompt)** to understand expectations.
2. **Read the Snapshot section** in this handbook (Section 3) to get the current architecture picture.
3. **Skim `context-cheatsheet.md`** for the quick pointer list. @static/niityt/docs/context-cheatsheet.md#1-47
4. **Open the core runtime files**, in this order:
   - [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0) → [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0) → [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) → [input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0) → [layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0).
5. **Check [todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0)** to understand current feature focus and checkpoints. @static/niityt/docs/todo.md#1-147

Only after that should you start changing code, shaders, or this document.

### 1.3 Rules of engagement (for humans & copilots)

- **Ground every claim in code.**
  - Use citations like ``@static/niityt/state.js#68-91``.
  - If you’re unsure, say so and leave a TODO with a pointer.

- **Prefer compact, structured output.**
  - Use short paragraphs, bullets, and tables.
  - Avoid restating large chunks of code; reference them instead.

- **Keep contracts explicit.**
  - When you change:
    - [ProtoState.getRenderPayload()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:273:2-309:3) @static/niityt/state.js#274-310
    - [NiitytRenderer.render()](cci:1://file:///home/void/repo/tauon/static/niityt/renderer.js:350:2-561:3) payload handling @static/niityt/renderer.js#351-375
    - WebGL uniforms or samplers in [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) @static/niityt/shaders/grid.frag.glsl#9-41  
  - …you **must** document the new contract in the Snapshot section and ensure all three layers stay in sync.

- **JS vs WASM parity.**
  - JS ([state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0)) is currently the **source of truth** for gameplay (flowers, fertilizer, reach, AI duel).
  - WASM (`niityt-core`) mirrors a simpler grid/energy/spread loop and may diverge.
  - When you adjust constants or core spread rules, call out whether Rust has been updated.

- **Layout & HUD assumptions are shared.**
  - [computeSquareLayout()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:6:0-32:1) and [mapScreenToSquare()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:34:0-51:1) define the playable square and gutters. @static/niityt/layout.js#7-52
  - Renderer and shader both depend on `u_squareMin/u_squareMax` and `HUD_ICON_LIMIT`. @static/niityt/renderer.js#119-147 @static/niityt/shaders/grid.frag.glsl#4-25
  - Input must map screen coordinates into the same square region before asking state to place or drop. @static/niityt/input.js#37-58

### 1.4 Snapshot skeleton (for future refreshes)

When you refresh the architecture snapshot (Section 3), use this skeleton and update dates:

```markdown
## 3. Snapshot (YYYY-MM-DDx)

### Topology & Entry Points
- …

### Runtime Flow
- …

### Renderer & Shader Notes
| Concept | Source | Details |
| --- | --- | --- |
| … | @path#start-end | … |

### State & Mechanics
- …

### Layout & HUD Surfaces
- …

### Input & UX
- …

### Integration & Workflow
- …

### Recent Changes (vs previous snapshot)
- …

### Open Questions / TODOs
- [ ] …
```

Keep bullets short; rely on `@path#line-line` instead of long explanations.

### 1.5 Versioning & procedure

When you update Niityt or this handbook:

- **0. Stamp.**
  - Bump the `Last refreshed` stamp at the top using `YYYY-MM-DDx` (a, b, c… same-day refreshes).

- **1. Archive the previous version.**
  - Copy the *prior* [handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) into:
    - `static/niityt/docs/ai_gen/YYYY-MM-DDx-handbook.md`
  - Do **not** overwrite older snapshots; add a new file each time.

- **2. Refresh snapshot & references.**
  - Re-skim:
    - [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0), [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0), [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0), [input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0), [layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0),
    - [main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0), CSS, template, WASM core.
  - Update the Snapshot section:
    - Date and “Supersedes …” note.
    - Any changed contracts (payload fields, uniforms, modes).
    - Line ranges in `@path#start-end` where they’re obviously out of date.

- **3. Align TODOs.**
  - Check [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) vs. current code.
  - In this handbook’s **Open Questions / TODOs**, only keep items that are:
    - Actionable.
    - Clearly not implemented.
    - Tied to files/functions when possible.

- **4. Summarize deltas in-chat (for humans).**
  - When you finish a handbook refresh, summarize:
    - Which sections changed.
    - Which contracts changed.
    - Which TODOs were added/removed.

If you can’t fully verify something in code, say so explicitly and mark it as a question rather than asserting behavior.

---

## 2. Human Primer (what Niityt is and how to use it)

### 2.1 Concept

Niityt is a **128×128 infection “meadow”** rendered entirely inside a single WebGL2 canvas. You:

- Spend **energy** to plant control cells.
- Watch the **grass infection spread** across the grid.
- Harvest **flower seeds** and **fertilizer** from special tiles.
- Use an **eight-slot toolbelt** in the canvas gutters to pick flowers/tools.
- Optionally fight a simple **AI opponent** in “duel” mode on the same grid.

Everything—HUD, rails, band, counters, pointer glow—draws in one fragment shader, no DOM HUD.

### 2.2 How it feels to play

- **Playfield.**
  - Centered square of grass over dark soil.
  - Bottom band is the “control band”: early growth area, visually emphasized in-shader. @static/niityt/shaders/grid.frag.glsl#116-123

- **Energy & spread.**
  - Energy regenerates over time with a bonus for having more claimed cells. @static/niityt/state.js#1-4 @static/niityt/state.js#68-78
  - Placing a control cell costs energy and seeds infection that spreads stochastically to neighbors. @static/niityt/state.js#68-78 @static/niityt/state.js#114-152

- **Flowers.**
  - Discrete flower seeds (20 fertilizer tiles + one of each bloom variant) are pre-placed using deterministic noise. @static/niityt/state.js#425-455
  - Claiming a flower tile unlocks that color on the toolbelt; flowers behave as *permanent* tools rather than consumable stacks. @static/niityt/state.js#496-535 @static/niityt/state.js#709-740
  - The shader tints growth by flower IDs and shows flower previews even before claim. @static/niityt/shaders/grid.frag.glsl#68-88 @static/niityt/shaders/grid.frag.glsl#293-300

- **Fertilizer.**
  - Fertilizer tiles harvest into a global `fertilizer` counter shown numerically on the fertilizer tool slot. @static/niityt/state.js#9-16 @static/niityt/state.js#496-507 @static/niityt/shaders/grid.frag.glsl#230-270
  - Dropping fertilizer near an area temporarily boosts spread & reinforcement in a radius, and the shader draws a dark halo for the boosted region. @static/niityt/state.js#246-261 @static/niityt/state.js#154-177 @static/niityt/state.js#312-343 @static/niityt/shaders/grid.frag.glsl#311-321

- **Reach & placement.**
  - A **reach mask** floods from the bottom row and existing growth, giving roughly a 4-tile-radius buffer of “in-reach” cells. @static/niityt/state.js#376-423
  - Placement is only allowed where reach is true and the cell is empty, not by a fixed control band alone. @static/niityt/state.js#230-244 @static/niityt/state.js#418-423
  - Shader brightens in-reach cells and

# Niityt Living Handbook  
_Last refreshed: 2025-12-11b (update this stamp on every refresh)_

This handbook is the **single source of truth** for both humans and copilots working on Niityt. It merges:

- **Invocation prompt** for AI agents.  
- **Human-readable primer / README.**  
- **Current architecture snapshot** of the Niityt system.

Keep it short, accurate, and easy to refresh as the code evolves.

---

## 1. Invocation Prompt (for copilots)

_Use this section as the base prompt when you invoke an AI agent for Niityt._

### 1.1 Role

You are working on **Niityt**, a 128×128 control-grid “meadow” where:

- All HUD and gameplay visuals render **inside one WebGL2 canvas**.
- A **proto-state** simulates infection, flowers, fertilizer, reach, and an optional AI opponent.
- A single fragment shader renders:
  - Playfield (grass, flowers, owner tint, fertilizer halo).
  - Gutter HUD rails (toolbelt, fertilizer counter, simple telemetry).

Your job: modify code/shaders/UX **and** keep this handbook aligned with reality.

### 1.2 Scope & key files

Focus on these paths:

- **Runtime & mechanics**
  - [static/niityt/state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0) – [ProtoState](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1): grid, flowers, fertilizer, reach, duel-mode AI, render payload. @static/niityt/state.js#1-310 @static/niityt/state.js#425-741
  - [static/niityt/main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) – bootstrap: mount canvases, tick state, call renderer. @static/niityt/main.js#1-52
  - [static/niityt/input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0) – pointer, wheel, keyboard, toolbelt clicks. @static/niityt/input.js#1-155
  - [static/niityt/layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0) – centered square layout + gutters, UV mapping. @static/niityt/layout.js#1-52

- **Rendering & shaders**
  - [static/niityt/renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0) – WebGL2 setup, textures, uniforms, HUD/toolbelt uploads. @static/niityt/renderer.js#65-563
  - [static/niityt/shaders/grid.vert.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.vert.glsl:0:0-0:0) – fullscreen triangle vertex shader. @static/niityt/shaders/grid.vert.glsl#1-8
  - [static/niityt/shaders/grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) – fragment shader: playfield, reach brightening, flowers, owner tint, fertilizer halo, rails. @static/niityt/shaders/grid.frag.glsl#1-343

- **Integration**
  - [static/css/niityt.css](cci:7://file:///home/void/repo/tauon/static/css/niityt.css:0:0-0:0) – wrapper card, canvas styling, hint text. @static/css/niityt.css#1-28
  - [templates/components/niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0) – canvas HTML + script include. @templates/components/niityt.html#1-17
  - [app.py](cci:7://file:///home/void/repo/tauon/app.py:0:0-0:0) – [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0) route and page composition. @app.py#177-235

- **Parity & docs**
  - [wasm/niityt-core/src/lib.rs](cci:7://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:0:0-0:0) – Rust mirror of older JS grid/energy/spread logic. JS is authoritative for flowers, fertilizer, reach, and AI duel. @wasm/niityt-core/src/lib.rs#3-134
  - `static/niityt/docs/context-cheatsheet.md` – compact topology/contract cheatsheet. @static/niityt/docs/context-cheatsheet.md#1-47
  - [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) – focused plan & checkpoints (currently AI-opponent work). @static/niityt/docs/todo.md#1-147

### 1.3 Reading order (before edits)

Before changing code or this doc:

1. Read **this Invocation Prompt** and the **Snapshot** (Section 3).
2. Skim `context-cheatsheet.md`. @static/niityt/docs/context-cheatsheet.md#1-47
3. Open and skim:
   - [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0) → [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0) → [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) → [input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0) → [layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0).
4. Check [todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) for current focus and constraints. @static/niityt/docs/todo.md#1-147

### 1.4 Rules of engagement

- **Citations.**  
  - Cite behavior as ``@path#start-end`` whenever you rely on code.
  - If something is unclear, mark it explicitly as uncertain or leave a TODO with a pointer.

- **Token discipline.**
  - Prefer:
    - Short bullets.
    - Small tables.
    - Narrow, high-signal paragraphs.
  - Avoid copying large code blocks into docs.

- **Contract awareness.**
  - Keep these **in sync whenever you change them**:
    - [ProtoState.getRenderPayload()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:273:2-309:3) shape. @static/niityt/state.js#274-310  
    - [NiitytRenderer.render(payload)](cci:1://file:///home/void/repo/tauon/static/niityt/renderer.js:350:2-561:3) consumption & uniforms. @static/niityt/renderer.js#351-375 @static/niityt/renderer.js#423-557  
    - Shader uniforms/samplers and assumptions in [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0). @static/niityt/shaders/grid.frag.glsl#9-41
  - Call out key cross-layer contracts in the Snapshot section.

- **JS ↔ WASM.**
  - Treat **JS state ([state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0)) as authoritative** for:
    - flowers, fertilizer, reach, toolbelt, duel AI, match outcome.
  - Treat **Rust core** as a performance/experimentation mirror of:
    - grid, energy, spread, healing. @wasm/niityt-core/src/lib.rs#3-99  
  - If you change fundamental constants or spread rules, note whether Rust has been updated.

- **Square layout & gutters.**
  - [computeSquareLayout()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:6:0-32:1) and [mapScreenToSquare()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:34:0-51:1) define:
    - Playable square (`playMin*/playMax*`).
    - Gutters (left/right) where rails live. @static/niityt/layout.js#7-32
  - Renderer and shaders depend on `u_squareMin/u_squareMax`, `HUD_ICON_LIMIT`, and gutter geometry. @static/niityt/renderer.js#119-147 @static/niityt/shaders/grid.frag.glsl#4-25
  - Input must map pointer into the same square region before calling state. @static/niityt/input.js#37-58

### 1.5 Snapshot skeleton (for future refreshes)

Use this template under Section 3 when taking a new architecture snapshot:

```markdown
## 3. Snapshot (YYYY-MM-DDx)

### Topology & Entry Points
- …

### Runtime Flow
- …

### Renderer & Shader Notes
| Concept | Source | Details |
| --- | --- | --- |
| … | @path#start-end | … |

### State & Mechanics
- …

### Layout & HUD Surfaces
- …

### Input & UX
- …

### Integration & Workflow
- …

### Recent Changes (vs previous snapshot)
- …

### Open Questions / TODOs
- [ ] …
```

Do **not** duplicate large code chunks; point to them.

### 1.6 Versioning & procedure

When you update Niityt or this handbook:

- **1. Archive the old handbook.**
  - Before editing, copy the previous [handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) to:  
    - `static/niityt/docs/ai_gen/YYYY-MM-DDx-handbook.md`  
    - Use `a`, `b`, `c` suffixes for same-day runs.

- **2. Update the stamp.**
  - Bump the `Last refreshed:` line at the top of this file.

- **3. Refresh understanding.**
  - Re-skim [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0), [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0), [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0), [input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0), [layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0), [main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0), CSS, template, and `niityt-core`.

- **4. Update the Snapshot section.**
  - Refresh:
    - Date + “Supersedes …” line.
    - Any contract descriptions (render payload, uniforms, toolbelt/HUD layout, modes).
    - `@path#line-range` if code has moved significantly.

- **5. Align TODOs.**
  - Reconcile:
    - [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) (source-of-truth task list).  
    - Section **3.9 Open Questions / TODOs** here (curated, high-level).

- **6. Summarize deltas in the current chat/session.**
  - Briefly list:
    - What changed in code.
    - What changed in the handbook.
    - Any new or resolved TODOs.

---

## 2. Human Primer (Niityt in one page)

### 2.1 What Niityt is

Niityt is a **single-canvas meadow**:

- **Simulation:**
  - 128×128 infection grid (`Uint8Array`), flowers and fertilizer overlaid on cells, optional duel-mode AI opponent. @static/niityt/state.js#28-66 @static/niityt/state.js#425-455
- **Rendering:**
  - WebGL2 fullscreen triangle; fragment shader renders ground, grass, flowers, owner tint, reach brightness, fertilizer boost halo, and gutter HUD rails. @static/niityt/renderer.js#93-117 @static/niityt/shaders/grid.frag.glsl#1-343
- **Interaction:**
  - Mouse pointer within the square playfield, drag placement, wheel / `1–8` / `Q/E` toolbelt cycling, `F` for fertilizer. @static/niityt/input.js#37-58 @static/niityt/input.js#130-152
- **HUD:**
  - **Left/right gutters** show an eight-slot toolbelt plus fertilizer count and simple telemetry, all rendered in-shader. @static/niityt/state.js#345-365 @static/niityt/state.js#709-740 @static/niityt/shaders/grid.frag.glsl#180-277

### 2.2 How to embed [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0)

- **Route & page:**
  - [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0) is served by [niityt_demo()](cci:1://file:///home/void/repo/tauon/app.py:228:0-233:40) which calls [render_niityt_page()](cci:1://file:///home/void/repo/tauon/app.py:176:0-193:5). @app.py#177-235
- **Template usage:**
  - The Niityt canvas lives in [templates/components/niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0).  
  - Include it via Jinja:  
    ```jinja
    {% include 'components/niityt.html' %}
    ```
  - The template attaches `<script type="module" src=".../niityt/main.js">`. @templates/components/niityt.html#1-17

- **Static assets:**
  - Ensure your host serves:
    - [static/niityt/main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0), [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0), [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0), [input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0), [layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0).
    - [static/niityt/shaders/grid.vert.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.vert.glsl:0:0-0:0), [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0).
    - [static/css/niityt.css](cci:7://file:///home/void/repo/tauon/static/css/niityt.css:0:0-0:0).
    - Optionally [static/niityt/pkg/](cci:7://file:///home/void/repo/tauon/static/niityt/pkg:0:0-0:0) if using WASM.

- **Modes:**
  - Query param `?mode=duel` toggles duel mode; sandbox is default. @app.py#229-235  
  - The canvas also has `data-niityt-mode="{{ niityt_mode }}"`. [main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) passes this into [ProtoState](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1). @templates/components/niityt.html#1-7 @static/niityt/main.js#7-13

### 2.3 Quick tour of main modules

- **[main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0)** – Canvas bootstrap & loop:
  - Finds `.niityt-canvas` nodes, guards double-mounts, sets mode from `data-niityt-mode`, creates [ProtoState](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1), [NiitytRenderer](cci:2://file:///home/void/repo/tauon/static/niityt/renderer.js:64:0-562:1), [InputController](cci:2://file:///home/void/repo/tauon/static/niityt/input.js:5:0-153:1), and runs a RAF loop. @static/niityt/main.js#1-52

- **[state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0)** – Core simulation:
  - Encapsulates grid, flowers, fertilizer, reach, toolbelt, duel-mode AI, match outcome, and render payload construction. @static/niityt/state.js#1-310 @static/niityt/state.js#574-707

- **[renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0)** – WebGL2 facade:
  - Compiles shaders, sets up fullscreen triangle VAO, creates textures (`grid`, `cellColors`, `reach`, `owner`), uploads HUD/toolbelt arrays, and binds all uniforms before drawing. @static/niityt/renderer.js#65-212 @static/niityt/renderer.js#351-563

- **[input.js](cci:7://file:///home/void/repo/tauon/static/niityt/input.js:0:0-0:0)** – Input controller:
  - Pointer move/down/up, wheel, keydown; maps screen coords → square UV → grid cells; also handles clicking gutters to select toolbelt slots. @static/niityt/input.js#37-58 @static/niityt/input.js#83-152

- **[layout.js](cci:7://file:///home/void/repo/tauon/static/niityt/layout.js:0:0-0:0)** – Square layout math:
  - Computes a centered square inside the canvas and its gutters; maps arbitrary UVs into that square. @static/niityt/layout.js#7-52

- **[grid.vert.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.vert.glsl:0:0-0:0)** – Vertex shader:
  - Simple: takes `a_position` clip coords, emits `v_uv` and `gl_Position`. @static/niityt/shaders/grid.vert.glsl#1-8

- **[grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0)** – Fragment shader:
  - Handles ground noise, grass growth colors, flowers, reach brightness, AI owner tint, fertilizer halo, and left/right toolbelt rails with a numeric fertilizer counter on the fertilizer slot. @static/niityt/shaders/grid.frag.glsl#43-96 @static/niityt/shaders/grid.frag.glsl#180-277 @static/niityt/shaders/grid.frag.glsl#280-341

### 2.4 Mechanics overview

- **Energy & spread**
  - Constants: `CONTROL_COST = 12`, `ENERGY_CAP = 120`, `BASE_CHARGE_RATE = 6`, `SPREAD_SAMPLES = 500`. @static/niityt/state.js#1-4
  - [tick(dt)](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:86:4-97:5):
    - Increments `time`.
    - Regenerates energy with a bonus based on claimed cells.
    - Runs [spread(iterations)](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:164:4-191:5), [healClaimed(dt)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:92:2-102:3), [updatePickupTimer(dt)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:565:2-571:3), [updateFertilizerBoost(dt)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:104:2-111:3), duel AI updates, reach update, and match-state update. @static/niityt/state.js#68-91

- **Flowers & toolbelt**
  - Flowers: `FLOWER_NONE`, `FLOWER_FERTILIZER`, plus several bloom variants. @static/niityt/state.js#12-15
  - [generateFlowerLayer()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:424:2-454:3) seeds 20 fertilizer tiles and one of each variant using coord noise; flowers also tint `cellColors`. @static/niityt/state.js#425-455
  - Toolbelt:
    - Eight slots total, two locked cores: base meadow and fertilizer. @static/niityt/state.js#5-8 @static/niityt/state.js#367-374
    - Harvesting flowers unlocks colors into free slots; flowers behave as persistent tools. @static/niityt/state.js#496-535
    - [getToolbeltDescriptors()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:708:2-713:3) encodes fill/colors/active/stacks into left/right arrays passed to the shader. @static/niityt/state.js#709-740 @static/niityt/renderer.js#479-517 @static/niityt/shaders/grid.frag.glsl#180-277

- **Fertilizer**
  - Harvesting fertilizer increments a global counter up to `FERTILIZER_MAX`. @static/niityt/state.js#9-10 @static/niityt/state.js#496-507
  - Pressing `F` drops fertilizer at the pointer if on a claimed cell:
    - Creates a `fertilizerBoost` (center index, color, remaining/duration).
    - Boost factor is spatial (radius) × temporal (remaining/duration).
    - Shader shows a subtle dark halo over boosted region. @static/niityt/state.js#246-261 @static/niityt/state.js#154-177 @static/niityt/state.js#312-343 @static/niityt/shaders/grid.frag.glsl#311-321

- **Reach & placement**
  - [updateReachField()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:375:2-415:3) seeds reach from bottom row and claimed cells, then runs a fixed-radius flood to mark in-reach cells. @static/niityt/state.js#376-415
  - [placeControl(x,y)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:229:2-243:3) only succeeds if:
    - Duel match not finished.
    - Cell empty.
    - Cell is in reach.
    - Player has enough energy. @static/niityt/state.js#230-244
  - Shader brightens in-reach areas and dims out-of-reach, hinting where planting is allowed. @static/niityt/shaders/grid.frag.glsl#285-309

- **Duel mode & AI**
  - `mode` is `'sandbox'` or `'duel'` based on `data-niityt-mode`. @static/niityt/state.js#56-59 @static/niityt/main.js#11-13
  - In duel mode:
    - An AI starting line is seeded at the top row.
    - `owner` buffer tracks `OWNER_NEUTRAL`, `OWNER_PLAYER`, `OWNER_AI`. @static/niityt/state.js#20-22 @static/niityt/state.js#36-37 @static/niityt/state.js#457-466
    - AI maintains `aiEnergy`, ticks via [updateAi(dt)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:573:2-585:3) and chooses placements via [runAiTurn()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:587:2-635:3)/[aiPlaceControlAt()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:637:2-651:3). @static/niityt/state.js#18-19 @static/niityt/state.js#574-652
    - Match ends when no neutral cells remain; winner is decided by ownership counts. @static/niityt/state.js#654-707
  - Shader samples `u_owner` and tints AI territory darker. @static/niityt/shaders/grid.frag.glsl#46-48 @static/niityt/shaders/grid.frag.glsl#290-295

- **HUD & gutters**
  - [buildHudDescriptors()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:344:2-352:3) normalizes a small set of telemetry values (e.g., energy, fertilizer, spread) into left HUD icons; additional diagnostics can be added later. @static/niityt/state.js#345-353
  - Fragment shader uses `HUD_ICON_LIMIT` and HUD arrays to lay out four vertical slots per side, with per-slot fill, flower color, active glow, stack ticks, fertilizer count digits, and pickup glows. @static/niityt/shaders/grid.frag.glsl#4-41 @static/niityt/shaders/grid.frag.glsl#180-277

- **Input & UX**
  - Pointer movement:
    - Maps client coordinates → raw UV → square UV via [computeSquareLayout()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:6:0-32:1) + [mapScreenToSquare()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:34:0-51:1).
    - Deactivates pointer when leaving the square or canvas. @static/niityt/input.js#37-58 @static/niityt/layout.js#35-52
  - Clicks:
    - Left click first checks gutter rails for toolbelt slot selection; otherwise plants at pointer. @static/niityt/input.js#60-68 @static/niityt/input.js#83-128
  - Wheel & keys:
    - Wheel: cycle slots by ±1.
    - `1–8`: select specific slot.
    - `Q/E`: cycle slots.
    - `F`: drop fertilizer at pointer. @static/niityt/input.js#130-152

### 2.5 Where to poke first (for new contributors)

- **To change gameplay:** start in [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0) ([tick](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:86:4-97:5), [spread](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:164:4-191:5), flowers, fertilizer, duel AI). @static/niityt/state.js#68-91 @static/niityt/state.js#114-152 @static/niityt/state.js#574-707  
- **To change visuals:** start in [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0) (colors, halos, rails) and [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0) (uniforms, textures). @static/niityt/shaders/grid.frag.glsl#54-88 @static/niityt/shaders/grid.frag.glsl#180-277 @static/niityt/renderer.js#119-160 @static/niityt/renderer.js#351-557  
- **To change interactions:** adjust [InputController](cci:2://file:///home/void/repo/tauon/static/niityt/input.js:5:0-153:1) and layout mapping. @static/niityt/input.js#37-58 @static/niityt/input.js#83-152 @static/niityt/layout.js#7-52  
- **To embed or style differently:** tweak [niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0) and [niityt.css](cci:7://file:///home/void/repo/tauon/static/css/niityt.css:0:0-0:0). @templates/components/niityt.html#1-17 @static/css/niityt.css#1-28  

---

## 3. Snapshot (2025-12-11b)

_Supersedes the 2025-12-10d fertilizer/reach snapshot by adding duel-mode AI, ownership masks, and fertilizer-boost mechanics._

> Keep the **render payload**, **WebGL uniforms**, and **shader assumptions** synchronized whenever you touch state/renderer/shader contracts.

### 3.1 Topology & entry points

- **Route & page:** [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0) → [niityt_demo()](cci:1://file:///home/void/repo/tauon/app.py:228:0-233:40) → [render_niityt_page()](cci:1://file:///home/void/repo/tauon/app.py:176:0-193:5) → includes [components/niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0). @app.py#177-195 @app.py#229-235
- **Component:** [niityt.html](cci:7://file:///home/void/repo/tauon/templates/components/niityt.html:0:0-0:0) renders the canvas + hint copy and loads [static/niityt/main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) as an ES module. @templates/components/niityt.html#1-17
- **Runtime bundle:** core modules live in `static/niityt/*.js`; shaders in [static/niityt/shaders/](cci:7://file:///home/void/repo/tauon/static/niityt/shaders:0:0-0:0).
- **Native parity:** `wasm/niityt-core` provides a lean Rust version of the older state loop; not wired into the current JS UI but useful for experiments. @wasm/niityt-core/src/lib.rs#3-134

### 3.2 Runtime flow

1. **Discovery:** [bootstrapAll()](cci:1://file:///home/void/repo/tauon/static/niityt/main.js:33:0-42:1) queries `.niityt-canvas`, skips already-bound nodes, and calls [mountNiityt()](cci:1://file:///home/void/repo/tauon/static/niityt/main.js:6:0-31:1) for each. @static/niityt/main.js#34-43
2. **Initialization:** [mountNiityt(canvas)](cci:1://file:///home/void/repo/tauon/static/niityt/main.js:6:0-31:1):
   - Reads `data-niityt-mode` to choose `'sandbox'` vs `'duel'`.
   - Creates [ProtoState(128,128,{mode})](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1), [NiitytRenderer(canvas)](cci:2://file:///home/void/repo/tauon/static/niityt/renderer.js:64:0-562:1), [InputController(canvas,state)](cci:2://file:///home/void/repo/tauon/static/niityt/input.js:5:0-153:1). @static/niityt/main.js#7-17 @static/niityt/state.js#28-66
   - Awaits renderer init (WebGL context + shader compilation). @static/niityt/renderer.js#93-117
3. **Frame loop:**
   - [frame(now)](cci:1://file:///home/void/repo/tauon/static/niityt/main.js:18:2-26:3) computes `delta` (clamped to 0.2s), advances [state.tick(delta)](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:86:4-97:5), and calls [renderer.render(state.getRenderPayload(state.time, input.pointerActive))](cci:1://file:///home/void/repo/tauon/static/niityt/renderer.js:350:2-561:3). @static/niityt/main.js#19-25 @static/niityt/state.js#68-91 @static/niityt/state.js#274-310

### 3.3 Renderer & shader notes

| Concept | Source | Details |
| --- | --- | --- |
| Fullscreen geometry | @static/niityt/renderer.js#3-10 @static/niityt/renderer.js#162-173 | Single fullscreen triangle VAO with `a_position` → `v_uv` in vertex shader. |
| Textures | @static/niityt/renderer.js#175-212 | `gridTexture`, `cellColorTexture`, `reachTexture`, `ownerTexture` as `R8` textures with nearest filtering and clamp-to-edge. |
| Layout uniforms | @static/niityt/renderer.js#237-241 @static/niityt/renderer.js#452-457 @static/niityt/shaders/grid.frag.glsl#20-21 | Renderer recomputes [computeSquareLayout()](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:6:0-32:1) on resize and feeds `u_squareMin/u_squareMax` to the shader. |
| HUD arrays & toolbelt | @static/niityt/renderer.js#459-517 @static/niityt/state.js#345-365 @static/niityt/state.js#709-740 @static/niityt/shaders/grid.frag.glsl#22-33 | State encodes left/right HUD values + toolbelt slices; renderer passes them to uniform arrays; fragment shader draws four slots per side. |
| Reach & owner | @static/niityt/state.js#376-423 @static/niityt/renderer.js#315-349 @static/niityt/shaders/grid.frag.glsl#287-295 | State builds a reach mask and owner mask; renderer uploads them; shader brightens in-reach cells and tints AI-owned cells. |
| Fertilizer boost | @static/niityt/state.js#105-112 @static/niityt/state.js#312-343 @static/niityt/renderer.js#538-557 @static/niityt/shaders/grid.frag.glsl#311-321 | State emits a `fertilizerBoost` descriptor; renderer binds center/radius/strength/color uniforms; shader overlays a subtle halo over boosted area. |

### 3.4 State & mechanics

- **Core constants & buffers**
  - Energy, cost, spread, toolbelt, fertilizer, flowers, AI decision interval, owners. @static/niityt/state.js#1-22
  - Buffers: `grid`, `cellColors`, `flowers`, `owner`, `reach`, `reachScratch`. @static/niityt/state.js#33-37 @static/niityt/state.js#53-55

- **Tick loop**
  - [tick(dt)](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:86:4-97:5):
    - Updates time and energy (bonus from claimed cells).
    - Runs spread, healing, pickup timer, fertilizer boost decay, AI update (if duel), reach update, match outcome. @static/niityt/state.js#68-91

- **Spread & healing**
  - [spread(iterations)](cci:1://file:///home/void/repo/tauon/wasm/niityt-core/src/lib.rs:164:4-191:5):
    - Randomly samples from claimed cells.
    - Attempts to infect neighbors based on spread and reinforce chances, affected by fertilizer boost. @static/niityt/state.js#114-152
  - [healClaimed(dt)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:92:2-102:3) slowly restores growth value for claimed cells. @static/niityt/state.js#93-103

- **Flowers & harvesting**
  - [generateFlowerLayer()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:424:2-454:3) seeds fertilizer and color variants using a noise-based ordering. @static/niityt/state.js#425-455
  - [harvestFlower(idx)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:495:2-509:3) increments fertilizer or unlocks flowers into the toolbelt; updates pickup color & timer. @static/niityt/state.js#496-507
  - [collectFlower(flowerId)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:511:2-534:3) finds or allocates a toolbelt slot for new flowers, preferring unlocked or empty slots. @static/niityt/state.js#512-535

- **Toolbelt descriptors**
  - [initializeDefaultToolbelt()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:366:2-373:3) sets slot 0 to meadow, slot 1 to fertilizer, both locked. @static/niityt/state.js#367-374
  - [getToolbeltDescriptors()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:708:2-713:3) splits eight slots into left/right slices and encodes fill/color/active/stacks arrays used by renderer and shader. @static/niityt/state.js#709-740
  - [setActiveSlot](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:547:2-551:3) / [shiftActiveSlot](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:553:2-556:3) manage selection, wrapping indices safely. @static/niityt/state.js#548-557

- **Fertilizer boost**
  - [dropFertilizer(x,y)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:245:2-260:3) consumes fertilizer on a claimed cell and records a local boost descriptor. @static/niityt/state.js#246-261
  - [getFertilizerBoostFactor()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:153:2-176:3) computes a spatial × temporal multiplier based on distance to center and remaining time. @static/niityt/state.js#154-177
  - [getFertilizerBoostDescriptor()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:311:2-342:3) converts boost to UV/radius/strength/color for shader use. @static/niityt/state.js#312-343

- **Reach field & placement gating**
  - [updateReachField()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:375:2-415:3):
    - Seeds reach from bottom row and claimed cells.
    - Floods a fixed-radius reach region around them. @static/niityt/state.js#376-415
  - [isCellInReach(x,y)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:417:2-422:3) gates placement; [placeControl()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:229:2-243:3) and AI placement both rely on it. @static/niityt/state.js#418-423 @static/niityt/state.js#230-244 @static/niityt/state.js#638-651

- **Ownership & duel AI**
  - `owner` buffer is updated on cell claim; ownership stats are derived for match outcome. @static/niityt/state.js#475-487 @static/niityt/state.js#654-687
  - AI:
    - Maintains its own energy pool.
    - Periodically evaluates sample cells and chooses a target by heuristic scoring, then calls [aiPlaceControlAt()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:637:2-651:3). @static/niityt/state.js#574-586 @static/niityt/state.js#588-636
  - [updateMatchState()](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:688:2-706:3) determines winner (`player`, `ai`, or `draw`) when no neutral cells remain. @static/niityt/state.js#689-707

- **Render payload contract**
  - [getRenderPayload(time,pointerActive)](cci:1://file:///home/void/repo/tauon/static/niityt/state.js:273:2-309:3) returns:
    - Grid & flower data, size, time, pointer cell/active.
    - Band height, energy norm.
    - HUD left/right icons, toolbelt left/right arrays, active slot index.
    - Fertilizer count/norm, fertilizer boost descriptor.
    - Reach & owner masks, ownership stats, match summary, recent pickup metadata. @static/niityt/state.js#274-310

### 3.5 Layout & HUD surfaces

- [computeSquareLayout(width,height)](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:6:0-32:1):
  - Produces centered square region, play bounds, gutters, and normalized sizes. @static/niityt/layout.js#7-32
- [mapScreenToSquare(u,v,layout)](cci:1://file:///home/void/repo/tauon/static/niityt/layout.js:34:0-51:1):
  - Clamps to the square and reports whether the pointer is inside. @static/niityt/layout.js#35-52
- Renderer:
  - Recomputes layout on resize and sends `u_squareMin/u_squareMax` to shader. @static/niityt/renderer.js#223-241 @static/niityt/renderer.js#452-457
- Fragment shader:
  - Uses helpers to map between screen UV and square UV, determine whether a pixel is in the playfield or gutters, and draw toolbelt rails accordingly. @static/niityt/shaders/grid.frag.glsl#98-115 @static/niityt/shaders/grid.frag.glsl#280-339

### 3.6 Input & UX

- Pointer:
  - Tracks pointer inside square only; leaving the square or canvas resets pointer state. @static/niityt/input.js#37-58 @static/niityt/input.js#74-81
- Gutter clicks:
  - Map clicks in left/right gutters into toolbelt slot indices using HUD row count and layout. @static/niityt/input.js#83-128
- Wheel & keyboard:
  - Wheel scroll cycles active slot.
  - `1–8` selects slots.
  - `Q/E` cycles.
  - `F` triggers fertilizer drop at pointer. @static/niityt/input.js#130-152
- Template & CSS:
  - Canvas is wrapped in a frosted-card layout with hint copy; canvas has ARIA label for basic accessibility. @templates/components/niityt.html#1-16 @static/css/niityt.css#1-27

### 3.7 Integration & workflow

- [/niityt](cci:7://file:///home/void/repo/tauon/static/niityt:0:0-0:0) uses the same base layout as the Markdown viewer but replaces main content with the Niityt section. @app.py#177-195
- Assets are ES modules; no bundler is required.
- **Docs flow**:
  - Use `context-cheatsheet.md` for quick verification.
  - Use [todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) for focused plans (currently AI-opponent work).
  - Keep this [handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) as the **primary narrative spec** and invocation prompt.

### 3.8 Recent changes (vs 2025-12-10d)

- **Duel mode & AI opponent**
  - Added `mode` field (`sandbox`/`duel`), AI energy, AI decision loop, and AI placement under the same reach/energy rules as the player. @static/niityt/state.js#18-19 @static/niityt/state.js#28-66 @static/niityt/state.js#574-652
  - Seeded an AI-owned top-row starting line and added `owner` buffer and ownership statistics. @static/niityt/state.js#20-22 @static/niityt/state.js#457-466 @static/niityt/state.js#654-687

- **Ownership mask & shader tint**
  - Renderer now uploads `ownerMask` as `u_owner`; fragment shader tints AI-owned cells slightly greyer to distinguish territory. @static/niityt/renderer.js#333-349 @static/niityt/shaders/grid.frag.glsl#90-96 @static/niityt/shaders/grid.frag.glsl#290-295

- **Fertilizer boost halo**
  - Implemented time/space-limited fertilizer boost field in state and corresponding halo visualization in shader. @static/niityt/state.js#105-112 @static/niityt/state.js#312-343 @static/niityt/shaders/grid.frag.glsl#311-321

- **Duel-mode wiring**
  - `/niityt?mode=duel` and `data-niityt-mode` both connect through [main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) to [ProtoState](cci:2://file:///home/void/repo/tauon/static/niityt/state.js:27:0-740:1). @app.py#229-235 @templates/components/niityt.html#1-7 @static/niityt/main.js#7-13

### 3.9 Open questions / TODOs (curated)

_See [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0) for the full, task-level plan. This list is a higher-level, handbook-oriented view._

- [ ] **AI opponent design & tuning.**
  - Finalize duel flavor (win/lose framing, scoring), difficulty knobs, and how much the AI should “cheat” on information or reach. @static/niityt/docs/todo.md#8-36

- [ ] **JS vs WASM source-of-truth + feature flag.**
  - Decide which implementation is canonical for core infection dynamics and expose a toggle in [main.js](cci:7://file:///home/void/repo/tauon/static/niityt/main.js:0:0-0:0) to run via JS or WASM without changing renderer contracts. @static/niityt/main.js#7-30 @wasm/niityt-core/src/lib.rs#3-134

- [ ] **Input & accessibility expansion.**
  - Add touch/keyboard affordances (e.g., keyboard placement, multitouch), and extend accessibility notes in the template beyond basic ARIA labeling. @static/niityt/input.js#1-155 @templates/components/niityt.html#1-17

- [ ] **HUD clarity & iconography.**
  - Add clearer glyphs or text inside toolbelt slots (e.g., shader-based digits/icons) to distinguish flowers when colors converge, while preserving the canvas-only aesthetic. @static/niityt/shaders/grid.frag.glsl#180-277

- [ ] **Visual verification assets.**
  - Capture and link a small set of screenshots/gifs showing:
    - Sandbox growth.
    - Duel territory split.
    - Fertilizer boost halo.
    - Toolbelt selection and fertilizer counter.  

  Store references near [static/niityt/docs/](cci:7://file:///home/void/repo/tauon/static/niityt/docs:0:0-0:0) and mention them in this handbook once they exist.

When you complete any of these, **update both**:

- The detailed entry (or checklist) in [static/niityt/docs/todo.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/todo.md:0:0-0:0).  
- This subsection (mark items `[x]`, briefly summarize what changed, and add any new follow-up questions).