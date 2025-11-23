const STAR_DESCRIPTOR_FLOATS = 12;
const TEXELS_PER_DESCRIPTOR = 3;
const DEFAULT_LAYER_COUNT = 4;
const LAYER_INFO_COMPONENTS = 4;
const MAX_TOTAL_STARS = 20000;
const MAX_STARS_PER_CELL = 8;

const DEFAULT_LAYER_SPECS = [
  { scale: 9.0, cells: 24 },
  { scale: 18.0, cells: 36 },
  { scale: 32.0, cells: 48 },
  { scale: 54.0, cells: 64 },
];

const clamp01 = v => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a * (1 - t) + b * t;
const fract = v => v - Math.floor(v);

function hash3(x, y, z = 0) {
  return fract(Math.sin(x * 157.31 + y * 89.19 + z * 113.79) * 43758.5453123);
}

function buildLayerConfig(layerCount = DEFAULT_LAYER_COUNT) {
  const config = [];
  let cellOffset = 0;
  for (let i = 0; i < layerCount; i++) {
    const spec = DEFAULT_LAYER_SPECS[Math.min(i, DEFAULT_LAYER_SPECS.length - 1)];
    const cellsPerAxis = spec.cells;
    const cellCount = cellsPerAxis * cellsPerAxis;
    config.push({
      layerId: i,
      cellsPerAxis,
      cellCount,
      scale: spec.scale,
      cellOffset,
    });
    cellOffset += cellCount;
  }
  return config;
}

function wrapIndex(value, span) {
  const mod = value % span;
  return mod < 0 ? mod + span : mod;
}

function ensureOffsetsFilled(offsets, counts, currentLength) {
  for (let i = 0; i < offsets.length; i++) {
    if (counts[i] === 0) {
      offsets[i] = currentLength;
    }
  }
}

function pushId(cellIndex, idsArray, offsets, counts, value) {
  if (counts[cellIndex] === 0) {
    offsets[cellIndex] = idsArray.length;
  }
  counts[cellIndex] += 1;
  idsArray.push(value);
}

function makeColor(t) {
  return [
    mix(0.82, 1.0, t),
    mix(0.92, 0.82, t),
    mix(1.0, 0.7, t),
  ];
}

function computeWorldPosition(layer, cellX, cellY, jitterX, jitterY) {
  const cells = layer.cellsPerAxis;
  const normX = (cellX + 0.5 + jitterX) / cells - 0.5;
  const normY = (cellY + 0.5 + jitterY) / cells - 0.5;
  return [normX * layer.scale, normY * layer.scale];
}

export class StarFieldGenerator {
  constructor(options = {}) {
    const layerCount = Math.max(1, options.layers ?? DEFAULT_LAYER_COUNT);
    this.layerConfig = buildLayerConfig(layerCount);
    this.cellCount = this.layerConfig.reduce((acc, layer) => acc + layer.cellCount, 0);
    this.layerCount = this.layerConfig.length;
    this.layerInfoTexture = this.buildLayerInfoTexture();
    this.ready = Promise.resolve();
  }

  buildLayerInfoTexture() {
    const width = this.layerConfig.length;
    const height = 1;
    const data = new Float32Array(width * LAYER_INFO_COMPONENTS);
    this.layerConfig.forEach((layer, idx) => {
      const base = idx * LAYER_INFO_COMPONENTS;
      data[base + 0] = layer.cellsPerAxis;
      data[base + 1] = layer.cellsPerAxis > 0 ? 1.0 / layer.cellsPerAxis : 1.0;
      data[base + 2] = layer.scale;
      data[base + 3] = layer.cellOffset;
    });
    return { width, height, data };
  }

  getLayerInfoTexture() {
    return this.layerInfoTexture;
  }

  generate(params = {}) {
    const densityNorm = clamp01((params.starFastDensity ?? 80) / 200);
    const softness = clamp01(params.starFastSoft ?? 0.3);
    const glowMix = clamp01((params.starFastGlow ?? 0.3) / 2.0);
    const heroBias = clamp01((params.starFastGlowRad ?? 0.8) / 1.2);
    const descriptorCapacity = Math.min(MAX_TOTAL_STARS, this.cellCount * MAX_STARS_PER_CELL);
    const descriptors = new Float32Array(descriptorCapacity * STAR_DESCRIPTOR_FLOATS);
    const localOffsets = new Uint32Array(this.cellCount);
    const localCounts = new Uint32Array(this.cellCount);
    const spillOffsets = new Uint32Array(this.cellCount);
    const spillCounts = new Uint32Array(this.cellCount);
    const localIds = [];
    const spillIds = [];

    let starId = 0;
    const heroChance = mix(0.01, 0.08, heroBias);

    for (const layer of this.layerConfig) {
      const cells = layer.cellsPerAxis;
      for (let y = 0; y < cells && starId < descriptorCapacity; y++) {
        for (let x = 0; x < cells && starId < descriptorCapacity; x++) {
          const cellSeed = hash3(layer.layerId + 1.0, x + 1.37, y + 2.17);
          const variance = hash3(layer.layerId + 5.0, x * 0.71, y * 0.63);
          let budget = Math.floor((densityNorm * 3.0 + cellSeed * 2.3));
          budget = Math.min(MAX_STARS_PER_CELL, Math.max(0, budget));
          if (budget === 0) continue;
          const cellIndex = layer.cellOffset + y * cells + x;
          for (let s = 0; s < budget && starId < descriptorCapacity; s++) {
            const starSeed = cellSeed + variance * (s + 1) * 0.37;
            const jitterX = (hash3(starSeed, 1.0, 0.0) - 0.5) * 0.9;
            const jitterY = (hash3(starSeed, 2.0, 0.0) - 0.5) * 0.9;
            const hero = hash3(starSeed, 3.0, 0.0) < heroChance;
            const sizeSeed = hash3(starSeed, 4.0, 0.0);
            const baseSize = mix(0.012, 0.08, Math.pow(sizeSeed, mix(2.3, 0.7, softness)));
            const size = hero ? baseSize * mix(1.35, 2.2, heroBias) : baseSize;
            const coreScale = hero ? mix(1.3, 2.1, glowMix) : mix(0.9, 1.5, glowMix);
            const haloScale = hero ? mix(2.0, 3.4, glowMix) : mix(1.4, 2.4, glowMix);
            const sparklePhase = hash3(starSeed, 5.0, 0.0) * 6.28318;
            const intensity = hero ? 1.15 : 0.85;
            const tint = makeColor(hash3(starSeed, 6.0, 0.0));
            const [worldX, worldY] = computeWorldPosition(layer, x, y, jitterX, jitterY);

            const descriptorOffset = starId * STAR_DESCRIPTOR_FLOATS;
            descriptors[descriptorOffset + 0] = worldX;
            descriptors[descriptorOffset + 1] = worldY;
            descriptors[descriptorOffset + 2] = layer.layerId;
            descriptors[descriptorOffset + 3] = size;
            descriptors[descriptorOffset + 4] = coreScale;
            descriptors[descriptorOffset + 5] = haloScale;
            descriptors[descriptorOffset + 6] = tint[0];
            descriptors[descriptorOffset + 7] = tint[1];
            descriptors[descriptorOffset + 8] = tint[2];
            descriptors[descriptorOffset + 9] = sparklePhase;
            descriptors[descriptorOffset + 10] = intensity;
            descriptors[descriptorOffset + 11] = hero ? 1 : 0;

            pushId(cellIndex, localIds, localOffsets, localCounts, starId);

            const worldToCell = layer.scale > 0 ? layer.cellsPerAxis / layer.scale : 1;
            const spillRadius = Math.min(2, Math.ceil(size * haloScale * worldToCell * 4.0));
            if (spillRadius > 0) {
              for (let dy = -spillRadius; dy <= spillRadius; dy++) {
                for (let dx = -spillRadius; dx <= spillRadius; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = wrapIndex(x + dx, cells);
                  const ny = wrapIndex(y + dy, cells);
                  const neighborIndex = layer.cellOffset + ny * cells + nx;
                  pushId(neighborIndex, spillIds, spillOffsets, spillCounts, starId);
                }
              }
            }

            starId += 1;
          }
        }
      }
    }

    ensureOffsetsFilled(localOffsets, localCounts, localIds.length);
    ensureOffsetsFilled(spillOffsets, spillCounts, spillIds.length);

    return {
      starCount: starId,
      descriptors: descriptors.subarray(0, starId * STAR_DESCRIPTOR_FLOATS),
      layerMeta: this.layerConfig.map(layer => ({
        layerId: layer.layerId,
        cellsPerAxis: layer.cellsPerAxis,
        cellOffset: layer.cellOffset,
        scale: layer.scale,
      })),
      layerCount: this.layerCount,
      cellCount: this.cellCount,
      local: {
        offsets: localOffsets,
        counts: localCounts,
        ids: Uint32Array.from(localIds),
      },
      spill: {
        offsets: spillOffsets,
        counts: spillCounts,
        ids: Uint32Array.from(spillIds),
      },
    };
  }
}

export { STAR_DESCRIPTOR_FLOATS, TEXELS_PER_DESCRIPTOR };
