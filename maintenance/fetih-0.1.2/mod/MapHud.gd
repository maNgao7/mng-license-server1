extends Control

const ACTION_COLOR := Color("#f6cb72")
const BUTTON_SIZE := 86.0
const ACTION_RADIUS := 104.0

var board: Control
var card: PanelContainer
var snapshot: Label
var side_cards: Array[PanelContainer] = []
var side_headings: Array[Label] = []
var side_details: Array[Label] = []
var number_plate: StyleBoxFlat
var hover_left := 0.0
var hover_index := -1
var action_region := -1
var action_owner := ""
var action_anchor := Vector2.ZERO
var action_buttons: Array[Button] = []
var targeting := false

func configure(map: Control) -> void:
	board = map
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	card = PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.z_index = 2
	var style: StyleBoxFlat = map.app.box_style(Color("#16232e"), Color("#cda775"), 8)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		style.set_content_margin(side, 10)
	card.add_theme_stylebox_override("panel", style)
	add_child(card)
	var content := VBoxContainer.new()
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.custom_minimum_size.x = 310
	content.add_theme_constant_override("separation", 7)
	card.add_child(content)
	snapshot = map.app.text(content, "", 15, Color("#fff3d8"))
	snapshot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for tint in [Color("#ff9c88"), Color("#85e0d5")]:
		var side := PanelContainer.new()
		side.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var frame: StyleBoxFlat = map.app.box_style(Color("#16232e").lerp(tint, 0.10), tint.darkened(0.30), 6)
		for edge in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
			frame.set_content_margin(edge, 8)
		side.add_theme_stylebox_override("panel", frame)
		content.add_child(side)
		var labels := VBoxContainer.new()
		labels.mouse_filter = Control.MOUSE_FILTER_IGNORE
		side.add_child(labels)
		var heading: Label = map.app.text(labels, "", 15, tint)
		var details: Label = map.app.text(labels, "", 14, Color("#fff3d8"))
		heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
		details.mouse_filter = Control.MOUSE_FILTER_IGNORE
		side_cards.append(side)
		side_headings.append(heading)
		side_details.append(details)
	number_plate = map.app.box_style(Color("#253845"), Color("#d5c5a4"), 4)
	card.hide()
	_add_action("Saldır", _arm_attack, ACTION_COLOR)
	_add_action("Tank\nekle", _grant_unit.bind("tank"), Color("#a2c8ab"))
	_add_action("Helikopter\nekle", _grant_unit.bind("helicopter"), Color("#a9d3ea"))
	_add_action("Karargâh\nekle", _grant_headquarters, Color("#f6dfab"))
	_add_action("Her yere\nsaldır", _attack_surroundings, Color("#ff9d80"))
	action_buttons[-1].tooltip_text = "Haritadaki rakiplere sırayla saldır."
	_add_action("Jet\nekle", _grant_unit.bind("jet"), Color("#beb8f3"))

func _add_action(label: String, action: Callable, tint: Color) -> void:
	var button := Button.new()
	button.text = label
	button.clip_text = true
	button.custom_minimum_size = Vector2.ONE * BUTTON_SIZE
	button.size = button.custom_minimum_size
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_font_override("font", board.app.ui_font)
	button.add_theme_font_size_override("font_size", 14)
	button.add_theme_color_override("font_color", tint.lightened(0.15))
	button.add_theme_color_override("font_hover_color", Color("#fff6de"))
	button.add_theme_color_override("font_pressed_color", Color("#fff6de"))
	button.add_theme_stylebox_override("normal", _action_style(Color("#182932"), tint.darkened(0.20)))
	button.add_theme_stylebox_override("hover", _action_style(Color("#34454b"), tint))
	button.add_theme_stylebox_override("pressed", _action_style(Color("#413b30"), tint))
	button.add_theme_stylebox_override("focus", _action_style(Color.TRANSPARENT, Color("#fff6de")))
	button.z_index = 3
	button.pressed.connect(action)
	add_child(button)
	action_buttons.append(button)
	button.hide()

func _action_style(fill: Color, edge: Color) -> StyleBoxFlat:
	var style: StyleBoxFlat = board.app.box_style(fill, edge, int(BUTTON_SIZE * 0.5))
	style.content_margin_left = 3
	style.content_margin_right = 3
	return style

func handle_map_click(region: int, cursor: Vector2) -> void:
	if not visible:
		return
	if region >= 0:
		board.selected_region = region
	if targeting and _source_is_owned():
		if region < 0:
			cancel_region_action()
		elif board.app.start_region_attack(action_region, region):
			cancel_region_action()
		return
	cancel_region_action()
	if region < 0:
		return
	board.app.click_region(region)
	var owner: String = board.app.region_owner(region)
	if owner.is_empty():
		return
	action_region = region
	action_owner = owner
	action_anchor = board.map_point(cursor)
	card.hide()
	_layout_actions(board.project_map_point(action_anchor))

func cancel_region_action() -> bool:
	var was_open := action_region >= 0
	action_region = -1
	action_owner = ""
	targeting = false
	for button in action_buttons:
		button.hide()
	return was_open

func _source_is_owned() -> bool:
	return action_region >= 0 and board.app.region_owner(action_region) == action_owner

func _arm_attack() -> void:
	if not _source_is_owned():
		cancel_region_action()
		return
	if int(board.app.player_view(action_owner).troops) <= 0:
		board.app.notice("Bu orduda asker kalmadı. Takviye geldikten sonra saldırabilir.")
		return
	if board.app.is_paused():
		board.app.notice("Savaş duraklatıldı. Üstteki Devam et düğmesini kullan.")
		return
	targeting = true
	for button in action_buttons:
		button.hide()
	board.app.notice("Saldırmak için rakibe ait bir bölgeye tıkla. Esc ile iptal et.")

func _grant_unit(unit: String) -> void:
	if _source_is_owned():
		board.app.grant_region_unit(action_region, unit)
	cancel_region_action()

func _grant_headquarters() -> void:
	if _source_is_owned():
		board.app.grant_region_headquarters(action_region)
	cancel_region_action()

func _attack_surroundings() -> void:
	if _source_is_owned():
		board.app.start_surrounding_attack(action_region)
	cancel_region_action()

func _layout_actions(anchor: Vector2) -> void:
	var half := Vector2.ONE * BUTTON_SIZE * 0.5
	var minimum := Vector2.ONE * (ACTION_RADIUS + 4.0) + half
	var maximum := (size - minimum).max(minimum)
	var center := anchor.clamp(minimum, maximum)
	for index in action_buttons.size():
		var button := action_buttons[index]
		var offset := Vector2.UP.rotated(TAU * index / action_buttons.size()) * ACTION_RADIUS
		button.position = center + offset - half
		button.show()

func _process(delta: float) -> void:
	if not visible:
		return
	queue_redraw()
	if action_region >= 0:
		var anchor: Vector2 = board.project_map_point(action_anchor)
		var on_screen := Rect2(Vector2.ZERO, size).has_point(anchor)
		if not _source_is_owned() or not on_screen or board.get_viewport().gui_is_dragging() or board.dragging:
			cancel_region_action()
		elif not targeting:
			_layout_actions(anchor)
	if board.hovered != hover_index:
		hover_index = board.hovered
		hover_left = 0.14
		card.hide()
	if hover_index < 0 or action_region >= 0 or board.dragging or board.get_viewport().gui_is_dragging():
		card.hide()
		return
	var cursor := get_local_mouse_position()
	hover_left -= delta
	if hover_left <= 0.0:
		hover_left = 0.12
		update_hover_card(board.region_hover_data(cursor))
	if card.visible:
		var extent := card.get_combined_minimum_size()
		card.position = (cursor + Vector2(18, 21)).clamp(Vector2(4, 4), (size - extent - Vector2(4, 4)).max(Vector2(4, 4)))

func update_hover_card(info: Dictionary) -> void:
	if info.is_empty():
		card.hide()
		return
	var sections: Array = info.sections
	snapshot.text = info.title
	if sections.size() == 1:
		snapshot.text += "\n" + sections[0].heading + "\n" + sections[0].body
	for index in side_cards.size():
		side_cards[index].visible = sections.size() == 2
		if side_cards[index].visible:
			side_headings[index].text = sections[index].heading
			side_details[index].text = sections[index].body
	card.reset_size()
	card.show()

func _draw() -> void:
	if board == null:
		return
	var font: Font = board.app.ui_font
	for region in board.regions:
		var number := region_number_text(region.id)
		if number.is_empty():
			continue
		var point: Vector2 = board.project_map_point(region.center)
		if not Rect2(Vector2.ZERO, size).has_point(point):
			continue
		var badge := Rect2(point.round() - Vector2(13.0, 9.0), Vector2(26, 18))
		draw_style_box(number_plate, badge)
		draw_string(font, badge.position + Vector2(1, 13), number,
			HORIZONTAL_ALIGNMENT_CENTER, 24, 12, Color("#fff3d8"))
	_draw_actions()
	for battle in board.app.battle_views():
		var b: Vector2 = board.project_map_point(board.regions[battle.to_region].center)
		if not b.is_finite():
			continue
		var elapsed := float(battle.elapsed)
		var contact := float(battle.deployment)
		if elapsed <= contact + 1.4:
			_draw_target(b, elapsed, contact)

func region_number_text(region: int) -> String:
	return "%02d" % (region + 1) if board.app.region_owner(region).is_empty() else ""

func _draw_actions() -> void:
	if action_region < 0:
		return
	var anchor: Vector2 = board.project_map_point(action_anchor)
	if not anchor.is_finite():
		return
	draw_arc(anchor, 12, 0.0, TAU, 32, Color("#25201c"), 4, true)
	draw_arc(anchor, 12, 0.0, TAU, 32, ACTION_COLOR, 2, true)
	if targeting:
		var cursor := get_local_mouse_position()
		if Rect2(Vector2.ZERO, size).has_point(cursor):
			var hovered: int = board.region_at(cursor)
			var owner: String = board.app.region_owner(hovered)
			var color := ACTION_COLOR if not owner.is_empty() and owner != action_owner else Color("#524838")
			draw_dashed_line(anchor, cursor, Color(color, 0.78), 1.5, 6.0, true, true)
			draw_arc(cursor, 10, 0.0, TAU, 24, color, 2, true)
	else:
		for button in action_buttons:
			draw_line(anchor, button.position + button.size * 0.5, Color("#493e2d"), 3, true)

func _draw_target(at: Vector2, elapsed: float, contact: float) -> void:
	var fade := 1.0 - smoothstep(contact + 0.35, contact + 1.4, elapsed)
	var radius := 22.0 + 7.0 * smoothstep(contact, contact + 0.55, elapsed)
	for quadrant: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var corner := at + quadrant * radius
		var bracket := PackedVector2Array([corner - Vector2(quadrant.x * 8.0, 0.0), corner,
			corner - Vector2(0.0, quadrant.y * 8.0)])
		draw_polyline(bracket, Color("#302416", fade), 4.0, true)
		draw_polyline(bracket, Color(ACTION_COLOR, fade), 2.0, true)
