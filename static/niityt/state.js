const CONTROL_COST = 12;
const ENERGY_CAP = 120;
const BASE_CHARGE_RATE = 6; // energy per second
const SPREAD_SAMPLES = 500;
const HUD_ICON_LIMIT = 4;
const TOOLBELT_SLOT_COUNT = 8;
const TOOLBELT_SLOTS_PER_SIDE = TOOLBELT_SLOT_COUNT / 2;
const TOOLBELT_STACK_CAP = 12;
const FERTILIZER_MAX = 80;
const FERTILIZER_BOOST_DURATION = 30;
const FERTILIZER_BOOST_RADIUS = 6;
const PIGMENT_NONE = 0;
const PIGMENT_FERTILIZER = 1;
const PIGMENT_BASE = 0;
const PIGMENT_VARIANTS = [2, 3, 4, 5, 6, 7];
const RECENT_PICKUP_WINDOW = 1.5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class ProtoState {
  constructor(width = 128, height = 128) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.cellColors = new Uint8Array(width * height);
    this.pigments = new Uint8Array(width * height);
    this.controlBandHeight = Math.max(6, Math.floor(height * 0.08));
    this.energy = CONTROL_COST * 1.5;
    this.pointerCell = null;
    this.claimedIndices = [];
    this.time = 0;
    this.toolbelt = Array.from({ length: TOOLBELT_SLOT_COUNT }, () => null);
    this.activeSlotIndex = 0;
    this.fertilizer = 0;
    this.lastNonFertilizerColorId = PIGMENT_BASE;
    this.fertilizerBoost = null;
    this.recentPickupTimer = 0;
    this.recentPickupColor = PIGMENT_NONE;

    this.reach = new Uint8Array(width * height);
    this.reachScratch = new Uint8Array(width * height);

    this.initializeDefaultToolbelt();
    this.generatePigmentLayer();
    this.updateReachField();
  }

  tick(dt) {
    this.time += dt;
    const bonus = 1 + this.claimedIndices.length * 0.004;
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
    this.updateReachField();
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

  updateFertilizerBoost(dt) {
    if (!this.fertilizerBoost) return;
    const boost = this.fertilizerBoost;
    boost.remaining = Math.max(0, boost.remaining - dt);
    if (boost.remaining <= 0) {
      this.fertilizerBoost = null;
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
        : PIGMENT_BASE;
      const boost = this.getFertilizerBoostFactor(sourceIdx, sourceColorId);
      const spreadChanceBase = 0.35;
      const spreadChance = clamp(spreadChanceBase + boost * 0.6, 0, 1);
      const reinforceChanceBase = 0.3;
      const reinforceChance = clamp(reinforceChanceBase + boost * 0.5, 0, 1);
      const neighbors = this.neighborsOfIndex(sourceIdx);
      if (!neighbors.length) continue;
      const targetIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      const currentValue = this.grid[targetIdx];
      if (currentValue === 0) {
        if (Math.random() < spreadChance) {
          const spreadValue = clamp(sourceValue - 24, 24, 255);
          this.grid[targetIdx] = spreadValue;
          const colorId = this.inheritColorFromSource(sourceIdx);
          this.onCellClaimed(targetIdx, colorId);
        }
      } else if (Math.random() < reinforceChance) {
        const reinforced = clamp(currentValue + 4 + Math.floor(40 * boost), 0, 255);
        this.grid[targetIdx] = reinforced;
      }
    }
  }

  getFertilizerBoostFactor(index, colorId) {
    if (!this.fertilizerBoost) return 0;
    if (!Number.isFinite(index) || index < 0 || index >= this.grid.length) return 0;
    const boost = this.fertilizerBoost;
    const effectiveColorId = colorId === undefined || colorId === null ? PIGMENT_BASE : colorId;
    const boostColorId = boost.colorId === undefined || boost.colorId === null ? PIGMENT_NONE : boost.colorId;
    if (boostColorId !== PIGMENT_BASE && effectiveColorId !== boostColorId) {
      return 0;
    }
    const center = boost.center;
    if (!Number.isFinite(center) || center < 0 || center >= this.grid.length) return 0;
    const sourceCoord = this.coordFromIndex(index);
    const centerCoord = this.coordFromIndex(center);
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
    return this.dropFertilizer(this.pointerCell.x, this.pointerCell.y);
  }

  placeControl(x, y) {
    const idx = this.indexFromCoord(x, y);
    if (this.grid[idx] !== 0) return false;
    if (!this.isCellInReach(x, y)) return false;
    if (this.energy < CONTROL_COST) return false;
    this.energy -= CONTROL_COST;
    this.grid[idx] = 255;
    const colorId = this.consumeActivePigment();
    if (colorId !== PIGMENT_BASE && colorId !== PIGMENT_FERTILIZER) {
      this.lastNonFertilizerColorId = colorId;
    }
    this.onCellClaimed(idx, colorId);
    return true;
  }

  dropFertilizer(x, y) {
    if (this.fertilizer <= 0) return false;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const idx = this.indexFromCoord(x, y);
    if (this.grid[idx] === 0) return false;
    const colorId = this.lastNonFertilizerColorId || PIGMENT_BASE;
    this.fertilizer = clamp(this.fertilizer - 1, 0, FERTILIZER_MAX);
    this.fertilizerBoost = {
      center: idx,
      colorId,
      remaining: FERTILIZER_BOOST_DURATION,
      duration: FERTILIZER_BOOST_DURATION,
    };
    return true;
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
    return {
      grid: this.grid,
      cellColors: this.cellColors,
      width: this.width,
      height: this.height,
      time,
      pointerCell: this.pointerCell,
      pointerActive: pointerActive && !!this.pointerCell,
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
      recentPickup: {
        colorId: this.recentPickupColor,
        strength: clamp(recentPickupStrength, 0, 1),
      },
    };
  }

  getFertilizerBoostDescriptor() {
    if (!this.fertilizerBoost) {
      return {
        centerUv: null,
        colorId: PIGMENT_NONE,
        strength: 0,
        radiusNorm: 0,
      };
    }
    const boost = this.fertilizerBoost;
    const total = this.width * this.height;
    if (!Number.isFinite(boost.center) || boost.center < 0 || boost.center >= total) {
      return {
        centerUv: null,
        colorId: PIGMENT_NONE,
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
      colorId: boost.colorId || PIGMENT_NONE,
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
    this.toolbelt[0] = { colorId: PIGMENT_BASE, locked: true };
    if (this.toolbelt.length > 1) {
      this.toolbelt[1] = { colorId: PIGMENT_FERTILIZER, locked: true };
    }
    this.activeSlotIndex = 0;
  }

  updateReachField() {
    const size = this.width * this.height;
    if (!this.reach || this.reach.length !== size) {
      this.reach = new Uint8Array(size);
    }
    if (!this.reachScratch || this.reachScratch.length !== size) {
      this.reachScratch = new Uint8Array(size);
    }

    const width = this.width;
    const height = this.height;
    const bottomY = height - 1;

    for (let idx = 0; idx < size; idx += 1) {
      const y = Math.floor(idx / width);
      const isSource = y === bottomY || this.grid[idx] > 0;
      const value = isSource ? 255 : 0;
      this.reach[idx] = value;
      this.reachScratch[idx] = value;
    }

    const radius = 4;
    for (let step = 0; step < radius; step += 1) {
      for (let idx = 0; idx < size; idx += 1) {
        if (this.reach[idx]) {
          continue;
        }
        const x = idx % width;
        const y = Math.floor(idx / width);
        let neighbor = false;
        if (x > 0 && this.reachScratch[idx - 1]) neighbor = true;
        if (!neighbor && x < width - 1 && this.reachScratch[idx + 1]) neighbor = true;
        if (!neighbor && y > 0 && this.reachScratch[idx - width]) neighbor = true;
        if (!neighbor && y < height - 1 && this.reachScratch[idx + width]) neighbor = true;
        if (neighbor) {
          this.reach[idx] = 255;
        }
      }
      this.reachScratch.set(this.reach);
    }
  }

  isCellInReach(x, y) {
    if (!this.reach || this.reach.length === 0) return true;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const idx = this.indexFromCoord(x, y);
    return this.reach[idx] > 0;
  }

  generatePigmentLayer() {
    const total = this.pigments.length;
    const indices = new Array(total);
    const noiseValues = new Float32Array(total);

    this.pigments.fill(PIGMENT_NONE);
    this.cellColors.fill(PIGMENT_NONE);

    for (let i = 0; i < total; i += 1) {
      indices[i] = i;
      noiseValues[i] = this.coordNoise(i);
    }

    indices.sort((a, b) => noiseValues[a] - noiseValues[b]);

    const REQUIRED_FERTILIZER = 20;
    let cursor = 0;

    for (let placed = 0; placed < REQUIRED_FERTILIZER && cursor < indices.length; placed += 1, cursor += 1) {
      const idx = indices[cursor];
      this.pigments[idx] = PIGMENT_FERTILIZER;
      this.cellColors[idx] = PIGMENT_FERTILIZER;
    }

    for (let v = 0; v < PIGMENT_VARIANTS.length && cursor < indices.length; v += 1, cursor += 1) {
      const idx = indices[cursor];
      const variant = PIGMENT_VARIANTS[v];
      this.pigments[idx] = variant;
      this.cellColors[idx] = variant;
    }
  }

  coordNoise(index) {
    const { x, y } = this.coordFromIndex(index);
    const dot = x * 374761393 + y * 668265263;
    const s = Math.sin(dot * 0.000001 + this.width * 0.13) * 43758.5453123;
    return s - Math.floor(s);
  }

  onCellClaimed(idx, colorId = PIGMENT_BASE) {
    this.claimedIndices.push(idx);
    this.harvestPigment(idx);
    const appliedColor = colorId === undefined ? PIGMENT_BASE : colorId;
    this.cellColors[idx] = appliedColor;
  }

  harvestPigment(idx) {
    const pigmentId = this.pigments[idx];
    if (pigmentId === PIGMENT_NONE) {
      return PIGMENT_NONE;
    }
    if (pigmentId === PIGMENT_FERTILIZER) {
      this.fertilizer = clamp(this.fertilizer + 1, 0, FERTILIZER_MAX);
    } else {
      this.collectPigment(pigmentId);
    }
    this.recentPickupColor = pigmentId;
    this.recentPickupTimer = RECENT_PICKUP_WINDOW;
    this.pigments[idx] = PIGMENT_NONE;
    return pigmentId;
  }

  collectPigment(pigmentId) {
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      const slot = this.toolbelt[i];
      if (slot && slot.colorId === pigmentId) {
        return;
      }
    }
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      const slot = this.toolbelt[i];
      if (!slot) {
        this.toolbelt[i] = { colorId: pigmentId };
        return;
      }
    }
    const startIndex = this.activeSlotIndex;
    for (let offset = 0; offset < this.toolbelt.length; offset += 1) {
      const index = (startIndex + offset) % this.toolbelt.length;
      const slot = this.toolbelt[index];
      if (!slot || !slot.locked) {
        this.toolbelt[index] = { colorId: pigmentId };
        return;
      }
    }
  }

  consumeActivePigment() {
    const slot = this.toolbelt[this.activeSlotIndex];
    if (!slot) {
      return PIGMENT_BASE;
    }
    if (slot.locked && slot.colorId === PIGMENT_FERTILIZER) {
      return PIGMENT_BASE;
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
    if (sourceIdx === null || sourceIdx === undefined) return PIGMENT_BASE;
    if (sourceIdx < 0 || sourceIdx >= this.cellColors.length) return PIGMENT_BASE;
    const inherited = this.cellColors[sourceIdx];
    return inherited === undefined ? PIGMENT_BASE : inherited;
  }

  updatePickupTimer(dt) {
    if (this.recentPickupTimer <= 0) return;
    this.recentPickupTimer = Math.max(0, this.recentPickupTimer - dt);
    if (this.recentPickupTimer === 0) {
      this.recentPickupColor = PIGMENT_NONE;
    }
  }

  getToolbeltDescriptors() {
    return {
      left: this.encodeToolbeltSlice(0, TOOLBELT_SLOTS_PER_SIDE),
      right: this.encodeToolbeltSlice(TOOLBELT_SLOTS_PER_SIDE, TOOLBELT_SLOT_COUNT),
    };
  }

  encodeToolbeltSlice(start, end) {
    const length = end - start;
    const fill = new Float32Array(length);
    const colors = new Float32Array(length);
    const active = new Float32Array(length);
    const stacks = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const slot = this.toolbelt[start + i];
      if (slot) {
        fill[i] = 1;
        colors[i] = slot.colorId;
        stacks[i] = 0;
      }
    }
    const activeIndex = this.activeSlotIndex - start;
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
}
