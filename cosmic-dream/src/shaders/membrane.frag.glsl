#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_membraneStrength;
uniform float u_membraneFlow;
uniform float u_membraneFringe;
uniform float u_momentumPersistence;
uniform float u_permissionBloom;
uniform float u_permissionGate;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = m * p * 2.0 + 21.37;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);
    vec2 centered = (v_uv - 0.5) * aspect;
    float dist = length(centered);

    float flowSpeed = 0.25 + u_membraneFlow * 0.35;
    float wobble = fbm(centered * (3.5 + u_membraneFlow) + u_time * flowSpeed);

    float fringe = mix(0.02, 0.18, clamp(u_membraneFringe / 3.0, 0.0, 1.0));
    float baseRadius = 0.32 + 0.05 * sin(u_time * 0.2);
    float band = smoothstep(baseRadius - fringe - wobble * 0.05, baseRadius + fringe + wobble * 0.05, dist);

    float polar = atan(centered.y, centered.x);
    float interference = 0.5 + 0.5 * sin(polar * 8.0 + u_time * flowSpeed * 1.5 + wobble * 2.0);

    float persistence = clamp(u_momentumPersistence, 0.0, 1.0);
    float momentum = mix(interference, pow(interference, 3.0), persistence);

    float permissionPulse = 0.5 + 0.5 * sin(u_time * (0.8 + u_membraneFlow * 0.15));
    float permission = smoothstep(u_permissionGate, 1.0, permissionPulse);
    float permissionBoost = mix(1.0, max(u_permissionBloom, 0.0), permission);

    vec3 chromaA = vec3(0.64, 0.32, 1.0);
    vec3 chromaB = vec3(0.12, 0.78, 0.92);
    float chromaMix = clamp(0.5 + 0.5 * sin((centered.x + centered.y) * 4.0 + u_time * 0.3), 0.0, 1.0);
    vec3 chroma = mix(chromaA, chromaB, chromaMix);

    float energy = band * momentum * clamp(u_membraneStrength, 0.0, 1.0);
    vec3 color = chroma * energy * permissionBoost;

    outColor = vec4(color, energy);
}
