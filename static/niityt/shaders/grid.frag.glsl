#version 300 es
precision highp float;

#define HUD_ICON_LIMIT 4

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_grid;
uniform sampler2D u_cellColors;
uniform sampler2D u_owner;
uniform sampler2D u_reach;
uniform vec2 u_gridSize;
uniform float u_time;
uniform float u_enableTexture;
uniform float u_bandHeight;
uniform float u_energyNorm;
uniform vec2 u_pointerUv;
uniform float u_pointerActive;
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

const float EPSILON = 1e-5;
const float PIGMENT_SCALE = 255.0;
const float MAX_STACKS = 12.0;
const int OWNER_NEUTRAL = 0;
const int OWNER_PLAYER = 1;
const int OWNER_AI = 2;

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
  if (pigmentId == 1) return vec3(1.0);
  if (pigmentId == 2) return vec3(0.98, 0.42, 0.58);
  if (pigmentId == 3) return vec3(0.45, 0.78, 0.98);
  if (pigmentId == 4) return vec3(0.98, 0.74, 0.33);
  if (pigmentId == 5) return vec3(0.76, 0.46, 0.98);
  if (pigmentId == 6) return vec3(0.32, 0.9, 0.68);
  if (pigmentId == 7) return vec3(0.98, 0.38, 0.25);
  return vec3(0.35, 0.8, 0.95);
}

vec3 pigmentColor(float pigmentId, float growthValue) {
  if (pigmentId < 0.5) {
    return playerColor(growthValue);
  }
  if (pigmentId < 1.5) {
    return pigmentPalette(1);
  }
  int paletteIndex = int(floor(pigmentId + 0.5));
  return pigmentPalette(paletteIndex);
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
  vec3 pointerColor = vec3(0.95, 0.6, 0.2);
  return mix(baseColor, pointerColor, pointerGlow * 0.28);
}

float sevenSegmentMask(vec2 uv, int pattern) {
  float thickness = 0.18;
  float marginX = 0.18;
  float marginY = 0.2;
  float on = 0.0;

  float a = step(1.0 - thickness, uv.y) * step(marginX, uv.x) * step(uv.x, 1.0 - marginX);
  float d = step(uv.y, thickness) * step(marginX, uv.x) * step(uv.x, 1.0 - marginX);
  float g = step(0.5 - thickness * 0.5, uv.y) * step(uv.y, 0.5 + thickness * 0.5) * step(marginX, uv.x) * step(uv.x, 1.0 - marginX);

  float b = step(1.0 - thickness, uv.x) * step(0.5, uv.y) * step(uv.y, 1.0 - marginY);
  float c = step(1.0 - thickness, uv.x) * step(marginY, uv.y) * step(uv.y, 0.5);
  float f = step(thickness, uv.x) * step(0.5, uv.y) * step(uv.y, 1.0 - marginY);
  float e = step(thickness, uv.x) * step(marginY, uv.y) * step(uv.y, 0.5);

  if ((pattern & 1) != 0) on = max(on, a);
  if ((pattern & 2) != 0) on = max(on, b);
  if ((pattern & 4) != 0) on = max(on, c);
  if ((pattern & 8) != 0) on = max(on, d);
  if ((pattern & 16) != 0) on = max(on, e);
  if ((pattern & 32) != 0) on = max(on, f);
  if ((pattern & 64) != 0) on = max(on, g);

  return on;
}

int digitPattern(int digit) {
  if (digit == 0) return 1 + 2 + 4 + 8 + 16 + 32;
  if (digit == 1) return 2 + 4;
  if (digit == 2) return 1 + 2 + 8 + 16 + 64;
  if (digit == 3) return 1 + 2 + 4 + 8 + 64;
  if (digit == 4) return 2 + 4 + 32 + 64;
  if (digit == 5) return 1 + 4 + 8 + 32 + 64;
  if (digit == 6) return 1 + 4 + 8 + 16 + 32 + 64;
  if (digit == 7) return 1 + 2 + 4;
  if (digit == 8) return 1 + 2 + 4 + 8 + 16 + 32 + 64;
  return 1 + 2 + 4 + 8 + 32 + 64;
}

float renderDigit(vec2 uv, int digit) {
  if (digit < 0 || digit > 9) {
    return 0.0;
  }
  int pattern = digitPattern(digit);
  return sevenSegmentMask(uv, pattern);
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

    float isFertilizerTool = step(abs(colorId - 1.0), 0.1);
    if (isFertilizerTool > 0.5) {
      float slotW = max(slotX1 - slotX0, EPSILON);
      float slotH = max(slotY1 - slotY0, EPSILON);
      float localX = clamp((railUv.x - slotX0) / slotW, 0.0, 1.0);
      float localY = clamp((railUv.y - slotY0) / slotH, 0.0, 1.0);

      float labelBand = step(0.4, localY);
      if (labelBand > 0.0) {
        float py = clamp((localY - 0.4) / 0.6, 0.0, 1.0);
        float px = clamp(localX, 0.0, 1.0);

        int countVal = int(clamp(floor(u_fertilizerCount + 0.5), 0.0, 99.0));
        if (countVal > 0) {
          int tens = countVal / 10;
          int ones = countVal - tens * 10;

          float digitMask = 0.0;

          if (countVal < 10) {
            vec2 dUv = vec2(px, py);
            digitMask = renderDigit(dUv, ones);
          } else {
            float nx2 = px * 2.0;
            float sideMask = step(px, 0.5);
            if (sideMask < 0.5) {
              vec2 dUv = vec2(nx2, py);
              digitMask = renderDigit(dUv, tens);
            } else {
              vec2 dUv = vec2(nx2 - 1.0, py);
              digitMask = renderDigit(dUv, ones);
            }
          }

          float bandMask = labelBand * (1.0 - digitMask);
          vec3 bandBase = vec3(0.08, 0.09, 0.14);
          color = mix(color, bandBase, bandMask * 0.85);

          vec3 digitColor = vec3(0.98, 0.9, 0.6);
          color = mix(color, digitColor, labelBand * digitMask);
        }
      }
    }
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
    float reachVal = texture(u_reach, texUV).r;
    float reachMask = step(0.5, reachVal);
    float texel = texture(u_grid, texUV).r;
    float pigmentId = texture(u_cellColors, texUV).r * PIGMENT_SCALE;
    float ownerSample = texture(u_owner, texUV).r * 255.0;
    int ownerId = int(floor(ownerSample + 0.5));
    vec3 growthColor = pigmentColor(pigmentId, texel * PIGMENT_SCALE);
    growthColor = applyOwnerTint(growthColor, ownerId);
    color = mix(color, growthColor, texel);

    float pigmentPresent = step(0.5, pigmentId);
    float emptyMask = 1.0 - smoothstep(0.02, 0.2, texel);
    vec3 pigmentPreview = pigmentPalette(int(floor(pigmentId + 0.5)));
    color = mix(color, pigmentPreview, pigmentPresent * emptyMask * 0.45);

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

  if (!squareHit) {
    bool leftRail = screenUV.x < u_squareMin.x;
    bool rightRail = screenUV.x > u_squareMax.x;
    if (leftRail && u_squareMin.x > EPSILON) {
      float width = max(u_squareMin.x, EPSILON);
      float railUvY = clamp((screenUV.y - u_squareMin.y) / squareSize().y, 0.0, 1.0);
      vec2 railUv = vec2(clamp(screenUV.x / width, 0.0, 1.0), railUvY);
      color = renderToolbeltRail(railUv, false);
    } else if (rightRail && (1.0 - u_squareMax.x) > EPSILON) {
      float width = max(1.0 - u_squareMax.x, EPSILON);
      float railUvY = clamp((screenUV.y - u_squareMin.y) / squareSize().y, 0.0, 1.0);
      vec2 railUv = vec2(clamp((screenUV.x - u_squareMax.x) / width, 0.0, 1.0), railUvY);
      color = renderToolbeltRail(railUv, true);
    }
  }

  outColor = vec4(color, 1.0);
}
