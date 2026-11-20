extends Node3D

const MESH_BUILDER := preload("TurkiyeHarbor.gd").MeshBuilder
const ATLAS_POSITION := Vector2(952, 40)
const ISLAND_SCALE := 0.70
const REEF := Color("#4b9695")
const WET_SAND := Color("#b2b38b")
const SAND := Color("#f0d8a1")
const GRASS := Color("#6d9561")
const DARK_LEAF := Color("#315d48")
const LIGHT_LEAF := Color("#84a85f")
const FLOWERS := [Color("#f4d594"), Color("#ef8e85"), Color("#ffcd71"), Color("#f3dfcf")]
const SURFACE_Y := 0.022
const WET_SAND_Y := -0.032
const REEF_Y := -0.047

var coastline_letters := ""

func configure(canvas: Control) -> void:
	name = "TurkiyeBrandIsland"
	position = canvas.world_point(ATLAS_POSITION)
	scale = Vector3.ONE * ISLAND_SCALE
	var path: String = canvas.app.mod_root.path_join("../assets/maps/turkiye-brand-island.json").simplify_path()
	var artwork: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not artwork is Dictionary or not artwork.get("letters") is Array:
		push_error("TikMnG ada çizgileri yüklenemedi.")
		return
	var model := MESH_BUILDER.new()
	for glyph: Dictionary in artwork.letters:
		coastline_letters += str(glyph.letter)
		_make_shore(model, glyph.reef, WET_SAND_Y, REEF_Y, WET_SAND, REEF)
		_make_shore(model, glyph.sand, SURFACE_Y, WET_SAND_Y, SAND, WET_SAND)
		_make_surface(model, glyph.grass, SURFACE_Y, GRASS)
		for point: Array in glyph.palms:
			var variation := cos(float(point[0]) * 3.2)
			_make_palm(model, _vertex_at(point, 0, SURFACE_Y),
				0.52 + variation * 0.11, variation * 0.13, 2.1 + variation)
		for index in glyph.flowers.size():
			_make_flower(model, _vertex_at(glyph.flowers[index], 0, SURFACE_Y), index)
	var paint := StandardMaterial3D.new()
	paint.vertex_color_use_as_albedo = true
	paint.roughness = 0.96
	paint.cull_mode = BaseMaterial3D.CULL_DISABLED
	var island := MeshInstance3D.new()
	island.name = "LetterCoastline"
	island.mesh = model.surface.commit()
	island.material_override = paint
	island.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(island)

func _vertex_at(points: Array, index: int, height: float) -> Vector3:
	return Vector3(points[index], height, points[index + 1])

func _make_surface(model: MESH_BUILDER, triangles: Array, height: float, tint: Color) -> void:
	for triangle: Array in triangles:
		var a := _vertex_at(triangle, 0, height)
		var b := _vertex_at(triangle, 2, height)
		var c := _vertex_at(triangle, 4, height)
		var center := (a + b + c) / 3.0
		var brightness := 0.023 + sin(center.x * 2.7 + center.z * 1.3) * 0.019
		model.triangle(a, b, c, tint.lightened(brightness), Vector3.UP)

func _make_shore(model: MESH_BUILDER, triangles: Array, inner_height: float, outer_height: float,
		inner_color: Color, outer_color: Color) -> void:
	for triangle: Array in triangles:
		for index in [0, 3, 6]:
			var blend := float(triangle[index + 2])
			model.surface.set_color(inner_color.lerp(outer_color, blend))
			model.surface.set_normal(Vector3.UP)
			model.surface.add_vertex(_vertex_at(triangle, index, lerpf(inner_height, outer_height, blend)))

func _make_palm(model: MESH_BUILDER, base: Vector3, height: float, lean: float, phase: float) -> void:
	var tip := base + Vector3(lean, height, -0.12)
	var trunk := Color("#8c6650")
	var origin := base
	for i in 6:
		var t := (i + 1.0) / 6.0
		var next := base + Vector3(lean * t * t, height * t, -0.12 * t * t)
		var root_width := lerpf(0.038, 0.013, float(i) / 6.0)
		model.cylinder(origin, next, root_width, root_width * 0.93,
			trunk.lightened(0.07 * float(i % 2)), 7)
		origin = next
	for leaf in 8:
		var a := TAU * leaf / 8.0 + phase
		var direction := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-sin(a), 0, cos(a))
		var length := height * (0.47 + 0.054 * float(leaf % 3))
		var elbow := tip + direction * length * 0.40 + Vector3.UP * length * 0.23
		var midpoint := tip + direction * length * 0.73 + Vector3.UP * length * 0.16
		var end := tip + direction * length - Vector3.UP * length * 0.20
		var width := length * 0.21
		model.triangle(tip, elbow + side * width * 0.65, elbow, LIGHT_LEAF, Vector3.UP)
		model.triangle(tip, elbow, elbow - side * width * 0.65, DARK_LEAF, Vector3.UP)
		model.quad(elbow, elbow + side * width * 0.65, midpoint + side * width, midpoint, LIGHT_LEAF, Vector3.UP)
		model.quad(elbow - side * width * 0.65, elbow, midpoint, midpoint - side * width, DARK_LEAF, Vector3.UP)
		model.triangle(midpoint, midpoint + side * width, end, LIGHT_LEAF, Vector3.UP)
		model.triangle(midpoint - side * width, midpoint, end, DARK_LEAF, Vector3.UP)

func _make_flower(model: MESH_BUILDER, at: Vector3, index: int) -> void:
	var bloom := at + Vector3.UP * (0.047 + float(index % 3) * 0.012)
	model.cylinder(at, bloom, 0.008, 0.006, DARK_LEAF, 4)
	for petal in 5:
		var a := TAU * petal / 5.0
		var d := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-sin(a), 0, cos(a))
		model.quad(bloom, bloom + d * 0.034 + side * 0.017,
			bloom + d * 0.052 + Vector3.UP * 0.012, bloom + d * 0.034 - side * 0.017,
			FLOWERS[index % FLOWERS.size()], Vector3.UP)
	model.ball(bloom + Vector3.UP * 0.007, Vector3(0.016, 0.010, 0.016), Color("#efb657"), 5, 3)
