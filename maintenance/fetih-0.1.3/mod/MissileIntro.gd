extends AcceptDialog

const CLIP := "res://assets/video/missile-intro.ogv"
const SEEN := "missile-intro-v1.json"
const CATALOG := "runtime/gift-assets/katalog_tam.json"
const MAX_DISPLAY_SECONDS := 8.0

var video: VideoStreamPlayer


static func show_once(game: Node) -> void:
	if game.qa_mode or game.test_mode:
		return
	var marker: String = game.profile_dir.path_join(SEEN)
	if FileAccess.file_exists(marker):
		var saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(marker))
		if saved is Dictionary and saved.get("seen") == true:
			return
	var clip := ResourceLoader.load(CLIP) as VideoStream
	if clip == null:
		return
	var intro: AcceptDialog = load("res://mod/MissileIntro.gd").new()
	intro.name = "FetihMissileIntro"
	game.ui.add_child(intro)
	intro.configure(game, clip)
	var parent_size := game.get_window().size as Vector2i
	intro.popup_centered(Vector2i(mini(830, parent_size.x - 44), mini(618, parent_size.y - 50)))
	game._write_json(marker, {"seen": true})
	intro.video.play()
	game.get_tree().create_timer(MAX_DISPLAY_SECONDS).timeout.connect(intro.dismiss)


func configure(game: Node, clip: VideoStream) -> void:
	title = "Fetih · Yeni özellik"
	exclusive = true
	transient = true
	theme = game.ui.theme.duplicate(true)
	add_theme_stylebox_override("panel", game.box_style(Color("#14232d"), Color("#657d89"), 12))
	var skip := get_ok_button()
	skip.text = "Videoyu geç"
	skip.custom_minimum_size = Vector2(125, 36)
	skip.add_theme_font_override("font", game.ui_font)
	skip.add_theme_color_override("font_color", game.WHITE)
	skip.add_theme_stylebox_override("normal", game.box_style(Color("#29424c"), game.GOLD, 7))

	var layout := VBoxContainer.new()
	layout.name = "IntroContent"
	layout.add_theme_constant_override("separation", 6)
	add_child(layout)
	game.text(layout, "Füze saldırısı", 26, game.GOLD)
	var trigger := game.text(layout, _trigger_message(game.settings.giftActions), 16, game.WHITE) as Label
	trigger.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var aspect := AspectRatioContainer.new()
	aspect.ratio = 1.6
	aspect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(aspect)
	video = VideoStreamPlayer.new()
	video.expand = true
	video.stream = clip
	video.volume_db = -3.0
	aspect.add_child(video)
	video.finished.connect(dismiss)
	visibility_changed.connect(_when_hidden)


func _trigger_message(actions: Dictionary) -> String:
	var ids: Array[String] = []
	for id: String in actions:
		if actions[id].get("unit") == "missile":
			ids.append(id)
	if ids.is_empty():
		return "Füzeyi B menüsünden bir hediyeye ata. Varsayılan hediye Balina Dalışı."
	var bridge := preload("InstallPaths.gd").bridge_directory()
	var catalog: Variant = JSON.parse_string(FileAccess.get_file_as_string(bridge.path_join(CATALOG)))
	var labels: PackedStringArray = []
	if catalog is Array:
		for row: Dictionary in catalog:
			if str(row.get("id")) in ids and labels.size() < 2:
				var label := str(row.get("name", "")).strip_edges()
				if not label.is_empty():
					labels.append(label)
	if labels.is_empty():
		return "Füzeyi B menüsünde seçili olan hediye tetikler."
	return "Füzeyi tetikleyen hediye: " + ", ".join(labels) + (" ve diğerleri" if ids.size() > labels.size() else "")


func dismiss() -> void:
	hide()


func _when_hidden() -> void:
	if not visible:
		video.stop()
		queue_free()
