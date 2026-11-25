extends AcceptDialog

var preview := TextureRect.new()

func configure(app: Node) -> void:
	title = "FETİH · İzleyici dilekleri"
	get_ok_button().text = "Kapat"
	var content := HBoxContainer.new()
	content.add_theme_constant_override("separation", 18)
	add_child(content)
	var notes := VBoxContainer.new()
	notes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	notes.add_theme_constant_override("separation", 12)
	content.add_child(notes)
	var heading: Label = app.text(notes, "Böyle yapmanızı öneririm", 23, app.GOLD)
	heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var explanation: Label = app.text(notes, "LIVE Studio’da İzleyici Dilekleri’ni aç. Hediyelere oyununda seçtiğin eylemlerin adlarını yaz. Sağdaki görsel bir kurulum örneğidir.", 16, app.WHITE)
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var tip: Label = app.text(notes, "Oyunda B ile eşleşmeleri kontrol et. Takviyeleri oyuncunun yanındaki Ekle düğmesinden, saldırıları ortadaki istekten onaylayabilirsin.", 15, app.MUTED)
	tip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(scroll)
	var image := Image.load_from_file(preload("InstallPaths.gd").bridge_directory().path_join("assets/guides/viewer-wishes.png"))
	if image != null and not image.is_empty():
		preview.texture = ImageTexture.create_from_image(image)
	preview.custom_minimum_size.y = 990
	preview.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	scroll.add_child(preview)
