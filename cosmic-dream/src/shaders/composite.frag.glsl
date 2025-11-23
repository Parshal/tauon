#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform sampler2D u_nebulaTex;
uniform sampler2D u_starTex;
uniform sampler2D u_membraneTex;
uniform bool u_nebulaEnabled;
uniform bool u_starEnabled;
uniform bool u_membraneEnabled;
uniform float u_starBlend;
uniform float u_contrast;

void main() {
    vec3 nebulaColor = u_nebulaEnabled ? texture(u_nebulaTex, v_uv).rgb : vec3(0.0);
    vec3 starColor = u_starEnabled ? texture(u_starTex, v_uv).rgb : vec3(0.0);
    vec4 membraneSample = u_membraneEnabled ? texture(u_membraneTex, v_uv) : vec4(0.0);
    vec3 finalColor = nebulaColor;

    if (u_starEnabled) {
        int blendMode = int(round(clamp(u_starBlend, 0.0, 3.0)));
        if (blendMode == 0) {
            finalColor = nebulaColor + starColor;
        } else if (blendMode == 1) {
            finalColor = 1.0 - (1.0 - clamp(nebulaColor, 0.0, 1.0)) * exp(-starColor);
        } else if (blendMode == 2) {
            float nebLuma = dot(clamp(nebulaColor, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
            float fade = mix(1.0, 0.4, smoothstep(0.5, 1.5, nebLuma));
            finalColor = nebulaColor + starColor * fade;
        } else {
            vec3 core = min(starColor, vec3(0.8));
            vec3 halo = max(starColor - core, vec3(0.0));
            vec3 haloBlend = 1.0 - (1.0 - clamp(nebulaColor, 0.0, 1.0)) * exp(-halo);
            finalColor = nebulaColor + core + haloBlend - nebulaColor;
        }
    }

    if (u_membraneEnabled) {
        float membraneAlpha = clamp(membraneSample.a * 1.5, 0.0, 1.0);
        vec3 dispersion = vec3(
            membraneSample.r,
            mix(membraneSample.g, membraneSample.r, 0.35),
            mix(membraneSample.b, membraneSample.g, 0.25)
        );
        vec3 membraneBlend = finalColor + dispersion * membraneAlpha;
        finalColor = mix(finalColor, membraneBlend, membraneAlpha);
    }

    float contrast = max(u_contrast, 0.0001);
    finalColor = pow(max(finalColor, vec3(0.0)), vec3(contrast));
    outColor = vec4(finalColor, 1.0);
}
