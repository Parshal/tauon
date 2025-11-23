import { loadShaderSources } from '../data/shaders.js';

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
const STAR_FAST_UNIFORMS = ['zoom','starFastDensity','starFastTwinkle','starFastSoft','starFastGlow','starFastGlowRad','starFastBright'];
const MEMBRANE_UNIFORMS = ['membraneStrength','membraneFlow','membraneFringe','momentumPersistence','permissionBloom','permissionGate'];

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

  render(time, data) {
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
      const value = data[key];
      if (typeof value === 'number') {
        gl.uniform1f(loc, value);
      }
    });
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.texture;
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
    this.isReady = false;

    this.ready = this.init();
  }

  async init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cd-bgCanvas';
    document.body.prepend(this.canvas);

    this.gl = this.canvas.getContext('webgl2', { alpha: true });
    if (!this.gl) throw new Error('WebGL2 Not Supported');

    this.geometry = new FullscreenGeometry(this.gl);
    const sources = await loadShaderSources();
    const vertSrc = sources.vertex;
    this.nebulaPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.nebula, NEBULA_UNIFORMS);
    this.starPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.star, STAR_UNIFORMS);
    this.starFastPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.star2, STAR_FAST_UNIFORMS);
    this.membranePass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.membrane, MEMBRANE_UNIFORMS);
    this.compositePass = new CompositePass(this.gl, this.geometry, vertSrc, sources.composite);
    this.dummyTexture = this.createDummyTexture();

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
        starTex = activeStarPass.render(time, data) ?? this.dummyTexture;
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
