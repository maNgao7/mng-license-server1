extends Node3D

const PROXIMITY := preload("JetAudio.gd")

const HARBOR := preload("TurkiyeHarbor.gd")
const MAP := preload("TurkiyeMap.gd")
const WATER_Y := HARBOR.WATER_Y
const FLAGSHIP := &"MediterraneanFlagship"
const FLAGSHIP_SALVO_INTERVAL := 10.0
# Atlas anchor, heading, silhouette length, beam multiplier, hull paint.
const FLEET := [
	[&"AegeanEscort", Vector2(362, 895), 4.65, 1.48, 0.94, Color("#465b67")],
	[FLAGSHIP, Vector2(696, 910), 1.35, 1.84, 1.14, Color("#4d5963")],
	[&"BlackSeaGuard", Vector2(1042, 166), 1.25, 1.68, 1.02, Color("#3e5367")],
]
# Atlas pixels only. This keeps the effect in the coastal area shown by the camera.
const FRONT_PROXIMITY_SQUARED := 205.0 * 205.0
# Timing is for readability in the atlas camera and has no gameplay effect.
const PULSE_DELAY := 0.22
const FLIGHT_TIME := 0.59
const SMOKE_LIFETIME := 1.0
const SALVO_TIME := PULSE_DELAY + FLIGHT_TIME + SMOKE_LIFETIME + 0.1
const FLASHES_PER_PULSE := 2
const PUFFS_PER_PULSE := 8
const AMBIENT_ZOOM := 2.8
const AMBIENT_FOCUS_TIME := 0.40
const AMBIENT_INTERVAL := 6.5

const DECK := Color("#859899")
const ARMOR := Color("#a9b8b9")
const PANEL := Color("#354550")
const WINDOWS := Color("#244650")
const GOLD := Color("#d6ad64")
const IVORY := Color("#e3dec7")

const WAKE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform float elapsed;
varying float phase;

void vertex() {
	phase = INSTANCE_CUSTOM.r;
}

void fragment() {
	vec2 p = vec2((UV.x - 0.5) * 0.64, UV.y * 1.40 - 0.85);
	float astern = 0.53 - p.y;
	float wave = sin(astern * 54.0 - elapsed * 5.4 + phase * 6.28);
	float ridge = 0.014 + astern * 0.19 + 0.007 * wave;
	float shoulder = 1.0 - smoothstep(0.008, 0.032, abs(abs(p.x) - ridge));
	shoulder *= smoothstep(0.0, 0.20, astern) * (1.0 - smoothstep(0.62, 1.36, astern));
	float wash = 1.0 - smoothstep(0.018, 0.081 + astern * 0.022, abs(p.x + 0.008 * wave));
	wash *= smoothstep(0.39, 0.59, astern) * (1.0 - smoothstep(0.92, 1.36, astern));
	float foam = shoulder * (0.35 + 0.10 * wave) + wash * (0.20 + 0.12 * wave);
	ALBEDO = vec3(0.67, 0.87, 0.87);
	ALPHA = foam;
}
"""

const SHOT_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, depth_draw_never, shadows_disabled;
varying vec4 style;

void vertex() {
	style = INSTANCE_CUSTOM;
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float width = mix(0.94, 0.26, smoothstep(-0.65, 0.94, p.x));
	float shape = length(vec2(p.x, p.y / width));
	shape += (sin(p.x * 16.0 + p.y * 12.0 + style.g * 7.0)
		* cos(p.y * 19.0 - p.x * 8.0)) * 0.10 * style.r;
	float halo = 1.0 - smoothstep(0.04, 0.98, shape);
	float core = 1.0 - smoothstep(0.0, 0.58, shape);
	ALBEDO = mix(vec3(0.85, 0.33, 0.095), vec3(1.0, 0.89, 0.66), core);
	ALPHA = (halo * halo * 0.56 + core * 0.44) * style.a;
}
"""

const SMOKE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;
varying vec4 style;

void vertex() {
	style = INSTANCE_CUSTOM;
}

float grain(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	vec4 dots = vec4(dot(i, vec2(21.41, 62.63)), dot(i + vec2(1.0, 0.0), vec2(21.41, 62.63)),
		dot(i + vec2(0.0, 1.0), vec2(21.41, 62.63)), dot(i + vec2(1.0), vec2(21.41, 62.63)));
	vec4 v = fract(sin(dots) * 15731.746);
	return mix(mix(v.x, v.y, f.x), mix(v.z, v.w, f.x), f.y);
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	vec2 sample_point = p * 3.1 + vec2(style.g * 18.0, -style.b * 1.1);
	float surface = grain(sample_point) * 0.70 + grain(sample_point * 2.1) * 0.30;
	float cloud = 1.0 - smoothstep(0.17, 0.96, length(p) - (surface - 0.55) * 0.58);
	vec3 shade = mix(vec3(0.27, 0.29, 0.31), vec3(0.38, 0.32, 0.27), style.r);
	vec3 lit = mix(vec3(0.66, 0.68, 0.67), vec3(0.76, 0.67, 0.56), style.r);
	ALBEDO = mix(shade, lit, clamp(surface * 0.76 + p.y * 0.16 + style.b * 0.21, 0.0, 1.0));
	ALPHA = cloud * cloud * (0.64 + surface * 0.36) * style.a;
}
"""


class Vessel:
	var hull: MeshInstance3D
	var anchor: Vector2
	var coast: Vector2
	var berth: Vector3
	var heading: float
	var hull_length: float
	var beam: float
	var phase: float
	var aim := 0.0
	var charge: float
	var shot_age := -1.0
	var shot_front := ""
	var shot_origins := PackedVector3Array()
	var shot_target := Vector3.ZERO
	var focused_for := 0.0
	var next_ambient := 0.0


var _canvas: Control
var _fleet: Array[Vessel] = []
var _turrets: MultiMesh
var _wakes: MultiMesh
var _effects: MultiMesh
var _smoke: MultiMesh
var _wake_material: ShaderMaterial
var _report: AudioStreamPlayer
var _report_source := Vector3.INF
var _reports_started := 0
var _elapsed := 0.0
var _shots_started := 0
var _ambient_shots_started := 0
var _next_ambient := 0.0
var _shader_warmup_left := 2


func configure(canvas: Control, atlas: Dictionary) -> void:
	name = "TurkiyeWarships"
	set_process(false)
	for child in get_children():
		remove_child(child)
		child.queue_free()
	_fleet.clear()
	_report = null
	_smoke = null
	_canvas = canvas
	_elapsed = 0.0
	_shots_started = 0
	_ambient_shots_started = 0
	_next_ambient = 0.0
	_reports_started = 0
	_shader_warmup_left = 2
	if not is_instance_valid(canvas) or atlas.get("regions", []).is_empty():
		return
	show()

	var paint := StandardMaterial3D.new()
	paint.vertex_color_use_as_albedo = true
	paint.roughness = 0.84
	var coastlines: Array[PackedVector2Array] = []
	for region: Dictionary in atlas.regions:
		coastlines.append(MAP.points(region.polygon))
	for index in FLEET.size():
		var entry: Array = FLEET[index]
		var ship := Vessel.new()
		ship.anchor = entry[1]
		ship.coast = _nearest_coast(ship.anchor, coastlines)
		ship.berth = canvas.world_point(ship.anchor)
		ship.berth.y = WATER_Y
		ship.heading = entry[2]
		ship.hull_length = entry[3]
		ship.beam = entry[4]
		ship.phase = 2.1 * index
		ship.charge = FLAGSHIP_SALVO_INTERVAL if entry[0] == FLAGSHIP else _first_shot_delay(index)
		ship.hull = MeshInstance3D.new()
		ship.hull.name = entry[0]
		ship.hull.mesh = _hull_mesh(index, entry[5], paint)
		ship.hull.scale = Vector3(ship.beam, 1.0, 1.0) * ship.hull_length
		ship.hull.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(ship.hull)
		_fleet.append(ship)

	_turrets = _make_batch(&"Turrets", _turret_mesh(paint), _fleet.size() * 2, false)
	var wake := PlaneMesh.new()
	wake.size = Vector2(0.64, 1.40)
	wake.center_offset.z = -0.15
	_wake_material = _shader_material(WAKE_SHADER)
	wake.material = _wake_material
	_wakes = _make_batch(&"Wakes", wake, _fleet.size(), true)
	var effect := QuadMesh.new()
	effect.material = _shader_material(SHOT_SHADER)
	effect.material.render_priority = 1
	_effects = _make_batch(&"ShotEffects", effect, _fleet.size() * 2 * FLASHES_PER_PULSE, true)
	_effects.visible_instance_count = 0
	var cloud := QuadMesh.new()
	cloud.material = _shader_material(SMOKE_SHADER)
	_smoke = _make_batch(&"ShotSmoke", cloud, _fleet.size() * 2 * PUFFS_PER_PULSE, true)
	_smoke.visible_instance_count = 0
	var sound := HARBOR.load_maritime_audio(_canvas.app.mod_root, "coastal-salvo.ogg")
	if sound != null:
		_report = AudioStreamPlayer.new()
		_report.name = "CoastalReport"
		_report.stream = sound
		_report.bus = HARBOR.maritime_bus()
		add_child(_report)
	for index in _fleet.size():
		_wakes.set_instance_custom_data(index, Color(float(index) / _fleet.size(), 0, 0, 1))
		_pose(_fleet[index], index, _fleet[index].coast, 0.0)
	set_process(true)


## shots_started is cumulative for this configured map instance, including completed shots.
func get_visual_stats() -> Dictionary:
	var active := 0
	for ship in _fleet:
		if ship.shot_age >= 0.0:
			active += 1
	return {"ship_count": _fleet.size(), "shots_started": _shots_started, "active_shots": active,
		"ambient_shots_started": _ambient_shots_started, "reports_started": _reports_started,
		"smoke_puffs": _smoke.visible_instance_count if _smoke != null else 0}


func _process(delta: float) -> void:
	if not is_instance_valid(_canvas) or not is_instance_valid(_canvas.app):
		hide()
		set_process(false)
		return
	var app: Node = _canvas.app
	if app.map_id != "turkiye" or app.canvas != _canvas:
		if is_instance_valid(_report):
			_report.stop()
		hide()
		return
	show()
	var paused: bool = get_tree().paused or app.is_paused()
	if is_instance_valid(_report):
		var listener := PROXIMITY.audible_camera(_canvas)
		var screen := listener.get_viewport().get_visible_rect() if listener != null else Rect2()
		PROXIMITY.update_voice(_report, PROXIMITY.position_gain(listener, screen, _report_source) * 0.62, paused, delta)
	if paused:
		return
	_elapsed += delta
	_wake_material.set_shader_parameter("elapsed", _elapsed)
	var fronts: Array = _canvas.battle_fronts() if app.state.get("phase") == "running" else []
	var camera := get_viewport().get_camera_3d()
	var camera_basis := camera.global_basis if camera != null else Basis.IDENTITY
	var effects_used := 0
	var smoke_used := 0
	for index in _fleet.size():
		var ship := _fleet[index]
		var front := _nearest_front(ship, fronts)
		var point: Vector2 = front.get("point", ship.coast)
		var front_id: String = front.get("id", "")
		if ship.shot_front != front_id:
			ship.shot_age = -1.0
		elif ship.shot_age >= 0.0:
			ship.shot_age += delta
			if ship.shot_age >= SALVO_TIME:
				ship.shot_age = -1.0
		_pose(ship, index, point, delta)
		var is_flagship := ship.hull.name == FLAGSHIP
		if is_flagship or not front_id.is_empty():
			ship.focused_for = 0.0
			ship.charge -= delta
			if ship.charge <= 0.0 and ship.shot_age < 0.0 and absf(angle_difference(ship.aim, _coastal_yaw(ship, point))) < 0.23:
				ship.charge = FLAGSHIP_SALVO_INTERVAL if is_flagship else 2.50 + index * 0.23
				_begin_shot(ship, index, point, front_id, camera)
		else:
			ship.charge = _first_shot_delay(index)
			ship.focused_for = ship.focused_for + delta if _has_ambient_focus(ship, camera) else 0.0
			if ship.focused_for >= AMBIENT_FOCUS_TIME and _elapsed >= maxf(_next_ambient, ship.next_ambient) and ship.shot_age < 0.0:
				_begin_shot(ship, index, point, front_id, camera)
				_next_ambient = _elapsed + AMBIENT_INTERVAL
				ship.next_ambient = _elapsed + AMBIENT_INTERVAL + 2.0
		if ship.shot_age >= 0.0:
			for pulse in 2:
				var age := ship.shot_age - pulse * PULSE_DELAY
				if age < 0.0:
					continue
				var origin := ship.shot_origins[pulse]
				var target := ship.shot_target + Vector3(0.042, 0, -0.057) * pulse
				effects_used = _draw_pulse(origin, target, age, camera_basis, effects_used)
				smoke_used = _draw_smoke(origin, target, age, camera_basis, ship.phase + pulse * 0.33, smoke_used)
	_effects.visible_instance_count = effects_used
	_smoke.visible_instance_count = smoke_used
	if _shader_warmup_left > 0 and camera != null:
		_shader_warmup_left -= 1
		# Compile both salvo shaders during the hidden loading frames. Their
		# first visible use ten seconds later must not stall the driver's compiler.
		var origin := camera.global_position - camera.global_basis.z * 3.0
		for batch in [_effects, _smoke]:
			if batch.visible_instance_count == 0:
				batch.set_instance_transform(0, Transform3D(camera_basis.scaled(Vector3.ONE * 0.1), origin))
				batch.set_instance_custom_data(0, Color(0, 0, 0, 0))
				batch.visible_instance_count = 1


func _begin_shot(ship: Vessel, index: int, point: Vector2, front_id: String, camera: Camera3D) -> void:
	ship.shot_origins = PackedVector3Array([
		_turret_pose(ship, false) * Vector3(0.0, 0.060, 0.180),
		_turret_pose(ship, true) * Vector3(0.0, 0.060, 0.180),
	])
	ship.shot_target = _canvas.world_point(point) + Vector3.UP * 0.095
	ship.shot_age = 0.0
	ship.shot_front = front_id
	_shots_started += 1
	if front_id.is_empty():
		_ambient_shots_started += 1
		if ship.hull.name == FLAGSHIP and not _has_ambient_focus(ship, camera):
			return
	_play_report(camera, ship, index)


func _has_ambient_focus(ship: Vessel, camera: Camera3D) -> bool:
	return float(_canvas.zoom_factor) >= AMBIENT_ZOOM and HARBOR.maritime_gain(camera, ship.hull.global_position) >= 0.89


func _nearest_coast(anchor: Vector2, coastlines: Array[PackedVector2Array]) -> Vector2:
	var nearest := INF
	var coast := anchor
	for polygon in coastlines:
		for index in polygon.size():
			var edge := Geometry2D.get_closest_point_to_segment(anchor, polygon[index], polygon[(index + 1) % polygon.size()])
			var distance := anchor.distance_squared_to(edge)
			if distance < nearest:
				nearest = distance
				coast = edge
	return coast


func _play_report(camera: Camera3D, ship: Vessel, index: int) -> void:
	if not is_instance_valid(_report) or _report.playing or PROXIMITY.audible_camera(_canvas) == null:
		return
	var gain := maxf(HARBOR.maritime_gain(camera, ship.shot_origins[0]), HARBOR.maritime_gain(camera, ship.shot_target) * 0.48)
	if gain <= 0.0:
		return
	_report.volume_db = linear_to_db(gain * 0.62)
	_report_source = ship.shot_origins[0]
	_report.pitch_scale = 0.97 + index * 0.025
	_report.play()
	_reports_started += 1


func _first_shot_delay(index: int) -> float:
	return 0.46 + index * 0.10


func _nearest_front(ship: Vessel, fronts: Array) -> Dictionary:
	var nearest := FRONT_PROXIMITY_SQUARED
	var selected := {}
	for front: Dictionary in fronts:
		var points: Array[Vector2] = []
		points.assign(front.get("formation_points", []))
		# A shared border may be inland while the attacked region reaches the coast.
		points.append(front.get("target", Vector2.INF))
		var front_id := str(front.get("id", ""))
		for point: Vector2 in points:
			var distance := ship.anchor.distance_squared_to(point)
			if distance < nearest:
				nearest = distance
				selected = {"point": point, "id": front_id}
	return selected


func _pose(ship: Vessel, index: int, target: Vector2, delta: float) -> void:
	var swell := _elapsed * 1.15 + ship.phase
	var heading := Basis(Vector3.UP, ship.heading)
	ship.hull.position = ship.berth + heading.z * (sin(swell * 0.38) * 0.13)
	ship.hull.position.y += sin(swell) * 0.012
	ship.hull.rotation = Vector3(cos(swell) * 0.014, ship.heading, sin(swell * 0.81) * 0.025)
	_wakes.set_instance_transform(index, Transform3D(
		heading.scaled(Vector3.ONE * ship.hull_length),
		Vector3(ship.hull.position.x, WATER_Y + 0.008, ship.hull.position.z)))
	var desired := _coastal_yaw(ship, target)
	ship.aim = desired if is_zero_approx(delta) else lerp_angle(ship.aim, desired, 1.0 - exp(-delta * 9.0))
	_turrets.set_instance_transform(index * 2, _turret_pose(ship, false))
	_turrets.set_instance_transform(index * 2 + 1, _turret_pose(ship, true))


func _coastal_yaw(ship: Vessel, target: Vector2) -> float:
	var direction: Vector3 = _canvas.world_point(target) - ship.hull.position
	return atan2(direction.x, direction.z) - ship.heading


func _turret_pose(ship: Vessel, stern: bool) -> Transform3D:
	var yaw := ship.aim
	var pivot := Vector3(0, 0.112, -0.332 if stern else 0.285)
	var recoil := 0.0
	var age := ship.shot_age - (PULSE_DELAY if stern else 0.0)
	if age >= 0.0:
		recoil = 0.024 * (1.0 - smoothstep(0.0, 0.14, age))
	var swivel := Basis(Vector3.UP, yaw)
	return ship.hull.transform * Transform3D(swivel, pivot - swivel.z * recoil)


func _arc(origin: Vector3, target: Vector3, t: float) -> Vector3:
	return origin.lerp(target, t) + Vector3.UP * (0.32 * 4.0 * t * (1.0 - t))


func _draw_pulse(origin: Vector3, target: Vector3, age: float, camera_basis: Basis, slot: int) -> int:
	if age < FLIGHT_TIME:
		var progress := age / FLIGHT_TIME
		var head := _arc(origin, target, progress)
		var direction := (_arc(origin, target, minf(1.0, progress + 0.04)) - head).normalized()
		var trail_basis := _screen_direction(camera_basis, direction)
		var amount := 0.62 * smoothstep(0.02, 0.15, progress) * (1.0 - smoothstep(0.78, 1.0, progress))
		_place_effect(slot, trail_basis, head - direction * 0.065, Vector2(0.22, 0.040), amount, 0.0)
		slot += 1
		if age < 0.12:
			var flash := 1.0 - smoothstep(0.012, 0.12, age)
			_place_effect(slot, trail_basis, origin + direction * 0.095,
				Vector2(0.23, 0.13) * (1.0 + age * 5.0), flash, 0.9)
			slot += 1
	elif age < FLIGHT_TIME + 0.13:
		var contact := (age - FLIGHT_TIME) / 0.13
		_place_effect(slot, camera_basis, target + Vector3.UP * (0.042 + contact * 0.09),
			Vector2(0.22, 0.17) * (1.0 + contact * 0.48), (1.0 - contact) * 0.71, 1.0)
		slot += 1
	return slot


func _draw_smoke(origin: Vector3, target: Vector3, age: float, camera_basis: Basis, seed: float, slot: int) -> int:
	var wind := Vector3(0.16, 0.0, -0.19)
	var route := (target - origin).slide(Vector3.UP).normalized()
	for index in PUFFS_PER_PULSE:
		var impact := index >= 4
		var spread := float(index % 4)
		var delay := (FLIGHT_TIME if impact else 0.0) + spread * 0.032
		var life := (age - delay) / (SMOKE_LIFETIME if impact else 0.78)
		if life < 0.0 or life >= 1.0:
			continue
		var angle := seed * 4.0 + spread * 2.38
		var radial := Vector3(cos(angle), 0, sin(angle))
		var center := target + radial * (0.035 + spread * 0.025) if impact else origin + route * spread * 0.071
		var rise := (0.27 + spread * 0.045) if impact else (0.22 - spread * 0.024)
		center += radial * life * (0.22 if impact else 0.12) + (wind + Vector3.UP * rise) * life
		var size := (0.19 if impact else 0.13) + (0.44 if impact else 0.30) * sqrt(life)
		var stretch := 1.06 + spread * 0.14 if impact else 1.02 + spread * 0.10
		var facing := camera_basis.rotated(camera_basis.z, angle * 0.8)
		var basis := Basis(facing.x * size, facing.y * size * stretch, facing.z)
		var onset := lerpf(0.27, 1.0, smoothstep(0.0, 0.09, life))
		var density := onset * pow(1.0 - life, 1.45) * (0.84 if impact else 0.72)
		_smoke.set_instance_transform(slot, Transform3D(basis, center))
		_smoke.set_instance_custom_data(slot, Color(float(impact), fposmod(angle, TAU) / TAU, life, density))
		slot += 1
	return slot


func _screen_direction(camera_basis: Basis, direction: Vector3) -> Basis:
	var in_plane := Vector2(direction.dot(camera_basis.x), direction.dot(camera_basis.y))
	return camera_basis.rotated(camera_basis.z, in_plane.angle())


func _place_effect(slot: int, basis: Basis, point: Vector3, size: Vector2, opacity: float, turbulence: float) -> void:
	var sized := Basis(basis.x * size.x, basis.y * size.y, basis.z)
	_effects.set_instance_transform(slot, Transform3D(sized, point))
	_effects.set_instance_custom_data(slot, Color(turbulence, fposmod(point.x * 0.43, 1.0), 0, opacity))


func _make_batch(node_name: StringName, mesh: Mesh, count: int, custom_data: bool) -> MultiMesh:
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.use_custom_data = custom_data
	batch.mesh = mesh
	batch.instance_count = count
	var instance := MultiMeshInstance3D.new()
	instance.name = node_name
	instance.multimesh = batch
	instance.custom_aabb = AABB(Vector3(-14, -0.1, -9), Vector3(28, 1.6, 18))
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(instance)
	return batch


func _shader_material(source: String) -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = source
	var material := ShaderMaterial.new()
	material.shader = shader
	return material


func _hull_mesh(profile: int, paint: Color, material: Material) -> ArrayMesh:
	var mesh := HARBOR.MeshBuilder.new()
	var outline := PackedVector2Array([
		Vector2(0.009, 0.52), Vector2(0.079, 0.36), Vector2(0.129, 0.17),
		Vector2(0.146, -0.10), Vector2(0.136, -0.40), Vector2(0.098, -0.50),
		Vector2(-0.098, -0.50), Vector2(-0.136, -0.40), Vector2(-0.146, -0.10),
		Vector2(-0.129, 0.17), Vector2(-0.079, 0.36), Vector2(-0.009, 0.52),
	])
	var keel := _ring(outline, -0.037, 0.74, 0.97)
	var lower := _ring(outline, 0.014, 0.91, 0.99)
	var upper := _ring(outline, 0.089, 1.0, 1.0)
	var lip := _ring(outline, 0.104, 1.0, 1.0)
	mesh.belt(keel, lower, Color("#46515a"))
	mesh.belt(lower, upper, paint)
	mesh.belt(upper, lip, ARMOR.darkened(0.15))
	mesh.cap(lip, Vector3(0, 0.104, 0), DECK)

	var house_z := -0.065 if profile == 0 else -0.021
	var house_width := 0.179 if profile == 1 else 0.148
	var bridge: float = 0.082 if profile == 2 else 0.106
	_block(mesh, Vector3(0, 0.102, house_z), Vector2(house_width, 0.343), 0.051, paint.lightened(0.22), DECK)
	_block(mesh, Vector3(0, 0.151, house_z + 0.063), Vector2(house_width * 0.86, 0.137), bridge, ARMOR, ARMOR.lightened(0.18))
	var window_y := 0.151 + bridge * 0.76
	mesh.box(Vector3(0, window_y, house_z + 0.125), Vector3(house_width * 0.60, 0.019, 0.015), WINDOWS)
	for side in [-1.0, 1.0]:
		mesh.box(Vector3(side * house_width * 0.35, window_y, house_z + 0.075), Vector3(0.017, 0.019, 0.070), WINDOWS)
		mesh.box(Vector3(side * 0.116, 0.111, 0.178), Vector3(0.017, 0.014, 0.116), GOLD)
		mesh.box(Vector3(side * 0.074, 0.111, -0.409), Vector3(0.012, 0.013, 0.098), IVORY)
	mesh.box(Vector3(0, 0.111, -0.452), Vector3(0.15, 0.013, 0.012), IVORY)
	mesh.box(Vector3(0, 0.112, 0.421), Vector3(0.038, 0.009, 0.013), IVORY)
	mesh.box(Vector3(0, 0.112, 0.389), Vector3(0.066, 0.009, 0.012), IVORY)

	var mast_base := Vector3(0, 0.151 + bridge, house_z + 0.032)
	var mast_top := mast_base + Vector3(0, 0.132 if profile == 0 else 0.110, -0.012)
	mesh.cylinder(mast_base, mast_top, 0.018, 0.005, PANEL, 5)
	mesh.box(mast_top - Vector3.UP * 0.020, Vector3(0.117, 0.018, 0.024), ARMOR)
	mesh.box(mast_top - Vector3.UP * 0.009, Vector3(0.081, 0.016, 0.017), WINDOWS)
	mesh.box(mast_top + Vector3.UP * 0.006, Vector3(0.019, 0.016, 0.018), GOLD)

	var funnels := [-0.042, 0.042] if profile == 1 else [0.0]
	for x: float in funnels:
		var z := house_z - 0.091
		_block(mesh, Vector3(x, 0.150, z), Vector2(0.066, 0.087), 0.072, paint.lightened(0.12), PANEL)
		mesh.box(Vector3(x, 0.222, z), Vector3(0.046, 0.016, 0.058), PANEL)
	return mesh.build(material)


func _turret_mesh(material: Material) -> ArrayMesh:
	var mesh := HARBOR.MeshBuilder.new()
	mesh.cylinder(Vector3.ZERO, Vector3.UP * 0.025, 0.064, 0.059, PANEL)
	_block(mesh, Vector3(0, 0.022, 0), Vector2(0.121, 0.103), 0.052, DECK, ARMOR)
	for side in [-1.0, 1.0]:
		var at := Vector3(side * 0.023, 0.060, 0.031)
		mesh.cylinder(at, at + Vector3.BACK * 0.150, 0.010, 0.007, PANEL, 6)
		mesh.cylinder(at + Vector3.BACK * 0.126, at + Vector3.BACK * 0.151, 0.009, 0.009, ARMOR, 6)
	return mesh.build(material)


func _ring(outline: PackedVector2Array, y: float, beam: float, length: float) -> PackedVector3Array:
	var ring := PackedVector3Array()
	for point in outline:
		var rise := maxf(0.0, point.y - 0.22) * 0.16
		ring.append(Vector3(point.x * beam, y + rise, point.y * length))
	return ring


func _block(mesh: HARBOR.MeshBuilder, base: Vector3, footprint: Vector2, height: float, side: Color, top: Color) -> void:
	var outline := PackedVector2Array([
		Vector2(0.50, 0.30), Vector2(0.32, 0.50), Vector2(-0.32, 0.50), Vector2(-0.50, 0.30),
		Vector2(-0.50, -0.31), Vector2(-0.33, -0.50), Vector2(0.33, -0.50), Vector2(0.50, -0.31),
	])
	var low := PackedVector3Array()
	var high := PackedVector3Array()
	var roof := base + Vector3.UP * height
	for corner in outline:
		var offset := Vector3(corner.x * footprint.x, 0, corner.y * footprint.y)
		low.append(base + offset)
		high.append(roof + offset * 0.76 - Vector3.BACK * 0.008)
	mesh.belt(low, high, side, base)
	mesh.cap(high, roof, top)
