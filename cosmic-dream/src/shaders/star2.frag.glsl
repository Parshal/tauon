#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_zoom;
uniform float u_starFastDensity;
uniform float u_starFastTwinkle;
uniform float u_starFastSoft;
uniform float u_starFastGlow;
uniform float u_starFastGlowRad;
uniform float u_starFastBright;

const int LAYERS = 4;
const int MAX_STAR_CANDIDATES = 4;
const vec4 HERO_THRESH = vec4(0.2, 0.45, 0.7, 0.9);
const vec4 STAR_THRESH = vec4(0.12, 0.3, 0.52, 0.75);

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash22(vec2 p) {
    p = vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    );
    return fract(sin(p) * 43758.5453123);
}

float starProfile(float dist, float baseRadius, float softness) {
    float safeRadius = max(baseRadius, 0.0005);
    float softmix = clamp(softness, 0.0, 1.0);
    float coreSharp = mix(1200.0, 180.0, softmix);
    float core = exp(-dist * dist * coreSharp * safeRadius);
    float haloRadius = safeRadius * mix(1.8, 4.5, softmix);
    float halo = 1.0 / (1.0 + pow(dist / (haloRadius + 0.0001), 2.6));
    return mix(core, halo, softmix);
}

vec2 estimateGlowProfile(float glowNorm, bool hero) {
    vec4 thresholds = hero ? HERO_THRESH : STAR_THRESH;
    vec4 cmp = step(thresholds, vec4(glowNorm));
    float coreScale = hero ? 1.0 : 1.0;
    float haloScale = hero ? 2.0 : 1.3;
    coreScale += dot(cmp, hero ? vec4(0.35, 0.25, 0.2, 0.15) : vec4(0.12, 0.08, 0.06, 0.05));
    haloScale += dot(cmp, hero ? vec4(0.8, 0.5, 0.45, 0.35) : vec4(0.4, 0.25, 0.23, 0.25));
    return vec2(coreScale, haloScale);
}

void main() {
    vec2 uv = (v_uv - 0.5) * vec2(u_res.x / max(u_res.y, 1.0), 1.0);
    float zoomAtten = mix(0.4, 1.8, clamp(2.2 - u_zoom, 0.0, 1.5));
    uv *= zoomAtten;

    vec3 accum = vec3(0.0);
    float densityControl = clamp(u_starFastDensity / 600.0, 0.0, 1.0);
    float budgetInterp = mix(1.0, float(MAX_STAR_CANDIDATES), pow(densityControl, 0.55));
    int baseSampleBudget = max(1, int(floor(budgetInterp + 0.5)));
    float density = clamp(u_starFastDensity / 420.0, 0.004, 0.75);
    float softness = clamp(u_starFastSoft, 0.0, 1.0);
    float glowBoost = 1.0 + u_starFastGlow * 0.8;
    float twinkle = clamp(u_starFastTwinkle, 0.0, 1.0);
    float heroBias = clamp(u_starFastGlowRad, 0.0, 1.0);

    for (int i = 0; i < LAYERS; ++i) {
        float fi = float(i);
        float layerLerp = fi / float(LAYERS - 1);
        float layerScale = mix(9.0, 54.0, layerLerp);
        float layerWeight = mix(1.1, 0.32, layerLerp);
        vec2 layerUv = uv * layerScale;
        vec2 warp = vec2(
            sin(layerUv.y * 0.73 + fi * 2.97),
            cos(layerUv.x * 0.63 - fi * 1.71)
        ) * mix(0.18, 0.05, layerLerp);
        vec2 warpedUv = layerUv + warp;
        vec2 cell = floor(warpedUv);
        vec2 local = fract(warpedUv) - 0.5;

        float derivative = max(fwidth(layerUv.x), fwidth(layerUv.y));
        float jitterMix = mix(0.95, 0.25, layerLerp);
        float layerDensity = density * mix(1.15, 0.28, layerLerp);
        float glowMix = clamp(u_starFastGlow, 0.0, 1.0);
        float layerBudgetFloat = float(baseSampleBudget) * mix(1.2, 0.35, layerLerp);
        int layerBudget = max(1, int(floor(layerBudgetFloat)));
        layerBudget = min(layerBudget, MAX_STAR_CANDIDATES);
        int samplesUsed = 0;

        for (int c = 0; c < MAX_STAR_CANDIDATES; ++c) {
            if (samplesUsed >= layerBudget) break;
            vec2 candidateOffset = vec2(float(c) * 13.17, float(c) * 37.41);
            float baseSeed = hash21(cell + fi * 19.17 + candidateOffset);
            if (baseSeed > layerDensity) continue;
            samplesUsed++;

            float heroSeed = fract(baseSeed * 3.97);
            bool hero = heroSeed < mix(0.01, 0.06, heroBias);

            vec2 jitter = (hash22(cell + baseSeed + candidateOffset) - 0.5) * jitterMix;
            vec2 starPos = local - jitter;
            float dist = length(starPos);

            float sizeSeed = fract(baseSeed * 37.23 + float(c) * 1.7);
            float baseSize = mix(0.018, 0.09, pow(sizeSeed, mix(2.6, 0.7, softness)));
            float heroBoost = hero ? mix(1.5, 2.4, heroBias) : 1.0;
            float size = max(0.012, baseSize * heroBoost);

            float profile = starProfile(dist, size, softness);
            profile *= layerWeight;
            profile *= 1.0 / (1.0 + derivative * 32.0);

            float glowNorm = hero ? heroBias : glowMix;
            vec2 glowProfile = estimateGlowProfile(glowNorm, hero);
            float shellRadius = size * glowProfile.y + 0.0003;
            float glowShell = 1.0 / (1.0 + pow(dist / shellRadius, 3.0));
            float sparklePhase = u_time * (0.6 + 4.5 * sizeSeed) + baseSeed * 45.0;
            float sparkle = mix(1.0, 0.7 + 0.3 * sin(sparklePhase), twinkle);
            if (hero) {
                sparkle = mix(sparkle, sparkle * 1.35, twinkle);
            }
            float chromaSeed = fract(baseSeed * 11.17);
            vec3 tint = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.82, 0.7), chromaSeed);

            float haloMix = hero ? mix(0.45, 0.82, glowMix) : mix(0.1, 0.35, glowMix);
            float haloEnergy = mix(profile, glowShell, haloMix) * sparkle * glowBoost;
            accum += tint * haloEnergy;
        }
    }

    accum *= u_starFastBright;
    outColor = vec4(accum, 1.0);
}
