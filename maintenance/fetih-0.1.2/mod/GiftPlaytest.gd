extends Node

const RULES := preload("WarRules.gd")
const LIVE_FIELDS := ["rules", "settings", "unknown_gifts", "processed_chat", "battle_routes",
	"surrounding_orders", "pending_surrounding", "pending_missiles", "attack_requests", "map_worlds",
	"country_leaders", "conquest_owner", "conquest_left", "headquarters_pulses", "inactive_gift_receipts",
	"inactive_chat_receipts", "factory_save_left", "accepted_live_counts", "attack_request_number",
	"selected_player", "selected_target", "missile_checkpoint_due"]

var _app: Node
var _original := {}
var _original_view := {}
var _choice := {}
var _dragging := false
var _banner: PanelContainer
var _cursor: PanelContainer
var _caption: Label
var _serial := 0


func configure(app: Node) -> void:
	_app = app
	_banner = PanelContainer.new()
	_banner.add_theme_stylebox_override("panel", _app.box_style(Color("#182932"), Color("#f2c66a"), 8))
	_app.ui.add_child(_banner)
	_banner.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_banner.offset_left = -288.0
	_banner.offset_top = -60.0
	_banner.offset_right = -12.0
	_banner.offset_bottom = -12.0
	var content := HBoxContainer.new()
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	_banner.add_child(content)
	var title: Label = _app.text(content, "Hediye testi", 16, Color("#f2c66a"))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_app.button(content, "Testi bitir", finish.bind(true))
	_banner.hide()

	_cursor = PanelContainer.new()
	_cursor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cursor.add_theme_stylebox_override("panel", _app.box_style(Color("#203540"), Color("#f2c66a"), 7))
	_app.ui.add_child(_cursor)
	_caption = _app.text(_cursor, "", 15)
	_caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cursor.hide()
	set_process(false)


func is_active() -> bool:
	return not _original.is_empty()


func offer(choice: Dictionary, dragging: bool) -> void:
	if choice.is_empty() or not _app.gift_dialog.visible:
		return
	_choice = choice
	_dragging = dragging
	_app.gift_dialog.hide_for_test()
	if dragging:
		_caption.text = "%s  ·  %s" % [choice.name, choice.label]
		_cursor.reset_size()
		_cursor.position = _app.ui.get_local_mouse_position() + Vector2(16, 18)
		_cursor.show()
		set_process(true)
	else:
		_app.notice("%s testini uygulamak için haritada bir bölge seç." % choice.name)


func _process(_delta: float) -> void:
	_cursor.position = _app.ui.get_local_mouse_position() + Vector2(16, 18)
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		return
	var point: Vector2 = _app.canvas.get_local_mouse_position()
	var canvas_rect := Rect2(Vector2.ZERO, _app.canvas.size)
	var region: int = _app.canvas.region_at(point) if canvas_rect.has_point(point) else -1
	if region < 0:
		cancel_selection()
	else:
		_apply(region)


func apply_click(region: int) -> bool:
	if _choice.is_empty() or _dragging:
		return false
	if region >= 0:
		_apply(region)
	return true


func cancel_selection() -> bool:
	if _choice.is_empty():
		return false
	_clear_selection()
	_app.gift_dialog.open()
	return true


func _clear_selection() -> void:
	_choice = {}
	_dragging = false
	_cursor.hide()
	set_process(false)


func _apply(region: int) -> void:
	var choice := _choice
	_clear_selection()
	if not is_active() and not _begin():
		return
	var owner: String = _app.region_owner(region)
	var unplaced := owner.is_empty()
	if unplaced:
		owner = "hediye_test_%d" % region
	var action: Dictionary = choice.action
	if action.unit in ["missile", "surrounding"]:
		_seed_opponent(region, owner)
	var event := _gift_event(owner, "Test ordusu %d" % (region + 1), choice.coins)
	event.giftId = choice.id
	var test_rules: RefCounted = _app.rules
	test_rules.set_soldiers_per_coin(int(choice.ratio))
	if not _app.accept_live_event(event, false, action):
		return
	if unplaced:
		_app.place_player(owner, region)
	_app._refresh()
	_app.notice("Hediye testi · %s · %s" % [choice.name, choice.label])


func _seed_opponent(region: int, owner: String) -> void:
	for tile in _app.canvas.regions:
		var existing: String = _app.region_owner(tile.id)
		if not existing.is_empty() and existing != owner:
			return
	for tile in _app.canvas.regions:
		if tile.id == region or not _app.region_owner(tile.id).is_empty():
			continue
		var rival := "hediye_rakip_%d" % int(tile.id)
		_app.accept_live_event(_gift_event(rival, "Test rakibi", 20))
		_app.place_player(rival, int(tile.id))
		return


func _gift_event(owner: String, nickname: String, coins: int) -> Dictionary:
	_serial += 1
	return {"type": "gift", "username": owner, "nickname": nickname,
		"eventId": "local-gift-test-%d" % _serial, "giftCoinValue": coins, "repeatCount": 1}


func _begin() -> bool:
	for field in LIVE_FIELDS:
		_original[field] = _app.get(field)
	_original_view = _camera_state()
	_app.live.event_delivery_paused = true
	if not _app._make_map():
		_original.clear()
		_app.live.event_delivery_paused = false
		_app.notice("Hediye test haritası açılamadı.")
		return false
	for field in LIVE_FIELDS:
		if _original[field] is Dictionary:
			_app.set(field, {})
	_app.settings = _original.settings.duplicate(true)
	_app.accepted_live_counts = {"gift": 0, "chat": 0, "other": 0}
	_app.selected_player = ""
	_app.selected_target = ""
	_app.factory_save_left = 10.0
	_app._restore_map_state()
	_app.close_army_details()
	_app.victory_scene.dismiss()
	_apply_camera(_original_view)
	_banner.show()
	_app._live_status()
	return true


func finish(rebuild_map: bool) -> void:
	_clear_selection()
	if not is_active():
		return
	var stored := _original
	_app._cancel_missile()
	_app._reset_conquest()
	if rebuild_map:
		_app._make_map()
	for field in LIVE_FIELDS:
		_app.set(field, stored[field])
	_original = {}
	_app.surrounding_check_left = 0.0
	_app.victory_scene.dismiss()
	_app.close_army_details()
	_app.live.event_delivery_paused = false
	_app.live.next_poll = 0.0
	_banner.hide()
	_app._live_status()
	if rebuild_map:
		if not _app.conquest_owner.is_empty() and _app.rules.round_phase() == "running":
			_app._show_conquest_count()
		_apply_camera(_original_view)
		_app._refresh()
		_app.notice("Hediye testi bitti. Gerçek tur devam ediyor.")
	_original_view.clear()


func _camera_state() -> Dictionary:
	return {"zoom": _app.canvas.zoom_factor, "rotation": _app.canvas.view_rotation,
		"pan": _app.canvas.pan_world, "tilt": _app.canvas._tilt_override}


func _apply_camera(view: Dictionary) -> void:
	_app.canvas.zoom_factor = view.zoom
	_app.canvas.view_rotation = view.rotation
	_app.canvas.pan_world = view.pan
	_app.canvas._tilt_override = view.tilt
	_app.canvas.fit_map()
