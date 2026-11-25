extends SceneTree


func _initialize() -> void:
	run.call_deferred()


func run() -> void:
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not profile.get_file().begins_with("live-proof-") or "--self-test" not in OS.get_cmdline_user_args():
		quit(1)
		return
	var username := ""
	var observation_seconds := 45
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--live-account="):
			username = arg.trim_prefix("--live-account=").trim_prefix("@")
		elif arg.begins_with("--observe-seconds="):
			observation_seconds = clampi(int(arg.trim_prefix("--observe-seconds=")), 10, 120)
	if username.is_empty():
		quit(1)
		return
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	var measurement := {"heldGifts": 0, "pollGifts": 0, "armyListRefreshes": 0, "worstPollToRosterMs": 0,
		"likeEvents": 0, "followEvents": 0, "likeAccepted": 0, "followAccepted": 0, "whaleEvents": 0}
	var observed := {}
	app.live.poll.request_completed.connect(func(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray):
		if result != HTTPRequest.RESULT_SUCCESS or code != 200:
			return
		var packet: Variant = JSON.parse_string(body.get_string_from_utf8())
		if not packet is Dictionary:
			return
		var pending := {}
		for row: Variant in packet.get("events", []):
			if not row is Dictionary or not row.get("value") is Dictionary:
				continue
			var event: Dictionary = row.value
			var seq := int(row.get("seq", 0))
			if seq > app.live.cursor or observed.has(seq):
				continue
			observed[seq] = true
			var kind := str(event.get("type", ""))
			if kind == "like" or kind == "follow":
				measurement[kind + "Events"] += 1
				if app.rules.has_seen_event(str(event.get("eventId", ""))):
					measurement[kind + "Accepted"] += 1
			if kind != "gift":
				continue
			measurement.pollGifts += 1
			if app.gift_reserve.has(str(event.get("eventId", ""))):
				measurement.heldGifts += 1
			if str(event.get("giftId", "")) == "6820":
				measurement.whaleEvents += 1
			var sender := str(event.get("username", ""))
			pending[sender] = true
		if pending.is_empty():
			return
		var started := Time.get_ticks_msec()
		for _frame in 12:
			await process_frame
			if pending.keys().all(func(sender: String) -> bool:
				return app.army_cards.has(sender) and app.army_cards[sender].get_node("Row/ApproveGift").visible):
				measurement.armyListRefreshes += 1
				measurement.worstPollToRosterMs = maxi(measurement.worstPollToRosterMs, Time.get_ticks_msec() - started)
				break)
	app.account.text = username
	await app._connect()
	var connected := false
	var connect_deadline := Time.get_ticks_msec() + 36000
	var observe_deadline := 0
	while true:
		var status := str(app.live.status.get("status", ""))
		if status == "connected" and not connected:
			connected = true
			observe_deadline = Time.get_ticks_msec() + observation_seconds * 1000
			print("FETIH_PREVIEW_CONNECTED")
		if Time.get_ticks_msec() >= (observe_deadline if connected else connect_deadline):
			break
		await create_timer(0.25).timeout
	print("FETIH_PREVIEW_LIVE: " + JSON.stringify({"connected": connected,
		"status": app.live.status.get("status", ""),
		"giftEvents": app.accepted_live_counts.gift, "chatEvents": app.accepted_live_counts.chat, "measurement": measurement,
		"armies": app.rules.view_state().participants.size()}))
	app.live.set_process(false)
	if not app.live.url.is_empty():
		await app.live.request_json("/disconnect", {})
	app.queue_free()
	await process_frame
	quit(0 if connected else 2)
