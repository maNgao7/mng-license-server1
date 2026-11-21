extends SceneTree

const MONEY_GUN := "7168"
const ACTIONS := preload("../mod/GiftActions.gd")
var failures := 0


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not profile.get_file().begins_with("gift-playtest-") or "--self-test" not in OS.get_cmdline_user_args():
		quit(1)
		return
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.set_process(false)
	app.test_mode = false
	await process_frame
	var existing := {ACTIONS.WHALE_DIVE: {"unit": "missile", "count": 6400}}
	check(ACTIONS.migrate_actions(existing, 2) == existing, "preserve saved Whale Dive assignment")
	check(ACTIONS.migrate_actions({}, 2).get(ACTIONS.WHALE_DIVE, {}).get("unit") == "missile", "new preset migrates")
	check(ACTIONS.migrate_actions({}, 3).is_empty(), "removing the preset is respected in current settings")
	check(app.prices.get(ACTIONS.WHALE_DIVE) == 2150, "Whale Dive exact catalog ID and coins")
	var actual := {"type": "gift", "username": "real_player", "eventId": "qa-original", "giftCoinValue": 4, "repeatCount": 1}
	check(app.accept_live_event(actual) and app.place_player("real_player", 0).ok, "seed original world")
	var original: Dictionary = app.rules.serialize_state()
	var saved_path := profile.path_join("world-v1.json")
	var original_disk := FileAccess.get_sha256(saved_path)
	app._open_actions()
	var menu: Window = app.gift_dialog
	menu._select_gift(MONEY_GUN)
	var row: Dictionary = menu._gift_row(MONEY_GUN)
	var coins := int(row.coins)
	var spin: SpinBox = menu.get("_amount")
	spin.get_line_edit().text = "1234"
	menu.get("_test_button").pressed.emit()
	await process_frame
	check(not menu.visible and not app.gift_test.is_active(), "pick mode waits until a valid map tile")
	check(app.gift_test.apply_click(4) and app.gift_test.is_active(), "preview starts on the targeted region")
	var test_owner := "hediye_test_4"
	check(app.region_owner(4) == test_owner and app.rules.get_participant(test_owner).troops == coins * 50 + 1234,
		"money gun uses the current draft and normal coin reward (%s)" % app.rules.get_participant(test_owner).get("troops", 0))
	check(app.rules.get_participant("real_player").is_empty(), "live roster is isolated from the test")
	check(FileAccess.get_sha256(saved_path) == original_disk, "preview performs no live save")
	var packet := {"status": {"status": "connected"}, "sessionId": "qa-bridge", "events": [{"seq": 1,
		"value": {"type": "gift", "username": "while_testing", "eventId": "qa-while-testing", "giftCoinValue": 2, "repeatCount": 1}}]}
	var bytes := JSON.stringify(packet).to_utf8_buffer()
	app.live._polled(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), bytes)
	check(app.live.cursor == 0 and app.rules.get_participant("while_testing").is_empty(), "real gifts stay waiting in the bridge")
	app.gift_test.finish(true)
	check(not app.gift_test.is_active() and app.rules.serialize_state() == original, "exit restores the original rules")
	check(FileAccess.get_sha256(saved_path) == original_disk and app.settings.giftActions[MONEY_GUN].count == 10000,
		"draft and preview rewards never modify the saved game")
	app.live._polled(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), bytes)
	check(app.live.cursor == 1 and app.rules.get_participant("while_testing").troops == 100, "bridge resumes from its previous cursor")
	app._open_actions()
	check(menu.visible and menu.get("_amount").value == 1234, "B returns to the unsaved draft")
	menu.hide()
	app.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_GIFT_PLAYTEST_OK")
	quit(0 if failures == 0 else 1)


func check(condition: bool, label: String) -> void:
	if not condition:
		failures += 1
		printerr("FETIH_GIFT_PLAYTEST_FAILED: " + label)
