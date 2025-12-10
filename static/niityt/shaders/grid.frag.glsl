#version 300 es
precision highp float;

#define HUD_ICON_LIMIT 4

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_grid;
uniform sampler2D u_cellColors;
uniform vec2 u_gridSize;
uniform float u_time;
uniform float u_enableTexture;
uniform float u_bandHeight;
uniform float u_energyNorm;
uniform vec2 u_pointerUv;
uniform float u_pointerActive;
uniform vec2 u_powerUpUv;
uniform float u_powerUpActive;
uniform float u_growthBoostActive;
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
uniform float u_fertilizerNorm;
uniform float u_recentPickupColor;
uniform float u_recentPickupStrength;

const float EPSILON = 1e-5;
const float PIGMENT_SCALE = 255.0;
const float MAX_STACKS = 12.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 groundColor(vec2 uv) {
  float n = hash(floor(uv * u_gridSize * 0.5)) * 0.35;
  vec3 base = vec3(0.06, 0.07, 0.09);
  vec3 dust = vec3(0.12, 0.11, 0.13);
  return mix(base, dust, n);
}

vec3 playerColor(float v) {
  float t = clamp(v / 255.0, 0.0, 1.0);
  vec3 inner = vec3(0.2, 0.7, 0.9);
  vec3 outer = vec3(0.9, 0.4, 0.2);
  return mix(inner, outer, smoothstep(0.2, 0.8, t));
}

vec3 pigmentPalette(int pigmentId) {
  if (pigmentId == 1) return vec3(0.95);
  if (pigmentId == 2) return vec3(0.98, 0.42, 0.58);
  if (pigmentId == 3) return vec3(0.45, 0.78, 0.98);
  if (pigmentId == 4) return vec3(0.98, 0.74, 0.33);
  if (pigmentId == 5) return vec3(0.76, 0.46, 0.98);
  if (pigmentId == 6) return vec3(0.32, 0.9, 0.68);
  if (pigmentId == 7) return vec3(0.98, 0.38, 0.25);
  return vec3(0.35, 0.8, 0.95);
}

vec3 pigmentColor(float pigmentId, float growthValue) {
  if (pigmentId < 1.5) {
    return playerColor(growthValue);
  }
  int paletteIndex = int(floor(pigmentId + 0.5));
  return pigmentPalette(paletteIndex);
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
  float boostPulse = 0.6 + 0.4 * sin(u_time * 3.1);
  float bandPulse = 0.6 + 0.4 * sin(u_time * 1.7);
  bandColor *= mix(bandPulse, boostPulse, clamp(u_growthBoostActive, 0.0, 1.0));
  return mix(baseColor, bandColor, bandMask * 0.6);
}

vec3 renderPointer(vec3 baseColor, vec2 screenUv) {
  vec2 pointerScreen = toScreenFromSquare(vec2(u_pointerUv.x, clamp(u_pointerUv.y, 0.0, 1.0)));
  float pointerDist = distance(screenUv, pointerScreen);
  float pointerGlow = smoothstep(0.2, 0.0, pointerDist);
  vec3 pointerColor = vec3(0.95, 0.6, 0.2);
  return mix(baseColor, pointerColor, pointerGlow * 0.8);
}

vec3 renderPowerUp(vec3 baseColor, vec2 screenUv) {
  vec2 powerScreen = toScreenFromSquare(vec2(u_powerUpUv.x, clamp(u_powerUpUv.y, 0.0, 1.0)));
  float spark = smoothstep(0.05, 0.0, distance(screenUv, powerScreen));
  vec3 powerColor = vec3(1.0);
  float pulse = 0.7 + 0.3 * sin(u_time * 5.0);
  return mix(baseColor, powerColor, spark * pulse);
}

vec3 renderToolbeltRail(vec2 railUv, bool isRight) {
  vec3 base = vec3(0.04, 0.05, 0.08);
  vec3 color = base;
  float slotHeight = 1.0 / float(HUD_ICON_LIMIT);
  float paddingY = slotHeight * 0.15;
  float paddingX = 0.12;

  for (int i = 0; i < HUD_ICON_LIMIT; ++i) {
    float slotY0 = float(i) * slotHeight + paddingY;
    float slotY1 = (float(i) + 1.0) * slotHeight - paddingY;
    float slotX0 = paddingX;
    float slotX1 = 1.0 - paddingX;

    float inSlot = step(slotX0, railUv.x) * step(railUv.x, slotX1) *
                   step(slotY0, railUv.y) * step(railUv.y, slotY1);
    if (inSlot <= 0.0) {
      continue;
    }

    float fill = isRight ? clamp(u_toolbeltRightFill[i], 0.0, 1.0) : clamp(u_toolbeltLeftFill[i], 0.0, 1.0);
    float colorId = isRight ? u_toolbeltRightColors[i] : u_toolbeltLeftColors[i];
    float slotActive = isRight ? u_toolbeltRightActive[i] : u_toolbeltLeftActive[i];
    float stacks = isRight ? u_toolbeltRightStacks[i] : u_toolbeltLeftStacks[i];

    vec3 slotBase = mix(vec3(0.08, 0.09, 0.14), vec3(0.16, 0.18, 0.28), float(i) * 0.18);
    color = mix(color, slotBase, inSlot);

    float fillEdge = mix(slotX0 + 0.015, slotX1 - 0.015, fill);
    float fillMask = inSlot * step(slotX0 + 0.01, railUv.x) * step(railUv.x, fillEdge);
    vec3 pigment = pigmentColor(colorId, fill * PIGMENT_SCALE);
    color = mix(color, pigment, fillMask * 0.95);

    float stackRatio = clamp(stacks / MAX_STACKS, 0.0, 1.0);
    float stackY = mix(slotY0 + 0.01, slotY1 - 0.01, stackRatio);
    float stackMask = inSlot * step(slotX1 - 0.055, railUv.x) * step(railUv.x, slotX1 - 0.01) *
                      step(slotY0 + 0.01, railUv.y) * step(railUv.y, stackY);
    color = mix(color, vec3(0.95), stackMask * 0.6);

    float border = smoothstep(slotX0, slotX0 + 0.015, railUv.x) * step(slotY0, railUv.y) * step(railUv.y, slotY1);
    border += smoothstep(slotX1 - 0.015, slotX1, railUv.x) * step(slotY0, railUv.y) * step(railUv.y, slotY1);
    color += border * vec3(0.05, 0.07, 0.12);

    float activeGlow = slotActive * smoothstep(0.0, 0.4, 1.0 - abs(railUv.x - mix(slotX0, slotX1, 0.5)));
    color += activeGlow * vec3(0.08, 0.1, 0.16);

    float hasColor = step(0.5, colorId);
    float pickupMatch = hasColor * smoothstep(0.0, 0.2, 1.0 - abs(colorId - u_recentPickupColor));
    float pickupGlow = pickupMatch * u_recentPickupStrength * (fill + slotActive);
    color += pickupGlow * vec3(0.2, 0.16, 0.05);
  }

  if (!isRight) {
    float fertX0 = 0.02;
    float fertX1 = 0.08;
    float fertY0 = 0.1;
    float fertY1 = 0.9;
    float fertMask = step(fertX0, railUv.x) * step(railUv.x, fertX1) * step(fertY0, railUv.y) * step(fertY1, railUv.y);
    float fertFillY = mix(fertY0, fertY1, clamp(u_fertilizerNorm, 0.0, 1.0));
    float fertFillMask = fertMask * step(railUv.y, fertFillY);
    vec3 fertColor = pigmentPalette(1);
    color = mix(color, fertColor, fertFillMask * 0.85);
  }

  float glow = 0.2 + 0.8 * smoothstep(0.0, 0.4, railUv.x) * smoothstep(1.0, 0.6, railUv.x);
  color *= vec3(1.0, 1.0, glow);
  return color;
}

void main() {
  vec2 screenUV = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 color = groundColor(screenUV);
  bool squareHit = insideSquare(screenUV);

  if (squareHit && u_enableTexture > 0.5) {
    vec2 texUV = toSquareUv(screenUV);
    float texel = texture(u_grid, texUV).r;
    float pigmentId = texture(u_cellColors, texUV).r * PIGMENT_SCALE;
    vec3 growthColor = pigmentColor(pigmentId, texel * PIGMENT_SCALE);
    color = mix(color, growthColor, texel);
    color = renderBand(color, texUV.y);

    if (u_pointerActive > 0.5) {
      color = renderPointer(color, screenUV);
    }
    if (u_powerUpActive > 0.5) {
      color = renderPowerUp(color, screenUV);
    }
  }

  if (!squareHit) {
    bool leftRail = screenUV.x < u_squareMin.x;
    bool rightRail = screenUV.x > u_squareMax.x;
    if (leftRail && u_squareMin.x > EPSILON) {
      float width = max(u_squareMin.x, EPSILON);
      vec2 railUv = vec2(clamp(screenUV.x / width, 0.0, 1.0), clamp((screenUV.y - u_squareMin.y) / squareSize().y + 0.5, 0.0, 1.0));
      color = renderToolbeltRail(railUv, false);
    } else if (rightRail && (1.0 - u_squareMax.x) > EPSILON) {
      float width = max(1.0 - u_squareMax.x, EPSILON);
      vec2 railUv = vec2(clamp((screenUV.x - u_squareMax.x) / width, 0.0, 1.0), clamp((screenUV.y - u_squareMin.y) / squareSize().y + 0.5, 0.0, 1.0));
      color = renderToolbeltRail(railUv, true);
    }
  }

  outColor = vec4(color, 1.0);
}
