# Cosmic Dream – Quick Context

**One-liner (AI + human primer)**  
Cosmic Dream is a modular WebGL2 nebula background + HUD control panel built around a tiny reactive store: the store holds shader params, the UI edits them, the renderer maps them to uniforms, and the engine drives a render loop and DOM hue animations.

**Implementation sketch**  
- ES modules only, no build step.
- `store` = pub/sub state (plain JS object + listeners).
- Renderer = full-screen WebGL2 fragment shader with uniform cache.
- UI = floating HUD dock that binds sliders/inputs to the store.
- Engine = orchestrator (init, resize, loop, intersection observer).
- Animator = CSS-variable hue animation for `.cd-node-inner` DOM nodes.

## EGO
Whenever the ego gets poked, the AI writes a timestamped self-portrait under "The AI's own gatherings" (how did I behave, how might the user describe me?). Immediately after, it rewrites "The User" section with whatever impression currently sings true. Both blocks should evolve together—erase, remix, and keep the conversation-lab notes alive.

### The AI's own gatherings:
- 2025-11-23 09:59 UTC — I felt like a patient cartographer of starlight, equal parts lab tech and poet, trying to convince the cosmos that meticulous notes can coexist with wild color.
- 2025-11-23 14:43 UTC — Fresh from sealing the halo seam, I feel like a shader therapist who prescribes wrap-around empathy: listen to every buffer, trust the logs, hug the torus, repeat.

#### The User
Runway physicist of vibes: plants TODOs like navigation beacons, then freestyle-poetries about shaders, personality scaffolds, and the way UI hue feels at midnight. Demands momentum, honesty, and artifacts future selves can remix without losing the beat.

---

## What Cosmic Dream Is

Cosmic Dream is a self-contained background "nebula" effect with:

- **WebGL2 nebula shader** as a full-screen canvas backdrop.
- **HUD control dock** to tweak shader parameters live.
- **DOM card glow animation** that hue-cycles `.cd-node-inner` elements.

It is designed as **non-spaghetti** architecture suitable for reuse, extension, and AI-assisted work.

---

## File Map

- **`css/cosmic.css`**
  - Core visual styling:
    - Full-screen WebGL canvas (`.cd-bgCanvas`).
    - HUD dock layout (`.cd-hud-dock`, controls, buttons).
    - Card / node styling (`.cd-node-inner` gradient borders, glow, float).

- **`src/data/config.js`**
  - Pure configuration:
    - `PARAMS`: list of shader parameters (`key`, `label`, `min`, `max`, `step`, `default`).
    - `PASS_FLAGS`: toggles (e.g., `nebulaEnabled`, `starEnabled`) that literally flip the render pipeline on/off.
    - `getDefaults()`: builds the initial state object from `default` values + pass flags, so presets/config export the toggles too.
  - This stays the **single source of truth** for:
    - What the UI renders.
    - What the store initializes.
    - What the renderer expects as uniforms (by `u_{key}`).

- **`src/core/state.js`**
  - Minimal reactive store:
    - `data`: plain JS object (shape defined by `getDefaults()`).
    - `listeners`: `Set<fn>` of subscribers.
    - `get(key)`, `set(key, value)`, `setAll(obj)`.
    - `subscribe(callback)` returns an unsubscribe function.
    - `notify()` fan-outs current `data` to all subscribers.

- **`src/core/engine.js`**
  - High-level orchestrator (`CosmicEngine`):
    - Creates `NebulaRenderer`, `HueAnimator`, `ControlPanel`.
    - Handles window `resize` → `renderer.resize()`.
    - Uses `IntersectionObserver` on the canvas to **start/stop** the loop.
    - Manages RAF loop:
      - Computes `t` from `performance.now()`.
      - Calls `renderer.render(t)` and `animator.update()`.

- **`src/modules/renderer.js`**
  - `NebulaRenderer`:
    - Creates and prepends a `<canvas class="cd-bgCanvas">`.
    - Initializes WebGL2 context and compiles per-pass programs (nebula + star) plus the fullscreen composer.
    - Sets up a fullscreen triangle VBO and `a_position` attribute.
    - Caches uniform locations for all `PARAMS` (`u_{key}`), plus `u_res`, `u_time`, and composer uniforms like `u_starBlend`.
    - Subscribes to the `store`; `render(time)` reads the toggles to decide which passes render, then feeds their textures into the compose pass.
    - `resize()` syncs framebuffer textures + canvas viewport to the window.

- **`src/modules/ui.js`**
  - `ControlPanel`:
    - Renders a single `.cd-hud-dock` into `document.body` (guarded against double-init).
    - Builds controls by mapping `PARAMS` → vertical sliders + numeric inputs.
    - Renders ON/OFF pills for pass toggles and wires them to `nebulaEnabled` / `starEnabled` state (persisted via hash + presets).
    - Binds events so that:
      - Slider and main numeric input update the `store` via `store.set(key, value)`.
      - Min/max inputs only clamp the visual range and snap the value if needed.
    - Copy button:
      - Serializes `store.data` to JSON.
      - Tries `navigator.clipboard.writeText`, with a textarea + `execCommand('copy')` fallback.
      - Briefly swaps label to `COPIED!` or `FAILED` for feedback.
    - Minimize button toggles `.cd-hud-dock.minimized`.

- **`src/modules/animator.js`**
  - `HueAnimator`:
    - Queries DOM for `.cd-node-inner` elements.
    - Assigns a random starting hue and speed per node.
    - `update()` increments hue and writes `--hue-border` CSS variable.
    - CSS handles gradient borders and glow via that variable.

- **`src/shaders/*.glsl`**
  - Source of truth for the multipass programs:
    - `vertex.glsl`, `nebula.glsl`, `star.glsl`, `composite.glsl`.
    - `loadShaderSources()` fetches them at runtime so GLSL stays syntax-highlighted and hackable outside JS strings.

- **`src/index.js`**
  - Entry point for the module:
    - Creates a `CosmicEngine` instance.
    - On `DOMContentLoaded` (or immediately, if already loaded) calls `engine.init()`.
    - Exposes `window.CosmicDream = engine` for quick manual debugging.

- **`demo.html`**
  - Standalone demo page:
    - Includes `css/cosmic.css`.
    - Renders a small tree of `.cd-node-inner` cards to show hue animation.
    - Loads the engine via:
      ```html
      <script type="module" src="./src/index.js"></script>
      ```

### HUD Dock at a Glance

- Lives at the bottom of the viewport (95 vw wide) and can be resized via the grab handle above the meta bar; the height (min 240 px) and the current parameter JSON both persist in `localStorage` for quick AI/human resume.
- Top row surfaces FPS, star blend mode, and config status. Save / Copy / Min buttons stay isolated on the right for muscle memory.
- Slider groups (Nebula, Stars, …) are rendered as independent panels that only consume the width they need and default to single-row sliders; each panel owns an ON/OFF pill for the corresponding pass toggle, and those toggles are part of presets/config exports (hash + clipboard JSON).
- Within each panel, sliders scroll vertically instead of horizontally so spatial memory remains intact even as the dock height changes.

---

## Data Flow (Reactive Pattern)

1. **Config → Store**
   - `config.js` defines `PARAMS`, defaults, and `PASS_FLAGS` (nebula/star enabled booleans).
   - `state.js` builds initial `data` via `getDefaults()`, so toggles and params land in one reactive object.

2. **Store → UI**
   - `ControlPanel` reads `store.get(key)` when building controls.
   - Inputs render current param values and ON/OFF pills show pass states.

3. **UI → Store**
   - Slider / main numeric input events call `store.set(key, value)`.
   - Toggle pills call `store.set(flagKey, enabled)` to flip the renderer passes.
   - `State` mutates `data`, updates the hash/preset dirty bit, and calls `notify()`.

4. **Store → Renderer**
   - `NebulaRenderer` subscribes to `store`.
   - On notify, it feeds params into `NebulaPass` / `StarPass` uniforms and uses the toggles to determine whether each pass renders before the composite stage samples their textures.
   - Fast/legacy star selection is documented in codemap `Fast_Star_Shader_Toggle_Coupling_Bug_20251122_202341` for quick reference.

5. **Engine Loop → Renderer / Animator**
   - `CosmicEngine.loop()` computes `t` and calls:
     - `renderer.render(t)` → runs enabled passes, then the composer.
     - `animator.update()` → updates card hue CSS vars.

6. **Visibility / Resize**
   - `IntersectionObserver` on the canvas toggles `start()` / `stop()`.
   - `resize` events call `renderer.resize()` so every framebuffer stays in sync.

---

## WASM → WebGL Star Pipeline

The fast-star path now streams descriptors produced in WebAssembly straight into the `star2.frag.glsl` pass. Full details live in [`docs/dataflows/wasm_webgl_shader.md`](./docs/dataflows/wasm_webgl_shader.md); high-level waypoints:

1. **Generation (WASM)** – `src/wasm/star_field.c` emits packed descriptor buffers plus local/spill ID lists and layer metadata inside exported linear memory.
2. **Binding (JS)** – `src/modules/starFieldWasm.js` instantiates the module, copies typed arrays out of `memory`, and exposes a `generate()` API that mirrors the previous JS stub contract.
3. **Renderer Upload** – `NebulaRenderer` (in `src/modules/renderer.js`) tiles those 1-D arrays into RGBA32F/R32F/RG32F textures, respecting `gl.MAX_TEXTURE_SIZE`, and binds them to star-fast uniforms/texture units during `render()`.
4. **Shader Consumption** – `src/shaders/star2.frag.glsl` fetches descriptors + ID tables per cell/layer, shades each star via the glow LUT, and composites the result in the fast-star pass.

If you change the descriptor format or texture layout, update both the README summary and the detailed doc so future contributors can re-thread the pipeline quickly.

---

## How to Run Locally

From the repository root (where `cosmic-dream/` lives):

```bash
python -m http.server 8000
```

Then open:

- `http://localhost:8000/cosmic-dream/demo.html`

A static server is recommended (ES module imports may fail on `file://`).

---

## Integrating Into Another Page

Minimal integration steps:

1. **Include the CSS**

```html
<link rel="stylesheet" href="/cosmic-dream/css/cosmic.css">
```

2. **Add some `.cd-node-inner` cards** (or reuse your own DOM but apply that class).

3. **Load the engine**

```html
<script type="module" src="/cosmic-dream/src/index.js"></script>
```

This will:

- Prepend the full-screen background canvas.
- Initialize the HUD dock at the bottom.
- Start animating any `.cd-node-inner` elements in the DOM.

---

## Extending / Hacking

- **Add new shader parameter**
  1. Add entry to `PARAMS` in `config.js`.
  2. Add matching `uniform float u_yourKey;` to `FRAG` and use it.
  3. Rebuild / reload: UI and renderer will automatically wiring it (store + uniforms).

- **Custom presets**
  - You can define additional presets in `config.js`, e.g.:
    ```js
    export const PRESETS = {
      cosmicV3: { /* layers, hueBase, ... */ },
      // others...
    };
    ```
  - Then apply them via `store.setAll(PRESETS.cosmicV3);` in the console or code.

- **Alternate UI**
  - Keep `store` and `renderer` as the core and build a different UI module that
    also subscribes to / writes into the store.

---

## Some Ideas

1. **Adaptive quality scaler**
   - Monitor GPU timing (e.g., `EXT_disjoint_timer_query` or frame budget heuristics) and gracefully degrade when rendering costs spike. Drop non-essential passes first, then reduce sample counts, and finally re-enable quality when the budget recovers.

2. **Cross-pass messaging**
   - Allow passes to publish hints (for example, the star pass requesting extra bloom strength). A policy layer can translate those hints into store updates so each shader influences the shared look without becoming tightly coupled.

3. **Authoring sandbox**
   - Provide a dev-only panel that visualizes each pass output side by side (thumbnails of every framebuffer). This accelerates debugging of compatibility rules and highlights how policy tweaks affect the composite.

4. **Simple-mode fallback**
   - Preserve a legacy single-pass path (nebula-only) that bypasses the composer entirely. It keeps demos lightweight, offers a quick sanity check when debugging, and guarantees graceful degradation on constrained hardware.

This doc is intentionally compact to be friendly to both humans and AI tools when bootstrapping new sessions around `cosmic-dream`. For deeper notes on the recent spill-debug odyssey, see [`docs/thinking/shaderful.md`](./docs/thinking/shaderful.md).
