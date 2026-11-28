"""Reuse the verified portable runtime; overlay only the Ring adapter sources."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[1]
STAGE = WORKSPACE / 'work/ring-hotfix-011'
BASE = WORKSPACE / 'work/ring-release-7038/game/Ring'
OUT = STAGE / 'game/Ring'
APP = OUT / 'resources/app'
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8-sig'))['version']
assert VERSION == '0.1.1', 'Set the verified hotfix version before packaging'
assert BASE.is_dir() and (BASE / 'Ring.exe').is_file()
if not OUT.exists():
    shutil.copytree(BASE, OUT)
for name in ['main.cjs', 'preload.cjs', 'package.json', 'src', 'spectator', 'desktop', 'broadcast', 'native-hud', 'assets']:
    source, target = ROOT / name, APP / name
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    else:
        shutil.copy2(source, target)
shutil.copy2(ROOT / 'YAYIN-REHBERI.md', OUT / 'YAYIN-REHBERI.md')
for name in ['spectator-worker.py', 'spectator-native.js', 'spectator-camera.js', 'native-camera.js']:
    shutil.copy2(ROOT / 'tools' / name, APP / 'tools' / name)
patch_file = APP / 'runtime/native-patch/manifest.json'
patch = json.loads(patch_file.read_text(encoding='utf-8-sig'))
patch['version'] = VERSION
patch_file.write_text(json.dumps(patch, indent=2) + '\n', encoding='utf-8')
release = STAGE / 'release'
release.mkdir(parents=True, exist_ok=True)
archive_path = release / 'Ring-Windows-x64.zip'
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in OUT.rglob('*'):
        if not file.is_file() or '__pycache__' in file.parts or file.suffix.lower() in ['.pyc', '.pdb', '.lib']:
            continue
        archive.write(file, file.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert not any(Path(name).name.lower() in ['boxing.exe', 'mujoco.dll', 'steam_api64.dll', 'audience-settings.json', 'win-standings.json'] for name in names)
    for name in ['Ring.exe', 'resources/app/src/queue-target.cjs', 'resources/app/assets/queue-layout.js', 'resources/app/runtime/python/python.exe']:
        assert name in names
meta = {'game': 'ring', 'version': VERSION, 'file': archive_path.name, 'bytes': archive_path.stat().st_size,
        'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(), 'requiresSteamApp': '4793540',
        'tutorial': 'https://www.youtube.com/watch?v=Il6t2jrBy1c'}
(release / 'ring-manifest.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
print(json.dumps(meta))
