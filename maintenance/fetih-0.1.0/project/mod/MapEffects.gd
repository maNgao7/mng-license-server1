extends Node2D

var map_canvas: Control

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if map_canvas != null:
		# The perspective stage owns crisp spatial borders and labels now.
		if map_canvas.get("territory_surface") == null:
			map_canvas.draw_overlay(self)
