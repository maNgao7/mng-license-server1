"""Read-only MuJoCo instrumentation of the isolated Online Boxing test copy.

No state setters, controls, Windows input, account files or remote process access.
Only the pinned copied game may be started/attached. Used to establish whether a
native game adapter is possible before claiming gift-driven punches work.
"""
import hashlib
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools' / 'hediye-box-probe-runtime'))
import frida

GAME = pathlib.Path('D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe')
EXPECTED_HASH = '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67'
SCRIPT = r'''
'use strict';
const m = Process.getModuleByName('mujoco.dll');
const version = new NativeFunction(m.getExportByName('mj_version'), 'int', []);
if (version() !== 337) throw new Error('Unsupported MuJoCo version');
const id2name = new NativeFunction(m.getExportByName('mj_id2name'), 'pointer', ['pointer','int','int']);
const getSize = new NativeFunction(m.getExportByName('mj_stateSize'), 'int', ['pointer','uint']);
const getState = new NativeFunction(m.getExportByName('mj_getState'), 'void', ['pointer','pointer','pointer','uint']);
let frames = 0, lastSampleAt = 0, cachedSample = {frames:0,ready:false};
const models = new Set();
const hooks = [];
function observe(model, data) {
  frames++;
  // Read only on the engine's own physics callback. RPC never dereferences
  // native pointers which could have been freed between scenes.
  if (Date.now()-lastSampleAt>=200) {
    lastSampleAt=Date.now();
    const values={};
    for (const [label,spec] of [['qpos',2],['ctrl',32],['forces',64]]) {
      const size=getSize(model,spec);
      if(size<0||size>10000)throw new Error('Invalid model size');
      const p=Memory.alloc(Math.max(8,size*8));
      getState(model,data,p,spec);
      values[label]=Array.from({length:Math.min(size,160)},(_,i)=>p.add(i*8).readDouble());
    }
    cachedSample={frames,ready:true,...values};
  }
  const key = model.toString();
  if (models.has(key)) return;
  models.add(key);
  const dims = Array.from({length: 12}, (_, i) => model.add(i*4).readS32());
  const names = {};
  for (const [label,kind,n] of [['body',1,dims[4]],['joint',3,dims[9]],['actuator',19,dims[2]]]) {
    names[label] = [];
    for (let i=0;i<n;i++) {
      const p=id2name(model,kind,i);
      if (p.isNull()) continue;
      names[label].push({id:i,name:p.readCString().slice(0,180)});
    }
  }
  send({type:'model',dimensions:dims,names});
}
for (const name of ['mj_step1','mj_step2']) {
  hooks.push(Interceptor.attach(m.getExportByName(name), {onEnter(args) {observe(args[0],args[1]);}}));
}
rpc.exports = {
  sample() {
    return cachedSample;
  },
  stop() {for(const hook of hooks)hook.detach();}
};
send({type:'attached',mujocoVersion:version(),mode:'read-only'});
'''

def main():
    if hashlib.sha256(GAME.read_bytes()).hexdigest() != EXPECTED_HASH:
        raise RuntimeError('Unsupported copied game build; refusing instrumentation')
    device = frida.get_local_device()
    existing = [p for p in device.enumerate_processes(scope='full') if p.name.lower() == 'boxing.exe']
    if '--attach-copy' in sys.argv:
        matches = [p for p in existing if pathlib.Path(p.parameters.get('path','')).resolve() == GAME.resolve()]
        if len(matches) != 1 or len(existing) != 1:
            raise RuntimeError('Exactly one isolated copied game required')
        pid = matches[0].pid
        child = None
    else:
        if existing:
            raise RuntimeError('An existing boxing game is running; close it before isolated probing')
        child = subprocess.Popen([str(GAME)], cwd=GAME.parent, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pid = child.pid
    session = None
    script = None
    try:
        for _ in range(80):
            if child and child.poll() is not None:
                raise RuntimeError('Copied game exited before attach')
            try:
                session = device.attach(pid)
                script = session.create_script(SCRIPT)
                script.on('message', lambda message, _data: print(json.dumps(message, ensure_ascii=False), flush=True))
                script.load()
                break
            except frida.InvalidOperationError:
                time.sleep(.25)
        if not script:
            raise RuntimeError('Native probe could not attach')
        print(json.dumps({'type':'process','pid':pid,'mode':'read-only'}), flush=True)
        for line in sys.stdin:
            try:
                request=json.loads(line)
                if request.get('action') == 'sample':
                    print(json.dumps({'type':'sample','value':script.exports_sync.sample()}),flush=True)
                elif request.get('action') == 'detach':
                    break
                else:
                    print(json.dumps({'type':'error','error':'Unknown probe action'}),flush=True)
            except Exception as error:
                print(json.dumps({'type':'error','error':str(error)[:300]}),flush=True)
    finally:
        if session:
            session.detach()

if __name__ == '__main__':
    main()
