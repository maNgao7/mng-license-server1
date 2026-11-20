extends Node

const SAMPLE_INTERVAL := 0.055
const MIN_AUDIBLE := 0.003
const ROTOR_BUS := &"TikMnG Rotor"
const WAR_FLOOR := 0.18
const CLOSE_STRENGTH := 0.72
const DISTANT_STRENGTH := 0.035

var board: Control
var voice: AudioStreamPlayer
var strength := 0.0
var required_strength := 0.0
var sample_left := 0.0

func configure(view: Control) -> void:
	board = view
	# Military is initialized before this adapter. Cannon audio stays independent
	# of the rotor sample/channel and is owned by NativeAttack on the combat bus.
	_connect_tank_audio()
	var jets: Node = load(get_script().resource_path.get_base_dir().path_join("JetAudio.gd")).new()
	add_child(jets)
	jets.configure(view)
	var loop := preload("res://assets/audio/rotor.ogg")
	if loop == null:
		push_warning("ROTOR_AUDIO: local rotor recording could not be loaded; combat audio remains available")
		set_process(false)
		return
	loop.loop = true
	if AudioServer.get_bus_index(ROTOR_BUS) < 0:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, ROTOR_BUS)
	voice = AudioStreamPlayer.new()
	voice.stream = loop
	voice.bus = ROTOR_BUS
	voice.volume_db = -60.0
	add_child(voice)

func _connect_tank_audio() -> void:
	if is_instance_valid(board.military) and board.military.has_signal("tank_fired") and is_instance_valid(board.native_attack):
		var callback := Callable(board.native_attack, "play_tank_fire")
		if not board.military.is_connected("tank_fired", callback):
			board.military.connect("tank_fired", callback)

func _process(delta: float) -> void:
	if voice == null or not is_instance_valid(board) or not is_finite(delta) or delta <= 0.0:
		return
	var paused: bool = board.app.is_paused()
	voice.stream_paused = paused
	if paused:
		sample_left = 0.0
		return
	sample_left -= delta
	if sample_left <= 0.0:
		sample_left = SAMPLE_INTERVAL
		required_strength = _strength_in_view()
	if not voice.playing and required_strength >= MIN_AUDIBLE:
		strength = required_strength
		voice.volume_db = linear_to_db(strength)
		voice.play()
		return
	var response := 30.0 if required_strength > strength else 10.0
	strength = lerpf(strength, required_strength, 1.0 - exp(-delta * response))
	if strength < MIN_AUDIBLE:
		if voice.playing:
			voice.stop()
		return
	voice.volume_db = linear_to_db(strength)

func _strength_in_view() -> float:
	if not is_instance_valid(board.military) or not is_instance_valid(board.eye) or not board.military.has_method("helicopter_audio_positions"):
		return 0.0
	var zoom := smoothstep(0.90, 2.60, float(board.zoom_factor))
	var camera: Camera3D = board.eye
	var screen := camera.get_viewport().get_visible_rect()
	if not screen.has_area():
		return 0.0
	var center := screen.get_center()
	var focus: Vector2 = board.map_point(center)
	var loudest := 0.0
	var fronts: Array = board.battle_fronts()
	for position: Vector3 in board.military.helicopter_audio_positions():
		if not position.is_finite() or camera.is_position_behind(position):
			continue
		var offset := (camera.unproject_position(position) - center) / (screen.size * 0.5)
		var edge := 1.0 - smoothstep(1.0, 1.12, maxf(absf(offset.x), absf(offset.y)))
		if edge <= 0.0:
			continue
		var distance := INF
		var war := 0.0
		position.y = 0.0
		if not camera.is_position_behind(position):
			var ground: Vector2 = board.map_point(camera.unproject_position(position))
			distance = focus.distance_to(ground)
			if _near_war(ground, fronts):
				war = WAR_FLOOR
		var close := 1.0 - smoothstep(24.0, 180.0, distance)
		var focused := zoom * lerpf(DISTANT_STRENGTH, CLOSE_STRENGTH, close)
		loudest = maxf(loudest, edge * maxf(war, focused))
	# The loudest aircraft drives the single loop.
	return loudest

func _near_war(ground: Vector2, fronts: Array) -> bool:
	for front: Dictionary in fronts:
		for field in ["from_region", "to_region", "contact_from"]:
			var index := int(front.get(field, -1))
			if index >= 0 and index < board.regions.size() and Geometry2D.is_point_in_polygon(ground, board.regions[index].polygon):
				return true
		var source: Variant = front.get("source")
		var target: Variant = front.get("destination", front.get("target"))
		if source is Vector2 and target is Vector2:
			var route_point := Geometry2D.get_closest_point_to_segment(ground, source, target)
			if ground.distance_to(route_point) <= 65.0:
				return true
	return false
