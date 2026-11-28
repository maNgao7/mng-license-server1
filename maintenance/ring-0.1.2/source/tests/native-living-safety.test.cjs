'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const layout=require('../assets/ring-layout.js');
const code=source.slice(source.indexOf('function livingRootForce('),source.indexOf('const step2Address='));
class Pointer{
  constructor(count,buffer=Buffer.alloc(count*8),offset=0){this.buffer=buffer;this.offset=offset;}
  add(n){return new Pointer(0,this.buffer,this.offset+n);}
  readDouble(){return this.buffer.readDoubleLE(this.offset);}
  writeDouble(n){this.buffer.writeDoubleLE(n,this.offset);}
  readByteArray(n){return Buffer.from(this.buffer.subarray(this.offset,this.offset+n));}
  writeByteArray(bytes){Buffer.from(bytes).copy(this.buffer,this.offset);}
}
const read=(p,n)=>Array.from({length:n},(_,i)=>p.add(i*8).readDouble());
function fixture(){
  const roots=[[-.5,-4,1],[-.5,-2,1]],spines=[[-.5,-4,1.8],[-.5,-2,1.8]],heads=[[-.5,-4,2.2],[-.5,-2,2.2]];
  const velocities=new Array(90).fill(0),forces=Array.from({length:90},(_,i)=>i+.125),initial=[...forces];
  const writes=[],during=[],mass=new Pointer(47);
  // Static ring masses must never be used to amplify a fighter's support.
  for(let i=1;i<47;i++)mass.add(i*8).writeDouble(i<5?8478000:(i<26?4:5));
  let lastSide=0;
  const ctx={ready:true,started:true,finished:false,knockoutAt:0,combatMs:1000,
    qposCount:114,qvelCount:90,visibleLineup:[true,true],ringHealth:[100,100],
    livingSafety:[0,1].map(()=>({since:null,recovering:false,count:0,boundary:false})),
    corners:[[-.5,-4,1],[-.5,-2,1]],TikMngRingLayout:layout,
    safetyState:new Pointer(204),savedForces:new Pointer(90),safetyForces:new Pointer(90),
    mjVersion:()=>337,stateSize:()=>90,
    globalMatrix:{add:offset=>({readDouble:()=>offset===64?1:0})},
    position(_data,id){lastSide=id>=26?1:0;const local=id-21*lastSide;
      return(local===5?roots:local===8?spines:heads)[lastSide];},
    bodyLean(root,upper){return Math.atan2(Math.hypot(upper[0]-root[0],upper[1]-root[1]),upper[2]-root[2]);},
    getState(_m,_d,out,spec){
      assert.ok(spec===(2|4)||spec===64);
      const values=spec===64?forces:new Array(114).fill(0).concat(velocities);
      values.forEach((value,i)=>out.add(i*8).writeDouble(value));
    },
    setState(_m,_d,out,spec){assert.equal(spec,64,'Never write qpos, qvel, actuator or solver state');
      forces.splice(0,90,...read(out,90));writes.push([...forces]);},
    nativeStep2(){during.push([...forces]);},
  };
  const model={add:offset=>offset===16?{readS32:()=>47}:{readPointer:()=>{assert.equal(offset,1496);return mass;}}};
  vm.runInNewContext(code,ctx);
  return{ctx,roots,spines,heads,velocities,forces,initial,writes,during,
    run:()=>ctx.solveLivingStep(model,'data'),
    tilt:()=>{ctx.globalMatrix={add:offset=>({readDouble:()=>offset===48?.8:offset===64?.6:0})};},
    setTime:t=>{ctx.combatMs=t;}};
}

test('healthy native movement in the ring passes through with every force and motor intact',()=>{
  const f=fixture();f.run();assert.equal(f.writes.length,0);assert.deepEqual(f.during,[f.initial]);
  assert.ok(f.ctx.livingSafety.every(s=>!s.recovering&&!s.boundary));
});

for(const axis of [0,1])for(const sign of [-1,1])test(`edge braking uses the correct physics axis ${axis} and sign ${sign}`,()=>{
  const f=fixture(),center=[layout.centerX,-layout.centerZ];
  f.roots[0][axis]=center[axis]+sign*(layout.halfRing-.6);f.velocities[axis]=sign*2;
  // Keep this root's chest stacked; this case must not engage balance support.
  f.spines[0]=f.roots[0].map((v,i)=>i===2?v+.8:v);f.heads[0]=f.roots[0].map((v,i)=>i===2?v+1.2:v);
  f.run();assert.equal(f.ctx.livingSafety[0].boundary,true);assert.equal(f.ctx.livingSafety[0].recovering,false);
  for(let i=0;i<90;i++)assert.equal(f.during[0][i],f.initial[i]+(i===axis?-sign*84*28:0));
  assert.deepEqual(f.forces,f.initial,'Restore every original applied force after the single native solve');
});

test('boundary support never damps tangential or already inward velocity',()=>{
  const f=fixture();vm.runInNewContext(code,f.ctx);
  const root=[layout.centerX+layout.halfRing-.6,-layout.centerZ,1];
  const inward=f.ctx.livingRootForce(root,[-4,7,0,0,0,9],[0,0,1],1,layout,false,84);
  assert.deepEqual(Array.from(inward),[-84*12,0,0,0,0,0]);
  const capped=f.ctx.livingRootForce([100,-100,1],[100,-100,0,0,0,0],[0,0,1],1,layout,false,84);
  assert.equal(Math.abs(capped[0]),84*30);assert.equal(Math.abs(capped[1]),84*30);
});

test('a transient native lean is free, a sustained lean recovers, and standing releases support',()=>{
  const f=fixture();f.spines[0]=[.1,-4,1.5];f.tilt();
  f.run();f.setTime(1079);f.run();assert.equal(f.writes.length,0);
  f.setTime(1080);f.run();assert.equal(f.ctx.livingSafety[0].recovering,true);assert.equal(f.ctx.livingSafety[0].count,1);
  assert.deepEqual(f.during.at(-1),f.initial,'A fallen guard must not be torqued by the solver');
  f.spines[0]=[-.5,-4,1.8];f.setTime(1100);f.run();
  assert.equal(f.ctx.livingSafety[0].recovering,false);assert.deepEqual(f.during.at(-1),f.initial);
});

test('a deep physical fall at one HP waits for boundary recovery without a launch force',()=>{
  const f=fixture();f.ctx.ringHealth[1]=1;f.roots[1][2]=.4;f.spines[1]=[.4,-2,.5];f.tilt();
  f.velocities[47]=-3;f.velocities[48]=100;f.velocities[49]=-100;
  f.run();assert.equal(f.ctx.livingSafety[1].count,1);
  assert.deepEqual(f.during[0],f.initial);
  assert.deepEqual(f.forces,f.initial);
  const upward=f.ctx.livingRootForce([-.5,-4,.9],[0,0,3,0,0,0],[0,0,1],1,layout,true,84);
  assert.equal(upward[2],0,'Do not add lift to a fighter that is already rising quickly');
});

test('zero authoritative HP and invisible fighters receive no recovery even with a fallen body',()=>{
  for(const invisible of [false,true]){
    const f=fixture();f.roots[0][2]=0;f.spines[0]=[1,-4,.1];
    if(invisible)f.ctx.visibleLineup[0]=false;else f.ctx.ringHealth[0]=0;
    f.ctx.livingSafety[0].recovering=true;f.run();
    assert.equal(f.writes.length,0);assert.equal(f.ctx.livingSafety[0].recovering,false);
  }
});

test('waiting, KO results and finished rounds use the original solver without safety writes',()=>{
  for(const [key,value] of [['started',false],['ready',false],['finished',true],['knockoutAt',123]]){
    const f=fixture();f.roots[0][0]=50;f.ctx[key]=value;f.run();
    assert.equal(f.writes.length,0);assert.deepEqual(f.during,[f.initial]);
  }
});

test('external forces are restored on native solver failure, and incompatible layouts fail before writing',()=>{
  const f=fixture();f.roots[0][0]=9;f.ctx.nativeStep2=()=>{throw new Error('native solve failed');};
  assert.throws(f.run,/native solve failed/);assert.deepEqual(f.forces,f.initial);assert.equal(f.writes.length,2);
  const incompatible=fixture();incompatible.roots[0][0]=9;incompatible.ctx.stateSize=()=>89;
  assert.throws(incompatible.run,/sürümle uyuşmuyor/);assert.equal(incompatible.writes.length,0);assert.equal(incompatible.during.length,0);
});

test('positive HP leaves a stuck native down state once; zero HP keeps the stock knockout controller',()=>{
  const nativeDown=[1,2],statusWrites=[],values=new Map();
  for(const base of [0,0x2e20])for(const offset of [0x9ec,0x9f0,0xa2c,0xa30,0x9ac,0x9bc,0x9fc,0xa3c])values.set(base+offset,200);
  const pointer=offset=>({add:n=>pointer(offset+n),readFloat:()=>values.get(offset)??0,
    writeFloat:n=>values.set(offset,n),readU8:()=>nativeDown[offset>=0x2e20?1:0],
    writeByteArray:bytes=>{const side=offset>=0x2e20?1:0;statusWrites.push([side,Array.from(bytes)]);nativeDown[side]=0;}});
  const ctx={health:()=>[1,1],started:true,finished:false,knockoutAt:0,combatMs:1000,
    punches:[{issued:0},{issued:0}],ringHealth:[1,0],nativeStunPeaks:[0,0],lastChannelHealth:[[200,200],[200,200]],
    livingSafety:[0,1].map(()=>({recovering:false,count:0})),scoreContact(){assert.fail('A fall cannot score damage');}};
  const protect=vm.runInNewContext(source.slice(source.indexOf('function protectHealth('),source.indexOf('function publish('))+'\nprotectHealth',ctx);
  protect(pointer(0));protect(pointer(0));
  assert.deepEqual(statusWrites,[[0,[1,0,0,0,0]]]);assert.equal(ctx.livingSafety[0].count,1);
  assert.deepEqual(ctx.ringHealth,[1,0]);assert.equal(nativeDown[1],2);
});

test('native follow forwards both waiting-boxer targets and the legacy empty argument unchanged',()=>{
  const calls=[],ctx={cameraController:{follow:value=>{calls.push(value);return value;}}};
  const follow=vm.runInNewContext('({'+source.match(/follow\(value\)\{return cameraController\.follow\(value\);\}/)[0]+'}).follow',ctx);
  const target={point:[1,2,3],waitingId:'viewer-7'};
  assert.equal(follow(target),target);assert.equal(follow(),undefined);assert.deepEqual(calls,[target,undefined]);
});
