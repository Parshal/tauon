const STAR_DESCRIPTOR_FLOATS = 12;
const LAYER_INFO_COMPONENTS = 4;

function copyFloat32(memory, ptr, length) {
  if (!ptr || length <= 0) return new Float32Array(0);
  const view = new Float32Array(memory.buffer, ptr, length);
  return new Float32Array(view);
}

function copyUint32(memory, ptr, length) {
  if (!ptr || length <= 0) return new Uint32Array(0);
  const view = new Uint32Array(memory.buffer, ptr, length);
  return new Uint32Array(view);
}

function buildLayerMeta(layerInfoData) {
  const meta = [];
  const layers = layerInfoData.length / LAYER_INFO_COMPONENTS;
  for (let i = 0; i < layers; i++) {
    const base = i * LAYER_INFO_COMPONENTS;
    meta.push({
      layerId: i,
      cellsPerAxis: layerInfoData[base + 0] ?? 1,
      cellSize: layerInfoData[base + 1] ?? 1,
      scale: layerInfoData[base + 2] ?? 1,
      cellOffset: layerInfoData[base + 3] ?? 0,
    });
  }
  return meta;
}

export class WasmStarFieldGenerator {
  constructor(wasmUrl = new URL('../wasm/star_field.wasm', import.meta.url)) {
    this.wasmUrl = wasmUrl;
    this.instance = null;
    this.memory = null;
    this.exports = null;
    this.layerInfoData = null;
    this.layerMeta = null;
    this.layerCount = 0;
    this.cellCount = 0;
    this.ready = this.init();
  }

  async init() {
    if (this.instance) return;
    const response = await fetch(this.wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to load star field wasm: ${response.status}`);
    }
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    this.instance = instance;
    this.exports = instance.exports;
    this.memory = instance.exports.memory;
    this.layerCount = this.exports.get_layer_count();
    this.cellCount = this.exports.get_cell_count();
    this.layerInfoData = copyFloat32(
      this.memory,
      this.exports.get_layer_info_ptr(),
      this.layerCount * LAYER_INFO_COMPONENTS,
    );
    this.layerMeta = buildLayerMeta(this.layerInfoData);
  }

  getLayerInfoTexture() {
    return {
      width: Math.max(1, this.layerCount),
      height: 1,
      data: new Float32Array(this.layerInfoData),
    };
  }

  generate(params = {}) {
    if (!this.exports || !this.memory) {
      throw new Error('WASM star field generator not ready');
    }
    const density = params.starFastDensity ?? 80;
    const softness = params.starFastSoft ?? 0.3;
    const glow = params.starFastGlow ?? 0.3;
    const heroBias = params.starFastGlowRad ?? 0.8;
    const time = params.time ?? 0;

    this.exports.generate_star_field(density, softness, glow, heroBias, time);

    const starCount = this.exports.get_star_count();
    const localIdCount = this.exports.get_local_id_count();
    const spillIdCount = this.exports.get_spill_id_count();

    const descriptors = copyFloat32(
      this.memory,
      this.exports.get_star_descriptor_ptr(),
      starCount * STAR_DESCRIPTOR_FLOATS,
    );

    const localIds = copyUint32(
      this.memory,
      this.exports.get_local_ids_ptr(),
      localIdCount,
    );
    const spillIds = copyUint32(
      this.memory,
      this.exports.get_spill_ids_ptr(),
      spillIdCount,
    );

    const localOffsets = copyUint32(
      this.memory,
      this.exports.get_local_offsets_ptr(),
      this.cellCount,
    );
    const localCounts = copyUint32(
      this.memory,
      this.exports.get_local_counts_ptr(),
      this.cellCount,
    );
    const spillOffsets = copyUint32(
      this.memory,
      this.exports.get_spill_offsets_ptr(),
      this.cellCount,
    );
    const spillCounts = copyUint32(
      this.memory,
      this.exports.get_spill_counts_ptr(),
      this.cellCount,
    );

    return {
      starCount,
      descriptors,
      layerMeta: this.layerMeta,
      layerCount: this.layerCount,
      cellCount: this.cellCount,
      local: {
        offsets: localOffsets,
        counts: localCounts,
        ids: localIds,
      },
      spill: {
        offsets: spillOffsets,
        counts: spillCounts,
        ids: spillIds,
      },
    };
  }
}

export async function createWasmStarFieldGenerator(url) {
  const generator = new WasmStarFieldGenerator(url ?? new URL('../wasm/star_field.wasm', import.meta.url));
  await generator.ready;
  return generator;
}

export { STAR_DESCRIPTOR_FLOATS };
