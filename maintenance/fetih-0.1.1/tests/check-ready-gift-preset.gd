extends SceneTree

const EXPECTED := {
	"5658": ["soldiers", 2000, "troops"],
	"5879": ["tank", 10, "bonusTanks"],
	"5303": ["helicopter", 10, "bonusHelicopters"],
	"5660": ["factory", 1, "factories"],
	"6427": ["jet", 10, "bonusJets"],
	"7168": ["soldiers", 10000, "troops"],
	"11046": ["surrounding", 1, ""],
}
var failures := 0

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	var preferences := profile.path_join("settings-v1.json")
	if profile.get_file() != "ready-gift-profile" or FileAccess.file_exists(preferences):
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(profile)
	var saved := FileAccess.open(preferences, FileAccess.WRITE)
	saved.store_string(JSON.stringify({"schemaVersion": 1, "giftActionsVersion": 1,
		"giftActions": {"11046": {"unit": "surrounding", "count": 1}}}))
	saved.close()
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.set_process(false)
	check(app.settings.giftActions.size() == EXPECTED.size(), "Galaxy only migrates to seven rules")
	var upgraded: Variant = JSON.parse_string(FileAccess.get_file_as_string(preferences))
	check(upgraded is Dictionary and int(upgraded.get("giftActionsVersion", 0)) == 2, "upgrade persisted")
	app._open_actions()
	var action_menu: Window = app.gift_dialog
	var entries: Dictionary = action_menu.get("_catalog_by_id")
	var rule_rows: Dictionary = action_menu.get("_rule_rows")
	for id: String in EXPECTED:
		var expected: Array = EXPECTED[id]
		var action: Dictionary = app.settings.giftActions.get(id, {})
		check(action.get("unit") == expected[0] and action.get("count") == expected[1], "right rule for " + id)
		var row: Dictionary = entries.get(id, {})
		var icon: Texture2D = action_menu._gift_icon(row) if not row.is_empty() else null
		check(rule_rows.has(id) and row.get("file") == id + ".png" and icon != null, "real saved rule and icon for " + id)
		var sender := "qa_" + id
		var event := {"eventId": sender, "type": "gift", "giftId": id, "username": sender, "repeatCount": 1}
		check(app.accept_live_event(event), "accept " + id)
		var unit_property: String = expected[2]
		var value: Variant = app.rules.get_participant(sender).get(unit_property, 0)
		if not unit_property.is_empty():
			check(int(value) == expected[1], "correct reward for " + id + ": " + str(value))
		else:
			check(app.pending_surrounding.has(sender), "Galaxy queues surrounding attack")
		var before: Dictionary = app.rules.serialize_state()
		check(app.accept_live_event(event) and app.rules.serialize_state() == before, "no duplicate reward for " + id)
	var gift_actions: Script = load("res://mod/GiftActions.gd")
	var existing: Dictionary = gift_actions.migrate_actions({"5303": {"unit": "helicopter", "count": 5}}, 1)
	check(existing["5303"].count == 5 and not existing.has("11046"), "preserve edited and removed rules")
	check(gift_actions.migrate_actions({}, 2).is_empty(), "deleted preset does not come back")
	action_menu.hide()
	app.queue_free()
	await process_frame
	if failures == 0:
		print("FETIH_READY_GIFT_PRESET_OK")
	quit(0 if failures == 0 else 1)

func check(condition: bool, label: String) -> void:
	if not condition:
		failures += 1
		printerr("READY_GIFT_FAIL: " + label)
