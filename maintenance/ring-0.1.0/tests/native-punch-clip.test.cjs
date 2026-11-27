'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const code=source.slice(source.indexOf('function needsNativeGuard('),source.indexOf('function prepareNativeTick('));

class BufferPointer{
 constructor(count,buffer=Buffer.alloc(count*8),offset=0){this.buffer=buffer;this.offset=offset;}
 add(n){return new BufferPointer(0,this.buffer,this.offset+n);}
 readDouble(){return this.buffer.readDoubleLE(this.offset);}
 writeDouble(value){this.buffer.writeDoubleLE(value,this.offset);}
 readByteArray(n){assert.ok(this.offset+n<=this.buffer.length);return Buffer.from(this.buffer.subarray(this.offset,this.offset+n));}
 writeByteArray(value){const bytes=Buffer.from(value);assert.ok(this.offset+bytes.length<=this.buffer.length);bytes.copy(this.buffer,this.offset);}
}
function write(pointer,values){values.forEach((value,i)=>pointer.add(i*8).writeDouble(value));}
function read(pointer,count){return Array.from({length:count},(_,i)=>pointer.add(i*8).readDouble());}
function pose(values){const pointer=new BufferPointer(10);write(pointer,values);return pointer.readByteArray(80);}
const guard=[1,0,0,0,.2,1,0,0,0,.4];
const extended=[0,0,0,1,.8,0,1,0,0,1];

function fixture(side=0,control=7){
 let now=1000;const writes=[],reads=[];
 const current=Array.from({length:114},(_,i)=>i+.125);
 const nativeControls=Array.from({length:78},(_,i)=>i+.25);
 const gloves=[[[-.2,.5,1.2],[.2,.5,1.2]],[[-.2,.5,1.2],[.2,.5,1.2]]];
 const ctx={ready:true,started:true,finished:false,knockoutAt:0,ringHealth:[100,100],
   qposCount:114,rootOffsets:[0,57],punchMotionMs:350,recordingPunch:null,originalPunches:{7:null,12:null},
   headForwardSign:[1,1],guardRepairs:[{arms:false,since:0,count:0},{arms:false,since:0,count:0}],
   punches:[{issued:0,control:7,until:0},{issued:0,control:12,until:0}],
   globalMatrix:{add:n=>({readDouble:()=>n===32?1:0})},
   position(data,id){
     const s=id>=26?1:0,local=id-s*21;
     if(local===12||local===15)return gloves[s][local===12?0:1];
     assert.ok(local===8||local===17);return[0,0,local===8?1:1.4];
   },
   stateSize:()=>78,
   getState(model,data,out,spec){
     assert.equal(model,'model');assert.equal(data,'data');reads.push(spec);
     if(spec===1){out.writeDouble(now/1000);return;}
     assert.ok(spec===2||spec===32);write(out,spec===2?current:nativeControls);
   },
   setState(model,data,out,spec){assert.equal(spec,32,'Only motor intent may be written');writes.push(read(out,78));},
   guardVelocity(){assert.fail('Unexpected native differentiation');},
   interpolatePose(){assert.fail('Unexpected native quaternion integration');},
 };
 for(const name of ['reference','guardCurrent','guardTarget','punchFrom','punchTo'])ctx[name]=new BufferPointer(114);
 for(const name of ['guardSpeeds','punchSpeeds'])ctx[name]=new BufferPointer(90);
 ctx.guardControls=new BufferPointer(78);ctx.stanceClock=new BufferPointer(1);
 write(ctx.reference,Array.from({length:114},(_,i)=>1000+i));
 for(let s=0;s<2;s++){
   current.splice(s*57+23,10,...guard);
   ctx.reference.add((s*57+23)*8).writeByteArray(pose(guard));
 }
 write(ctx.guardCurrent,current);write(ctx.guardTarget,current);
 ctx.punches[side]={issued:1,control,until:1350};
 vm.runInNewContext(code,ctx);
 return{ctx,current,nativeControls,gloves,writes,reads,
   capture:n=>ctx.captureOriginalPunch('model','data',n),setTime:n=>{now=n;},
   target:n=>ctx.originalPunchTarget('model',side,n),maintain:()=>ctx.maintainNativeGuard('model','data')};
}

for(const invalid of ['wide gloves','gloves behind chest'])test(`an invalid original swing is never committed: ${invalid}`,()=>{
 const f=fixture();f.capture(1000);
 f.gloves[0]=invalid==='wide gloves'?[[-1.6,.5,1.2],[1.6,.5,1.2]]:[[-.2,-.46,1.2],[.2,-.46,1.2]];
 f.capture(1030);assert.equal(f.ctx.recordingPunch.valid,false);
 f.gloves[0]=[[-.2,.5,1.2],[.2,.5,1.2]];
 for(let t=1060;t<=1330;t+=30)f.capture(t);
 assert.ok(f.ctx.recordingPunch.frames.length>=10);
 f.capture(1350);assert.equal(f.ctx.originalPunches[7],null);assert.equal(f.ctx.recordingPunch,null);
});

for(const [reason,times] of [
 ['fewer than ten frames',[40,80,120,160,200,240,280,330]],
 ['less than 300 milliseconds of coverage',[10,20,30,40,50,60,70,80,290]],
])test(`an incomplete clip is rejected: ${reason}`,()=>{
 const f=fixture();f.capture(1000);times.forEach(t=>f.capture(1000+t));
 f.capture(1350);assert.equal(f.ctx.originalPunches[7],null);assert.equal(f.ctx.recordingPunch,null);
});

for(const side of [0,1])test(`a healthy original swing commits once at its window end for side ${side}`,()=>{
 const control=side?12:7,f=fixture(side,control),offset=side*57+23;
 f.capture(1000);
 for(let t=1030;t<=1330;t+=30){f.current[offset+4]=t/1000;f.capture(t);}
 const recording=f.ctx.recordingPunch,frames=recording.frames;
 assert.equal(f.ctx.originalPunches[control],null,'Do not publish a partial recording');
 assert.deepEqual(read(new BufferPointer(0,Buffer.from(frames[0].pose)),10),guard);
 assert.equal(new BufferPointer(0,Buffer.from(frames[1].pose)).add(4*8).readDouble(),1.03,
   'Captured bytes must survive later qpos samples');
 f.capture(1349);assert.equal(f.ctx.originalPunches[control],null);
 f.capture(1350);assert.equal(f.ctx.originalPunches[control],frames);assert.equal(f.ctx.recordingPunch,null);
 assert.equal(frames.at(-1).time,349,'Never sample the next window into this clip');
 f.ctx.punches[side].until=2350;f.capture(2000);f.capture(2350);
 assert.equal(f.ctx.originalPunches[control],frames,'An original clip is learned only once');
});

test('a repaired arm cannot train another clip from an existing replacement',()=>{
 const f=fixture(0,12);f.ctx.originalPunches[7]=[{time:0,pose:pose(guard)}];
 f.ctx.guardRepairs[0].arms=true;f.capture(1000);f.capture(1030);
 assert.equal(f.ctx.recordingPunch,null);assert.equal(f.ctx.originalPunches[12],null);assert.equal(f.reads.length,0);
});

for(const side of [0,1])test(`clip interpolation delegates quaternion math and preserves all other joints for side ${side}`,()=>{
 const f=fixture(side),offset=side*57+23,calls=[];
 f.ctx.originalPunches[7]=[{time:0,pose:pose(guard)},{time:100,pose:pose(extended)},{time:350,pose:pose(guard)}];
 const half=Math.SQRT1_2,interpolated=[half,0,0,half,.5,half,half,0,0,.7];
 f.ctx.guardVelocity=(model,out,dt,from,to)=>{
   calls.push('differentiate');assert.equal(model,'model');assert.equal(out,f.ctx.punchSpeeds);assert.equal(dt,1);
   for(let i=0;i<114;i++){
     const arm=i>=offset&&i<offset+10;
     assert.equal(from.add(i*8).readDouble(),arm?guard[i-offset]:f.current[i]);
     assert.equal(to.add(i*8).readDouble(),arm?extended[i-offset]:f.current[i]);
   }
   out.writeDouble(123); // Token proving the native result reaches the integrator.
 };
 f.ctx.interpolatePose=(model,from,speeds,mix)=>{
   calls.push('integrate');assert.equal(model,'model');assert.equal(from,f.ctx.punchFrom);
   assert.equal(speeds,f.ctx.punchSpeeds);assert.equal(speeds.readDouble(),123);assert.equal(mix,.5);
   // Native quaternion integration returns a unit quaternion, not component lerp.
   from.add(offset*8).writeByteArray(pose(interpolated));
 };
 assert.equal(f.target(1025),true); // 25 ms elapsed + the native follower's 25 ms lookahead.
 assert.deepEqual(calls,['differentiate','integrate']);
 for(let i=0;i<114;i++)assert.equal(f.ctx.guardTarget.add(i*8).readDouble(),
   i>=offset&&i<offset+10?interpolated[i-offset]:f.current[i]);
 assert.deepEqual(read(f.ctx.guardCurrent,114),f.current);assert.equal(f.writes.length,0);
});

test('without an original clip, target lookup leaves the target untouched',()=>{
 const f=fixture(),before=f.ctx.guardTarget.readByteArray(114*8);
 assert.equal(f.target(1100),false);assert.deepEqual(f.ctx.guardTarget.readByteArray(114*8),before);
});

test('clip following ends exactly at punch.until and switches to guard recovery timing',()=>{
 const f=fixture(),calls=[];f.ctx.guardRepairs[0].arms=true;
 f.ctx.originalPunches[7]=[{time:0,pose:pose(guard)}];
 f.ctx.originalPunchTarget=(model,side,now)=>{calls.push(now);f.ctx.guardTarget.add(23*8).writeByteArray(pose(extended));return true;};
 f.ctx.guardVelocity=(model,out,dt,from,to)=>{
   assert.equal(dt,1);assert.equal(out,f.ctx.guardSpeeds);
   const expected=calls.length===1&&f.writes.length===0?extended:guard;
   assert.deepEqual(read(to.add(23*8),10),expected);
   for(let i=0;i<8;i++)out.add((18+i)*8).writeDouble(.8);
 };
 for(const now of [1349,1350,1351]){f.setTime(now);f.maintain();}
 assert.deepEqual(calls,[1349],'The clip must not run at or after the end of the swing');
 assert.equal(f.writes.length,3);
 for(const [frame,values] of f.writes.entries())for(let i=0;i<78;i++)
   assert.equal(values[i],i>=12&&i<20?(frame===0?10:4):f.nativeControls[i]);
});
