#version 300 es
precision highp float;

#define HUD_ICON_LIMIT 4

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_gridSize;
uniform vec2 u_squareMin;
uniform vec2 u_squareMax;
uniform float u_toolbeltLeftFill[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftColors[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftActive[HUD_ICON_LIMIT];
uniform float u_toolbeltLeftStacks[HUD_ICON_LIMIT];
uniform float u_toolbeltRightFill[HUD_ICON_LIMIT];
uniform float u_toolbeltRightColors[HUD_ICON_LIMIT];
uniform float u_toolbeltRightActive[HUD_ICON_LIMIT];
uniform float u_toolbeltRightStacks[HUD_ICON_LIMIT];
uniform float u_fertilizerCount;
uniform float u_recentPickupColor;
uniform float u_recentPickupStrength;

const float EPSILON = 1e-5;
const float MAX_STACKS = 12.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 groundColor(vec2 uv) {
  float n = hash(floor(uv * u_gridSize * 0.5));
  vec3 earth = vec3(0.04, 0.05, 0.03);
  vec3 moss = vec3(0.07, 0.13, 0.07);
  vec3 light = vec3(0.18, 0.28, 0.12);
  vec3 base = mix(earth, moss, n);
  return mix(base, light, 0.35);
}

vec2 squareSize() {
  return max(u_squareMax - u_squareMin, vec2(EPSILON));
}

vec3 meadowSlotColor(vec2 localUv, float fill, float stacks, float slotActive, float colorId) {
  float x = clamp(localUv.x, 0.0, 1.0);
  float y = clamp(localUv.y, 0.0, 1.0);
  vec3 deep = vec3(0.02, 0.05, 0.03);
  vec3 mid = vec3(0.08, 0.22, 0.10);
  vec3 top = vec3(0.22, 0.46, 0.16);
  float g = smoothstep(0.0, 1.0, y * y);
  vec3 color = mix(deep, top, g);
  float meterH = 0.2;
  float meterMask = 1.0 - smoothstep(meterH - 0.02, meterH + 0.02, y);
  float fillEdge = clamp(fill, 0.0, 1.0);
  float meterFill = step(x, fillEdge);
  vec3 meterColor = vec3(0.18, 0.42, 0.16);
  color = mix(color, meterColor, meterMask * meterFill);
  float stackRatio = clamp(stacks / MAX_STACKS, 0.0, 1.0);
  float stackX0 = 0.8;
  float stackX1 = 0.96;
  float stackHeight = mix(meterH + 0.06, 0.95, stackRatio);
  float stackMask = step(stackX0, x) * step(x, stackX1) * step(meterH, y) * step(y, stackHeight);
  vec3 stackColor = vec3(0.32, 0.62, 0.30);
  color = mix(color, stackColor, stackMask * 0.75);
  float bands = 32.0;
  float fx = x * bands;
  float idx = floor(fx);
  float jitter = hash(vec2(idx + 3.1, colorId + 7.3));
  float lane = (idx + 0.5 + (jitter - 0.5) * 0.7) / bands;
  float dx = abs(x - lane);
  float width = mix(0.025, 0.012, jitter);
  float bladeBase = mix(0.3, 1.0, fill);
  float bladeTop = max(bladeBase * (0.5 + stackRatio * 0.7), 0.18);
  float bladeBody = smoothstep(width, 0.0, dx) * smoothstep(0.0, bladeTop, y) * (1.0 - smoothstep(bladeTop - 0.15, bladeTop + 0.02, y));
  vec3 bladeColor = mix(mid, top, smoothstep(0.0, bladeTop, y));
  bladeColor *= 1.0 + 0.4 * (jitter - 0.5);
  color = mix(color, bladeColor, bladeBody);
  float dewNoise = hash(vec2(floor(x * 36.0), floor(y * 48.0) + colorId * 11.0));
  float dew = smoothstep(0.965, 1.0, dewNoise) * smoothstep(meterH + 0.05, 0.95, y);
  vec3 dewColor = vec3(0.85, 0.96, 0.78);
  color = mix(color, dewColor, dew * (0.18 + 0.4 * fill));
  float activeGlow = slotActive * smoothstep(0.0, 0.4, 1.0 - abs(x - 0.5));
  vec3 glowColor = vec3(0.10, 0.22, 0.10);
  color += glowColor * activeGlow * 0.6;
  float pickupMatch = 1.0 - step(0.5, abs(colorId - u_recentPickupColor));
  float pickupGlow = pickupMatch * u_recentPickupStrength;
  vec3 pickupColor = vec3(0.22, 0.24, 0.08);
  color = mix(color, color * 1.12 + pickupColor, pickupGlow * 0.5);
  return color;
}

vec3 renderMeadowRail(vec2 railUv, bool isRight) {
  vec3 base = vec3(0.04, 0.05, 0.07);
  vec3 color = base;
  float slotHeight = 1.0 / float(HUD_ICON_LIMIT);
  float paddingY = slotHeight * 0.15;
  float paddingX = 0.12;
  for (int i = 0; i < HUD_ICON_LIMIT; ++i) {
    float slotY0 = float(i) * slotHeight + paddingY;
    float slotY1 = (float(i) + 1.0) * slotHeight - paddingY;
    float slotX0 = paddingX;
    float slotX1 = 1.0 - paddingX;
    float inSlot = step(slotX0, railUv.x) * step(railUv.x, slotX1) * step(slotY0, railUv.y) * step(railUv.y, slotY1);
    if (inSlot <= 0.0) {
      continue;
    }
    float fill = isRight ? clamp(u_toolbeltRightFill[i], 0.0, 1.0) : clamp(u_toolbeltLeftFill[i], 0.0, 1.0);
    float colorId = isRight ? u_toolbeltRightColors[i] : u_toolbeltLeftColors[i];
    float slotActive = isRight ? u_toolbeltRightActive[i] : u_toolbeltLeftActive[i];
    float stacks = isRight ? u_toolbeltRightStacks[i] : u_toolbeltLeftStacks[i];
    float slotW = max(slotX1 - slotX0, EPSILON);
    float slotH = max(slotY1 - slotY0, EPSILON);
    vec2 localUv = vec2(clamp((railUv.x - slotX0) / slotW, 0.0, 1.0), clamp((railUv.y - slotY0) / slotH, 0.0, 1.0));
    float isMeadow = 1.0 - step(0.5, colorId);
    vec3 slotBase = mix(vec3(0.06, 0.07, 0.10), vec3(0.10, 0.13, 0.16), float(i) * 0.22);
    vec3 slotColor = slotBase;
    if (isMeadow > 0.0) {
      vec3 meadow = meadowSlotColor(localUv, fill, stacks, slotActive, colorId);
      slotColor = mix(slotBase, meadow, isMeadow);
    } else {
      float innerFill = step(slotX0 + slotW * 0.08, railUv.x) * step(railUv.x, slotX1 - slotW * 0.24) * step(slotY0 + slotH * 0.08, railUv.y) * step(railUv.y, mix(slotY0 + slotH * 0.15, slotY1 - slotH * 0.15, fill));
      vec3 innerColor = vec3(0.12, 0.20, 0.22);
      slotColor = mix(slotColor, innerColor, innerFill);
    }
    float border = smoothstep(slotX0, slotX0 + 0.015, railUv.x) * step(slotY0, railUv.y) * step(railUv.y, slotY1);
    border += smoothstep(slotX1 - 0.015, slotX1, railUv.x) * step(slotY0, railUv.y) * step(railUv.y, slotY1);
    border += smoothstep(slotY0, slotY0 + 0.015, railUv.y) * step(slotX0, railUv.x) * step(railUv.x, slotX1);
    border += smoothstep(slotY1 - 0.015, slotY1, railUv.y) * step(slotX0, railUv.x) * step(railUv.x, slotX1);
    slotColor += border * vec3(0.05, 0.08, 0.12);
    color = mix(color, slotColor, inSlot);
  }
  float glow = 0.2 + 0.8 * smoothstep(0.0, 0.4, railUv.x) * smoothstep(1.0, 0.6, railUv.x);
  color *= vec3(1.0, 1.0, glow);
  return color;
}

void main() {
  vec2 screenUV = vec2(v_uv.x, 1.0 - v_uv.y);
  bool leftRail = screenUV.x < u_squareMin.x;
  bool rightRail = screenUV.x > u_squareMax.x;
  bool hasLeft = leftRail && u_squareMin.x > EPSILON;
  bool hasRight = rightRail && (1.0 - u_squareMax.x) > EPSILON;
  if (!hasLeft && !hasRight) {
    discard;
  }
  vec3 color = groundColor(screenUV);
  if (hasLeft) {
    float width = max(u_squareMin.x, EPSILON);
    float railUvY = clamp((screenUV.y - u_squareMin.y) / squareSize().y, 0.0, 1.0);
    vec2 railUv = vec2(clamp(screenUV.x / width, 0.0, 1.0), railUvY);
    color = renderMeadowRail(railUv, false);
  } else if (hasRight) {
    float width = max(1.0 - u_squareMax.x, EPSILON);
    float railUvY = clamp((screenUV.y - u_squareMin.y) / squareSize().y, 0.0, 1.0);
    vec2 railUv = vec2(clamp((screenUV.x - u_squareMax.x) / width, 0.0, 1.0), railUvY);
    color = renderMeadowRail(railUv, true);
  }
  outColor = vec4(color, 1.0);
}
