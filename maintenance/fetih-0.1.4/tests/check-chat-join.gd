extends SceneTree

var failures := 0


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if "--self-test" not in OS.get_cmdline_user_args() or not profile.get_file().begins_with("chat-join-proof-"):
		quit(1)
		return
	var app := start_game()
	var join := message("join-1", "Ozge", "  KATIL  ")
	var retry := message("join-2", "ozge", "!katıl")
	var casual := message("ordinary", "izleyici", "ben de katılabilir miyim?")
	var save_blocker := profile.path_join("world-v1.json.tmp")
	check(DirAccess.make_dir_absolute(save_blocker) == OK, "make the first commit fail")
	poll(app, [join, retry, casual])
	check(app.live.cursor == 0, "a failed checkpoint does not acknowledge the packet")
	check(DirAccess.remove_absolute(save_blocker) == OK, "reopen the temporary save path")
	poll(app, [join, retry, casual])
	check(app.live.cursor == 3, "a successful retry advances the cursor")
	await process_frame
	await process_frame
	var player: Dictionary = app.rules.get_participant("ozge")
	check(player.get("troops") == 50 and player.get("coinTotal") == 0, "exactly 50 free soldiers after replay and another join")
	check(player.get("regions") == [] and app.army_cards.has("ozge"), "unplaced army is visible in the left list")
	check(app.rules.get_participant("izleyici").is_empty(), "ordinary chatter is ignored")
	check(app.drop_army("ozge", 2).ok and app.region_owner(2) == "ozge", "publisher can place the army")
	check(app.rules.get_participant("ozge").get("starterGranted", false), "initial placement grants the existing starter units")
	check(app._switch_map("world"), "second map opens")
	check(app.accept_live_event(join) and app.rules.get_participant("ozge").is_empty(), "replay does not join a different map")
	check(app._switch_map("turkiye"), "return to previous map")
	app.free()
	await process_frame

	var reopened := start_game()
	check(reopened.region_owner(2) == "ozge", "saved army returned in the same region")
	var next_message := message("join-3", "ozge", "katil")
	check(reopened.accept_live_event(next_message), "same-round command is accepted after restart")
	check(reopened.rules.get_participant("ozge").get("troops") == 50, "reopening does not restore the signup credit")
	var other := message("join-4", "deniz", "!KATİL")
	check(reopened.accept_live_event(other) and reopened.rules.get_participant("deniz").get("troops") == 50,
		"another viewer can join for free")
	check(reopened.accept_live_event({"type": "gift", "eventId": "gift-1", "username": "existing",
		"giftCoinValue": 2, "repeatCount": 1}), "existing reward entry still works")
	check(reopened.accept_live_event(message("existing-join", "existing", "katıl")) and
		reopened.rules.get_participant("existing").get("troops") == 100, "join is not a reinforcement for an existing army")
	reopened._finish_round()
	check(reopened.rules.round_phase() == "staging" and reopened.region_owner(2).is_empty(), "finish prepares a clean map")
	reopened.victory_scene.dismiss()
	check(reopened.rules.get_participant("deniz").get("troops") == 50, "waiting troops survive the round change")
	check(reopened.accept_live_event(next_message) and reopened.rules.get_participant("ozge").is_empty(),
		"old command replays are ignored even after the round changes")
	check(reopened.accept_live_event(message("join-5", "ozge", "katıl")) and
		reopened.rules.get_participant("ozge").get("troops") == 50, "a fresh command works in a new round")
	reopened.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_CHAT_JOIN_OK")
	quit(0 if failures == 0 else 1)


func start_game() -> Node:
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.test_mode = false
	app._read_state()
	app._refresh()
	return app


func message(receipt: String, username: String, comment: String) -> Dictionary:
	return {"type": "chat", "eventId": receipt, "username": username, "nickname": username, "comment": comment}


func poll(app: Node, messages: Array) -> void:
	var rows: Array = []
	for event in messages:
		rows.append({"seq": rows.size() + 1, "value": event})
	var packet := {"status": {"status": "connected", "message": "Yerel test"}, "sessionId": "katil-test", "events": rows}
	app.live._polled(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), JSON.stringify(packet).to_utf8_buffer())


func check(condition: bool, description: String) -> void:
	if not condition:
		failures += 1
		printerr("FETIH_CHAT_JOIN_FAILED: " + description)
