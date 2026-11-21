extends SceneTree
## Run with GL Compatibility, --fixed-fps 60, and --self-test.
## Set TIKMNG_ANIMAL_PROFILE to an isolated missile-stress-* directory.

const STEP := 1.0 / 60.0
const ARMIES := 8
const TROOPS := 50000
const Salvo := preload("../mod/MissileSalvo.gd")
const Military := preload("../mod/MilitaryLayer.gd")

var _app: Node
var _board: Control
var _effect: Salvo
var _layer: Military
var _targets: Array
var _failures := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not profile.get_file().begins_with("missile-stress-") or "--self-test" not in OS.get_cmdline_user_args() \
			or DisplayServer.get_name() == "headless" or RenderingServer.get_current_rendering_method() != "gl_compatibility":
		push_error("Use GL Compatibility and --self-test with an isolated missile-stress-* profile.")
		quit(1)
		return
	_app = load("res://mod/LiveWar.gd").new()
	_app.mod_root = "res://mod"
	root.add_child(_app)
	_app.set_process(false)
	await process_frame
	_check(_app.map_id == "world" or _app._switch_map("world"), "world board loads")
	await process_frame
	_board = _app.canvas
	_layer = _board.military
	_layer.set_process(false)
	root.size = Vector2i(1280, 800)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	_targets = range(_board.regions.size())
	_check(_targets.size() == 34, "world board has 34 regions")
	for index in ARMIES:
		var id := _army(index)
		var credit: Dictionary = _app.rules.accept_event({"eventId": id, "participantId": id,
			"username": id, "completedCount": 1, "coinValue": TROOPS / 50})
		_check(credit.ok and _app.unit_counts(id).soldiers == TROOPS, "seed %s with %d troops" % [id, TROOPS])
	for region: int in _targets:
		_check(_app.rules.claim_region(_army(region % ARMIES), region).ok, "occupy region %d" % region)
	_app._refresh()
	_effect = Salvo.new()
	_board.stage_view.add_child(_effect)
	_effect.setup(_board)
	await _sample("warmup", true, false)
	for index in 2:
		await _sample("garrison-%d" % (index + 1), false)
	_check(_layer._infantry_reserves.visible_instance_count == 180, "dense garrison renders all 180 reserve infantry")
	_app.rules.set_battle_seconds(120.0)
	for index in range(0, ARMIES, 2):
		_check(_app._issue_attack(_army(index), _army(index + 1), -1, -1, true).ok, "launch battle %d" % index)
	_app._refresh()
	# Move the real battles past their deployment while keeping a long measured combat window.
	_app._process(10.0)
	await _sample("battle-warmup", false, false)
	for index in 2:
		await _sample("battle-%d" % (index + 1), true)
	_check(_board.battle_fronts().size() == ARMIES / 2, "four battles remain active")
	_check(_layer._infantry_orders.size() == 180, "all 180 reserve infantry remain mobilized")
	print("MISSILE_GL_STRESS: failures=%d viewport=%s renderer=%s device=%s" % [_failures, _board.stage_view.size,
		RenderingServer.get_current_rendering_method(), RenderingServer.get_video_adapter_name()])
	_app.free()
	quit(int(_failures > 0))


func _sample(label: String, salvo: bool, report := true) -> void:
	if salvo:
		_check(_effect.play(range(0, _targets.size(), 4), _targets), "34-flight salvo starts")
		_effect.set_process(false)
	var times := {"idle": [], "flight": [], "impact": [], "aftermath": []}
	var military := {"idle": [], "flight": [], "impact": [], "aftermath": []}
	var missile := {"flight": [], "impact": [], "aftermath": []}
	var peak_impacts := 0
	var peak_flashes := 0
	var last := Time.get_ticks_usec()
	for index in (320 if salvo else 240):
		_app._process(STEP)
		var started := Time.get_ticks_usec()
		_layer._process(STEP)
		var after_military := Time.get_ticks_usec()
		var phase := "idle"
		if salvo:
			_effect._process(STEP)
			var age: float = _effect._elapsed - Salvo.IMPACT_TIME
			phase = "flight" if age < 0.0 else ("impact" if age < 0.85 else "aftermath")
			missile[phase].append((Time.get_ticks_usec() - after_military) / 1000.0)
			peak_impacts = maxi(peak_impacts, _effect._cracks.visible_instance_count)
		peak_flashes = maxi(peak_flashes, _layer._infantry_flashes.visible_instance_count)
		military[phase].append((after_military - started) / 1000.0)
		await process_frame
		var now := Time.get_ticks_usec()
		times[phase].append((now - last) / 1000.0)
		last = now
	if salvo:
		_check(peak_impacts == 34 and not _effect._active, "all impacts rendered and salvo cleared")
	if label.begins_with("battle-"):
		_check(peak_flashes > 0, "engaged infantry fire remains visible")
	if not report:
		return
	for phase: String in times:
		if not times[phase].is_empty():
			print("%s/%s frame %s | military %s | missile %s" % [label, phase, _summary(times[phase]),
				_summary(military[phase]), _summary(missile.get(phase, []))])


func _summary(samples: Array) -> String:
	if samples.is_empty():
		return "—"
	samples.sort()
	var count := samples.size()
	return "n=%d p50=%.2f p95=%.2f p99=%.2f max=%.2f ms" % [count, samples[ceili(count * 0.50) - 1],
		samples[ceili(count * 0.95) - 1], samples[ceili(count * 0.99) - 1], samples.back()]


func _army(index: int) -> String:
	return "Stress %02d" % index


func _check(passed: bool, message: String) -> void:
	if not passed:
		_failures += 1
		push_error(message)
