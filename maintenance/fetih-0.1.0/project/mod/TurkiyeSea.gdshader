shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform sampler2D shoreline : filter_linear, repeat_disable;
uniform bool has_shoreline = false;
uniform vec4 deep_water : source_color = vec4(0.037, 0.24, 0.36, 1.0);
uniform vec4 blue_water : source_color = vec4(0.055, 0.38, 0.49, 1.0);
uniform vec4 shallows : source_color = vec4(0.28, 0.63, 0.60, 1.0);
uniform vec4 wash : source_color = vec4(0.65, 0.83, 0.78, 1.0);

varying vec2 water_point;
varying vec3 camera_ray;

void vertex() {
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	water_point = world.xz;
	camera_ray = CAMERA_POSITION_WORLD - world;
}

float hash_at(vec2 p) {
	vec3 value = fract(p.xyx * 0.1031);
	value += dot(value, value.yzx + 33.33);
	return fract((value.x + value.y) * value.z);
}

float soft_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 blend = smoothstep(vec2(0.0), vec2(1.0), fract(p));
	return mix(
		mix(hash_at(cell), hash_at(cell + vec2(1.0, 0.0)), blend.x),
		mix(hash_at(cell + vec2(0.0, 1.0)), hash_at(cell + vec2(1.0)), blend.x),
		blend.y
	);
}

void fragment() {
	vec2 p = water_point;
	vec2 map_point = (p / vec2(26.0, 16.0) + 0.5) * vec2(1920.0, 1080.0);
	// The coast field extends 320 × 264 map pixels beyond the board.
	vec2 map_uv = (map_point + vec2(320.0, 264.0)) / vec2(2560.0, 1608.0);
	float distance_to_shore = 1.0;
	if (has_shoreline && all(greaterThanEqual(map_uv, vec2(0.0))) && all(lessThanEqual(map_uv, vec2(1.0)))) {
		distance_to_shore = texture(shoreline, map_uv).r;
	}
	float drift = soft_noise(p * 0.43 + vec2(-TIME * 0.026, TIME * 0.013));
	float variation = soft_noise(p * 1.25 + vec2(TIME * 0.035, 0.0));
	vec2 direction_a = vec2(2.25, 5.82);
	vec2 direction_b = vec2(-4.40, 3.52);
	vec2 direction_c = vec2(1.40, -10.80);
	float wave_a = dot(p, direction_a) - TIME * 1.28 + drift * 6.7;
	float wave_b = dot(p, direction_b) + TIME * 0.93 + variation * 4.0;
	float wave_c = dot(p, direction_c) - TIME * 1.73 + (variation + drift) * 4.2;
	float distance_filter = 1.0 - smoothstep(0.48, 1.45, fwidth(wave_c));
	vec2 slope = cos(wave_a) * direction_a * (0.006 + 0.005 * variation)
		+ cos(wave_b) * direction_b * 0.006
		+ cos(wave_c) * direction_c * 0.0039 * distance_filter;
	vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
	vec3 reflected = normalize(normalize(camera_ray) + normalize(vec3(-0.43, 0.74, -0.21)));
	float glint = pow(max(dot(normal, reflected), 0.0), 27.0);
	float swell = 0.42 + 0.29 * drift + 0.12 * variation + sin(wave_a) * 0.04 + sin(wave_b) * 0.03;
	vec3 water = mix(deep_water.rgb, blue_water.rgb, swell);
	float shelf = 1.0 - smoothstep(0.014, 0.54 + drift * 0.33, distance_to_shore);
	water = mix(water, shallows.rgb, shelf * (0.55 + 0.21 * variation));
	float break_phase = distance_to_shore * 102.0 - TIME * 0.95 + variation * 1.9;
	float breakers = smoothstep(0.70, 0.99, sin(break_phase))
		* (1.0 - smoothstep(0.008, 0.095, distance_to_shore))
		* smoothstep(0.31, 0.76, variation);
	float lace = (1.0 - smoothstep(0.005, 0.021, distance_to_shore))
		* (0.27 + 0.36 * variation);
	float crests = smoothstep(1.25, 2.32, sin(wave_a) + sin(wave_b) + sin(wave_c) * 0.52)
		* (0.20 + variation * 0.80) * distance_filter;
	float sheen = min(0.40, breakers * 0.32 + lace + glint * 0.20 + crests * 0.25);
	ALBEDO = mix(water, wash.rgb, sheen);
}
