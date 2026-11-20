extends Control

const DURATION := 6.8
const VOICE_START := 1.0
const GOLD := Color("#f4ca75")
const INK := Color("#0a1d1e")
const IVORY := Color("#fff0cb")
const ART := "country-victory.webp"
const PORTRAIT_SHADER := """
shader_type canvas_item;
uniform vec2 crop = vec2(1.0);
varying vec4 draw_tint;
void vertex() {
	draw_tint = COLOR;
}
void fragment() {
	vec4 tint = draw_tint;
	vec4 portrait = texture(TEXTURE, (UV - vec2(0.5)) * crop + vec2(0.5));
	float circle = 1.0 - smoothstep(0.485, 0.5, length(UV - vec2(0.5)));
	COLOR = vec4(portrait.rgb * tint.rgb, circle * portrait.a * tint.a);
}
"""

var app: Node
var artwork := TextureRect.new()
var portrait := TextureRect.new()
var title := Label.new()
var player_name := Label.new()
var record := Label.new()
var initials := Label.new()
var music := AudioStreamPlayer.new()
var voice := AudioStreamPlayer.new()
var serif := SystemFont.new()
var portrait_mask := ShaderMaterial.new()
var player_id := ""
var age := 0.0
var voice_played := false
var center := Vector2.ZERO
var radius := 0.0
var dust: Array[Vector3] = []

func configure(owner_app: Node) -> void:
	app = owner_app
	name = "CountryVictory"
	mouse_filter = MOUSE_FILTER_STOP
	serif.font_names = PackedStringArray(["Georgia", "Cambria", "Noto Serif"])
	serif.font_weight = 700
	var part := Shader.new()
	part.code = PORTRAIT_SHADER
	portrait_mask.shader = part
	for picture in [artwork, portrait]:
		picture.mouse_filter = MOUSE_FILTER_IGNORE
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	artwork.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.material = portrait_mask
	add_child(artwork)
	# Draw the particles and medallion above the artwork and below the portrait.
	artwork.show_behind_parent = true
	add_child(portrait)
	for label in [title, player_name, record, initials]:
		label.mouse_filter = MOUSE_FILTER_IGNORE
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.clip_text = true
		label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		label.add_theme_color_override("font_shadow_color", Color("#030b0b", 0.85))
		label.add_theme_constant_override("shadow_offset_y", 3)
		add_child(label)
	title.add_theme_font_override("font", serif)
	title.add_theme_color_override("font_color", GOLD)
	player_name.add_theme_font_override("font", serif)
	player_name.add_theme_color_override("font_color", IVORY)
	record.add_theme_font_override("font", app.ui_font)
	record.add_theme_color_override("font_color", GOLD)
	initials.add_theme_font_override("font", serif)
	initials.add_theme_color_override("font_color", GOLD)
	add_child(music)
	add_child(voice)
	music.volume_db = -8.0
	voice.volume_db = -1.0
	var rng := RandomNumberGenerator.new()
	rng.seed = 716
	for i in 40:
		dust.append(Vector3(rng.randf(), rng.randf(), rng.randf()))
	resized.connect(_layout)
	hide()
	set_process(false)

func show_winner(id: String, display_name: String, map_name: String, held_regions: int, region_count: int, wins: int) -> void:
	if artwork.texture == null:
		artwork.texture = load("res://assets/art/" + ART)
	if music.stream == null:
		music.stream = _audio("country-victory.ogg")
	if voice.stream == null:
		voice.stream = _audio("country-victory-voice.ogg")
	player_id = id
	age = 0.0
	voice_played = false
	title.text = "FETİH"
	player_name.text = display_name
	record.text = "%s  ·  %d/%d bölge  ·  ×%d zafer" % [map_name, held_regions, region_count, wins]
	initials.text = display_name.lstrip("@").left(2).to_upper()
	portrait.texture = null
	_update_portrait()
	_layout()
	modulate.a = 0.0
	show()
	set_process(true)
	if music.stream != null:
		music.volume_db = -8.0
		music.play()

func _audio(file: String) -> AudioStreamOggVorbis:
	return load("res://assets/audio/" + file) as AudioStreamOggVorbis

func _update_portrait() -> void:
	var texture: Texture2D = app.avatar_for(player_id)
	if texture != portrait.texture:
		portrait.texture = texture
		if texture != null:
			var extent := texture.get_size()
			var side := minf(extent.x, extent.y)
			portrait_mask.set_shader_parameter("crop", Vector2(side / extent.x, side / extent.y))
	initials.visible = portrait.texture == null

func dismiss() -> void:
	music.stop()
	voice.stop()
	hide()
	set_process(false)

func _layout() -> void:
	center = Vector2(size.x * 0.5, size.y * 0.377)
	radius = minf(size.y * 0.148, size.x * 0.152)
	var span := minf(size.x * 0.66, size.y * 1.28)
	var top := center.y + radius * 1.28
	_set_label(title, span, top, radius * 0.50, 0.72)
	_set_label(player_name, span, top + radius * 0.76, radius * 0.37, 0.58)
	_set_label(record, span, top + radius * 1.40, radius * 0.19, 0.34)
	_set_label(initials, radius * 1.65, center.y - radius * 0.6, radius * 0.58, 1.2)
	portrait.size = Vector2.ONE * radius * 1.87
	portrait.position = center - portrait.size * 0.5
	portrait.pivot_offset = portrait.size * 0.5
	queue_redraw()

func _set_label(label: Label, span: float, y: float, font_size: float, height_ratio: float) -> void:
	label.add_theme_font_size_override("font_size", maxi(10, roundi(font_size)))
	label.position = Vector2((size.x - span) * 0.5, y)
	label.size = Vector2(span, radius * height_ratio)
	label.pivot_offset = label.size * 0.5

func _process(delta: float) -> void:
	age += delta
	if age >= DURATION:
		dismiss()
		return
	if not voice_played and age >= VOICE_START:
		voice_played = true
		if voice.stream != null:
			voice.play()
	var cue_pending := not voice_played and age >= VOICE_START - 0.25
	var announcing := voice.stream != null and (cue_pending or voice.playing)
	music.volume_db = lerpf(music.volume_db, -18.0 if announcing else -8.0,
		1.0 - exp(-delta * 8.0))
	_update_portrait()
	var entry := smoothstep(0.06, 0.82, age)
	modulate.a = smoothstep(0.0, 0.46, age) * (1.0 - smoothstep(5.60, DURATION, age))
	var overscan := 1.046 - 0.046 * smoothstep(0.0, 4.8, age)
	artwork.size = size * overscan
	artwork.position = (size - artwork.size) * 0.5
	portrait.modulate.a = entry
	portrait.scale = Vector2.ONE * lerpf(0.88, 1.0, entry)
	initials.modulate.a = entry
	title.modulate.a = smoothstep(0.78, 1.24, age)
	title.scale = Vector2.ONE * lerpf(0.90, 1.0, title.modulate.a)
	player_name.modulate.a = smoothstep(1.16, 1.72, age)
	record.modulate.a = smoothstep(1.52, 2.0, age)
	queue_redraw()

func _draw() -> void:
	if artwork.texture == null:
		draw_rect(Rect2(Vector2.ZERO, size), INK)
	for star in dust:
		var point := Vector2(star.x * size.x, fposmod(star.y - age * (0.033 + star.z * 0.02), 1.0) * size.y)
		var flicker := pow(0.5 + 0.5 * sin(age * (1.8 + star.z * 3.1) + star.y * TAU), 2.0)
		draw_circle(point, 0.8 + 2.0 * star.z, Color(GOLD, flicker * 0.64), true, -1.0, true)
	var reveal := smoothstep(0.06, 0.82, age)
	var r := radius * lerpf(0.88, 1.0, reveal)
	draw_circle(center, r * 1.05, Color(INK, reveal), true, -1.0, true)
	draw_arc(center, r * 0.973, 0.0, TAU, 96, Color(GOLD, reveal), maxf(2.0, r * 0.039), true)
	draw_arc(center, r * 1.063, 0.0, TAU, 96, Color(GOLD, reveal * 0.66), maxf(1.0, r * 0.014), true)
	var pulse := smoothstep(0.84, 1.9, age)
	if pulse > 0.0 and pulse < 1.0:
		draw_arc(center, r * lerpf(1.06, 1.55, pulse), 0.0, TAU, 96,
			Color(IVORY, 0.38 * (1.0 - pulse)), maxf(1.0, radius * 0.015), true)
	var gleam := -PI / 2.0 + age * 0.91
	draw_arc(center, r * 1.063, gleam, gleam + 0.53, 24, Color(IVORY, reveal), maxf(1.5, r * 0.018), true)
	for ray in 4:
		var direction := Vector2.from_angle(ray * PI / 2.0 - PI / 4.0)
		var jewel := center + direction * r * 1.108
		var sideways := direction.orthogonal()
		var spread := r * 0.054
		draw_colored_polygon(PackedVector2Array([
			jewel - direction * spread, jewel + sideways * spread * 0.58,
			jewel + direction * spread, jewel - sideways * spread * 0.58
		]), Color(GOLD, reveal))
