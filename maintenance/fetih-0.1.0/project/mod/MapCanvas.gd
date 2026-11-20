extends Control

const USERNAME_FONT_SIZE := 14
const USERNAME_HEIGHT := 22.0
const USERNAME_INK := Color("#fff7e5")
const VISUAL_REGION_GROWTH := [3.0, 1.5, 0.75]

var app: Node
var world := Node2D.new()
var base_map: Node2D
var regions: Array[Dictionary] = []
var zoom_factor := 1.0
var map_offset := Vector2.ZERO
var dragging := false
var hovered := -1
var time := 0.0
var fit_scale := 1.0
var shader: Shader
var marked_owners: Dictionary = {}
var waves: Dictionary = {}
var tag_style: StyleBoxFlat
var portrait_cache: Dictionary = {}
var front_builder: Script
var cached_fronts: Array[Dictionary] = []
var continent_titles: Array[Dictionary] = []
var neighbors: Dictionary = {}

func configure(owner_app: Node, original_map: Node2D, territory_nodes: Array[Node]) -> void:
	app = owner_app
	front_builder = load(app.mod_root.path_join("BattleFront.gd"))
	tag_style = app.box_style(Color("#191715"), Color("#a98e68"), 4)
	for side in [SIDE_LEFT, SIDE_RIGHT]:
		tag_style.set_content_margin(side, 7)
	for side in [SIDE_TOP, SIDE_BOTTOM]:
		tag_style.set_content_margin(side, 0)
	base_map = original_map
	shader = load(app.mod_root.path_join("Conquest.gdshader"))
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true
	add_child(world)
	world.add_child(base_map)
	var is_turkiye := base_map.has_meta("turkiye_atlas")
	if not is_turkiye:
		_enlarge_continents(territory_nodes)
	for area in territory_nodes:
		var collision: CollisionPolygon2D = area.get_node_or_null("CollisionPolygon2D")
		var sprite: Sprite2D = area.get_node_or_null("MainSprite")
		if collision == null or sprite == null:
			continue
		var polygon := PackedVector2Array()
		var center := Vector2.ZERO
		for point in collision.polygon:
			var local: Vector2 = base_map.to_local(collision.to_global(point))
			polygon.append(local)
			center += local
		center /= maxf(1.0, polygon.size())
		center = area.get_meta("zone_center", center)
		var material := ShaderMaterial.new()
		material.shader = shader
		var rect := sprite.get_rect()
		var origin := base_map.to_local(sprite.to_global(rect.position))
		material.set_shader_parameter("map_origin", origin)
		material.set_shader_parameter("map_axis_x", base_map.to_local(sprite.to_global(rect.position + Vector2(rect.size.x, 0))) - origin)
		material.set_shader_parameter("map_axis_y", base_map.to_local(sprite.to_global(rect.position + Vector2(0, rect.size.y))) - origin)
		sprite.material = material
		var bounds := Rect2(polygon[0], Vector2.ZERO)
		for point in polygon:
			bounds = bounds.expand(point)
		material.set_shader_parameter("portrait_map_min", bounds.position)
		material.set_shader_parameter("portrait_map_size", bounds.size)
		var record := {"id": regions.size(), "node": area, "sprite": sprite, "material": material,
			"polygon": polygon, "center": center, "bounds": bounds,
			"name": str(area.get_meta("zone_name", app.region_name(str(area.name))))}
		regions.append(record)
		# The spatial polygon draws the territory at native screen resolution.
		# Keep this source sprite/material for the original asset and QA fallback.
		sprite.hide()
	if is_turkiye:
		for region in regions:
			region["display_polygon"] = region.polygon
			neighbors[region.id] = region.node.get_meta("zone_neighbors", [])
	else:
		_build_display_polygons()
		_build_neighbors()
	mouse_exited.connect(func() -> void: hovered = -1)
	resized.connect(fit_map)
	fit_map.call_deferred()

func _enlarge_continents(territory_nodes: Array[Node]) -> void:
	# Scale the original continent silhouettes as a whole, preserving each
	# shared border and the map's original geographic layout.
	var groups := {}
	for area in territory_nodes:
		var parent: Node2D = area.get_parent()
		var collision: CollisionPolygon2D = area.get_node_or_null("CollisionPolygon2D")
		if collision == null:
			continue
		if not groups.has(parent):
			groups[parent] = {"bounds": Rect2(), "initialized": false}
		for point in collision.polygon:
			var local := base_map.to_local(collision.to_global(point))
			if not groups[parent].initialized:
				groups[parent].bounds = Rect2(local, Vector2.ZERO)
				groups[parent].initialized = true
			else:
				groups[parent].bounds = groups[parent].bounds.expand(local)
	var atlas := {
		"Mudflats": [Vector2(-87, -6), "ÇAMUR DÜZLÜKLERİ", Vector2(640, 146)],
		"Bamboovia": [Vector2(4, 7), "BAMBU VADİSİ", Vector2(1070, 541)],
		"Riverside": [Vector2(106, -24), "NEHİR BOYU", Vector2(1725, 354)],
		"Bushlands": [Vector2(-32, -4), "ÇALILIKLAR", Vector2(681, 700)],
		"Eucalypta": [Vector2(21, 21), "OKALİPTÜS ADALARI", Vector2(981, 963)],
		"Peaks": [Vector2(81, 4), "TAŞ ZİRVELER", Vector2(1210, 918)],
	}
	var growth := Vector2(1.25, 1.06)
	for parent in groups:
		var continent: Array = atlas.get(str(parent.name), [])
		if continent.is_empty():
			continue
		var bounds: Rect2 = groups[parent].bounds
		var center := bounds.get_center()
		parent.position = center + (parent.position - center) * growth + continent[0]
		parent.scale *= growth
		continent_titles.append({"text": continent[1], "position": continent[2]})
		for edge_name in ["Border", "Board"]:
			var coast: CanvasItem = parent.get_node_or_null(edge_name)
			if coast != null:
				coast.hide()
	for original_labels in ["Water", "Border", "ContinentLabels", "SeaNames", "SeaPaths"]:
		var layer: CanvasItem = base_map.get_node_or_null(original_labels)
		if layer != null:
			layer.hide()
	set_meta("expanded_original_atlas", true)

func _build_display_polygons() -> void:
	# Keep the original atlas polygons for picking, adjacency and combat. Only
	# accept a visual expansion if it leaves every other territory clear.
	for region in regions:
		region["display_polygon"] = region.polygon
		for growth in VISUAL_REGION_GROWTH:
			var expanded := Geometry2D.offset_polygon(region.polygon, growth)
			if expanded.size() != 1 or Geometry2D.triangulate_polygon(expanded[0]).is_empty():
				continue
			var candidate: PackedVector2Array = expanded[0]
			var bounds: Rect2 = region.bounds.grow(growth * 2.0)
			var blocked := false
			for other in regions:
				if other.id == region.id or not bounds.intersects(other.bounds.grow(6.0)):
					continue
				if not Geometry2D.intersect_polygons(candidate, other.get("display_polygon", other.polygon)).is_empty():
					blocked = true
					break
			if not blocked:
				region.display_polygon = candidate
				break

func _build_neighbors() -> void:
	const GAP := 14.0
	for a in regions:
		neighbors[a.id] = []
	for i in regions.size():
		var a: Dictionary = regions[i]
		var bounds: Rect2 = a.bounds.grow(GAP)
		for j in range(i + 1, regions.size()):
			var b: Dictionary = regions[j]
			if not bounds.intersects(b.bounds) or not _borders_close(a.polygon, b.polygon, GAP):
				continue
			neighbors[i].append(j)
			neighbors[j].append(i)

func _borders_close(a: PackedVector2Array, b: PackedVector2Array, gap: float) -> bool:
	for i in a.size():
		var p := a[i]
		var q := a[(i + 1) % a.size()]
		for j in b.size():
			var r := b[j]
			var s := b[(j + 1) % b.size()]
			if Geometry2D.segment_intersects_segment(p, q, r, s) != null:
				return true
			if p.distance_squared_to(Geometry2D.get_closest_point_to_segment(p, r, s)) <= gap * gap \
				or r.distance_squared_to(Geometry2D.get_closest_point_to_segment(r, p, q)) <= gap * gap:
				return true
	return false

func fit_map() -> void:
	fit_scale = minf(size.x / 1990.0, size.y / 1150.0)
	_apply_transform()

func _apply_transform() -> void:
	world.scale = Vector2.ONE * fit_scale * zoom_factor
	world.position = size * 0.5 - Vector2(960, 540) * world.scale + map_offset

func map_point(position: Vector2) -> Vector2:
	return world.to_local(get_global_transform() * position)

func region_at(position: Vector2) -> int:
	var point := map_point(position)
	for region in regions:
		if Geometry2D.is_point_in_polygon(point, region.polygon):
			return region.id
	return -1

func region_display_name(index: int) -> String:
	return str(regions[index].name)


func region_tooltip(at_position: Vector2, colored: bool = false) -> String:
	var info := region_hover_data(at_position)
	if info.is_empty():
		return ""
	var lines: Array[String] = [info.title]
	for section in info.sections:
		var heading: String = section.heading
		if colored:
			heading = "[color=%s]%s[/color]" % [section.color, heading.replace("[", "[lb]")]
		lines.append("\n" + heading + "\n" + section.body)
	return "\n".join(lines)

func region_hover_data(at_position: Vector2) -> Dictionary:
	var index := region_at(at_position)
	if index < 0:
		return {}
	var owner: String = app.region_owner(index)
	var title := "Bölge"
	if owner.is_empty():
		return {"title": region_display_name(index) + " · Boş bölge", "sections": []}
	var details: Array[String] = [title + "  ·  Bu bölgede %d asker" % app.region_troops(index)]
	match str(app.region_headquarters(index)):
		"ready":
			details.append("Karargâh hazır")
		"pending":
			details.append("Karargâh asker bekliyor")
	for battle in app.battle_views():
		if owner == battle.attacker or owner == battle.defender:
			var defense := "Savunan · Karşı taarruz" if float(battle.control) < -0.02 else "Savunan"
			return {"title": "\n".join(details), "sections": [
				_combat_summary(battle.attacker, "Saldıran", "#ff9c88", int(battle.attackerPower)),
				_combat_summary(battle.defender, defense, "#85e0d5", int(battle.defenderPower))]}
	return {"title": "\n".join(details), "sections": [_combat_summary(owner, "Bölge sahibi", "#fff3d8")]}

func _combat_summary(id: String, role: String, tint: String, power: int = -1) -> Dictionary:
	var player: Dictionary = app.player_view(id)
	var units: Dictionary = app.combat_unit_counts(id)
	var name := str(player.get("displayName", player.get("nickname", player.get("username", "")))).left(26)
	var heading := "%s  ·  #%d %s" % [role, player.number, name]
	var body := "%d asker  ·  %d bölge\n%d tank  ·  %d helikopter  ·  %d jet" \
		% [units.soldiers, player.regions.size(), units.tanks, units.helicopters, units.jets]
	if power >= 0:
		body += "\nToplam savaş gücü: %d asker eşdeğeri" % power
	return {"heading": heading, "body": body, "color": tint}


func _can_drop_data(position: Vector2, data: Variant) -> bool:
	if not data is Dictionary or not data.has("tikmng_army"):
		return false
	var region := region_at(position)
	if region < 0:
		return false
	return not app.region_owner(region).is_empty() or app.player_view(str(data.tikmng_army)).get("regions", []).is_empty()

func _drop_data(position: Vector2, data: Variant) -> void:
	app.drop_army(str(data.tikmng_army), region_at(position), int(data.get("source", -1)))

func _get_drag_data(position: Vector2) -> Variant:
	var source := region_at(position)
	if source < 0:
		return null
	var owner: String = app.region_owner(source)
	if owner.is_empty():
		return null
	app.close_army_details()
	set_drag_preview(app.army_drag_preview(owner))
	return {"tikmng_army": owner, "source": source}

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_MIDDLE or event.button_index == MOUSE_BUTTON_RIGHT:
			dragging = event.pressed
		elif event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var before := map_point(event.position)
			zoom_factor = clampf(zoom_factor * (1.15 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15), 0.65, 4.5)
			_apply_transform()
			map_offset += event.position - (world.position + before * world.scale)
			_apply_transform()
		elif event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			var index := region_at(event.position)
			if index >= 0:
				app.click_region(index)
	elif event is InputEventMouseMotion:
		hovered = region_at(event.position)
		if dragging:
			map_offset += event.relative
			_apply_transform()
	queue_redraw()

func _process(delta: float) -> void:
	if app == null:
		return
	if not app.is_paused():
		time += delta
	if not app.is_paused():
		cached_fronts = front_builder.build(self)
	var active_portraits := {}
	# The overview shows owner colors; nearby portraits ease into full clarity.
	# Keep full source contrast constant once the close-zoom threshold is reached.
	var portrait_strength := smoothstep(1.0, 1.65, zoom_factor)
	for region in regions:
		var owner: String = app.region_owner(region.id)
		if marked_owners.get(region.id, "") != owner:
			var previous: String = marked_owners.get(region.id, "")
			waves[region.id] = {"left": 0.0, "old": app.player_color(previous), "next": app.player_color(owner)}
			marked_owners[region.id] = owner
		if waves.has(region.id):
			var wave: Dictionary = waves[region.id]
			if not app.is_paused():
				wave.left = minf(1.0, float(wave.left) + delta * 0.43)
			region.material.set_shader_parameter("old_color", wave.old)
			region.material.set_shader_parameter("next_color", wave.next)
			region.material.set_shader_parameter("progress", wave.left)
			if wave.left >= 1.0:
				waves.erase(region.id)
		else:
			region.material.set_shader_parameter("old_color", app.player_color(owner))
			region.material.set_shader_parameter("next_color", app.player_color(owner))
			region.material.set_shader_parameter("progress", 1.0)
		if not owner.is_empty() and not active_portraits.has(owner):
			active_portraits[owner] = _map_portrait(owner)
		var portrait: Texture2D = active_portraits.get(owner)
		if region.get("portrait") != portrait:
			region["portrait"] = portrait
			region.material.set_shader_parameter("has_portrait", portrait != null)
			region.material.set_shader_parameter("portrait_texture", portrait)
			if portrait != null:
				var photo_aspect := float(portrait.get_width()) / portrait.get_height()
				var area: Vector2 = region.bounds.size
				var region_aspect := area.x / area.y
				var ratio := Vector2(minf(1.0, region_aspect / photo_aspect), minf(1.0, photo_aspect / region_aspect))
				region.material.set_shader_parameter("portrait_ratio", ratio)
		if region.get("portrait_strength") != portrait_strength:
			region["portrait_strength"] = portrait_strength
			region.material.set_shader_parameter("portrait_strength", portrait_strength)
	for owner in portrait_cache.keys():
		if not active_portraits.has(owner):
			portrait_cache.erase(owner)
	queue_redraw()

func _map_portrait(owner: String) -> Texture2D:
	var source: Texture2D = app.avatar_for(owner)
	var cached: Dictionary = portrait_cache.get(owner, {})
	if source == cached.get("source"):
		return cached.get("texture")
	var texture := source
	if source != null:
		var image := source.get_image()
		if image != null and not image.is_empty() and not image.has_mipmaps() and image.generate_mipmaps() == OK:
			texture = ImageTexture.create_from_image(image)
	portrait_cache[owner] = {"source": source, "texture": texture}
	return texture

func battle_fronts() -> Array[Dictionary]:
	return cached_fronts

func center_for_player(id: String) -> Vector2:
	for region in regions:
		if app.region_owner(region.id) == id:
			return region.center
	return Vector2(-10000, -10000)

func _draw() -> void:
	if app == null:
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color("#0c141a"))
	# The base map is an original game scene beneath this overlay's children.

func username_plate_width(font: Font, username: String) -> float:
	return clampf(ceilf(font.get_string_size(username, HORIZONTAL_ALIGNMENT_LEFT, -1, USERNAME_FONT_SIZE).x) + 14.0,
		36.0, 204.0)

func layout_username_plates(entries: Array[Dictionary], viewport_rect: Rect2) -> Dictionary:
	var placed := {}
	var occupied: Array[Rect2] = []
	var space := viewport_rect.grow(-4.0)
	if space.size.y < USERNAME_HEIGHT or space.size.x < 36.0:
		return placed
	for entry in entries:
		var badge: Rect2 = entry.badge
		if badge.has_area():
			occupied.append(badge)
	for entry in entries:
		var anchor: Vector2 = entry.anchor
		var badge: Rect2 = entry.badge
		var height := float(entry.get("height", USERNAME_HEIGHT))
		if space.size.y < height:
			continue
		var width := minf(float(entry.width), minf(162.0 if height > USERNAME_HEIGHT else 128.0, space.size.x / 6.0))
		var below := maxf(anchor.y, badge.end.y) + 3.0
		var above := minf(anchor.y, badge.position.y) - height - 3.0
		for row in range(ceili(space.size.y / (height + 3.0)) + 1):
			var offset := row * (height + 3.0)
			for y in [below + offset, above - offset]:
				for shift in [0.0, -0.43, 0.43, -0.86, 0.86]:
					var position := Vector2(
						clampf(anchor.x - width * (0.5 + shift), space.position.x, space.end.x - width),
						clampf(y, space.position.y, space.end.y - height)).round()
					var plate := Rect2(position, Vector2(width, height))
					var clear := true
					for other in occupied:
						if plate.grow(2.0).intersects(other):
							clear = false
							break
					if clear:
						placed[entry.id] = plate
						occupied.append(plate)
						break
				if placed.has(entry.id):
					break
			if placed.has(entry.id):
				break
	return placed

func draw_overlay(canvas: Node2D) -> void:
	var font: Font = app.ui_font if app.ui_font != null else ThemeDB.fallback_font
	var scale_now := maxf(0.25, fit_scale * zoom_factor)
	var entries: Array[Dictionary] = []
	for region in regions:
		var id: String = app.region_owner(region.id)
		if id.is_empty():
			continue
		var p: Dictionary = app.player_view(id)
		var center: Vector2 = region.center
		var color: Color = app.player_color(id)
		var border: PackedVector2Array = region.polygon.duplicate()
		border.append(border[0])
		canvas.draw_polyline(border, Color("#10151a"), (3.5 if app.selected_player == id or region.id == hovered else 2.1) / scale_now, true)
		var radius := 16.0 / scale_now
		canvas.draw_circle(center, radius + 2.0 / scale_now, Color("#14242b"))
		canvas.draw_circle(center, radius, color.darkened(0.52))
		var number := str(p.number)
		var fs := int(16.0 / scale_now)
		var text_size := font.get_string_size(number, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		canvas.draw_string(font, center + Vector2(-text_size.x * 0.5, text_size.y * 0.27), number,
			HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
		var anchor := world.transform * center
		if Rect2(Vector2.ZERO, size).has_point(anchor):
			var badge := Rect2(anchor - Vector2(18, 18), Vector2(36, 36))
			entries.append({"id": region.id, "anchor": anchor, "badge": badge, "text": p.username,
				"width": username_plate_width(font, p.username)})
	var plates := layout_username_plates(entries, Rect2(Vector2.ZERO, size))
	var small := roundi(USERNAME_FONT_SIZE / scale_now)
	for entry in entries:
		if not plates.has(entry.id):
			continue
		var plate: Rect2 = plates[entry.id]
		var rect := Rect2(world.transform.affine_inverse() * plate.position, plate.size / world.scale)
		var baseline := Vector2(7.0 / scale_now, (rect.size.y - font.get_height(small)) * 0.5 + font.get_ascent(small))
		canvas.draw_style_box(tag_style, rect)
		canvas.draw_string(font, rect.position + baseline, entry.text, HORIZONTAL_ALIGNMENT_CENTER,
			rect.size.x - 2.0 * baseline.x, small, USERNAME_INK)

