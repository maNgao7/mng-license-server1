shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

// 0: territory fill, 1: boundary ribbon, 2: billboard number badge.
uniform int surface_layer = 0;
uniform vec4 edge_ink : source_color = vec4(0.094, 0.090, 0.067, 1.0);
uniform vec4 accent_color : source_color = vec4(1.0, 0.96, 0.79, 1.0);
uniform float border_scale = 1.0;
uniform float hover_lift = 0.0;
uniform vec4 old_color : source_color = vec4(0.87, 0.84, 0.76, 1.0);
uniform vec4 next_color : source_color = vec4(0.87, 0.84, 0.76, 1.0);
uniform float progress = 1.0;
uniform vec2 region_min;
uniform vec2 region_size;
uniform vec2 portrait_center;
uniform vec2 portrait_size;
uniform sampler2D portrait_texture : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform bool has_portrait = false;
uniform float portrait_strength = 0.0;
uniform vec2 portrait_ratio = vec2(1.0);
uniform bool contested = false;
uniform float front_opacity = 0.0;
uniform vec2 front_direction = vec2(1.0, 0.0);
uniform float front_threshold = 0.0;
uniform vec4 attack_color : source_color;
uniform bool atlas_relief = false;
uniform bool atlas_neutral = false;

float atlas_hash(vec2 p) {
	vec3 value = fract(p.xyx * 0.1031);
	value += dot(value, value.yzx + 33.33);
	return fract((value.x + value.y) * value.z);
}

float atlas_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 w = smoothstep(vec2(0.0), vec2(1.0), fract(p));
	return mix(mix(atlas_hash(cell), atlas_hash(cell + vec2(1.0, 0.0)), w.x),
		mix(atlas_hash(cell + vec2(0.0, 1.0)), atlas_hash(cell + 1.0), w.x), w.y);
}

vec3 sample_portrait(vec2 uv) {
	vec3 photo = texture(portrait_texture, uv, -0.5).rgb;
	vec2 dimensions = vec2(textureSize(portrait_texture, 0));
	vec2 footprint = fwidth(uv) * dimensions;
	float detail = 1.0 - smoothstep(0.35, 0.85, max(footprint.x, footprint.y));
	if (detail > 0.0 && min(dimensions.x, dimensions.y) < 384.0) {
		vec2 texel = 1.0 / max(dimensions, vec2(1.0));
		vec2 horizontal = vec2(texel.x, 0.0);
		vec2 vertical = vec2(0.0, texel.y);
		vec3 surrounding = (textureLod(portrait_texture, uv - horizontal, 0.0).rgb
			+ textureLod(portrait_texture, uv + horizontal, 0.0).rgb
			+ textureLod(portrait_texture, uv - vertical, 0.0).rgb
			+ textureLod(portrait_texture, uv + vertical, 0.0).rgb) * 0.25;
		photo += clamp(photo - surrounding, vec3(-0.18), vec3(0.18)) * (0.32 * detail);
	}
	return clamp(photo, vec3(0.0), vec3(1.0));
}

void vertex() {
	if (surface_layer == 1) {
		VERTEX.xz += UV2 * (border_scale - 1.0);
	} else if (surface_layer == 2) {
		// Keep the shared quad aligned with the Label3D billboard through camera rotation.
		MODELVIEW_MATRIX = mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0),
			vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0),
			vec4(0.0, 0.0, 1.0, 0.0), MODELVIEW_MATRIX[3]);
	}
}

vec3 territory_fill(vec2 uv) {
	vec2 map_point = uv * vec2(1920.0, 1080.0);
	vec2 region_uv = (map_point - region_min) / max(region_size, vec2(0.001));
	float radial = length(region_uv - vec2(0.5));
	float reveal = 1.0 - smoothstep(progress * 0.76, progress * 0.76 + 0.035, radial);
	vec3 color = mix(old_color.rgb, next_color.rgb, reveal);
	if (atlas_relief) {
		float elevation = atlas_noise(uv * vec2(22.0, 16.0)) + atlas_noise(uv * 101.0) * 0.26;
		float lines = pow(0.5 + 0.5 * sin(elevation * 43.98), 5.0);
		if (atlas_neutral) {
			float green = 1.0 - smoothstep(0.32, 0.62, uv.y + elevation * 0.12);
			color = mix(color, color * vec3(0.82, 0.96, 0.81), green * 0.82);
			color = mix(color, color * vec3(0.96, 0.85, 0.73), smoothstep(0.82, 1.14, elevation) * 0.65);
		}
		color *= 0.95 + elevation * 0.092 - lines * 0.025;
	}
	if (has_portrait && portrait_strength > 0.0) {
		vec2 owner_uv = (map_point - portrait_center) / max(portrait_size, vec2(0.001));
		vec2 photo_uv = owner_uv * portrait_ratio + vec2(0.5);
		// The territory mesh clips the photograph at the painted boundary.
		vec3 photo = sample_portrait(photo_uv);
		color = mix(color, photo, portrait_strength * reveal);
	}
	if (contested) {
		float captured = 1.0 - smoothstep(front_threshold - 2.0, front_threshold + 2.0, dot(map_point, front_direction));
		float stripe = smoothstep(0.38, 0.48, fract((map_point.x + map_point.y) / 12.0));
		vec3 occupied = mix(color, attack_color.rgb, 0.75);
		occupied = mix(occupied, vec3(0.09, 0.10, 0.11), stripe * 0.22);
		color = mix(color, occupied, captured * front_opacity);
	}
	return mix(color, accent_color.rgb, hover_lift);
}

void fragment() {
	if (surface_layer == 1) {
		float across = abs(UV.x);
		float antialias = max(fwidth(across) * 0.38, 0.008);
		float trim = 1.0 - smoothstep(0.60 - antialias, 0.60 + antialias, across);
		ALBEDO = mix(edge_ink.rgb, accent_color.rgb, border_scale > 1.0 ? trim : 0.0);
	} else if (surface_layer == 2) {
		// Cut corners, a shallow pennant point, and a contrasting ink keyline.
		float side = abs(UV.x * 2.0 - 1.0);
		float tip = 0.99 - side * 0.23;
		float bevel = side + max(0.18 - UV.y, 0.0) * 1.5;
		if (side > 0.98 || UV.y < 0.04 || UV.y > tip || bevel > 1.0) {
			discard;
		}
		if (side > 0.90 || UV.y < 0.115 || UV.y > tip - 0.085 || bevel > 0.92) {
			ALBEDO = edge_ink.rgb;
		} else {
			float trim = step(UV.y, 0.155) + step(tip - 0.15, UV.y);
			vec3 face = accent_color.rgb;
			vec3 embroidery = mix(face, vec3(1.0, 0.90, 0.59), border_scale > 1.0 ? 0.9 : 0.48);
			ALBEDO = mix(face, embroidery, min(trim, 1.0));
		}
	} else {
		ALBEDO = territory_fill(UV);
	}
}
