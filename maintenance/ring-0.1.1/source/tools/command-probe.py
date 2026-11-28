"""Pinned isolated Online Boxing command test. Never attach another game build."""
import hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/hediye-box-probe-runtime'))
import frida
GAME=pathlib.Path('D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe')
if hashlib.sha256(GAME.read_bytes()).hexdigest()!='9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67':
    raise RuntimeError('Unsupported native build')
device=frida.get_local_device()
games=[p for p in device.enumerate_processes(scope='full') if p.name.lower()=='boxing.exe']
if len(games)!=1 or pathlib.Path(games[0].parameters.get('path','')).resolve()!=GAME.resolve():
    raise RuntimeError('Exactly one isolated game required')
session=device.attach(games[0].pid)
script=session.create_script(pathlib.Path(__file__).with_suffix('.js').read_text(encoding='utf-8'))
script.on('message',lambda message,_data:print(json.dumps(message),flush=True))
script.load()
try:
    for line in sys.stdin:
        request=json.loads(line);action=request.get('action')
        if action=='detach':break
        if action not in ['jab','cross','sample','baseline']:raise RuntimeError('Unsupported test action')
        result=getattr(script.exports_sync,action)()
        print(json.dumps({'action':action,'result':result}),flush=True)
finally:
    try:script.exports_sync.stop()
    finally:session.detach()
