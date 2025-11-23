import { loadShaderSources } from '../data/shaders.js';
import { createGlowLookup } from './glowLut.js';
import { createWasmStarFieldGenerator, STAR_DESCRIPTOR_FLOATS } from './starFieldWasm.js';

const globalDebug = typeof window !== 'undefined'
  ? (window.CosmicDreamDebug = window.CosmicDreamDebug || {})
  : null;

function clampCellIndex(value) {
  return Math.max(0, Math.floor(value ?? 0));
}

if (globalDebug && typeof globalDebug.setCell !== 'function') {
  globalDebug.setCell = (layer, x, y) => {
    globalDebug.targetCell = { layer, x, y };
    if (globalDebug.renderer?.setDebugCell) {
      globalDebug.renderer.setDebugCell(globalDebug.targetCell);
    }
  };
}

const FULLSCREEN_TRIANGLES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]);

const NEBULA_UNIFORMS = ['layers','hueBase','hueSpeed','flow','rotFlow','zoom','nebulaScale','detailScale','brightness','voidCut','colorSpread','layerDecay'];
const STAR_UNIFORMS = ['zoom','starDensity','starTwinkle','starSoft','starGlow','starGlowRad','starBright'];
const STAR_FAST_UNIFORMS = [
  'zoom',
  'starFastDensity',
  'starFastTwinkle',
  'starFastSoft',
  'starFastGlow',
  'starFastGlowRad',
  'starFastBright',
  'glowLUTSize',
  'glowLUTRows',
  'starDescriptorWidth',
  'starDescriptorHeight',
  'starLocalWidth',
  'starLocalHeight',
  'starSpillWidth',
  'starSpillHeight',
  'starLocalIndexWidth',
  'starLocalIndexHeight',
  'starSpillIndexWidth',
  'starSpillIndexHeight',
  'starLayerInfoWidth',
  'starLayerInfoHeight',
  'starCellCount',
  'starLayerCount',
  'starCount',
  'debugCellLayer',
  'debugCellX',
  'debugCellY',
  'debugCellEnabled',
];
const MEMBRANE_UNIFORMS = ['membraneStrength','membraneFlow','membraneFringe','momentumPersistence','permissionBloom','permissionGate'];

const clamp01 = v => Math.min(1, Math.max(0, v));

const TEXELS_PER_STAR = Math.ceil(STAR_DESCRIPTOR_FLOATS / 4);

function computeTiledDimensions(count, texelsPerEntry, maxWidth) {
  const width = Math.max(1, Math.min(maxWidth, count));
  const rows = Math.max(1, Math.ceil(count / width));
  const height = Math.max(1, rows * texelsPerEntry);
  return { width, height, rows };
}

function packDescriptorTextureData(descriptors, starCount, maxWidth) {
  const { width, height } = computeTiledDimensions(starCount, TEXELS_PER_STAR, maxWidth);
  const floatsPerTexel = 4;
  const data = new Float32Array(width * height * floatsPerTexel);
  for (let star = 0; star < starCount; star++) {
    const srcBase = star * STAR_DESCRIPTOR_FLOATS;
    const rowBlock = Math.floor(star / width);
    const column = star - rowBlock * width;
    for (let row = 0; row < TEXELS_PER_STAR; row++) {
      const dstRow = rowBlock * TEXELS_PER_STAR + row;
      const dstBase = (dstRow * width + column) * floatsPerTexel;
      for (let channel = 0; channel < floatsPerTexel; channel++) {
        const srcIndex = srcBase + row * floatsPerTexel + channel;
        data[dstBase + channel] = descriptors[srcIndex] ?? 0;
      }
    }
  }
  return { width, height, data };
}

function packIdTextureData(ids, maxWidth) {
  const count = ids?.length ?? 0;
  const width = Math.max(1, Math.min(maxWidth, Math.max(1, count)));
  const rows = Math.max(1, Math.ceil(count / width));
  const data = new Float32Array(width * rows);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / width);
    const column = i - row * width;
    data[row * width + column] = ids[i];
  }
  return { width, height: rows, data };
}

function packIndexTextureData(offsets, counts, maxWidth) {
  const length = offsets?.length ?? 0;
  const { width, height } = computeTiledDimensions(length, 1, maxWidth);
  const data = new Float32Array(width * height * 2);
  for (let i = 0; i < length; i++) {
    const row = Math.floor(i / width);
    const column = i - row * width;
    const base = (row * width + column) * 2;
    data[base] = offsets[i];
    data[base + 1] = counts[i];
  }
  return { width, height, data };
}

class FullscreenGeometry {
  constructor(gl) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLES, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  bind() {
    this.gl.bindVertexArray(this.vao);
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || 'Shader compile failed');
  }
  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || 'Program link failed');
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

class ShaderPass {
  constructor(gl, geometry, vertSource, fragSource, uniformKeys = []) {
    this.gl = gl;
    this.geometry = geometry;
    this.uniformKeys = uniformKeys;
    this.program = createProgram(gl, vertSource, fragSource);
    this.uniforms = {
      res: gl.getUniformLocation(this.program, 'u_res'),
      time: gl.getUniformLocation(this.program, 'u_time'),
    };
    this.uniformKeys.forEach(key => {
      this.uniforms[key] = gl.getUniformLocation(this.program, `u_${key}`);
    });
    this.dynamicUniforms = [];
    this.framebuffer = gl.createFramebuffer();
    this.texture = gl.createTexture();
    this.width = 1;
    this.height = 1;
    this.configureTexture();
  }

  configureTexture() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  resize(width, height) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(time, data, extraUniforms = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    this.geometry.bind();
    if (this.uniforms.res) gl.uniform2f(this.uniforms.res, this.width, this.height);
    if (this.uniforms.time) gl.uniform1f(this.uniforms.time, time);
    this.uniformKeys.forEach(key => {
      const loc = this.uniforms[key];
      if (!loc) return;
      let value;
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        value = data[key];
      } else if (extraUniforms && Object.prototype.hasOwnProperty.call(extraUniforms, key)) {
        value = extraUniforms[key];
      }
      if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      }
    });
    if (this.dynamicUniforms.length) {
      this.dynamicUniforms.forEach(entry => {
        if (!entry.loc) return;
        entry.setter(gl, entry.loc);
      });
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.texture;
  }

  setDynamicUniform(name, setter, glName) {
    const uniformName = glName || `u_${name}`;
    const loc = this.gl.getUniformLocation(this.program, uniformName);
    this.dynamicUniforms.push({ loc, setter });
  }
}

class CompositePass {
  constructor(gl, geometry, vertSource, fragSource) {
    this.gl = gl;
    this.geometry = geometry;
    this.program = createProgram(gl, vertSource, fragSource);
    this.uniforms = {
      nebulaTex: gl.getUniformLocation(this.program, 'u_nebulaTex'),
      starTex: gl.getUniformLocation(this.program, 'u_starTex'),
      membraneTex: gl.getUniformLocation(this.program, 'u_membraneTex'),
      nebulaEnabled: gl.getUniformLocation(this.program, 'u_nebulaEnabled'),
      starEnabled: gl.getUniformLocation(this.program, 'u_starEnabled'),
      membraneEnabled: gl.getUniformLocation(this.program, 'u_membraneEnabled'),
      starBlend: gl.getUniformLocation(this.program, 'u_starBlend'),
      contrast: gl.getUniformLocation(this.program, 'u_contrast'),
    };
  }

  render(width, height, data, textures) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    this.geometry.bind();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures.nebulaTex ?? textures.fallback);
    if (this.uniforms.nebulaTex) gl.uniform1i(this.uniforms.nebulaTex, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures.starTex ?? textures.fallback);
    if (this.uniforms.starTex) gl.uniform1i(this.uniforms.starTex, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures.membraneTex ?? textures.fallback);
    if (this.uniforms.membraneTex) gl.uniform1i(this.uniforms.membraneTex, 2);

    if (this.uniforms.nebulaEnabled) gl.uniform1i(this.uniforms.nebulaEnabled, textures.nebulaEnabled ? 1 : 0);
    if (this.uniforms.starEnabled) gl.uniform1i(this.uniforms.starEnabled, textures.starEnabled ? 1 : 0);
    if (this.uniforms.membraneEnabled) gl.uniform1i(this.uniforms.membraneEnabled, textures.membraneEnabled ? 1 : 0);
    if (this.uniforms.starBlend) gl.uniform1f(this.uniforms.starBlend, data.starBlend ?? 0);
    if (this.uniforms.contrast) gl.uniform1f(this.uniforms.contrast, data.contrast ?? 1);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }
}

export class NebulaRenderer {
  constructor(store) {
    this.store = store;
    this.canvas = null;
    this.gl = null;
    this.geometry = null;
    this.nebulaPass = null;
    this.starPass = null;
    this.starFastPass = null;
    this.membranePass = null;
    this.compositePass = null;
    this.dummyTexture = null;
    this.glowLUTCompiler = null;
    this.glowLUTTexture = null;
    this.glowLUTSize = 0;
    this.glowLUTRows = 1;
    this.glowState = { hero: -1, glow: -1 };
    this.starFieldGenerator = null;
    this.starFieldTextures = null;
    this.starFieldState = null;
    this.starLayerInfoTexture = null;
    this.debugCell = { layer: 0, x: 19, y: 15 };
    this.debugCellSignature = null;
    this.isReady = false;
    this.canvasClickHandler = this.handleCanvasClick.bind(this);

    this.ready = this.init();
  }

  async init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cd-bgCanvas';
    document.body.prepend(this.canvas);
    window.addEventListener('click', this.canvasClickHandler);

    this.gl = this.canvas.getContext('webgl2', { alpha: true });
    if (!this.gl) throw new Error('WebGL2 Not Supported');

    this.geometry = new FullscreenGeometry(this.gl);
    const sources = await loadShaderSources();
    const vertSrc = sources.vertex;
    this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) || 4096;
    this.nebulaPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.nebula, NEBULA_UNIFORMS);
    this.starPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.star, STAR_UNIFORMS);
    this.starFastPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.star2, STAR_FAST_UNIFORMS);
    this.membranePass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.membrane, MEMBRANE_UNIFORMS);
    this.compositePass = new CompositePass(this.gl, this.geometry, vertSrc, sources.composite);
    this.dummyTexture = this.createDummyTexture();
    await this.initGlowLookupResources();
    await this.initStarFieldResources();

    if (globalDebug) {
      globalDebug.renderer = this;
      if (globalDebug.targetCell) {
        this.setDebugCell(globalDebug.targetCell);
      } else {
        globalDebug.targetCell = { ...this.debugCell };
        this.setDebugCell(globalDebug.targetCell);
      }
    }

    this.resize();
    this.isReady = true;
  }

  createDummyTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  createDataTexture(internalFormat, format, type) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { tex, internalFormat, format, type, width: 1, height: 1 };
  }

  uploadDataTexture(resource, width, height, data) {
    if (!resource?.tex || !this.gl) return;
    const w = Math.max(1, width ?? 1);
    const h = Math.max(1, height ?? 1);
    const gl = this.gl;
    resource.width = w;
    resource.height = h;
    gl.bindTexture(gl.TEXTURE_2D, resource.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, resource.internalFormat, w, h, 0, resource.format, resource.type, data ?? null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  async initGlowLookupResources() {
    if (!this.gl) return;
    this.glowLUTCompiler = await createGlowLookup(48);
    this.glowLUTSize = this.glowLUTCompiler.getSize();
    this.glowLUTRows = this.glowLUTCompiler.getRowCount?.() ?? 1;
    const gl = this.gl;
    this.glowLUTTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.glowLUTTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.glowLUTSize, this.glowLUTRows, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.starFastPass?.setDynamicUniform('glowLUTTex', (ctx, loc) => {
      ctx.activeTexture(ctx.TEXTURE5);
      ctx.bindTexture(ctx.TEXTURE_2D, this.glowLUTTexture ?? this.dummyTexture);
      ctx.uniform1i(loc, 5);
    });
    this.updateGlowLookup(this.store?.data ?? {});
  }

  async initStarFieldResources() {
    if (!this.gl) return;
    this.starFieldGenerator = await createWasmStarFieldGenerator();
    this.starLayerInfoTexture = this.createDataTexture(this.gl.RGBA32F, this.gl.RGBA, this.gl.FLOAT);
    this.uploadLayerInfoTexture();
    this.starFieldTextures = {
      descriptors: this.createDataTexture(this.gl.RGBA32F, this.gl.RGBA, this.gl.FLOAT),
      localIds: this.createDataTexture(this.gl.R32F, this.gl.RED, this.gl.FLOAT),
      spillIds: this.createDataTexture(this.gl.R32F, this.gl.RED, this.gl.FLOAT),
      localIndex: this.createDataTexture(this.gl.RG32F, this.gl.RG, this.gl.FLOAT),
      spillIndex: this.createDataTexture(this.gl.RG32F, this.gl.RG, this.gl.FLOAT),
    };
    this.starFieldState = {
      descriptor: { width: 1, height: TEXELS_PER_STAR },
      localIds: { width: 1, height: 1 },
      spillIds: { width: 1, height: 1 },
      localIndex: { width: 1, height: 1 },
      spillIndex: { width: 1, height: 1 },
      layerInfo: { width: this.starFieldGenerator.layerCount ?? 1, height: 1 },
      starCount: 0,
      cellCount: this.starFieldGenerator.cellCount ?? 0,
      layerCount: this.starFieldGenerator.layerCount ?? 0,
    };
    this.configureStarFieldUniforms();
  }

  configureStarFieldUniforms() {
    if (!this.starFastPass) return;
    const textureUnits = {
      starDescriptorTex: { key: 'descriptors', unit: 6 },
      starLocalIdTex: { key: 'localIds', unit: 7 },
      starSpillIdTex: { key: 'spillIds', unit: 8 },
      starLocalIndexTex: { key: 'localIndex', unit: 9 },
      starSpillIndexTex: { key: 'spillIndex', unit: 10 },
    };
    Object.entries(textureUnits).forEach(([uniformName, meta]) => {
      this.starFastPass.setDynamicUniform(uniformName, (ctx, loc) => {
        if (!loc) return;
        const texture = this.starFieldTextures?.[meta.key]?.tex ?? this.dummyTexture;
        ctx.activeTexture(ctx[`TEXTURE${meta.unit}`]);
        ctx.bindTexture(ctx.TEXTURE_2D, texture);
        ctx.uniform1i(loc, meta.unit);
      });
    });
    this.starFastPass.setDynamicUniform('starLayerInfoTex', (ctx, loc) => {
      if (!loc) return;
      ctx.activeTexture(ctx.TEXTURE11);
      ctx.bindTexture(ctx.TEXTURE_2D, this.starLayerInfoTexture?.tex ?? this.dummyTexture);
      ctx.uniform1i(loc, 11);
    });
  }

  updateStarField(data, time) {
    if (!this.starFieldGenerator || !this.starFieldTextures) {
      return this.getStarFieldUniformPayload();
    }
    const starData = this.starFieldGenerator.generate({ ...data, time });
    this.uploadStarFieldDescriptors(starData.descriptors, starData.starCount);
    this.uploadStarFieldIds('localIds', starData.local.ids);
    this.uploadStarFieldIds('spillIds', starData.spill.ids);
    this.uploadStarFieldIndices('localIndex', starData.local.offsets, starData.local.counts);
    this.uploadStarFieldIndices('spillIndex', starData.spill.offsets, starData.spill.counts);
    this.logDebugCellData(starData);
    if (this.starFieldState) {
      this.starFieldState.starCount = starData.starCount;
      this.starFieldState.cellCount = starData.cellCount;
      this.starFieldState.layerCount = starData.layerCount;
    }
    return this.getStarFieldUniformPayload();
  }

  uploadLayerInfoTexture() {
    if (!this.starLayerInfoTexture || !this.starFieldGenerator) return;
    const payload = this.starFieldGenerator.getLayerInfoTexture?.();
    if (!payload) return;
    this.uploadDataTexture(this.starLayerInfoTexture, payload.width, payload.height, payload.data);
    if (this.starFieldState?.layerInfo) {
      this.starFieldState.layerInfo.width = payload.width;
      this.starFieldState.layerInfo.height = payload.height;
    }
  }

  uploadStarFieldDescriptors(buffer, starCount) {
    if (!this.starFieldTextures?.descriptors) return;
    const payload = packDescriptorTextureData(buffer, starCount, this.maxTextureSize);
    this.uploadDataTexture(this.starFieldTextures.descriptors, payload.width, payload.height, payload.data);
    if (this.starFieldState) {
      this.starFieldState.descriptor.width = payload.width;
      this.starFieldState.descriptor.height = payload.height;
    }
  }

  uploadStarFieldIds(kind, ids) {
    if (!this.starFieldTextures?.[kind]) return;
    const payload = packIdTextureData(ids, this.maxTextureSize);
    this.uploadDataTexture(this.starFieldTextures[kind], payload.width, payload.height, payload.data);
    if (this.starFieldState?.[kind]) {
      this.starFieldState[kind].width = payload.width;
      this.starFieldState[kind].height = payload.height;
    }
  }

  uploadStarFieldIndices(kind, offsets, counts) {
    if (!this.starFieldTextures?.[kind]) return;
    const payload = packIndexTextureData(offsets, counts, this.maxTextureSize);
    this.uploadDataTexture(this.starFieldTextures[kind], payload.width, payload.height, payload.data);
    if (this.starFieldState?.[kind]) {
      this.starFieldState[kind].width = payload.width;
      this.starFieldState[kind].height = payload.height;
    }
  }

  setDebugCell(cell) {
    if (!cell) {
      this.debugCell = null;
      this.debugCellSignature = null;
      console.info('[StarField] Debug cell cleared');
      return;
    }
    const next = {
      layer: clampCellIndex(cell.layer),
      x: clampCellIndex(cell.x),
      y: clampCellIndex(cell.y),
    };
    this.debugCell = next;
    this.debugCellSignature = null;
    console.info('[StarField] Debug cell set', next);
  }

  getDebugUniformPayload() {
    if (!this.debugCell || !this.starFieldState) {
      return {
        debugCellLayer: 0,
        debugCellX: 0,
        debugCellY: 0,
        debugCellEnabled: 0,
      };
    }
    return {
      debugCellLayer: this.debugCell.layer,
      debugCellX: this.debugCell.x,
      debugCellY: this.debugCell.y,
      debugCellEnabled: 1,
    };
  }

  extractIdsForCell(bucket, cellIndex) {
    if (!bucket || cellIndex == null) return [];
    const offset = bucket.offsets?.[cellIndex];
    const count = bucket.counts?.[cellIndex];
    if (offset == null || count == null) return [];
    const end = offset + count;
    return Array.from(bucket.ids?.slice?.(offset, end) ?? []);
  }

  logDebugCellData(starData) {
    if (!this.debugCell || !starData?.layerMeta?.length) return;
    const layerMeta = starData.layerMeta[this.debugCell.layer];
    if (!layerMeta) return;
    const { cellsPerAxis, cellOffset } = layerMeta;
    const clampedX = Math.min(Math.max(this.debugCell.x, 0), cellsPerAxis - 1);
    const clampedY = Math.min(Math.max(this.debugCell.y, 0), cellsPerAxis - 1);
    const cellIndex = cellOffset + clampedY * cellsPerAxis + clampedX;
    const localIds = this.extractIdsForCell(starData.local, cellIndex);
    const spillIds = this.extractIdsForCell(starData.spill, cellIndex);
    const signature = `${localIds.join(',')}|${spillIds.join(',')}`;
    if (signature === this.debugCellSignature) {
      return;
    }
    this.debugCellSignature = signature;
    console.group(`[StarField] Debug cell L${this.debugCell.layer} (${clampedX}, ${clampedY})`);
    console.log('Local IDs:', localIds);
    console.log('Spill IDs:', spillIds);
    console.log('Local count:', localIds.length, 'Spill count:', spillIds.length);
    if (typeof starData.local.dropCount === 'number' || typeof starData.spill.dropCount === 'number') {
      console.log('Drop counts → local:', starData.local.dropCount ?? 0, 'spill:', starData.spill.dropCount ?? 0);
    }
    if (localIds.length && starData.descriptors) {
      localIds.forEach(id => {
        const base = id * STAR_DESCRIPTOR_FLOATS;
        if (base + 11 >= starData.descriptors.length) return;
        const desc = Array.from(starData.descriptors.slice(base, base + STAR_DESCRIPTOR_FLOATS));
        console.log(`Descriptor[${id}]:`, {
          position: { x: desc[0], y: desc[1] },
          layer: desc[2],
          size: desc[3],
          coreScale: desc[4],
          haloScale: desc[5],
          tint: { r: desc[6], g: desc[7], b: desc[8] },
          sparklePhase: desc[9],
          intensity: desc[10],
          heroFlag: desc[11],
        });
        this.logStarSpillTargets({
          starId: id,
          descriptor: desc,
          layerMeta,
          cellX: clampedX,
          cellY: clampedY,
        });
      });
    }
    console.groupEnd();
  }

  logStarSpillTargets({ starId, descriptor, layerMeta, cellX, cellY }) {
    const cells = Math.max(1, layerMeta?.cellsPerAxis ?? 1);
    const scale = layerMeta?.scale ?? 1;
    if (!descriptor || scale <= 0) return;
    const size = descriptor[3] ?? 0;
    const haloScale = descriptor[5] ?? 0;
    const worldToCell = scale > 0 ? cells / scale : 1;
    let rawSpill = size * haloScale * worldToCell * 4.0;
    if (!Number.isFinite(rawSpill) || rawSpill <= 0) return;
    rawSpill = Math.min(2, rawSpill);
    let spillRadius = Math.floor(rawSpill);
    if (spillRadius < rawSpill) spillRadius += 1;
    if (spillRadius <= 0) return;

    const neighbors = [];
    const wrapIndex = (value, span) => {
      const mod = value % span;
      return mod < 0 ? mod + span : mod;
    };

    for (let dy = -spillRadius; dy <= spillRadius; dy++) {
      for (let dx = -spillRadius; dx <= spillRadius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const rawX = cellX + dx;
        const rawY = cellY + dy;
        const nx = wrapIndex(rawX, cells);
        const ny = wrapIndex(rawY, cells);
        neighbors.push({
          dx,
          dy,
          cell: `${nx},${ny}`,
          wrapped: rawX !== nx || rawY !== ny,
        });
      }
    }

    if (neighbors.length) {
      console.log(`[StarField] Spill targets for star ${starId}:`, neighbors);
    }
  }

  handleCanvasClick(event) {
    if (!this.canvas || !this.starFieldGenerator?.layerMeta?.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) return;
    if (Number.isNaN(px) || Number.isNaN(py)) return;

    console.info('[StarField] Click @ canvas UV', { px, py });

    const vUvX = Math.min(Math.max(px, 0), 1);
    const vUvY = Math.min(Math.max(1 - py, 0), 1);
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    let uvX = (vUvX - 0.5) * aspect;
    let uvY = (vUvY - 0.5);

    const zoom = this.store?.data?.zoom ?? 1;
    const zoomT = Math.min(Math.max(2.2 - zoom, 0), 1.5);
    const zoomAtten = 0.4 * (1 - zoomT) + 1.8 * zoomT;
    uvX *= zoomAtten;
    uvY *= zoomAtten;

    const normalizedX = uvX + 0.5;
    const normalizedY = uvY + 0.5;
    const tileX = Math.floor(normalizedX);
    const tileY = Math.floor(normalizedY);
    const localX = Math.min(Math.max(normalizedX - tileX, 0), 0.9999);
    const localY = Math.min(Math.max(normalizedY - tileY, 0), 0.9999);

    const layerIndex = 0;
    const layerMeta = this.starFieldGenerator.layerMeta?.[layerIndex];
    if (!layerMeta) return;
    const cellsPerAxis = Math.max(1, layerMeta.cellsPerAxis ?? 1);
    const cellX = Math.min(Math.max(Math.floor(localX * cellsPerAxis), 0), cellsPerAxis - 1);
    const cellY = Math.min(Math.max(Math.floor(localY * cellsPerAxis), 0), cellsPerAxis - 1);

    console.info('[StarField] Click resolved to cell', {
      layer: layerIndex,
      cellX,
      cellY,
      cellsPerAxis,
    });

    this.setDebugCell({ layer: layerIndex, x: cellX, y: cellY });
    if (globalDebug) {
      globalDebug.targetCell = { layer: layerIndex, x: cellX, y: cellY };
    }
  }

  getStarFieldUniformPayload() {
    if (!this.starFieldState) {
      return {
        starDescriptorWidth: 1,
        starDescriptorHeight: TEXELS_PER_STAR,
        starLocalWidth: 1,
        starLocalHeight: 1,
        starSpillWidth: 1,
        starSpillHeight: 1,
        starLocalIndexWidth: 1,
        starLocalIndexHeight: 1,
        starSpillIndexWidth: 1,
        starSpillIndexHeight: 1,
        starLayerInfoWidth: 1,
        starLayerInfoHeight: 1,
        starCellCount: 0,
        starLayerCount: 0,
        starCount: 0,
      };
    }
    return {
      starDescriptorWidth: this.starFieldState.descriptor.width,
      starDescriptorHeight: this.starFieldState.descriptor.height,
      starLocalWidth: this.starFieldState.localIds.width,
      starLocalHeight: this.starFieldState.localIds.height,
      starSpillWidth: this.starFieldState.spillIds.width,
      starSpillHeight: this.starFieldState.spillIds.height,
      starLocalIndexWidth: this.starFieldState.localIndex.width,
      starLocalIndexHeight: this.starFieldState.localIndex.height,
      starSpillIndexWidth: this.starFieldState.spillIndex.width,
      starSpillIndexHeight: this.starFieldState.spillIndex.height,
      starLayerInfoWidth: this.starFieldState.layerInfo.width,
      starLayerInfoHeight: this.starFieldState.layerInfo.height,
      starCellCount: this.starFieldState.cellCount,
      starLayerCount: this.starFieldState.layerCount,
      starCount: this.starFieldState.starCount,
    };
  }

  updateGlowLookup(data) {
    if (!this.glowLUTCompiler || !this.glowLUTTexture) return;
    const heroBias = clamp01((data.starFastGlowRad ?? 0) / 1.2);
    const glowMax = clamp01((data.starFastGlow ?? 0) / 2.0);
    if (heroBias === this.glowState.hero && glowMax === this.glowState.glow) return;
    const payload = this.glowLUTCompiler.rebuild(heroBias, glowMax);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.glowLUTTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.glowLUTCompiler.getSize(), this.glowLUTRows, 0, gl.RGBA, gl.FLOAT, payload);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.glowState.hero = heroBias;
    this.glowState.glow = glowMax;
  }

  resize() {
    if (!this.canvas || !this.gl) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.nebulaPass?.resize(this.canvas.width, this.canvas.height);
    this.starPass?.resize(this.canvas.width, this.canvas.height);
    this.starFastPass?.resize(this.canvas.width, this.canvas.height);
    this.membranePass?.resize(this.canvas.width, this.canvas.height);
  }

  render(time) {
    if (!this.gl || !this.isReady) return;
    const data = this.store.data;
    const nebulaEnabled = data.nebulaEnabled !== false;
    const starEnabled = data.starEnabled !== false;
    const useFast = data.starFastMode === true;
    const starPassActive = starEnabled || useFast;
    const membraneEnabled = data.membraneEnabled !== false;
    let nebulaTex = this.dummyTexture;
    let starTex = this.dummyTexture;
    let membraneTex = this.dummyTexture;

    if (nebulaEnabled) {
      nebulaTex = this.nebulaPass.render(time, data) ?? this.dummyTexture;
    }
    if (starPassActive) {
      const activeStarPass = useFast
        ? (this.starFastPass ?? (starEnabled ? this.starPass : null))
        : (starEnabled ? this.starPass : null);
      if (activeStarPass) {
        let extraUniforms = null;
        if (activeStarPass === this.starFastPass) {
          this.updateGlowLookup(data);
          const starFieldUniforms = this.updateStarField(data, time);
          const debugUniforms = this.getDebugUniformPayload();
          extraUniforms = {
            glowLUTSize: this.glowLUTSize,
            glowLUTRows: this.glowLUTRows,
            ...(starFieldUniforms ?? {}),
            ...(debugUniforms ?? {}),
          };
        }
        starTex = activeStarPass.render(time, data, extraUniforms) ?? this.dummyTexture;
      }
    }
    if (membraneEnabled) {
      membraneTex = this.membranePass.render(time, data) ?? this.dummyTexture;
    }

    this.compositePass.render(
      this.canvas.width,
      this.canvas.height,
      data,
      {
        nebulaTex,
        starTex,
        membraneTex,
        nebulaEnabled,
        starEnabled: starPassActive,
        membraneEnabled,
        fallback: this.dummyTexture,
      }
    );
  }
}
