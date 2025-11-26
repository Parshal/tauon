# WASM + WebGL fast-star pipeline (prompt seed)

This document is a **prompt seed** for recreating the old Cosmic Dream fast-star pipeline that used a C/WASM generator feeding a WebGL2 fragment shader via data textures. The current branch has been simplified to a single minimal background pass, so this exists purely as *historical/bootstrapping context* for future work.

You can hand this whole file (or sections of it) to an AI to recover the former architecture.

---

## 1. High-level architecture to recreate

- **Goal:** Rebuild a pipeline where a C/WASM module synthesizes a star field into linear memory, JS uploads that data into float textures, and a WebGL2 fragment shader (`star2.frag.glsl`) consumes it to render a dense multi-layer starfield.
- **Key components (old world):**
  - `src/wasm/star_field.c` – C generator compiled to `star_field.wasm`.
  - `build_wasm.sh` – build script for emscripten/clang.
  - `src/modules/starFieldWasm.js` – JS wrapper that calls into WASM and copies out typed arrays.
  - `src/modules/renderer.js` – packs typed arrays into 2D textures and passes dimensions as uniforms.
  - `src/shaders/star2.frag.glsl` – fast-star fragment shader that reads descriptor/index textures and shades stars.

When recreating this, keep the same **conceptual dataflow** even if exact APIs change:

> C/WASM → linear memory → JS typed arrays → packed float textures → WebGL2 fragment shader.

---

## 2. C/WASM module expectations

The old build used a C file `src/wasm/star_field.c` that exported a set of functions compiled to a standalone `.wasm` module. The entrypoint generated all star data into a shared `WebAssembly.Memory`.

### 2.1 Exports and entrypoints

The build expected the following exported functions (leading underscores are the toolchain ABI detail):

- `generate_star_field(density, softness, glow, hero_bias, time)` – **main entry** that fills all buffers.
- Count getters:
  - `get_star_count()`
  - `get_local_id_count()`
  - `get_spill_id_count()`
  - `get_local_drop_count()`
  - `get_spill_drop_count()`
  - `get_layer_count()`
  - `get_cell_count()`
- Pointer getters (all into the same shared `WebAssembly.Memory`):
  - `get_star_descriptor_ptr()` – `Float32Array` view, **12 floats per star**.
  - `get_local_ids_ptr()` / `get_spill_ids_ptr()` – `Uint32Array` views.
  - `get_local_offsets_ptr()` / `get_local_counts_ptr()` – `Uint32Array` views indexed by cell.
  - `get_spill_offsets_ptr()` / `get_spill_counts_ptr()` – `Uint32Array` views indexed by cell.
  - `get_layer_info_ptr()` – `Float32Array` view, **4 floats per layer**.

### 2.2 Memory layout (per-star and per-layer)

The JS side assumed the descriptor layout (12 floats per star) was:

```text
[0] position.x
[1] position.y
[2] layerId
[3] size
[4] coreScale
[5] haloScale
[6] tint.r
[7] tint.g
[8] tint.b
[9] sparklePhase
[10] intensity
[11] heroFlag
```

Layer info (4 floats per layer):

```text
[0] cellsPerAxis
[1] cellSize   (or 1 / cellsPerAxis depending on version)
[2] scale      (world scale of layer)
[3] cellOffset (starting index of this layer's cells in global cell arrays)
```

Local/spill index arrays:

- `local_offsets[cellIndex]` / `local_counts[cellIndex]` point into `local_ids[]`.
- `spill_offsets[cellIndex]` / `spill_counts[cellIndex]` point into `spill_ids[]`.

Each cell has up to `MAX_STARS_PER_CELL` stars; any extra candidates are dropped.

---

## 3. JS binding responsibilities

A JS wrapper (originally `WasmStarFieldGenerator` in `src/modules/starFieldWasm.js`) should:

1. **Instantiate** the `.wasm` module, cache `instance.exports` and `memory`.
2. On `generate(params)`:
   - Compute derived physical density from a normalized slider (0–200 → ~5–200 physical density).
   - Call `generate_star_field(density, softness, glow, hero_bias, time)`.
   - Read counts via `get_*_count()`.
   - Create copies of data using typed views over `memory.buffer`, e.g.:

     ```js
     const starCount = exports.get_star_count();
     const descriptors = new Float32Array(memory.buffer, exports.get_star_descriptor_ptr(), starCount * 12);
     // similarly for ids, offsets, counts, layer info
     ```

   - Wrap these into a result object:

     ```js
     return {
       starCount,
       descriptors: new Float32Array(descriptors),
       layerMeta: buildLayerMeta(layerInfoData),
       layerCount,
       cellCount,
       local:  { offsets, counts, ids, dropCount },
       spill:  { offsets, counts, ids, dropCount },
     };
     ```

3. Expose the result to the renderer each time fast-stars need to be regenerated.

---

## 4. Renderer + shader dataflow

On the JS rendering side (originally inside `NebulaRenderer`):

- **Packing helpers** tiled 1D arrays into 2D float textures constrained by `gl.MAX_TEXTURE_SIZE`:
  - `packDescriptorTextureData` → RGBA32F with 3 texels per star.
  - `packIdTextureData` → R32F with packed indices.
  - `packIndexTextureData` → RG32F storing `(offset,count)` pairs per cell.
- **Textures** were then bound to specific texture units (6–11) and exposed as uniforms to `star2.frag.glsl`.
- The fast-star fragment shader:
  - Read layer info.
  - Determined the current cell from fragment coordinates.
  - Fetched `(offset,count)` for local + spill stars.
  - Looped up to `MAX_CELL_STAR_LOOP` stars per list.
  - Loaded descriptor rows and shaded each star using a glow LUT.

You don’t need to recreate the exact GLSL, but keep the idea: **shader fetches stars by cell using index textures instead of brute-forcing all stars.**

---

## 5. Build method from `build_wasm.sh`

To rebuild the WASM module, the project used `build_wasm.sh` at the cosmic-dream root. Here is the core content (slightly rewrapped, but semantically identical):

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="$ROOT_DIR/src/wasm/star_field.c"
OUT_FILE="$ROOT_DIR/src/wasm/star_field.wasm"

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE" >&2
  exit 1
fi

EXPORTS=(
  "_generate_star_field"
  "_get_star_count"
  "_get_local_id_count"
  "_get_spill_id_count"
  "_get_local_drop_count"
  "_get_spill_drop_count"
  "_get_layer_count"
  "_get_cell_count"
  "_get_star_descriptor_ptr"
  "_get_local_ids_ptr"
  "_get_spill_ids_ptr"
  "_get_local_offsets_ptr"
  "_get_local_counts_ptr"
  "_get_spill_offsets_ptr"
  "_get_spill_counts_ptr"
  "_get_layer_info_ptr"
)

if command -v emcc >/dev/null 2>&1; then
  echo "[build] Using emcc"
  emcc "$SRC_FILE" -O3 -s STANDALONE_WASM=1 \
    -s EXPORTED_FUNCTIONS="[$(printf '%s,' "${EXPORTS[@]}") ]" \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -o "$OUT_FILE"
  exit 0
fi

if command -v clang >/dev/null 2>&1; then
  echo "[build] Using clang --target=wasm32"
  export_flags=()
  for fn in "${EXPORTS[@]}"; do
    export_flags+=("-Wl,--export=$(echo "$fn" | sed 's/^_//')")
  done
  clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--allow-undefined \
    "${export_flags[@]}" "$SRC_FILE" -o "$OUT_FILE"
  exit 0
fi

echo "Neither emcc nor clang (with wasm target) was found in PATH." >&2
exit 1
```

Any reconstruction should either:

- Reuse this script as-is, or
- Embed equivalent flags in your own build system.

---

## 6. Example AI prompt using this doc

You can hand an AI the following instruction together with this file:

> We previously had a fast-star pipeline in a WebGL2 background project that used a C/WASM module (`star_field.c` → `star_field.wasm`) to generate star descriptors and per-cell index data, which JS then uploaded into float textures for a fragment shader (`star2.frag.glsl`). The current codebase has removed those modules but kept documentation of the old dataflow.
>
> Using the details in `docs/dora/wasm_webgl.md`, recreate:
> 1. A C file `src/wasm/star_field.c` that matches the described memory layout and exported functions.
> 2. A JS wrapper `src/modules/starFieldWasm.js` that instantiates the WASM, calls `generate_star_field`, and exposes typed arrays in the same shape as before.
> 3. The renderer-side packing+upload logic that turns those arrays into float textures and feeds a fast-star fragment shader.
> 4. (Optionally) a `star2.frag.glsl`-style shader that consumes the descriptor/index textures to render a multi-layer starfield.
>
> Use the `build_wasm.sh` snippet in this doc to choose appropriate compiler flags (either `emcc` or `clang --target=wasm32`). Keep the C/WASM boundary and texture layouts compatible with the described design so we can swap this fast-star path back into the existing WebGL2 renderer.

This is enough context for an AI to faithfully reconstruct the earlier fast-star pipeline if we ever want it back.
