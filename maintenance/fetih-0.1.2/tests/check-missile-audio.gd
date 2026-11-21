extends SceneTree
## Run with Godot 4.7.2 in a graphical window or with --headless.

const MISSILE := preload("res://mod/MissileAudio.gd")
const MISSILE_BUS := &"TikMnG Missile"
const PREVIEW := "res://qa/missile-audio-zoom.png"

class MapGrid extends Node2D:
	func _draw() -> void:
		for coordinate in range(-2048, 2049, 40):
			draw_line(Vector2(coordinate, -2048), Vector2(coordinate, 2048), Color("#253c4a"))
			draw_line(Vector2(-2048, coordinate), Vector2(2048, coordinate), Color("#253c4a"))
		draw_circle(Vector2.ZERO, 7, Color("#efac5e"))
		draw_arc(Vector2.ZERO, 34, 0, TAU, 48, Color("#efac5e"), 1.4, true)

var _failures := 0
var _capture := AudioEffectCapture.new()


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	root.title = "Fetih | Missile audio QA"
	root.size = Vector2i(720, 320)
	RenderingServer.set_default_clear_color(Color("#172832"))
	var app := Node.new()
	root.add_child(app)
	app.add_child(MapGrid.new())
	var camera := Camera2D.new()
	app.add_child(camera)
	camera.make_current()
	var labels := CanvasLayer.new()
	app.add_child(labels)
	var banner := Label.new()
	banner.position = Vector2(18, 14)
	banner.add_theme_font_size_override("font_size", 19)
	banner.add_theme_constant_override("outline_size", 6)
	banner.add_theme_color_override("font_outline_color", Color("#172832"))
	labels.add_child(banner)

	var missile := MISSILE.new()
	app.add_child(missile)
	var engine: AudioStreamWAV = missile._launch.stream
	var hit: AudioStreamWAV = missile._impact.stream
	_check(engine.loop_mode == AudioStreamWAV.LOOP_FORWARD and absf(float(engine.loop_begin) / engine.mix_rate - 3.22) <= 0.005
		and engine.loop_end == 307199 and hit.loop_mode == AudioStreamWAV.LOOP_DISABLED,
		"launch has a 3.22–6.40 s sustained loop and impact is a one-shot")
	_check(engine.format == AudioStreamWAV.FORMAT_16_BITS and hit.format == AudioStreamWAV.FORMAT_16_BITS,
		"both imported resources preserve source PCM")
	_check(AudioServer.get_bus_send(AudioServer.get_bus_index(MISSILE_BUS)) == MISSILE.GAME_FX_BUS,
		"standalone playback uses the limited game effects bus")
	_add_bus(&"TikMnG Jets")
	_add_bus(&"TikMnG Rotor")
	AudioServer.set_bus_send(AudioServer.get_bus_index(&"TikMnG Jets"), &"Master")
	var rotor_route := AudioServer.get_bus_send(AudioServer.get_bus_index(&"TikMnG Rotor"))
	var game_fx := AudioServer.get_bus_index(MISSILE.GAME_FX_BUS)
	_capture.buffer_length = 2.0
	AudioServer.add_bus_effect(0, _capture)

	camera.zoom = Vector2.ONE * 0.5
	missile.play_launch()
	var missile_bus := AudioServer.get_bus_index(MISSILE_BUS)
	_check(missile_bus > game_fx and AudioServer.get_bus_send(game_fx) == &"Master"
		and AudioServer.get_bus_effect(game_fx, 0) is AudioEffectHardLimiter,
		"shared effects bus has a limiter ahead of Master")
	_check(missile._launch.bus == MISSILE_BUS and missile._impact.bus == MISSILE_BUS
		and AudioServer.get_bus_send(AudioServer.get_bus_index(&"TikMnG Jets")) == &"Master"
		and AudioServer.get_bus_send(AudioServer.get_bus_index(&"TikMnG Rotor")) == rotor_route,
		"missile one-shots use their own bus while jet and rotor routing is untouched")

	var overview := await _measure(0.40)
	_check(overview.x > 0.08, "overview motor PCM peak %.4f" % overview.x)
	banner.text = "MAP OVERVIEW  /  0.5x\nMotor PCM peak %.4f" % overview.x
	var overview_image: Image
	var save_preview := "--save-preview" in OS.get_cmdline_user_args() and DisplayServer.get_name() != "headless"
	if save_preview:
		await RenderingServer.frame_post_draw
		overview_image = root.get_texture().get_image()

	camera.position = Vector2(650, 410)
	camera.zoom = Vector2.ONE * 5.0
	var zoomed := await _measure(0.38)
	_check(zoomed.x > 0.08 and missile._launch.get_playback_position() > 0.72,
		"motor PCM peak %.4f at 5x with launch point off-screen" % zoomed.x)
	banner.text = "FAR PAN  /  5x\nMotor PCM peak %.4f" % zoomed.x
	if save_preview:
		await RenderingServer.frame_post_draw
		var zoomed_image := root.get_texture().get_image()
		var comparison := Image.create_empty(overview_image.get_width(), overview_image.get_height() * 2,
			false, overview_image.get_format())
		comparison.blit_rect(overview_image, Rect2i(Vector2i.ZERO, overview_image.get_size()), Vector2i.ZERO)
		comparison.blit_rect(zoomed_image, Rect2i(Vector2i.ZERO, zoomed_image.get_size()),
			Vector2i(0, overview_image.get_height()))
		_check(comparison.save_png(PREVIEW) == OK, "rendered overview and far-pan comparison saved")

	missile.set_paused(true)
	await create_timer(0.08).timeout
	var paused_position := missile._launch.get_playback_position()
	var paused_mix := await _measure(0.27)
	_check(paused_mix.x == 0.0 and absf(missile._launch.get_playback_position() - paused_position) < 0.025,
		"pause silences engine PCM and freezes its sample position")
	missile.set_paused(false)
	var full := await _measure(0.36)
	_check(full.x > 0.08 and missile._launch.get_playback_position() > paused_position + 0.24,
		"resume advances the same engine playback")

	AudioServer.set_bus_volume_db(game_fx, -18)
	var reduced := await _measure(0.36)
	var change := linear_to_db(reduced.y / maxf(full.y, 0.0001))
	_check(change > -22 and change < -13, "effects volume propagated to missile PCM (%.1f dB RMS change)" % change)
	AudioServer.set_bus_volume_db(game_fx, 0)
	AudioServer.set_bus_mute(game_fx, true)
	var muted := await _measure(0.25)
	_check(muted.x == 0.0 and missile._launch.playing, "effects mute silences Master PCM while flight continues")
	AudioServer.set_bus_mute(game_fx, false)
	AudioServer.set_bus_mute(0, true)
	await _measure(0.25)
	_check(AudioServer.get_bus_peak_volume_left_db(0, 0) < -90.0 and missile._launch.playing,
		"Master mute silences post-fader output while flight continues")
	AudioServer.set_bus_mute(0, false)

	# Cross the first loop seam in real time and confirm the motor never stopped.
	await create_timer(4.8).timeout
	var sustained := await _measure(0.31)
	var loop_position := missile._launch.get_playback_position()
	_check(missile._launch.playing and loop_position >= 3.21 and loop_position < 6.4 and sustained.x > 0.08,
		"motor remains audible after loop wrap (position %.3f s, peak %.4f)" % [loop_position, sustained.x])

	banner.text = "IMPACT\nMeasuring onset, overlap and tail"
	_capture.clear_buffer()
	missile.play_impact()
	await create_timer(0.31).timeout
	var impact := _levels()
	_check(impact.x > 0.24 and impact.x < 0.82 and not missile._launch.playing,
		"impact and motor release peak %.4f (%.1f dBFS), motor ended" % [impact.x, linear_to_db(impact.x)])
	missile.set_paused(true)
	await create_timer(0.08).timeout
	var hit_position := missile._impact.get_playback_position()
	var held_tail := await _measure(0.24)
	_check(held_tail.x == 0.0 and absf(missile._impact.get_playback_position() - hit_position) < 0.025,
		"pause silences impact PCM and holds its sample position")
	missile.set_paused(false)
	await create_timer(2.0).timeout
	var tail := await _measure(0.25)
	_check(tail.x > 0.008 and tail.x < 0.20, "impact tail at 2+ seconds PCM peak %.4f" % tail.x)
	await create_timer(3.7).timeout
	_check((await _measure(0.18)).x == 0.0 and not missile._impact.playing, "impact tail decays to silence and ends naturally")

	missile.stop()
	missile.set_paused(true)
	missile.play_launch()
	var queued := await _measure(0.2)
	_check(queued.x == 0.0 and not missile._launch.has_stream_playback(), "launch called during pause waits from sample zero")
	missile.play_impact()
	await create_timer(0.22).timeout
	_check(not missile._launch.has_stream_playback() and not missile._impact.has_stream_playback(),
		"impact triggered while paused holds the motor handoff")
	missile.set_paused(false)
	var released := await _measure(0.27)
	_check(released.x > 0.08 and missile._impact.playing and not missile._launch.playing,
		"resume completes the pending handoff and removes the motor")
	missile.set_paused(true)
	missile.play_launch()
	missile.play_impact()
	missile.stop()
	missile.set_paused(false)
	var reset := await _measure(0.32)
	_check(reset.x == 0.0 and not missile._launch.playing and not missile._impact.playing,
		"stop clears both streams and the pending handoff across resume")
	missile.play_launch()
	_check((await _measure(0.28)).x > 0.08, "reset allows a fresh audible launch")
	missile.stop()

	app.queue_free()
	await create_timer(0.13).timeout
	AudioServer.remove_bus_effect(0, 0)
	await process_frame
	print("FETIH_MISSILE_AUDIO_%s: %d failures" % ["OK" if _failures == 0 else "FAILED", _failures])
	quit(int(_failures != 0))


func _add_bus(bus_name: StringName) -> void:
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)


func _measure(seconds: float) -> Vector2:
	# Allow the next buffer to reflect the current player and bus state.
	await create_timer(0.065).timeout
	_capture.clear_buffer()
	await create_timer(seconds).timeout
	return _levels()


func _levels() -> Vector2:
	var count := _capture.get_frames_available()
	if count == 0:
		return Vector2.ZERO
	var peak := 0.0
	var power := 0.0
	for frame in _capture.get_buffer(count):
		peak = maxf(peak, maxf(absf(frame.x), absf(frame.y)))
		power += frame.length_squared()
	return Vector2(peak, sqrt(power / (2 * count)))


func _check(ok: bool, message: String) -> void:
	print("%s: %s" % ["PASS" if ok else "FAIL", message])
	_failures += int(not ok)
