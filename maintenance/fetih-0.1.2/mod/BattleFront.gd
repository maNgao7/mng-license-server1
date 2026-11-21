extends RefCounted
const RULES = preload("WarRules.gd")

static func build(canvas: Control) -> Array[Dictionary]:
	var fronts: Array[Dictionary] = []
	for battle in canvas.app.battle_views():
		var a: Dictionary = canvas.app.player_view(battle.attacker)
		var b: Dictionary = canvas.app.player_view(battle.defender)
		if a.regions.is_empty() or b.regions.is_empty():
			continue
		var leader: String = battle.attacker if float(battle.get("attackerPower", a.troops)) >= float(battle.get("defenderPower", b.troops)) else battle.defender
		var control := float(battle.control)
		var winner: String = leader if is_zero_approx(control) else (battle.attacker if control > 0.0 else battle.defender)
		var loser: String = battle.defender if winner == battle.attacker else battle.attacker
		var source: Vector2 = canvas.regions[battle.from_region].center
		var target: Vector2 = canvas.regions[battle.to_region].center
		var contact: Vector2 = canvas.regions[battle.contact_from].center
		var direction := (target - contact).normalized() * (1.0 if winner == battle.attacker else -1.0)
		if direction.length_squared() < 0.01:
			direction = Vector2.RIGHT
		var selected: Array[int] = []
		var low := INF
		var high := -INF
		for region in canvas.regions:
			if canvas.app.region_owner(region.id) != loser:
				continue
			selected.append(region.id)
			for point in region.polygon:
				low = minf(low, point.dot(direction))
				high = maxf(high, point.dot(direction))
		var deployment := float(battle.deployment)
		var travel := clampf(battle.elapsed / deployment, 0.0, 1.0) if deployment > 0.0 else 1.0
		var sweep := clampf(absf(control), 0.005, 0.98)
		var threshold: float = lerpf(low, high, sweep)
		var rally_points := _slice_points(canvas, selected, direction, lerpf(low, high, 0.10))
		var formation_points := _contact_points(canvas, int(battle.contact_from), int(battle.to_region))
		if formation_points.is_empty():
			formation_points = _slice_points(canvas, [int(battle.to_region)], (target - contact).normalized(),
				target.dot((target - contact).normalized()))
		var remaining := remaining_troops(battle, int(a.troops), int(b.troops))
		var candidates: Array[Vector2] = []
		if travel >= 1.0:
			candidates = _slice_points(canvas, selected, direction, threshold)
		var points: Array[Vector2] = []
		var count := mini(candidates.size(), 24) if travel >= 1.0 else 0
		for i in count:
			points.append(candidates[int(float(i) * candidates.size() / count)])
		if points.is_empty() and travel >= 1.0:
			var contested_region: int = battle.to_region if winner == battle.attacker else battle.from_region
			points.append(canvas.regions[contested_region].center)
		var contested := int(battle.to_region) if winner == battle.attacker else int(battle.contact_from)
		var formation_low := INF
		var formation_high := -INF
		for point in canvas.regions[contested].polygon:
			formation_low = minf(formation_low, point.dot(direction))
			formation_high = maxf(formation_high, point.dot(direction))
		var formation_threshold := lerpf(formation_low, formation_high, sweep)
		if travel >= 1.0:
			var advance := _slice_points(canvas, [contested], direction, formation_threshold)
			if not advance.is_empty():
				formation_points = advance
				points = advance.slice(0, mini(24, advance.size()))
		var id := str(battle.id)
		var targets: Array[int] = []
		for value in battle.get("target_regions", b.regions):
			var region_id := int(value)
			if region_id >= 0 and region_id < canvas.regions.size() and region_id != int(battle.to_region) \
					and region_id not in targets and canvas.app.region_owner(region_id) == battle.defender:
				targets.append(region_id)
		targets.sort()
		targets.push_front(int(battle.to_region))
		var primary := {"id": id, "battle_id": id, "primary": true, "target_regions": targets,
			"attacker": battle.attacker,
			"defender": battle.defender, "winner": winner, "loser": loser, "direction": direction,
			"threshold": threshold, "progress": battle.progress, "regions": selected, "points": points,
			"rally_points": rally_points,
			"formation_points": formation_points,
			"formation_regions": [contested], "formation_threshold": formation_threshold,
			"strength": {battle.attacker: int(a.troops), battle.defender: int(b.troops)},
			"remaining": {battle.attacker: remaining.x, battle.defender: remaining.y},
			"airborne": battle.airborne, "source": source, "target": target, "destination": target,
			"from_region": battle.from_region, "to_region": battle.to_region, "contact_from": battle.contact_from,
			"duration": battle.duration, "deployment": deployment, "elapsed": battle.elapsed,
			"travel": travel, "leader": leader, "control": control}
		primary.assault = _assault_geometry(canvas, int(battle.to_region), contact, control, travel)
		fronts.append(primary)
		for index in range(1, targets.size()):
			var region_id := targets[index]
			var assault := _assault_geometry(canvas, region_id, contact, control, travel)
			fronts.append({"id": "%s:%d" % [id, region_id], "battle_id": id, "primary": false,
				"attacker": battle.attacker, "defender": battle.defender, "to_region": region_id,
				"assault": assault, "regions": [region_id], "points": assault.points, "direction": assault.direction,
				"duration": battle.duration, "deployment": deployment, "elapsed": battle.elapsed,
				"travel": travel, "progress": battle.progress, "control": control})
	return fronts

static func _assault_geometry(canvas: Control, region_id: int, contact: Vector2, control: float, travel: float) -> Dictionary:
	var region: Dictionary = canvas.regions[region_id]
	var center: Vector2 = region.center
	var direction := contact.direction_to(center)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var low := INF
	var high := -INF
	for point: Vector2 in region.polygon:
		low = minf(low, point.dot(direction))
		high = maxf(high, point.dot(direction))
	var advance := clampf(control, 0.0, 1.0)
	var threshold := lerpf(low, high, lerpf(0.12, 0.98, advance))
	var points: Array[Vector2] = []
	if travel >= 1.0:
		# Keep effects on an interior slice even as control reaches a thin edge.
		var interior := lerpf(low, high, lerpf(0.26, 0.72, advance))
		points = _slice_points(canvas, [region_id], direction, interior)
		if points.is_empty() and Geometry2D.is_point_in_polygon(center, region.polygon):
			points.append(center)
	return {"region": region_id, "direction": direction, "threshold": threshold, "points": points}

static func remaining_troops(battle: Dictionary, attacker: int, defender: int) -> Vector2i:
	var remaining := RULES.remaining_combat_troops(battle, attacker, defender)
	return Vector2i(mini(remaining[0], 2147483647), mini(remaining[1], 2147483647))

static func _contact_points(canvas: Control, source_id: int, target_id: int) -> Array[Vector2]:
	var cached: Dictionary = canvas.get_meta("military_contact_lines", {})
	var key := Vector2i(source_id, target_id)
	if cached.has(key):
		return cached[key]
	var source: PackedVector2Array = canvas.regions[source_id].polygon
	var target: PackedVector2Array = canvas.regions[target_id].polygon
	var edge_index := _contact_edge_index(source, 32.0, 10.0)
	var points: Array[Vector2] = []
	for edge in target.size():
		var a := target[edge]
		var b := target[(edge + 1) % target.size()]
		var count := maxi(2, ceili(a.distance_to(b) / 14.0))
		for sample in count:
			var point := a.lerp(b, (sample + 0.5) / count)
			var cell := Vector2i((point / 32.0).floor())
			for other in edge_index.get(cell, []):
				var close := Geometry2D.get_closest_point_to_segment(point, source[other], source[(other + 1) % source.size()])
				if point.distance_squared_to(close) <= 10.0 * 10.0:
					points.append(point)
					break
	cached[key] = points
	canvas.set_meta("military_contact_lines", cached)
	return points

static func _contact_edge_index(polygon: PackedVector2Array, cell_size: float, margin: float) -> Dictionary:
	var cells := {}
	for edge in polygon.size():
		var a := polygon[edge]
		var b := polygon[(edge + 1) % polygon.size()]
		var first := Vector2i(((a.min(b) - Vector2.ONE * margin) / cell_size).floor())
		var last := Vector2i(((a.max(b) + Vector2.ONE * margin) / cell_size).floor())
		for y in range(first.y, last.y + 1):
			for x in range(first.x, last.x + 1):
				var cell := Vector2i(x, y)
				if not cells.has(cell):
					cells[cell] = []
				cells[cell].append(edge)
	return cells

static func _slice_points(canvas: Control, regions: Array[int], direction: Vector2, threshold: float) -> Array[Vector2]:
	var points: Array[Vector2] = []
	for region_id in regions:
		var polygon: PackedVector2Array = canvas.regions[region_id].polygon
		var crossings: Array[Vector2] = []
		for edge in polygon.size():
			var a := polygon[edge]
			var b := polygon[(edge + 1) % polygon.size()]
			var da := a.dot(direction) - threshold
			var db := b.dot(direction) - threshold
			if (da <= 0.0 and db > 0.0) or (db <= 0.0 and da > 0.0):
				crossings.append(a.lerp(b, da / (da - db)))
		var side := direction.orthogonal()
		crossings.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.dot(side) < b.dot(side))
		for index in range(0, crossings.size() - 1, 2):
			var a := crossings[index]
			var b := crossings[index + 1]
			var count := maxi(2, int(a.distance_to(b) / 18.0))
			for part in count:
				points.append(a.lerp(b, (part + 0.5) / count))
	return points
