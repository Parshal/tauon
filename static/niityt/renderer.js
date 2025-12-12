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
    this.hudProgram = null;
    this.gridPrograms = {};
    this.gridUniforms = {};
    this.toolPrograms = {};
    this.vao = null;
    this.gridTexture = null;
    this.cellColorTexture = null;
    this.reachTexture = null;
    this.ownerTexture = null;
    this.growthTexture = null;
    this.localGrowthTexture = null;
    this.growthAccumTexture = null;
    this.gridWidth = 0;
    this.gridHeight = 0;
    this.cellColorWidth = 0;
    this.cellColorHeight = 0;
    this.gridTextureReady = false;
    this.cellTextureReady = false;
    this.uniforms = {};
    this.hudUniforms = {};
    this.toolUniforms = {};
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
    const gridFragmentURL = new URL('./shaders/grid.frag.glsl', import.meta.url);
    const gridGrowthURL = new URL('./shaders/grid_view_growthField.frag.glsl', import.meta.url);
    const gridLocalURL = new URL('./shaders/grid_view_localGrowth.frag.glsl', import.meta.url);
    const gridAccumURL = new URL('./shaders/grid_view_accum.frag.glsl', import.meta.url);
    const hudFragmentURL = new URL('./shaders/hud_meadow.frag.glsl', import.meta.url);
    const meadowToolURL = new URL('./shaders/hud_tool_meadow.frag.glsl', import.meta.url);
    const fertilizerToolURL = new URL('./shaders/hud_tool_fertilizer.frag.glsl', import.meta.url);
    const flower2URL = new URL('./shaders/hud_tool_flower_2.frag.glsl', import.meta.url);
    const flower3URL = new URL('./shaders/hud_tool_flower_3.frag.glsl', import.meta.url);
    const flower4URL = new URL('./shaders/hud_tool_flower_4.frag.glsl', import.meta.url);
    const flower5URL = new URL('./shaders/hud_tool_flower_5.frag.glsl', import.meta.url);
    const flower6URL = new URL('./shaders/hud_tool_flower_6.frag.glsl', import.meta.url);
    const flower7URL = new URL('./shaders/hud_tool_flower_7.frag.glsl', import.meta.url);
    const [vertexSrc, gridFragmentSrc, gridGrowthSrc, gridLocalSrc, gridAccumSrc, hudFragmentSrc, meadowToolSrc, fertilizerToolSrc, flower2Src, flower3Src, flower4Src, flower5Src, flower6Src, flower7Src] = await Promise.all([
      loadText(vertexURL),
      loadText(gridFragmentURL),
      loadText(gridGrowthURL),
      loadText(gridLocalURL),
      loadText(gridAccumURL),
      loadText(hudFragmentURL),
      loadText(meadowToolURL),
      loadText(fertilizerToolURL),
      loadText(flower2URL),
      loadText(flower3URL),
      loadText(flower4URL),
      loadText(flower5URL),
      loadText(flower6URL),
      loadText(flower7URL)
    ]);

    this.gridPrograms = {
      0: createProgram(gl, vertexSrc, gridFragmentSrc),
      1: createProgram(gl, vertexSrc, gridGrowthSrc),
      2: createProgram(gl, vertexSrc, gridLocalSrc),
      3: createProgram(gl, vertexSrc, gridAccumSrc)
    };
    this.program = this.gridPrograms[0];
    this.hudProgram = createProgram(gl, vertexSrc, hudFragmentSrc);
    this.toolPrograms = this.toolPrograms || {};
    this.toolPrograms.meadow = createProgram(gl, vertexSrc, meadowToolSrc);
    this.toolPrograms.fertilizer = createProgram(gl, vertexSrc, fertilizerToolSrc);
    this.toolPrograms.flower2 = createProgram(gl, vertexSrc, flower2Src);
    this.toolPrograms.flower3 = createProgram(gl, vertexSrc, flower3Src);
    this.toolPrograms.flower4 = createProgram(gl, vertexSrc, flower4Src);
    this.toolPrograms.flower5 = createProgram(gl, vertexSrc, flower5Src);
    this.toolPrograms.flower6 = createProgram(gl, vertexSrc, flower6Src);
    this.toolPrograms.flower7 = createProgram(gl, vertexSrc, flower7Src);
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
      'u_owner',
      'u_reach',
      'u_growthField',
      'u_localGrowth',
      'u_growthAccum',
      'u_bandHeight',
      'u_energyNorm',
      'u_pointerUv',
      'u_pointerActive',
      'u_pointerCanPlace',
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
    const gridPrograms = this.gridPrograms || {};
    this.gridUniforms = {};
    [0, 1, 2, 3].forEach((mode) => {
      const program = gridPrograms[mode];
      if (!program) return;
      this.gridUniforms[mode] = names.reduce((map, name) => {
        map[name] = gl.getUniformLocation(program, name);
        return map;
      }, {});
    });

    this.uniforms = this.gridUniforms[0] || {};
    this.hudUniforms = names.reduce((map, name) => {
      map[name] = this.hudProgram ? gl.getUniformLocation(this.hudProgram, name) : null;
      return map;
    }, {});

    const toolPrograms = this.toolPrograms || {};
    this.toolUniforms = {};
    if (toolPrograms.meadow) {
      this.toolUniforms.meadow = {
        u_quadMin: gl.getUniformLocation(toolPrograms.meadow, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.meadow, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.meadow, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.meadow, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.meadow, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.meadow, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.meadow, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.meadow, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.fertilizer) {
      this.toolUniforms.fertilizer = {
        u_quadMin: gl.getUniformLocation(toolPrograms.fertilizer, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.fertilizer, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.fertilizer, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.fertilizer, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.fertilizer, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.fertilizer, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.fertilizer, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.fertilizer, 'u_recentPickupStrength'),
        u_fertilizerCount: gl.getUniformLocation(toolPrograms.fertilizer, 'u_fertilizerCount'),
        u_fertilizerNorm: gl.getUniformLocation(toolPrograms.fertilizer, 'u_fertilizerNorm')
      };
    }
    if (toolPrograms.flower2) {
      this.toolUniforms.flower2 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower2, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower2, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower2, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower2, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower2, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower2, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower2, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower2, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.flower3) {
      this.toolUniforms.flower3 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower3, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower3, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower3, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower3, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower3, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower3, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower3, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower3, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.flower4) {
      this.toolUniforms.flower4 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower4, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower4, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower4, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower4, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower4, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower4, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower4, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower4, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.flower5) {
      this.toolUniforms.flower5 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower5, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower5, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower5, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower5, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower5, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower5, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower5, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower5, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.flower6) {
      this.toolUniforms.flower6 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower6, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower6, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower6, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower6, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower6, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower6, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower6, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower6, 'u_recentPickupStrength')
      };
    }
    if (toolPrograms.flower7) {
      this.toolUniforms.flower7 = {
        u_quadMin: gl.getUniformLocation(toolPrograms.flower7, 'u_quadMin'),
        u_quadMax: gl.getUniformLocation(toolPrograms.flower7, 'u_quadMax'),
        u_toolFill: gl.getUniformLocation(toolPrograms.flower7, 'u_toolFill'),
        u_toolStacks: gl.getUniformLocation(toolPrograms.flower7, 'u_toolStacks'),
        u_toolActive: gl.getUniformLocation(toolPrograms.flower7, 'u_toolActive'),
        u_toolColorId: gl.getUniformLocation(toolPrograms.flower7, 'u_toolColorId'),
        u_recentPickupColor: gl.getUniformLocation(toolPrograms.flower7, 'u_recentPickupColor'),
        u_recentPickupStrength: gl.getUniformLocation(toolPrograms.flower7, 'u_recentPickupStrength')
      };
    }
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

    this.growthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.growthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.localGrowthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.localGrowthTexture);
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

    this.ownerTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.ownerTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.growthAccumTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.growthAccumTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  uploadGrowthAccum(growthAccum, width, height) {
    const gl = this.gl;
    if (!gl || !growthAccum) return;
    gl.bindTexture(gl.TEXTURE_2D, this.growthAccumTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      growthAccum
    );
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

  uploadOwner(ownerMask, width, height) {
    const gl = this.gl;
    if (!gl || !ownerMask) return;
    gl.bindTexture(gl.TEXTURE_2D, this.ownerTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      ownerMask
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  uploadLocalGrowth(localGrowth, width, height) {
    const gl = this.gl;
    if (!gl || !localGrowth) return;
    gl.bindTexture(gl.TEXTURE_2D, this.localGrowthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      localGrowth
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  uploadGrowthField(growthField, width, height) {
    const gl = this.gl;
    if (!gl || !growthField) return;
    gl.bindTexture(gl.TEXTURE_2D, this.growthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      growthField
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
      pointerCanPlace,
      bandHeightNorm,
      energyNorm,
      hudLeftIcons,
      hudRightIcons,
      toolbeltLeft,
      toolbeltRight,
      activeSlotIndex,
      fertilizerNorm,
      fertilizerCount,
      recentPickup,
      reachMask,
      ownerMask,
      fertilizerBoost,
      growthField,
      localGrowth,
      growthAccum,
      viewMode
    } = payload;

    const layout = this.layout || computeSquareLayout(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);

    const rawViewMode = Number.isFinite(viewMode) ? Math.floor(viewMode) : 0;
    const modeIndex = rawViewMode >= 1 && rawViewMode <= 3 ? rawViewMode : 0;
    const gridPrograms = this.gridPrograms || null;
    const gridProgram = gridPrograms && gridPrograms[modeIndex]
      ? gridPrograms[modeIndex]
      : (gridPrograms ? gridPrograms[0] : null);
    if (!gridProgram) return;

    const gridUniforms = this.gridUniforms || null;
    const uniforms = gridUniforms && gridUniforms[modeIndex]
      ? gridUniforms[modeIndex]
      : (gridUniforms ? gridUniforms[0] : {});
    this.program = gridProgram;
    this.uniforms = uniforms;

    if (grid) {
      this.uploadGrid(grid, width, height);
    }
    if (cellColors) {
      this.uploadCellColors(cellColors, width, height);
    }
    if (reachMask) {
      this.uploadReach(reachMask, width, height);
    }
    if (ownerMask) {
      this.uploadOwner(ownerMask, width, height);
    }
    if (growthField) {
      this.uploadGrowthField(growthField, width, height);
    }
    if (localGrowth) {
      this.uploadLocalGrowth(localGrowth, width, height);
    }
    if (growthAccum) {
      this.uploadGrowthAccum(growthAccum, width, height);
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

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.ownerTexture);
    if (this.uniforms.u_owner) {
      gl.uniform1i(this.uniforms.u_owner, 3);
    }
    gl.activeTexture(gl.TEXTURE0);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.growthTexture);
    if (this.uniforms.u_growthField) {
      gl.uniform1i(this.uniforms.u_growthField, 4);
    }
    gl.activeTexture(gl.TEXTURE0);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.localGrowthTexture);
    if (this.uniforms.u_localGrowth) {
      gl.uniform1i(this.uniforms.u_localGrowth, 5);
    }
    gl.activeTexture(gl.TEXTURE0);

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.growthAccumTexture);
    if (this.uniforms.u_growthAccum) {
      gl.uniform1i(this.uniforms.u_growthAccum, 6);
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

    if (this.uniforms.u_pointerCanPlace) {
      const canPlace = pointerCanPlace ? 1.0 : 0.0;
      gl.uniform1f(this.uniforms.u_pointerCanPlace, canPlace);
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

    this.renderHudPass(
      layout,
      toolbeltLeft,
      toolbeltRight,
      fertilizerCount,
      recentPickup,
      width,
      height
    );

    this.renderToolPasses(
      layout,
      toolbeltLeft,
      toolbeltRight,
      activeSlotIndex,
      recentPickup,
      fertilizerCount,
      fertilizerNorm
    );

    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  renderToolPasses(layout, toolbeltLeft, toolbeltRight, activeSlotIndex, recentPickup, fertilizerCount, fertilizerNorm) {
    const gl = this.gl;
    if (!gl) return;

    const programs = this.toolPrograms || {};
    const uniformsByKind = this.toolUniforms || {};
    if (!programs.meadow &&
        !programs.fertilizer &&
        !programs.flower2 &&
        !programs.flower3 &&
        !programs.flower4 &&
        !programs.flower5 &&
        !programs.flower6 &&
        !programs.flower7) {
      return;
    }

    if (!Number.isFinite(activeSlotIndex)) {
      return;
    }

    const sideSlots = TOOLBELT_SLOTS_PER_SIDE;
    const totalSlots = sideSlots * 2;
    const clampedIndex = Math.max(0, Math.min(activeSlotIndex, totalSlots - 1));
    const isRight = clampedIndex >= sideSlots;
    const slotIndex = isRight ? clampedIndex - sideSlots : clampedIndex;

    const fallback = this.toolbeltFallback;
    const source = isRight ? (toolbeltRight || {}) : (toolbeltLeft || {});

    const fillArr = source.fill instanceof Float32Array ? source.fill : fallback.fill;
    const colorsArr = source.colors instanceof Float32Array ? source.colors : fallback.colors;
    const activeArr = source.active instanceof Float32Array ? source.active : fallback.active;
    const stacksArr = source.stacks instanceof Float32Array ? source.stacks : fallback.stacks;

    if (slotIndex < 0 || slotIndex >= fillArr.length) {
      return;
    }

    const fill = fillArr[slotIndex];
    const colorId = colorsArr[slotIndex];
    const slotActive = activeArr[slotIndex];
    const stacks = stacksArr[slotIndex];

    const kind = this.getToolKindFromColorId(colorId);
    if (!kind) {
      return;
    }

    const program = programs[kind];
    const u = uniformsByKind[kind] || {};
    if (!program) {
      return;
    }

    const rect = this.computeToolSlotRect(layout, isRight, slotIndex);
    const minX = rect.minX;
    const minY = rect.minY;
    const maxX = rect.maxX;
    const maxY = rect.maxY;

    gl.useProgram(program);

    if (u.u_quadMin) {
      gl.uniform2f(u.u_quadMin, minX, minY);
    }
    if (u.u_quadMax) {
      gl.uniform2f(u.u_quadMax, maxX, maxY);
    }
    if (u.u_toolFill) {
      gl.uniform1f(u.u_toolFill, fill);
    }
    if (u.u_toolStacks) {
      gl.uniform1f(u.u_toolStacks, stacks);
    }
    if (u.u_toolActive) {
      gl.uniform1f(u.u_toolActive, slotActive);
    }
    if (u.u_toolColorId) {
      gl.uniform1f(u.u_toolColorId, colorId);
    }

    const pickupColor = recentPickup && Number.isFinite(recentPickup.colorId) ? recentPickup.colorId : 0;
    const pickupStrength = recentPickup && Number.isFinite(recentPickup.strength)
      ? clamp01(recentPickup.strength)
      : 0;

    if (u.u_recentPickupColor) {
      gl.uniform1f(u.u_recentPickupColor, pickupColor);
    }
    if (u.u_recentPickupStrength) {
      gl.uniform1f(u.u_recentPickupStrength, pickupStrength);
    }

    if (kind === 'fertilizer') {
      const fertCount = Number.isFinite(fertilizerCount) ? fertilizerCount : 0;
      const fertNorm = Number.isFinite(fertilizerNorm) ? clamp01(fertilizerNorm) : 0;
      if (u.u_fertilizerCount) {
        gl.uniform1f(u.u_fertilizerCount, fertCount);
      }
      if (u.u_fertilizerNorm) {
        gl.uniform1f(u.u_fertilizerNorm, fertNorm);
      }
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  computeToolSlotRect(layout, isRight, slotIndex) {
    const index = Math.max(0, Math.min(slotIndex, TOOLBELT_SLOTS_PER_SIDE - 1));

    const playMinX = layout.playMinX;
    const playMaxX = layout.playMaxX;
    const playMinY = layout.playMinY;
    const playMaxY = layout.playMaxY;

    const railMinX = isRight ? playMaxX : 0;
    const railMaxX = isRight ? 1 : playMinX;
    const railWidth = Math.max(1e-6, railMaxX - railMinX);

    const railMinY = playMinY;
    const railMaxY = playMaxY;
    const totalHeight = Math.max(1e-6, railMaxY - railMinY);
    const slotHeight = totalHeight / HUD_ICON_LIMIT;
    const paddingY = slotHeight * 0.15;
    const paddingX = 0.12;

    const slotY0 = railMinY + slotHeight * index + paddingY;
    const slotY1 = railMinY + slotHeight * (index + 1) - paddingY;
    const slotX0 = railMinX + railWidth * paddingX;
    const slotX1 = railMaxX - railWidth * paddingX;

    return {
      minX: slotX0,
      minY: slotY0,
      maxX: slotX1,
      maxY: slotY1
    };
  }

  getToolKindFromColorId(colorId) {
    if (!Number.isFinite(colorId)) {
      return null;
    }
    if (Math.abs(colorId - 1.0) < 0.25) {
      return 'fertilizer';
    }
    if (colorId < 0.5) {
      return 'meadow';
    }
    const rounded = Math.floor(colorId + 0.5);
    if (rounded === 2) return 'flower2';
    if (rounded === 3) return 'flower3';
    if (rounded === 4) return 'flower4';
    if (rounded === 5) return 'flower5';
    if (rounded === 6) return 'flower6';
    if (rounded === 7) return 'flower7';
    return null;
  }

  renderHudPass(layout, toolbeltLeft, toolbeltRight, fertilizerCount, recentPickup, width, height) {
    const gl = this.gl;
    if (!gl || !this.hudProgram) return;

    gl.useProgram(this.hudProgram);
    const u = this.hudUniforms || {};

    if (u.u_gridSize) {
      gl.uniform2f(u.u_gridSize, width, height);
    }
    if (u.u_squareMin) {
      gl.uniform2f(u.u_squareMin, layout.playMinX, layout.playMinY);
    }
    if (u.u_squareMax) {
      gl.uniform2f(u.u_squareMax, layout.playMaxX, layout.playMaxY);
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

    if (u.u_toolbeltLeftFill) {
      gl.uniform1fv(u.u_toolbeltLeftFill, leftFill);
    }
    if (u.u_toolbeltLeftColors) {
      gl.uniform1fv(u.u_toolbeltLeftColors, leftColors);
    }
    if (u.u_toolbeltLeftActive) {
      gl.uniform1fv(u.u_toolbeltLeftActive, leftActive);
    }
    if (u.u_toolbeltLeftStacks) {
      gl.uniform1fv(u.u_toolbeltLeftStacks, leftStacks);
    }

    if (u.u_toolbeltRightFill) {
      gl.uniform1fv(u.u_toolbeltRightFill, rightFill);
    }
    if (u.u_toolbeltRightColors) {
      gl.uniform1fv(u.u_toolbeltRightColors, rightColors);
    }
    if (u.u_toolbeltRightActive) {
      gl.uniform1fv(u.u_toolbeltRightActive, rightActive);
    }
    if (u.u_toolbeltRightStacks) {
      gl.uniform1fv(u.u_toolbeltRightStacks, rightStacks);
    }

    if (u.u_fertilizerCount) {
      const fertCount = Number.isFinite(fertilizerCount) ? fertilizerCount : 0;
      gl.uniform1f(u.u_fertilizerCount, fertCount);
    }

    if (u.u_recentPickupColor) {
      const pickupColor = recentPickup?.colorId || 0;
      gl.uniform1f(u.u_recentPickupColor, pickupColor);
    }
    if (u.u_recentPickupStrength) {
      const pickupStrength = clamp01(recentPickup?.strength || 0);
      gl.uniform1f(u.u_recentPickupStrength, pickupStrength);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
