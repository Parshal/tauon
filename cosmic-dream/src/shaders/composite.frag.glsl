#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform sampler2D u_starTex;
uniform float u_contrast;

void main() {
    vec3 color = texture(u_starTex, v_uv).rgb;
    float contrast = max(u_contrast, 0.0001);
    color = pow(max(color, vec3(0.0)), vec3(contrast));
    outColor = vec4(color, 1.0);
}
