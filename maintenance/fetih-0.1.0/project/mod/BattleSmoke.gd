extends Node3D
## Bounded presentation only: one shared draw, no gameplay/ownership writes.

const MAX_PUFFS := 48
const LIFETIME := 2.6
var board: Control
var particles: Array[Dictionary] = []
var batch := MultiMeshInstance3D.new()
var clock := 0.0
var emission_left := 0.0
var serial := 0

func configure(canvas: Control, texture: Texture2D) -> void:
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
	set_process(false)

func clear() -> void:
	particles.clear()
	emission_left = 0.0
	batch.multimesh.visible_instance_count = 0

func step(fronts: Array, delta: float) -> void:
	clock += delta
	for index in range(particles.size() - 1, -1, -1):
		particles[index].age += delta
		if float(particles[index].age) >= LIFETIME:
			particles.remove_at(index)
	emission_left -= delta
	if emission_left <= 0.0:
		emission_left = 0.42
		for front: Dictionary in fronts:
			var points: Array = front.get("points", [])
			if float(front.get("travel", 0.0)) < 1.0 or points.is_empty():
				continue
			for lane in 2:
				if particles.size() >= MAX_PUFFS:
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
	shared.visible_instance_count = particles.size()
	for index in particles.size():
		var p: Dictionary = particles[index]
		var age: float = p.age
		var scale := 0.45 + age * 0.36
		var position: Vector3 = p.origin + p.drift * age
		position.x += sin(age * 1.4 + p.seed * TAU) * 0.025
		var transform := Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * scale), position)
		shared.set_instance_transform(index, transform)
		var opacity := smoothstep(0.0, 0.24, age) * (1.0 - smoothstep(LIFETIME - 0.85, LIFETIME, age))
		shared.set_instance_color(index, Color(0.82, 0.78, 0.73, opacity * 0.78))

func _inside(point: Vector2, region_ids: Array) -> bool:
	for id in region_ids:
		if int(id) >= 0 and int(id) < board.regions.size() and Geometry2D.is_point_in_polygon(point, board.regions[int(id)].polygon):
			return true
	return false
