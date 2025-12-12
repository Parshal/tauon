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
const float FLOWER_SCALE = 255.0;
const float MAX_STACKS = 12.0;

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

vec3 playerColor(float v) {
  float t = clamp(v / 255.0, 0.0, 1.0);
  vec3 inner = vec3(0.10, 0.40, 0.16);
  vec3 outer = vec3(0.50, 0.90, 0.35);
  float curve = smoothstep(0.15, 0.85, t);
  return mix(inner, outer, curve);
}

vec3 flowerPalette(int flowerId) {
  if (flowerId == 1) return vec3(1.0);
  if (flowerId == 2) return vec3(0.90, 0.72, 0.20);
  if (flowerId == 3) return vec3(0.95, 0.55, 0.15);
  if (flowerId == 4) return vec3(0.85, 0.25, 0.25);
  if (flowerId == 5) return vec3(0.80, 0.25, 0.60);
  if (flowerId == 6) return vec3(0.60, 0.35, 0.90);
  if (flowerId == 7) return vec3(0.22, 0.45, 0.90);
  return vec3(0.26, 0.70, 0.90);
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

vec2 squareSize() {
  return max(u_squareMax - u_squareMin, vec2(EPSILON));
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
    vec3 flower = flowerColor(colorId, fill * FLOWER_SCALE);
    color = mix(color, flower, fillMask * 0.95);

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
    color = renderToolbeltRail(railUv, false);
  } else if (hasRight) {
    float width = max(1.0 - u_squareMax.x, EPSILON);
    float railUvY = clamp((screenUV.y - u_squareMin.y) / squareSize().y, 0.0, 1.0);
    vec2 railUv = vec2(clamp((screenUV.x - u_squareMax.x) / width, 0.0, 1.0), railUvY);
    color = renderToolbeltRail(railUv, true);
  }

  outColor = vec4(color, 1.0);
}
