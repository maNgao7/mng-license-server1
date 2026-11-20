extends SceneTree

func _initialize() -> void:
	check_maps.call_deferred()

func check_maps() -> void:
	if OS.get_environment("TIKMNG_ANIMAL_PROFILE").is_empty() or "--self-test" not in OS.get_cmdline_user_args():
		quit(1)
		return
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	if app.map_id != "turkiye" or app.map_picker.item_count != 2 or app.canvas.regions.size() != 15:
		fail("Türkiye varsayılanı veya harita seçicisi eksik")
		return
	var gift := {"eventId": "map-qa-gift", "type": "gift", "username": "atlas_qa", "giftCoinValue": 2, "repeatCount": 1}
	if not app.accept_live_event(gift) or app.rules.get_participant("atlas_qa").get("troops", 0) != 100:
		fail("Türkiye turu hazırlanamadı")
		return
	if not app._switch_map("world") or app.canvas.regions.size() != 34 or not app.rules.get_participant("atlas_qa").is_empty():
		fail("Dünya haritası boş ve 34 bölgeyle açılmalı")
		return
	await RenderingServer.frame_post_draw
	var shot := OS.get_environment("MNG_QA_WORLD_CAPTURE")
	if not shot.is_empty():
		root.get_texture().get_image().save_png(shot)
	if not app.accept_live_event(gift) or not app.rules.get_participant("atlas_qa").is_empty():
		fail("Harita değişikliği yinelenen hediyeyi ödüllendirdi")
		return
	if not app._switch_map("turkiye") or app.rules.get_participant("atlas_qa").get("troops", 0) != 100:
		fail("Türkiye turu korunmadı")
		return
	app.queue_free()
	await process_frame
	print("FETIH_STANDALONE_MAPS_OK")
	quit()

func fail(message: String) -> void:
	push_error(message)
	quit(1)
