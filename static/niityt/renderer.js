import { computeSquareLayout } from './layout.js';

const FULLSCREEN_TRIANGLES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]);

const HUD_ICON_LIMIT = 4;
const TOOLBELT_SLOTS_PER_SIDE = HUD_ICON_LIMIT;

async function loadText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const info = gl.getShaderInfoLog(shader);
  if (info && info.trim().length) {
    console.warn('[Niityt] shader log:', info);
  }
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error(info || 'Shader compile failed');
  }
  return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const program = gl.createProgram();
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const linkInfo = gl.getProgramInfoLog(program);
  if (linkInfo && linkInfo.trim().length) {
    console.warn('[Niityt] program log:', linkInfo);
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error(linkInfo || 'Program link failed');
  }
  return program;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export class NiitytRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.gridTexture = null;
    this.cellColorTexture = null;
    this.reachTexture = null;
    this.gridWidth = 0;
    this.gridHeight = 0;
    this.cellColorWidth = 0;
    this.cellColorHeight = 0;
    this.gridTextureReady = false;
    this.cellTextureReady = false;
    this.uniforms = {};
    this.resizeObserver = null;
    this.layout = computeSquareLayout(canvas?.clientWidth || 1, canvas?.clientHeight || 1);
    this.hudFallback = new Float32Array(HUD_ICON_LIMIT);
    this.toolbeltFallback = {
      fill: new Float32Array(TOOLBELT_SLOTS_PER_SIDE),
      colors: new Float32Array(TOOLBELT_SLOTS_PER_SIDE),
      active: new Float32Array(TOOLBELT_SLOTS_PER_SIDE),
      stacks: new Float32Array(TOOLBELT_SLOTS_PER_SIDE)
    };
  }

  async init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    const vertexURL = new URL('./shaders/grid.vert.glsl', import.meta.url);
    const fragmentURL = new URL('./shaders/grid.frag.glsl', import.meta.url);
    const [vertexSrc, fragmentSrc] = await Promise.all([
      loadText(vertexURL),
      loadText(fragmentURL)
    ]);

    this.program = createProgram(gl, vertexSrc, fragmentSrc);
    this.cacheUniforms();
    this.setupGeometry();
    this.setupTextures();
    this.handleResize();
    this.installResizeObserver();
  }

  cacheUniforms() {
    const gl = this.gl;
    const names = [
      'u_grid',
      'u_gridSize',
      'u_time',
      'u_enableTexture',
      'u_cellColors',
      'u_reach',
      'u_bandHeight',
      'u_energyNorm',
      'u_pointerUv',
      'u_pointerActive',
      'u_squareMin',
      'u_squareMax',
      'u_hudLeftValues',
      'u_hudRightValues',
      'u_hudLeftCount',
      'u_hudRightCount',
      'u_toolbeltLeftFill',
      'u_toolbeltLeftColors',
      'u_toolbeltLeftActive',
      'u_toolbeltLeftStacks',
      'u_toolbeltRightFill',
      'u_toolbeltRightColors',
      'u_toolbeltRightActive',
      'u_toolbeltRightStacks',
      'u_fertilizerCount',
      'u_fertilizerNorm',
      'u_recentPickupColor',
      'u_recentPickupStrength',
      'u_fertilizerBoostCenterUv',
      'u_fertilizerBoostRadius',
      'u_fertilizerBoostStrength',
      'u_fertilizerBoostColorId'
    ];
    this.uniforms = names.reduce((map, name) => {
      map[name] = gl.getUniformLocation(this.program, name);
      return map;
    }, {});
  }

  setupGeometry() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLES, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
  }

  setupTextures() {
    const gl = this.gl;
    this.gridTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.cellColorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cellColorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.reachTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.reachTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  installResizeObserver() {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => this.handleResize());
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
  }

  handleResize() {
    const gl = this.gl;
    if (!gl) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    this.updateLayout();
  }

  updateLayout() {
    const clientWidth = this.canvas.clientWidth || 1;
    const clientHeight = this.canvas.clientHeight || 1;
    this.layout = computeSquareLayout(clientWidth, clientHeight);
  }

  uploadGrid(grid, width, height) {
    const gl = this.gl;
    if (!gl || !grid) return;
    const needsResize = width !== this.gridWidth || height !== this.gridHeight;
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);
    if (needsResize) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        width,
        height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        grid
      );
      this.gridWidth = width;
      this.gridHeight = height;
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        width,
        height,
        gl.RED,
        gl.UNSIGNED_BYTE,
        grid
      );
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.gridTextureReady = true;
  }

  uploadCellColors(cellColors, width, height) {
    const gl = this.gl;
    if (!gl || !cellColors) return;
    const needsResize = width !== this.cellColorWidth || height !== this.cellColorHeight;
    gl.bindTexture(gl.TEXTURE_2D, this.cellColorTexture);
    if (needsResize) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        width,
        height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        cellColors
      );
      this.cellColorWidth = width;
      this.cellColorHeight = height;
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        width,
        height,
        gl.RED,
        gl.UNSIGNED_BYTE,
        cellColors
      );
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.cellTextureReady = true;
  }

  uploadReach(reachMask, width, height) {
    const gl = this.gl;
    if (!gl || !reachMask) return;
    gl.bindTexture(gl.TEXTURE_2D, this.reachTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      reachMask
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(payload) {
    const gl = this.gl;
    if (!gl) return;

    const {
      grid,
      cellColors,
      width,
      height,
      time,
      pointerCell,
      pointerActive,
      bandHeightNorm,
      energyNorm,
      hudLeftIcons,
      hudRightIcons,
      toolbeltLeft,
      toolbeltRight,
      fertilizerNorm,
      fertilizerCount,
      recentPickup,
      reachMask,
      fertilizerBoost
    } = payload;

    const layout = this.layout || computeSquareLayout(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);

    if (grid) {
      this.uploadGrid(grid, width, height);
    }
    if (cellColors) {
      this.uploadCellColors(cellColors, width, height);
    }
    if (reachMask) {
      this.uploadReach(reachMask, width, height);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture);
    if (this.uniforms.u_grid) {
      gl.uniform1i(this.uniforms.u_grid, 0);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.cellColorTexture);
    if (this.uniforms.u_cellColors) {
      gl.uniform1i(this.uniforms.u_cellColors, 1);
    }
    gl.activeTexture(gl.TEXTURE0);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.reachTexture);
    if (this.uniforms.u_reach) {
      gl.uniform1i(this.uniforms.u_reach, 2);
    }
    gl.activeTexture(gl.TEXTURE0);

    if (this.uniforms.u_gridSize) {
      gl.uniform2f(this.uniforms.u_gridSize, width, height);
    }
    if (this.uniforms.u_time) {
      gl.uniform1f(this.uniforms.u_time, time);
    }
    if (this.uniforms.u_enableTexture) {
      gl.uniform1f(this.uniforms.u_enableTexture, this.gridTextureReady ? 1.0 : 0.0);
    }
    if (this.uniforms.u_bandHeight) {
      gl.uniform1f(this.uniforms.u_bandHeight, bandHeightNorm || 0.1);
    }
    if (this.uniforms.u_energyNorm) {
      gl.uniform1f(this.uniforms.u_energyNorm, energyNorm || 0.0);
    }

    if (this.uniforms.u_pointerUv) {
      let pointerUvX = 0.0;
      let pointerUvY = 0.0;
      if (pointerCell) {
        pointerUvX = (pointerCell.x + 0.5) / width;
        pointerUvY = (pointerCell.y + 0.5) / height;
      }
      gl.uniform2f(this.uniforms.u_pointerUv, pointerUvX, pointerUvY);
    }
    if (this.uniforms.u_pointerActive) {
      gl.uniform1f(this.uniforms.u_pointerActive, pointerActive ? 1.0 : 0.0);
    }

    if (this.uniforms.u_squareMin) {
      gl.uniform2f(this.uniforms.u_squareMin, layout.playMinX, layout.playMinY);
    }
    if (this.uniforms.u_squareMax) {
      gl.uniform2f(this.uniforms.u_squareMax, layout.playMaxX, layout.playMaxY);
    }

    const leftIcons = hudLeftIcons || {};
    const rightIcons = hudRightIcons || {};
    const leftValues = leftIcons.values instanceof Float32Array ? leftIcons.values : this.hudFallback;
    const rightValues = rightIcons.values instanceof Float32Array ? rightIcons.values : this.hudFallback;
    const leftCount = leftIcons.count || 0;
    const rightCount = rightIcons.count || 0;

    if (this.uniforms.u_hudLeftValues) {
      gl.uniform1fv(this.uniforms.u_hudLeftValues, leftValues);
    }
    if (this.uniforms.u_hudRightValues) {
      gl.uniform1fv(this.uniforms.u_hudRightValues, rightValues);
    }
    if (this.uniforms.u_hudLeftCount) {
      gl.uniform1i(this.uniforms.u_hudLeftCount, leftCount);
    }
    if (this.uniforms.u_hudRightCount) {
      gl.uniform1i(this.uniforms.u_hudRightCount, rightCount);
    }

    const fallback = this.toolbeltFallback;
    const leftToolbelt = toolbeltLeft || {};
    const rightToolbelt = toolbeltRight || {};

    const leftFill = leftToolbelt.fill instanceof Float32Array ? leftToolbelt.fill : fallback.fill;
    const leftColors = leftToolbelt.colors instanceof Float32Array ? leftToolbelt.colors : fallback.colors;
    const leftActive = leftToolbelt.active instanceof Float32Array ? leftToolbelt.active : fallback.active;
    const leftStacks = leftToolbelt.stacks instanceof Float32Array ? leftToolbelt.stacks : fallback.stacks;

    const rightFill = rightToolbelt.fill instanceof Float32Array ? rightToolbelt.fill : fallback.fill;
    const rightColors = rightToolbelt.colors instanceof Float32Array ? rightToolbelt.colors : fallback.colors;
    const rightActive = rightToolbelt.active instanceof Float32Array ? rightToolbelt.active : fallback.active;
    const rightStacks = rightToolbelt.stacks instanceof Float32Array ? rightToolbelt.stacks : fallback.stacks;

    if (this.uniforms.u_toolbeltLeftFill) {
      gl.uniform1fv(this.uniforms.u_toolbeltLeftFill, leftFill);
    }
    if (this.uniforms.u_toolbeltLeftColors) {
      gl.uniform1fv(this.uniforms.u_toolbeltLeftColors, leftColors);
    }
    if (this.uniforms.u_toolbeltLeftActive) {
      gl.uniform1fv(this.uniforms.u_toolbeltLeftActive, leftActive);
    }
    if (this.uniforms.u_toolbeltLeftStacks) {
      gl.uniform1fv(this.uniforms.u_toolbeltLeftStacks, leftStacks);
    }

    if (this.uniforms.u_toolbeltRightFill) {
      gl.uniform1fv(this.uniforms.u_toolbeltRightFill, rightFill);
    }
    if (this.uniforms.u_toolbeltRightColors) {
      gl.uniform1fv(this.uniforms.u_toolbeltRightColors, rightColors);
    }
    if (this.uniforms.u_toolbeltRightActive) {
      gl.uniform1fv(this.uniforms.u_toolbeltRightActive, rightActive);
    }
    if (this.uniforms.u_toolbeltRightStacks) {
      gl.uniform1fv(this.uniforms.u_toolbeltRightStacks, rightStacks);
    }

    if (this.uniforms.u_fertilizerNorm) {
      const fert = Number.isFinite(fertilizerNorm) ? clamp01(fertilizerNorm) : 0;
      gl.uniform1f(this.uniforms.u_fertilizerNorm, fert);
    }

    if (this.uniforms.u_fertilizerCount) {
      const fertCount = Number.isFinite(fertilizerCount) ? fertilizerCount : 0;
      gl.uniform1f(this.uniforms.u_fertilizerCount, fertCount);
    }

    if (this.uniforms.u_recentPickupColor) {
      const pickupColor = recentPickup?.colorId || 0;
      gl.uniform1f(this.uniforms.u_recentPickupColor, pickupColor);
    }
    if (this.uniforms.u_recentPickupStrength) {
      const pickupStrength = clamp01(recentPickup?.strength || 0);
      gl.uniform1f(this.uniforms.u_recentPickupStrength, pickupStrength);
    }

    const boost = fertilizerBoost || {};
    const center = boost.centerUv || null;
    const boostU = center && Number.isFinite(center.u) ? center.u : 0.5;
    const boostV = center && Number.isFinite(center.v) ? center.v : 0.5;
    const boostStrength = clamp01(boost.strength || 0);
    const boostRadius = Number.isFinite(boost.radiusNorm) ? boost.radiusNorm : 0;
    const boostColorId = Number.isFinite(boost.colorId) ? boost.colorId : 0;

    if (this.uniforms.u_fertilizerBoostCenterUv) {
      gl.uniform2f(this.uniforms.u_fertilizerBoostCenterUv, boostU, boostV);
    }
    if (this.uniforms.u_fertilizerBoostRadius) {
      gl.uniform1f(this.uniforms.u_fertilizerBoostRadius, boostRadius);
    }
    if (this.uniforms.u_fertilizerBoostStrength) {
      gl.uniform1f(this.uniforms.u_fertilizerBoostStrength, boostStrength);
    }
    if (this.uniforms.u_fertilizerBoostColorId) {
      gl.uniform1f(this.uniforms.u_fertilizerBoostColorId, boostColorId);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
