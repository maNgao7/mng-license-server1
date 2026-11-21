extends Node3D

const PROXIMITY := preload("JetAudio.gd")
const MISSILE_AUDIO := preload("MissileAudio.gd")

# Routes are expressed in the 1920 x 1080 atlas coordinates used by world_point().
# One opaque surface per vessel and a MultiMesh for wakes and for each bird silhouette.
const WATER_Y := -0.045
const MARITIME_BUS := &"TikMnG Maritime"
const FISHING := 0
const LAUNCH := 1
const FERRY := 2
const CARGO := 3
# Name, model, center, radii, length, speed, starting progress, hull paint, optional wake tail scale.
const TRAFFIC := [
	["MarmaraVapur", FERRY, Vector2(332, 338), Vector2(22, 9), 0.64, 0.23, 0.32, "#172e3f", 0.24],
	["BosphorusApproachVapur", FERRY, Vector2(470, 185), Vector2(60, 20), 0.91, 0.32, 0.28, "#21454e"],
	["AegeanFishingBoat", FISHING, Vector2(145, 700), Vector2(26, 42), 0.47, 0.26, 0.12, "#bd4635"],
	["AegeanLaunch", LAUNCH, Vector2(289, 836), Vector2(54, 13), 0.43, 0.31, 0.22, "#3bb29e"],
	["AntalyaLaunch", LAUNCH, Vector2(568, 885), Vector2(50, 18), 0.43, 0.28, 0.39, "#e6a746"],
	["BlackSeaContainerShip", CARGO, Vector2(1315, 156), Vector2(107, 21), 1.12, 0.23, 0.73, "#396a98"],
	["BlackSeaFishingBoat", FISHING, Vector2(1517, 213), Vector2(51, 15), 0.49, 0.26, 0.72, "#2096ae"],
	["MediterraneanContainerShip", CARGO, Vector2(889, 932), Vector2(81, 19), 1.08, 0.22, 0.59, "#274b54"],
]
const GULL_FLOCKS := [
	[Vector2(520, 178), Vector2(78, 26), 4],
	[Vector2(156, 721), Vector2(30, 62), 3],
	[Vector2(633, 925), Vector2(112, 24), 5],
	[Vector2(1440, 191), Vector2(104, 28), 4],
	[Vector2(1162, 907), Vector2(102, 31), 4],
]
# Count, starting progress and crosswind offset in world units for each passing group.
const MIGRATION_FLOCKS := [[7, 0.22, -0.65], [5, 0.34, 1.45], [6, 0.47, -1.35],
	[5, 0.61, 1.55], [7, 0.74, -0.55]]
const MIGRATION_START := Vector2(2280, -370)
const MIGRATION_FINISH := Vector2(-440, 1270)
const MIGRATION_TRAVERSE_SECONDS := 44.0
const MIGRATION_STAGGER := 0.76
const BIRD_PASS_SECONDS := 70.0
const BIRD_MIN_INTERVAL := 7.0 * 60.0
const BIRD_MAX_INTERVAL := 10.0 * 60.0
const BIRD_CALL_SECONDS := 14.0
const BIRD_BUS := &"TikMnG Birds"
const PresentationAudio := preload("WarNotice.gd")
const BIRD_BOUNDS := AABB(Vector3(-21, 0, -14), Vector3(42, 3.2, 27))

const IVORY := Color("#f3ecd7")
const WHITE_PAINT := Color("#e4e9e5")
const GLASS := Color("#263e4b")
const GLINT := Color("#69939c")
const TEAK := Color("#ab7850")
const STEEL := Color("#435659")
const RUBBER := Color("#273238")
const KEEL := Color("#a64839")
const RESCUE := Color("#e58638")

const FOAM_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;
varying vec2 wake_point;
varying vec3 wake_style;

void vertex() {
	wake_point = VERTEX.xz;
	wake_style = INSTANCE_CUSTOM.rgb;
	float age = max(0.0, -VERTEX.z - 0.42);
	VERTEX.x *= mix(1.0, max(0.52, wake_style.z), smoothstep(0.0, 0.67, age));
	VERTEX.x += (wake_style.x - 0.5) * 1.8 * age * age * wake_style.z;
	VERTEX.z += age * (1.0 - wake_style.z);
}

void fragment() {
	float z = wake_point.y;
	float x = wake_point.x;
	float distance_back = 0.47 - z;
	float age = max(0.0, -z - 0.42);
	float clock = TIME * 3.9 + wake_style.y * 31.0;
	float eddies = sin(x * 47.0 + z * 32.0 + clock) * sin(x * 91.0 - z * 61.0 - clock * 0.46);
	float side = abs(x + sin(z * 18.0 + clock * 0.65) * 0.009);
	float spread = 0.040 + age * 0.124;
	float wash = 1.0 - smoothstep(spread * 0.15, spread, side);
	wash *= smoothstep(0.42, 0.55, -z) * (1.0 - smoothstep(0.33, 1.04, age));
	float train = sin(distance_back * 76.0 - clock + eddies * 1.2);
	float ridge = 0.031 + distance_back * 0.205 + eddies * 0.008;
	float arm = 1.0 - smoothstep(0.007, 0.023 + age * 0.005, abs(side - ridge));
	arm *= smoothstep(-0.025, 0.20, distance_back) * (1.0 - smoothstep(0.56, 1.05, distance_back));
	float aft_ridge = 0.12 + age * 0.235 + eddies * 0.011;
	float aft = 1.0 - smoothstep(0.005, 0.025, abs(side - aft_ridge));
	aft *= smoothstep(0.0, 0.19, age) * (1.0 - smoothstep(0.45, 1.07, age));
	float foam = arm * (0.24 + 0.20 * smoothstep(-0.1, 0.85, train))
		+ wash * (0.29 + 0.28 * smoothstep(-0.35, 0.95, eddies))
		+ aft * (0.05 + 0.22 * smoothstep(-0.6, 0.93, train));
	ALBEDO = mix(vec3(0.34, 0.63, 0.68), vec3(0.87, 0.96, 0.94), clamp(foam * 2.1, 0.0, 1.0));
	ALPHA = min(0.78, foam);
}
"""

const BIRD_SHADER := """
shader_type spatial;
render_mode cull_disabled, shadows_disabled;
uniform float elapsed;
uniform bool migratory;
varying vec3 resting_vertex;
varying float plumage;

void vertex() {
	resting_vertex = VERTEX;
	plumage = INSTANCE_CUSTOM.a;
	float rate = mix(10.6, 16.2, INSTANCE_CUSTOM.b) * (migratory ? 0.66 : 1.0);
	float rhythm = elapsed * rate + INSTANCE_CUSTOM.r * 6.283;
	float glide_cycle = sin(elapsed * mix(0.73, 1.36, INSTANCE_CUSTOM.b) + INSTANCE_CUSTOM.g * 6.283);
	float stroke = smoothstep(migratory ? 0.04 : -0.38, 0.72, glide_cycle);
	float wing = abs(VERTEX.x);
	float root = migratory ? 0.115 : 0.079;
	float shoulder = max(0.0, wing - root);
	float angle = (0.065 + (sin(rhythm) * 0.50 + sin(rhythm * 2.0) * 0.09) * stroke)
		* smoothstep(root, root + 0.12, wing);
	angle += smoothstep(0.44, 1.06, wing) * sin(rhythm - 0.72) * stroke * 0.23;
	float side = sign(VERTEX.x);
	float s = sin(angle) * side;
	float c = cos(angle);
	mat2 hinge = mat2(vec2(c, s), vec2(-s, c));
	VERTEX.xy = hinge * vec2(shoulder * side, VERTEX.y) + vec2(min(wing, root) * side, 0.0);
	NORMAL.xy = hinge * NORMAL.xy;
}

void fragment() {
	float wing = abs(resting_vertex.x);
	float aft = resting_vertex.z;
	vec3 white = vec3(0.93, 0.89, 0.80);
	vec3 dark = vec3(0.105, 0.123, 0.142);
	vec3 feather;
	if (migratory) {
		float edge = -0.16 + wing * 0.15;
		float rear = (1.0 - smoothstep(edge - 0.025, edge + 0.025, aft)) * smoothstep(0.10, 0.16, wing);
		feather = mix(white, dark, max(rear, smoothstep(0.68, 0.86, wing)));
		if (wing < 0.125 && (aft > 0.615 || (aft < -0.26 && resting_vertex.y < -0.050))) {
			feather = vec3(0.56, 0.19, 0.10);
		}
	} else {
		feather = mix(white, vec3(0.54, 0.63, 0.69), smoothstep(0.13, 0.58, wing));
		feather = mix(feather, dark, smoothstep(0.71, 0.90, wing));
		if (wing < 0.034 && aft > 0.248 && resting_vertex.y < 0.042) {
			feather = vec3(0.74, 0.43, 0.12);
		}
	}
	feather *= mix(0.86, 1.0, plumage);
	ALBEDO = feather;
	EMISSION = feather * 0.16;
	ROUGHNESS = 0.9;
}
"""


class MeshBuilder:
	var surface := SurfaceTool.new()

	func _init() -> void:
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	func triangle(a: Vector3, b: Vector3, c: Vector3, color: Color, outside: Vector3) -> void:
		var normal := (c - a).cross(b - a).normalized()
		if normal.dot(outside) < 0.0:
			var swap := b
			b = c
			c = swap
			normal = -normal
		for point in [a, b, c]:
			surface.set_normal(normal)
			surface.set_color(color)
			surface.add_vertex(point)

	func quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color, outside: Vector3) -> void:
		triangle(a, b, c, color, outside)
		triangle(a, c, d, color, outside)

	func box(at: Vector3, size: Vector3, color: Color) -> void:
		var half := size * 0.5
		var base := PackedVector3Array([
			at + Vector3(-half.x, -half.y, -half.z), at + Vector3(half.x, -half.y, -half.z),
			at + Vector3(half.x, -half.y, half.z), at + Vector3(-half.x, -half.y, half.z),
		])
		var up := Vector3.UP * size.y
		belt(base, _translated(base, up), color, at)
		quad(base[0], base[1], base[2], base[3], color, Vector3.DOWN)
		quad(base[0] + up, base[1] + up, base[2] + up, base[3] + up, color, Vector3.UP)

	func belt(low: PackedVector3Array, high: PackedVector3Array, color: Color, center := Vector3.ZERO) -> void:
		for i in low.size():
			var j := (i + 1) % low.size()
			var outward := (low[i] + low[j]) * 0.5 - center
			outward.y = 0.0
			quad(low[i], low[j], high[j], high[i], color, outward)

	func cap(ring: PackedVector3Array, center: Vector3, color: Color, outside := Vector3.UP) -> void:
		for i in ring.size():
			triangle(center, ring[i], ring[(i + 1) % ring.size()], color, outside)

	func cylinder(start: Vector3, finish: Vector3, base_radius: float, tip_radius: float, color: Color, sides := 8) -> void:
		var axis := (finish - start).normalized()
		var u := axis.cross(Vector3.FORWARD if absf(axis.z) < 0.9 else Vector3.UP).normalized()
		var v := axis.cross(u)
		for i in sides:
			var a := u * cos(TAU * i / sides) + v * sin(TAU * i / sides)
			var b := u * cos(TAU * (i + 1) / sides) + v * sin(TAU * (i + 1) / sides)
			var p := start + a * base_radius
			var q := start + b * base_radius
			var r := finish + b * tip_radius
			var s := finish + a * tip_radius
			quad(p, q, r, s, color, a + b)
			triangle(start, p, q, color, -axis)
			triangle(finish, s, r, color, axis)

	func ball(at: Vector3, radii: Vector3, color: Color, around := 10, bands := 5) -> void:
		var last := PackedVector3Array()
		for row in bands + 1:
			var pitch := -PI * 0.5 + PI * float(row) / bands
			var ring := PackedVector3Array()
			for i in around:
				var yaw := TAU * i / around
				ring.append(at + radii * Vector3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch)))
			for i in last.size():
				var j := (i + 1) % around
				var outward := (last[i] + last[j] + ring[i] + ring[j]) * 0.25 - at
				if row > 1:
					triangle(last[i], last[j], ring[j], color, outward)
				if row < bands:
					triangle(last[i], ring[j], ring[i], color, outward)
			last = ring

	func _translated(ring: PackedVector3Array, offset: Vector3) -> PackedVector3Array:
		var moved := PackedVector3Array()
		for point in ring:
			moved.append(point + offset)
		return moved

	func build(material: Material) -> ArrayMesh:
		surface.set_material(material)
		surface.index()
		return surface.commit()


class Vessel:
	var mesh: MeshInstance3D
	var route: Curve3D
	var kind: int
	var length: float
	var distance: float
	var speed: float
	var phase: float
	var wake_tail: float
	var next_horn: float
	var horn_pitch: float


class Bird:
	var route: Curve3D
	var distance: float
	var speed: float
	var phase: float
	var size: float
	var height: float
	var crosswind: float


var _fleet: Array[Vessel] = []
var _gulls: Array[Bird] = []
var _storks: Array[Bird] = []
var _wake_batch: MultiMesh
var _gull_batch: MultiMesh
var _stork_batch: MultiMesh
var _migration_start: Vector3
var _migration_finish: Vector3
var _bird_schedule_rng := RandomNumberGenerator.new()
var _bird_wait_left := 0.0
var _bird_pass_age := -1.0
var _bird_call_played := false
var _bird_audio: AudioStreamPlayer
var _paint: StandardMaterial3D
var _elapsed := 0.0
var _canvas: Control
var _horn: AudioStreamPlayer
var _horn_source: Node3D
var _engines: Array[AudioStreamPlayer] = []
var _engine_levels := Vector2.ZERO
var _horn_cooldown := 0.0


func configure(canvas: Control, atlas: Dictionary) -> void:
	name = "TurkiyeHarbor"
	for child in get_children():
		remove_child(child)
		child.queue_free()
	_fleet.clear()
	_gulls.clear()
	_storks.clear()
	_engines.clear()
	_engine_levels = Vector2.ZERO
	_wake_batch = null
	_gull_batch = null
	_stork_batch = null
	_horn = null
	_bird_audio = null
	_elapsed = 0.0
	_horn_cooldown = 0.0
	_canvas = canvas
	set_process(false)
	if canvas == null or atlas.get("regions", []).is_empty():
		return

	_paint = StandardMaterial3D.new()
	_paint.vertex_color_use_as_albedo = true
	_paint.roughness = 0.86
	for entry: Array in TRAFFIC:
		var ship := Vessel.new()
		ship.route = _route(canvas, entry[2], entry[3])
		ship.kind = entry[1]
		ship.length = entry[4]
		ship.speed = entry[5]
		ship.wake_tail = float(entry[8]) if entry.size() > 8 else 1.0
		ship.phase = TAU * float(entry[6])
		ship.next_horn = 3.5 + float(_fleet.size() % 4) * 2.1
		ship.horn_pitch = lerpf(1.02, 0.89, inverse_lerp(0.62, 1.12, ship.length))
		ship.distance = ship.route.get_baked_length() * float(entry[6])
		ship.mesh = MeshInstance3D.new()
		ship.mesh.name = entry[0]
		ship.mesh.mesh = _ship_mesh(entry[1], Color(entry[7]))
		ship.mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(ship.mesh)
		_fleet.append(ship)

	_make_wakes()
	_make_birds(canvas)
	_make_bird_audio()
	_bird_schedule_rng.randomize()
	_schedule_birds()
	_horn = _audio_player(&"BoatHorn", "ferry-horn.ogg")
	_engines.append(_audio_player(&"BoatWash", "boat-wash.ogg", true))
	_engines.append(_audio_player(&"ShipDiesel", "ship-diesel.ogg", true))
	_process(0.0)
	set_process(true)


func _route(canvas: Control, center: Vector2, radius: Vector2) -> Curve3D:
	# Cubic arcs provide continuous turning and baked distance gives a steady speed.
	var route := Curve3D.new()
	route.bake_interval = 0.025
	for i in 5:
		var angle := (i % 4) * PI * 0.5
		var point := center + Vector2(cos(angle), sin(angle)) * radius
		var handle := Vector2(-sin(angle), cos(angle)) * radius * 0.55228475
		var at: Vector3 = canvas.world_point(point)
		var ahead: Vector3 = canvas.world_point(point + handle)
		route.add_point(at, at - ahead, ahead - at)
	return route


func _route_at(route: Curve3D, distance: float) -> Vector3:
	return route.sample_baked(fposmod(distance, route.get_baked_length()), true)


func _heading(route: Curve3D, distance: float) -> Vector3:
	return (_route_at(route, distance + 0.045) - _route_at(route, distance - 0.045)).normalized()


func _process(delta: float) -> void:
	if not is_instance_valid(_canvas) or not is_instance_valid(_canvas.app):
		return
	var paused: bool = _canvas.app.is_paused() or get_tree().paused
	var camera := PROXIMITY.audible_camera(_canvas)
	if camera == null:
		_horn.stop()
		if _bird_audio != null:
			_bird_audio.stop()
		for engine in _engines:
			engine.stop()
		_engine_levels = Vector2.ZERO
	elif _horn.playing and is_instance_valid(_horn_source):
		var screen := camera.get_viewport().get_visible_rect()
		PROXIMITY.update_voice(_horn, PROXIMITY.position_gain(camera, screen, _horn_source.global_position) * 0.40, paused, delta)
	_horn.stream_paused = paused
	if _bird_audio != null:
		_bird_audio.stream_paused = paused
	for engine in _engines:
		engine.stream_paused = paused
	if paused:
		return
	_elapsed += delta
	var zoom := float(_canvas.zoom_factor)
	var can_honk := _horn.stream != null and _elapsed >= _horn_cooldown and not _horn.playing and zoom >= 1.65
	var loudest := 0.0
	var engine_gains := Vector2.ZERO
	var selected: Vessel
	for i in _fleet.size():
		var ship := _fleet[i]
		ship.distance = fposmod(ship.distance + delta * ship.speed, ship.route.get_baked_length())
		var at := _route_at(ship.route, ship.distance)
		var course := _heading(ship.route, ship.distance)
		var yaw := atan2(course.x, course.z)
		var swell := _elapsed * 1.6 + ship.phase
		var motion := 1.0 if ship.length < 0.55 else 0.58
		ship.mesh.position = at + Vector3.UP * (WATER_Y + sin(swell) * 0.010 * motion)
		ship.mesh.rotation = Vector3(cos(swell * 0.73) * 0.027 * motion, yaw, sin(swell * 1.13) * 0.065 * motion)
		ship.mesh.scale = Vector3.ONE * ship.length
		var wake_basis := Basis(Vector3.UP, yaw)
		_wake_batch.set_instance_transform(i, Transform3D(
			wake_basis.scaled(Vector3.ONE * ship.length), at + Vector3.UP * (WATER_Y + 0.004)))
		var astern := _route_at(ship.route, ship.distance - ship.length * (0.43 + 0.50 * ship.wake_tail))
		var bend := clampf((astern - at).dot(wake_basis.x) / ship.length, -0.26, 0.26)
		_wake_batch.set_instance_custom_data(i, Color(0.5 + bend, ship.phase / TAU, ship.wake_tail, 1.0))
		if zoom >= 1.18:
			var gain := maritime_gain(camera, ship.mesh.global_position)
			var engine_kind := int(ship.kind == FERRY or ship.kind == CARGO)
			engine_gains[engine_kind] = maxf(engine_gains[engine_kind], gain)
			if can_honk and engine_kind == 1 and _elapsed >= ship.next_horn and gain > maxf(loudest, 0.60):
				loudest = gain
				selected = ship

	if selected != null:
		_horn_source = selected.mesh
		_horn.volume_db = linear_to_db(loudest * 0.40)
		_horn.pitch_scale = selected.horn_pitch
		_horn.play()
		selected.next_horn = _elapsed + 27.0 + selected.phase * 1.8
		_horn_cooldown = _elapsed + 12.0

	_mix_engines(engine_gains * smoothstep(1.18, 3.0, zoom), delta)
	_advance_birds(delta, camera != null)


static func maritime_bus() -> StringName:
	return MISSILE_AUDIO.connect_game_fx_bus(MARITIME_BUS)


static func maritime_gain(camera: Camera3D, position: Vector3) -> float:
	if not is_instance_valid(camera) or camera.is_position_behind(position):
		return 0.0
	var screen := camera.get_viewport().get_visible_rect()
	var pixel := camera.unproject_position(position)
	if not screen.has_area() or not screen.has_point(pixel):
		return 0.0
	var offset := (pixel - screen.get_center()) / (screen.size * 0.5)
	return (1.0 - smoothstep(0.20, 1.16, offset.length())) * PROXIMITY.position_gain(camera, screen, position)


static func load_maritime_audio(_mod_root: String, file: String) -> AudioStreamOggVorbis:
	return load("res://assets/audio/maritime/" + file) as AudioStreamOggVorbis


func _audio_player(node_name: StringName, file: String, looping := false) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.name = node_name
	player.bus = maritime_bus()
	var sound := load_maritime_audio(_canvas.app.mod_root, file)
	if sound != null:
		sound.loop = looping
		player.stream = sound
	add_child(player)
	return player


func _mix_engines(gains: Vector2, delta: float) -> void:
	_engine_levels = _engine_levels.lerp(gains, 1.0 - exp(-delta * 4.0))
	for i in _engines.size():
		var engine := _engines[i]
		var level := _engine_levels[i]
		if level < 0.014 or engine.stream == null:
			if engine.playing:
				engine.stop()
			continue
		engine.volume_db = linear_to_db(level * (0.24 if i == 0 else 0.28))
		if not engine.playing:
			engine.play()


func _batch(mesh: Mesh, count: int, node_name: String) -> MultiMeshInstance3D:
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.use_custom_data = true
	batch.mesh = mesh
	batch.instance_count = count
	var node := MultiMeshInstance3D.new()
	node.name = node_name
	node.multimesh = batch
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(node)
	return node


func _make_wakes() -> void:
	var foam := Shader.new()
	foam.code = FOAM_SHADER
	var material := ShaderMaterial.new()
	material.shader = foam
	var plane := PlaneMesh.new()
	plane.size = Vector2(1.56, 2.04)
	plane.center_offset = Vector3(0, 0, -0.54)
	plane.subdivide_depth = 8
	plane.material = material
	var wake_node := _batch(plane, _fleet.size(), "Wakes")
	wake_node.custom_aabb = AABB(Vector3(-16, -0.08, -11), Vector3(32, 0.20, 22))
	_wake_batch = wake_node.multimesh


func _make_birds(canvas: Control) -> void:
	var variation := RandomNumberGenerator.new()
	variation.seed = 61118
	for entry: Array in GULL_FLOCKS:
		for i in int(entry[2]):
			var gull := Bird.new()
			var center: Vector2 = entry[0] + Vector2(variation.randf_range(-24, 24), variation.randf_range(-12, 12))
			var radius: Vector2 = entry[1] * variation.randf_range(0.68, 1.12)
			gull.route = _route(canvas, center, radius)
			gull.distance = gull.route.get_baked_length() * variation.randf()
			gull.phase = variation.randf() * TAU
			gull.speed = variation.randf_range(0.34, 0.69)
			gull.size = variation.randf_range(0.119, 0.155)
			gull.height = variation.randf_range(0.23, 0.49)
			_gulls.append(gull)

	_migration_start = canvas.world_point(MIGRATION_START)
	_migration_finish = canvas.world_point(MIGRATION_FINISH)
	for entry: Array in MIGRATION_FLOCKS:
		for i in int(entry[0]):
			var stork := Bird.new()
			stork.distance = float(entry[1]) + (i - (int(entry[0]) - 1) * 0.5) * 0.011
			stork.distance += variation.randf_range(-0.012, 0.012)
			stork.crosswind = float(entry[2]) + variation.randf_range(-0.70, 0.70)
			stork.phase = variation.randf() * TAU
			stork.speed = variation.randf_range(0.38, 0.66)
			stork.size = variation.randf_range(0.177, 0.229)
			stork.height = variation.randf_range(0.72, 1.23)
			_storks.append(stork)

	var shader := Shader.new()
	shader.code = BIRD_SHADER
	_gull_batch = _bird_batch(shader, _gulls, false, variation)
	_stork_batch = _bird_batch(shader, _storks, true, variation)


func _bird_batch(shader: Shader, birds: Array[Bird], migratory: bool, variation: RandomNumberGenerator) -> MultiMesh:
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("migratory", migratory)
	var mesh: ArrayMesh = _stork_mesh(material) if migratory else _gull_mesh(material)
	var batch := _batch(mesh, birds.size(), "MigratingStorks" if migratory else "Gulls")
	batch.custom_aabb = BIRD_BOUNDS
	for i in birds.size():
		batch.multimesh.set_instance_custom_data(i, Color(birds[i].phase / TAU,
			variation.randf(), variation.randf(), variation.randf()))
	return batch.multimesh


func _schedule_birds() -> void:
	_bird_wait_left = _bird_schedule_rng.randf_range(BIRD_MIN_INTERVAL, BIRD_MAX_INTERVAL)
	_bird_pass_age = -1.0
	_bird_call_played = false
	if _bird_audio != null:
		_bird_audio.stop()
	_gull_batch.visible_instance_count = 0
	_stork_batch.visible_instance_count = 0


func _advance_birds(delta: float, audible := true) -> void:
	if _bird_pass_age < 0.0:
		_bird_wait_left -= delta
		if _bird_wait_left > 0.0:
			return
		_bird_pass_age = 0.0
		_gull_batch.visible_instance_count = _gulls.size()
		_stork_batch.visible_instance_count = _storks.size()
		_move_birds(0.0)
		return
	_bird_pass_age += delta
	if _bird_pass_age >= BIRD_PASS_SECONDS:
		_schedule_birds()
		return
	# One quiet, short call after the migrating flock enters the map. No ambient
	# loop, repeated calls, or audio at all during the randomized waiting period.
	if not _bird_call_played and _bird_pass_age >= BIRD_CALL_SECONDS:
		_bird_call_played = true
		if audible and _bird_audio != null and _bird_audio.stream != null:
			_bird_audio.play()
	_move_birds(delta)


func _make_bird_audio() -> void:
	_bird_audio = AudioStreamPlayer.new()
	_bird_audio.name = "MigrationCall"
	_bird_audio.bus = MISSILE_AUDIO.connect_game_fx_bus(BIRD_BUS)
	_bird_audio.volume_db = -12.0
	_bird_audio.stream = PresentationAudio.load_presentation_audio(_canvas.app.mod_root, "migration-call.ogg")
	add_child(_bird_audio)


func _move_birds(delta: float) -> void:
	var gull_material: ShaderMaterial = _gull_batch.mesh.surface_get_material(0)
	var stork_material: ShaderMaterial = _stork_batch.mesh.surface_get_material(0)
	gull_material.set_shader_parameter("elapsed", _bird_pass_age)
	stork_material.set_shader_parameter("elapsed", _bird_pass_age)
	var gull_reveal := 0.01 + 0.99 * minf(smoothstep(0.0, 1.8, _bird_pass_age),
		1.0 - smoothstep(BIRD_PASS_SECONDS - 4.0, BIRD_PASS_SECONDS, _bird_pass_age))
	for i in _gulls.size():
		var gull := _gulls[i]
		var flight := gull.phase + _bird_pass_age * 1.12
		gull.distance = fposmod(gull.distance + delta * gull.speed, gull.route.get_baked_length())
		var at := _route_at(gull.route, gull.distance)
		var course := _heading(gull.route, gull.distance)
		at += Vector3.UP.cross(course) * sin(flight) * 0.055
		at.y = gull.height + sin(flight * 0.72) * 0.10
		_place_bird(_gull_batch, i, gull.size * gull_reveal, at, course,
			sin(flight * 0.72) * 0.09, -0.12 + sin(flight) * 0.19)

	var crossing := _migration_finish - _migration_start
	var crosswind := Vector3.UP.cross(crossing.normalized())
	for i in _storks.size():
		var stork := _storks[i]
		var flight := stork.phase + _bird_pass_age * stork.speed
		var progress := stork.distance - MIGRATION_STAGGER + _bird_pass_age / MIGRATION_TRAVERSE_SECONDS
		progress += sin(flight) * 0.006
		if progress < 0.0 or progress > 1.0:
			var outside := _migration_start if progress < 0.0 else _migration_finish
			_stork_batch.set_instance_transform(i, Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * 0.001), outside))
			continue
		var bend := sin(progress * TAU - 0.7)
		var at := _migration_start.lerp(_migration_finish, progress)
		at += crosswind * (stork.crosswind + bend * 1.34 + sin(flight * 0.76) * 0.20)
		at.y = stork.height + sin(flight * 0.80) * 0.16 + bend * 0.24
		var course := crossing + crosswind * (cos(progress * TAU - 0.7) * 1.34 * TAU + cos(flight * 0.76) * 2.8)
		_place_bird(_stork_batch, i, stork.size, at, course, cos(flight * 0.8) * 0.055, sin(flight) * 0.22)


func _place_bird(batch: MultiMesh, index: int, size: float, at: Vector3, course: Vector3, pitch: float, bank: float) -> void:
	var pose := Basis.from_euler(Vector3(pitch, atan2(course.x, course.z), bank))
	batch.set_instance_transform(index, Transform3D(pose.scaled(Vector3.ONE * size), at))

# Hull stations store (fore/aft position, half beam, sheer). The bow is +Z.
func _hull_ring(stations: Array[Vector3], y: float, beam: float, length: float, sheer: float) -> PackedVector3Array:
	var ring := PackedVector3Array()
	for side in [1.0, -1.0]:
		for i in stations.size():
			var station := stations[i if side > 0.0 else stations.size() - 1 - i]
			ring.append(Vector3(station.y * beam * side, y + station.z * sheer, station.x * length))
	return ring


func _hull(b: MeshBuilder, kind: int, paint: Color, deck_color: Color) -> PackedVector3Array:
	var sections: Array[Vector3] = [
		Vector3(-0.50, 0.042, 0.018), Vector3(-0.47, 0.095, 0.012),
		Vector3(-0.39, 0.130, 0.003), Vector3(-0.24, 0.142, 0.0),
		Vector3(0.03, 0.142, 0.0), Vector3(0.23, 0.117, 0.002),
		Vector3(0.36, 0.081, 0.013), Vector3(0.45, 0.040, 0.025),
		Vector3(0.50, 0.006, 0.038),
	]
	if kind == CARGO:
		sections[0] = Vector3(-0.50, 0.071, 0.008)
		sections[1] = Vector3(-0.46, 0.109, 0.004)
		sections[5] = Vector3(0.26, 0.129, 0.003)
	elif kind == FISHING or kind == LAUNCH:
		sections[0] = Vector3(-0.50, 0.087, 0.003)
		sections[1] = Vector3(-0.46, 0.127, 0.0)
		sections[2] = Vector3(-0.37, 0.144, 0.0)
	var keel := _hull_ring(sections, -0.084, 0.54, 0.84, 0.12)
	var waterline := _hull_ring(sections, 0.014, 0.88, 0.96, 0.25)
	var topsides := _hull_ring(sections, 0.097, 0.98, 0.99, 0.92)
	var gunwale := _hull_ring(sections, 0.113, 1.0, 1.0, 1.0)
	var inner := _hull_ring(sections, 0.113, 0.92, 0.98, 1.0)
	var deck := _hull_ring(sections, 0.105, 0.92, 0.98, 1.0)
	b.cap(keel, Vector3(0, -0.084, 0), KEEL.darkened(0.37), Vector3.DOWN)
	b.belt(keel, waterline, KEEL)
	b.belt(waterline, topsides, paint)
	var trim := Color("#d4b985") if kind == CARGO else IVORY
	b.belt(topsides, gunwale, trim)
	for i in gunwale.size():
		var j := (i + 1) % gunwale.size()
		b.quad(gunwale[i], gunwale[j], inner[j], inner[i], trim, Vector3.UP)
		b.quad(deck[i], deck[j], inner[j], inner[i], paint.darkened(0.13), -(inner[i] + inner[j]))
	b.cap(deck, Vector3(0, 0.105, 0), deck_color)
	return gunwale


func _chamfer_ring(at: Vector3, width: float, length: float, cut: float) -> PackedVector3Array:
	var x := width * 0.5
	var z := length * 0.5
	var outline := PackedVector2Array([
		Vector2(x, z - cut), Vector2(x - cut, z), Vector2(-x + cut, z), Vector2(-x, z - cut),
		Vector2(-x, -z + cut), Vector2(-x + cut, -z), Vector2(x - cut, -z), Vector2(x, -z + cut),
	])
	var ring := PackedVector3Array()
	for point in outline:
		ring.append(at + Vector3(point.x, 0, point.y))
	return ring


func _deckhouse(b: MeshBuilder, at: Vector3, size: Vector3, color: Color, roof: Color, brim := 0.012) -> void:
	var cut := minf(size.x, size.z) * 0.13
	var top := at + Vector3.UP * size.y
	var base := _chamfer_ring(at, size.x, size.z, cut)
	var eaves := _chamfer_ring(top, size.x, size.z, cut)
	var rim := _chamfer_ring(top, size.x + brim, size.z + brim, cut)
	var crown := _chamfer_ring(top + Vector3.UP * 0.016, size.x + brim * 0.5, size.z + brim * 0.5, cut)
	b.belt(base, eaves, color, at)
	b.belt(rim, crown, roof.darkened(0.13), top)
	b.cap(crown, top + Vector3.UP * 0.019, roof)


func _windows(b: MeshBuilder, at: Vector3, width: float, length: float, count: int, height: float) -> void:
	var side_run := length * 0.84
	var pane := side_run / count
	for side in [-1.0, 1.0]:
		for i in count:
			var ink := GLASS.lerp(GLINT, 0.14 + 0.17 * float(i % 3))
			var side_at := Vector3(at.x + side * width * 0.505, at.y, at.z + (i + 0.5) * pane - side_run * 0.5)
			b.box(side_at, Vector3(0.004, height, pane * 0.78), ink)
			b.box(side_at + Vector3(side * 0.001, height * 0.32, 0), Vector3(0.004, height * 0.14, pane * 0.77), GLINT)
		for i in 3:
			var front_at := Vector3(at.x + (i - 1) * width * 0.227, at.y, at.z + side * length * 0.503)
			b.box(front_at, Vector3(width * 0.188, height, 0.004), GLASS.lerp(GLINT, 0.25))
			b.box(front_at + Vector3(0, height * 0.32, side * 0.001), Vector3(width * 0.188, height * 0.14, 0.004), GLINT)


func _rails(b: MeshBuilder, line: PackedVector3Array, height: float, color: Color) -> void:
	for i in line.size():
		var point := line[i]
		var up := Vector3.UP * height
		b.cylinder(point, point + up, 0.0033, 0.0033, color, 5)
		if i > 0:
			b.cylinder(line[i - 1] + up, point + up, 0.0035, 0.0035, color, 5)


func _mast(b: MeshBuilder, base: Vector3, height: float, color: Color) -> void:
	var tip := base + Vector3(0, height, -height * 0.11)
	b.cylinder(base, tip, 0.0080, 0.0033, color, 8)
	var yard := base.lerp(tip, 0.72)
	b.cylinder(yard - Vector3(0.045, 0, 0), yard + Vector3(0.045, 0, 0), 0.0028, 0.0028, color, 5)
	b.ball(tip, Vector3.ONE * 0.006, IVORY, 6, 3)


func _bollards(b: MeshBuilder, y: float, z: float, width: float) -> void:
	for side in [-1.0, 1.0]:
		var mount := Vector3(width * side, y, z)
		b.cylinder(mount, mount + Vector3.UP * 0.017, 0.008, 0.006, RUBBER, 6)
		b.cylinder(mount + Vector3.UP * 0.017, mount + Vector3.UP * 0.021, 0.008, 0.008, STEEL, 6)


func _lifebuoy(b: MeshBuilder, at: Vector3, radius: float, upright: bool) -> void:
	for i in 12:
		var a := float(i) * TAU / 12.0
		var c := float(i + 1) * TAU / 12.0
		var from := at + Vector3(0, sin(a), cos(a)) * radius if upright else at + Vector3(sin(a), 0, cos(a)) * radius
		var to := at + Vector3(0, sin(c), cos(c)) * radius if upright else at + Vector3(sin(c), 0, cos(c)) * radius
		b.cylinder(from, to, radius * 0.23, radius * 0.23, IVORY if i % 3 == 0 else RESCUE, 5)


func _ship_mesh(kind: int, paint: Color) -> ArrayMesh:
	var b := MeshBuilder.new()
	var deck_color := Color("#537a68") if kind == CARGO else TEAK
	var rim := _hull(b, kind, paint, deck_color)
	match kind:
		FERRY:
			_ferry(b, rim)
		CARGO:
			_cargo_ship(b, paint)
		FISHING:
			_fishing_boat(b, paint)
		LAUNCH:
			_open_launch(b, paint)
	_bollards(b, 0.125, 0.344, 0.039)
	_bollards(b, 0.118, -0.436, 0.064)
	return b.build(_paint)


func _ferry(b: MeshBuilder, rim: PackedVector3Array) -> void:
	_deckhouse(b, Vector3(0, 0.111, -0.083), Vector3(0.208, 0.105, 0.603), IVORY, TEAK, 0.030)
	_windows(b, Vector3(0, 0.173, -0.083), 0.208, 0.603, 9, 0.055)
	_deckhouse(b, Vector3(0, 0.230, -0.071), Vector3(0.168, 0.077, 0.478), IVORY, IVORY, 0.028)
	_windows(b, Vector3(0, 0.275, -0.071), 0.168, 0.478, 8, 0.044)
	_deckhouse(b, Vector3(0, 0.311, 0.119), Vector3(0.155, 0.047, 0.150), IVORY, Color("#d4ded6"))
	_windows(b, Vector3(0, 0.337, 0.119), 0.155, 0.150, 3, 0.030)
	# Ochre and coal-black funnel, slightly raked toward the stern.
	var funnel := Color("#deab46")
	b.cylinder(Vector3(0, 0.324, -0.095), Vector3(0, 0.451, -0.119), 0.045, 0.038, funnel, 14)
	b.cylinder(Vector3(0, 0.451, -0.119), Vector3(0, 0.484, -0.126), 0.038, 0.037, RUBBER, 14)
	b.cylinder(Vector3(0, 0.483, -0.126), Vector3(0, 0.490, -0.127), 0.022, 0.021, Color("#181e22"), 12)
	for side in [-1.0, 1.0]:
		var offset := int((1.0 - side) * 0.5) * (rim.size() - 1)
		var bow := PackedVector3Array()
		for i in range(5, 9):
			bow.append(rim[offset + int(side) * i] * Vector3(0.90, 1.0, 0.98))
		_rails(b, bow, 0.025, IVORY)
		_rails(b, PackedVector3Array([
			Vector3(side * 0.095, 0.230, -0.383), Vector3(side * 0.115, 0.230, -0.274),
			Vector3(side * 0.115, 0.230, -0.193), Vector3(side * 0.115, 0.230, -0.106),
		]), 0.035, IVORY)
		_lifebuoy(b, Vector3(side * 0.116, 0.246, -0.269), 0.024, true)
		b.ball(Vector3(side * 0.121, 0.245, -0.155), Vector3(0.019, 0.024, 0.069), RESCUE, 9, 4)
	b.box(Vector3(0, 0.145, 0.294), Vector3(0.126, 0.018, 0.035), TEAK.lightened(0.25))
	_mast(b, Vector3(0, 0.374, 0.141), 0.090, STEEL)
	_mast(b, Vector3(0, 0.125, -0.444), 0.145, IVORY)
	var flag := Color("#cd483c")
	b.quad(Vector3(0, 0.264, -0.456), Vector3(0.002, 0.257, -0.541),
		Vector3(-0.002, 0.222, -0.535), Vector3(0, 0.226, -0.455), flag, Vector3.RIGHT)
	b.quad(Vector3(0, 0.264, -0.456), Vector3(0.002, 0.257, -0.541),
		Vector3(-0.002, 0.222, -0.535), Vector3(0, 0.226, -0.455), flag, Vector3.LEFT)


func _cargo_ship(b: MeshBuilder, paint: Color) -> void:
	var rust_deck := Color("#86554b")
	_deckhouse(b, Vector3(0, 0.105, -0.344), Vector3(0.195, 0.145, 0.210), WHITE_PAINT, rust_deck)
	_windows(b, Vector3(0, 0.212, -0.344), 0.195, 0.210, 4, 0.036)
	_deckhouse(b, Vector3(0, 0.262, -0.303), Vector3(0.228, 0.062, 0.112), IVORY, WHITE_PAINT)
	_windows(b, Vector3(0, 0.294, -0.303), 0.228, 0.112, 2, 0.032)
	b.cylinder(Vector3(0, 0.261, -0.414), Vector3(0, 0.350, -0.433), 0.035, 0.027, paint.lightened(0.18), 10)
	b.cylinder(Vector3(0, 0.350, -0.433), Vector3(0, 0.370, -0.437), 0.027, 0.025, RUBBER, 10)
	_mast(b, Vector3(0, 0.342, -0.300), 0.102, IVORY)
	_mast(b, Vector3(0, 0.137, 0.366), 0.083, IVORY)
	b.cylinder(Vector3(0, 0.134, 0.332), Vector3(0, 0.138, 0.357), 0.020, 0.020, STEEL)
	var boxes := [Color("#ba6244"), Color("#d2a84b"), Color("#6a949b"), Color("#6b9171"),
		Color("#ae5150"), Color("#d7b88b"), Color("#5382a5")]
	var palette_shift := 2 if paint.r < 0.21 else 0
	for row in 4:
		var z := -0.154 + 0.112 * row
		var rows := 2 if row == 3 else 3
		for column in rows:
			var x := float(column - 1) * 0.070 if rows == 3 else float(column * 2 - 1) * 0.036
			var levels := 2 if (row + column) % 4 != 0 else 1
			for level in levels:
				var ink: Color = boxes[(row * 3 + column * 2 + level + palette_shift) % boxes.size()]
				var at := Vector3(x, 0.127 + 0.051 * level, z)
				b.box(at + Vector3.UP * 0.020, Vector3(0.063, 0.041, 0.103), ink)
				b.box(at + Vector3.UP * 0.042, Vector3(0.065, 0.005, 0.102), ink.lightened(0.14))
				for rib in 5:
					b.box(at + Vector3(0, 0.045, (rib - 2) * 0.019),
						Vector3(0.059, 0.002, 0.0036), ink.darkened(0.12))
				b.box(at + Vector3(0, 0.019, 0.052), Vector3(0.003, 0.035, 0.003), ink.darkened(0.25))
	for side in [-1.0, 1.0]:
		_rails(b, PackedVector3Array([Vector3(side * 0.118, 0.113, 0.218),
			Vector3(side * 0.101, 0.124, 0.288), Vector3(side * 0.071, 0.128, 0.361),
			Vector3(side * 0.040, 0.135, 0.431)]), 0.021, IVORY)


func _fishing_boat(b: MeshBuilder, paint: Color) -> void:
	_deckhouse(b, Vector3(0, 0.112, 0.140), Vector3(0.181, 0.154, 0.248), IVORY, paint.lightened(0.16), 0.033)
	_windows(b, Vector3(0, 0.223, 0.140), 0.181, 0.248, 3, 0.063)
	b.cylinder(Vector3(0.066, 0.220, 0.010), Vector3(0.066, 0.345, -0.004), 0.010, 0.008, STEEL)
	_mast(b, Vector3(-0.040, 0.285, 0.107), 0.095, IVORY)
	_lifebuoy(b, Vector3(0.042, 0.291, 0.145), 0.029, false)
	for side in [-1.0, 1.0]:
		_rails(b, PackedVector3Array([Vector3(side * 0.082, 0.120, -0.472), Vector3(side * 0.118, 0.116, -0.401),
			Vector3(side * 0.134, 0.111, -0.273), Vector3(side * 0.134, 0.111, -0.159)]), 0.029, IVORY)
		b.ball(Vector3(side * 0.133, 0.110, -0.248), Vector3(0.013, 0.024, 0.037), RUBBER, 8, 4)
	b.box(Vector3(-0.061, 0.143, -0.164), Vector3(0.070, 0.075, 0.111), Color("#c1a05d"))
	b.box(Vector3(-0.061, 0.183, -0.164), Vector3(0.067, 0.009, 0.104), Color("#776e44"))
	b.cylinder(Vector3(-0.063, 0.154, -0.328), Vector3(0.065, 0.154, -0.328), 0.033, 0.033, STEEL)
	b.cylinder(Vector3(-0.044, 0.154, -0.328), Vector3(0.043, 0.154, -0.328), 0.036, 0.036, Color("#92906c"))


func _open_launch(b: MeshBuilder, paint: Color) -> void:
	_deckhouse(b, Vector3(0, 0.108, 0.287), Vector3(0.134, 0.031, 0.134), IVORY, IVORY)
	_deckhouse(b, Vector3(0, 0.109, -0.063), Vector3(0.110, 0.074, 0.103), paint.darkened(0.18), IVORY)
	b.quad(Vector3(-0.059, 0.189, -0.019), Vector3(0.059, 0.189, -0.019),
		Vector3(0.050, 0.225, -0.039), Vector3(-0.050, 0.225, -0.039), GLINT, Vector3.UP)
	b.quad(Vector3(-0.059, 0.189, -0.019), Vector3(0.059, 0.189, -0.019),
		Vector3(0.050, 0.225, -0.039), Vector3(-0.050, 0.225, -0.039), GLASS, Vector3.DOWN)
	for z in [-0.336, -0.207, 0.091]:
		b.box(Vector3(0, 0.138, float(z)), Vector3(0.223, 0.041, 0.052), IVORY)
		b.box(Vector3(0, 0.160, float(z)), Vector3(0.211, 0.009, 0.045), paint.lightened(0.52))
	_lifebuoy(b, Vector3(0, 0.158, 0.284), 0.037, false)
	b.box(Vector3(0, 0.105, -0.503), Vector3(0.048, 0.064, 0.051), RUBBER)
	b.ball(Vector3(0, 0.137, -0.514), Vector3(0.039, 0.033, 0.049), STEEL, 10, 4)


func _gull_mesh(material: Material) -> ArrayMesh:
	var b := MeshBuilder.new()
	var feather := Color("#f4f1e4")
	var silver := Color("#b1bec5")
	var soot := Color("#363f49")
	b.ball(Vector3(0, 0.012, -0.044), Vector3(0.085, 0.090, 0.243), feather, 8, 4)
	b.ball(Vector3(0, 0.045, 0.163), Vector3(0.067, 0.071, 0.095), IVORY, 8, 4)
	b.cylinder(Vector3(0, 0.024, 0.221), Vector3(0, 0.016, 0.341), 0.021, 0.003, Color("#d79b43"), 5)
	var tail := Vector3(0, 0.011, -0.171)
	b.quad(tail + Vector3(-0.048, 0, 0), tail + Vector3(0.048, 0, 0),
		tail + Vector3(0.112, 0.006, -0.214), tail + Vector3(-0.112, 0.006, -0.214), feather, Vector3.UP)
	for side in [-1.0, 1.0]:
		b.ball(Vector3(side * 0.054, 0.070, 0.200), Vector3.ONE * 0.014, soot, 5, 2)
		var tip := Vector3(side, -0.018, -0.087)
		var leading := PackedVector3Array([Vector3(side * 0.066, 0.034, 0.120), Vector3(side * 0.255, 0.042, 0.132),
			Vector3(side * 0.516, 0.034, 0.133), Vector3(side * 0.720, 0.014, 0.047), Vector3(side * 0.878, -0.008, -0.013)])
		var trailing := PackedVector3Array([Vector3(side * 0.066, 0.018, -0.210), Vector3(side * 0.255, 0.018, -0.184),
			Vector3(side * 0.516, 0.010, -0.110), Vector3(side * 0.720, -0.010, -0.136), Vector3(side * 0.878, -0.022, -0.124)])
		for i in leading.size() - 1:
			var ridge := leading[i].lerp(trailing[i], 0.29) + Vector3.UP * 0.020
			var next := leading[i + 1].lerp(trailing[i + 1], 0.29) + Vector3.UP * 0.020
			var shade := silver if i < 3 else soot
			b.quad(leading[i], leading[i + 1], next, ridge, shade.lightened(0.19), Vector3.UP)
			b.quad(ridge, next, trailing[i + 1], trailing[i], shade, Vector3.UP)
		b.triangle(leading[-1], tip, trailing[-1], soot, Vector3.UP)
	return b.build(material)


func _stork_mesh(material: Material) -> ArrayMesh:
	var b := MeshBuilder.new()
	var white := Color("#eeeae0")
	var flight_feather := Color("#363a42")
	var red := Color("#ab4c3e")
	b.ball(Vector3(0, 0.015, -0.09), Vector3(0.110, 0.097, 0.256), white, 8, 4)
	var breast := Vector3(0, 0.033, 0.095)
	var neck := Vector3(0, 0.049, 0.38)
	var head := Vector3(0, 0.067, 0.54)
	b.cylinder(breast, neck, 0.073, 0.039, white, 6)
	b.cylinder(neck, head, 0.039, 0.043, white, 6)
	b.ball(head, Vector3(0.052, 0.054, 0.080), white, 7, 3)
	b.cylinder(head + Vector3(0, -0.012, 0.055), Vector3(0, 0.024, 0.824), 0.031, 0.004, red, 5)
	b.quad(Vector3(-0.075, 0.024, -0.24), Vector3(0.075, 0.024, -0.24),
		Vector3(0.084, 0.017, -0.45), Vector3(-0.084, 0.017, -0.45), white, Vector3.UP)

	for side in [-1.0, 1.0]:
		var hip := Vector3(side * 0.056, -0.052, -0.20)
		var hock := Vector3(side * 0.082, -0.088, -0.52)
		var foot := Vector3(side * 0.098, -0.090, -0.87 - 0.04 * side)
		b.cylinder(hip, hock, 0.026, 0.019, red, 5)
		b.cylinder(hock, foot, 0.019, 0.012, red.darkened(0.15), 5)
		b.cylinder(foot, foot + Vector3(side * 0.017, -0.015, -0.10), 0.020, 0.006, red, 5)

		var leading := PackedVector3Array([Vector3(side * 0.10, 0.037, 0.11), Vector3(side * 0.40, 0.063, 0.18),
			Vector3(side * 0.67, 0.047, 0.16), Vector3(side * 0.84, 0.018, 0.086)])
		var coverts := PackedVector3Array([Vector3(side * 0.10, 0.051, -0.16), Vector3(side * 0.39, 0.076, -0.09),
			Vector3(side * 0.62, 0.053, -0.05), Vector3(side * 0.78, 0.025, -0.043)])
		var trailing := PackedVector3Array([Vector3(side * 0.10, 0.020, -0.29), Vector3(side * 0.42, 0.026, -0.30),
			Vector3(side * 0.66, 0.015, -0.25), Vector3(side * 0.84, -0.004, -0.18)])
		for i in leading.size() - 1:
			b.quad(leading[i], leading[i + 1], coverts[i + 1], coverts[i], white, Vector3.UP)
			b.quad(coverts[i], coverts[i + 1], trailing[i + 1], trailing[i], flight_feather, Vector3.UP)
		# The separate outer primaries give the broad wing a fingered silhouette.
		var wing_base := leading[-1]
		var wing_back := trailing[-1]
		for i in 5:
			var base := wing_base.lerp(wing_back, float(i) / 5.0)
			var next := wing_base.lerp(wing_back, float(i + 1) / 5.0)
			var tip := Vector3(side * (1.13 - i * 0.038), -0.025, 0.054 - i * 0.073)
			b.triangle(base, tip, next, flight_feather.lightened(0.025 * (i % 2)), Vector3.UP)
	return b.build(material)
