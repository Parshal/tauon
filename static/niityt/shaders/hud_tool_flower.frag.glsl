#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_quadMin;
uniform vec2 u_quadMax;
uniform float u_toolFill;
uniform float u_toolStacks;
uniform float u_toolActive;
uniform float u_toolColorId;
uniform float u_recentPickupColor;
uniform float u_recentPickupStrength;

const float EPSILON = 1e-5;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 hslToRgb(float h, float s, float l) {
  float r, g, b;
  if (s <= 0.0) {
    r = g = b = l;
  } else {
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    float hk = fract(h);
    float tR = hk + 1.0 / 3.0;
    float tG = hk;
    float tB = hk - 1.0 / 3.0;

    if (tR < 0.0) tR += 1.0;
    if (tR > 1.0) tR -= 1.0;
    if (tG < 0.0) tG += 1.0;
    if (tG > 1.0) tG -= 1.0;
    if (tB < 0.0) tB += 1.0;
    if (tB > 1.0) tB -= 1.0;

    float cR;
    if (tR < 1.0 / 6.0) cR = p + (q - p) * 6.0 * tR;
    else if (tR < 1.0 / 2.0) cR = q;
    else if (tR < 2.0 / 3.0) cR = p + (q - p) * (2.0 / 3.0 - tR) * 6.0;
    else cR = p;

    float cG;
    if (tG < 1.0 / 6.0) cG = p + (q - p) * 6.0 * tG;
    else if (tG < 1.0 / 2.0) cG = q;
    else if (tG < 2.0 / 3.0) cG = p + (q - p) * (2.0 / 3.0 - tG) * 6.0;
    else cG = p;

    float cB;
    if (tB < 1.0 / 6.0) cB = p + (q - p) * 6.0 * tB;
    else if (tB < 1.0 / 2.0) cB = q;
    else if (tB < 2.0 / 3.0) cB = p + (q - p) * (2.0 / 3.0 - tB) * 6.0;
    else cB = p;

    r = cR;
    g = cG;
    b = cB;
  }
  return vec3(r, g, b);
}

vec3 flowerBaseColor(float colorId) {
  // Map the discrete flower IDs (2..7) to evenly spaced hues with uniform brightness.
  float rawIndex = floor(colorId + 0.5) - 2.0;
  float idx = clamp(rawIndex, 0.0, 5.0);
  float hue = fract(idx / 6.0);     // 6 variants around the wheel
  float sat = 1.0;
  float light = 0.42;               // slightly under "half" to keep brightness comfortable
  return hslToRgb(hue, sat, light);
}

vec3 renderFlower(vec2 localUv, float fill, float slotActive, float colorId, float recentPickupColor, float recentPickupStrength) {
  vec3 bg = vec3(0.05, 0.06, 0.09);

  vec2 p = localUv - vec2(0.5);
  float r = length(p);

  // Core color from uniform-hue HSL
  vec3 base = flowerBaseColor(colorId);

  // Large soft bloom disk
  float outer = smoothstep(0.55, 0.28, r);

  // Inner core
  float core = smoothstep(0.22, 0.0, r);

  // Use fill to thicken the bloom
  float fillFactor = clamp(fill, 0.0, 1.0);
  float bloomStrength = mix(0.4, 1.0, fillFactor);

  vec3 petals = base * (0.8 + 0.4 * fillFactor);
  vec3 coreColor = base * 1.2;

  // Subtle multi-petal modulation using angular bands
  float angle = atan(p.y, p.x);
  float petalsCount = 7.0;
  float petalShape = 0.5 + 0.5 * cos(angle * petalsCount);
  float petalMask = petalShape * outer;

  // Active glow near center
  float slotActiveNorm = clamp(slotActive, 0.0, 1.0);
  float activeGlow = slotActiveNorm * smoothstep(0.35, 0.0, r);
  vec3 activeColor = mix(vec3(0.95), base, 0.6);

  // Pickup pulse if this flower was the recent pickup
  float pickupMatch = 1.0 - step(0.5, abs(colorId - recentPickupColor));
  float pickupStrength = pickupMatch * clamp(recentPickupStrength, 0.0, 1.0);

  vec3 color = bg;
  color = mix(color, petals, petalMask * bloomStrength);
  color = mix(color, coreColor, core);
  color += activeColor * activeGlow * 0.4;
  color = mix(color, color * 1.12, pickupStrength * core);

  return color;
}

void main() {
  vec2 screenUV = vec2(v_uv.x, 1.0 - v_uv.y);

  vec2 minUv = u_quadMin;
  vec2 maxUv = u_quadMax;
  vec2 size = max(maxUv - minUv, vec2(EPSILON));

  float insideX = step(minUv.x, screenUV.x) * step(screenUV.x, maxUv.x);
  float insideY = step(minUv.y, screenUV.y) * step(screenUV.y, maxUv.y);
  if (insideX * insideY < 0.5) {
    discard;
  }

  vec2 localUv = clamp((screenUV - minUv) / size, 0.0, 1.0);

  float fill = clamp(u_toolFill, 0.0, 1.0);
  float slotActive = clamp(u_toolActive, 0.0, 1.0);

  vec3 color = renderFlower(localUv, fill, slotActive, u_toolColorId, u_recentPickupColor, u_recentPickupStrength);
  outColor = vec4(color, 1.0);
}
