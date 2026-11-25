extends SceneTree

const SALVO = preload("../mod/MissileSalvo.gd")
var failures := 0


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if "--self-test" not in OS.get_cmdline_user_args() or not profile.get_file().begins_with("air-show-proof-"):
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(profile)
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.set_process(false)
	app._air_show_signature = JSON.stringify(["qa_pilot", "DEMO"]).sha256_text()
	check(app._switch_map("world"), "World map opens")
	if not app.map_id == "world":
		quit(1)
		return
	for donor in ["first", "second"]:
		check(app.accept_live_event({"type": "gift", "username": donor, "eventId": "unit-" + donor,
			"giftCoinValue": 15, "repeatCount": 1}), "seed a real army")
		app._approve_gifts(donor)
	check(app.drop_army("first", 3).ok and app.drop_army("second", 11).ok, "place armies with jets")
	app._refresh()
	await create_timer(0.42).timeout
	var origins: PackedVector3Array = app.canvas.military.jet_show_launch_positions()
	check(origins.size() >= 4, "each jet contributes its two wing hardpoints")
	var before: Dictionary = app.rules.serialize_state()
	var rankings: Dictionary = app.country_leaders.duplicate(true)
	var salvo: SALVO = app.missile_effect
	var counts := {"launches": 0, "impacts": 0}
	salvo.launched.connect(func() -> void: counts.launches += 1)
	salvo.impact.connect(func() -> void: counts.impacts += 1)
	app.accept_live_event(message("wrong-user", "intruder", "DEMO"))
	app.accept_live_event(message("wrong-case", "qa_pilot", "demo"))
	app.accept_live_event(message("wrong-text", "qa_pilot", "prefix DEMO"))
	check(counts.launches == 0, "only the configured account and an exact uppercase command can launch")
	var authorized := message("authorized", "QA_PILOT", "DEMO")
	app.accept_live_event(authorized)
	check(salvo.is_air_show() and counts.launches == 1 and salvo._targets.size() == 34,
		"authorized chat covers every world region")
	check(salvo._sources == origins and salvo._flights.size() >= origins.size(), "every rendered wing participates")
	salvo._process(SALVO.IMPACT_TIME + 0.04)
	check(counts.impacts == 1 and salvo._cracks.visible_instance_count == 0, "show creates an impact without damage marks")
	check(app.rules.serialize_state() == before and app.country_leaders == rankings and app.active_missile.is_empty(),
		"troops, controls, war state, regions, rankings and damaging launch queue are unaffected")
	salvo._process(SALVO.AFTERMATH_TIME + 0.04)
	app.accept_live_event(message("cooldown", "qa_pilot", "DEMO"))
	check(counts.launches == 1, "repeated chat cannot spam the show")
	app.air_show_available_at = 0
	app.accept_live_event(authorized)
	check(counts.launches == 1, "the original chat receipt cannot play again after cooldown")
	check(salvo.play_air_show(PackedVector3Array(), range(app.canvas.regions.size())) and salvo._targets.size() == 34,
		"an empty sky still shows every region from an aerial fallback")
	check(salvo.play([3], [11]) and not salvo.is_air_show(), "a normal missile salvo can take priority")
	app.accept_live_event(message("busy", "qa_pilot", "DEMO"))
	check(not salvo.is_air_show() and counts.launches == 3, "chat never replaces a normal salvo")
	salvo.cancel()
	app.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_AIR_SHOW_OK")
	quit(0 if failures == 0 else 1)


func message(id: String, username: String, comment: String) -> Dictionary:
	return {"type": "chat", "eventId": id, "username": username, "nickname": "qa_pilot", "comment": comment}


func check(condition: bool, description: String) -> void:
	if not condition:
		failures += 1
		printerr("FETIH_AIR_SHOW_FAILED: " + description)
