extends SceneTree

const GIFT_ID := "5655"
const THRESHOLD := 5000
var app: Node
var failures := 0
var capture_dir := ""


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not profile.get_file().begins_with("missile-proof-") or "--self-test" not in OS.get_cmdline_user_args():
		quit(1)
		return
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--capture="):
			capture_dir = arg.trim_prefix("--capture=")
	if not capture_dir.is_empty():
		DirAccess.make_dir_recursive_absolute(capture_dir)
	app = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.test_mode = false
	await process_frame

	app._open_actions()
	var menu: Window = app.gift_dialog
	var picker: OptionButton = menu.get("_unit")
	var index := preload("../mod/GiftActions.gd").UNIT_KEYS.find("missile")
	check(picker.get_item_text(index) == "Füze saldırısı", "B actions expose the missile gift")
	picker.select(index)
	picker.item_selected.emit(index)
	menu._select_gift(GIFT_ID)
	check(menu.get("_amount").value == THRESHOLD, "the editor sets the configurable default damage")
	check(app.save_gift_actions(menu.get("_actions")), "the new mapping passes save normalization")
	check(app.settings.giftActions[GIFT_ID] == {"unit": "missile", "count": THRESHOLD}, "the rule was saved")
	menu.hide()

	for seed in [["caster", 400], ["weak", 70], ["strong", 400], ["waiting", 20]]:
		check(donate(seed[0], int(seed[1])), "synthetic donor receives troops")
	for placement in [["caster", 0], ["weak", 10], ["strong", 14]]:
		check(app.drop_army(placement[0], placement[1]).ok, "army gets its initial region")
	check(app.rules.claim_region("caster", 1).ok and app.rules.claim_region("weak", 11).ok,
		"missile sources and rival both have two regions")
	var event := {"type": "gift", "username": "caster", "eventId": "qa-salvo", "giftId": GIFT_ID,
		"giftCoinValue": 1, "repeatCount": 1}
	check(app.accept_live_event(event) and app.accept_live_event(event), "missile gift tolerates replay")
	check(app.rules.get_participant("caster").troops == 20050 and app.pending_missiles.get("caster") == THRESHOLD,
		"gift adds its regular soldiers and precisely one salvo")
	var document: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(profile.path_join("world-v1.json")))
	check(document.mapWorlds.turkiye.pendingMissiles.get("caster") == THRESHOLD, "salvo is persisted before flight")
	check(app._switch_map("world") and app.pending_missiles.is_empty(), "queued gift stays on its own map")
	check(app._switch_map("turkiye") and app.pending_missiles.get("caster") == THRESHOLD,
		"changing back restores the queued gift exactly once")
	await process_frame
	await process_frame
	check(app.active_missile.get("targets", {}).size() == 3, "one salvo targets all three enemy regions")
	check(app.region_owner(10) == "weak" and app.region_owner(11) == "weak", "ownership waits for the impact")
	if not capture_dir.is_empty():
		await create_timer(0.95).timeout
		await capture("01-fuzeler")

	var deadline := Time.get_ticks_msec() + 8000
	while app.region_owner(10) != "caster" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.region_owner(10) == "caster" and app.region_owner(11) == "caster", "all hit regions of the eliminated rival transfer")
	check(app.rules.get_participant("strong").troops == 6000 and app.region_owner(14) == "strong", "strong rival survives with 30% troops")
	check(app.rules.get_participant("waiting").troops == 1000, "unplaced army takes no damage")
	check(app.pending_missiles.is_empty() and not app.army_cards.has("weak"), "impact consumes the salvo and refreshes the roster")
	if not capture_dir.is_empty():
		await create_timer(0.22).timeout
		await capture("02-patlama")
	document = JSON.parse_string(FileAccess.get_file_as_string(profile.path_join("world-v1.json")))
	check(document.mapWorlds.turkiye.pendingMissiles.is_empty(), "consumed salvo persists atomically with the damage")
	check(app.accept_live_event(event) and app.pending_missiles.is_empty(), "a replay after impact cannot launch again")
	app.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_MISSILE_GIFT_OK")
	quit(0 if failures == 0 else 1)


func capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var error := root.get_texture().get_image().save_png(capture_dir.path_join(label + ".png"))
	check(error == OK, "visual capture " + label)


func donate(player: String, coins: int) -> bool:
	return app.accept_live_event({"type": "gift", "username": player, "eventId": "qa-seed-" + player,
		"giftCoinValue": coins, "repeatCount": 1})


func check(condition: bool, description: String) -> void:
	if not condition:
		failures += 1
		printerr("FETIH_MISSILE_GIFT_FAILED: " + description)
