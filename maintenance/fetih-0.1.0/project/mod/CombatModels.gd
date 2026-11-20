class_name CombatModels
extends RefCounted
## Original RTS miniatures. Forward is +Z, ground is Y=0; dimensions are final.
## Packed prototypes share every ArrayMesh/material, with independent node poses.
## Animate MainRotor.rotation.y (NOT the old imported rotor's local Z).

const TANK_MUZZLE := Vector3(0.0, 0.207, 0.365)
const HELICOPTER_MUZZLE := Vector3(0.0, 0.102, 0.422)
const MISSILE_MUZZLES: Array[Vector3] = [Vector3(-0.188, 0.139, 0.110), Vector3(0.188, 0.139, 0.110)]
const JET_NOZZLE_DEPTH := 0.048
const OLIVE := Color("#73816a")
const DARK_OLIVE := Color("#515f4e")
const STEEL := Color("#414951")
const RUBBER := Color("#292e30")
const GLASS := Color("#344f61")
const STONE := Color("#e6e0d3")
const WHITE := Color("#f6f2e8")

static var _prototypes: Dictionary = {}
static var _materials: Dictionary = {}


static func helicopter() -> Node3D:
	return _instance(&"Helicopter")


static func jet() -> Node3D:
	return _instance(&"Jet")


static func tank() -> Node3D:
	return _instance(&"Tank")


static func infantry() -> Node3D:
	return _instance(&"Soldier")


static func town_hall() -> Node3D:
	return _instance(&"TownHall")


static func create(kind: StringName) -> Node3D:
	match kind:
		&"Tank", &"tank": return tank()
		&"Helicopter", &"helicopter": return helicopter()
		&"Jet", &"jet": return jet()
		&"Soldier", &"Infantry", &"infantry": return infantry()
		&"TownHall", &"Headquarters", &"town_hall": return town_hall()
	push_error("CombatModels: unknown kind '%s'" % kind)
	return null


static func _instance(kind: StringName) -> Node3D:
	if not _prototypes.has(kind):
		var prototype: Node3D
		match kind:
			&"Helicopter": prototype = _make_helicopter()
			&"Jet": prototype = _make_jet()
			&"Tank": prototype = _make_tank()
			&"Soldier": prototype = _make_infantry()
			_: prototype = _make_town_hall()
		_own_children(prototype, prototype)
		var packed := PackedScene.new()
		var error := packed.pack(prototype)
		prototype.free()
		if error != OK:
			push_error("CombatModels: packing %s failed (%d)" % [kind, error])
			return null
		_prototypes[kind] = packed
	var result: Node3D = _prototypes[kind].instantiate()
	# Arrays are mutable; give each instance independent metadata, like its pose.
	if kind == &"Helicopter":
		result.set_meta("missile_muzzles", MISSILE_MUZZLES.duplicate())
	return result


static func _own_children(node: Node, scene_root: Node) -> void:
	for child in node.get_children():
		child.owner = scene_root
		_own_children(child, scene_root)


static func _marker(parent: Node3D, label: StringName, point: Vector3) -> Node3D:
	var marker := Node3D.new()
	marker.name = label
	marker.position = point
	parent.add_child(marker)
	return marker


static func _make_helicopter() -> Node3D:
	var root := Node3D.new()
	root.name = "AttackHelicopter"
	root.set_meta("muzzle", HELICOPTER_MUZZLE)
	root.set_meta("missile_muzzles", MISSILE_MUZZLES.duplicate())
	root.set_meta("rotor_axis", "y")
	root.set_meta("model_center", Vector3(0, 0.166, -0.010))
	var b := {}
	var armor := _surface(b, &"armor")
	var detail := _surface(b, &"detail")
	var glass := _surface(b, &"glass")
	var shell := Color("#818f7c")
	var edge := Color("#abb39c")
	var canopy := Color("#3c6375")
	# Angular fuselage with a raised transmission deck and stepped tandem cockpit.
	_loft(armor, [Vector4(-0.221, 0.160, 0.031, 0.036), Vector4(-0.145, 0.166, 0.073, 0.065),
		Vector4(0.074, 0.154, 0.071, 0.063), Vector4(0.248, 0.139, 0.054, 0.046),
		Vector4(0.381, 0.126, 0.035, 0.029), Vector4(0.456, 0.126, 0.018, 0.022)], shell)
	_loft(armor, [Vector4(-0.480, 0.212, 0.009, 0.012), Vector4(-0.368, 0.198, 0.013, 0.019),
		Vector4(-0.214, 0.172, 0.029, 0.031), Vector4(-0.096, 0.166, 0.046, 0.040)], shell)
	_loft(detail, [Vector4(-0.179, 0.219, 0.032, 0.022), Vector4(-0.117, 0.238, 0.048, 0.031),
		Vector4(0.015, 0.228, 0.049, 0.033), Vector4(0.069, 0.213, 0.038, 0.019)], DARK_OLIVE)
	_loft(glass, [Vector4(-0.024, 0.226, 0.034, 0.022), Vector4(0.025, 0.251, 0.041, 0.035),
		Vector4(0.112, 0.244, 0.038, 0.038), Vector4(0.161, 0.212, 0.033, 0.022),
		Vector4(0.212, 0.214, 0.034, 0.028), Vector4(0.285, 0.188, 0.028, 0.025),
		Vector4(0.332, 0.157, 0.024, 0.012)], canopy)
	# Canopy framing, composite fairings and protected side engine inlets.
	for side in [-1.0, 1.0]:
		var x: float = side
		_beam(detail, Vector3(x * 0.021, 0.279, 0.061), Vector3(x * 0.025, 0.271, 0.134),
			0.006, 0.004, Color("#82a4a8"))
		_beam(detail, Vector3(x * 0.015, 0.215, 0.235), Vector3(x * 0.019, 0.195, 0.294),
			0.006, 0.004, Color("#82a4a8"))
		_beam(armor, Vector3(side * 0.037, 0.216, 0.013), Vector3(side * 0.038, 0.272, 0.047), 0.006, 0.006, DARK_OLIVE)
		_beam(armor, Vector3(side * 0.037, 0.272, 0.047), Vector3(side * 0.036, 0.271, 0.101), 0.006, 0.006, DARK_OLIVE)
		_beam(armor, Vector3(side * 0.036, 0.271, 0.101), Vector3(side * 0.033, 0.207, 0.161), 0.007, 0.007, DARK_OLIVE)
		_beam(armor, Vector3(side * 0.033, 0.207, 0.161), Vector3(side * 0.031, 0.238, 0.213), 0.006, 0.006, DARK_OLIVE)
		_beam(armor, Vector3(side * 0.031, 0.238, 0.213), Vector3(side * 0.025, 0.182, 0.296), 0.006, 0.006, DARK_OLIVE)
		_loft(armor, [Vector4(-0.204, 0.215, 0.021, 0.023), Vector4(-0.144, 0.231, 0.033, 0.031),
			Vector4(-0.022, 0.232, 0.031, 0.027), Vector4(0.054, 0.219, 0.020, 0.020)],
			shell, Basis.IDENTITY, Vector3(x * 0.068, 0, 0))
		_box(detail, Vector3(0.011, 0.035, 0.071), Vector3(x * 0.095, 0.230, -0.014), RUBBER)
		for vane in 3:
			_box(detail, Vector3(0.012, 0.005, 0.057),
				Vector3(x * 0.097, 0.220 + float(vane) * 0.010, -0.014), STEEL)
		_cylinder(detail, Vector3(x * 0.068, 0.221, -0.192), Vector3(x * 0.068, 0.221, -0.224), 0.021, 0.017, STEEL, 8)
		_cylinder(detail, Vector3(x * 0.068, 0.221, -0.224), Vector3(x * 0.068, 0.221, -0.225), 0.012, 0.012, RUBBER, 8)
		_beam(detail, Vector3(x * 0.061, 0.176, 0.165), Vector3(x * 0.041, 0.153, 0.361), 0.010, 0.008, edge)
		_box(detail, Vector3(0.022, 0.014, 0.028), Vector3(x * 0.201, 0.161, -0.031),
			Color("#dc755b") if x < 0.0 else Color("#82b898"))
		# Swept stub wing, outer rocket pod and inboard guided missile rails.
		_loft(armor, [Vector4(-0.105, 0.161, 0.013, 0.012), Vector4(-0.041, 0.165, 0.016, 0.012),
			Vector4(0.060, 0.168, 0.010, 0.009)], OLIVE,
			Basis(Vector3.UP, side * PI / 2.0), Vector3(side * 0.125, 0, -0.010))
		_beam(armor, Vector3(side * 0.055, 0.171, 0.004), Vector3(side * 0.190, 0.158, -0.027), 0.022, 0.059, OLIVE)
		_cylinder(detail, Vector3(side * 0.188, 0.139, -0.068), Vector3(side * 0.188, 0.139, 0.109), 0.024, 0.024, STEEL, 10)
		_cylinder(detail, Vector3(side * 0.188, 0.139, 0.109), Vector3(side * 0.188, 0.139, 0.110), 0.019, 0.019, RUBBER, 10)
		for hole in [Vector2(-0.009, 0), Vector2(0.009, 0), Vector2(0, 0.010), Vector2(0, -0.010)]:
			_cylinder(detail, Vector3(side * 0.188 + hole.x, 0.139 + hole.y, 0.110),
				Vector3(side * 0.188 + hole.x, 0.139 + hole.y, 0.111), 0.004, 0.004, Color("#aab0a5"), 6)
		for rail in [-0.012, 0.012]:
			var rail_x: float = side * 0.133 + rail
			_cylinder(detail, Vector3(rail_x, 0.133, -0.073), Vector3(rail_x, 0.133, 0.073), 0.006, 0.006, Color("#c4c7ae"), 6)
			_cylinder(detail, Vector3(rail_x, 0.133, 0.073), Vector3(rail_x, 0.133, 0.091), 0.006, 0.001, STEEL, 6)
		# Wheels and outriggers, rather than civilian skids.
		_beam(detail, Vector3(side * 0.045, 0.114, 0.119), Vector3(side * 0.093, 0.032, 0.139), 0.008, 0.009, STEEL)
		_cylinder(detail, Vector3(side * 0.083, 0.025, 0.140), Vector3(side * 0.105, 0.025, 0.140), 0.025, 0.025, RUBBER, 10)
		_cylinder(detail, Vector3(side * 0.105, 0.025, 0.140), Vector3(side * 0.106, 0.025, 0.140), 0.010, 0.010, STEEL, 8)
		_marker(root, &"MissileMuzzleLeft" if side < 0 else &"MissileMuzzleRight", Vector3(side * 0.188, 0.139, 0.110))
	# Tall swept vertical fin and horizontal tailplane.
	_prism_x(armor, [Vector2(-0.480, 0.186), Vector2(-0.399, 0.202), Vector2(-0.444, 0.301),
		Vector2(-0.473, 0.305), Vector2(-0.494, 0.222)], -0.009, 0.009, shell)
	_box(detail, Vector3(0.021, 0.015, 0.018), Vector3(0, 0.298, -0.459), edge)
	for side in [-1.0, 1.0]:
		var x: float = side
		_airfoil(armor, [Vector3(x * 0.012, 0.208, -0.345), Vector3(x * 0.094, 0.204, -0.372),
			Vector3(x * 0.104, 0.203, -0.407), Vector3(x * 0.013, 0.208, -0.397)], 0.010, shell, DARK_OLIVE)
	_beam(detail, Vector3(0, 0.153, -0.337), Vector3(0, 0.018, -0.367), 0.007, 0.008, STEEL)
	_cylinder(detail, Vector3(-0.010, 0.017, -0.369), Vector3(0.010, 0.017, -0.369), 0.017, 0.017, RUBBER, 8)
	# Nose sensor and underslung chain gun; named hardpoint is at final muzzle.
	_cylinder(detail, Vector3(0, 0.112, 0.342), Vector3(0, 0.077, 0.342), 0.020, 0.016, STEEL, 8)
	_box(glass, Vector3(0.017, 0.012, 0.003), Vector3(0, 0.088, 0.359), GLASS)
	_beam(detail, Vector3(0, 0.102, 0.326), HELICOPTER_MUZZLE, 0.008, 0.008, STEEL)
	_box(detail, Vector3(0.012, 0.013, 0.015), Vector3(0, 0.102, 0.412), RUBBER)
	_marker(root, &"NoseGunHardpoint", Vector3(0, 0.102, 0.326))
	_marker(root, &"NoseGunMuzzle", HELICOPTER_MUZZLE)
	_marker(root, &"Muzzle", HELICOPTER_MUZZLE)
	_cylinder(detail, Vector3(0, 0.227, -0.069), Vector3(0, 0.307, -0.069), 0.009, 0.008, STEEL, 8)
	_mesh(root, b, "Airframe")
	var rotor := _marker(root, &"MainRotor", Vector3(0, 0.309, -0.069))
	var rb := {}
	var rs := _surface(rb, &"detail")
	_cylinder(rs, Vector3(0, -0.009, 0), Vector3(0, 0.016, 0), 0.030, 0.021, STEEL, 10)
	for blade in 4:
		var spin := Basis(Vector3.UP, blade * PI / 2.0 + 0.30)
		_beam(rs, spin * Vector3(0, 0.004, 0.015), spin * Vector3(0, 0.004, 0.065), 0.018, 0.010, STEEL)
		_airfoil(rs, [spin * Vector3(-0.017, 0.004, 0.054), spin * Vector3(-0.015, 0.004, 0.374),
			spin * Vector3(0.006, 0.004, 0.425), spin * Vector3(0.023, 0.004, 0.400),
			spin * Vector3(0.024, 0.004, 0.077)], 0.005, Color("#3e494a"), RUBBER)
		_box(rs, Vector3(0.032, 0.002, 0.020), spin * Vector3(0.004, 0.006, 0.376), edge, spin)
	_mesh(rotor, rb, "Blades")
	var tail := _marker(root, &"TailRotor", Vector3(-0.013, 0.239, -0.452))
	var tb := {}
	var ts := _surface(tb, &"detail")
	for blade in 4:
		var spin := Basis(Vector3.RIGHT, blade * PI / 2.0 + 0.35)
		_box(ts, Vector3(0.005, 0.063, 0.012), spin * Vector3(0, 0.037, 0), STEEL, spin)
		_box(ts, Vector3(0.005, 0.012, 0.012), spin * Vector3(-0.001, 0.063, 0), edge, spin)
	_cylinder(ts, Vector3(-0.008, 0, 0), Vector3(0.005, 0, 0), 0.013, 0.012, STEEL, 8)
	_mesh(tail, tb, "TailBlades")
	return root


static func _make_jet() -> Node3D:
	var root := Node3D.new()
	root.name = "FighterJet"
	root.set_meta("muzzle", Vector3(0, 0.009, 0.79))
	var builder := {}
	var alloy := _surface(builder, &"jet_alloy")
	var details := _surface(builder, &"detail")
	var glazing := _surface(builder, &"glass")
	var exhaust_mesh := _jet_exhaust_mesh()
	var gray := Color("#64747e")
	var wing_gray := Color("#697e88")
	var lower := Color("#3e505c")
	var panel := Color("#485c67")
	var charcoal := Color("#293741")
	var highlight := Color("#9eb1b7")
	# Sculpted fuselage, with a narrow waist and a separate radome and raised canopy.
	_jet_shell(alloy, [Vector4(-0.63, 0.024, 0.121, 0.052), Vector4(-0.49, 0.032, 0.164, 0.073),
		Vector4(-0.25, 0.038, 0.154, 0.080), Vector4(0.02, 0.046, 0.111, 0.090),
		Vector4(0.22, 0.056, 0.090, 0.094), Vector4(0.42, 0.061, 0.065, 0.068),
		Vector4(0.57, 0.044, 0.048, 0.048)], gray)
	_jet_shell(alloy, [Vector4(0.566, 0.044, 0.048, 0.048), Vector4(0.66, 0.032, 0.033, 0.034),
		Vector4(0.74, 0.016, 0.014, 0.018), Vector4(0.785, 0.009, 0.002, 0.004)], charcoal)
	_jet_shell(glazing, [Vector4(0.117, 0.139, 0.043, 0.013), Vector4(0.204, 0.148, 0.055, 0.036),
		Vector4(0.293, 0.153, 0.056, 0.046), Vector4(0.372, 0.143, 0.046, 0.038),
		Vector4(0.445, 0.115, 0.032, 0.023), Vector4(0.476, 0.101, 0.019, 0.007)], Color("#294650"))
	_beam(details, Vector3(-0.021, 0.192, 0.286), Vector3(-0.015, 0.168, 0.400),
		0.009, 0.002, Color("#6b9ba2"))
	for side in [-1.0, 1.0]:
		var x: float = side
		# The heavy shoulders transition into thin swept wings and a visible separate flap.
		_airfoil(alloy, [Vector3(x * 0.082, 0.092, 0.35), Vector3(x * 0.220, 0.086, 0.14),
			Vector3(x * 0.248, 0.069, -0.16), Vector3(x * 0.135, 0.066, -0.30)], 0.058, gray, lower)
		var wing_in := Vector3(x * 0.153, 0.075, 0.108)
		var lead := Vector3(x * 0.494, 0.043, -0.209)
		var tip := Vector3(x * 0.515, 0.040, -0.318)
		var root_rear := Vector3(x * 0.142, 0.060, -0.291)
		_airfoil(alloy, [wing_in, lead, tip, root_rear], 0.034, wing_gray, lower)
		_airfoil(details, [root_rear + Vector3(0, 0.003, 0.025), tip + Vector3(0, 0.003, 0.023),
			tip + Vector3(0, 0.000, -0.028), root_rear + Vector3(0, 0.000, -0.056)], 0.020, panel, charcoal)
		var aft_in := Vector3(x * 0.116, 0.069, -0.392)
		var aft_lead := Vector3(x * 0.313, 0.063, -0.546)
		var aft_tip := Vector3(x * 0.322, 0.061, -0.613)
		var aft_trail := Vector3(x * 0.136, 0.064, -0.591)
		_airfoil(alloy, [aft_in, aft_lead, aft_tip, aft_trail], 0.025, gray, lower)
		var fin_front := Vector3(x * 0.106, 0.085, -0.272)
		var fin_top := Vector3(x * 0.166, 0.296, -0.450)
		var fin_tip := Vector3(x * 0.176, 0.290, -0.519)
		var fin_back := Vector3(x * 0.115, 0.083, -0.619)
		_jet_fin(alloy, details, x, [fin_front, fin_top, fin_tip, fin_back], gray, highlight)

		# Dark, recessed intakes and two segmented exhaust outlets define the underside.
		var nacelle := Vector3(x * 0.116, -0.022, 0)
		_jet_shell(alloy, [Vector4(-0.58, 0.020, 0.053, 0.051), Vector4(-0.35, 0.023, 0.061, 0.055),
			Vector4(-0.035, 0.015, 0.066, 0.053), Vector4(0.128, 0.019, 0.051, 0.035)], lower, nacelle)
		_box(details, Vector3(0.077, 0.047, 0.006), nacelle + Vector3(0, 0.018, 0.133), charcoal)
		var nozzle := Vector3(x * 0.083, 0.015, -0.615)
		_jet_nozzle(details, nozzle)
		var plume := MeshInstance3D.new()
		plume.name = "ExhaustLeft" if x < 0.0 else "ExhaustRight"
		plume.mesh = exhaust_mesh
		plume.position = nozzle + Vector3.FORWARD * JET_NOZZLE_DEPTH
		plume.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		plume.hide()
		root.add_child(plume)
		var outboard := wing_in.lerp(lead, 0.67) + Vector3(0, 0.003, -0.036)
		_beam(details, outboard, outboard + Vector3(-x * 0.035, 0.004, -0.081), 0.016, 0.003, highlight)
		var nav := Color("#be7067") if side < 0.0 else Color("#6ba89b")
		_box(details, Vector3(0.023, 0.012, 0.029), tip + Vector3(-x * 0.006, 0.001, 0.026), nav)
	_mesh(root, builder, "Airframe")
	return root


static func _jet_shell(surface: SurfaceTool, rings: Array, color: Color, offset := Vector3.ZERO) -> void:
	const SIDES := 14
	var back_cap: Array[Vector3] = []
	var front_cap: Array[Vector3] = []
	for side in SIDES:
		var angle := TAU * float(side) / SIDES
		back_cap.append(_jet_ring_point(rings.front(), angle) + offset)
		front_cap.append(_jet_ring_point(rings.back(), angle) + offset)
	_face(surface, back_cap, Vector3.FORWARD, color.darkened(0.22))
	_face(surface, front_cap, Vector3.BACK, color)
	for station in range(rings.size() - 1):
		var back: Vector4 = rings[station]
		var front: Vector4 = rings[station + 1]
		for side in SIDES:
			var a := TAU * float(side) / SIDES
			var b := a + TAU / SIDES
			_face(surface, [_jet_ring_point(back, a) + offset, _jet_ring_point(back, b) + offset,
				_jet_ring_point(front, b) + offset, _jet_ring_point(front, a) + offset],
				Vector3(cos((a + b) * 0.5), sin((a + b) * 0.5), 0), color)


static func _jet_ring_point(ring: Vector4, angle: float) -> Vector3:
	return Vector3(cos(angle) * ring.z, ring.y + sin(angle) * ring.w, ring.x)


static func _jet_fin(alloy: SurfaceTool, details: SurfaceTool, side: float, outline: Array, color: Color, stripe: Color) -> void:
	var out := Vector3(side * 0.009, 0, 0)
	var outside: Array[Vector3] = []
	var inside: Array[Vector3] = []
	for point: Vector3 in outline:
		outside.append(point + out)
		inside.append(point - out)
	_face(alloy, outside, out, color)
	_face(alloy, inside, -out, color.darkened(0.16))
	for index in outline.size():
		var next := (index + 1) % outline.size()
		var normal := (outside[next] - outside[index]).cross(out)
		_face(alloy, [outside[index], outside[next], inside[next], inside[index]], normal, color.darkened(0.10))
	var lift := out.normalized() * 0.001
	_face(details, [outside[0].lerp(outside[1], 0.76) + lift, outside[1] + lift,
		outside[2] + lift, outside[3].lerp(outside[2], 0.76) + lift], out, stripe)


static func _jet_nozzle(surface: SurfaceTool, at: Vector3) -> void:
	const PETALS := 12
	var rear := at + Vector3.FORWARD * JET_NOZZLE_DEPTH
	for index in PETALS:
		var angle := TAU * float(index) / PETALS
		var outer := Vector3(cos(angle), sin(angle), 0)
		var next := Vector3(cos(angle + TAU / PETALS), sin(angle + TAU / PETALS), 0)
		var tint := STEEL.lightened(0.04) if index % 2 == 0 else STEEL.darkened(0.08)
		_face(surface, [at + outer * 0.049, at + next * 0.049, rear + next * 0.042, rear + outer * 0.042],
			outer + next, tint)
		_face(surface, [rear + outer * 0.042, rear + next * 0.042, rear + next * 0.032, rear + outer * 0.032],
			Vector3.FORWARD, tint.darkened(0.21))
		_face(surface, [rear + outer * 0.032, rear + next * 0.032, at + Vector3(0, 0, -0.006)],
			Vector3.FORWARD, Color("#161e22"))


static func _jet_exhaust_mesh() -> ArrayMesh:
	# Start inside the nozzle lip, flare into a blue core and taper to a warm tip.
	const SIDES := 8
	var rings: Array[Vector2] = [Vector2(0, 0.029), Vector2(0.07, 0.045),
		Vector2(0.16, 0.040), Vector2(0.24, 0.032), Vector2(0.35, 0.020)]
	var colors: Array[Color] = [Color("#b4edff"), Color("#298dff"), Color("#429aff"),
		Color("#ffcf6a"), Color("#ff852f")]
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for ring in rings.size():
		var profile := rings[ring]
		for side in SIDES:
			var angle := TAU * float(side) / SIDES
			surface.set_color(colors[ring])
			surface.add_vertex(Vector3(cos(angle) * profile.y, sin(angle) * profile.y, -profile.x))
	var tip := rings.size() * SIDES
	surface.set_color(Color("#ff5425"))
	surface.add_vertex(Vector3(0, 0, -0.49))
	for ring in rings.size():
		for side in SIDES:
			var front := ring * SIDES + side
			var front_next := ring * SIDES + (side + 1) % SIDES
			surface.add_index(front)
			surface.add_index(front_next)
			if ring == rings.size() - 1:
				surface.add_index(tip)
			else:
				surface.add_index(front_next + SIDES)
				surface.add_index(front)
				surface.add_index(front_next + SIDES)
				surface.add_index(front + SIDES)
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.vertex_color_use_as_albedo = true
	surface.set_material(material)
	return surface.commit()


static func _airfoil(surface: SurfaceTool, top: Array, thickness: float, light: Color, dark: Color) -> void:
	var bottom: Array[Vector3] = []
	var center := Vector3.ZERO
	for vertex: Vector3 in top:
		center += vertex / float(top.size())
		bottom.append(vertex - Vector3.UP * thickness)
	_face(surface, top, Vector3.UP, light)
	_face(surface, bottom, Vector3.DOWN, dark)
	for index in top.size():
		var next := (index + 1) % top.size()
		var outward: Vector3 = (top[index] + top[next]) * 0.5 - center
		_face(surface, [top[index], bottom[index], bottom[next], top[next]], outward, dark)


static func _make_tank() -> Node3D:
	var root := Node3D.new()
	root.name = "MainBattleTank"
	root.set_meta("muzzle", TANK_MUZZLE)
	root.set_meta("model_center", Vector3(0, 0.122, 0.065))
	var b := {}
	var armor := _surface(b, &"armor")
	var detail := _surface(b, &"detail")
	_loft(armor, [Vector4(-0.222, 0.092, 0.089, 0.037), Vector4(-0.173, 0.107, 0.105, 0.039),
		Vector4(0.137, 0.106, 0.105, 0.040), Vector4(0.210, 0.088, 0.091, 0.020)], OLIVE)
	for side in [-1.0, 1.0]:
		_track(detail, side * 0.115)
		for z in [-0.174, -0.105, -0.036, 0.033, 0.102, 0.171]:
			_cylinder(detail, Vector3(side * 0.107, 0.052, z), Vector3(side * 0.139, 0.052, z), 0.032, 0.032, RUBBER, 10)
			_cylinder(detail, Vector3(side * 0.139, 0.052, z), Vector3(side * 0.140, 0.052, z), 0.022, 0.022, DARK_OLIVE, 8)
			_cylinder(detail, Vector3(side * 0.140, 0.052, z), Vector3(side * 0.141, 0.052, z), 0.007, 0.007, STEEL, 6)
		for index in 13:
			var z := -0.205 + index * 0.033
			_box(detail, Vector3(0.048, 0.006, 0.010), Vector3(side * 0.115, 0.104, z), STEEL)
			_box(detail, Vector3(0.048, 0.005, 0.010), Vector3(side * 0.115, 0.013, z), STEEL)
		# Continuous side skirts, split into armor plates.
		for index in 5:
			_box(armor, Vector3(0.012, 0.035, 0.072), Vector3(side * 0.139, 0.114, -0.156 + index * 0.078), OLIVE)
		_box(detail, Vector3(0.015, 0.010, 0.018), Vector3(side * 0.082, 0.113, 0.199), Color("#e1dab1"))
		_cylinder(detail, Vector3(side * 0.067, 0.108, -0.224), Vector3(side * 0.067, 0.108, -0.231), 0.015, 0.015, STEEL, 8)
	for index in 6:
		_box(detail, Vector3(0.108, 0.003, 0.006), Vector3(0, 0.148, -0.189 + index * 0.010), STEEL)
	_mesh(root, b, "Chassis")
	# Independent turret pivot: local Y may be animated without changing the hull.
	var turret := _marker(root, &"Turret", Vector3(0, 0, -0.032))
	var t := {}
	var ta := _surface(t, &"armor")
	var td := _surface(t, &"detail")
	_cylinder(td, Vector3(0, 0.140, 0), Vector3(0, 0.159, 0), 0.067, 0.067, STEEL, 12)
	_loft(ta, [Vector4(-0.122, 0.188, 0.064, 0.029), Vector4(-0.061, 0.194, 0.087, 0.039),
		Vector4(0.064, 0.189, 0.078, 0.034), Vector4(0.111, 0.184, 0.048, 0.022)], OLIVE)
	_box(ta, Vector3(0.052, 0.043, 0.046), Vector3(0, 0.205, 0.108), DARK_OLIVE)
	_cylinder(td, Vector3(0, 0.207, 0.118), Vector3(0, 0.207, 0.384), 0.009, 0.006, STEEL, 10)
	_cylinder(ta, Vector3(0, 0.207, 0.157), Vector3(0, 0.207, 0.213), 0.013, 0.012, OLIVE, 10)
	_box(td, Vector3(0.018, 0.017, 0.022), Vector3(0, 0.207, 0.386), STEEL)
	_box(td, Vector3(0.010, 0.009, 0.001), Vector3(0, 0.207, 0.397), RUBBER)
	_cylinder(ta, Vector3(-0.031, 0.228, -0.023), Vector3(-0.031, 0.239, -0.023), 0.025, 0.025, DARK_OLIVE, 10)
	_box(td, Vector3(0.029, 0.012, 0.015), Vector3(0.033, 0.232, 0.036), STEEL)
	_box(_surface(t, &"glass"), Vector3(0.021, 0.006, 0.002), Vector3(0.033, 0.233, 0.044), GLASS)
	_beam(td, Vector3(0.057, 0.215, -0.081), Vector3(0.057, 0.302, -0.091), 0.0025, 0.0025, STEEL)
	_box(td, Vector3(0.142, 0.030, 0.024), Vector3(0, 0.190, -0.126), STEEL)
	for side in [-1.0, 1.0]:
		for index in 3:
			_cylinder(td, Vector3(side * 0.074, 0.197, 0.004 + index * 0.020),
				Vector3(side * 0.092, 0.217, 0.010 + index * 0.020), 0.006, 0.006, STEEL, 6)
	_mesh(turret, t, "TurretArmor")
	_marker(turret, &"CannonMuzzle", TANK_MUZZLE - turret.position)
	_marker(root, &"Muzzle", TANK_MUZZLE)
	return root


static func _make_infantry() -> Node3D:
	var root := Node3D.new()
	root.name = "RifleInfantry"
	root.set_meta("model_center", Vector3(0, 0.140, 0.019))
	root.set_meta("muzzle", Vector3(0.019, 0.188, 0.142))
	var b := {}
	var cloth := _surface(b, &"armor")
	var d := _surface(b, &"detail")
	var uniform := Color("#859178")
	var gear := Color("#57624e")
	var skin := Color("#c6a184")
	# 7.5-head human proportions; bent knees, two hands shouldering a real rifle.
	for side in [-1.0, 1.0]:
		var hip := Vector3(side * 0.018, 0.139, 0)
		var knee := Vector3(side * 0.023, 0.079, side * 0.016 + 0.007)
		var ankle := Vector3(side * 0.026, 0.024, side * 0.022)
		_cylinder(cloth, hip, knee, 0.016, 0.012, uniform, 7)
		_cylinder(cloth, knee, ankle, 0.012, 0.008, uniform, 7)
		_box(d, Vector3(0.021, 0.018, 0.041), ankle + Vector3(0, -0.013, 0.010), RUBBER)
		_box(d, Vector3(0.020, 0.020, 0.008), knee + Vector3(0, 0, 0.010), gear)
	# Torso widens at the shoulders; no oversized toy head or mitten arms.
	_loft(cloth, [Vector4(0.135, 0, 0.025, 0.014), Vector4(0.162, 0, 0.026, 0.016),
		Vector4(0.207, 0, 0.035, 0.017), Vector4(0.222, 0, 0.030, 0.015)], uniform,
		Basis(Vector3.RIGHT, -PI / 2.0))
	_box(d, Vector3(0.056, 0.047, 0.015), Vector3(0, 0.189, 0.018), gear)
	_box(d, Vector3(0.042, 0.049, 0.023), Vector3(0, 0.192, -0.026), gear)
	_box(d, Vector3(0.053, 0.008, 0.032), Vector3(0, 0.149, 0), STEEL)
	for x in [-0.018, 0, 0.018]:
		_box(d, Vector3(0.013, 0.019, 0.008), Vector3(x, 0.177, 0.029), DARK_OLIVE)
	_cylinder(d, Vector3(0, 0.220, 0.003), Vector3(0, 0.235, 0.003), 0.008, 0.008, skin, 8)
	_loft(d, [Vector4(0.231, 0, 0.009, 0.009), Vector4(0.243, 0, 0.014, 0.013),
		Vector4(0.260, 0, 0.013, 0.013), Vector4(0.266, 0, 0.009, 0.010)], skin,
		Basis(Vector3.RIGHT, -PI / 2.0), Vector3(0, 0, 0.004))
	# Faceted helmet dome with a lip, ear protection and a restrained visor.
	_loft(cloth, [Vector4(0.254, 0, 0.019, 0.018), Vector4(0.264, 0, 0.020, 0.018),
		Vector4(0.275, 0, 0.015, 0.014), Vector4(0.280, 0, 0.006, 0.006)], DARK_OLIVE,
		Basis(Vector3.RIGHT, -PI / 2.0), Vector3(0, 0, 0.001))
	_box(d, Vector3(0.038, 0.004, 0.032), Vector3(0, 0.255, 0.004), gear)
	_box(d, Vector3(0.022, 0.007, 0.004), Vector3(0, 0.251, 0.017), STEEL)
	var right_elbow := Vector3(0.042, 0.178, 0.012)
	var left_elbow := Vector3(-0.039, 0.181, 0.028)
	var right_hand := Vector3(0.019, 0.183, 0.050)
	var left_hand := Vector3(0.016, 0.187, 0.093)
	_cylinder(cloth, Vector3(0.034, 0.212, 0.001), right_elbow, 0.012, 0.010, uniform, 7)
	_cylinder(cloth, right_elbow, right_hand, 0.010, 0.007, uniform, 7)
	_cylinder(cloth, Vector3(-0.034, 0.211, 0.002), left_elbow, 0.012, 0.010, uniform, 7)
	_cylinder(cloth, left_elbow, left_hand, 0.010, 0.007, uniform, 7)
	_cylinder(d, right_hand - Vector3(0, 0, 0.007), right_hand + Vector3(0, 0, 0.005), 0.007, 0.006, skin, 6)
	_cylinder(d, left_hand - Vector3(0.005, 0, 0), left_hand + Vector3(0.005, 0, 0), 0.007, 0.006, skin, 6)
	_box(d, Vector3(0.010, 0.014, 0.046), Vector3(0.019, 0.196, 0.064), STEEL)
	_beam(d, Vector3(0.019, 0.198, 0.040), Vector3(0.024, 0.208, 0.013), 0.010, 0.012, RUBBER)
	_box(d, Vector3(0.011, 0.012, 0.030), Vector3(0.019, 0.194, 0.101), DARK_OLIVE)
	_beam(d, Vector3(0.019, 0.191, 0.065), Vector3(0.019, 0.172, 0.069), 0.008, 0.012, RUBBER)
	_cylinder(d, Vector3(0.019, 0.194, 0.110), Vector3(0.019, 0.194, 0.142), 0.003, 0.0025, STEEL, 6)
	_box(d, Vector3(0.006, 0.006, 0.011), Vector3(0.019, 0.206, 0.068), RUBBER)
	root.set_meta("muzzle", Vector3(0.019, 0.194, 0.142))
	_marker(root, &"RifleMuzzle", Vector3(0.019, 0.194, 0.142))
	_mesh(root, b, "Infantry")
	return root


static func _make_town_hall() -> Node3D:
	var root := Node3D.new()
	root.name = "TownHall"
	root.set_meta("model_center", Vector3(0, 0.31, 0))
	var b := {}
	var d := _surface(b, &"detail")
	var glass := _surface(b, &"glass")
	var banners := _surface(b, &"armor")
	var roof := Color("#38616c")
	var bronze := Color("#c49861")
	_box(d, Vector3(1.04, 0.036, 0.782), Vector3(0, 0.018, 0), Color("#515a62"))
	_box(d, Vector3(0.976, 0.014, 0.719), Vector3(0, 0.034, 0), Color("#dfd0aa"))
	for x in [-0.47, 0.47]:
		for z in [-0.33, 0.33]:
			_box(banners, Vector3(0.065, 0.012, 0.065), Vector3(x, 0.043, z), WHITE)
	_box(d, Vector3(0.248, 0.005, 0.139), Vector3(0, 0.039, 0.221), STONE)
	for side in [-1.0, 1.0]:
		var x: float = side * 0.346
		_box(d, Vector3(0.142, 0.167, 0.276), Vector3(x, 0.118, -0.029), STONE)
		_gable(d, Vector3(x, 0.201, -0.029), 0.163, 0.300, 0.055, roof, Basis(Vector3.UP, PI / 2.0))
		for z in [-0.105, 0.045]:
			_box(glass, Vector3(0.004, 0.067, 0.040), Vector3(side * 0.419, 0.126, z), GLASS)
		for z in [-0.228, 0.221]:
			_box(d, Vector3(0.061, 0.019, 0.061), Vector3(x, 0.046, z), Color("#aaa18d"))
			_cylinder(d, Vector3(x, 0.055, z), Vector3(x, 0.110, z), 0.012, 0.010, STEEL, 6)
			_box(d, Vector3(0.027, 0.024, 0.027), Vector3(x, 0.115, z), bronze)
	_box(d, Vector3(0.586, 0.214, 0.340), Vector3(0, 0.130, 0), WHITE)
	_box(d, Vector3(0.607, 0.014, 0.359), Vector3(0, 0.238, 0), STONE)
	_box(d, Vector3(0.597, 0.008, 0.350), Vector3(0, 0.126, 0), STONE)
	_gable(d, Vector3(0, 0.245, 0), 0.640, 0.400, 0.102, roof)
	_box(d, Vector3(0.646, 0.010, 0.013), Vector3(0, 0.345, 0), bronze)
	for x in [-0.249, -0.167, 0.167, 0.249]:
		for side in [-1.0, 1.0]:
			_beam(d, Vector3(x, 0.252, side * 0.189), Vector3(x, 0.345, side * 0.015),
				0.006, 0.005, roof.lightened(0.17))
	# Symmetrical white civic facade: two floors, sash windows and stone pilasters.
	for side in [-1.0, 1.0]:
		for x in [0.106, 0.211]:
			for y in [0.084, 0.184]:
				for z in [-0.172, 0.172]:
					_box(glass, Vector3(0.036, 0.048, 0.003), Vector3(side * x, y, z), GLASS)
					_box(d, Vector3(0.047, 0.007, 0.012), Vector3(side * x, y - 0.027, z), STONE)
					_box(d, Vector3(0.044, 0.007, 0.010), Vector3(side * x, y + 0.027, z), STONE)
					_box(d, Vector3(0.003, 0.048, 0.005), Vector3(side * x, y, z * 1.011), WHITE)
					_box(d, Vector3(0.036, 0.003, 0.005), Vector3(side * x, y, z * 1.011), WHITE)
		for z in [-0.145, 0.145]:
			_box(d, Vector3(0.021, 0.211, 0.021), Vector3(side * 0.287, 0.131, z), STONE)
		for z in [-0.079, 0.062]:
			for y in [0.084, 0.184]:
				_box(glass, Vector3(0.003, 0.048, 0.036), Vector3(side * 0.294, y, z), GLASS)
				_box(d, Vector3(0.010, 0.006, 0.044), Vector3(side * 0.295, y - 0.027, z), STONE)
	# Three shallow entrance steps and a columned portico with a pediment.
	for index in 3:
		_box(d, Vector3(0.170 - index * 0.014, 0.009, 0.063 - index * 0.012),
			Vector3(0, 0.041 + index * 0.009, 0.207 - index * 0.004), WHITE)
	_box(d, Vector3(0.055, 0.076, 0.005), Vector3(0, 0.084, 0.173), Color("#574c42"))
	_box(d, Vector3(0.003, 0.074, 0.007), Vector3(0, 0.084, 0.176), STONE)
	for x in [-0.057, 0.057]:
		_cylinder(d, Vector3(x, 0.050, 0.207), Vector3(x, 0.155, 0.207), 0.010, 0.008, WHITE, 8)
		_box(d, Vector3(0.026, 0.009, 0.026), Vector3(x, 0.051, 0.207), STONE)
		_box(d, Vector3(0.024, 0.010, 0.024), Vector3(x, 0.153, 0.207), STONE)
	_box(d, Vector3(0.153, 0.012, 0.078), Vector3(0, 0.163, 0.194), WHITE)
	_gable(d, Vector3(0, 0.169, 0.194), 0.086, 0.161, 0.036, STONE, Basis(Vector3.UP, PI / 2.0))
	# White clock tower rises out of the roof. Both front/back have an actual dial.
	_box(d, Vector3(0.128, 0.164, 0.129), Vector3(0, 0.364, -0.012), WHITE)
	_box(d, Vector3(0.149, 0.014, 0.150), Vector3(0, 0.449, -0.012), STONE)
	_box(d, Vector3(0.140, 0.008, 0.142), Vector3(0, 0.320, -0.012), STONE)
	_gable(d, Vector3(0, 0.457, -0.012), 0.163, 0.168, 0.065, roof, Basis(Vector3.UP, PI / 2.0))
	_cylinder(d, Vector3(0, 0.518, -0.012), Vector3(0, 0.668, -0.012), 0.005, 0.004, bronze, 6)
	var pennant := [Vector3(0, 0.654, -0.012), Vector3(0.128, 0.623, -0.018), Vector3(0, 0.590, -0.012)]
	_face(banners, pennant, Vector3.BACK, WHITE)
	_face(banners, pennant, Vector3.FORWARD, WHITE)
	for side in [-1.0, 1.0]:
		var x: float = side * 0.065
		_cylinder(d, Vector3(x, 0.395, -0.012), Vector3(x + side * 0.003, 0.395, -0.012),
			0.033, 0.033, bronze, 16)
		_cylinder(d, Vector3(x + side * 0.003, 0.395, -0.012), Vector3(x + side * 0.004, 0.395, -0.012),
			0.028, 0.028, WHITE, 16)
		_box(d, Vector3(0.004, 0.024, 0.005), Vector3(x + side * 0.005, 0.403, -0.012), STEEL)
		_box(d, Vector3(0.004, 0.005, 0.020), Vector3(x + side * 0.005, 0.395, -0.006), STEEL)
	for side in [-1.0, 1.0]:
		var z: float = -0.012 + side * 0.066
		_cylinder(d, Vector3(0, 0.395, z), Vector3(0, 0.395, z + side * 0.002), 0.032, 0.032, STEEL, 16)
		_cylinder(d, Vector3(0, 0.395, z + side * 0.002), Vector3(0, 0.395, z + side * 0.003), 0.028, 0.028, WHITE, 16)
		for hour in 12:
			var angle := hour * TAU / 12.0
			_box(d, Vector3(0.003, 0.005, 0.001), Vector3(sin(angle) * 0.023, 0.395 + cos(angle) * 0.023, z + side * 0.004), STEEL, Basis(Vector3.FORWARD, angle))
		_beam(d, Vector3(0, 0.395, z + side * 0.005), Vector3(0.015, 0.404, z + side * 0.005), 0.003, 0.002, STEEL)
		_beam(d, Vector3(0, 0.395, z + side * 0.005), Vector3(-0.006, 0.416, z + side * 0.005), 0.002, 0.002, STEEL)
	_mesh(root, b, "CivicBuilding")
	return root


# Geometry helpers. One indexed surface per material; all parts are baked in.
# Godot uses clockwise front faces: outward normal is opposite the vertex cross.
static func _surface(builder: Dictionary, channel: StringName) -> SurfaceTool:
	if not builder.has(channel):
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)
		builder[channel] = surface
	return builder[channel]


static func _material(channel: StringName) -> StandardMaterial3D:
	if not _materials.has(channel):
		var material := StandardMaterial3D.new()
		material.resource_name = "GreenCombatArmor" if channel == &"armor" else ("CombatGlass" if channel == &"glass" else "CombatDetails")
		material.vertex_color_use_as_albedo = true
		material.roughness = 0.28 if channel == &"glass" else (0.54 if channel == &"jet_alloy" else 0.87)
		material.metallic = 0.30 if channel == &"glass" else (0.20 if channel == &"jet_alloy" else 0.06)
		material.resource_local_to_scene = false
		_materials[channel] = material
	return _materials[channel]


static func _mesh(parent: Node3D, builder: Dictionary, label: String) -> MeshInstance3D:
	var mesh := ArrayMesh.new()
	for channel in builder:
		var surface: SurfaceTool = builder[channel]
		surface.set_material(_material(channel))
		surface.index()
		surface.commit(mesh)
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)
	return instance


static func _face(surface: SurfaceTool, points: Array, outward: Vector3, color: Color) -> void:
	var a: Vector3 = points[0]
	for index in range(1, points.size() - 1):
		var b: Vector3 = points[index]
		var c: Vector3 = points[index + 1]
		var normal := (b - a).cross(c - a)
		if normal.length_squared() < 0.00000000000001:
			continue
		if normal.dot(outward) < 0:
			normal = -normal
		else:
			var swap := b
			b = c
			c = swap
		normal = normal.normalized()
		for vertex in [a, b, c]:
			surface.set_normal(normal)
			surface.set_color(color)
			surface.add_vertex(vertex)


static func _box(surface: SurfaceTool, size: Vector3, position: Vector3, color: Color, orientation := Basis.IDENTITY) -> void:
	var h := size * 0.5
	var v: Array[Vector3] = []
	for p in [Vector3(-h.x, -h.y, -h.z), Vector3(h.x, -h.y, -h.z), Vector3(h.x, h.y, -h.z), Vector3(-h.x, h.y, -h.z),
		Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z), Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z)]:
		v.append(orientation * p + position)
	var faces := [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [0, 3, 7, 4], [1, 5, 6, 2]]
	var normals := [Vector3.FORWARD, Vector3.BACK, Vector3.DOWN, Vector3.UP, Vector3.LEFT, Vector3.RIGHT]
	for index in 6:
		var f: Array = faces[index]
		_face(surface, [v[f[0]], v[f[1]], v[f[2]], v[f[3]]], orientation * normals[index], color)


static func _beam(surface: SurfaceTool, a: Vector3, b: Vector3, width: float, depth: float, color: Color) -> void:
	var y := (b - a).normalized()
	var reference := Vector3.UP if absf(y.y) < 0.95 else Vector3.BACK
	var x := y.cross(reference).normalized()
	var z := x.cross(y).normalized()
	_box(surface, Vector3(width, a.distance_to(b), depth), (a + b) * 0.5, color, Basis(x, y, z))


static func _cylinder(surface: SurfaceTool, a: Vector3, b: Vector3, r0: float, r1: float, color: Color, sides: int) -> void:
	var axis := (b - a).normalized()
	var reference := Vector3.UP if absf(axis.y) < 0.95 else Vector3.BACK
	var u := axis.cross(reference).normalized()
	var v := axis.cross(u).normalized()
	var lower: Array[Vector3] = []
	var upper: Array[Vector3] = []
	for index in sides:
		var angle := index * TAU / float(sides)
		var radial := u * cos(angle) + v * sin(angle)
		lower.append(a + radial * r0)
		upper.append(b + radial * r1)
	for index in sides:
		var next := (index + 1) % sides
		_face(surface, [lower[index], lower[next], upper[next], upper[index]],
			(lower[index] + lower[next]) * 0.5 - a, color)
	_face(surface, lower, -axis, color)
	_face(surface, upper, axis, color)


static func _loft(surface: SurfaceTool, rings: Array, color: Color, orientation := Basis.IDENTITY, position := Vector3.ZERO) -> void:
	# Ring Vector4 = axial Z, center Y, half width X, half height Y.
	var vertices: Array = []
	var cross_section := [Vector2(-1, -0.6), Vector2(-0.65, -1), Vector2(0.65, -1), Vector2(1, -0.6),
		Vector2(1, 0.6), Vector2(0.65, 1), Vector2(-0.65, 1), Vector2(-1, 0.6)]
	for ring in rings:
		var points: Array[Vector3] = []
		for p in cross_section:
			points.append(orientation * Vector3(p.x * ring.z, ring.y + p.y * ring.w, ring.x) + position)
		vertices.append(points)
	for index in range(rings.size() - 1):
		for side in 8:
			var next := (side + 1) % 8
			var p: Vector2 = cross_section[side] + cross_section[next]
			_face(surface, [vertices[index][side], vertices[index][next], vertices[index + 1][next], vertices[index + 1][side]],
				orientation * Vector3(p.x, p.y, 0), color)
	_face(surface, vertices[0], orientation * Vector3.FORWARD, color)
	_face(surface, vertices[-1], orientation * Vector3.BACK, color)


static func _prism_x(surface: SurfaceTool, profile: Array, x0: float, x1: float, color: Color) -> void:
	var left: Array[Vector3] = []
	var right: Array[Vector3] = []
	var center := Vector2.ZERO
	for p in profile:
		left.append(Vector3(x0, p.y, p.x))
		right.append(Vector3(x1, p.y, p.x))
		center += p
	center /= profile.size()
	_face(surface, left, Vector3.LEFT, color)
	_face(surface, right, Vector3.RIGHT, color)
	for index in profile.size():
		var next := (index + 1) % profile.size()
		var hint: Vector2 = (profile[index] + profile[next]) * 0.5 - center
		_face(surface, [left[index], right[index], right[next], left[next]], Vector3(0, hint.y, hint.x), color)


static func _track(surface: SurfaceTool, center_x: float) -> void:
	var outer := [Vector2(-0.235, 0.037), Vector2(-0.197, 0.011), Vector2(0.188, 0.011), Vector2(0.221, 0.038),
		Vector2(0.221, 0.074), Vector2(0.181, 0.102), Vector2(-0.188, 0.102), Vector2(-0.235, 0.075)]
	var inner := [Vector2(-0.222, 0.042), Vector2(-0.193, 0.023), Vector2(0.184, 0.023), Vector2(0.209, 0.044),
		Vector2(0.209, 0.069), Vector2(0.176, 0.090), Vector2(-0.183, 0.090), Vector2(-0.222, 0.070)]
	for index in 8:
		var next := (index + 1) % 8
		for side in [-1.0, 1.0]:
			var x: float = center_x + side * 0.024
			_face(surface, [Vector3(x, outer[index].y, outer[index].x), Vector3(x, outer[next].y, outer[next].x),
				Vector3(x, inner[next].y, inner[next].x), Vector3(x, inner[index].y, inner[index].x)], Vector3(side, 0, 0), RUBBER)
		var hint: Vector2 = (outer[index] + outer[next]) * 0.5 - Vector2(0, 0.055)
		_face(surface, [Vector3(center_x - 0.024, outer[index].y, outer[index].x), Vector3(center_x + 0.024, outer[index].y, outer[index].x),
			Vector3(center_x + 0.024, outer[next].y, outer[next].x), Vector3(center_x - 0.024, outer[next].y, outer[next].x)], Vector3(0, hint.y, hint.x), RUBBER)
		_face(surface, [Vector3(center_x - 0.024, inner[index].y, inner[index].x), Vector3(center_x + 0.024, inner[index].y, inner[index].x),
			Vector3(center_x + 0.024, inner[next].y, inner[next].x), Vector3(center_x - 0.024, inner[next].y, inner[next].x)], Vector3(0, -hint.y, -hint.x), RUBBER)


static func _gable(surface: SurfaceTool, position: Vector3, width: float, depth: float, rise: float, color: Color, orientation := Basis.IDENTITY) -> void:
	var v: Array[Vector3] = []
	for p in [Vector3(-width / 2, 0, -depth / 2), Vector3(width / 2, 0, -depth / 2),
		Vector3(width / 2, 0, depth / 2), Vector3(-width / 2, 0, depth / 2),
		Vector3(-width / 2, rise, 0), Vector3(width / 2, rise, 0)]:
		v.append(orientation * p + position)
	_face(surface, [v[0], v[1], v[5], v[4]], orientation * Vector3(0, 1, -1), color)
	_face(surface, [v[3], v[4], v[5], v[2]], orientation * Vector3(0, 1, 1), color)
	_face(surface, [v[0], v[4], v[3]], orientation * Vector3.LEFT, color.lightened(0.08))
	_face(surface, [v[1], v[2], v[5]], orientation * Vector3.RIGHT, color.lightened(0.08))
	_face(surface, [v[0], v[3], v[2], v[1]], Vector3.DOWN, color)
