#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_layers;
uniform float u_hueBase;
uniform float u_hueSpeed;
uniform float u_flow;
uniform float u_rotFlow;
uniform float u_zoom;
uniform float u_nebulaScale;
uniform float u_detailScale;
uniform float u_brightness;
uniform float u_voidCut;
uniform float u_colorSpread;
uniform float u_layerDecay;

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

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash21(i + vec2(0.0,0.0)), hash21(i + vec2(1.0,0.0)), u.x),
               mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0,1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    vec2 shift = vec2(100.0);
    mat2 m = rot(0.5);
    for(int i=0; i<3; i++) {
        v += amp * noise(p);
        p = m * p * 2.0 + shift;
        amp *= 0.5;
    }
    return v;
}

vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0*l - 1.0)) * s;
    float hp = h / 60.0;
    float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
    vec3 col = vec3(0.0);
    if (0.0 <= hp && hp < 1.0) col = vec3(c, x, 0.0);
    else if (1.0 <= hp && hp < 2.0) col = vec3(x, c, 0.0);
    else if (2.0 <= hp && hp < 3.0) col = vec3(0.0, c, x);
    else if (3.0 <= hp && hp < 4.0) col = vec3(0.0, x, c);
    else if (4.0 <= hp && hp < 5.0) col = vec3(x, 0.0, c);
    else col = vec3(c, 0.0, x);
    return col + vec3(l - 0.5 * c);
}

void main() {
    vec2 uv = (v_uv - 0.5) * vec2(u_res.x/u_res.y, 1.0);
    float zoomFactor = max(0.1, 2.0 - u_zoom);
    uv *= zoomFactor;

    float t = u_time * 0.1;
    vec3 accColor = vec3(0.0);

    float maxL = clamp(u_layers, 1.0, 5.0);
    for(float i = 0.0; i < 5.0; i++) {
        if(i >= maxL) break;
        float layerFactor = 1.0 + i * 0.5;
        float flowAngle = t * u_rotFlow * (1.0/(i+1.0));
        vec2 p = rot(flowAngle) * uv;
        p += vec2(t * u_flow * 0.2 * layerFactor, t * u_flow * 0.1);

        vec2 noiseUV = p * u_nebulaScale * layerFactor;
        float n = fbm(noiseUV + fbm(noiseUV + t*0.2));

        float mask = smoothstep(u_voidCut, 1.0, n);
        float detail = noise(noiseUV * u_detailScale + t);
        mask *= (0.5 + 0.5 * detail);

        float activeHue = mod(u_hueBase + (u_time * u_hueSpeed * 10.0) + (i * u_colorSpread), 360.0);
        vec3 layerCol = hsl2rgb(activeHue, 0.7, 0.5);

        float alpha = mask * pow(u_layerDecay, i);
        accColor += layerCol * alpha * u_brightness;
    }

    outColor = vec4(accColor, 1.0);
}
