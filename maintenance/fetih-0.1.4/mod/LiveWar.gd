extends Node

const BG := Color("#101b24")
const SURFACE := Color("#1b2a35")
const GOLD := Color("#f2c66a")
const WHITE := Color("#fff3d8")
const MUTED := Color("#9eb0b9")
const WAR_RULES = preload("WarRules.gd")
const WINDOW_PLACEMENT = preload("WindowPlacement.gd")
const MAP_IDS := ["turkiye", "world"]
const MAP_LABELS := {"turkiye": "Türkiye", "world": "Dünya"}
const DEFAULT_COMBAT_SECONDS := 36.0
const DEFAULT_TERRITORY_TROOPS := 3000
const COMBAT_PACING_VERSION := 2
const COUNTRY_VICTORY = preload("CountryVictory.gd")
const GIFT_ACTIONS = preload("GiftActions.gd")
const GIFT_PLAYTEST = preload("GiftPlaytest.gd")
const LIVE_CLIENT = preload("LiveClient.gd")
const LEADERS_PORT := 32188
const CONQUEST_SECONDS := 10.0
const BREAK_SIEGE_COINS := 100
const AIR_SHOW_COOLDOWN_MS := 12000
const PALETTE := [Color("#69b9ad"), Color("#e28c79"), Color("#91a9dc"), Color("#e4bc65"), Color("#b594c9"), Color("#a6be76"), Color("#79b8d5"), Color("#dd95b4")]

var mod_root := ""
var profile_dir := ""
var map_id := "turkiye"
var rules: RefCounted
var live: Node
var canvas: Control
var gift_test: Node
var map_frame: VBoxContainer
var map_picker: OptionButton
var sidebar: PanelContainer
var sidebar_toggle: Button
var top_bar: PanelContainer
var map_footer: PanelContainer
var map_only := false
var sidebar_open := true
var commands_open := true
var command_toggle: Button
var broadcast_guide: AcceptDialog
var file_downloads = preload("UserDownloads.gd")
var ui := Control.new()
var selected_player := ""
var selected_target := ""
var inspected_player := ""
var root_layout := VBoxContainer.new()
var roster := VBoxContainer.new()
var roster_empty: Label
var summary: Label
var reset_roster_button: Button
var connection_label: Label
var detail: Label
var detail_name: Label
var detail_units: Label
var detail_panel: PanelContainer
var detail_portrait := TextureRect.new()
var notify_label: Label
var finish_button: Button
var pause_button: Button
var battle_speed_label: Label
var battle_speed := 1.0
var attack_button: Button
var jet_button: Button
var target_picker := OptionButton.new()
var account := LineEdit.new()
var dialog := AcceptDialog.new()
var gift_dialog: AcceptDialog
var war_notice: Control
var war_notice_host: Control
var outcome_layer: CanvasLayer
var state: Dictionary = {}
var settings := {"schemaVersion": 1, "soldiersPerCoin": 50, "battleSeconds": DEFAULT_COMBAT_SECONDS,
	"battlePacingVersion": COMBAT_PACING_VERSION,
	"headquartersTroops": DEFAULT_TERRITORY_TROOPS, "username": "",
	"giftActionsVersion": GIFT_ACTIONS.DEFAULT_ACTIONS_VERSION, "giftActions": GIFT_ACTIONS.DEFAULT_ACTIONS.duplicate(true),
	"engagementActions": WAR_RULES.DEFAULT_ENGAGEMENT_ACTIONS.duplicate(true)}
var avatars: Dictionary = {}
var army_cards: Dictionary = {}
var avatar_waiting: Dictionary = {}
var avatar_quality: Dictionary = {}
var avatar_next_check: Dictionary = {}
var avatar_write_queue: Dictionary = {}
var avatar_write_job := -1
var avatar_retry_step: Dictionary = {}
var avatar_announced: Dictionary = {}
var avatar_icons: Dictionary = {}
var avatar_cursor := 0
var avatar_cache_serial := 0
const AVATAR_GOOD_SHORT_SIDE := 750
const AVATAR_UPGRADE_SECONDS := 90.0
const AVATAR_RETRY_DELAYS := [0.8, 1.6, 3.2, 6.4, 15.0, 30.0]
const AVATAR_MAX_REQUESTS := 2
const AVATAR_MAX_PIXELS := 16777216
var prices: Dictionary = {}
var unknown_gifts: Dictionary = {}
var processed_chat: Dictionary = {}
var battle_routes: Dictionary = {}
var surrounding_orders: Dictionary = {}
var pending_surrounding: Dictionary = {}
var pending_missiles: Dictionary = {}
var active_missile: Dictionary = {}
var missile_effect: Node3D
var missile_audio: Node
var missile_checkpoint_due := false
var missile_retry_left := 0.0
var air_show_account := ""
var air_show_command := ""
var air_show_available_at := 0
var attack_requests: Dictionary = {}
var attack_request_number := 0
var surrounding_check_left := 0.0
var map_worlds: Dictionary = {}
var country_leaders: Dictionary = {}
var victory_scene: Control
var conquest_overlay: Control
var conquest_owner := ""
var conquest_left := CONQUEST_SECONDS
var headquarters_pulses: Dictionary = {}
var leaders_pid := -1
var leaders_port := LEADERS_PORT
var leaders_button: Button
var armies_button: Button
var widget_elapsed := 0.0
var widget_rows := ""
var inactive_gift_receipts: Dictionary = {}
var inactive_chat_receipts: Dictionary = {}
var factory_save_left := 10.0
var ui_font: Font
var refresh_left := 0.0
var conquest_retry_left := 0.0
var notice_left := 0.0
var avatar_left := 0.0
var dirty := true
var test_mode := false
var qa_mode := false
var qa_capture := ""
var accepted_live_counts := {"gift": 0, "chat": 0, "other": 0}

func _ready() -> void:
	test_mode = "--self-test" in OS.get_cmdline_user_args()
	qa_mode = "--qa-scene" in OS.get_cmdline_user_args()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--qa-output="):
			qa_capture = arg.trim_prefix("--qa-output=")
		elif arg.begins_with("--map="):
			var requested := arg.trim_prefix("--map=")
			if requested in MAP_IDS:
				map_id = requested
	profile_dir = WINDOW_PLACEMENT.profile_directory(mod_root)
	DirAccess.make_dir_recursive_absolute(profile_dir)
	var air_show_config := profile_dir.path_join("air-show-account.txt")
	if FileAccess.file_exists(air_show_config):
		air_show_account = FileAccess.get_file_as_string(air_show_config).strip_edges().trim_prefix("@").to_lower()
	var air_show_command_path := profile_dir.path_join("air-show-command.txt")
	if FileAccess.file_exists(air_show_command_path):
		air_show_command = FileAccess.get_file_as_string(air_show_command_path).strip_edges()
	_read_settings()
	_read_prices()
	_setup_window()
	_make_ui()
	if not _make_map():
		push_error("Harita yüklenemedi: " + map_id)
		get_tree().quit(1)
		return
	_read_state()
	_read_avatar_cache()
	live = LIVE_CLIENT.new()
	add_child(live)
	live.setup(self)
	live.status_changed.connect(_live_status)
	_refresh()
	if not qa_mode and not test_mode and not state.participants.is_empty():
		live.ensure_started()
	get_window().close_requested.connect(_close)
	get_window().focus_exited.connect(_set_battle_boost.bind(false))
	if qa_mode:
		_run_qa.call_deferred()
	print("ANIMAL_LIVE_READY: %s map, %d regions, publisher attacks, saved settings" % [map_id, canvas.regions.size()])

func _setup_window() -> void:
	var window := get_window()
	window.title = "TikMnG · FETİH"
	if "--local-preview" in OS.get_cmdline_user_args():
		window.title += " · Yerel Test"
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	window.content_scale_size = Vector2i.ZERO
	WINDOW_PLACEMENT.restore(window, profile_dir)
	Engine.max_fps = 60

func box_style(color: Color, edge: Color = Color.TRANSPARENT, radius: int = 10) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = edge
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style

func text(parent: Node, value: String, font_size: int, color: Color = WHITE) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", font_size)
	if ui_font != null:
		label.add_theme_font_override("font", ui_font)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label

func button(parent: Node, value: String, action: Callable, primary: bool = false) -> Button:
	var control := Button.new()
	control.text = value
	control.custom_minimum_size.y = 39
	control.add_theme_font_size_override("font_size", 15)
	if ui_font != null:
		control.add_theme_font_override("font", ui_font)
	control.add_theme_color_override("font_color", BG if primary else WHITE)
	control.add_theme_color_override("font_hover_color", BG if primary else WHITE)
	control.add_theme_stylebox_override("normal", box_style(GOLD if primary else SURFACE, Color("#34434c"), 8))
	control.add_theme_stylebox_override("hover", box_style(GOLD.lightened(0.1) if primary else Color("#2b414e"), GOLD.darkened(0.4), 8))
	control.add_theme_stylebox_override("pressed", box_style(GOLD.darkened(0.12), GOLD, 8))
	control.add_theme_stylebox_override("disabled", box_style(Color("#26343c"), Color("#34434c"), 8))
	control.add_theme_color_override("font_disabled_color", Color("#70818b"))
	control.pressed.connect(action)
	parent.add_child(control)
	return control

func _make_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	layer.add_child(ui)
	var clean_theme := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Segoe UI", "Arial", "Noto Sans"])
	ui_font = font
	clean_theme.default_font = font
	clean_theme.default_font_size = 15
	for type_name in ["Label", "Button", "LineEdit", "OptionButton", "PopupMenu", "SpinBox"]:
		clean_theme.set_font("font", type_name, font)
	ui.theme = clean_theme
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var background := ColorRect.new()
	background.color = BG
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(background)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.add_child(root_layout)
	root_layout.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root_layout.add_theme_constant_override("separation", 0)
	var top := PanelContainer.new()
	top_bar = top
	top.add_theme_stylebox_override("panel", box_style(Color("#14232d"), Color("#334149"), 0))
	root_layout.add_child(top)
	var toolbar_stack := VBoxContainer.new()
	toolbar_stack.add_theme_constant_override("separation", 5)
	top.add_child(toolbar_stack)
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 7)
	toolbar_stack.add_child(bar)
	var left := HBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(left)
	var brand := text(left, "TİKMNG / FETİH", 15, GOLD)
	brand.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	button(left, "Kurallar", _show_rules)
	button(left, "Yeni tur", _confirm_reset)
	var center := HBoxContainer.new()
	bar.add_child(center)
	pause_button = button(center, "Ⅱ  Duraklat", _pause)
	finish_button = button(center, "Savaşı bitir", _finish_round, true)
	battle_speed_label = text(center, "H · 1×", 14, GOLD)
	battle_speed_label.name = "BattleSpeed"
	battle_speed_label.custom_minimum_size.x = 70.0
	battle_speed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	battle_speed_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	battle_speed_label.mouse_filter = Control.MOUSE_FILTER_STOP
	battle_speed_label.tooltip_text = "H’yi basılı tut: 3×. Bırak: 1×."
	var right := HBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.alignment = BoxContainer.ALIGNMENT_END
	bar.add_child(right)
	button(right, "B · Eylemler", _open_actions)
	leaders_button = button(right, "Ülke Liderleri (Widget bağlantısı)", _copy_leaders_link, true)
	leaders_button.name = "CountryLeadersLink"
	leaders_button.tooltip_text = "Ülke Liderleri için OBS tarayıcı kaynağı bağlantısını kopyala."
	button(right, "⚙  Ayarlar", _settings_dialog)
	var angle := button(right, "+", _open_camera_angle)
	angle.name = "CameraAngle"
	angle.tooltip_text = "Harita görüş açısını ayarla"
	for group in [left, center, right]:
		for child in group.get_children():
			if child is Button:
				child.add_theme_font_size_override("font_size", 14)
	var flank_width := maxf(left.get_combined_minimum_size().x, right.get_combined_minimum_size().x)
	left.custom_minimum_size.x = flank_width
	right.custom_minimum_size.x = flank_width
	var resources := HBoxContainer.new()
	resources.alignment = BoxContainer.ALIGNMENT_END
	toolbar_stack.add_child(resources)
	armies_button = button(resources, "Ordu Sıralaması · Widget", _copy_widget_link.bind("fetih-ordular"), true)
	armies_button.name = "ArmyStandingsLink"
	armies_button.add_theme_font_size_override("font_size", 14)
	button(resources, "İhlal riskini azaltma rehberi", _open_broadcast_guide, true)
	var gift_download := button(resources, "Hazır hediye görseli indir", _download_gift_design, true)
	gift_download.name = "GiftDesignDownload"
	gift_download.add_theme_font_size_override("font_size", 14)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 0)
	root_layout.add_child(body)
	sidebar = PanelContainer.new()
	sidebar.custom_minimum_size.x = 374
	sidebar.add_theme_stylebox_override("panel", box_style(Color("#14212b"), Color("#334149"), 0))
	body.add_child(sidebar)
	sidebar_toggle = button(ui, "‹", _toggle_sidebar)
	sidebar_toggle.name = "SidebarHandle"
	sidebar_toggle.custom_minimum_size = Vector2(29, 68)
	sidebar_toggle.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	sidebar_toggle.tooltip_text = "Sol ordu listesini aç veya kapat."
	sidebar_toggle.add_theme_font_size_override("font_size", 14)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 6)
	sidebar.add_child(stack)
	text(stack, "HARİTAYI DEĞİŞTİR", 11, GOLD)
	map_picker = OptionButton.new()
	map_picker.name = "MapSelector"
	map_picker.custom_minimum_size.y = 36
	map_picker.tooltip_text = "Haritayı değiştir. Her haritanın turu ayrı kaydedilir."
	_style_map_picker()
	for id in MAP_IDS:
		map_picker.add_item("Türkiye · Varsayılan" if id == "turkiye" else MAP_LABELS[id])
	map_picker.select(MAP_IDS.find(map_id))
	map_picker.item_selected.connect(_select_map)
	stack.add_child(map_picker)
	var connection := HBoxContainer.new()
	stack.add_child(connection)
	account.placeholder_text = "@yayıncı kullanıcı adı"
	account.text = str(settings.username)
	account.add_theme_font_override("font", ui_font)
	account.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	account.add_theme_stylebox_override("normal", box_style(Color("#0d1820"), Color("#344956"), 7))
	connection.add_child(account)
	button(connection, "Bağlan", _connect, true)
	connection_label = text(stack, "●  Yayına bağlı değil", 12, MUTED)
	connection_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var roster_header := HBoxContainer.new()
	stack.add_child(roster_header)
	summary = text(roster_header, "Ordular · 0", 14, GOLD)
	summary.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	summary.mouse_filter = Control.MOUSE_FILTER_STOP
	reset_roster_button = button(roster_header, "Sıfırla", _reset_roster)
	reset_roster_button.custom_minimum_size.y = 32
	reset_roster_button.tooltip_text = "Listedeki orduları ve haritadaki birliklerini temizler. Yayın bağlantısı, hediyeler ve ayarlar korunur."
	var scroll := ScrollContainer.new()
	scroll.name = "ArmyRosterScroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	stack.add_child(scroll)
	roster.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	roster.add_theme_constant_override("separation", 4)
	scroll.add_child(roster)
	roster_empty = text(roster, "Sohbete katıl yazanlar burada görünür.", 13, MUTED)
	detail_panel = PanelContainer.new()
	detail_panel.hide()
	stack.add_child(detail_panel)
	var details := VBoxContainer.new()
	details.add_theme_constant_override("separation", 5)
	detail_panel.add_child(details)
	var selected_info := HBoxContainer.new()
	details.add_child(selected_info)
	detail_portrait.custom_minimum_size = Vector2(38, 38)
	detail_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	detail_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	detail_portrait.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	detail_portrait.hide()
	selected_info.add_child(detail_portrait)
	var selected_text := VBoxContainer.new()
	selected_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selected_text.alignment = BoxContainer.ALIGNMENT_CENTER
	selected_text.add_theme_constant_override("separation", 0)
	selected_info.add_child(selected_text)
	detail_name = text(selected_text, "", 14, WHITE)
	detail_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	detail = text(selected_text, "", 14, GOLD)
	detail.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	detail.mouse_filter = Control.MOUSE_FILTER_PASS
	var close_details := button(selected_info, "×", close_army_details)
	close_details.tooltip_text = "Ordu bilgilerini kapat"
	close_details.custom_minimum_size.y = 30
	detail_units = text(details, "", 13, WHITE)
	detail_units.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var attack_options := HBoxContainer.new()
	attack_options.add_theme_constant_override("separation", 5)
	details.add_child(attack_options)
	target_picker.custom_minimum_size.y = 36
	target_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	target_picker.fit_to_longest_item = false
	target_picker.add_theme_font_override("font", ui_font)
	target_picker.add_theme_stylebox_override("normal", box_style(SURFACE, Color("#344956"), 7))
	target_picker.add_theme_color_override("font_color", WHITE)
	target_picker.get_popup().add_theme_font_override("font", ui_font)
	target_picker.item_selected.connect(_pick_target)
	attack_options.add_child(target_picker)
	jet_button = button(attack_options, "Jet ekle", _grant_selected_jet)
	jet_button.custom_minimum_size.y = 36
	jet_button.hide()
	attack_button = button(details, "Seçili hedefe saldır", _publisher_attack, true)
	attack_button.tooltip_text = "Doğrudan saldırmak için ordunu rakip bölgeye sürükle."
	map_frame = VBoxContainer.new()
	map_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map_frame.add_theme_constant_override("separation", 0)
	body.add_child(map_frame)
	map_footer = PanelContainer.new()
	map_footer.add_theme_stylebox_override("panel", box_style(Color("#14232d"), Color("#334149"), 0))
	map_frame.add_child(map_footer)
	var tools := HBoxContainer.new()
	map_footer.add_child(tools)
	notify_label = text(tools, "Hediyeler asker kazandırır. Orduları yerleştir; savaşı sen başlat.", 13, MUTED)
	notify_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	notify_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	map_footer.hide()
	map_footer.reparent(ui)
	map_footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	map_footer.offset_left = 390.0
	map_footer.offset_top = -58.0
	map_footer.offset_right = 1080.0
	map_footer.offset_bottom = -14.0
	# Reserve the command bar's height so every fitted region remains clickable.
	top_bar.show()
	command_toggle = button(ui, "▴", _toggle_command_bar)
	command_toggle.name = "CommandBarHandle"
	command_toggle.custom_minimum_size = Vector2(56, 24)
	command_toggle.add_theme_font_override("font", ui_font)
	command_toggle.tooltip_text = "Üst menüyü aç veya kapat."
	ui.move_child(sidebar_toggle, ui.get_child_count() - 1)
	_update_sidebar_handle()
	_update_command_bar(0.0, Vector2.ZERO)
	ui.add_child(dialog)
	dialog.min_size = Vector2i(460, 260)
	dialog.title = "Fetih · Ayarlar"
	gift_test = GIFT_PLAYTEST.new()
	add_child(gift_test)
	gift_test.configure(self)

func _style_map_picker() -> void:
	var edge := Color("#586d7c")
	var hovered := Color("#314759")
	map_picker.add_theme_stylebox_override("normal", box_style(Color("#192b38"), edge, 8))
	map_picker.add_theme_stylebox_override("hover", box_style(hovered, edge, 8))
	map_picker.add_theme_stylebox_override("pressed", box_style(hovered, GOLD, 8))
	map_picker.add_theme_stylebox_override("focus", box_style(Color.TRANSPARENT, GOLD, 8))
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		map_picker.add_theme_color_override(color_name, WHITE)
	map_picker.add_theme_constant_override("modulate_arrow", 1)
	var popup := map_picker.get_popup()
	popup.add_theme_stylebox_override("panel", box_style(Color("#192b38"), edge, 8))
	popup.add_theme_stylebox_override("hover", box_style(hovered, Color.TRANSPARENT, 5))
	popup.add_theme_color_override("font_color", WHITE)
	popup.add_theme_color_override("font_hover_color", WHITE)
	popup.add_theme_color_override("font_disabled_color", MUTED)
	popup.add_theme_constant_override("v_separation", 10)


func _toggle_sidebar() -> void:
	sidebar_open = not sidebar_open
	sidebar.visible = sidebar_open and not map_only
	_update_sidebar_handle()

func _update_sidebar_handle() -> void:
	sidebar_toggle.text = "‹" if sidebar_open else "›"
	var handle_position := Vector2(sidebar.size.x if sidebar.visible else 0.0, ui.size.y * 0.5 - 34.0)
	if sidebar_toggle.position != handle_position:
		sidebar_toggle.position = handle_position
	sidebar_toggle.size = Vector2(29, 68)
	sidebar_toggle.visible = not map_only

func _toggle_command_bar() -> void:
	commands_open = not commands_open
	_update_command_bar(0.0, Vector2.ZERO)

func _update_command_bar(_delta: float, _cursor: Vector2) -> void:
	_update_sidebar_handle()
	if command_toggle == null:
		return
	top_bar.visible = commands_open and not map_only
	command_toggle.visible = not map_only
	command_toggle.text = "▴" if commands_open else "▾"
	command_toggle.position = Vector2(ui.size.x * 0.5 - 28.0, top_bar.size.y if top_bar.visible else 0.0)
	command_toggle.size = Vector2(56, 24)

func gift_design_source() -> String:
	return preload("InstallPaths.gd").bridge_directory().path_join("assets/guides/ready-gift-design.png")

func _download_gift_design() -> void:
	var result: Dictionary = file_downloads.copy_asset(gift_design_source(),
		"TikMnG-hazir-hediye-gorseli.png", OS.SYSTEM_DIR_DOWNLOADS)
	notice("Hediye görseli İndirilenler'e kaydedildi." if result.ok else "Görsel kaydedilemedi: " + result.error)

func _open_broadcast_guide() -> void:
	if not is_instance_valid(broadcast_guide):
		broadcast_guide = load(mod_root.path_join("BroadcastGuide.gd")).new()
		ui.add_child(broadcast_guide)
		broadcast_guide.configure(self)
	broadcast_guide.popup_centered_clamped(Vector2i(1000, 650), 0.94)


func _toggle_map_only() -> void:
	map_only = not map_only
	top_bar.visible = not map_only and commands_open
	map_footer.hide()
	sidebar.visible = not map_only and sidebar_open
	_update_sidebar_handle()
	_update_command_bar(0.0, Vector2.ZERO)
	canvas.map_hud.cancel_region_action()
	canvas.map_hud.visible = not map_only
	canvas.territory_surface.set_markers_visible(not map_only)
	war_notice_host.visible = not map_only
	outcome_layer.visible = not map_only

func _make_map() -> bool:
	var builder: Script = preload("WorldMap.gd") if map_id == "world" else preload("TurkiyeMap.gd")
	var built: Dictionary = builder.new().build()
	var map: Node2D = built.get("map")
	var territories: Array[Node] = []
	territories.assign(built.get("territories", []))
	if map == null:
		return false
	if territories.is_empty():
		map.free()
		return false
	var next_canvas: Control = load(mod_root.path_join("PerspectiveMap.gd")).new()
	var previous := canvas
	canvas = next_canvas
	canvas.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	map_frame.add_child(canvas)
	map_frame.move_child(canvas, 0)
	canvas.configure(self, map, territories)
	if settings.has("cameraTilt"):
		canvas.set_view_tilt(float(settings.cameraTilt))
	if canvas.regions.is_empty():
		canvas.free()
		canvas = previous
		return false
	rules = WAR_RULES.new(canvas.regions.size(), false, _uses_soldier_aviation())
	_apply_rules_settings()
	var effects: Node2D = load(mod_root.path_join("MapEffects.gd")).new()
	effects.map_canvas = canvas
	canvas.world.add_child(effects)
	_cancel_missile()
	missile_effect = load(mod_root.path_join("MissileSalvo.gd")).new()
	canvas.stage_view.add_child(missile_effect)
	missile_effect.setup(canvas)
	missile_effect.impact.connect(_on_missile_impact)
	missile_effect.finished.connect(func() -> void: active_missile.clear())
	if missile_audio == null:
		missile_audio = load(mod_root.path_join("MissileAudio.gd")).new()
		add_child(missile_audio)
	if is_instance_valid(previous):
		previous.get_parent().remove_child(previous)
		previous.queue_free()
	if is_instance_valid(war_notice):
		war_notice.free()
	if not is_instance_valid(war_notice_host):
		war_notice_host = Control.new()
		war_notice_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ui.add_child(war_notice_host)
		war_notice_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	war_notice = load(mod_root.path_join("WarNotice.gd")).new()
	war_notice_host.add_child(war_notice)
	war_notice.configure(self, canvas)
	if victory_scene == null:
		outcome_layer = CanvasLayer.new()
		outcome_layer.layer = 12
		add_child(outcome_layer)
		victory_scene = COUNTRY_VICTORY.new()
		outcome_layer.add_child(victory_scene)
		victory_scene.configure(self)
		victory_scene.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		var countdown_script: Script = load(mod_root.path_join("CountryCountdown.gd"))
		if countdown_script != null:
			conquest_overlay = countdown_script.new()
			outcome_layer.add_child(conquest_overlay)
			conquest_overlay.configure(self)
			conquest_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return true

func _select_map(index: int) -> void:
	var requested: String = MAP_IDS[index]
	map_picker.select(MAP_IDS.find(map_id))
	if requested == map_id:
		return
	var confirm := ConfirmationDialog.new()
	confirm.title = "Haritayı değiştir"
	confirm.dialog_text = "%s haritası açılsın mı?\nBu haritadaki tur kaydedilir. Açık savaş, geri döndüğünde duraklatılmış olur." % MAP_LABELS[requested]
	ui.add_child(confirm)
	confirm.confirmed.connect(func() -> void:
		_switch_map(requested)
		confirm.queue_free()
	)
	confirm.canceled.connect(confirm.queue_free)
	confirm.popup_centered()

func _switch_map(requested: String) -> bool:
	if gift_test.is_active():
		notice("Haritayı değiştirmek için hediye testini bitir.")
		return false
	if requested == map_id or requested not in MAP_IDS:
		return false
	if not _save_state():
		notice("Mevcut tur kaydedilemedi. Harita değiştirilmedi.")
		return false
	var previous_id := map_id
	map_id = requested
	if not _make_map():
		map_id = previous_id
		notice("Harita yüklenemedi: " + MAP_LABELS[requested])
		return false
	victory_scene.dismiss()
	selected_player = ""
	selected_target = ""
	factory_save_left = 10.0
	_restore_map_state()
	_read_avatar_cache()
	map_picker.select(MAP_IDS.find(map_id))
	_refresh()
	notice("%s haritası açıldı." % MAP_LABELS[map_id])
	return true

func _process(delta: float) -> void:
	if ui.is_inside_tree() and sidebar_toggle != null:
		_update_command_bar(delta, ui.get_local_mouse_position())
	if rules == null:
		return
	if leaders_pid > 0 and not gift_test.is_active():
		widget_elapsed -= delta
		if widget_elapsed <= 0.0:
			widget_elapsed = 2.0
			_update_army_widget()
	if is_inside_tree():
		WINDOW_PLACEMENT.remember(get_window())
	if not conquest_owner.is_empty() and rules.round_phase() == "running":
		_advance_conquest(delta)
	var results: Array = rules.tick(delta, battle_speed)
	for region in rules.consume_headquarters_ticks():
		headquarters_pulses[region] = int(headquarters_pulses.get(region, 0)) + 1
	if rules.consume_factory_update():
		dirty = true
	for result in results:
		battle_routes.erase(str(result.battleId))
		if result.tie:
			notice("Savaş berabere bitti. İki tarafın ordusu da tükendi.")
		else:
			if canvas != null:
				canvas.military.show_defeat(str(result.loserId), result.transferredRegions)
				var surface: Node = canvas.get("territory_surface")
				if surface != null:
					for region in result.get("destroyedHeadquarters", []):
						surface.show_headquarters_destruction(int(region))
			var winner := player_view(str(result.winnerId))
			notice("#%d %s kazandı · %s asker kaldı" % [winner.number, winner.nickname, amount(result.survivors)])
		dirty = true
	if not results.is_empty():
		_save_state()
	if (not pending_surrounding.is_empty() or not surrounding_orders.is_empty()) and rules.round_phase() in ["staging", "running"]:
		surrounding_check_left -= delta
		if surrounding_check_left <= 0.0:
			surrounding_check_left = 0.30
			var engaged := _engaged_armies()
			for actor in surrounding_orders.keys():
				_advance_surrounding_attack(actor, engaged)
			for actor in pending_surrounding.keys():
				_try_gift_surrounding(actor)
	if missile_checkpoint_due or not pending_missiles.is_empty():
		_advance_missiles(delta)
	if state.get("phase") == "running":
		factory_save_left -= delta
		if factory_save_left <= 0.0:
			factory_save_left = 10.0
			for participant in state.participants:
				var units := unit_counts(participant.id)
				if int(units.get("factories", 0)) + int(units.get("headquarters", 0)) > 0:
					_save_state()
					break
	refresh_left -= delta
	if dirty and refresh_left <= 0.0:
		refresh_left = 0.3
		_refresh()
	elif refresh_left <= 0.0 and state.get("phase") == "running" and not state.battles.is_empty():
		refresh_left = 0.5
		_refresh_armies()
		if detail_panel.visible and not target_picker.get_popup().visible:
			if combat_troops(selected_player) > 0:
				_refresh_army_counts(player_view(selected_player))
			else:
				close_army_details()
	if not gift_test.is_active():
		_refresh_avatar_upgrades(delta)
	_advance_avatar_writes()
	if notice_left > 0.0:
		notice_left -= delta
		if notice_left <= 0.0:
			if map_footer != null:
				map_footer.hide()
			notify_label.text = "Sohbet: hedef numarası + saldır  ·  Yeni hediyeler savaş sürerken de orduya eklenir."

func _refresh() -> void:
	state = rules.view_state()
	var phase: String = state.phase
	finish_button.disabled = phase == "results" or not state.participants.any(
		func(participant: Dictionary) -> bool: return not participant.regions.is_empty())
	pause_button.disabled = phase not in ["running", "paused"]
	pause_button.text = "▶  Devam et" if phase == "paused" else "Ⅱ  Duraklat"
	_refresh_armies()
	_refresh_details()
	dirty = false


func _refresh_armies() -> void:
	summary.tooltip_text = "1 coin = %d asker" % state.soldiersPerCoin
	if _uses_soldier_aviation():
		summary.tooltip_text += "\n150 asker · 1 tank\n300 asker · 1 helikopter\n700 asker · 1 jet"
	var current_ids: Dictionary = {}
	var roster_order: Array[Dictionary] = []
	var troops_by_id := {}
	var battles := battle_views()
	for p in state.participants:
		var troops := int(p.troops) if p.regions.is_empty() else combat_troops(p.id, battles)
		if troops <= 0:
			continue
		current_ids[p.id] = true
		troops_by_id[p.id] = troops
		roster_order.append(p)
	summary.text = "Ordular · %d" % roster_order.size()
	for id in army_cards.keys():
		if not current_ids.has(id):
			var removed: Control = army_cards[id]
			roster.remove_child(removed)
			removed.queue_free()
			army_cards.erase(id)
			attack_requests.erase(id)
	roster_empty.visible = roster_order.is_empty()
	roster_order.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var a_placed: bool = not a.regions.is_empty()
		var b_placed: bool = not b.regions.is_empty()
		if a_placed != b_placed:
			return a_placed
		var request_a := int(attack_requests.get(a.id, 0))
		var request_b := int(attack_requests.get(b.id, 0))
		if request_a != request_b:
			return request_a > request_b
		return troops_by_id[a.id] > troops_by_id[b.id] if troops_by_id[a.id] != troops_by_id[b.id] else a.number < b.number)
	for index in roster_order.size():
		var participant: Dictionary = roster_order[index]
		_make_army_card(participant, troops_by_id[participant.id])
		var card: Control = army_cards[participant.id]
		if card.get_index() != index + 1:
			roster.move_child(card, index + 1)

func _make_army_card(p: Dictionary, troops: int) -> void:
	var card_title := "#%d  %s" % [p.number, display_player_name(p)]
	var troop_label := "%s asker  ·  %s coin" % [amount(troops), amount(p.coinTotal)]
	var location := "Haritaya sürükleyerek yerleştir." if p.regions.is_empty() else "%d bölge" % p.regions.size()
	var card_tooltip := "%s\n@%s  ·  %s" % [card_title, p.username, location]
	var selected: bool = p.id == selected_player
	if army_cards.has(p.id):
		var existing: PanelContainer = army_cards[p.id]
		if existing.get_meta("selected") != selected:
			existing.set_meta("selected", selected)
			existing.add_theme_stylebox_override("panel", _army_card_style(p.id, selected))
		existing.tooltip_text = card_tooltip
		existing.get_node("Row/Info/Name").text = card_title
		existing.get_node("Row/Info/Army").text = troop_label
		existing.get_node("Row/AttackRequest").visible = attack_requests.has(p.id)
		existing.get_node("Row/TerritoryBadge").visible = not p.regions.is_empty()
		var existing_portrait: TextureRect = existing.get_node("Row/Portrait")
		existing_portrait.texture = avatar_for(p.id)
		for child in existing_portrait.get_children():
			child.visible = existing_portrait.texture == null
		return
	var card: PanelContainer = load(mod_root.path_join("ArmyCard.gd")).new()
	card.app = self
	card.player_id = p.id
	card.set_meta("selected", selected)
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	card.tooltip_text = card_tooltip
	card.add_theme_stylebox_override("panel", _army_card_style(p.id, selected))
	roster.add_child(card)
	army_cards[p.id] = card
	var row := HBoxContainer.new()
	row.name = "Row"
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 8)
	card.add_child(row)
	var portrait := TextureRect.new()
	portrait.name = "Portrait"
	portrait.custom_minimum_size = Vector2(60, 60)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	portrait.texture = avatar_for(p.id)
	row.add_child(portrait)
	var fallback := Label.new()
	fallback.text = "#%d" % p.number
	fallback.add_theme_color_override("font_color", player_color(p.id))
	fallback.add_theme_font_size_override("font_size", 16)
	fallback.add_theme_font_override("font", ui_font)
	fallback.mouse_filter = Control.MOUSE_FILTER_IGNORE
	portrait.add_child(fallback)
	fallback.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	fallback.visible = portrait.texture == null
	var info := VBoxContainer.new()
	info.name = "Info"
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	info.add_theme_constant_override("separation", 1)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(info)
	var nickname := text(info, card_title, 17, WHITE)
	nickname.name = "Name"
	nickname.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	nickname.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var army := text(info, troop_label, 14, Color("#eaf3f5"))
	army.name = "Army"
	army.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	army.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var territory_icon: Control = load(mod_root.path_join("ArmyCard.gd")).TerritoryBadge.new()
	territory_icon.name = "TerritoryBadge"
	territory_icon.custom_minimum_size = Vector2(30, 30)
	territory_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	territory_icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	territory_icon.visible = not p.regions.is_empty()
	row.add_child(territory_icon)
	var request := text(row, "SALDIR", 12, Color("#ffd0c6"))
	request.name = "AttackRequest"
	request.mouse_filter = Control.MOUSE_FILTER_IGNORE
	request.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var alert_style := box_style(Color("#6e2b2e"), Color("#d96861"), 6)
	alert_style.content_margin_left = 6
	alert_style.content_margin_right = 6
	alert_style.content_margin_top = 4
	alert_style.content_margin_bottom = 4
	request.add_theme_stylebox_override("normal", alert_style)
	request.visible = attack_requests.has(p.id)

func _army_card_style(id: String, selected: bool) -> StyleBoxFlat:
	var style := box_style(Color("#263b46") if selected else SURFACE,
		player_color(id) if selected else Color("#30434f"), 7)
	style.content_margin_top = 4
	style.content_margin_bottom = 4
	style.content_margin_left = 5
	style.content_margin_right = 6
	return style

func player_view(id: String) -> Dictionary:
	var p: Dictionary = rules.get_participant(id)
	if p.is_empty():
		return {"id": id, "number": 0, "username": "", "nickname": "", "troops": 0, "coins": 0, "regions": []}
	p["coins"] = p.coinTotal
	p["displayName"] = display_player_name(p)
	return p


static func display_player_name(player: Dictionary) -> String:
	var nickname := str(player.get("nickname", "")).replace("\n", " ").replace("\r", " ").strip_edges()
	return nickname if not nickname.is_empty() else str(player.get("username", ""))

func unit_counts(id: String) -> Dictionary:
	var units: Dictionary = rules.unit_counts(id)
	units.jets = int(units.get("jets", 0))
	return units

func combat_troops(id: String, current_battles: Variant = null) -> int:
	var player: Dictionary = rules.get_participant(id)
	var total := int(player.get("troops", 0))
	for battle in (battle_views() if current_battles == null else current_battles):
		if id != battle.attacker and id != battle.defender:
			continue
		var attacker: Dictionary = rules.get_participant(battle.attacker)
		var defender: Dictionary = rules.get_participant(battle.defender)
		var left := WAR_RULES.remaining_combat_troops(battle, int(attacker.troops), int(defender.troops))
		return left[0 if id == battle.attacker else 1]
	return total

func combat_unit_counts(id: String, current_battles: Variant = null) -> Dictionary:
	var units := unit_counts(id)
	var total := int(units.soldiers)
	var remaining := combat_troops(id, current_battles)
	if remaining < total:
		var player: Dictionary = rules.get_participant(id)
		var ratio := float(remaining) / float(total)
		units.tanks = remaining / WAR_RULES.TROOPS_PER_TANK + roundi(float(player.bonusTanks) * ratio)
		units.helicopters = int(rules.automatic_helicopters(id, remaining)) + roundi(float(player.bonusHelicopters) * ratio)
		units.jets = rules.aircraft_jets(id, remaining)
	units.soldiers = remaining
	return units

func player_color(id: String) -> Color:
	if id.is_empty():
		return Color("#e4ddc8")
	var p: Dictionary = rules.get_participant(id)
	var number := int(p.get("number", 1))
	return PALETTE[(number - 1) % PALETTE.size()] if number <= PALETTE.size() else Color.from_hsv(fmod(number * 0.618034, 1.0), 0.38, 0.85)

func region_owner(id: int) -> String:
	return rules.get_region_owner(id)

func region_troops(id: int) -> int:
	return rules.region_troops(id)

func region_headquarters(id: int) -> String:
	return rules.region_headquarters(id)

func battle_views() -> Array[Dictionary]:
	var list: Array[Dictionary] = []
	for item in rules.active_battles_view():
		var route: Dictionary = battle_routes.get(str(item.id), {})
		var from_region := int(route.get("from", item.get("captureFrom", item.actorRegion)))
		var airborne: bool = item.get("airborne", item.has("captureFrom"))
		var defender: Dictionary = rules.get_participant(str(item.targetId))
		list.append({"id": item.id, "attacker": str(item.actorId), "defender": str(item.targetId),
			"attackerPower": float(item.actorPower), "defenderPower": float(item.targetPower),
			"progress": float(item.progress), "elapsed": float(item.elapsed), "duration": float(item.duration),
			"control": float(item.frontControl), "airborne": airborne,
			"air_unit": str(item.get("airUnit", "")),
			"target_regions": defender.get("regions", []),
			"deployment": WAR_RULES.deployment_seconds(float(item.duration), airborne),
			"from_region": from_region, "to_region": int(route.get("to", item.get("captureTo", item.targetRegion))),
			"contact_from": int(route.get("contact", from_region))})
	return list

func is_paused() -> bool:
	return state.get("phase", "staging") == "paused"


func battle_speed_multiplier() -> float:
	return battle_speed


func _set_battle_boost(held: bool) -> void:
	battle_speed = 3.0 if held else 1.0
	if is_instance_valid(battle_speed_label):
		battle_speed_label.text = "H · %d×" % int(battle_speed)


func _advance_missiles(delta: float) -> void:
	missile_retry_left -= delta
	if missile_retry_left > 0.0:
		return
	missile_retry_left = 0.20
	if missile_checkpoint_due:
		missile_checkpoint_due = not _save_state()
	if pending_missiles.is_empty() or not active_missile.is_empty() or missile_checkpoint_due \
			or rules.round_phase() not in ["staging", "running"]:
		return
	var occupied := {}
	for region in canvas.regions:
		var owner := region_owner(region.id)
		if not owner.is_empty():
			occupied[region.id] = owner
	for actor: String in pending_missiles:
		var sources: Array = rules.get_participant(actor).get("regions", [])
		if sources.is_empty() or occupied.size() <= sources.size():
			continue
		var targets := occupied.duplicate()
		for source in sources:
			targets.erase(source)
		active_missile = {"actor": actor, "damage": pending_missiles[actor], "targets": targets, "impacted": false}
		if not missile_effect.play(sources, targets.keys()):
			active_missile.clear()
			return
		missile_audio.play_launch()
		notice("%s · Füze saldırısı · %d hedef" % [display_player_name(player_view(actor)), targets.size()])
		return


func _on_missile_impact() -> void:
	if missile_effect.is_air_show():
		missile_audio.play_impact()
		return
	_impact_missile()


func _play_air_show() -> void:
	var now := Time.get_ticks_msec()
	if now < air_show_available_at or rules.round_phase() not in ["staging", "running"]:
		return
	var origins: PackedVector3Array = canvas.military.jet_show_launch_positions()
	if missile_effect.play_air_show(origins, range(canvas.regions.size())):
		air_show_available_at = now + AIR_SHOW_COOLDOWN_MS
		missile_audio.play_launch()


func _impact_missile() -> void:
	if active_missile.is_empty() or active_missile.impacted:
		return
	active_missile.impacted = true
	missile_audio.play_impact()
	var actor: String = active_missile.actor
	var damage: int = active_missile.damage
	var impact: Dictionary = rules.resolve_missile_strike(actor, active_missile.targets, damage)
	if not impact.ok or impact.hitRegions.is_empty():
		return
	var remaining := int(pending_missiles.get(actor, 0)) - damage
	if remaining > 0:
		pending_missiles[actor] = remaining
	else:
		pending_missiles.erase(actor)
	for id in impact.cancelledBattles:
		battle_routes.erase(str(id))
	var captured := 0
	for defeated in impact.defeated:
		var regions: Array = impact.defeated[defeated]
		canvas.military.show_defeat(defeated, regions)
		captured += regions.size()
	for region in impact.destroyedHeadquarters:
		canvas.territory_surface.show_headquarters_destruction(region)
	if rules.round_phase() == "staging":
		rules.start_round()
	missile_checkpoint_due = not _save_state()
	_refresh()
	notice("Füze saldırısı · %s asker kaybı · %d bölge ele geçirildi" % [amount(impact.troopsLost), captured])


func _cancel_missile() -> void:
	active_missile.clear()
	missile_retry_left = 0.0
	if is_instance_valid(missile_effect):
		missile_effect.cancel()
	if is_instance_valid(missile_audio):
		missile_audio.stop()
		missile_audio.set_paused(false)


func _retained_missiles(current_rules: RefCounted) -> Dictionary:
	var retained := pending_missiles.duplicate()
	for actor in pending_missiles:
		if current_rules.get_participant(actor).is_empty():
			retained.erase(actor)
	return retained


func amount(value: Variant) -> String:
	var n := int(value)
	if n >= 1000000:
		return "%.1f M" % (n / 1000000.0)
	if n >= 10000:
		return "%.1f B" % (n / 1000.0)
	return str(n)

func region_name(original: String) -> String:
	return {"Frozen_Mud": "Donmuş Çamur", "Mud_Hills": "Çamur Tepeleri", "Inner_Mud": "İç Bataklık",
		"Muddy_Island": "Çamur Adası", "Muddy_Coast": "Bataklık Kıyısı", "Dark_Mud": "Kara Bataklık",
		"Bamboo_Ridge": "Bambu Sırtı", "Bamboo_Forest": "Bambu Ormanı", "Bamboo_Mist": "Sisli Bambu",
		"Outer_Bamboo": "Dış Bambu", "Bamboo_Valley": "Bambu Vadisi", "Bamboo_Beach": "Bambu Sahili",
		"Sacred_Bamboo": "Kutsal Bambu", "Wild_Bamboo": "Yabani Bambu", "Cold_River": "Soğuk Nehir",
		"Clear_River": "Berrak Nehir", "Main_River": "Ana Nehir", "River_Falls": "Şelale",
		"The_Delta": "Delta", "Stone_Bridge": "Taş Köprü", "Beaver_Dam": "Kunduz Barajı",
		"Stone_Peak": "Taş Zirve", "High_Peak": "Yüksek Zirve", "High_Valley": "Yüksek Vadi",
		"Central_Peak": "Merkez Zirve", "Wind_Ridge": "Rüzgâr Sırtı", "Thorn_Bush": "Dikenlik",
		"Sun_Hollow": "Güneş Oyuğu", "Dry_Basin": "Kuru Havza", "Inner_Bush": "İç Çalılık",
		"The_Lookout": "Gözetleme Tepesi", "Wind_Plains": "Rüzgârlı Ovalar", "Bush_Island": "Çalılık Adası",
		"Tree_Island": "Ağaç Adası", "Deep_Forest": "Derin Orman", "Crown_Forest": "Taç Ormanı",
		"Old_Trees": "Kadim Ağaçlar"}.get(original, original.replace("_", " "))

func avatar_for(id: String) -> Texture2D:
	return avatars.get(id)

func portraits_available(updates: Array) -> void:
	for row in updates:
		if not row is Dictionary:
			continue
		var id := str(row.get("username", ""))
		if id.is_empty() or rules.get_participant(id).is_empty():
			continue
		var requested := Vector2i(int(row.get("width", 0)), int(row.get("height", 0)))
		if requested.x <= 0 or requested.y <= 0 or avatar_announced.get(id) == requested:
			continue
		var existing := avatar_for(id)
		if existing != null and not _avatar_is_better(requested.x, requested.y, existing.get_width(), existing.get_height()):
			continue
		avatar_announced[id] = requested
		avatar_next_check[id] = 0.0
		avatar_left = 0.0

func _fetch_avatar(id: String, username: String) -> void:
	if live == null or live.url.is_empty() or avatar_waiting.has(id) or avatar_waiting.size() >= AVATAR_MAX_REQUESTS:
		return
	var now := Time.get_ticks_msec() / 1000.0
	if float(avatar_next_check.get(id, 0.0)) > now:
		return
	# Retain the best disk copy even after memory eviction; never overwrite it
	# with a smaller first bridge response following a reconnect.
	if not avatars.has(id):
		var cached := _load_avatar_image(_avatar_cache_path(username))
		if cached != null:
			cached.generate_mipmaps()
			_remember_avatar(id, ImageTexture.create_from_image(cached))
	var retry := int(avatar_retry_step.get(id, 0))
	if not avatar_next_check.has(id) and avatars.has(id):
		# A cached image is visible immediately, including while awaiting a source update.
		retry = maxi(1, retry)
	avatar_next_check[id] = now + AVATAR_RETRY_DELAYS[retry]
	while avatar_next_check.size() > 1500:
		var forgotten: String = avatar_next_check.keys()[0]
		avatar_next_check.erase(forgotten)
		avatar_retry_step.erase(forgotten)
		avatar_announced.erase(forgotten)
	var announced: Vector2i = avatar_announced.get(id, Vector2i.ZERO)
	avatar_waiting[id] = true
	var client: Node = live
	var photo: Texture2D
	var decoded: Image
	var version := ""
	if client.has_method("avatar_result"):
		var result: Dictionary = await client.avatar_result(username)
		photo = result.get("texture")
		decoded = result.get("image")
		version = str(result.get("qualityVersion", ""))
	else:
		photo = await client.avatar(username)
	avatar_waiting.erase(id)
	# A late response from a replaced bridge/different donor must not change the
	# current identity. Failure or lower quality leaves the current photo intact.
	var participant: Dictionary = rules.get_participant(id)
	if client != live or participant.is_empty() or str(participant.username) != username:
		return
	var improved := _remember_avatar(id, photo, decoded, version)
	var best: Texture2D = avatar_for(id)
	var good := best != null and mini(best.get_width(), best.get_height()) >= AVATAR_GOOD_SHORT_SIDE
	var next_retry := 1 if improved else mini(retry + 1, AVATAR_RETRY_DELAYS.size() - 1)
	avatar_retry_step[id] = next_retry
	avatar_next_check[id] = Time.get_ticks_msec() / 1000.0 + (AVATAR_UPGRADE_SECONDS if good else AVATAR_RETRY_DELAYS[next_retry])
	var latest: Vector2i = avatar_announced.get(id, Vector2i.ZERO)
	if best != null and not _avatar_is_better(latest.x, latest.y, best.get_width(), best.get_height()):
		avatar_announced.erase(id)
	elif latest != announced:
		# The sharper image was announced while an older request was in flight.
		avatar_next_check[id] = 0.0
		avatar_left = 0.0
	if best != null and (improved or not FileAccess.file_exists(_avatar_cache_path(username))):
		_queue_avatar_write(username, decoded if improved and decoded != null else best.get_image())

func _refresh_avatar_upgrades(delta: float) -> void:
	avatar_left -= delta
	if avatar_left > 0.0 or qa_mode or live == null or live.url.is_empty():
		return
	avatar_left = 0.5
	if avatar_waiting.size() >= AVATAR_MAX_REQUESTS:
		return
	var participants: Array = state.get("participants", [])
	if participants.is_empty():
		return
	var now := Time.get_ticks_msec() / 1000.0
	# A missing portrait already on the map gets one slot. Other armies can
	# still receive their first images while the map retries a broken source.
	if AVATAR_MAX_REQUESTS - avatar_waiting.size() > 1:
		_poll_avatars(participants, now, true, true)
	if avatar_waiting.size() < AVATAR_MAX_REQUESTS and not _poll_avatars(participants, now, true):
		_poll_avatars(participants, now, false)

func _poll_avatars(participants: Array, now: float, missing: bool, on_map_only: bool = false) -> bool:
	var remaining := 1 if on_map_only else AVATAR_MAX_REQUESTS - avatar_waiting.size()
	for offset in range(participants.size()):
		var index := (avatar_cursor + offset) % participants.size()
		var p: Dictionary = participants[index]
		if on_map_only and p.regions.is_empty():
			continue
		if avatars.has(p.id) == missing or avatar_waiting.has(p.id) or float(avatar_next_check.get(p.id, 0.0)) > now:
			continue
		_fetch_avatar(p.id, p.username)
		remaining -= 1
		if remaining == 0:
			avatar_cursor = (index + 1) % participants.size()
			return true
	return false

func _valid_avatar_texture(texture: Texture2D) -> bool:
	return (texture != null and texture.get_width() > 0 and texture.get_height() > 0
		and texture.get_width() <= 8192 and texture.get_height() <= 8192
		and texture.get_width() * texture.get_height() <= AVATAR_MAX_PIXELS)

static func _avatar_is_better(width: int, height: int, old_width: int, old_height: int) -> bool:
	var side := mini(width, height)
	var old_side := mini(old_width, old_height)
	return side > old_side or (side == old_side and width * height > old_width * old_height)

func _remember_avatar(id: String, texture: Texture2D, decoded: Image = null, version: String = "") -> bool:
	if not _valid_avatar_texture(texture):
		return false
	var old: Texture2D = avatars.get(id)
	if old != null and not _avatar_is_better(texture.get_width(), texture.get_height(), old.get_width(), old.get_height()):
		return false
	var image := decoded if decoded != null else texture.get_image()
	if not LIVE_CLIENT.is_portrait_image_usable(image):
		return false
	if version.is_empty():
		var digest := HashingContext.new()
		digest.start(HashingContext.HASH_SHA256)
		digest.update(image.get_data())
		version = digest.finish().hex_encode()
	avatar_quality[id] = {"width": texture.get_width(), "height": texture.get_height(),
		"qualityVersion": version}
	avatars[id] = texture
	avatar_icons.erase(id)
	dirty = true
	refresh_left = 0.0
	while avatars.size() > 128:
		var oldest: String = str(avatars.keys()[0])
		for candidate: String in avatars:
			if rules.get_participant(candidate).get("regions", []).is_empty():
				oldest = candidate
				break
		avatars.erase(oldest)
		avatar_quality.erase(oldest)
		avatar_icons.erase(oldest)
	return true


func _target_avatar(id: String) -> Texture2D:
	if avatar_icons.has(id):
		return avatar_icons[id]
	var source := avatar_for(id)
	if source == null:
		return null
	var image := source.get_image()
	if image == null or image.is_empty():
		return null
	var side := mini(image.get_width(), image.get_height())
	var origin := (image.get_size() - Vector2i(side, side)) / 2
	var icon := image.get_region(Rect2i(origin, Vector2i(side, side)))
	icon.resize(28, 28, Image.INTERPOLATE_LANCZOS)
	var texture := ImageTexture.create_from_image(icon)
	avatar_icons[id] = texture
	return texture

func _avatar_cache_path(username: String) -> String:
	return profile_dir.path_join("avatars").path_join(username.sha256_text() + ".png")

static func _load_avatar_image(path: String) -> Image:
	if not FileAccess.file_exists(path):
		return null
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var length := file.get_length()
	file.close()
	if length <= 0 or length > 16777216:
		return null
	var image := Image.load_from_file(path)
	if not LIVE_CLIENT.is_portrait_image_usable(image):
		return null
	return image

func _write_avatar_cache(username: String, image: Image) -> bool:
	if avatar_write_job >= 0:
		WorkerThreadPool.wait_for_task_completion(avatar_write_job)
		avatar_write_job = -1
	var path := _avatar_cache_path(username)
	avatar_cache_serial += 1
	var temporary := path + ".%d-%d.tmp" % [OS.get_process_id(), avatar_cache_serial]
	return _store_avatar_image(path, temporary, image)

static func _store_avatar_image(path: String, temporary: String, image: Image) -> bool:
	var previous := _load_avatar_image(path)
	if previous != null and not _avatar_is_better(image.get_width(), image.get_height(), previous.get_width(), previous.get_height()):
		return false
	if DirAccess.make_dir_recursive_absolute(path.get_base_dir()) != OK:
		push_warning("Portre önbelleği yazılamadı; mevcut görüntü bellekte korunuyor.")
		return false
	var error := image.save_png(temporary)
	if error == OK:
		error = DirAccess.rename_absolute(temporary, path)
	if FileAccess.file_exists(temporary):
		DirAccess.remove_absolute(temporary)
	if error != OK:
		push_warning("Portre önbelleği yazılamadı; mevcut görüntü bellekte korunuyor.")
	return error == OK

func _queue_avatar_write(username: String, image: Image) -> void:
	var pending: Image = avatar_write_queue.get(username)
	if pending != null and not _avatar_is_better(image.get_width(), image.get_height(), pending.get_width(), pending.get_height()):
		return
	if pending == null and avatar_write_queue.size() >= 128:
		return
	avatar_write_queue[username] = image.duplicate()
	_advance_avatar_writes()

func _advance_avatar_writes() -> void:
	if avatar_write_job >= 0:
		if not WorkerThreadPool.is_task_completed(avatar_write_job):
			return
		WorkerThreadPool.wait_for_task_completion(avatar_write_job)
		avatar_write_job = -1
	if avatar_write_queue.is_empty():
		return
	var username: String = avatar_write_queue.keys()[0]
	var image: Image = avatar_write_queue[username]
	avatar_write_queue.erase(username)
	var path := _avatar_cache_path(username)
	avatar_cache_serial += 1
	var temporary := path + ".%d-%d.tmp" % [OS.get_process_id(), avatar_cache_serial]
	avatar_write_job = WorkerThreadPool.add_task(_store_avatar_image.bind(path, temporary, image), false, "Portrait PNG cache")

func _flush_avatar_writes() -> void:
	if avatar_write_job >= 0:
		WorkerThreadPool.wait_for_task_completion(avatar_write_job)
		avatar_write_job = -1
	for username: String in avatar_write_queue:
		_write_avatar_cache(username, avatar_write_queue[username])
	avatar_write_queue.clear()

func _read_avatar_cache() -> void:
	for p in rules.view_state().participants:
		var image := _load_avatar_image(_avatar_cache_path(str(p.username)))
		if image != null:
			image.generate_mipmaps()
			_remember_avatar(p.id, ImageTexture.create_from_image(image))

func select_player(id: String) -> void:
	if inspected_player != id:
		close_army_details()
	selected_player = id
	if selected_target == id:
		selected_target = ""
	dirty = true

func open_army_details(id: String) -> void:
	select_player(id)
	inspected_player = id
	_refresh()

func close_army_details() -> void:
	inspected_player = ""
	detail_panel.hide()
	jet_button.hide()

func click_region(region: int) -> void:
	var owner := region_owner(region)
	if owner.is_empty():
		return
	select_player(owner)
	_refresh()

func grant_region_unit(region: int, unit: String) -> bool:
	var owner := region_owner(region)
	var result: Dictionary = rules.add_publisher_unit(owner, unit)
	if not result.ok:
		notice(_error_text(result.error))
		return false
	_enqueue_reinforcements(owner, int(unit == "tank"), int(unit == "helicopter"))
	var saved := _save_state()
	var label: String = {"tank": "tank", "helicopter": "helikopter", "jet": "jet"}[unit]
	notice("%s ordusuna 1 %s eklendi.%s" % [player_view(owner).nickname, label,
		"" if saved else " Kayıt dosyasına yazılamadı."])
	_refresh()
	return true

func grant_region_headquarters(region: int) -> bool:
	var owner := region_owner(region)
	var result: Dictionary = rules.add_headquarters(owner, region)
	if not result.ok:
		notice(_error_text(result.error))
		return false
	var base_region := int(result.regionId)
	var title: String = canvas.region_display_name(base_region)
	var saved := _save_state()
	var feedback := "%s merkezinde karargâh kuruldu. Saniyede 5 asker." % title
	if not result.get("changed", false):
		feedback = "%s merkezinde karargâh zaten var. Saniyede 5 asker." % title
	if result.get("waiting", false):
		feedback = "%s merkezindeki eski karargâhın kayıtlı asker eşiği bekleniyor." % title
	notice(feedback + ("" if saved else " Kayıt dosyasına yazılamadı."))
	_refresh()
	return true

func start_region_attack(from_region: int, to_region: int) -> bool:
	var attacker := region_owner(from_region)
	var defender := region_owner(to_region)
	if defender.is_empty() or attacker == defender:
		notice("Saldırı için rakibe ait bir bölge seç.")
		return false
	var result := _issue_attack(attacker, defender, from_region, to_region, true)
	if not result.ok:
		notice(_error_text(result.error))
		return false
	select_player(attacker)
	selected_target = defender
	_refresh()
	return true

func army_drag_preview(id: String) -> Control:
	var p := player_view(id)
	var preview := PanelContainer.new()
	preview.add_theme_stylebox_override("panel", box_style(Color("#203340"), player_color(id), 8))
	text(preview, "#%d  %s · %s asker" % [p.number, str(p.nickname).left(24), amount(p.troops)], 16)
	return preview

func drop_army(id: String, region: int, from_region: int = -1) -> Dictionary:
	close_army_details()
	if region < 0 or region >= canvas.regions.size():
		return {"ok": false, "error": "invalid_region"}
	var owner := region_owner(region)
	if owner.is_empty():
		return place_player(id, region)
	if owner == id:
		select_player(id)
		return {"ok": true}
	var result := _issue_attack(id, owner, from_region, region, true)
	if result.ok:
		select_player(id)
		selected_target = owner
	else:
		notice(_error_text(result.error))
	_refresh()
	return result

func place_player(id: String, region: int) -> Dictionary:
	var had_starter: bool = rules.get_participant(id).get("starterGranted", false)
	var result: Dictionary = rules.place_participant(id, region)
	if result.get("changed", false):
		selected_player = id
		var photo := avatar_for(id)
		if photo == null or mini(photo.get_width(), photo.get_height()) < AVATAR_GOOD_SHORT_SIDE:
			avatar_next_check[id] = 0.0
			avatar_left = 0.0
		var message := "#%d · %s üzerine yerleşti." % [player_view(id).number, canvas.region_display_name(region)]
		if not had_starter and rules.get_participant(id).get("starterGranted", false):
			message += " Başlangıç ödülü: 1 tank, 1 helikopter, 1 jet."
		notice(message)
		_try_gift_surrounding(id)
		_save_state()
		dirty = true
	elif not result.ok:
		notice(_error_text(result.get("error", "")))
	return result

func _refresh_details() -> void:
	target_picker.clear()
	target_picker.add_item("Bir hedef seç", 0)
	var has_selection: bool = not inspected_player.is_empty() and inspected_player == selected_player \
		and combat_troops(selected_player) > 0
	detail_panel.visible = has_selection
	if not has_selection:
		jet_button.hide()
		attack_button.disabled = true
		return
	var p := player_view(selected_player)
	jet_button.visible = not p.regions.is_empty()
	jet_button.disabled = state.phase == "results"
	var color := player_color(selected_player)
	var style := box_style(color.lerp(BG, 0.83), color, 7)
	style.content_margin_top = 3
	style.content_margin_bottom = 3
	style.content_margin_left = 6
	style.content_margin_right = 6
	detail_panel.add_theme_stylebox_override("panel", style)
	detail_portrait.texture = avatar_for(selected_player)
	detail_portrait.visible = detail_portrait.texture != null
	detail_name.text = "#%d  %s" % [p.number, display_player_name(p)]
	_refresh_army_counts(p)
	for target in state.participants:
		if target.id != selected_player and not target.regions.is_empty() and int(target.troops) > 0:
			target_picker.add_item("#%d  %s" % [target.number, str(target.nickname).left(20)], target.number)
			var index := target_picker.item_count - 1
			target_picker.set_item_metadata(index, target.id)
			target_picker.set_item_icon(index, _target_avatar(target.id))
			if target.id == selected_target:
				target_picker.select(index)
	attack_button.disabled = state.phase not in ["staging", "running"] or selected_target.is_empty() \
		or p.regions.is_empty() or p.troops <= 0


func _refresh_army_counts(player: Dictionary) -> void:
	var units := combat_unit_counts(player.id)
	detail.text = "%d asker  ·  %d coin" % [units.soldiers, player.coinTotal]
	detail.tooltip_text = detail.text
	detail_units.text = "%d tank  ·  %d helikopter  ·  %d jet\n%d bölge  ·  %d fabrika  ·  %d karargâh" % [
		units.tanks, units.helicopters, units.jets, player.regions.size(),
		units.get("factories", 0), player.get("headquarters", []).size()]

func _pick_target(index: int) -> void:
	selected_target = "" if index == 0 else str(target_picker.get_item_metadata(index))
	dirty = true

func _publisher_attack() -> void:
	if selected_player.is_empty() or selected_target.is_empty():
		return
	var result := _issue_attack(selected_player, selected_target, -1, -1, true)
	if not result.ok:
		notice(_error_text(result.get("error", "")))
	dirty = true

func _grant_selected_jet() -> void:
	var selected: Dictionary = rules.get_participant(selected_player)
	if not selected.is_empty():
		grant_region_unit(int(selected.troopRegion), "jet")

func start_surrounding_attack(from_region: int, focus_actor: bool = true) -> bool:
	var actor := region_owner(from_region)
	if actor.is_empty():
		return false
	var phase: String = rules.round_phase()
	if phase == "paused" or phase == "results":
		notice(_error_text("round_paused" if phase == "paused" else "round_not_running"))
		return false
	if int(rules.get_participant(actor).troops) <= 0:
		notice(_error_text("no_troops"))
		return false
	if surrounding_orders.has(actor):
		notice("Bu ordunun çevre saldırısı zaten sırada.")
		return false
	var engaged := _engaged_armies()
	var borders := _surrounding_routes(actor, from_region)
	borders.erase(engaged.get(actor, ""))
	if borders.is_empty():
		notice("Saldırılacak yerleşmiş bir rakip ordu yok.")
		return false
	var targets: Array = borders.keys()
	targets.sort_custom(func(a: String, b: String) -> bool: return borders[a].distance < borders[b].distance)
	surrounding_orders[actor] = targets
	var started := _advance_surrounding_attack(actor, engaged, true, from_region)
	if not started:
		_save_state()
	var remaining: int = surrounding_orders.get(actor, []).size()
	if remaining > 0:
		notice("Her yere saldır · %d rakip sırada." % remaining)
	if focus_actor:
		select_player(actor)
		_refresh()
	return started or remaining > 0


func _try_gift_surrounding(actor: String) -> void:
	if not pending_surrounding.has(actor) or rules.round_phase() not in ["staging", "running"]:
		return
	var army: Dictionary = rules.get_participant(actor)
	if army.is_empty() or army.regions.is_empty() or int(army.troops) <= 0:
		return
	if surrounding_orders.has(actor):
		pending_surrounding.erase(actor)
		_save_state()
	elif not _surrounding_routes(actor).is_empty():
		pending_surrounding.erase(actor)
		if not start_surrounding_attack(int(army.troopRegion), false):
			pending_surrounding[actor] = true

func _surrounding_routes(actor: String, preferred_region: int = -1) -> Dictionary:
	var routes := {}
	var participant: Dictionary = rules.get_participant(actor)
	if participant.is_empty() or participant.regions.is_empty():
		return routes
	var preferred := preferred_region if preferred_region in participant.regions else int(participant.troopRegion)
	var anchor: Vector2 = canvas.regions[preferred].center
	for region in canvas.regions:
		var opponent := region_owner(region.id)
		if opponent.is_empty() or opponent == actor or routes.has(opponent):
			continue
		var defender: Dictionary = rules.get_participant(opponent)
		var route := _pick_route(participant.regions, defender.regions, preferred_region, -1)
		routes[opponent] = {"source": route.from, "target": route.to,
			"distance": anchor.distance_squared_to(canvas.regions[route.to].center)}
	return routes

func _engaged_armies() -> Dictionary:
	var engaged := {}
	for battle in rules.active_battles_view():
		engaged[battle.actorId] = battle.targetId
		engaged[battle.targetId] = battle.actorId
	return engaged

func _advance_surrounding_attack(actor: String, engaged: Dictionary, may_start_round: bool = false, from_region: int = -1) -> bool:
	if engaged.has(actor):
		return false
	var army: Dictionary = rules.get_participant(actor)
	if army.is_empty() or army.regions.is_empty() or army.troops <= 0:
		surrounding_orders.erase(actor)
		_save_state()
		return false
	var routes := _surrounding_routes(actor, from_region)
	var targets: Array = surrounding_orders[actor]
	var original_count := targets.size()
	for opponent in targets.duplicate():
		if not routes.has(opponent):
			targets.erase(opponent)
			continue
		if engaged.has(opponent):
			continue
		targets.erase(opponent)
		if targets.is_empty():
			surrounding_orders.erase(actor)
		var route: Dictionary = routes[opponent]
		var result := _issue_attack(actor, opponent, route.source, route.target, may_start_round)
		if result.ok:
			engaged[actor] = opponent
			engaged[opponent] = actor
			return true
	if targets.is_empty():
		surrounding_orders.erase(actor)
	if original_count != targets.size():
		_save_state()
	return false

func _issue_attack(actor: String, target: String, from_region: int = -1, to_region: int = -1, may_start_round: bool = false) -> Dictionary:
	var attacker: Dictionary = rules.get_participant(actor)
	var defender: Dictionary = rules.get_participant(target)
	if attacker.is_empty() or defender.is_empty() or attacker.regions.is_empty() or defender.regions.is_empty():
		return {"ok": false, "error": "participant_unplaced"}
	if actor == target:
		return {"ok": false, "error": "self_attack"}
	if attacker.troops <= 0:
		return {"ok": false, "error": "no_troops"}
	var phase: String = rules.view_state().phase
	if phase == "paused":
		return {"ok": false, "error": "round_paused"}
	if phase != "running" and (phase != "staging" or not may_start_round):
		return {"ok": false, "error": "round_not_running"}
	var route := _pick_route(attacker.regions, defender.regions, from_region, to_region)
	var before: Dictionary = {}
	if phase == "staging":
		before = rules.serialize_state()
		rules.start_round()
	var result: Dictionary = rules.request_attack(actor, int(defender.number), route if route.airborne else {})
	if not result.ok:
		if not before.is_empty():
			rules.restore_state(before)
		return result
	battle_routes[str(result.battleId)] = route
	attack_requests.erase(actor)
	if war_notice != null:
		war_notice.show_attack(actor, target)
	var route_name := "Kara ve hava" if not String(rules.air_unit(actor)).is_empty() else "Kara"
	notice("%s saldırısı · #%d → #%d" % [route_name, attacker.number, defender.number])
	_save_state()
	dirty = true
	return result

func _pick_route(actor_regions: Array, target_regions: Array, from_region: int, to_region: int) -> Dictionary:
	var starts: Array = [from_region] if actor_regions.has(from_region) else actor_regions
	var targets: Array = [to_region] if target_regions.has(to_region) else target_regions
	var allowed_sources := _connected_owned(from_region, actor_regions) if actor_regions.has(from_region) else actor_regions
	var route := {"from": int(starts[0]), "to": int(targets[0]), "contact": int(starts[0]), "airborne": true}
	var nearest := INF
	for start in starts:
		for end in targets:
			var distance: float = canvas.regions[start].center.distance_squared_to(canvas.regions[end].center)
			if distance < nearest:
				route = {"from": int(start), "to": int(end), "contact": int(start), "airborne": true}
				nearest = distance
	nearest = INF
	for contact in allowed_sources:
		for end in targets:
			if end not in canvas.neighbors.get(contact, []):
				continue
			var distance: float = canvas.regions[contact].center.distance_squared_to(canvas.regions[end].center)
			if distance < nearest:
				var start: int = from_region if actor_regions.has(from_region) else int(contact)
				route = {"from": start, "to": int(end), "contact": int(contact), "airborne": false}
				nearest = distance
	return route

func _connected_owned(source: int, owned: Array) -> Array:
	var queue := [source]
	var index := 0
	while index < queue.size():
		var region: int = queue[index]
		index += 1
		for neighbor in canvas.neighbors.get(region, []):
			if neighbor in owned and neighbor not in queue:
				queue.append(neighbor)
	return queue

func _uses_soldier_aviation() -> bool:
	return true


func _show_rules() -> void:
	var rules_window := AcceptDialog.new()
	rules_window.title = "Fetih · Kurallar"
	rules_window.theme = ui.theme.duplicate()
	rules_window.theme.default_font = ui_font
	rules_window.theme.set_font("font", "Label", ui_font)
	rules_window.theme.set_font("font", "Button", ui_font)
	rules_window.theme.set_constant("outline_size", "Label", 0)
	rules_window.theme.set_color("font_color", "Label", WHITE)
	rules_window.theme.set_stylebox("panel", "AcceptDialog", box_style(BG, Color("#58707b"), 8))
	rules_window.get_label().add_theme_font_override("font", ui_font)
	rules_window.get_label().add_theme_font_size_override("font_size", 16)
	rules_window.get_label().add_theme_constant_override("line_spacing", 5)
	rules_window.get_label().add_theme_color_override("font_shadow_color", Color.TRANSPARENT)
	rules_window.get_label().autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rules_window.dialog_text = ("• Sohbete ‘katıl’ yazan izleyici tur başına bir kez %d askerle sol listeye girer.\n" % WAR_RULES.CHAT_JOIN_SOLDIERS
		+ "• Varsayılan 1 coin = 50 asker. B menüsünde değiştirilebilir.\n"
		+ "• Her 150 askere 1 tank, her 300 askere 1 helikopter, her 700 askere 1 savaş jeti.\n"
		+ "• İlk bölgesini alan 50 askerli ordu bu turda birer tank, helikopter ve jet kazanır.\n"
		+ "• İlk bölge için orduyu boş bir bölgeye sürükle. Birlik biriktirmek boş bölgeleri almaz.\n"
		+ "• İlk geçerli yayıncı saldırısı savaşı başlatır.\n"
		+ "• Savaşı bitir: en çok kalan askeri olan, eşitse en çok bölgesi olan kazanır.\n"
		+ "• Karargâh her aktif saniyede 5 asker üretir.\n"
		+ "• B menüsündeki hediye ödülü, hediyenin coin karşılığı olan askerlere eklenir. Galaksi rakiplere sırayla saldırır.\n"
		+ "• Füze saldırısı hediyesinin taban hasarı B menüsünden ayarlanır. Atış için haritada bölge gerekir.\n"
		+ "• Savaş normal hızda başlar. H basılıyken 3× olur ve tuş bırakılınca 1× hıza döner.\n"
		+ "• Kara ve hava birlikleri birlikte savaşır. Uzak çatışmada tank ve askerler kendi bölgelerinden ateş eder.\n"
		+ "• Sohbete ‘saldır’ veya ‘saldırı’ yazan ordunun isteği listenin üstünde görünür. Hedef numarasıyla emir verilebilir.\n"
		+ "• Tüm harita tek ordudaysa 10 saniyelik fetih sayımı başlar.\n"
		+ "• Bu sırada rakibin en az %d coin değerindeki tamamlanmış hediyesi bir bölge açar.\n" % BREAK_SIEGE_COINS
		+ "• P, seçtiğin bölgeyi ve o bölgedeki portreyi temizler.\n"
		+ "• T, yalnızca haritanın göründüğü yayın modunu açar veya kapatır.\n"
		+ "• Üst ok menüyü, sol ok listeyi açar veya kapatır. Çapraz kılıç haritada yeri olan orduyu gösterir.\n"
		+ "• Klavye okları: yukarı/aşağı eğim, sağ/sol harita dönüşü. Yazı ve ayar pencerelerinde devre dışıdır.\n"
		+ "• Ülke Liderleri her tamamlanan zaferi bir kez sayar.\n"
		+ "• Savaş bitince harita yeni tura hazır olur. Haritada savaşan ordular temizlenir, yerleştirilmemiş birlikler korunur.")
	ui.add_child(rules_window)
	rules_window.confirmed.connect(rules_window.queue_free)
	rules_window.canceled.connect(rules_window.queue_free)
	rules_window.popup_centered_clamped(Vector2i(790, 475), 0.94)


func _open_camera_angle() -> void:
	var angle_window := AcceptDialog.new()
	angle_window.title = "Harita görüş açısı"
	var layout := VBoxContainer.new()
	angle_window.add_child(layout)
	var angle_value := text(layout, "", 16, GOLD)
	var slider := HSlider.new()
	slider.min_value = 35
	slider.max_value = 82
	slider.step = 1
	slider.custom_minimum_size.x = 320
	layout.add_child(slider)
	slider.value = float(settings.get("cameraTilt", 53.0))
	var update := func(value: float) -> void:
		angle_value.text = "%d°" % roundi(value)
		canvas.set_view_tilt(value)
		settings.cameraTilt = value
	update.call(slider.value)
	slider.value_changed.connect(update)
	var close_angle := func() -> void:
		_write_json(profile_dir.path_join("settings-v1.json"), settings)
		angle_window.queue_free()
	angle_window.confirmed.connect(close_angle)
	angle_window.canceled.connect(close_angle)
	angle_window.popup_centered()


func _start_round() -> void:
	var result: Dictionary = rules.start_round()
	if result.ok:
		notice("Savaş başladı. İzleyiciler kendi ordularına sohbetten saldırı emri verebilir.")
		_save_state()
	_refresh()

func _finish_round() -> void:
	if rules.round_phase() == "results":
		return
	var winner := ""
	var best_troops := -1
	var best_regions := -1
	for participant in rules.view_state().participants:
		var regions: int = participant.regions.size()
		if regions == 0:
			continue
		var troops := combat_troops(participant.id)
		if troops > best_troops or (troops == best_troops and regions > best_regions):
			winner = participant.id
			best_troops = troops
			best_regions = regions
	if not winner.is_empty() and _save_state(winner):
		_refresh()

func _pause() -> void:
	if state.phase == "paused":
		rules.resume_round()
		if not conquest_owner.is_empty():
			_show_conquest_count()
	else:
		rules.pause_round()
		if conquest_overlay != null:
			conquest_overlay.set_count(0)
	missile_audio.set_paused(rules.round_phase() == "paused")
	_save_state()
	_refresh()

func _confirm_reset() -> void:
	var confirm := ConfirmationDialog.new()
	confirm.title = "Yeni tur"
	confirm.dialog_text = "Harita ve savaşlar temizlensin mi?\nYerleştirilmemiş bekleyen ordular korunacak."
	ui.add_child(confirm)
	confirm.confirmed.connect(func() -> void:
		if rules.view_state().phase == "staging":
			rules.start_round()
		rules.finish_round()
		rules.reset_round(true)
		_cancel_missile()
		pending_missiles = _retained_missiles(rules)
		_reset_conquest()
		headquarters_pulses.clear()
		battle_routes.clear()
		surrounding_orders.clear()
		attack_requests.clear()
		canvas.military.clear_reinforcements()
		canvas.territory_surface.clear_headquarters_destruction()
		canvas.map_hud.cancel_region_action()
		war_notice.clear()
		selected_player = ""
		selected_target = ""
		_save_state()
		dirty = true
		confirm.queue_free()
	)
	confirm.canceled.connect(confirm.queue_free)
	confirm.popup_centered()

func _reset_roster() -> void:
	if rules.view_state().phase == "staging":
		rules.start_round()
	rules.finish_round()
	rules.reset_round(false)
	_cancel_missile()
	pending_missiles.clear()
	_reset_conquest()
	headquarters_pulses.clear()
	battle_routes.clear()
	surrounding_orders.clear()
	pending_surrounding.clear()
	attack_requests.clear()
	canvas.military.clear_reinforcements()
	canvas.territory_surface.clear_headquarters_destruction()
	canvas.map_hud.cancel_region_action()
	war_notice.clear()
	selected_player = ""
	selected_target = ""
	var saved := _save_state()
	_refresh()
	notice("Ordu listesi ve harita sıfırlandı." if saved else "Liste sıfırlandı fakat kayıt dosyasına yazılamadı.")

func _settings_dialog() -> void:
	for child in dialog.get_children():
		if child is VBoxContainer:
			child.queue_free()
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 10)
	dialog.add_child(layout)
	text(layout, "Ordu dengesi", 21, GOLD)
	text(layout, "Bir coin kaç asker kazandırsın?", 15)
	var ratio := SpinBox.new()
	ratio.min_value = 1
	ratio.max_value = 100000
	ratio.value = settings.soldiersPerCoin
	layout.add_child(ratio)
	text(layout, "Taarruz ve savaş süresi (saniye)", 15)
	var duration := SpinBox.new()
	duration.min_value = 20
	duration.max_value = 180
	duration.value = settings.battleSeconds
	layout.add_child(duration)
	text(layout, "Karargâh: ana bölgenin merkezinde 1 bina · saniyede +5 asker", 15)
	text(layout, "Tank desteğinin ek asker gücü", 15)
	var tank := SpinBox.new()
	tank.min_value = 0
	tank.max_value = 100000
	tank.value = int(settings.get("tankPower", 100))
	layout.add_child(tank)
	text(layout, "Helikopter desteğinin ek asker gücü", 15)
	var helicopter := SpinBox.new()
	helicopter.min_value = 0
	helicopter.max_value = 100000
	helicopter.value = int(settings.get("helicopterPower", 300))
	layout.add_child(helicopter)
	text(layout, "Jet desteğinin ek asker gücü", 15)
	var jet := SpinBox.new()
	jet.min_value = 0
	jet.max_value = 100000
	jet.value = int(settings.get("jetPower", WAR_RULES.JET_POWER))
	layout.add_child(jet)
	button(layout, "Ayarları kaydet", func() -> void:
		settings.soldiersPerCoin = int(ratio.value)
		settings.battleSeconds = float(duration.value)
		settings.tankPower = int(tank.value)
		settings.helicopterPower = int(helicopter.value)
		settings.jetPower = int(jet.value)
		rules.set_vehicle_power(int(tank.value), int(helicopter.value), int(jet.value))
		rules.set_soldiers_per_coin(int(ratio.value))
		rules.set_battle_seconds(float(duration.value))
		_write_json(profile_dir.path_join("settings-v1.json"), settings)
		_save_state()
		dirty = true
		dialog.hide()
		notice("Ayarlar kaydedildi. Yeni hediyelerde seçtiğin asker değeri uygulanacak.")
	, true)
	var credit := RichTextLabel.new()
	credit.bbcode_enabled = true
	credit.fit_content = true
	credit.custom_minimum_size.y = 42
	credit.add_theme_font_size_override("normal_font_size", 12)
	credit.text = "3D araçlar · [url=https://poly.pizza/u/Zsky]Zsky[/url], [url=https://creativecommons.org/licenses/by/3.0/]CC BY 3.0[/url]\nSes · [url=https://freesound.org/s/187681/]qubodup[/url], [url=https://freesound.org/s/108640/]juskiddink[/url], [url=https://freesound.org/s/383220/]1piemanpie[/url]"
	credit.text += ("\nHarita · [url=https://www.geoboundaries.org/]geoBoundaries[/url] / "
		+ "[url=https://www.openstreetmap.org/copyright]© OpenStreetMap contributors[/url], "
		+ "[url=https://creativecommons.org/licenses/by-sa/2.0/]CC BY-SA 2.0[/url] (uyarlama)\n"
		+ "Harita · [url=https://www.naturalearthdata.com/]Natural Earth[/url]")
	credit.meta_clicked.connect(func(link: Variant) -> void: OS.shell_open(str(link)))
	layout.add_child(credit)
	dialog.popup_centered(Vector2i(490, 500))

func _open_actions() -> void:
	if not is_instance_valid(gift_dialog):
		gift_dialog = load(mod_root.path_join("GiftActions.gd")).new()
		ui.add_child(gift_dialog)
		gift_dialog.configure(self)
	if gift_dialog.visible:
		gift_dialog.hide()
	else:
		gift_dialog.open()

func _clean_gift_actions(raw: Variant) -> Dictionary:
	return GIFT_ACTIONS.normalize_actions(raw)

func save_gift_actions(actions: Dictionary, soldiers_per_coin: int = -1, engagement: Variant = null) -> bool:
	var updated := settings.duplicate(true)
	updated.giftActions = _clean_gift_actions(actions)
	updated.giftActionsVersion = GIFT_ACTIONS.DEFAULT_ACTIONS_VERSION
	if engagement != null:
		updated.engagementActions = WAR_RULES.normalize_engagement_actions(engagement)
	if soldiers_per_coin > 0:
		updated.soldiersPerCoin = clampi(soldiers_per_coin, 1, 100000)
	if not test_mode and not qa_mode and not _write_json(profile_dir.path_join("settings-v1.json"), updated):
		notice("Hediye eylemleri kaydedilemedi. Eski ayarlar korunuyor.")
		return false
	settings = updated
	rules.set_soldiers_per_coin(int(settings.soldiersPerCoin))
	_save_state()
	dirty = true
	notice("Hediye eylemleri deneme turuna uygulandı." if gift_test.is_active() else "Hediye eylemleri kaydedildi.")
	return true

func _connect() -> void:
	if gift_test.is_active():
		notice("Yayın bağlantısı için hediye testini bitir.")
		return
	var requested := account.text
	var response: Dictionary = await live.connect_account(requested)
	if gift_test.is_active():
		return
	if response.has("error"):
		notice(str(response.error))
	else:
		settings.username = requested.strip_edges().trim_prefix("@")
		_write_json(profile_dir.path_join("settings-v1.json"), settings)

func _live_status() -> void:
	if gift_test.is_active():
		connection_label.text = "●  Hediye testi"
		connection_label.add_theme_color_override("font_color", GOLD)
		return
	var connected: bool = live.status.get("status") == "connected"
	connection_label.text = "●  " + str(live.status.get("message", "Bağlantı bekleniyor"))
	connection_label.add_theme_color_override("font_color", Color("#80d2ab") if connected else MUTED)

func _enqueue_reinforcements(id: String, tanks: int, helicopters: int) -> void:
	if (tanks > 0 or helicopters > 0) and canvas != null and canvas.military != null \
			and canvas.military.has_method("enqueue_reinforcements"):
		canvas.military.enqueue_reinforcements(id, tanks, helicopters)

func accept_live_event(event: Dictionary, defer_checkpoint: bool = false, test_action: Dictionary = {}) -> bool:
	var kind := str(event.get("type", ""))
	var username := str(event.get("username", "")).strip_edges().to_lower()
	if username.is_empty():
		return true
	var id := username
	if kind in ["like", "follow"]:
		return _accept_engagement(event, id, defer_checkpoint)
	elif kind == "gift":
		var receipt := str(event.get("eventId", ""))
		if receipt.strip_edges().is_empty():
			return false
		if inactive_gift_receipts.has(receipt) or rules.has_seen_event(receipt):
			return defer_checkpoint or _save_state()
		var action: Dictionary = test_action if gift_test.is_active() else settings.giftActions.get(str(event.get("giftId", "")), {})
		var price: Variant = event.get("giftCoinValue")
		if price == null or int(price) < 1:
			price = prices.get(str(event.get("giftId", "")), 0)
		if int(price) < 1:
			unknown_gifts[receipt] = event
			notice("Bir hediyenin coin değeri bekleniyor; hediye kaydı korundu.")
			return defer_checkpoint or _save_state()
		# The shared normalizer already hashes channel + source message/combo ID.
		# A new bridge process must not make the same source gift new again.
		var normalized := {"eventId": receipt,
			"participantId": id, "username": username, "nickname": _event_display_name(event, id),
			"portraitUrl": str(event.get("bestPortraitUrl", event.get("avatarUrl", ""))),
			"coinValue": int(price), "completedCount": int(event.get("repeatCount", 1))}
		var action_amount := int(action.get("count", 0))
		match action.get("unit", ""):
			"tank": normalized.bonusTanksPerGift = action_amount
			"helicopter": normalized.bonusHelicoptersPerGift = action_amount
			"jet": normalized.bonusJetsPerGift = action_amount
			"factory": normalized.bonusFactoriesPerGift = action_amount
			"headquarters": normalized.headquartersPerGift = 1
			"soldiers": normalized.soldiersPerGift = action_amount
		var result: Dictionary = rules.accept_event(normalized)
		if not result.ok:
			notice("Hediye işlenemedi: " + str(result.get("error", "")))
			return false
		if result.get("applied", false):
			unknown_gifts.erase(receipt)
			accepted_live_counts.gift += 1
			avatar_left = 0.0
			refresh_left = 0.0
			dirty = true
			if rules.view_state().phase != "results":
				_enqueue_reinforcements(id, int(result.bonusTanksAdded) + int(result.get("automaticTanksAdded", 0)),
					int(result.bonusHelicoptersAdded) + int(result.automaticHelicoptersAdded))
				_break_conquest(id, int(result.coinsAdded))
			if action.get("unit") == "surrounding":
				pending_surrounding[id] = true
				_try_gift_surrounding(id)
			elif action.get("unit") == "missile":
				var prior := int(pending_missiles.get(id, 0))
				@warning_ignore("integer_division")
				var capacity := (WAR_RULES.MAX_INTEGER - prior) / action_amount
				pending_missiles[id] = prior + action_amount * mini(normalized.completedCount, capacity)
				missile_checkpoint_due = true
				missile_retry_left = 0.0
		return defer_checkpoint or _save_state()
	elif kind == "chat":
		var comment := str(event.get("comment", ""))
		if is_join_command(comment):
			return _accept_chat_join(event, id, defer_checkpoint)
		var target_number: int = rules.parse_attack_target(comment)
		var attack_request := comment.strip_edges().to_lower().replace("ı", "i") in ["saldir", "saldiri"]
		var air_show := is_air_show_command(username, comment)
		if target_number < 1 and not attack_request and not air_show:
			accepted_live_counts.chat += 1
			return true
		var receipt := str(event.get("eventId", ""))
		if receipt.is_empty():
			return false
		if processed_chat.has(receipt) or inactive_chat_receipts.has(receipt):
			return (air_show and defer_checkpoint) or _save_state()
		processed_chat[receipt] = true
		accepted_live_counts.chat += 1
		if air_show:
			_play_air_show()
			return defer_checkpoint or _save_state()
		if attack_request:
			if not rules.get_participant(id).is_empty() and rules.round_phase() != "results":
				attack_request_number += 1
				attack_requests[id] = attack_request_number
				refresh_left = 0.0
				dirty = true
				roster.get_parent().set_deferred("scroll_vertical", 0)
			return _save_state()
		var target := ""
		for p in rules.view_state().participants:
			if p.number == target_number:
				target = p.id
				break
		var result := _issue_attack(id, target)
		if result.ok:
			notice("@%s saldırı emri verdi." % username)
			dirty = true
		return _save_state()
	else:
		accepted_live_counts.other += 1
	return true


func is_air_show_command(username: String, comment: String) -> bool:
	return not air_show_account.is_empty() and username == air_show_account \
		and not air_show_command.is_empty() and comment.strip_edges() == air_show_command


func is_join_command(comment: String) -> bool:
	var command := comment.strip_edges().trim_prefix("!").replace("İ", "i").to_lower()
	return command in ["katıl", "katil"]


func _accept_chat_join(event: Dictionary, id: String, defer_checkpoint: bool) -> bool:
	var receipt := str(event.get("eventId", "")).strip_edges()
	if receipt.is_empty() or id.length() > 64:
		return true
	if processed_chat.has(receipt) or inactive_chat_receipts.has(receipt):
		return defer_checkpoint or _save_state()
	var result: Dictionary = rules.accept_chat_join({
		"eventId": "chat-join:" + receipt, "participantId": id, "username": id,
		"nickname": _event_display_name(event, id),
		"portraitUrl": str(event.get("bestPortraitUrl", event.get("avatarUrl", "")))
	})
	processed_chat[receipt] = true
	accepted_live_counts.chat += 1
	if not result.ok:
		notice("Katılma komutu bu orduya uygulanamadı.")
	elif result.get("applied", false):
		avatar_left = 0.0
		refresh_left = 0.0
		dirty = true
		_enqueue_reinforcements(id, int(result.bonusTanksAdded) + int(result.automaticTanksAdded),
			int(result.bonusHelicoptersAdded) + int(result.automaticHelicoptersAdded))
	return defer_checkpoint or _save_state()


func _accept_engagement(event: Dictionary, id: String, defer_save: bool) -> bool:
	var receipt := str(event.get("eventId", "")).strip_edges()
	if receipt.is_empty() or id.length() > 64 or inactive_gift_receipts.has(receipt):
		return true
	var broadcast := str(event.get("broadcastChannel", settings.username)).strip_edges().trim_prefix("@").to_lower().left(64)
	var normalized := {"type": event.type, "eventId": receipt, "participantId": id,
		"username": id, "nickname": _event_display_name(event, id),
		"portraitUrl": str(event.get("bestPortraitUrl", event.get("avatarUrl", ""))),
		"broadcastChannel": broadcast, "likeCount": event.get("likeCount")}
	var result: Dictionary = rules.accept_engagement(normalized, settings.engagementActions[event.type])
	if not result.ok:
		if result.error == "invalid_like_count":
			return true
		notice("Etkileşim ödülü işlenemedi: " + str(result.error))
		return false
	if result.applied:
		avatar_left = 0.0
		refresh_left = 0.0
		if rules.round_phase() != "results":
			_enqueue_reinforcements(id, int(result.bonusTanksAdded) + int(result.get("automaticTanksAdded", 0)),
				int(result.bonusHelicoptersAdded) + int(result.automaticHelicoptersAdded))
		dirty = true
	return defer_save or save_live_checkpoint()


func _event_display_name(event: Dictionary, id: String) -> String:
	var nickname := str(event.get("nickname", "")).strip_edges()
	if not nickname.is_empty() and nickname.to_lower() != id:
		return nickname
	return str(rules.get_participant(id).get("nickname", id))


func save_live_checkpoint() -> bool:
	return _save_state()


func _error_text(error: String) -> String:
	return {"placement_not_allowed": "Yerleştirmek için hazırlığa veya devam eden savaşa dön.",
		"region_owned": "Bu bölgenin bir sahibi var. Boş bölge seç veya saldırı emri ver.",
		"already_placed": "Bu ordu zaten haritada. Yeni bölgeler savaşla kazanılır.",
		"participant_in_battle": "Bu ordu zaten savaşıyor.",
		"round_not_running": "Sohbetten saldırmak için yayıncının ilk saldırısını bekle.",
		"no_troops": "Saldıran orduda asker kalmadı. Yeni hediyeyle destek gelebilir.",
		"self_attack": "Saldırı için rakibe ait bir bölge seç.",
		"round_paused": "Savaş duraklatıldı. Üstteki Devam et düğmesini kullan.",
		"participant_not_placed_or_empty": "Saldıran ordunun haritada askeri olmalı.",
		"quantity_overflow": "Bu ordu daha fazla birlik alamıyor.",
		"headquarters_exists": "Bu bölgede karargâh zaten var ya da yapım sırasına alındı.",
		"helicopter_required": "Uzak bölgeye saldırmak için helikopter veya jet gerekli.",
		"participant_unplaced": "Önce orduları haritaya yerleştir.", "target_unplaced": "Hedef ordunun haritaya yerleşmesi gerekiyor."}.get(error, "Bu işlem şu anda yapılamıyor.")

func notice(message: String) -> void:
	if notify_label == null:
		return
	notify_label.text = message
	notify_label.add_theme_color_override("font_color", GOLD)
	notice_left = 5.0
	if map_footer != null:
		map_footer.visible = not map_only

func _read_prices() -> void:
	var path := preload("InstallPaths.gd").bridge_directory().path_join("runtime/gift-assets/katalog_tam.json")
	if not FileAccess.file_exists(path):
		return
	var rows: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if rows is Array:
		for row in rows:
			prices[str(row.get("id", ""))] = int(row.get("coins", 0))

func _read_settings() -> void:
	var path := profile_dir.path_join("settings-v1.json")
	if FileAccess.file_exists(path):
		var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if data is Dictionary and data.get("schemaVersion") == 1:
			var ratio: Variant = data.get("soldiersPerCoin", 50)
			var seconds: Variant = data.get("battleSeconds", DEFAULT_COMBAT_SECONDS)
			var headquarters: Variant = data.get("headquartersTroops", DEFAULT_TERRITORY_TROOPS)
			if typeof(ratio) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(ratio)):
				settings.soldiersPerCoin = clampi(int(ratio), 1, 100000)
			if typeof(seconds) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(seconds)):
				var minimum := 20.0 if data.get("battlePacingVersion") == COMBAT_PACING_VERSION else DEFAULT_COMBAT_SECONDS
				settings.battleSeconds = clampf(float(seconds), minimum, 180.0)
			if typeof(headquarters) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(headquarters)):
				settings.headquartersTroops = clampi(int(headquarters), 1, DEFAULT_TERRITORY_TROOPS)
			var tilt: Variant = data.get("cameraTilt")
			if typeof(tilt) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(tilt)):
				settings.cameraTilt = clampf(float(tilt), 35.0, 82.0)
			settings.username = str(data.get("username", "")).left(64)
			var actions_version := int(data.get("giftActionsVersion", 0))
			settings.giftActions = GIFT_ACTIONS.migrate_actions(data.get("giftActions", {}), actions_version)
			settings.engagementActions = WAR_RULES.normalize_engagement_actions(data.get("engagementActions"))
			var vehicle_defaults := {"tankPower": 100, "helicopterPower": 300, "jetPower": WAR_RULES.JET_POWER}
			for field in vehicle_defaults:
				var power: Variant = data.get(field, vehicle_defaults[field])
				if typeof(power) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(power)):
					settings[field] = clampi(int(power), 0, 100000)
			if actions_version < GIFT_ACTIONS.DEFAULT_ACTIONS_VERSION and not test_mode and not qa_mode:
				data.giftActions = settings.giftActions
				data.giftActionsVersion = GIFT_ACTIONS.DEFAULT_ACTIONS_VERSION
				if not _write_json(path, data):
					push_warning("Varsayılan hediye eylemleri kaydedilemedi.")

func _read_state() -> void:
	if qa_mode or test_mode:
		return
	map_worlds.clear()
	country_leaders.clear()
	var path := profile_dir.path_join("world-v1.json")
	if FileAccess.file_exists(path):
		var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if data is Dictionary and data.get("schemaVersion") == 1:
			var saved_leaders: Variant = data.get("countryLeaders")
			if saved_leaders is Dictionary:
				country_leaders = saved_leaders
			if data.get("rules") is Dictionary:
				var original: Dictionary = data.duplicate()
				original.erase("mapWorlds")
				original.erase("countryLeaders")
				map_worlds.original = original
			var extra: Variant = data.get("mapWorlds", {})
			if extra is Dictionary:
				for id: String in ["turkiye", "world"]:
					if extra.get(id) is Dictionary:
						map_worlds[id] = extra[id]
	_restore_map_state()

func _apply_rules_settings() -> void:
	rules.set_soldiers_per_coin(int(settings.soldiersPerCoin))
	rules.set_battle_seconds(float(settings.battleSeconds))
	rules.set_vehicle_power(int(settings.get("tankPower", 100)), int(settings.get("helicopterPower", 300)),
		int(settings.get("jetPower", WAR_RULES.JET_POWER)))

func _restore_map_state() -> void:
	_reset_conquest()
	headquarters_pulses.clear()
	unknown_gifts.clear()
	processed_chat.clear()
	battle_routes.clear()
	surrounding_orders.clear()
	pending_surrounding.clear()
	pending_missiles.clear()
	missile_checkpoint_due = false
	attack_requests.clear()
	attack_request_number = 0
	surrounding_check_left = 0.0
	inactive_gift_receipts.clear()
	inactive_chat_receipts.clear()
	for id in map_worlds:
		if id == map_id:
			continue
		var inactive: Dictionary = map_worlds[id]
		var other_rules: Dictionary = inactive.get("rules", {}) if inactive.get("rules") is Dictionary else {}
		_index_receipts(inactive_gift_receipts, other_rules.get("seenEventIds"))
		_index_receipts(inactive_chat_receipts, inactive.get("chatReceipts"))
		# The first delivery's map also owns gifts waiting for a catalog price.
		var waiting: Variant = inactive.get("unknownGifts")
		if waiting is Dictionary:
			_index_receipts(inactive_gift_receipts, waiting.keys())
	var data: Dictionary = map_worlds.get(map_id, {})
	if data.get("schemaVersion") == 1 and data.get("rules") is Dictionary:
		var restored: Dictionary = rules.restore_state(data.rules)
		if not restored.ok:
			_apply_rules_settings()
			return
		if data.get("battlePacingVersion") != COMBAT_PACING_VERSION:
			var paced: Dictionary = rules.serialize_state()
			var extended := false
			for battle in paced.battles:
				var previous := float(battle.duration)
				if previous < DEFAULT_COMBAT_SECONDS:
					battle.elapsed = float(battle.elapsed) / previous * DEFAULT_COMBAT_SECONDS
					battle.duration = DEFAULT_COMBAT_SECONDS
					extended = true
			if extended:
				rules.restore_state(paced)
		var phase: String = rules.view_state().phase
		if phase == "running":
			rules.pause_round()
		elif phase == "results":
			rules.reset_round(true, true)
		var remaining: Variant = data.get("conquestLeft")
		var prior_owner: Variant = data.get("conquestOwner")
		if phase in ["running", "paused"] and prior_owner is String \
				and typeof(remaining) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(remaining)):
			conquest_owner = prior_owner
			conquest_left = clampf(float(remaining), 0.0, CONQUEST_SECONDS)
		var waiting: Variant = data.get("unknownGifts", {})
		unknown_gifts = waiting.duplicate(true) if waiting is Dictionary else {}
		_index_receipts(processed_chat, data.get("chatReceipts"))
		var pending: Variant = data.get("pendingSurrounding", [])
		if pending is Array:
			for actor in pending:
				if actor is String and not rules.get_participant(actor).is_empty():
					pending_surrounding[actor] = true
		var queued_missiles: Variant = data.get("pendingMissiles", {})
		if queued_missiles is Dictionary:
			for actor in queued_missiles:
				var damage: Variant = queued_missiles[actor]
				if actor is String and not rules.get_participant(actor).is_empty() \
						and typeof(damage) in [TYPE_INT, TYPE_FLOAT] and float(damage) >= 1.0 \
						and float(damage) <= float(WAR_RULES.MAX_INTEGER) and float(damage) == floorf(float(damage)):
					pending_missiles[actor] = int(damage)
		var requests: Variant = data.get("attackRequests", [])
		if requests is Array:
			for actor in requests:
				if actor is String and not rules.get_participant(actor).is_empty():
					attack_request_number += 1
					attack_requests[actor] = attack_request_number
		var orders: Variant = data.get("surroundingOrders")
		if orders is Dictionary:
			for actor in orders:
				var queued: Variant = orders[actor]
				if not actor is String or rules.get_participant(actor).is_empty() or not queued is Array:
					continue
				var targets: Array[String] = []
				for opponent in queued.slice(0, canvas.regions.size()):
					if opponent is String and opponent != actor and opponent not in targets and not rules.get_participant(opponent).is_empty():
						targets.append(opponent)
				if not targets.is_empty():
					surrounding_orders[actor] = targets
		var routes: Variant = data.get("battleRoutes", {})
		if routes is Dictionary:
			for active in rules.view_state().battles:
				var key := str(int(active.id))
				var route: Variant = routes.get(key)
				if route is Dictionary:
					var from_value: Variant = route.get("from", -1)
					var to_value: Variant = route.get("to", -1)
					if typeof(from_value) in [TYPE_INT, TYPE_FLOAT] and typeof(to_value) in [TYPE_INT, TYPE_FLOAT] \
						and rules.get_region_owner(int(from_value)) == active.actorId and rules.get_region_owner(int(to_value)) == active.targetId:
						var contact: Variant = route.get("contact", from_value)
						if typeof(contact) not in [TYPE_INT, TYPE_FLOAT] or rules.get_region_owner(int(contact)) != active.actorId:
							contact = from_value
						battle_routes[key] = {"from": int(from_value), "to": int(to_value), "contact": int(contact), "airborne": route.get("airborne") == true}
	# Saved battles retain their own duration. New battles use current settings.
	_apply_rules_settings()

func _index_receipts(index: Dictionary, receipts: Variant) -> void:
	if receipts is Array:
		for receipt in receipts:
			if receipt is String and not receipt.is_empty():
				index[receipt] = true

func _write_json(path: String, data: Dictionary) -> bool:
	if is_instance_valid(gift_test) and gift_test.is_active():
		return true
	var temporary := path + ".tmp"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data))
	file.flush()
	file.close()
	return DirAccess.rename_absolute(temporary, path) == OK

func _save_state(forced_winner: String = "") -> bool:
	var occupant: String = rules.territory_champion()
	var phase: String = rules.round_phase()
	if forced_winner.is_empty() and phase == "running" and occupant != conquest_owner:
		_reset_conquest()
		conquest_owner = occupant
		if not occupant.is_empty():
			_show_conquest_count()
	var champion := forced_winner
	if champion.is_empty() and not conquest_owner.is_empty() and occupant == conquest_owner and conquest_left <= 0.0:
		champion = conquest_owner
	var scorecard := country_leaders
	var rule_save: Dictionary = rules.serialize_state()
	var next_surrounding := pending_surrounding
	var next_missiles := pending_missiles
	var winner := {}
	var finished_rules: RefCounted
	var winner_regions := 0
	if not champion.is_empty():
		var player: Dictionary = rules.get_participant(champion)
		winner_regions = player.regions.size()
		var username := str(player.get("username", "")).strip_edges().trim_prefix("@")
		var nickname := str(player.get("nickname", "")).strip_edges()
		if nickname.is_empty():
			nickname = "@" + username if not username.is_empty() else "Oyuncu #%d" % player.number
		var previous: Variant = country_leaders.get(champion)
		var previous_wins := 0
		if previous is Dictionary and typeof(previous.get("wins")) in [TYPE_INT, TYPE_FLOAT]:
			previous_wins = clampi(int(previous.wins), 0, 2147483646)
		winner = {"uniqueId": username.left(64), "displayName": nickname.left(80), "wins": previous_wins + 1}
		scorecard = country_leaders.duplicate()
		scorecard[champion] = winner
		# Commit the clean board and score together before switching the visible game.
		finished_rules = WAR_RULES.new(canvas.regions.size(), false, _uses_soldier_aviation())
		if not finished_rules.restore_state(rule_save).ok:
			notice("Tur sonucu hazırlanamadı.")
			return false
		if phase == "staging":
			finished_rules.start_round()
		finished_rules.finish_round()
		finished_rules.reset_round(true, true)
		next_surrounding = pending_surrounding.duplicate()
		for actor in pending_surrounding:
			if finished_rules.get_participant(actor).is_empty():
				next_surrounding.erase(actor)
		next_missiles = _retained_missiles(finished_rules)
		rule_save = finished_rules.serialize_state()
	var ordered_requests := attack_requests.keys()
	ordered_requests.sort_custom(func(a: String, b: String) -> bool: return attack_requests[a] < attack_requests[b])
	var current := {"schemaVersion": 1, "battlePacingVersion": COMBAT_PACING_VERSION,
		"rules": rule_save, "unknownGifts": unknown_gifts.duplicate(true),
		"conquestOwner": conquest_owner if winner.is_empty() else "",
		"conquestLeft": conquest_left if winner.is_empty() else CONQUEST_SECONDS,
		"chatReceipts": processed_chat.keys(), "attackRequests": ordered_requests if winner.is_empty() else [],
		"pendingSurrounding": next_surrounding.keys(),
		"pendingMissiles": next_missiles.duplicate(),
		"battleRoutes": battle_routes.duplicate(true) if winner.is_empty() else {},
		"surroundingOrders": surrounding_orders.duplicate(true) if winner.is_empty() else {}}
	var worlds := map_worlds.duplicate()
	worlds[map_id] = current
	if not qa_mode and not test_mode:
		# Keep the original map at the schema-1 root for existing saves.
		var document: Dictionary = worlds.get("original", {"schemaVersion": 1}).duplicate()
		document.countryLeaders = scorecard
		var extra := worlds.duplicate()
		extra.erase("original")
		if not extra.is_empty():
			document.mapWorlds = extra
		if not _write_json(profile_dir.path_join("world-v1.json"), document):
			if not winner.is_empty():
				notice("Zafer kaydedilemedi. Tekrar deneniyor." if forced_winner.is_empty()
					else "Zafer kaydedilemedi. Savaşı bitir düğmesiyle tekrar dene.")
			return false
	map_worlds = worlds
	missile_checkpoint_due = false
	if not winner.is_empty():
		rules = finished_rules
		pending_surrounding = next_surrounding
		pending_missiles = next_missiles
		_cancel_missile()
		_reset_conquest()
		country_leaders = scorecard
		headquarters_pulses.clear()
		battle_routes.clear()
		surrounding_orders.clear()
		attack_requests.clear()
		canvas.military.clear_reinforcements()
		canvas.territory_surface.clear_headquarters_destruction()
		war_notice.clear()
		canvas.map_hud.cancel_region_action()
		canvas.selected_region = -1
		selected_player = ""
		selected_target = ""
		victory_scene.show_winner(champion, winner.displayName, MAP_LABELS[map_id],
			winner_regions, canvas.regions.size(), winner.wins)
		dirty = true
	return true

func _show_conquest_count() -> void:
	if conquest_overlay != null:
		conquest_overlay.set_count(ceili(conquest_left))


func _reset_conquest() -> void:
	conquest_owner = ""
	conquest_left = CONQUEST_SECONDS
	conquest_retry_left = 0.0
	if conquest_overlay != null:
		conquest_overlay.set_count(0)


func _advance_conquest(delta: float) -> void:
	var before := ceili(conquest_left)
	conquest_left = maxf(0.0, conquest_left - delta)
	if conquest_left <= 0.0:
		conquest_retry_left -= delta
		if conquest_retry_left <= 0.0 and not _save_state():
			conquest_retry_left = 1.5
	elif ceili(conquest_left) != before:
		_show_conquest_count()


func _break_conquest(id: String, coins: int) -> void:
	if coins < BREAK_SIEGE_COINS or conquest_owner.is_empty() or conquest_left <= 0.0 \
			or rules.round_phase() != "running" or id == conquest_owner:
		return
	var territories: Array = rules.get_participant(conquest_owner).get("garrisonOrder", [])
	if territories.size() < 2:
		return
	# Take the newest outlying territory, leaving the champion's command seat in place.
	var region := int(territories.back())
	var result: Dictionary = rules.claim_challenger_region(id, conquest_owner, region)
	if not result.ok:
		return
	_clear_disbanded_battles(result)
	_reset_conquest()
	notice("%s · %s bölgesine çıktı. Fetih sayımı durdu." % [player_view(id).nickname, canvas.region_display_name(region)])


func _clear_disbanded_battles(result: Dictionary) -> void:
	for battle_id in result.get("cancelledBattles", []):
		battle_routes.erase(battle_id)
	surrounding_orders.erase(str(result.get("owner", "")))


func _clear_selected_region() -> bool:
	if canvas == null or canvas.map_hud == null or (victory_scene != null and victory_scene.visible):
		return false
	var region := int(canvas.selected_region)
	var result: Dictionary = rules.clear_region(region)
	if not result.ok:
		return false
	headquarters_pulses.erase(region)
	_clear_disbanded_battles(result)
	_reset_conquest()
	canvas.map_hud.cancel_region_action()
	canvas.selected_region = -1
	selected_player = ""
	selected_target = ""
	var saved := _save_state()
	_refresh()
	notice("Seçili bölge temizlendi." if saved else "Bölge temizlendi, kayıt yazılamadı.")
	return true


func _update_army_widget() -> void:
	var rows: Array[Dictionary] = []
	var battles := battle_views()
	for participant: Dictionary in state.get("participants", []):
		var units := combat_unit_counts(str(participant.id), battles)
		if int(units.soldiers) > 0:
			rows.append({"name": display_player_name(participant).left(80), "soldiers": int(units.soldiers),
				"tanks": int(units.tanks), "helicopters": int(units.helicopters), "jets": int(units.jets)})
	var document := {"rows": rows}
	var serialized := JSON.stringify(document)
	if serialized != widget_rows and _write_json(profile_dir.path_join("widget-armies-v1.json"), document):
		widget_rows = serialized


func _start_leaders_widget(publish := false) -> bool:
	if leaders_pid > 0 and OS.is_process_running(leaders_pid):
		return true
	var bridge := preload("InstallPaths.gd").bridge_directory()
	var runtime := bridge.path_join("runtime/node.exe")
	var script := bridge.path_join("country-leaders-widget.cjs")
	if not FileAccess.file_exists(runtime) or not FileAccess.file_exists(script):
		return false
	var args := PackedStringArray([script, profile_dir.path_join("world-v1.json"),
		str(OS.get_process_id()), str(leaders_port)])
	if publish:
		var license := OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS).path_join("MNG TikTok Game/license-backup.json")
		args.append(license)
	widget_rows = ""
	_update_army_widget()
	leaders_pid = OS.create_process(runtime, args, false)
	return leaders_pid > 0

func _leaders_url() -> String:
	return "http://127.0.0.1:%d/ulke-liderleri" % leaders_port

func _copy_leaders_link() -> void:
	await _copy_widget_link("fetih-liderler")


func _copy_widget_link(kind: String) -> void:
	if gift_test.is_active():
		notice("Widget bağlantısı için hediye testini bitir.")
		return
	if not _start_leaders_widget(true):
		notice("Fetih widget’ı başlatılamadı.")
		return
	leaders_button.disabled = true
	armies_button.disabled = true
	notice("HTTPS yayın bağlantısı hazırlanıyor…")
	var copied := ""
	var usable_locally := false
	var status_path := profile_dir.path_join("widget-link-v1.json")
	var local := _leaders_url() if kind == "fetih-liderler" else "http://127.0.0.1:%d/ordu-siralamasi" % leaders_port
	var probe := HTTPRequest.new()
	probe.timeout = 1.0
	add_child(probe)
	for attempt in 25:
		if not OS.is_process_running(leaders_pid):
			break
		var doc: Variant = JSON.parse_string(FileAccess.get_file_as_string(status_path)) if FileAccess.file_exists(status_path) else null
		if doc is Dictionary and int(doc.get("pid", -1)) == leaders_pid:
			var link := str(doc.get("links", {}).get(kind, ""))
			if link.begins_with("https://mng-license-server1.onrender.com/overlays/"):
				copied = link
				break
			if doc.get("status") == "license-required":
				break
		await get_tree().create_timer(0.25).timeout
	if copied.is_empty() and OS.is_process_running(leaders_pid) and probe.request(local) == OK:
		var response: Array = await probe.request_completed
		var title := "Ülke Liderleri" if kind == "fetih-liderler" else "Ordu Sıralaması"
		var html: PackedByteArray = response[3]
		usable_locally = response[0] == HTTPRequest.RESULT_SUCCESS and response[1] == 200 and title in html.get_string_from_utf8()
	probe.queue_free()
	leaders_button.disabled = false
	armies_button.disabled = false
	if not copied.is_empty():
		DisplayServer.clipboard_set(copied)
		notice("HTTPS widget bağlantısı kopyalandı. Yayın programına tarayıcı kaynağı olarak ekle.")
	elif usable_locally:
		DisplayServer.clipboard_set(local)
		notice("Yerel OBS bağlantısı kopyalandı. HTTPS için TikMnG lisansını kontrol edip tekrar dene.")
	else:
		notice("Fetih widget bağlantısı açılamadı. Biraz sonra tekrar dene.")

func _exit_tree() -> void:
	_flush_avatar_writes()
	if leaders_pid > 0 and OS.is_process_running(leaders_pid):
		OS.kill(leaders_pid)

func _close() -> void:
	if is_instance_valid(gift_test):
		gift_test.finish(false)
	if not test_mode and not qa_mode:
		var error := WINDOW_PLACEMENT.save(get_window(), profile_dir)
		if error != OK:
			push_warning("Fetih pencere konumu kaydedilemedi: " + error_string(error))
	_save_state()
	get_tree().quit()

func _input(event: InputEvent) -> void:
	if event is InputEventKey and not event.pressed and (event.physical_keycode == KEY_H or event.keycode == KEY_H):
		_set_battle_boost(false)


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode == KEY_F11:
		WINDOW_PLACEMENT.remember(get_window())
		get_window().mode = Window.MODE_WINDOWED if get_window().mode == Window.MODE_FULLSCREEN else Window.MODE_FULLSCREEN
		get_viewport().set_input_as_handled()
	elif event.physical_keycode == KEY_H or event.keycode == KEY_H:
		var focused := get_viewport().gui_get_focus_owner()
		if focused is LineEdit or focused is TextEdit:
			return
		_set_battle_boost(true)
		get_viewport().set_input_as_handled()
	elif map_only and event.keycode != KEY_T:
		return
	elif event.keycode == KEY_B and not get_viewport().gui_get_focus_owner() is LineEdit:
		_open_actions()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_P and not get_viewport().gui_get_focus_owner() is LineEdit:
		if _clear_selected_region():
			get_viewport().set_input_as_handled()
	elif event.keycode == KEY_T and not get_viewport().gui_get_focus_owner() is LineEdit:
		_toggle_map_only()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_ESCAPE:
		if gift_test.cancel_selection():
			get_viewport().set_input_as_handled()
			return
		if victory_scene != null and victory_scene.visible:
			victory_scene.dismiss()
		elif dialog.visible:
			dialog.hide()
		elif canvas == null or not canvas.map_hud.cancel_region_action():
			_settings_dialog()
		get_viewport().set_input_as_handled()

func _run_qa() -> void:
	await get_tree().process_frame
	var names := ["TikMnG Test", "Deniz", "Ece", "Kaan"]
	var qa_regions := [2, 10, 5, 13] if map_id == "turkiye" else [2, 3, 10, 27]
	for index in 4:
		accept_live_event({"eventId": "qa-" + str(index), "type": "gift", "username": "qa_" + str(index),
			"nickname": names[index], "giftCoinValue": [100, 60, 20, 40][index], "repeatCount": 1})
		place_player("qa_" + str(index), qa_regions[index])
	grant_region_headquarters(qa_regions[0])
	await get_tree().create_timer(1.5).timeout
	if not qa_capture.is_empty():
		DirAccess.make_dir_recursive_absolute(qa_capture)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(qa_capture.path_join("01-map.png"))
	var selected_region: int = qa_regions[0]
	var target_region: int = qa_regions[1]
	if not qa_capture.is_empty():
		canvas.pan_world = canvas.world_point(canvas.regions[selected_region].center)
		canvas.zoom_factor = 2.6
		canvas._apply_transform()
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(qa_capture.path_join("06-patrol-close.png"))
		canvas.reset_view()
	canvas.map_hud.handle_map_click(selected_region, canvas.project_map_point(canvas.regions[selected_region].center))
	if not qa_capture.is_empty():
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(qa_capture.path_join("05-region-actions.png"))
	canvas.map_hud.action_buttons[0].pressed.emit()
	canvas.map_hud.handle_map_click(target_region, canvas.project_map_point(canvas.regions[target_region].center))
	var battles := battle_views()
	if battles.is_empty():
		push_error("Visual QA could not start its battle.")
		get_tree().quit(1)
		return
	var deployment := float(battles[0].deployment)
	rules.tick(maxf(0.8, deployment * 0.51))
	_refresh()
	await get_tree().create_timer(0.2).timeout
	if not qa_capture.is_empty():
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(qa_capture.path_join("02-battle.png"))
		rules.tick(deployment * 0.55 + 3.4)
		await get_tree().create_timer(0.24).timeout
		var front: Array[Dictionary] = canvas.battle_fronts()
		if not front.is_empty() and not front[0].points.is_empty():
			var points: Array = front[0].points
			canvas.pan_world = canvas.world_point(points[points.size() / 2])
			canvas.zoom_factor = 2.8
			canvas._apply_transform()
			await get_tree().create_timer(0.35).timeout
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(qa_capture.path_join("03-battle-close.png"))
		_open_actions()
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		if gift_dialog.is_embedded():
			var gift_image := gift_dialog.get_texture().get_image()
			if gift_image != null and not gift_image.is_empty():
				gift_image.save_png(qa_capture.path_join("04-gift-actions.png"))
		gift_dialog.hide()
	print("ANIMAL_LIVE_VISUAL_QA_OK: %s map, 4 donors, placement and publisher-started battle" % map_id)
	if "--qa-exit" in OS.get_cmdline_user_args():
		if not _verify_standalone_reset():
			push_error("Standalone combat, results, reset or replay verification failed.")
			get_tree().quit(1)
			return
		print("FETIH_STANDALONE_ROUND_OK")
		get_tree().quit()

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
	if rules.round_phase() != "staging" or not victory_scene.visible:
		return false
	for region in rules.view_state().regions:
		if not region.ownerId.is_empty():
			return false
	var follow := {"eventId": "qa-follow", "type": "follow", "username": "qa_follower"}
	if not accept_live_event(follow) or not accept_live_event(follow):
		return false
	var follower: Dictionary = rules.get_participant("qa_follower")
	if follower.troops != 100 or follower.bonusJets != 1:
		return false
	var music: AudioStreamPlayer = victory_scene.get("music")
	var voice: AudioStreamPlayer = victory_scene.get("voice")
	if music.stream == null or voice.stream == null:
		return false
	victory_scene.dismiss()
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
	if not drop_army("qa_pending", 0).get("ok", false):
		return false
	var starter := unit_counts("qa_pending")
	if int(starter.tanks) != 1 or int(starter.helicopters) != 1 or int(starter.jets) != 1:
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
