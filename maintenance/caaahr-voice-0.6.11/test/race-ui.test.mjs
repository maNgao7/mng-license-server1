import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=name=>readFileSync(new URL('../plugin/'+name,import.meta.url),'utf8');
test('voice prompt is hidden for actual movement, voice demand, menus and keyboard mode',()=>{
  const source=read('RaceRounds.cs');
  const expression=source.match(/bool VoicePromptVisible \{get\{return (.*);\}\}/)[1]
    .replaceAll('ActiveVoice.enabled','enabled').replaceAll('DrivingSpeed()','speed').replace(/(\d+(?:\.\d+)?|\.\d+)f/g,'$1');
  const visible=new Function('enteredGame','Ready','menuOpen','startingGame','trackFinished','autoDrive','giftMotion','Damaged','enabled','voiceDemand','Throttle','speed','Jailed',`return ${expression}`);
  const stopped=[true,true,false,false,false,false,false,false,true,0,0,0,false];
  assert.equal(visible(...stopped),true);
  for(const [index,value] of [[2,true],[3,true],[4,true],[5,true],[6,true],[7,true],[8,false],[9,.1],[10,.1],[11,1],[12,true]]){
    const input=[...stopped];input[index]=value;assert.equal(visible(...input),false,`guard ${index}`);
  }
});
test('only the straight course is selectable and win labels have contrast without a box',()=>{
  const custom=read('CustomTrack.cs'),menu=read('RaceMenu.cs');
  assert.match(custom,/return map==CustomMap;/);
  assert.doesNotMatch(menu,/LavaMap|Lav Parkuru/);
  assert.equal(existsSync(new URL('../plugin/LavaCourse.cs',import.meta.url)),false);
  assert.match(menu,/WASD sürüşe geç/);
  assert.match(custom,/HudShadowLabel[^\n]+"WIN "/);
  const hud=custom.slice(custom.indexOf('void DrawTrackHud()'),custom.indexOf('void ReleaseTrackGeometry()'));
  assert.doesNotMatch(hud,/Fill\(/);
});
