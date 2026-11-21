extends Node3D
## Bounded presentation only: one shared draw, no gameplay/ownership writes.

const MAX_PUFFS := 48
const LIFETIME := 2.6
const ASSAULT_PULSE := 1.84
var board: Control
var particles: Array[Dictionary] = []
var batch := MultiMeshInstance3D.new()
var flashes: MultiMeshInstance3D
var clock := 0.0
var emission_left := 0.0
var serial := 0

func configure(canvas: Control, texture: Texture2D, flash_mesh: QuadMesh = null) -> void:
	board = canvas
	name = "BattleSmoke"
	var material := StandardMaterial3D.new()
	material.albedo_texture = texture
	material.vertex_color_use_as_albedo = true
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	material.no_depth_test = false
	var puff := QuadMesh.new()
	puff.size = Vector2(0.32, 0.48)
	puff.material = material
	var shared := MultiMesh.new()
	shared.transform_format = MultiMesh.TRANSFORM_3D
	shared.use_colors = true
	shared.mesh = puff
	shared.instance_count = MAX_PUFFS
	shared.visible_instance_count = 0
	batch.multimesh = shared
	batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(batch)
	if flash_mesh != null:
		var burst: QuadMesh = flash_mesh.duplicate()
		burst.material = flash_mesh.material.duplicate()
		burst.material.vertex_color_use_as_albedo = true
		var flash_instances := MultiMesh.new()
		flash_instances.transform_format = MultiMesh.TRANSFORM_3D
		flash_instances.use_colors = true
		flash_instances.mesh = burst
		flash_instances.instance_count = MAX_PUFFS
		flash_instances.visible_instance_count = 0
		flashes = MultiMeshInstance3D.new()
		flashes.multimesh = flash_instances
		flashes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(flashes)
	set_process(false)

func clear() -> void:
	particles.clear()
	emission_left = 0.0
	batch.multimesh.visible_instance_count = 0
	if flashes != null:
		flashes.multimesh.visible_instance_count = 0

func step(fronts: Array, delta: float) -> void:
	clock += delta
	var regional := _draw_assaults(fronts)
	var available := MAX_PUFFS - regional
	for index in range(particles.size() - 1, -1, -1):
		particles[index].age += delta
		if float(particles[index].age) >= LIFETIME:
			particles.remove_at(index)
	emission_left -= delta
	if emission_left <= 0.0:
		emission_left = 0.42
		for front: Dictionary in fronts:
			if not front.get("primary", true):
				continue
			var points: Array = front.get("points", [])
			if float(front.get("travel", 0.0)) < 1.0 or points.is_empty():
				continue
			for lane in 2:
				if particles.size() >= available:
					break
				var point: Vector2 = points[posmod(serial * 7 + lane * (points.size() / 2), points.size())]
				var bearing: Vector2 = front.get("direction", Vector2.RIGHT)
				var damaged := point + bearing * (8.0 + float(serial % 4) * 3.0)
				if not _inside(damaged, front.get("regions", [])):
					damaged = point
				if not _inside(damaged, front.get("regions", [])):
					continue
				serial += 1
				var seed := float(posmod(serial * 37, 101)) / 101.0
				var origin: Vector3 = board.world_point(damaged) + Vector3(0, 0.08, 0)
				particles.append({"origin": origin, "age": 0.0, "seed": seed,
					"drift": Vector3((seed - 0.5) * 0.12, 0.22 + seed * 0.08, 0.045)})
	var shared: MultiMesh = batch.multimesh
	var count := mini(available, particles.size())
	shared.visible_instance_count = regional + count
	for index in count:
		var p: Dictionary = particles[index]
		var age: float = p.age
		var scale := 0.45 + age * 0.36
		var position: Vector3 = p.origin + p.drift * age
		position.x += sin(age * 1.4 + p.seed * TAU) * 0.025
		var transform := Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * scale), position)
		shared.set_instance_transform(index + regional, transform)
		var opacity := smoothstep(0.0, 0.24, age) * (1.0 - smoothstep(LIFETIME - 0.85, LIFETIME, age))
		shared.set_instance_color(index + regional, Color(0.82, 0.78, 0.73, opacity * 0.78))

func _draw_assaults(fronts: Array) -> int:
	var smoke_count := 0
	var flash_count := 0
	for front: Dictionary in fronts:
		var assault: Dictionary = front.get("assault", {})
		if assault.is_empty() or assault.points.is_empty():
			continue
		if front.get("primary", true) and assault.region in front.get("formation_regions", []):
			continue
		if smoke_count >= MAX_PUFFS:
			break
		var key := str(front.id).hash()
		var timing := clock / ASSAULT_PULSE + float(posmod(key, 997)) / 997.0
		var phase := fposmod(timing, 1.0)
		var points: Array = assault.points
		var point: Vector2 = points[posmod(key + floori(timing) * 7, points.size())]
		var origin: Vector3 = board.world_point(point)
		var puff := origin + Vector3((phase - 0.25) * 0.20, 0.12 + phase * 0.63, -0.12 * phase)
		var opacity := smoothstep(0.0, 0.14, phase) * (1.0 - smoothstep(0.65, 1.0, phase))
		var smoke_scale := lerpf(0.85, 1.55, phase)
		batch.multimesh.set_instance_transform(smoke_count, Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * smoke_scale), puff))
		batch.multimesh.set_instance_color(smoke_count, Color(0.47, 0.43, 0.37, opacity * 0.88))
		smoke_count += 1
		if flashes != null and phase < 0.21:
			var rise := phase / 0.21
			var scale := lerpf(0.85, 2.25, rise)
			var at := origin + Vector3.UP * (0.12 + rise * 0.21)
			flashes.multimesh.set_instance_transform(flash_count, Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * scale), at))
			flashes.multimesh.set_instance_color(flash_count, Color(1.0, 0.82, 0.60, 1.0 - rise))
			flash_count += 1
	if flashes != null:
		flashes.multimesh.visible_instance_count = flash_count
	return smoke_count

func _inside(point: Vector2, region_ids: Array) -> bool:
	for id in region_ids:
		if int(id) >= 0 and int(id) < board.regions.size() and Geometry2D.is_point_in_polygon(point, board.regions[int(id)].polygon):
			return true
	return false
