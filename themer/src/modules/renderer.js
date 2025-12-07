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
    const data = this.store.data;
    const starEnabled = data.starEnabled !== false;
    const starTex = starEnabled && this.starPass
      ? (this.starPass.render(time, data) ?? this.dummyTexture)
      : this.dummyTexture;

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
}
