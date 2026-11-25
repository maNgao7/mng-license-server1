extends SceneTree

func _initialize() -> void:
	verify.call_deferred()

func verify() -> void:
	print("FETIH_RUNTIME_PROBE")
	if ProjectSettings.get_setting("application/config/version") != "0.1.5":
		fail("version")
		return
	var expected_path := OS.get_environment("FETIH_QA_EXPECTED")
	var expected: Variant = JSON.parse_string(FileAccess.get_file_as_string(expected_path))
	if not expected is Dictionary or expected.is_empty():
		fail("fixture")
		return
	if change_scene_to_file("res://Main.tscn") != OK:
		fail("main scene")
		return
	await scene_changed
	for frame in 180:
		if current_scene.get_child_count() > 0:
			break
		await process_frame
	if current_scene.get_child_count() == 0:
		fail("bootstrap")
		return
	var game: Node = current_scene.get_child(0)
	if not is_instance_valid(game.get("rules")) or game.qa_mode or game.test_mode or game.map_id != "turkiye":
		fail("normal start")
		return
	if game.rules.round_phase() != "staging" or not game.rules.view_state().participants.is_empty() or game.live.child_pid > 0:
		fail("empty map")
		return
	for key in expected:
		if not equal_settings(expected[key], game.settings.get(key)):
			fail("game settings")
			return
	# A release operator may also validate the original private match in memory.
	var sender := OS.get_environment("FETIH_QA_MATCH_ACCOUNT")
	var trigger := OS.get_environment("FETIH_QA_MATCH_TEXT")
	if not sender.is_empty() or not trigger.is_empty():
		if sender.is_empty() or trigger.is_empty() or not game.is_air_show_command(sender, trigger):
			fail("cosmetic match")
			return
		if game.is_air_show_command(sender + "_qa", trigger) or game.is_air_show_command(sender, trigger.to_lower()):
			fail("cosmetic exclusions")
			return
	print("FETIH_PACKAGED_STARTUP_OK: version 0.1.5, empty map, gameplay configuration matches")
	quit(0)

func equal_settings(expected: Variant, actual: Variant) -> bool:
	if expected is Dictionary:
		if not actual is Dictionary or expected.size() != actual.size():
			return false
		for key in expected:
			if not actual.has(key) or not equal_settings(expected[key], actual[key]):
				return false
		return true
	return expected == actual

func fail(reason: String) -> void:
	printerr("FETIH_PACKAGED_STARTUP_FAILED: ", reason)
	quit(1)
