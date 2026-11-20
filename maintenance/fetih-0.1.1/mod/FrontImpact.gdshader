shader_type canvas_item;
render_mode unshaded;

uniform bool smoke_pass = false;
varying vec4 tint;

void vertex() {
	tint = COLOR;
}

float fleck(vec2 uv, vec2 center, vec2 radii) {
	return 1.0 - smoothstep(0.28, 1.0, length((uv - center) / radii));
}

void fragment() {
	float mask = texture(TEXTURE, UV).a;
	float upper_mask = texture(TEXTURE, UV + vec2(-0.032, -0.052)).a;
	float light = clamp(0.48 + (mask - upper_mask) * 1.35, 0.0, 1.0);
	if (smoke_pass) {
		vec3 soot = mix(vec3(0.14, 0.12, 0.11), vec3(0.48, 0.43, 0.37), light);
		COLOR = vec4(soot, smoothstep(0.03, 0.78, mask) * tint.a);
	} else {
		float core = (1.0 - smoothstep(0.025, 0.145, length((UV - vec2(0.48, 0.50)) * vec2(1.0, 1.22)))) * mask;
		float sparks = max(fleck(UV, vec2(0.73, 0.39), vec2(0.045, 0.022)), fleck(UV, vec2(0.34, 0.27), vec2(0.023, 0.040)));
		sparks = max(sparks, fleck(UV, vec2(0.69, 0.68), vec2(0.027, 0.019)));
		vec3 amber = mix(vec3(0.68, 0.23, 0.07), vec3(1.0, 0.64, 0.20), light);
		vec3 flash = mix(amber, vec3(1.0, 0.96, 0.75), max(core, sparks));
		float opacity = max(smoothstep(0.04, 0.69, mask), sparks * 0.84);
		COLOR = vec4(flash * tint.rgb, opacity * tint.a);
	}
}
