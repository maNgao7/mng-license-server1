extends Control

const BACKGROUND := Color("#07151b")
const GOLD := Color("#e0b477")
const TITLE := Color("#f7deb1")
const TRACK := Color("#573f32")
const LOADING_BUS := &"TikMnG Loading"
const PresentationAudio := preload("WarNotice.gd")

var artwork: Texture2D
var title: Label
var status: Label
var progress := 0.045
var progress_target := 0.28
var music := AudioStreamPlayer.new()

func _ready() -> void:
	name = "FetihLoading"
	mouse_filter = Control.MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_start_music()
	visibility_changed.connect(_sync_music)
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Georgia", "Cambria", "Times New Roman"])
	font.font_weight = 700
	title = Label.new()
	title.text = "FETİH"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_font_override("font", font)
	title.add_theme_color_override("font_color", TITLE)
	title.add_theme_color_override("font_outline_color", Color("#111b21"))
	title.add_theme_constant_override("outline_size", 5)
	add_child(title)
	var status_font := SystemFont.new()
	status_font.font_names = PackedStringArray(["Segoe UI", "Arial"])
	status_font.font_weight = 600
	status = Label.new()
	status.text = "Oyun motoru açılıyor…"
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.add_theme_font_override("font", status_font)
	status.add_theme_color_override("font_color", Color("#f8ebd7"))
	status.add_theme_color_override("font_outline_color", Color("#111b21"))
	status.add_theme_constant_override("outline_size", 4)
	add_child(status)
	resized.connect(_arrange)
	_arrange()

func _arrange() -> void:
	var scale_factor := clampf(minf(size.x / 1200.0, size.y / 675.0), 0.65, 1.65)
	var title_size := roundi(104.0 * scale_factor)
	title.add_theme_font_size_override("font_size", title_size)
	var title_height := float(title_size) * 1.46
	title.position = Vector2(0.0, size.y * 0.345 - title_height * 0.5)
	title.size = Vector2(size.x, title_height)
	status.add_theme_font_size_override("font_size", roundi(16.0 * scale_factor))
	status.position = Vector2(0.0, size.y * 0.505)
	status.size = Vector2(size.x, 35.0 * scale_factor)
	queue_redraw()

func loading_stage(stage: int) -> void:
	progress_target = [0.28, 0.56, 0.88, 1.0][stage - 1]
	status.text = ["Oyun motoru açılıyor…", "Fetih hazırlanıyor…", "Harita yükleniyor…", "Oyun hazır"][stage - 1]

func _process(delta: float) -> void:
	progress = move_toward(progress, progress_target, delta * (3.6 if progress_target == 1.0 else 0.95))
	queue_redraw()
	# Follow the existing visual exit fade without touching game audio or Master.
	music.volume_db = -6.0 + linear_to_db(maxf(0.00001, modulate.a))

func _start_music() -> void:
	if AudioServer.get_bus_index(LOADING_BUS) < 0:
		AudioServer.add_bus()
		var index := AudioServer.bus_count - 1
		AudioServer.set_bus_name(index, LOADING_BUS)
		AudioServer.set_bus_send(index, &"Master")
	music.name = "LoadingMusic"
	music.bus = LOADING_BUS
	music.volume_db = -6.0
	music.stream = PresentationAudio.load_presentation_audio(get_script().resource_path.get_base_dir(), "loading-ottoman.ogg")
	if music.stream != null:
		music.stream.loop = true
	else:
		push_warning("Fetih yükleme müziği bulunamadı; yükleme devam ediyor.")
	add_child(music)
	_sync_music()

func _sync_music() -> void:
	if is_visible_in_tree() and music.stream != null:
		if not music.playing:
			music.play()
	else:
		music.stop()

func _exit_tree() -> void:
	music.stop()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), BACKGROUND)
	if artwork != null:
		var source := artwork.get_size()
		var extent := source * minf(size.x / source.x, size.y / source.y)
		draw_texture_rect(artwork, Rect2((size - extent) * 0.5, extent), false)
	var width := clampf(size.x * 0.215, 112.0, 355.0)
	var middle := Vector2(size.x * 0.5, size.y * 0.49)
	var left := middle - Vector2(width * 0.5, 0.0)
	var right := left + Vector2(width, 0.0)
	draw_line(left, right, TRACK.darkened(0.59), 8.0, true)
	draw_line(left, right, TRACK.lightened(0.14), 4.0, true)
	draw_line(left, left.lerp(right, progress), GOLD, 5.0, true)
	for point in [left, right]:
		draw_circle(point, 2.65, GOLD)
