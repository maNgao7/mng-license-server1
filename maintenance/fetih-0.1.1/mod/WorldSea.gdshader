shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform vec4 deep_ink : source_color = vec4(0.045, 0.16, 0.21, 1.0);
uniform vec4 chart_ink : source_color = vec4(0.10, 0.29, 0.33, 1.0);
uniform vec4 grid_ink : source_color = vec4(0.30, 0.48, 0.46, 1.0);
varying vec2 board_point;

void vertex() {
	board_point = VERTEX.xz / vec2(26.0, 16.0) + 0.5;
}

void fragment() {
	// Match the projection in generate-world.py, including its polar taper.
	vec2 p = board_point * vec2(1920.0, 1080.0);
	float lat = (576.0 - p.y) / 5.88;
	float lon = (p.x - 960.0) / (4.93 * (0.72 + 0.28 * cos(radians(clamp(lat, -90.0, 90.0)))));
	vec2 grid = vec2(lon / 20.0, lat / 15.0);
	vec2 width = max(fwidth(grid), vec2(0.001));
	vec2 distance_to_line = abs(fract(grid + 0.5) - 0.5) / width;
	float lines = 1.0 - smoothstep(0.22, 1.0, min(distance_to_line.x, distance_to_line.y));
	float extent = length((board_point - vec2(0.50, 0.45)) * vec2(1.3, 1.0));
	float light = 1.0 - smoothstep(0.0, 0.82, extent);
	vec3 water = mix(deep_ink.rgb, chart_ink.rgb, light);
	ALBEDO = mix(water, grid_ink.rgb, lines * light * 0.28);
}
