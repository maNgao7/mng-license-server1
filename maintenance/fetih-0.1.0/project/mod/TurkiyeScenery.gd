extends Node3D

const MAP := preload("TurkiyeMap.gd")
const HARBOR := preload("TurkiyeHarbor.gd")
const WARSHIPS := preload("TurkiyeWarships.gd")
var canvas: Control
var zoom_detail := Node3D.new()
var harbor: Node3D

func configure(map_canvas: Control, atlas: Dictionary) -> void:
	canvas = map_canvas
	name = "TurkiyeScenery"
	var water := MeshInstance3D.new()
	water.name = "TurkiyeWater"
	var sea_mesh := PlaneMesh.new()
	sea_mesh.size = Vector2(320, 320)
	water.mesh = sea_mesh
	water.position.y = -0.045
	var sea := ShaderMaterial.new()
	sea.shader = preload("TurkiyeSea.gdshader")
	sea.set_shader_parameter("shoreline", preload("res://assets/maps/turkiye-shoreline.png"))
	sea.set_shader_parameter("has_shoreline", true)
	water.material_override = sea
	add_child(water)
	zoom_detail.name = "CityDetail"
	add_child(zoom_detail)
	zoom_detail.hide()
	_make_lakes(atlas.get("lakes", []))
	for bridge: Dictionary in atlas.bridges:
		_make_bridge(bridge)
	harbor = HARBOR.new()
	add_child(harbor)
	harbor.configure(canvas, atlas)
	var warships := WARSHIPS.new()
	add_child(warships)
	warships.configure(canvas, atlas)
	var brand_island := preload("TurkiyeBrandIsland.gd").new()
	add_child(brand_island)
	brand_island.configure(canvas)

func _surface(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.88
	return material

func _box(parent: Node3D, at: Vector3, dimensions: Vector3, material: Material) -> MeshInstance3D:
	var object := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = dimensions
	object.mesh = mesh
	object.material_override = material
	object.position = at
	object.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(object)
	return object

func _make_lakes(lakes: Array) -> void:
	var material := _surface(Color("#286779"))
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	for entry in lakes:
		var outline := MAP.points(entry)
		var indices := Geometry2D.triangulate_polygon(outline)
		if indices.is_empty():
			continue
		var vertices := PackedVector3Array()
		for point in outline:
			vertices.append(canvas.world_point(point) + Vector3(0, 0.021, 0))
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		arrays[Mesh.ARRAY_INDEX] = indices
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var lake := MeshInstance3D.new()
		lake.mesh = mesh
		lake.material_override = material
		lake.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(lake)

func _make_bridge(entry: Dictionary) -> void:
	var left: Vector3 = canvas.world_point(MAP.point(entry.start))
	var right: Vector3 = canvas.world_point(MAP.point(entry.end))
	var bridge := Node3D.new()
	bridge.set_meta("landmark_name", entry.name)
	bridge.position = (left + right) * 0.5 + Vector3(0, 0.037, 0)
	bridge.rotation.y = atan2(left.z - right.z, right.x - left.x)
	zoom_detail.add_child(bridge)
	var length := maxf(0.125, left.distance_to(right) * 1.32)
	var ivory := _surface(Color("#f0d9a1"))
	var deck := _surface(Color("#586469"))
	_box(bridge, Vector3.ZERO, Vector3(length, 0.009, 0.024), deck)
	for x in [-length * 0.32, length * 0.32]:
		_box(bridge, Vector3(x, 0.038, -0.012), Vector3(0.009, 0.080, 0.006), ivory)
		_box(bridge, Vector3(x, 0.038, 0.012), Vector3(0.009, 0.080, 0.006), ivory)
		_box(bridge, Vector3(x, 0.069, 0), Vector3(0.008, 0.006, 0.029), ivory)
	for side in [-0.012, 0.012]:
		for i in range(6):
			var x1 := lerpf(-length * 0.32, length * 0.32, float(i) / 6.0)
			var x2 := lerpf(-length * 0.32, length * 0.32, float(i + 1) / 6.0)
			var p1 := Vector3(x1, 0.029 + 0.043 * pow(absf(x1 / (length * 0.32)), 2.0), side)
			var p2 := Vector3(x2, 0.029 + 0.043 * pow(absf(x2 / (length * 0.32)), 2.0), side)
			var hanger := _box(bridge, (p1 + p2) * 0.5, Vector3(p1.distance_to(p2), 0.0028, 0.0028), ivory)
			hanger.rotation.z = atan2(p2.y - p1.y, p2.x - p1.x)

func _process(_delta: float) -> void:
	if is_instance_valid(canvas):
		zoom_detail.visible = float(canvas.zoom_factor) >= 1.95
