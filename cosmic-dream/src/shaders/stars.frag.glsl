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
uniform float u_starBright;
uniform float u_starSize;

// New: grid resolution in cells per axis
uniform float u_gridCells;
uniform float u_gridEnabled;
uniform float u_gridBordersEnabled;

// Simple 2D hash
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// Tiny helper: antialiased disc falloff
float aaDisc(vec2 p, float radius) {
    float d = length(p);
    float r = max(radius, 0.0001);
    float t = fwidth(d);
    float edge0 = r - t;
    float edge1 = r + t;
    float m = smoothstep(edge1, edge0, d);
    return m;
}

void main() {
    // Screen-space UV with aspect, centered, zoomed a bit like old shaders
    float maxDim = max(max(u_res.x, u_res.y), 1.0);
    vec2 aspect = vec2(u_res.x, u_res.y) / maxDim;
    vec2 uv = (v_uv - 0.5) * aspect;
    float zoomAtten = max(0.2, 2.2 - u_zoom);
    uv *= zoomAtten;

    // Map to [0,1] logical grid space
    vec2 gridUv = uv / aspect + 0.5;

    float cellsF = max(1.0, floor(u_gridCells + 0.5));
    vec2 scaled = gridUv * cellsF;
    vec2 cell = floor(scaled);
    vec2 cellUv = fract(scaled);

    vec3 color = vec3(0.0);

    if (u_gridEnabled > 0.5) {
        // Checkerboard background
        float checker = mod(cell.x + cell.y, 2.0);
        vec3 baseA = vec3(0.02, 0.02, 0.04);
        vec3 baseB = vec3(0.05, 0.05, 0.08);
        color = mix(baseA, baseB, checker);

        // Subtle grid lines
        if (u_gridBordersEnabled > 0.5) {
            float lineWidth = 0.04; // fraction of cell
            vec2 distToEdge = min(cellUv, 1.0 - cellUv);
            float lineMask = smoothstep(lineWidth * 0.5, 0.0, min(distToEdge.x, distToEdge.y));
            color += vec3(0.06, 0.06, 0.08) * lineMask * 0.5;
        }
    }

    // Simple star splodges: sample stars from this cell + 8 neighbors
    float densityNorm = clamp(u_starDensity / 200.0, 0.0, 1.0);
    float twinkle = clamp(u_starTwinkle, 0.0, 1.0);
    float sizeScale = clamp(u_starSize > 0.0 ? u_starSize : 1.0, 0.25, 2.0);

    vec3 starAccum = vec3(0.0);

    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            vec2 neighborCell = cell + vec2(float(dx), float(dy));
            float h = hash21(neighborCell + 37.0);
            if (h > densityNorm) continue;

            // Local star properties from hash
            float radiusSeed = fract(h * 17.23);
            float angle = fract(h * 91.7) * 6.2831853;
            float baseRadius = mix(0.06, 0.18, radiusSeed); // smaller, debug-sized discs
            float radiusJitter = mix(0.8, 1.2, fract(h * 137.0));
            float r = baseRadius * radiusJitter * sizeScale; // in cell space
            vec2 offset = vec2(cos(angle), sin(angle)) * 0.15;

            vec2 starLocal = cellUv + vec2(float(dx), float(dy)) - offset;
            float falloff = aaDisc(starLocal, r);

            // Cheap twinkle
            float twPhase = h * 62.8 + u_time * (0.5 + 1.5 * fract(h * 9.13));
            float twVal = mix(1.0, 0.5 + 0.5 * sin(twPhase), twinkle);

            vec3 starColor = vec3(0.8, 0.9, 1.1);
            starAccum += starColor * falloff * twVal;
        }
    }

    starAccum *= u_starBright;

    // Simple tonemix
    vec3 finalColor = color + starAccum;
    finalColor = clamp(finalColor, 0.0, 1.0);

    outColor = vec4(finalColor, 1.0);
}
