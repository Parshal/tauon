# WASM → WebGL Shader Dataflow

This note captures the end-to-end path for GPU-visible data that originates inside our WebAssembly generator and ends up shaded in `star2.frag.glsl`. Use it as a template for future shader/data migrations.

## 1. Generation (WASM module)
- **File**: `src/wasm/star_field.c`
- **Exported entrypoint**: `generate_star_field(density, softness, glow, hero_bias, time)`
- **Outputs in linear memory**:
  - `star_descriptors` (Float32 ×12 per star) → world-space position, size/scale, tint, sparkle
  - `local_offsets`/`local_counts` + `local_ids` (Uint32) → primary cell membership lists
  - `spill_offsets`/`spill_counts` + `spill_ids` (Uint32) → neighbor coverage lists
  - `layer_info` (Float32 ×4 per layer) → `cellsPerAxis`, `cellSize`, `scale`, `cellOffset`
- **Helper getters** (`get_*`) expose counts and typed array pointers so JS can map them via the shared `WebAssembly.Memory`.

## 2. JS Binding / Loader
- **File**: `src/modules/starFieldWasm.js`
- **Class**: `WasmStarFieldGenerator`
  1. Fetch & instantiate `star_field.wasm`.
  2. Cache `instance.exports`, `memory`, `layer`/`cell` counts, and a snapshot of `layer_info` for texture upload.
  3. `generate(params)` invokes the exported `generate_star_field`, then copies each buffer into new typed arrays (Float32Array/Uint32Array) for downstream safety.
  4. Returns a POJO `{ starCount, descriptors, layerMeta, layerCount, cellCount, local: {...}, spill: {...} }` that mirrors the former JS generator output.

## 3. Renderer Plumbing
- **File**: `src/modules/renderer.js`
- **Functions of interest**:
  - `initStarFieldResources()` → awaits `createWasmStarFieldGenerator()`, builds float textures (RGBA32F / R32F / RG32F) plus layer-info texture.
  - `packDescriptorTextureData`, `packIdTextureData`, `packIndexTextureData` → tile 1-D arrays into 2-D textures constrained by `gl.MAX_TEXTURE_SIZE`.
  - `uploadStarFieldDescriptors/Ids/Indices()` → `texImage2D` into persistent textures and update dimension bookkeeping consumed by uniforms.
  - `configureStarFieldUniforms()` → binds samplers to texture units 6–11 for the fast-star shader.
  - `updateStarField()` → per-frame call; regenerates buffers, uploads textures, returns a uniform bundle (`starDescriptorWidth`, `starLocalWidth`, …) merged into the star pass render.

## 4. Shader Consumption
- **File**: `src/shaders/star2.frag.glsl`
- **Uniforms**: sampler2D + dimension scalars for descriptors, ID lists, index tables, and layer info.
- **Sampling helpers**:
  - `texCoord2D`, `readIdValue`, `readIndexValue`, `readDescriptorRow`
- **Flow**:
  1. Read layer info (grid size, scale, offsets).
  2. Determine current cell index from fragment’s layer-space coordinates.
  3. Fetch `(offset,count)` for local + spill stars from index textures.
  4. Loop indices (capped by `MAX_CELL_STAR_LOOP`), sample descriptor rows lazily (discarding off-layer IDs before fetching the remaining rows), shade each star via the glow LUT, and accumulate color.
  5. All layers now participate in accumulation with parallax-weighted blending so density can be distributed instead of forcing layer 0 to do all the work.

### Parameter mapping cheatsheet (fast-star path)

- **Density (`starFastDensity`)**
  - UI range: `0–200`.
  - WASM maps it to a physical density via an exponential curve between ~5 and 200 before generating up to ~35 000 stars.

- **Softness / Glow / Radius (`starFastSoft`, `starFastGlow`, `starFastGlowRad`)**
  - JS normalizes these and shapes them non-linearly before rebuilding the glow LUT and feeding shader uniforms.
  - The all-zero corner (`FastSft/Glw/Rad = 0`) is treated as a tight, almost halo-free core profile.
  - Increasing values first passes through a Krita-like profile (bright compact core, gentle halo) and only then into large, stylized halos.

- **Exposure (`starFastBright`)**
  - Constrained to `0–2` for the fast-star pass and applied as a simple multiplicative gain in `star2.frag.glsl`.

## 5. Extending / Swapping
To adapt this pipeline for a new shader or data source:
1. Reuse `WasmStarFieldGenerator` (or replace with your module) as long as you output the same descriptor/index layout.
2. Update `renderer.js` packing helpers if your descriptor size or per-entry texel count changes.
3. Thread new uniforms through `STAR_FAST_UNIFORMS` and extend `configureStarFieldUniforms` for extra samplers.
4. Mirror the changes inside the fragment shader—sample the new texture data via helper functions so tiling rules stay consistent.

Keep this document synced when adjusting any side of the loop (WASM memory layout, JS uploader, or GLSL consumer) so future contributors can reason about data dependencies without spelunking the entire stack.
