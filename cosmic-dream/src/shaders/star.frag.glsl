#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_zoom;
uniform float u_starDensity;
uniform float u_starTwinkle;
uniform float u_starSoft;
uniform float u_starGlow;
uniform float u_starGlowRad;
uniform float u_starBright;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float getStarLight(float d, float radius, float softness, float glowStr) {
    float rawRadius = max(radius, 0.00005);
    float radiusNorm = clamp(rawRadius / 1.2, 0.0, 1.0);
    float softnessNorm = clamp(softness, 0.0, 1.0);

    float pinSharp = mix(3600.0, 800.0, softnessNorm);
    float radiusInfluence = pow(radiusNorm, 1.2) * softnessNorm;
    float coreDecay = mix(pinSharp, 100.0, radiusInfluence);
    float core = exp(-d * d * coreDecay);

    float haloRadius = mix(0.01, 0.7, radiusNorm);
    haloRadius += softnessNorm * 0.05;
    float halo = 1.0 / (1.0 + pow(d / haloRadius, 2.2));

    float base = mix(core, halo, softnessNorm);
    float energyComp = 1.0 / (1.0 + rawRadius * 1.2);
    base *= energyComp;

    return base * (1.0 + glowStr * 2.0);
}

void main() {
    vec2 uv = (v_uv - 0.5) * vec2(u_res.x/u_res.y, 1.0);
    float zoomFactor = max(0.1, 2.0 - u_zoom);
    uv *= zoomFactor;

    float t = u_time * 0.1;
    vec3 starLayerAccum = vec3(0.0);
    float densityNorm = clamp(u_starDensity / 200.0, 0.0, 1.0);
    float softnessNorm = clamp(u_starSoft, 0.0, 1.0);

    const int MAX_NEIGHBOR_RANGE = 3;
    for(int i = 0; i < 3; i++) {
        float fi = float(i);
        mat2 layerRot = rot(fi * 2.4);
        float baseScale = (20.0 - (fi * 5.0)) * (1.0 + densityNorm * 1.5);
        float quadGrow = 1.0 + u_starGlowRad * 0.8;
        float scale = baseScale / mix(1.0, quadGrow, softnessNorm);
        vec2 st = (layerRot * uv) * scale;
        vec2 id = floor(st);
        float layerDensityBias = clamp(1.0 - fi * 0.3, 0.1, 1.0);
        float effectiveDensity = densityNorm * layerDensityBias;
        float haloReach = 1.0 + u_starGlowRad * 1.4;
        int activeRange = int(min(float(MAX_NEIGHBOR_RANGE), ceil(haloReach)));

        for (int ox = -MAX_NEIGHBOR_RANGE; ox <= MAX_NEIGHBOR_RANGE; ++ox) {
            if(abs(ox) > activeRange) continue;
            for (int oy = -MAX_NEIGHBOR_RANGE; oy <= MAX_NEIGHBOR_RANGE; ++oy) {
                if(abs(oy) > activeRange) continue;
                vec2 cell = id + vec2(float(ox), float(oy));
                float h = hash21(cell + fi * 100.0);
                if(h >= effectiveDensity) continue;

                vec2 offset = vec2(sin(h*12.0), cos(h*23.0)) * 0.4;
                vec2 starCenter = cell + vec2(0.5) + offset;
                vec2 local = st - starCenter;
                float d = length(local);

                float sizeSeed = fract(h * 45.1);
                float radiusBias = smoothstep(0.2, 1.0, u_starGlowRad);
                float sizeShape = mix(pow(sizeSeed, 3.0), pow(sizeSeed, 1.2), radiusBias * softnessNorm);
                float heroScale = mix(0.35, 1.0, clamp(fi / 2.0, 0.0, 1.0));
                float sizeRandom = max(0.015, sizeShape * heroScale);

                float twinklePhase = h * 62.8 + u_time * (0.5 + 2.0 * fract(h * 9.1));
                float twinkleVal = sin(twinklePhase) * 0.5 + 0.5;
                float brightnessMod = mix(1.0, twinkleVal, u_starTwinkle);

                float intensity = getStarLight(d, u_starGlowRad * sizeRandom, u_starSoft, u_starGlow);
                vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.7), fract(h*10.0));

                starLayerAccum += starColor * intensity * brightnessMod * u_starBright;
            }
        }
    }

    outColor = vec4(starLayerAccum, 1.0);
}
