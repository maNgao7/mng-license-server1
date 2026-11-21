extends PanelContainer

const DISPLAY_SECONDS := 1.4
const IMPACT_SECONDS := 0.46
const PRESENTATION_BUS := &"TikMnG Presentation"
const PROXIMITY := preload("JetAudio.gd")

# Code-native, screen-space metalwork: two swords, 20 bounded spark streaks,
# no textures, collision objects, map transforms or gameplay timers.
class SwordClash extends Node2D:
	var swing := 0.0
	var time := 0.0

	func _draw() -> void:
		for i in 8:
			draw_circle(Vector2(0, 12), 62.0 + i * 11.0, Color(0.025, 0.055, 0.065, 0.025))
		var approach := clampf(swing, 0.0, 1.0)
		for side in [-1.0, 1.0]:
			var grip := Vector2(side * lerpf(114.0, 73.0, approach), lerpf(98.0, 76.0, approach))
			var angle: float = -side * deg_to_rad(lerpf(-30.0, 44.0, approach))
			draw_set_transform(grip, angle)
			_sword(side)
		draw_set_transform(Vector2.ZERO)
		var impact_age := time - IMPACT_SECONDS
		if impact_age < 0.0 or impact_age > 0.52:
			return
		var flash := exp(-impact_age * 32.0)
		for i in 4:
			draw_circle(Vector2(0, 1), 5.0 + i * 7.0, Color(1.0, 0.84, 0.50, flash * 0.15))
		for i in 20:
			var angle := float(i) * 2.39996 + 0.17
			var speed := 105.0 + float((i * 37) % 130)
			var direction := Vector2(cos(angle), sin(angle))
			var at := Vector2(0, 1) + direction * (4.0 + impact_age * speed)
			at.y += 115.0 * impact_age * impact_age
			var alpha := pow(maxf(0.0, 1.0 - impact_age / 0.52), 1.6)
			draw_line(at - direction * (3.0 + 12.0 * alpha), at,
				Color(1.0, 0.63 + (i % 3) * 0.10, 0.26, alpha), 1.7, true)
			draw_circle(at, 1.1, Color(1.0, 0.94, 0.72, alpha))

	func _sword(side: float) -> void:
		var tip := Vector2(0, -192)
		var edge := Color("#e8f2f6")
		var bright := Color("#c9d9e2")
		var steel := Color("#718793")
		var shade := Color("#354956")
		# A tapered blade with bevels, raised central ridge and a dark fuller.
		draw_colored_polygon(PackedVector2Array([Vector2(-13, 3), Vector2(-11, -153), tip,
			Vector2(11, -153), Vector2(13, 3)]), Color("#17252f"))
		draw_polygon(PackedVector2Array([Vector2(-12, 0), Vector2(-10, -153), tip, Vector2(-6, -149), Vector2(-7, 0)]),
			PackedColorArray([edge, bright, edge, steel, steel]))
		draw_polygon(PackedVector2Array([Vector2(-7, 0), Vector2(-6, -149), tip, Vector2(0, -145), Vector2(0, 0)]),
			PackedColorArray([steel, bright, edge, bright, bright]))
		draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(0, -145), tip, Vector2(7, -151), Vector2(8, 0)]),
			PackedColorArray([shade, steel, edge, bright, steel]))
		draw_polygon(PackedVector2Array([Vector2(8, 0), Vector2(7, -151), tip, Vector2(10, -153), Vector2(12, 0)]),
			PackedColorArray([bright, bright, edge, shade, edge]))
		draw_line(Vector2(2, -18), Vector2(2, -136), Color("#405965"), 1.4, true)
		draw_line(Vector2(-2, -22), Vector2(-2, -137), Color("#f1f6f5"), 0.8, true)
		var gleam := -40.0 - 108.0 * fposmod(time * 0.85 + (0.2 if side > 0 else 0.0), 1.0)
		draw_line(Vector2(-8, gleam + 7), Vector2(8, gleam - 5), Color(0.94, 0.98, 1.0, 0.65), 2.2, true)
		# Cast brass crossguard, blued collars, wrapped leather and a faceted pommel.
		var guard := PackedVector2Array([Vector2(-36, 5), Vector2(-33, -4), Vector2(-17, -8),
			Vector2(0, -5), Vector2(17, -8), Vector2(33, -4), Vector2(36, 5),
			Vector2(29, 8), Vector2(16, 2), Vector2(0, 4), Vector2(-16, 2), Vector2(-29, 8)])
		draw_colored_polygon(guard, Color("#8f7146"))
		draw_polyline(PackedVector2Array([Vector2(-33, -2), Vector2(-17, -6), Vector2(0, -3),
			Vector2(17, -6), Vector2(33, -2)]), Color("#efd4a0"), 1.8, true)
		draw_rect(Rect2(-8, 6, 16, 43), Color("#1b252a"))
		draw_rect(Rect2(-5, 10, 10, 35), Color("#523e35"))
		for i in 7:
			draw_line(Vector2(-6, 12 + i * 4.8), Vector2(6, 8 + i * 4.8), Color("#99816a"), 1.3, true)
		for y in [7.0, 45.0]:
			draw_rect(Rect2(-9, y, 18, 4), Color("#bb9861"))
		draw_colored_polygon(PackedVector2Array([Vector2(-8, 49), Vector2(-12, 57), Vector2(0, 65),
			Vector2(12, 57), Vector2(8, 49)]), Color("#a98b5b"))
		draw_line(Vector2(-8, 52), Vector2(0, 61), Color("#f1d7a3"), 2.0, true)

var app: Node
var board: Control
var message: Label
var photos: Array[TextureRect] = []
var badges: Array[Label] = []
var active: Array[String] = []
var queue: Array[Array] = []
var age := 0.0
var refresh_left := 0.0
var clash := SwordClash.new()
var clash_audio := AudioStreamPlayer.new()
var _swing_tween: Tween
var _impact_played := false
var _sound_cooldown_until := 0

func configure(owner_app: Node, canvas: Control) -> void:
	app = owner_app
	board = canvas
	name = "WarNotice"
	z_index = 40
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", app.box_style(Color("#14242d", 0.97), app.GOLD, 10))
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 14)
	add_child(row)
	_make_side(row, "Saldıran", Color("#ff9c88"))
	message = app.text(row, "", 17, app.WHITE)
	message.mouse_filter = Control.MOUSE_FILTER_IGNORE
	message.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	message.custom_minimum_size.x = 280.0
	message.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	message.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_make_side(row, "Savunan", Color("#85e0d5"))
	clash.name = "CentralSwordClash"
	add_child(clash)
	clash_audio.name = "SteelClash"
	clash_audio.bus = preload("MissileAudio.gd").connect_game_fx_bus(&"TikMnG Clash")
	clash_audio.volume_db = -9.0
	clash_audio.stream = load_presentation_audio(app.mod_root, "steel-clash.ogg")
	add_child(clash_audio)
	board.resized.connect(_layout)
	_layout()
	hide()

func _make_side(row: HBoxContainer, role: String, tint: Color) -> void:
	var frame := PanelContainer.new()
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.custom_minimum_size.x = 90.0
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var style: StyleBoxFlat = app.box_style(app.BG.lerp(tint, 0.14), tint.darkened(0.28), 6)
	for edge in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		style.set_content_margin(edge, 5.0)
	frame.add_theme_stylebox_override("panel", style)
	row.add_child(frame)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(column)
	var heading: Label = app.text(column, role, 14, tint)
	heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var portrait := Control.new()
	portrait.custom_minimum_size = Vector2(55, 55)
	portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(portrait)
	var photo := TextureRect.new()
	photo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	photo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	photo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	photo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	portrait.add_child(photo)
	photo.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	photos.append(photo)
	var badge: Label = app.text(portrait, "", 22, tint)
	badge.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badges.append(badge)

func _layout() -> void:
	size = Vector2(maxf(280.0, minf(620.0, board.size.x - 24.0)), 80.0)
	global_position = board.global_position + Vector2((board.size.x - size.x) * 0.5, 12.0)
	clash.position = board.global_position + board.size * 0.5 - global_position
	clash.scale = Vector2.ONE * clampf(minf(board.size.x / 900.0, board.size.y / 650.0), 0.5, 1.25)

func show_attack(attacker: String, defender: String) -> void:
	# Every accepted order starts now, even during a burst of orders. Never queue
	# a stale clash until after deployment. The newest pair remains identified.
	queue.clear()
	queue.append([attacker, defender])
	_next()

func clear() -> void:
	if _swing_tween != null:
		_swing_tween.kill()
	clash_audio.stop()
	queue.clear()
	active.clear()
	hide()

func _next() -> void:
	if _swing_tween != null:
		_swing_tween.kill()
	if queue.is_empty():
		active.clear()
		hide()
		return
	active.assign(queue.pop_front())
	age = 0.0
	refresh_left = 0.0
	_impact_played = false
	clash.swing = 0.0
	clash.time = 0.0
	modulate.a = 1.0
	_swing_tween = create_tween()
	_swing_tween.tween_property(clash, "swing", 1.0, IMPACT_SECONDS).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
	_swing_tween.tween_property(clash, "swing", 0.91, 0.13).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_swing_tween.tween_property(clash, "swing", 1.0, 0.18).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var a: Dictionary = app.player_view(active[0])
	var b: Dictionary = app.player_view(active[1])
	var names: Array[String] = []
	for player in [a, b]:
		var username := str(player.username)
		if username.is_empty():
			username = str(player.nickname)
		if username.is_empty():
			username = str(player.id)
		names.append(username.left(32))
	message.text = "@%s\n@%s kişisine savaş açtı." % names
	_layout()
	show()
	_refresh_portraits()

func _process(delta: float) -> void:
	var listener := PROXIMITY.audible_camera(board)
	if listener == null and clash_audio.playing:
		clash_audio.stop()
	if active.is_empty():
		return
	age += delta
	if age >= DISPLAY_SECONDS:
		_next()
		return
	modulate.a = clampf((DISPLAY_SECONDS - age) / 0.22, 0.0, 1.0)
	clash.time = age
	clash.queue_redraw()
	if not _impact_played and age >= IMPACT_SECONDS:
		_impact_played = true
		if listener != null and clash_audio.stream != null and Time.get_ticks_msec() >= _sound_cooldown_until:
			clash_audio.play()
			_sound_cooldown_until = Time.get_ticks_msec() + 700
	refresh_left -= delta
	if refresh_left > 0.0:
		return
	refresh_left = 0.125
	_refresh_portraits()

func _refresh_portraits() -> void:
	for index in 2:
		var id := active[index]
		photos[index].texture = app.avatar_for(id)
		badges[index].visible = photos[index].texture == null
		badges[index].text = str(app.player_view(id).number)

static func presentation_bus() -> StringName:
	if AudioServer.get_bus_index(PRESENTATION_BUS) < 0:
		AudioServer.add_bus()
		var index := AudioServer.bus_count - 1
		AudioServer.set_bus_name(index, PRESENTATION_BUS)
		AudioServer.set_bus_send(index, &"Master")
	return PRESENTATION_BUS

# Shared by StartupScreen: exported resources must use ResourceLoader; the
# native Steam mod runs outside res:// and needs the local Vorbis loader.
static func load_presentation_audio(mod_root: String, file: String) -> AudioStreamOggVorbis:
	var path := mod_root.path_join("../assets/audio/presentation").simplify_path().path_join(file)
	if path.begins_with("res://"):
		return load(path) as AudioStreamOggVorbis if ResourceLoader.exists(path) else null
	return AudioStreamOggVorbis.load_from_file(path) if FileAccess.file_exists(path) else null
