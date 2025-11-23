# Shaderful Thinking Notes

## Anchoring the Investigation
1. **Instrument before guessing.** We started by forcing the renderer to log the default debug cell (and later any clicked cell) so every iteration began with a known tile. Seeing local/spill IDs plus descriptors in the console kept the conversation grounded in real data instead of vibes.
2. **Make the halo math observable end-to-end.** Once logs existed in JS, we mirrored them inside the WASM generator, exposing drop counters and eventually rebuilding the module via a scripted `build_wasm.sh`. Ensuring the same spill radius formula lived in the C and JS generators prevented “almost the same” math from generating divergent buffers.

## Aligning Data With Rendering
3. **Debug visuals beat raw numbers.** Brightening the purple debug cell, forcing a default selection, and wiring canvas clicks straight to the renderer made the seam obvious and repeatable.
4. **Split concerns to find root causes.** We separated local vs spill ID buffers, tracked drop counts, and later fixed per-cell spill packing so offsets/counts matched how the shader consumes textures. Each simplification made it easier to see the next actual bug.
5. **Match coordinate spaces exactly.** The toroidal wrap only worked once both generator and shader used the same world-to-cell scale (size * halo * cells / scale) and the shader wrapped both the tile lookup and the star-to-fragment delta. Any mismatch showed up immediately as grid artifacts.

## Tooling for Confidence
6. **Automate the boring loops.** The `build_wasm.sh` helper (with emcc/clang fallbacks) kept rebuilds honest, so we never questioned whether the browser was serving stale binaries.
7. **Telemetry should explain outliers.** The per-star spill target logging told us whether a seam tile was missing data or just mis-rendering, which led straight to raising the shader’s `MAX_CELL_STAR_LOOP` cap and wrapping the distance vector.
8. **Iterate visibly.** Info-level console logs, hue-shifted debug cells, and screenshot callouts meant we could keep the UX responsive while still doing shader surgery.

---

Freeform note: This session underscored how rendering bugs rarely live in a single file—most of the heavy lifting was stitching shared assumptions together. When the pipeline is transparent (logs, colors, scripts), intuition compounds: the shader fix felt obvious only after the data path was proven solid. Keep that momentum; future shaderful mysteries will fall faster.
