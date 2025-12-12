import {
  CONTROL_COST,
  AI_DECISION_INTERVAL,
  OWNER_NEUTRAL,
  OWNER_PLAYER,
  OWNER_AI,
  FLOWER_BASE,
} from './state-constants.js';

export function initializeAiStartingLine(state) {
  if (state.mode !== 'duel') return;
  const y = 0;
  for (let x = 0; x < state.width; x += 1) {
    const idx = state.indexFromCoord(x, y);
    if (idx < 0 || idx >= state.grid.length) continue;
    state.grid[idx] = 220;
    state.onCellClaimed(idx, FLOWER_BASE, OWNER_AI);
  }
}

export function updateAi(state, dt) {
  if (state.mode !== 'duel' || state.matchFinished) {
    return;
  }
  if (!Number.isFinite(dt) || dt <= 0) return;

  state.aiDecisionTimer += dt;
  if (state.aiDecisionTimer < AI_DECISION_INTERVAL) {
    return;
  }
  state.aiDecisionTimer -= AI_DECISION_INTERVAL;
  runAiTurn(state);
}

export function runAiTurn(state) {
  if (state.aiEnergy < CONTROL_COST) return;
  const total = state.width * state.height;
  if (total <= 0) return;

  const maxAttempts = 64;
  let bestIdx = -1;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const idx = Math.floor(Math.random() * total);
    if (state.grid[idx] !== 0) continue;
    const coord = state.coordFromIndex(idx);
    const x = coord.x;
    const y = coord.y;

    let score = 0;
    const half = state.height * 0.5;
    const third = state.height / 3;
    if (y < third) {
      score += 2;
    } else if (y < half) {
      score += 1;
    }

    const neighbors = state.neighborsOfIndex(idx);
    for (let i = 0; i < neighbors.length; i += 1) {
      const nIdx = neighbors[i];
      const ownerId = state.owner && state.owner.length === total
        ? state.owner[nIdx]
        : OWNER_NEUTRAL;
      if (ownerId === OWNER_PLAYER) {
        score += 1;
      } else if (ownerId === OWNER_AI) {
        score += 0.5;
      }
    }

    if (state.growthField && state.growthField.length === total) {
      const fieldNorm = state.growthField[idx] / 255;
      score += fieldNorm * 1.5;
    }
    if (state.localGrowth && state.localGrowth.length === total) {
      const localNorm = state.localGrowth[idx] / 255;
      score += localNorm * 0.8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  if (bestIdx >= 0) {
    const { x, y } = state.coordFromIndex(bestIdx);
    aiPlaceControlAt(state, x, y);
  }
}

export function aiPlaceControlAt(state, x, y) {
  if (state.mode !== 'duel' || state.matchFinished) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  const idx = state.indexFromCoord(x, y);
  if (state.grid[idx] !== 0) return false;
  if (!state.isCellInReach(x, y)) return false;
  if (state.aiEnergy < CONTROL_COST) return false;

  state.aiEnergy -= CONTROL_COST;
  state.grid[idx] = 255;
  const colorId = FLOWER_BASE;
  state.onCellClaimed(idx, colorId, OWNER_AI);
  return true;
}

export function getOwnershipStats(state) {
  const total = state.width * state.height;
  if (!state.owner || state.owner.length !== total) {
    const playerCells = state.claimedIndices.length;
    const neutralCells = total - playerCells;
    return {
      playerCells,
      aiCells: 0,
      neutralCells,
      total,
    };
  }

  let playerCells = 0;
  let aiCells = 0;
  let neutralCells = 0;
  for (let i = 0; i < total; i += 1) {
    const ownerId = state.owner[i];
    if (ownerId === OWNER_PLAYER) {
      playerCells += 1;
    } else if (ownerId === OWNER_AI) {
      aiCells += 1;
    } else {
      neutralCells += 1;
    }
  }

  return {
    playerCells,
    aiCells,
    neutralCells,
    total,
  };
}

export function updateMatchState(state) {
  if (state.mode !== 'duel' || state.matchFinished) {
    return;
  }

  const stats = getOwnershipStats(state);
  if (stats.neutralCells > 0) {
    return;
  }

  if (stats.playerCells > stats.aiCells) {
    state.matchWinner = 'player';
  } else if (stats.aiCells > stats.playerCells) {
    state.matchWinner = 'ai';
  } else {
    state.matchWinner = 'draw';
  }
  state.matchFinished = true;
}
