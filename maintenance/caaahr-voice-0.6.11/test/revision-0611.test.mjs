import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Commands} from '../lib/commands.mjs';
const read=name=>readFileSync(new URL('../plugin/'+name,import.meta.url),'utf8');
test('large displacement commands reserve their travel time rather than expiring at fifteen seconds',()=>{
  let now=1000;const commands=new Commands(()=>now);commands.heartbeat({session:'qa',ready:true});
  const command=commands.add({action:'backward',distance:500,duration:10,strength:2});assert.ok(command.expiresAt-now>=30000);
  now+=16000;commands.heartbeat({session:'qa',ready:true});assert.ok(commands.pending.some(item=>item.id===command.id));
});
test('finish detection survives native control being disabled and countdown does not stall with lost focus',()=>{
  const track=read('CustomTrack.cs'),rounds=read('RaceRounds.cs');
  assert.match(track,/!menuOpen&&Get<bool>\(car,"spawned"\)&&TrackProgress>=builtLength/);
  const result=rounds.slice(rounds.indexOf('void UpdateRoundEnd()'),rounds.indexOf('void PrepareRaceHud()'));
  assert.doesNotMatch(result,/!Focused/);assert.match(result,/if\(menuOpen\)/);
  const draw=rounds.slice(rounds.indexOf('void DrawRoundResult()'),rounds.indexOf('float DrivingSpeed()'));
  assert.doesNotMatch(draw,/Kazanmak için|Yeni tur:|Fill\(/);assert.match(draw,/ScaleAroundPivot/);
});
test('restart bypasses travel and meteors; landing tries exact metres before nearby safe spots',()=>{
  const motion=read('GiftMotion.cs'),landing=read('ReverseRocket.cs');
  const restart=motion.slice(motion.indexOf('string RestartGiftInstant()'),motion.indexOf('void StartGiftMotion('));
  assert.match(restart,/SetPosAndRot\(spawn.position,spawn.rotation\)/);assert.doesNotMatch(restart,/StartMeteor|StartGiftMotion/);
  assert.match(landing,/step==0\?0/);assert.match(landing,/trackLayout.SafeZ\(Mathf.Clamp\(requested\+offset/);assert.doesNotMatch(landing,/trackLayout.GiftZ/);
});
