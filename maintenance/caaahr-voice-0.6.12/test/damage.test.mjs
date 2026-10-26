import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const damage=readFileSync(new URL('../plugin/TimedDamage.cs',import.meta.url),'utf8');
const visuals=readFileSync(new URL('../plugin/ActionVisuals.cs',import.meta.url),'utf8');

// Execute the production clock and renderer reconciliation with Unity-free values.
const clockBody=damage.match(/float WheelDamageClock \{get\{([\s\S]*?)\n    \}\}/)[1]
  .replace('float now=Time.unscaledTime','let now=rawNow');
const clock=new Function('state',`with(state){${clockBody}}`);
const durationExpression=damage.match(/static float DamageDuration\(float duration\)\{return (.*);\}/)[1]
  .replace('float.IsNaN','Number.isNaN').replace('float.IsInfinity','isInfinity');
const duration=new Function('duration','isInfinity',`return ${durationExpression};`);
const normalize=value=>duration(value,value=>value===Infinity||value===-Infinity);
const wheelDeadline=visuals.match(/wheelUntil=Mathf.Max\((.*)\);/)[1]
  .replaceAll('Mathf.Max','Math.max');
const extendWheel=new Function('wheelUntil','WheelDamageClock','duration','DamageDuration',`return Math.max(${wheelDeadline});`);
const damageDeadline=damage.match(/damageUntil=Mathf.Max\((.*)\);/)[1];
const extendDamage=new Function('damageUntil','WheelDamageClock','duration','DamageDuration',`return Math.max(${damageDeadline});`);
const refreshBody=visuals.match(/void RefreshWheelRenderers\(\)\{([\s\S]*?)\n    \}/)[1]
  .replace('var restored=new List<Renderer>();','const restored=[];')
  .replace('foreach(var item in wheelRenderers){','for(const [Key,Value] of wheelRenderers){const item={Key,Value};')
  .replace('bool hidden=','const hidden=')
  .replaceAll('.Contains(','.has(').replace('restored.Add(', 'restored.push(')
  .replace('foreach(var renderer in restored)wheelRenderers.Remove(renderer);','for(const renderer of restored)wheelRenderers.delete(renderer);');
const refresh=new Function('state',`with(state){${refreshBody}}`);

function fixture(){
  const s={rawNow:0,menuOpen:false,damageClockPaused:false,damagePauseStarted:0,damagePausedTotal:0,
    wheelUntil:0,damageUntil:0,wheelRenderers:new Map(),giftWheelRenderers:new Set(),damageWheelRenderers:new Set()};
  const wheels=Array.from({length:4},(_,i)=>({enabled:i!==3}));
  const hide=(renderer,owner)=>{if(!s.wheelRenderers.has(renderer))s.wheelRenderers.set(renderer,renderer.enabled);owner.add(renderer);renderer.enabled=false;};
  return {s,wheels,
    time(n){s.rawNow=n;return clock(s);},pause(){s.menuOpen=true;clock(s);},resume(){s.menuOpen=false;clock(s);},
    gift(index,seconds){s.wheelUntil=extendWheel(s.wheelUntil,clock(s),seconds,normalize);hide(wheels[index],s.giftWheelRenderers);},
    explode(seconds){s.damageUntil=extendDamage(s.damageUntil,clock(s),seconds,normalize);for(const w of wheels)hide(w,s.damageWheelRenderers);},
    tick(){const now=clock(s);if(now>=s.wheelUntil)s.giftWheelRenderers.clear();if(now>=s.damageUntil)s.damageWheelRenderers.clear();refresh(s);},
    clearDamage(){s.damageUntil=0;s.damageWheelRenderers.clear();refresh(s);}
  };
}

test('duration defaults to ten seconds and retains configured positive durations',()=>{
  for(const value of [0,-1,NaN,Infinity,-Infinity])assert.equal(normalize(value),10);
  for(const value of [.5,10,60])assert.equal(normalize(value),value);
});

test('explosion recovers automatically without clearing a longer wheel gift',()=>{
  const f=fixture();f.gift(0,30);f.explode(10);
  assert.ok(f.wheels.every(w=>!w.enabled));
  f.time(10);f.tick();assert.deepEqual(f.wheels.map(w=>w.enabled),[false,true,true,false]);
  f.time(30);f.tick();assert.deepEqual(f.wheels.map(w=>w.enabled),[true,true,true,false]);
  assert.equal(f.s.wheelRenderers.size,0);
});

test('wheel expiry during explosion retains all explosion wheels until recovery',()=>{
  const f=fixture();f.gift(0,2);f.explode(10);f.time(3);f.tick();
  assert.ok(f.wheels.every(w=>!w.enabled));
  f.time(10);f.tick();assert.deepEqual(f.wheels.map(w=>w.enabled),[true,true,true,false]);
});

test('wheel gifts arriving during damage survive explosion recovery',()=>{
  const f=fixture();f.explode(10);f.time(7);f.gift(1,20);f.time(10);f.tick();
  assert.deepEqual(f.wheels.map(w=>w.enabled),[true,false,true,false]);
  f.time(27);f.tick();assert.deepEqual(f.wheels.map(w=>w.enabled),[true,true,true,false]);
});

test('menu freezes both deadlines, including effects received while paused',()=>{
  const f=fixture();f.explode(10);f.time(3);f.pause();
  assert.equal(f.time(103),3);f.gift(0,20);f.tick();assert.ok(f.wheels.every(w=>!w.enabled));
  f.resume();assert.equal(f.time(109),9);f.tick();assert.ok(f.wheels.every(w=>!w.enabled));
  f.time(110);f.tick();assert.deepEqual(f.wheels.map(w=>w.enabled),[false,true,true,false]);
  f.time(112);f.pause();f.time(212);f.resume();assert.equal(f.time(223),23);f.tick();
  assert.deepEqual(f.wheels.map(w=>w.enabled),[true,true,true,false]);
});

test('repeated explosions extend without shortening; clear preserves gift ownership',()=>{
  const f=fixture();f.explode(30);f.time(1);f.explode(2);assert.equal(f.s.damageUntil,30);
  f.time(25);f.explode(10);assert.equal(f.s.damageUntil,35);
  f.gift(2,20);f.clearDamage();assert.deepEqual(f.wheels.map(w=>w.enabled),[true,true,false,false]);
  f.time(45);f.tick();assert.equal(f.s.wheelRenderers.size,0);
});

test('lifecycle, visual bounds and independent owner contracts remain wired',()=>{
  assert.match(damage,/public bool Damaged/);
  for(const method of ['StartTimedDamage','UpdateTimedDamage','ClearTimedDamage'])assert.match(damage,new RegExp(`public void ${method}\\(`));
  assert.match(visuals,/void UpdateActionVisuals\(\)\{\s*UpdateTimedDamage\(\)/);
  assert.match(visuals,/void ReleaseActionVisuals\(\)\{ClearTimedDamage\(\);RestoreWheel\(\)/);
  assert.match(damage,/now>=damageUntil/);
  assert.match(damage,/damageWheels.Clear\(\);damageWheelRenderers.Clear\(\);RefreshWheelRenderers\(\)/);
  assert.match(visuals,/giftWheelRenderers.Clear\(\);missingWheels.Clear\(\);wheelUntil=0;RefreshWheelRenderers\(\)/);
  assert.match(damage,/CreateDamageParticles\("Engine smoke",true,96/);
  assert.match(damage,/CreateDamageParticles\("Explosion sparks",false,64/);
  assert.match(damage,/damageSparks.Emit\(48\)/);
  assert.match(damage,/ParticleSystemRenderMode.Billboard/);
  assert.match(damage,/damageTexture.SetPixel/);
  assert.match(damage,/main.useUnscaledTime=true/);
  assert.match(damage,/damageSmoke.Pause\(\)/);
  assert.match(damage,/damageSparks.Pause\(\)/);
  assert.match(damage,/Destroy\(damageMaterial\)/);
  assert.match(damage,/Destroy\(damageTexture\)/);
  assert.doesNotMatch(damage,/RestartGame|CreatePrimitive|StartCoroutine|RigidbodyConstraints/);
});
