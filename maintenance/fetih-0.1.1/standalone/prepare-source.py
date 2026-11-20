"""Create the standalone-only source snapshot from the adjacent TikMnG sources."""
from pathlib import Path
from hashlib import sha256
import json
import math
import random
import re
import shutil
import struct
import zlib

ROOT = Path(__file__).resolve().parent
SHARED = ROOT.parent
PROJECT = ROOT / "project"
MOD = PROJECT / "mod"


def copy(path, into=PROJECT):
    target = into / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SHARED / path, target)


def paste(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f"Expected one source occurrence: {old[:100]}")
    return text.replace(old, new)


def cut(text, start, end):
    return paste(text, text[text.index(start):text.index(end, text.index(start))], "")


def change(name, transform):
    path = MOD / (name + ".gd")
    path.write_text(transform(path.read_text(encoding="utf-8-sig")), encoding="utf-8")


def bootstrap(text):
    text = paste(text, "extends SceneTree", "extends Node")
    text = cut(text, "func _initialize()", "func _start()")
    text = paste(text, "func _start()", "func _ready() -> void:\n\t_start.call_deferred()\n\nfunc _start()")
    text = paste(text, "	var directory:", "	var root := get_tree().root\n	var directory:")
    text = re.sub(r"(?<!\.)\b(quit|create_timer|create_tween)\(", r"get_tree().\1(", text)
    text = paste(text, """			var image := Image.load_from_file(directory.path_join("../assets/art/fetih-startup.jpg").simplify_path())
			if image != null:
				startup.artwork = ImageTexture.create_from_image(image)""",
        '			startup.artwork = preload("res://assets/art/fetih-startup.jpg")')
    text = paste(text, '	root.add_child(game)', '	add_child(game)')
    text = paste(text, """	if not graphical or game.get("live") == null:
		return""", """	if game.get("live") == null:
		get_tree().quit(1)
		return
	if not graphical:
		return""")
    return paste(text, "	var arguments := OS.get_cmdline_user_args()", "	var root := get_tree().root\n	var arguments := OS.get_cmdline_user_args()")


def portable_maps(text):
    text = paste(text, 'const MAP_IDS := ["turkiye", "original"]', 'const MAP_IDS := ["turkiye", "world"]')
    text = paste(text, '"original": "Orijinal harita"', '"world": "Dünya"')
    text = paste(text, 'var map_id := "original"', 'var map_id := "turkiye"')
    text = paste(text, '\tmap_id = "original" if test_mode or qa_mode else "turkiye"\n', '')
    start = text.index('\tvar map: Node2D', text.index('func _make_map()'))
    end = text.index('\tif map == null:', start)
    text = paste(text, text[start:end], """\tvar builder: Script = preload("WorldMap.gd") if map_id == "world" else preload("TurkiyeMap.gd")
\tvar built: Dictionary = builder.new().build()
\tvar map: Node2D = built.get("map")
\tvar territories: Array[Node] = []
\tterritories.assign(built.get("territories", []))
""")
    text = re.sub(r'(?ms)^func _strip_original_input\(.*?(?=^func |\Z)', '', text, count=1)
    text = paste(text, 'map_id == "turkiye" or not (test_mode or qa_mode)', 'true')
    return paste(text, '[2, 10, 5, 13] if map_id == "turkiye" else [2, 10, 22, 29]',
        '[2, 10, 5, 13] if map_id == "turkiye" else [2, 3, 10, 27]')


def live_war(text):
    text = portable_maps(text)
    text = paste(text,'const LEADERS_PORT := 32187','const LEADERS_PORT := 32188')
    text = paste(text, 'mod_root.get_base_dir().path_join("bridge/runtime/gift-assets/katalog_tam.json")',
        'preload("InstallPaths.gd").bridge_directory().path_join("runtime/gift-assets/katalog_tam.json")')
    return paste(text, 'mod_root.path_join("../bridge").simplify_path()', 'preload("InstallPaths.gd").bridge_directory()')


def perspective(text):
    text = paste(text, '\t\t_create_parchment()', '\t\tpreload("WorldMap.gd").add_ocean(stage_view)')
    text = paste(text, 'ATLAS_FIT_INSET if base_map.has_meta("turkiye_atlas") else FIT_INSET', 'ATLAS_FIT_INSET')
    text = paste(text, 'MAX_ATLAS_ZOOM if base_map.has_meta("turkiye_atlas") else MAX_ZOOM', 'MAX_ATLAS_ZOOM')
    return cut(text, 'func _create_parchment()', 'func _create_attack_layer()')


def atlas_canvas(text):
    text = paste(text, '\tvar is_turkiye := base_map.has_meta("turkiye_atlas")\n'
        '\tif not is_turkiye:\n\t\t_enlarge_continents(territory_nodes)\n', '')
    return paste(text, """\tif is_turkiye:
\t\tfor region in regions:
\t\t\tregion["display_polygon"] = region.polygon
\t\t\tneighbors[region.id] = region.node.get_meta("zone_neighbors", [])
\telse:
\t\t_build_display_polygons()
\t\t_build_neighbors()""", """\tfor region in regions:
\t\tregion["display_polygon"] = region.polygon
\t\tneighbors[region.id] = region.node.get_meta("zone_neighbors", [])""")


def attacks(text):
    text = paste(text, 'Original Animal Times fight-cloud art', 'Fetih impact sprites')
    text = paste(text, 'const NATIVE_SCENE := "res://HUD/combat_display.tscn"\n', '')
    text = paste(text, 'const FRAME_PATH := "res://HUD/Assets/fight_cloud_png/fight cloud%02d.png"',
        'const FRAME_PATH := "res://assets/effects/impact-%02d.png"')
    text = paste(text, 'const ORIGINAL_AUDIO := "res://Assets/SoundEffects/attack_punch_dice.wav"\n', '')
    text = paste(text, '		"native_scene": NATIVE_SCENE, "native_frame_pattern": FRAME_PATH, "native_audio": ORIGINAL_AUDIO,',
        '		"frame_pattern": FRAME_PATH,')
    text = cut(text, '	# A repeating family', '	var burst')
    text = paste(text, '	var audio_dir: String = get_script().resource_path.get_base_dir().get_base_dir().path_join("assets/audio")\n', '')
    for filename in ["front-impact.ogg", "front-rumble.ogg", "tank-cannon.ogg"]:
        text = paste(text, f'AudioStreamOggVorbis.load_from_file(audio_dir.path_join("{filename}"))',
            f'preload("res://assets/audio/{filename}")')
    return text


def numbers(text):
    text = re.sub(r"^const NATIVE_NUMBER_FONT[^\n]+\n", "", text, flags=re.MULTILINE)
    return paste(text, '''	var number_font := username_font
	if ResourceLoader.exists(NATIVE_NUMBER_FONT, "Font"):
		number_font = load(NATIVE_NUMBER_FONT) as Font''', '''	var number_font := SystemFont.new()
	number_font.font_names = PackedStringArray(["Georgia", "Cambria", "Segoe UI"])
	number_font.font_weight = 700''')


def profile(text):
    text = paste(text, "const DEFAULT_SIZE := Vector2i(1800, 1040)", "const DEFAULT_SIZE := Vector2i(1280, 800)")
    return paste(text, text[text.index('static func profile_directory('):text.index('static func restore(')], """static func profile_directory(_mod_root: String) -> String:
	var custom_profile := OS.get_environment("TIKMNG_ANIMAL_PROFILE")
	if not custom_profile.is_empty():
		return custom_profile
	var base := OS.get_environment("LOCALAPPDATA")
	if "--qa-scene" in OS.get_cmdline_user_args() or "--self-test" in OS.get_cmdline_user_args():
		return base.path_join("TikMnG/FetihStandaloneQA/%d" % OS.get_process_id())
	if "--desktop-profile" in OS.get_cmdline_user_args():
		var previous := base.path_join("TikMnG/AnimalTimesLive")
		if DirAccess.dir_exists_absolute(previous):
			return previous
	return base.path_join("TikMnG/FetihStandalone")

""")


def victory(text):
    text = paste(text, '''		var picture := Image.load_from_file(app.mod_root.path_join("../assets/art/" + ART).simplify_path())
		if picture != null:
			picture.generate_mipmaps()
			artwork.texture = ImageTexture.create_from_image(picture)''',
        '		artwork.texture = load("res://assets/art/" + ART)')
    return paste(text, '''	var path: String = app.mod_root.path_join("../assets/audio/" + file).simplify_path()
	return AudioStreamOggVorbis.load_from_file(path) if FileAccess.file_exists(path) else null''',
        '	return load("res://assets/audio/" + file) as AudioStreamOggVorbis')


def countdown(text):
    text = paste(text, "func configure(owner_app: Node)", "func configure(_owner_app: Node)")
    text = cut(text, '	var audio_dir:', '	_clips.resize')
    return paste(text, '''		var path := audio_dir.path_join("%d.ogg" % tick)
		if FileAccess.file_exists(path):
			_clips[tick] = AudioStreamOggVorbis.load_from_file(path)''',
        '		_clips[tick] = load("res://assets/audio/country-countdown/%d.ogg" % tick)')


def scenery(text):
    return paste(text, '''	var shore := Image.load_from_file(canvas.app.mod_root.path_join("../assets/maps/turkiye-shoreline.png").simplify_path())
	if shore != null and not shore.is_empty():
		sea.set_shader_parameter("shoreline", ImageTexture.create_from_image(shore))
		sea.set_shader_parameter("has_shoreline", true)''',
        '''	sea.set_shader_parameter("shoreline", preload("res://assets/maps/turkiye-shoreline.png"))
	sea.set_shader_parameter("has_shoreline", true)''')


def png(path, size, pixel):
    """Write an RGBA texture with no external asset or Python dependency."""
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    data = bytearray()
    for row in range(size):
        data.append(0)
        for column in range(size):
            data.extend(pixel(column, row))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(data, 9)) + chunk(b"IEND", b""))


def impacts():
    rng = random.Random(72390)
    lobes = [(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(6, 13)) for _ in range(12)]
    for frame in range(15):
        progress = frame / 14
        expansion = 9 + 16 * progress
        def pixel(x, y):
            dx, dy = x - 47.5, y - 47.5
            cloud = 0.0
            for u, v, radius in lobes:
                distance = math.hypot(dx - u * expansion, dy - v * expansion)
                spread = radius * (0.55 + 0.61 * progress)
                cloud += max(0.0, 1.0 - distance / spread) ** 0.48
            alpha = min(1.0, max(0.0, cloud * 0.9))
            return (246, 243, 237, round(255 * alpha))
        png(PROJECT / "assets/effects" / f"impact-{frame:02d}.png", 96, pixel)


def gift_icon(x, y):
    if not (8 <= x <= 39 and 19 <= y <= 39 or 5 <= x <= 42 and 13 <= y <= 20):
        return (0, 0, 0, 0)
    if 21 <= x <= 26:
        return (248, 218, 154, 255)
    return (183, 122, 55, 255) if y >= 20 else (223, 176, 96, 255)


def stage_bridge():
    target = ROOT / "payload/bridge"
    copy("bridge/country-leaders-widget.cjs", ROOT / "payload")
    page_script = target / "country-leaders-widget.cjs"
    page_script.write_text(paste(page_script.read_text(encoding="utf-8"),
        "path.join(__dirname, '../assets/widgets/country-leaders.html')",
        "path.join(__dirname, 'assets/widgets/country-leaders.html')"), encoding="utf-8")
    page_script.write_text(paste(page_script.read_text(encoding="utf-8"),
        "path.join(__dirname, '../assets/widgets/fetih-armies.html')",
        "path.join(__dirname, 'assets/widgets/fetih-armies.html')"), encoding="utf-8")
    copy("assets/widgets/country-leaders.html", target)
    copy("assets/widgets/fetih-armies.html", target)
    runtime = target / "runtime"
    source = SHARED / "bridge/runtime"
    for name in ("bridge.cjs", "launcher-glue.cjs", "owner-helper.cjs", "package.json", "NODE-LICENSE.txt", "node.exe"):
        copy(f"bridge/runtime/{name}", ROOT / "payload")
    for name in ("lib", "vendor", "node_modules"):
        shutil.copytree(source / name, runtime / name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns(".bin", ".git", ".npmrc", ".package-lock.json"))
    overlay_files = ("overlay-bridge.cjs", "widget-document-route.cjs", "cinematic-assets.cjs")
    manifest = json.loads((source / "runtime-manifest.json").read_text(encoding="utf-8-sig"))
    for name in overlay_files:
        file = f"vendor/{name}"
        manifest["files"] = [record for record in manifest["files"] if record["file"] != file]
        manifest["files"].append({"file": file, "sha256": sha256((runtime / file).read_bytes()).hexdigest()})
    for key in ("source", "sourceRuntime", "sourceBridge", "portraitSource"):
        manifest.pop(key, None)
    manifest["node"].pop("source", None)
    catalog = runtime / "gift-assets"
    catalog.mkdir(exist_ok=True)
    source_catalog = source / "gift-assets" / "katalog_tam.json"
    rows = json.loads(source_catalog.read_text(encoding="utf-8-sig"))
    for row in rows:
        filename = row["file"]
        if not re.fullmatch(r"[0-9]+\.png", filename) or filename == "0.png":
            raise ValueError("Gift catalog entry must have its own numeric image path")
        shutil.copyfile(source_catalog.parent / filename, catalog / filename)
    shutil.copyfile(source_catalog, catalog / "katalog_tam.json")
    png(catalog / "0.png", 48, gift_icon)
    manifest["catalog"] = {"count": len(rows), "sha256": sha256((catalog / "katalog_tam.json").read_bytes()).hexdigest()}
    (runtime / "runtime-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main():
    for path in sorted((SHARED / "mod").iterdir()):
        if path.suffix in (".gd", ".gdshader") and path.name != "Parchment.gdshader":
            copy(f"mod/{path.name}")
    for pattern in ["assets/maps/turkiye*.*", "assets/maps/world.json", "assets/art/fetih-startup.jpg",
                    "assets/art/country-victory.webp", "assets/audio/**/*.ogg", "assets/guides/*.png", "assets/guides/*.jpg"]:
        for path in SHARED.glob(pattern):
            if path.name != "ready-gift-design.png":
                copy(path.relative_to(SHARED))
    for name, transform in [
        ("Bootstrap", bootstrap), ("LiveWar", live_war), ("PerspectiveMap", perspective), ("MapCanvas", atlas_canvas),
        ("NativeAttack", attacks), ("TerritorySurface", numbers), ("WindowPlacement", profile),
        ("CountryVictory", victory), ("CountryCountdown", countdown), ("TurkiyeScenery", scenery),
    ]:
        change(name, transform)
    change("BroadcastGuide", lambda text: paste(text,
        'app.mod_root.path_join("../assets/guides/live-layout-muted.mp4").simplify_path()',
        'preload("InstallPaths.gd").bridge_directory().path_join("assets/guides/live-layout-muted.mp4")'))
    change("LiveWar", lambda text: paste(text,
        'mod_root.path_join("../assets/guides/ready-gift-design.png").simplify_path()',
        'preload("InstallPaths.gd").bridge_directory().path_join("assets/guides/ready-gift-design.png")'))
    for name, before, after in [
        ("WarRules", "var whole := floor(balance + 0.000000001)", "var whole := floorf(balance + 0.000000001)"),
        ("LiveClient", 'app.mod_root.get_base_dir().path_join("bridge/runtime")',
         'preload("InstallPaths.gd").bridge_directory().path_join("runtime")'),
        ("GiftActions", 'String(_app.mod_root).get_base_dir().path_join("bridge/runtime/gift-assets")',
         'preload("InstallPaths.gd").bridge_directory().path_join("runtime/gift-assets")'),
        ("JetAudio", '	var mod_root: String = get_script().resource_path.get_base_dir()\n	var stream := AudioStreamOggVorbis.load_from_file(mod_root.get_base_dir().path_join("assets/audio/jet-flyby.ogg"))',
         '	var stream := preload("res://assets/audio/jet-flyby.ogg")'),
        ("RotorAudio", '	var audio_root: String = get_script().resource_path.get_base_dir().get_base_dir().path_join("assets/audio")\n	var loop := AudioStreamOggVorbis.load_from_file(audio_root.path_join("rotor.ogg"))',
         '	var loop := preload("res://assets/audio/rotor.ogg")'),
        ("TurkiyeHarbor", 'load_maritime_audio(mod_root: String, file: String)', 'load_maritime_audio(_mod_root: String, file: String)'),
    ]:
        change(name, lambda text: paste(text, before, after))
    change("TurkiyeHarbor", lambda text: paste(text,
        '''	var path := mod_root.path_join("../assets/audio/maritime").simplify_path().path_join(file)
	return AudioStreamOggVorbis.load_from_file(path) if FileAccess.file_exists(path) else null''',
        '	return load("res://assets/audio/maritime/" + file) as AudioStreamOggVorbis'))
    qa_end = '	if "--qa-exit" in OS.get_cmdline_user_args():\n		get_tree().quit()'
    qa_checked = """	if "--qa-exit" in OS.get_cmdline_user_args():
		if not _verify_standalone_reset():
			push_error("Standalone combat, results, reset or replay verification failed.")
			get_tree().quit(1)
			return
		print("FETIH_STANDALONE_ROUND_OK")
		get_tree().quit()"""
    change("LiveWar", lambda text: paste(text, qa_end, qa_checked) + "\n" +
           (ROOT / "verify-round.gd.inc").read_text(encoding="utf-8"))
    impacts()
    stage_bridge()
    copy("assets/guides/live-layout-muted.mp4", ROOT / "payload/bridge")
    copy("assets/guides/ready-gift-design.png", ROOT / "payload/bridge")
    for path in ["assets/maps/KAYNAKLAR.md", "assets/maps/WORLD-SOURCES.md", "assets/audio/CREDITS.md", "assets/audio/jet-credits.md", "assets/audio/maritime/SOURCES.md"]:
        copy(path, ROOT / "payload/licenses")
    copy("assets/audio/presentation/SOURCES.md", ROOT / "payload/licenses")


if __name__ == "__main__":
    main()
