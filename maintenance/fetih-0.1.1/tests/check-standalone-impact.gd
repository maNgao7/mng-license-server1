extends SceneTree
## Run with the standalone project, a fresh TIKMNG_ANIMAL_PROFILE and --self-test.
## Optional --impact-output=<dir> saves wide and close views for visual review.

const BATTLE_ID := "qa_impact"
const FLASH_TIME := 0.12
const SMOKE_TIME := 0.72

var failures := 0
var capture_dir := ""


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var args := OS.get_cmdline_user_args()
	if "--self-test" not in args or OS.get_environment("TIKMNG_ANIMAL_PROFILE").is_empty() or DisplayServer.get_name() == "headless":
		printerr("STANDALONE_IMPACT_FAIL: requires the graphical standalone project, --self-test and a fresh profile")
		quit(1)
		return
	for arg in args:
		if arg.begins_with("--impact-output="):
			capture_dir = arg.trim_prefix("--impact-output=")
			DirAccess.make_dir_recursive_absolute(capture_dir)
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	var canvas: Control = app.canvas
	if canvas == null or canvas.native_attack == null:
		printerr("STANDALONE_IMPACT_FAIL: no map effect layer")
		quit(1)
		return
	var adapter: Node2D = canvas.native_attack
	adapter.set_audio_enabled(false)
	app.set_process(false)
	canvas.military.set_process(false)
	adapter.set_process(false)
	await process_frame
	await process_frame
	canvas.reset_view()
	canvas.set_process(false)
	canvas.map_hud.set_process(false)
	canvas.map_hud.update_hover_card({})
	check(app.rules.round_phase() == "staging" and canvas.battle_fronts().is_empty(), "cold staging starts with no battle")
	var state: Dictionary = adapter.debug_state()
	check(state.ready and state.native_frame_count == 15 and state.get("frame_pattern") == "res://assets/effects/impact-%02d.png",
		"standalone uses the fifteen packaged fallback frames")
	if not state.ready:
		quit(1)
		return
	canvas.attack_overlay.show()
	canvas.attack_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	# Feed one fixed front directly so gameplay polling cannot move the test point.
	adapter.map_canvas = null
	var region: Dictionary = canvas.regions[10]
	var anchor: Vector2 = region.center.lerp(region.polygon[0], 0.50)
	var fronts := [{"id": BATTLE_ID, "points": PackedVector2Array([anchor]), "travel": 0.8}]
	adapter.sync_fronts(fronts)
	check(adapter.debug_state().battle_count == 0, "deployment creates no impact before arrival")
	fronts[0].travel = 1.0
	adapter.sync_fronts(fronts)
	var slot: Node2D = adapter.get_node("Front_%08x" % BATTLE_ID.hash()).get_child(1)
	var smoke: Sprite2D = slot.get_child(0)
	var flash: AnimatedSprite2D = slot.get_child(1)
	check(slot.position == anchor and adapter.debug_state().sprite_count == 2, "the bounded pair stays on the caller's map point")

	# Freeze the exact phases for the wide and 2.8x views. The viewport plane and
	# the game's Camera3D still perform the real canvas-to-screen projection.
	step_to(adapter, FLASH_TIME)
	await RenderingServer.frame_post_draw
	var center: Vector2 = canvas.attack_view.canvas_transform * anchor
	var layer: Image = canvas.attack_view.get_texture().get_image()
	var flash_pixel := layer.get_pixelv(Vector2i(center))
	check(flash.visible and not smoke.visible and flash_pixel.a > 0.70 and flash_pixel.g > 0.57 and flash_pixel.b > 0.27,
		"a readable bright core precedes smoke")
	check(flash.scale.x * flash.sprite_frames.get_frame_texture(flash.animation, flash.frame).get_width() <= 56.0,
		"the flash quad stays within 56 map units")
	await capture_pair(canvas, anchor, "flash")

	var frozen: Dictionary = adapter.debug_state()
	adapter.set_effects_paused(true)
	adapter.advance(0.1)
	adapter.set_effects_paused(false)
	check(adapter.debug_state() == frozen, "pause freezes the same flash frame and front point")
	step_to(adapter, SMOKE_TIME)
	await RenderingServer.frame_post_draw
	layer = canvas.attack_view.get_texture().get_image()
	var smoke_center: Vector2 = canvas.attack_view.canvas_transform * (anchor + smoke.position)
	var smoke_pixel := layer.get_pixelv(Vector2i(smoke_center))
	check(not flash.visible and smoke.visible and smoke.position.y < 0.0 and smoke_pixel.a > 0.40 and smoke_pixel.r < 0.48,
		"the blast gives way to rising soot")
	await capture_pair(canvas, anchor, "smoke")

	step_to(adapter, 1.8)
	check(not flash.visible and not smoke.visible, "the end of the cycle has a quiet interval")
	adapter.sync_fronts([])
	await RenderingServer.frame_post_draw
	check(adapter.debug_state().sprite_count == 0 and adapter.debug_state().battle_count == 0,
		"clearing the last front removes both sprites")
	app.free()
	if failures == 0:
		print("FETIH_STANDALONE_IMPACT_OK")
	quit(0 if failures == 0 else 1)


func step_to(adapter: Node2D, age: float) -> void:
	var current: float = adapter.debug_state().fronts[0].age
	while current < age - 0.00001:
		var step := minf(0.1, age - current)
		adapter.advance(step)
		current += step


func capture_pair(canvas: Control, anchor: Vector2, name: String) -> void:
	for zoom in [1.0, 2.8]:
		if zoom > 1.0:
			canvas.pan_world = canvas.world_point(anchor)
			canvas.zoom_factor = zoom
			canvas._apply_transform()
		canvas.attack_overlay.hide()
		await RenderingServer.frame_post_draw
		var stage: SubViewport = canvas.stage_view
		var bare := stage.get_texture().get_image()
		canvas.attack_overlay.show()
		await RenderingServer.frame_post_draw
		var camera: Camera3D = canvas.eye
		var center := camera.unproject_position(canvas.world_point(anchor) + Vector3.UP * canvas.attack_overlay.position.y)
		var rendered := stage.get_texture().get_image()
		var area := Rect2i(Vector2i(center) - Vector2i(36, 36), Vector2i(73, 73)).intersection(Rect2i(Vector2i.ZERO, rendered.get_size()))
		var changed := 0
		for y in range(area.position.y, area.end.y):
			for x in range(area.position.x, area.end.x):
				var diff := rendered.get_pixel(x, y) - bare.get_pixel(x, y)
				if maxf(absf(diff.r), maxf(absf(diff.g), absf(diff.b))) > 0.08:
					changed += 1
		check(changed >= 4, "%s renders on the map at %.1fx" % [name, zoom])
		if not capture_dir.is_empty():
			var shot := root.get_texture().get_image()
			check(shot.save_png(capture_dir.path_join("%s-%.1fx.png" % [name, zoom])) == OK, "comparison capture saved")
	canvas.reset_view()


func check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		printerr("STANDALONE_IMPACT_FAIL: " + message)
