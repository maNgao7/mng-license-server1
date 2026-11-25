extends AcceptDialog

var app: Node
var downloads: Object = preload("UserDownloads.gd")
var status: Label
var preview: Control
var heading: Label
var instructions: Label
var step_buttons: Array[Button] = []
var source_images: Array[Texture2D] = []

class ScreenshotPreview:
	extends Control
	var texture: Texture2D
	var step := 0
	var font: Font
	func _draw() -> void:
		if texture == null:
			return
		var source := Rect2(720, 115, 480, 835)
		if step == 1:
			source = Rect2(310, 40, 423, 675)
		elif step == 2:
			source = Rect2(Vector2.ZERO, Vector2(texture.get_size()))
		var available := size - Vector2(170 if step < 2 else 24, 24)
		var scale_factor := minf(available.x / source.size.x, available.y / source.size.y)
		var extent := source.size * scale_factor
		var frame := Rect2(Vector2(12, (size.y - extent.y) * 0.5), extent)
		if step == 2:
			frame.position.x = (size.x - extent.x) * 0.5
		draw_style_box(_panel(Color("#0b141b"), Color("#546b76"), 10), frame.grow(4))
		draw_texture_rect_region(texture, frame, source)
		if step == 0:
			_callout(frame, 0.15, "1  KAMERA", Color("#f1c77e"))
			_callout(frame, 0.49, "2  FETİH", Color("#7dd9cc"))
			_callout(frame, 0.86, "3  KAYITLI KLİP", Color("#c8aff2"))
		elif step == 1:
			_callout(frame, 0.70, "SES → %0", Color("#7dd9cc"))
			_callout(frame, 0.765, "DÖNGÜ → AÇIK", Color("#f1c77e"))
			_callout(frame, 0.915, "SON → UYGULA", Color("#f39eae"))
		else:
			var pill := Rect2(frame.position + Vector2(14, 14), Vector2(178, 32))
			draw_style_box(_panel(Color("#14232d", 0.95), Color("#f1c77e"), 6), pill)
			draw_string(font, pill.position + Vector2(10, 22), "SESSİZ KLİP  ·  1:28", HORIZONTAL_ALIGNMENT_LEFT, 160, 14, Color("#fff3d8"))
			var center := frame.get_center()
			draw_circle(center, 33, Color("#14232d", 0.88))
			draw_colored_polygon(PackedVector2Array([center + Vector2(-9, -15), center + Vector2(-9, 15), center + Vector2(17, 0)]), Color("#f2c66a"))
	func _callout(frame: Rect2, fraction: float, label: String, tint: Color) -> void:
		var target := Vector2(frame.end.x - 8, frame.position.y + frame.size.y * fraction)
		var start := Vector2(frame.end.x + 25, target.y)
		draw_line(start, target, tint, 2.2, true)
		draw_line(target, target + Vector2(8, -5), tint, 2.2, true)
		draw_line(target, target + Vector2(8, 5), tint, 2.2, true)
		var box := Rect2(start + Vector2(3, -17), Vector2(145, 34))
		draw_style_box(_panel(Color("#21323e"), tint.darkened(0.3), 6), box)
		draw_string(font, box.position + Vector2(9, 22), label, HORIZONTAL_ALIGNMENT_LEFT, 130, 13, tint)
	func _panel(fill: Color, edge: Color, radius: int) -> StyleBoxFlat:
		var style := StyleBoxFlat.new()
		style.bg_color = fill
		style.border_color = edge
		style.set_border_width_all(1)
		style.set_corner_radius_all(radius)
		return style

func configure(owner_app: Node) -> void:
	app = owner_app
	title = "TikMnG · Görsellerle yayın kurulumu"
	theme = app.ui.theme.duplicate(true)
	get_ok_button().text = "Kapat"
	get_ok_button().add_theme_stylebox_override("normal", app.box_style(Color("#29424c"), app.GOLD, 7))
	get_ok_button().add_theme_color_override("font_color", app.WHITE)
	get_ok_button().custom_minimum_size = Vector2(100, 38)
	get_ok_button().add_theme_font_override("font", app.ui_font)
	add_theme_stylebox_override("panel", app.box_style(Color("#14232d"), Color("#657d89"), 12))
	for file in ["studio-layout.png", "studio-video-settings.png", "live-layout-cover.jpg"]:
		var path: String = app.mod_root.path_join("../assets/guides").simplify_path().path_join(file)
		var texture: Texture2D
		if path.begins_with("res://"):
			texture = load(path) as Texture2D
		else:
			var image := Image.load_from_file(path)
			if image != null and not image.is_empty():
				image.generate_mipmaps()
				texture = ImageTexture.create_from_image(image)
		source_images.append(texture)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_left = 20
	scroll.offset_right = -20
	scroll.offset_top = 14
	scroll.offset_bottom = -59
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	scroll.add_child(content)
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	content.add_child(tabs)
	var titles := ["1  Yayın düzeni", "2  Video ayarları", "3  Videoyu indir"]
	for index in 3:
		var tab: Button = app.button(tabs, titles[index], _select_step.bind(index))
		tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		step_buttons.append(tab)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 22)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.add_child(body)
	preview = ScreenshotPreview.new()
	preview.font = app.ui_font
	preview.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	preview.custom_minimum_size = Vector2(420, 390)
	preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	preview.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(preview)
	var details := VBoxContainer.new()
	details.custom_minimum_size.x = 285
	details.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details.add_theme_constant_override("separation", 18)
	body.add_child(details)
	_label(details, "TİKMNG  /  YAYIN KURULUMU", 12, app.GOLD)
	heading = _label(details, "", 27, app.WHITE)
	instructions = _label(details, "", 17, Color("#d2e0e6"))
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	details.add_child(spacer)
	var download: Button = app.button(details, "↓  Sessiz videoyu indir", _choose_export, true)
	download.custom_minimum_size.y = 47
	_label(content, "Kamera veya döngü video, ihlalden muafiyet sağlamaz. Kayıtlı klibi canlı yayınmış gibi sunmayın.", 13, app.MUTED)
	status = _label(content, "", 13, Color("#9bdfcf"))
	_select_step(0)

func _select_step(index: int) -> void:
	preview.step = index
	preview.texture = source_images[index]
	preview.queue_redraw()
	var headings := ["Üç alan.\nTek yayın düzeni.", "Sessiz oynat.\nDöngüyü seç.", "Klibin hazır.\nBilgisayarına kaydet."]
	var messages := [
		"Gönderdiğin gerçek LIVE Studio ekranı üzerinde gösteriliyor.\n\nÜstte canlı kamera, ortada Fetih penceresi, altta isteğe bağlı kayıtlı klip.\n\nKamera ve oyun kaynaklarını ayrı ekle. İzleyicinle canlı etkileşim kur.",
		"Video kaynağını aç ve dosyayı seç.\n\n1. Ses kaydırıcısını %0 yap.\n2. ‘Döngü’ seçeneğini aç.\n3. ‘Uygula’ düğmesine bas.\n\nKayıtlı klip kullandığını yayında belirt. Döngü ayarı yalnızca oynatmayı tekrarlar.",
		"MnG Kesit (3) videosunun sessiz kopyası.\n\nSüre 1 dakika 28 saniye.\nHD 1280 × 720 · MP4\nSes kanalı bulunmaz.\n\nİndir düğmesi videoyu doğrudan masaüstüne kaydeder. Ardından LIVE Studio'ya video kaynağı olarak ekle."]
	heading.text = headings[index]
	instructions.text = messages[index]
	for i in step_buttons.size():
		step_buttons[i].add_theme_stylebox_override("normal", app.box_style(Color("#34515d") if i == index else Color("#1b2c37"), app.GOLD if i == index else Color("#455d69"), 7))

func _label(parent: Node, value: String, font_size: int, tint: Color) -> Label:
	var label: Label = app.text(parent, value, font_size, tint)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label

func video_source() -> String:
	return preload("InstallPaths.gd").bridge_directory().path_join("assets/guides/live-layout-muted.mp4")

func _choose_export(target_directory: String = "") -> void:
	if not FileAccess.file_exists(video_source()):
		status.text = "Video bulunamadı. Oyun dosyalarını onarıp yeniden deneyin."
		return
	var result: Dictionary = downloads.copy_asset(video_source(), "TikMnG-sessiz-ornek-klip.mp4", OS.SYSTEM_DIR_DESKTOP, target_directory)
	status.text = "Sessiz video masaüstüne indirildi:\n" + str(result.path) if result.ok else "Video indirilemedi. " + str(result.error)

func _export_video(destination: String) -> void:
	if destination.simplify_path() == video_source():
		status.text = "Oyun klasörü dışında bir kayıt yeri seçin."
		return
	var result := DirAccess.copy_absolute(video_source(), destination)
	status.text = "Sessiz video kaydedildi." if result == OK else "Video kaydedilemedi. Başka bir klasör seçin."
