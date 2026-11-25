extends SceneTree

var app: Node
var failures := 0


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not profile.get_file().begins_with("round-update-") or "--self-test" not in OS.get_cmdline_user_args():
		quit(1)
		return
	app = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.set_process(false)
	app.test_mode = false
	await process_frame

	check(gift("placed_a", 1) and gift("placed_b", 1), "two initial donors credited")
	check(gift("waiting", 3) and gift("hat", 0, "6427"), "waiting and Hat & Mustache gift")
	check(gift("galaxy", 0, "11046"), "Galaxy gift before placement")
	check(app.unit_counts("hat") == {"soldiers": 4950, "tanks": 33, "helicopters": 16, "jets": 17,
		"factories": 0, "headquarters": 0}, "99 coins supply 4950 soldiers and 10 extra jets")
	check(app.rules.get_participant("galaxy").troops == 50000 and app.pending_surrounding.has("galaxy"),
		"Galaxy credits 50000 soldiers and queues its assigned action")
	check(app.rules.get_participant("placed_a").bonusJets == 0, "starter units wait for placement")
	var distant := find_distant(0)
	check(distant >= 0, "non-neighboring region exists")
	if distant < 0:
		quit(1)
		return
	check(app.drop_army("placed_a", 0).ok and app.drop_army("placed_b", distant).ok, "placed from roster")
	var starter: Dictionary = app.unit_counts("placed_a")
	check(starter.soldiers == 50 and starter.tanks == 1 and starter.helicopters == 1 and starter.jets == 1,
		"50-soldier first placement grants each of the three starter vehicles")
	check(app.drop_army("placed_a", 0).ok and app.unit_counts("placed_a") == starter, "same existing region grants nothing again")
	var secondary := extra_region(distant)
	check(app.rules.claim_region("placed_b", secondary).ok, "defender owns a second region")
	check(app.start_region_attack(0, distant), "a distant battle starts normally")
	var battles: Array = app.battle_views()
	check(battles.size() == 1 and battles[0].airborne, "distant route is recorded")
	if battles.is_empty():
		quit(1)
		return
	app.canvas._process(0.0)
	var fronts: Array = app.canvas.visual_battle_fronts()
	var targets := fronts.map(func(front: Dictionary) -> int: return front.to_region)
	check(fronts.size() == 2 and distant in targets and secondary in targets,
		"one attack starts a visible front in every defender region on the first frame")
	check(fronts.all(func(front: Dictionary) -> bool: return front.battle_id == str(battles[0].id)),
		"the visual fronts share one battle")

	var keyboard := InputEventKey.new()
	keyboard.keycode = KEY_H
	keyboard.pressed = true
	app.account.grab_focus()
	app._unhandled_key_input(keyboard)
	check(app.battle_speed_multiplier() == 1.0, "default speed is 1× and typing H does not change it")
	app.account.release_focus()
	app._unhandled_key_input(keyboard)
	check(app.battle_speed_multiplier() == 3.0 and app.battle_speed_label.text == "H · 3×", "held H enables 3×")
	var elapsed := float(battles[0].elapsed)
	app._process(0.25)
	check(is_equal_approx(float(app.battle_views()[0].elapsed) - elapsed, 0.75), "same real time advances three times the battle time")
	keyboard.pressed = false
	app._input(keyboard)
	check(app.battle_speed_multiplier() == 1.0 and app.battle_speed_label.text == "H · 1×", "releasing H restores 1×")
	keyboard.pressed = true
	app._unhandled_key_input(keyboard)
	app.get_window().focus_exited.emit()
	check(app.battle_speed_multiplier() == 1.0, "loss of window focus clears the key boost")

	var waiting_before: Dictionary = app.rules.get_participant("waiting")
	app.finish_button.pressed.emit()
	check(app.rules.round_phase() == "staging" and app.victory_scene.visible, "finish displays victory and immediately stages the next round")
	check(app.rules.active_battles_view().is_empty() and app.region_owner(0).is_empty()
		and app.region_owner(distant).is_empty(), "board and combat are cleared")
	check(app.rules.get_participant("placed_a").is_empty() and app.rules.get_participant("placed_b").is_empty(),
		"only the previous deployed armies are cleared")
	var waiting: Dictionary = app.rules.get_participant("waiting")
	check(waiting.number == waiting_before.number and waiting.troops == waiting_before.troops
		and waiting.coinTotal == waiting_before.coinTotal and app.rules.get_participant("hat").troops == 4950,
		"waiting roster keeps original numbers and credits")
	check(app.pending_surrounding.has("galaxy"), "waiting Galaxy order survives bridge between rounds")
	var score_before: Dictionary = app.country_leaders.duplicate(true)
	app._finish_round()
	check(app.country_leaders == score_before and score_before.size() == 1, "empty stage cannot count another victory")
	var saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(profile.path_join("world-v1.json")))
	check(saved is Dictionary and saved.mapWorlds.turkiye.rules.phase == "staging",
		"the atomic save contains the open next round")
	app.victory_scene.dismiss()
	check(gift("new_player", 1) and app.drop_army("new_player", distant).ok, "fresh donor can be placed without reset")
	check(app.drop_army("waiting", 0).ok and app.region_owner(0) == "waiting", "unchanged waiting army can be placed without reset")
	check(app.drop_army("galaxy", extra_region(distant)).ok, "queued Galaxy sender joins from the roster")
	var launched: Array = app.battle_views()
	check(launched.size() == 1 and launched[0].attacker == "galaxy", "Galaxy starts a new attack")
	check(app.surrounding_orders.get("galaxy", []).size() == 1, "Galaxy queues all other placed opponents")
	if not launched.is_empty():
		var defeated := str(launched[0].defender)
		app._process(40.0)
		check(not app.army_cards.has(defeated), "defeated donor drops off the list at zero soldiers")
		var returned := {"type": "gift", "eventId": "qa-return", "username": defeated, "repeatCount": 1, "giftCoinValue": 2}
		var packet := {"status": {"status": "connected"}, "sessionId": "qa-round", "events": [{"seq": 1, "value": returned}]}
		var bytes := JSON.stringify(packet).to_utf8_buffer()
		app.live._polled(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), bytes)
		app._process(0.01)
		check(app.army_cards.has(defeated), "first refresh shows the returning donor")
		check(app.rules.get_participant(defeated).get("troops", 0) == 0 and app.gift_reserve.has("qa-return"), "returning donor waits on the roster with no automatic troops")
		app.army_cards[defeated].get_node("Row/ApproveGift").pressed.emit()
		check(app.rules.get_participant(defeated).troops == 100, "returning donor receives 100 troops after confirmation")
		check(app.live.cursor == 1, "the completed gift was acknowledged")
		app.live._polled(HTTPRequest.RESULT_SUCCESS, 200, PackedStringArray(), bytes)
		check(app.rules.get_participant(defeated).troops == 100, "repeated bridge delivery does not reward twice")
	app.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_ROUND_UPDATE_OK")
	quit(0 if failures == 0 else 1)


func gift(player: String, coins: int, gift_id := "") -> bool:
	var event := {"type": "gift", "eventId": "qa-" + player, "username": player, "repeatCount": 1, "giftId": gift_id}
	if coins > 0:
		event.giftCoinValue = coins
	if not app.accept_live_event(event):
		return false
	app._approve_gifts(player)
	app._approve_attack_request(event.eventId)
	return true


func find_distant(from_region: int) -> int:
	for region in app.canvas.regions:
		if region.id != from_region and region.id not in app.canvas.neighbors.get(from_region, []):
			return region.id
	return -1


func extra_region(except: int) -> int:
	for region in app.canvas.regions:
		if region.id not in [0, except]:
			return region.id
	return -1


func check(condition: bool, description: String) -> void:
	if not condition:
		failures += 1
		printerr("FETIH_ROUND_UPDATE_FAILED: " + description)
