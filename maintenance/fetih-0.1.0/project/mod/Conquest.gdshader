shader_type canvas_item;
uniform vec4 old_color : source_color = vec4(0.87, 0.84, 0.76, 1.0);
uniform vec4 next_color : source_color = vec4(0.87, 0.84, 0.76, 1.0);
uniform float progress : hint_range(0.0, 1.0) = 1.0;
uniform vec2 direction = vec2(1.0, 0.0);
uniform sampler2D portrait_texture : source_color, filter_linear;
uniform bool has_portrait = false;
uniform float portrait_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec2 portrait_ratio = vec2(1.0, 1.0);
uniform vec2 map_origin = vec2(0.0, 0.0);
uniform vec2 map_axis_x = vec2(1.0, 0.0);
uniform vec2 map_axis_y = vec2(0.0, 1.0);
uniform vec2 portrait_map_min = vec2(0.0, 0.0);
uniform vec2 portrait_map_size = vec2(1.0, 1.0);
void fragment() {
	vec4 source = texture(TEXTURE, UV);
	float radial = length((UV - vec2(0.5)) * vec2(1.0, 1.0));
	float reveal = 1.0 - smoothstep(progress * 0.76, progress * 0.76 + 0.035, radial);
	vec3 tint = mix(old_color.rgb, next_color.rgb, reveal);
	float inside = smoothstep(0.55, 0.95, source.r);
	if (has_portrait) {
		vec2 map_point = map_origin + map_axis_x * UV.x + map_axis_y * UV.y;
		vec2 owner_uv = (map_point - portrait_map_min) / max(portrait_map_size, vec2(0.001));
		vec2 portrait_uv = (owner_uv - vec2(0.5)) * portrait_ratio + vec2(0.5);
		vec3 photo = texture(portrait_texture, portrait_uv).rgb;
		tint = mix(tint, photo, portrait_strength * reveal);
	}
	vec3 border = mix(source.rgb * vec3(0.73, 0.77, 0.79), vec3(0.025, 0.028, 0.032), float(has_portrait));
	vec3 color = mix(border, tint, inside);
	float front = (1.0 - smoothstep(0.0, 0.025, abs(radial - progress * 0.76)));
	color += vec3(0.14, 0.11, 0.04) * front * inside * float(progress < 0.99);
	COLOR = vec4(color, source.a);
}
