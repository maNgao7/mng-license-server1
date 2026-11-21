extends Node
## One flyby follows the loudest nearby jet while the camera is zoomed in.

const JET_BUS := &"TikMnG Jets"
const MISSILE_AUDIO := preload("MissileAudio.gd")
const MIN_AUDIBLE_ZOOM := 1.68
const FULL_GAIN_ZOOM := 2.60
const FULL_GAIN_DISTANCE := 4.0
const MAX_AUDIBLE_DISTANCE := 10.0
const SILENT_DB := -80.0
const MIN_GAIN := 0.006

var board: Control
var voice: AudioStreamPlayer
var cooldown := 0.0
var pending_source := Vector3.INF


func configure(view: Control) -> void:
	board = view
	var stream := load("res://assets/audio/jet-flyby.ogg") as AudioStreamOggVorbis
	if stream == null:
		push_warning("JET_AUDIO: local flyby recording could not be loaded")
		set_process(false)
		return
	voice = AudioStreamPlayer.new()
	voice.stream = stream
	voice.bus = MISSILE_AUDIO.connect_game_fx_bus(JET_BUS)
	voice.volume_db = SILENT_DB
	add_child(voice)
	if board.military.has_signal("jet_passed"):
		board.military.jet_passed.connect(_queue_pass)
	if board.military.has_signal("jet_audio_reset"):
		board.military.jet_audio_reset.connect(_reset)


func _queue_pass(position: Vector3) -> void:
	if cooldown > 0.0:
		return
	var camera := audible_camera(board)
	if camera == null:
		return
	var screen := camera.get_viewport().get_visible_rect()
	if position_gain(camera, screen, position) > position_gain(camera, screen, pending_source):
		pending_source = position


static func audible_camera(view: Control) -> Camera3D:
	if not is_instance_valid(view) or not view.is_visible_in_tree():
		return null
	var zoom := float(view.zoom_factor)
	var camera: Camera3D = view.eye
	if not is_finite(zoom) or zoom <= MIN_AUDIBLE_ZOOM or not is_instance_valid(camera):
		return null
	if not camera.is_visible_in_tree() or not camera.is_current():
		return null
	var viewport := camera.get_viewport()
	if viewport.disable_3d or not viewport.get_visible_rect().has_area():
		return null
	if viewport is SubViewport and viewport.render_target_update_mode == SubViewport.UPDATE_DISABLED:
		return null
	return camera


static func position_gain(camera: Camera3D, screen: Rect2, position: Vector3) -> float:
	if camera == null or not position.is_finite() or camera.is_position_behind(position):
		return 0.0
	var distance := camera.get_camera_transform().origin.distance_to(position)
	if distance >= MAX_AUDIBLE_DISTANCE:
		return 0.0
	var offset := (camera.unproject_position(position) - screen.get_center()) / (screen.size * 0.5)
	var edge := 1.0 - smoothstep(0.65, 1.0, maxf(absf(offset.x), absf(offset.y)))
	return edge * (1.0 - smoothstep(FULL_GAIN_DISTANCE, MAX_AUDIBLE_DISTANCE, distance))


static func zoom_gain(view: Control) -> float:
	return smoothstep(MIN_AUDIBLE_ZOOM, FULL_GAIN_ZOOM, float(view.zoom_factor))


static func update_voice(player: AudioStreamPlayer, gain: float, paused: bool, delta: float,
		attack := 18.0, release := 10.0) -> void:
	if gain <= 0.0:
		if player.playing:
			player.volume_db = SILENT_DB
			player.stop()
		player.stream_paused = false
		return
	player.stream_paused = paused
	if paused or not player.playing or not is_finite(delta) or delta <= 0.0:
		return
	var current := db_to_linear(player.volume_db)
	var response := attack if gain > current else release
	var level := lerpf(current, gain, 1.0 - exp(-delta * response))
	player.volume_db = maxf(SILENT_DB, linear_to_db(level))


func _process(delta: float) -> void:
	if voice == null:
		return
	var camera := audible_camera(board)
	if camera == null:
		_reset()
		return
	var screen := camera.get_viewport().get_visible_rect()
	var gain := position_gain(camera, screen, pending_source)
	pending_source = Vector3.INF
	if is_instance_valid(board.military) and board.military.has_method("jet_audio_positions"):
		for position: Vector3 in board.military.jet_audio_positions():
			gain = maxf(gain, position_gain(camera, screen, position))
	if gain <= 0.0:
		_reset()
		return
	voice.stream_paused = board.app.is_paused()
	if voice.stream_paused:
		return
	var zoom := float(board.zoom_factor)
	var onset := smoothstep(MIN_AUDIBLE_ZOOM, MIN_AUDIBLE_ZOOM + 0.30, zoom)
	var proximity := smoothstep(MIN_AUDIBLE_ZOOM, 5.30, zoom)
	gain *= onset * lerpf(0.23, 0.94, proximity)
	cooldown = maxf(0.0, cooldown - delta)
	if not voice.playing:
		if gain <= MIN_GAIN or cooldown > 0.0:
			return
		voice.volume_db = SILENT_DB
		voice.play()
		cooldown = voice.stream.get_length() + 0.34
	update_voice(voice, gain, false, delta)


func _reset() -> void:
	if voice.playing:
		voice.volume_db = SILENT_DB
		voice.stop()
	voice.stream_paused = false
	cooldown = 0.0
	pending_source = Vector3.INF
