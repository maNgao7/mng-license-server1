"""Build and verify the private Windows ZIP from the standalone source snapshot."""
from argparse import ArgumentParser
from hashlib import file_digest, md5, sha256
from pathlib import Path, PurePosixPath
import json
import re
import shutil
import struct
import subprocess
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent
VERSION = "0.1.1"
PROJECT = ROOT / "project"
PAYLOAD = ROOT / "payload"
TOOLCHAIN = ROOT / "toolchain"
RELEASE = "https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/"
TPZ = "Godot_v4.7.2-stable_export_templates.tpz"
TPZ_SHA = "f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011"
TEMPLATE = "windows_release_x86_64.exe"
TEMPLATE_SHA = "d34d36f3be1a6c49c56525ae86469b92e4f417ddf0b43cf00dd80c385c4b0562"
EDITOR_NAME = "Godot_v4.7.2-stable_win64"
EDITOR_SHA = "ab1824f85bfd8e0e4128182c000c4003a3e042245b2967848d089b2a04b22424"
CONSOLE_SHA = "c8f0a6bc45a19b33541501e57f6f7cd972ab18453743266339d495cbbe846643"


def digest(path):
    with path.open("rb") as source:
        return file_digest(source, "sha256").hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(args, name):
    log = ROOT / (name + ".log")
    with log.open("wb") as output:
        result = subprocess.run(args, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
    errors = re.search(r"^(?:SCRIPT ERROR|SHADER ERROR|USER ERROR|ERROR:)", log.read_text(encoding="utf-8", errors="replace"), re.M)
    require(result.returncode == 0 and not errors, f"{name} failed, see {log}")


def prepare_template():
    TOOLCHAIN.mkdir(exist_ok=True)
    template = TOOLCHAIN / TEMPLATE
    if template.is_file() and digest(template) == TEMPLATE_SHA:
        return
    archive = TOOLCHAIN / TPZ
    if not archive.is_file() or digest(archive) != TPZ_SHA:
        temporary = archive.with_suffix(".download")
        subprocess.run(["curl.exe", "--fail", "--location", "--retry", "2", "--output", str(temporary), RELEASE + TPZ], check=True)
        require(digest(temporary) == TPZ_SHA, "Official Godot template archive SHA-256 mismatch")
        temporary.replace(archive)
    with ZipFile(archive) as source, source.open("templates/" + TEMPLATE) as entry, template.open("wb") as output:
        shutil.copyfileobj(entry, output)
    require(digest(template) == TEMPLATE_SHA, "Official Windows template SHA-256 mismatch")


def pck_index(path):
    data = path.read_bytes()
    magic, format_version, major, minor, patch, flags, base, directory = struct.unpack_from("<4s5I2Q", data)
    require((magic, format_version, major, minor, patch, flags) == (b"GDPC", 4, 4, 7, 2, 2), "Unexpected Godot pack header")
    count, = struct.unpack_from("<I", data, directory)
    pos = directory + 4
    entries = {}
    for _ in range(count):
        length, = struct.unpack_from("<I", data, pos)
        pos += 4
        name = data[pos:pos + length].rstrip(b"\0").decode("utf-8")
        pos += length
        relative, size, checksum, entry_flags = struct.unpack_from("<2Q16sI", data, pos)
        pos += 36
        start = base + relative
        require(entry_flags == 0 and start + size <= directory and name not in entries, "Unexpected pack entry " + name)
        content = data[start:start + size]
        require(md5(content).digest() == checksum, "Pack checksum mismatch for " + name)
        require(name.startswith((".godot/", "assets/", "mod/")) or name in ("Main.tscn.remap", "project.binary"),
                "Unexpected pack path " + name)
        entries[name] = {"bytes": size, "sha256": sha256(content).hexdigest()}
    require(pos == len(data), "Unexpected trailing data in Godot pack")
    require({"project.binary", "Main.tscn.remap", "assets/maps/turkiye.json",
             "assets/maps/turkiye-brand-island.json", "assets/maps/world.json"}.issubset(entries), "Missing main scene or atlas")
    require(all(f"assets/effects/impact-{frame:02}.png.import" in entries for frame in range(15)), "Missing impact sprites")
    return entries


def package_files():
    roots = {"Fetih.exe", "Fetih.pck", "README.txt", "bridge", "licenses"}
    require({path.name for path in PAYLOAD.iterdir()} == roots, "Unexpected payload layout")
    files = {}
    for path in sorted(PAYLOAD.rglob("*")):
        require(not path.is_symlink() and not path.is_junction(), "Linked payload path " + str(path))
        if path.is_file():
            name = path.relative_to(PAYLOAD).as_posix()
            parts = PurePosixPath(name).parts
            require(not any(re.search(r"(^\.env|^steam|\.pck$|\.tscn$|^project\.godot$)", part, re.I)
                            for part in parts if name != "Fetih.pck"), "Unexpected payload path " + name)
            files[name] = path
    require(digest(files["Fetih.exe"]) == TEMPLATE_SHA, "Exported EXE differs from the official Windows template")
    runtime = PAYLOAD / "bridge/runtime"
    require("bridge/assets/widgets/country-leaders.html" in files, "Country leaders HTML is missing from the native package")
    require("bridge/assets/widgets/fetih-armies.html" in files, "Army standings HTML is missing from the native package")
    require("bridge/assets/guides/live-layout-muted.mp4" in files, "Muted broadcast guide clip is missing")
    require("bridge/assets/guides/ready-gift-design.png" in files, "Original ready-made gift graphic is missing")
    manifest = json.loads((runtime / "runtime-manifest.json").read_text(encoding="utf-8"))
    require(digest(runtime / "node.exe") == manifest["node"]["sha256"], "Bundled Node hash mismatch")
    gift_folder = runtime / "gift-assets"
    gift_catalog = gift_folder / "katalog_tam.json"
    gifts = json.loads(gift_catalog.read_text(encoding="utf-8-sig"))
    require(len(gifts) == manifest["catalog"]["count"] and digest(gift_catalog) == manifest["catalog"]["sha256"],
            "Bundled gift catalogue mismatch")
    require(len({str(gift["id"]) for gift in gifts}) == len(gifts), "Duplicate gift IDs in catalogue")
    for gift in gifts:
        image = gift["file"]
        require(re.fullmatch(r"[0-9]+\.png", image) and image != "0.png" and (gift_folder / image).is_file(),
                "Individual gift icon missing: " + image)
    for record in manifest["files"]:
        require(digest(runtime / record["file"]) == record["sha256"], "Bundled bridge file mismatch: " + record["file"])
    for package in manifest["packages"]:
        require(digest(runtime / package["path"] / "package.json") == package["packageSha256"],
                "Bundled Node dependency mismatch: " + package["name"])
    return files


def build(editor, output):
    require(editor.name == EDITOR_NAME + "_console.exe" and digest(editor) == CONSOLE_SHA,
            "Use the official 4.7.2 Windows x64 console wrapper")
    require(digest(editor.with_name(EDITOR_NAME + ".exe")) == EDITOR_SHA, "Godot editor SHA-256 mismatch")
    require((PAYLOAD / "bridge/runtime/node.exe").is_file(), "Standalone source and bridge snapshot are missing")
    prepare_template()
    run([str(editor), "--headless", "--path", str(PROJECT), "--import"], "build-import")
    run([str(editor), "--headless", "--path", str(PROJECT), "--export-release", "Windows x64", str(PAYLOAD / "Fetih.exe")],
        "build-export")
    entries = pck_index(PAYLOAD / "Fetih.pck")
    files = package_files()
    listing = {name: {"bytes": path.stat().st_size, "sha256": digest(path)} for name, path in files.items()}
    require(len({name.casefold() for name in files}) == len(files), "Case-conflicting ZIP paths")
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "Fetih-Windows-x64.zip"
    temporary = output / "Fetih-Windows-x64.zip.tmp"
    with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=6) as zip_file:
        for name, file in files.items():
            entry = ZipInfo(name, (2020, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            with file.open("rb") as source, zip_file.open(entry, "w") as target:
                shutil.copyfileobj(source, target)
    with ZipFile(temporary) as zip_file:
        require(zip_file.namelist() == list(files), "ZIP layout mismatch")
        for entry in zip_file.infolist():
            with zip_file.open(entry) as source:
                expected = listing[entry.filename]
                require(entry.file_size == expected["bytes"] and file_digest(source, "sha256").hexdigest() == expected["sha256"],
                        "ZIP contents mismatch: " + entry.filename)
    temporary.replace(archive)
    report = {"version": VERSION, "engine": "4.7.2.stable.official.ed1daf0bf",
              "entry": "Fetih.exe", "archive": archive.name, "bytes": archive.stat().st_size,
              "sha256": digest(archive), "files": listing, "godotPack": entries}
    archive.with_suffix(".contents.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    archive.with_suffix(".sha256").write_text(f"{report['sha256']}  {archive.name}\n", encoding="ascii")
    print(f"{archive} | {report['bytes']} bytes | SHA-256 {report['sha256']} | {len(files)} ZIP files | {len(entries)} PCK entries")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--editor", type=Path, default=Path("D:/TikMnG-GitHub-Araclari/runtime/godot-4.7.2") / (EDITOR_NAME + "_console.exe"))
    parser.add_argument("--output", type=Path, default=ROOT.parent / "qa/standalone-private")
    args = parser.parse_args()
    build(args.editor.resolve(), args.output.resolve())
