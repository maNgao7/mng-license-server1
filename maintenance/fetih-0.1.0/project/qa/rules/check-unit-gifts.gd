extends SceneTree
## Native gate: Run-Game.ps1 -Script <this file> -Profile <isolated QA directory>
## -GameArguments @('--self-test') -Headless -Wait
## Synthetic events only. This script uses no live connection or disk saves.

var _rules: GDScript
var _checks := 0
var _failures: PackedStringArray = []


func _initialize() -> void:
	var directory: String = get_script().resource_path.get_base_dir().path_join("../mod").simplify_path()
	_rules = load(directory.path_join("WarRules.gd"))
	var dialog: GDScript = load(directory.path_join("GiftActions.gd"))
	if not _check(_rules != null and _rules.can_instantiate(), "WarRules loads"):
		quit(1)
		return
	_test_earned_and_replayed_units()
	_test_custom_soldiers_and_limits()
	_test_large_army()
	_test_factory_clock_and_save()
	_test_factory_at_battle_end()
	_test_results_and_reset()
	_test_zero_coin_explicit_actions()
	_test_old_and_corrupt_saves()
	if _check(dialog != null and dialog.can_instantiate(), "GiftActions dialog loads"):
		_test_settings_shape(dialog)
	if _failures.is_empty():
		print("ANIMAL_UNIT_GIFTS_OK: %d checks" % _checks)
		quit(0)
	else:
		printerr("ANIMAL_UNIT_GIFTS_FAILED: %d of %d checks" % [_failures.size(), _checks])
		quit(1)


func _check(condition: bool, label: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(label)
		printerr("UNIT_GIFTS_FAIL: ", label)
	return condition


func _gift(id: String, receipt: String, coins: int = 1, count: int = 1, action: Dictionary = {}) -> Dictionary:
	var event := {"participantId": id, "eventId": receipt, "coinValue": coins, "completedCount": count}
	event.merge(action)
	return event


func _counts(soldiers: int, tanks: int, helicopters: int, factories: int) -> Dictionary:
	return {"soldiers": soldiers, "tanks": tanks, "helicopters": helicopters, "factories": factories, "headquarters": 0}


func _test_large_army() -> void:
	var rules: RefCounted = _rules.new()
	var event := _gift("large", "large-gift", 10, 75,
		{"bonusTanksPerGift": 1250, "bonusHelicoptersPerGift": 1500, "bonusJetsPerGift": 1100})
	_check(rules.accept_event(event).applied and rules.accept_event(event).duplicate,
		"large gifts apply once with over 1000 combat vehicles per gift")
	_check(rules.place_participant("large", 2).ok and not rules.place_participant("large", 3).ok,
		"the large army still gets one initial placement")
	_check(rules.add_publisher_unit("large", "helicopter").ok and rules.add_publisher_unit("large", "tank").ok,
		"publisher can add vehicles to a large army")
	var units: Dictionary = rules.unit_counts("large")
	_check(units.soldiers == 37500 and rules.region_troops(2) == 37500 and units.tanks >= 93751
		and units.helicopters >= 112501 and units.jets == 82500,
		"large counts remain credited and all troops stay in the only owned region")

func _test_earned_and_replayed_units() -> void:
	var rules: RefCounted = _rules.new()
	_check(rules.unit_counts("missing") == _counts(0, 0, 0, 0), "unknown donor starts at zero")
	rules.set_soldiers_per_coin(1)
	rules.accept_event(_gift("a", "t0", 449))
	_check(rules.unit_counts("a") == _counts(449, 0, 0, 0), "no tank below 450 soldiers")
	rules.accept_event(_gift("a", "t1"))
	_check(rules.unit_counts("a") == _counts(450, 1, 0, 0), "first tank at 450 soldiers")
	rules.accept_event(_gift("a", "h0", 1149))
	_check(rules.unit_counts("a") == _counts(1599, 3, 0, 0), "no helicopter below 1600 soldiers")
	rules.accept_event(_gift("a", "h1"))
	_check(rules.unit_counts("a") == _counts(1600, 3, 1, 0), "first helicopter at 1600 soldiers")
	var event := _gift("a", "units", 2, 3, {"bonusTanksPerGift": 2, "bonusHelicoptersPerGift": 1, "bonusFactoriesPerGift": 2})
	var accepted: Dictionary = rules.accept_event(event)
	_check(accepted.ok and accepted.bonusTanksAdded == 6 and accepted.bonusHelicoptersAdded == 3 and accepted.bonusFactoriesAdded == 6,
		"all bonuses multiply the completed gift delta")
	_check(rules.unit_counts("a") == _counts(1606, 9, 4, 6), "earned and gift units are added")
	var saved: Dictionary = rules.serialize_state()
	_check(rules.accept_event(event).duplicate and rules.serialize_state() == saved, "replayed event changes neither troops nor units")
	_check(rules.accept_event(_gift("a", "later-delta", 2, 2, {"bonusTanksPerGift": 2})).applied
		and rules.unit_counts("a").tanks == 13, "later completed delta applies independently")
	_check(rules.view_state().phase == "staging", "unit and factory gifts do not start the war")


func _test_custom_soldiers_and_limits() -> void:
	var rules: RefCounted = _rules.new()
	var custom: Dictionary = rules.accept_event(_gift("a", "custom", 10, 2, {"soldiersPerGift": 75}))
	_check(custom.applied and custom.troopsAdded == 150 and rules.get_participant("a").coinTotal == 20,
		"custom soldiers replace default conversion and preserve actual coins")
	rules.set_soldiers_per_coin(75)
	rules.accept_event(_gift("a", "normal", 2))
	_check(rules.unit_counts("a").soldiers == 300, "the default ratio applies to subsequent unmapped gifts")
	var saved: Dictionary = rules.serialize_state()
	for action in [{"bonusTanksPerGift": -1}, {"bonusHelicoptersPerGift": 1.5}, {"bonusFactoriesPerGift": 1001},
			{"bonusFactoriesPerGift": true}, {"soldiersPerGift": 0}, {"soldiersPerGift": 100001}, {"soldiersPerGift": INF}]:
		_check(not rules.accept_event(_gift("a", "bad", 1, 1, action)).ok and rules.serialize_state() == saved,
			"invalid amount is rejected without applying or consuming the receipt")
	_check(rules.accept_event(_gift("a", "bad", 1, 1, {"bonusFactoriesPerGift": 1000})).applied,
		"corrected event can use the original receipt")
	var limit: int = _rules.MAX_INTEGER
	rules.set_soldiers_per_coin(1)
	saved = rules.serialize_state()
	_check(not rules.accept_event(_gift("b", "overflow", 1, limit, {"bonusTanksPerGift": 2})).ok
		and rules.serialize_state() == saved, "combined gift multiplication cannot overflow")
	_check(not rules.accept_event(_gift("b", "earned-overflow", 1, limit, {"bonusTanksPerGift": 1})).ok,
		"gift and earned unit totals stay JSON-exact")
	var capped: RefCounted = _rules.new()
	capped.set_soldiers_per_coin(1)
	capped.accept_event(_gift("a", "near-cap", limit - 4, 1, {"bonusFactoriesPerGift": 1}))
	capped.start_round()
	capped.tick(1e308)
	_check(capped.unit_counts("a").soldiers == limit and capped.get_participant("a").factoryRemainder == 0.0,
		"factory production saturates safely even with an enormous finite tick")


func _test_factory_clock_and_save() -> void:
	var rules: RefCounted = _rules.new()
	var updates := 0
	rules.accept_event(_gift("a", "factory", 1, 1, {"bonusFactoriesPerGift": 1}))
	rules.tick(10.0)
	_check(rules.unit_counts("a").soldiers == 50 and not rules.consume_factory_update(), "factories do not run in staging")
	rules.start_round()
	rules.tick(0.1)
	_check(rules.unit_counts("a").soldiers == 50 and not rules.consume_factory_update(), "fractional production does not invent a whole soldier")
	rules.pause_round()
	var paused: Dictionary = rules.serialize_state()
	rules.tick(10.0)
	_check(rules.serialize_state() == paused, "pause freezes fractional production")
	var restored: RefCounted = _rules.new()
	_check(restored.restore_state(JSON.parse_string(JSON.stringify(paused))).ok, "JSON restore accepts fractional factory progress")
	_check(is_equal_approx(restored.get_participant("a").factoryRemainder, 0.5), "fractional factory progress survives restore")
	rules.resume_round()
	restored.resume_round()
	for _step in range(9):
		rules.tick(0.1)
		restored.tick(0.1)
		if rules.consume_factory_update():
			updates += 1
	_check(rules.unit_counts("a") == _counts(55, 0, 0, 1) and updates == 5 and not rules.consume_factory_update(),
		"one factory produces exactly five soldiers per elapsed second and marks whole production once")
	_check(restored.serialize_state() == rules.serialize_state(), "restored production matches uninterrupted production")
	rules.accept_event(_gift("a", "second", 1, 1, {"bonusFactoriesPerGift": 1}))
	rules.tick(1.0)
	_check(rules.unit_counts("a").soldiers == 115, "two factories yield ten additional soldiers per second")
	_check(rules.get_participant("a").coinTotal == 2 and rules.serialize_state().seenEventIds.size() == 2,
		"factory production generates neither coins nor synthetic gift events")


func _test_factory_at_battle_end() -> void:
	var rules: RefCounted = _rules.new()
	rules.set_soldiers_per_coin(1)
	rules.set_battle_seconds(1.0)
	rules.accept_event(_gift("a", "a", 100, 1, {"bonusTanksPerGift": 1, "bonusFactoriesPerGift": 1}))
	rules.accept_event(_gift("b", "b", 99, 1, {"bonusHelicoptersPerGift": 1, "bonusFactoriesPerGift": 1}))
	rules.claim_region("a", 0)
	rules.claim_region("b", 1)
	rules.start_round()
	rules.request_attack("a", 2)
	var battles: Array = rules.tick(2.0)
	_check(battles.size() == 1 and battles[0].actorTroops == 105 and battles[0].targetTroops == 104,
		"battle strength includes only production before the battle ended")
	_check(rules.unit_counts("a") == _counts(0, 0, 0, 0) and rules.unit_counts("b") == _counts(56, 0, 0, 1),
		"stronger helicopter support wins, vehicle attrition is retained, and only the winner continues production")


func _test_results_and_reset() -> void:
	var rules: RefCounted = _rules.new()
	rules.accept_event(_gift("a", "old", 1, 1, {"bonusFactoriesPerGift": 2}))
	rules.accept_event(_gift("b", "pending", 1, 1, {"bonusHelicoptersPerGift": 1, "bonusFactoriesPerGift": 1}))
	rules.claim_region("a", 0)
	rules.start_round()
	rules.tick(0.1)
	rules.finish_round()
	var queued := _gift("a", "queued", 1, 2, {"bonusTanksPerGift": 1, "bonusFactoriesPerGift": 1})
	rules.accept_event(queued)
	rules.accept_event(_gift("b", "pending-queued", 1, 1, {"bonusFactoriesPerGift": 1}))
	rules.tick(100.0)
	_check(rules.unit_counts("a") == _counts(51, 0, 0, 2), "results gifts do not change the finished army")
	_check(rules.reset_round(true).ok and rules.get_region_owner(0).is_empty(),
		"reset preserves pending credit with a clean neutral map")
	_check(rules.unit_counts("a") == _counts(100, 2, 0, 2), "only queued gifts survive for the formerly placed donor")
	_check(rules.unit_counts("b") == _counts(100, 0, 1, 2) and is_equal_approx(rules.get_participant("b").factoryRemainder, 0.5),
		"unplaced current units and factory fraction merge with queued units")
	_check(rules.accept_event(queued).duplicate, "round reset does not forget event receipts")
	rules.start_round()
	rules.finish_round()
	rules.reset_round(false)
	_check(rules.unit_counts("a") == _counts(0, 0, 0, 0) and rules.unit_counts("b") == _counts(0, 0, 0, 0),
		"discarding pending credit clears all units")


func _test_old_and_corrupt_saves() -> void:
	var rules: RefCounted = _rules.new()
	rules.accept_event(_gift("a", "legacy", 32))
	var legacy: Dictionary = rules.serialize_state()
	for key in ["bonusTanks", "nextBonusTanks", "bonusHelicopters", "nextBonusHelicopters", "factories", "nextFactories", "factoryRemainder"]:
		legacy.participants[0].erase(key)
	var restored: RefCounted = _rules.new()
	_check(legacy.schemaVersion == 1 and restored.restore_state(legacy).ok and restored.unit_counts("a") == _counts(1600, 3, 1, 0),
		"pre-feature saves recover earned units and zero bonuses without a version bump")
	_check(restored.accept_event(_gift("a", "legacy", 32)).duplicate, "old save receipts still prevent replay")
	var invalid: Dictionary = restored.serialize_state()
	invalid.participants[0].nextFactories = 1
	_check(not restored.restore_state(invalid).ok, "save cannot contain queued units outside results")
	invalid = legacy.duplicate(true)
	invalid.participants[0].factoryRemainder = 1.0
	_check(not restored.restore_state(invalid).ok, "invalid factory fraction is rejected")


func _test_zero_coin_explicit_actions() -> void:
	var rules: RefCounted = _rules.new()
	_check(not rules.accept_event(_gift("a", "unpriced", 0)).ok, "unmapped zero-coin gift is still rejected")
	_check(rules.accept_event(_gift("a", "unpriced", 0, 1, {"bonusFactoriesPerGift": 1})).applied
		and rules.unit_counts("a") == _counts(0, 0, 0, 1) and rules.view_state().pending == ["a"],
		"mapped unpriced gift adds a factory and preserves the pending donor without inventing coins")
	var restored: RefCounted = _rules.new()
	_check(restored.restore_state(rules.serialize_state()).ok, "unit-only pending gifts can be restored")
	rules.start_round()
	rules.tick(1.0)
	_check(rules.unit_counts("a") == _counts(5, 0, 0, 1), "a factory can produce the donor's first soldiers")
	rules.finish_round()
	_check(rules.accept_event(_gift("b", "pending-unpriced", 0, 1, {"bonusTanksPerGift": 2})).ok,
		"unit-only results gift queues successfully")
	_check(rules.reset_round(true).ok and rules.unit_counts("b") == _counts(0, 2, 0, 0)
		and rules.view_state().pending.has("b"), "reset retains queued units without invented soldiers")
	_check(rules.accept_event(_gift("b", "explicit-soldiers", 0, 2, {"soldiersPerGift": 40})).troopsAdded == 80
		and rules.get_participant("b").coinTotal == 0, "explicit soldiers apply at zero coin value")


func _test_settings_shape(dialog: GDScript) -> void:
	var actions := {"5655": {"unit": "tank", "count": 3.0}, "5269": {"unit": "factory", "count": 2},
		"5593": {"unit": "soldiers", "count": 100000}, "42": {"unit": "helicopter", "count": 1},
		"../../bad": {"unit": "tank", "count": 1}, "11": {"unit": "tank", "count": 1001},
		"12": {"unit": "unknown", "count": 1}, "13": {"unit": "soldiers", "count": 0.5}}
	var good: Dictionary = dialog.normalize_actions(actions)
	_check(good.size() == 5 and good["5655"].count == 3 and typeof(good["5655"].count) == TYPE_INT
		and good["11"].count == 1001, "dialog normalizes large vehicle actions and rejects malformed settings")
	_check(good["5593"].count == 100000 and dialog.normalize_actions([]).is_empty(),
		"custom soldier maximum is valid and malformed settings fall back safely")
