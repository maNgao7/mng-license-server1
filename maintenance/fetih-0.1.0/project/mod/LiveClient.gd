extends Node

signal status_changed

var app: Node
var url := ""
var token := ""
var status := {"status": "disconnected", "username": "", "message": "Yayın bağlantısı bekleniyor."}
var cursor := 0
var session_id := ""
var portrait_cursor := 0
var portrait_session := ""
var child_pid := -1
var descriptor := ""
var next_poll := 0.0
var started_at := 0.0
var busy := false
var poll := HTTPRequest.new()

func setup(owner_app: Node) -> void:
	app = owner_app
	add_child(poll)
	poll.timeout = 12.0
	poll.body_size_limit = 2 * 1024 * 1024
	poll.request_completed.connect(_polled)
	set_process(false)

func ensure_started() -> void:
	if not url.is_empty() or child_pid > 0:
		return
	var directory: String = preload("InstallPaths.gd").bridge_directory().path_join("runtime")
	var executable := directory.path_join("node.exe")
	var script := directory.path_join("bridge.cjs")
	if not FileAccess.file_exists(executable) or not FileAccess.file_exists(script):
		set_status("error", "Yayın bağlantısı dosyaları bulunamadı.")
		return
	descriptor = app.profile_dir.path_join("live-bridge.json")
	child_pid = OS.create_process(executable, PackedStringArray([script, "--descriptor", descriptor,
		"--parent-pid", str(OS.get_process_id())]), false)
	if child_pid < 1:
		set_status("error", "Yayın bağlantısı başlatılamadı.")
		return
	started_at = Time.get_ticks_msec() / 1000.0
	set_status("connecting", "Yayın bağlantısı hazırlanıyor…")
	set_process(true)

func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now < next_poll:
		return
	next_poll = now + 0.4
	if url.is_empty():
		if FileAccess.file_exists(descriptor):
			var packet: Variant = JSON.parse_string(FileAccess.get_file_as_string(descriptor))
			if packet is Dictionary and str(packet.get("url", "")).begins_with("http://127.0.0.1:") and str(packet.get("token", "")).length() >= 32:
				url = str(packet.url)
				token = str(packet.token)
		elif now - started_at > 20.0:
			set_status("error", "Yayın bağlantısı hazırlanamadı. Tekrar bağlanmayı dene.")
		return
	if busy:
		return
	busy = true
	var path := "/state?after=%d&portraitAfter=%d" % [cursor, portrait_cursor]
	if not portrait_session.is_empty():
		path += "&portraitSessionId=" + portrait_session.uri_encode()
	var error := poll.request(url + path, PackedStringArray(["Authorization: Bearer " + token]))
	if error != OK:
		busy = false
		set_status("error", "Bağlantı yeniden deneniyor…")

func _polled(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	busy = false
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		set_status("error", "Yayın bağlantısına ulaşılamadı; yeniden deneniyor.")
		return
	var packet: Variant = JSON.parse_string(body.get_string_from_utf8())
	if not packet is Dictionary or not packet.get("status") is Dictionary:
		return
	status = packet.status
	var incoming := str(packet.get("sessionId", ""))
	if incoming != session_id:
		session_id = incoming
		cursor = 0
	var next_cursor := cursor
	var needs_checkpoint := false
	for entry: Variant in packet.get("events", []):
		if not entry is Dictionary or not entry.get("value") is Dictionary:
			continue
		var sequence := int(entry.get("seq", 0))
		if sequence <= next_cursor:
			continue
		var event: Dictionary = entry.value.duplicate(true)
		event["liveSessionId"] = session_id
		var engagement: bool = event.get("type") in ["like", "follow"]
		# Persist frequent engagement receipts once per poll before acknowledging them.
		if not app.accept_live_event(event, engagement):
			set_status("error", "Olay kaydedilemedi. Bekleyen olay tekrar denenecek.")
			break
		needs_checkpoint = needs_checkpoint or engagement
		next_cursor = sequence
	if not needs_checkpoint or app.save_live_checkpoint():
		cursor = next_cursor
	else:
		set_status("error", "Etkileşim kaydedilemedi. Bekleyen olaylar tekrar denenecek.")
	if packet.get("portraitSessionId") is String and packet.get("portraitUpdates") is Array:
		portrait_session = packet.portraitSessionId
		portrait_cursor = int(packet.get("portraitCursor", 0))
		app.portraits_available(packet.portraitUpdates)
	status_changed.emit()

func set_status(state: String, message: String) -> void:
	status.status = state
	status.message = message
	status_changed.emit()

func request_bytes(path: String, payload: Variant = null, timeout_seconds: float = 25.0) -> PackedByteArray:
	if url.is_empty() or not path.begins_with("/") or path.begins_with("//"):
		return PackedByteArray()
	var request := HTTPRequest.new()
	request.timeout = timeout_seconds
	request.body_size_limit = 4 * 1024 * 1024
	add_child(request)
	var headers := PackedStringArray(["Authorization: Bearer " + token, "Content-Type: application/json"])
	var error := request.request(url + path, headers, HTTPClient.METHOD_GET if payload == null else HTTPClient.METHOD_POST,
		"" if payload == null else JSON.stringify(payload))
	if error != OK:
		request.queue_free()
		return PackedByteArray()
	var response: Array = await request.request_completed
	request.queue_free()
	if response[0] != HTTPRequest.RESULT_SUCCESS or response[1] != 200:
		return PackedByteArray()
	return response[3]

func request_json(path: String, payload: Variant = null) -> Dictionary:
	var data := await request_bytes(path, payload)
	if data.is_empty():
		return {"error": "Bağlantı yanıt vermedi."}
	var parsed: Variant = JSON.parse_string(data.get_string_from_utf8())
	return parsed if parsed is Dictionary else {"error": "Bağlantı yanıtı okunamadı."}

func connect_account(username: String) -> Dictionary:
	var clean := username.strip_edges().trim_prefix("@").to_lower()
	var pattern := RegEx.new()
	pattern.compile("^[a-z0-9_.]{1,64}$")
	if pattern.search(clean) == null:
		return {"error": "Geçerli bir TikTok kullanıcı adı gir."}
	ensure_started()
	var timeout := Time.get_ticks_msec() + 22000
	while url.is_empty() and Time.get_ticks_msec() < timeout:
		await get_tree().create_timer(0.15).timeout
	if url.is_empty():
		return {"error": "Yayın bağlantısı başlatılamadı."}
	set_status("connecting", "@%s yayınına bağlanılıyor…" % clean)
	return await request_json("/connect", {"username": clean})

func avatar(username: String) -> Texture2D:
	var portrait: Dictionary = await avatar_result(username)
	return portrait.get("texture")

func avatar_result(username: String) -> Dictionary:
	var clean: String = username.strip_edges().trim_prefix("@").to_lower()
	var route: String = "/portrait/" + clean.uri_encode()
	var excluded: String = ""
	for _attempt in range(2):
		var bytes: PackedByteArray = await request_bytes(route + ("?excludeQualityVersion=" + excluded if not excluded.is_empty() else ""), null, 4.0)
		if bytes.is_empty():
			return {}
		# The digest identifies the exact encoded bytes fetched by this request.
		var digest := HashingContext.new()
		digest.start(HashingContext.HASH_SHA256)
		digest.update(bytes)
		var version: String = digest.finish().hex_encode()
		if version == excluded:
			return {}
		var image: Image = _decode_portrait(bytes)
		if image != null:
			image.generate_mipmaps()
			return {"image": image, "texture": ImageTexture.create_from_image(image), "qualityVersion": version}
		excluded = version
	return {}

func _decode_portrait(bytes: PackedByteArray) -> Image:
	var image := Image.new()
	var error := ERR_FILE_UNRECOGNIZED
	if bytes.size() > 8 and bytes.slice(0, 8).hex_encode() == "89504e470d0a1a0a":
		error = image.load_png_from_buffer(bytes)
	elif bytes.size() > 2 and bytes[0] == 255 and bytes[1] == 216:
		error = image.load_jpg_from_buffer(bytes)
	elif bytes.size() > 12 and bytes.slice(0, 4).get_string_from_ascii() == "RIFF" \
			and bytes.slice(8, 12).get_string_from_ascii() == "WEBP":
		error = image.load_webp_from_buffer(bytes)
	return image if error == OK and is_portrait_image_usable(image) else null

static func is_portrait_image_usable(image: Image) -> bool:
	if image == null or image.is_empty() or image.is_compressed():
		return false
	var size: Vector2i = image.get_size()
	if size.x > 8192 or size.y > 8192 or size.x * size.y > 16777216:
		return false
	# Check at most 81 points for images that are entirely transparent or
	# effectively black. A dark background can still contain a visible subject.
	for y in range(9):
		for x in range(9):
			var pixel: Color = image.get_pixel(roundi(x * (size.x - 1) / 8.0), roundi(y * (size.y - 1) / 8.0))
			if pixel.a > 1.0 / 255.0 and maxf(pixel.r, maxf(pixel.g, pixel.b)) > 3.0 / 255.0:
				return true
	return false

func _exit_tree() -> void:
	if child_pid > 0 and OS.is_process_running(child_pid):
		OS.kill(child_pid)
	if not descriptor.is_empty() and FileAccess.file_exists(descriptor):
		DirAccess.remove_absolute(descriptor)
