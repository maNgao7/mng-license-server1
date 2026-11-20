extends Node3D

const BORDER_HALF_WIDTH := 0.028
const HOVER_NEUTRAL := Color("#fff2a8")
const SELECTION := Color("#f0bf65")
const REGION_SELECTION := Color("#ffe9a1")
const BORDER_INK := Color("#181711")
const NEUTRAL_BORDER_INK := Color("#606e70")
const NUMBER_INK := Color("#211810")
const HQ_BADGE_LIFT := 0.6
const HQ_DESTRUCTION_SECONDS := 2.3
const HQ_DEBRIS_COUNT := 10
const HQ_SMOKE_COUNT := 12
const FILL_PARAMETERS := [&"old_color", &"next_color", &"progress", &"portrait_strength"]
enum Focus { NONE, SELECTED, OWNER_HOVER, REGION_HOVER, NEUTRAL_HOVER, REGION_SELECTED }

var map_canvas: Control
var surfaces: Array[Dictionary] = []
var surface_shader: Shader
var badge_mesh := QuadMesh.new()
var username_font: Font
var last_username_entries: Array[Dictionary] = []
var last_viewport_rect := Rect2()
var username_plates: Dictionary = {}
var atlas_mode := false
var surface_by_region: Dictionary = {}
var portrait_components: Array[Dictionary] = []
var portrait_owners: Dictionary = {}
var portrait_world_scale: Vector2
var _headquarters_destructions: Dictionary = {}
var _headquarters_debris_mesh: BoxMesh
var _headquarters_smoke_mesh: QuadMesh

func configure(canvas: Control) -> void:
	map_canvas = canvas
	atlas_mode = canvas.base_map.has_meta("turkiye_atlas")
	surface_shader = load(canvas.app.mod_root.path_join("TerritorySurface.gdshader"))
	username_font = canvas.app.ui_font if canvas.app.ui_font != null else ThemeDB.fallback_font
	var board_size := Vector2(1920, 1080)
	var board_span: Vector3 = canvas.world_point(board_size) - canvas.world_point(Vector2.ZERO)
	portrait_world_scale = Vector2(board_span.x, board_span.z) / board_size
	badge_mesh.size = Vector2(1.04, 0.66)
	var number_font := SystemFont.new()
	number_font.font_names = PackedStringArray(["Georgia", "Cambria", "Segoe UI"])
	number_font.font_weight = 700
	for region in canvas.regions:
		var polygon: PackedVector2Array = region.display_polygon
		var triangles := Geometry2D.triangulate_polygon(polygon)
		if triangles.is_empty():
			push_error("TERRITORY_TRIANGULATION: %d" % region.id)
			continue
		var vertices := PackedVector3Array()
		var uv := PackedVector2Array()
		var crop := Rect2(polygon[0], Vector2.ZERO)
		for point in polygon:
			vertices.append(canvas.world_point(point) + Vector3(0, 0.012, 0))
			uv.append(point / Vector2(1920, 1080))
			crop = crop.expand(point)
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		arrays[Mesh.ARRAY_TEX_UV] = uv
		arrays[Mesh.ARRAY_INDEX] = triangles
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var material := ShaderMaterial.new()
		material.shader = surface_shader
		material.set_shader_parameter("atlas_relief", atlas_mode)
		material.set_shader_parameter("region_min", crop.position)
		material.set_shader_parameter("region_size", crop.size)
		var fill := MeshInstance3D.new()
		fill.mesh = mesh
		fill.material_override = material
		fill.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(fill)
		var border := _border_mesh(polygon, canvas)
		add_child(border)
		var unit_label: Label = region.node.get_node_or_null("LabelGroup/UnitLabel")
		var anchor: Vector2 = region.center
		var font := number_font
		var ink := NUMBER_INK
		if unit_label != null:
			var native_anchor: Vector2 = canvas.base_map.to_local(unit_label.get_global_transform() * (unit_label.size * 0.5))
			if Geometry2D.is_point_in_polygon(native_anchor, polygon):
				anchor = native_anchor
			if unit_label.has_theme_font_override("font"):
				font = unit_label.get_theme_font("font")
			if unit_label.has_theme_color_override("font_color"):
				ink = unit_label.get_theme_color("font_color")
			if unit_label.label_settings != null:
				if unit_label.label_settings.font != null:
					font = unit_label.label_settings.font
				ink = unit_label.label_settings.font_color
		var marker_scale := clampf(minf(region.bounds.size.x, region.bounds.size.y) / 120.0, 0.79, 1.0)
		var marker_position: Vector3 = canvas.world_point(anchor) + Vector3(0, 0.74, 0)
		var label := Label3D.new()
		label.position = marker_position
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.pixel_size = 0.0059 * marker_scale
		label.font_size = 96
		label.outline_size = 3
		label.modulate = ink
		label.outline_modulate = Color("#ffeecc")
		label.font = font
		label.no_depth_test = true
		label.hide()
		add_child(label)
		var badge := MeshInstance3D.new()
		badge.mesh = badge_mesh
		badge.scale = Vector3.ONE * marker_scale
		badge.extra_cull_margin = 0.8
		badge.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var badge_material := ShaderMaterial.new()
		badge_material.shader = surface_shader
		badge_material.set_shader_parameter("surface_layer", 2)
		badge.material_override = badge_material
		label.add_child(badge)
		var name_label := Label.new()
		name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		name_label.add_theme_font_override("font", username_font)
		name_label.add_theme_font_size_override("font_size", canvas.USERNAME_FONT_SIZE)
		name_label.add_theme_color_override("font_color", canvas.USERNAME_INK)
		name_label.add_theme_stylebox_override("normal", canvas.tag_style)
		name_label.hide()
		add_child(name_label)
		var surface := {"id": region.id, "fill": fill, "material": material, "border": border, "label": label,
			"marker_position": marker_position,
			"name_label": name_label, "badge": badge, "badge_scale": marker_scale, "uniforms": {},
			"bounds": crop, "name_width": 0.0,
			"focus": -1, "owner": "", "player_color": Color.TRANSPARENT}
		surfaces.append(surface)
		surface_by_region[region.id] = surface

## Call while handling a confirmed capture, before the military display synchronizes.
func show_headquarters_destruction(region: int) -> void:
	if not is_inside_tree() or not surface_by_region.has(region) or _headquarters_destructions.has(region):
		return
	var app: Node = map_canvas.app
	var winner: String = app.region_owner(region)
	if winner.is_empty() or not app.region_headquarters(region).is_empty():
		return
	var military: Node3D = map_canvas.military
	if not is_instance_valid(military):
		return
	var castle: Node3D = military.get_node_or_null("Headquarters_%d" % region)
	if castle == null or castle.is_queued_for_deletion():
		return
	var previous_owner: String = castle.get_meta(&"owner", "")
	if previous_owner.is_empty() or previous_owner == winner:
		return
	var model: MeshInstance3D = castle.get_node_or_null("CivicBuilding")
	if model == null or not model.is_visible_in_tree():
		return

	if _headquarters_smoke_mesh == null:
		_make_headquarters_destruction_meshes()
	var effect := Node3D.new()
	effect.name = "HeadquartersDestruction_%d" % region
	add_child(effect)
	effect.global_transform = castle.global_transform
	# Keep the defeated owner's visual mesh and tint after the live HQ disappears.
	var collapsing := model.duplicate(0) as MeshInstance3D
	effect.add_child(collapsing)
	var debris := _headquarters_particles(effect, &"Debris", _headquarters_debris_mesh, HQ_DEBRIS_COUNT)
	var smoke := _headquarters_particles(effect, &"Smoke", _headquarters_smoke_mesh, HQ_SMOKE_COUNT)
	_headquarters_destructions[region] = {"effect": effect, "winner": winner, "age": 0.0,
		"model": collapsing, "model_pose": collapsing.transform, "debris": debris, "smoke": smoke}


func clear_headquarters_destruction() -> void:
	for region in _headquarters_destructions.keys():
		_remove_headquarters_destruction(region)


func _exit_tree() -> void:
	clear_headquarters_destruction()


func _remove_headquarters_destruction(region: int) -> void:
	var effect: Node3D = _headquarters_destructions[region].effect
	effect.hide()
	effect.queue_free()
	_headquarters_destructions.erase(region)


func _make_headquarters_destruction_meshes() -> void:
	var masonry := StandardMaterial3D.new()
	masonry.vertex_color_use_as_albedo = true
	masonry.roughness = 1.0
	_headquarters_debris_mesh = BoxMesh.new()
	_headquarters_debris_mesh.size = Vector3(0.105, 0.08, 0.09)
	_headquarters_debris_mesh.material = masonry

	var softness := Gradient.new()
	softness.offsets = PackedFloat32Array([0.0, 0.34, 0.68, 1.0])
	softness.colors = PackedColorArray([Color.WHITE, Color(1, 1, 1, 0.78), Color(1, 1, 1, 0.28), Color.TRANSPARENT])
	var plume := GradientTexture2D.new()
	plume.gradient = softness
	plume.fill = GradientTexture2D.FILL_RADIAL
	plume.fill_from = Vector2(0.5, 0.5)
	plume.fill_to = Vector2(1.0, 0.5)
	var soot := StandardMaterial3D.new()
	soot.albedo_texture = plume
	soot.vertex_color_use_as_albedo = true
	soot.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	soot.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	soot.render_priority = -1
	soot.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	soot.billboard_keep_scale = true
	_headquarters_smoke_mesh = QuadMesh.new()
	_headquarters_smoke_mesh.material = soot


func _headquarters_particles(effect: Node3D, label: StringName, mesh: Mesh, count: int) -> MultiMesh:
	var particles := MultiMesh.new()
	particles.transform_format = MultiMesh.TRANSFORM_3D
	particles.use_colors = true
	particles.mesh = mesh
	particles.instance_count = count
	particles.visible_instance_count = 0
	var batch := MultiMeshInstance3D.new()
	batch.name = label
	batch.multimesh = particles
	batch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	batch.custom_aabb = AABB(Vector3(-2.0, -0.5, -2.0), Vector3(4.0, 3.0, 4.0))
	effect.add_child(batch)
	return particles


func _advance_headquarters_destruction(delta: float, owners: Dictionary) -> void:
	if _headquarters_destructions.is_empty():
		return
	if map_canvas.app.rules.round_phase() == "staging":
		clear_headquarters_destruction()
		return
	for region in _headquarters_destructions.keys():
		var effect: Dictionary = _headquarters_destructions[region]
		effect.age += delta
		if effect.age >= HQ_DESTRUCTION_SECONDS or owners.get(region) != effect.winner:
			_remove_headquarters_destruction(region)
			continue
		_animate_headquarters_destruction(effect, effect.age)


func _animate_headquarters_destruction(effect: Dictionary, age: float) -> void:
	var collapse := smoothstep(0.10, 0.87, age)
	var pose: Transform3D = effect.model_pose
	var shake := sin(age * 51.0) * (1.0 - collapse)
	pose.basis = Basis(Vector3(0.22, 0.0, 1.0).normalized(), 0.31 * collapse + 0.055 * shake) * pose.basis
	pose.basis = pose.basis.scaled(Vector3(1.0, 1.0 - 0.58 * collapse, 1.0))
	pose.origin += Vector3(0.075 * collapse + 0.026 * shake, -0.40 * collapse, 0.0)
	effect.model.transform = pose
	effect.model.visible = age < 0.83

	var debris: MultiMesh = effect.debris
	debris.visible_instance_count = HQ_DEBRIS_COUNT if age < 1.22 else 0
	for index in debris.visible_instance_count:
		var angle := float(index) * 2.39996
		var travel := maxf(0.0, age - 0.05 - float(index % 3) * 0.04)
		var speed := 0.55 + 0.16 * float(index % 4)
		var height := maxf(0.035, 0.22 + (1.0 + speed) * travel - 3.2 * travel * travel)
		var distance := 0.20 + speed * minf(travel, 0.62)
		var point := Vector3(cos(angle) * distance, height, sin(angle) * distance)
		var size := (0.7 + 0.22 * float(index % 4)) * (1.0 - smoothstep(0.85, 1.22, age))
		var spin := Basis.from_euler(Vector3(angle, angle * 0.5, minf(travel, 0.62) * (4.0 + speed)))
		debris.set_instance_transform(index, Transform3D(spin.scaled(Vector3.ONE * size), point))
		debris.set_instance_color(index, Color("#d7c8a7").darkened(float(index % 4) * 0.12))

	var smoke: MultiMesh = effect.smoke
	# A low ring of dust gives way to the narrower rising smoke column.
	smoke.visible_instance_count = mini(HQ_SMOKE_COUNT, 1 + int(age / 0.056))
	for index in smoke.visible_instance_count:
		var drift_age := age - float(index) * 0.056
		var angle := float(index) * 2.39996
		var dust := index < 5
		var spread := 0.18 + drift_age * (0.60 if dust else 0.19)
		var lift := (0.10 + drift_age * 0.25) if dust else (0.39 + drift_age * 0.98)
		var point := Vector3(cos(angle) * spread + drift_age * 0.29, lift, sin(angle) * spread)
		var size := 0.45 + drift_age * (0.78 if dust else 0.43)
		var shape := Vector3(size, size * (0.70 if dust else 1.19), size)
		smoke.set_instance_transform(index, Transform3D(Basis.IDENTITY.scaled(shape), point))
		var shade := Color("#a08770") if dust else Color("#514b47")
		shade.a = smoothstep(0.0, 0.19, drift_age) * (1.0 - smoothstep(0.47, 1.35 if dust else 1.66, drift_age)) * 0.66
		smoke.set_instance_color(index, shade)

func _border_mesh(polygon: PackedVector2Array, canvas: Control) -> MeshInstance3D:
	var points := PackedVector2Array()
	for point in polygon:
		var world: Vector3 = canvas.world_point(point)
		var xz := Vector2(world.x, world.z)
		if points.is_empty() or not xz.is_equal_approx(points[-1]):
			points.append(xz)
	if points.size() > 1 and points[0].is_equal_approx(points[-1]):
		points.resize(points.size() - 1)
	var vertices := PackedVector3Array()
	var uv := PackedVector2Array()
	var offsets := PackedVector2Array()
	var triangles := PackedInt32Array()
	for index in points.size():
		var point := points[index]
		var next := (index + 1) % points.size()
		var before := (point - points[posmod(index - 1, points.size())]).orthogonal().normalized()
		var after := (points[next] - point).orthogonal().normalized()
		var join := (before + after).normalized()
		if join.is_zero_approx():
			join = after
		# Cap sharp joins while keeping the ribbon closed around concave corners.
		var half_width := 0.014 if canvas.base_map.has_meta("turkiye_atlas") else BORDER_HALF_WIDTH
		var offset := join * half_width / maxf(0.55, join.dot(after))
		for side: float in [-1.0, 1.0]:
			var edge := point + side * offset
			vertices.append(Vector3(edge.x, 0.019, edge.y))
			uv.append(Vector2(side, 0.0))
			offsets.append(side * offset)
		var a := index * 2
		var b := next * 2
		triangles.append_array(PackedInt32Array([a, b, a + 1, a + 1, b, b + 1]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_TEX_UV] = uv
	arrays[Mesh.ARRAY_TEX_UV2] = offsets
	arrays[Mesh.ARRAY_INDEX] = triangles
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.extra_cull_margin = 0.21
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := ShaderMaterial.new()
	material.shader = surface_shader
	material.set_shader_parameter("surface_layer", 1)
	instance.material_override = material
	return instance

func _set_fill(surface: Dictionary, parameter: StringName, value: Variant) -> void:
	if surface.uniforms.get(parameter) != value:
		surface.uniforms[parameter] = value
		surface.material.set_shader_parameter(parameter, value)

func _update_portrait_components(owners: Dictionary) -> void:
	if owners == portrait_owners:
		return
	portrait_owners = owners
	portrait_components.clear()
	var visited := {}
	for start in owners:
		var owner: String = owners[start]
		if owner.is_empty() or visited.has(start):
			continue
		var component: Array[int] = [start]
		var bounds: Rect2 = surface_by_region[start].bounds
		visited[start] = true
		var index := 0
		while index < component.size():
			var id := component[index]
			index += 1
			bounds = bounds.merge(surface_by_region[id].bounds)
			for neighbor in map_canvas.neighbors.get(id, []):
				if not visited.has(neighbor) and owners.get(neighbor, "") == owner:
					visited[neighbor] = true
					component.append(neighbor)
		portrait_components.append({"owner": owner, "ids": component, "bounds": bounds})

func _update_portraits() -> void:
	for component in portrait_components:
		# Use the best original for every polygon and sample it on the GPU.
		# Upscaling it on the main thread stalls the animation as portraits arrive.
		var display: Texture2D = map_canvas.regions[component.ids[0]].get("portrait")
		var bounds: Rect2 = component.bounds
		var ratio := Vector2.ONE
		if display != null:
			# Use the same world-space aspect and origin on every polygon in this component.
			var world_span := bounds.size * portrait_world_scale
			var relative_aspect := world_span.aspect() / display.get_size().aspect()
			ratio = Vector2(minf(1.0, relative_aspect), minf(1.0, 1.0 / relative_aspect))
		for id in component.ids:
			var surface: Dictionary = surface_by_region[id]
			_set_fill(surface, &"has_portrait", display != null)
			_set_fill(surface, &"portrait_texture", display)
			if display != null:
				_set_fill(surface, &"portrait_size", bounds.size)
				_set_fill(surface, &"portrait_center", bounds.get_center())
				_set_fill(surface, &"portrait_ratio", ratio)

func _set_focus(surface: Dictionary, focus: int, owner: String, player_color: Color) -> void:
	if surface.focus == focus and surface.owner == owner and surface.player_color == player_color:
		return
	surface.focus = focus
	surface.owner = owner
	surface.player_color = player_color
	var ink := BORDER_INK if not owner.is_empty() else NEUTRAL_BORDER_INK
	if owner.is_empty() and map_canvas.base_map.has_meta("turkiye_atlas"):
		ink = Color("#516355")
	var accent := player_color.lerp(Color("#fff1bc"), 0.44)
	var width := 1.0
	var lift := 0.0
	var elevation := 0.0
	match focus:
		Focus.SELECTED:
			accent = SELECTION
			width = 1.55
			elevation = 0.004
		Focus.REGION_SELECTED:
			ink = Color("#49310f")
			accent = REGION_SELECTION
			width = 2.9
			lift = 0.22
			elevation = 0.014
		Focus.OWNER_HOVER:
			width = 2.45
			lift = 0.075
			elevation = 0.008
		Focus.REGION_HOVER, Focus.NEUTRAL_HOVER:
			accent = HOVER_NEUTRAL if focus == Focus.NEUTRAL_HOVER else player_color.lerp(Color("#fffbed"), 0.72)
			ink = BORDER_INK
			width = 3.35
			lift = 0.18 if focus == Focus.NEUTRAL_HOVER else 0.12
			elevation = 0.012
	if atlas_mode:
		width = minf(width, 2.25 if focus == Focus.REGION_SELECTED else 1.85)
		lift *= 0.42
	var border_material: ShaderMaterial = surface.border.material_override
	border_material.set_shader_parameter("edge_ink", ink)
	border_material.set_shader_parameter("accent_color", accent)
	border_material.set_shader_parameter("border_scale", width)
	surface.border.position.y = elevation
	_set_fill(surface, &"hover_lift", lift)
	_set_fill(surface, &"accent_color", accent)
	var badge_material: ShaderMaterial = surface.badge.material_override
	badge_material.set_shader_parameter("accent_color", player_color.lerp(Color("#ffeec8"), 0.25))
	badge_material.set_shader_parameter("edge_ink", BORDER_INK)
	badge_material.set_shader_parameter("border_scale", width)

var markers_visible := true

func set_markers_visible(enabled: bool) -> void:
	markers_visible = enabled
	if not enabled:
		for surface in surfaces:
			surface.label.hide()
			surface.name_label.hide()

func _process(delta: float) -> void:
	if map_canvas == null:
		return
	var app: Node = map_canvas.app
	var hovered: int = map_canvas.hovered
	var hovered_owner: String = app.region_owner(hovered) if hovered >= 0 and hovered < map_canvas.regions.size() else ""
	var selected: String = app.selected_player
	var selected_region: Variant = map_canvas.get(&"selected_region")
	var eye := get_viewport().get_camera_3d()
	var viewport_rect := get_viewport().get_visible_rect()
	var fronts: Array[Dictionary] = map_canvas.battle_fronts()
	var players := {}
	var owners := {}
	for surface in surfaces:
		owners[surface.id] = app.region_owner(surface.id)
	_advance_headquarters_destruction(delta, owners)
	_update_portrait_components(owners)
	_update_portraits()
	var zoom_scale := 1.0 / maxf(1.0, map_canvas.zoom_factor / 1.25)
	for surface in surfaces:
		var region: Dictionary = map_canvas.regions[surface.id]
		var owner: String = owners[surface.id]
		for parameter in FILL_PARAMETERS:
			var value: Variant = region.material.get_shader_parameter(parameter)
			if value != null:
				_set_fill(surface, parameter, value)
		var front_opacity := 0.0
		for front in fronts:
			if surface.id not in front.formation_regions:
				continue
			if float(front.get("travel", 1.0)) < 1.0:
				continue
			front_opacity = smoothstep(0.012, 0.10, absf(float(front.control)))
			if front_opacity <= 0.0:
				continue
			_set_fill(surface, &"front_direction", front.direction)
			_set_fill(surface, &"front_threshold", front.formation_threshold)
			_set_fill(surface, &"attack_color", app.player_color(front.winner))
		_set_fill(surface, &"contested", front_opacity > 0.0)
		_set_fill(surface, &"front_opacity", front_opacity)
		var owned := not owner.is_empty()
		if not owned:
			_set_fill(surface, &"has_portrait", false)
			_set_fill(surface, &"portrait_texture", null)
		_set_fill(surface, &"atlas_neutral", not owned)
		var marker_position: Vector3 = surface.marker_position
		if app.has_method("region_headquarters") and not str(app.region_headquarters(surface.id)).is_empty():
			marker_position.y += HQ_BADGE_LIFT
		if not surface.label.position.is_equal_approx(marker_position):
			surface.label.position = marker_position
		var focus := Focus.NONE
		if surface.id == selected_region:
			focus = Focus.REGION_SELECTED
		elif surface.id == hovered:
			focus = Focus.REGION_HOVER if owned else Focus.NEUTRAL_HOVER
		elif owned and owner == hovered_owner:
			focus = Focus.OWNER_HOVER
		elif owned and owner == selected:
			focus = Focus.SELECTED
		if owned and not players.has(owner):
			var player: Dictionary = app.player_view(owner)
			players[owner] = {"color": app.player_color(owner), "number": str(player.number),
				"name": str(player.get("displayName", player.username))}
		if surface.label.visible != (owned and markers_visible):
			surface.label.visible = owned and markers_visible
		_set_focus(surface, focus, owner, players[owner].color if owned else Color.TRANSPARENT)
		if owned:
			var marker: Dictionary = players[owner]
			if surface.label.text != marker.number:
				surface.label.text = marker.number
				surface.badge.scale.x = surface.badge_scale * maxf(1.0, 0.49 + marker.number.length() * 0.25)
			var marker_scale := Vector3.ONE * zoom_scale
			if surface.label.scale != marker_scale:
				surface.label.scale = marker_scale
			if surface.name_label.text != marker.name:
				surface.name_label.text = marker.name
				surface.name_width = map_canvas.username_plate_width(username_font, marker.name)
	if markers_visible:
		_update_usernames(eye, viewport_rect)

func _update_usernames(eye: Camera3D, viewport_rect: Rect2) -> void:
	if eye == null:
		return
	var entries: Array[Dictionary] = []
	var basis := eye.get_camera_transform().basis
	for surface in surfaces:
		var map_region: Dictionary = map_canvas.regions[surface.id]
		if surface.owner.is_empty() or surface.name_label.text.is_empty():
			continue
		var marker: Label3D = surface.label
		var world_anchor := marker.global_position
		var anchor := eye.unproject_position(world_anchor)
		var badge := Rect2(anchor, Vector2.ZERO)
		if eye.is_position_behind(world_anchor) or not viewport_rect.has_point(anchor):
			anchor = _visible_outline_anchor(eye, map_region.display_polygon, viewport_rect)
			if not anchor.is_finite():
				continue
			badge.position = anchor
		else:
			var half_size: Vector2 = badge_mesh.size * Vector2(surface.badge.scale.x, surface.badge.scale.y) * marker.scale.x * 0.5
			var corner := basis.x * half_size.x - basis.y * half_size.y
			badge = Rect2(eye.unproject_position(world_anchor - corner), Vector2.ZERO)
			badge = badge.expand(eye.unproject_position(world_anchor + corner))
		entries.append({"id": surface.id, "anchor": anchor, "badge": badge, "width": surface.name_width})
	if entries != last_username_entries or viewport_rect != last_viewport_rect:
		username_plates = map_canvas.layout_username_plates(entries, viewport_rect)
		last_username_entries = entries
		last_viewport_rect = viewport_rect
	for surface in surfaces:
		var label: Label = surface.name_label
		label.visible = username_plates.has(surface.id)
		if label.visible:
			var rect: Rect2 = username_plates[surface.id]
			label.position = rect.position
			label.size = rect.size

func _visible_outline_anchor(eye: Camera3D, polygon: PackedVector2Array, viewport_rect: Rect2) -> Vector2:
	var projected := PackedVector2Array()
	var bounds := Rect2(eye.unproject_position(map_canvas.world_point(polygon[0])), Vector2.ZERO)
	for point in polygon:
		var position := eye.unproject_position(map_canvas.world_point(point))
		projected.append(position)
		bounds = bounds.expand(position)
	if not viewport_rect.intersects(bounds):
		return Vector2.INF
	var viewport_outline := PackedVector2Array([viewport_rect.position,
		Vector2(viewport_rect.end.x, viewport_rect.position.y), viewport_rect.end,
		Vector2(viewport_rect.position.x, viewport_rect.end.y)])
	for visible_part in Geometry2D.intersect_polygons(projected, viewport_outline):
		var triangle := Geometry2D.triangulate_polygon(visible_part)
		if triangle.size() >= 3:
			return (visible_part[triangle[0]] + visible_part[triangle[1]] + visible_part[triangle[2]]) / 3.0
	return Vector2.INF
