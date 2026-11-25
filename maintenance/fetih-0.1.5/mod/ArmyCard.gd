extends PanelContainer

var app: Node
var player_id := ""
var pressed_on_card := false

class TerritoryBadge:
	extends Control
	func _draw() -> void:
		for side in [-1.0, 1.0]:
			draw_set_transform(size * 0.5, side * PI * 0.25)
			draw_colored_polygon(PackedVector2Array([Vector2(-2, 3), Vector2(-2, -8), Vector2(0, -12), Vector2(2, -8), Vector2(2, 3)]), Color("#d8e6e9"))
			draw_line(Vector2(0, -9), Vector2(0, 2), Color("#78949d"), 1.0, true)
			draw_line(Vector2(-5, 4), Vector2(5, 4), Color("#f2c66a"), 2.5, true)
			draw_line(Vector2(0, 5), Vector2(0, 10), Color("#9f7750"), 3.0, true)
			draw_circle(Vector2(0, 11), 2, Color("#f2c66a"))
		draw_set_transform(Vector2.ZERO)

func _get_drag_data(_position: Vector2) -> Variant:
	if app == null or player_id.is_empty() or not get_meta("can_drag", true):
		return null
	pressed_on_card = false
	app.close_army_details()
	set_drag_preview(app.army_drag_preview(player_id))
	return {"tikmng_army": player_id}

func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or event.button_index != MOUSE_BUTTON_LEFT:
		return
	if event.pressed:
		pressed_on_card = true
	else:
		if pressed_on_card and Rect2(Vector2.ZERO, size).has_point(event.position):
			app.open_army_details(player_id)
		pressed_on_card = false
