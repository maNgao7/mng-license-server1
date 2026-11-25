extends AcceptDialog
## configure(app) once, add to the tree, then call open().
## settings.giftActions uses gift ID keys and {"unit": String, "count": int}.
## Saving calls app.save_gift_actions(actions, soldiers_per_coin) -> bool.

const Rules = preload("WarRules.gd")
const PAGE_SIZE := 40
const INK := Color("#101b24")
const SURFACE := Color("#172932")
const FIELD := Color("#0e2029")
const BUTTON := Color("#233944")
const HOVER := Color("#304955")
const EDGE := Color("#52717b")
const TEXT := Color("#fff3d8")
const MUTED := Color("#c4d2d8")
const GOLD := Color("#f2c66a")
const SELECTED := Color("#544126")
const CONTROL_HEIGHT := 36
const MISSILE_DEFAULT_DAMAGE := 5000
const UNIT_KEYS := ["", "tank", "helicopter", "factory", "soldiers", "headquarters", "jet", "surrounding", "missile"]
const UNIT_LABELS := ["Eylem seç", "Tank ekle", "Helikopter ekle", "Fabrika ekle", "Ek asker ver", "Karargâh ekle", "Jet ekle", "Her yere saldır", "Füze saldırısı"]
const UNIT_NAMES := {"tank": "tank", "helicopter": "helikopter", "factory": "fabrika", "soldiers": "asker", "headquarters": "karargâh", "jet": "jet", "surrounding": "Her yere saldır", "missile": "Füze saldırısı"}
const GALAXY := "11046"
const WHALE_DIVE := "6820"
const DEFAULT_ACTIONS_VERSION := 3
const DEFAULT_ACTIONS := {
	"17473": {"unit": "soldiers", "count": 2000},
	"5658": {"unit": "soldiers", "count": 2000}, # Parfüm
	"5879": {"unit": "tank", "count": 10}, # Donat
	"5303": {"unit": "helicopter", "count": 10}, # Çay
	"5660": {"unit": "factory", "count": 1}, # Elle Kalp
	"6427": {"unit": "jet", "count": 10}, # Şapka ve Bıyık
	"7168": {"unit": "soldiers", "count": 10000}, # Para Tabancası
	GALAXY: {"unit": "surrounding", "count": 1},
	WHALE_DIVE: {"unit": "missile", "count": MISSILE_DEFAULT_DAMAGE},
}

var _app: Node
var _catalog_path := ""
var _entries: Array[Dictionary] = []
var _catalog_by_id: Dictionary = {}
var _matches: Array[Dictionary] = []
var _icons: Dictionary = {}
var _actions: Dictionary = {}
var _amount_label: Label
var _page := 0
var _selected_id := ""
var _loading_selection := false
var _rules_scroll: ScrollContainer
var _rules_list: VBoxContainer
var _rule_rows: Dictionary = {}
var _rules_empty: Label
var _new_rule: Button
var _cancel: Button
var _search: LineEdit
var _list: ItemList
var _catalog_hint: Label
var _navigation: HBoxContainer
var _previous: Button
var _next: Button
var _page_label: Label
var _selection_label: Label
var _unit: OptionButton
var _amount: SpinBox
var _amount_row: HBoxContainer
var _remove: Button
var _soldiers_per_coin: SpinBox
var _description: Label
var _status: Label
var _test_button: Button
var _return_to_draft := false
var _engagement_controls: Dictionary = {}
var _engagement_panel: PanelContainer
var _gift_columns: HBoxContainer


func configure(app: Node) -> void:
	_app = app
	if _search == null:
		_build()


func open() -> void:
	if _app == null or not is_inside_tree():
		return
	get_ok_button().text = "Denemeye uygula" if _app.gift_test.is_active() else "Kaydet"
	if _return_to_draft:
		_return_to_draft = false
		popup_centered_clamped(Vector2i(980, 760), 0.91)
		return
	_catalog_path = preload("InstallPaths.gd").bridge_directory().path_join("runtime/gift-assets")
	_load_catalog()
	_actions = normalize_actions(_app.settings.get("giftActions", {}))
	var ratio: Variant = _app.settings.get("soldiersPerCoin", Rules.DEFAULT_SOLDIERS_PER_COIN)
	_set_spin_value(_soldiers_per_coin, int(ratio) if _whole_in_range(ratio, Rules.MAX_SOLDIERS_PER_GIFT) else Rules.DEFAULT_SOLDIERS_PER_COIN)
	var engagement := Rules.normalize_engagement_actions(_app.settings.get("engagementActions"))
	for kind in _engagement_controls:
		var fields: Dictionary = _engagement_controls[kind]
		var rule: Dictionary = engagement[kind]
		if fields.threshold != null:
			_set_spin_value(fields.threshold, rule.threshold)
		_set_spin_value(fields.soldiers, rule.soldiers)
		fields.unit.select(Rules.ENGAGEMENT_UNITS.find(rule.unit))
		_set_spin_value(fields.count, rule.count)
	_reset_editor()
	_refresh_rules()
	popup_centered_clamped(Vector2i(980, 760), 0.91)
	_unit.grab_focus()


func hide_for_test() -> void:
	_return_to_draft = true
	hide()


static func normalize_actions(value: Variant) -> Dictionary:
	var result: Dictionary = {}
	if not value is Dictionary:
		return result
	for key in value:
		if typeof(key) != TYPE_STRING or not _valid_gift_id(key):
			continue
		var action: Variant = value[key]
		if not action is Dictionary or not UNIT_NAMES.has(action.get("unit")):
			continue
		var unit: String = action["unit"]
		var count: Variant = action.get("count")
		if _whole_in_range(count, _limit_for(unit)):
			result[key] = {"unit": unit, "count": int(count)}
	return result


static func migrate_actions(value: Variant, version: int) -> Dictionary:
	var result := normalize_actions(value)
	if version < 2:
		for id: String in DEFAULT_ACTIONS:
			# Galaxy was already editable in version 1, including removal.
			if id != WHALE_DIVE and not result.has(id) and (id != GALAXY or version < 1):
				result[id] = DEFAULT_ACTIONS[id].duplicate()
	if version < DEFAULT_ACTIONS_VERSION and not result.has(WHALE_DIVE) \
			and not result.values().any(func(action: Dictionary) -> bool: return action.unit == "missile"):
		result[WHALE_DIVE] = DEFAULT_ACTIONS[WHALE_DIVE].duplicate()
	return result


static func _limit_for(unit: String) -> int:
	match unit:
		"headquarters", "surrounding":
			return 1
		"soldiers", "missile":
			return Rules.MAX_SOLDIERS_PER_GIFT
		"tank", "helicopter", "jet":
			return Rules.MAX_INTEGER
		_:
			return Rules.MAX_GIFT_UNITS


static func _whole_in_range(value: Variant, maximum: int) -> bool:
	if typeof(value) == TYPE_INT:
		return value >= 1 and value <= maximum
	if typeof(value) == TYPE_FLOAT:
		return is_finite(value) and value >= 1.0 and value <= maximum and floor(value) == value
	return false


static func _valid_gift_id(id: String) -> bool:
	if id.is_empty() or id.length() > 20:
		return false
	for index in id.length():
		var code := id.unicode_at(index)
		if code < 48 or code > 57:
			return false
	return true


func _build() -> void:
	title = "Yayın eylemleri"
	ok_button_text = "Kaydet"
	dialog_hide_on_ok = false
	min_size = Vector2i(820, 525)
	_apply_game_theme()
	confirmed.connect(_save)
	_cancel = add_cancel_button("Vazgeç")
	_style_button(_cancel)

	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 8)
	add_child(layout)
	_build_engagement(layout)

	_gift_columns = HBoxContainer.new()
	_gift_columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_gift_columns.add_theme_constant_override("separation", 12)
	layout.add_child(_gift_columns)
	_build_saved_rules(_section(_gift_columns, 324))
	_build_editor(_section(_gift_columns, 0, true))

	_status = _add_label(layout, "", 17, Color("#ffad98"))
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	var save := get_ok_button()
	_style_button(save)
	save.add_theme_font_size_override("font_size", 20)
	save.add_theme_stylebox_override("normal", _box(GOLD, GOLD, 7, Vector2(12, 5)))
	save.add_theme_stylebox_override("hover", _box(GOLD.lightened(0.18), GOLD, 7, Vector2(12, 5)))
	var save_pressed := _box(GOLD.darkened(0.12), GOLD, 7, Vector2(12, 5))
	save.add_theme_stylebox_override("pressed", save_pressed)
	save.add_theme_stylebox_override("hover_pressed", save_pressed)
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		save.add_theme_color_override(color_name, INK)
	var save_focus := _box(Color.TRANSPARENT, TEXT, 7, Vector2.ZERO)
	save_focus.set_border_width_all(2)
	save_focus.set_expand_margin_all(2)
	save.add_theme_stylebox_override("focus", save_focus)


func _build_engagement(layout: VBoxContainer) -> void:
	_engagement_panel = PanelContainer.new()
	_engagement_panel.add_theme_stylebox_override("panel", _box(SURFACE, EDGE, 8, Vector2(12, 5)))
	layout.add_child(_engagement_panel)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 2)
	_engagement_panel.add_child(content)
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 3)
	content.add_child(grid)
	_add_label(grid, "Beğeni ve takip", 16, GOLD)
	for caption in ["Eşik", "Asker", "Birlik", "Birlik adedi"]:
		_add_label(grid, caption, 14, MUTED)
	for kind in ["like", "follow"]:
		var label := _add_label(grid, "Beğeni" if kind == "like" else "Takip", 16)
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		var threshold: SpinBox
		if kind == "like":
			threshold = _spin(grid, Rules.MAX_SOLDIERS_PER_GIFT)
			threshold.tooltip_text = "Aynı izleyicinin her bu kadar beğenisinde ödül verilir."
		else:
			_add_label(grid, "Her takip", 15)
		var soldiers := _spin(grid, Rules.MAX_SOLDIERS_PER_GIFT)
		soldiers.min_value = 0
		soldiers.tooltip_text = "0 seçilirse asker verilmez."
		var unit := OptionButton.new()
		_style_button(unit, "OptionButton")
		unit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		unit.add_theme_constant_override("modulate_arrow", 1)
		unit.get_popup().theme = theme
		unit.get_popup().add_theme_font_override("font", _app.ui_font)
		for unit_name in ["Yok", "Tank", "Helikopter", "Jet"]:
			unit.add_item(unit_name)
		grid.add_child(unit)
		var count := _spin(grid, Rules.MAX_SOLDIERS_PER_GIFT)
		count.min_value = 0
		count.tooltip_text = "0 seçilirse araç verilmez."
		_engagement_controls[kind] = {"threshold": threshold, "soldiers": soldiers, "unit": unit, "count": count}


func _build_saved_rules(saved: VBoxContainer) -> void:
	var header := HBoxContainer.new()
	saved.add_child(header)
	var heading := _add_label(header, "Kayıtlı kurallar", 20)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_new_rule = _button("Yeni kural", _start_new)
	header.add_child(_new_rule)

	_rules_scroll = ScrollContainer.new()
	_rules_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_rules_scroll.follow_focus = true
	_rules_scroll.custom_minimum_size.y = 120
	_rules_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	saved.add_child(_rules_scroll)

	_rules_list = VBoxContainer.new()
	_rules_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rules_list.add_theme_constant_override("separation", 4)
	_rules_scroll.add_child(_rules_list)
	_rules_empty = _add_label(_rules_list, "Henüz kayıtlı kural yok.", 17, MUTED)
	var test_hint := _add_label(saved, "Bir hediye kuralını haritaya sürükleyerek dene.", 14, MUTED)
	test_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	saved.add_child(HSeparator.new())
	var conversion := HBoxContainer.new()
	saved.add_child(conversion)
	var caption := _add_label(conversion, "1 coin başına asker", 18)
	caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	caption.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_soldiers_per_coin = _spin(conversion, Rules.MAX_SOLDIERS_PER_GIFT)


func _build_editor(editor: VBoxContainer) -> void:
	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 8)
	editor.add_child(action_row)
	_unit = OptionButton.new()
	_style_button(_unit, "OptionButton")
	_unit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_unit.add_theme_constant_override("modulate_arrow", 1)
	var popup := _unit.get_popup()
	popup.theme = theme
	popup.add_theme_font_override("font", _app.ui_font)
	popup.add_theme_constant_override("outline_size", 0)
	for label in UNIT_LABELS:
		_unit.add_item(label)
	_unit.set_item_disabled(0, true)
	_unit.item_selected.connect(_change_unit)
	action_row.add_child(_unit)

	_search = LineEdit.new()
	_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_search.size_flags_stretch_ratio = 1.35
	_search.custom_minimum_size.y = CONTROL_HEIGHT
	_search.placeholder_text = "Hediye adı veya numarası"
	_search.clear_button_enabled = true
	_search.text_changed.connect(_filter_catalog)
	action_row.add_child(_search)
	_use_light_icon(_search, "clear")

	var catalog := PanelContainer.new()
	catalog.custom_minimum_size.y = 106
	catalog.size_flags_vertical = Control.SIZE_EXPAND_FILL
	editor.add_child(catalog)
	_list = ItemList.new()
	_list.fixed_icon_size = Vector2i(24, 24)
	_list.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING
	_list.item_selected.connect(_select_item)
	_list.set_drag_forwarding(_drag_catalog_gift, Callable(), Callable())
	catalog.add_child(_list)
	_catalog_hint = _add_label(catalog, "", 18, MUTED)
	_catalog_hint.add_theme_stylebox_override("normal", theme.get_stylebox("panel", "ItemList"))
	_catalog_hint.size_flags_vertical = Control.SIZE_FILL
	_catalog_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_catalog_hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	_navigation = HBoxContainer.new()
	_navigation.add_theme_constant_override("separation", 8)
	editor.add_child(_navigation)
	_previous = _button("‹  Önceki", _move_page.bind(-1))
	_previous.custom_minimum_size.x = 108
	_navigation.add_child(_previous)
	_page_label = _add_label(_navigation, "", 18, GOLD)
	_page_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_page_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_page_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_next = _button("Sonraki  ›", _move_page.bind(1))
	_next.custom_minimum_size.x = _previous.custom_minimum_size.x
	_navigation.add_child(_next)

	var selection := HBoxContainer.new()
	editor.add_child(selection)
	_selection_label = _add_label(selection, "", 18, GOLD)
	_selection_label.custom_minimum_size.x = 158
	_selection_label.size.x = 158
	_selection_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_selection_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_selection_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_remove = _button("Kuralı kaldır", _remove_selected)
	_remove.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	selection.add_child(_remove)

	_amount_row = HBoxContainer.new()
	_amount_row.add_theme_constant_override("separation", 5)
	selection.add_child(_amount_row)
	selection.move_child(_amount_row, 1)
	_amount_label = _add_label(_amount_row, "Adet", 16)
	_amount_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_amount = _spin(_amount_row, Rules.MAX_GIFT_UNITS)
	_amount.tooltip_text = "Hediye başına miktar"
	_amount.value_changed.connect(_change_amount)
	_description = _add_label(editor, "", 16, MUTED)
	_description.custom_minimum_size.x = 276
	_description.size.x = 276
	_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_test_button = _button("Haritada test et", _test_selected_gift)
	_test_button.tooltip_text = "Geçici turda bir bölgeye tıklayarak hediyeyi dene."
	editor.add_child(_test_button)


func _section(parent: HBoxContainer, minimum_width: float, expand: bool = false) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = minimum_width
	if expand:
		panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _box(SURFACE, EDGE, 8, Vector2(10, 9)))
	parent.add_child(panel)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 6)
	panel.add_child(content)
	return content


func _button(label: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = label
	_style_button(button)
	button.pressed.connect(action)
	return button


func _style_button(button: Button, kind: String = "Button") -> void:
	button.custom_minimum_size.y = CONTROL_HEIGHT
	# AcceptDialog's built-in buttons need the dialog styles explicitly.
	button.add_theme_font_override("font", _app.ui_font)
	button.add_theme_font_size_override("font_size", 18)
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color",
			"font_hover_pressed_color", "font_disabled_color"]:
		button.add_theme_color_override(color_name, theme.get_color(color_name, kind))
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		button.add_theme_stylebox_override(state, theme.get_stylebox(state, kind))


func _box(color: Color, border: Color, radius: int, padding: Vector2) -> StyleBoxFlat:
	var style: StyleBoxFlat = _app.box_style(color, border, radius)
	style.content_margin_left = padding.x
	style.content_margin_right = padding.x
	style.content_margin_top = padding.y
	style.content_margin_bottom = padding.y
	return style


func _apply_game_theme() -> void:
	var panel_theme := Theme.new()
	panel_theme.default_font = _app.ui_font
	panel_theme.default_font_size = 18

	var field := _box(FIELD, EDGE, 6, Vector2(10, 4))
	var button := _box(BUTTON, EDGE, 6, Vector2(10, 4))
	var hover := _box(HOVER, GOLD.darkened(0.26), 6, Vector2(10, 4))
	var selected := _box(SELECTED, GOLD, 6, Vector2(10, 4))
	var disabled := _box(SURFACE, EDGE.darkened(0.25), 6, Vector2(10, 4))
	var focus := _box(Color.TRANSPARENT, GOLD, 6, Vector2.ZERO)
	focus.set_border_width_all(2)

	panel_theme.set_stylebox("panel", "AcceptDialog", _box(INK, EDGE, 8, Vector2(12, 8)))
	panel_theme.set_constant("buttons_min_width", "AcceptDialog", 152)
	panel_theme.set_constant("buttons_min_height", "AcceptDialog", 38)
	var window_border := _box(SURFACE, EDGE, 8, Vector2.ZERO)
	window_border.set_expand_margin(SIDE_TOP, 34)
	panel_theme.set_stylebox("embedded_border", "Window", window_border)
	panel_theme.set_stylebox("embedded_unfocused_border", "Window", window_border)
	panel_theme.set_constant("title_height", "Window", 34)
	panel_theme.set_font("title_font", "Window", _app.ui_font)
	panel_theme.set_font_size("title_font_size", "Window", 22)
	panel_theme.set_color("title_color", "Window", GOLD)
	panel_theme.set_stylebox("panel", "PanelContainer", StyleBoxEmpty.new())
	for kind in ["Button", "OptionButton", "LineEdit", "ItemList", "PopupMenu"]:
		panel_theme.set_color("font_color", kind, TEXT)
		panel_theme.set_color("font_hover_color", kind, TEXT)
		panel_theme.set_color("font_focus_color", kind, TEXT)
		panel_theme.set_stylebox("focus", kind, focus)
	for kind in ["Button", "OptionButton"]:
		panel_theme.set_stylebox("normal", kind, button if kind == "Button" else field)
		panel_theme.set_stylebox("hover", kind, hover)
		panel_theme.set_stylebox("pressed", kind, selected)
		panel_theme.set_stylebox("hover_pressed", kind, selected)
		panel_theme.set_stylebox("disabled", kind, disabled)
		panel_theme.set_color("font_pressed_color", kind, TEXT)
		panel_theme.set_color("font_hover_pressed_color", kind, TEXT)
		panel_theme.set_color("font_disabled_color", kind, MUTED)

	panel_theme.set_stylebox("normal", "LineEdit", field)
	panel_theme.set_stylebox("read_only", "LineEdit", disabled)
	panel_theme.set_color("font_placeholder_color", "LineEdit", MUTED)
	panel_theme.set_color("font_uneditable_color", "LineEdit", MUTED)
	panel_theme.set_color("caret_color", "LineEdit", GOLD)
	panel_theme.set_color("selection_color", "LineEdit", GOLD)
	panel_theme.set_color("font_selected_color", "LineEdit", INK)
	panel_theme.set_stylebox("panel", "ItemList", field)
	for state in ["selected", "selected_focus"]:
		panel_theme.set_stylebox(state, "ItemList", selected)
	panel_theme.set_color("font_selected_color", "ItemList", TEXT)
	panel_theme.set_color("guide_color", "ItemList", Color("#29434d"))
	panel_theme.set_constant("v_separation", "ItemList", 5)
	panel_theme.set_constant("icon_margin", "ItemList", 8)

	panel_theme.set_stylebox("panel", "PopupMenu", field)
	panel_theme.set_stylebox("hover", "PopupMenu", hover)
	panel_theme.set_color("font_disabled_color", "PopupMenu", MUTED)
	panel_theme.set_constant("v_separation", "PopupMenu", 12)
	panel_theme.set_stylebox("separator", "HSeparator", _box(EDGE, EDGE, 0, Vector2(0, 1)))
	var scroll_track := _box(FIELD, Color.TRANSPARENT, 4, Vector2(5, 0))
	var scroll_handle := _box(EDGE, Color.TRANSPARENT, 4, Vector2(5, 0))
	var scroll_active := _box(GOLD.darkened(0.16), Color.TRANSPARENT, 4, Vector2(5, 0))
	panel_theme.set_stylebox("scroll", "VScrollBar", scroll_track)
	panel_theme.set_stylebox("scroll_focus", "VScrollBar", scroll_track)
	panel_theme.set_stylebox("grabber", "VScrollBar", scroll_handle)
	panel_theme.set_stylebox("grabber_highlight", "VScrollBar", scroll_active)
	panel_theme.set_stylebox("grabber_pressed", "VScrollBar", scroll_active)
	theme = panel_theme


func _add_label(parent: Node, value: String, font_size: int, color: Color = TEXT) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_override("font", _app.ui_font)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_constant_override("outline_size", 0)
	label.add_theme_color_override("font_shadow_color", Color.TRANSPARENT)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label


func _spin(parent: Node, maximum: int) -> SpinBox:
	var spin := SpinBox.new()
	spin.min_value = 1
	spin.max_value = maximum
	spin.step = 1
	spin.rounded = true
	spin.custom_minimum_size = Vector2(108, CONTROL_HEIGHT)
	parent.add_child(spin)
	_use_light_icon(spin, "updown")
	return spin


func _use_light_icon(control: Control, icon_name: String) -> void:
	var icon := control.get_theme_icon(icon_name)
	if icon == null:
		return
	var image := icon.get_image()
	if image == null or image.is_empty():
		return
	image.convert(Image.FORMAT_RGBA8)
	for y in image.get_height():
		for x in image.get_width():
			var alpha := image.get_pixel(x, y).a
			image.set_pixel(x, y, Color(TEXT.r, TEXT.g, TEXT.b, alpha))
	control.add_theme_icon_override(icon_name, ImageTexture.create_from_image(image))


func _set_spin_value(spin: SpinBox, count: int) -> void:
	# Godot 4.3 leaves the previous text when setting the value without a signal.
	spin.set_value_no_signal(count)
	spin.get_line_edit().text = str(count)


func _load_catalog() -> void:
	_entries.clear()
	_catalog_by_id.clear()
	_icons.clear()
	var path := _catalog_path.path_join("katalog_tam.json")
	if not FileAccess.file_exists(path):
		return
	var rows: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not rows is Array:
		return
	for row in rows:
		if not row is Dictionary:
			continue
		var id := str(row.get("id", ""))
		if not _valid_gift_id(id) or _catalog_by_id.has(id):
			continue
		var original := str(row.get("name", id))
		var name := str(row.get("trName", original))
		var file := str(row.get("file", id + ".png"))
		if not file.ends_with(".png") or not _valid_gift_id(file.trim_suffix(".png")):
			file = id + ".png"
		var entry := {"id": id, "name": name, "coins": str(int(row.get("coins", 0))),
			"file": file, "search": _fold("%s %s %s" % [id, original, name])}
		_entries.append(entry)
		_catalog_by_id[id] = entry


func _fold(value: String) -> String:
	var result := value.replace("İ", "i").to_lower()
	for pair in [["ı", "i"], ["ü", "u"], ["ç", "c"], ["ö", "o"], ["ş", "s"], ["ğ", "g"]]:
		result = result.replace(pair[0], pair[1])
	return result


func _filter_catalog(query: String) -> void:
	var search := _fold(query.strip_edges())
	_matches.clear()
	for entry in _entries:
		if search.is_empty() or String(entry.search).contains(search):
			_matches.append(entry)
	_page = 0
	_refresh_page()


func _move_page(offset: int) -> void:
	_page += offset
	_refresh_page()


func _refresh_page() -> void:
	var page_count := maxi(1, ceili(float(_matches.size()) / PAGE_SIZE))
	_page = clampi(_page, 0, page_count - 1)
	var can_select := _unit.selected > 0
	var show_gifts := can_select and not _matches.is_empty()
	_search.editable = can_select
	_search.focus_mode = Control.FOCUS_ALL if can_select else Control.FOCUS_NONE
	_list.focus_mode = Control.FOCUS_ALL if show_gifts else Control.FOCUS_NONE
	_list.visible = show_gifts
	_navigation.visible = show_gifts and page_count > 1
	_previous.disabled = _page == 0
	_next.disabled = _page + 1 >= page_count
	_page_label.text = "Sayfa %d / %d  ·  %d hediye" % [_page + 1, page_count, _matches.size()]
	_catalog_hint.visible = not show_gifts
	if _entries.is_empty():
		_catalog_hint.text = "Katalog açılamadı."
	elif not can_select:
		_catalog_hint.text = "Hediyeleri görmek için bir eylem seç."
	else:
		_catalog_hint.text = "Hediye bulunamadı."
	_list.clear()
	var start := _page * PAGE_SIZE
	for index in range(start, mini(start + PAGE_SIZE, _matches.size())):
		var row: Dictionary = _matches[index]
		var item := _list.add_item("%s   ·   %s coin" % [row.name, row.coins] if show_gifts else "",
			_gift_icon(row) if show_gifts else null)
		_list.set_item_disabled(item, not show_gifts)
		if row.id == _selected_id:
			_list.select(item)
	if not _selected_id.is_empty():
		_list.ensure_current_is_visible()


func _refresh_rules() -> void:
	for row in _rule_rows.values():
		var card: PanelContainer = row.card
		_rules_list.remove_child(card)
		card.queue_free()
	_rule_rows.clear()
	_rules_empty.visible = _actions.is_empty()
	_rules_scroll.scroll_vertical = 0
	for id in _actions:
		_add_rule(id)


func _add_rule(id: String) -> void:
	var gift := _gift_row(id)
	var card := PanelContainer.new()
	_rules_list.add_child(card)

	var button := _button("", _select_gift.bind(id))
	button.toggle_mode = true
	button.tooltip_text = "%s · #%s\nTest için haritaya sürükle." % [gift.name, id]
	button.set_drag_forwarding(_drag_rule.bind(id), Callable(), Callable())
	card.add_child(button)

	# The content determines the row height. The button covers the whole row.
	var inset := MarginContainer.new()
	inset.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right"]:
		inset.add_theme_constant_override("margin_" + side, 10)
	for side in ["top", "bottom"]:
		inset.add_theme_constant_override("margin_" + side, 3)
	card.add_child(inset)
	var content := HBoxContainer.new()
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_theme_constant_override("separation", 9)
	inset.add_child(content)

	var icon := TextureRect.new()
	icon.texture = _gift_icon(gift)
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(28, 28)
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	content.add_child(icon)

	var labels := VBoxContainer.new()
	labels.mouse_filter = Control.MOUSE_FILTER_IGNORE
	labels.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	labels.add_theme_constant_override("separation", 0)
	content.add_child(labels)
	var gift_name := _add_label(labels, gift.name, 18)
	gift_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var amount := _add_label(labels, _rule_amount(_actions[id]), 16, MUTED)
	amount.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_rule_rows[id] = {"card": card, "button": button, "gift_name": gift_name, "amount": amount}
	_rules_empty.hide()


func _rule_amount(action: Dictionary) -> String:
	if action.unit == "missile":
		return "Füze saldırısı · %s taban hasar" % _app.amount(action.count)
	return UNIT_NAMES[action.unit] if action.unit == "surrounding" else "%d %s" % [action.count, UNIT_NAMES[action.unit]]


func _drag_rule(_position: Vector2, id: String) -> Variant:
	_offer_test(id, true)
	return null


func _drag_catalog_gift(position: Vector2) -> Variant:
	var index := _list.get_item_at_position(position, true)
	if index >= 0:
		_offer_test(_matches[_page * PAGE_SIZE + index].id, true)
	return null


func _test_selected_gift() -> void:
	_offer_test(_selected_id, false)


func _offer_test(id: String, dragging: bool) -> void:
	if not _actions.has(id):
		return
	_soldiers_per_coin.apply()
	if id == _selected_id:
		_amount.apply()
	var gift := _gift_row(id)
	var coins := int(gift.coins)
	if coins <= 0:
		_status.text = "Bu hediyenin coin değeri katalogda bulunamadı."
		_status.show()
		return
	var action: Dictionary = _actions[id]
	_app.gift_test.offer.call_deferred({"id": id, "name": gift.name, "coins": coins,
		"action": action.duplicate(), "ratio": int(_soldiers_per_coin.value), "label": _rule_amount(action)}, dragging)


func _gift_row(id: String) -> Dictionary:
	return _catalog_by_id.get(id, {"id": id, "name": "Hediye #%s" % id, "coins": "",
		"file": id + ".png"})


func _gift_icon(gift: Dictionary) -> Texture2D:
	var file: String = gift.file
	if file == "0.png":
		# Older standalone catalogs point all rows at the bundled placeholder.
		var original: String = gift.id + ".png"
		if FileAccess.file_exists(_catalog_path.path_join(original)):
			file = original
	if _icons.has(file):
		return _icons[file]
	var path := _catalog_path.path_join(file)
	if not FileAccess.file_exists(path):
		return null
	var image := Image.load_from_file(path)
	if image == null or image.is_empty():
		return null
	var icon := ImageTexture.create_from_image(image)
	if _icons.size() >= PAGE_SIZE * 2:
		_icons.erase(_icons.keys()[0])
	_icons[file] = icon
	return icon


func _start_new() -> void:
	_amount.apply()
	_reset_editor()
	_unit.grab_focus()


func _reset_editor() -> void:
	_selected_id = ""
	_unit.select(0)
	_search.clear()
	_filter_catalog("")
	_sync_editor()
	_status.hide()


func _select_item(index: int) -> void:
	if _unit.selected > 0:
		_select_gift(_matches[_page * PAGE_SIZE + index].id)


func _select_gift(id: String) -> void:
	if _selected_id == id:
		_rule_rows[id].button.set_pressed_no_signal(true)
		return
	_amount.apply()
	var move_surrounding: bool = _actions.get(_selected_id, {}).get("unit") == "surrounding" and not _actions.has(id)
	if move_surrounding:
		_actions.erase(_selected_id)
	_selected_id = id
	if not _actions.has(id):
		var unit: String = UNIT_KEYS[_unit.selected]
		_set_action(unit, MISSILE_DEFAULT_DAMAGE if unit == "missile" else 1)
		if move_surrounding:
			_refresh_rules()
		else:
			_add_rule(id)
	_sync_editor()
	_refresh_page()
	_scroll_to_selected_rule.call_deferred()


func _scroll_to_selected_rule() -> void:
	if _rule_rows.has(_selected_id):
		_rules_scroll.ensure_control_visible(_rule_rows[_selected_id].card)


func _sync_editor() -> void:
	for id in _rule_rows:
		_rule_rows[id].button.set_pressed_no_signal(id == _selected_id)
	var action: Dictionary = _actions.get(_selected_id, {})
	var unit: String = action.get("unit", UNIT_KEYS[_unit.selected])
	_unit.select(UNIT_KEYS.find(unit))
	_loading_selection = true
	_amount.max_value = _limit_for(unit)
	_set_spin_value(_amount, int(action.get("count", 1)))
	_loading_selection = false

	var row := _gift_row(_selected_id)
	_selection_label.visible = not _selected_id.is_empty()
	_selection_label.text = row.name if row.coins.is_empty() else "%s · %s coin" % [row.name, row.coins]
	_remove.visible = not action.is_empty()
	_test_button.disabled = action.is_empty()
	_amount_row.visible = not action.is_empty() and unit not in ["headquarters", "surrounding"]
	_amount.editable = _amount_row.visible
	_amount_label.text = "Taban hasar" if unit == "missile" else "Adet"
	_amount.tooltip_text = "Hediye başına her rakibe uygulanacak taban asker kaybı" if unit == "missile" else "Hediye başına miktar"
	match unit:
		"headquarters":
			_description.text = "Gönderenin ana bölgesine 1 karargâh kurar. Asker eşiği yoktur; savaş çalışırken saniyede 5 asker üretir. Mevcut karargâh çoğaltılmaz."
		"surrounding":
			_description.text = "Gönderen coin karşılığı asker alır ve haritadaki rakiplere sırayla saldırır."
		"missile":
			_description.text = "Gönderenin bölgelerinden rakip bölgelerine füze yağar. Her rakip, taban hasar ile askerlerinin %70’inden büyük olanı kaybeder. Ordusu tükenenin vurulan bölgeleri ele geçirilir. Coin karşılığı asker de eklenir."
		"factory":
			_description.text = "Her fabrika savaş çalışırken saniyede 5 asker üretir."
		"soldiers":
			_description.text = "Seçtiğin ek asker, hediyenin coin karşılığı askerlere eklenir."
		"tank", "helicopter", "jet":
			_description.text = "Seçtiğin birlik, hediyenin coin karşılığına eklenir."
		_:
			_description.text = "Kuralı olmayan hediyeler coin hesabını kullanır."


func _change_unit(index: int) -> void:
	if index <= 0:
		return
	var unit: String = UNIT_KEYS[index]
	if not _selected_id.is_empty():
		_amount.apply()
		if _actions[_selected_id].unit != unit:
			_set_action(unit, MISSILE_DEFAULT_DAMAGE if unit == "missile" else 1)
	_sync_editor()
	_refresh_page()


func _change_amount(value: float) -> void:
	if _loading_selection or _selected_id.is_empty():
		return
	var action: Dictionary = _actions[_selected_id]
	_set_action(action.unit, int(value))


func _set_action(unit: String, count: int) -> void:
	var action := {"unit": unit, "count": count}
	_actions[_selected_id] = action
	if _rule_rows.has(_selected_id):
		_rule_rows[_selected_id].amount.text = _rule_amount(action)
	_status.hide()


func _remove_selected() -> void:
	_actions.erase(_selected_id)
	_reset_editor()
	_refresh_rules()
	_unit.grab_focus()


func _save() -> void:
	_soldiers_per_coin.apply()
	if not _selected_id.is_empty():
		_amount.apply()
	if not _app.has_method("save_gift_actions"):
		_status.text = "Hediye ayarları kaydedilemedi."
		_status.show()
		return
	var engagement := {}
	for kind in _engagement_controls:
		var fields: Dictionary = _engagement_controls[kind]
		if fields.threshold != null:
			fields.threshold.apply()
		fields.soldiers.apply()
		fields.count.apply()
		engagement[kind] = {"threshold": int(fields.threshold.value) if fields.threshold != null else 1,
			"soldiers": int(fields.soldiers.value), "unit": Rules.ENGAGEMENT_UNITS[fields.unit.selected],
			"count": int(fields.count.value)}
	var saved: Variant = _app.save_gift_actions(_actions.duplicate(true), int(_soldiers_per_coin.value), engagement)
	if saved == true:
		hide()
	else:
		_status.text = "Hediye ayarları kaydedilemedi. Yeniden deneyebilirsin."
		_status.show()
