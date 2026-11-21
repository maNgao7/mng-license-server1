extends SceneTree

const INTRO = preload("../mod/MissileIntro.gd")
const WAIT_SECONDS := 12.0


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var proof := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if DisplayServer.get_name() == "headless" or not proof.get_file().begins_with("missile-intro-proof-"):
		quit(1)
		return
	var first := await start(proof.path_join("natural"))
	var intro := await wait_for_intro()
	if intro == null:
		fail("first game launch did not open the intro")
		return
	var opened := Time.get_ticks_msec()
	await create_timer(1.3).timeout
	if not intro.video.is_playing() or intro.video.stream_position < 0.75:
		fail("first launch did not play the video")
		return
	if intro.get_node("IntroContent").get_child(1).text != "Füzeyi tetikleyen hediye: Balina Dalışı":
		fail("the actual default gift was not identified")
		return
	await RenderingServer.frame_post_draw
	intro.get_viewport().get_texture().get_image().save_png(proof.path_join("ilk-acilis.png"))
	while is_instance_valid(intro) and Time.get_ticks_msec() - opened < 10000:
		await process_frame
	var elapsed := Time.get_ticks_msec() - opened
	if is_instance_valid(intro) or elapsed < 4300 or elapsed > 7600:
		fail("the video did not close automatically at the end, elapsed=%d" % elapsed)
		return
	first.free()
	await process_frame
	var reopened := await start(proof.path_join("natural"))
	await create_timer(2.0).timeout
	if find_intro() != null:
		fail("second launch replayed the video")
		return
	reopened.free()
	await process_frame

	var skip_profile := proof.path_join("skip")
	DirAccess.make_dir_recursive_absolute(skip_profile)
	var settings := FileAccess.open(skip_profile.path_join("settings-v1.json"), FileAccess.WRITE)
	settings.store_string(JSON.stringify({"schemaVersion": 1, "giftActionsVersion": 3,
		"giftActions": {"5655": {"unit": "missile", "count": 5000}}}))
	settings.close()
	var skipped_game := await start(skip_profile)
	intro = await wait_for_intro()
	if intro == null or intro.get_node("IntroContent").get_child(1).text.contains("Balina Dalışı"):
		fail("a publisher's custom gift was overwritten in the intro")
		return
	intro.get_ok_button().pressed.emit()
	await process_frame
	await process_frame
	if find_intro() != null or not FileAccess.file_exists(skip_profile.path_join(INTRO.SEEN)):
		fail("skipping did not close and mark the video")
		return
	skipped_game.free()
	print("FETIH_MISSILE_INTRO_OK natural_ms=%d first_play second_launch_skip manual_skip custom_gift" % elapsed)
	quit()


func start(profile: String) -> Node:
	OS.set_environment("TIKMNG_ANIMAL_PROFILE", profile)
	var scene := (load("res://Main.tscn") as PackedScene).instantiate()
	root.add_child(scene)
	await process_frame
	return scene


func find_intro() -> INTRO:
	return root.find_child("FetihMissileIntro", true, false) as INTRO


func wait_for_intro() -> INTRO:
	var until := Time.get_ticks_msec() + int(WAIT_SECONDS * 1000.0)
	while Time.get_ticks_msec() < until:
		var dialog := find_intro()
		if dialog != null and dialog.visible:
			return dialog
		await process_frame
	return null


func fail(message: String) -> void:
	push_error("FETIH_MISSILE_INTRO_FAILED: " + message)
	quit(1)
