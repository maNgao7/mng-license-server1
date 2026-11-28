"""Observe only the pinned isolated game's original input structures."""
import hashlib, json, pathlib, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT / 'tools/hediye-box-probe-runtime'))
import frida
GAME = pathlib.Path('D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe')
EXPECTED = '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67'
OUT = pathlib.Path(__file__).resolve().parents[1] / 'qa/input-probe.jsonl'
if hashlib.sha256(GAME.read_bytes()).hexdigest()!=EXPECTED:
    raise RuntimeError('Unsupported game build')
device=frida.get_local_device()
matches=[p for p in device.enumerate_processes(scope='full') if p.name.lower()=='boxing.exe']
if matches:
    if len(matches)!=1 or pathlib.Path(matches[0].parameters.get('path','')).resolve()!=GAME.resolve():
        raise RuntimeError('Unexpected existing game')
    pid=matches[0].pid
else:
    child=subprocess.Popen([str(GAME),'player_vs_player'],cwd=GAME.parent,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    pid=child.pid
    time.sleep(1)
session=device.attach(pid)
script=session.create_script(pathlib.Path(__file__).with_suffix('.js').read_text(encoding='utf-8'))
OUT.parent.mkdir(parents=True,exist_ok=True)
log=OUT.open('w',encoding='utf-8')
def message(value,_data):
    log.write(json.dumps(value,ensure_ascii=False)+'\n');log.flush()
    payload=value.get('payload',{})
    print(json.dumps({'type':payload.get('type',value.get('type')),'index':payload.get('index'),
                      'mode':payload.get('mode'),'changes':payload.get('changes'),
                      'error':value.get('description')}),flush=True)
script.on('message',message);script.load()
print(json.dumps({'type':'process','pid':pid}),flush=True)
try:
    for line in sys.stdin:
        request=json.loads(line)
        if request.get('action')=='sample': print(json.dumps(script.exports_sync.sample()),flush=True)
        elif request.get('action')=='detach': break
finally:
    session.detach();log.close()
