const DEFAULT_SIZE = 32;
const ROWS = 2;

const REGULAR_PROFILE = { baseCore: 1.0, baseHalo: 1.25, coreAmp: 0.24, haloAmp: 0.55 };
const HERO_PROFILE = { baseCore: 1.35, baseHalo: 2.05, coreAmp: 0.5, haloAmp: 1.15 };
const REGULAR_SCATTER = { spanBase: 0.2, spanAmp: 1.1, weightBase: 0.35, weightAmp: 0.4 };
const HERO_SCATTER = { spanBase: 0.6, spanAmp: 1.6, weightBase: 0.55, weightAmp: 0.35 };

const wasmBytes = new Uint8Array([
  0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
  0x01,0x07,0x01,0x60,0x02,0x7d,0x7f,0x01,0x7d,
  0x03,0x02,0x01,0x00,
  0x07,0x0a,0x01,0x06,0x77,0x65,0x69,0x67,0x68,0x74,0x00,0x00,
  0x0a,0x06,0x01,0x04,0x00,0x20,0x00,0x0b,
]);

const clamp01 = v => Math.max(0, Math.min(1, v));

async function compileGlowWeightWasm() {
  if (typeof WebAssembly === 'undefined') return null;
  try {
    const { instance } = await WebAssembly.instantiate(wasmBytes.buffer);
    const fn = instance?.exports?.weight;
    if (typeof fn !== 'function') {
      throw new Error('weight export missing');
    }
    console.info('[GlowLUT] using wasm weight helper');
    return fn;
  } catch (err) {
    console.warn('[GlowLUT] wasm init failed, using JS weight fn.', err);
    return null;
  }
}

function jsWeight(glow, hero) {
  const bias = hero ? 1.2 : 0.65;
  const spread = hero ? 1.5 : 0.9;
  return bias + Math.pow(glow, hero ? 1.08 : 1.35) * spread;
}

export class GlowLookupCompiler {
  constructor(size = DEFAULT_SIZE) {
    this.size = size;
    this.table = new Float32Array(size * ROWS * 4);
    this.weightFn = null;
    this.ready = this.init();
  }

  async init() {
    this.weightFn = await compileGlowWeightWasm() ?? jsWeight;
    this.rebuild();
  }

  rebuild(heroBias = 0.0, glowMax = 1.0) {
    const heroMix = clamp01(heroBias);
    const normScale = clamp01(glowMax);
    const step = 1 / Math.max(1, this.size - 1);
    for (let i = 0; i < this.size; i++) {
      const norm = clamp01(i * step);
      const regWeight = this.weightFn(norm * normScale, false);
      const heroWeight = this.weightFn(norm * (0.65 + heroMix * 0.6), true);
      const regCore = REGULAR_PROFILE.baseCore + REGULAR_PROFILE.coreAmp * regWeight;
      const regHalo = REGULAR_PROFILE.baseHalo + REGULAR_PROFILE.haloAmp * regWeight;
      const heroCore = HERO_PROFILE.baseCore + HERO_PROFILE.coreAmp * heroWeight;
      const heroHalo = HERO_PROFILE.baseHalo + HERO_PROFILE.haloAmp * heroWeight;
      const regSpan = REGULAR_SCATTER.spanBase + REGULAR_SCATTER.spanAmp * regWeight;
      const heroSpan = HERO_SCATTER.spanBase + HERO_SCATTER.spanAmp * heroWeight;
      const regWeightGain = REGULAR_SCATTER.weightBase + REGULAR_SCATTER.weightAmp * regWeight;
      const heroWeightGain = HERO_SCATTER.weightBase + HERO_SCATTER.weightAmp * heroWeight;
      const base = i * ROWS * 4;
      this.table[base + 0] = regCore;
      this.table[base + 1] = regHalo;
      this.table[base + 2] = regSpan;
      this.table[base + 3] = clamp01(regWeightGain);
      this.table[base + 4] = heroCore;
      this.table[base + 5] = heroHalo;
      this.table[base + 6] = heroSpan;
      this.table[base + 7] = clamp01(heroWeightGain);
    }
    return this.table;
  }

  getTexturePayload() {
    return this.table;
  }

  getSize() {
    return this.size;
  }

  getRowCount() {
    return ROWS;
  }
}

export async function createGlowLookup(size) {
  const compiler = new GlowLookupCompiler(size);
  await compiler.ready;
  return compiler;
}
