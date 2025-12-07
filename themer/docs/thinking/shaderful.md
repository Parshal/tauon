# Shader Debug Survival Guide

## Establish Ground Truth
1. (we don't have production so skip this) Mirror production GL state (precision, extensions, defines) locally before touching code.
2. Capture failing frame: GPU markers + renderdoc/webgpu capture + uniform dumps + seed.
3. Freeze inputs (textures, SSBOs, uniforms) and version them so repro tokens survive reloads.

## Make Data Observable
4. Log pipeline edges (CPU generator → upload → shader uniforms) with shared struct schemas.
5. Encode sanity overlays in-shader: color by branch, animate UV bounds, visualize NaNs.
6. Add toggles for key uniforms (time, zoom, LOD) and record deltas per toggle in console.

## Isolate Compute Paths
7. Bisect stages: reroute VS → flat color, FS → constant, or bypass composite to find source.
8. Replace suspect resources with procedural patterns (grid, gradient, ramp) to expose swaps.
9. Render each buffer to screen-sized debug targets; avoid interpreting packed textures mentally.

## Validate Math
10. Compare CPU + GPU math on same inputs; assert relative error < ε per component.
11. Print intermediate floats via RGBA packing; sample with PIX/RenderDoc to inspect.
12. Clamp + normalize aggressively while debugging; remove guards only after fix confirmed.

## Timing + Precision Checks
13. Track derivative use (fwidth, dFdx) vs dynamic branches; ensure gradients legal.
14. Profile with EXT_disjoint_timer_query; correlate spikes to uniforms or screen-space areas.
15. Test with lowered precision (mediump) and forced NaN propagation to catch UB early.

## Workflow Hygiene
16. Script hot-reload pipeline (shader watcher + cache-bust) to avoid stale binaries.
17. Store playbooks: repro seed, captured buffers, fix summary → tokens stay cheap for AI.
18. When bug fixed, remove debug hooks except one toggleable path for future reuse.
