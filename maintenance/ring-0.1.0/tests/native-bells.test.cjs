'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('native automatic bells become silent while originals, unrelated sound and format remain intact',()=>{
 const source=String.raw`import importlib.util,pathlib,tempfile,wave,struct
p=pathlib.Path('tools/prepare-native-bells.py');s=importlib.util.spec_from_file_location('bells',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 root=pathlib.Path(temp);game=root/'native';audio=game/'assets/sounds/sounds_v2';audio.mkdir(parents=True);backup=root/'backup'
 for name in ['round_start.wav','round_end.wav','punch.wav']:
  with wave.open(str(audio/name),'wb') as w:w.setparams((1,2,44100,80,'NONE','not compressed'));w.writeframes(struct.pack('<h',1234)*80)
 original=(audio/'round_start.wav').read_bytes();punch=(audio/'punch.wav').read_bytes()
 assert len(m.prepare(game,backup))==2
 for name in ['round_start.wav','round_end.wav']:
  with wave.open(str(audio/name),'rb') as r:assert r.getnframes()==80 and r.getframerate()==44100 and set(r.readframes(80))=={0}
 assert (backup/'native-auto-round_start.wav').read_bytes()==original
 assert (audio/'punch.wav').read_bytes()==punch
 assert m.prepare(game,backup)==[]
 print('Selective native bell preparation passed')`;
 const r=spawnSync('python',['-c',source],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);
});
