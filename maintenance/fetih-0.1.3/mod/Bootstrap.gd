extends Node

const Placement = preload("WindowPlacement.gd")
const Startup = preload("StartupScreen.gd")
const MINIMUM_DISPLAY_MS := 750

var launcher_signal := ""

func _ready() -> void:
	_start.call_deferred()

func _start() -> void:
	var root := get_tree().root
	var directory: String = get_script().resource_path.get_base_dir()
	var startup_layer: CanvasLayer
	var startup: Startup
	var rendered_at := 0
	launcher_signal = OS.get_environment("TIKMNG_FETIH_STARTUP_SIGNAL")
	var graphical := DisplayServer.get_name() != "headless"
	if graphical:
		root.title = "TikMnG · FETİH"
		root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
		root.content_scale_size = Vector2i.ZERO
		Placement.restore(root, Placement.profile_directory(directory))
		if launcher_signal.is_empty():
			startup_layer = CanvasLayer.new()
			startup_layer.layer = 90
			root.add_child(startup_layer)
			startup = Startup.new()
			startup.artwork = preload("res://assets/art/fetih-startup.jpg")
			startup_layer.add_child(startup)
			await RenderingServer.frame_post_draw
			rendered_at = Time.get_ticks_msec()
			print("FETIH_LOADING_VISIBLE: screen=%d %s %s" % [root.current_screen, root.position, root.size])
			_capture_loading()
			startup.loading_stage(2)
		elif not _signal_launcher(2):
			return

	var script: Script = load(directory.path_join("LiveWar.gd"))
	if script == null or not script.can_instantiate():
		push_error("TikMnG Fetih yüklenemedi.")
		get_tree().quit(1)
		return
	if startup != null:
		startup.loading_stage(3)
		await RenderingServer.frame_post_draw
	elif not _signal_launcher(3):
		return

	var game: Node = script.new()
	game.mod_root = directory
	add_child(game)
	if game.get("live") == null:
		get_tree().quit(1)
		return
	if not graphical:
		return
	await RenderingServer.frame_post_draw
	if not _signal_launcher(4):
		return
	if startup != null:
		startup.loading_stage(4)
		var remaining_ms := MINIMUM_DISPLAY_MS - (Time.get_ticks_msec() - rendered_at)
		await get_tree().create_timer(maxf(0.17, remaining_ms / 1000.0)).timeout
		var fade := get_tree().create_tween()
		fade.tween_property(startup, "modulate:a", 0.0, 0.16)
		await fade.finished
		startup_layer.queue_free()
	print("FETIH_LOADING_FINISHED: screen=%d %s %s" % [root.current_screen, root.position, root.size])
	if not launcher_signal.is_empty():
		await get_tree().create_timer(0.45).timeout
	if not root.has_focus() and not game.qa_mode and not game.test_mode:
		await root.focus_entered
	preload("MissileIntro.gd").show_once(game)

func _signal_launcher(stage: int) -> bool:
	if launcher_signal.is_empty():
		return true
	var file := FileAccess.open(launcher_signal, FileAccess.WRITE)
	if file == null:
		push_error("Fetih yükleme durumu başlatıcıya yazılamadı.")
		get_tree().quit(1)
		return false
	file.store_string(str(stage))
	file.flush()
	file.close()
	print("FETIH_LAUNCHER_STAGE: ", stage)
	return true

func _capture_loading() -> void:
	var root := get_tree().root
	var arguments := OS.get_cmdline_user_args()
	if not "--qa-scene" in arguments:
		return
	for argument in arguments:
		if not argument.begins_with("--qa-output="):
			continue
		var path := argument.trim_prefix("--qa-output=")
		if path.is_empty():
			return
		DirAccess.make_dir_recursive_absolute(path)
		var screenshot := root.get_texture().get_image()
		if screenshot != null and screenshot.save_png(path.path_join("00-fetih-loading.png")) == OK:
			print("FETIH_LOADING_CAPTURE_OK")
		else:
			push_error("Fetih yükleme ekranı test görüntüsü yazılamadı.")
		return
