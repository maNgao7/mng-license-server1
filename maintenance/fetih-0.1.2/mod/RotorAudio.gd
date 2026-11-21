extends Node

const JET_AUDIO := preload("JetAudio.gd")
const MIN_AUDIBLE := 0.003
const ROTOR_BUS := &"TikMnG Rotor"
const CLOSE_STRENGTH := 0.72

var board: Control
var voice: AudioStreamPlayer

func configure(view: Control) -> void:
	board = view
	# Military is initialized before this adapter. Cannon audio stays independent
	# of the rotor sample/channel and is owned by NativeAttack on the combat bus.
	_connect_tank_audio()
	var jets := JET_AUDIO.new()
	add_child(jets)
	jets.configure(view)
	var loop := load("res://assets/audio/rotor.ogg") as AudioStreamOggVorbis
	if loop == null:
		push_warning("ROTOR_AUDIO: local rotor recording could not be loaded; combat audio remains available")
		set_process(false)
		return
	loop.loop = true
	voice = AudioStreamPlayer.new()
	voice.stream = loop
	voice.bus = JET_AUDIO.MISSILE_AUDIO.connect_game_fx_bus(ROTOR_BUS)
	voice.volume_db = JET_AUDIO.SILENT_DB
	add_child(voice)

func _connect_tank_audio() -> void:
	if is_instance_valid(board.military) and board.military.has_signal("tank_fired") and is_instance_valid(board.native_attack):
		var callback := Callable(board.native_attack, "play_tank_fire")
		if not board.military.is_connected("tank_fired", callback):
			board.military.connect("tank_fired", callback)

func _process(delta: float) -> void:
	if voice == null:
		return
	var gain := _strength_in_view()
	var paused: bool = board.app.is_paused()
	if not paused and not voice.playing and gain >= MIN_AUDIBLE:
		voice.volume_db = JET_AUDIO.SILENT_DB
		voice.play()
	JET_AUDIO.update_voice(voice, gain, paused, delta, 30.0)

func _strength_in_view() -> float:
	var camera := JET_AUDIO.audible_camera(board)
	if camera == null or not is_instance_valid(board.military) or not board.military.has_method("helicopter_audio_positions"):
		return 0.0
	var screen := camera.get_viewport().get_visible_rect()
	var loudest := 0.0
	for position: Vector3 in board.military.helicopter_audio_positions():
		loudest = maxf(loudest, JET_AUDIO.position_gain(camera, screen, position))
	return loudest * JET_AUDIO.zoom_gain(board) * CLOSE_STRENGTH
