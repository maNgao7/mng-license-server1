extends Control

const LAST_TICK := 10
const VOICE_BUS := &"Fetih Countdown Voice"
const GOLD := Color("#ecc77e")
const IVORY := Color("#fff1d3")
const INK := Color("#102421")
const TICK_POP_SECONDS := 0.20

var _count := 0
var _center := Vector2.ZERO
var _radius := 0.0
var _pop_elapsed := 0.0
var _number := Label.new()
var _voice := AudioStreamPlayer.new()
var _clips: Array[AudioStreamOggVorbis] = []

func configure(_owner_app: Node) -> void:
	if not _clips.is_empty():
		return
	name = "CountryCountdown"
	mouse_filter = MOUSE_FILTER_IGNORE
	focus_mode = FOCUS_NONE
	var serif := SystemFont.new()
	serif.font_names = PackedStringArray(["Georgia", "Cambria", "Noto Serif"])
	serif.font_weight = 700
	_number.mouse_filter = MOUSE_FILTER_IGNORE
	_number.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_number.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_number.add_theme_font_override("font", serif)
	_number.add_theme_color_override("font_color", IVORY)
	_number.add_theme_color_override("font_outline_color", INK)
	_number.add_theme_constant_override("outline_size", 3)
	add_child(_number)

	if AudioServer.get_bus_index(VOICE_BUS) < 0:
		AudioServer.add_bus()
		var index := AudioServer.bus_count - 1
		AudioServer.set_bus_name(index, VOICE_BUS)
		AudioServer.set_bus_send(index, &"Master")
	_voice.name = "Voice"
	_voice.bus = VOICE_BUS
	_voice.volume_db = -1.0
	add_child(_voice)
	_clips.resize(LAST_TICK + 1)
	for tick in range(1, LAST_TICK + 1):
		_clips[tick] = load("res://assets/audio/country-countdown/%d.ogg" % tick)
	resized.connect(_layout)
	_layout()
	hide()
	set_process(false)

func set_count(value: int) -> void:
	if _clips.is_empty():
		return
	var next := value if value >= 1 and value <= LAST_TICK else 0
	if next == _count:
		return
	_count = next
	_voice.stop()
	if _count == 0:
		hide()
		set_process(false)
		return
	_number.text = str(_count)
	_number.scale = Vector2.ONE * 0.91
	_pop_elapsed = 0.0
	show()
	set_process(true)
	if _clips[_count] != null:
		_voice.stream = _clips[_count]
		_voice.play()

func _layout() -> void:
	_center = Vector2(size.x * 0.5, size.y * 0.42)
	_radius = clampf(minf(size.x, size.y) * 0.087, 12.0, 86.0)
	_number.add_theme_font_size_override("font_size", roundi(_radius * 1.16))
	_number.size = Vector2(_radius * 2.0, _radius * 1.70)
	_number.position = _center - _number.size * 0.5 + Vector2(0.0, _radius * 0.045)
	_number.pivot_offset = _number.size * 0.5
	queue_redraw()

func _process(delta: float) -> void:
	_pop_elapsed += delta
	var settle := smoothstep(0.0, TICK_POP_SECONDS, _pop_elapsed)
	_number.scale = Vector2.ONE * lerpf(0.91, 1.0, settle)
	if _pop_elapsed >= TICK_POP_SECONDS:
		set_process(false)

func _draw() -> void:
	var r := _radius
	if r <= 0.0:
		return
	draw_circle(_center + Vector2(0.0, r * 0.08), r * 1.04, Color(0.02, 0.05, 0.05, 0.50), true, -1.0, true)
	draw_circle(_center, r, Color(INK, 0.96), true, -1.0, true)
	draw_arc(_center, r, 0.0, TAU, 72, GOLD, maxf(1.0, r * 0.026), true)
	draw_arc(_center, r * 0.90, 0.0, TAU, 72, Color(GOLD, 0.40), 1.0, true)
	var crown := _center - Vector2(0.0, r * 0.86)
	draw_circle(crown, r * 0.25, INK, true, -1.0, true)
	var rosette := PackedVector2Array()
	for point in range(32):
		var angle := float(point) * TAU / 32.0 - PI * 0.5
		var petal := (1.0 + cos(float(point) * PI * 0.5)) * 0.5
		rosette.append(crown + Vector2.from_angle(angle) * r * lerpf(0.106, 0.198, petal))
	draw_colored_polygon(rosette, GOLD)
	draw_circle(crown, r * 0.065, Color("#347365"), true, -1.0, true)
