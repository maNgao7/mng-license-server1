extends RefCounted
## Animal Times LIVE rules core; compatible with Godot 4.3 (no scene/IO/network).
## API (IDs are case-sensitive, externally normalized String viewer IDs/usernames):
##   new(region_count=37, coin_aviation=false, standalone=false).
##   set_soldiers_per_coin(1..100000); set_battle_seconds(positive seconds).
##   accept_event({eventId, participantId, username, nickname, portraitUrl,
##                 coinValue, completedCount, bonusTanksPerGift?,
##                 bonusHelicoptersPerGift?, bonusJetsPerGift?, bonusFactoriesPerGift?, soldiersPerGift?, headquartersPerGift?})
##     -> {ok, applied, troopsAdded, automaticTanksAdded, bonusTanksAdded, ...}.
##   Unit bonuses are 0..1000 per completed gift. An optional soldiersPerGift
##   (1..100000) adds to coin-based troop credit.
##   coinValue = coins per gift, completedCount = NEW completed gift count DELTA.
##   Zero coin value is allowed only when an explicit action grants credit.
##   The adapter MUST convert repeat counters to deltas and give every delta a
##   stable eventId scoped to the live session. Cumulative fields are rejected;
##   e.g. counts 1 -> 3 must arrive as completedCount 1 then 2, NOT 1 then 3.
##   Optional profile fields remain separate; blank updates retain existing data.
##   claim_region(id, region) / place_participant(id, region) -> {ok, ...}; only
##   neutral integer regions in the current map. First claim places a known donor, even with
##   zero soldiers. Subsequent claims expand that donor's territory.
##   Once per standalone round, a placed donor with at least 50 soldiers earns
##   a bonus tank, helicopter and jet. The saved starterGranted marker is
##   independent of those units surviving combat.
##   get_region_owner(region) -> String ID, or "" for neutral/invalid region.
##   region_troops(region) -> local soldiers, assigned base first and then in
##   acquisition order. Each region gets up to 3000 before filling the next.
##   Surplus stays in the last region until more territory is held.
##   add_headquarters(owner, region, min_local_troops=0) -> {ok, waiting, ...}.
##   New HQs are ready immediately at the owner's base; one HQ per region.
##   The old threshold argument/settings are retained for compatibility only.
##   headquartersPerGift=1 requests the donor's base HQ, or waits for manual placement.
##   region_headquarters(region) -> "ready", "pending", or "".
##   A region holds one HQ. Ready HQs produce 5 soldiers/s while running, even
##   at zero troops. Losing the region removes its pending or ready HQ.
##   request_attack(actor_id, target_number), publisher_attack(actor_id, number),
##   handle_chat(authenticated_sender_id, text) -> {ok, battleId, ...}.
##   resolve_missile_strike(actor_id, target_owners, fixed_damage)
##     -> {ok, hitRegions, defeated, destroyedHeadquarters, cancelledBattles, troopsLost}.
##   Apply once per accepted salvo at impact. The caller owns gift replay protection.
##   Each matching rival takes damage once. A wiped rival cedes only its matching
##   regions and keeps any other regions with zero soldiers.
##   cancelledBattles contains string battle IDs, as in clear_region.
##   deployment_seconds(duration, airborne) -> initial travel before front advances.
##   Chat: '#3', '#3 saldır', 'üç saldır', 'bir saldıracağız'; a number is ONLY
##   the target, NEVER an actor selector. Sender identity comes from the adapter.
##   start_round(), pause_round(), resume_round(), finish_round(),
##   reset_round(preserve_pending=true, preserve_numbers=false) -> {ok, ...}.
##   Gifts never start a round.
##   tick(seconds, battle_speed=1.0) -> Array of newly resolved results.
##   Production runs in real seconds, even at zero battle speed. Pause freezes time and
##   attacks/claims, but accepts gifts. Results-phase gifts go to next-round
##   pending credit, never into a finished army. finish_round cancels live battles.
##   view_state() -> deep copy {phase, soldiersPerCoin, battleSeconds, participants,
##     regions, pending, battles, results}; participants sorted by ascending number.
##   active_battles_view() -> deep copy of active battles with current progress
##   and troop totals.
##   get_participant(id) -> deep copy, or {}; parse_attack_target(text) -> int/-1.
##   unit_counts(id, remaining_troops=-1) -> {soldiers, tanks, helicopters,
##   factories, headquarters, jets?}. Standalone derives one tank per 150 soldiers,
##   helicopter per 300, and jet per 700, then adds the surviving bonus units.
##   add_publisher_unit(id, unit) -> {ok, ...}; grant one bonus tank or helicopter
##   to a placed owner in staging, running or paused, without gift credit.
##   consume_factory_update() -> true once after production adds whole soldiers
##   or a running tick activates an HQ.
##   serialize_state() -> schemaVersion=1 Dictionary, restore_state(Variant) ->
##   {ok, ...}. JSON-compatible; caller owns atomic persistence. Invalid saves
##   reset safely to empty defaults and report an error. NO userdata access here.
## Rules: one pooled army per donor, attached to their first claimed troopRegion.
## Additional owned regions do not duplicate soldiers. Only a placed donor with
## soldiers can attack; a placed defender can have zero soldiers. One simultaneous
## battle per donor; disjoint battles allowed.
## At battle END compare CURRENT armies (all pre-resolution gifts count). Winner
## keeps abs(A-B), loser becomes zero/unplaced, and ALL loser's regions transfer.
## A tie consumes both armies, keeps territory ownership, and produces no winner.
## Combat vehicles suffer proportional losses. Defeated or tied armies lose their
## current bonus units and unfinished production. Queued results gifts are separate.
## Gifts after a loss return the same identity/number to pending for manual claim.
## A participant can be placed once while they hold territory. Captures use the combat resolver.
## Reset empties territory and battles. Automatic reset can retain waiting
## numbers and the next number. Event replay protection survives round resets.
## Quantities capped at JSON-exact integer 2^53-1; overflow is rejected atomically.

const SCHEMA_VERSION := 1
const REGION_COUNT := 37
const MAX_INTEGER := 9007199254740991
const MAX_GIFT_UNITS := 1000
const MAX_SOLDIERS_PER_GIFT := 100000
const TANK_SOLDIER_THRESHOLD := 450
const HELICOPTER_SOLDIER_THRESHOLD := 1600
const COINS_PER_HELICOPTER := 100
const TROOPS_PER_TANK := 150
const TROOPS_PER_HELICOPTER := 300
const TROOPS_PER_JET := 700
const STARTER_MIN_TROOPS := 50
const STARTER_BONUS_FIELDS := {"tanks": "bonusTanks", "helicopters": "bonusHelicopters", "jets": "bonusJets"}
const STANDALONE_BONUS_THRESHOLDS := {
	"bonusTanks": TROOPS_PER_TANK, "bonusHelicopters": TROOPS_PER_HELICOPTER, "bonusJets": TROOPS_PER_JET,
}
const JET_POWER := 600
const FACTORY_SOLDIERS_PER_SECOND := 5
const GARRISON_SOLDIERS := 3000
const DEFAULT_HEADQUARTERS_MIN_LOCAL_TROOPS := 0
const DEFAULT_SOLDIERS_PER_COIN := 50
const DEFAULT_BATTLE_SECONDS := 5.0
const ENGAGEMENT_UNITS := ["", "tank", "helicopter", "jet"]
const DEFAULT_ENGAGEMENT_ACTIONS := {
	"like": {"threshold": 250, "soldiers": 100, "unit": "helicopter", "count": 1},
	"follow": {"threshold": 1, "soldiers": 100, "unit": "jet", "count": 1},
}
const CAPTURE_FRONT_MINIMUM := 0.92
const PHASES := ["staging", "running", "paused", "results"]
const UNIT_GIFT_FIELDS := {
	"bonusTanksPerGift": ["bonusTanks", "nextBonusTanks"],
	"bonusHelicoptersPerGift": ["bonusHelicopters", "nextBonusHelicopters"],
	"bonusJetsPerGift": ["bonusJets", "nextBonusJets"],
	"bonusFactoriesPerGift": ["factories", "nextFactories"],
}
const AIR_WALLET_FIELDS := ["automaticHelicopters", "nextAutomaticHelicopters"]
const NUMBER_WORDS := {
	"bir": 1, "iki": 2, "uc": 3, "dort": 4, "bes": 5,
	"alti": 6, "yedi": 7, "sekiz": 8, "dokuz": 9,
	"on": 10, "yirmi": 20, "otuz": 30, "kirk": 40, "elli": 50,
	"altmis": 60, "yetmis": 70, "seksen": 80, "doksan": 90,
}

var _phase: String = "staging"
var _soldiers_per_coin: int = DEFAULT_SOLDIERS_PER_COIN
var _battle_seconds: float = DEFAULT_BATTLE_SECONDS
var _tank_power := 100
var _helicopter_power := 300
var _jet_power := JET_POWER
var _participants: Dictionary = {}
var _owners: Dictionary = {}
var _seen_events: Dictionary = {}
var _battles: Array = []
var _results: Array = []
var _next_number: int = 1
var _next_battle_id: int = 1
var _factory_update := false
var _headquarters_ticks: Dictionary = {}
var _region_count: int
var _coin_aviation: bool
var _standalone: bool
var _tank_threshold: int
var _helicopter_threshold: int
var _coin_remainders: Dictionary = {}
var _like_remainders: Dictionary = {}


func _init(region_count: int = REGION_COUNT, coin_aviation: bool = false, standalone: bool = false) -> void:
	_region_count = region_count
	_standalone = standalone
	_coin_aviation = coin_aviation and not standalone
	_tank_threshold = TROOPS_PER_TANK if standalone else TANK_SOLDIER_THRESHOLD
	_helicopter_threshold = TROOPS_PER_HELICOPTER if standalone else HELICOPTER_SOLDIER_THRESHOLD


func set_soldiers_per_coin(value: int) -> Dictionary:
	if value < 1 or value > MAX_SOLDIERS_PER_GIFT:
		return _fail("soldiers_per_coin_out_of_range")
	_soldiers_per_coin = value
	return {"ok": true}


func set_battle_seconds(value: float) -> Dictionary:
	if not is_finite(value) or value <= 0.0:
		return _fail("invalid_battle_seconds")
	_battle_seconds = value
	return {"ok": true}

func set_vehicle_power(tank: int, helicopter: int, jet: int = JET_POWER) -> Dictionary:
	if tank < 0 or tank > 100000 or helicopter < 0 or helicopter > 100000 or jet < 0 or jet > 100000:
		return _fail("invalid_vehicle_power")
	_tank_power = tank
	_helicopter_power = helicopter
	_jet_power = jet
	return {"ok": true}

func army_power(id: String, include_tanks: bool = true) -> float:
	var p: Dictionary = _participants.get(id, {})
	var soldiers := float(p.get("troops", 0))
	if soldiers <= 0.0:
		return 0.0
	# Earned vehicles already represent the soldiers that unlocked them.
	var tank_support := float(p.get("bonusTanks", 0)) * _tank_power if include_tanks else 0.0
	var support := tank_support + float(p.get("bonusHelicopters", 0)) * _helicopter_power + float(p.get("bonusJets", 0)) * _jet_power
	return soldiers + minf(support, soldiers)

static func combat_survivors(a: int, b: int, power_a: float, power_b: float) -> Vector2i:
	# Legacy renderers use Vector2i. Keep full-sized forces in the rules core.
	var counts := _combat_survivor_counts(a, b, power_a, power_b)
	return Vector2i(mini(counts[0], 2147483647), mini(counts[1], 2147483647))


static func _combat_survivor_counts(a: int, b: int, power_a: float, power_b: float) -> Array[int]:
	if power_a == float(a) and power_b == float(b):
		return [maxi(0, a - b), maxi(0, b - a)]
	if power_a == power_b:
		return [0, 0]
	if power_a > power_b:
		return [clampi(roundi(float(a) * (1.0 - power_b / maxf(1.0, power_a))), mini(1, a), a), 0]
	return [0, clampi(roundi(float(b) * (1.0 - power_a / maxf(1.0, power_b))), mini(1, b), b)]


static func remaining_combat_troops(battle: Dictionary, attacker: int, defender: int) -> Array[int]:
	var deployment := float(battle.get("deployment", 0.0))
	var fighting := clampf((float(battle.get("elapsed", 0.0)) - deployment) /
		maxf(0.001, float(battle.get("duration", 1.0)) - deployment), 0.0, 1.0)
	var attack_power := float(battle.get("attackerPower", attacker))
	var defense_power := float(battle.get("defenderPower", defender))
	var direction := signf(attack_power - defense_power)
	# When reinforcements reverse the front late, keep the retreating army visible
	# until the new leader has actually pushed the line to the capture threshold.
	if direction != 0.0 and (battle.has("control") or battle.has("frontControl")):
		var control := float(battle.get("control", battle.get("frontControl", 0.0)))
		var advance := clampf(direction * control / CAPTURE_FRONT_MINIMUM, 0.0, 1.0)
		fighting = minf(fighting, lerpf(0.90, 1.0, advance))
	var final := _combat_survivor_counts(attacker, defender, attack_power, defense_power)
	return [attacker - floori(float(attacker - final[0]) * fighting),
		defender - floori(float(defender - final[1]) * fighting)]


func has_seen_event(event_id: String) -> bool:
	return _seen_events.has(event_id)


static func normalize_engagement_actions(value: Variant) -> Dictionary:
	var config := DEFAULT_ENGAGEMENT_ACTIONS.duplicate(true)
	if not value is Dictionary:
		return config
	for kind in config:
		var entry: Variant = value.get(kind)
		if not entry is Dictionary:
			continue
		var rule: Dictionary = config[kind]
		if kind == "like" and _whole(entry.get("threshold"), 1, MAX_SOLDIERS_PER_GIFT):
			rule.threshold = int(entry.threshold)
		if _whole(entry.get("soldiers"), 0, MAX_SOLDIERS_PER_GIFT):
			rule.soldiers = int(entry.soldiers)
		if entry.get("unit") in ENGAGEMENT_UNITS:
			rule.unit = entry.unit
		if _whole(entry.get("count"), 0, MAX_SOLDIERS_PER_GIFT):
			rule.count = int(entry.count)
	return config


func accept_engagement(event: Dictionary, rule: Dictionary) -> Dictionary:
	var receipt := str(event.get("eventId", ""))
	var kind := str(event.get("type", ""))
	if receipt.is_empty() or kind not in ["like", "follow"] or not _nonempty_string(event.get("participantId")):
		return _fail("invalid_engagement")
	if _seen_events.has(receipt):
		return {"ok": true, "applied": false, "duplicate": true}
	var threshold := int(rule.threshold)
	var soldiers := int(rule.soldiers)
	var units := int(rule.count) if not str(rule.unit).is_empty() else 0
	if soldiers == 0 and units == 0:
		_seen_events[receipt] = true
		return {"ok": true, "applied": false}
	var rewards := 1
	var remainder := 0
	var wallet_key := ""
	if kind == "like":
		if not _whole(event.get("likeCount"), 1, MAX_INTEGER - MAX_SOLDIERS_PER_GIFT):
			return _fail("invalid_like_count")
		wallet_key = str(event.get("broadcastChannel", "")) + ":" + str(event.participantId)
		var total := int(_like_remainders.get(wallet_key, 0)) + int(event.likeCount)
		rewards = total / threshold
		remainder = total % threshold
	var result := {"ok": true, "applied": false}
	if rewards > 0:
		var grant := {"eventId": receipt, "participantId": event.participantId,
			"username": event.username, "nickname": event.nickname, "portraitUrl": event.portraitUrl,
			"coinValue": 0, "completedCount": rewards}
		if soldiers > 0:
			grant.soldiersPerGift = soldiers
		if units > 0:
			var field: String = {"tank": "bonusTanksPerGift", "helicopter": "bonusHelicoptersPerGift", "jet": "bonusJetsPerGift"}[rule.unit]
			grant[field] = units
		result = accept_event(grant)
		if not result.ok:
			return result
	else:
		_seen_events[receipt] = true
	if kind == "like":
		if remainder > 0:
			_like_remainders[wallet_key] = remainder
		else:
			_like_remainders.erase(wallet_key)
	return result


static func deployment_seconds(duration: float, airborne: bool) -> float:
	if not is_finite(duration) or duration <= 0.0:
		return 0.0
	if duration < 10.0:
		return minf(3.2, duration * 0.4) if airborne else 0.0
	if airborne:
		return clampf(duration * 0.12, 2.5, 4.8)
	return clampf(duration * 0.08, 1.4, 2.4)


func accept_event(event: Dictionary) -> Dictionary:
	# A repeated delivery is a complete no-op, including profile changes.
	if not _nonempty_string(event.get("eventId")):
		return _fail("invalid_event_id")
	var event_id: String = event["eventId"]
	if _seen_events.has(event_id):
		return {"ok": true, "applied": false, "duplicate": true}
	for field in ["cumulativeCount", "repeatCount", "repeatGroupId"]:
		if event.has(field):
			return _fail("completed_delta_required")
	if not _nonempty_string(event.get("participantId")):
		return _fail("invalid_participant_id")
	for field in ["username", "nickname", "portraitUrl"]:
		if event.has(field) and typeof(event[field]) != TYPE_STRING:
			return _fail("invalid_profile")
	if not _whole(event.get("coinValue")) or not _whole(event.get("completedCount"), 1):
		return _fail("invalid_gift_quantity")
	if event.has("soldiersPerGift") and not _whole(event["soldiersPerGift"], 1, MAX_SOLDIERS_PER_GIFT):
		return _fail("invalid_soldiers_per_gift")
	if not _whole(event.get("headquartersPerGift", 0), 0, 1):
		return _fail("invalid_headquarters_quantity")
	var wants_headquarters := int(event.get("headquartersPerGift", 0)) == 1
	var coin_value := int(event["coinValue"])
	var count := int(event["completedCount"])
	if coin_value > MAX_INTEGER / count:
		return _fail("quantity_overflow")
	var coins: int = coin_value * count
	if coins > MAX_INTEGER / _soldiers_per_coin:
		return _fail("quantity_overflow")
	var troops := coins * _soldiers_per_coin
	var extra := int(event.get("soldiersPerGift", 0))
	if extra > (MAX_INTEGER - troops) / count:
		return _fail("quantity_overflow")
	troops += extra * count
	var id: String = event["participantId"]
	var participant: Dictionary = _participants.get(id, {})
	var is_new := participant.is_empty()
	if is_new:
		if _next_number >= MAX_INTEGER:
			return _fail("quantity_overflow")
		participant = _new_participant(id, _next_number)
	var queued := _phase == "results"
	var troop_field := "nextTroops" if queued else "troops"
	if int(participant["coinTotal"]) > MAX_INTEGER - coins:
		return _fail("quantity_overflow")
	if int(participant[troop_field]) > MAX_INTEGER - troops:
		return _fail("quantity_overflow")
	# Results credit and unplaced credit may be merged on reset. Keep that sum
	# within the same exact-integer limit, even after multiplier changes.
	if _phase == "results" and int(participant["troops"]) > MAX_INTEGER - int(participant["nextTroops"]) - troops:
		return _fail("quantity_overflow")
	if _phase == "results" and int(participant["nextCoins"]) > MAX_INTEGER - coins:
		return _fail("quantity_overflow")
	var unit_deltas: Dictionary = {}
	var combined_units: Dictionary = {}
	var has_bonus := wants_headquarters
	for field in UNIT_GIFT_FIELDS:
		var per_gift: Variant = event.get(field, 0)
		var maximum := MAX_GIFT_UNITS if field == "bonusFactoriesPerGift" else MAX_INTEGER
		if not _whole(per_gift, 0, maximum):
			return _fail("invalid_gift_unit_quantity")
		if int(per_gift) > MAX_INTEGER / count:
			return _fail("quantity_overflow")
		var fields: Array = UNIT_GIFT_FIELDS[field]
		var added := int(per_gift) * count
		has_bonus = has_bonus or added > 0
		var previous := int(participant[fields[0]]) + int(participant[fields[1]])
		if added > MAX_INTEGER - previous:
			return _fail("quantity_overflow")
		unit_deltas[fields[1] if queued else fields[0]] = added
		combined_units[fields[0]] = previous + added
	if troops == 0 and not has_bonus:
		return _fail("invalid_gift_quantity")
	var combined_troops := int(participant["troops"]) + int(participant["nextTroops"]) + troops
	var coin_progress := int(_coin_remainders.get(id, 0)) + coins
	var automatic_added := coin_progress / COINS_PER_HELICOPTER if _coin_aviation else 0
	var automatic_field: String = AIR_WALLET_FIELDS[1 if queued else 0]
	var all_automatic := int(participant.automaticHelicopters) + int(participant.nextAutomaticHelicopters)
	if automatic_added > MAX_INTEGER - combined_units["bonusHelicopters"] - all_automatic:
		return _fail("quantity_overflow")
	if combined_troops > _troop_limit(combined_units["bonusTanks"], combined_units["bonusHelicopters"], combined_units["bonusJets"]):
		return _fail("quantity_overflow")
	# Commit only after validation; an invalid event can be corrected and retried.
	if is_new:
		_next_number += 1
		_participants[id] = participant
	for field in ["username", "nickname", "portraitUrl"]:
		if not String(event.get(field, "")).strip_edges().is_empty():
			participant[field] = event[field]
	participant["coinTotal"] += coins
	var previous_troops := int(participant[troop_field])
	# For a waiting army, results credit will merge with its current soldiers.
	if queued and int(participant.troopRegion) < 0:
		previous_troops += int(participant.troops)
	var credited_troops := previous_troops + troops
	var earned_tanks := credited_troops / _tank_threshold - previous_troops / _tank_threshold
	participant[troop_field] += troops
	var earned_heli := automatic_added
	var earned_jet := 0
	if _standalone:
		earned_heli = credited_troops / _helicopter_threshold - previous_troops / _helicopter_threshold
		earned_jet = credited_troops / TROOPS_PER_JET - previous_troops / TROOPS_PER_JET
	participant[automatic_field] += automatic_added
	if _coin_aviation:
		var remainder := coin_progress % COINS_PER_HELICOPTER
		if remainder == 0:
			_coin_remainders.erase(id)
		else:
			_coin_remainders[id] = remainder
	for field in unit_deltas:
		participant[field] += unit_deltas[field]
	var starter: Dictionary = {}
	if queued:
		participant["nextCoins"] += coins
		participant["nextHeadquartersRequested"] = participant["nextHeadquartersRequested"] or wants_headquarters
	else:
		participant["headquartersRequested"] = participant["headquartersRequested"] or wants_headquarters
		_grant_requested_headquarters(participant)
		_update_headquarters(participant)
		starter = _grant_starter_units(participant)
	_seen_events[event_id] = true
	return {"ok": true, "applied": true, "duplicate": false,
		"participantId": id, "number": participant["number"],
		"coinsAdded": coins, "troopsAdded": troops,
		"automaticTanksAdded": earned_tanks,
		"bonusTanksAdded": unit_deltas["nextBonusTanks" if queued else "bonusTanks"] + starter.get("tanks", 0),
		"bonusHelicoptersAdded": unit_deltas["nextBonusHelicopters" if queued else "bonusHelicopters"] + starter.get("helicopters", 0),
		"automaticHelicoptersAdded": earned_heli,
		"automaticJetsAdded": earned_jet,
		"bonusJetsAdded": unit_deltas["nextBonusJets" if queued else "bonusJets"] + starter.get("jets", 0),
		"bonusFactoriesAdded": unit_deltas["nextFactories" if queued else "factories"]}


func claim_region(participant_id: String, region_id: int) -> Dictionary:
	if _phase != "staging" and _phase != "running":
		return _fail("placement_not_allowed")
	if region_id < 0 or region_id >= _region_count:
		return _fail("invalid_region")
	if not _participants.has(participant_id):
		return _fail("unknown_participant")
	var participant: Dictionary = _participants[participant_id]
	var owner := get_region_owner(region_id)
	if owner == participant_id:
		return {"ok": true, "changed": false}
	if not owner.is_empty():
		return _fail("region_owned")
	if _is_busy(participant_id):
		return _fail("participant_in_battle")
	_owners[region_id] = participant_id
	participant["regions"].append(region_id)
	participant["regions"].sort()
	participant["garrisonOrder"].append(region_id)
	if int(participant["troopRegion"]) < 0:
		participant["troopRegion"] = region_id
	_grant_requested_headquarters(participant)
	_grant_starter_units(participant)
	return {"ok": true, "changed": true, "regionId": region_id}


func place_participant(participant_id: String, region_id: int) -> Dictionary:
	var participant: Dictionary = _participants.get(participant_id, {})
	if not participant.get("regions", []).is_empty() and get_region_owner(region_id) != participant_id:
		return _fail("already_placed")
	return claim_region(participant_id, region_id)


func get_region_owner(region_id: int) -> String:
	return String(_owners.get(region_id, ""))


func clear_region(region: int) -> Dictionary:
	var owner := get_region_owner(region)
	if owner.is_empty():
		return _fail("invalid_region")
	var participant: Dictionary = _participants[owner]
	var cancelled := _cancel_battles_for({owner: true})
	_owners.erase(region)
	participant.regions.erase(region)
	participant.garrisonOrder.erase(region)
	if int(participant.troopRegion) == region:
		participant.troopRegion = -1 if participant.garrisonOrder.is_empty() else participant.garrisonOrder[0]
		for entry in participant.headquarters:
			if int(entry.regionId) == region:
				participant.headquarters.erase(entry)
				if int(participant.factories) == 0:
					participant.factoryRemainder = 0.0
				break
	return {"ok": true, "owner": owner, "cancelledBattles": cancelled}


func claim_challenger_region(challenger: String, champion: String, region: int) -> Dictionary:
	if _phase != "running" or challenger == champion or not _participants.has(challenger) \
			or _is_busy(challenger) or territory_champion() != champion or get_region_owner(region) != champion:
		return _fail("invalid_challenger")
	var removal := clear_region(region)
	var claimed := claim_region(challenger, region)
	claimed["cancelledBattles"] = removal.cancelledBattles
	claimed["owner"] = removal.owner
	return claimed


func territory_champion() -> String:
	if _phase != "running" or _region_count == 0 or _owners.size() != _region_count:
		return ""
	var owner := get_region_owner(0)
	var participant: Dictionary = _participants.get(owner, {})
	if participant.get("regions", []).size() == _region_count:
		return owner
	return ""


func region_troops(region: int) -> int:
	var owner := get_region_owner(region)
	if owner.is_empty():
		return 0
	var participant: Dictionary = _participants[owner]
	var order: Array = participant["garrisonOrder"]
	var index := order.find(region)
	var available := maxi(0, int(participant["troops"]) - index * GARRISON_SOLDIERS)
	return available if index == order.size() - 1 else mini(available, GARRISON_SOLDIERS)


func add_headquarters(owner: String, region: int, min_local_troops: int = DEFAULT_HEADQUARTERS_MIN_LOCAL_TROOPS) -> Dictionary:
	if _phase == "results":
		return {"ok": false, "waiting": false, "error": "invalid_phase"}
	if owner.is_empty() or get_region_owner(region) != owner:
		return {"ok": false, "waiting": false, "error": "region_not_owned"}
	if not _whole(min_local_troops):
		return {"ok": false, "waiting": false, "error": "invalid_headquarters_threshold"}
	# Clicks on any owned region and donor gifts both target the owner's base.
	region = int(_participants[owner]["troopRegion"])
	var status := region_headquarters(region)
	if status == "pending":
		# An explicit button/gift action completes the saved base HQ in place.
		for headquarters in _participants[owner]["headquarters"]:
			if int(headquarters.regionId) == region:
				headquarters.ready = true
				headquarters.minLocalTroops = 0
				return {"ok": true, "waiting": false, "changed": true, "regionId": region}
	if not status.is_empty():
		return {"ok": true, "waiting": status == "pending", "changed": false, "regionId": region}
	_participants[owner]["headquarters"].append({"regionId": region, "minLocalTroops": 0, "ready": true})
	return {"ok": true, "waiting": false, "changed": true, "regionId": region}


func _grant_requested_headquarters(participant: Dictionary) -> void:
	if not participant["headquartersRequested"] or int(participant["troopRegion"]) < 0:
		return
	var result := add_headquarters(participant["id"], int(participant["troopRegion"]))
	if result.ok:
		participant["headquartersRequested"] = false


func region_headquarters(region: int) -> String:
	var owner := get_region_owner(region)
	if not owner.is_empty():
		for headquarters in _participants[owner]["headquarters"]:
			if int(headquarters.regionId) == region:
				return "ready" if headquarters.ready else "pending"
	return ""


func get_participant(participant_id: String) -> Dictionary:
	return _participants.get(participant_id, {}).duplicate(true)

func unit_counts(participant_id: String, remaining_troops: int = -1) -> Dictionary:
	var participant: Dictionary = _participants.get(participant_id, {})
	var troops := int(participant.get("troops", 0))
	var soldiers := troops if remaining_troops < 0 else mini(troops, remaining_troops)
	var bonus_tanks := _retained_units(int(participant.get("bonusTanks", 0)), soldiers, troops)
	var bonus_helicopters := _retained_units(int(participant.get("bonusHelicopters", 0)), soldiers, troops)
	var ready_headquarters := 0
	for headquarters in participant.get("headquarters", []):
		ready_headquarters += int(headquarters.ready)
	var units := {"soldiers": soldiers,
		"tanks": soldiers / _tank_threshold + bonus_tanks,
		"helicopters": automatic_helicopters(participant_id, soldiers) + bonus_helicopters,
		"factories": int(participant.get("factories", 0)),
		"headquarters": ready_headquarters}
	# Direct legacy rules clients compare the original Dictionary shape.
	var jets := aircraft_jets(participant_id, soldiers)
	if _standalone or _coin_aviation or jets > 0:
		units.jets = jets
	return units


func automatic_helicopters(participant_id: String, troops: int = -1) -> int:
	var participant: Dictionary = _participants.get(participant_id, {})
	if _coin_aviation:
		var count := int(participant.get("automaticHelicopters", 0))
		return count if troops < 0 else _retained_units(count, troops, int(participant.get("troops", 0)))
	var soldiers := int(participant.get("troops", 0)) if troops < 0 else troops
	return soldiers / _helicopter_threshold


func aircraft_jets(participant_id: String, remaining_troops: int = -1) -> int:
	var participant: Dictionary = _participants.get(participant_id, {})
	var troops := int(participant.get("troops", 0))
	var bonus := int(participant.get("bonusJets", 0))
	var remaining := troops if remaining_troops < 0 else remaining_troops
	if remaining_troops >= 0:
		bonus = _retained_units(bonus, remaining, troops)
	return bonus + (remaining / TROOPS_PER_JET if _standalone else 0)


func air_unit(participant_id: String) -> String:
	var participant: Dictionary = _participants.get(participant_id, {})
	if aircraft_jets(participant_id) > 0:
		return "jet"
	if automatic_helicopters(participant_id) + int(participant.get("bonusHelicopters", 0)) > 0:
		return "helicopter"
	return ""


func _grant_starter_units(participant: Dictionary) -> Dictionary:
	if (not _standalone or participant.starterGranted or int(participant.troopRegion) < 0
			or int(participant.troops) < STARTER_MIN_TROOPS):
		return {}
	var added: Dictionary = {}
	var counts := unit_counts(participant.id)
	for unit in STARTER_BONUS_FIELDS:
		# Keep saves and visible counts exact even for already capped gift fleets.
		if int(counts[unit]) < MAX_INTEGER:
			participant[STARTER_BONUS_FIELDS[unit]] += 1
			added[unit] = 1
	participant.starterGranted = true
	return added


func add_publisher_unit(participant_id: String, unit: String) -> Dictionary:
	if not _phase in ["staging", "running", "paused"]:
		return _fail("invalid_phase")
	var field: String = {"tank": "bonusTanks", "helicopter": "bonusHelicopters", "jet": "bonusJets"}.get(unit, "")
	if field.is_empty():
		return _fail("invalid_unit")
	if not _participants.has(participant_id):
		return _fail("unknown_participant")
	var participant: Dictionary = _participants[participant_id]
	var troop_region := int(participant["troopRegion"])
	if troop_region < 0:
		return _fail("participant_not_placed")
	if get_region_owner(troop_region) != participant_id:
		return _fail("troop_region_not_owned")
	var bonus_tanks := int(participant["bonusTanks"]) + (1 if unit == "tank" else 0)
	var bonus_helicopters := int(participant["bonusHelicopters"]) + (1 if unit == "helicopter" else 0)
	if int(participant[field]) >= MAX_INTEGER or bonus_helicopters > MAX_INTEGER - int(participant.automaticHelicopters):
		return _fail("quantity_overflow")
	var bonus_jets := int(participant["bonusJets"]) + (1 if unit == "jet" else 0)
	if int(participant["troops"]) > _troop_limit(bonus_tanks, bonus_helicopters, bonus_jets):
		return _fail("quantity_overflow")
	participant[field] += 1
	return {"ok": true}


func round_phase() -> String:
	return _phase


func start_round() -> Dictionary:
	return _transition("staging", "running")


func pause_round() -> Dictionary:
	return _transition("running", "paused")


func resume_round() -> Dictionary:
	return _transition("paused", "running")


func finish_round() -> Dictionary:
	if _phase != "running" and _phase != "paused":
		return _fail("invalid_phase")
	_phase = "results"
	_battles.clear()
	return {"ok": true}


func clear_finished_board() -> void:
	if _phase != "results":
		return
	for id in _participants.keys():
		var participant: Dictionary = _participants[id]
		if participant["regions"].is_empty():
			continue
		if not _has_army_credit(participant, true):
			_participants.erase(id)
			continue
		var waiting := _new_participant(id, int(participant["number"]))
		for field in ["username", "nickname", "portraitUrl", "nextCoins", "nextTroops",
				"nextHeadquartersRequested", "nextAutomaticHelicopters"]:
			waiting[field] = participant[field]
		for fields in UNIT_GIFT_FIELDS.values():
			waiting[fields[1]] = participant[fields[1]]
		if _standalone:
			waiting.starterGranted = participant.starterGranted
		waiting["coinTotal"] = waiting["nextCoins"]
		_participants[id] = waiting
	_owners.clear()
	_results.clear()
	_headquarters_ticks.clear()
	_factory_update = false


func reset_round(preserve_pending: bool = true, preserve_numbers: bool = false) -> Dictionary:
	if _phase != "results":
		return _fail("invalid_phase")
	var retained: Array = []
	preserve_numbers = preserve_numbers and preserve_pending
	if preserve_pending:
		for participant in _ordered_participants():
			var troops: int = int(participant["nextTroops"])
			var coins: int = int(participant["nextCoins"])
			var unplaced := int(participant["troopRegion"]) < 0
			if unplaced:
				troops += int(participant["troops"])
				coins = int(participant["coinTotal"])
			if _has_army_credit(participant, true) or (unplaced and _has_army_credit(participant, false)):
				var number := int(participant["number"]) if preserve_numbers else retained.size() + 1
				var pending := _new_participant(participant["id"], number)
				for field in ["username", "nickname", "portraitUrl"]:
					pending[field] = participant[field]
				pending["troops"] = troops
				pending["coinTotal"] = coins
				pending["headquartersRequested"] = participant["nextHeadquartersRequested"] or (unplaced and participant["headquartersRequested"])
				for fields in UNIT_GIFT_FIELDS.values():
					pending[fields[0]] = int(participant[fields[1]])
					if unplaced:
						pending[fields[0]] += int(participant[fields[0]])
				pending.automaticHelicopters = int(participant.nextAutomaticHelicopters)
				if unplaced:
					pending.automaticHelicopters += int(participant.automaticHelicopters)
					pending["factoryRemainder"] = float(participant["factoryRemainder"])
				retained.append(pending)
	_participants.clear()
	_owners.clear()
	_battles.clear()
	_results.clear()
	if not preserve_numbers:
		_next_number = retained.size() + 1
	_next_battle_id = 1
	_factory_update = false
	_headquarters_ticks.clear()
	_phase = "staging"
	for participant in retained:
		_participants[participant["id"]] = participant
	return {"ok": true, "pendingPreserved": retained.size()}


func request_attack(actor_id: String, target_number: int, capture: Dictionary = {}) -> Dictionary:
	if _phase != "running":
		return _fail("round_not_running")
	if not _participants.has(actor_id):
		return _fail("unknown_actor")
	var target_id := ""
	for participant in _ordered_participants():
		if int(participant["number"]) == target_number:
			target_id = participant["id"]
			break
	if target_id.is_empty():
		return _fail("unknown_target")
	if actor_id == target_id:
		return _fail("self_attack")
	var actor: Dictionary = _participants[actor_id]
	var target: Dictionary = _participants[target_id]
	if int(actor["troops"]) <= 0:
		return _fail("participant_not_placed_or_empty")
	for participant in [actor, target]:
		if int(participant["troopRegion"]) < 0:
			return _fail("participant_not_placed_or_empty")
		if get_region_owner(int(participant["troopRegion"])) != participant["id"]:
			return _fail("troop_region_not_owned")
		if _is_busy(participant["id"]):
			return _fail("participant_in_battle")
	if _next_battle_id >= MAX_INTEGER:
		return _fail("quantity_overflow")
	var battle := {"id": _next_battle_id, "actorId": actor_id,
		"targetId": target_id, "actorRegion": actor["troopRegion"],
		"targetRegion": target["troopRegion"], "elapsed": 0.0,
		"duration": _battle_seconds, "frontControl": 0.0, "airborne": false}
	if not capture.is_empty():
		if not _whole(capture.get("from"), 0, _region_count - 1) or not _whole(capture.get("to"), 0, _region_count - 1):
			return _fail("invalid_region")
		var departure := int(capture["from"])
		var destination := int(capture["to"])
		if get_region_owner(departure) != actor_id or get_region_owner(destination) != target_id:
			return _fail("invalid_region")
		if typeof(capture.get("airborne", true)) != TYPE_BOOL:
			return _fail("invalid_battle_route")
		battle.captureFrom = departure
		battle.captureTo = destination
		battle.airborne = capture.get("airborne", true)
		if battle.airborne:
			var aircraft := air_unit(actor_id)
			if aircraft.is_empty() and _coin_aviation:
				return _fail("helicopter_required")
			if not aircraft.is_empty():
				battle.airUnit = aircraft
	_battles.append(battle)
	_next_battle_id += 1
	return {"ok": true, "battleId": battle["id"]}


func publisher_attack(actor_id: String, target_number: int) -> Dictionary:
	# Privilege/authentication belongs to the publisher UI, not chat parsing.
	return request_attack(actor_id, target_number)


func resolve_missile_strike(actor_id: String, target_owners: Dictionary, fixed_damage: int) -> Dictionary:
	if _phase != "staging" and _phase != "running":
		return _fail("invalid_phase")
	if fixed_damage < 0:
		return _fail("invalid_missile_damage")
	if not _participants.has(actor_id):
		return _fail("unknown_actor")
	var actor: Dictionary = _participants[actor_id]
	var base := int(actor.troopRegion)
	if base < 0 or get_region_owner(base) != actor_id:
		return _fail("participant_not_placed")

	var hit_regions: Array[int] = []
	for region in target_owners:
		if typeof(region) != TYPE_INT or region < 0 or region >= _region_count:
			continue
		var expected_owner: Variant = target_owners[region]
		var owner := get_region_owner(region)
		if typeof(expected_owner) == TYPE_STRING and owner == expected_owner and owner != actor_id and not owner.is_empty():
			hit_regions.append(region)
	hit_regions.sort()
	var hits_by_enemy: Dictionary = {}
	for region in hit_regions:
		var enemy_id := get_region_owner(region)
		if not hits_by_enemy.has(enemy_id):
			hits_by_enemy[enemy_id] = []
		hits_by_enemy[enemy_id].append(region)

	var defeated: Dictionary = {}
	var destroyed_headquarters: Array[int] = []
	var troops_lost := 0
	for enemy_id in hits_by_enemy:
		var enemy: Dictionary = _participants[enemy_id]
		var before := int(enemy.troops)
		# Integer division floors the exact 70% even at the maximum army size.
		@warning_ignore("integer_division")
		var loss := mini(before, maxi(fixed_damage, before * 7 / 10))
		enemy.troops = before - loss
		troops_lost += loss
		if enemy.troops > 0:
			_apply_mobile_unit_losses(enemy, before)
			continue
		_clear_unit_bonuses(enemy)
		var transferred: Array = hits_by_enemy[enemy_id]
		_transfer_defeated_territory(actor, enemy, transferred, destroyed_headquarters)
		defeated[enemy_id] = transferred
	for region in destroyed_headquarters:
		_headquarters_ticks.erase(region)
	destroyed_headquarters.sort()
	return {"ok": true, "hitRegions": hit_regions, "defeated": defeated,
		"destroyedHeadquarters": destroyed_headquarters, "cancelledBattles": _cancel_battles_for(defeated),
		"troopsLost": troops_lost}


func handle_chat(sender_id: String, text: String) -> Dictionary:
	var target := parse_attack_target(text)
	if target < 1:
		return _fail("not_attack_command")
	return request_attack(sender_id, target)


func parse_attack_target(text: String) -> int:
	var normalized := text.replace("İ", "i").replace("I", "ı").to_lower()
	for pair in [["ı", "i"], ["ü", "u"], ["ç", "c"], ["ö", "o"], ["ş", "s"], ["ğ", "g"]]:
		normalized = normalized.replace(pair[0], pair[1])
	var pattern := RegEx.new()
	pattern.compile("^\\s*(#?)\\s*([0-9]+|[a-z]+(?:\\s+[a-z]+)*)\\s*(?:\\s+(saldir|saldiracagiz))?\\s*[.!?]*\\s*$")
	var found := pattern.search(normalized)
	if found == null:
		return -1
	# The word branch is greedy; remove a final attack verb before parsing words.
	var number_text: String = found.get_string(2).strip_edges()
	var has_verb := not found.get_string(3).is_empty()
	for verb in [" saldiracagiz", " saldir"]:
		if number_text.ends_with(verb):
			number_text = number_text.trim_suffix(verb).strip_edges()
			has_verb = true
			break
	if found.get_string(1).is_empty() and not has_verb:
		return -1
	if number_text.is_valid_int():
		# No signed/overflowing decimal input; participant numbers are JSON-exact.
		if number_text.length() > 16:
			return -1
		var number := number_text.to_int()
		return number if number > 0 and number <= MAX_INTEGER else -1
	var words := number_text.split(" ", false)
	# Turkish 1..99 covers the native 37-region map; larger targets use digits.
	if words.size() == 1:
		return int(NUMBER_WORDS.get(words[0], -1))
	if words.size() == 2:
		var tens := int(NUMBER_WORDS.get(words[0], -1))
		var units := int(NUMBER_WORDS.get(words[1], -1))
		if tens >= 10 and tens % 10 == 0 and units >= 1 and units <= 9:
			return tens + units
	return -1


func tick(delta: float, battle_speed: float = 1.0) -> Array:
	var resolved: Array = []
	if _phase != "running" or not is_finite(delta) or delta <= 0.0:
		return resolved
	var after_battle: Dictionary = {}
	if not is_finite(battle_speed) or battle_speed < 0.0:
		battle_speed = 1.0
	# Insertion order is battle ID order. Battles cannot share participants.
	var advancing := _battles.duplicate() if battle_speed > 0.0 else []
	for battle in advancing:
		var remaining := _advance_battle(battle, delta, battle_speed)
		after_battle[battle.actorId] = remaining
		after_battle[battle.targetId] = remaining
		if not _battle_can_finish(battle):
			continue
		var result := _resolve_battle(battle)
		var history := result.duplicate(true)
		history.erase("destroyedHeadquarters")
		_results.append(history)
		resolved.append(result)
		_battles.erase(battle)
	for id in _participants:
		if _produce_factory_soldiers(_participants[id], float(after_battle.get(id, delta))):
			_factory_update = true
	return resolved

func _advance_battle(battle: Dictionary, delta: float, battle_speed: float) -> float:
	var duration := float(battle.duration)
	var approach := deployment_seconds(duration, battle.airborne)
	var battle_time := duration - approach
	var remaining := delta
	while remaining > 0.0:
		var balance := _troop_balance(battle)
		var direction := signf(balance)
		var advantage := absf(balance)
		var speed := 1.1 + advantage * 1.7
		var elapsed := float(battle.elapsed)
		var travel_left := maxf(0.0, approach - elapsed)
		var front := float(battle.frontControl)
		# Reinforcements can extend combat so the new leader can push back.
		var capture_time := 0.0
		if direction != 0.0:
			capture_time = maxf(0.0, CAPTURE_FRONT_MINIMUM - direction * front) / speed * battle_time
		var simulated := remaining * battle_speed
		var step := minf(simulated, maxf(duration - elapsed, travel_left + capture_time))
		battle.elapsed = minf(duration, elapsed + step)
		var stage := clampf((float(battle.elapsed) - approach) / battle_time * (1.0 + advantage * 0.3), 0.0, 1.0)
		var active_step := maxf(0.0, step - travel_left) / battle_time
		battle.frontControl = move_toward(front, direction * stage, speed * active_step)
		# Convert the completed combat step back to real production time.
		var real_step := remaining if step == simulated else minf(remaining, step / battle_speed)
		for id in [battle.actorId, battle.targetId]:
			if _produce_factory_soldiers(_participants[id], real_step):
				_factory_update = true
		remaining -= real_step
		if step == 0.0 or _battle_can_finish(battle):
			break
	return remaining


func _troop_balance(battle: Dictionary) -> float:
	var attacker := army_power(battle.actorId, _standalone or not battle.airborne)
	var defender := army_power(battle.targetId)
	return (attacker - defender) / maxf(1.0, maxf(attacker, defender))


func _battle_can_finish(battle: Dictionary) -> bool:
	if float(battle.elapsed) < float(battle.duration):
		return false
	var leading_side := signf(_troop_balance(battle))
	return leading_side == 0.0 or leading_side * float(battle.frontControl) >= CAPTURE_FRONT_MINIMUM - 0.000001


func consume_factory_update() -> bool:
	var updated := _factory_update
	_factory_update = false
	return updated


func _update_headquarters(participant: Dictionary) -> Dictionary:
	var ready := 0
	var activated := false
	var next_threshold := MAX_INTEGER + 1
	var order: Array = participant["garrisonOrder"]
	var troops := int(participant["troops"])
	for headquarters in participant["headquarters"]:
		if not headquarters.ready:
			var index := order.find(headquarters.regionId)
			var minimum := int(headquarters.minLocalTroops)
			if index < order.size() - 1 and minimum > GARRISON_SOLDIERS:
				continue
			var threshold := index * GARRISON_SOLDIERS + minimum if minimum > 0 else 0
			if troops < threshold:
				next_threshold = mini(next_threshold, threshold)
				continue
			headquarters.ready = true
			activated = true
		ready += 1
	return {"ready": ready, "activated": activated, "nextThreshold": next_threshold}


func consume_headquarters_ticks() -> Dictionary:
	var ticks := _headquarters_ticks
	_headquarters_ticks = {}
	return ticks


func _produce_factory_soldiers(participant: Dictionary, seconds: float) -> bool:
	if seconds <= 0.0 or (int(participant["factories"]) == 0 and participant["headquarters"].is_empty()):
		return false
	var headquarters := _update_headquarters(participant)
	var updated: bool = headquarters.activated
	var limit := _troop_limit(participant["bonusTanks"], participant["bonusHelicopters"], participant["bonusJets"])
	if _standalone:
		var producers := int(participant.factories) + int(headquarters.ready)
		if producers == 0:
			return updated
		var balance := seconds + float(participant.factoryRemainder)
		var troops := int(participant.troops)
		var room := limit - troops
		var rate := float(producers) * FACTORY_SOLDIERS_PER_SECOND
		var whole := floorf(balance + 0.000000001)
		var produced := room if whole * rate >= float(room) else int(whole * rate)
		participant.factoryRemainder = clampf(balance - whole, 0.0, 0.999999999) if room > produced else 0.0
		if produced > 0:
			participant.troops += produced
			_grant_starter_units(participant)
			for entry in participant.headquarters:
				if entry.ready:
					var region := int(entry.regionId)
					_headquarters_ticks[region] = int(_headquarters_ticks.get(region, 0)) + int(minf(whole, produced))
			_update_headquarters(participant)
		return updated or produced > 0
	while seconds > 0.0:
		var factories := int(participant["factories"]) + int(headquarters.ready)
		if factories == 0:
			break
		var troops := int(participant["troops"])
		var room := limit - troops
		if room <= 0:
			participant["factoryRemainder"] = 0.0
			break
		var rate := float(factories) * FACTORY_SOLDIERS_PER_SECOND
		var prior := float(participant["factoryRemainder"])
		var accumulated := rate * seconds + prior
		var threshold := int(headquarters.nextThreshold)
		var needed := float(threshold - troops)
		if threshold <= limit and accumulated >= needed - 0.000000001:
			# Start production at the instant the HQ qualifies, including within a long tick.
			seconds -= (needed - prior) / rate
			participant["troops"] = threshold
			participant["factoryRemainder"] = 0.0
			headquarters = _update_headquarters(participant)
			updated = true
			continue
		# Saturate before converting a large (possibly infinite) float to an int.
		if accumulated >= float(room):
			participant["troops"] = limit
			participant["factoryRemainder"] = 0.0
			return true
		var whole := int(floor(accumulated))
		var remainder := accumulated - float(whole)
		# Correct tiny binary rounding errors when ticks sum to an exact soldier.
		if remainder >= 1.0 - 0.000000001:
			whole += 1
			remainder = 0.0
		participant["troops"] += whole
		participant["factoryRemainder"] = remainder
		return updated or whole > 0
	return updated


func _troop_limit(bonus_tanks: int, bonus_helicopters: int, bonus_jets: int = 0) -> int:
	var limit := MAX_INTEGER
	# Keep the derived + gifted counts exact as well as the army itself.
	var earned_tank_room := MAX_INTEGER - bonus_tanks
	if earned_tank_room < MAX_INTEGER / _tank_threshold:
		limit = (earned_tank_room + 1) * _tank_threshold - 1
	var earned_heli_room := MAX_INTEGER - bonus_helicopters
	if not _coin_aviation and earned_heli_room < MAX_INTEGER / _helicopter_threshold:
		limit = mini(limit, (earned_heli_room + 1) * _helicopter_threshold - 1)
	var jet_room := MAX_INTEGER - bonus_jets
	if _standalone and jet_room < MAX_INTEGER / TROOPS_PER_JET:
		limit = mini(limit, (jet_room + 1) * TROOPS_PER_JET - 1)
	return limit


func view_state() -> Dictionary:
	var participants := _ordered_participants().duplicate(true)
	var pending: Array = []
	for participant in participants:
		if (int(participant["troopRegion"]) < 0 and _has_army_credit(participant, false)) or _has_army_credit(participant, true):
			pending.append(participant["id"])
	var regions: Array = []
	for region_id in range(_region_count):
		regions.append({"id": region_id, "ownerId": get_region_owner(region_id)})
	return {"phase": _phase, "soldiersPerCoin": _soldiers_per_coin,
		"battleSeconds": _battle_seconds, "tankPower": _tank_power, "helicopterPower": _helicopter_power, "jetPower": _jet_power, "participants": participants,
		"regions": regions, "pending": pending, "battles": active_battles_view(),
		"results": _results.duplicate(true)}


func active_battles_view() -> Array:
	var battles := _battles.duplicate(true)
	for battle in battles:
		battle["progress"] = clampf(float(battle["elapsed"]) / float(battle["duration"]), 0.0, 1.0)
		battle["actorTroops"] = _participants[battle["actorId"]]["troops"]
		battle["targetTroops"] = _participants[battle["targetId"]]["troops"]
		battle["actorPower"] = army_power(battle["actorId"], _standalone or not battle.airborne)
		battle["targetPower"] = army_power(battle["targetId"])
	return battles


func _has_army_credit(participant: Dictionary, queued: bool) -> bool:
	if participant.get("nextHeadquartersRequested" if queued else "headquartersRequested", false):
		return true
	if int(participant["nextTroops" if queued else "troops"]) > 0:
		return true
	if int(participant[AIR_WALLET_FIELDS[1 if queued else 0]]) > 0:
		return true
	for fields in UNIT_GIFT_FIELDS.values():
		if int(participant.get(fields[1] if queued else fields[0], 0)) > 0:
			return true
	return false


func serialize_state() -> Dictionary:
	var state := view_state()
	state["schemaVersion"] = SCHEMA_VERSION
	state["nextNumber"] = _next_number
	state["nextBattleId"] = _next_battle_id
	var seen := _seen_events.keys()
	seen.sort()
	state["seenEventIds"] = seen
	if _standalone:
		state["productionRemainderInSeconds"] = true
	if _coin_aviation:
		state["coinRemainders"] = _coin_remainders.duplicate()
	if not _like_remainders.is_empty():
		state["likeRemainders"] = _like_remainders.duplicate()
	return state


func restore_state(data: Variant) -> Dictionary:
	var error := _validate_save(data)
	if not error.is_empty():
		_clear_all()
		return _fail(error)
	_clear_all()
	_phase = data["phase"]
	_soldiers_per_coin = int(data["soldiersPerCoin"])
	_battle_seconds = float(data["battleSeconds"])
	_tank_power = int(data.get("tankPower", 100))
	_helicopter_power = int(data.get("helicopterPower", 300))
	_jet_power = int(data.get("jetPower", JET_POWER))
	_next_number = int(data["nextNumber"])
	_next_battle_id = int(data["nextBattleId"])
	for key in data.get("likeRemainders", {}):
		_like_remainders[key] = int(data.likeRemainders[key])
	if _coin_aviation:
		for id in data.get("coinRemainders", {}):
			_coin_remainders[id] = int(data.coinRemainders[id])
	var previous_fighters: Dictionary = {}
	if _standalone:
		for result in data["results"]:
			previous_fighters[result.actorId] = true
			previous_fighters[result.targetId] = true
	for source in data["participants"]:
		var participant: Dictionary = source.duplicate(true)
		for field in ["number", "coinTotal", "troops", "nextCoins", "nextTroops", "troopRegion"]:
			participant[field] = int(participant[field])
		for fields in UNIT_GIFT_FIELDS.values():
			for field in fields:
				participant[field] = int(participant.get(field, 0))
		var aircraft := _automatic_from_save(source)
		participant.automaticHelicopters = aircraft[0]
		participant.nextAutomaticHelicopters = aircraft[1]
		if _coin_aviation and not data.has("coinRemainders"):
			var remainder := int(participant.coinTotal) % COINS_PER_HELICOPTER
			if remainder != 0:
				_coin_remainders[participant.id] = remainder
		participant["factoryRemainder"] = float(participant.get("factoryRemainder", 0.0))
		for field in ["headquartersRequested", "nextHeadquartersRequested"]:
			participant[field] = participant.get(field, false)
		if _standalone:
			var fought: bool = previous_fighters.has(participant.id)
			participant.starterGranted = source.get("starterGranted", int(participant.troopRegion) >= 0 or fought)
			if not source.has("starterGranted"):
				_migrate_standalone_bonuses(participant)
		var regions: Array = []
		for region_id in participant["regions"]:
			regions.append(int(region_id))
			_owners[int(region_id)] = participant["id"]
		participant["regions"] = regions
		var order: Array = []
		if source.has("garrisonOrder"):
			for region_id in source["garrisonOrder"]:
				order.append(int(region_id))
		elif not regions.is_empty():
			order = regions.duplicate()
			order.erase(participant["troopRegion"])
			order.push_front(participant["troopRegion"])
		participant["garrisonOrder"] = order
		var headquarters: Array = []
		for entry in source.get("headquarters", []):
			headquarters.append({"regionId": int(entry.regionId), "minLocalTroops": int(entry.minLocalTroops), "ready": entry.ready})
		participant["headquarters"] = headquarters
		if _standalone and data.get("productionRemainderInSeconds") != true:
			var producers := int(participant.factories) + _ready_headquarters_in_save(source, regions)
			participant.factoryRemainder /= float(maxi(1, producers) * FACTORY_SOLDIERS_PER_SECOND)
		_participants[participant["id"]] = participant
	for event_id in data["seenEventIds"]:
		_seen_events[event_id] = true
	for source in data["battles"]:
		var restored_battle := {"id": int(source["id"]), "actorId": source["actorId"],
			"targetId": source["targetId"], "actorRegion": int(source["actorRegion"]),
			"targetRegion": int(source["targetRegion"]), "elapsed": float(source["elapsed"]),
			"duration": float(source["duration"]), "frontControl": float(source.get("frontControl", 0.0)),
			"airborne": source.get("airborne", source.has("captureFrom"))}
		if source.has("captureFrom"):
			restored_battle.captureFrom = int(source.captureFrom)
			restored_battle.captureTo = int(source.captureTo)
		if source.has("airUnit"):
			restored_battle.airUnit = source.airUnit
		_battles.append(restored_battle)
	_battles.sort_custom(func(a, b): return int(a["id"]) < int(b["id"]))
	for source in data["results"]:
		var result: Dictionary = source.duplicate(true)
		for field in ["battleId", "actorTroops", "targetTroops", "survivors"]:
			result[field] = int(result[field])
		var transferred: Array = []
		for region_id in result["transferredRegions"]:
			transferred.append(int(region_id))
		result["transferredRegions"] = transferred
		_results.append(result)
	return {"ok": true}


func _resolve_battle(battle: Dictionary) -> Dictionary:
	var actor: Dictionary = _participants[battle["actorId"]]
	var target: Dictionary = _participants[battle["targetId"]]
	var a: int = int(actor["troops"])
	var b: int = int(target["troops"])
	var power_a := army_power(actor.id, _standalone or not battle.airborne)
	var power_b := army_power(target.id)
	var survivors := _combat_survivor_counts(a, b, power_a, power_b)
	var result := {"battleId": battle["id"], "actorId": actor["id"],
		"targetId": target["id"], "actorTroops": a, "targetTroops": b,
		"actorPower": power_a, "targetPower": power_b,
		"winnerId": "", "loserId": "", "tie": power_a == power_b,
		"survivors": maxi(survivors[0], survivors[1]), "transferredRegions": []}
	actor["troops"] = survivors[0]
	target["troops"] = survivors[1]
	if result.tie:
		_clear_unit_bonuses(actor)
		_clear_unit_bonuses(target)
		return result
	var winner: Dictionary = actor if power_a > power_b else target
	var loser: Dictionary = target if power_a > power_b else actor
	var before := a if power_a > power_b else b
	_apply_mobile_unit_losses(winner, before)
	result["winnerId"] = winner["id"]
	result["loserId"] = loser["id"]
	var destroyed: Array[int] = []
	var transferred: Array = loser.regions.duplicate()
	_transfer_defeated_territory(winner, loser, transferred, destroyed)
	result["transferredRegions"] = transferred
	if not destroyed.is_empty():
		result["destroyedHeadquarters"] = destroyed
	_clear_unit_bonuses(loser)
	return result


func _transfer_defeated_territory(winner: Dictionary, loser: Dictionary, transferred: Array, destroyed: Array[int]) -> void:
	for region_id in transferred:
		_owners[region_id] = winner["id"]
		loser.regions.erase(region_id)
	winner["regions"].append_array(transferred)
	winner["regions"].sort()
	var retained_order: Array = []
	for region_id in loser.garrisonOrder:
		if get_region_owner(region_id) == winner.id:
			winner.garrisonOrder.append(region_id)
		else:
			retained_order.append(region_id)
	loser.garrisonOrder = retained_order
	# Full defeat unplaces the loser. A partial capture may move their base.
	loser.troopRegion = -1 if retained_order.is_empty() else retained_order[0]
	var retained_headquarters: Array = []
	for headquarters in loser.headquarters:
		if get_region_owner(int(headquarters.regionId)) == loser.id:
			retained_headquarters.append(headquarters)
		elif headquarters.ready:
			destroyed.append(int(headquarters.regionId))
	loser.headquarters = retained_headquarters


func _apply_mobile_unit_losses(participant: Dictionary, before: int) -> void:
	for field in ["bonusTanks", "bonusHelicopters", "bonusJets", "automaticHelicopters"]:
		participant[field] = _retained_units(int(participant[field]), int(participant.troops), before)


func _clear_unit_bonuses(participant: Dictionary) -> void:
	for fields in UNIT_GIFT_FIELDS.values():
		participant[fields[0]] = 0
	participant.automaticHelicopters = 0
	participant["factoryRemainder"] = 0.0
	participant["headquartersRequested"] = false


func _new_participant(id: String, number: int) -> Dictionary:
	var participant := {"id": id, "number": number, "username": "", "nickname": "",
		"portraitUrl": "", "coinTotal": 0, "troops": 0, "troopRegion": -1,
		"regions": [], "garrisonOrder": [], "headquarters": [],
		"nextCoins": 0, "nextTroops": 0, "factoryRemainder": 0.0,
		"headquartersRequested": false, "nextHeadquartersRequested": false}
	for fields in UNIT_GIFT_FIELDS.values():
		for field in fields:
			participant[field] = 0
	for field in AIR_WALLET_FIELDS:
		participant[field] = 0
	if _standalone:
		participant.starterGranted = false
	return participant


static func _retained_units(count: int, remaining: int, before: int) -> int:
	if remaining >= before:
		return count
	return clampi(roundi(float(count) * (float(remaining) / float(before))), 0, count)


func _ordered_participants() -> Array:
	var participants := _participants.values()
	participants.sort_custom(func(a, b): return int(a["number"]) < int(b["number"]))
	return participants


func _is_busy(id: String) -> bool:
	for battle in _battles:
		if battle["actorId"] == id or battle["targetId"] == id:
			return true
	return false


func _cancel_battles_for(participant_ids: Dictionary) -> Array[String]:
	var cancelled: Array[String] = []
	for battle in _battles.duplicate():
		if participant_ids.has(battle.actorId) or participant_ids.has(battle.targetId):
			cancelled.append(str(int(battle.id)))
			_battles.erase(battle)
	return cancelled


func _transition(expected: String, target: String) -> Dictionary:
	if _phase != expected:
		return _fail("invalid_phase")
	_phase = target
	return {"ok": true}


func _fail(error: String) -> Dictionary:
	return {"ok": false, "applied": false, "error": error}


func _nonempty_string(value: Variant) -> bool:
	return typeof(value) == TYPE_STRING and not String(value).strip_edges().is_empty()


static func _whole(value: Variant, minimum: int = 0, maximum: int = MAX_INTEGER) -> bool:
	# JSON decodes integers as floats; validate before conversion (never truncate).
	if typeof(value) == TYPE_INT:
		return value >= minimum and value <= maximum
	if typeof(value) == TYPE_FLOAT:
		return is_finite(value) and value >= minimum and value <= maximum and floor(value) == value
	return false


func _positive_seconds(value: Variant) -> bool:
	return (typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT) and is_finite(float(value)) and float(value) > 0.0


func _validate_save(data: Variant) -> String:
	if not data is Dictionary or not _whole(data.get("schemaVersion"), SCHEMA_VERSION, SCHEMA_VERSION):
		return "unsupported_or_corrupt_schema"
	if not data.has_all(["phase", "soldiersPerCoin", "battleSeconds", "participants", "battles", "results", "seenEventIds", "nextNumber", "nextBattleId"]):
		return "missing_state_fields"
	if not data.get("phase") in PHASES:
		return "corrupt_phase"
	if not _whole(data.get("soldiersPerCoin"), 1, 100000) or not _positive_seconds(data.get("battleSeconds")):
		return "corrupt_settings"
	if not _whole(data.get("tankPower", 100), 0, 100000) or not _whole(data.get("helicopterPower", 300), 0, 100000) \
			or not _whole(data.get("jetPower", JET_POWER), 0, 100000):
		return "corrupt_vehicle_power"
	for field in ["participants", "battles", "results", "seenEventIds"]:
		if not data.get(field) is Array:
			return "corrupt_arrays"
	if not _whole(data.get("nextNumber"), 1) or not _whole(data.get("nextBattleId"), 1):
		return "corrupt_counters"
	var remainders: Variant = data.get("coinRemainders", {})
	if not remainders is Dictionary:
		return "corrupt_coin_remainders"
	for id in remainders:
		if not _nonempty_string(id) or not _whole(remainders[id], 0, COINS_PER_HELICOPTER - 1):
			return "corrupt_coin_remainders"
	var likes: Variant = data.get("likeRemainders", {})
	if not likes is Dictionary:
		return "corrupt_like_remainders"
	for key in likes:
		if not _nonempty_string(key) or key.length() > 129 or not _whole(likes[key], 1, MAX_SOLDIERS_PER_GIFT - 1):
			return "corrupt_like_remainders"
	var ids: Dictionary = {}
	var numbers: Dictionary = {}
	var occupied: Dictionary = {}
	for participant in data["participants"]:
		if not participant is Dictionary or not _nonempty_string(participant.get("id")):
			return "corrupt_participant"
		if not participant.has_all(["number", "username", "nickname", "portraitUrl", "coinTotal", "troops", "troopRegion", "regions", "nextCoins", "nextTroops"]):
			return "missing_participant_fields"
		if ids.has(participant["id"]):
			return "duplicate_participant"
		for field in ["username", "nickname", "portraitUrl"]:
			if typeof(participant.get(field)) != TYPE_STRING:
				return "corrupt_profile"
		for field in ["number", "coinTotal", "troops", "nextCoins", "nextTroops"]:
			if not _whole(participant.get(field)):
				return "corrupt_quantity"
		var number := int(participant["number"])
		if number < 1 or number >= int(data["nextNumber"]) or numbers.has(number):
			return "corrupt_participant_number"
		if not _whole(participant.get("troopRegion"), -1, _region_count - 1) or not participant.get("regions") is Array:
			return "corrupt_regions"
		if int(participant["troops"]) > MAX_INTEGER - int(participant["nextTroops"]):
			return "corrupt_quantity"
		if int(participant["nextCoins"]) > int(participant["coinTotal"]):
			return "corrupt_quantity"
		if data["phase"] != "results" and (int(participant["nextTroops"]) != 0 or int(participant["nextCoins"]) != 0):
			return "corrupt_pending_phase"
		var regions: Array = []
		for region_id in participant["regions"]:
			if not _whole(region_id, 0, _region_count - 1) or occupied.has(int(region_id)):
				return "corrupt_region_owner"
			occupied[int(region_id)] = participant["id"]
			regions.append(int(region_id))
		var troop_region := int(participant["troopRegion"])
		if (troop_region < 0 and not regions.is_empty()) or (troop_region >= 0 and not troop_region in regions):
			return "corrupt_troop_region"
		if not _valid_garrison_order(participant, regions, troop_region):
			return "corrupt_garrison_order"
		var ready_headquarters := _ready_headquarters_in_save(participant, regions)
		if ready_headquarters < 0:
			return "corrupt_headquarters"
		if not _valid_unit_save(participant, data["phase"] == "results", ready_headquarters > 0, data):
			return "corrupt_unit_quantities"
		ids[participant["id"]] = participant
		numbers[number] = true
	var event_ids: Dictionary = {}
	for event_id in data["seenEventIds"]:
		if not _nonempty_string(event_id) or event_ids.has(event_id):
			return "corrupt_event_ids"
		event_ids[event_id] = true
	if not data["battles"].is_empty() and not data["phase"] in ["running", "paused"]:
		return "corrupt_battle_phase"
	var busy: Dictionary = {}
	var battle_ids: Dictionary = {}
	for battle in data["battles"]:
		if not battle is Dictionary or not _whole(battle.get("id"), 1, int(data["nextBattleId"]) - 1):
			return "corrupt_battle"
		if not battle.has_all(["actorId", "targetId", "actorRegion", "targetRegion", "elapsed", "duration"]):
			return "missing_battle_fields"
		if battle_ids.has(int(battle["id"])):
			return "corrupt_battle_id"
		battle_ids[int(battle["id"])] = true
		if typeof(battle.get("actorId")) != TYPE_STRING or typeof(battle.get("targetId")) != TYPE_STRING:
			return "corrupt_battle_participant"
		if battle["actorId"] == battle["targetId"]:
			return "corrupt_self_battle"
		for side in ["actor", "target"]:
			var id: String = battle[side + "Id"]
			if not ids.has(id) or busy.has(id):
				return "corrupt_battle_participant"
			if not _whole(battle.get(side + "Region"), 0, _region_count - 1):
				return "corrupt_battle_region"
			if int(battle[side + "Region"]) != int(ids[id]["troopRegion"]):
				return "corrupt_battle_region"
			busy[id] = true
		if int(ids[battle["actorId"]]["troops"]) <= 0:
			return "corrupt_battle_region"
		if typeof(battle.get("airborne", false)) != TYPE_BOOL or (battle.get("airborne", false) and not battle.has("captureFrom")):
			return "corrupt_capture_route"
		if battle.has("airUnit") and (battle.get("airborne") != true or battle.airUnit not in ["helicopter", "jet"]):
			return "corrupt_capture_route"
		if battle.has("captureFrom") or battle.has("captureTo"):
			if not _whole(battle.get("captureFrom"), 0, _region_count - 1) or not _whole(battle.get("captureTo"), 0, _region_count - 1):
				return "corrupt_capture_route"
			if occupied.get(int(battle.captureFrom)) != battle.actorId or occupied.get(int(battle.captureTo)) != battle.targetId:
				return "corrupt_capture_route"
		if not _positive_seconds(battle.get("duration")):
			return "corrupt_battle_time"
		var elapsed: Variant = battle.get("elapsed")
		if (typeof(elapsed) != TYPE_INT and typeof(elapsed) != TYPE_FLOAT) or not is_finite(float(elapsed)):
			return "corrupt_battle_time"
		if float(elapsed) < 0.0 or float(elapsed) > float(battle["duration"]):
			return "corrupt_battle_time"
		var control: Variant = battle.get("frontControl", 0.0)
		if typeof(control) not in [TYPE_INT, TYPE_FLOAT] or not is_finite(float(control)) or absf(float(control)) > 1.0:
			return "corrupt_battle_front"
	for result in data["results"]:
		if not result is Dictionary:
			return "corrupt_result"
		if not result.has_all(["battleId", "actorId", "targetId", "actorTroops", "targetTroops", "winnerId", "loserId", "tie", "survivors", "transferredRegions"]):
			return "missing_result_fields"
		for field in ["battleId", "actorTroops", "targetTroops", "survivors"]:
			if not _whole(result.get(field)):
				return "corrupt_result"
		for field in ["actorId", "targetId", "winnerId", "loserId"]:
			if typeof(result.get(field)) != TYPE_STRING:
				return "corrupt_result"
		if not ids.has(result["actorId"]) or not ids.has(result["targetId"]) or result["actorId"] == result["targetId"]:
			return "corrupt_result"
		if typeof(result.get("tie")) != TYPE_BOOL or not result.get("transferredRegions") is Array:
			return "corrupt_result"
		var a := int(result["actorTroops"])
		var b := int(result["targetTroops"])
		for field in ["actorPower", "targetPower"]:
			if field in result and (typeof(result[field]) not in [TYPE_INT, TYPE_FLOAT] or not is_finite(float(result[field])) or float(result[field]) < 0.0):
				return "corrupt_result_power"
		var power_a := float(result.get("actorPower", a))
		var power_b := float(result.get("targetPower", b))
		var winner: String = "" if power_a == power_b else (result["actorId"] if power_a > power_b else result["targetId"])
		var loser: String = "" if power_a == power_b else (result["targetId"] if power_a > power_b else result["actorId"])
		var survivors := _combat_survivor_counts(a, b, power_a, power_b)
		if result["tie"] != (power_a == power_b) or result["winnerId"] != winner or result["loserId"] != loser or int(result["survivors"]) != maxi(survivors[0], survivors[1]):
			return "corrupt_result_math"
		var transferred: Dictionary = {}
		for region_id in result["transferredRegions"]:
			if not _whole(region_id, 0, _region_count - 1) or transferred.has(int(region_id)):
				return "corrupt_result_regions"
			transferred[int(region_id)] = true
	return ""


func _valid_garrison_order(participant: Dictionary, regions: Array, base_region: int) -> bool:
	if not participant.has("garrisonOrder"):
		return true
	var order: Variant = participant["garrisonOrder"]
	if not order is Array or order.size() != regions.size():
		return false
	var remaining := regions.duplicate()
	for index in order.size():
		var region: Variant = order[index]
		if not _whole(region, 0, _region_count - 1) or not remaining.has(int(region)):
			return false
		if index == 0 and int(region) != base_region:
			return false
		remaining.erase(int(region))
	return true


func _ready_headquarters_in_save(participant: Dictionary, regions: Array) -> int:
	var entries: Variant = participant.get("headquarters", [])
	if not entries is Array or entries.size() > regions.size():
		return -1
	var seen := {}
	var ready := 0
	for entry in entries:
		if not entry is Dictionary or not _whole(entry.get("regionId"), 0, _region_count - 1):
			return -1
		var region := int(entry.regionId)
		if not regions.has(region) or seen.has(region):
			return -1
		if not _whole(entry.get("minLocalTroops")) or typeof(entry.get("ready")) != TYPE_BOOL:
			return -1
		seen[region] = true
		ready += int(entry.ready)
	return ready


func _valid_unit_save(participant: Dictionary, allows_queued: bool, has_ready_headquarters: bool, data: Dictionary) -> bool:
	# These fields are additive to schema 1. Saves created before gift actions
	# have zero gift units and zero unfinished factory production.
	for field in ["headquartersRequested", "nextHeadquartersRequested"]:
		if typeof(participant.get(field, false)) != TYPE_BOOL:
			return false
	if typeof(participant.get("starterGranted", false)) != TYPE_BOOL:
		return false
	if not allows_queued and participant.get("nextHeadquartersRequested", false):
		return false
	var combined: Dictionary = {}
	for fields in UNIT_GIFT_FIELDS.values():
		var active: Variant = participant.get(fields[0], 0)
		var queued: Variant = participant.get(fields[1], 0)
		if not _whole(active) or not _whole(queued):
			return false
		if not allows_queued and int(queued) > 0:
			return false
		combined[fields[0]] = int(active) + int(queued)
		if combined[fields[0]] > MAX_INTEGER:
			return false
	for field in AIR_WALLET_FIELDS:
		if not _whole(participant.get(field, 0)):
			return false
	var aircraft := _automatic_from_save(participant)
	if not allows_queued and aircraft[1] != 0:
		return false
	if aircraft[0] + aircraft[1] > MAX_INTEGER - combined["bonusHelicopters"]:
		return false
	var remainder: Variant = participant.get("factoryRemainder", 0.0)
	if typeof(remainder) != TYPE_INT and typeof(remainder) != TYPE_FLOAT:
		return false
	if not is_finite(float(remainder)) or float(remainder) < 0.0 or float(remainder) >= 1.0:
		return false
	if float(remainder) != 0.0 and int(participant.get("factories", 0)) == 0 and not has_ready_headquarters:
		return false
	var combined_troops := int(participant["troops"]) + int(participant["nextTroops"])
	if _standalone and not participant.has("starterGranted"):
		# Pre-milestone saves used the old thresholds. Validate those before
		# trimming any bonus counts that the new derived totals would overflow.
		var was_soldier_aviation: bool = data.get("productionRemainderInSeconds") == true
		var heli_threshold := 500 if was_soldier_aviation else HELICOPTER_SOLDIER_THRESHOLD
		var old_helis: int = combined_troops / heli_threshold
		if data.has("coinRemainders") and not was_soldier_aviation:
			var legacy_aircraft: Array[int] = _automatic_from_save(participant, true)
			old_helis = legacy_aircraft[0] + legacy_aircraft[1]
		var old_jets := combined_troops / 1000 if was_soldier_aviation else 0
		return (combined["bonusTanks"] <= MAX_INTEGER - combined_troops / TANK_SOLDIER_THRESHOLD
			and combined["bonusHelicopters"] <= MAX_INTEGER - old_helis
			and combined["bonusJets"] <= MAX_INTEGER - old_jets)
	return combined_troops <= _troop_limit(combined["bonusTanks"], combined["bonusHelicopters"], combined["bonusJets"])


func _migrate_standalone_bonuses(participant: Dictionary) -> void:
	var troops := int(participant.troops) + int(participant.nextTroops)
	for fields in UNIT_GIFT_FIELDS.values():
		var field: String = fields[0]
		if STANDALONE_BONUS_THRESHOLDS.has(field):
			var room: int = MAX_INTEGER - troops / int(STANDALONE_BONUS_THRESHOLDS[field])
			participant[field] = mini(int(participant[field]), room)
			participant[fields[1]] = mini(int(participant[fields[1]]), room - int(participant[field]))


func _automatic_from_save(participant: Dictionary, legacy_coin_aviation: bool = false) -> Array[int]:
	if not (_coin_aviation or legacy_coin_aviation):
		return [0, 0]
	if participant.has("automaticHelicopters"):
		return [int(participant.automaticHelicopters), int(participant.get("nextAutomaticHelicopters", 0))]
	# Grandfather the old troop-derived fleet, including pending credit, once.
	var troops := int(participant.troops)
	var queued := int(participant.nextTroops)
	var active := troops / HELICOPTER_SOLDIER_THRESHOLD
	var pending := queued / HELICOPTER_SOLDIER_THRESHOLD
	if int(participant.troopRegion) < 0:
		pending = (troops + queued) / HELICOPTER_SOLDIER_THRESHOLD - active
	return [active, pending]


func _clear_all() -> void:
	_phase = "staging"
	_soldiers_per_coin = DEFAULT_SOLDIERS_PER_COIN
	_battle_seconds = DEFAULT_BATTLE_SECONDS
	_tank_power = 100
	_helicopter_power = 300
	_participants.clear()
	_owners.clear()
	_seen_events.clear()
	_coin_remainders.clear()
	_like_remainders.clear()
	_headquarters_ticks.clear()
	_battles.clear()
	_results.clear()
	_next_number = 1
	_next_battle_id = 1
	_factory_update = false
