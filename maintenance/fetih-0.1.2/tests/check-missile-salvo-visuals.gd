extends SceneTree
## Use --self-test --capture=<absolute directory> for GL Compatibility screenshots.
## The Windows profile for this test is isolated from the production profile.

const Salvo = preload("../mod/MissileSalvo.gd")
var _failures := 0
var _capture_dir := ""
var _events: Array[StringName] = []
var _app: Node
var _board: Control
var _effect: Salvo
var _eye: Camera3D
var _offset := Vector2(0.043, -0.026)


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if "--self-test" not in args or not profile.get_file().begins_with("missile-visual-"):
		push_error("Use --self-test with an isolated missile-visual-* profile.")
		quit(1)
		return
	for arg in args:
		if arg.begins_with("--capture=") and DisplayServer.get_name() != "headless":
			_capture_dir = arg.trim_prefix("--capture=")
	if not _capture_dir.is_empty():
		DirAccess.make_dir_recursive_absolute(_capture_dir)

	_app = load("res://mod/LiveWar.gd").new()
	_app.mod_root = "res://mod"
	root.add_child(_app)
	_app.set_process(false)
	await process_frame
	_attach()
	var before: Dictionary = _app.rules.view_state().duplicate(true)
	_check(not _effect.play([-1], [1]) and _events.is_empty(), "invalid region IDs do not start a salvo")
	_check(_effect.play([0, 5, 9, 13, 13], [2, 4, 8, 11]), "valid region IDs start a salvo")
	_effect.set_process(false)
	_check(_effect._flights.size() == 4 and _effect._sources.size() == 4, "deduplicated sources get individual flights")
	_check(_events == [&"launched"], "only launch has signaled before flight")
	_effect._process(0.46)
	await _capture("01-launch")
	_effect._process(0.98)
	await _capture("02-camera-pass")

	var before_pause := _effect._elapsed
	_app.state.phase = "paused"
	_effect._process(4.0)
	_check(_effect._elapsed == before_pause and _events == [&"launched"], "app pause freezes the timeline")
	_app.state.phase = before.phase
	_effect._process(1.30)
	_check(_events == [&"launched", &"impact"], "single impact at the shared boundary")
	_check(_effect._hulls.visible_instance_count == 0 and _effect._cracks.visible_instance_count == 4,
		"all four impact sites start on the same frame")
	_check(_current_offset().distance_to(_offset) >= 0.045, "impact starts with a strong, visible offset")
	_effect._process(0.23)
	await _capture("03-synchronized-impact")
	_effect._process(0.37)
	_check(_current_offset().distance_to(_offset) > 0.002, "impact shake continues beyond half a second")
	_effect._process(0.43)
	await _capture("04-cooling-fissures")
	_check(_current_offset().is_equal_approx(_offset), "shake returns to the original nonzero offsets")
	_effect._process(2.0)
	_check(_events == [&"launched", &"impact", &"finished"] and _all_clear(), "completion signals once and clears every batch")
	_check(_app.rules.view_state() == before, "the presentation never alters game state")

	_events.clear()
	_board.pan_world = _board.world_point(_board.regions[7].center)
	_board.zoom_factor = 3.1
	_board.set_view_tilt(48.0)
	_board.rotate_view(0.24)
	_check(_effect.play([2, 9], [7, 8]), "zoomed playback starts")
	_effect.set_process(false)
	_effect._process(1.28)
	await _capture("05-close-camera-pass")
	_effect._process(1.40)
	_effect._process(0.31)
	await _capture("06-close-impact")
	_effect.cancel()
	_check(_all_clear() and _current_offset().is_equal_approx(_offset)
		and _events == [&"launched", &"impact"], "cancel during shake is silent and immediately restores offsets")
	_events.clear()
	_check(_effect.play([2], [7]), "effect can replay after cancellation")
	_effect.cancel()
	_check(_all_clear() and _events == [&"launched"], "cancel before impact emits neither terminal signal")

	_check(_app._switch_map("world"), "the real world board loads")
	await process_frame
	_attach()
	var all_regions := range(_board.regions.size())
	_check(all_regions.size() == Salvo.MAX_REGIONS, "world board has 34 regions")
	_check(_effect.play(all_regions, all_regions) and _effect._flights.size() == Salvo.MAX_REGIONS,
		"stress case uses one flight per region")
	_effect.set_process(false)
	_effect._process(1.39)
	await _capture("07-world-34-flight")
	var peak_update_ms := 0.0
	for _frame in 70:
		var started := Time.get_ticks_usec()
		_effect._process(1.0 / 60.0)
		peak_update_ms = maxf(peak_update_ms, (Time.get_ticks_usec() - started) / 1000.0)
	_effect._process(0.07)
	_check(_effect._cracks.visible_instance_count == Salvo.MAX_REGIONS, "all 34 targets begin impact together")
	_effect._process(0.26)
	await _capture("08-world-34-impact")
	_effect.cancel()
	_check(_all_clear(), "34-region stress case clears every batch")
	print("MISSILE_VISUAL_QA: failures=%d peak_visual_update_ms=%.2f renderer=%s" %
		[_failures, peak_update_ms, RenderingServer.get_current_rendering_method()])
	_app.free()
	quit(0 if _failures == 0 else 1)


func _attach() -> void:
	_board = _app.canvas
	_eye = _board.eye
	_eye.h_offset = _offset.x
	_eye.v_offset = _offset.y
	_effect = Salvo.new()
	_board.stage_view.add_child(_effect)
	_effect.setup(_board)
	_effect.launched.connect(func() -> void: _events.append(&"launched"))
	_effect.impact.connect(func() -> void: _events.append(&"impact"))
	_effect.finished.connect(func() -> void: _events.append(&"finished"))


func _current_offset() -> Vector2:
	return Vector2(_eye.h_offset, _eye.v_offset)


func _all_clear() -> bool:
	for child in _effect.get_children():
		if child is MultiMeshInstance3D and child.multimesh.visible_instance_count > 0:
			return false
	return not _effect.is_processing()


func _check(passed: bool, message: String) -> void:
	if not passed:
		_failures += 1
		push_error(message)


func _capture(label: String) -> void:
	if _capture_dir.is_empty():
		return
	for _frame in 3:
		await RenderingServer.frame_post_draw
	var screenshot := root.get_texture().get_image()
	_check(screenshot != null and screenshot.save_png(_capture_dir.path_join(label + ".png")) == OK,
		"capture " + label)
