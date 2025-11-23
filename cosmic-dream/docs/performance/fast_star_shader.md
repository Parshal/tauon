# Fast-Star Shader Performance Notes

This doc captures how the fast-star path in Cosmic Dream spends its time and where the important levers live. It is meant as a bootstrap for future sessions that want to trade quality for speed (or vice versa) without re-deriving the whole pipeline.

## 0. Files in Play

- **WASM generator**
  - `src/wasm/star_field.c`
  - Produces star descriptors, per-cell local ID lists, spill ID lists, and layer metadata into linear memory.

- **JS bindings / fallback**
  - `src/modules/starFieldWasm.js` – wraps the WASM module and exposes `generate(params)`.
  - `src/modules/starField.js` – legacy JS generator with the same descriptor/index layout.

- **Renderer plumbing**
  - `src/modules/renderer.js`
    - `initStarFieldResources()`, `updateStarField()`
    - `packDescriptorTextureData`, `packIdTextureData`, `packIndexTextureData`

- **Fast-star fragment shader**
  - `src/shaders/star2.frag.glsl`

- **Config / docs**
  - `src/data/config.js` – slider ranges (`starFast*` params).
  - `docs/dataflows/wasm_webgl_shader.md` – high-level dataflow and parameter mapping.

## 1. High-Level Performance Shape

Each frame, when fast stars are enabled, the path looks like this:

1. **CPU / WASM (occasionally)**
   - `WasmStarFieldGenerator.generate(params)` in `starFieldWasm.js` calls `generate_star_field(density, softness, glow, hero_bias, time)`.
   - This runs C code that:
     - Loops over every layer and cell.
     - Decides how many stars this cell gets (based on a normalized density).
     - Synthesizes up to `MAX_STARS` descriptors.
     - Fills `local_offsets` / `local_counts` / `local_ids` and matching spill lists.
   - The result is copied out of WASM memory into typed arrays.

   This step only happens when the star state is regenerated (e.g. on density/softness/glow/radius/time changes), but copying arrays and repacking textures are still non-trivial at high star counts.

2. **CPU → GPU texture upload**
   - `updateStarField()` in `renderer.js`:
     - Packs descriptors into an RGBA32F texture (3 texels per star) via `packDescriptorTextureData`.
     - Packs ID arrays and index `(offset,count)` arrays into R32F/RG32F textures.
     - Uploads them with `texImage2D` into persistent textures.
   - Cost scales roughly with **starCount** and the size of the ID / index buffers.

3. **Fragment shader per-frame cost**
   - `star2.frag.glsl` runs for every pixel in the star pass framebuffer.
   - For each visible fragment it:
     1. Determines the current layer and cell index from fragment coordinates.
     2. Fetches local and spill `(offset,count)` for that cell.
     3. Loops over the union of local and spill IDs (capped by `MAX_CELL_STAR_LOOP`).
     4. For each star ID:
        - Lazily loads descriptor rows.
        - Computes a core + halo profile via a LUT-driven helper.
        - Accumulates the result into `accum`.

   This is the main GPU hotspot: even if each star is cheap, the number of stars considered per fragment can be high if many stars share a cell.

## 2. Key Constants and Their Impact

### 2.1 Star counts

- **MAX_STARS (WASM)** – `src/wasm/star_field.c`
  - Currently `35000`.
  - Hard cap on how many star descriptors are generated in the WASM path.

- **MAX_TOTAL_STARS (JS)** – `src/modules/starField.js`
  - Currently `35000`.
  - Same cap for the JS fallback generator.

- **MAX_STARS_PER_CELL** (both C and JS)
  - Currently `8`.
  - Per-cell cap before extra candidates are dropped.
  - Higher values:
    - Increase star density in hot cells.
    - Increase average loop length per fragment.
  - Lower values:
    - Flatten density in very crowded regions.
    - Bound the worst-case fragment cost more tightly.

### 2.2 Shader loop bound

- **MAX_CELL_STAR_LOOP** – `src/shaders/star2.frag.glsl`
  - Currently `256`.
  - Upper bound on how many stars we consider per cell.
  - For each of local + spill lists we run a `for (int i = 0; i < MAX_CELL_STAR_LOOP; ++i)` loop and break when we exceed the actual count, so the *effective* work is `min(count, MAX_CELL_STAR_LOOP)`.

### 2.3 Texture dimensions

- Descriptor texture dimensions are computed from `starCount` and `gl.MAX_TEXTURE_SIZE` via `computeTiledDimensions`.
- Large star counts create tall descriptor textures but the lookup cost is dominated by **number of sampled rows**, not physical texture size.

## 3. Fragment Shader Hotspots (`star2.frag.glsl`)

### 3.1 Per-fragment control flow

For each fragment:

- Compute aspect-correct UV and zoom attenuation.
- For each layer (up to `MAX_LAYERS`):
  - Lookup `layerInfo` to get `cellsPerAxis`, `invCells`, `layerScale`, `cellOffset`.
  - Transform UV into layer space and wrap it.
  - Convert to a cell index (`cellOffset + y * cellsPerAxis + x`).
  - Early-out if cellIndex is out of range.
  - Read local + spill index ranges for that cell.
  - Call `accumulateRange` for local and spill lists.

The cost per fragment is thus:

```
O(layers * (cost_of_cell_math + cost_of_local_range + cost_of_spill_range))
```

With the current tuning, only a small number of layers are active, but each layer still does all the cell bookkeeping.

### 3.2 `accumulateRange` and `shadeStar`

`accumulateRange` is where most of the per-fragment work lands:

```glsl
void accumulateRange(
    sampler2D idTex,
    float idWidth,
    float idHeight,
    vec2 indexInfo, // (offset,count)
    vec2 fragLocal,
    int layerIndex,
    float layerScale,
    float invCells,
    float layerWeight,
    float softness,
    float twinkle,
    float glowMix,
    float glowBoost,
    float glowRadiusGain,
    inout vec3 accum
) {
    float baseOffset = indexInfo.x;
    int countInt = int(floor(max(0.0, indexInfo.y) + 0.5));
    if (countInt <= 0) return;
    int loopCount = min(MAX_CELL_STAR_LOOP, countInt);
    for (int i = 0; i < MAX_CELL_STAR_LOOP; ++i) {
        if (i >= loopCount) break;
        float starId = readIdValue(idTex, idWidth, idHeight, baseOffset + float(i));
        accum += shadeStar(..., starId, ...);
    }
}
```

Inside `shadeStar` we:

- Check `starId` range and that the star belongs to the current layer.
- Compute `baseRadius` from the descriptor size, cell size, and layer scale.
- Wrap fragment-space coordinates into a toroidal layer space.
- Evaluate `evalGlowEnergy`, which:
  - Samples the glow LUT.
  - Computes a sharp core and softer halo.
  - Blends between core/halo based on softness and glow sliders.
- Apply twinkle and hero bias, then weight by layer and accumulate.

This function is branchy but structured to avoid work where possible:

- Off-layer stars are discarded early.
- A halo strength scalar gates halo work when sliders are at their minimal corner.

Still, when many stars share a cell, the `accumulateRange` loops dominate fragment cost.

## 4. UI Sliders vs Performance

These controls influence performance indirectly by changing how many stars are in play and how large their halos are.

### 4.1 `starFastDensity`

- UI range: `0–200`.
- Inside `WasmStarFieldGenerator.generate` we map:

  ```js
  const rawDensity = params.starFastDensity ?? 80;
  const densityNorm = Math.max(0, Math.min(1, rawDensity / 200));
  const minDensity = 5.0;
  const maxDensity = 200.0;
  const densityPhysical = minDensity * Math.pow(maxDensity / minDensity, densityNorm);
  const density = Math.max(0, Math.min(maxDensity, densityPhysical));
  ```

- Higher slider values → more stars per cell up to `MAX_STARS_PER_CELL` and ultimately more work in `accumulateRange`.

### 4.2 `starFastGlow` / `starFastGlowRad` / `starFastSoft`

- Affect **how many cells a star needs to spill into** and how much of the halo we see.
- Larger halos:
  - Increase the size of spill lists.
  - Increase the chance that many stars overlap in a single cell, again increasing `loopCount`.
- Current tuning deliberately keeps the “nice” range small so the cost bump is gradual.

### 4.3 `starFastBright`

- Pure scalar multiply in the shader.
- Does not affect control flow or sampling cost.
- Only impacts perceived brightness and precision pressure.

## 5. Obvious Performance Levers for Future Work

This section is a checklist for future sessions that want to trade quality for speed.

1. **Clamp per-cell star work more aggressively**
   - Lower `MAX_STARS_PER_CELL` (WASM/JS) so dense cells don’t explode `loopCount`.
   - Potentially expose a debug mode that visualizes per-cell `countInt` to choose sensible limits.

2. **Adaptive `MAX_CELL_STAR_LOOP`**
   - Currently a uniform compile-time constant.
   - Could be split into two bounds (local vs spill) or reduced if profiling shows we rarely need 256 iterations.

3. **Cheaper halo for distant / small stars**
   - Evaluate a simpler profile (e.g. pure 1/(1+r^n)) for non-hero stars or stars below a certain size, skipping glow LUT.
   - Keep full LUT-driven profile only for heroes or close layers.

4. **Regeneration frequency / caching**
   - If the camera and density are stable, we do not need to regenerate stars every frame.
   - Confirm that `updateStarField` only runs when relevant params change; if not, introduce dirty flags.

5. **Spill radius policy**
   - Current WASM computes a spill radius from `size * haloScale * worldToCell * 4.0` and clamps it to at most 2 cells.
   - For performance-heavy setups, we can:
     - Hard-cap this to 1 cell.
     - Or scale it down when density is high.

6. **Resolution / render scale options**
   - Introduce a fast path where the entire star pass renders at a lower resolution and is upscaled in the composite, trading sharpness for speed.

## 6. How to Use This Doc in a New Session

When starting a new performance-tuning pass for fast stars:

1. Skim **Section 1–3** to remember where the work lives (WASM vs JS vs fragment shader).
2. Look at **Section 2.1–2.2** to recall the core caps (`MAX_STARS`, `MAX_STARS_PER_CELL`, `MAX_CELL_STAR_LOOP`).
3. Check **Section 4** to understand how the artist-facing sliders influence those costs.
4. Pick a small number of levers from **Section 5** and design experiments around them, rather than tweaking everything at once.

This keeps future iterations grounded in the current architecture while still leaving plenty of room for more aggressive optimizations if needed.
