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
uniform sampler2D u_glowLUTTex;
uniform float u_glowLUTSize;
uniform float u_glowLUTRows;

uniform sampler2D u_starDescriptorTex;
uniform sampler2D u_starLocalIdTex;
uniform sampler2D u_starSpillIdTex;
uniform sampler2D u_starLocalIndexTex;
uniform sampler2D u_starSpillIndexTex;
uniform sampler2D u_starLayerInfoTex;
uniform float u_starDescriptorWidth;
uniform float u_starDescriptorHeight;
uniform float u_starLocalWidth;
uniform float u_starLocalHeight;
uniform float u_starSpillWidth;
uniform float u_starSpillHeight;
uniform float u_starLocalIndexWidth;
uniform float u_starLocalIndexHeight;
uniform float u_starSpillIndexWidth;
uniform float u_starSpillIndexHeight;
uniform float u_starLayerInfoWidth;
uniform float u_starLayerInfoHeight;
uniform float u_starCellCount;
uniform float u_starLayerCount;
uniform float u_starCount;
uniform float u_debugCellLayer;
uniform float u_debugCellX;
uniform float u_debugCellY;
uniform float u_debugCellEnabled;

const int MAX_LAYERS = 8;
const int MAX_CELL_STAR_LOOP = 256;
const float TEXELS_PER_STAR = 3.0;
const float EPSILON = 0.0001;

float saturate(float v) {
    return clamp(v, 0.0, 1.0);
}

vec4 sampleGlowProfile(float glowNorm, bool hero) {
    float size = max(u_glowLUTSize, 1.0);
    float rows = max(u_glowLUTRows, 1.0);
    float coord = clamp(glowNorm, 0.0, 0.999) * (size - 1.0);
    float texCoord = (coord + 0.5) / size;
    float row = hero ? 1.0 : 0.0;
    float texRow = (row + 0.5) / rows;
    return texture(u_glowLUTTex, vec2(texCoord, texRow));
}

vec2 wrapLayerSpace(vec2 pos, float scale) {
    float safeScale = max(scale, 0.0001);
    float halfScale = safeScale * 0.5;
    return mod(pos + halfScale, safeScale) - halfScale;
}

float evalGlowEnergy(
    float dist,
    float baseRadius,
    float softness,
    float coreScale,
    float haloScale,
    float glowRadiusGain,
    float glowMix,
    bool hero
) {
    float minReach = 0.1;
    float haloStrength = saturate(max(glowMix, glowRadiusGain - 0.6));
    float reach = mix(minReach, max(0.35, haloScale) * glowRadiusGain, haloStrength);
    float radiusNorm = clamp(dist / (baseRadius * reach + EPSILON), 0.0, 0.999);
    vec4 glow = sampleGlowProfile(radiusNorm, hero);
    float coreRadius = baseRadius * mix(0.35, 1.0, haloStrength);
    float coreSharp = mix(1200.0, 120.0, haloStrength);
    float haloRadius = baseRadius * (0.35 + glow.y * reach);
    float haloCurve = mix(2.0, 3.8, saturate(glow.z));
    float core = exp(-dist * dist * coreSharp / max(coreRadius, EPSILON));
    float halo = 1.0 / (1.0 + pow(dist / (haloRadius + EPSILON), haloCurve));
    float softnessMix = mix(0.18, 0.84, saturate(softness));
    float glowMixWeight = mix(0.2, 0.92, saturate(glowMix));
    float profileMix = mix(softnessMix, glowMixWeight, 0.65 * haloStrength);
    float lutBoost = mix(0.72, 1.35, saturate(glow.w));
    float haloWeighted = halo * haloStrength;
    return mix(core, haloWeighted, profileMix) * lutBoost * coreScale;
}

float texCoord1D(float index, float width) {
    float safeWidth = max(width, 1.0);
    float clamped = clamp(index, 0.0, safeWidth - 1.0);
    return (clamped + 0.5) / safeWidth;
}

vec2 texCoord2D(float index, float width, float height) {
    float safeWidth = max(width, 1.0);
    float safeHeight = max(height, 1.0);
    float total = safeWidth * safeHeight;
    float clamped = clamp(index, 0.0, total - 1.0);
    float row = floor(clamped / safeWidth);
    float column = clamped - row * safeWidth;
    return vec2((column + 0.5) / safeWidth, (row + 0.5) / safeHeight);
}

vec2 readIndexValue(sampler2D tex, float width, float height, float index) {
    vec2 uv = texCoord2D(index, width, height);
    return texture(tex, uv).xy;
}

float readIdValue(sampler2D tex, float width, float height, float index) {
    vec2 uv = texCoord2D(index, width, height);
    return texture(tex, uv).r;
}

vec4 readDescriptorRow(float starId, float row) {
    float safeWidth = max(u_starDescriptorWidth, 1.0);
    float safeHeight = max(u_starDescriptorHeight, 1.0);
    float rowsPerBlock = TEXELS_PER_STAR;
    float rowBlockCount = max(1.0, safeHeight / rowsPerBlock);
    float blockIndex = floor(starId / safeWidth);
    float column = starId - blockIndex * safeWidth;
    float texRow = blockIndex * rowsPerBlock + clamp(row, 0.0, rowsPerBlock - 1.0);
    float u = (column + 0.5) / safeWidth;
    float v = (texRow + 0.5) / safeHeight;
    return texture(u_starDescriptorTex, vec2(u, v));
}

vec4 readLayerInfo(int layerIndex) {
    float u = texCoord1D(float(layerIndex), u_starLayerInfoWidth);
    return texture(u_starLayerInfoTex, vec2(u, 0.5));
}

struct StarSample {
    vec2 position;
    float layerId;
    float size;
    float coreScale;
    float haloScale;
    vec3 tint;
    float sparklePhase;
    float intensity;
    float heroFlag;
};

bool loadStar(float starId, int layerIndex, out StarSample s) {
    vec4 r0 = readDescriptorRow(starId, 0.0);
    int starLayer = int(r0.z + 0.5);
    if (starLayer != layerIndex) {
        return false;
    }
    vec4 r1 = readDescriptorRow(starId, 1.0);
    vec4 r2 = readDescriptorRow(starId, 2.0);
    s.position = r0.xy;
    s.layerId = r0.z;
    s.size = r0.w;
    s.coreScale = r1.x;
    s.haloScale = r1.y;
    s.tint = vec3(r1.z, r1.w, r2.x);
    s.sparklePhase = r2.y;
    s.intensity = r2.z;
    s.heroFlag = r2.w;
    return true;
}

vec3 shadeStar(
    float starId,
    vec2 fragLocal,
    int layerIndex,
    float layerScale,
    float invCells,
    float layerWeight,
    float softness,
    float twinkle,
    float glowMix,
    float glowBoost,
    float glowRadiusGain
) {
    if (starId < 0.0 || starId >= u_starCount) return vec3(0.0);
    StarSample star;
    if (!loadStar(starId, layerIndex, star)) {
        return vec3(0.0);
    }
    float worldCellSize = layerScale * invCells;
    float baseRadius = max(0.00015, star.size * worldCellSize);
    vec2 starPos = star.position;
    vec2 delta = wrapLayerSpace(fragLocal - starPos, layerScale);
    float dist = length(delta);
    bool isHero = star.heroFlag > 0.5;
    float glowEnergy = evalGlowEnergy(dist, baseRadius, softness, star.coreScale, star.haloScale, glowRadiusGain, glowMix, isHero);
    float sparkleBase = sin(u_time * (0.6 + star.intensity * 2.4) + star.sparklePhase);
    float sparkle = mix(1.0, 0.7 + 0.3 * sparkleBase, twinkle);
    if (isHero) {
        float heroLift = mix(1.0, 1.25 + glowMix * 0.4, twinkle);
        sparkle = mix(sparkle, sparkle * heroLift, 0.65);
        glowEnergy *= mix(1.0, 1.1 + glowRadiusGain * 0.15, glowMix);
    }
    float haloEnergy = glowEnergy * star.intensity * sparkle * glowBoost * layerWeight;
    return star.tint * haloEnergy;
}

void accumulateRange(
    sampler2D idTex,
    float idWidth,
    float idHeight,
    vec2 indexInfo,
    vec2 fragLocal,
    int layerIndex,
    float layerScale,
    float invCells,
    float layerWeight,
    float softness,
    float twinkle,
    float glowMix,
    float glowBoost,
    float glowRadiusGain,
    inout vec3 accum
) {
    float baseOffset = indexInfo.x;
    int countInt = int(floor(max(0.0, indexInfo.y) + 0.5));
    if (countInt <= 0) return;
    int loopCount = min(MAX_CELL_STAR_LOOP, countInt);
    for (int i = 0; i < MAX_CELL_STAR_LOOP; ++i) {
        if (i >= loopCount) break;
        float starId = readIdValue(idTex, idWidth, idHeight, baseOffset + float(i));
        accum += shadeStar(
            starId,
            fragLocal,
            layerIndex,
            layerScale,
            invCells,
            layerWeight,
            softness,
            twinkle,
            glowMix,
            glowBoost,
            glowRadiusGain
        );
    }
}

void main() {
    float maxDim = max(max(u_res.x, u_res.y), 1.0);
    vec2 aspect = vec2(u_res.x, u_res.y) / maxDim;
    vec2 uv = (v_uv - 0.5) * aspect;
    float zoomAtten = mix(0.4, 1.8, clamp(2.2 - u_zoom, 0.0, 1.5));
    uv *= zoomAtten;

    vec3 accum = vec3(0.0);
    float softness = clamp(u_starFastSoft, 0.0, 1.0);
    float twinkle = clamp(u_starFastTwinkle, 0.0, 1.0);
    float glowNorm = clamp(u_starFastGlow / 2.0, 0.0, 1.0);
    float glowShape = pow(glowNorm, 1.5);
    float glowBoost = 1.0 + glowShape * 0.5;
    float glowMix = glowShape;
    float radiusNorm = clamp(u_starFastGlowRad / 1.2, 0.0, 1.0);
    float radiusShape = pow(radiusNorm, 1.4);
    float glowRadiusGain = mix(0.6, 1.8, radiusShape);
    float densityNorm = clamp(u_starFastDensity / 200.0, 0.0, 1.0);
    int totalLayers = max(1, int(floor(u_starLayerCount + 0.5)));

    bool debugActive = u_debugCellEnabled > 0.5;

    for (int layer = 0; layer < MAX_LAYERS; ++layer) {
        if (layer >= totalLayers) break;
        vec4 layerInfo = readLayerInfo(layer);
        float cellsPerAxis = max(1.0, layerInfo.x);
        float invCells = max(1.0 / cellsPerAxis, layerInfo.y);
        float layerScale = max(0.001, layerInfo.z);
        float cellOffset = layerInfo.w;

        vec2 layerPos = uv * layerScale;
        vec2 wrappedLayerPos = wrapLayerSpace(layerPos, layerScale);
        vec2 normalized = wrappedLayerPos / layerScale + 0.5;
        vec2 clampedNorm = clamp(normalized, 0.0, 0.9999);
        vec2 cellFloat = clampedNorm * cellsPerAxis;
        ivec2 cell = ivec2(floor(cellFloat));
        float cellIndex = cellOffset + float(cell.y) * cellsPerAxis + float(cell.x);
        if (cellIndex < 0.0 || cellIndex >= u_starCellCount) continue;

        bool isDebugCell = debugActive
            && layer == int(floor(u_debugCellLayer + 0.5))
            && cell.x == int(floor(u_debugCellX + 0.5))
            && cell.y == int(floor(u_debugCellY + 0.5));

        float layerLerp = totalLayers > 1 ? float(layer) / float(totalLayers - 1) : 0.0;
        float parallaxWeight = mix(1.15, 0.24, layerLerp);
        float densityLift = mix(0.85, 1.2, densityNorm);
        float layerWeight = parallaxWeight * densityLift;

        vec2 localInfo = readIndexValue(u_starLocalIndexTex, u_starLocalIndexWidth, u_starLocalIndexHeight, cellIndex);
        vec2 spillInfo = readIndexValue(u_starSpillIndexTex, u_starSpillIndexWidth, u_starSpillIndexHeight, cellIndex);

        accumulateRange(
            u_starLocalIdTex,
            u_starLocalWidth,
            u_starLocalHeight,
            localInfo,
            wrappedLayerPos,
            layer,
            layerScale,
            invCells,
            layerWeight,
            softness,
            twinkle,
            glowMix,
            glowBoost,
            glowRadiusGain,
            accum
        );

        accumulateRange(
            u_starSpillIdTex,
            u_starSpillWidth,
            u_starSpillHeight,
            spillInfo,
            wrappedLayerPos,
            layer,
            layerScale,
            invCells,
            layerWeight,
            softness,
            twinkle,
            glowMix,
            glowBoost,
            glowRadiusGain,
            accum
        );

        if (isDebugCell) {
            vec3 tint = vec3(0.75, 0.2, 0.95);
            float gridMix = 0.65;
            accum = mix(accum, accum + tint * 0.6, gridMix);
        }
    }

    accum *= u_starFastBright;
    outColor = vec4(accum, 1.0);
}
