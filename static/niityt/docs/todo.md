Color-capture toolbelt plan.

AI can freely mark sections done or add any information that will serve as beneficial context.

1. ~~Ground pigment map & pickups (state.js)~~ ✅  
   * Generate a deterministic pigment layer (e.g., `this.pigments = new Uint8Array(width * height)`) alongside `this.grid` in `ProtoState`’s constructor so each cell knows whether it’s white fertilizer or one of six flower hues. Use seeded RNG or noise so the layout is stable but varied. @static/niityt/state.js#13-44  
   * When `spread()` claims a new cell, check `this.pigments[targetIdx]`; if it’s non-zero, push that pigment into a new `this.toolbelt` structure (array of slots with `{type, count}`) and clear the pigment so it can’t be harvested twice. Hook this right after `this.claimedIndices.push(targetIdx)` in `spread()`. @static/niityt/state.js#97-119  
   * Track fertilizer (white) separately so you can spend it on boosted placements (e.g., instantly grown cells or temporary cost reduction).

2. ~~Toolbelt state & player selection~~ ✅  
   * Represent the eight slots (4L/4R) as `this.toolbelt = Array(8).fill(null)` plus `this.activeSlotIndex`. On capture, fill the first empty slot or increment a stack count; on placement, consume from the active slot.  
   * Extend `placeControl()` to plant with the active pigment: write a color ID into a new `this.cellColors` buffer (mirrors `grid`) so the renderer/shader can tint blooms by slot color, while the original `grid` value continues to store growth strength. @static/niityt/state.js#167-177  
   * Add input methods for cycling the active slot (mouse wheel, number keys, or gutter clicks) via `InputController`, mutating `state.setActiveSlot(index)` and exposing it through `getRenderPayload()`. @static/niityt/input.js#1-70

3. ~~Render payload & HUD plumbing~~ ✅  
   * Extend `getRenderPayload()` to include `toolbeltLeft`/`toolbeltRight` arrays (each slot carries `{fill, colorId, isActive}`) plus the `cellColors` texture if you opt for a separate channel. @static/niityt/state.js#190-231  
   * In the renderer, upload the toolbelt descriptors via new uniforms (`u_toolbeltLeftColors`, etc.) mirroring the existing HUD arrays. Reserve the existing left rail for fertilizer/energy bars and repurpose the right rail for the four toolbelt slots, or render dedicated slot strips near each gutter edge. @static/niityt/renderer.js#291-316

4. ~~Shader updates~~ ✅  
   * Tinting + slot rendering implemented in `grid.frag.glsl`; further polish can iterate on glow/typography later.

5. ~~UX & feedback loops~~ ✅  
   * Fertilizer ladder + pickup glow are live; audio/particles remain a future stretch.

6. Follow-ups / open questions (still active)  
   1. Palette logistics: consider packing pigments into alpha if bandwidth becomes an issue—current dual-texture path works but costs another binding.  
   2. Input affordances: decide whether gutter clicking should switch slots (requires mapping rail UV → slot index).  
   3. Fertilizer spend: clarify the player verb unlocked by the white meter (energy boost vs. super seed action).