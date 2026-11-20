extends RefCounted

const ATLAS := "../assets/maps/turkiye.json"

func build() -> Dictionary:
	var path: String = get_script().resource_path.get_base_dir().path_join(ATLAS).simplify_path()
	var atlas: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not atlas is Dictionary or not atlas.has("regions"):
		push_error("Türkiye harita verisi okunamadı.")
		return {}
	var map := Node2D.new()
	map.name = "TurkiyeAtlas"
	map.set_meta("turkiye_atlas", atlas)
	var territories: Array[Node] = []
	var group := Node2D.new()
	map.add_child(group)
	for zone: Dictionary in atlas.regions:
		var area := Area2D.new()
		area.input_pickable = false
		area.set_meta("zone_name", zone.name)
		area.set_meta("zone_center", point(zone.center))
		var links: Array[int] = []
		for neighbor in zone.neighbors:
			links.append(int(neighbor))
		area.set_meta("zone_neighbors", links)
		group.add_child(area)
		var collision := CollisionPolygon2D.new()
		collision.name = "CollisionPolygon2D"
		collision.disabled = true
		collision.polygon = points(zone.polygon)
		area.add_child(collision)
		var sprite := Sprite2D.new()
		sprite.name = "MainSprite"
		area.add_child(sprite)
		territories.append(area)
	for island: Array in atlas.islands:
		var shore := Polygon2D.new()
		shore.polygon = points(island)
		shore.color = Color("#e5d6ac")
		map.add_child(shore)
	return {"map": map, "territories": territories}

static func point(coords: Array) -> Vector2:
	return Vector2(coords[0], coords[1])

static func points(coords: Array) -> PackedVector2Array:
	var polygon := PackedVector2Array()
	for coord: Array in coords:
		polygon.append(point(coord))
	return polygon
