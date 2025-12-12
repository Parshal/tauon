import {
  updateReachField as growthUpdateReachField,
  updateGrowthField as growthUpdateGrowthField,
  updateLocalGrowthSignal as growthUpdateLocalGrowthSignal,
  updateGrowthAccumulator as growthUpdateGrowthAccumulator,
  getMeadowStrength as growthGetMeadowStrength,
} from './state-growth.js';

import {
  initializeAiStartingLine as aiInitializeAiStartingLine,
  updateAi as aiUpdateAi,
  runAiTurn as aiRunAiTurn,
  aiPlaceControlAt as aiAiPlaceControlAt,
  getOwnershipStats as aiGetOwnershipStats,
  updateMatchState as aiUpdateMatchState,
} from './state-ai.js';

import {
  CONTROL_COST,
  ENERGY_CAP,
  BASE_CHARGE_RATE,
  SPREAD_SAMPLES,
  HUD_ICON_LIMIT,
  TOOLBELT_SLOT_COUNT,
  TOOLBELT_SLOTS_PER_SIDE,
  TOOLBELT_STACK_CAP,
  FERTILIZER_MAX,
  FERTILIZER_BOOST_DURATION,
  FERTILIZER_BOOST_RADIUS,
  GROWTH_ACCUM_RATE,
  GROWTH_ACCUM_DECAY,
  GROWTH_ACCUM_THRESHOLD,
  FLOWER_NONE,
  FLOWER_FERTILIZER,
  FLOWER_BASE,
  FLOWER_VARIANTS,
  RECENT_PICKUP_WINDOW,
  AI_DECISION_INTERVAL,
  OWNER_NEUTRAL,
  OWNER_PLAYER,
  OWNER_AI,
  clamp,
} from './state-constants.js';

import {
  getToolbeltDescriptors as tbGetToolbeltDescriptors,
  encodeToolbeltSlice as tbEncodeToolbeltSlice,
} from './state-toolbelt.js';

import {
  updateFertilizerBoost as flowersUpdateFertilizerBoost,
  getFertilizerBoostFactor as flowersGetFertilizerBoostFactor,
  dropFertilizer as flowersDropFertilizer,
  getFertilizerBoostDescriptor as flowersGetFertilizerBoostDescriptor,
  generateFlowerLayer as flowersGenerateFlowerLayer,
  clearFlower as flowersClearFlower,
  harvestFlower as flowersHarvestFlower,
  collectFlower as flowersCollectFlower,
} from './state-flowers.js';

export class ProtoState {
  constructor(width = 128, height = 128, options = {}) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.grid = new Uint8Array(size);
    this.cellColors = new Uint8Array(size);
    this.flowers = new Uint8Array(size);
    this.owner = new Uint8Array(size);
    this.controlBandHeight = Math.max(6, Math.floor(height * 0.08));
    this.energy = CONTROL_COST * 1.5;
    this.aiEnergy = CONTROL_COST * 1.5;
    this.pointerCell = null;
    this.claimedIndices = [];
    this.time = 0;
    this.toolbelt = Array.from({ length: TOOLBELT_SLOT_COUNT }, () => null);
    this.activeSlotIndex = 0;
    this.fertilizer = 0;
    this.lastNonFertilizerColorId = FLOWER_BASE;
    this.fertilizerBoost = null;
    this.recentPickupTimer = 0;
    this.recentPickupColor = FLOWER_NONE;

    this.aiDecisionTimer = 0;

    this.reach = new Uint8Array(size);
    this.reachScratch = new Uint8Array(size);

    this.growthField = new Uint8Array(size);
    this.growthFieldScratch = new Uint8Array(size);

    this.localGrowth = new Uint8Array(size);
    this.growthAccumulator = new Float32Array(size);

    this.growthAccumulatorVis = new Uint8Array(size);

    this.viewMode = 0;

    this.mode = (options && options.mode === 'duel') ? 'duel' : 'sandbox';
    this.matchFinished = false;
    this.matchWinner = null;

    this.initializeDefaultToolbelt();
    flowersGenerateFlowerLayer(this);
    if (this.mode === 'duel') {
      this.initializeAiStartingLine();
    }
    this.updateReachField();
    this.updateGrowthField();
  }

  tick(dt) {
    this.time += dt;
    const bonusBase = 1 + this.claimedIndices.length * 0.004;
    const meadowStrength = this.getMeadowStrength();
    const meadowFactor = 1 + meadowStrength * 0.5;
    const bonus = bonusBase * meadowFactor;
    const growthRatio = bonus;
    this.energy = Math.min(
      ENERGY_CAP,
      this.energy + dt * BASE_CHARGE_RATE * bonus,
    );

    const iterations = Math.max(1, Math.floor(SPREAD_SAMPLES * dt * growthRatio));
    this.spread(iterations);
    this.healClaimed(dt);
    this.updatePickupTimer(dt);
    this.updateFertilizerBoost(dt);
    if (this.mode === 'duel') {
      this.aiEnergy = Math.min(
        ENERGY_CAP,
        this.aiEnergy + dt * BASE_CHARGE_RATE * bonus,
      );
      this.updateAi(dt);
    }
    this.updateReachField();
    this.updateGrowthField();
    this.updateLocalGrowthSignal();
    this.updateGrowthAccumulator(dt);
    this.updateMatchState();
  }

  healClaimed(dt) {
    if (!this.claimedIndices.length) return;
    const increment = clamp(dt * 90, 0, 6);
    for (let i = 0; i < this.claimedIndices.length; i += 1) {
      const idx = this.claimedIndices[i];
      const current = this.grid[idx];
      if (current > 0) {
        this.grid[idx] = clamp(current + increment, 0, 255);
      }
    }
  }

  spread(iterations) {
    if (!this.claimedIndices.length) return;
    for (let i = 0; i < iterations; i += 1) {
      const sourceIdx = this.randomClaimedIndex();
      if (sourceIdx < 0) continue;
      const sourceValue = this.grid[sourceIdx];
      if (sourceValue === 0) continue;
      const sourceColorId = (sourceIdx >= 0 && sourceIdx < this.cellColors.length)
        ? this.cellColors[sourceIdx]
        : FLOWER_BASE;
      const boost = flowersGetFertilizerBoostFactor(this, sourceIdx, sourceColorId);
      const spreadChanceBase = 0.35;
      const spreadChance = clamp(spreadChanceBase + boost * 0.6, 0, 1);
      const reinforceChanceBase = 0.3;
      const reinforceChance = clamp(reinforceChanceBase + boost * 0.5, 0, 1);
      const neighbors = this.neighborsOfIndex(sourceIdx);
      if (!neighbors.length) continue;
      const targetIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      const currentValue = this.grid[targetIdx];
      if (currentValue > 0 && Math.random() < reinforceChance) {
        const reinforced = clamp(currentValue + 4 + Math.floor(40 * boost), 0, 255);
        this.grid[targetIdx] = reinforced;
      }
    }
  }

  updateFertilizerBoost(dt) {
    flowersUpdateFertilizerBoost(this, dt);
  }

  getFertilizerBoostFactor(index, colorId) {
    return flowersGetFertilizerBoostFactor(this, index, colorId);
  }

  neighborsOfIndex(index) {
    const { x, y } = this.coordFromIndex(index);
    const coords = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    const results = [];
    for (const [nx, ny] of coords) {
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
      results.push(this.indexFromCoord(nx, ny));
    }
    return results;
  }

  randomClaimedIndex() {
    if (!this.claimedIndices.length) return -1;
    const idx = Math.floor(Math.random() * this.claimedIndices.length);
    return this.claimedIndices[idx] ?? -1;
  }

  setPointerFromUV(u, v) {
    if (Number.isNaN(u) || Number.isNaN(v)) {
      this.pointerCell = null;
      return null;
    }
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      this.pointerCell = null;
      return null;
    }
    const x = clamp(Math.floor(u * this.width), 0, this.width - 1);
    const y = clamp(Math.floor(v * this.height), 0, this.height - 1);
    this.pointerCell = { x, y };
    return this.pointerCell;
  }

  clearPointer() {
    this.pointerCell = null;
  }

  attemptPlaceActivePointer() {
    if (!this.pointerCell) return false;
    return this.placeControl(this.pointerCell.x, this.pointerCell.y);
  }

  attemptDropFertilizerAtPointer() {
    if (!this.pointerCell) return false;
    return flowersDropFertilizer(this, this.pointerCell.x, this.pointerCell.y);
  }

  canPlaceControlAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.mode === 'duel' && this.matchFinished) return false;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const idx = this.indexFromCoord(x, y);
    const gridValue = this.grid[idx];
    const colorId = this.consumeActiveFlower();
    if (!this.isCellInReach(x, y)) return false;

    if (gridValue === 0) {
      if (colorId !== FLOWER_BASE) return false;
      if (this.activeSlotIndex !== 0) return false;
      if (this.energy < CONTROL_COST) return false;
      return true;
    }

    let ownerId = OWNER_PLAYER;
    if (this.owner && this.owner.length === this.grid.length) {
      ownerId = this.owner[idx];
    }
    if (this.mode === 'duel' && ownerId !== OWNER_PLAYER) {
      return false;
    }
    if (colorId === FLOWER_BASE) return false;
    const currentColor = this.cellColors[idx];
    if (colorId === currentColor) return false;
    if (this.energy < CONTROL_COST) return false;
    return true;
  }

  placeControl(x, y) {
    if (this.mode === 'duel' && this.matchFinished) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const idx = this.indexFromCoord(x, y);
    const gridValue = this.grid[idx];
    const colorId = this.consumeActiveFlower();

    if (!this.isCellInReach(x, y)) return false;

    if (gridValue === 0) {
      if (colorId !== FLOWER_BASE) {
        return false;
      }
      if (this.activeSlotIndex !== 0) {
        return false;
      }
      if (this.energy < CONTROL_COST) return false;
      this.energy -= CONTROL_COST;
      this.grid[idx] = 255;
      this.onCellClaimed(idx, FLOWER_BASE, OWNER_PLAYER);
      return true;
    }

    let ownerId = OWNER_PLAYER;
    if (this.owner && this.owner.length === this.grid.length) {
      ownerId = this.owner[idx];
    }
    if (this.mode === 'duel' && ownerId !== OWNER_PLAYER) {
      return false;
    }
    if (colorId === FLOWER_BASE) {
      return false;
    }
    const currentColor = this.cellColors[idx];
    if (colorId === currentColor) {
      return false;
    }
    if (this.energy < CONTROL_COST) return false;
    this.energy -= CONTROL_COST;
    this.cellColors[idx] = colorId;
    if (colorId !== FLOWER_BASE && colorId !== FLOWER_FERTILIZER) {
      this.lastNonFertilizerColorId = colorId;
    }
    return true;
  }

  dropFertilizer(x, y) {
    return flowersDropFertilizer(this, x, y);
  }

  indexFromCoord(x, y) {
    return y * this.width + x;
  }

  coordFromIndex(index) {
    return {
      x: index % this.width,
      y: Math.floor(index / this.width),
    };
  }

  getRenderPayload(time, pointerActive) {
    const hud = this.buildHudDescriptors();
    const toolbelt = this.getToolbeltDescriptors();
    const recentPickupStrength = RECENT_PICKUP_WINDOW > 0 ? this.recentPickupTimer / RECENT_PICKUP_WINDOW : 0;
    const ownership = this.getOwnershipStats();
    const pointer = this.pointerCell;
    const pointerCanPlace = !!(pointer && this.canPlaceControlAt(pointer.x, pointer.y));
    return {
      grid: this.grid,
      cellColors: this.cellColors,
      width: this.width,
      height: this.height,
      time,
      pointerCell: this.pointerCell,
      pointerActive: pointerActive && !!this.pointerCell,
      pointerCanPlace,
      bandHeightNorm: this.controlBandHeight / this.height,
      energyNorm: this.energy / ENERGY_CAP,
      hudLeftIcons: hud.left,
      hudRightIcons: hud.right,
      toolbeltLeft: toolbelt.left,
      toolbeltRight: toolbelt.right,
      activeSlotIndex: this.activeSlotIndex,
      fertilizerCount: this.fertilizer,
      fertilizerNorm: this.fertilizer / FERTILIZER_MAX,
      fertilizerBoost: this.getFertilizerBoostDescriptor(),
      reachMask: this.reach,
      ownerMask: this.owner,
      growthField: this.growthField,
      growthAccum: this.growthAccumulatorVis,
      localGrowth: this.localGrowth,
      ownership,
      match: {
        mode: this.mode,
        finished: this.matchFinished,
        winner: this.matchWinner,
      },
      recentPickup: {
        colorId: this.recentPickupColor,
        strength: clamp(recentPickupStrength, 0, 1),
      },
      viewMode: this.viewMode || 0,
    };
  }

  getFertilizerBoostDescriptor() {
    if (!this.fertilizerBoost) {
      return {
        centerUv: null,
        colorId: FLOWER_NONE,
        strength: 0,
        radiusNorm: 0,
      };
    }
    const boost = this.fertilizerBoost;
    const total = this.width * this.height;
    if (!Number.isFinite(boost.center) || boost.center < 0 || boost.center >= total) {
      return {
        centerUv: null,
        colorId: FLOWER_NONE,
        strength: 0,
        radiusNorm: 0,
      };
    }
    const coord = this.coordFromIndex(boost.center);
    const u = this.width > 0 ? (coord.x + 0.5) / this.width : 0.5;
    const v = this.height > 0 ? (coord.y + 0.5) / this.height : 0.5;
    const duration = Math.max(boost.duration || FERTILIZER_BOOST_DURATION, 0.0001);
    const strength = clamp(boost.remaining / duration, 0, 1);
    const radiusNorm = this.width > 0 ? FERTILIZER_BOOST_RADIUS / this.width : 0;
    return {
      centerUv: { u, v },
      colorId: boost.colorId || FLOWER_NONE,
      strength,
      radiusNorm,
    };
  }
 
  buildHudDescriptors() {
    const energyFill = this.energy / ENERGY_CAP;
    const spreadFill = this.claimedIndices.length / this.grid.length;
    const fertilizerFill = this.fertilizer / FERTILIZER_MAX;
    const left = this.normalizeHudList([energyFill, fertilizerFill, spreadFill]);
    const right = this.normalizeHudList([]);

    return { left, right };
  }

  normalizeHudList(values) {
    const result = new Float32Array(HUD_ICON_LIMIT);
    let count = 0;
    if (Array.isArray(values)) {
      count = Math.min(values.length, HUD_ICON_LIMIT);
      for (let i = 0; i < count; i += 1) {
        result[i] = clamp(values[i] || 0, 0, 1);
      }
    }
    return { values: result, count };
  }

  initializeDefaultToolbelt() {
    if (!Array.isArray(this.toolbelt) || this.toolbelt.length === 0) return;
    this.toolbelt[0] = { colorId: FLOWER_BASE, locked: true };
    if (this.toolbelt.length > 1) {
      this.toolbelt[1] = { colorId: FLOWER_FERTILIZER, locked: true };
    }
    this.activeSlotIndex = 0;
  }

  updateReachField() {
    growthUpdateReachField(this);
  }

  updateGrowthField() {
    growthUpdateGrowthField(this);
  }

  updateLocalGrowthSignal() {
    growthUpdateLocalGrowthSignal(this);
  }

  updateGrowthAccumulator(dt) {
    growthUpdateGrowthAccumulator(this, dt);
  }

  tryFrontierClaim(index) {
    if (!Number.isFinite(index)) return false;
    const size = this.grid.length;
    if (index < 0 || index >= size) return false;
    if (this.grid[index] !== 0) return false;

    const neighbors = this.neighborsOfIndex(index);
    if (!neighbors.length) return false;

    let bestIdx = -1;
    let bestValue = 0;
    for (let i = 0; i < neighbors.length; i += 1) {
      const nIdx = neighbors[i];
      const value = this.grid[nIdx];
      if (value > bestValue) {
        bestValue = value;
        bestIdx = nIdx;
      }
    }

    if (bestIdx < 0 || bestValue <= 0) return false;

    const sourceIdx = bestIdx;
    const sourceValue = this.grid[sourceIdx];
    const spreadValue = clamp(sourceValue - 24, 24, 255);
    this.grid[index] = spreadValue;
    const colorId = this.inheritColorFromSource(sourceIdx);
    let ownerId = OWNER_PLAYER;
    if (this.owner && this.owner.length === this.grid.length) {
      const srcOwner = this.owner[sourceIdx];
      if (srcOwner === OWNER_AI) {
        ownerId = OWNER_AI;
      }
    }
    this.onCellClaimed(index, colorId, ownerId);
    return true;
  }

  getMeadowStrength() {
    return growthGetMeadowStrength(this);
  }

  setViewMode(mode) {
    if (!Number.isFinite(mode)) return;
    const m = Math.max(0, Math.min(3, Math.floor(mode)));
    this.viewMode = m;
  }

  isCellInReach(x, y) {
    if (!this.reach || this.reach.length === 0) return true;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const idx = this.indexFromCoord(x, y);
    return this.reach[idx] > 0;
  }

  generateFlowerLayer() {
    const total = this.flowers.length;
    const indices = new Array(total);
    const noiseValues = new Float32Array(total);

    this.flowers.fill(FLOWER_NONE);
    this.cellColors.fill(FLOWER_NONE);

    for (let i = 0; i < total; i += 1) {
      indices[i] = i;
      noiseValues[i] = this.coordNoise(i);
    }

    indices.sort((a, b) => noiseValues[a] - noiseValues[b]);

    const REQUIRED_FERTILIZER = 20;
    let cursor = 0;

    for (let placed = 0; placed < REQUIRED_FERTILIZER && cursor < indices.length; placed += 1, cursor += 1) {
      const idx = indices[cursor];
      this.flowers[idx] = FLOWER_FERTILIZER;
      this.cellColors[idx] = FLOWER_FERTILIZER;
    }

    for (let v = 0; v < FLOWER_VARIANTS.length && cursor < indices.length; v += 1, cursor += 1) {
      const idx = indices[cursor];
      const variant = FLOWER_VARIANTS[v];
      this.flowers[idx] = variant;
      this.cellColors[idx] = variant;
    }
  }

  initializeAiStartingLine() {
    aiInitializeAiStartingLine(this);
  }

  coordNoise(index) {
    const { x, y } = this.coordFromIndex(index);
    const dot = x * 374761393 + y * 668265263;
    const s = Math.sin(dot * 0.000001 + this.width * 0.13) * 43758.5453123;
    return s - Math.floor(s);
  }

  onCellClaimed(idx, colorId = FLOWER_BASE, ownerId = OWNER_PLAYER) {
    this.claimedIndices.push(idx);
    if (ownerId === OWNER_PLAYER) {
      this.harvestFlower(idx);
    } else {
      this.clearFlower(idx);
    }
    const appliedColor = colorId === undefined ? FLOWER_BASE : colorId;
    this.cellColors[idx] = appliedColor;
    if (this.owner && this.owner.length === this.grid.length) {
      const value = ownerId || OWNER_PLAYER;
      this.owner[idx] = value;
    }
  }

  clearFlower(idx) {
    if (!Number.isFinite(idx)) return;
    if (idx < 0 || idx >= this.flowers.length) return;
    this.flowers[idx] = FLOWER_NONE;
  }

  harvestFlower(idx) {
    const flowerId = this.flowers[idx];
    if (flowerId === FLOWER_NONE) {
      return FLOWER_NONE;
    }
    if (flowerId === FLOWER_FERTILIZER) {
      this.fertilizer = clamp(this.fertilizer + 1, 0, FERTILIZER_MAX);
    } else {
      this.collectFlower(flowerId);
    }
    this.recentPickupColor = flowerId;
    this.recentPickupTimer = RECENT_PICKUP_WINDOW;
    this.flowers[idx] = FLOWER_NONE;
    return flowerId;
  }

  collectFlower(flowerId) {
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      const slot = this.toolbelt[i];
      if (slot && slot.colorId === flowerId) {
        return;
      }
    }
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      const slot = this.toolbelt[i];
      if (!slot) {
        this.toolbelt[i] = { colorId: flowerId };
        return;
      }
    }
    const startIndex = this.activeSlotIndex;
    for (let offset = 0; offset < this.toolbelt.length; offset += 1) {
      const index = (startIndex + offset) % this.toolbelt.length;
      const slot = this.toolbelt[index];
      if (!slot || !slot.locked) {
        this.toolbelt[index] = { colorId: flowerId };
        return;
      }
    }
  }

  consumeActiveFlower() {
    const slot = this.toolbelt[this.activeSlotIndex];
    if (!slot) {
      return FLOWER_BASE;
    }
    if (slot.locked && slot.colorId === FLOWER_FERTILIZER) {
      return FLOWER_BASE;
    }
    return slot.colorId;
  }

  setActiveSlot(index) {
    if (!Number.isFinite(index)) return;
    const normalized = ((Math.round(index) % TOOLBELT_SLOT_COUNT) + TOOLBELT_SLOT_COUNT) % TOOLBELT_SLOT_COUNT;
    this.activeSlotIndex = normalized;
  }

  shiftActiveSlot(delta) {
    if (!Number.isFinite(delta)) return;
    this.setActiveSlot(this.activeSlotIndex + delta);
  }

  inheritColorFromSource(sourceIdx) {
    if (sourceIdx === null || sourceIdx === undefined) return FLOWER_BASE;
    if (sourceIdx < 0 || sourceIdx >= this.cellColors.length) return FLOWER_BASE;
    const inherited = this.cellColors[sourceIdx];
    return inherited === undefined ? FLOWER_BASE : inherited;
  }

  updatePickupTimer(dt) {
    if (this.recentPickupTimer <= 0) return;
    this.recentPickupTimer = Math.max(0, this.recentPickupTimer - dt);
    if (this.recentPickupTimer === 0) {
      this.recentPickupColor = FLOWER_NONE;
    }
  }

  updateAi(dt) {
    aiUpdateAi(this, dt);
  }

  runAiTurn() {
    aiRunAiTurn(this);
  }

  aiPlaceControlAt(x, y) {
    return aiAiPlaceControlAt(this, x, y);
  }

  getOwnershipStats() {
    return aiGetOwnershipStats(this);
  }

  updateMatchState() {
    aiUpdateMatchState(this);
  }

  getToolbeltDescriptors() {
    return tbGetToolbeltDescriptors(this);
  }

  encodeToolbeltSlice(start, end) {
    return tbEncodeToolbeltSlice(this, start, end);
  }
}
