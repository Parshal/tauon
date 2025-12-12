import {
  clamp,
  GROWTH_ACCUM_RATE,
  GROWTH_ACCUM_DECAY,
  GROWTH_ACCUM_THRESHOLD,
  FLOWER_BASE,
} from './state-constants.js';

export function updateReachField(state) {
  const size = state.width * state.height;
  if (!state.reach || state.reach.length !== size) {
    state.reach = new Uint8Array(size);
  }
  if (!state.reachScratch || state.reachScratch.length !== size) {
    state.reachScratch = new Uint8Array(size);
  }

  const width = state.width;
  const height = state.height;
  const bottomY = height - 1;

  for (let idx = 0; idx < size; idx += 1) {
    const y = Math.floor(idx / width);
    const isSource = y === bottomY || state.grid[idx] > 0;
    const value = isSource ? 255 : 0;
    state.reach[idx] = value;
    state.reachScratch[idx] = value;
  }

  const radius = 4;
  for (let step = 0; step < radius; step += 1) {
    for (let idx = 0; idx < size; idx += 1) {
      if (state.reach[idx]) {
        continue;
      }
      const x = idx % width;
      const y = Math.floor(idx / width);
      let neighbor = false;
      if (x > 0 && state.reachScratch[idx - 1]) neighbor = true;
      if (!neighbor && x < width - 1 && state.reachScratch[idx + 1]) neighbor = true;
      if (!neighbor && y > 0 && state.reachScratch[idx - width]) neighbor = true;
      if (!neighbor && y < height - 1 && state.reachScratch[idx + width]) neighbor = true;
      if (neighbor) {
        state.reach[idx] = 255;
      }
    }
    state.reachScratch.set(state.reach);
  }
}

export function updateGrowthField(state) {
  const size = state.width * state.height;
  if (size <= 0) return;

  if (!state.growthField || state.growthField.length !== size) {
    state.growthField = new Uint8Array(size);
  }
  if (!state.growthFieldScratch || state.growthFieldScratch.length !== size) {
    state.growthFieldScratch = new Uint8Array(size);
  }

  const width = state.width;
  const height = state.height;

  for (let idx = 0; idx < size; idx += 1) {
    const base = state.grid[idx];
    state.growthField[idx] = base;
    state.growthFieldScratch[idx] = base;
  }

  const radiusSteps = 6;
  const decayPerStep = 4;

  for (let step = 0; step < radiusSteps; step += 1) {
    const src = state.growthFieldScratch;
    const dst = state.growthField;
    for (let idx = 0; idx < size; idx += 1) {
      const center = src[idx];
      const x = idx % width;
      const y = Math.floor(idx / width);
      let sum = center;
      let count = 1;
      if (x > 0) {
        sum += src[idx - 1];
        count += 1;
      }
      if (x < width - 1) {
        sum += src[idx + 1];
        count += 1;
      }
      if (y > 0) {
        sum += src[idx - width];
        count += 1;
      }
      if (y < height - 1) {
        sum += src[idx + width];
        count += 1;
      }
      let avg = sum / count;
      avg -= decayPerStep;
      if (avg < 0) avg = 0;
      if (avg > 255) avg = 255;
      dst[idx] = avg;
    }
    state.growthFieldScratch.set(state.growthField);
  }
}

export function updateLocalGrowthSignal(state) {
  const size = state.width * state.height;
  if (size <= 0) return;

  if (!state.localGrowth || state.localGrowth.length !== size) {
    state.localGrowth = new Uint8Array(size);
  }

  const field = state.growthField;
  const hasField = field && field.length === size;

  for (let idx = 0; idx < size; idx += 1) {
    const base = state.grid[idx];
    if (base > 0) {
      state.localGrowth[idx] = 0;
      continue;
    }
    const neighbors = state.neighborsOfIndex(idx);
    if (!neighbors.length) {
      state.localGrowth[idx] = 0;
      continue;
    }
    let sum = 0;
    for (let n = 0; n < neighbors.length; n += 1) {
      const nIdx = neighbors[n];
      sum += state.grid[nIdx];
    }
    const avgNeighbor = sum / neighbors.length;
    const neighborNorm = avgNeighbor / 255;
    const fieldNorm = hasField ? field[idx] / 255 : 0;
    const combined = neighborNorm * fieldNorm;
    const scaled = clamp(Math.round(combined * 255), 0, 255);
    state.localGrowth[idx] = scaled;
  }
}

export function updateGrowthAccumulator(state, dt) {
  const size = state.width * state.height;
  if (size <= 0) return;
  if (!Number.isFinite(dt) || dt <= 0) return;

  if (!state.growthAccumulator || state.growthAccumulator.length !== size) {
    state.growthAccumulator = new Float32Array(size);
  }

  const local = state.localGrowth;
  const field = state.growthField;
  const hasLocal = local && local.length === size;
  const hasField = field && field.length === size;

  for (let idx = 0; idx < size; idx += 1) {
    if (state.grid[idx] !== 0) {
      state.growthAccumulator[idx] = 0;
      continue;
    }
    if (!hasLocal || !hasField) {
      state.growthAccumulator[idx] = 0;
      state.growthAccumulatorVis[idx] = 0;
      continue;
    }

    const localNorm = local[idx] / 255;
    const fieldNorm = field[idx] / 255;
    let influence = localNorm * fieldNorm;
    if (influence <= 0) {
      const current = state.growthAccumulator[idx];
      if (current > 0) {
        const decayed = current - GROWTH_ACCUM_DECAY * dt;
        state.growthAccumulator[idx] = decayed > 0 ? decayed : 0;
      }
      state.growthAccumulatorVis[idx] = 0;
      continue;
    }

    const jitter = 0.8 + 0.4 * state.coordNoise(idx);
    const fertBoost = state.getFertilizerBoostFactor(idx, FLOWER_BASE);
    const fertFactor = 1 + 1.5 * clamp(fertBoost, 0, 1);
    const rate = GROWTH_ACCUM_RATE * influence * jitter * fertFactor;
    const updated = state.growthAccumulator[idx] + rate * dt;
    state.growthAccumulator[idx] = updated;
    const vis = clamp(Math.round((updated / GROWTH_ACCUM_THRESHOLD) * 255), 0, 255);
    state.growthAccumulatorVis[idx] = vis;
    if (updated >= GROWTH_ACCUM_THRESHOLD) {
      state.tryFrontierClaim(idx);
      state.growthAccumulator[idx] = 0;
      state.growthAccumulatorVis[idx] = 0;
    }
  }
}

export function getMeadowStrength(state) {
  const size = state.width * state.height;
  if (!state.growthField || state.growthField.length !== size) return 0;
  if (!state.claimedIndices || !state.claimedIndices.length) return 0;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < state.claimedIndices.length; i += 1) {
    const idx = state.claimedIndices[i];
    if (!Number.isFinite(idx) || idx < 0 || idx >= size) continue;
    sum += state.growthField[idx];
    count += 1;
  }
  if (!count) return 0;
  const avg = sum / count;
  return clamp(avg / 255, 0, 1);
}
