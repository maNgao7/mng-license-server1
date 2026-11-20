extends "MapCanvas.gd"

var paper_view: SubViewport
var stage_view: SubViewport
var stage_container: SubViewportContainer
var eye: Camera3D
var military: Node3D
var territory_surface: Node3D
var attack_view: SubViewport
var attack_world: Node2D
var native_attack: Node2D
var attack_overlay: MeshInstance3D
var map_hud: Control
var rotor_audio: Node
var selected_region := -1
var pan_world := Vector3.ZERO
var view_rotation := 0.0
var _tilt_override := -1.0
var _view_keys: Dictionary = {}
var fit_distance := 18.0
var fit_center := Vector3.ZERO
var fit_basis := Basis.IDENTITY
var land_hull := PackedVector2Array()
const BOARD_WIDTH := 26.0
const BOARD_HEIGHT := 16.0
const PAN_LIMIT := Vector3(BOARD_WIDTH * 0.5, 0.0, BOARD_HEIGHT * 0.5)
const FIT_INSET := 0.02
const ATLAS_FIT_INSET := 0.04
const COMPACT_PITCH := 74.0
const WIDE_PITCH := 57.0
const ULTRAWIDE_PITCH := 50.0
const MIN_PITCH := 32.0
const MAX_PITCH := 82.0
const MIN_ZOOM := 0.70
const MAX_ZOOM := 4.0
const MAX_ATLAS_ZOOM := 6.0

func configure(owner_app: Node, original_map: Node2D, territory_nodes: Array[Node]) -> void:
	super.configure(owner_app, original_map, territory_nodes)
	var land_vertices := PackedVector2Array()
	for region in regions:
		land_vertices.append_array(region.polygon)
	land_hull = Geometry2D.convex_hull(land_vertices)
	paper_view = SubViewport.new()
	paper_view.size = Vector2i(3840, 2160)
	paper_view.transparent_bg = true
	paper_view.render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(paper_view)
	world.reparent(paper_view, false)
	world.transform = Transform2D.IDENTITY
	paper_view.canvas_transform = Transform2D(Vector2(2, 0), Vector2(0, 2), Vector2.ZERO)
	var atlas_labels := Node2D.new()
	world.add_child(atlas_labels)
	for caption in continent_titles:
		var label: Label = app.text(atlas_labels, caption.text, 24, Color("#352b20"))
		label.add_theme_color_override("font_outline_color", Color("#e5d5b6"))
		label.add_theme_constant_override("outline_size", 4)
		label.size.x = 420
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.position = caption.position - Vector2(210, 16)
	stage_container = SubViewportContainer.new()
	stage_container.stretch = true
	stage_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(stage_container)
	stage_container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	stage_view = SubViewport.new()
	stage_view.size = Vector2i(maxi(1, int(size.x)), maxi(1, int(size.y)))
	stage_view.own_world_3d = true
	stage_view.transparent_bg = true
	stage_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	stage_view.msaa_3d = Viewport.MSAA_4X
	stage_container.add_child(stage_view)
	var board := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(BOARD_WIDTH, BOARD_HEIGHT)
	board.mesh = plane
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	material.albedo_texture = paper_view.get_texture()
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	board.material_override = material
	stage_view.add_child(board)
	var scenery := preload("TurkiyeScenery.gd").new()
	stage_view.add_child(scenery)
	scenery.configure(self, original_map.get_meta("turkiye_atlas"))
	var lamp := DirectionalLight3D.new()
	lamp.rotation_degrees = Vector3(-60, -24, 0)
	lamp.light_energy = 1.4
	stage_view.add_child(lamp)
	var ambience := WorldEnvironment.new()
	var environment := Environment.new()
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#cbd7df")
	environment.ambient_light_energy = 0.65
	ambience.environment = environment
	stage_view.add_child(ambience)
	territory_surface = load(app.mod_root.path_join("TerritorySurface.gd")).new()
	stage_view.add_child(territory_surface)
	territory_surface.configure(self)
	_create_attack_layer()
	military = load(app.mod_root.path_join("MilitaryLayer.gd")).new()
	stage_view.add_child(military)
	military.configure(self)
	eye = Camera3D.new()
	eye.fov = 55.0
	eye.keep_aspect = Camera3D.KEEP_HEIGHT
	eye.near = 0.1
	eye.far = 200.0
	stage_view.add_child(eye)
	eye.make_current()
	stage_view.size_changed.connect(fit_map)
	map_hud = load(app.mod_root.path_join("MapHud.gd")).new()
	add_child(map_hud)
	map_hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	map_hud.configure(self)
	rotor_audio = load(app.mod_root.path_join("RotorAudio.gd")).new()
	add_child(rotor_audio)
	rotor_audio.configure(self)
	fit_map()

func _create_attack_layer() -> void:
	attack_view = SubViewport.new()
	attack_view.size = paper_view.size
	attack_view.transparent_bg = true
	attack_view.disable_3d = true
	attack_view.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(attack_view)
	attack_world = Node2D.new()
	attack_view.add_child(attack_world)
	attack_view.canvas_transform = paper_view.canvas_transform
	native_attack = load(app.mod_root.path_join("NativeAttack.gd")).new()
	attack_world.add_child(native_attack)
	if not native_attack.configure(self):
		push_error(native_attack.resource_error)
	var bus_name := &"TikMnG Combat"
	if AudioServer.get_bus_index(bus_name) < 0:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)
		AudioServer.set_bus_send(AudioServer.bus_count - 1, &"Master")
	native_attack.set_audio_enabled(true, -9.0, bus_name)
	var plane := PlaneMesh.new()
	plane.size = Vector2(BOARD_WIDTH, BOARD_HEIGHT)
	attack_overlay = MeshInstance3D.new()
	attack_overlay.mesh = plane
	attack_overlay.position.y = 0.035
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	material.albedo_texture = attack_view.get_texture()
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	attack_overlay.material_override = material
	attack_overlay.hide()
	stage_view.add_child(attack_overlay)

func _process(delta: float) -> void:
	if not _view_keys.is_empty():
		if not _keyboard_view_allowed():
			_view_keys.clear()
		else:
			apply_keyboard_view(float(_view_keys.has(KEY_RIGHT)) - float(_view_keys.has(KEY_LEFT)),
				float(_view_keys.has(KEY_UP)) - float(_view_keys.has(KEY_DOWN)), delta)
	super._process(delta)
	if attack_overlay == null:
		return
	var show_effects := not battle_fronts().is_empty()
	if attack_overlay.visible != show_effects:
		attack_overlay.visible = show_effects
		attack_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS if show_effects else SubViewport.UPDATE_DISABLED

func fit_map() -> void:
	fit_scale = maxf(0.3, size.x / 2050.0)
	if eye == null or land_hull.is_empty():
		return
	# The container owns the render size and emits size_changed when layout settles.
	var viewport_size := stage_view.get_visible_rect().size
	if viewport_size.x < 2 or viewport_size.y < 2:
		return
	_compute_fit(viewport_size)
	_apply_transform()

func _compute_fit(viewport_size: Vector2) -> void:
	var aspect := viewport_size.aspect()
	var wide := inverse_lerp(1.3, 16.0 / 9.0, aspect)
	var default_pitch := clampf(lerpf(COMPACT_PITCH, WIDE_PITCH, wide), ULTRAWIDE_PITCH, COMPACT_PITCH)
	var pitch := deg_to_rad(_tilt_override if _tilt_override >= 0.0 else default_pitch)
	var direction := Vector3(sin(view_rotation) * cos(pitch), sin(pitch), cos(view_rotation) * cos(pitch))
	fit_basis = Basis.looking_at(-direction)
	var to_camera := fit_basis.transposed()
	var inset_fraction := ATLAS_FIT_INSET if base_map.has_meta("turkiye_atlas") else FIT_INSET
	var inset := minf(viewport_size.x, viewport_size.y) * inset_fraction
	var slopes := tan(deg_to_rad(eye.fov) * 0.5) * Vector2(aspect, 1.0)
	slopes *= Vector2.ONE - Vector2.ONE * (2.0 * inset) / viewport_size

	# For each camera-space axis, a hull point fits when
	# abs(point - camera_center) <= slope * (camera_depth - point.z).
	var outline := PackedVector3Array()
	var lower := Vector2(-INF, -INF)
	var upper := Vector2(INF, INF)
	var depth := -INF
	for point in land_hull:
		var camera_point := to_camera * world_point(point)
		outline.append(camera_point)
		var xy := Vector2(camera_point.x, camera_point.y)
		lower = lower.max(xy + slopes * camera_point.z)
		upper = upper.min(xy - slopes * camera_point.z)
		depth = maxf(depth, camera_point.z + eye.near)
	var required_depth := (lower - upper) / (2.0 * slopes)
	depth = maxf(depth, maxf(required_depth.x, required_depth.y)) + 0.001
	lower -= slopes * depth
	upper += slopes * depth

	# Choose the center within those limits that balances the projected margins.
	# Perspective gives near and far vertices different screen weights.
	for iteration in 12:
		var center := (lower + upper) * 0.5
		var low := Vector2(INF, INF)
		var high := Vector2(-INF, -INF)
		for point in outline:
			var projected := (Vector2(point.x, point.y) - center) / (depth - point.z)
			low = low.min(projected)
			high = high.max(projected)
		for axis in 2:
			if low[axis] + high[axis] > 0.0:
				lower[axis] = center[axis]
			else:
				upper[axis] = center[axis]
	var center := (lower + upper) * 0.5
	var camera_position := fit_basis * Vector3(center.x, center.y, depth)
	# Keep the optical center on the ground so picking, panning and zoom agree.
	fit_distance = camera_position.y / direction.y
	var next_center := camera_position - direction * fit_distance
	next_center.y = 0.0
	if pan_world.is_equal_approx(fit_center):
		pan_world = next_center
	fit_center = next_center

func _apply_transform() -> void:
	world.transform = Transform2D.IDENTITY
	if eye == null:
		return
	pan_world = pan_world.clamp(-PAN_LIMIT, PAN_LIMIT)
	eye.transform = Transform3D(fit_basis, pan_world + fit_basis.z * fit_distance / zoom_factor)

func _ground_at(position: Vector2) -> Variant:
	if eye == null or not position.is_finite():
		return null
	var origin := eye.project_ray_origin(position)
	var ray := eye.project_ray_normal(position)
	return Plane(Vector3.UP, 0.0).intersects_ray(origin, ray)

func map_point(position: Vector2) -> Vector2:
	var hit: Variant = _ground_at(position)
	if hit == null:
		return Vector2(-10000, -10000)
	return Vector2((hit.x / BOARD_WIDTH + 0.5) * 1920.0, (hit.z / BOARD_HEIGHT + 0.5) * 1080.0)

func project_map_point(point: Vector2) -> Vector2:
	return eye.unproject_position(world_point(point))

func world_point(point: Vector2) -> Vector3:
	return Vector3((point.x / 1920.0 - 0.5) * BOARD_WIDTH, 0, (point.y / 1080.0 - 0.5) * BOARD_HEIGHT)

func reset_view() -> void:
	zoom_factor = 1.0
	pan_world = fit_center
	map_offset = Vector2.ZERO
	view_rotation = 0.0
	_tilt_override = -1.0
	fit_map()

func rotate_view(radians: float) -> void:
	view_rotation += radians
	fit_map()

func set_view_tilt(degrees: float) -> void:
	if is_finite(degrees):
		_tilt_override = clampf(degrees, MIN_PITCH, MAX_PITCH)
		fit_map()

func apply_keyboard_view(horizontal: float, vertical: float, delta: float) -> void:
	if eye == null or not is_finite(delta) or delta <= 0.0 or (is_zero_approx(horizontal) and is_zero_approx(vertical)):
		return
	var step := minf(delta, 0.05)
	view_rotation += clampf(horizontal, -1.0, 1.0) * 0.72 * step
	if not is_zero_approx(vertical):
		var pitch := _tilt_override if _tilt_override >= 0.0 else -eye.rotation_degrees.x
		_tilt_override = clampf(pitch + clampf(vertical, -1.0, 1.0) * 26.0 * step, MIN_PITCH, MAX_PITCH)
		app.settings.cameraTilt = _tilt_override
	fit_map()

func _keyboard_view_allowed() -> bool:
	if not get_window().has_focus():
		return false
	var focus := get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit or focus is Range or focus is OptionButton:
		return false
	for child in app.ui.get_children():
		if child is Window and child.visible:
			return false
	return app.victory_scene == null or not app.victory_scene.visible

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or event.keycode not in [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT]:
		return
	if not event.pressed:
		_view_keys.erase(event.keycode)
		return
	if not _keyboard_view_allowed():
		_view_keys.clear()
		return
	_view_keys[event.keycode] = true
	get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		_view_keys.clear()

func change_zoom(multiplier: float, at: Vector2) -> void:
	if eye == null or multiplier <= 0.0 or not is_finite(multiplier):
		return
	var limit := MAX_ATLAS_ZOOM if base_map.has_meta("turkiye_atlas") else MAX_ZOOM
	var next_zoom := clampf(zoom_factor * multiplier, MIN_ZOOM, limit)
	if next_zoom == zoom_factor:
		return
	var before: Variant = _ground_at(at)
	zoom_factor = next_zoom
	_apply_transform()
	var after: Variant = _ground_at(at)
	if before is Vector3 and after is Vector3:
		pan_world += before - after
		_apply_transform()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			dragging = event.pressed
		elif event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			change_zoom(1.13 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.13, event.position)
		elif event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			map_hud.handle_map_click(region_at(event.position), event.position)
	elif event is InputEventMouseMotion:
		hovered = region_at(event.position)
		if dragging:
			var previous: Variant = _ground_at(event.position - event.relative)
			var current: Variant = _ground_at(event.position)
			if previous is Vector3 and current is Vector3:
				pan_world += previous - current
				_apply_transform()
	queue_redraw()
