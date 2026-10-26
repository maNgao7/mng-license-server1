import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../plugin/ActionVisuals.cs',import.meta.url),'utf8');
const drive=readFileSync(new URL('../plugin/VoiceDrive.cs',import.meta.url),'utf8');
const damage=readFileSync(new URL('../plugin/TimedDamage.cs',import.meta.url),'utf8');
const limit=Number(source.match(/missingWheels.Count<(\d+)/)[1]);
const scoreExpression=source.match(/float score=(.*);/)[1]
  .replaceAll('missingWheels.Count','missing.length').replaceAll('Mathf.Abs','Math.abs')
  .replace('car.transform.InverseTransformPoint(missingWheels[0].position).z','missing[0].z');
const score=new Function('missing','position','firstSide',`return ${scoreExpression};`);

const clockBody=damage.match(/float WheelDamageClock \{get\{([\s\S]*?)\n    \}\}/)[1]
  .replace('float now=Time.unscaledTime','let now=rawNow');
const clock=new Function('state',`with(state){${clockBody}}`);
const durationExpression=damage.match(/static float DamageDuration\(float duration\)\{return (.*);\}/)[1]
  .replace('float.IsNaN','Number.isNaN').replace('float.IsInfinity','isInfinity');
const duration=new Function('duration','isInfinity',`return ${durationExpression};`);
const normalize=value=>duration(value,value=>value===Infinity||value===-Infinity);
const countExpression=source.match(/public int MissingWheelCount \{get\{return (.*);\}\}/)[1]
  .replaceAll('.Count','.length');
const count=new Function('state',`with(state){return ${countExpression};}`);
const damagedExpression=damage.match(/public bool Damaged \{get\{return (.*);\}\}/)[1];
const damaged=new Function('state',`with(state){return ${damagedExpression};}`);
const wheelDeadline=source.match(/wheelUntil=Mathf.Max\((.*)\);/)[1];
const extendWheel=new Function('wheelUntil','WheelDamageClock','duration','DamageDuration',`return Math.max(${wheelDeadline});`);
const damageDeadline=damage.match(/damageUntil=Mathf.Max\((.*)\);/)[1];
const extendDamage=new Function('damageUntil','WheelDamageClock','duration','DamageDuration',`return Math.max(${damageDeadline});`);
const refreshBody=source.match(/void RefreshWheelRenderers\(\)\{([\s\S]*?)\n    \}/)[1]
  .replace('var restored=new List<Renderer>();','const restored=[];')
  .replace('foreach(var item in wheelRenderers){','for(const [Key,Value] of wheelRenderers){const item={Key,Value};')
  .replace('bool hidden=','const hidden=')
  .replaceAll('.Contains(','.has(').replace('restored.Add(','restored.push(')
  .replace('foreach(var renderer in restored)wheelRenderers.Remove(renderer);','for(const renderer of restored)wheelRenderers.delete(renderer);');
const refresh=new Function('state',`with(state){${refreshBody}}`);
const restoreBody=source.match(/void RestoreWheel\(\)\{(.*)\}/)[1]
  .replaceAll('.Clear()','.clear()');
const restoreGift=new Function('state',`with(state){${restoreBody}}`);

// Unity-free adapter executes production clock, count, deadlines and owner reconciliation.
function wheelState(wheels){
  const missing=[],renderers=new Map();
  missing.clear=()=>{missing.length=0;};
  const state={rawNow:0,menuOpen:false,damageClockPaused:false,damagePauseStarted:0,damagePausedTotal:0,
    wheelUntil:0,damageUntil:0,car:{},damagedCar:null,damageWheels:[],missingWheels:missing,
    wheelRenderers:renderers,giftWheelRenderers:new Set(),damageWheelRenderers:new Set(),
    wheelBankReported:false,RestoreWheelBankOffset(){},RefreshWheelRenderers(){refresh(state);},
    get WheelDamageClock(){return clock(state);},get Damaged(){return damaged(state);}};
  function restore(){restoreGift(state);}
  function clearDamage(){state.damageUntil=0;state.damagedCar=null;state.damageWheels.length=0;state.damageWheelRenderers.clear();refresh(state);}
  function hide(wheel,owners){for(const renderer of wheel.renderers){if(!renderers.has(renderer))renderers.set(renderer,renderer.enabled);owners.add(renderer);renderer.enabled=false;}}
  return {
    missing,renderers,get count(){return count(state);},get until(){return state.wheelUntil;},
    time(value){state.rawNow=value;clock(state);},
    pause(){state.menuOpen=true;clock(state);},resume(){state.menuOpen=false;clock(state);},
    tick(){const now=clock(state);if(missing.length&&now>=state.wheelUntil)restore();if(state.damagedCar&&now>=state.damageUntil)clearDamage();},
    restore,clearDamage,reset(){clearDamage();restore();},
    explode(seconds){
      state.damageUntil=extendDamage(state.damageUntil,clock(state),seconds,normalize);state.damagedCar=state.car;
      for(const wheel of wheels){if(!wheel||!wheel.renderers.length||state.damageWheels.includes(wheel))continue;state.damageWheels.push(wheel);hide(wheel,state.damageWheelRenderers);}
    },
    gift(duration){
      if(clock(state)>=state.wheelUntil)restore();
      if(missing.length<limit){
        let next=null,best=Infinity;
        for(const wheel of wheels){
          if(!wheel||missing.includes(wheel)||!wheel.renderers.length)continue;
          const value=score(missing,wheel,missing[0]?.x??0);
          if(value<best){best=value;next=wheel;}
        }
        if(next){hide(next,state.giftWheelRenderers);missing.push(next);}
      }
      state.wheelUntil=extendWheel(state.wheelUntil,clock(state),duration,normalize);
    }
  };
}
function layout(side=1,end=1){return [[side,end],[-side,end],[-side,-end],[side,-end]].map(([x,z],i)=>({x,z,renderers:[{enabled:i!==1},{enabled:false}]}));}

test('successive gifts remove both wheels on the starting side first and cap at four',()=>{
  assert.equal(limit,4);
  for(const side of [-1,1])for(const end of [-1,1]){
    const state=wheelState(layout(side,end));
    for(let i=1;i<=7;i++){state.gift(10);assert.equal(state.count,Math.min(i,4));}
    assert.equal(state.missing[0].x,state.missing[1].x);
    assert.notEqual(state.missing[0].z,state.missing[1].z);
    assert.ok(state.missing.slice(2).every(wheel=>wheel.x===-side));
  }
});

test('expiry, gift restoration and reset restore initially disabled and shared renderers',()=>{
  assert.match(source,/WheelDamageClock>=wheelUntil\)RestoreWheel\(\)/);
  assert.match(source,/void ReleaseActionVisuals\(\)\{ClearTimedDamage\(\);RestoreWheel\(\)/);
  assert.match(drive,/void ResetEffects\(\)[^\n]*ReleaseActionVisuals\(\)/);
  assert.match(source,/if\(!wheelRenderers.ContainsKey\(renderer\)\)wheelRenderers.Add\(renderer,renderer.enabled\)/);
  for(const path of ['expiry','restore','reset']){
    const wheels=layout();wheels[3].renderers.push(wheels[0].renderers[0]);
    const original=new Map(wheels.flatMap(wheel=>wheel.renderers).map(renderer=>[renderer,renderer.enabled]));
    const state=wheelState(wheels);for(let i=0;i<4;i++)state.gift(10);
    assert.ok([...original.keys()].every(renderer=>!renderer.enabled));
    if(path==='expiry'){state.time(10);assert.equal(state.count,0);state.tick();}else if(path==='reset')state.reset();else state.restore();
    assert.equal(state.count,0);assert.equal(state.renderers.size,0);
    for(const [renderer,enabled] of original)assert.equal(renderer.enabled,enabled);
  }
});

test('gifts extend expiry, restart expired state, and skip absent wheel visuals',()=>{
  assert.match(source,/wheelUntil=Mathf.Max\(wheelUntil,WheelDamageClock\+DamageDuration\(duration\)\)/);
  assert.match(source,/if\(WheelDamageClock>=wheelUntil\)RestoreWheel\(\)/);
  const wheels=layout(),state=wheelState([null,{renderers:[]},...wheels]);
  state.gift(20);state.time(1);state.gift(2);assert.equal(state.until,20);
  state.time(19);state.gift(10);assert.equal(state.until,29);
  state.time(30);assert.equal(state.count,0);state.gift(5);
  assert.equal(state.count,1);assert.equal(state.missing[0],wheels[0]);assert.equal(state.until,35);
  assert.match(source,/public bool WheelMissing \{get\{return MissingWheelCount>0;\}\}/);
  for(const seconds of [0,-1,NaN,Infinity,-Infinity]){
    const fallback=wheelState(layout());fallback.gift(seconds);assert.equal(fallback.until,10);
    fallback.time(10);fallback.tick();assert.equal(fallback.count,0);
  }
});

test('production clock pauses wheel gifts and gives gifts received in the menu their full duration',()=>{
  const wheels=layout(),state=wheelState(wheels);state.gift(10);state.time(3);state.pause();
  state.time(103);state.tick();assert.equal(state.count,1);assert.equal(state.until,10);
  state.gift(20);assert.equal(state.count,2);assert.equal(state.until,23);
  state.resume();state.time(110);state.tick();assert.equal(state.count,2);
  state.pause();state.time(210);state.resume();state.time(222);state.tick();assert.equal(state.count,2);
  state.time(223);state.tick();assert.equal(state.count,0);assert.equal(state.renderers.size,0);
  assert.deepEqual(wheels.map(w=>w.renderers[0].enabled),[true,false,true,true]);
});

test('dual owners preserve original renderer states across either expiry order, clear and reset',()=>{
  for(const order of ['gift-first','damage-first','gift-during-damage','restore','clear','reset']){
    const wheels=layout();wheels[3].renderers.push(wheels[0].renderers[0]);
    const original=new Map(wheels.flatMap(w=>w.renderers).map(r=>[r,r.enabled]));
    const state=wheelState(wheels);
    if(order==='gift-during-damage'){state.explode(10);state.time(2);state.gift(20);}
    else{state.gift(order==='gift-first'?2:30);state.explode(10);}
    assert.equal(state.count,4);assert.ok([...original.keys()].every(r=>!r.enabled));
    if(order==='reset'){
      state.reset();assert.equal(state.count,0);
    }else if(order==='gift-first'||order==='restore'){
      if(order==='restore')state.restore();else{state.time(2);state.tick();}
      assert.equal(state.count,4);assert.ok([...original.keys()].every(r=>!r.enabled));
      state.time(10);state.tick();assert.equal(state.count,0);
    }else{
      if(order==='clear')state.clearDamage();else{state.time(10);state.tick();}
      assert.equal(state.count,1);assert.equal(state.missing[0],wheels[0]);
      assert.equal(wheels[0].renderers[0].enabled,false);
      assert.equal(wheels[3].renderers.at(-1).enabled,false);
      assert.equal(wheels[2].renderers[0].enabled,true);
      state.time(order==='gift-during-damage'?22:30);state.tick();assert.equal(state.count,0);
    }
    assert.equal(state.renderers.size,0);
    for(const [renderer,enabled] of original)assert.equal(renderer.enabled,enabled);
  }
});

test('banking accepts the explicit detached Visual and excludes physics and root transforms',()=>{
  const apply=source.slice(source.indexOf('public void ApplyWheelBankOffset()'),source.indexOf('void RestoreWheel(){'));
  assert.match(apply,/var visual=Get<Transform>\(car,"Visual"\)/);
  assert.doesNotMatch(apply,/!visual.IsChildOf\(car.transform\)/);
  assert.match(apply,/visual==car.transform\|\|car.transform.IsChildOf\(visual\)/);
  assert.match(apply,/part.GetComponentsInChildren<Rigidbody>\(true\).Length>0/);
  assert.match(apply,/part.GetComponentsInChildren<Collider>\(true\).Length>0/);
  assert.match(apply,/part==visual\|\|part==car.transform/);
  assert.match(apply,/part.GetComponent<Fusion.NetworkTransform>\(\)/);
  assert.match(apply,/part.localPosition=pose.appliedPosition;part.localRotation=pose.appliedRotation/);
  assert.match(apply,/center\+bank\*\(part.position-center\)/);
  assert.match(apply,/Mathf.Clamp\(-side\*8,-16,16\)/);
  assert.doesNotMatch(apply,/Vector3.down|Teleport|AddTorque|SetParent|rb\.|(?:visual|car.transform)\.(?:localPosition|localRotation|rotation|position)\s*=/);
  assert.match(source,/body.transform==pivot\|\|body.transform.IsChildOf\(pivot\)/);
  assert.match(source,/if\(renderer==body\)continue/);
  assert.match(source,/DefaultExecutionOrder\(-10000\)/);assert.match(source,/DefaultExecutionOrder\(10000\)/);
});

test('bank offset restoration preserves native replacements and reparenting without drift',()=>{
  assert.match(source,/pose.part.parent==pose.parent/);
  assert.match(source,/pose.part.localPosition-pose.appliedPosition/);
  assert.match(source,/Quaternion.Angle\(pose.part.localRotation,pose.appliedRotation\)/);
  function bank(visual){
    let saved=null;
    function restore(){
      if(saved&&visual.parent===saved.parent){for(const key of ['position','rotation'])if(visual[key]===saved.applied[key])visual[key]=saved.base[key];}
      saved=null;
    }
    return {restore,apply(){restore();const base={position:visual.position,rotation:visual.rotation};saved={parent:visual.parent,base,applied:{position:base.position,rotation:base.rotation-16}};Object.assign(visual,saved.applied);}};
  }
  for(const parent of [null,{}]){
    const visual={parent,position:3,rotation:20},effect=bank(visual);
    for(let i=0;i<1000;i++){effect.restore();effect.apply();}
    effect.restore();assert.equal(visual.position,3);assert.equal(visual.rotation,20);
    effect.apply();visual.position=100;effect.restore();assert.equal(visual.position,100);assert.equal(visual.rotation,20);
    effect.apply();visual.rotation=90;effect.restore();assert.equal(visual.position,100);assert.equal(visual.rotation,90);
    effect.apply();visual.parent={};visual.position=7;visual.rotation=8;effect.restore();
    assert.equal(visual.position,7);assert.equal(visual.rotation,8);
  }
});
