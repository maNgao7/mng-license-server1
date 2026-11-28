#version 450
layout(set = 0, binding = 0) uniform sampler2D hud;
layout(push_constant) uniform OutputFormat { vec2 ratio; uint srgb; } outputFormat;
layout(location = 0) in vec2 uv;
layout(location = 0) out vec4 color;
void main() {
    // B8G8R8A8_UNORM already returns logical RGBA. Do NOT swizzle .bgra.
    color = texture(hud, uv * outputFormat.ratio);
    if (color.a <= 0.0) discard;
    if (outputFormat.srgb != 0u) {
        // Electron's premultiplied bytes are in sRGB encoding. An sRGB
        // attachment blends in linear light, so decode straight RGB first.
        vec3 straight = clamp(color.rgb / color.a, 0.0, 1.0);
        vec3 linearRGB = mix(pow((straight + 0.055) / 1.055, vec3(2.4)),
                             straight / 12.92, lessThanEqual(straight, vec3(0.04045)));
        color.rgb = linearRGB * color.a;
    }
}
