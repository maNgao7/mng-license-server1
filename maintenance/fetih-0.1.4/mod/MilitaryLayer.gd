extends Node3D

signal tank_fired(position: Vector3)
signal jet_passed(position: Vector3)
signal jet_audio_reset

const KINDS := [&"Tank", &"Helicopter", &"Soldier", &"Factory", &"Jet"]
# One combined budget for garrisons, fronts and arriving reinforcements.
const PLAYER_LIMITS := {&"Tank": 10, &"Helicopter": 8, &"Soldier": 18, &"Factory": 1, &"Jet": 4}
const TOTAL_LIMITS := {&"Tank": 24, &"Helicopter": 24, &"Soldier": 42, &"Factory": 12, &"Jet": 12}
const SOLDIERS_PER_MODEL := 200
const INFANTRY_DENSITY_THRESHOLD := 600
const INFANTRY_RESERVE_HALF_DENSITY := 3400.0
const INFANTRY_RESERVES_PER_OWNER := 84
const INFANTRY_RESERVE_LIMIT := 180
const INFANTRY_POST_SPACING := Vector2(14.0, 12.0)
const INFANTRY_POST_RADIUS := 5.5
const REINFORCEMENT_LIMITS := {&"Tank": 4, &"Helicopter": 5}
const ARRIVAL_LIMIT := 24
const SYNC_INTERVAL := 0.15
const PATROL_INLINE_EDGES := 24
const PATROL_WORKERS := 2
const PATROL_SPEED_SCALE := 0.75
const TANK_DUST_LIMIT := 192
const TANK_DUST_DURATION := 1.2
const TANK_DUST_INTERVAL := 0.18
const CASUALTY_LIMIT := 24
# Reserve enough defeat slots for the combat models visible across the whole map.
const DEFEAT_LIMIT := TOTAL_LIMITS[&"Tank"] + TOTAL_LIMITS[&"Soldier"] + TOTAL_LIMITS[&"Helicopter"] + TOTAL_LIMITS[&"Jet"]
const CASUALTY_DURATION := 2.30
const TRAIL_PUFFS := 5
const BOMB_LIMIT := 6
const BOMB_CLOUD_PUFFS := 13
const BOMB_CLOUD_DURATION := 2.15
const BOMB_CLOUD_SCALE := 1.32
const SORTIE_SPEED := 1.95

class PatrolPath:
	var points := PackedVector3Array()
	var distances := PackedFloat64Array([0.0])
	var length := 0.0

	func sample(distance: float) -> Vector3:
		if length <= 0.001:
			return points[0]
		var along := fposmod(distance, length)
		var next := clampi(distances.bsearch(along), 1, points.size() - 1)
		var start := distances[next - 1]
		return points[next - 1].lerp(points[next], (along - start) / (distances[next] - start))

class PatrolRouteJob:
	const TURN_CLEARANCE := 3.0

	var task_id := -1
	var corners := PackedVector2Array()

	func build(polygon: PackedVector2Array, bounds: Rect2, seed: int, center: Vector2) -> void:
		corners = interior_route(polygon, bounds, seed, center)

	static func interior_route(polygon: PackedVector2Array, bounds: Rect2, seed: int, center: Vector2) -> PackedVector2Array:
		var rng := RandomNumberGenerator.new()
		rng.seed = seed
		var grid := AStar2D.new()
		var columns := clampi(ceili(bounds.size.x / 24.0), 3, 10)
		var rows := clampi(ceili(bounds.size.y / 24.0), 3, 10)
		var offset := Vector2(rng.randf_range(0.30, 0.64), rng.randf_range(0.30, 0.64))
		# A sparse interior grid allows open stretches to cross the territory.
		# Concave areas use connected grid segments to get around cuts and bays.
		for y in rows:
			for x in columns:
				var point := bounds.position + bounds.size * Vector2((x + offset.x) / columns, (y + offset.y) / rows)
				if not Geometry2D.is_point_in_polygon(point, polygon):
					continue
				var id := y * columns + x
				grid.add_point(id, point)
				for step in [Vector2i.LEFT, Vector2i.UP, Vector2i(-1, -1), Vector2i(1, -1)]:
					var neighbor: Vector2i = Vector2i(x, y) + step
					var other := neighbor.y * columns + neighbor.x
					if neighbor.x >= 0 and neighbor.x < columns and grid.has_point(other) \
							and chord_inside(point, grid.get_point_position(other), polygon, TURN_CLEARANCE):
						grid.connect_points(id, other)
		if grid.get_point_count() == 0:
			return local_orbit(polygon, center, rng.randf_range(0.0, TAU))
		var start := grid.get_closest_point(center)
		var connected := {start: true}
		var component := PackedInt64Array([start])
		var next := 0
		while next < component.size():
			for neighbor in grid.get_point_connections(component[next]):
				if not connected.has(neighbor):
					component.append(neighbor)
					connected[neighbor] = true
			next += 1
		var goals := PackedInt64Array()
		var angle := rng.randf_range(-0.12, 0.12)
		var reach := rng.randf_range(0.34, 0.39)
		for quadrant in 4:
			var direction := Vector2.from_angle(angle + PI * (0.25 + float(quadrant) * 0.5))
			var goal := bounds.get_center() + direction * bounds.size * reach
			var nearest := INF
			var choice := start
			for id in component:
				var distance := grid.get_point_position(id).distance_squared_to(goal)
				if distance < nearest:
					nearest = distance
					choice = id
			if choice not in goals:
				goals.append(choice)
		if goals.size() < 2:
			return local_orbit(polygon, grid.get_point_position(start), angle)
		if rng.randf() > 0.5:
			goals.reverse()
		var points := PackedVector2Array()
		for index in goals.size():
			var leg := grid.get_point_path(goals[index], goals[(index + 1) % goals.size()])
			var vertex := 0
			while vertex < leg.size() - 1:
				points.append(leg[vertex])
				# Prefer a straight chord across open land over a chain of grid steps.
				var ahead := leg.size() - 1
				while ahead > vertex + 1 and not chord_inside(leg[vertex], leg[ahead], polygon, TURN_CLEARANCE):
					ahead -= 1
				vertex = ahead
		for _pass in 2:
			points = round_corners(points, polygon)
		return points

	static func local_orbit(polygon: PackedVector2Array, center: Vector2, angle: float) -> PackedVector2Array:
		var radius := 14.0
		var previous := polygon[-1]
		for point in polygon:
			radius = minf(radius, 0.65 * center.distance_to(Geometry2D.get_closest_point_to_segment(center, previous, point)))
			previous = point
		var corners := PackedVector2Array()
		for index in 8:
			corners.append(center + Vector2.from_angle(angle + float(index) * TAU / 8.0) * radius)
		return corners

	static func round_corners(points: PackedVector2Array, polygon: PackedVector2Array) -> PackedVector2Array:
		var rounded := PackedVector2Array()
		for index in points.size():
			var corner := points[index]
			var previous := points[(index + points.size() - 1) % points.size()]
			var following := points[(index + 1) % points.size()]
			var incoming := previous - corner
			var outgoing := following - corner
			# Keep the reach of a leg that doubles back through a narrow passage.
			var limit := 4.0 if incoming.normalized().dot(outgoing.normalized()) > 0.65 else 24.0
			var trim := minf(limit, minf(incoming.length(), outgoing.length()) * 0.30)
			var enter := corner.move_toward(previous, trim)
			var exit := corner.move_toward(following, trim)
			if trim > 0.05 and chord_inside(enter, exit, polygon, TURN_CLEARANCE):
				rounded.append(enter)
				rounded.append(exit)
			else:
				rounded.append(corner)
		return rounded

	static func chord_inside(a: Vector2, b: Vector2, polygon: PackedVector2Array, margin := 0.0) -> bool:
		if not Geometry2D.is_point_in_polygon(a.lerp(b, 0.5), polygon):
			return false
		var previous := polygon[-1]
		var near_segment := Rect2(a, Vector2.ZERO).expand(b).grow(margin)
		for vertex in polygon:
			if Geometry2D.segment_intersects_segment(a, b, previous, vertex) != null:
				return false
			# Leave room for a frame step to span two adjacent segments at a turn.
			if margin > 0.0 and near_segment.has_point(vertex) \
					and vertex.distance_squared_to(Geometry2D.get_closest_point_to_segment(vertex, a, b)) < margin * margin:
				return false
			previous = vertex
		return true

var map_canvas: Control
var battle_formations: Dictionary = {}
var clock := 0.0
var _battle_clock := 0.0
var _sync_left := 0.0
var _front_ids: Dictionary = {}
var _models: Dictionary = {}
var _pool: Dictionary = {}
var _active: Dictionary = {}
var _home_layouts: Dictionary = {}
var _infantry_reserves: MultiMesh
var _infantry_reserve_state: Array = []
var _infantry_orders: Array[Dictionary] = []
var _infantry_timing := {}
var _infantry_flashes: MultiMesh
var _infantry_tracers: MultiMesh
var _infantry_muzzle: Vector3
var _patrol_jobs: Dictionary = {}
var _owned_previous: Dictionary = {}
var _arrivals: Dictionary = {}
var _land_routes: Dictionary = {}
var _headquarters: Dictionary = {}
var _headquarters_model: Node3D
var _headquarters_feedback: Dictionary = {}
var _flash_mesh: QuadMesh
var _tracer_mesh: BoxMesh
var _missile_mesh: CylinderMesh
var _missile_trail: BoxMesh
var _smoke_mesh: QuadMesh
var _dying: Array[Dictionary] = []
var _defeat_count := 0
var _defeat_regions: Dictionary = {}
var _bombs: Array[Dictionary] = []
var _effect_smoke: MultiMesh
var _puff_count := 0
var _tank_dust: Array[Dictionary] = []
var _tank_dust_mesh: MultiMesh
var _tank_dust_next := 0
var _combat_strength: Dictionary = {}
var battle_smoke: Node3D


func configure(canvas: Control) -> void:
	map_canvas = canvas
	var library: Script = load(get_script().resource_path.get_base_dir().path_join("CombatModels.gd"))
	for kind in [&"Tank", &"Helicopter", &"Soldier", &"Jet"]:
		_models[kind] = library.create(kind)
	_configure_infantry_reserves()
	_models[&"Factory"] = _miniature(true)
	_headquarters_model = library.create(&"Headquarters")
	_make_fire_meshes()
	_infantry_flashes = _make_infantry_effect_batch(_flash_mesh, "InfantryFlashes")
	_infantry_tracers = _make_infantry_effect_batch(_tracer_mesh, "InfantryTracers")
	_infantry_muzzle = _models[&"Soldier"].get_meta("muzzle")
	_missile_mesh = CylinderMesh.new()
	_missile_mesh.top_radius = 0.009
	_missile_mesh.bottom_radius = 0.016
	_missile_mesh.height = 0.16
	_missile_mesh.radial_segments = 8
	var missile_material := StandardMaterial3D.new()
	missile_material.albedo_color = Color("#ddd9c7")
	missile_material.metallic = 0.25
	_missile_mesh.material = missile_material
	_missile_trail = BoxMesh.new()
	_missile_trail.size = Vector3(0.027, 0.027, 0.13)
	var flame := StandardMaterial3D.new()
	flame.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flame.albedo_color = Color("#ffb25b")
	_missile_trail.material = flame
	_smoke_mesh = QuadMesh.new()
	_smoke_mesh.size = Vector2(0.48, 0.58)
	var smoke_image := Image.create(48, 48, false, Image.FORMAT_RGBA8)
	var combat_smoke_image := Image.create(48, 48, false, Image.FORMAT_RGBA8)
	for y in 48:
		for x in 48:
			var p := Vector2((x + 0.5) / 24.0 - 1.0, (y + 0.5) / 24.0 - 1.0)
			var swirl := 0.88 + 0.10 * sin(p.x * 12.0 + p.y * 6.0) * cos(p.y * 9.0)
			var distance := p.length() / swirl
			var opacity := pow(clampf(1.0 - distance, 0.0, 1.0), 1.12) * 0.82
			smoke_image.set_pixel(x, y, Color(0.32, 0.30, 0.27, opacity))
			var edge := (1.0 - smoothstep(0.24, 0.98, distance)) * 0.88
			var shade := lerpf(0.77, 1.0, 1.0 - smoothstep(-0.40, 0.88, p.y))
			combat_smoke_image.set_pixel(x, y, Color(shade, shade, shade, edge))
	var smoke := StandardMaterial3D.new()
	smoke.albedo_texture = ImageTexture.create_from_image(smoke_image)
	smoke.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	smoke.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	smoke.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	smoke.billboard_keep_scale = true
	_smoke_mesh.material = smoke
	battle_smoke = load(get_script().resource_path.get_base_dir().path_join("BattleSmoke.gd")).new()
	add_child(battle_smoke)
	battle_smoke.configure(canvas, smoke.albedo_texture, _flash_mesh)
	_configure_combat_effects(ImageTexture.create_from_image(combat_smoke_image))
	_sync_left = 0.0
	set_process(true)


func _load_vehicle(kind: StringName, folder: String, width: float, tip: Vector3) -> void:
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_file(folder.path_join(str(kind) + ".glb"), state)
	if error != OK:
		push_error("MILITARY_MODEL_LOAD: %s (%d)" % [kind, error])
		return
	var scene: Node3D = document.generate_scene(state)
	if scene == null:
		push_error("MILITARY_MODEL_SCENE: " + str(kind))
		return
	var bounds := _bounds(scene, Transform3D.IDENTITY)
	var extent := maxf(bounds.size.x, bounds.size.z)
	if extent <= 0.0:
		scene.free()
		push_error("MILITARY_MODEL_BOUNDS: " + str(kind))
		return
	var model_scale := width / extent
	var pivot := Vector3(bounds.get_center().x, bounds.position.y, bounds.get_center().z)
	var prototype := Node3D.new()
	prototype.add_child(scene)
	scene.scale *= model_scale
	scene.position -= pivot * model_scale
	# The measured barrel face and nose in the authored GLBs both face +Z.
	prototype.set_meta("muzzle", (tip - pivot) * model_scale)
	prototype.set_meta("model_center", (bounds.get_center() - pivot) * model_scale)
	_models[kind] = prototype


func _bounds(node: Node3D, parent_transform: Transform3D) -> AABB:
	var combined := parent_transform * node.transform
	var result := AABB()
	if node is MeshInstance3D and node.mesh != null:
		result = combined * node.get_aabb()
	for child in node.get_children():
		if child is Node3D:
			var child_bounds := _bounds(child, combined)
			if child_bounds.has_volume():
				result = result.merge(child_bounds) if result.has_volume() else child_bounds
	return result


func _process(delta: float) -> void:
	if not is_instance_valid(map_canvas) or get_tree().paused or map_canvas.app.is_paused():
		return
	clock += delta
	var speed := 1.0
	if map_canvas.app.has_method("battle_speed_multiplier"):
		speed = clampf(float(map_canvas.app.battle_speed_multiplier()), 1.0, 3.0)
	var battle_delta := delta * speed
	_battle_clock += battle_delta
	_sync_left -= delta
	_collect_patrol_routes()
	var fronts: Array = map_canvas.battle_fronts()
	if _sync_left <= 0.0 or _fronts_changed(fronts):
		_sync_left = SYNC_INTERVAL
		_sync_units()
	_update_infantry_timing(fronts)
	for key in _active:
		var entry: Dictionary = _active[key]
		_update_unit(entry, delta, battle_delta)
	_update_infantry_reserves()
	_update_tank_dust()
	_puff_count = 0
	_update_casualties(battle_delta)
	_update_defeat_regions()
	_update_bombs()
	_effect_smoke.visible_instance_count = _puff_count
	_update_headquarters_feedback()
	var visual_fronts: Array = map_canvas.visual_battle_fronts() if map_canvas.has_method("visual_battle_fronts") else fronts
	battle_smoke.step(visual_fronts, battle_delta)


func _fronts_changed(fronts: Array) -> bool:
	if fronts.size() != _front_ids.size():
		return true
	for front in fronts:
		if not _front_ids.has(front.get("id", "")):
			return true
	return false


func _sync_units() -> void:
	var regions_by_owner := {}
	var ready_headquarters := {}
	var has_headquarters: bool = map_canvas.app.has_method("region_headquarters")
	for region in map_canvas.regions:
		var owner: String = map_canvas.app.region_owner(region.id)
		if not owner.is_empty():
			if not regions_by_owner.has(owner):
				regions_by_owner[owner] = []
			regions_by_owner[owner].append(region)
			if has_headquarters and not map_canvas.app.region_headquarters(region.id).is_empty():
				ready_headquarters[region.id] = region.center
	_sync_headquarters(ready_headquarters)
	if regions_by_owner.is_empty() and not _owned_previous.is_empty():
		clear_reinforcements()
	for previous in _owned_previous:
		if not regions_by_owner.has(previous):
			_arrivals.erase(previous)
		if regions_by_owner.get(previous, []) != _owned_previous[previous]:
			_land_routes.erase(previous)
	_owned_previous = regions_by_owner
	if regions_by_owner.is_empty():
		battle_smoke.clear()
	_trim_arrivals()

	var owners: Array = regions_by_owner.keys()
	owners.sort()
	var plans := {}
	var fronts: Array = map_canvas.battle_fronts()
	_front_ids.clear()
	_combat_strength.clear()
	var fronts_by_owner := {}
	for front in fronts:
		_front_ids[front.get("id", "")] = true
		for owner in front.get("strength", {}):
			_combat_strength[owner] = {"total": front.strength[owner], "remaining": front.remaining[owner]}
			fronts_by_owner[owner] = front
	# Active combat always gets its first model of each kind before garrisons.
	owners.sort_custom(func(a: String, b: String) -> bool:
		var a_fights := _combat_strength.has(a)
		var b_fights := _combat_strength.has(b)
		return a_fights if a_fights != b_fights else a < b)
	battle_formations.clear()
	var reserve_counts := {}
	for owner in owners:
		var plan := {}
		for kind in KINDS:
			plan[kind] = []
		var regions: Array = regions_by_owner[owner]
		var front: Dictionary = fronts_by_owner.get(owner, {})
		var counts := _unit_budget(owner)
		if counts.reserves > 0:
			reserve_counts[owner] = counts.reserves
		var distant: bool = front.get("airborne", false)
		_plan_home(regions, counts, plan, distant)
		if not front.is_empty():
			_plan_deployment(owner, regions, front, counts, plan)
		plans[owner] = plan
	_apply_plan(owners, plans)
	for id in _infantry_timing.keys():
		if not _front_ids.has(id):
			_infantry_timing.erase(id)
	_update_infantry_timing(fronts)
	_sync_infantry_reserves(reserve_counts, regions_by_owner, fronts_by_owner)


func _unit_budget(owner: String) -> Dictionary:
	var source: Dictionary
	if map_canvas.app.has_method("unit_counts"):
		source = map_canvas.app.unit_counts(owner)
	else:
		# Transitional compatibility with restored rounds and older preview fixtures.
		var legacy: Dictionary = map_canvas.app.player_view(owner)
		var troops := maxi(0, int(legacy.get("troops", 0)))
		source = {"tanks": int(troops > 0), "soldiers": troops}
	var result := {}
	var fields := ["tanks", "helicopters", "soldiers", "factories", "jets"]
	var strength: Dictionary = _combat_strength.get(owner, {})
	var projected := {}
	if not strength.is_empty() and map_canvas.app.has_method("combat_unit_counts"):
		projected = map_canvas.app.combat_unit_counts(owner)
	for index in KINDS.size():
		var kind: StringName = KINDS[index]
		var field: String = fields[index]
		var amount := maxi(0, int(source.get(field, 0)))
		var alive := amount
		if kind != &"Factory" and not strength.is_empty():
			var total := float(strength.total)
			var ratio := clampf(float(strength.remaining) / total, 0.0, 1.0) if total > 0.0 else 1.0
			var fallback := amount if ratio >= 1.0 else roundi(float(amount) * ratio)
			alive = clampi(int(projected.get(field, fallback)), 0, amount)
		var limit: int = PLAYER_LIMITS[kind]
		if kind == &"Soldier":
			var visible_count := ceili(float(alive) / SOLDIERS_PER_MODEL)
			if not strength.is_empty() and amount > 0:
				var initial := clampi(ceili(float(amount) / SOLDIERS_PER_MODEL), mini(amount, 6), limit)
				visible_count = maxi(ceili(float(initial) * float(alive) / float(amount)), mini(alive, 3))
			result[kind] = mini(visible_count, limit)
			# Diminishing density lets very large armies read apart from medium ones.
			var excess := float(maxi(0, alive - INFANTRY_DENSITY_THRESHOLD))
			result.reserves = ceili(INFANTRY_RESERVES_PER_OWNER * excess / (excess + INFANTRY_RESERVE_HALF_DENSITY))
		elif kind != &"Factory" and amount > 0:
			var visible_count := ceili(float(mini(amount, limit)) * float(alive) / float(amount))
			# Keep a final ground model until the round resolves. Aircraft can all be lost in flight.
			result[kind] = maxi(1, visible_count) if kind == &"Tank" and not strength.is_empty() else visible_count
		else:
			result[kind] = mini(amount, limit)
	return result


func _configure_infantry_reserves() -> void:
	var infantry: MeshInstance3D = _models[&"Soldier"].get_node("Infantry")
	_infantry_reserves = MultiMesh.new()
	_infantry_reserves.transform_format = MultiMesh.TRANSFORM_3D
	_infantry_reserves.use_colors = true
	_infantry_reserves.mesh = infantry.mesh
	_infantry_reserves.instance_count = INFANTRY_RESERVE_LIMIT
	_infantry_reserves.visible_instance_count = 0
	var batch := MultiMeshInstance3D.new()
	batch.name = "InfantryReserves"
	batch.multimesh = _infantry_reserves
	batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(batch)


func _make_infantry_effect_batch(mesh: Mesh, label: String) -> MultiMesh:
	var instances := MultiMesh.new()
	instances.transform_format = MultiMesh.TRANSFORM_3D
	instances.mesh = mesh
	instances.instance_count = INFANTRY_RESERVE_LIMIT
	instances.visible_instance_count = 0
	var batch := MultiMeshInstance3D.new()
	batch.name = label
	batch.multimesh = instances
	batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(batch)
	return instances


func _clear_infantry_reserves() -> void:
	_infantry_reserves.visible_instance_count = 0
	_infantry_flashes.visible_instance_count = 0
	_infantry_tracers.visible_instance_count = 0
	_infantry_orders.clear()
	_infantry_reserve_state.clear()


func _sync_infantry_reserves(requested: Dictionary, holdings: Dictionary, fronts: Dictionary) -> void:
	if requested.is_empty():
		_clear_infantry_reserves()
		return
	var occupied := {}
	var origin: Vector3 = map_canvas.world_point(Vector2.ZERO)
	var axes: Vector3 = map_canvas.world_point(Vector2.ONE) - origin
	for entry: Dictionary in _active.values():
		if entry.kind not in [&"Soldier", &"Tank", &"Factory"]:
			continue
		var spot: Vector3 = entry.pose.target - origin
		var point := Vector2(spot.x / axes.x, spot.z / axes.z)
		var radius := 17.0 if entry.kind == &"Tank" else 20.0
		occupied[point] = INFANTRY_POST_RADIUS if entry.kind == &"Soldier" else radius
	for region_id: int in _headquarters:
		occupied[map_canvas.regions[region_id].center] = 34.0 * _headquarters[region_id].scale.x

	var orders := {}
	for owner: String in requested:
		var front: Dictionary = fronts.get(owner, {})
		var attacking: bool = owner == front.get("attacker", "")
		var source_key := "from_region" if front.get("airborne", false) else "contact_from"
		var anchor: int = front.get(source_key if attacking else "to_region", -1)
		var enemy: int = front.get("to_region" if attacking else source_key, -1)
		var opponent: Vector2 = _home_points(map_canvas.regions[enemy]).patrol_center if enemy >= 0 else Vector2.INF
		var color: Color = map_canvas.app.player_color(owner)
		orders[owner] = {"regions": holdings[owner], "opponent": opponent, "anchor": anchor,
			"battle": front.get("id", ""), "color": color}
	var state := [requested, orders, occupied]
	if state == _infantry_reserve_state:
		return
	_infantry_reserve_state = state
	_infantry_orders.clear()
	_infantry_flashes.visible_instance_count = 0
	_infantry_tracers.visible_instance_count = 0

	var formations := {}
	for owner: String in orders:
		var order: Dictionary = orders[owner]
		var opponent: Vector2 = order.opponent
		var posts: Array[Dictionary] = []
		for region: Dictionary in order.regions:
			var layout := _home_points(region)
			var center: Vector2 = layout.patrol_center
			var bounds: Rect2 = region.bounds
			var rally := center
			if opponent.is_finite():
				rally = center.move_toward(opponent, minf(bounds.size.x, bounds.size.y) * 0.40)
			var nearby := {}
			var vicinity := bounds.grow(42.0)
			for point: Vector2 in occupied:
				if vicinity.has_point(point):
					nearby[point] = occupied[point]
			var candidates: Array[Vector2] = []
			for point: Vector2 in _infantry_posts(region, layout):
				if _home_slot_clear(point, INFANTRY_POST_RADIUS, nearby):
					candidates.append(point)
			if candidates.is_empty():
				continue
			candidates.sort_custom(func(a: Vector2, b: Vector2) -> bool:
				return a.distance_squared_to(rally) < b.distance_squared_to(rally))
			var formation := {"points": candidates, "center": center, "region": region, "index": 0}
			if region.id == order.anchor:
				posts.push_front(formation)
			else:
				posts.append(formation)
		if not posts.is_empty():
			formations[owner] = {"posts": posts, "opponent": opponent, "battle": order.battle, "placed": 0,
				"color": Color.WHITE.lerp(order.color, 0.52).darkened(0.13)}

	# Share the global pool in proportion to each army's request. Rotate through
	# its holdings so every region gets a post before any region gets a second.
	var drawn := 0
	while drawn < INFANTRY_RESERVE_LIMIT and not formations.is_empty():
		var lowest := INF
		var selected := ""
		for owner: String in formations:
			var load := float(formations[owner].placed) / float(requested[owner])
			if load < lowest:
				lowest = load
				selected = owner
		var army: Dictionary = formations[selected]
		var posts: Array[Dictionary] = army.posts
		var post: Dictionary = posts.pop_front()
		var point: Vector2 = post.points[post.index]
		var opponent: Vector2 = army.opponent
		var seed := float(posmod(hash(point), 1009)) / 1009.0
		var transform: Transform3D
		if opponent.is_finite():
			var order := _infantry_order(post.region, point, opponent, army.battle)
			order.instance = drawn
			order.seed = seed
			_infantry_orders.append(order)
			transform = _infantry_advance(order, seed)
		else:
			var facing := _world_direction(post.center.direction_to(point))
			var watch := float(posmod(hash(point), 17) - 8) * 0.028
			transform = Transform3D(Basis(Vector3.UP, atan2(facing.x, facing.z) + watch), _ground(point))
		_infantry_reserves.set_instance_transform(drawn, transform)
		_infantry_reserves.set_instance_color(drawn, army.color)
		drawn += 1
		army.placed += 1
		post.index += 1
		if post.index < post.points.size():
			posts.append(post)
		if posts.is_empty() or army.placed == requested[selected]:
			formations.erase(selected)
	_infantry_reserves.visible_instance_count = drawn


func _update_infantry_timing(fronts: Array) -> void:
	for front: Dictionary in fronts:
		var timing: Dictionary = _infantry_timing.get_or_add(front.id, {"engaged_at": INF})
		var travel := clampf(float(front.get("travel", 1.0)), 0.0, 1.0)
		timing.travel = travel
		timing.engaged_at = minf(timing.engaged_at, _battle_clock) if travel >= 1.0 else INF


func _infantry_advance(order: Dictionary, seed: float) -> Transform3D:
	var start: Vector3 = order.launch
	var post: Vector3 = order.target
	var aim: Vector3 = order.facing
	var travel: float = _infantry_timing[order.battle].travel
	var angle := _battle_clock * (10.0 + seed * 2.0) + seed * TAU
	var stride := 1.0
	var progress := smoothstep(seed * 0.13, 0.86 + seed * 0.14, travel)
	if travel >= 1.0:
		# Short staggered steps around the firing post stay on the deployment lane.
		progress = 1.0 - (0.04 + seed * 0.04) * (0.5 - 0.5 * cos(angle * 0.24))
		stride = 0.28
	var at := start.lerp(post, progress)
	at.y += (1.0 - cos(angle * 2.0)) * 0.006 * stride
	var pitch := (0.10 + 0.035 * cos(angle)) * stride
	var roll := sin(angle) * 0.09 * stride
	var basis := Basis.from_euler(Vector3(pitch, atan2(aim.x, aim.z), roll))
	return Transform3D(basis, at)


func _update_infantry_reserves() -> void:
	if _infantry_orders.is_empty():
		return
	var flashes := 0
	var tracers := 0
	for order: Dictionary in _infantry_orders:
		var seed: float = order.seed
		var at := _infantry_advance(order, seed)
		_infantry_reserves.set_instance_transform(order.instance, at)
		var age := _battle_clock - float(_infantry_timing[order.battle].engaged_at) - (0.13 + seed * 1.65)
		if age < 0.0:
			continue
		var pulse := fposmod(age, 1.42 + seed * 0.74)
		var muzzle := at * _infantry_muzzle
		if pulse < 0.105:
			var size := lerpf(0.94, 0.42, pulse / 0.105)
			_infantry_flashes.set_instance_transform(flashes, Transform3D(Basis.from_scale(Vector3.ONE * size), muzzle))
			flashes += 1
		if pulse >= 0.025 and pulse < 0.15:
			var tracer := Vector3(0.0, 0.0, 0.10 + pulse * 1.8)
			var basis := at.basis.scaled_local(Vector3(0.72, 0.72, lerpf(0.88, 0.32, pulse / 0.15)))
			_infantry_tracers.set_instance_transform(tracers, Transform3D(basis, muzzle + at.basis * tracer))
			tracers += 1
	_infantry_flashes.visible_instance_count = flashes
	_infantry_tracers.visible_instance_count = tracers


func _infantry_posts(region: Dictionary, layout: Dictionary) -> PackedVector2Array:
	if layout.has("infantry_posts"):
		return layout.infantry_posts
	var posts := PackedVector2Array()
	var bounds: Rect2 = region.bounds
	var polygon: PackedVector2Array = region.polygon
	var size := INFANTRY_POST_SPACING
	var first := Vector2i((bounds.position / size).floor())
	var last := Vector2i((bounds.end / size).ceil())
	# One staggered lattice across the map keeps formations separated at borders.
	for row in range(first.y, last.y):
		for column in range(first.x, last.x):
			var point := Vector2(column + float(posmod(row, 2)) * 0.5, row) * size
			if not Geometry2D.is_point_in_polygon(point, polygon):
				continue
			var clear := true
			for index in polygon.size():
				var edge := Geometry2D.get_closest_point_to_segment(point, polygon[index], polygon[(index + 1) % polygon.size()])
				if point.distance_squared_to(edge) < INFANTRY_POST_RADIUS * INFANTRY_POST_RADIUS:
					clear = false
					break
			if clear:
				posts.append(point)
	layout.infantry_posts = posts
	return posts


func _plan_deployment(owner: String, regions: Array, front: Dictionary, counts: Dictionary, plan: Dictionary) -> void:
	var attacking: bool = owner == front.attacker
	var distant: bool = front.get("airborne", false)
	var id: String = front.id
	var destination: Vector2 = front.destination
	var source_region: int = front.from_region if distant else front.contact_from
	var strike_region: int = front.to_region if attacking else source_region
	var anchor: int = source_region if attacking else front.to_region
	if not _has_region(regions, anchor):
		anchor = regions[0].id
	var opponent: Vector2 = map_canvas.regions[strike_region].center
	var bearing: Vector2 = front.direction if owner == front.winner else -front.direction
	var points := PackedVector2Array()
	var front_points: Variant = front.get("formation_points", front.get("points", []))
	if front_points.is_empty():
		front_points = front.get("rally_points", [])
	for point in front_points:
		if point is Vector2 and point.is_finite() and (points.is_empty() or points[-1].distance_to(point) >= 16.0):
			points.append(point)
	if points.is_empty():
		points.append(destination if distant else _approach_point(front, destination))
	var ordered: Array[Vector2] = []
	ordered.assign(points)
	var side := bearing.orthogonal()
	ordered.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.dot(side) < b.dot(side))
	var allowed: Array[int] = []
	for region in regions:
		allowed.append(region.id)
	if owner == front.winner:
		for region_id in front.get("formation_regions", front.get("regions", [])):
			if region_id not in allowed:
				allowed.append(region_id)
	var deployment := {"anchor": anchor, "routes": {} if distant else _routes_to(owner, anchor, regions),
		"airborne": distant, "air_target": int(front.to_region) if attacking and distant else -1,
		"points": PackedVector2Array(ordered), "bearing": bearing, "travel": clampf(float(front.get("travel", 1.0)), 0.0, 1.0),
		"allowed": allowed, "taken": {}, "air_taken": {}, "winning": owner == front.winner,
		"front_direction": front.direction, "threshold": float(front.get("formation_threshold", INF)),
		"strike_region": strike_region, "strike_regions": front.get("target_regions", []) if attacking else []}
	if distant:
		_plan_distant_ground(id, deployment, opponent, counts, plan)
	else:
		_plan_land_infantry(id, opponent, plan)
	for kind in [&"Tank", &"Helicopter", &"Jet"]:
		if distant and kind == &"Tank":
			continue
		var choices: Array = plan[kind]
		var ranks := {}
		for index in choices.size():
			var home: Dictionary = choices[index]
			var region_id: int = home.region
			var rank: int = ranks.get(region_id, 0)
			choices[index] = _deployment_order(kind, id, deployment, home, rank, index, choices.size())
			ranks[region_id] = rank + 1


func _plan_land_infantry(id: String, opponent: Vector2, plan: Dictionary) -> void:
	var taken := {}
	var origin: Vector3 = map_canvas.world_point(Vector2.ZERO)
	var axes: Vector3 = map_canvas.world_point(Vector2.ONE) - origin
	for kind in [&"Factory", &"Tank", &"Soldier"]:
		for pose: Dictionary in plan[kind]:
			var at: Vector3 = pose.target - origin
			taken[Vector2(at.x / axes.x, at.z / axes.z)] = INFANTRY_POST_RADIUS if kind == &"Soldier" else 19.0
	for region_id: int in _headquarters:
		taken[map_canvas.regions[region_id].center] = 34.0 * _headquarters[region_id].scale.x
	var choices: Array = plan[&"Soldier"]
	for index in choices.size():
		var home: Dictionary = choices[index]
		var region: Dictionary = map_canvas.regions[home.region]
		var at: Vector3 = home.target - origin
		var start := Vector2(at.x / axes.x, at.z / axes.z)
		var direction := start.direction_to(opponent)
		var post := start
		for angle in [0.0, -0.28, 0.28, -0.57, 0.57]:
			var end := _infantry_lane(region.polygon, start, direction.rotated(angle), 68.0)
			for fraction in [1.0, 0.75, 0.5, 0.25]:
				var candidate := start.lerp(end, fraction)
				if candidate.distance_squared_to(start) >= 64.0 and _home_slot_clear(candidate, INFANTRY_POST_RADIUS, taken):
					post = candidate
					break
			if post != start:
				break
		taken.erase(start)
		taken[post] = INFANTRY_POST_RADIUS
		var pose := _infantry_order(region, post, opponent, id, start if post != start else Vector2.INF)
		pose.merge({"mode": &"land_support", "airborne": false, "scale": home.scale, "impact": _ground(opponent)})
		choices[index] = pose


func _infantry_order(region: Dictionary, post: Vector2, opponent: Vector2, battle: String,
		start := Vector2.INF) -> Dictionary:
	var aim := post.direction_to(opponent)
	if not start.is_finite():
		var reach := 44.0 + float(posmod(hash(post), 17))
		start = _infantry_lane(region.polygon, post, -aim, reach)
		if start.distance_squared_to(post) < 64.0:
			for angle in [-0.45, 0.45, -0.90, 0.90]:
				var candidate := _infantry_lane(region.polygon, post, -aim.rotated(angle), reach)
				if candidate.distance_squared_to(post) > start.distance_squared_to(post):
					start = candidate
	return {"battle": battle, "region": region.id, "launch": _ground(start), "target": _ground(post),
		"facing": _world_direction(aim)}


func _infantry_lane(polygon: PackedVector2Array, start: Vector2, direction: Vector2, reach: float) -> Vector2:
	# Clip at the first boundary, including bays and concave coastlines.
	var end := start + direction * reach
	var allowed := reach
	var previous := polygon[-1]
	for point in polygon:
		var hit: Variant = Geometry2D.segment_intersects_segment(start, end, previous, point)
		if hit is Vector2:
			allowed = minf(allowed, maxf(0.0, start.distance_to(hit) - INFANTRY_POST_RADIUS))
		previous = point
	return start + direction * allowed


func _plan_distant_ground(id: String, deployment: Dictionary, opponent: Vector2, counts: Dictionary, plan: Dictionary) -> void:
	var region: Dictionary = map_canvas.regions[deployment.anchor]
	var layout := _home_points(region)
	var center: Vector2 = layout.patrol_center
	var bearing := center.direction_to(opponent)
	var side := bearing.orthogonal()
	var bounds: Rect2 = region.bounds
	var reach := minf(75.0, minf(bounds.size.x, bounds.size.y) * 0.23)
	var rally := center.move_toward(opponent, reach)
	var taken := {}
	if _headquarters.has(region.id):
		var headquarters: Node3D = _headquarters[region.id]
		taken[region.center] = 34.0 * headquarters.scale.x
	# Keep low ranks close together so the surviving line stays readable.
	for index in maxi(counts[&"Tank"], counts[&"Soldier"]):
		for kind in [&"Tank", &"Soldier"]:
			if index >= int(counts[kind]):
				continue
			var tank: bool = kind == &"Tank"
			var radius := 17.0 if tank else 7.0
			var width := 5 if tank else 7
			var row := index / width
			var column := index % width
			var lane := float((column + 1) / 2) * (-1.0 if column % 2 == 0 else 1.0)
			var desired := rally + side * (lane * (38.0 if tank else 17.0))
			desired -= bearing * ((0.0 if tank else 29.0) + float(row) * (44.0 if tank else 17.0))
			var point := _distant_ground_slot(region.polygon, layout.interior, desired, radius, taken)
			if not point.is_finite():
				continue
			taken[point] = radius
			var at := _ground(point)
			var impact := _regional_strike(deployment, index)
			var pose := {"mode": &"distant_support", "battle": id, "airborne": true, "region": region.id,
				"target": at, "facing": (impact - at).normalized(), "impact": impact,
				"engage": deployment.travel >= 1.0, "scale": 1.0}
			if not tank:
				pose.merge(_infantry_order(region, point, opponent, id))
			plan[kind].append(pose)


func _distant_ground_slot(polygon: PackedVector2Array, interior: PackedVector2Array, desired: Vector2,
		radius: float, taken: Dictionary) -> Vector2:
	if _home_slot_clear(desired, radius, taken) and _edge_clearance(desired, polygon) >= radius * 0.014:
		return desired
	var closest := Vector2.INF
	var nearest := INF
	for point in interior:
		var distance := point.distance_squared_to(desired)
		if distance < nearest and _home_slot_clear(point, radius, taken):
			closest = point
			nearest = distance
	return closest


func _has_region(regions: Array, id: int) -> bool:
	for region in regions:
		if region.id == id:
			return true
	return false


func _approach_point(front: Dictionary, destination: Vector2) -> Vector2:
	var contact: int = front.get("contact_from", front.get("from_region", -1))
	var target: int = front.get("to_region", -1)
	if contact < 0 or contact >= map_canvas.regions.size() or target < 0 or target >= map_canvas.regions.size():
		return destination
	var source: Vector2 = map_canvas.regions[contact].center
	var polygon: PackedVector2Array = map_canvas.regions[target].polygon
	var border := destination
	var nearest := source.distance_squared_to(destination)
	for index in polygon.size():
		var hit: Variant = Geometry2D.segment_intersects_segment(source, destination, polygon[index], polygon[(index + 1) % polygon.size()])
		if hit is Vector2 and source.distance_squared_to(hit) < nearest:
			border = hit
			nearest = source.distance_squared_to(hit)
	return border


func _routes_to(owner: String, anchor: int, regions: Array) -> Dictionary:
	if not _land_routes.has(owner):
		_land_routes[owner] = {}
	var cached: Dictionary = _land_routes[owner]
	if cached.has(anchor):
		return cached[anchor]
	# One reverse search supplies the next friendly region for every column.
	var owned := {}
	for region in regions:
		owned[region.id] = true
	var queue := [anchor]
	var routes := {anchor: -1}
	var index := 0
	while index < queue.size():
		var current: int = queue[index]
		index += 1
		for adjacent in map_canvas.neighbors.get(current, []):
			if owned.has(adjacent) and not routes.has(adjacent):
				routes[adjacent] = current
				queue.append(adjacent)
	cached[anchor] = routes
	return routes


func _deployment_order(kind: StringName, id: String, deployment: Dictionary, home: Dictionary,
		rank: int, index: int, count: int) -> Dictionary:
	var bearing: Vector2 = deployment.bearing
	var direction := _world_direction(bearing)
	var points: PackedVector2Array = deployment.points
	if kind == &"Jet":
		var strike := _regional_strike(deployment, index)
		return {"mode": &"sortie", "battle": id, "airborne": deployment.airborne, "home": home,
			"region": home.region, "target": strike, "facing": direction, "impact": strike,
			"travel": deployment.travel, "rank": index, "scale": home.scale}
	var routes: Dictionary = deployment.routes
	if kind == &"Tank":
		var support := home.duplicate()
		var nearest := INF
		for point in points:
			var impact := _ground(point)
			var distance: float = impact.distance_squared_to(home.target)
			if distance < nearest:
				nearest = distance
				support.impact = impact
		if not routes.has(home.region):
			support.impact = _sortie_impact(deployment, index)
		support.mode = &"land_support"
		support.battle = id
		support.airborne = false
		support.engage = deployment.travel >= 1.0
		return support

	var side := bearing.orthogonal()
	var span := absf((points[-1] - points[0]).dot(side))
	var helicopter := kind == &"Helicopter"
	var row_size := count if helicopter else mini(count, 8)
	var row := index / row_size
	var column := index % row_size
	var members := mini(row_size, count - row * row_size)
	var spacing := 54.0 if helicopter else 16.5
	var sample := mini(points.size() - 1, floori((float(column) + 0.5) * points.size() / members))
	var offset := 72.0 if helicopter else 9.0 + float(row) * 17.0
	var contact := points[sample] - bearing * offset
	if span < spacing * float(members - 1):
		contact += side * (float(column) + 0.5 - float(members) * 0.5) * (spacing - span / maxf(1.0, float(members - 1)))
	var assigned := _combat_position(deployment, contact, 22.0 if kind == &"Helicopter" else 8.0, kind == &"Helicopter")
	contact = assigned.point
	var region: int = home.region
	var waypoints := PackedVector3Array()
	var reaches_contact: bool = assigned.placed and (kind == &"Helicopter" or routes.has(region))
	if kind != &"Helicopter":
		if routes.has(region):
			var next: int = routes[region]
			while next >= 0:
				waypoints.append(_ground(_home_points(map_canvas.regions[next]).patrol_center))
				next = routes[next]
	var impact := _ground(points[sample])
	if helicopter or not reaches_contact:
		impact = _sortie_impact(deployment, index)
	if not reaches_contact:
		var staging_region: int = deployment.anchor if helicopter or routes.has(region) else region
		var layout := _home_points(map_canvas.regions[staging_region])
		var sentries: PackedVector2Array = layout.sentries
		contact = layout.patrol_center if sentries.is_empty() else sentries[(index + rank) % sentries.size()]
	if helicopter or not reaches_contact:
		var aim := (impact - _ground(contact)).normalized()
		if not aim.is_zero_approx():
			direction = aim
	return {"mode": &"deploy", "battle": id, "airborne": deployment.airborne, "home": home, "region": region,
		"target": _ground(contact), "impact": impact, "facing": direction,
		"waypoints": waypoints,
		"travel": deployment.travel, "index": index, "engage": true, "scale": home.scale}

func _regional_strike(deployment: Dictionary, rank: int) -> Vector3:
	var regions: Array = deployment.strike_regions
	if regions.size() <= 1:
		return _sortie_impact(deployment, rank)
	return _strike_point(regions[rank % regions.size()], deployment.bearing, rank / regions.size())


func _sortie_impact(deployment: Dictionary, rank: int) -> Vector3:
	return _strike_point(deployment.strike_region, deployment.bearing, rank)


func _strike_point(region_id: int, bearing: Vector2, rank: int) -> Vector3:
	var region: Dictionary = map_canvas.regions[region_id]
	var base: Vector2 = _home_points(region).patrol_center
	var side := bearing.orthogonal()
	var lane := float((rank + 1) / 2) * (-1.0 if rank % 2 == 0 else 1.0)
	var desired := base + side * lane * 27.0
	# A narrow territory can shorten the lane without putting the impact outside it.
	for _attempt in 4:
		if Geometry2D.is_point_in_polygon(desired, region.polygon):
			return _ground(desired)
		desired = desired.lerp(base, 0.5)
	return _ground(base)


func _combat_position(deployment: Dictionary, desired: Vector2, radius: float, aircraft := false) -> Dictionary:
	var best := Vector2.INF
	var distance := INF
	# Aircraft hover above the line and do not consume infantry positions.
	var taken: Dictionary = deployment.air_taken if aircraft else deployment.taken
	var allowed: Array = deployment.allowed
	var air_assault: bool = aircraft and int(deployment.get("air_target", -1)) >= 0
	if air_assault:
		# A crowded landing zone must never choose a free slot back at home.
		allowed = [int(deployment.air_target)]
		radius = 10.0
	for region_id in allowed:
		var region: Dictionary = map_canvas.regions[region_id]
		var candidates := PackedVector2Array([desired])
		var side: Vector2 = deployment.bearing.orthogonal()
		for offset in [-1.0, 1.0, -2.0, 2.0]:
			candidates.append(desired + side * radius * offset)
		candidates.append_array(_home_points(region).interior)
		for point in candidates:
			var d := desired.distance_squared_to(point)
			if d >= distance or not Geometry2D.is_point_in_polygon(point, region.polygon):
				continue
			if deployment.travel >= 1.0 and is_finite(deployment.threshold):
				var projection: float = point.dot(deployment.front_direction) - deployment.threshold
				if (deployment.winning and projection > -3.0) or (not deployment.winning and projection < 3.0):
					continue
			if not _home_slot_clear(point, radius, taken):
				continue
			best = point
			distance = d
	if best.is_finite():
		taken[best] = radius
	elif air_assault:
		var landing: PackedVector2Array = _home_points(map_canvas.regions[int(deployment.air_target)]).interior
		if not landing.is_empty():
			best = landing[taken.size() % landing.size()]
			taken[best] = radius
	return {"point": best if best.is_finite() else desired, "placed": best.is_finite()}


func _plan_home(regions: Array, counts: Dictionary, plans: Dictionary, distant: bool) -> void:
	var used := {}
	var layouts: Array[Dictionary] = []
	for region in regions:
		layouts.append(_home_points(region))
		if _headquarters.has(region.id):
			var headquarters: Node3D = _headquarters[region.id]
			used[region.center] = 34.0 * headquarters.scale.x
	# Keep the center clear and distribute sentries before filling extra slots.
	for kind in [&"Factory", &"Tank"]:
		var remaining: int = 0 if distant and kind == &"Tank" else counts[kind]
		var radius := 20.0 if kind == &"Factory" else 17.0
		for step in 24:
			if remaining == 0:
				break
			for layout in layouts:
				var points: PackedVector2Array = layout.sentries if kind == &"Tank" else layout.interior
				if step >= points.size() or not _home_slot_clear(points[step], radius, used):
					continue
				var point := points[step]
				var outward: Vector2 = point - layout.center
				var facing := _world_direction(outward) if not outward.is_zero_approx() else Vector3.BACK
				var pose := {"mode": &"home", "region": layout.id,
					"target": _ground(point), "facing": facing, "scale": 1.0}
				if kind == &"Tank":
					var end := _tank_patrol_end(layout, point)
					pose.patrol_end = _ground(end)
					pose.tank_path = _tank_patrol_path(layout, point, end)
					if not point.is_equal_approx(end):
						pose.facing = _world_direction(point - end)
				plans[kind].append(pose)
				used[point] = radius
				remaining -= 1
				if remaining == 0:
					break

	var infantry: int = 0 if distant else counts[&"Soldier"]
	var groups := {}
	for _pass in infantry:
		if infantry == 0:
			break
		var placed := false
		for index in layouts.size():
			var layout: Dictionary = layouts[index]
			var group: Dictionary = groups.get(index, {})
			var points: PackedVector2Array = layout.sentries
			var point := Vector2.INF
			if not group.is_empty() and int(group.size_now) < 3:
				var anchor: Vector2 = group.anchor
				var nearest := 35.0 * 35.0
				var interior: PackedVector2Array = layout.interior
				for candidate in interior:
					var distance := candidate.distance_squared_to(anchor)
					if distance < nearest and _home_slot_clear(candidate, 5.5, used):
						point = candidate
						nearest = distance
			if not point.is_finite():
				for candidate in points:
					if _home_slot_clear(candidate, 5.5, used):
						point = candidate
						group = {"anchor": point, "size_now": 0}
						break
			if not point.is_finite():
				continue
			var outward: Vector2 = group.anchor - layout.center
			var bearing := _world_direction(outward) if not outward.is_zero_approx() else Vector3.BACK
			var facing := bearing.rotated(Vector3.UP, (float(group.size_now) - 1.0) * 0.22)
			plans[&"Soldier"].append({"mode": &"home", "region": layout.id,
				"target": _ground(point), "facing": facing, "scale": 1.0})
			used[point] = 5.5
			group.size_now += 1
			groups[index] = group
			placed = true
			infantry -= 1
			if infantry == 0:
				break
		if not placed:
			break

	var patrol_regions: Array[int] = []
	var tank_regions := {}
	for index in plans[&"Tank"].size():
		tank_regions[plans[&"Tank"][index].region] = true
	# Cover otherwise unrepresented holdings before adding more air patrols to a region.
	for index in layouts.size():
		if not layouts[index].interior.is_empty() and not tank_regions.has(layouts[index].id):
			patrol_regions.append(index)
	for index in layouts.size():
		if not layouts[index].interior.is_empty() and tank_regions.has(layouts[index].id):
			patrol_regions.append(index)
	if patrol_regions.is_empty():
		return
	for index in int(counts[&"Helicopter"]):
		var region_index := patrol_regions[index % patrol_regions.size()]
		var layout: Dictionary = layouts[region_index]
		var lane := floori(float(index) / patrol_regions.size())
		plans[&"Helicopter"].append({"mode": &"patrol", "region": layout.id, "target": _ground(layout.patrol_center),
			"path": _patrol_path(layout, lane, false),
			"height": 0.67 + float(lane % 3) * 0.22 + float(int(layout.id) % 3) * 0.08,
			"phase": fposmod(float(layout.id) * 1.618 + float(lane) * 2.399963, TAU), "scale": 0.88})
	for index in int(counts[&"Jet"]):
		var layout: Dictionary = layouts[patrol_regions[index % patrol_regions.size()]]
		var rank := floori(float(index) / patrol_regions.size())
		plans[&"Jet"].append({"mode": &"jet_patrol", "region": layout.id,
			"path": _patrol_path(layout, rank, true),
			"height": 0.96 + rank * 0.13, "phase": fposmod(float(layout.id) * 1.618, TAU) - rank * 1.06,
			"scale": 0.62})


func _home_slot_clear(point: Vector2, radius: float, used: Dictionary) -> bool:
	for occupied in used:
		var other: Vector2 = occupied
		var spacing := radius + float(used[other])
		if point.distance_squared_to(other) < spacing * spacing:
			return false
	return true


func _home_points(region: Dictionary) -> Dictionary:
	var id: int = region.id
	if _home_layouts.has(id):
		return _home_layouts[id]
	var polygon: PackedVector2Array = region.polygon
	var bounds: Rect2 = region.bounds
	var center: Vector2 = region.center
	var candidates: Array[Vector2] = []
	var clearance := {}
	var step := clampf(minf(bounds.size.x, bounds.size.y) / 5.0, 13.5, 30.0)
	var columns := mini(12, maxi(1, floori(bounds.size.x / step)))
	var rows := mini(12, maxi(1, floori(bounds.size.y / step)))
	for y in rows:
		for x in columns:
			var point := bounds.position + bounds.size * Vector2((x + 0.5) / columns, (y + 0.5) / rows)
			if point.distance_squared_to(center) < 12.0 * 12.0 or not Geometry2D.is_point_in_polygon(point, polygon):
				continue
			var edge_distance := INF
			for edge in polygon.size():
				var closest := Geometry2D.get_closest_point_to_segment(point, polygon[edge], polygon[(edge + 1) % polygon.size()])
				edge_distance = minf(edge_distance, point.distance_squared_to(closest))
			if edge_distance >= 6.0 * 6.0:
				candidates.append(point)
				clearance[point] = absf(sqrt(edge_distance) - 18.0)
	candidates.sort_custom(func(a: Vector2, b: Vector2) -> bool:
		return a.distance_squared_to(center) < b.distance_squared_to(center))
	if candidates.is_empty():
		var triangles := Geometry2D.triangulate_polygon(polygon)
		var best_area := 0.0
		var best := center
		for offset in range(0, triangles.size(), 3):
			var a := polygon[triangles[offset]]
			var b := polygon[triangles[offset + 1]]
			var c := polygon[triangles[offset + 2]]
			var area := absf((b - a).cross(c - a))
			if area > best_area:
				best_area = area
				best = (a + b + c) / 3.0
		if best_area > 0.0 or Geometry2D.is_point_in_polygon(center, polygon):
			candidates.append(best)
			clearance[best] = 0.0
	var interior := PackedVector2Array(candidates)
	candidates.sort_custom(func(a: Vector2, b: Vector2) -> bool:
		if is_equal_approx(clearance[a], clearance[b]):
			return a.distance_squared_to(center) > b.distance_squared_to(center)
		return float(clearance[a]) < float(clearance[b]))
	var patrol_center := center
	if not interior.is_empty() and not Geometry2D.is_point_in_polygon(center, polygon):
		patrol_center = interior[0]
	var result := {"id": id, "interior": interior, "sentries": PackedVector2Array(candidates),
		"center": center, "patrol_center": patrol_center,
		"patrol_paths": {}, "tank_ends": {}, "tank_paths": {}}
	_home_layouts[id] = result
	return result


func _tank_patrol_end(layout: Dictionary, start: Vector2) -> Vector2:
	var cached: Dictionary = layout.tank_ends
	if cached.has(start):
		return cached[start]
	var polygon: PackedVector2Array = map_canvas.regions[layout.id].polygon
	var center: Vector2 = layout.patrol_center
	var end := start.move_toward(center, 24.0)
	# Test the entire tread path. An inward step can still cut across a bay.
	for _attempt in 4:
		if PatrolRouteJob.chord_inside(start, end, polygon):
			cached[start] = end
			return end
		end = start.lerp(end, 0.5)
	cached[start] = start
	return start


func _tank_patrol_path(layout: Dictionary, start: Vector2, end: Vector2) -> PatrolPath:
	var cached: Dictionary = layout.tank_paths
	if cached.has(start):
		return cached[start]
	var polygon: PackedVector2Array = map_canvas.regions[layout.id].polygon
	var side := (end - start).orthogonal().normalized() * minf(6.0, start.distance_to(end) * 0.25)
	var corners := PackedVector2Array([start, end])
	# A compact rounded loop avoids repeatedly reversing down the same tread line.
	# Validate every chord, including the closing one, around concave borders.
	for _attempt in 4:
		var loop := PackedVector2Array()
		for index in 16:
			var angle := float(index) * TAU / 16.0
			loop.append(start.lerp(end, 0.5 - 0.5 * cos(angle)) + side * sin(angle))
		var safe := true
		for index in loop.size():
			safe = safe and PatrolRouteJob.chord_inside(loop[index], loop[(index + 1) % loop.size()], polygon)
		if safe:
			corners = loop
			break
		side *= 0.5
	cached[start] = _route_from_corners(corners)
	return cached[start]


func _patrol_path(layout: Dictionary, lane: int, jet: bool) -> PatrolPath:
	var key := lane + (PLAYER_LIMITS[&"Helicopter"] if jet else 0)
	var cached: Dictionary = layout.patrol_paths
	if cached.has(key):
		return cached[key]
	var id: int = layout.id
	var region: Dictionary = map_canvas.regions[id]
	var polygon: PackedVector2Array = region.polygon
	var bounds: Rect2 = region.bounds
	var seed := id * 131 + key * 79
	var center: Vector2 = layout.patrol_center
	if polygon.size() <= PATROL_INLINE_EDGES:
		var corners := PatrolRouteJob.interior_route(polygon, bounds, seed, center)
		cached[key] = _route_from_corners(corners)
		return cached[key]
	var route_id := Vector2i(id, key)
	if _patrol_jobs.size() < PATROL_WORKERS and not _patrol_jobs.has(route_id):
		var job := PatrolRouteJob.new()
		job.task_id = WorkerThreadPool.add_task(job.build.bind(polygon, bounds, seed, center), false, "Aircraft patrol")
		_patrol_jobs[route_id] = job
	# Aircraft can deploy immediately while the interior path is being calculated.
	if not layout.has("patrol_fallback"):
		layout.patrol_fallback = _route_from_corners(PackedVector2Array([center]))
	return layout.patrol_fallback


func _collect_patrol_routes() -> void:
	for route_id: Vector2i in _patrol_jobs.keys():
		var job: PatrolRouteJob = _patrol_jobs[route_id]
		if not WorkerThreadPool.is_task_completed(job.task_id):
			continue
		WorkerThreadPool.wait_for_task_completion(job.task_id)
		_home_layouts[route_id.x].patrol_paths[route_id.y] = _route_from_corners(job.corners)
		_patrol_jobs.erase(route_id)
		_sync_left = 0.0


func _route_from_corners(corners: PackedVector2Array) -> PatrolPath:
	var path := PatrolPath.new()
	path.points.append(_ground(corners[0]))
	for step in range(1, corners.size() + 1):
		var point := _ground(corners[step % corners.size()])
		var segment := point.distance_to(path.points[-1])
		if segment > 0.00001:
			path.length += segment
			path.points.append(point)
			path.distances.append(path.length)
	return path


func _edge_clearance(point: Vector2, polygon: PackedVector2Array) -> float:
	if polygon.size() < 3 or not Geometry2D.is_point_in_polygon(point, polygon):
		return 0.0
	var nearest := INF
	var center := _ground(point)
	for index in polygon.size():
		var a := _ground(polygon[index])
		var b := _ground(polygon[(index + 1) % polygon.size()])
		nearest = minf(nearest, center.distance_squared_to(Geometry3D.get_closest_point_to_segment(center, a, b)))
	return sqrt(nearest)


func _apply_plan(owners: Array, plans: Dictionary) -> void:
	var desired := {}
	for kind in KINDS:
		if not _models.has(kind):
			continue
		var limit: int = TOTAL_LIMITS[kind]
		var selected := {}
		# A large army cannot use all slots before smaller armies get a turn.
		for index in PLAYER_LIMITS[kind]:
			if limit == 0:
				break
			for owner in owners:
				if limit == 0:
					break
				var choices: Array = plans[owner][kind]
				if index >= choices.size():
					continue
				if not selected.has(owner):
					selected[owner] = []
				selected[owner].append(choices[index])
				limit -= 1
		for owner in selected:
			var choices: Array = selected[owner]
			var arrivals := _arrival_slots(_tickets_for(str(owner), kind), choices.size())
			var color: Color = map_canvas.app.player_color(owner)
			for index in choices.size():
				var pose: Dictionary = choices[index]
				var ticket: Dictionary = arrivals.get(index, {})
				var key := JSON.stringify([owner, str(kind), index])
				desired[key] = {"kind": kind, "pose": pose, "ticket": ticket, "owner": owner, "slot": index,
					"color": color, "seed": float(posmod(key.hash(), 1009)) / 1009.0}

	for key in _active.keys():
		if not desired.has(key):
			var old: Dictionary = _active[key]
			# Dropping a render slot to fit another army is silent.
			var surviving: Array = plans.get(old.owner, {}).get(old.kind, [])
			var destroyed: bool = plans.has(old.owner) and _combat_strength.has(old.owner) and int(old.slot) >= surviving.size()
			_release(key, destroyed)
	for key in desired:
		var request: Dictionary = desired[key]
		var kind: StringName = request.kind
		var entry: Dictionary = _active.get(key, {})
		if entry.is_empty():
			entry = _acquire(kind)
			_active[key] = entry
			entry.fresh = true
		entry.pose = request.pose
		entry.ticket = request.ticket
		entry.seed = request.seed
		entry.owner = request.owner
		entry.slot = request.slot
		if entry.get("tint", Color.TRANSPARENT) != request.color:
			_tint(entry.node, kind, request.color)
			entry.tint = request.color
		var battle_id := str(entry.pose.get("battle", ""))
		if not battle_id.is_empty():
			if not battle_formations.has(battle_id):
				battle_formations[battle_id] = {"airborne": entry.pose.airborne,
					"tanks": [], "helicopters": [], "soldiers": [], "jets": []}
			var field := str(kind).to_lower() + "s"
			battle_formations[battle_id][field].append(entry.node)


func enqueue_reinforcements(owner: String, tanks: int, helicopters: int) -> void:
	if owner.is_empty():
		return
	var total := 0
	for tickets in _arrivals.values():
		total += tickets.size()
	var queue: Array = _arrivals.get(owner, [])
	var requested := {&"Tank": tanks, &"Helicopter": helicopters}
	for kind in [&"Tank", &"Helicopter"]:
		var existing := _tickets_for(owner, kind).size()
		var count := clampi(int(requested[kind]), 0, mini(ARRIVAL_LIMIT - total, REINFORCEMENT_LIMITS[kind] - existing))
		for index in count:
			queue.append({"kind": kind, "queued_at": clock, "elapsed": 0.0,
				"duration": 2.7 + (existing + index) * 0.24})
		total += count
	if not queue.is_empty():
		_arrivals[owner] = queue
		_sync_left = 0.0


func _tickets_for(owner: String, kind: StringName) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for ticket in _arrivals.get(owner, []):
		if ticket.kind == kind and float(ticket.elapsed) < float(ticket.duration):
			result.append(ticket)
	return result


func _arrival_slots(tickets: Array[Dictionary], count: int) -> Dictionary:
	var assigned := {}
	for ticket in tickets:
		var slot := int(ticket.get("slot", -1))
		if slot >= 0 and slot < count and not assigned.has(slot):
			assigned[slot] = ticket
		else:
			ticket.erase("slot")
	# Fill from the back so the first front units stay on duty during arrivals.
	for ticket in tickets:
		if ticket.has("slot"):
			continue
		for slot in range(count - 1, -1, -1):
			if not assigned.has(slot):
				ticket.slot = slot
				assigned[slot] = ticket
				break
	return assigned


func _trim_arrivals() -> void:
	for owner in _arrivals.keys():
		var queue: Array = _arrivals[owner]
		for index in range(queue.size() - 1, -1, -1):
			var ticket: Dictionary = queue[index]
			if float(ticket.elapsed) >= float(ticket.duration) or clock - float(ticket.queued_at) > 30.0:
				queue.remove_at(index)
		if queue.is_empty():
			_arrivals.erase(owner)


func clear_reinforcements() -> void:
	_arrivals.clear()
	_clear_infantry_reserves()
	_infantry_timing.clear()
	_clear_combat_effects()
	jet_audio_reset.emit()
	for entry in _active.values():
		entry.ticket = {}
		entry.motion = 0.0
		_clear_projectile_effects(entry)
		_stop_jet_exhaust(entry)
	for feedback in _headquarters_feedback.values():
		feedback.label.hide()
		feedback.sequence = 0
		feedback.shown = 0
		feedback.started = -1.0
	_sync_left = 0.0


func _ground(point: Vector2) -> Vector3:
	return map_canvas.world_point(point) + Vector3(0.0, 0.046, 0.0)


func _world_direction(direction: Vector2) -> Vector3:
	var facing: Vector3 = map_canvas.world_point(direction) - map_canvas.world_point(Vector2.ZERO)
	return facing.normalized()


func helicopter_audio_positions() -> PackedVector3Array:
	return _aircraft_audio_positions(&"Helicopter")


func jet_audio_positions() -> PackedVector3Array:
	return _aircraft_audio_positions(&"Jet")


func jet_show_launch_positions() -> PackedVector3Array:
	const HARDPOINTS: Array[Vector3] = [Vector3(-0.30, 0.01, -0.12), Vector3(0.30, 0.01, -0.12)]
	var origins := PackedVector3Array()
	for entry: Dictionary in _active.values():
		var jet: Node3D = entry.node
		if entry.kind == &"Jet" and jet.is_visible_in_tree():
			for point: Vector3 in HARDPOINTS:
				origins.append(jet.to_global(point))
	return origins


func _aircraft_audio_positions(kind: StringName) -> PackedVector3Array:
	var centers := PackedVector3Array()
	for key in _active:
		var entry: Dictionary = _active[key]
		var node: Node3D = entry.node
		if entry.kind == kind and node.is_visible_in_tree():
			centers.append(node.to_global(node.get_meta("model_center", Vector3.ZERO)))
	return centers


func tank_rumble_strength() -> float:
	var camera: Camera3D = map_canvas.eye
	if not is_instance_valid(camera):
		return 0.0
	var screen := camera.get_viewport().get_visible_rect()
	if not screen.has_area():
		return 0.0
	var loudest := 0.0
	for entry in _active.values():
		if entry.kind != &"Tank" or float(entry.get("motion", 0.0)) < 0.03:
			continue
		var node: Node3D = entry.node
		var position := node.global_position
		if not node.is_visible_in_tree() or camera.is_position_behind(position):
			continue
		var at := camera.unproject_position(position)
		if screen.has_point(at):
			var offset := (at - screen.get_center()) / (screen.size * 0.5)
			var focus := 1.0 - smoothstep(0.18, 1.26, offset.length())
			loudest = maxf(loudest, float(entry.motion) * lerpf(0.27, 1.0, focus))
	return loudest


func _patrol_position(home: Dictionary, elapsed: float, jet: bool) -> Vector3:
	var path: PatrolPath = home.path
	var phase: float = home.phase
	var cruise_speed := clampf(path.length / 8.8, 1.55, 4.8) if jet else clampf(path.length / 12.0, 0.65, 2.2)
	var speed := cruise_speed * PATROL_SPEED_SCALE
	var distance := speed * (elapsed + sin(elapsed * 0.63 + phase) * 0.24) + path.length * phase / TAU
	var angle := elapsed * (0.82 if jet else 0.67) + phase
	var height := sin(angle - 0.60) * 0.22 + cos(angle * 2.0 + 0.32) * 0.12 if jet else sin(angle) * 0.07
	return path.sample(distance) + Vector3.UP * (float(home.height) + height)


func _departure_progress(travel: float, length: float, age: float, lead_speed: float) -> float:
	# Movement leads the periodic formation samples. Fire still uses the rules' travel.
	const LEAD_SECONDS := 0.38
	var reach := minf(0.52 * length, lead_speed * LEAD_SECONDS)
	var lead := reach * (1.0 - exp(-lead_speed * age / maxf(reach, 0.001))) / maxf(length, 0.001)
	return 1.0 - pow(1.0 - travel, 2.0) * (1.0 - lead)


func _air_contact_offset(pose: Dictionary, age: float) -> Vector3:
	var lane := int(pose.index) % 3
	var angle := float(pose.index) * 2.399963 + age * 0.76
	return Vector3(cos(angle) * 0.38, 0.68 + lane * 0.22 + sin(age * 1.7) * 0.04, sin(angle) * 0.31)


func _deployment_pose(entry: Dictionary, pose: Dictionary, delta: float) -> Dictionary:
	var helicopter: bool = entry.kind == &"Helicopter"
	var target: Vector3 = pose.target
	var facing: Vector3 = pose.facing
	if entry.get("march_battle", "") != pose.battle or entry.get("march_region", -1) != pose.region:
		_clear_deployment(entry)
		var launch: Vector3 = entry.node.position
		if entry.get("fresh", false):
			var home: Dictionary = pose.home
			launch = home.target
			if helicopter:
				launch = _patrol_position(home, clock, false)
		var route := Curve3D.new()
		route.bake_interval = 0.12
		if helicopter:
			var end := target + _air_contact_offset(pose, 0.0)
			var arc := Vector3.UP * minf(launch.distance_to(end) * 0.2, 1.4)
			route.add_point(launch, Vector3.ZERO, (end - launch) * 0.3 + arc)
			route.add_point(end, (launch - end) * 0.3 + arc, Vector3.ZERO)
		else:
			var path := PackedVector3Array([launch])
			path.append_array(pose.waypoints)
			path.append(target)
			for point in path:
				if route.point_count == 0 or point.distance_squared_to(route.get_point_position(route.point_count - 1)) > 0.000001:
					route.add_point(point)
		entry.march_battle = pose.battle
		entry.march_region = pose.region
		entry.march_route = route
		entry.march_started = _battle_clock - delta

	var travel: float = pose.travel
	if travel < 1.0:
		var route: Curve3D = entry.march_route
		var length := route.get_baked_length()
		if length < 0.001:
			return {"position": target, "facing": facing, "engage": false, "bank": 0.0}
		# Start moving at once and ease into the line while the rules clock
		# still decides when the formation may fire.
		var progress := _departure_progress(travel, length, _battle_clock - float(entry.march_started), 8.0 if helicopter else 2.8)
		var distance := length * progress
		target = route.sample_baked(distance)
		var tangent := route.sample_baked(minf(distance + 0.14, length)) - route.sample_baked(maxf(distance - 0.14, 0.0))
		tangent = tangent.slide(Vector3.UP).normalized()
		if not tangent.is_zero_approx():
			facing = tangent
		return {"position": target, "facing": facing, "engage": false, "bank": -0.11 * sin(progress * PI) if helicopter else 0.0}

	var landed: float = entry.get("landed_at", _battle_clock)
	entry.landed_at = landed
	var age := _battle_clock - landed
	var bank := 0.0
	if helicopter:
		target += _air_contact_offset(pose, age)
		bank = 0.10 * sin(age * 0.76 + float(pose.index))
	return {"position": target, "facing": facing, "engage": pose.engage, "bank": bank}


func _clear_deployment(entry: Dictionary) -> void:
	for field in ["march_battle", "march_region", "march_route", "march_started", "landed_at", "next_shot", "shot_at"]:
		entry.erase(field)


func _update_core_infantry(entry: Dictionary, pose: Dictionary) -> void:
	if entry.get("infantry_battle", "") != pose.battle:
		_clear_projectile_effects(entry)
		entry.infantry_battle = pose.battle
	var node: Node3D = entry.node
	node.transform = _infantry_advance(pose, entry.seed)
	entry.fresh = false
	_update_fire(entry, float(_infantry_timing[pose.battle].travel) >= 1.0)


func _update_unit(entry: Dictionary, delta: float, battle_delta: float) -> void:
	var pose: Dictionary = entry.pose
	if entry.kind == &"Soldier":
		if pose.has("launch"):
			_update_core_infantry(entry, pose)
			return
		if entry.has("infantry_battle"):
			entry.erase("infantry_battle")
			_clear_deployment(entry)
			_clear_projectile_effects(entry)
			entry.fresh = true
	var in_battle := pose.has("battle")
	var age_clock := _battle_clock if in_battle else clock
	var step_delta := battle_delta if in_battle else delta
	if entry.kind == &"Jet":
		_update_jet(entry, step_delta)
		return
	var node: Node3D = entry.node
	var seed: float = entry.seed
	var kind: StringName = entry.kind
	var target: Vector3 = pose.target
	var facing: Vector3 = pose.get("facing", Vector3.BACK)
	var fire := false
	var bank := 0.0
	var local_support: bool = pose.mode == &"distant_support"
	var patrolling: bool = pose.mode == &"patrol"
	var ticket: Dictionary = entry.ticket
	var arriving := not ticket.is_empty() and float(ticket.elapsed) < float(ticket.duration)
	if arriving:
		ticket.elapsed = minf(float(ticket.duration), float(ticket.elapsed) + step_delta)
	if kind == &"Tank":
		# A render slot can be reassigned after conquest. Keep each tank on its post's chord.
		if entry.get("tank_region", -1) != pose.region or entry.get("tank_post", Vector3.INF) != target:
			entry.fresh = true
			entry.tank_region = pose.region
			entry.tank_post = target
		fire = bool(pose.get("engage", false))
		if local_support:
			entry.erase("tank_battle")
		else:
			var shift := 0.5 - 0.5 * cos(age_clock * (1.03 + seed * 0.24) + seed * TAU)
			shift = smoothstep(0.09, 0.91, shift)
			if pose.mode == &"land_support":
				if entry.get("tank_battle", "") != pose.battle:
					entry.tank_battle = pose.battle
					entry.tank_ordered = _battle_clock - step_delta
					var tread: Vector3 = pose.patrol_end - target
					entry.tank_forward = float(tread.dot(pose.impact - node.position) > 0.0)
				var age := _battle_clock - float(entry.tank_ordered)
				shift = lerpf(float(entry.tank_forward), shift, smoothstep(0.30, 1.00, age))
			else:
				entry.erase("tank_battle")
			if arriving:
				shift = lerpf(1.0, shift, smoothstep(0.0, float(ticket.duration), float(ticket.elapsed)))
			target = target.lerp(pose.patrol_end, shift)
			if pose.mode == &"home" and not arriving:
				var path: PatrolPath = pose.tank_path
				var cycle := (clock + seed * 7.0) / (6.0 + seed * 1.5)
				# Brief, eased pauses are staggered per tank; the path stays local.
				var along := floorf(cycle) + smoothstep(0.08, 0.92, fposmod(cycle, 1.0))
				target = path.sample(along * path.length)
	elif pose.mode == &"deploy":
		var deployment := _deployment_pose(entry, pose, step_delta)
		target = deployment.position
		facing = deployment.facing
		fire = deployment.engage
		bank = deployment.bank
	else:
		if entry.has("march_battle"):
			_clear_deployment(entry)
		if local_support:
			fire = pose.engage
		elif patrolling:
			var patrol_time := clock
			if arriving:
				ticket.patrol_arrival = true
				patrol_time -= 0.75 * (1.0 - smoothstep(0.0, float(ticket.duration), float(ticket.elapsed)))
			target = _patrol_position(pose, patrol_time, false)
			var ahead := _patrol_position(pose, patrol_time + 0.14, false)
			facing = ahead - _patrol_position(pose, patrol_time - 0.12, false)
			var lead := _patrol_position(pose, patrol_time + 0.32, false) - ahead
			var turn := angle_difference(atan2(facing.x, facing.z), atan2(lead.x, lead.z))
			bank = clampf(turn * 0.75, -0.24, 0.24) + 0.04 * sin(clock * 0.9 + float(pose.phase))
			if arriving:
				target.y -= 0.30 * (1.0 - smoothstep(0.0, float(ticket.duration), float(ticket.elapsed)))
		elif kind == &"Soldier":
			var watch := sin(clock * (0.62 + seed * 0.14) + seed * TAU)
			facing = facing.rotated(Vector3.UP, watch * 0.16)

	if arriving and kind != &"Tank" and not local_support and not patrolling and not ticket.get("patrol_arrival", false):
		if not ticket.has("start"):
			var bearing := facing if not facing.is_zero_approx() else Vector3.BACK
			var side := Vector3(bearing.z, 0.0, -bearing.x)
			var start := target - bearing * (1.06 + seed * 0.75) + side * ((seed - 0.5) * 0.64)
			start.y = target.y - (0.18 if kind == &"Helicopter" else 0.0)
			ticket.start = start
			entry.fresh = true
		var t := clampf(float(ticket.elapsed) / float(ticket.duration), 0.0, 1.0)
		var launch: Vector3 = ticket.start
		var path_direction := (target - launch).slide(Vector3.UP).normalized()
		var destination := launch.lerp(target, smoothstep(0.0, 1.0, t))
		if kind == &"Helicopter":
			destination.y += sin(t * PI) * 0.47
		target = destination
		if not path_direction.is_zero_approx():
			facing = path_direction.lerp(facing, smoothstep(0.68, 1.0, t))
		fire = false
	elif arriving:
		fire = false

	node.scale = Vector3.ONE * float(pose.scale)
	var previous := node.position
	var fresh := bool(entry.get("fresh", false))
	if fresh:
		node.position = target
		node.rotation.y = atan2(facing.x, facing.z)
		entry.fresh = false
	else:
		var blend := 1.0 - exp(-step_delta * 12.0)
		if local_support:
			node.position = target
		elif kind == &"Tank":
			node.position = node.position.move_toward(target, 0.72 * step_delta)
		elif pose.mode == &"deploy" and entry.has("landed_at") and not arriving:
			var close_speed := 1.48 if kind == &"Helicopter" else 0.78
			if _battle_clock - float(entry.landed_at) < 0.65:
				close_speed *= 1.75
			var stride := minf(close_speed * step_delta, node.position.distance_to(target) * blend)
			node.position = node.position.move_toward(target, stride)
		elif patrolling:
			if entry.get("patrol_path") != pose.path:
				facing = target - node.position
				node.position = node.position.move_toward(target, 5.0 * delta)
			else:
				node.position = target
		elif pose.mode == &"deploy" and (not arriving or ticket.get("patrol_arrival", false)):
			node.position = node.position.move_toward(target, (9.0 if kind == &"Helicopter" else 4.0) * step_delta)
		else:
			node.position = node.position.lerp(target, blend)
		if not facing.is_zero_approx():
			if kind == &"Tank" and node.position.distance_squared_to(previous) > 0.00000001:
				facing = node.position - previous
			node.rotation.y = lerp_angle(node.rotation.y, atan2(facing.x, facing.z), blend)
	if patrolling and node.position == target:
		entry.patrol_path = pose.path
	elif not patrolling:
		entry.erase("patrol_path")
	node.rotation.x = 0.048 if pose.mode == &"patrol" else 0.0
	node.rotation.z = bank
	if kind == &"Tank":
		var speed := 0.0 if fresh or local_support else Vector2(node.position.x - previous.x, node.position.z - previous.z).length() / maxf(delta, 0.001)
		entry.motion = lerpf(float(entry.get("motion", 0.0)), smoothstep(0.035, 0.68, speed), 1.0 - exp(-delta * 18.0))
		if speed > 0.045 and clock >= float(entry.get("dust_at", 0.0)):
			_emit_tank_dust(entry, previous, (node.position - previous).normalized())
			entry.dust_at = clock + TANK_DUST_INTERVAL
	if kind == &"Soldier":
		var movement := node.position - previous
		var speed := Vector2(movement.x, movement.z).length() / maxf(delta, 0.001)
		var stride := clampf(speed * 1.8, 0.0, 1.0) if not fresh and not local_support else 0.0
		var step := age_clock * 11.0 + seed * TAU
		node.position.y = target.y + (1.0 - cos(step * 2.0)) * 0.004 * stride
		node.rotation.x = (0.11 + 0.035 * cos(step)) * stride
		node.rotation.z = lerpf(0.023 * sin(age_clock * 1.25 + seed * TAU), sin(step) * 0.075, stride)
	if entry.rotor != null:
		entry.rotor.rotate_y(step_delta * 36.0)
	if entry.tail_rotor != null:
		entry.tail_rotor.rotate_x(step_delta * 48.0)
	var in_position := node.position.distance_squared_to(target) < 0.36
	var aimed := absf(angle_difference(node.rotation.y, atan2(facing.x, facing.z))) < 0.24
	if entry.turret != null:
		var turret: Node3D = entry.turret
		var sweep := sin(age_clock * (0.58 + seed * 0.12) + seed * TAU) * 0.30 if not fire else 0.0
		if in_battle:
			var aim: Vector3 = pose.impact - node.transform * turret.position
			var yaw := atan2(aim.x, aim.z) - node.rotation.y + sweep
			turret.rotation.y = lerp_angle(turret.rotation.y, yaw, 1.0 - exp(-step_delta * 7.0))
			aimed = absf(angle_difference(turret.rotation.y, yaw)) < 0.15
		else:
			turret.rotation.y = lerp_angle(turret.rotation.y, sweep, 1.0 - exp(-step_delta * 2.0))
			aimed = aimed and absf(angle_difference(turret.rotation.y, sweep)) < 0.15
	_update_fire(entry, fire and in_position and aimed)


func _update_jet(entry: Dictionary, delta: float) -> void:
	var node: Node3D = entry.node
	var pose: Dictionary = entry.pose
	var sortie: bool = pose.mode == &"sortie"
	var home: Dictionary = pose.home if sortie else pose
	var home_angle := clock * 0.82 + float(home.phase)
	var home_position := _patrol_position(home, clock, true)
	var target := home_position
	var tangent := _patrol_position(home, clock + 0.08, true) - _patrol_position(home, clock - 0.08, true)
	var lead := _patrol_position(home, clock + 0.28, true) - _patrol_position(home, clock + 0.12, true)
	var turn := angle_difference(atan2(tangent.x, tangent.z), atan2(lead.x, lead.z))
	var banking := clampf(turn * 2.75, -0.67, 0.67)
	var pitch := clampf(-atan2(tangent.y, Vector2(tangent.x, tangent.z).length()), -0.53, 0.53)
	var fraction := fposmod(home_angle, TAU) / TAU
	# One controlled roll as the aircraft pulls away from the center crossing.
	var roll_progress := smoothstep(0.42, 0.68, fraction)
	var roll_sign := 1.0 if int(home.region) % 2 == 0 else -1.0
	banking = banking * (1.0 - sin(PI * roll_progress)) + roll_sign * TAU * roll_progress
	var state := &"patrol"
	var on_pass := fraction >= 0.43 and fraction < 0.54
	if bool(entry.get("fresh", false)):
		node.position = home_position
		node.rotation = Vector3(pitch, atan2(tangent.x, tangent.z), banking)
		entry.fresh = false

	if sortie:
		var heading: Vector3 = pose.facing if not pose.facing.is_zero_approx() else Vector3.BACK
		var lateral := Vector3(heading.z, 0.0, -heading.x)
		var rank: int = pose.rank
		var altitude := 0.92 + float(rank) * 0.13
		var center: Vector3 = pose.target + Vector3.UP * altitude
		var length := 1.43
		var half_width := 0.62
		var new_sortie: bool = entry.get("jet_battle", "") != pose.battle
		if new_sortie:
			entry.jet_battle = pose.battle
			entry.jet_started = _battle_clock - delta
			entry.jet_launch = node.position
			entry.erase("jet_run_at")
		# Split a flight across the circuit so jets and flashes read individually.
		var phase := fposmod((_battle_clock - float(entry.get("jet_run_at", _battle_clock))) * SORTIE_SPEED - float(rank) * 0.59, TAU)
		var along := -cos(phase)
		var across := sin(phase)
		var lane := tanh(across * 2.0)
		target = center + heading * (along * length) + lateral * (half_width * (1.0 - lane))
		target.y += (1.0 - across) * 0.29
		if new_sortie:
			# Approach along the visible flight line before lining up for the first pass.
			entry.jet_assembly = target.lerp(center, 0.48)
		if not entry.has("jet_run_at") and float(pose.travel) >= 1.0 \
				and node.position.distance_squared_to(target) <= 0.09:
			entry.jet_run_at = _battle_clock
		if entry.has("jet_run_at"):
			# Flatten the inbound leg over the strike and climb along the outbound leg.
			tangent = heading * (across * length) + lateral * (along * half_width * 2.0 * (1.0 - lane * lane))
			banking = -0.70 * (1.0 - 0.89 * absf(across))
			pitch = clampf(cos(phase) * 0.31, -0.39, 0.39)
			on_pass = phase >= 1.05 and phase < 2.05
			state = &"pass" if on_pass else &"egress"
		else:
			state = &"approach"
			on_pass = false
			if float(pose.travel) < 1.0:
				var launch: Vector3 = entry.jet_launch
				var assembly: Vector3 = entry.jet_assembly
				var progress := _departure_progress(float(pose.travel), launch.distance_to(assembly),
					_battle_clock - float(entry.jet_started), 11.0)
				target = launch.lerp(assembly, progress)
			tangent = target - node.position
			banking = 0.18
			pitch = clampf(-tangent.y * 0.18, -0.30, 0.30)
	else:
		entry.erase("jet_battle")
		entry.erase("jet_run_at")
		if entry.get("patrol_path") != home.path and node.position.distance_to(target) > delta * 7.0:
			state = &"return"
			on_pass = false
			tangent = target - node.position
			banking = 0.22
			pitch = clampf(-tangent.y * 0.18, -0.25, 0.25)

	if state == &"patrol":
		node.position = target
		entry.patrol_path = home.path
	else:
		entry.erase("patrol_path")
		var speed := 12.0 if state == &"approach" else (7.0 if state == &"return" else 4.6)
		node.position = node.position.move_toward(target, delta * speed)
	var blend := 1.0 - exp(-delta * 10.0)
	if Vector2(tangent.x, tangent.z).length_squared() > 0.0001:
		node.rotation.y = lerp_angle(node.rotation.y, atan2(tangent.x, tangent.z), blend)
	node.rotation.x = lerpf(node.rotation.x, pitch, blend)
	node.rotation.z = lerp_angle(node.rotation.z, banking, blend)
	node.scale = Vector3.ONE * float(pose.scale)
	var flame_phase := (_battle_clock if sortie else clock) * 22.0 + float(entry.seed) * TAU
	var exhaust: Array[MeshInstance3D] = entry.exhaust
	for index in exhaust.size():
		var plume := exhaust[index]
		var phase := flame_phase + float(index) * 2.4
		var width := 1.0 + 0.07 * sin(phase * 1.4)
		plume.scale = Vector3(width, width, 0.97 + 0.15 * sin(phase) + 0.05 * sin(phase * 2.31))
		plume.show()
	var entered_pass := on_pass and not bool(entry.get("jet_on_pass", true))
	if entered_pass and node.is_visible_in_tree():
		jet_passed.emit(node.global_position)
		if sortie:
			_drop_bomb(entry)
	_update_fire(entry, sortie and on_pass, sortie and entered_pass)
	entry.jet_on_pass = on_pass
	entry.jet_state = state


func _make_fire_meshes() -> void:
	# Small pointed camera-facing sprite, with a short independent tracer.
	var image := Image.create(40, 40, false, Image.FORMAT_RGBA8)
	for y in 40:
		for x in 40:
			var p := Vector2((x + 0.5) / 20.0 - 1.0, (y + 0.5) / 20.0 - 1.0)
			var radius := p.length()
			var rays := maxf(absf(p.x), absf(p.y)) + minf(absf(p.x), absf(p.y)) * 4.0
			var alpha := maxf(1.0 - rays, 1.0 - radius * 3.5)
			var color := Color("#fff4a3").lerp(Color("#ff822b"), clampf(radius * 1.6, 0.0, 1.0))
			color.a = clampf(alpha, 0.0, 1.0)
			image.set_pixel(x, y, color)
	var flash := StandardMaterial3D.new()
	flash.albedo_texture = ImageTexture.create_from_image(image)
	flash.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flash.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flash.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	flash.billboard_keep_scale = true
	_flash_mesh = QuadMesh.new()
	_flash_mesh.size = Vector2(0.26, 0.26)
	_flash_mesh.material = flash
	var tracer := StandardMaterial3D.new()
	tracer.albedo_color = Color("#ffcf68")
	tracer.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_tracer_mesh = BoxMesh.new()
	_tracer_mesh.size = Vector3(0.018, 0.018, 0.20)
	_tracer_mesh.material = tracer


func _update_fire(entry: Dictionary, firing: bool, pulse := false) -> void:
	var flash: MeshInstance3D = entry.flash
	if flash == null:
		return
	var tracer: MeshInstance3D = entry.tracer
	var fired := false
	if not firing:
		entry.erase("next_shot")
	elif entry.kind == &"Jet":
		if pulse:
			entry.shot_at = _battle_clock
			fired = true
	elif not entry.has("next_shot"):
		entry.next_shot = _battle_clock + 0.13 + float(entry.seed) * 0.55
	elif _battle_clock >= float(entry.next_shot):
		var cadence := 1.42 + float(entry.seed) * 0.74
		entry.shot_at = _battle_clock
		entry.next_shot = _battle_clock + cadence
		fired = true
	if fired:
		entry.erase("far_travel")
		var pose: Dictionary = entry.pose
		if pose.mode == &"distant_support":
			var start := to_local(flash.global_position)
			var end: Vector3 = pose.impact + Vector3.UP * 0.09
			entry.far_start = start
			entry.far_end = end
			entry.far_travel = clampf(0.20 + start.distance_to(end) * 0.033, 0.25, 0.68)
			entry.impact_at = _battle_clock + float(entry.far_travel)
			entry.impact_point = pose.impact
		elif entry.kind in [&"Tank", &"Helicopter"] and pose.has("impact"):
			entry.impact_at = _battle_clock + (0.45 if entry.kind == &"Helicopter" else 0.19)
			entry.impact_point = pose.impact
	_update_impact(entry)
	var phase := _battle_clock - float(entry.get("shot_at", -1.0))
	flash.visible = entry.has("shot_at") and phase < 0.13
	if flash.visible:
		flash.scale = Vector3.ONE * lerpf(1.32, 0.48, phase / 0.13)
		if fired and entry.kind == &"Tank" and flash.is_visible_in_tree():
			tank_fired.emit(flash.global_position)
	if entry.has("far_travel"):
		var flight: float = entry.far_travel
		tracer.visible = phase >= 0.025 and phase < flight
		if tracer.visible:
			var t := phase / flight
			var start: Vector3 = entry.far_start
			var end: Vector3 = entry.far_end
			var at := start.lerp(end, t) + Vector3.UP * (0.55 * sin(t * PI))
			var heading := end - start + Vector3.UP * (0.55 * PI * cos(t * PI))
			var length := 2.4 if entry.kind == &"Tank" else 1.45
			var basis := Basis.looking_at(heading, Vector3.UP, true).scaled_local(Vector3(1.0, 1.0, length))
			tracer.global_transform = global_transform * Transform3D(basis, at)
	else:
		tracer.visible = entry.has("shot_at") and phase >= 0.025 and phase < 0.18
		if tracer.visible:
			var tip: Vector3 = entry.tip
			tracer.position = tip + Vector3(0.0, 0.0, 0.10 + phase * 1.8)
			tracer.rotation = Vector3.ZERO
			tracer.scale = Vector3(1.0, 1.0, lerpf(1.0, 0.42, phase / 0.18))
	for index in entry.missiles.size():
		var missile: MeshInstance3D = entry.missiles[index]
		var trail: MeshInstance3D = entry.missile_trails[index]
		var visible_now := entry.has("shot_at") and phase >= 0.04 and phase < 0.64
		missile.visible = visible_now
		trail.visible = visible_now
		if visible_now:
			var travel := (phase - 0.04) / 0.60
			var start: Vector3 = missile.get_meta("launch")
			missile.position = start + Vector3(0.0, sin(travel * PI) * 0.10, travel * 2.1)
			trail.position = missile.position - Vector3(0.0, 0.0, 0.12)
		var puffs: Array = entry.missile_smoke[index]
		for puff_index in puffs.size():
			var puff: MeshInstance3D = puffs[puff_index]
			var trail_age := float(puff_index + 1) * 0.07
			var travel := (phase - 0.04 - trail_age) / 0.60
			puff.visible = entry.has("shot_at") and travel > 0.0 and travel < 0.96
			if puff.visible:
				var start: Vector3 = missile.get_meta("launch")
				puff.position = start + Vector3(0.0, sin(travel * PI) * 0.10 + trail_age * 0.35, travel * 2.1)
				puff.scale = Vector3.ONE * (0.13 + trail_age * 1.6) * (1.0 - smoothstep(0.69, 0.97, travel))


func _update_impact(entry: Dictionary) -> void:
	if not entry.has("impact_at"):
		return
	var age := _battle_clock - float(entry.impact_at)
	if age < 0.0:
		return
	if not entry.has("impact_flash"):
		entry.impact_flash = _mesh_child(self, _flash_mesh, "ImpactFlare")
		entry.impact_smoke = _mesh_child(self, _smoke_mesh, "ImpactPlume")
	var flare: MeshInstance3D = entry.impact_flash
	var plume: MeshInstance3D = entry.impact_smoke
	var at: Vector3 = entry.impact_point
	flare.visible = age < 0.21
	flare.position = at + Vector3.UP * 0.09
	var size := 0.33 if entry.kind == &"Soldier" else 1.0
	flare.scale = Vector3.ONE * size * lerpf(2.4, 0.42, clampf(age / 0.21, 0.0, 1.0))
	plume.visible = age < 0.88
	plume.position = at + Vector3(0.12 * age, 0.11 + age * 0.42, -0.08 * age)
	plume.scale = Vector3.ONE * size * (0.66 + age) * (1.0 - smoothstep(0.52, 0.89, age))
	if age >= 0.88:
		entry.erase("impact_at")


func _clear_projectile_effects(entry: Dictionary) -> void:
	entry.erase("far_travel")
	entry.erase("far_start")
	entry.erase("far_end")
	entry.erase("shot_at")
	entry.erase("next_shot")
	entry.erase("impact_at")
	if entry.flash != null:
		entry.flash.hide()
		entry.tracer.hide()
	for projectile in entry.missiles + entry.missile_trails:
		projectile.hide()
	if entry.has("impact_flash"):
		entry.impact_flash.hide()
		entry.impact_smoke.hide()
	for puffs in entry.missile_smoke:
		for puff in puffs:
			puff.hide()


func _configure_combat_effects(texture: Texture2D) -> void:
	var smoke: StandardMaterial3D = _smoke_mesh.material.duplicate()
	smoke.albedo_texture = texture
	smoke.vertex_color_use_as_albedo = true
	var puff: QuadMesh = _smoke_mesh.duplicate()
	puff.material = smoke
	_effect_smoke = MultiMesh.new()
	_effect_smoke.transform_format = MultiMesh.TRANSFORM_3D
	_effect_smoke.use_colors = true
	_effect_smoke.mesh = puff
	var trail_budget := (CASUALTY_LIMIT + DEFEAT_LIMIT) * TRAIL_PUFFS
	_effect_smoke.instance_count = trail_budget + BOMB_LIMIT * BOMB_CLOUD_PUFFS + map_canvas.regions.size()
	_effect_smoke.visible_instance_count = 0
	var batch := MultiMeshInstance3D.new()
	batch.name = "CombatSmoke"
	batch.multimesh = _effect_smoke
	batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(batch)

	# One fixed batch and reusable ring for faint ground dust, separate from combat smoke.
	_tank_dust_mesh = MultiMesh.new()
	_tank_dust_mesh.transform_format = MultiMesh.TRANSFORM_3D
	_tank_dust_mesh.use_colors = true
	_tank_dust_mesh.mesh = puff
	_tank_dust_mesh.instance_count = TANK_DUST_LIMIT
	_tank_dust_mesh.visible_instance_count = 0
	var dust_batch := MultiMeshInstance3D.new()
	dust_batch.name = "TankGroundDust"
	dust_batch.multimesh = _tank_dust_mesh
	dust_batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(dust_batch)
	for _index in TANK_DUST_LIMIT:
		_tank_dust.append({"started": -1.0, "origin": Vector3.ZERO, "direction": Vector3.ZERO})

	var bomb_mesh := SphereMesh.new()
	bomb_mesh.radius = 0.105
	bomb_mesh.height = 0.38
	bomb_mesh.radial_segments = 8
	bomb_mesh.rings = 4
	bomb_mesh.material = _missile_trail.material
	for index in BOMB_LIMIT:
		var bomb := _mesh_child(self, bomb_mesh, "FallingBomb%d" % index)
		var flare := _mesh_child(self, _flash_mesh, "BombImpact%d" % index)
		bomb.hide()
		flare.hide()
		_bombs.append({"node": bomb, "flare": flare, "started": -1.0})


func _emit_tank_dust(entry: Dictionary, previous: Vector3, direction: Vector3) -> void:
	var origin := previous - direction * 0.19
	var polygon: PackedVector2Array = map_canvas.regions[entry.pose.region].polygon
	var point := Vector2(origin.x, origin.z) / 0.014
	if not Geometry2D.is_point_in_polygon(point, polygon):
		origin = previous
	origin.y = _ground(Vector2.ZERO).y + 0.025
	var puff: Dictionary = _tank_dust[_tank_dust_next]
	puff.started = clock
	puff.origin = origin
	puff.direction = direction
	_tank_dust_next = (_tank_dust_next + 1) % TANK_DUST_LIMIT


func _update_tank_dust() -> void:
	var visible := 0
	for puff in _tank_dust:
		var age := clock - float(puff.started)
		if puff.started < 0.0 or age >= TANK_DUST_DURATION:
			puff.started = -1.0
			continue
		var life := age / TANK_DUST_DURATION
		var at: Vector3 = puff.origin + Vector3.UP * age * 0.018
		var size := Basis.from_scale(Vector3(0.38 + life * 0.14, 0.15 + life * 0.08, 1.0))
		_tank_dust_mesh.set_instance_transform(visible, Transform3D(size, at))
		_tank_dust_mesh.set_instance_color(visible, Color(0.48, 0.38, 0.24, 0.16 * (1.0 - life) * (1.0 - life)))
		visible += 1
	_tank_dust_mesh.visible_instance_count = visible


func _combat_puff(at: Vector3, size: Vector2, tint: Color) -> void:
	if tint.a <= 0.0:
		return
	var basis := Basis.from_scale(Vector3(size.x, size.y, 1.0))
	_effect_smoke.set_instance_transform(_puff_count, Transform3D(basis, at))
	_effect_smoke.set_instance_color(_puff_count, tint)
	_puff_count += 1


func _drop_bomb(entry: Dictionary) -> void:
	var node: Node3D = entry.node
	var departure := to_local(node.to_global(Vector3(0.0, -0.10, 0.10)))
	var impact: Vector3 = entry.pose.impact
	var available: Dictionary = {}
	for bomb in _bombs:
		if bomb.started >= 0.0:
			var other: Vector3 = bomb.impact
			if _battle_clock - float(bomb.started) < 0.72 and other.distance_squared_to(impact) < 0.30 * 0.30:
				return
			continue
		if available.is_empty():
			available = bomb
	if available.is_empty():
		return
	var distance := Vector2(departure.x - impact.x, departure.z - impact.z).length()
	available.departure = departure
	available.impact = impact
	available.started = _battle_clock
	available.fall = clampf(0.56 + distance * 0.13, 0.56, 0.92)


func _update_bombs() -> void:
	for bomb in _bombs:
		if bomb.started < 0.0:
			continue
		var node: MeshInstance3D = bomb.node
		var flare: MeshInstance3D = bomb.flare
		var from: Vector3 = bomb.departure
		var impact: Vector3 = bomb.impact
		var t := (_battle_clock - float(bomb.started)) / float(bomb.fall)
		if t < 1.0:
			var at := from.lerp(impact, t)
			at.y = lerpf(from.y, impact.y, t * t)
			var tangent := impact - from
			tangent.y *= 2.0 * maxf(0.15, t)
			var axis := tangent.normalized()
			node.basis = Basis(Quaternion(Vector3.UP, axis)) if not axis.is_zero_approx() else Basis.IDENTITY
			node.position = at
			node.show()
			continue
		node.hide()
		var age := _battle_clock - float(bomb.started) - float(bomb.fall)
		if age >= BOMB_CLOUD_DURATION:
			flare.hide()
			bomb.started = -1.0
			continue
		flare.visible = age < 0.39
		flare.position = impact + Vector3.UP * 0.24
		flare.scale = Vector3.ONE * lerpf(6.5, 1.4, clampf(age / 0.39, 0.0, 1.0))
		_draw_bomb_cloud(impact, age)


func _draw_bomb_cloud(impact: Vector3, age: float) -> void:
	var rise := smoothstep(0.0, 0.94, age)
	var fade := smoothstep(0.03, 0.23, age) * (1.0 - smoothstep(0.36, BOMB_CLOUD_DURATION, age)) * 0.77
	var lifted := impact + Vector3(0.16 * age, 0.18 + rise * 1.38 + age * 0.14, 0.07 * age) * BOMB_CLOUD_SCALE
	var hot := 1.0 - smoothstep(0.15, 0.96, age)
	var billow := Color("#655762").lerp(Color("#ffb468"), hot)
	# A narrow rising stem supports a wider crown of independently expanding lobes.
	for index in 4:
		var ratio := (float(index) + 0.45) / 4.0
		var at := impact.lerp(lifted, ratio) + Vector3(sin(ratio * TAU) * 0.09, 0.12, 0.0)
		_combat_puff(at, Vector2(0.58, 1.26) * (0.68 + rise * 0.60) * BOMB_CLOUD_SCALE,
			Color(billow.darkened(0.22), fade * 0.86))
	for index in 7:
		var angle := float(index) * TAU / 6.0
		var center := index == 6
		var radius := 0.0 if center else 0.22 + 0.39 * rise + 0.10 * age
		var offset := Vector3(cos(angle) * radius, sin(angle * 2.0) * 0.10, sin(angle) * radius)
		var tint := billow.lerp(Color("#c3967b"), 0.27 + 0.14 * cos(angle))
		# The broad core joins the lobes when the overhead camera foreshortens the crown.
		var shape := Vector2(2.1 + rise * 1.75, 0.96 + rise * 0.51) if center else Vector2(1.17 + rise * 0.86, 0.89 + rise * 0.52)
		if center:
			tint = tint.darkened(0.12)
		_combat_puff(lifted + offset * BOMB_CLOUD_SCALE, shape * BOMB_CLOUD_SCALE, Color(tint, fade * 0.88))
	for index in 2:
		var direction := -1.0 if index == 0 else 1.0
		var at := impact + Vector3(direction * (0.26 + rise * 0.57), 0.17, 0.13 * direction) * BOMB_CLOUD_SCALE
		_combat_puff(at, Vector2(1.10 + rise * 2.0, 0.55) * BOMB_CLOUD_SCALE,
			Color("#aa7c59", fade * (1.0 - smoothstep(0.46, 1.24, age)) * 0.88))


func _acquire(kind: StringName) -> Dictionary:
	var available: Array = _pool.get(kind, [])
	if not available.is_empty():
		var reused: Dictionary = available.pop_back()
		reused.node.show()
		return reused
	var node: Node3D = _models[kind].duplicate()
	node.name = str(kind)
	add_child(node)
	var flash: MeshInstance3D
	var tracer: MeshInstance3D
	var tip: Vector3 = node.get_meta("muzzle", Vector3.ZERO)
	var missiles: Array[MeshInstance3D] = []
	var trails: Array[MeshInstance3D] = []
	var missile_smoke: Array = []
	if node.has_meta("muzzle"):
		var gun := node
		if kind == &"Tank":
			var muzzle: Node3D = node.get_node("Turret/CannonMuzzle")
			gun = muzzle.get_parent() as Node3D
			tip = muzzle.position
		flash = _mesh_child(gun, _flash_mesh, "MuzzleFlash")
		flash.position = tip
		flash.hide()
		tracer = _mesh_child(gun, _tracer_mesh, "MuzzleTracer")
		tracer.hide()
	for launch: Vector3 in node.get_meta("missile_muzzles", []):
		var missile := _mesh_child(node, _missile_mesh, "FlyingMissile")
		missile.rotation.x = PI * 0.5
		missile.set_meta("launch", launch)
		missile.hide()
		missiles.append(missile)
		var trail := _mesh_child(node, _missile_trail, "MissileExhaust")
		trail.hide()
		trails.append(trail)
		var puffs: Array[MeshInstance3D] = []
		for index in 3:
			var puff := _mesh_child(node, _smoke_mesh, "MissileSmoke%d" % index)
			puff.hide()
			puffs.append(puff)
		missile_smoke.append(puffs)
	var blast := _mesh_child(node, _flash_mesh, "CasualtyBlast")
	var smoke := _mesh_child(node, _smoke_mesh, "CasualtySmoke")
	blast.hide()
	smoke.hide()
	var exhaust: Array[MeshInstance3D] = []
	if kind == &"Jet":
		exhaust.assign([node.get_node("ExhaustLeft"), node.get_node("ExhaustRight")])
	return {"node": node, "kind": kind, "rotor": node.find_child("MainRotor", true, false),
		"tail_rotor": node.find_child("TailRotor", true, false), "turret": node.find_child("Turret", true, false),
		"flash": flash, "tracer": tracer, "tip": tip, "missiles": missiles, "missile_trails": trails,
		"missile_smoke": missile_smoke, "blast": blast, "smoke": smoke, "exhaust": exhaust}


func _stop_jet_exhaust(entry: Dictionary) -> void:
	for plume: MeshInstance3D in entry.exhaust:
		plume.hide()
		plume.scale = Vector3.ONE


## Called once for a confirmed defeat using the result's pre-transfer region IDs.
func show_defeat(loser: String, transferred_regions: Array) -> void:
	if loser.is_empty():
		return
	var region_delays := {}
	for region_id in transferred_regions:
		if region_id < 0 or region_id >= map_canvas.regions.size():
			continue
		var region: Dictionary = map_canvas.regions[region_id]
		var delay := minf(0.50, float(region_delays.size()) * 0.075)
		region_delays[region_id] = delay
		_defeat_regions[region_id] = {"origin": _ground(_home_points(region).patrol_center), "start": _battle_clock + delay}
	for key in _active.keys():
		var entry: Dictionary = _active[key]
		if entry.owner != loser or entry.kind == &"Factory" or not region_delays.has(entry.pose.region):
			continue
		if entry.node.is_visible_in_tree():
			_release(key, true, float(region_delays[entry.pose.region]) + float(entry.seed) * 0.20, true)
	_sync_left = 0.0


func _release(key: String, destroyed := false, delay := 0.0, defeat := false) -> void:
	var entry: Dictionary = _active[key]
	_active.erase(key)
	_clear_projectile_effects(entry)
	_stop_jet_exhaust(entry)
	if defeat and _defeat_count >= DEFEAT_LIMIT:
		for index in _dying.size():
			if _dying[index].loss_defeat:
				_recycle(_dying.pop_at(index))
				_defeat_count -= 1
				break
	var air: bool = entry.kind in [&"Helicopter", &"Jet"]
	if destroyed and air and not defeat and _dying.size() - _defeat_count >= CASUALTY_LIMIT:
		# Ground casualties can fill the pool in a single update. Make room for aircraft falls.
		for index in _dying.size():
			var prior: Dictionary = _dying[index]
			if not prior.loss_defeat and prior.kind in [&"Tank", &"Soldier"]:
				_recycle(_dying.pop_at(index))
				break
	if destroyed and entry.kind != &"Factory" and (defeat or _dying.size() - _defeat_count < CASUALTY_LIMIT):
		entry.loss_age = 0.0
		entry.loss_delay = delay
		entry.loss_defeat = defeat
		entry.loss_position = entry.node.position
		entry.loss_scale = entry.node.scale
		entry.loss_rotation = entry.node.rotation
		if air:
			var forward: Vector3 = entry.node.basis.z
			entry.loss_direction = forward.slide(Vector3.UP).normalized()
			entry.loss_ground = _ground(Vector2.ZERO).y
			var altitude := maxf(0.0, entry.loss_position.y - entry.loss_ground)
			var descent := 3.7 if entry.kind == &"Jet" else 1.6
			entry.loss_fall = clampf(sqrt(altitude / descent), 0.34, 1.10)
		if entry.kind == &"Jet":
			entry.jet_state = &"crash"
		_defeat_count += int(defeat)
		_dying.append(entry)
		return
	_recycle(entry)

func _recycle(entry: Dictionary) -> void:
	entry.node.hide()
	entry.blast.hide()
	entry.smoke.hide()
	entry.node.rotation = Vector3.ZERO
	entry.erase("pose")
	entry.erase("ticket")
	entry.erase("jet_state")
	entry.erase("jet_on_pass")
	entry.erase("jet_battle")
	entry.erase("jet_started")
	entry.erase("jet_launch")
	entry.erase("jet_assembly")
	entry.erase("jet_run_at")
	entry.erase("patrol_path")
	entry.erase("motion")
	entry.erase("dust_at")
	entry.erase("tank_region")
	entry.erase("tank_post")
	entry.erase("tank_battle")
	entry.erase("tank_ordered")
	entry.erase("tank_forward")
	_clear_deployment(entry)
	var kind: StringName = entry.kind
	if not _pool.has(kind):
		_pool[kind] = []
	_pool[kind].append(entry)

func _update_casualties(delta: float) -> void:
	for index in range(_dying.size() - 1, -1, -1):
		var entry: Dictionary = _dying[index]
		entry.loss_age += delta
		var age: float = entry.loss_age - entry.loss_delay
		if age < 0.0:
			continue
		var node: Node3D = entry.node
		var air: bool = entry.kind in [&"Helicopter", &"Jet"]
		var infantry: bool = entry.kind == &"Soldier"
		var duration := 1.4 if infantry else CASUALTY_DURATION
		if age >= duration:
			_defeat_count -= int(entry.loss_defeat)
			_recycle(entry)
			_dying.remove_at(index)
			continue
		if infantry:
			node.rotation.x = -smoothstep(0.0, 0.5, age) * PI * 0.48
		else:
			_update_vehicle_loss(entry, age, air)
		node.scale = entry.loss_scale * (1.0 - smoothstep(duration - 0.55, duration, age))


func _update_vehicle_loss(entry: Dictionary, age: float, air: bool) -> void:
	var node: Node3D = entry.node
	var jet: bool = entry.kind == &"Jet"
	var impact := age - 0.32
	var exhaust := Vector3(0, 0.12, -0.23)
	if air:
		var fall := clampf(age / float(entry.loss_fall), 0.0, 1.0)
		var roll := -1.0 if entry.seed < 0.5 else 1.0
		node.position = _fall_position(entry, age)
		node.rotation.x = lerpf(entry.loss_rotation.x, 0.64 if jet else 0.28, fall)
		node.rotation.y = float(entry.loss_rotation.y) + roll * fall * (0.22 if jet else 0.86)
		node.rotation.z = float(entry.loss_rotation.z) + roll * (2.15 if jet else 2.8) * fall
		impact = age - float(entry.loss_fall)
		exhaust.z = -0.64 if jet else -0.35
	else:
		var kick := sin(clampf(impact, 0.0, 0.54) * 17.0) * 0.20
		node.rotation.z = float(entry.loss_rotation.z) + kick * (1.0 - smoothstep(0.0, 0.54, impact))
	entry.blast.visible = impact >= 0.0 and impact < 0.39
	entry.blast.position = exhaust + Vector3.UP * 0.08
	entry.blast.scale = Vector3.ONE * (0.95 + sin(clampf(impact / 0.39, 0.0, 1.0) * PI) * 2.30)
	entry.smoke.visible = age < 1.84
	entry.smoke.position = exhaust + Vector3.UP * (0.12 * maxf(0.0, impact))
	entry.smoke.scale = Vector3.ONE * (0.65 + maxf(impact, 0.0) * 0.72)
	var origin := to_local(node.to_global(exhaust))
	for index in TRAIL_PUFFS:
		var lag := float(index) * 0.16 + 0.06
		if age < lag:
			continue
		var at := origin
		if air:
			var heading: Vector3 = entry.loss_direction
			at = _fall_position(entry, age - lag) - heading * (0.28 if jet else 0.16)
		at += Vector3((float(entry.seed) - 0.30) * lag, 0.13 + lag * 0.62, lag * 0.24)
		var tint := Color("#39383e").lerp(Color("#a96b43"), 0.38 if impact > 0.0 and index < 2 else 0.0)
		tint.a = (0.94 - lag * 0.48) * (1.0 - smoothstep(1.31, CASUALTY_DURATION, age))
		var size := 0.62 + lag * 0.86 + maxf(0.0, impact) * 0.22
		_combat_puff(at, Vector2(size, size * 1.11), tint)


func _fall_position(entry: Dictionary, age: float) -> Vector3:
	var fall := clampf(age / float(entry.loss_fall), 0.0, 1.0)
	var jet: bool = entry.kind == &"Jet"
	var at: Vector3 = entry.loss_position + entry.loss_direction * fall * (2.30 if jet else 0.77)
	at.y = lerpf(entry.loss_position.y, entry.loss_ground, fall * fall)
	return at


func _update_defeat_regions() -> void:
	for region_id in _defeat_regions.keys():
		var burst: Dictionary = _defeat_regions[region_id]
		var age := _battle_clock - float(burst.start)
		if age >= 1.85:
			_defeat_regions.erase(region_id)
		elif age > 0.0:
			var at: Vector3 = burst.origin + Vector3(0.10, 0.16 + age * 0.37, -0.09) * age
			var alpha := smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.65, 1.85, age))
			_combat_puff(at, Vector2(1.1, 1.35) * (0.72 + age * 0.55), Color("#8b7467", alpha * 0.84))


func _clear_combat_effects() -> void:
	for entry in _dying:
		_recycle(entry)
	_dying.clear()
	_defeat_count = 0
	_defeat_regions.clear()
	for puff in _tank_dust:
		puff.started = -1.0
	_tank_dust_next = 0
	_tank_dust_mesh.visible_instance_count = 0
	_puff_count = 0
	for bomb in _bombs:
		bomb.node.hide()
		bomb.flare.hide()
		bomb.started = -1.0
	_effect_smoke.visible_instance_count = 0


func _mesh_child(parent: Node3D, mesh: Mesh, label: String) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(node)
	return node


func _sync_headquarters(ready: Dictionary) -> void:
	for id in _headquarters.keys():
		if not ready.has(id):
			var castle: Node3D = _headquarters[id]
			castle.hide()
			castle.queue_free()
			_headquarters.erase(id)
			_headquarters_feedback.erase(id)
	for id in ready:
		if not _headquarters.has(id):
			var castle: Node3D = _headquarters_model.duplicate()
			castle.name = "Headquarters_%d" % id
			add_child(castle)
			castle.position = _ground(ready[id])
			var clearance := _edge_clearance(ready[id], map_canvas.regions[id].polygon)
			castle.scale = Vector3.ONE * clampf(clearance / 0.59, 0.68, 1.18)
			_headquarters[id] = castle
			var pulse := Label3D.new()
			pulse.name = "ProductionPulse"
			pulse.text = "+5"
			pulse.font_size = 56
			pulse.outline_size = 10
			pulse.pixel_size = 0.00105
			pulse.fixed_size = true
			pulse.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			pulse.no_depth_test = true
			pulse.hide()
			castle.add_child(pulse)
			_headquarters_feedback[id] = {"label": pulse, "sequence": 0, "shown": 0, "started": -1.0}
		var castle: Node3D = _headquarters[id]
		var owner: String = map_canvas.app.region_owner(id)
		if castle.get_meta("owner", "") != owner:
			_tint(castle, &"Headquarters", map_canvas.app.player_color(owner))
			castle.set_meta("owner", owner)


func _update_headquarters_feedback() -> void:
	var sequences: Variant = map_canvas.app.get("headquarters_pulses")
	if not sequences is Dictionary:
		return
	for id in _headquarters_feedback:
		var feedback: Dictionary = _headquarters_feedback[id]
		var pulse: Label3D = feedback.label
		var sequence := maxi(0, int(sequences.get(id, 0)))
		if sequence < int(feedback.sequence):
			feedback.shown = 0
			feedback.started = -1.0
		feedback.sequence = sequence
		var age := clock - float(feedback.started)
		var active := float(feedback.started) >= 0.0 and age < 0.72
		if not active and int(feedback.shown) < sequence:
			feedback.shown += 1
			feedback.started = clock
			age = 0.0
			active = true
		pulse.visible = active
		if active:
			pulse.position = Vector3(0.21, 0.76 + age * 0.55, 0.1)
			var opacity := 1.0 - smoothstep(0.44, 0.72, age)
			pulse.modulate = Color(0.74, 1.0, 0.54, opacity)
			pulse.outline_modulate = Color(0.08, 0.16, 0.12, opacity)


func _make_headquarters() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var stone := Color("#ece9df")
	var footing := Color("#c9c4b9")
	var trim := Color("#f7f3e7")
	_box(surface, Vector3(0.56, 0.055, 0.48), Vector3(0.0, 0.028, 0.0), footing)
	_box(surface, Vector3(0.44, 0.20, 0.36), Vector3(0.0, 0.15, 0.0), stone)
	_box(surface, Vector3(0.19, 0.32, 0.17), Vector3(0.0, 0.21, -0.032), stone)
	_box(surface, Vector3(0.20, 0.04, 0.18), Vector3(0.0, 0.38, -0.032), trim)
	_box(surface, Vector3(0.093, 0.114, 0.015), Vector3(0.0, 0.11, 0.185), Color("#605c56"))
	_box(surface, Vector3(0.123, 0.025, 0.022), Vector3(0.0, 0.18, 0.19), trim)
	for x in [-0.21, 0.21]:
		for z in [-0.165, 0.165]:
			_box(surface, Vector3(0.135, 0.29, 0.135), Vector3(x, 0.18, z), stone)
			_box(surface, Vector3(0.15, 0.032, 0.15), Vector3(x, 0.32, z), trim)
			for corner in [Vector2(-1, -1), Vector2(-1, 1), Vector2(1, -1), Vector2(1, 1)]:
				_box(surface, Vector3(0.037, 0.038, 0.037),
					Vector3(x + corner.x * 0.054, 0.354, z + corner.y * 0.054), trim)
	for x in [-0.105, 0.0, 0.105]:
		for z in [-0.171, 0.171]:
			_box(surface, Vector3(0.046, 0.04, 0.042), Vector3(x, 0.27, z), trim)
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.92
	surface.set_material(material)
	return surface.commit()


func _tint(node: Node3D, kind: StringName, color: Color) -> void:
	if node is MeshInstance3D and node.mesh != null and not node.name in [&"MuzzleFlash", &"MuzzleTracer"]:
		for surface in node.mesh.get_surface_count():
			var original: Material = node.mesh.surface_get_material(surface)
			if not original is StandardMaterial3D:
				continue
			if kind in [&"Soldier", &"Factory"] or "Green" in original.resource_name:
				var material: StandardMaterial3D = original.duplicate()
				var strength := 0.42 if kind == &"Factory" else (0.52 if kind in [&"Soldier", &"Helicopter"] else 0.7)
				material.albedo_color = Color.WHITE.lerp(color, strength).darkened(0.13)
				node.set_surface_override_material(surface, material)
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for child in node.get_children():
		if child is Node3D:
			_tint(child, kind, color)


func _miniature(factory: bool) -> Node3D:
	# Original authored silhouettes. Merge colored parts into one mesh/surface.
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	if factory:
		_box(surface, Vector3(0.60, 0.17, 0.38), Vector3(0, 0.085, 0), Color("#9b8b76"))
		_box(surface, Vector3(0.64, 0.042, 0.41), Vector3(0, 0.183, 0), Color("#4b4c4a"))
		_box(surface, Vector3(0.42, 0.08, 0.17), Vector3(-0.06, 0.24, -0.06), Color("#687782"))
		_box(surface, Vector3(0.18, 0.12, 0.028), Vector3(0, 0.061, 0.191), Color("#343c43"))
		for index in 2:
			var x := 0.145 + float(index) * 0.11
			_box(surface, Vector3(0.065, 0.22 - index * 0.04, 0.065), Vector3(x, 0.31 - index * 0.02, -0.105), Color("#554f47"))
			_box(surface, Vector3(0.082, 0.032, 0.082), Vector3(x, 0.421 - index * 0.04, -0.105), Color("#343c43"))
	else:
		_infantry_parts(surface)
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.92
	surface.set_material(material)
	var prototype := Node3D.new()
	_mesh_child(prototype, surface.commit(), "FactoryModel" if factory else "InfantryModel")
	return prototype


func _infantry_parts(surface: SurfaceTool) -> void:
	var cloth := Color("#7e8968")
	var gear := Color("#4d5646")
	var boots := Color("#343831")
	var skin := Color("#d9b491")
	for side in [-1.0, 1.0]:
		var x := float(side) * 0.027
		var stance := float(side) * 0.014
		_box(surface, Vector3(0.036, 0.122, 0.038), Vector3(x, 0.081, stance * 0.55), cloth,
			Basis(Vector3.RIGHT, float(side) * 0.13))
		_box(surface, Vector3(0.037, 0.027, 0.060), Vector3(x, 0.014, stance + 0.010), boots)
		_box(surface, Vector3(0.025, 0.064, 0.029), Vector3(x * 1.87, 0.191, 0.007), cloth,
			Basis(Vector3.RIGHT, 0.24) * Basis(Vector3.BACK, float(side) * 0.16))
		_box(surface, Vector3(0.022, 0.024, 0.052), Vector3(x * 1.54, 0.168 + stance, 0.039), gear,
			Basis(Vector3.UP, float(side) * 0.32))
	_box(surface, Vector3(0.084, 0.048, 0.055), Vector3(0, 0.131, 0), cloth)
	_box(surface, Vector3(0.090, 0.079, 0.057), Vector3(0, 0.185, 0), cloth)
	_box(surface, Vector3(0.074, 0.056, 0.023), Vector3(0, 0.181, 0.025), gear)
	_box(surface, Vector3(0.064, 0.059, 0.027), Vector3(0, 0.190, -0.037), gear)
	_box(surface, Vector3(0.025, 0.027, 0.028), Vector3(0, 0.225, 0.003), cloth)
	_box(surface, Vector3(0.037, 0.042, 0.037), Vector3(0, 0.253, 0.008), skin)
	_box(surface, Vector3(0.020, 0.025, 0.104), Vector3(0.015, 0.169, 0.057), boots,
		Basis(Vector3.UP, -0.57) * Basis(Vector3.RIGHT, 0.23))
	var helmet := SphereMesh.new()
	helmet.radius = 0.027
	helmet.height = 0.039
	helmet.radial_segments = 8
	helmet.rings = 3
	_part(surface, helmet, Vector3(0, 0.277, 0.003), gear)


func _box(surface: SurfaceTool, size: Vector3, position: Vector3, color: Color, orientation := Basis.IDENTITY) -> void:
	var box := BoxMesh.new()
	box.size = size
	_part(surface, box, position, color, orientation)


func _part(surface: SurfaceTool, mesh: PrimitiveMesh, position: Vector3, color: Color, orientation := Basis.IDENTITY) -> void:
	var arrays := mesh.get_mesh_arrays()
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	for index in arrays[Mesh.ARRAY_INDEX]:
		surface.set_normal(orientation * normals[index])
		surface.set_color(color)
		surface.add_vertex(orientation * vertices[index] + position)


func _exit_tree() -> void:
	for job: PatrolRouteJob in _patrol_jobs.values():
		WorkerThreadPool.wait_for_task_completion(job.task_id)
	_patrol_jobs.clear()
	for prototype in _models.values():
		prototype.free()
	_models.clear()
	if is_instance_valid(_headquarters_model):
		_headquarters_model.free()
