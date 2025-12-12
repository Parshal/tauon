import { TOOLBELT_SLOTS_PER_SIDE, TOOLBELT_SLOT_COUNT } from './state-constants.js';

export function getToolbeltDescriptors(state) {
  return {
    left: encodeToolbeltSlice(state, 0, TOOLBELT_SLOTS_PER_SIDE),
    right: encodeToolbeltSlice(state, TOOLBELT_SLOTS_PER_SIDE, TOOLBELT_SLOT_COUNT),
  };
}

export function encodeToolbeltSlice(state, start, end) {
  const length = end - start;
  const fill = new Float32Array(length);
  const colors = new Float32Array(length);
  const active = new Float32Array(length);
  const stacks = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const slot = state.toolbelt[start + i];
    if (slot) {
      fill[i] = 1;
      colors[i] = slot.colorId;
      stacks[i] = 0;
    }
  }
  const activeIndex = state.activeSlotIndex - start;
  if (activeIndex >= 0 && activeIndex < length) {
    active[activeIndex] = 1;
  }
  return {
    fill,
    colors,
    active,
    stacks,
  };
}
