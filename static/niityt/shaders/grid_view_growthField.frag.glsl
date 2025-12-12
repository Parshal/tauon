#version 300 es
precision highp float;

#define HUD_ICON_LIMIT 4

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
uniform float u_hudLeftValues[HUD_ICON_LIMIT];
uniform float u_hudRightValues[HUD_ICON_LIMIT];
uniform int u_hudLeftCount;
uniform int u_hudRightCount;
uniform float u_toolbeltLeftFill[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftColors[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftActive[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftStacks[HUD_ICON_LIMIT];
uniform float u_toolbeltRightFill[HUD_ICON_LIMIT];
uniform float u_toolbeltRightColors[HUD_ICON_LIMIT];
uniform float u_toolbeltRightActive[HUD_ICON_LIMIT];
uniform float u_toolbeltRightStacks[HUD_ICON_LIMIT];
uniform float u_fertilizerCount;
uniform float u_fertilizerNorm;
uniform float u_recentPickupColor;
uniform float u_recentPickupStrength;
uniform vec2 u_fertilizerBoostCenterUv;
uniform float u_fertilizerBoostRadius;
uniform float u_fertilizerBoostStrength;
uniform float u_fertilizerBoostColorId;
uniform int u_viewMode;

const float EPSILON = 1e-5;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 groundColor(vec2 uv) {
  float n = hash(floor(uv * u_gridSize * 0.5)) * 0.7;
  vec3 base = vec3(0.06, 0.06, 0.05);
  vec3 soil = vec3(0.14, 0.11, 0.09);
  vec3 moss = vec3(0.10, 0.16, 0.10);
  vec3 mixed = mix(base, soil, n);
  return mix(mixed, moss, 0.45);
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

void main() {
  vec2 screenUV = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 color = groundColor(screenUV);
  bool squareHit = insideSquare(screenUV);

  if (squareHit && u_enableTexture > 0.5) {
    vec2 texUV = toSquareUv(screenUV);
    float reachVal = texture(u_reach, texUV).r;
    float reachMask = step(0.5, reachVal);
    float growthFieldVal = texture(u_growthField, texUV).r;

    float t = clamp(growthFieldVal * 3.5, 0.0, 1.0);
    vec3 c0 = vec3(0.03, 0.05, 0.04);
    vec3 c1 = vec3(0.16, 0.85, 0.45);
    color = mix(c0, c1, t);

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

  outColor = vec4(color, 1.0);
}
