extends Node3D
## Presentation for one salvo. The caller owns every gameplay consequence.
## Signal order for an accepted play: launched, impact, finished. Cancel is silent.

signal launched
signal impact
signal finished

const IMPACT_TIME := 2.60
const AFTERMATH_TIME := 2.65
const MAX_REGIONS := 34
const TRAIL_STEP := 0.05
const TRAIL_SAMPLES := 20
const PLUME_LOBES := 7
const SPARKS := 9
const GROUND_Y := 0.039
const SHAKE_TIME := 0.88

const HULL_SHADER := """
shader_type spatial;
render_mode cull_disabled, shadows_disabled;
varying float height;
void vertex() {
	height = (MODEL_MATRIX * vec4(VERTEX, 1.0)).y;
}
void fragment() {
	if (height < 0.025) { discard; }
	ALBEDO = COLOR.rgb;
	METALLIC = 0.48;
	ROUGHNESS = 0.39 + (1.0 - COLOR.r) * 0.17;
	SPECULAR = 0.52;
	float grazing = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 3.0);
	EMISSION = COLOR.rgb * 0.16 + vec3(0.045, 0.063, 0.075) * grazing;
}
"""

const FIRE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
uniform sampler2D density : filter_linear_mipmap;
void fragment() {
	vec4 cloud = texture(density, UV);
	float heat = clamp((cloud.a * 0.73 + cloud.r * 0.39) * COLOR.r, 0.0, 1.0);
	vec3 ember = vec3(0.82, 0.13, 0.025);
	vec3 flame = mix(ember, vec3(1.0, 0.55, 0.11), smoothstep(0.21, 0.70, heat));
	ALBEDO = mix(flame, vec3(1.0, 0.97, 0.78), smoothstep(0.66, 1.0, heat));
	ALPHA = cloud.a * COLOR.a;
}
"""

const GROUND_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
varying vec3 effect;
void vertex() {
	effect = INSTANCE_CUSTOM.rgb;
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float angle = atan(p.y, p.x);
	float t = effect.x;
	float blast = effect.y;
	float life = effect.z;
	float broken = sin(angle * 11.0 + 0.7) * 0.012 + sin(angle * 19.0) * 0.007;
	float wave = 0.10 + 0.80 * (1.0 - (1.0 - t) * (1.0 - t));
	float rim = 1.0 - smoothstep(0.012, 0.047 + t * 0.023, abs(r - wave + broken));
	float echo = 1.0 - smoothstep(0.009, 0.025, abs(r - wave * 0.72 + broken));
	float ring = max(rim, echo * 0.32) * (1.0 - smoothstep(0.25, 0.95, t));
	float soot = (1.0 - smoothstep(0.08, 0.63, r + broken * 4.5)) * blast * 0.78;
	soot *= smoothstep(0.0, 0.13, t) * (1.0 - smoothstep(0.48, 1.0, life));
	float core = (1.0 - smoothstep(0.02, 0.44, r)) * (1.0 - smoothstep(0.01, 0.43, t));
	vec3 warm = mix(vec3(0.60, 0.90, 0.94), vec3(1.0, 0.70, 0.29), blast);
	ALBEDO = mix(vec3(0.21, 0.095, 0.075), warm, clamp(ring * 1.6 + core, 0.0, 1.0));
	ALPHA = max(soot, max(ring * 0.75, core * 0.67));
}
"""

const CRACK_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
varying vec2 effect;
void vertex() {
	effect = INSTANCE_CUSTOM.rg;
}
void fragment() {
	float glow = 1.0 - smoothstep(0.04, 0.68, effect.x);
	float center = 1.0 - smoothstep(0.19, 0.46, abs(UV.y - 0.5));
	float spread = 1.0 - smoothstep(effect.y - 0.16, effect.y, UV.x);
	vec3 ember = mix(vec3(0.99, 0.23, 0.035), vec3(1.0, 0.80, 0.40), glow);
	ALBEDO = mix(vec3(0.24, 0.10, 0.075), ember, center * glow);
	ALPHA = spread * (1.0 - smoothstep(0.56, 1.0, effect.x)) * (0.75 + center * 0.20);
}
"""


class Flight:
	var from: Vector3
	var lift: Vector3
	var before_peak: Vector3
	var peak: Vector3
	var after_peak: Vector3
	var dive: Vector3
	var to: Vector3
	var size: float


var _board: Control
var _sources := PackedVector3Array()
var _targets := PackedVector3Array()
var _flights: Array[Flight] = []
var _elapsed := 0.0
var _active := false
var _air_show := false
var _shaken_camera: Camera3D
var _saved_offset := Vector2.ZERO

# Seven shared draws at most. Instance capacity is fixed independently of input.
var _hulls: MultiMesh
var _smoke: MultiMesh
var _fire: MultiMesh
var _streaks: MultiMesh
var _ground: MultiMesh
var _cracks: MultiMesh
var _glints: MultiMesh
var _smoke_used := 0
var _fire_used := 0
var _streaks_used := 0
var _ground_used := 0
var _glints_used := 0

# Recomputed once per rendered frame so the FX stay legible when the viewer zooms.
var _view := Transform3D.IDENTITY
var _view_rect := Rect2()
var _pixel_ratio := 0.0


func _ready() -> void:
	set_process(false)


func setup(board: Control) -> void:
	cancel()
	_board = board
	if _hulls == null:
		_build_batches()


## Returns false for an unusable board, camera, or region list.
func play(sources: Array, targets: Array) -> bool:
	return _play_points(_region_points(sources), _region_points(targets), false)


func play_air_show(origins: PackedVector3Array, targets: Array) -> bool:
	if _active:
		return false
	var destinations := _region_points(targets)
	if origins.is_empty() and not destinations.is_empty():
		origins = PackedVector3Array([destinations[0] + Vector3.UP * 2.8])
	return _play_points(origins.slice(0, MAX_REGIONS), destinations, true)


func is_air_show() -> bool:
	return _active and _air_show


func _play_points(origins: PackedVector3Array, destinations: PackedVector3Array, air_show: bool) -> bool:
	var camera := _camera()
	if camera == null or _hulls == null:
		return false
	if origins.is_empty() or destinations.is_empty():
		return false

	cancel()
	_air_show = air_show
	_sources = origins
	_targets = destinations
	_cache_view(camera)
	_plan_flights()
	_elapsed = 0.0
	_active = true
	_draw(camera)
	set_process(true)
	launched.emit()
	return true


## Can also be called while paused or inside a signal callback.
func cancel() -> void:
	_active = false
	set_process(false)
	_restore_shake()
	_sources.clear()
	_targets.clear()
	_flights.clear()
	if _hulls != null:
		for batch in [_hulls, _smoke, _fire, _streaks, _ground, _cracks, _glints]:
			batch.visible_instance_count = 0


func _exit_tree() -> void:
	cancel()


func _camera() -> Camera3D:
	if not is_inside_tree() or not is_instance_valid(_board):
		return null
	var camera: Variant = _board.get("eye")
	if is_instance_valid(camera) and camera is Camera3D and camera.is_inside_tree():
		return camera
	return null


func _region_points(ids: Array) -> PackedVector3Array:
	var points := PackedVector3Array()
	if not is_instance_valid(_board):
		return points
	var regions: Array = _board.get("regions")
	var seen := {}
	for id: Variant in ids:
		if not id is int or id < 0 or id >= regions.size() or seen.has(id):
			continue
		var center: Vector2 = regions[id].center
		var world: Vector3 = _board.world_point(center)
		if not world.is_finite():
			continue
		points.append(world + Vector3.UP * GROUND_Y)
		seen[id] = true
		if points.size() == MAX_REGIONS:
			break
	return points


func _process(delta: float) -> void:
	if not _active:
		return
	var camera := _camera()
	if camera == null:
		cancel()
		return
	var app: Variant = _board.get("app")
	if is_instance_valid(app) and app.has_method("is_paused") and app.is_paused():
		_restore_shake()
		return
	var previous := _elapsed
	_elapsed += delta
	if previous < IMPACT_TIME and _elapsed >= IMPACT_TIME:
		# Give every target its first impact frame together, even after a hitch.
		_elapsed = IMPACT_TIME
		_draw(camera)
		impact.emit()
		return
	if _elapsed >= IMPACT_TIME + AFTERMATH_TIME:
		cancel()
		finished.emit()
		return
	_draw(camera)


func _cache_view(camera: Camera3D) -> void:
	_view = camera.global_transform
	_view_rect = camera.get_viewport().get_visible_rect()
	_pixel_ratio = 2.0 * tan(deg_to_rad(camera.fov) * 0.5) / maxf(1.0, _view_rect.size.y)


func _depth(point: Vector3) -> float:
	return (_view.origin - point).dot(_view.basis.z)


func _world_per_pixel(point: Vector3) -> float:
	return maxf(0.1, _depth(point)) * _pixel_ratio


func _on_screen(camera: Camera3D, point: Vector3, margin: float) -> bool:
	return _depth(point) > maxf(camera.near * 2.0, 0.20) \
		and _view_rect.grow(margin).has_point(camera.unproject_position(point))


func _plan_flights() -> void:
	# Pair the larger side to the least-used nearest region on the smaller side.
	# This covers every source and target in at most 34 flights.
	var more_sources := _sources.size() >= _targets.size()
	var primary := _sources if more_sources else _targets
	var secondary := _targets if more_sources else _sources
	var uses := PackedInt32Array()
	uses.resize(secondary.size())
	for index in primary.size():
		var chosen := 0
		var nearest := INF
		for candidate in secondary.size():
			var distance := primary[index].distance_squared_to(secondary[candidate])
			if uses[candidate] < uses[chosen] or (uses[candidate] == uses[chosen] and distance < nearest):
				chosen = candidate
				nearest = distance
		uses[chosen] += 1
		var origin := primary[index] if more_sources else secondary[chosen]
		var target := secondary[chosen] if more_sources else primary[index]
		_flights.append(_make_flight(origin, target, index))


func _make_flight(origin: Vector3, target: Vector3, index: int) -> Flight:
	var flight := Flight.new()
	flight.size = clampf(_world_per_pixel(origin) * 33.0, 0.25, 0.96)
	var chord := target - origin
	var sideways := Vector3(-chord.z, 0.0, chord.x).normalized()
	if sideways.is_zero_approx():
		sideways = _view.basis.x
	var seed := _unit_seed(index, 3)
	var lift := clampf(_view.origin.y * 0.39, 0.64, 7.4)
	flight.from = origin - Vector3.UP * (flight.size * 0.73 + 0.03)
	flight.to = target + Vector3.UP * flight.size * 0.69
	flight.lift = origin + Vector3.UP * lift * 0.66
	if _air_show:
		flight.from = origin
		flight.lift = origin.lerp(target, 0.18) + Vector3.UP * (lift * 0.28 + 0.30)
	var midpoint := origin.lerp(target, 0.53)
	var toward_view := (_view.origin - midpoint)
	toward_view.y = 0.0
	flight.peak = midpoint + toward_view.limit_length(5.4) * (0.30 + seed * 0.15)
	flight.peak += Vector3.UP * lift * (0.85 + seed * 0.21)
	flight.peak += sideways * (seed - 0.5) * clampf(lift * 0.45, 0.24, 1.35)
	var across := chord * 0.18 + sideways * (0.48 + seed * 0.32)
	flight.before_peak = flight.peak - across
	flight.after_peak = flight.peak + across * 0.70
	flight.dive = flight.to + Vector3.UP * maxf(0.72, lift * 0.62)
	return flight


func _position_at(flight: Flight, seconds: float) -> Vector3:
	const TURN := 0.59
	var t := clampf(seconds / IMPACT_TIME, 0.0, 1.0)
	if t < TURN:
		return flight.from.bezier_interpolate(flight.lift, flight.before_peak, flight.peak, t / TURN)
	return flight.peak.bezier_interpolate(flight.after_peak, flight.dive, flight.to, (t - TURN) / (1.0 - TURN))


func _draw(camera: Camera3D) -> void:
	_cache_view(camera)
	_smoke_used = 0
	_fire_used = 0
	_streaks_used = 0
	_ground_used = 0
	_glints_used = 0
	_draw_trails(camera)
	if _elapsed < IMPACT_TIME:
		_draw_flight(camera)
		if not _air_show:
			_draw_launch_sites(camera)
	else:
		_hulls.visible_instance_count = 0
		_draw_impacts(camera, _elapsed - IMPACT_TIME)
	_smoke.visible_instance_count = _smoke_used
	_fire.visible_instance_count = _fire_used
	_streaks.visible_instance_count = _streaks_used
	_ground.visible_instance_count = _ground_used
	_glints.visible_instance_count = _glints_used


func _draw_flight(camera: Camera3D) -> void:
	var used := 0
	var progress := _elapsed / IMPACT_TIME
	for flight in _flights:
		var point := _position_at(flight, _elapsed)
		if not _on_screen(camera, point, 75.0):
			continue
		var earlier := _position_at(flight, maxf(0.0, _elapsed - 0.009))
		var ahead := _position_at(flight, _elapsed + 0.009)
		var direction := (ahead - earlier).normalized()
		var up := Vector3.UP if absf(direction.y) < 0.97 else Vector3.RIGHT
		var body := Basis.looking_at(direction, up, true)
		var size := minf(flight.size * (1.0 + 0.32 * sin(progress * PI)), _world_per_pixel(point) * 73.0)
		var roll := progress * 2.3
		body = body.rotated(direction, roll).scaled(Vector3.ONE * size)
		_put(_hulls, used, body, point, Color.WHITE)
		used += 1
		var nozzle := point - direction * (size * 0.61)
		if nozzle.y > GROUND_Y:
			var end := nozzle - direction * (0.65 + 0.11 * sin(_elapsed * 41.0)) * size
			end.y = maxf(end.y, GROUND_Y)
			_streak(nozzle, end, size * 0.27, Color(1.0, 0.55, 0.18, 0.91))
			_streak(nozzle, nozzle.lerp(end, 0.76), size * 0.14, Color(1.0, 0.94, 0.73, 0.99))
			_card(_glints, _glints_used, nozzle, Vector2.ONE * size * 0.39, 0.0, Color(1.0, 0.72, 0.38, 0.80))
			_glints_used += 1
	_hulls.visible_instance_count = used


func _draw_trails(camera: Camera3D) -> void:
	var last_sample := floori(minf(_elapsed, IMPACT_TIME) / TRAIL_STEP)
	for lane in _flights.size():
		var flight := _flights[lane]
		for sample in range(maxi(1, last_sample - TRAIL_SAMPLES + 1), last_sample + 1):
			var born := float(sample) * TRAIL_STEP
			var age := (_elapsed - born) / (TRAIL_STEP * TRAIL_SAMPLES)
			if age >= 1.0:
				continue
			var head := _position_at(flight, born)
			var previous := _position_at(flight, born - 0.017)
			var direction := (head - previous).normalized()
			var live_size := flight.size * (1.0 + 0.32 * sin(born / IMPACT_TIME * PI))
			var point := head - direction * live_size * 0.74
			if point.y < GROUND_Y + 0.04 or not _on_screen(camera, point, 65.0):
				continue
			var seed := _unit_seed(lane, sample)
			var size := minf(maxf(flight.size * (0.34 + age * 1.02) * (0.79 + seed * 0.42), 0.10),
				_world_per_pixel(point) * 32.0)
			var fade := 1.0 - smoothstep(0.33, 1.0, age)
			var curl := seed * TAU + age * 3.1
			point += Vector3(cos(curl) * 0.45, 0.31, sin(curl) * 0.45) * age * flight.size
			var color := Color(1.0, 0.93, 0.80, 0.96).lerp(Color(0.67, 0.73, 0.76, 0.55), smoothstep(0.06, 0.71, age))
			color.a *= fade
			_card(_smoke, _smoke_used, point, Vector2(size * (1.04 + seed * 0.34), size), curl, color)
			_smoke_used += 1
			# A short hot wake joins the youngest billows without a full-length tracer.
			if age < 0.15 and _elapsed < IMPACT_TIME:
				var next := _position_at(flight, minf(born + TRAIL_STEP, _elapsed))
				var light := 0.58 * (1.0 - age / 0.15)
				_streak(point, point + next - head, size * 0.64, Color(1.0, 0.73, 0.42, light))


func _draw_launch_sites(camera: Camera3D) -> void:
	if _elapsed >= 0.94:
		return
	var age := _elapsed / 0.94
	for index in _sources.size():
		var point := _sources[index]
		if not _on_screen(camera, point, 80.0):
			continue
		var radius := clampf(_world_per_pixel(point) * 37.0, 0.21, 0.90)
		_stamp(point, radius, age, 0.0, age)
		for lobe in 3:
			var theta := float(lobe) * TAU / 3.0 + _unit_seed(index, 31) * TAU
			var outward := Vector3(cos(theta), 0.0, sin(theta))
			var dust := point + outward * radius * (0.12 + age * 0.58) + Vector3.UP * radius * age * 0.35
			var size := radius * (0.35 + age * 0.50)
			_card(_smoke, _smoke_used, dust, Vector2(size * 1.3, size), theta,
				Color(0.81, 0.84, 0.79, 0.66 * (1.0 - age)))
			_smoke_used += 1


func _draw_impacts(camera: Camera3D, seconds: float) -> void:
	var cracks_used := 0
	var intensity := lerpf(1.18, 0.78, smoothstep(4.0, float(MAX_REGIONS), float(_targets.size())))
	for index in _targets.size():
		var point := _targets[index]
		if not _on_screen(camera, point, 145.0):
			continue
		var radius := clampf(_world_per_pixel(point) * 108.0 * intensity, 0.40, 2.18)
		var seed := _unit_seed(index, 22)
		var age := seconds / AFTERMATH_TIME
		_stamp(point, radius, minf(1.0, seconds / 0.63), 1.0, age)
		if not _air_show:
			_put(_cracks, cracks_used, Basis(Vector3.UP, seed * TAU).scaled(Vector3.ONE * radius),
				point + Vector3.UP * 0.007, Color.WHITE)
			_cracks.set_instance_custom_data(cracks_used, Color(age, clampf(0.20 + seconds * 3.5, 0.0, 1.12), 0.0))
			cracks_used += 1
		_draw_column(point, radius, seed, seconds)
		_draw_sparks(point, radius, index, seconds)
	_cracks.visible_instance_count = cracks_used
	if not _air_show:
		_apply_shake(camera, seconds)


func _draw_column(point: Vector3, radius: float, seed: float, seconds: float) -> void:
	var bloom := 1.0 - smoothstep(0.055, 0.38, seconds)
	if bloom > 0.0:
		var center := point + Vector3.UP * radius * 0.23
		_card(_glints, _glints_used, center, Vector2.ONE * radius * (1.28 + seconds * 1.7), 0.0,
			Color(1.0, 0.72, 0.35, bloom * 0.90))
		_glints_used += 1
	for lobe in PLUME_LOBES:
		var age := seconds - 0.034 * float(lobe)
		if age < 0.0:
			continue
		var layer := float(lobe) / (PLUME_LOBES - 1)
		var angle := seed * TAU + float(lobe) * 2.399
		var rise := (1.0 - exp(-age * 4.3)) * (0.26 + layer * 1.82)
		var swirl := (0.06 + layer * 0.19) * (0.5 + minf(age, 1.4))
		var radial := Vector3(cos(angle), 0.0, sin(angle))
		var center := point + radius * (radial * swirl + Vector3.UP * (0.10 + rise + age * 0.17))
		var spread := (0.76 + 0.27 * sin(layer * PI) - 0.18 * layer) * (0.65 + minf(age, 1.75) * 0.48)
		var size := radius * spread
		var soot := smoothstep(0.13, 0.72, age) * (1.0 - smoothstep(0.90, 2.62, age))
		if soot > 0.0:
			var smoke_color := Color(0.38, 0.30, 0.31).lerp(Color(0.49, 0.51, 0.55), minf(age * 0.6, 1.0))
			smoke_color.a = soot * (0.67 - 0.10 * layer)
			_card(_smoke, _smoke_used, center + radial * radius * (0.09 + age * 0.10),
				Vector2(size * 1.44, size * 1.32), angle + age * 0.44, smoke_color)
			_smoke_used += 1
		var flame := 1.0 - smoothstep(0.16, 0.82 - layer * 0.20, age)
		if flame > 0.0:
			var flicker := 0.95 + 0.05 * sin(age * 39.0 + angle)
			_card(_fire, _fire_used, center, Vector2(size * (1.18 + layer * 0.27), size * 1.65) * flicker,
				angle + age * 0.53, Color(1.03 - layer * 0.24 - age * 0.32, 1.0, 1.0, flame))
			_fire_used += 1


func _draw_sparks(point: Vector3, radius: float, index: int, seconds: float) -> void:
	for spark in SPARKS:
		var seed := _unit_seed(index, spark + 52)
		var age := seconds - 0.016 * float(spark)
		var life := 0.45 + seed * 0.52
		if age < 0.0 or age > life:
			continue
		var angle := float(spark) * TAU / SPARKS + seed
		var radial := Vector3(cos(angle), 0.0, sin(angle))
		var velocity := radial * (1.18 + seed) + Vector3.UP * (1.20 + seed * 2.4)
		var gravity := Vector3.DOWN * 2.9
		var head := point + radius * (velocity * age + gravity * age * age)
		if head.y <= GROUND_Y:
			continue
		var tail := head - radius * (velocity + gravity * (2.0 * age)) * (0.045 + seed * 0.047)
		tail.y = maxf(tail.y, GROUND_Y)
		var alpha := (1.0 - smoothstep(0.17, life, age)) * 0.94
		_streak(head, tail, radius * (0.034 + seed * 0.046), Color(1.0, 0.63 + seed * 0.28, 0.22, alpha))


func _apply_shake(camera: Camera3D, seconds: float) -> void:
	if _shaken_camera != camera or seconds >= SHAKE_TIME:
		_restore_shake()
	if seconds >= SHAKE_TIME:
		return
	if _shaken_camera == null:
		_shaken_camera = camera
		_saved_offset = Vector2(camera.h_offset, camera.v_offset)
	var decay := (1.0 - seconds / SHAKE_TIME) ** 2.3
	var magnitude := clampf(_view.origin.y * _pixel_ratio * 18.0, 0.014, 0.33) * decay
	magnitude *= 0.76 + 0.24 * smoothstep(1.0, 8.0, float(_targets.size()))
	camera.h_offset = _saved_offset.x + magnitude * (sin(seconds * 76.0) * 0.71 + cos(seconds * 39.0) * 0.29)
	camera.v_offset = _saved_offset.y + magnitude * cos(seconds * 64.0) * 0.66


func _restore_shake() -> void:
	if is_instance_valid(_shaken_camera):
		_shaken_camera.h_offset = _saved_offset.x
		_shaken_camera.v_offset = _saved_offset.y
	_shaken_camera = null


func _stamp(point: Vector3, radius: float, wave: float, blast: float, life: float) -> void:
	_put(_ground, _ground_used, Basis.IDENTITY.scaled(Vector3.ONE * radius), point, Color.WHITE)
	_ground.set_instance_custom_data(_ground_used, Color(wave, blast, life))
	_ground_used += 1


func _streak(head: Vector3, tail: Vector3, width: float, color: Color) -> void:
	var segment := head - tail
	var length := segment.length()
	if length < 0.008:
		return
	var y := segment / length
	var x := y.cross(_view.basis.z).normalized()
	if x.is_zero_approx():
		x = _view.basis.x
	_put(_streaks, _streaks_used, Basis(x * width, y * (length + width * 0.58), x.cross(y)),
		(head + tail) * 0.5, color)
	_streaks_used += 1


func _card(batch: MultiMesh, slot: int, point: Vector3, size: Vector2, angle: float, color: Color) -> void:
	var basis := (_view.basis * Basis(Vector3.BACK, angle)).scaled_local(Vector3(size.x, size.y, 1.0))
	_put(batch, slot, basis, point, color)


func _put(batch: MultiMesh, slot: int, basis: Basis, point: Vector3, color: Color) -> void:
	batch.set_instance_transform(slot, Transform3D(basis, point))
	batch.set_instance_color(slot, color)


func _unit_seed(a: int, b: int) -> float:
	return float(posmod(a * 133 + b * 71 + a * b * 29, 257)) / 256.0


func _build_batches() -> void:
	var puff := _puff_texture()
	var fire_material := _shader(FIRE_SHADER, 3)
	fire_material.set_shader_parameter("density", puff)
	var plane := PlaneMesh.new()
	plane.size = Vector2(2.0, 2.0)
	plane.material = _shader(GROUND_SHADER, 1)
	_hulls = _batch("RocketHulls", _rocket_mesh(), MAX_REGIONS)
	_ground = _batch("GroundPressure", plane, MAX_REGIONS, true)
	_cracks = _batch("Fissures", _crack_mesh(), MAX_REGIONS, true)
	_smoke = _batch("DriftingSmoke", _quad(_sprite(puff, 4, false)), MAX_REGIONS * (TRAIL_SAMPLES + PLUME_LOBES))
	_fire = _batch("FireColumns", _quad(fire_material), MAX_REGIONS * PLUME_LOBES)
	_streaks = _batch("ExhaustAndEmbers", _quad(_sprite(_light_texture(true), 5, true)),
		MAX_REGIONS * SPARKS)
	_glints = _batch("BlastGlints", _quad(_sprite(_light_texture(false), 6, true)), MAX_REGIONS)


func _batch(label: String, mesh: Mesh, capacity: int, custom := false) -> MultiMesh:
	var data := MultiMesh.new()
	data.transform_format = MultiMesh.TRANSFORM_3D
	data.use_colors = true
	data.use_custom_data = custom
	data.mesh = mesh
	data.instance_count = capacity
	data.visible_instance_count = 0
	var draw := MultiMeshInstance3D.new()
	draw.name = label
	draw.multimesh = data
	draw.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(draw)
	return data


func _shader(code: String, priority: int) -> ShaderMaterial:
	var result := ShaderMaterial.new()
	result.shader = Shader.new()
	result.shader.code = code
	result.render_priority = priority
	return result


func _sprite(texture: Texture2D, priority: int, additive: bool) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_texture = texture
	result.vertex_color_use_as_albedo = true
	result.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	result.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	result.cull_mode = BaseMaterial3D.CULL_DISABLED
	result.render_priority = priority
	if additive:
		result.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	return result


func _quad(material: Material) -> QuadMesh:
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	quad.material = material
	return quad


func _puff_texture() -> ImageTexture:
	const SIDE := 96
	var noise := FastNoiseLite.new()
	noise.seed = 921
	noise.frequency = 0.052
	var image := Image.create_empty(SIDE, SIDE, false, Image.FORMAT_RGBA8)
	for y in SIDE:
		for x in SIDE:
			var p := Vector2(x, y) / (SIDE - 1) * 2.0 - Vector2.ONE
			var warp := noise.get_noise_2d(x * 0.71 - 23.0, y * 0.71 + 17.0) * 13.0
			var curls := noise.get_noise_2d(x + warp, y - warp)
			var grit := noise.get_noise_2d(x * 2.65 + 53.0 + warp, y * 2.65 - warp)
			var billow := p.length() + curls * 0.38 + grit * 0.10
			var opacity := (1.0 - smoothstep(0.28, 0.88, billow)) * (1.0 - smoothstep(0.76, 1.0, p.length()))
			var shade := clampf(0.86 + curls * 0.39 + grit * 0.11 - p.y * 0.12, 0.0, 1.0)
			image.set_pixel(x, y, Color(shade, shade, shade, opacity))
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


func _light_texture(streak: bool) -> ImageTexture:
	const SIDE := 48
	var image := Image.create_empty(SIDE, SIDE, false, Image.FORMAT_RGBA8)
	for y in SIDE:
		for x in SIDE:
			var p := Vector2(x, y) / (SIDE - 1) * 2.0 - Vector2.ONE
			var outline := 1.0 - smoothstep(0.0, 1.0, p.length())
			if streak:
				var width := lerpf(1.0, 0.22, absf(p.y))
				outline = (1.0 - smoothstep(0.0, width, absf(p.x))) * (1.0 - smoothstep(0.16, 1.0, absf(p.y)))
			var falloff := pow(outline, 1.72)
			image.set_pixel(x, y, Color(1.0, 0.76 + outline * 0.24, 0.43 + outline * 0.57, falloff))
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


func _rocket_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_material(_shader(HULL_SHADER, 0))
	const SIDES := 16
	# Each ring is (axial position, radius). Thin bands are panel joins and stencils.
	var rings := [
		Vector2(-0.62, 0.074), Vector2(-0.55, 0.083), Vector2(-0.48, 0.104),
		Vector2(-0.36, 0.108), Vector2(-0.33, 0.108), Vector2(0.20, 0.108),
		Vector2(0.22, 0.108), Vector2(0.32, 0.102), Vector2(0.44, 0.084),
		Vector2(0.56, 0.051), Vector2(0.65, 0.017), Vector2(0.69, 0.001)]
	var paint := [
		Color("#252c30"), Color("#515a61"), Color("#656f74"), Color("#434b51"),
		Color("#7e8a8f"), Color("#908f7b"), Color("#69757c"), Color("#565f68"),
		Color("#555e65"), Color("#505b63"), Color("#48555c")]
	for index in rings.size() - 1:
		for side in SIDES:
			var angle := float(side) * TAU / SIDES
			var next := float(side + 1) * TAU / SIDES
			var a := Vector3(cos(angle), sin(angle), 0.0)
			var b := Vector3(cos(next), sin(next), 0.0)
			var low: Vector2 = rings[index]
			var high: Vector2 = rings[index + 1]
			var slope := (low.y - high.y) / (high.x - low.x)
			var normal_a := (a + Vector3.BACK * slope).normalized()
			var normal_b := (b + Vector3.BACK * slope).normalized()
			var color: Color = paint[index].darkened(0.045 * float(side % 3))
			_model_vertex(surface, a * low.y + Vector3.BACK * low.x, normal_a, color)
			_model_vertex(surface, a * high.y + Vector3.BACK * high.x, normal_a, color)
			_model_vertex(surface, b * high.y + Vector3.BACK * high.x, normal_b, color)
			_model_vertex(surface, a * low.y + Vector3.BACK * low.x, normal_a, color)
			_model_vertex(surface, b * high.y + Vector3.BACK * high.x, normal_b, color)
			_model_vertex(surface, b * low.y + Vector3.BACK * low.x, normal_b, color)
	for fin in 4:
		var rotation := Basis(Vector3.BACK, float(fin) * TAU / 4.0)
		var root := rotation * Vector3(0.093, 0.0, -0.23)
		var leading := rotation * Vector3(0.248, 0.0, -0.48)
		var trailing := rotation * Vector3(0.224, 0.0, -0.55)
		var base := rotation * Vector3(0.079, 0.0, -0.57)
		var ridge_a := rotation * Vector3(0.119, 0.016, -0.47)
		var ridge_b := rotation * Vector3(0.119, -0.016, -0.47)
		var rim := [root, leading, trailing, base]
		for edge in rim.size():
			var following: Vector3 = rim[(edge + 1) % rim.size()]
			var tint := Color("#545e65") if edge == 0 else Color("#3e484f")
			_flat_triangle(surface, rim[edge], following, ridge_a, tint)
			_flat_triangle(surface, following, rim[edge], ridge_b, tint)
	return surface.commit()


func _flat_triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, color: Color) -> void:
	var normal := (c - a).cross(b - a).normalized()
	for vertex in [a, b, c]:
		_model_vertex(surface, vertex, normal, color)


func _model_vertex(surface: SurfaceTool, vertex: Vector3, normal: Vector3, color: Color) -> void:
	surface.set_color(color)
	surface.set_normal(normal)
	surface.add_vertex(vertex)


func _crack_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_material(_shader(CRACK_SHADER, 2))
	for ray in 7:
		var angle := float(ray) * TAU / 7.0 + (_unit_seed(ray, 7) - 0.5) * 0.63
		var outward := Vector3(cos(angle), 0.0, sin(angle))
		var side := Vector3(-outward.z, 0.0, outward.x)
		var length := 0.49 + _unit_seed(ray, 4) * 0.42
		var from := outward * 0.055
		for joint in 5:
			var progress := float(joint + 1) / 5.0
			var to := outward * length * progress + side * (_unit_seed(ray, joint) - 0.5) * 0.19
			var width := lerpf(0.035, 0.006, progress)
			_fissure(surface, from, to, width, progress)
			if joint in [1, 2]:
				var fork := to + side * (0.09 + _unit_seed(ray, joint + 12) * 0.16) * (1.0 if joint == 1 else -1.0)
				_fissure(surface, to, fork + outward * 0.13, width * 0.65, progress + 0.13)
			from = to
	return surface.commit()


func _fissure(surface: SurfaceTool, from: Vector3, to: Vector3, width: float, progress: float) -> void:
	var segment := to - from
	var edge := segment.cross(Vector3.UP).normalized() * width * 0.5
	var vertices := [from - edge, from + edge, to + edge * 0.50, to - edge * 0.50]
	var start := maxf(0.0, progress - 0.20)
	var uv := [Vector2(start, 0.0), Vector2(start, 1.0), Vector2(progress, 1.0), Vector2(progress, 0.0)]
	for index in [0, 1, 2, 0, 2, 3]:
		surface.set_uv(uv[index])
		surface.add_vertex(vertices[index])
