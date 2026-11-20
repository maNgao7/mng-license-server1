extends SceneTree
## Isolated synthetic rules checks, not a live-stream/graphics integration test.
## Run from any directory, without a project.godot or native game resources:
## Godot_console.exe --headless --script D:/TikMnG/Animal-Times-Live/tests/check-war-rules.gd
## No fixtures, bots, userdata, graphics, network, or persistent test participants.

var _rules_script: GDScript
var _checks: int = 0
var _failures: Array = []


func _initialize() -> void:
	var script_path: String = get_script().resource_path
	var rules_path := script_path.get_base_dir().path_join("../../mod/WarRules.gd").simplify_path()
	_rules_script = load(rules_path)
	if _rules_script == null or not _rules_script.can_instantiate():
		printerr("FAIL: WarRules.gd could not be compiled: ", rules_path)
		quit(1)
		return
	_test_gift_math_and_identity()
	_test_replay_and_repeat_deltas()
	_test_invalid_events_and_limits()
	_test_manual_start_and_placement()
	_test_zero_soldier_placement()
	_test_publisher_unit_grants()
	_test_publisher_unit_limits()
	_test_chat_ownership_and_turkish()
	_test_pause_and_reinforcements()
	_test_attacker_wins_with_reinforcements()
	_test_tie_and_gift_return()
	_test_air_capture_transfers_all_regions()
	_test_multiple_regions_and_captured_return()
	_test_garrison_allocation()
	_test_headquarters_construction()
	_test_headquarters_production()
	_test_headquarters_save_validation()
	_test_long_deployment()
	_test_reset_and_results_gifts()
	_test_state_machine()
	_test_snapshot_isolation()
	_test_save_round_trip_and_replay()
	_test_corrupt_saves()
	_test_disjoint_battles_and_tick_partition()
	_test_combat_math_grid()
	if _failures.is_empty():
		print("PASS: WarRules: ", _checks, " deterministic checks; Godot ", Engine.get_version_info()["string"])
		quit(0)
	else:
		for failure in _failures:
			printerr("FAIL: ", failure)
		printerr("FAILED: ", _failures.size(), " / ", _checks, " checks")
		quit(1)


func _new() -> RefCounted:
	return _rules_script.new()


func _event(id: String, coins: int = 1, event_id: String = "", count: int = 1) -> Dictionary:
	return {"eventId": "gift:" + id if event_id.is_empty() else event_id,
		"participantId": id, "username": "user_" + id, "nickname": "Nick " + id,
		"portraitUrl": "https://example.invalid/" + id + ".png",
		"coinValue": coins, "completedCount": count}


func _pair(a_coins: int = 2, b_coins: int = 1) -> RefCounted:
	var rules := _new()
	rules.accept_event(_event("a", a_coins))
	rules.accept_event(_event("b", b_coins))
	rules.claim_region("a", 0)
	rules.claim_region("b", 1)
	return rules


func _check(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _test_gift_math_and_identity() -> void:
	var rules := _new()
	_check(rules.view_state()["soldiersPerCoin"] == 50, "default 50 soldiers per coin")
	var outcome: Dictionary = rules.accept_event(_event("a", 100))
	_check(outcome["ok"] and outcome["troopsAdded"] == 5000, "100 coins = 5000 soldiers")
	var a: Dictionary = rules.get_participant("a")
	_check(a["troops"] == 5000 and a["coinTotal"] == 100, "coin and troop totals are separate")
	_check(a["number"] == 1 and a["troopRegion"] == -1, "first donor is number 1 and unplaced")
	_check(a["username"] == "user_a" and a["nickname"] == "Nick a" and a["portraitUrl"].ends_with("a.png"), "separate username/nickname/portrait")
	_check(rules.view_state()["pending"] == ["a"], "unplaced donor is pending")
	_check(rules.set_soldiers_per_coin(1)["ok"], "minimum multiplier accepted")
	rules.accept_event(_event("a", 2, "extra:1"))
	_check(rules.get_participant("a")["troops"] == 5002, "multiplier affects future gifts only")
	_check(rules.set_soldiers_per_coin(100000)["ok"], "maximum multiplier accepted")
	rules.accept_event(_event("b", 1))
	_check(rules.get_participant("b")["number"] == 2 and rules.get_participant("b")["troops"] == 100000, "stable ascending donor number")
	_check(not rules.set_soldiers_per_coin(0)["ok"] and not rules.set_soldiers_per_coin(100001)["ok"], "invalid multiplier rejected")
	var update := _event("a", 1, "profile:update")
	update["nickname"] = "New Nick"
	update["username"] = ""
	update["portraitUrl"] = ""
	rules.accept_event(update)
	a = rules.get_participant("a")
	_check(a["number"] == 1 and a["nickname"] == "New Nick" and a["username"] == "user_a" and not a["portraitUrl"].is_empty(), "profile update retains ID number and nonempty identity")


func _test_replay_and_repeat_deltas() -> void:
	var rules := _new()
	var first := _event("a", 3, "session:repeat:1", 1)
	rules.accept_event(first)
	var before: Dictionary = rules.serialize_state()
	var duplicate: Dictionary = rules.accept_event(first)
	_check(duplicate["ok"] and duplicate["duplicate"] and not duplicate["applied"], "duplicate is acknowledged without application")
	_check(before == rules.serialize_state(), "duplicate changes absolutely no state")
	# External cumulative count 1 -> 3 -> 6 is normalized to deltas 1, 2, 3.
	rules.accept_event(_event("a", 3, "session:repeat:3", 2))
	rules.accept_event(_event("a", 3, "session:repeat:6", 3))
	rules.accept_event(_event("a", 3, "session:repeat:3", 2))
	_check(rules.get_participant("a")["coinTotal"] == 18 and rules.get_participant("a")["troops"] == 900, "incremental repeats and out-of-order duplicate counted once")
	var cumulative := _event("a", 3, "bad:cumulative")
	cumulative["repeatCount"] = 6
	_check(not rules.accept_event(cumulative)["ok"], "raw cumulative repeat input is explicitly rejected")
	var replay_as_other := first.duplicate(true)
	replay_as_other["participantId"] = "impersonator"
	_check(not rules.accept_event(replay_as_other)["applied"] and rules.get_participant("impersonator").is_empty(), "reused event ID cannot credit another donor")


func _test_invalid_events_and_limits() -> void:
	var rules := _new()
	var invalids: Array = [{}, {"eventId": ""}, {"eventId": "x", "participantId": ""}]
	for value in [0, -1, 1.5, INF, NAN, true, "1", null]:
		var event := _event("a", 1, "invalid")
		event["completedCount"] = value
		invalids.append(event)
	var too_large := _event("a", 9007199254740991, "too:large", 2)
	invalids.append(too_large)
	var bad_profile := _event("a")
	bad_profile["portraitUrl"] = 12
	invalids.append(bad_profile)
	for event in invalids:
		_check(not rules.accept_event(event)["ok"], "invalid event rejected: " + str(event))
	_check(rules.view_state()["participants"].is_empty(), "invalid gifts create no donors or consumed numbers")
	_check(rules.accept_event(_event("a", 1, "invalid"))["ok"], "invalid event ID can be corrected and retried")
	rules.set_soldiers_per_coin(1)
	var max_value: int = 9007199254740991
	var huge := _new()
	huge.set_soldiers_per_coin(1)
	_check(huge.accept_event(_event("max", max_value))["ok"], "maximum JSON-exact troop count accepted")
	var saved: Dictionary = huge.serialize_state()
	_check(not huge.accept_event(_event("max", 1, "overflow"))["ok"] and huge.serialize_state() == saved, "overflow rejected atomically")
	var merge_limit := _new()
	merge_limit.set_soldiers_per_coin(100000)
	merge_limit.accept_event(_event("large", 90071992547))
	merge_limit.start_round()
	merge_limit.finish_round()
	saved = merge_limit.serialize_state()
	_check(not merge_limit.accept_event(_event("large", 1, "results:overflow"))["ok"] and merge_limit.serialize_state() == saved, "pending/reset merge cannot exceed exact integer limit")


func _test_manual_start_and_placement() -> void:
	var rules := _pair()
	_check(rules.view_state()["phase"] == "staging", "gifts and placement never autostart")
	_check(not rules.request_attack("a", 2)["ok"], "staging attack blocked")
	_check(rules.tick(999.0).is_empty() and rules.view_state()["phase"] == "staging", "waiting does not autostart")
	_check(rules.get_region_owner(0) == "a" and rules.get_region_owner(1) == "b", "placement uses requested integer region")
	_check(not rules.claim_region("a", -1)["ok"] and not rules.claim_region("a", 37)["ok"], "native map bounds 0..36")
	_check(not rules.claim_region("missing", 3)["ok"], "unknown donor not created by claim")
	_check(not rules.claim_region("a", 1)["ok"], "neutral claim cannot steal enemy territory")
	_check(rules.claim_region("a", 36)["ok"] and rules.get_region_owner(36) == "a", "one participant may own multiple regions")
	_check(rules.get_participant("a")["troops"] == 100, "expansion does not duplicate troops")
	_check(rules.start_round()["ok"] and rules.view_state()["battles"].is_empty(), "manual start does not autoattack")
	_check(rules.publisher_attack("a", 2)["ok"], "publisher explicitly chooses actor and target")
	_check(not rules.claim_region("a", 3)["ok"], "neutral expansion locked during participant battle")
	_check(not rules.request_attack("b", 1)["ok"], "participant cannot enter two battles")


func _test_zero_soldier_placement() -> void:
	var rules := _new()
	var gift := _event("empty", 0)
	gift["bonusTanksPerGift"] = 1
	rules.accept_event(gift)
	rules.accept_event(_event("other"))
	rules.place_participant("other", 3)
	_check(rules.place_participant("empty", 7).ok and rules.get_region_owner(7) == "empty",
		"a known participant with zero soldiers can manually take a neutral region")
	_check(rules.region_troops(7) == 0 and rules.view_state().pending.is_empty(), "zero-soldier owner is placed")
	_check(not rules.place_participant("empty", 3).ok, "manual zero-soldier placement still requires neutral land")
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(rules.serialize_state()))).ok
		and restored.get_region_owner(7) == "empty", "zero-soldier ownership survives JSON reload")
	restored.start_round()
	_check(not restored.request_attack("empty", 2).ok, "zero-soldier attacker still cannot attack")
	_check(restored.request_attack("other", 1).ok, "zero-soldier defender can be attacked")


func _test_publisher_unit_grants() -> void:
	var rules := _pair(32, 1)
	rules.accept_event(_event("pending"))
	var gift := _event("a", 0, "tank:gift")
	gift["bonusTanksPerGift"] = 2
	rules.accept_event(gift)
	var expected: Dictionary = rules.serialize_state()
	_check(not rules.add_publisher_unit("a", "factory").ok, "manual unit grant rejects unsupported units")
	_check(not rules.add_publisher_unit("missing", "tank").ok, "manual grant cannot create a participant")
	_check(not rules.add_publisher_unit("pending", "helicopter").ok, "manual grant requires placed ownership")
	_check(rules.serialize_state() == expected, "invalid manual grants are atomic")
	_check(rules.add_publisher_unit("a", "tank").ok, "manual tank grant in staging")
	rules.start_round()
	_check(rules.add_publisher_unit("a", "helicopter").ok, "manual helicopter grant while running")
	rules.pause_round()
	_check(rules.add_publisher_unit("a", "tank").ok, "another manual tank grant while paused")
	_check(rules.unit_counts("a") == {"soldiers": 1600, "tanks": 7, "helicopters": 2, "factories": 0, "headquarters": 0},
		"manual units add to earned and gifted counts")
	expected.phase = "paused"
	expected.participants[0].bonusTanks += 2
	expected.participants[0].bonusHelicopters += 1
	_check(rules.serialize_state() == expected, "manual grants change only current unit bonuses, including no coins or receipts")
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(expected))).ok and restored.serialize_state() == expected,
		"manual grants round-trip through existing bonus fields")
	_check(not restored.accept_event(gift).applied and restored.serialize_state() == expected, "gift replay remains a no-op after manual grants")
	rules.finish_round()
	var finished: Dictionary = rules.serialize_state()
	_check(not rules.add_publisher_unit("a", "tank").ok and rules.serialize_state() == finished,
		"manual grants are rejected in results without queuing credit")


func _test_publisher_unit_limits() -> void:
	var maximum: int = _rules_script.MAX_INTEGER
	for unit in ["tank", "helicopter"]:
		var bonus_field := "bonusTanks" if unit == "tank" else "bonusHelicopters"
		var count_field := "tanks" if unit == "tank" else "helicopters"
		var threshold: int = _rules_script.TANK_SOLDIER_THRESHOLD if unit == "tank" else _rules_script.HELICOPTER_SOLDIER_THRESHOLD
		var rules := _new()
		rules.set_soldiers_per_coin(1)
		rules.accept_event(_event("a", threshold))
		rules.claim_region("a", 0)
		var saved: Dictionary = rules.serialize_state()
		saved.participants[0][bonus_field] = maximum - 1
		_check(rules.restore_state(saved).ok and rules.unit_counts("a")[count_field] == maximum,
			unit + " count can reach the limit with one earned unit")
		var before: Dictionary = rules.serialize_state()
		_check(rules.add_publisher_unit("a", unit).get("error") == "quantity_overflow" and rules.serialize_state() == before,
			unit + " grant that would overflow the derived count is atomic")
		saved.participants[0].troops = threshold - 1
		_check(rules.restore_state(saved).ok and rules.add_publisher_unit("a", unit).ok
			and rules.unit_counts("a")[count_field] == maximum, unit + " bonus can reach the limit below its earned threshold")
		before = rules.serialize_state()
		_check(rules.add_publisher_unit("a", unit).get("error") == "quantity_overflow" and rules.serialize_state() == before,
			unit + " bonus counter cannot exceed its limit")


func _test_chat_ownership_and_turkish() -> void:
	var rules := _new()
	for input in ["3 saldır", "üç saldır", "ÜÇ SALDIR", "#3", "#3 saldır", "  #3 saldır! ", "üç saldir"]:
		_check(rules.parse_attack_target(input) == 3, "Turkish/digit/hash target: " + input)
	_check(rules.parse_attack_target("bir saldıracağız") == 1, "Turkish conjugated attack")
	_check(rules.parse_attack_target("otuz yedi saldır") == 37, "multiword Turkish native map target")
	for input in ["3", "saldır", "ben 3 saldır", "1 3 saldır", "@a 3 saldır", "3 saldır 1", "#0", "#-1", "#999999999999999999999", "üçüncü saldır", "3 saldırma"]:
		_check(rules.parse_attack_target(input) == -1, "ambiguous/impersonating chat rejected: " + input)
	rules = _pair()
	rules.accept_event(_event("c", 1))
	rules.claim_region("c", 2)
	rules.start_round()
	_check(not rules.handle_chat("outsider", "3 saldır")["ok"], "unknown authenticated sender cannot attack as someone else")
	_check(not rules.handle_chat("c", "1 2 saldır")["ok"], "message cannot select another attacker")
	_check(not rules.handle_chat("c", "3 saldır")["ok"], "self-target blocked")
	_check(rules.handle_chat("c", "bir saldıracağız")["ok"], "sender c attacks target 1")
	var battle: Dictionary = rules.view_state()["battles"][0]
	_check(battle["actorId"] == "c" and battle["targetId"] == "a" and battle["actorRegion"] == 2, "chat actor always comes from sender's troop region")


func _test_pause_and_reinforcements() -> void:
	var rules := _pair(2, 1)
	rules.set_battle_seconds(4.0)
	rules.start_round()
	rules.request_attack("a", 2)
	_check(rules.tick(1.0).is_empty(), "battle not resolved before duration")
	_check(is_equal_approx(rules.view_state()["battles"][0]["progress"], 0.25), "battle exposes progress")
	rules.pause_round()
	var paused: Dictionary = rules.serialize_state()
	_check(rules.tick(1000.0).is_empty() and rules.serialize_state() == paused, "pause holds all battle time and progress")
	_check(not rules.publisher_attack("a", 2)["ok"] and not rules.claim_region("a", 3)["ok"], "pause blocks attacks and claims")
	_check(rules.accept_event(_event("b", 2, "paused:reinforce"))["ok"], "pause still accepts reinforcement")
	_check(rules.view_state()["battles"][0]["targetTroops"] == 150, "battle view exposes live reinforcement")
	rules.resume_round()
	_check(rules.tick(2.0).is_empty(), "resume preserves remaining time")
	var results: Array = rules.tick(1.0)
	_check(results.size() == 1 and results[0]["winnerId"] == "b" and results[0]["survivors"] == 50, "reinforcement flips initial losing defender to winner at end")
	_check(rules.get_region_owner(0) == "b" and rules.get_participant("a")["troops"] == 0, "defender victory captures attacker's land")
	_check(rules.tick(100.0).is_empty() and rules.view_state()["results"].size() == 1, "completed battle resolves exactly once")


func _test_attacker_wins_with_reinforcements() -> void:
	var rules := _pair(1, 2)
	rules.start_round()
	rules.request_attack("a", 2)
	rules.tick(4.0)
	rules.accept_event(_event("a", 4, "last:reinforce"))
	_check(rules.tick(1.0).is_empty() and rules.get_region_owner(1) == "b",
		"late reinforcement extends the battle instead of switching ownership at the deadline")
	var hold: Dictionary = rules.view_state()["battles"][0]
	_check(is_equal_approx(hold.elapsed, hold.duration) and hold.frontControl < 0.0,
		"the old front is still retreating after the deadline")
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(rules.serialize_state()))).ok,
		"an ongoing battle restores after its nominal deadline")
	_check(rules.tick(2.0).is_empty() and rules.view_state()["battles"][0].frontControl > 0.0,
		"the new leader advances before capturing the region")
	restored.tick(2.0)
	var outcomes: Array = rules.tick(2.0)
	_check(outcomes.size() == 1 and outcomes == restored.tick(2.0),
		"settled front completes the battle after rewind-free restore")
	if outcomes.is_empty():
		return
	var result: Dictionary = outcomes[0]
	_check(result["winnerId"] == "a" and result["actorTroops"] == 250 and result["targetTroops"] == 100 and result["survivors"] == 150, "late attacker reinforcement changes winner without prior attrition")
	_check(rules.get_participant("a")["coinTotal"] == 5 and rules.get_participant("a")["troops"] == 150, "combat losses do not subtract historic coin contributions")


func _test_tie_and_gift_return() -> void:
	var rules := _pair(1, 1)
	rules.start_round()
	rules.request_attack("a", 2)
	var result: Dictionary = rules.tick(5.0)[0]
	_check(result["tie"] and result["winnerId"] == "" and result["survivors"] == 0 and result["transferredRegions"].is_empty(), "tie has no winner or capture")
	_check(rules.get_participant("a")["troops"] == 0 and rules.get_participant("b")["troops"] == 0, "tie consumes both forces without negative troops")
	_check(rules.get_region_owner(0) == "a" and rules.get_region_owner(1) == "b", "tie retains both territory owners")
	_check(not rules.request_attack("a", 2)["ok"], "empty army cannot attack")
	_check(rules.add_publisher_unit("b", "tank").ok and rules.unit_counts("b").tanks == 1,
		"manual grant can target a placed owner with zero soldiers")
	rules.accept_event(_event("a", 1, "tie:return:a"))
	_check(not rules.request_attack("b", 1)["ok"], "empty attacker is rejected even against a positive defender")
	var attack: Dictionary = rules.request_attack("a", 2)
	_check(attack.ok, "reinforced owner can attack a still-empty owner after a tie")
	if not attack.ok:
		return
	_check(rules.tick(1.0).is_empty() and rules.get_region_owner(1) == "b", "empty defender keeps ownership during siege")
	var battle: Dictionary = rules.view_state().battles[0]
	_check(battle.targetTroops == 0 and battle.frontControl > 0.0 and battle.frontControl < 1.0,
		"siege against empty defender advances gradually")
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(rules.serialize_state()))).ok,
		"active siege with an empty defender restores from JSON")
	var outcomes: Array = rules.tick(4.0)
	_check(outcomes.size() == 1 and outcomes == restored.tick(4.0), "restored siege resolves the same way")
	_check(rules.get_region_owner(1) == "a" and restored.get_region_owner(1) == "a"
		and rules.get_participant("a").troops == 50, "empty defender is captured when the siege ends")


func _test_air_capture_transfers_all_regions() -> void:
	for defender_reinforced in [false, true]:
		var rules := _pair()
		rules.claim_region("a", 18)
		rules.claim_region("b", 29)
		rules.claim_region("b", 9)
		rules.start_round()
		_check(not rules.request_attack("a", 2, {"from": 18, "to": 0}).ok, "air route requires an enemy-owned destination")
		_check(rules.request_attack("a", 2, {"from": 18, "to": 29}).ok, "one air battle uses two selected, non-base endpoints")
		_check(rules.tick(4.0).is_empty() and rules.get_region_owner(29) == "b" and rules.get_region_owner(9) == "b",
			"air siege leaves all ownership intact before resolution")
		var legacy: Dictionary = rules.serialize_state()
		legacy.battles[0].erase("airborne")
		var restored := _new()
		var reloaded: Dictionary = restored.restore_state(JSON.parse_string(JSON.stringify(legacy)))
		_check(reloaded.ok, "old air siege JSON reloads with its route")
		if not reloaded.ok:
			continue
		var battle: Dictionary = restored.view_state().battles[0]
		_check(battle.airborne and battle.captureFrom == 18 and battle.captureTo == 29 and battle.frontControl > 0.0,
			"legacy air battle retains endpoints and advancing front")
		var outcomes: Array
		var winner := "a"
		var loser := "b"
		var expected := [1, 9, 29]
		if defender_reinforced:
			restored.accept_event(_event("b", 3, "air:reinforce:b"))
			_check(restored.tick(1.0).is_empty() and restored.get_region_owner(18) == "a",
				"late reinforcements extend the air siege while the front reverses")
			winner = "b"
			loser = "a"
			expected = [0, 18]
			outcomes = restored.tick(3.0)
		else:
			outcomes = restored.tick(1.0)
		_check(outcomes.size() == 1 and outcomes[0].winnerId == winner and outcomes[0].transferredRegions == expected,
			"an air battle transfers all defeated territory in one result")
		_check(restored.get_participant(loser).troopRegion == -1 and restored.get_participant(loser).regions.is_empty()
			and restored.get_participant(loser).troops == 0, "air defeat leaves the loser unplaced with no soldiers")
		for region in expected:
			_check(restored.get_region_owner(region) == winner, "air victory transfers region " + str(region))


func _test_multiple_regions_and_captured_return() -> void:
	var rules := _pair(3, 1)
	rules.claim_region("a", 2)
	rules.claim_region("b", 3)
	rules.claim_region("b", 4)
	rules.start_round()
	rules.publisher_attack("a", 2)
	var result: Dictionary = rules.tick(5.0)[0]
	_check(result["transferredRegions"] == [1, 3, 4], "winner gains all loser regions")
	_check(rules.get_participant("a")["regions"] == [0, 1, 2, 3, 4] and rules.get_participant("a")["troops"] == 100, "multi-region victory has one surviving troop pool")
	for region_id in range(5):
		_check(rules.get_region_owner(region_id) == "a", "render ownership transferred: " + str(region_id))
	_check(rules.get_participant("b")["troopRegion"] == -1 and rules.get_participant("b")["regions"].is_empty(), "captured donor is unplaced")
	rules.accept_event(_event("b", 2, "captured:return"))
	_check(rules.get_participant("b")["number"] == 2 and rules.view_state()["pending"] == ["b"], "captured gift returns original identity to pending")
	_check(not rules.request_attack("b", 1)["ok"], "unplaced reinforcements cannot attack")
	_check(not rules.request_attack("a", 2)["ok"], "unplaced reinforcements cannot be attacked")
	_check(not rules.claim_region("b", 1)["ok"] and rules.claim_region("b", 5)["ok"], "returned donor requires a neutral manual placement")
	_check(rules.get_participant("b")["troops"] == 100 and rules.get_region_owner(5) == "b", "return gift is not lost")


func _test_garrison_allocation() -> void:
	var rules := _new()
	rules.accept_event(_event("a", 151))
	rules.claim_region("a", 25)
	_check(rules.region_troops(25) == 7550 and rules.region_troops(0) == 0 and rules.region_troops(37) == 0,
		"a single base holds the pool, with zero troops in neutral or unknown regions")
	rules.claim_region("a", 17)
	_check(rules.region_troops(25) == 3000 and rules.region_troops(17) == 4550,
		"the first non-base region receives all remaining troops")
	rules.claim_region("a", 4)
	_check(rules.region_troops(25) == 3000 and rules.region_troops(17) == 3000 and rules.region_troops(4) == 1550,
		"soldiers fill garrisons base-first in acquisition order")
	_check(rules.get_participant("a").regions == [4, 17, 25], "public territory list keeps its sorted order")
	var saved: Dictionary = rules.serialize_state()
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(saved))).ok
		and restored.region_troops(4) == 1550, "garrison order survives JSON reload")
	saved.participants[0].erase("garrisonOrder")
	_check(restored.restore_state(saved).ok and restored.region_troops(25) == 3000
		and restored.region_troops(4) == 3000 and restored.region_troops(17) == 1550,
		"legacy save uses the base first and then its stored region order")
	restored.claim_region("a", 2)
	restored.accept_event(_event("a", 49, "garrison:fill"))
	_check(restored.region_troops(17) == 3000 and restored.region_troops(2) == 1000,
		"newly acquired regions are appended after the legacy order")
	var capped := _new()
	var limit: int = _rules_script.MAX_INTEGER
	capped.set_soldiers_per_coin(1)
	capped.accept_event(_event("cap", limit - 4))
	capped.claim_region("cap", 9)
	capped.claim_region("cap", 0)
	capped.add_headquarters("cap", 9)
	capped.add_headquarters("cap", 0)
	capped.start_round()
	capped.tick(1e308)
	_check(capped.region_troops(0) == limit - 3000 and capped.region_troops(9) == 3000
		and capped.get_participant("cap").factoryRemainder == 0.0, "HQ production and allocation saturate at the exact integer cap")


func _test_headquarters_construction() -> void:
	var rules := _new()
	var initial := _event("a", 0)
	initial.bonusTanksPerGift = 1
	rules.accept_event(initial)
	rules.claim_region("a", 15)
	rules.claim_region("a", 9)
	_check(not rules.add_headquarters("missing", 15).ok and not rules.add_headquarters("", 1).ok
		and not rules.add_headquarters("a", 9, -1).ok, "HQ requires an owned region and a valid compatibility argument")
	var ready: Dictionary = rules.add_headquarters("a", 9, 3000)
	_check(ready.ok and ready.changed and not ready.waiting and ready.regionId == 15
		and rules.region_headquarters(15) == "ready" and rules.region_troops(15) == 0,
		"HQ requested on a secondary region builds immediately at the zero-soldier base")
	_check(rules.region_headquarters(9) == "" and rules.unit_counts("a").headquarters == 1,
		"one request creates exactly one ready HQ and no secondary-region HQ")
	var saved: Dictionary = rules.serialize_state()
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(saved))).ok
		and restored.serialize_state() == saved, "immediately ready HQ survives JSON reload")
	_check(not restored.add_headquarters("a", 9, 1).changed and not restored.add_headquarters("a", 15).changed
		and restored.serialize_state() == saved, "repeated requests keep one base HQ without changing its saved state")
	var gift := _event("a", 0, "hq:gift")
	gift.headquartersPerGift = 1
	restored.accept_event(gift)
	_check(restored.unit_counts("a").headquarters == 1 and restored.unit_counts("a").factories == 0,
		"HQ gift for an existing base HQ adds no extra HQ or factory producer")
	saved = restored.serialize_state()
	_check(restored.accept_event(gift).duplicate and restored.serialize_state() == saved, "gift replay cannot produce another HQ or more soldiers")
	restored.tick(10.0)
	_check(restored.serialize_state() == saved, "ready HQs produce only while running")
	restored.start_round()
	restored.tick(1.0)
	var units: Dictionary = restored.unit_counts("a")
	_check(units.soldiers == 5 and units.factories == 0 and units.headquarters == 1,
		"one new HQ produces five soldiers per second from zero without a threshold")
	# Old schema-1 saves may contain multiple region HQs and unfinished builds.
	var old := _new()
	old.accept_event(_event("a", 90))
	old.claim_region("a", 15)
	old.claim_region("a", 9)
	var legacy: Dictionary = old.serialize_state()
	legacy.schemaVersion = 1
	legacy.participants[0].erase("headquartersRequested")
	legacy.participants[0].erase("nextHeadquartersRequested")
	legacy.participants[0].headquarters = [
		{"regionId": 15, "minLocalTroops": 3000, "ready": true},
		{"regionId": 9, "minLocalTroops": 3000, "ready": false}]
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(legacy))).ok
		and restored.region_headquarters(15) == "ready" and restored.region_headquarters(9) == "pending",
		"explicit old-schema fixture retains ready and pending region HQs")
	saved = restored.serialize_state()
	_check(not restored.add_headquarters("a", 9, 1).changed and restored.serialize_state() == saved,
		"new base request leaves the old secondary HQ and its original threshold untouched")
	var reinforcement := _event("a", 30, "hq:legacy-reinforce")
	restored.accept_event(reinforcement)
	_check(restored.region_troops(9) == 3000 and restored.region_headquarters(9) == "ready",
		"qualifying gift activates an old pending HQ at its saved local threshold")
	saved = restored.serialize_state()
	_check(restored.accept_event(reinforcement).duplicate and restored.serialize_state() == saved,
		"legacy activation gift replay adds neither soldiers nor HQs")
	restored.start_round()
	restored.tick(1.0)
	units = restored.unit_counts("a")
	_check(units.soldiers == 6010 and units.factories == 0 and units.headquarters == 2,
		"two saved legacy HQs produce ten soldiers per second and remain separate from gift factories")


func _test_headquarters_production() -> void:
	var rules := _new()
	var gift := _event("factory", 0)
	gift["bonusFactoriesPerGift"] = 1
	rules.accept_event(gift)
	rules.place_participant("factory", 4)
	var legacy: Dictionary = rules.serialize_state()
	_check(not rules.add_headquarters("factory", 4, 5).waiting and rules.region_headquarters(4) == "ready",
		"new HQ ignores the old positive threshold argument at zero soldiers")
	rules.start_round()
	var split := _new()
	split.restore_state(rules.serialize_state())
	split.tick(1.0)
	_check(split.region_troops(4) == 10 and split.region_headquarters(4) == "ready",
		"gift factory and new ready HQ each produce five soldiers from the first second")
	split.tick(1.0)
	rules.tick(2.0)
	_check(rules.region_troops(4) == 20 and rules.serialize_state() == split.serialize_state()
		and rules.consume_factory_update(), "new HQ mixed production is identical across tick partitions")
	# Only an explicit old-schema save creates a threshold-gated pending HQ.
	legacy.schemaVersion = 1
	legacy.participants[0].erase("headquartersRequested")
	legacy.participants[0].erase("nextHeadquartersRequested")
	legacy.participants[0].headquarters = [{"regionId": 4, "minLocalTroops": 5, "ready": false}]
	_check(rules.restore_state(JSON.parse_string(JSON.stringify(legacy))).ok
		and rules.region_headquarters(4) == "pending", "old-schema pending HQ retains its custom five-soldier threshold")
	rules.start_round()
	split.restore_state(rules.serialize_state())
	split.tick(1.0)
	_check(split.region_troops(4) == 5 and split.region_headquarters(4) == "ready",
		"gift factory activates the old pending HQ on the qualifying tick")
	split.tick(1.0)
	rules.tick(2.0)
	_check(rules.region_troops(4) == 15 and rules.serialize_state() == split.serialize_state()
		and rules.consume_factory_update(), "old HQ production starts at its saved threshold within a long tick")
	var tie := _pair(1, 1)
	tie.claim_region("b", 16)
	tie.add_headquarters("a", 0, 50)
	tie.add_headquarters("b", 1, 50)
	tie.add_headquarters("b", 16)
	tie.start_round()
	tie.request_attack("a", 2)
	var outcomes: Array = tie.tick(5.0)
	_check(outcomes.size() == 1 and outcomes[0].tie and tie.region_troops(0) == 0 and tie.region_headquarters(0) == "ready",
		"a tie keeps the occupied HQ when the army falls to zero soldiers")
	tie.tick(0.1)
	tie.pause_round()
	var saved: Dictionary = tie.serialize_state()
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(saved))).ok
		and restored.get_participant("a").factoryRemainder == 0.5, "fractional HQ-only production survives reload")
	restored.tick(10.0)
	_check(restored.serialize_state() == saved, "pause freezes HQ production and its fraction")
	restored.resume_round()
	restored.tick(0.9)
	_check(restored.region_troops(0) == 5 and restored.region_troops(1) == 5, "ready HQ rebuilds a zero-soldier army")
	restored.accept_event(_event("a", 10, "hq:advantage"))
	restored.request_attack("a", 2, {"from": 0, "to": 16})
	outcomes = restored.tick(6.0)
	_check(outcomes.size() == 1 and restored.region_headquarters(0) == "ready",
		"winner retains its HQ and produces after claiming enemy territory")
	_check(restored.get_region_owner(1) == "a" and restored.get_region_owner(16) == "a"
		and restored.region_headquarters(1) == "" and restored.region_headquarters(16) == ""
		and restored.get_participant("a").troops == 505 and restored.get_participant("b").troops == 0,
		"capture clears ready and pending HQs and stops defeated production")
	var captured_request: Dictionary = restored.add_headquarters("a", 16, 0)
	_check(captured_request.ok and not captured_request.changed and captured_request.regionId == 0
		and restored.region_headquarters(16) == "" and restored.unit_counts("a").headquarters == 1,
		"request on captured territory targets the winner's existing base HQ without another producer")
	restored.finish_round()
	restored.reset_round()
	_check(restored.region_headquarters(0) == "" and restored.region_headquarters(16) == "", "reset clears all HQs")


func _test_headquarters_save_validation() -> void:
	var rules := _pair()
	rules.claim_region("a", 5)
	rules.add_headquarters("a", 0, 1)
	rules.add_headquarters("a", 5)
	var saved: Dictionary = rules.serialize_state()
	var reloaded := _new()
	_check(reloaded.restore_state(JSON.parse_string(JSON.stringify(saved))).ok
		and reloaded.get_participant("a").headquarters == [{"regionId": 0, "minLocalTroops": 0, "ready": true}],
		"new HQ save contains one immediately ready base HQ with no troop threshold")
	# Preserve validation of old per-region ready/pending HQ records explicitly.
	saved.schemaVersion = 1
	for participant in saved.participants:
		participant.erase("headquartersRequested")
		participant.erase("nextHeadquartersRequested")
	saved.participants[0].headquarters = [
		{"regionId": 0, "minLocalTroops": 1, "ready": true},
		{"regionId": 5, "minLocalTroops": 3000, "ready": false}]
	_check(reloaded.restore_state(JSON.parse_string(JSON.stringify(saved))).ok
		and reloaded.region_headquarters(0) == "ready" and reloaded.region_headquarters(5) == "pending",
		"old-schema fixture with multiple regional HQs remains valid before corruption tests")
	for mutation in ["duplicate", "foreign", "negative_threshold", "fractional_threshold", "status", "order"]:
		var corrupt := saved.duplicate(true)
		var participant: Dictionary = corrupt.participants[0]
		match mutation:
			"duplicate": participant.headquarters[1].regionId = 0
			"foreign": participant.headquarters[0].regionId = 1
			"negative_threshold": participant.headquarters[0].minLocalTroops = -1
			"fractional_threshold": participant.headquarters[0].minLocalTroops = 3.5
			"status": participant.headquarters[0].ready = "true"
			"order": participant.garrisonOrder = [5, 0]
		var restored := _new()
		_check(not restored.restore_state(corrupt).ok and restored.region_headquarters(0) == "",
			"malformed HQ or garrison save falls back safely: " + mutation)


func _test_long_deployment() -> void:
	var duration := 32.0
	var ground_seconds: float = _rules_script.deployment_seconds(duration, false)
	var air_seconds: float = _rules_script.deployment_seconds(duration, true)
	_check(ground_seconds >= 4.0 and ground_seconds <= 8.0 and air_seconds >= 7.0 and air_seconds <= 12.0
		and ground_seconds < air_seconds, "default deployment fits gradual land and air travel")
	for airborne in [false, true]:
		for short_duration in [0.1, 4.0, 5.0, 9.9, 10.0]:
			var short_deployment: float = _rules_script.deployment_seconds(short_duration, airborne)
			_check(short_deployment >= 0.0 and short_deployment < short_duration, "legacy duration leaves time for combat")
		var rules := _pair()
		var deployment := air_seconds if airborne else ground_seconds
		rules.set_battle_seconds(duration)
		rules.start_round()
		_check(rules.request_attack("a", 2, {"from": 0, "to": 1, "airborne": airborne}).ok, "explicit route accepts either travel type")
		rules.tick(deployment * 0.5)
		rules.pause_round()
		var saved: Dictionary = rules.serialize_state()
		var restored := _new()
		_check(restored.restore_state(JSON.parse_string(JSON.stringify(saved))).ok, "deployment resumes from a paused JSON save")
		restored.tick(100.0)
		_check(restored.view_state().battles[0].frontControl == 0.0, "front holds during travel and while paused")
		restored.resume_round()
		restored.set_battle_seconds(5.0)
		restored.tick(deployment * 0.5)
		_check(is_zero_approx(restored.view_state().battles[0].frontControl), "front stays still until contact")
		restored.tick(1.0)
		var battle: Dictionary = restored.view_state().battles[0]
		_check(battle.airborne == airborne and battle.duration == duration and battle.frontControl > 0.0,
			"front starts moving after deployment with the battle's original duration")
		_check(restored.tick(duration - deployment - 2.0).is_empty() and restored.get_region_owner(1) == "b",
			"advancing front leaves ownership intact before the end")
		_check(restored.tick(1.01).size() == 1 and restored.get_region_owner(1) == "a",
			"battle resolves once the original duration and front threshold are met")


func _test_reset_and_results_gifts() -> void:
	var rules := _pair()
	rules.accept_event(_event("pending", 4))
	rules.start_round()
	rules.finish_round()
	rules.accept_event(_event("a", 3, "results:a"))
	rules.accept_event(_event("new", 2))
	_check(rules.get_participant("a")["troops"] == 100 and rules.get_participant("a")["nextTroops"] == 150, "results gifts do not revive old placed army")
	_check(not rules.claim_region("new", 3)["ok"], "results gifts wait for next round")
	_check(rules.reset_round(true)["ok"], "reset succeeds from results")
	var state: Dictionary = rules.view_state()
	_check(state["phase"] == "staging" and state["battles"].is_empty() and state["results"].is_empty(), "reset is clean staging without autostart")
	_check(rules.get_participant("b").is_empty(), "old placed donor not refilled next round")
	_check(state["pending"] == ["a", "pending", "new"], "pending and post-result donations survive reset")
	_check(rules.get_participant("a")["troops"] == 150 and rules.get_participant("a")["coinTotal"] == 3, "only new results credit returns from placed donor")
	_check(rules.get_participant("a")["number"] == 1 and rules.get_participant("pending")["number"] == 2 and rules.get_participant("new")["number"] == 3, "retained pending numbers start fresh ascending")
	for region in state["regions"]:
		_check(region["ownerId"] == "", "reset map neutral region " + str(region["id"]))
	_check(not rules.accept_event(_event("a", 3, "results:a"))["applied"], "replay protection survives reset")
	rules.start_round()
	rules.finish_round()
	rules.reset_round(false)
	_check(rules.view_state()["participants"].is_empty(), "configured discard clears pending")
	_check(not rules.accept_event(_event("pending", 4))["applied"], "discard does not re-enable stale gifts")
	rules.accept_event(_event("fresh", 1))
	_check(rules.get_participant("fresh")["number"] == 1 and rules.view_state()["phase"] == "staging", "empty new round numbers fresh and no autostart")


func _test_state_machine() -> void:
	var rules := _pair()
	_check(not rules.pause_round()["ok"] and not rules.resume_round()["ok"] and not rules.finish_round()["ok"] and not rules.reset_round()["ok"], "invalid staging transitions blocked")
	_check(rules.start_round()["ok"] and not rules.start_round()["ok"], "manual start can happen once")
	_check(not rules.reset_round()["ok"], "reset cannot silently cancel running round")
	rules.request_attack("a", 2)
	rules.pause_round()
	_check(not rules.pause_round()["ok"] and not rules.start_round()["ok"], "paused start/pause cannot reset battles")
	_check(rules.finish_round()["ok"] and rules.view_state()["battles"].is_empty(), "manual finish cancels outstanding battle even while paused")
	_check(rules.tick(100.0).is_empty() and rules.get_participant("a")["troops"] == 100, "cancelled battle has no later losses")
	_check(not rules.start_round()["ok"] and not rules.resume_round()["ok"], "results require reset before new start")
	_check(rules.reset_round()["ok"] and rules.view_state()["phase"] == "staging", "results returns to staging")


func _test_snapshot_isolation() -> void:
	var rules := _pair()
	rules.start_round()
	rules.request_attack("a", 2)
	var before: Dictionary = rules.serialize_state()
	var state: Dictionary = rules.view_state()
	var active_battles: Array = rules.active_battles_view()
	_check(active_battles == state.battles and active_battles[0].actorTroops == 100
		and active_battles[0].targetTroops == 50, "active battle view matches full state with current troop totals")
	active_battles[0]["frontControl"] = -1.0
	active_battles.clear()
	state["participants"][0]["troops"] = -100
	state["participants"][0]["regions"].append(36)
	state["regions"][0]["ownerId"] = "fake"
	state["battles"][0]["elapsed"] = 100.0
	var donor: Dictionary = rules.get_participant("a")
	donor["regions"].clear()
	_check(rules.serialize_state() == before, "view and participant results are deep copies")
	for delta in [-1.0, 0.0, NAN, INF]:
		_check(rules.tick(delta).is_empty() and rules.serialize_state() == before, "invalid tick is atomic no-op: " + str(delta))
	_check(not rules.set_battle_seconds(NAN)["ok"] and not rules.set_battle_seconds(0.0)["ok"], "invalid durations rejected")
	rules.tick(5.0)
	state = rules.view_state()
	state["results"][0]["transferredRegions"].clear()
	_check(rules.view_state()["results"][0]["transferredRegions"] == [1], "result territory list is also isolated")


func _test_save_round_trip_and_replay() -> void:
	var rules := _pair(2, 3)
	rules.claim_region("a", 36)
	rules.claim_region("b", 2)
	rules.start_round()
	rules.handle_chat("a", "#2")
	rules.tick(2.0)
	rules.pause_round()
	var saved: Dictionary = rules.serialize_state()
	var restored := _new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(saved)))["ok"], "versioned JSON round trip accepts numeric float decoding")
	var original_view: Dictionary = rules.view_state()
	var restored_view: Dictionary = restored.view_state()
	var original_front: float = original_view.battles[0].frontControl
	var restored_front: float = restored_view.battles[0].frontControl
	original_view.battles[0].erase("frontControl")
	restored_view.battles[0].erase("frontControl")
	_check(restored_view == original_view and is_equal_approx(restored_front, original_front),
		"restored profile/owners/battle/progress match within JSON float precision")
	_check(not restored.accept_event(_event("b", 3))["applied"], "restored event IDs reject replay")
	_check(restored.tick(100.0).is_empty(), "restored paused battle remains paused")
	rules.resume_round()
	restored.resume_round()
	_check(rules.tick(3.0) == restored.tick(3.0), "restored battle resolves identically")
	var result_saved: Dictionary = restored.serialize_state()
	var result_restored := _new()
	_check(result_restored.restore_state(JSON.parse_string(JSON.stringify(result_saved)))["ok"], "resolved result schema round trip")
	_check(result_restored.view_state() == restored.view_state(), "resolved result JSON round trip retains strict state equality")
	var result: Dictionary = result_restored.view_state()["results"][0]
	for field in ["battleId", "actorTroops", "targetTroops", "survivors"]:
		_check(typeof(result[field]) == TYPE_INT, "restored result field remains integer: " + field)
	_check(result["transferredRegions"] == [0, 36] and typeof(result["transferredRegions"][0]) == TYPE_INT
		and typeof(result["transferredRegions"][1]) == TYPE_INT, "restored captured region array contains integer IDs")
	restored.finish_round()
	restored.accept_event(_event("b", 2, "save:results"))
	_check(_new().restore_state(restored.serialize_state())["ok"], "results pending credits serializable")


func _test_corrupt_saves() -> void:
	var rules := _pair()
	var base: Dictionary = rules.serialize_state()
	var invalids: Array = [null, [], {}, {"schemaVersion": 999}]
	for field in ["schemaVersion", "phase", "soldiersPerCoin", "battleSeconds", "participants", "battles", "results", "seenEventIds", "nextNumber", "nextBattleId"]:
		var missing: Dictionary = base.duplicate(true)
		missing.erase(field)
		invalids.append(missing)
	for field in ["id", "number", "username", "nickname", "portraitUrl", "coinTotal", "troops", "troopRegion", "regions", "nextCoins", "nextTroops"]:
		var missing: Dictionary = base.duplicate(true)
		missing["participants"][0].erase(field)
		invalids.append(missing)
	for mutation in ["schema", "negative", "number", "region", "duplicate", "profile", "pending"]:
		var bad: Dictionary = base.duplicate(true)
		match mutation:
			"schema": bad["schemaVersion"] = 2
			"negative": bad["participants"][0]["troops"] = -1
			"number": bad["participants"][1]["number"] = 1
			"region": bad["participants"][1]["regions"] = [0]
			"duplicate": bad["participants"].append(bad["participants"][0].duplicate(true))
			"profile": bad["participants"][0]["portraitUrl"] = null
			"pending": bad["participants"][0]["nextTroops"] = 10
		invalids.append(bad)
	rules.start_round()
	rules.request_attack("a", 2)
	for mutation in ["nan", "owner", "self", "empty_actor", "phase", "busy"]:
		var bad: Dictionary = rules.serialize_state()
		match mutation:
			"nan": bad["battles"][0]["elapsed"] = NAN
			"owner": bad["battles"][0]["actorRegion"] = 1
			"self": bad["battles"][0]["actorId"] = "b"
			"empty_actor": bad["participants"][0]["troops"] = 0
			"phase": bad["phase"] = "results"
			"busy":
				bad["battles"].append(bad["battles"][0].duplicate(true))
				bad["battles"][1]["id"] = 2
				bad["nextBattleId"] = 3
		invalids.append(bad)
	for field in ["id", "actorId", "targetId", "actorRegion", "targetRegion", "elapsed", "duration"]:
		var missing: Dictionary = rules.serialize_state()
		missing["battles"][0].erase(field)
		invalids.append(missing)
	rules.tick(5.0)
	for field in ["battleId", "actorId", "targetId", "actorTroops", "targetTroops", "winnerId", "loserId", "tie", "survivors", "transferredRegions"]:
		var missing: Dictionary = rules.serialize_state()
		missing["results"][0].erase(field)
		invalids.append(missing)
	for bad in invalids:
		var restored := _pair()
		_check(not restored.restore_state(bad)["ok"], "corrupt save rejected")
		_check(restored.view_state()["phase"] == "staging" and restored.view_state()["participants"].is_empty() and restored.get_region_owner(0) == "", "corrupt save returns safe empty default")


func _test_disjoint_battles_and_tick_partition() -> void:
	var rules := _pair(3, 1)
	rules.accept_event(_event("c", 1))
	rules.accept_event(_event("d", 4))
	rules.claim_region("c", 2)
	rules.claim_region("d", 3)
	rules.start_round()
	_check(rules.request_attack("a", 2)["ok"] and rules.request_attack("c", 4)["ok"], "disjoint battles allowed")
	var copy := _new()
	copy.restore_state(rules.serialize_state())
	for i in range(4):
		_check(copy.tick(1.0).is_empty(), "partitioned tick waits for duration")
	var partitioned: Array = copy.tick(1.0)
	var single: Array = rules.tick(5.0)
	_check(partitioned == single and copy.serialize_state() == rules.serialize_state(), "tick partition deterministic for independent simultaneous battles")
	_check(single.size() == 2 and single[0]["battleId"] == 1 and single[1]["battleId"] == 2, "simultaneous resolution ordered by battle ID")
	_check(rules.get_participant("a")["troops"] == 100 and rules.get_participant("d")["troops"] == 150, "disjoint armies never affect each other")


func _test_combat_math_grid() -> void:
	# Exhaust all small positive force pairs; no random seed, timing or resources.
	for a in range(1, 13):
		for b in range(1, 13):
			var rules := _pair(a, b)
			rules.start_round()
			rules.request_attack("a", 2)
			var result: Dictionary = rules.tick(5.0)[0]
			var expected_a: int = maxi(0, a - b) * 50
			var expected_b: int = maxi(0, b - a) * 50
			_check(rules.get_participant("a")["troops"] == expected_a and rules.get_participant("b")["troops"] == expected_b and result["survivors"] == absi(a - b) * 50, "exhaustive battle conservation " + str(a) + ":" + str(b))
			var expected_winner := "" if a == b else ("a" if a > b else "b")
			_check(result["winnerId"] == expected_winner, "exhaustive deterministic winner " + str(a) + ":" + str(b))
