extends Node
## Audio for one missile cinematic, mixed globally at every map zoom.

const MISSILE_BUS := &"TikMnG Missile"
const GAME_FX_BUS := &"TikMnG Game FX"
const GAME_FX_CEILING_DB := -4.0
const LAUNCH_STREAM := preload("res://assets/audio/missile-launch.wav")
const IMPACT_STREAM := preload("res://assets/audio/missile-impact.wav")
const LAUNCH_DB := -0.5
const IMPACT_DB := -3.0
const RELEASE_SECONDS := 0.16

var _launch: AudioStreamPlayer
var _impact: AudioStreamPlayer
var _release: Tween
var _pending: Array[AudioStreamPlayer] = []
var _paused := false


func _ready() -> void:
	connect_game_fx_bus(MISSILE_BUS)
	_launch = _make_player(LAUNCH_STREAM, LAUNCH_DB)
	_impact = _make_player(IMPACT_STREAM, IMPACT_DB)


func play_launch() -> void:
	if not is_node_ready():
		return
	_cancel_release()
	_launch.stop()
	_launch.volume_db = LAUNCH_DB
	_play_or_queue(_launch)


func play_impact() -> void:
	if not is_node_ready():
		return
	_impact.stop()
	_play_or_queue(_impact)
	var engine_active := _launch.playing or _launch.stream_paused or _pending.has(_launch)
	if engine_active and _release == null:
		_release = create_tween()
		var fade := _release.tween_property(_launch, "volume_db", -55.0, RELEASE_SECONDS)
		fade.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		_release.tween_callback(_finish_release)
		if _paused:
			_release.pause()


func stop() -> void:
	if not is_node_ready():
		return
	_cancel_release()
	_pending.clear()
	_launch.stop()
	_impact.stop()
	_launch.volume_db = LAUNCH_DB


func set_paused(paused: bool) -> void:
	_paused = paused
	if not is_node_ready():
		return
	_launch.stream_paused = paused
	_impact.stream_paused = paused
	if not paused:
		for player in _pending:
			player.play()
		_pending.clear()
	if _release != null:
		if paused:
			_release.pause()
		else:
			_release.play()


func _play_or_queue(player: AudioStreamPlayer) -> void:
	if not _paused:
		player.play()
	elif not _pending.has(player):
		_pending.append(player)


func _make_player(stream: AudioStream, volume_db: float) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.stream = stream
	player.bus = MISSILE_BUS
	player.volume_db = volume_db
	add_child(player)
	return player


static func connect_game_fx_bus(bus: StringName) -> StringName:
	var mix := AudioServer.get_bus_index(GAME_FX_BUS)
	if mix < 0:
		# Sends must go to a bus earlier in the layout. Keep the shared output
		# ahead of the source buses even when a map creates them first.
		AudioServer.add_bus(1)
		mix = 1
		AudioServer.set_bus_name(mix, GAME_FX_BUS)
		AudioServer.set_bus_send(mix, &"Master")
		var limiter := AudioEffectHardLimiter.new()
		limiter.ceiling_db = GAME_FX_CEILING_DB
		AudioServer.add_bus_effect(mix, limiter)
	if bus == &"Master" or bus == GAME_FX_BUS:
		return GAME_FX_BUS
	var index := AudioServer.get_bus_index(bus)
	if index < 0:
		AudioServer.add_bus()
		index = AudioServer.bus_count - 1
		AudioServer.set_bus_name(index, bus)
	AudioServer.set_bus_send(index, GAME_FX_BUS)
	return bus


func _finish_release() -> void:
	_launch.stop()
	_launch.volume_db = LAUNCH_DB
	_release = null


func _cancel_release() -> void:
	if _release != null:
		_release.kill()
		_release = null
