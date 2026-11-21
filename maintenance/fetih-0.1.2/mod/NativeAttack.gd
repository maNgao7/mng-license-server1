extends Node2D
## Fetih impact sprites, distributed along caller-owned fronts.
## Local recorded tank blasts follow the front on a separate combat bus.
## No original scenes/scripts, networking, battle resolution or profile writes.

const FRAME_PATH := "res://assets/effects/impact-%02d.png"
const STANDALONE_FRAME_PATH := "res://assets/effects/impact-%02d.png"
const STANDALONE_EFFECT := preload("FrontImpact.gdshader")
const PROXIMITY := preload("JetAudio.gd")
const GAME_AUDIO := preload("MissileAudio.gd")
const STANDALONE_FLASH_END := 0.24
const STANDALONE_SMOKE_START := 0.09
const STANDALONE_SMOKE_END := 0.78
const MAX_BATTLES := 4
const MAX_POINTS := 24
const CYCLE_SECONDS := 2.15
const MAX_CANNON_VOICES := 2
const SHOT_INTERVAL := 0.22
const MIN_TANK_GAIN := 0.003

var map_canvas: Control
var audio_enabled := false
var audio_bus: StringName = &"Master"
var audio_volume_db := -23.0
var resource_error := ""
var _frames: SpriteFrames
var _textures: Array[Texture2D] = []
var _impact_material: ShaderMaterial
var _smoke_material: ShaderMaterial
var _sound: AudioStream
var _rumble: AudioStream
var _cannon: AudioStream
var _tank_rumble: AudioStreamPlayer
var _shots: Array[AudioStreamPlayer] = []
var _shot_cooldown := 0.0
var _shot_number := 0
var _battles: Dictionary = {}
var _paused := false
var _loaded := false
var _clock := 0.0


func configure(canvas: Control) -> bool:
	# Caller owns parenting. Works under transparent attack_world at original map
	# coordinates, including the caller's 2x SubViewport canvas transform.
	map_canvas = canvas
	name = "NativeAttack"
	z_index = 40
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	return _load_resources()


func _load_resources() -> bool:
	if _loaded:
		return true
	_textures.clear()
	for index in 15:
		var path := FRAME_PATH % index
		if not ResourceLoader.exists(path, "Texture2D"):
			resource_error = "Özgün savaş karesi bulunamadı: " + path
			return false
		var texture: Texture2D = load(path)
		if texture == null:
			resource_error = "Özgün savaş karesi yüklenemedi: " + path
			return false
		_textures.append(texture)
	_frames = SpriteFrames.new()
	_frames.add_animation(&"native_fight_cloud")
	_frames.set_animation_loop(&"native_fight_cloud", false)
	_frames.set_animation_speed(&"native_fight_cloud", 20.0)
	for texture in _textures:
		_frames.add_frame(&"native_fight_cloud", texture)
	if FRAME_PATH == STANDALONE_FRAME_PATH:
		_impact_material = ShaderMaterial.new()
		_impact_material.shader = STANDALONE_EFFECT
		_smoke_material = ShaderMaterial.new()
		_smoke_material.shader = STANDALONE_EFFECT
		_smoke_material.set_shader_parameter(&"smoke_pass", true)
	_sound = preload("res://assets/audio/front-impact.ogg")
	_rumble = preload("res://assets/audio/front-rumble.ogg")
	_cannon = preload("res://assets/audio/tank-cannon.ogg")
	if _sound == null or _rumble == null or _cannon == null:
		push_warning("COMBAT_AUDIO: one or more local recordings could not be loaded; other audio channels remain available")
	resource_error = ""
	_loaded = true
	return true


func _process(delta: float) -> void:
	advance(delta)


func advance(delta: float) -> void:
	var stopped := _is_paused()
	var advancing := _loaded and not stopped and is_finite(delta) and delta > 0.0
	var step := minf(delta, 0.1) if advancing else 0.0
	if advancing:
		if is_instance_valid(map_canvas) and map_canvas.has_method("battle_fronts"):
			var fronts: Variant = map_canvas.call("battle_fronts")
			if fronts is Array:
				sync_fronts(fronts)
		_clock += step
		_shot_cooldown = maxf(0.0, _shot_cooldown - delta)
	var camera := PROXIMITY.audible_camera(map_canvas) if audio_enabled else null
	var screen := camera.get_viewport().get_visible_rect() if camera != null else Rect2()
	var zoom_gain := PROXIMITY.zoom_gain(map_canvas) if camera != null else 0.0
	_update_tank_rumble(camera, screen, zoom_gain, delta, stopped)
	var combat_gain := _combat_gain() * zoom_gain
	for shot in _shots:
		if shot.playing:
			var gain := PROXIMITY.position_gain(camera, screen, shot.get_meta("position"))
			PROXIMITY.update_voice(shot, gain * combat_gain * db_to_linear(-1.0), stopped, delta)
	for battle in _battles.values():
		if advancing:
			battle.age = float(battle.age) + step
			for index in battle.slots.size():
				_update_slot(battle, index)
		if not audio_enabled:
			continue
		var voice: AudioStreamPlayer = battle.voice
		var due := advancing and _sound != null and float(battle.age) >= float(battle.next_sound)
		if not voice.playing and not due:
			continue
		var gain := _front_gain(camera, screen, battle.points) * combat_gain
		PROXIMITY.update_voice(voice, gain, stopped, delta)
		if due and gain > MIN_TANK_GAIN:
			if not voice.playing:
				var number := int(battle.bursts)
				voice.bus = audio_bus
				voice.stream = _rumble if _rumble != null and number % 3 == 2 else _sound
				voice.pitch_scale = 0.94 + float(posmod(number * 3 + int(battle.seed * 9), 9)) * 0.015
				voice.volume_db = linear_to_db(gain)
				voice.play()
				battle.bursts = number + 1
			battle.next_sound = float(battle.age) + 3.8 + fposmod(float(battle.bursts) * 0.79 + float(battle.seed), 1.8)


func _update_tank_rumble(camera: Camera3D, screen: Rect2, zoom_gain: float, delta: float, stopped: bool) -> void:
	var gain := _moving_tank_gain(camera, screen) * zoom_gain if _rumble != null else 0.0
	gain = minf(gain * db_to_linear(audio_volume_db + 12.0), db_to_linear(-2.0))
	if _tank_rumble != null:
		PROXIMITY.update_voice(_tank_rumble, gain, stopped, delta, 27.0, 8.0)
	if stopped or not is_finite(delta) or delta <= 0.0 or gain < MIN_TANK_GAIN:
		return
	if _tank_rumble == null:
		var loop: AudioStreamOggVorbis = _rumble.duplicate()
		loop.loop = true
		_tank_rumble = AudioStreamPlayer.new()
		_tank_rumble.name = "TankMovementRumble"
		_tank_rumble.stream = loop
		_tank_rumble.pitch_scale = 0.82
		add_child(_tank_rumble)
	if not _tank_rumble.playing:
		_tank_rumble.bus = audio_bus
		_tank_rumble.volume_db = PROXIMITY.SILENT_DB
		_tank_rumble.play()


func _moving_tank_gain(camera: Camera3D, screen: Rect2) -> float:
	if camera == null or not is_instance_valid(map_canvas.military):
		return 0.0
	# MilitaryLayer owns these active vehicles and their movement envelopes.
	var loudest := 0.0
	for entry: Dictionary in map_canvas.military._active.values():
		var motion := float(entry.get("motion", 0.0))
		if entry.kind != &"Tank" or motion < 0.03:
			continue
		var node: Node3D = entry.node
		if node.is_visible_in_tree():
			loudest = maxf(loudest, motion * PROXIMITY.position_gain(camera, screen, node.global_position))
	return loudest


func _combat_gain() -> float:
	# Multiple fronts share a power budget.
	var crowd := 10.0 * log(float(maxi(1, _battles.size()))) / log(10.0)
	return db_to_linear(clampf(audio_volume_db - crowd, -60.0, -6.0))


func _front_gain(camera: Camera3D, screen: Rect2, points: PackedVector2Array) -> float:
	if camera == null:
		return 0.0
	var loudest := 0.0
	for point in points:
		var source: Vector3 = map_canvas.world_point(point)
		loudest = maxf(loudest, PROXIMITY.position_gain(camera, screen, source))
	return loudest

func play_tank_fire(position: Vector3) -> void:
	# Called by MilitaryLayer.tank_fired through RotorAudio.configure, after the
	# military layer exists. No timer invents a muzzle shot during deployment.
	if not audio_enabled or _cannon == null or _is_paused() or _shot_cooldown > 0.0 or not position.is_finite() or _battles.is_empty():
		return
	var camera := PROXIMITY.audible_camera(map_canvas)
	if camera == null:
		return
	var screen := camera.get_viewport().get_visible_rect()
	var gain := PROXIMITY.position_gain(camera, screen, position) * PROXIMITY.zoom_gain(map_canvas) * _combat_gain() * db_to_linear(-1.0)
	if gain < MIN_TANK_GAIN:
		return
	var voice: AudioStreamPlayer
	for candidate in _shots:
		if not candidate.playing:
			voice = candidate
			break
	if voice == null:
		if _shots.size() >= MAX_CANNON_VOICES:
			return
		voice = AudioStreamPlayer.new()
		voice.stream = _cannon
		add_child(voice)
		_shots.append(voice)
	voice.bus = audio_bus
	voice.set_meta("position", position)
	voice.volume_db = linear_to_db(gain)
	voice.pitch_scale = 0.97 + float(_shot_number % 5) * 0.015
	voice.play()
	_shot_number += 1
	_shot_cooldown = SHOT_INTERVAL


func sync_fronts(fronts: Array) -> void:
	if _is_paused() or not _load_resources():
		return
	var accepted: Dictionary = {}
	for value in fronts:
		if not value is Dictionary:
			continue
		var front: Dictionary = value
		if float(front.get("travel", 1.0)) < 1.0:
			continue
		var id := str(front.get("id", ""))
		if id.is_empty() or id.length() > 512 or accepted.has(id):
			continue
		var raw: Variant = front.get("points", [])
		if not raw is Array and not raw is PackedVector2Array:
			continue
		var points := PackedVector2Array()
		# Validate first; never infer, project, resample or replace caller geometry.
		for point in raw:
			if point is Vector2 and point.is_finite() and absf(point.x) < 100000.0 and absf(point.y) < 100000.0:
				points.append(point)
		if points.is_empty():
			continue
		# More than 24 supplied points retain an evenly distributed subset.
		if points.size() > MAX_POINTS:
			var subset := PackedVector2Array()
			for index in MAX_POINTS:
				subset.append(points[int(float(index) * float(points.size() - 1) / float(MAX_POINTS - 1))])
			points = subset
		accepted[id] = {"points": points, "progress": clampf(float(front.get("progress", 0.0)), 0.0, 1.0)}
	var ids: Array = accepted.keys()
	ids.sort()
	if ids.size() > MAX_BATTLES:
		ids.resize(MAX_BATTLES)
	for id in _battles.keys():
		if not id in ids:
			clear_attack(str(id))
	for id in ids:
		var front: Dictionary = accepted[id]
		if not _battles.has(id):
			_battles[id] = _new_battle(str(id))
		var battle: Dictionary = _battles[id]
		battle.points = front.points
		battle.progress = front.progress
		while battle.slots.size() < battle.points.size():
			battle.slots.append(_new_slot(battle.holder))
		while battle.slots.size() > battle.points.size():
			var slot: Dictionary = battle.slots.pop_back()
			slot.root.free()
		for index in battle.slots.size():
			_update_slot(battle, index)


func sync_battles(fronts: Array) -> void:
	# Compatibility name; accepts the same canonical battle_fronts dictionaries.
	sync_fronts(fronts)


func _new_battle(id: String) -> Dictionary:
	var holder := Node2D.new()
	holder.name = "Front_%08x" % id.hash()
	add_child(holder)
	var voice := AudioStreamPlayer.new()
	voice.stream = _sound
	voice.max_polyphony = 1
	holder.add_child(voice)
	return {"id": id, "holder": holder, "voice": voice, "slots": [], "points": PackedVector2Array(),
		"progress": 0.0, "age": 0.0, "seed": float(posmod(id.hash(), 997)) / 997.0,
		"next_sound": 0.12 + float(posmod(id.hash(), 997)) / 997.0 * 0.75, "bursts": 0}


func _new_slot(holder: Node2D) -> Dictionary:
	var anchor := Node2D.new()
	holder.add_child(anchor)
	var smoke := Sprite2D.new()
	smoke.texture = _textures[8]
	smoke.material = _smoke_material
	anchor.add_child(smoke)
	var impact := AnimatedSprite2D.new()
	impact.sprite_frames = _frames
	impact.animation = &"native_fight_cloud"
	impact.material = _impact_material
	# Manual native animation frame selection, rather than engine autoplay, keeps
	# the complete animation frozen for both app pause and SceneTree pause.
	impact.stop()
	anchor.add_child(impact)
	return {"root": anchor, "impact": impact, "smoke": smoke}


func _update_slot(battle: Dictionary, index: int) -> void:
	var slot: Dictionary = battle.slots[index]
	var origin: Vector2 = battle.points[index]
	var age: float = battle.age
	var seed: float = battle.seed
	var delay := 0.0 if index == 0 else seed + index * 0.381966
	var phase := fposmod(age / CYCLE_SECONDS + delay, 1.0)
	var impact: AnimatedSprite2D = slot.impact
	var smoke: Sprite2D = slot.smoke
	var anchor: Node2D = slot.root
	anchor.position = origin
	if _impact_material != null:
		_update_standalone_slot(impact, smoke, phase, index, seed)
		return
	var burst := clampf(phase / 0.38, 0.0, 1.0)
	impact.visible = phase < 0.38
	impact.frame = mini(14, int(burst * 15.0))
	var flash := Color("#ffcf55").lerp(Color("#eb6b24"), burst)
	flash.a = minf(1.0, burst * 8.0) * clampf((1.0 - burst) * 3.0, 0.0, 1.0)
	impact.modulate = flash
	var impact_width := lerpf(30.0, 57.0, sin(burst * PI * 0.5))
	impact.scale = Vector2.ONE * impact_width / maxf(1.0, float(_textures[0].get_width()))
	impact.rotation = sin(index * 2.399963 + seed) * 0.12
	var plume := clampf((phase - 0.12) / 0.88, 0.0, 1.0)
	smoke.visible = phase >= 0.12
	smoke.texture = _textures[mini(14, 5 + int(plume * 9.0))]
	var shade := Color("#383432").lerp(Color("#858482"), plume)
	shade.a = sin(plume * PI) * 0.76
	smoke.modulate = shade
	smoke.position = Vector2(sin(index * 2.399963 + seed * TAU) * plume * 12.0, -plume * 42.0)
	smoke.scale = Vector2.ONE * lerpf(24.0, 49.0, plume) / maxf(1.0, float(_textures[0].get_width()))
	smoke.rotation = sin(index * 1.37) * plume * 0.22


func _update_standalone_slot(impact: AnimatedSprite2D, smoke: Sprite2D, phase: float, index: int, seed: float) -> void:
	var sprite_width := float(_textures[0].get_width())
	var burst := clampf(phase / STANDALONE_FLASH_END, 0.0, 1.0)
	impact.visible = phase < STANDALONE_FLASH_END
	impact.frame = mini(14, int(burst * 15.0))
	var flash := Color(1.0, 1.0, 0.96).lerp(Color(0.87, 0.58, 0.39), burst)
	flash.a = smoothstep(0.0, 0.10, burst) * (1.0 - smoothstep(0.24, 1.0, burst))
	impact.modulate = flash
	impact.scale = Vector2.ONE * lerpf(40.0, 56.0, burst) / sprite_width
	impact.rotation = sin(index * 2.399963 + seed) * 0.30
	var plume := clampf((phase - STANDALONE_SMOKE_START) / (STANDALONE_SMOKE_END - STANDALONE_SMOKE_START), 0.0, 1.0)
	smoke.visible = phase >= STANDALONE_SMOKE_START and phase < STANDALONE_SMOKE_END
	smoke.texture = _textures[mini(14, 5 + int(plume * 10.0))]
	var opacity := smoothstep(0.0, 0.22, plume) * (1.0 - smoothstep(0.35, 1.0, plume))
	smoke.modulate = Color(1.0, 1.0, 1.0, opacity * 0.82)
	smoke.position = Vector2(sin(index * 2.399963 + seed * TAU) * plume * 10.0, -plume * 31.0)
	smoke.scale = Vector2.ONE * lerpf(29.0, 48.0, plume) / sprite_width
	smoke.rotation = sin(index * 1.37) * plume * 0.22


func set_effects_paused(value: bool) -> void:
	_paused = value
	if _tank_rumble != null:
		_tank_rumble.stream_paused = _is_paused()
	for battle in _battles.values():
		battle.voice.stream_paused = _is_paused()
	for shot in _shots:
		shot.stream_paused = _is_paused()


func _is_paused() -> bool:
	if _paused or is_inside_tree() and get_tree().paused:
		return true
	if is_instance_valid(map_canvas):
		var app: Variant = map_canvas.get("app")
		if is_instance_valid(app) and app.has_method("is_paused"):
			return bool(app.call("is_paused"))
	return false


func set_audio_enabled(enabled: bool, volume_db: float = -23.0, bus: StringName = &"Master") -> void:
	audio_enabled = enabled
	audio_volume_db = volume_db
	audio_bus = GAME_AUDIO.connect_game_fx_bus(bus) if enabled else bus
	if not enabled:
		_stop_tank_rumble()
		for battle in _battles.values():
			battle.voice.stream_paused = false
			battle.voice.stop()
		_clear_shots()


func clear_attack(id: String) -> void:
	if _battles.has(id):
		var battle: Dictionary = _battles[id]
		battle.voice.stream_paused = false
		battle.voice.stop()
		battle.voice.stream = null
		battle.holder.free()
		_battles.erase(id)
		if _battles.is_empty():
			_clear_shots()


func clear_all() -> void:
	for id in _battles.keys():
		clear_attack(str(id))
	_clear_shots()
	_stop_tank_rumble()

func _stop_tank_rumble() -> void:
	if _tank_rumble != null:
		_tank_rumble.stop()
		_tank_rumble.free()
		_tank_rumble = null

func _clear_shots() -> void:
	for shot in _shots:
		shot.stop()
		shot.free()
	_shots.clear()
	_shot_cooldown = 0.0
	_shot_number = 0


func debug_state() -> Dictionary:
	var fronts: Array[Dictionary] = []
	var sprite_count := 0
	for id in _battles:
		var battle: Dictionary = _battles[id]
		var slots: Array[Dictionary] = []
		for slot in battle.slots:
			slots.append({"position": slot.root.position, "frame": slot.impact.frame,
				"smoke_position": slot.smoke.position, "smoke_scale": slot.smoke.scale,
				"impact_color": slot.impact.modulate, "smoke_color": slot.smoke.modulate})
		sprite_count += battle.slots.size() * 2
		fronts.append({"id": str(id), "age": battle.age, "point_count": battle.points.size(), "slots": slots,
			"audio_playing": battle.voice.playing, "audio_paused": battle.voice.stream_paused})
	return {"ready": _loaded, "resource_error": resource_error, "native_frame_count": _textures.size(),
		"clock": _clock, "paused": _is_paused(), "battle_count": _battles.size(), "sprite_count": sprite_count,
		"max_battles": MAX_BATTLES, "max_points_per_battle": MAX_POINTS, "fronts": fronts,
		"frame_pattern": FRAME_PATH,
		"battle_audio_ready": _sound != null and _rumble != null and _cannon != null,
		"cannon_voices": _shots.size(), "cannon_shots": _shot_number,
		"custom_adapter": ["front placement", "warm tint", "rising dark smoke", "deterministic frame timing"]}
