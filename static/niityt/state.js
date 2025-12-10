const CONTROL_COST = 12;
const ENERGY_CAP = 120;
const BASE_CHARGE_RATE = 6; // energy per second
const SPREAD_SAMPLES = 60;
const POWER_UP_RESPAWN = 10; // seconds between spawn attempts
const POWER_UP_DURATION = 6; // seconds of doubled growth
const HUD_ICON_LIMIT = 4;
const TOOLBELT_SLOT_COUNT = 8;
const TOOLBELT_SLOTS_PER_SIDE = TOOLBELT_SLOT_COUNT / 2;
const TOOLBELT_STACK_CAP = 12;
const FERTILIZER_MAX = 80;
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
    this.powerUpIndex = null;
    this.powerUpRespawnTimer = 1.5;
    this.growthMultiplierTimer = 0;
    this.toolbelt = Array.from({ length: TOOLBELT_SLOT_COUNT }, () => null);
    this.activeSlotIndex = 0;
    this.fertilizer = 0;
    this.recentPickupTimer = 0;
    this.recentPickupColor = PIGMENT_NONE;

    this.generatePigmentLayer();
  }

  tick(dt) {
    this.time += dt;

    this.updatePowerUpTimers(dt);

    const bonus = 1 + this.claimedIndices.length * 0.004;
    const growthMultiplier = this.getGrowthMultiplier();
    const growthRatio = bonus * growthMultiplier;
    this.energy = Math.min(
      ENERGY_CAP,
      this.energy + dt * BASE_CHARGE_RATE * bonus,
    );

    const iterations = Math.max(1, Math.floor(SPREAD_SAMPLES * dt * growthRatio));
    this.spread(iterations);
    this.healClaimed(dt);
    this.updatePickupTimer(dt);
  }

  updatePowerUpTimers(dt) {
    if (this.growthMultiplierTimer > 0) {
      this.growthMultiplierTimer = Math.max(0, this.growthMultiplierTimer - dt);
    }

    if (this.powerUpIndex === null) {
      this.powerUpRespawnTimer -= dt;
      if (this.powerUpRespawnTimer <= 0) {
        this.spawnPowerUp();
      }
    }
  }

  getGrowthMultiplier() {
    return this.growthMultiplierTimer > 0 ? 2 : 1;
  }

  spawnPowerUp() {
    const total = this.grid.length;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const idx = Math.floor(Math.random() * total);
      if (this.grid[idx] === 0) {
        this.powerUpIndex = idx;
        this.powerUpRespawnTimer = POWER_UP_RESPAWN;
        return true;
      }
    }
    this.powerUpRespawnTimer = POWER_UP_RESPAWN;
    return false;
  }

  consumePowerUp(idx) {
    if (this.powerUpIndex === null) return;
    if (idx !== this.powerUpIndex) return;
    this.powerUpIndex = null;
    this.growthMultiplierTimer = POWER_UP_DURATION;
    this.powerUpRespawnTimer = POWER_UP_RESPAWN;
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
      const neighbors = this.neighborsOfIndex(sourceIdx);
      if (!neighbors.length) continue;
      const targetIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      const currentValue = this.grid[targetIdx];
      if (currentValue === 0) {
        if (Math.random() < 0.35) {
          const spreadValue = clamp(sourceValue - 24, 24, 255);
          this.grid[targetIdx] = spreadValue;
          const colorId = this.inheritColorFromSource(sourceIdx);
          this.onCellClaimed(targetIdx, colorId);
        }
      } else if (Math.random() < 0.1) {
        this.grid[targetIdx] = clamp(currentValue + 4, 0, 255);
      }
    }
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

  placeControl(x, y) {
    if (y < this.height - this.controlBandHeight) return false;
    const idx = this.indexFromCoord(x, y);
    if (this.grid[idx] !== 0) return false;
    if (this.energy < CONTROL_COST) return false;
    this.energy -= CONTROL_COST;
    this.grid[idx] = 255;
    const colorId = this.consumeActivePigment();
    this.onCellClaimed(idx, colorId);
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
      powerUpCell: this.powerUpIndex === null ? null : this.coordFromIndex(this.powerUpIndex),
      powerUpActive: this.powerUpIndex !== null,
      growthBoostActive: this.growthMultiplierTimer > 0,
      hudLeftIcons: hud.left,
      hudRightIcons: hud.right,
      toolbeltLeft: toolbelt.left,
      toolbeltRight: toolbelt.right,
      activeSlotIndex: this.activeSlotIndex,
      fertilizerNorm: this.fertilizer / FERTILIZER_MAX,
      recentPickup: {
        colorId: this.recentPickupColor,
        strength: clamp(recentPickupStrength, 0, 1),
      },
    };
  }

  buildHudDescriptors() {
    const energyFill = this.energy / ENERGY_CAP;
    const spreadFill = this.claimedIndices.length / this.grid.length;
    const powerIndicator = this.powerUpIndex === null ? 0 : 1;
    const boostIndicator = this.growthMultiplierTimer > 0 ? 1 : 0;

    const fertilizerFill = this.fertilizer / FERTILIZER_MAX;
    const left = this.normalizeHudList([energyFill, fertilizerFill, spreadFill]);
    const right = this.normalizeHudList([powerIndicator, boostIndicator]);

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

  generatePigmentLayer() {
    for (let i = 0; i < this.pigments.length; i += 1) {
      const noise = this.coordNoise(i);
      if (noise < 0.08) {
        this.pigments[i] = PIGMENT_FERTILIZER;
      } else if (noise < 0.6) {
        const variantIndex = Math.floor(((noise - 0.08) / 0.52) * PIGMENT_VARIANTS.length);
        const paletteIdx = clamp(variantIndex, 0, PIGMENT_VARIANTS.length - 1);
        this.pigments[i] = PIGMENT_VARIANTS[paletteIdx];
      } else {
        this.pigments[i] = PIGMENT_NONE;
      }
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
    this.consumePowerUp(idx);
    this.harvestPigment(idx);
    this.cellColors[idx] = colorId;
  }

  harvestPigment(idx) {
    const pigmentId = this.pigments[idx];
    if (pigmentId === PIGMENT_NONE) {
      return;
    }
    if (pigmentId === PIGMENT_FERTILIZER) {
      this.fertilizer = clamp(this.fertilizer + 1, 0, FERTILIZER_MAX);
    } else {
      this.collectPigment(pigmentId);
    }
    this.recentPickupColor = pigmentId;
    this.recentPickupTimer = RECENT_PICKUP_WINDOW;
    this.pigments[idx] = PIGMENT_NONE;
  }

  collectPigment(pigmentId) {
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      const slot = this.toolbelt[i];
      if (slot && slot.colorId === pigmentId) {
        slot.count = clamp(slot.count + 1, 0, TOOLBELT_STACK_CAP);
        return;
      }
    }
    for (let i = 0; i < this.toolbelt.length; i += 1) {
      if (!this.toolbelt[i]) {
        this.toolbelt[i] = { colorId: pigmentId, count: 1 };
        return;
      }
    }
    this.toolbelt[this.activeSlotIndex] = { colorId: pigmentId, count: 1 };
  }

  consumeActivePigment() {
    const slot = this.toolbelt[this.activeSlotIndex];
    if (!slot || slot.count <= 0) {
      return PIGMENT_BASE;
    }
    slot.count -= 1;
    const colorId = slot.colorId;
    if (slot.count <= 0) {
      this.toolbelt[this.activeSlotIndex] = null;
    }
    return colorId;
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
        fill[i] = clamp(slot.count / TOOLBELT_STACK_CAP, 0, 1);
        colors[i] = slot.colorId;
        stacks[i] = slot.count;
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
