from pathlib import Path
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
WORKSPACE=ROOT.parents[1]
REPO=WORKSPACE/'work/snake-video-launcher-7034'
STAGE=WORKSPACE/'work/ring-hotfix-012'
meta=json.loads((STAGE/'release/ring-manifest.json').read_text())
assert meta['version']=='0.1.2'
baseline=REPO/'content-bootstrap-pre-ring-0.1.2.json'
if not baseline.exists():shutil.copy2(REPO/'content-defaults.json',baseline)
for name in ['content-defaults.json','web/content-catalog-7.0.0.json']:
    file=REPO/name
    data=json.loads(file.read_text(encoding='utf-8-sig'))
    old={row['id']:row for row in data['games'] if row['id']!='ring'}
    ring=next(row for row in data['games'] if row['id']=='ring')
    ring.update(version='0.1.2',url='https://github.com/maNgao7/mng-license-server1/releases/download/ring-0.1.2/Ring-Windows-x64.zip',sha256=meta['sha256'],bytes=meta['bytes'])
    data['revision']=2026112802
    data['publishedAt']='2026-11-28T14:30:00.000Z'
    assert old=={row['id']:row for row in data['games'] if row['id']!='ring'}
    file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
site=REPO/'web/game-catalog.json'
data=json.loads(site.read_text(encoding='utf-8'))
ring=next(row for row in data['games'] if row['id']=='ring')
if 'version' in ring:ring['version']='0.1.2'
data['revision']='20261128-ring-0.1.2'
site.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
html=REPO/'web/index.html'
text=html.read_bytes().decode('utf-8')
import re
text=re.sub(r'(<script id="publicGameCatalog" type="application/json">)[\s\S]*?(</script>)',
            lambda match:re.sub(r'"revision"\s*:\s*"[^"]+"','"revision":'+json.dumps(data['revision']),match[0],count=1),text,count=1)
html.write_bytes(text.encode('utf-8'))
destination=REPO/'maintenance/ring-0.1.2/source'
destination.mkdir(parents=True,exist_ok=True)
for name in ['main.cjs','preload.cjs','package.json','TECHNICAL-NOTES.md','YAYIN-REHBERI.md','src','spectator','desktop','broadcast','native-hud','assets','tests','tools']:
    source,target=ROOT/name,destination/name
    if source.is_dir():shutil.copytree(source,target,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    else:shutil.copy2(source,target)
(destination/'qa').mkdir(exist_ok=True)
shutil.copy2(ROOT/'qa/desktop-round-harness.cjs',destination/'qa/desktop-round-harness.cjs')
print(json.dumps({'game':'0.1.2','catalogRevision':2026112802,'renderDeployed':False}))
