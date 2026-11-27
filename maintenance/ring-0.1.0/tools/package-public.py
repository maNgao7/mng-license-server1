"""Build the Ring adapter; the proprietary Steam demo is installed by its owner."""
from pathlib import Path
import hashlib,json,shutil,zipfile,os
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parents[1]/'work/ring-release-7038'
OUT=WORK/'game/Ring'
APP=OUT/'resources/app'
INSTALLED=Path('D:/TikMnG/Hediye-Box-Private/desktop-app')
STEAM=Path('D:/SteamLibrary/steamapps/common/OnlineBoxing3DDemo')
PRIVATE=Path('D:/TikMnG/Hediye-Box-Private/native-game')
OUT.mkdir(parents=True,exist_ok=True)
for file in INSTALLED.iterdir():
    if file.name in ['resources','preview-manifest.json']:continue
    target=OUT/('Ring.exe' if file.name=='HediyeBox.exe' else file.name)
    if file.is_dir():shutil.copytree(file,target,dirs_exist_ok=True)
    else:shutil.copy2(file,target)
APP.mkdir(parents=True,exist_ok=True)
for name in ['main.cjs','preload.cjs','package.json','src','desktop','spectator','broadcast','native-hud','assets']:
    source=ROOT/name
    if source.is_dir():shutil.copytree(source,APP/name,dirs_exist_ok=True)
    else:shutil.copy2(source,APP/name)
(APP/'tools').mkdir(exist_ok=True)
for name in ['focus-game.ps1','spectator-worker.py','spectator-native.js','native-camera.js','spectator-camera.js','game-volume.ps1','native-delta.py']:shutil.copy2(ROOT/'tools'/name,APP/'tools'/name)
# The packaged module tree is the existing verified TikMnG owner/client code.
shutil.copytree(INSTALLED/'resources/app/runtime/shared',APP/'runtime/shared',dirs_exist_ok=True)
for folder in ['lib','vendor']:
    shutil.copytree(Path('D:/TikMnG/Animal-Times-Live/bridge/runtime')/folder,APP/'runtime/shared'/folder,dirs_exist_ok=True)
shutil.copy2('D:/TikMnG/Animal-Times-Live/bridge/runtime/owner-helper.cjs',APP/'runtime/shared/owner-helper.cjs')
shutil.copytree(INSTALLED/'resources/app/runtime/probe-runtime',APP/'runtime/probe-runtime',dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
python=APP/'runtime/python';python.mkdir(parents=True,exist_ok=True)
for name in ['python.exe','python3.dll','python314.dll','vcruntime140.dll','vcruntime140_1.dll','LICENSE.txt']:shutil.copy2(Path('C:/Python314')/name,python/name)
shutil.copytree('C:/Python314/DLLs',python/'DLLs',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*_test*','_tkinter*'))
with zipfile.ZipFile(python/'python314.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in Path('C:/Python314/Lib').rglob('*.py'):
        relative=file.relative_to('C:/Python314/Lib')
        if any(p in ['site-packages','test','tests','__pycache__','tkinter','idlelib','ensurepip','turtledemo'] for p in relative.parts):continue
        archive.write(file,relative.as_posix())
(python/'python314._pth').write_text('python314.zip\nDLLs\n.\n',encoding='utf-8')
patch=APP/'runtime/native-patch';patch.mkdir(parents=True,exist_ok=True)
entries=[]
for file in PRIVATE.rglob('*'):
    if not file.is_file():continue
    relative=file.relative_to(PRIVATE)
    if relative.parts[0] not in ['assets','config','poses','properties']:continue
    if 'SINGLEPLAYER_GAMES' in relative.parts:continue
    original=STEAM/relative
    digest=hashlib.sha256(file.read_bytes()).hexdigest()
    if original.is_file() and hashlib.sha256(original.read_bytes()).hexdigest()==digest:continue
    target=patch/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,target)
    entries.append({'path':relative.as_posix(),'sha256':digest})
delta=WORK/'qa/native-compatibility.delta'
shutil.copy2(delta,patch/delta.name)
(patch/'manifest.json').write_text(json.dumps({'version':json.loads((ROOT/'package.json').read_text())['version'],'nativeHash':'9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67','compatibility':[{'sourceHash':hashlib.sha256((STEAM/'boxing.exe').read_bytes()).hexdigest(),'file':delta.name,'sha256':hashlib.sha256(delta.read_bytes()).hexdigest()}],'files':entries},indent=2))
bridge=OUT/'bridge/runtime';bridge.mkdir(parents=True,exist_ok=True)
(bridge/'owner-helper.cjs').write_text("module.exports=require('../../resources/app/runtime/shared/owner-helper.cjs');\n")
shutil.copytree('D:/TikMnG/Animal-Times-Live/bridge/runtime/gift-assets',bridge/'gift-assets',dirs_exist_ok=True)
for directory in ['frida-17.27.4.dist-info']:
    source=ROOT.parents[1]/'tools/hediye-box-probe-runtime'/directory
    if source.exists():shutil.copytree(source,APP/'runtime/probe-runtime'/directory,dirs_exist_ok=True)
(OUT/'RING-KURULUM.txt').write_text('TikMnG Ring\n\nWindows 10/11 64 bit. Steam: Online Boxing 3D Demo (4793540) bir kez kurulmalidir.\nhttps://store.steampowered.com/app/4793540/\nRing, demo dosyalarini kullanici kayit klasorune kopyalar; Steam kurulumu degismez.\nLauncher uzerinden Ring indir, sonra Oyna. B: yayin/eylemler, P: baslat/yeni ikili.\nKurulum videosu: https://www.youtube.com/watch?v=Il6t2jrBy1c\nPython veya gelistirme araci kurmaniz gerekmez.\n',encoding='utf-8')
print(json.dumps({'directory':str(OUT),'nativePatchFiles':len(entries),'containsSteamExecutable':False,'pythonBundled':True}))
