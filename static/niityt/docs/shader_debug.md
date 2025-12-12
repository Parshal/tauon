# Shader Debugging Field Notes (Rust ⇄ WASM ⇄ WebGL)

_A quick-reference deck for when the canvas goes dark. Focuses on our Rust/WASM state core feeding a JS/WebGL renderer._

---

## 1. Sanity Pass (JS ↔ GPU wiring)
1. **Log compile/link output** every time shaders change:
   ```js
   const shader = gl.createShader(type);
   gl.shaderSource(shader, source);
   gl.compileShader(shader);
   console.info(gl.getShaderInfoLog(shader) || 'shader ok');
   ```
   Warnings (precision, unused vars) often hint at logic errors.
2. **Confirm uniform/texture bindings**:
   - Print the values we send from JS (textures, floats, vec2s) before draw.
   - Temporarily hardcode constants in GLSL. If the hardcoded path renders, the bug is in JS/WASM payload generation.
3. **Check texture uploads**:
   - Ensure `gl.texImage2D` uses the handles we intend (`gridTexture` vs. `cellColorTexture`).
   - Verify dimensions stay in sync with state (Rust/JS arrays should match `width × height`).
4. **Firefox Shader Editor / Chrome WebGL Inspector**: live-edit shaders, inspect uniforms/textures, and confirm the GPU sees the same source we shipped.

## 2. Instrument the Fragment Shader
Only output is `outColor`, so use it as a debugging oscilloscope.

| Trick | What it shows |
| --- | --- |
| `outColor = vec4(vec3(uv, 0.0), 1.0);` | Are our UVs/square mapping sane? If everything is black, UVs are NaN or outside [0,1]. |
| `outColor = vec4(vec3(texture(u_grid, texUV).r), 1.0);` | Confirms the base energy texture has data. |
| `outColor = vec4(vec3(texture(u_cellColors, texUV).r), 1.0);` | Verifies flower/ID texture writes. |
| `outColor = vec4(vec3(float(condition)), 1.0);` | Shows whether specific branches/conditions fire (white = true). |
| `discard;` vs. `outColor = vec4(1,0,0,1);` | Isolate problematic sections by early return. |

Scale/clamp intermediate values into [0,1] before writing them out; otherwise you’ll just see clamped white/black.

## 3. Binary Search the Shader
1. Comment out large sections (e.g., toolbelt rail rendering). If the playfield returns, the bug lies in the removed block.
2. Reintroduce code block-by-block (band render, pointer, toolbelt). This “shader bisection” narrows the culprit quickly.
3. When a block causes failure, instrument it with the table in §2.

## 4. Cross-Layer Checks (Rust/WASM ⇄ JS)
1. **State parity**: mirror proto-state changes (buffers, enums) between Rust and JS modules. Desync causes garbage uniforms/texture sizes.
2. **Memory layout**: when exporting textures from WASM, confirm they’re backed by `Uint8Array` views with stable lengths. A stray `realloc` can zero textures.
3. **Timing**: ensure RAF only renders after state tick populates new buffers. A null `cellColors` texture yields black flowers.
4. **Seeded RNG**: deterministic flower layers make repro easier; log the seed so Rust and JS stay aligned.

## 5. Tooling & Extensions
- `WEBGL_debug_shaders`: fetch GPU-translated shader source (helps when drivers change our code).
- `webgl-debug.js`: wraps GL calls and throws descriptive errors on bad states (invalid enums, lost contexts).
- RenderDoc (desktop) or Spector.js (browser extension) for full-frame capture, uniform inspection, and shader step-through.

## 6. Triage Checklist When “Nothing Renders”
1. GL errors? Call `gl.getError()` after setup/draw.
2. Program bound? Did context loss happen (check console for `webglcontextlost`).
3. Viewport matches canvas size (after DPR adjustments).
4. At least one vertex array bound and draw call invoked.
5. Textures/buffers have non-zero length data.
6. Fragment shader writes a visible color (temporarily bypass logic to confirm).

## 7. References
- LearnWebGL fragment debugging guide (Substitute intermediate values via colors). [@learnwebgl](http://learnwebgl.brown37.net/09_lights/fragment_shader_debugging.html)
- Mozilla Developer docs: Firefox Shader Editor (live GLSL tweaking).
- Spector.js: https://spector.babylonjs.com/
- `webgl-debug.js`: https://github.com/KhronosGroup/WebGLDeveloperTools

Keep this doc evolving; whenever we hit a new class of bug (e.g., NaNs from mat4 inverses, precision woes on mobile GPUs), drop a note with repro + fix so future runs debug faster.
