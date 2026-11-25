extends SceneTree

var failures := 0

func _initialize() -> void:
	run.call_deferred()

func start_game() -> Node:
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	app.test_mode = false
	app._read_state()
	app._refresh()
	return app

func gift(receipt: String, viewer: String, count: int) -> Dictionary:
	return {"type": "gift", "username": viewer, "eventId": receipt, "giftCoinValue": 1, "repeatCount": count}

func check(value: bool, label: String) -> void:
	if not value:
		failures += 1
		printerr("HELD_GIFT_FAILED: " + label)

func troops(app: Node, user: String) -> int:
	return int(app.rules.get_participant(user).get("troops", 0))

func run() -> void:
	if "--self-test" not in OS.get_cmdline_user_args() or not OS.get_environment("TIKMNG_ANIMAL_PROFILE").get_file().begins_with("held-gifts-"):
		quit(1)
		return
	var app := start_game()
	var reward := gift("ada-combo", "ada", 2)
	check(app.accept_live_event(gift("ada-first", "ada", 1)) and troops(app, "ada") == 0, "even first gift awaits approval")
	app._refresh()
	var first_button: Button = app.army_cards.ada.get_node("Row/ApproveGift")
	check(first_button.visible and first_button.text == "Ekle", "first gift has approval on own row")
	first_button.pressed.emit()
	check(troops(app, "ada") == 50 and not first_button.visible, "first coin starts 50 troops once on approval")
	check(app.drop_army("ada", 2).ok, "publisher places waiting army")
	check(app.accept_live_event(reward) and app.accept_live_event(reward) and troops(app, "ada") == 50 and app.gift_reserve.size() == 1, "replayed combo waits once")
	check(not app.accept_live_event(gift("bad", "ada", 0)) and not app.gift_reserve.has("bad"), "invalid combo cannot enter reserve")
	check(app.accept_live_event({"type":"like", "eventId":"thanks", "username":"ada", "likeCount":250, "broadcastChannel":"qa"}), "likes accepted")
	check(app.accept_live_event({"type":"follow", "eventId":"follow", "username":"ada", "broadcastChannel":"qa"}) and troops(app, "ada") == 250, "free engagement immediately reinforces")
	check(app._switch_map("world") and app.gift_reserve.is_empty() and app.accept_live_event(reward) and troops(app, "ada") == 0, "held reward stays on its original map")
	check(app._switch_map("turkiye") and app.gift_reserve.size() == 1, "held reward survives map switch")
	app.free()
	await process_frame
	app = start_game()
	check(app.gift_reserve.size() == 1 and troops(app, "ada") == 250, "restored deployed army and pending gift")
	app.settings.soldiersPerCoin = 80
	app._apply_rules_settings()
	check(app.accept_live_event(gift("deniz-new", "deniz", 1)) , "second first gift waits")
	app._approve_gifts("deniz")
	check(app.drop_army("deniz", 3).ok, "second army placed")
	check(app.accept_live_event(gift("deniz-next", "deniz", 1)), "another recipient can wait")
	app._refresh()
	var button: Button = app.army_cards.ada.get_node("Row/ApproveGift")
	if "--capture" in OS.get_cmdline_user_args():
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(OS.get_environment("TIKMNG_ANIMAL_PROFILE").path_join("ekle.png"))
	check(button.visible and "100 asker" in button.tooltip_text, "button stays on donor row at original rate")
	if button:
		button.pressed.emit()
	app._approve_gifts("ada")
	check(troops(app, "ada") == 350 and app.accept_live_event(reward) and troops(app, "ada") == 350, "approval and replay grant once")
	check(troops(app, "deniz") == 80 and app.gift_reserve.has("deniz-next"), "other army stays pending")
	app._finish_round()
	check(app.gift_reserve.has("deniz-next"), "pending credit survives round end")
	app._approve_gifts("deniz")
	check(troops(app, "deniz") == 80 and app.rules.get_participant("deniz").regions.is_empty(), "post-round approval enters waiting list")
	app.victory_scene.dismiss()
	check(app.drop_army("deniz", 3).ok, "next round can place returned army")
	var discarded := gift("reset-reward", "deniz", 1)
	check(app.accept_live_event(discarded) and app.gift_reserve.has("reset-reward"), "reset fixture waits")
	app._reset_roster()
	check(app.gift_reserve.is_empty() and app.accept_live_event(discarded) and troops(app, "deniz") == 0, "explicit reset prevents replay")
	var factory := gift("factory", "fabrika", 1)
	factory.giftId = "5660"
	check(app.accept_live_event(factory) and troops(app, "fabrika") == 0, "factory is held")
	app._refresh()
	app.army_cards.fabrika.get_node("Row/ApproveGift").pressed.emit()
	check(app.rules.unit_counts("fabrika").factories == 1, "button applies the factory once")
	var galaxy := gift("galaxy-order", "komutan", 1)
	galaxy.giftId = "11046"
	check(app.accept_live_event(galaxy) and not app.pending_surrounding.has("komutan"), "no automatic surrounding attack")
	app._refresh()
	check(app.gift_request.visible and app.gift_request.receipt == "galaxy-order", "central request identifies the gift")
	if "--capture" in OS.get_cmdline_user_args():
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(OS.get_environment("TIKMNG_ANIMAL_PROFILE").path_join("saldiri-istegi.png"))
	app.gift_request.postpone()
	check(not app.gift_request.visible and app.gift_reserve.has("galaxy-order"), "postponing never accepts")
	app.army_cards.komutan.get_node("Row/ApproveGift").pressed.emit()
	check(app.gift_request.visible, "reopen deferred request from sender row")
	app.gift_request.confirm.pressed.emit()
	check(not app.gift_request.visible and app.pending_surrounding.has("komutan"), "only explicit central confirmation arms the attack")
	for word in ["KATIL", "Katıl", "katıl", "KATİL", "!katil", " KaTıl "]:
		check(app.is_join_command(word), "case-insensitive join " + word)
	app.queue_free()
	await create_timer(0.6).timeout
	if failures == 0:
		print("FETIH_HELD_GIFTS_OK")
	quit(0 if failures == 0 else 1)
