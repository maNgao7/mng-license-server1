extends CenterContainer

var app: Node
var receipt := ""
var deferred_requests := {}
var caption: Label
var description: Label
var confirm: Button
var chime := AudioStreamPlayer.new()
var last_chime := -3000

func setup(owner_app: Node) -> void:
	app = owner_app
	app.ui.add_child(self)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	z_index = 12
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 400
	panel.add_theme_stylebox_override("panel", app.box_style(Color("#1b2933"), Color("#efa85c"), 12))
	add_child(panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 10)
	panel.add_child(stack)
	caption = app.text(stack, "", 20, app.GOLD)
	description = app.text(stack, "", 16, app.WHITE)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_END
	stack.add_child(actions)
	app.button(actions, "Daha sonra", postpone)
	confirm = app.button(actions, "Onayla", approve, true)
	add_child(chime)
	chime.stream = preload("../assets/audio/gift-request.wav")
	chime.volume_db = -9.0
	hide()

func sync(requests: Dictionary) -> void:
	for key in deferred_requests.keys():
		if not requests.has(key):
			deferred_requests.erase(key)
	if visible and requests.has(receipt):
		return
	hide()
	receipt = ""
	for key in requests:
		if requests[key].action in ["surrounding", "missile"] and not deferred_requests.has(key):
			show_request(key, requests[key])
			return

func show_request(key: String, item: Dictionary) -> void:
	receipt = key
	caption.text = "Saldırı isteği"
	var who: String = item.grant.username
	var action := "her yere füze saldırısı yapmak" if item.action == "missile" else "her yere saldırmak"
	description.text = "@%s %s istiyor." % [who, action]
	if not str(item.get("giftName", "")).is_empty():
		description.text += "\nHediye: %s" % item.giftName
	if app.rules.get_participant(who).get("regions", []).is_empty():
		description.text += "\nOnaydan sonra orduyu haritaya yerleştir."
	show()
	var now := Time.get_ticks_msec()
	if now - last_chime >= 2200:
		chime.play()
		last_chime = now

func postpone() -> void:
	deferred_requests[receipt] = true
	hide()
	sync(app.gift_reserve)

func approve() -> void:
	var selected := receipt
	receipt = ""
	hide()
	app._approve_attack_request(selected)
