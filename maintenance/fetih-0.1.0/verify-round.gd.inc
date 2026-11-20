func _verify_standalone_reset() -> bool:
	var effects: Dictionary = canvas.native_attack.debug_state()
	if rules.round_phase() != "running" or not effects.ready or not effects.battle_audio_ready:
		return false
	if effects.native_frame_count != 15 or effects.battle_count < 1:
		return false
	var pending := {"eventId": "qa-pending", "type": "gift", "username": "qa_pending",
		"giftCoinValue": 1, "repeatCount": 1}
	if not accept_live_event(pending):
		return false
	var troops: int = rules.get_participant("qa_pending").troops
	if troops != 50 or not accept_live_event(pending) or rules.get_participant("qa_pending").troops != troops:
		return false
	finish_button.pressed.emit()
	if rules.round_phase() != "results" or not victory_scene.visible:
		return false
	for region in rules.view_state().regions:
		if not region.ownerId.is_empty():
			return false
	var follow := {"eventId": "qa-follow", "type": "follow", "username": "qa_follower"}
	if not accept_live_event(follow) or not accept_live_event(follow):
		return false
	var follower: Dictionary = rules.get_participant("qa_follower")
	if follower.nextTroops != 100 or follower.nextBonusJets != 1:
		return false
	var music: AudioStreamPlayer = victory_scene.get("music")
	var voice: AudioStreamPlayer = victory_scene.get("voice")
	if music.stream == null or voice.stream == null:
		return false
	victory_scene.dismiss()
	_confirm_reset()
	var confirm: ConfirmationDialog = ui.get_child(ui.get_child_count() - 1)
	confirm.confirmed.emit()
	confirm.hide()
	var result: Dictionary = rules.view_state()
	if result.phase != "staging" or not result.battles.is_empty() or "qa_pending" not in result.pending:
		return false
	var next_follower: Dictionary = rules.get_participant("qa_follower")
	if next_follower.troops != 100 or next_follower.bonusJets != 1:
		return false
	for region in result.regions:
		if not region.ownerId.is_empty():
			return false
	if not accept_live_event(pending) or rules.get_participant("qa_pending").troops != troops:
		return false
	_open_broadcast_guide()
	if broadcast_guide.title != "TikMnG · Görsellerle yayın kurulumu" or not FileAccess.file_exists(gift_design_source()):
		return false
	if broadcast_guide.source_images.size() != 3 or not FileAccess.file_exists(broadcast_guide.video_source()):
		return false
	for picture: Texture2D in broadcast_guide.source_images:
		if picture == null:
			return false
	for index in 3:
		broadcast_guide.step_buttons[index].pressed.emit()
		if broadcast_guide.preview.texture != broadcast_guide.source_images[index]:
			return false
	var exported := profile_dir.path_join("verified-muted-clip.mp4")
	broadcast_guide._export_video(exported)
	if FileAccess.get_sha256(exported) != FileAccess.get_sha256(broadcast_guide.video_source()):
		return false
	var gift_exported := profile_dir.path_join("verified-gift-design.png")
	if DirAccess.copy_absolute(gift_design_source(), gift_exported) != OK or FileAccess.get_sha256(gift_exported) != FileAccess.get_sha256(gift_design_source()):
		return false
	broadcast_guide.hide()
	print("FETIH_PACKAGED_GUIDE_OK: actual screenshots, cover and byte-matched muted download")
	return true

