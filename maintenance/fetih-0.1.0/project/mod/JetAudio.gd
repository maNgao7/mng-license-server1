extends Node
## One flyby follows the loudest nearby jet while the camera is zoomed in.

const JET_BUS := &"TikMnG Jets"
const MIN_AUDIBLE_ZOOM := 1.68
const MIN_GAIN := 0.006
const EDGE_GAIN := 0.08

var board: Control
var voice: AudioStreamPlayer
var cooldown := 0.0
var pending_source := Vector3.INF


func configure(view: Control) -> void:
	board = view
	var stream := preload("res://assets/audio/jet-flyby.ogg")
	if stream == null:
		push_warning("JET_AUDIO: local flyby recording could not be loaded")
		set_process(false)
		return
	if AudioServer.get_bus_index(JET_BUS) < 0:
		AudioServer.add_bus()
		var index := AudioServer.bus_count - 1
		AudioServer.set_bus_name(index, JET_BUS)
		AudioServer.set_bus_send(index, &"Master")
	voice = AudioStreamPlayer.new()
	voice.stream = stream
	voice.bus = JET_BUS
	add_child(voice)
	if board.military.has_signal("jet_passed"):
		board.military.jet_passed.connect(_queue_pass)
	if board.military.has_signal("jet_audio_reset"):
		board.military.jet_audio_reset.connect(_reset)


func _queue_pass(position: Vector3) -> void:
	if cooldown <= 0.0 and _view_gain(position) > _view_gain(pending_source):
		pending_source = position


func _view_gain(position: Vector3) -> float:
	var zoom := float(board.zoom_factor)
	if zoom <= MIN_AUDIBLE_ZOOM or not position.is_finite() or not is_instance_valid(board.eye):
		return 0.0
	var camera: Camera3D = board.eye
	if camera.is_position_behind(position):
		return 0.0
	var screen := camera.get_viewport().get_visible_rect()
	if not screen.has_area():
		return 0.0
	var offset := (camera.unproject_position(position) - screen.get_center()) / (screen.size * 0.5)
	var edge := 1.0 - smoothstep(1.0, 1.12, maxf(absf(offset.x), absf(offset.y)))
	var focus := 1.0 - smoothstep(0.18, 0.90, offset.length())
	var onset := smoothstep(MIN_AUDIBLE_ZOOM, MIN_AUDIBLE_ZOOM + 0.30, zoom)
	var proximity := smoothstep(MIN_AUDIBLE_ZOOM, 5.30, zoom)
	return onset * edge * lerpf(EDGE_GAIN, 1.0, focus) * lerpf(0.23, 0.94, proximity)


func _process(delta: float) -> void:
	if not is_instance_valid(board) or voice == null:
		return
	voice.stream_paused = board.app.is_paused()
	if voice.stream_paused:
		pending_source = Vector3.INF
		return
	var gain := _view_gain(pending_source)
	pending_source = Vector3.INF
	if float(board.zoom_factor) > MIN_AUDIBLE_ZOOM and is_instance_valid(board.military) and board.military.has_method("jet_audio_positions"):
		for position: Vector3 in board.military.jet_audio_positions():
			gain = maxf(gain, _view_gain(position))
	cooldown = maxf(0.0, cooldown - delta)
	if voice.playing:
		# A camera move changes the gain while the recorded pass keeps its phase.
		var current := db_to_linear(voice.volume_db)
		var response := 18.0 if gain > current else 10.0
		var level := lerpf(current, gain, 1.0 - exp(-delta * response))
		voice.volume_db = linear_to_db(maxf(0.001, level))
	elif gain <= MIN_GAIN:
		cooldown = 0.0
	elif cooldown <= 0.0:
		voice.volume_db = linear_to_db(gain)
		voice.play()
		cooldown = voice.stream.get_length() + 0.34


func _reset() -> void:
	voice.stop()
	voice.stream_paused = false
	cooldown = 0.0
	pending_source = Vector3.INF
