extends SceneTree

const App := preload("../mod/LiveWar.gd")
const Actions := preload("../mod/GiftActions.gd")
var failures := 0

func _initialize() -> void:
	run.call_deferred()

func check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)

func run() -> void:
	var project: String = get_script().resource_path.get_base_dir().get_base_dir()
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE").replace("\\", "/").simplify_path()
	if profile.get_base_dir().nocasecmp_to(project.path_join("qa")) != 0 or not profile.get_file().begins_with("galaxy-roster-"):
		quit(1)
		return
	var preferences := profile.path_join("settings-v1.json")
	if FileAccess.file_exists(preferences):
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(profile)
	var saved := FileAccess.open(preferences, FileAccess.WRITE)
	saved.store_string(JSON.stringify({"schemaVersion": 1, "giftActions": {"5655": {"unit": "tank", "count": 3}}}))
	saved.close()
	var app := App.new()
	app.mod_root = project.path_join("mod")
	root.add_child(app)
	app.set_process(false)
	app.test_mode = false
	await process_frame
	check(app.settings.giftActions.size() == 8 and app.settings.giftActions["5655"].count == 3
		and app.settings.giftActions[Actions.GALAXY].unit == "surrounding", "legacy custom rule gets the seven illustrated defaults alongside it")
	app._open_actions()
	await process_frame
	var dialog := app.gift_dialog
	check(int(dialog._catalog_by_id[Actions.GALAXY].coins.to_float()) == 1000 and dialog._rule_rows[Actions.GALAXY].amount.text == "Her yere saldır",
		"the default rule selects the real 1000-coin Galaxy ID")
	dialog._select_gift(Actions.GALAXY)
	var replacement: String = dialog._entries[0].id
	if replacement in [Actions.GALAXY, "5655"]:
		replacement = dialog._entries[1].id
	dialog._select_gift(replacement)
	check(not dialog._actions.has(Actions.GALAXY) and dialog._actions[replacement].unit == "surrounding",
		"editing the default rule can move it to a different gift")
	dialog.confirmed.emit()
	app._read_settings()
	check(not app.settings.giftActions.has(Actions.GALAXY) and app.settings.giftActions.has(replacement)
		and app.settings.giftActions.has("5655"), "the migrated default does not return after editing and restarting")
	check(app.save_gift_actions(Actions.DEFAULT_ACTIONS), "restore the standard rule for gameplay checks")

	var source := 2
	var neighbor: int = app.canvas.neighbors[source][0]
	var third: int = app.canvas.neighbors[source][1]
	app.accept_live_event({"eventId": "ward", "type": "gift", "username": "ward", "nickname": "Ward Gösterim", "giftCoinValue": 10})
	app.accept_live_event({"eventId": "reserve", "type": "gift", "username": "reserve", "giftCoinValue": 1})
	app.place_player("ward", neighbor)
	app.place_player("reserve", third)
	var gift := {"eventId": "galaxy:1", "type": "gift", "username": "pilot", "nickname": "Pilot Gösterim", "giftId": Actions.GALAXY}
	check(app.accept_live_event(gift) and app.pending_surrounding.has("pilot")
		and app.battle_views().is_empty() and app.player_view("pilot").coinTotal == 1000, "unplaced Galaxy author keeps the request and paid coin credit")
	app._read_state()
	check(app.pending_surrounding.has("pilot"), "queued Galaxy request survives a restart")
	app.place_player("pilot", source)
	check(app.battle_views().size() == 1 and app.battle_views()[0].attacker == "pilot"
		and app.surrounding_orders.get("pilot", []).size() == 1, "placement starts the first of two surrounding battles")
	check(app.accept_live_event(gift) and app.player_view("pilot").coinTotal == 1000
		and app.battle_views().size() == 1 and not app.pending_surrounding.has("pilot"), "replay cannot start or pay twice")

	app._refresh()
	check(app.army_cards.pilot.get_index() == 1, "army order defaults to highest soldier count")
	var command := {"eventId": "chat:1", "type": "chat", "username": "reserve", "comment": "  SALDIR  "}
	check(app.accept_live_event(command), "plain chat request is accepted")
	app._refresh()
	check(app.army_cards.reserve.get_index() == 1 and app.army_cards.reserve.get_node("Row/AttackRequest").visible
		and app.battle_views().size() == 1, "plain attack pins the army and shows the badge without starting combat")
	await process_frame
	check(app.canvas.territory_surface.surface_by_region[source].name_label.text == "Pilot Gösterim",
		"map shows the same display name as the army list")
	var tooltip: String = app.canvas.region_tooltip(app.canvas.project_map_point(app.canvas.regions[source].center), true)
	check(tooltip.contains("[color=#ff9c88]") and tooltip.contains("[color=#85e0d5]"), "hover identifies both sides with separate colors")
	var hud: Control = app.canvas.map_hud
	hud.update_hover_card(app.canvas.region_hover_data(app.canvas.project_map_point(app.canvas.regions[source].center)))
	check(hud.side_cards[0].visible and hud.side_cards[1].visible
		and hud.side_headings[0].text.begins_with("Saldıran") and hud.side_headings[1].text.begins_with("Savunan")
		and hud.side_details[0].text.contains("asker eşdeğeri"), "the hover has two distinct role cards")
	var defender: String = app.battle_views()[0].defender
	app.rules.tick(120.0)
	app._refresh()
	check(not app.army_cards.has(defender) and app.player_view(defender).troops == 0, "a defeated zero-soldier army leaves the visible roster")
	app.accept_live_event({"eventId": "defender:returns", "type": "gift", "username": defender, "giftCoinValue": 1})
	app._refresh()
	check(app.army_cards.has(defender) and app.player_view(defender).troops == 50, "a gift restores the same army's row")
	app._toggle_sidebar()
	app._toggle_map_only()
	check(not app.top_bar.visible and not app.map_footer.visible and not app.sidebar.visible and not app.canvas.map_hud.visible
		and not app.canvas.territory_surface.surface_by_region[source].label.visible, "map mode hides the overlays and army roster")
	app._toggle_map_only()
	check(app.top_bar.visible and not app.map_footer.visible and not app.sidebar.visible and app.canvas.map_hud.visible,
		"map mode restores prior sidebar preference with manually open commands")
	app._toggle_sidebar()
	check(app.sidebar.visible, "sidebar can be reopened independently")
	app.free()
	await process_frame
	if failures == 0:
		print("FETIH_GALAXY_ROSTER_OK")
	quit(0 if failures == 0 else 1)
