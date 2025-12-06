#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_zoom;

// Reuse existing star uniforms for tiny minimal control
uniform float u_starDensity;
uniform float u_starTwinkle;
uniform float u_starZoom;

uniform float u_seamDebugEnabled;

const float STAR_LATTICE = 256.0;

// Simple 2D hash
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec2 wrapCell(vec2 cell) {
    return mod(mod(cell, STAR_LATTICE) + STAR_LATTICE, STAR_LATTICE);
}

vec2 wrapDelta(vec2 delta) {
    return delta - STAR_LATTICE * round(delta / STAR_LATTICE);
}

// Tiny helper: antialiased disc falloff
float aaDisc(vec2 p, float radiusPx) {
    float d = length(p);
    float minDim = max(min(u_res.x, u_res.y), 1.0);
    float worldPerPixel = (u_starZoom * STAR_LATTICE) / minDim;
    float pixelRadius = max(radiusPx, 0.0001) * worldPerPixel;
    float feather = worldPerPixel;
    float edge0 = pixelRadius - feather;
    float edge1 = pixelRadius + feather;
    return smoothstep(edge1, edge0, d);
}

vec3 sampleStars(vec2 worldPos, vec2 starCell, float densityNorm, float twinkle) {
    vec3 starAccum = vec3(0.0);

    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            vec2 neighborCell = starCell + vec2(float(dx), float(dy));
            vec2 wrappedCell = wrapCell(neighborCell);
            float h = hash21(wrappedCell + 37.0);
            if (h > densityNorm) continue;

            // Star radius in pixels (0.5–1.5px)
            float radiusSeed = fract(h * 17.23);
            float radiusPx = mix(0.5, 1.5, radiusSeed);

            // Stable per-cell 2D offset inside [0,1) so stars can sit on borders
            float ox = fract(h * 53.17);
            float oy = fract(h * 91.73);
            vec2 starOffset = vec2(ox, oy);

            vec2 starCenter = wrappedCell + starOffset;
            vec2 starLocal = wrapDelta(worldPos - starCenter);
            float falloff = aaDisc(starLocal, radiusPx);

            float twPhase = h * 62.8 + u_time * (0.5 + 1.5 * fract(h * 9.13));
            float twVal = mix(1.0, 0.5 + 0.5 * sin(twPhase), twinkle);

            vec3 starColor = vec3(1.0, 1.0, 1.6);
            starAccum += starColor * falloff * twVal;
        }
    }

    return starAccum;
}

void main() {
    // Screen-space UV with aspect, centered, zoomed a bit like old shaders
    float maxDim = max(max(u_res.x, u_res.y), 1.0);
    vec2 aspect = vec2(u_res.x, u_res.y) / maxDim;
    vec2 uv = (v_uv - 0.5) * aspect;
    float zoomAtten = u_starZoom;
    uv *= zoomAtten;

    float densityNorm = clamp(u_starDensity / 200.0, 0.0, 1.0);
    float twinkle = clamp(u_starTwinkle, 0.0, 1.0);

    vec2 starUv = uv / aspect + 0.5;
    vec2 starScaled = starUv * STAR_LATTICE;
    vec2 worldPos = wrapCell(starScaled);
    vec2 starCell = floor(worldPos);
    vec3 starAccum = sampleStars(worldPos, starCell, densityNorm, twinkle);

    // Optional checker just to visualize STAR_LATTICE cells
    vec3 color = vec3(0.0);
    if (u_seamDebugEnabled > 0.5) {
        float checker = mod(starCell.x + starCell.y, 2.0);
        vec3 baseA = vec3(0.06, 0.06, 0.08);
        vec3 baseB = vec3(0.1, 0.1, 0.16);
        color = mix(baseA, baseB, checker);
    }

    // Simple tonemix
    vec3 finalColor = max(color, starAccum);

    if (u_seamDebugEnabled > 0.5) {
        vec2 seamEdge = min(fract(starScaled), 1.0 - fract(starScaled));
        float seamMask = step(seamEdge.x, 0.02) + step(seamEdge.y, 0.02);
        seamMask = clamp(seamMask, 0.0, 1.0);
        finalColor = mix(finalColor, vec3(1.0, 0.0, 1.0), seamMask);
    }

    finalColor = clamp(finalColor, 0.0, 1.0);

    outColor = vec4(finalColor, 1.0);
}
