import {
  clamp,
  FLOWER_BASE,
  FLOWER_FERTILIZER,
  FLOWER_NONE,
  FLOWER_VARIANTS,
  FERTILIZER_MAX,
  FERTILIZER_BOOST_DURATION,
  FERTILIZER_BOOST_RADIUS,
  RECENT_PICKUP_WINDOW,
} from './state-constants.js';

export function updateFertilizerBoost(state, dt) {
  if (!state.fertilizerBoost) return;
  const boost = state.fertilizerBoost;
  boost.remaining = Math.max(0, boost.remaining - dt);
  if (boost.remaining <= 0) {
    state.fertilizerBoost = null;
  }
}

export function getFertilizerBoostFactor(state, index, colorId) {
  if (!state.fertilizerBoost) return 0;
  if (!Number.isFinite(index) || index < 0 || index >= state.grid.length) return 0;
  const boost = state.fertilizerBoost;
  const effectiveColorId = colorId === undefined || colorId === null ? FLOWER_BASE : colorId;
  const boostColorId = boost.colorId === undefined || boost.colorId === null ? FLOWER_NONE : boost.colorId;
  if (boostColorId !== FLOWER_BASE && effectiveColorId !== boostColorId) {
    return 0;
  }
  const center = boost.center;
  if (!Number.isFinite(center) || center < 0 || center >= state.grid.length) return 0;
  const sourceCoord = state.coordFromIndex(index);
  const centerCoord = state.coordFromIndex(center);
  const dx = sourceCoord.x - centerCoord.x;
  const dy = sourceCoord.y - centerCoord.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = Math.max(FERTILIZER_BOOST_RADIUS, 0);
  if (radius <= 0) return 0;
  const spatial = 1 - clamp(dist / radius, 0, 1);
  if (spatial <= 0) return 0;
  const duration = Math.max(boost.duration || FERTILIZER_BOOST_DURATION, 0.0001);
  const temporal = clamp(boost.remaining / duration, 0, 1);
  return spatial * temporal;
}

export function dropFertilizer(state, x, y) {
  if (state.mode === 'duel' && state.matchFinished) return false;
  if (state.fertilizer <= 0) return false;
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  const idx = state.indexFromCoord(x, y);
  if (state.grid[idx] === 0) return false;
  const colorId = state.lastNonFertilizerColorId || FLOWER_BASE;
  state.fertilizer = clamp(state.fertilizer - 1, 0, FERTILIZER_MAX);
  state.fertilizerBoost = {
    center: idx,
    colorId,
    remaining: FERTILIZER_BOOST_DURATION,
    duration: FERTILIZER_BOOST_DURATION,
  };
  return true;
}

export function getFertilizerBoostDescriptor(state) {
  if (!state.fertilizerBoost) {
    return {
      centerUv: null,
      colorId: FLOWER_NONE,
      strength: 0,
      radiusNorm: 0,
    };
  }
  const boost = state.fertilizerBoost;
  const total = state.width * state.height;
  if (!Number.isFinite(boost.center) || boost.center < 0 || boost.center >= total) {
    return {
      centerUv: null,
      colorId: FLOWER_NONE,
      strength: 0,
      radiusNorm: 0,
    };
  }
  const coord = state.coordFromIndex(boost.center);
  const u = state.width > 0 ? (coord.x + 0.5) / state.width : 0.5;
  const v = state.height > 0 ? (coord.y + 0.5) / state.height : 0.5;
  const duration = Math.max(boost.duration || FERTILIZER_BOOST_DURATION, 0.0001);
  const strength = clamp(boost.remaining / duration, 0, 1);
  const radiusNorm = state.width > 0 ? FERTILIZER_BOOST_RADIUS / state.width : 0;
  return {
    centerUv: { u, v },
    colorId: boost.colorId || FLOWER_NONE,
    strength,
    radiusNorm,
  };
}

export function generateFlowerLayer(state) {
  const total = state.flowers.length;
  const indices = new Array(total);
  const noiseValues = new Float32Array(total);

  state.flowers.fill(FLOWER_NONE);
  state.cellColors.fill(FLOWER_NONE);

  for (let i = 0; i < total; i += 1) {
    indices[i] = i;
    noiseValues[i] = state.coordNoise(i);
  }

  indices.sort((a, b) => noiseValues[a] - noiseValues[b]);

  const REQUIRED_FERTILIZER = 20;
  let cursor = 0;

  for (let placed = 0; placed < REQUIRED_FERTILIZER && cursor < indices.length; placed += 1, cursor += 1) {
    const idx = indices[cursor];
    state.flowers[idx] = FLOWER_FERTILIZER;
    state.cellColors[idx] = FLOWER_FERTILIZER;
  }

  for (let v = 0; v < FLOWER_VARIANTS.length && cursor < indices.length; v += 1, cursor += 1) {
    const idx = indices[cursor];
    const variant = FLOWER_VARIANTS[v];
    state.flowers[idx] = variant;
    state.cellColors[idx] = variant;
  }
}

export function clearFlower(state, idx) {
  if (!Number.isFinite(idx)) return;
  if (idx < 0 || idx >= state.flowers.length) return;
  state.flowers[idx] = FLOWER_NONE;
}

export function harvestFlower(state, idx) {
  const flowerId = state.flowers[idx];
  if (flowerId === FLOWER_NONE) {
    return FLOWER_NONE;
  }
  if (flowerId === FLOWER_FERTILIZER) {
    state.fertilizer = clamp(state.fertilizer + 1, 0, FERTILIZER_MAX);
  } else {
    collectFlower(state, flowerId);
  }
  state.recentPickupColor = flowerId;
  state.recentPickupTimer = RECENT_PICKUP_WINDOW;
  state.flowers[idx] = FLOWER_NONE;
  return flowerId;
}

export function collectFlower(state, flowerId) {
  for (let i = 0; i < state.toolbelt.length; i += 1) {
    const slot = state.toolbelt[i];
    if (slot && slot.colorId === flowerId) {
      return;
    }
  }
  for (let i = 0; i < state.toolbelt.length; i += 1) {
    const slot = state.toolbelt[i];
    if (!slot) {
      state.toolbelt[i] = { colorId: flowerId };
      return;
    }
  }
  const startIndex = state.activeSlotIndex;
  for (let offset = 0; offset < state.toolbelt.length; offset += 1) {
    const index = (startIndex + offset) % state.toolbelt.length;
    const slot = state.toolbelt[index];
    if (!slot || !slot.locked) {
      state.toolbelt[index] = { colorId: flowerId };
      return;
    }
  }
}
