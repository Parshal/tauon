import { loadShaderSources } from '../data/shaders.js';

const FULLSCREEN_TRIANGLES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]);

const STAR_UNIFORMS = ['zoom','starDensity','starTwinkle','starZoom'];
const TIMER_QUERY_LIMIT = 4;

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
      starTex: gl.getUniformLocation(this.program, 'u_starTex'),
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
    gl.bindTexture(gl.TEXTURE_2D, textures.starTex ?? textures.fallback);
    if (this.uniforms.starTex) gl.uniform1i(this.uniforms.starTex, 0);

    if (this.uniforms.contrast) gl.uniform1f(this.uniforms.contrast, data.contrast ?? 1);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }
}

export class BackgroundRenderer {
  constructor(store) {
    this.store = store;
    this.canvas = null;
    this.gl = null;
    this.geometry = null;
    this.starPass = null;
    this.compositePass = null;
    this.dummyTexture = null;
    this.isReady = false;
    this.ready = this.init();

    this.timerExt = null;
    this.timerExtMode = null; // 'webgl2' or 'webgl1'
    this.pendingTimerQueries = [];
    this.activeTimerQuery = null;
    this.lastGpuTimeMs = null;
    this.timingMode = 'none'; // 'gpu-ext' | 'cpu-fallback' | 'none'
    this.gpuSampleTimeoutMs = 2000;
    this.noGpuSampleAccumMs = 0;
    this.cpuFallbackIntervalMs = 500;
    this.cpuFallbackAccumMs = 0;
    this.lastPerfNowMs = null;
    this.cpuFallbackEnabled = false;
    this.gpuTimerWarningShown = false;
    this.timingDebugEnabled = typeof window !== 'undefined' && window.__THEMER_TIMING_DEBUG__ === true;
  }

  setupTimerSupport() {
    if (!this.gl) return;
    if (this.timerExtMode && this.timingMode !== 'none') return;

    if (!this.timerExt) {
      const primary = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (primary) {
        this.timerExt = primary;
        this.timerExtMode = 'webgl2';
      } else {
        const fallbackExt = this.gl.getExtension('EXT_disjoint_timer_query');
        if (fallbackExt) {
          this.timerExt = fallbackExt;
          this.timerExtMode = 'webgl1';
        }
      }
    }

    if (this.timerExt) {
      this.timingMode = 'gpu-ext';
      this.cpuFallbackEnabled = false;
      this.debugTiming('GPU timer extension ready', this.timerExtMode);
    } else {
      this.timingMode = 'cpu-fallback';
      this.cpuFallbackEnabled = true;
      this.debugTiming('GPU timer extension missing, using CPU fallback');
    }
  }

  debugTiming(...args) {
    if (this.timingDebugEnabled) {
      console.log('[Themer][Timing]', ...args);
    }
  }

  async init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cd-bgCanvas';
    document.body.prepend(this.canvas);

    this.gl = this.canvas.getContext('webgl2', { alpha: true });
    if (!this.gl) throw new Error('WebGL2 Not Supported');

    this.setupTimerSupport();

    this.geometry = new FullscreenGeometry(this.gl);
    const sources = await loadShaderSources();
    const vertSrc = sources.vertex;

    this.starPass = new ShaderPass(this.gl, this.geometry, vertSrc, sources.star, STAR_UNIFORMS);
    this.starPass.setDynamicUniform('seamDebugEnabled', (ctx, loc) => {
      const enabled = this.store?.data?.seamDebugEnabled === true;
      ctx.uniform1f(loc, enabled ? 1.0 : 0.0);
    });

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
    this.starPass?.resize(this.canvas.width, this.canvas.height);
  }

  render(time) {
    if (!this.gl || !this.isReady) return;
    if (this.timingMode === 'none') {
      this.setupTimerSupport();
    }
    const data = this.store.data;
    const shouldRenderStar = data.starEnabled !== false && this.starPass;
    if (!shouldRenderStar) {
      this.lastGpuTimeMs = null;
    }

    const nowMs = performance.now();
    if (this.lastPerfNowMs === null) this.lastPerfNowMs = nowMs;
    const deltaMs = nowMs - this.lastPerfNowMs;
    this.lastPerfNowMs = nowMs;

    if (this.timingMode === 'gpu-ext') {
      this.resolveTimerQueries();
      this.noGpuSampleAccumMs += deltaMs;
      if (this.noGpuSampleAccumMs > this.gpuSampleTimeoutMs) {
        this.disableGpuTimerSupport('GPU timer queries never resolved; falling back to CPU timing');
      }
    } else if (this.timingMode === 'cpu-fallback') {
      this.cpuFallbackAccumMs += deltaMs;
    }

    const canSample = shouldRenderStar
      && this.timingMode === 'gpu-ext'
      && this.timerExt
      && !this.activeTimerQuery
      && this.pendingTimerQueries.length < TIMER_QUERY_LIMIT;

    const useCpuSample = shouldRenderStar
      && this.timingMode === 'cpu-fallback'
      && this.cpuFallbackAccumMs >= this.cpuFallbackIntervalMs;

    if (canSample) this.beginStarTimer();
    let cpuSampleStart = null;
    if (useCpuSample) {
      cpuSampleStart = performance.now();
    }

    const starTex = shouldRenderStar
      ? (this.starPass.render(time, data) ?? this.dummyTexture)
      : this.dummyTexture;

    if (canSample) this.endStarTimer();
    if (useCpuSample) {
      this.gl.finish();
      const cpuEnd = performance.now();
      this.lastGpuTimeMs = cpuEnd - cpuSampleStart;
      this.cpuFallbackAccumMs = 0;
      this.debugTiming('CPU sample captured', this.lastGpuTimeMs);
    }

    this.compositePass.render(
      this.canvas.width,
      this.canvas.height,
      data,
      {
        starTex,
        fallback: this.dummyTexture,
      }
    );
  }

  beginStarTimer() {
    const ext = this.timerExt;
    if (!ext || this.activeTimerQuery) return;

    if (this.timerExtMode === 'webgl2') {
      const query = this.gl.createQuery();
      if (!query) return;
      this.activeTimerQuery = query;
      this.gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    } else {
      const query = ext.createQueryEXT();
      if (!query) return;
      this.activeTimerQuery = query;
      ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, query);
    }
  }

  endStarTimer() {
    const ext = this.timerExt;
    if (!ext || !this.activeTimerQuery) return;
    if (this.timerExtMode === 'webgl2') {
      this.gl.endQuery(ext.TIME_ELAPSED_EXT);
    } else {
      ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
    }
    this.pendingTimerQueries.push(this.activeTimerQuery);
    this.activeTimerQuery = null;
  }

  resolveTimerQueries() {
    const ext = this.timerExt;
    if (!ext || !this.pendingTimerQueries.length) return;
    const disjoint = this.gl.getParameter(ext.GPU_DISJOINT_EXT);

    while (this.pendingTimerQueries.length) {
      const query = this.pendingTimerQueries[0];
      let available = false;
      if (this.timerExtMode === 'webgl2') {
        available = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
      } else {
        available = ext.getQueryObjectEXT(query, ext.QUERY_RESULT_AVAILABLE_EXT);
      }
      if (!available) break;
      this.pendingTimerQueries.shift();

      if (!disjoint) {
        const ns = this.timerExtMode === 'webgl2'
          ? this.gl.getQueryParameter(query, this.gl.QUERY_RESULT)
          : ext.getQueryObjectEXT(query, ext.QUERY_RESULT_EXT);
        this.lastGpuTimeMs = ns / 1e6;
        this.noGpuSampleAccumMs = 0;
        this.debugTiming('GPU sample resolved', this.lastGpuTimeMs);
      } else {
        this.lastGpuTimeMs = null;
        this.debugTiming('GPU disjoint detected — sample discarded');
      }

      if (this.timerExtMode === 'webgl2') {
        this.gl.deleteQuery(query);
      } else {
        ext.deleteQueryEXT(query);
      }
    }

    if (disjoint) {
      this.pendingTimerQueries.length = 0;
      if (this.activeTimerQuery) {
        if (this.timerExtMode === 'webgl2') {
          this.gl.endQuery(ext.TIME_ELAPSED_EXT);
          this.gl.deleteQuery(this.activeTimerQuery);
        } else {
          ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
          ext.deleteQueryEXT(this.activeTimerQuery);
        }
        this.activeTimerQuery = null;
      }
    }
  }

  disableGpuTimerSupport(reason) {
    if (this.timingMode !== 'gpu-ext') return;
    const ext = this.timerExt;
    if (this.timerExtMode === 'webgl2') {
      if (this.activeTimerQuery) {
        this.gl.deleteQuery(this.activeTimerQuery);
      }
      this.pendingTimerQueries.forEach(query => {
        if (query) this.gl.deleteQuery(query);
      });
    } else if (ext) {
      if (this.activeTimerQuery) {
        ext.deleteQueryEXT(this.activeTimerQuery);
      }
      this.pendingTimerQueries.forEach(query => {
        if (query) ext.deleteQueryEXT(query);
      });
    }
    this.pendingTimerQueries = [];
    this.activeTimerQuery = null;
    this.timerExt = null;
    this.timerExtMode = null;
    this.timingMode = 'cpu-fallback';
    this.cpuFallbackEnabled = true;
    this.cpuFallbackAccumMs = 0;
    this.noGpuSampleAccumMs = 0;
    this.debugTiming('Disabling GPU timer support', reason);
    if (!this.gpuTimerWarningShown && reason) {
      this.gpuTimerWarningShown = true;
      console.warn(`[Themer] ${reason}`);
    }
  }

  getStarPassMs() {
    return (typeof this.lastGpuTimeMs === 'number' && isFinite(this.lastGpuTimeMs))
      ? this.lastGpuTimeMs
      : null;
  }

  getTimingMode() {
    return this.timingMode;
  }

  setTimingDebugEnabled(enabled) {
    this.timingDebugEnabled = !!enabled;
  }

  isTimingDebugEnabled() {
    return this.timingDebugEnabled;
  }
}
