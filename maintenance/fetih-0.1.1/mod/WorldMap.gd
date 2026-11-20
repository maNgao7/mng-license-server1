extends RefCounted

const ATLAS := "res://assets/maps/world.json"
const POINTS := preload("TurkiyeMap.gd")
const ISLAND_INK := Color("#cbb994")
const COAST_INK := Color("#7c8b80")
const ROUTE_INK := Color("#a5c1ad")

func build() -> Dictionary:
	var atlas: Variant = JSON.parse_string(FileAccess.get_file_as_string(ATLAS))
	if not atlas is Dictionary or atlas.get("schemaVersion") != 1 or not atlas.get("regions") is Array:
		push_error("Dünya atlası okunamadı.")
		return {}
	var map := Node2D.new()
	map.name = "WorldAtlas"
	map.set_meta("world_atlas", true)
	var territories: Array[Node] = []
	for region: Dictionary in atlas.regions:
		var area := Area2D.new()
		area.input_pickable = false
		area.set_meta("zone_name", region.name)
		area.set_meta("zone_center", POINTS.point(region.center))
		var neighbors: Array[int] = []
		for id: float in region.neighbors:
			neighbors.append(int(id))
		area.set_meta("zone_neighbors", neighbors)
		map.add_child(area)
		var collision := CollisionPolygon2D.new()
		collision.name = "CollisionPolygon2D"
		collision.disabled = true
		collision.polygon = POINTS.points(region.polygon)
		area.add_child(collision)
		var sprite := Sprite2D.new()
		sprite.name = "MainSprite"
		area.add_child(sprite)
		territories.append(area)

	var islands: Array[PackedVector2Array] = []
	for outline: Array in atlas.islands:
		islands.append(POINTS.points(outline))
	var routes: Array[PackedVector2Array] = []
	for endpoints: Array in atlas.seaRoutes:
		routes.append(POINTS.points(endpoints))
	map.draw.connect(func() -> void:
		for route: PackedVector2Array in routes:
			map.draw_dashed_line(route[0], route[1], ROUTE_INK, 1.65, 5.0, true, true)
		for ring: PackedVector2Array in islands:
			map.draw_colored_polygon(ring, ISLAND_INK)
			var outline := ring.duplicate()
			outline.append(outline[0])
			map.draw_polyline(outline, COAST_INK, 1.25, true)
	)
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Georgia", "Cambria", "Segoe UI"])
	for entry: Array in atlas.oceanLabels:
		var label := Label.new()
		label.text = entry[0]
		label.add_theme_font_override("font", font)
		label.add_theme_font_size_override("font_size", 21)
		label.add_theme_color_override("font_color", Color("#91b1ad"))
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.size.x = 280.0
		label.position = POINTS.point(entry[1]) - Vector2(140.0, 12.0)
		map.add_child(label)
	return {"map": map, "territories": territories}

static func add_ocean(stage: Node) -> void:
	var ocean := MeshInstance3D.new()
	ocean.name = "WorldOcean"
	var plane := PlaneMesh.new()
	plane.size = Vector2(320.0, 320.0)
	ocean.mesh = plane
	ocean.position.y = -0.045
	var material := ShaderMaterial.new()
	material.shader = preload("WorldSea.gdshader")
	ocean.material_override = material
	stage.add_child(ocean)
