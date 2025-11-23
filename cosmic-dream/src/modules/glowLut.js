const DEFAULT_SIZE = 32;

const REGULAR_PROFILE = { baseCore: 1.0, baseHalo: 1.3, coreAmp: 0.25, haloAmp: 0.6 };
const HERO_PROFILE = { baseCore: 1.25, baseHalo: 2.0, coreAmp: 0.55, haloAmp: 1.35 };

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
    const instance = await WebAssembly.instantiate(wasmBytes.buffer);
    return instance.exports.weight;
  } catch (err) {
    console.warn('[GlowLUT] wasm init failed, using JS weight fn.', err);
    return null;
  }
}

function jsWeight(glow, hero) {
  const bias = hero ? 1.3 : 0.7;
  const spread = hero ? 1.7 : 1.05;
  return bias + Math.pow(glow, hero ? 1.1 : 1.4) * spread;
}

export class GlowLookupCompiler {
  constructor(size = DEFAULT_SIZE) {
    this.size = size;
    this.table = new Float32Array(size * 4);
    this.weightFn = null;
    this.ready = this.init();
  }

  async init() {
    this.weightFn = await compileGlowWeightWasm() ?? jsWeight;
    this.rebuild();
  }

  rebuild(heroBias = 0.0, glowMax = 1.0) {
    const heroRatio = clamp01(heroBias);
    const step = 1 / Math.max(1, this.size - 1);
    for (let i = 0; i < this.size; i++) {
      const norm = clamp01(i * step);
      const hero = norm > heroRatio;
      const profile = hero ? HERO_PROFILE : REGULAR_PROFILE;
      const weight = this.weightFn(norm * glowMax, hero);
      const coreScale = profile.baseCore + profile.coreAmp * weight;
      const haloScale = profile.baseHalo + profile.haloAmp * weight;
      const dst = i * 4;
      this.table[dst + 0] = norm;
      this.table[dst + 1] = hero ? 1 : 0;
      this.table[dst + 2] = coreScale;
      this.table[dst + 3] = haloScale;
    }
    return this.table;
  }

  getTexturePayload() {
    return this.table;
  }
}

export async function createGlowLookup(size) {
  const compiler = new GlowLookupCompiler(size);
  await compiler.ready;
  return compiler;
}
