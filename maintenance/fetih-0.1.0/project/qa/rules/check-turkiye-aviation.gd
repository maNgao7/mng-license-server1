extends SceneTree
## Synthetic gifts, save migration and full battles on the native Godot runtime.

const Rules = preload("../../mod/WarRules.gd")
const Actions = preload("../../mod/GiftActions.gd")

var checks := 0
var failures := 0

func _initialize() -> void:
	_coin_milestones()
	_soldier_milestones()
	_legacy_save()
	_air_battle()
	_air_tank_support()
	_large_force()
	if failures == 0:
		print("TURKIYE_AVIATION_OK: %d checks" % checks)
	quit(0 if failures == 0 else 1)

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error(label)

func gift(owner: String, receipt: String, coins: int, count: int = 1, action: Dictionary = {}) -> Dictionary:
	var event := {"participantId": owner, "eventId": receipt, "coinValue": coins, "completedCount": count}
	event.merge(action)
	return event

func _soldier_milestones() -> void:
	var rules := Rules.new(15, false, true)
	for index in 9:
		check(rules.accept_event(gift("army", "initial-" + str(index), 1)).troopsAdded == 50, "one coin adds 50 troops")
	check(rules.unit_counts("army").helicopters == 0 and rules.unit_counts("army").jets == 0, "450 troops earns no aircraft")
	var crossing: Dictionary = rules.accept_event(gift("army", "one-helicopter", 1))
	check(crossing.automaticHelicoptersAdded == 1 and crossing.automaticJetsAdded == 0, "500 troops earns one helicopter")
	crossing = rules.accept_event(gift("army", "one-jet", 10))
	check(crossing.automaticHelicoptersAdded == 1 and crossing.automaticJetsAdded == 1
		and rules.unit_counts("army").helicopters == 2 and rules.unit_counts("army").jets == 1, "1000 troops earns two helicopters and one jet")
	check(rules.accept_event(gift("army", "one-jet", 10)).duplicate
		and rules.unit_counts("army").jets == 1, "replayed gift does not unlock another jet")
	rules.claim_region("army", 0)
	rules.add_headquarters("army", 0)
	rules.start_round()
	rules.tick(0.99)
	check(rules.unit_counts("army").soldiers == 1000, "headquarters does not trickle individual soldiers")
	rules.tick(0.01)
	check(rules.unit_counts("army").soldiers == 1005 and rules.consume_headquarters_ticks().get(0) == 1,
		"whole second grants five soldiers and raises a visual pulse")
	var restored := Rules.new(15, false, true)
	check(restored.restore_state(rules.serialize_state()).ok and restored.unit_counts("army").jets == 1,
		"new aviation and headquarters semantics survive reload")
	var legacy := rules.serialize_state()
	legacy.erase("productionRemainderInSeconds")
	legacy.participants[0].factoryRemainder = 0.5
	check(restored.restore_state(legacy).ok and is_equal_approx(restored.get_participant("army").factoryRemainder, 0.1),
		"a fractional soldier in an old save converts to a fraction of a production second")


func _coin_milestones() -> void:
	var rules := Rules.new(15, true)
	check(rules.unit_counts("a").jets == 0, "empty forces expose jets")
	var first := gift("a", "initial", 33, 3, {"bonusHelicoptersPerGift": 2, "soldiersPerGift": 1})
	var credited := rules.accept_event(first)
	check(credited.automaticHelicoptersAdded == 0 and credited.bonusHelicoptersAdded == 6
		and rules.unit_counts("a").soldiers == 3, "mapped soldiers and aircraft keep independent amounts")
	check(rules.accept_event(first).duplicate, "same completion does not advance milestones")
	var restored := Rules.new(15, true)
	check(restored.restore_state(JSON.parse_string(JSON.stringify(rules.serialize_state()))).ok,
		"reload 99-coin remainder")
	var crossing := restored.accept_event(gift("a", "cross", 1, 1, {"bonusHelicoptersPerGift": 1}))
	check(crossing.automaticHelicoptersAdded == 1 and crossing.bonusHelicoptersAdded == 1
		and restored.unit_counts("a").helicopters == 8 and restored.unit_counts("a").soldiers == 53,
		"100th coin and separately configured helicopter both grant once at 50 soldiers per coin")
	var multiple := restored.accept_event(gift("a", "large", 299))
	check(multiple.automaticHelicoptersAdded == 2 and restored.unit_counts("a").helicopters == 10,
		"one gift can cross several milestones and keeps its remainder")
	check(restored.claim_region("a", 14).ok and not restored.claim_region("a", 15).ok,
		"map-specific rules accept only their own region IDs")
	restored.start_round()
	restored.finish_round()
	var queued := restored.accept_event(gift("a", "queued", 1, 2, {"bonusJetsPerGift": 3}))
	check(queued.automaticHelicoptersAdded == 1 and queued.bonusJetsAdded == 6
		and restored.unit_counts("a").jets == 0 and restored.unit_counts("a").helicopters == 10,
		"results-phase milestones and jets wait for the next round")
	check(restored.reset_round().ok and restored.unit_counts("a").helicopters == 1
		and restored.unit_counts("a").jets == 6 and restored.view_state().pending == ["a"]
		and restored.get_region_owner(14).is_empty(), "reset transfers only pending units to a neutral map")
	check(restored.accept_event(gift("a", "next", 99)).automaticHelicoptersAdded == 1,
		"new round uses the post-queue coin remainder")
	check(restored.add_publisher_unit("a", "jet").error == "participant_not_placed",
		"publisher grant requires a placed army")
	restored.claim_region("a", 3)
	check(restored.add_publisher_unit("a", "jet").ok and restored.unit_counts("a").jets == 7,
		"publisher jet grant joins the placed owner")
	var actions := {"5": {"unit": "jet", "count": 3}, "6": {"unit": "jet", "count": 1001}}
	var overflow := {"7": {"unit": "jet", "count": Rules.MAX_INTEGER + 1}}
	check(Actions.normalize_actions(actions.merged(overflow)) == actions,
		"jet gift multipliers accept large counts and reject exact-integer overflow")

func _legacy_save() -> void:
	var old := Rules.new()
	old.accept_event(gift("legacy", "old", 99, 1, {"bonusHelicoptersPerGift": 2}))
	old.claim_region("legacy", 36)
	var snapshot := old.serialize_state()
	for field in ["automaticHelicopters", "nextAutomaticHelicopters", "bonusJets", "nextBonusJets"]:
		snapshot.participants[0].erase(field)
	var restored := Rules.new(37, true)
	check(restored.restore_state(snapshot).ok and restored.get_region_owner(36) == "legacy"
		and restored.unit_counts("legacy").jets == 0 and restored.unit_counts("legacy").helicopters == 5,
		"schema 1 keeps the original owners, earned vehicles and gift bonuses")
	check(restored.accept_event(gift("legacy", "old", 99)).duplicate
		and restored.accept_event(gift("legacy", "new", 1)).automaticHelicoptersAdded == 1
		and restored.unit_counts("legacy").helicopters == 6, "migration credits only new milestones")
	var again := Rules.new(37, true)
	check(again.restore_state(restored.serialize_state()).ok and again.unit_counts("legacy").helicopters == 6,
		"reopening migrated state never re-awards its historical vehicles")
	again.start_round()
	again.finish_round()
	again.reset_round()
	check(again.get_participant("legacy").is_empty(), "empty new round does not repopulate old armies")
	again.accept_event(gift("legacy", "rejoin-first", 99))
	again.claim_region("legacy", 36)
	again.start_round()
	again.finish_round()
	again.reset_round()
	check(again.accept_event(gift("legacy", "rejoin-second", 1)).automaticHelicoptersAdded == 1,
		"retired player's remainder survives a clean round without restoring their army")

func _air_battle() -> void:
	var rules := Rules.new(15, true)
	rules.set_battle_seconds(36.0)
	rules.accept_event(gift("a", "a-base", 20))
	rules.accept_event(gift("b", "b-base", 18))
	rules.claim_region("a", 0)
	rules.claim_region("b", 14)
	rules.start_round()
	var air := {"from": 0, "to": 14, "airborne": true}
	check(not rules.request_attack("a", 2, air).ok, "air route requires an aircraft even with ground tanks")
	check(rules.accept_event(gift("a", "jets", 0, 2, {"bonusJetsPerGift": 2})).bonusJetsAdded == 4
		and rules.army_power("a") == 3400.0, "jets are independent of coins and contribute force")
	check(rules.request_attack("a", 2, air).ok, "jet alone opens an air route")
	var saved := Rules.new(15, true)
	check(saved.restore_state(rules.serialize_state()).ok
		and saved.active_battles_view()[0].airUnit == "jet", "saved battle retains its aircraft")
	check(saved.tick(8.0).is_empty() and saved.active_battles_view()[0].frontControl == 0.0,
		"air deployment uses the existing slow approach")
	saved.tick(8.0)
	check(saved.active_battles_view()[0].frontControl > 0.0, "stronger attacker advances after deployment")
	saved.accept_event(gift("b", "b-reinforce", 20, 9, {"bonusJetsPerGift": 1}))
	check(saved.tick(7.0).is_empty() and saved.active_battles_view()[0].frontControl < 0.0,
		"defender's reinforcements reverse the front")
	saved.accept_event(gift("a", "a-reinforce", 0, 1, {"bonusJetsPerGift": 30}))
	check(saved.tick(13.0).is_empty(), "late reinforcement must push the front before resolution")
	var result := saved.tick(60.0)
	check(result.size() == 1 and result[0].winnerId == "a" and saved.get_region_owner(14) == "a",
		"air battle resolves after the front swings back and transfers the region")
	check(saved.unit_counts("b").jets == 0 and saved.unit_counts("a").jets > 0 and saved.unit_counts("a").jets < 34,
		"loser clears jets and winner keeps only surviving jets")
	check(Rules.new(15, true).restore_state(saved.serialize_state()).ok, "resolved battle and attrition validate on reload")

func _air_tank_support() -> void:
	var rules := Rules.new(15, false, true)
	rules.set_soldiers_per_coin(1)
	rules.accept_event(gift("a", "tank-at-home", 1000, 1, {"bonusTanksPerGift": 25}))
	rules.accept_event(gift("b", "tank-defends", 1500, 1, {"bonusTanksPerGift": 2}))
	rules.place_participant("a", 0)
	rules.place_participant("b", 14)
	rules.start_round()
	var target: Dictionary = rules.get_participant("b")
	check(rules.request_attack("a", int(target.number), {"from": 0, "to": 14, "airborne": true}).ok,
		"air assault starts with automatic aircraft")
	var battle: Dictionary = rules.active_battles_view()[0]
	check(rules.army_power("a") > rules.army_power("b") and battle.actorPower == 1000.0
		and battle.targetPower == 1700.0, "ground tank support stays with defender during an air assault")
	var resolved := rules.tick(60.0)
	check(resolved.size() == 1 and resolved[0].winnerId == "b", "air battle result uses the same power as its moving front")

func _large_force() -> void:
	var rules := Rules.new(15, true)
	rules.accept_event(gift("a", "huge", 200000000, 1, {"bonusJetsPerGift": 1}))
	rules.accept_event(gift("b", "small", 10))
	rules.claim_region("a", 0)
	rules.claim_region("b", 1)
	rules.start_round()
	rules.request_attack("a", 2)
	var result := rules.tick(60.0)
	check(result.size() == 1 and result[0].survivors == 9999999500
		and rules.unit_counts("a").jets == 1, "armies above 32-bit retain exact survivor quantities")
