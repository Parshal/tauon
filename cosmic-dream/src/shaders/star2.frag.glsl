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

const int MAX_LAYERS = 8;
const int MAX_CELL_STAR_LOOP = 64;

float starProfile(float dist, float baseRadius, float softness) {
    float safeRadius = max(baseRadius, 0.0005);
    float softmix = clamp(softness, 0.0, 1.0);
    float coreSharp = mix(1200.0, 180.0, softmix);
    float core = exp(-dist * dist * coreSharp * safeRadius);
    float haloRadius = safeRadius * mix(1.8, 4.5, softmix);
    float halo = 1.0 / (1.0 + pow(dist / (haloRadius + 0.0001), 2.6));
    return mix(core, halo, softmix);
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

float texCoord1D(float index, float width) {
    float safeWidth = max(width, 1.0);
    float clamped = clamp(index, 0.0, safeWidth - 1.0);
    return (clamped + 0.5) / safeWidth;
}

vec2 readIndexValue(sampler2D tex, float width, float index) {
    float u = texCoord1D(index, width);
    return texture(tex, vec2(u, 0.5)).xy;
}

float readIdValue(sampler2D tex, float width, float index) {
    float u = texCoord1D(index, width);
    return texture(tex, vec2(u, 0.5)).r;
}

vec4 readDescriptorRow(float starId, float row) {
    float u = texCoord1D(starId, u_starDescriptorWidth);
    float safeHeight = max(u_starDescriptorHeight, 1.0);
    float v = texCoord1D(row, safeHeight);
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

StarSample loadStar(float starId) {
    StarSample s;
    vec4 r0 = readDescriptorRow(starId, 0.0);
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
    return s;
}

vec3 shadeStar(
    float starId,
    vec2 fragPos,
    vec2 tileOffset,
    int layerIndex,
    float layerScale,
    float invCells,
    float layerWeight,
    float softness,
    float twinkle,
    float glowMix,
    float glowBoost
) {
    if (starId < 0.0 || starId >= u_starCount) return vec3(0.0);
    StarSample star = loadStar(starId);
    if (int(star.layerId + 0.5) != layerIndex) {
        return vec3(0.0);
    }
    float worldCellSize = layerScale * invCells;
    float baseRadius = max(0.00015, star.size * worldCellSize);
    vec2 starPos = star.position + tileOffset;
    vec2 delta = fragPos - starPos;
    float dist = length(delta);
    float profile = starProfile(dist, baseRadius, softness) * star.coreScale * layerWeight;
    float haloRadius = max(baseRadius * star.haloScale, baseRadius * 1.1) + 0.0003;
    float glowShell = 1.0 / (1.0 + pow(dist / haloRadius, 3.0));
    float sparkleBase = sin(u_time * (0.6 + star.intensity * 2.4) + star.sparklePhase);
    float sparkle = mix(1.0, 0.7 + 0.3 * sparkleBase, twinkle);
    if (star.heroFlag > 0.5) {
        sparkle = mix(sparkle, sparkle * 1.35, twinkle);
    }
    float haloEnergy = mix(profile, glowShell, glowMix) * star.intensity * sparkle * glowBoost;
    return star.tint * haloEnergy;
}

void accumulateRange(
    sampler2D idTex,
    float idWidth,
    vec2 indexInfo,
    vec2 fragPos,
    vec2 tileOffset,
    int layerIndex,
    float layerScale,
    float invCells,
    float layerWeight,
    float softness,
    float twinkle,
    float glowMix,
    float glowBoost,
    inout vec3 accum
) {
    float baseOffset = indexInfo.x;
    float count = indexInfo.y;
    if (count <= 0.0) return;
    for (int i = 0; i < MAX_CELL_STAR_LOOP; ++i) {
        if (float(i) >= count) break;
        float starId = readIdValue(idTex, idWidth, baseOffset + float(i));
        accum += shadeStar(starId, fragPos, tileOffset, layerIndex, layerScale, invCells, layerWeight, softness, twinkle, glowMix, glowBoost);
    }
}

void main() {
    vec2 uv = (v_uv - 0.5) * vec2(u_res.x / max(u_res.y, 1.0), 1.0);
    float zoomAtten = mix(0.4, 1.8, clamp(2.2 - u_zoom, 0.0, 1.5));
    uv *= zoomAtten;

    vec3 accum = vec3(0.0);
    float softness = clamp(u_starFastSoft, 0.0, 1.0);
    float twinkle = clamp(u_starFastTwinkle, 0.0, 1.0);
    float glowBoost = 1.0 + u_starFastGlow * 0.8;
    float glowMix = clamp(u_starFastGlow, 0.0, 1.0);
    int totalLayers = max(1, int(floor(u_starLayerCount + 0.5)));

    for (int layer = 0; layer < MAX_LAYERS; ++layer) {
        if (layer >= totalLayers) break;
        vec4 layerInfo = readLayerInfo(layer);
        float cellsPerAxis = max(1.0, layerInfo.x);
        float invCells = max(1.0 / cellsPerAxis, layerInfo.y);
        float layerScale = max(0.001, layerInfo.z);
        float cellOffset = layerInfo.w;

        vec2 layerPos = uv * layerScale;
        vec2 normalized = layerPos / layerScale + 0.5;
        vec2 tile = floor(normalized);
        vec2 wrappedNorm = normalized - tile;
        vec2 tileWorld = tile * layerScale;
        vec2 clampedNorm = clamp(wrappedNorm, 0.0, 0.9999);
        vec2 cellFloat = clampedNorm * cellsPerAxis;
        ivec2 cell = ivec2(floor(cellFloat));
        float cellIndex = cellOffset + float(cell.y) * cellsPerAxis + float(cell.x);
        if (cellIndex < 0.0 || cellIndex >= u_starCellCount) continue;

        float layerLerp = totalLayers > 1 ? float(layer) / float(totalLayers - 1) : 0.0;
        float layerWeight = mix(1.1, 0.32, layerLerp);

        vec2 localInfo = readIndexValue(u_starLocalIndexTex, u_starLocalIndexWidth, cellIndex);
        vec2 spillInfo = readIndexValue(u_starSpillIndexTex, u_starSpillIndexWidth, cellIndex);

        accumulateRange(
            u_starLocalIdTex,
            u_starLocalWidth,
            localInfo,
            layerPos,
            tileWorld,
            layer,
            layerScale,
            invCells,
            layerWeight,
            softness,
            twinkle,
            glowMix,
            glowBoost,
            accum
        );

        accumulateRange(
            u_starSpillIdTex,
            u_starSpillWidth,
            spillInfo,
            layerPos,
            tileWorld,
            layer,
            layerScale,
            invCells,
            layerWeight,
            softness,
            twinkle,
            glowMix,
            glowBoost,
            accum
        );
    }

    accum *= u_starFastBright;
    outColor = vec4(accum, 1.0);
}
