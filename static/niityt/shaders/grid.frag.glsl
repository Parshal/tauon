#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_grid;
uniform sampler2D u_cellColors;
uniform sampler2D u_owner;
uniform sampler2D u_reach;
uniform sampler2D u_growthField;
uniform sampler2D u_localGrowth;
uniform sampler2D u_growthAccum;
uniform vec2 u_gridSize;
uniform float u_time;
uniform float u_enableTexture;
uniform float u_bandHeight;
uniform float u_energyNorm;
uniform vec2 u_pointerUv;
uniform float u_pointerActive;
uniform float u_pointerCanPlace;
uniform vec2 u_squareMin;
uniform vec2 u_squareMax;
uniform vec2 u_fertilizerBoostCenterUv;
uniform float u_fertilizerBoostRadius;
uniform float u_fertilizerBoostStrength;
uniform float u_fertilizerBoostColorId;

const float EPSILON = 1e-5;
const float FLOWER_SCALE = 255.0;
const float MAX_STACKS = 12.0;
const int OWNER_NEUTRAL = 0;
const int OWNER_PLAYER = 1;
const int OWNER_AI = 2;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float computeWindShade(vec2 texUV, vec2 screenUv, float growthValue, float pigmentId) {
  if (growthValue < 0.02) {
    return 1.0;
  }

  // Use a very simple per-cell noise at 2x the grid resolution.
  // Each half-cell patch gets its own shade and just oscillates over time.
  vec2 noiseCell = floor(texUV * u_gridSize * 2.0 + u_time*3.0);
  float n = hash(noiseCell);

  float t = u_time * 2.8;
  float wave = sin(t + n * 6.2831853);

  float grassMask = smoothstep(0.1, 0.6, growthValue);

  // Small amplitude so it just gently darkens/brightens the patch.
  float shade = 1.0 + wave * 0.1 * grassMask;
  return shade;
}

vec3 groundColor(vec2 uv) {
  float n = hash(floor(uv * u_gridSize * 0.5)) * 0.7;
  vec3 base = vec3(0.06, 0.06, 0.05);
  vec3 soil = vec3(0.14, 0.11, 0.09);
  vec3 moss = vec3(0.10, 0.16, 0.10);
  vec3 mixed = mix(base, soil, n);
  return mix(mixed, moss, 0.45);
}

vec3 playerColor(float v) {
  float t = clamp(v / 255.0, 0.0, 1.0);
  vec3 inner = vec3(0.10, 0.40, 0.16);
  vec3 outer = vec3(0.50, 0.90, 0.35);
  float curve = smoothstep(0.15, 0.85, t);
  return mix(inner, outer, curve);
}

vec3 flowerPalette(int flowerId) {
  if (flowerId == 1) return vec3(1.0);
  if (flowerId == 2) return vec3(0.90, 0.72, 0.20); // deep yellow
  if (flowerId == 3) return vec3(0.95, 0.55, 0.15); // orange
  if (flowerId == 4) return vec3(0.85, 0.25, 0.25); // red
  if (flowerId == 5) return vec3(0.80, 0.25, 0.60); // magenta
  if (flowerId == 6) return vec3(0.60, 0.35, 0.90); // violet
  if (flowerId == 7) return vec3(0.22, 0.45, 0.90); // blue
  return vec3(0.26, 0.70, 0.90); // cyan fallback
}

vec3 flowerColor(float flowerId, float growthValue) {
  if (flowerId < 0.5) {
    return playerColor(growthValue);
  }
  if (flowerId < 1.5) {
    return flowerPalette(1);
  }
  int paletteIndex = int(floor(flowerId + 0.5));
  return flowerPalette(paletteIndex);
}

vec3 applyOwnerTint(vec3 base, int ownerId) {
  if (ownerId == OWNER_AI) {
    vec3 grey = vec3(0.28, 0.30, 0.34);
    return mix(base, grey, 0.35);
  }
  return base;
}

vec2 squareSize() {
  return max(u_squareMax - u_squareMin, vec2(EPSILON));
}

vec2 toSquareUv(vec2 screenUv) {
  vec2 size = squareSize();
  return clamp((screenUv - u_squareMin) / size, 0.0, 1.0);
}

vec2 toScreenFromSquare(vec2 sqUv) {
  return u_squareMin + sqUv * squareSize();
}

bool insideSquare(vec2 screenUv) {
  return screenUv.x >= u_squareMin.x && screenUv.x <= u_squareMax.x &&
         screenUv.y >= u_squareMin.y && screenUv.y <= u_squareMax.y;
}

vec3 renderBand(vec3 baseColor, float squareY) {
  float bandStart = max(0.0, 1.0 - u_bandHeight);
  float bandMask = smoothstep(bandStart, 1.0, squareY);
  vec3 bandColor = mix(vec3(0.15, 0.6, 0.4), vec3(0.65, 0.95, 0.6), clamp(u_energyNorm, 0.0, 1.0));
  float bandPulse = 0.6 + 0.4 * sin(u_time * 1.7);
  bandColor *= bandPulse;
  return mix(baseColor, bandColor, bandMask * 0.6);
}

vec3 renderPointer(vec3 baseColor, vec2 screenUv) {
  vec2 pointerScreen = toScreenFromSquare(vec2(u_pointerUv.x, clamp(u_pointerUv.y, 0.0, 1.0)));
  float pointerDist = distance(screenUv, pointerScreen);
  float pointerGlow = smoothstep(0.2, 0.0, pointerDist);
  vec3 validColor = vec3(0.80, 0.95, 0.35);
  vec3 invalidColor = vec3(0.85, 0.20, 0.18);
  float canPlace = clamp(u_pointerCanPlace, 0.0, 1.0);
  vec3 pointerColor = mix(invalidColor, validColor, canPlace);
  float strength = mix(0.22, 0.36, canPlace);
  return mix(baseColor, pointerColor, pointerGlow * strength);
}

vec3 renderToolbeltRail(vec2 railUv, bool isRight) {
  vec3 base = vec3(0.04, 0.05, 0.08);
  float glow = 0.2 + 0.8 * smoothstep(0.0, 0.4, railUv.x) * smoothstep(1.0, 0.6, railUv.x);
  return base * vec3(1.0, 1.0, glow);
}

vec3 renderGridRegion(vec2 screenUV) {
  vec3 color = groundColor(screenUV);

  if (u_enableTexture > 0.5) {
    vec2 texUV = toSquareUv(screenUV);
    float reachVal = texture(u_reach, texUV).r;
    float reachMask = step(0.5, reachVal);
    float texel = texture(u_grid, texUV).r;
    float flowerId = texture(u_cellColors, texUV).r * FLOWER_SCALE;
    float ownerSample = texture(u_owner, texUV).r * 255.0;
    int ownerId = int(floor(ownerSample + 0.5));
    float growthFieldVal = texture(u_growthField, texUV).r;
    float localGrowthVal = texture(u_localGrowth, texUV).r;

    vec3 growthColor = flowerColor(flowerId, texel * FLOWER_SCALE);
    growthColor = applyOwnerTint(growthColor, ownerId);
    float windShade = computeWindShade(texUV, screenUV, texel, flowerId);
    growthColor *= windShade;

    float isGrass = 1.0 - step(0.5, flowerId);
    float stage = clamp((texel - 0.08) / 0.55, 0.0, 1.0);
    float newFactor = (1.0 - stage) * isGrass;
    float matureFactor = stage * isGrass;
    vec3 newTint = vec3(0.20, 0.55, 0.25);
    vec3 matureTint = vec3(0.04, 0.18, 0.08);
    growthColor = mix(growthColor, growthColor * 1.10 + newTint, newFactor * 0.55);
    growthColor = mix(growthColor, growthColor * 0.92 + matureTint, matureFactor * 0.55);
    color = mix(color, growthColor, texel);

    float flowerPresent = step(0.5, flowerId);
    float growthMask = smoothstep(0.02, 0.2, texel);
    float flowerOnGrass = flowerPresent * growthMask;
    float flowerOnBare = flowerPresent * (1.0 - growthMask);
    vec3 flowerPreview = flowerPalette(int(floor(flowerId + 0.5)));
    color = mix(color, flowerPreview, flowerOnGrass * 0.45);
    float pickupStrength = 0.38;
    color = mix(color, flowerPreview, flowerOnBare * pickupStrength);

    float fieldNorm = clamp(growthFieldVal * 3.5, 0.0, 1.0);
    float bareMask = 1.0 - smoothstep(0.02, 0.12, texel);
    float fieldMask = bareMask * fieldNorm;
    vec3 fieldColor = vec3(0.08, 0.20, 0.10);
    color = mix(color, fieldColor, fieldMask * 0.65);

    float localNorm = clamp(localGrowthVal * 3.0, 0.0, 1.0);
    float frontierMask = smoothstep(0.15, 0.6, localNorm) * bareMask;
    vec3 frontierColor = vec3(0.10, 0.28, 0.38);
    color = mix(color, frontierColor, frontierMask * 0.4);

    if (u_pointerActive > 0.5) {
      color = renderPointer(color, screenUV);
    }

    float inReachBrightness = 1.12;
    float outReachBrightness = 0.82;
    float brightness = mix(outReachBrightness, inReachBrightness, reachMask);
    color *= brightness;

    if (u_fertilizerBoostStrength > 0.0 && u_fertilizerBoostRadius > 0.0) {
      vec2 centerUv = u_fertilizerBoostCenterUv;
      float d = distance(texUV, centerUv);
      float radius = u_fertilizerBoostRadius * 1.6;
      float radial = 1.0 - smoothstep(0.0, radius, d);

      float halo = radial * u_fertilizerBoostStrength;
      if (halo > 0.0) {
        vec3 haloColor = vec3(0.03, 0.035, 0.05);
        color = mix(color, haloColor, halo);
      }
    }
  }

  return color;
}

void main() {
  vec2 screenUV = vec2(v_uv.x, 1.0 - v_uv.y);

  vec3 color = groundColor(screenUV);
  if (insideSquare(screenUV)) {
    color = renderGridRegion(screenUV);
  }

  outColor = vec4(color, 1.0);
}
