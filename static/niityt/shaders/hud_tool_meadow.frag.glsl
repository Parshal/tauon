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
const float MAX_STACKS = 12.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
  float stacks = max(u_toolStacks, 0.0);
  float slotActive = clamp(u_toolActive, 0.0, 1.0);
  float colorId = u_toolColorId;

  vec3 color = meadowSlotColor(localUv, fill, stacks, slotActive, colorId);
  outColor = vec4(color, 1.0);
}
