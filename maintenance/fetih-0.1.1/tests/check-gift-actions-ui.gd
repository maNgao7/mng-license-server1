extends SceneTree
## Native UI regression using Run-Game.ps1 with --self-test and an isolated profile.
## Optional --gift-ui-capture=<existing directory> captures compact game PNGs.

const Actions = preload("../mod/GiftActions.gd")
const Rules = preload("../mod/WarRules.gd")
const LONG_GIFT := "17846"
const LONG_NAME := "Cadılar Bayramı Eğlenceli Şapka"
const BOOTSTRAP_FIXTURE := {
	LONG_GIFT: {"unit": "tank", "count": 8},
	"5269": {"unit": "tank", "count": 2},
	"5593": {"unit": "factory", "count": 3},
	"5827": {"unit": "headquarters", "count": 1},
	"5868": {"unit": "jet", "count": 4},
	"7934": {"unit": "helicopter", "count": 5},
	"99999999999999999999": {"unit": "soldiers", "count": 4200},
}
const NEW_GIFT := "5655"

var checks := 0
var failures := 0


func _initialize() -> void:
	_run.call_deferred()


func _check(ok: bool, message: String) -> bool:
	checks += 1
	if not ok:
		failures += 1
		printerr("GIFT_ACTIONS_UI_FAIL: ", message)
	return ok


func _press_b() -> void:
	var key := InputEventKey.new()
	key.keycode = KEY_B
	key.pressed = true
	root.push_input(key)


func _choose_action(dialog: AcceptDialog, unit: String) -> void:
	var picker: OptionButton = dialog._unit
	var index := Actions.UNIT_KEYS.find(unit)
	picker.select(index)
	picker.item_selected.emit(index)


func _choose_item(list: ItemList, index: int) -> void:
	list.select(index)
	list.item_selected.emit(index)


func _choose_rule(dialog: AcceptDialog, id: String) -> bool:
	if not dialog._rule_rows.has(id):
		return false
	var button: Button = dialog._rule_rows[id].button
	button.pressed.emit()
	return true


func _click_row(dialog: AcceptDialog, label: Label) -> void:
	var point := label.get_global_rect().get_center()
	for pressed in [true, false]:
		var click := InputEventMouseButton.new()
		click.position = point
		click.global_position = point
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = pressed
		dialog.push_input(click, true)


func _check_compact_layout(dialog: AcceptDialog, state: String) -> void:
	_check(root.size == Vector2i(1000, 650), "compact game runs at 1000 × 650 for " + state)
	var dialog_rect := Rect2(Vector2.ZERO, Vector2(dialog.size))
	var controls: Array[Control] = [dialog._rules_scroll, dialog._unit, dialog._search,
		dialog._list, dialog._amount_row, dialog._remove, dialog._soldiers_per_coin,
		dialog._selection_label, dialog._navigation, dialog._previous, dialog._page_label,
		dialog._next, dialog.get_ok_button(), dialog._cancel]
	var fits := Rect2i(Vector2i.ZERO, root.size).encloses(Rect2i(dialog.position, dialog.size))
	for control in controls:
		if control.is_visible_in_tree():
			fits = fits and dialog_rect.encloses(control.get_global_rect())
	_check(fits, "dialog and visible controls fit for %s (%s / %s)" % [state, dialog.size, root.size])


func _contrast(foreground: Color, background: Color) -> float:
	var fg := foreground.srgb_to_linear().get_luminance()
	var bg := background.srgb_to_linear().get_luminance()
	return (maxf(fg, bg) + 0.05) / (minf(fg, bg) + 0.05)


func _check_theme(dialog: AcceptDialog) -> void:
	var panel: StyleBoxFlat = dialog.get_theme_stylebox("panel", "AcceptDialog")
	var search: LineEdit = dialog._search
	var field: StyleBoxFlat = search.get_theme_stylebox("normal")
	var list: ItemList = dialog._list
	var selected: StyleBoxFlat = list.get_theme_stylebox("selected_focus")
	var save := dialog.get_ok_button()
	var primary: StyleBoxFlat = save.get_theme_stylebox("normal")
	var page: Label = dialog._page_label
	_check(panel.bg_color.srgb_to_linear().get_luminance() < 0.05
		and field.bg_color.srgb_to_linear().get_luminance() < 0.05,
		"the dialog and search field have dark surfaces")
	_check(_contrast(search.get_theme_color("font_color"), field.bg_color) >= 7.0
		and _contrast(list.get_theme_color("font_selected_color"), selected.bg_color) >= 7.0,
		"search and selected gifts keep high text contrast")
	_check(save.get_theme_font_size("font_size") >= 20 and save.size.x >= 140
		and _contrast(save.get_theme_color("font_color"), primary.bg_color) >= 7.0
		and primary.bg_color == page.get_theme_color("font_color")
		and primary.bg_color == selected.border_color,
		"Save is prominent and its gold matches selection and paging")


func _check_catalog_fit(dialog: AcceptDialog) -> void:
	var list: ItemList = dialog._list
	var panel := list.get_theme_stylebox("panel")
	var font := list.get_theme_font("font")
	var font_size := list.get_theme_font_size("font_size")
	var width := list.size.x - panel.get_minimum_size().x - list.fixed_icon_size.x
	width -= list.get_theme_constant("icon_margin") + 16 # Scrollbar and row spacing.
	var longest := ""
	for entry: Dictionary in dialog._entries:
		var text := "%s   ·   %s coin" % [entry.name, entry.coins]
		if font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > width:
			longest = text
			break
	_check(longest.is_empty() and font_size >= 18
		and list.text_overrun_behavior == TextServer.OVERRUN_NO_TRIMMING,
		"catalog names and coin values fit at full size in the compact window: " + longest)

	var row_pixels: Dictionary = {}
	for y in range(ceili(panel.get_margin(SIDE_TOP)), floori(list.size.y - panel.get_margin(SIDE_BOTTOM))):
		var item := list.get_item_at_position(Vector2(50, y), true)
		if item >= 0:
			row_pixels[item] = int(row_pixels.get(item, 0)) + 1
	var full_rows := 0
	for pixels: int in row_pixels.values():
		if pixels >= maxi(list.fixed_icon_size.y, ceili(font.get_height(font_size))):
			full_rows += 1
	_check(full_rows >= 7, "the compact catalog shows at least seven full rows with engagement settings visible (%d visible)" % full_rows)


func _search_for(dialog: AcceptDialog, query: String) -> void:
	var search: LineEdit = dialog._search
	search.text = query
	search.text_changed.emit(query)


func _icon_matches(icon: Texture2D, image: Image) -> bool:
	if icon == null or image == null or image.is_empty():
		return false
	var actual := icon.get_image()
	return actual != null and actual.get_size() == image.get_size() and actual.get_data() == image.get_data()


func _check_legacy_catalog_icons(dialog: AcceptDialog) -> void:
	var fixture := OS.get_environment("TIKMNG_ANIMAL_PROFILE").path_join("gift-icon-fixture")
	if not _check(DirAccess.make_dir_recursive_absolute(fixture) == OK, "create an isolated gift catalog"):
		return
	var originals: String = dialog._catalog_path
	var images := {}
	var rows: Array[Dictionary] = []
	for id: String in ["5269", "7934", NEW_GIFT]:
		var row: Dictionary = dialog._catalog_by_id[id]
		var source := originals.path_join(id + ".png")
		var file := "0.png" if id == NEW_GIFT else id + ".png"
		if not _check(DirAccess.copy_absolute(source, fixture.path_join(file)) == OK, "stage gift icon " + file):
			return
		images[id] = Image.load_from_file(source)
		rows.append({"id": id, "name": row.name, "coins": int(row.coins), "file": "0.png"})
	var catalog := FileAccess.open(fixture.path_join("katalog_tam.json"), FileAccess.WRITE)
	if not _check(catalog != null, "write legacy catalog rows pointing to 0.png"):
		return
	catalog.store_string(JSON.stringify(rows))
	catalog.close()

	dialog._catalog_path = fixture
	dialog._load_catalog()
	dialog._reset_editor()
	dialog._refresh_rules()
	_choose_action(dialog, "jet")
	for id: String in images:
		_search_for(dialog, id)
		_check(dialog._list.item_count == 1 and _icon_matches(dialog._list.get_item_icon(0), images[id]),
			"legacy catalog loads the ID icon when present and the bundled fallback otherwise: " + id)
		if id != NEW_GIFT:
			var icons: Array[Node] = dialog._rule_rows[id].card.find_children("*", "TextureRect", true, false)
			_check(icons.size() == 1 and _icon_matches(icons[0].texture, images[id]),
				"saved rule uses the original icon for the same gift ID: " + id)
		DirAccess.remove_absolute(fixture.path_join("0.png" if id == NEW_GIFT else id + ".png"))
	DirAccess.remove_absolute(fixture.path_join("katalog_tam.json"))
	DirAccess.remove_absolute(fixture)


func _capture(filename: String) -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--gift-ui-capture="):
			await process_frame
			await RenderingServer.frame_post_draw
			var image := root.get_texture().get_image()
			_check(image != null and image.get_size() == Vector2i(1000, 650)
				and image.save_png(arg.trim_prefix("--gift-ui-capture=").path_join(filename)) == OK,
				"capture compact rendered game " + filename)


func _run() -> void:
	if not _check("--self-test" in OS.get_cmdline_user_args()
			and not OS.get_environment("TIKMNG_ANIMAL_PROFILE").is_empty(),
			"requires --self-test and an isolated TIKMNG_ANIMAL_PROFILE"):
		quit(1)
		return

	var project_dir: String = get_script().resource_path.get_base_dir().get_base_dir()
	var script: GDScript = load(project_dir.path_join("mod/LiveWar.gd"))
	if not _check(script != null and script.can_instantiate(), "load the native game"):
		quit(1)
		return
	var app: Node = script.new()
	app.mod_root = project_dir.path_join("mod")
	root.add_child(app)
	root.size = root.min_size
	await process_frame

	_check(app.save_gift_actions(BOOTSTRAP_FIXTURE, 50), "seed settings through the game save API")
	_press_b()
	await process_frame
	var dialog: AcceptDialog = app.gift_dialog
	if not _check(is_instance_valid(dialog) and dialog.visible, "B opens the real gift editor"):
		quit(1)
		return
	_check(dialog._unit.has_focus(), "new rules start with the action picker focused")
	_check(dialog._unit.get_item_text(Actions.UNIT_KEYS.find("jet")) == "Jet ekle", "Jet is offered")
	_check(not dialog._search.editable and dialog._list.is_item_disabled(0)
		and not dialog._amount_row.visible, "gift and amount wait for the action")
	_check(dialog._rule_rows.size() == BOOTSTRAP_FIXTURE.size(),
		"all existing rules are listed, including IDs absent from the catalog")
	_check(dialog._catalog_hint.visible and not dialog._navigation.visible,
		"the initial catalog shows the action prompt without paging controls")
	await process_frame
	_check_compact_layout(dialog, "opening the panel")
	_check_theme(dialog)
	await _capture("01-action-first.png")
	if not _check(dialog._rule_rows.has(LONG_GIFT), "long-name fixture has a saved row"):
		quit(1)
		return
	var name_label: Label = dialog._rule_rows[LONG_GIFT].gift_name
	var saved_row: Button = dialog._rule_rows[LONG_GIFT].button
	_check(name_label.text == LONG_NAME and name_label.get_line_count() > 1
		and name_label.text_overrun_behavior == TextServer.OVERRUN_NO_TRIMMING
		and saved_row.get_global_rect().encloses(name_label.get_global_rect()),
		"the full catalog name wraps inside its saved row")
	_check(saved_row.size.y >= 52, "saved rows provide a roomy click target")
	_click_row(dialog, name_label)
	await process_frame
	_check(dialog._selected_id == LONG_GIFT and saved_row.button_pressed
		and dialog._selection_label.text.begins_with(LONG_NAME),
		"clicking the wrapped name opens its rule and shows the full selected gift")
	_check_compact_layout(dialog, "editing the long-name rule with paging")
	_check_catalog_fit(dialog)
	await _capture("02-long-saved-name.png")
	_search_for(dialog, LONG_GIFT)
	_check(dialog._list.item_count == 1 and dialog._list.get_item_text(0).begins_with(LONG_NAME + "   ·"),
		"search by ID shows the complete long name in the gift catalog")

	for id in BOOTSTRAP_FIXTURE:
		if _check(_choose_rule(dialog, id), "select existing rule " + id):
			var rule: Dictionary = BOOTSTRAP_FIXTURE[id]
			_check(dialog._selected_id == id and Actions.UNIT_KEYS[dialog._unit.selected] == rule.unit
				and int(dialog._amount.value) == rule.count
				and dialog._amount.get_line_edit().text == str(rule.count), "restore the action and count for " + id)
			_check(dialog._amount_row.visible == (rule.unit != "headquarters"),
				"only adjustable rules offer an amount for " + id)
	_check(dialog._actions == BOOTSTRAP_FIXTURE, "browsing existing rules preserves every mapping")

	dialog._new_rule.pressed.emit()
	_check(dialog._unit.selected == 0 and dialog._unit.has_focus()
		and not dialog._search.editable, "New rule returns to the action-first editor")
	_choose_action(dialog, "jet")
	_search_for(dialog, "7934")
	if _check(dialog._list.item_count == 1, "find a previously configured gift in the catalog"):
		_choose_item(dialog._list, 0)
		_check(Actions.UNIT_KEYS[dialog._unit.selected] == "helicopter"
			and dialog._amount.value == 5 and dialog._actions == BOOTSTRAP_FIXTURE,
			"selecting a configured gift loads its rule without overwriting it")
	dialog._new_rule.pressed.emit()
	_choose_action(dialog, "jet")
	await process_frame
	_check(dialog._search.editable and not dialog._list.is_item_disabled(0)
		and not dialog._amount_row.visible, "selecting Jet enables gifts and still gates amount")
	_check(dialog._navigation.visible and not dialog._next.disabled, "the full catalog offers paging")
	await _capture("04-catalog-page.png")
	dialog._next.pressed.emit()
	_check(dialog._page == 1 and not dialog._previous.disabled
		and dialog._page_label.text.begins_with("Sayfa 2 / "), "Next advances and shows the second catalog page")
	dialog._previous.pressed.emit()
	_check(dialog._page == 0, "Previous returns to the first catalog page")
	_check(dialog._unit.get_global_rect().end.x < dialog._search.get_global_rect().position.x,
		"action is immediately before gift search")
	_search_for(dialog, "gul")
	_check(dialog._list.item_count > 0, "gift search keeps Turkish name folding")
	_search_for(dialog, NEW_GIFT)
	if not _check(dialog._list.item_count == 1, "find a single gift by ID"):
		quit(1)
		return
	_choose_item(dialog._list, 0)
	await process_frame
	_check(dialog._selected_id == NEW_GIFT and dialog._amount_row.visible
		and dialog._amount.get_global_rect().position.y > dialog._list.get_global_rect().end.y,
		"selecting the gift enables the amount below the catalog")
	dialog._amount.get_line_edit().text = "7"
	_search_for(dialog, "does-not-match-a-gift")
	_check(dialog._selected_id == NEW_GIFT and dialog._amount_row.visible,
		"searching retains the rule being edited")
	_check(_choose_rule(dialog, "7934"), "switch to the saved helicopter rule")
	_check(dialog._actions[NEW_GIFT] == {"unit": "jet", "count": 7},
		"switching rules commits the typed amount to the correct gift")
	_check(dialog._amount.value == 5, "the saved helicopter amount is restored")
	_choose_action(dialog, "tank")
	_search_for(dialog, "7934")
	await process_frame
	dialog._amount.get_line_edit().text = "6"
	dialog._soldiers_per_coin.get_line_edit().text = "65"
	_check(dialog._rule_rows["7934"].amount.text == "1 tank",
		"changing action immediately updates the saved-row summary and resets its amount")
	_check_compact_layout(dialog, "editing a filtered rule")
	await _capture("03-editing-rule.png")

	_check(app.settings.giftActions == BOOTSTRAP_FIXTURE, "edits stay in the dialog until Save")
	dialog.get_ok_button().pressed.emit()
	var expected := BOOTSTRAP_FIXTURE.duplicate(true)
	expected[NEW_GIFT] = {"unit": "jet", "count": 7}
	expected["7934"] = {"unit": "tank", "count": 6}
	_check(not dialog.visible and app.settings.giftActions == expected and app.settings.soldiersPerCoin == 65,
		"Save adds the new Jet rule and edits the selected rule while preserving all other rules: %s / %s"
		% [app.settings.giftActions, app.settings.soldiersPerCoin])

	_press_b()
	await process_frame
	_check(_choose_rule(dialog, NEW_GIFT) and dialog._amount.value == 7
		and dialog._rule_rows[NEW_GIFT].amount.text == "7 jet", "reopening restores the new Jet rule and row summary")
	dialog._remove.pressed.emit()
	_check(not dialog._actions.has(NEW_GIFT) and app.settings.giftActions.has(NEW_GIFT),
		"removing an override is staged until Save")
	dialog._cancel.pressed.emit()
	await process_frame
	if not _check(not dialog.visible, "Cancel closes the B dialog"):
		quit(1)
		return
	_press_b()
	await process_frame
	_check(_choose_rule(dialog, NEW_GIFT), "canceling discards staged removal")
	dialog._remove.pressed.emit()
	dialog.get_ok_button().pressed.emit()
	expected.erase(NEW_GIFT)
	_check(not dialog.visible and app.settings.giftActions == expected,
		"saving a removal restores the default for that gift only")
	_press_b()
	await process_frame
	var wide_amounts := {
		"5269": {"unit": "tank", "count": Rules.MAX_INTEGER - 2},
		"7934": {"unit": "helicopter", "count": Rules.MAX_INTEGER - 1},
		"5868": {"unit": "jet", "count": Rules.MAX_INTEGER},
	}
	for id in wide_amounts:
		if _check(_choose_rule(dialog, id), "select rule for full-width quantity " + id):
			var rule: Dictionary = wide_amounts[id]
			_choose_action(dialog, rule.unit)
			_check(int(dialog._amount.max_value) == Rules.MAX_INTEGER, "large quantity limit for " + rule.unit)
			dialog._amount.get_line_edit().text = str(rule.count)
			dialog._amount.apply()
			_check(dialog._actions[id] == rule, "accept exact large count for %s (%s)" % [rule.unit, dialog._actions[id]])
	dialog.get_ok_button().pressed.emit()
	expected.merge(wide_amounts, true)
	_check(not dialog.visible and app.settings.giftActions == expected,
		"all three large quantities save through the normal game settings")
	_press_b()
	await process_frame
	for id in wide_amounts:
		var rule: Dictionary = wide_amounts[id]
		_check(_choose_rule(dialog, id) and dialog._amount.get_line_edit().text == str(rule.count),
			"reopening displays the full quantity for " + rule.unit)
	_check_legacy_catalog_icons(dialog)
	dialog._cancel.pressed.emit()
	_check(app.live.url.is_empty() and int(app.live.child_pid) < 1,
		"the UI regression opens no broadcast session")

	app.free()
	await process_frame
	if failures == 0:
		print("GIFT_ACTIONS_UI_OK: %d checks; Godot %s" % [checks, Engine.get_version_info().string])
	quit(0 if failures == 0 else 1)
