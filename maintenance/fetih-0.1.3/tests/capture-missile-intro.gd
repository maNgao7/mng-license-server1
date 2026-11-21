extends SceneTree

## Run with --fixed-fps 30 --resolution 1280x800 -- --self-test --capture=<empty directory>.

const FRAMES := 186
const RELEASE_FRAME := 18


func _initialize() -> void:
	capture.call_deferred()


func capture() -> void:
	var args := OS.get_cmdline_user_args()
	var profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	var output := ""
	for arg in args:
		if arg.begins_with("--capture="):
			output = arg.trim_prefix("--capture=")
	if output.is_empty() or "--self-test" not in args or not profile.get_file().begins_with("missile-intro-capture-"):
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(output)
	var app: Node = load("res://mod/LiveWar.gd").new()
	app.mod_root = "res://mod"
	root.add_child(app)
	for sample in [["Altın", "captain", 320, 2], ["Mavi", "east", 170, 8], ["Yeşil", "south", 65, 5]]:
		app.accept_live_event({"type": "gift", "username": sample[1], "nickname": sample[0],
			"eventId": "intro-" + sample[1], "giftCoinValue": sample[2], "repeatCount": 1})
		if not app.drop_army(sample[1], sample[3]).ok:
			quit(2)
			return
	app.rules.claim_region("captain", 3)
	app.rules.claim_region("east", 11)
	app.rules.claim_region("south", 6)
	app._refresh()
	app._toggle_map_only()
	await process_frame
	app.canvas.zoom_factor = 1.65
	app.canvas.pan_world = app.canvas.world_point(app.canvas.regions[7].center)
	app.canvas.set_view_tilt(42.0)
	for _frame in 5:
		await RenderingServer.frame_post_draw
	var launched := false
	for frame in FRAMES:
		if frame == RELEASE_FRAME:
			app.accept_live_event({"type": "gift", "username": "captain", "eventId": "intro-whale",
				"giftId": "6820", "giftCoinValue": 2150, "repeatCount": 1})
		await RenderingServer.frame_post_draw
		launched = launched or not app.active_missile.is_empty()
		var image := root.get_texture().get_image()
		image.resize(960, 600, Image.INTERPOLATE_LANCZOS)
		if image.save_jpg(output.path_join("shot-%04d.jpg" % frame), 0.95) != OK:
			quit(3)
			return
	if not launched or app.region_owner(5) != "captain":
		push_error("Captured preview failed to demonstrate a real hit and territory transfer.")
		quit(4)
		return
	print("FETIH_INTRO_CAPTURE_OK frames=%d" % FRAMES)
	quit()
