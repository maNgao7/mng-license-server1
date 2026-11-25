extends RefCounted

const RESTORED_META := &"_tikmng_window_placement_restored"
const WINDOWED_RECT_META := &"_tikmng_windowed_rect"
const MODE_META := &"_tikmng_window_mode"
const MIN_SIZE := Vector2i(1000, 650)
const DEFAULT_SIZE := Vector2i(1280, 800)
const SCHEMA_VERSION := 1
const SLOT_FILES := ["window-placement-v1.json", "window-placement-v1-alt.json"]

static func profile_directory(_mod_root: String) -> String:
	var custom_profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not custom_profile.is_empty():
		return custom_profile
	var base := OS.get_environment("LOCALAPPDATA")
	if "--qa-scene" in OS.get_cmdline_user_args() or "--self-test" in OS.get_cmdline_user_args():
		return base.path_join("TikMnG/FetihStandaloneQA/%d" % OS.get_process_id())
	if "--local-preview" in OS.get_cmdline_user_args():
		return base.path_join("TikMnG/FetihTakviyeOnizleme")
	if "--desktop-profile" in OS.get_cmdline_user_args():
		var previous := base.path_join("TikMnG/AnimalTimesLive")
		if DirAccess.dir_exists_absolute(previous):
			return previous
	return base.path_join("TikMnG/FetihStandalone")

static func restore(window: Window, profile_dir: String) -> void:
	if window == null or window.has_meta(RESTORED_META) or DisplayServer.get_name() == "headless":
		return
	var primary := DisplayServer.get_primary_screen()
	var count := DisplayServer.get_screen_count()
	if primary < 0 or primary >= count:
		return
	var origin := DisplayServer.screen_get_position(primary)
	var monitors: Array[Rect2i] = []
	for index in count:
		monitors.append(_monitor_rect(index, origin))
	var saved := _read_latest(profile_dir)
	var saved_monitor: Rect2i = saved.get("monitor", Rect2i())
	var match_index := _matching_screen(saved_monitor, monitors)
	var screen := primary if match_index == -1 else match_index
	var usable := DisplayServer.screen_get_usable_rect(screen)
	if not usable.has_area():
		usable = Rect2i(monitors[screen].position + origin, monitors[screen].size)
	if not usable.has_area():
		return
	window.set_meta(RESTORED_META, true)
	if window.mode != Window.MODE_WINDOWED:
		window.mode = Window.MODE_WINDOWED
	window.borderless = false
	window.unresizable = false
	if window.current_screen != screen:
		window.current_screen = screen
	var inset_start := (window.position - window.get_position_with_decorations()).max(Vector2i.ZERO)
	var inset_end := (window.get_size_with_decorations() - window.size - inset_start).max(Vector2i.ZERO)
	var client_area := Rect2i(usable.position + inset_start, usable.size - inset_start - inset_end)
	if not client_area.has_area():
		client_area = usable
	var preferred: Rect2i = saved.get("window", Rect2i())
	preferred.position += monitors[screen].position + origin
	var placement := _fit_rect(client_area, preferred, match_index == -1)
	window.min_size = MIN_SIZE.min(client_area.size)
	window.size = placement.size
	window.position = placement.position
	remember(window)
	var mode: Window.Mode = saved.get("mode", Window.MODE_WINDOWED)
	if mode != Window.MODE_WINDOWED:
		window.mode = mode
		window.set_meta(MODE_META, mode)

static func remember(window: Window) -> void:
	if window == null or not window.has_meta(RESTORED_META):
		return
	var mode := window.mode
	if mode == Window.MODE_MINIMIZED:
		return
	window.set_meta(MODE_META, mode)
	if mode == Window.MODE_WINDOWED:
		var rect := Rect2i(window.position, window.size)
		if rect.has_area():
			window.set_meta(WINDOWED_RECT_META, rect)

static func save(window: Window, profile_dir: String) -> Error:
	if window == null or not window.has_meta(RESTORED_META):
		return OK
	remember(window)
	var screen := window.current_screen
	if screen < 0 or screen >= DisplayServer.get_screen_count():
		return ERR_UNAVAILABLE
	var origin := DisplayServer.screen_get_position(DisplayServer.get_primary_screen())
	var monitor := _monitor_rect(screen, origin)
	var normal: Rect2i = window.get_meta(WINDOWED_RECT_META, Rect2i(Vector2i.ZERO, DEFAULT_SIZE))
	normal.position -= origin
	if window.mode != Window.MODE_WINDOWED and not monitor.has_point(normal.get_center()):
		# A maximized window can move monitors without exposing a new normal rect.
		normal.position = monitor.position + (monitor.size - normal.size) / 2
	normal.position -= monitor.position
	return _write_record(profile_dir, monitor, normal, window.get_meta(MODE_META, Window.MODE_WINDOWED))

static func _monitor_rect(screen: int, origin: Vector2i) -> Rect2i:
	# Godot's Windows desktop origin can shift when a monitor is added to the left.
	return Rect2i(DisplayServer.screen_get_position(screen) - origin, DisplayServer.screen_get_size(screen))

static func _matching_screen(saved: Rect2i, monitors: Array[Rect2i]) -> int:
	var exact := monitors.find(saved)
	if exact != -1 or not saved.has_area():
		return exact
	var best := -1
	var best_area := 0
	for index in monitors.size():
		var area := saved.intersection(monitors[index]).get_area()
		if area > best_area:
			best = index
			best_area = area
	return best

static func _fit_rect(available: Rect2i, preferred: Rect2i, center: bool) -> Rect2i:
	var requested := preferred.size if preferred.has_area() else DEFAULT_SIZE.min(available.size - Vector2i(90, 90))
	var size := requested.max(MIN_SIZE).min(available.size)
	var position := preferred.position
	if center or not preferred.intersects(available):
		position = available.position + (available.size - size) / 2
	return Rect2i(position.clamp(available.position, available.end - size), size)

static func _read_latest(profile_dir: String) -> Dictionary:
	var latest: Dictionary = {}
	for slot in SLOT_FILES.size():
		var file := FileAccess.open(profile_dir.path_join(SLOT_FILES[slot]), FileAccess.READ)
		if file == null or file.get_length() > 4096:
			continue
		var json := JSON.new()
		if json.parse(file.get_as_text()) != OK:
			continue
		var record := _decode(json.data)
		if not record.is_empty() and record.generation > latest.get("generation", 0):
			latest = record
			latest.slot = slot
	return latest

static func _decode(data: Variant) -> Dictionary:
	if not data is Dictionary or not _integer_in_range(data.get("schemaVersion"), SCHEMA_VERSION, SCHEMA_VERSION) \
			or not _integer_in_range(data.get("generation"), 1, 1 << 52) \
			or not _integer_in_range(data.get("mode"), Window.MODE_WINDOWED, Window.MODE_EXCLUSIVE_FULLSCREEN) \
			or data.mode == Window.MODE_MINIMIZED:
		return {}
	var monitor := _decode_rect(data.get("monitor"))
	var normal := _decode_rect(data.get("window"))
	if not monitor.has_area() or not normal.has_area():
		return {}
	return {"generation": int(data.generation), "monitor": monitor, "window": normal, "mode": int(data.mode)}

static func _decode_rect(values: Variant) -> Rect2i:
	if not values is Array or values.size() != 4:
		return Rect2i()
	for index in 4:
		if not _integer_in_range(values[index], -1000000 if index < 2 else 1, 1000000):
			return Rect2i()
	return Rect2i(int(values[0]), int(values[1]), int(values[2]), int(values[3]))

static func _integer_in_range(value: Variant, minimum: int, maximum: int) -> bool:
	return (value is int or value is float) and value >= minimum and value <= maximum and floor(value) == value

static func _write_record(profile_dir: String, monitor: Rect2i, normal: Rect2i, mode: Window.Mode) -> Error:
	var latest := _read_latest(profile_dir)
	var slot: int = 1 - latest.get("slot", 1)
	var generation: int = latest.get("generation", 0) + 1
	if generation > (1 << 52):
		return ERR_INVALID_DATA
	var path := profile_dir.path_join(SLOT_FILES[slot])
	var temporary := "%s.%d.tmp" % [path, OS.get_process_id()]
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify({"schemaVersion": SCHEMA_VERSION, "generation": generation, "mode": mode,
		"monitor": [monitor.position.x, monitor.position.y, monitor.size.x, monitor.size.y],
		"window": [normal.position.x, normal.position.y, normal.size.x, normal.size.y]}))
	file.flush()
	var error := file.get_error()
	file.close()
	# Windows Godot 4.3 removes the destination before renaming. Only replace the inactive slot.
	if error == OK:
		error = DirAccess.rename_absolute(temporary, path)
	if error != OK:
		DirAccess.remove_absolute(temporary)
	return error
