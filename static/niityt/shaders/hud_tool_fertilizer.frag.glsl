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
uniform float u_fertilizerCount;
uniform float u_fertilizerNorm;

const float EPSILON = 1e-5;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 applyFertilizerMound(vec2 localUv, float amountNorm, float slotActive, float pickupStrength) {
  float x = clamp(localUv.x, 0.0, 1.0);
  float y = clamp(localUv.y, 0.0, 1.0);

  // Base soil / tray color
  vec3 soilDark = vec3(0.07, 0.06, 0.05);
  vec3 soilMid = vec3(0.12, 0.10, 0.08);
  vec3 soil = mix(soilDark, soilMid, 0.4 + 0.3 * amountNorm);

  // Mound ellipse parameters based on amount
  float h = mix(0.25, 0.9, sqrt(amountNorm));
  float w = mix(0.7, 1.1, 0.3 + 0.4 * amountNorm);
  vec2 center = vec2(0.5, 0.1 + h * 0.55);

  vec2 p = vec2((x - center.x) / (0.5 * w), (y - center.y) / max(h, EPSILON));
  float r2 = dot(p, p);
  float mound = smoothstep(1.2, 0.7, r2);

  // Sandy fertilizer palette
  vec3 sandDark = vec3(0.24, 0.19, 0.11);
  vec3 sandMid  = vec3(0.34, 0.27, 0.15);
  vec3 sandLite = vec3(0.48, 0.39, 0.23);

  // Grainy pattern: coarse cells
  vec2 grainCell = floor(localUv * vec2(40.0, 30.0));
  float n = hash(grainCell);
  float grainBand = smoothstep(0.15, 0.85, n);
  vec3 sand = mix(sandDark, sandMid, grainBand);
  sand = mix(sand, sandLite, amountNorm * 0.35);

  // Denser speckles with more fertilizer
  float speckNoise = hash(grainCell + vec2(19.7, 7.3));
  float specks = smoothstep(0.82, 1.0, speckNoise) * (0.2 + 0.6 * amountNorm);
  vec3 speckColor = vec3(0.60, 0.52, 0.32);
  sand = mix(sand, speckColor, specks * 0.35);

  // Ridge highlight near the mound crest
  float crestY = center.y + h * 0.35;
  float crest = mound * smoothstep(crestY - 0.02, crestY + 0.02, y);
  crest *= (0.4 + 0.6 * amountNorm);
  vec3 crestColor = vec3(0.88, 0.82, 0.60);

  // Subtle nutrient "heat" shimmer above when rich
  float vapourRegion = smoothstep(center.y + h * 0.3, center.y + h * 0.9, y);
  float vapourNoise = hash(localUv * vec2(60.0, 80.0) + vec2(3.1, 9.7));
  float vapour = vapourRegion * smoothstep(0.88, 1.0, vapourNoise) * amountNorm;
  vec3 vapourColor = vec3(0.55, 0.58, 0.40);

  // Active slot glow: warm ring around mound
  float activeGlowBase = smoothstep(0.0, 0.5, 1.0 - abs(x - 0.5));
  float activeGlow = slotActive * activeGlowBase * (0.35 + 0.4 * amountNorm);
  vec3 activeColor = vec3(0.85, 0.70, 0.32);

  // Recent-pickup pulse darkens edges and warms the core a bit
  float pickup = clamp(pickupStrength, 0.0, 1.0);
  float edge = mound * smoothstep(0.7, 1.05, r2);
  vec3 pickupEdge = vec3(0.18, 0.14, 0.10);

  vec3 color = soil;
  color = mix(color, sand, mound);
  color = mix(color, crestColor, crest);
  color = mix(color, vapourColor, vapour * 0.6);
  color = mix(color, activeColor, activeGlow);
  color = mix(color, pickupEdge, pickup * edge * 0.6);

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

  float amountNorm = clamp(u_fertilizerNorm, 0.0, 1.0);
  float slotActive = clamp(u_toolActive, 0.0, 1.0);

  // Only pulse on pickup when the recent pickup color matches fertilizer (~1.0)
  float pickupMatch = 1.0 - step(0.5, abs(u_toolColorId - u_recentPickupColor));
  float pickupStrength = pickupMatch * clamp(u_recentPickupStrength, 0.0, 1.0);

  vec3 color = applyFertilizerMound(localUv, amountNorm, slotActive, pickupStrength);
  outColor = vec4(color, 1.0);
}
