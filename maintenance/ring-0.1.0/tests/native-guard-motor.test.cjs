'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const code=source.slice(source.indexOf('function needsNativeGuard('),source.indexOf('function prepareNativeTick('));
class BufferPointer{
 constructor(count,buffer=Buffer.alloc(count*8),offset=0){this.buffer=buffer;this.offset=offset;}
 add(n){return new BufferPointer(0,this.buffer,this.offset+n);}
 readDouble(){return this.buffer.readDoubleLE(this.offset);}
 writeDouble(n){this.buffer.writeDoubleLE(n,this.offset);}
 readByteArray(n){return this.buffer.subarray(this.offset,this.offset+n);}
 writeByteArray(b){Buffer.from(b).copy(this.buffer,this.offset);}
}
function fixture(){
 let now=1000;const writes=[];
 const current=Array.from({length:114},(_,i)=>i+.5),nativeControls=Array.from({length:78},(_,i)=>i+.25);
 const reference=new BufferPointer(114);for(let i=0;i<114;i++)reference.add(i*8).writeDouble(1000+i);
 const ctx={ready:true,started:true,finished:false,knockoutAt:0,ringHealth:[100,100],rootOffsets:[0,57],
   guardRepairs:[{arms:false,since:0,count:0},{arms:false,since:0,count:0}],punches:[{until:0},{until:0}],
   stanceClock:{readDouble:()=>now/1000},headForwardSign:[1,1],recordingPunch:null,originalPunches:{7:null,12:null},
   globalMatrix:{add:n=>({readDouble:()=>n===32?1:0})},
   position(data,id){return({17:[0,0,1.4],38:[0,0,1.4],8:[0,0,1],29:[0,0,1],
     12:[-1.9,0,1],15:[1.9,0,1],33:[-.2,.4,1],36:[.2,.4,1]})[id];},
   reference,guardCurrent:new BufferPointer(114),guardTarget:new BufferPointer(114),
   guardSpeeds:new BufferPointer(90),guardControls:new BufferPointer(78),qposCount:114,
   stateSize:()=>78,
   getState(model,data,out,spec){
     if(spec===1)return;
     const values=spec===2?current:nativeControls;assert.ok(spec===2||spec===32);
     values.forEach((v,i)=>out.add(i*8).writeDouble(v));
   },
   guardVelocity(model,out,dt,from,to){
     assert.equal(dt,1);
     for(let i=0;i<114;i++){
       const selected=i>=23&&i<33;
       assert.equal(to.add(i*8).readDouble(),selected?1000+i:current[i],
         'Guard recovery must leave the root, spine, legs and the other boxer’s target untouched');
     }
     for(let i=0;i<8;i++)out.add((18+i)*8).writeDouble(i%2?-20:20);
   },
   setState(model,data,out,spec){assert.equal(spec,32,'Only motor controls may change during a living bout');
     writes.push(Array.from({length:78},(_,i)=>out.add(i*8).readDouble()));},
 };
 const repair=vm.runInNewContext(code+'\nmaintainNativeGuard',ctx);
 return{ctx,repair:()=>repair('model','data'),writes,nativeControls,setTime:n=>{now=n;}};
}
test('persistent invalid arms use their captured native guard through only eight velocity motors',()=>{
 const f=fixture();f.repair();assert.equal(f.writes.length,0);
 f.setTime(1081);f.repair();assert.equal(f.writes.length,1);
 assert.equal(f.ctx.guardRepairs[0].count,1);assert.equal(f.ctx.guardRepairs[1].count,0);
 for(let i=0;i<78;i++)assert.equal(f.writes[0][i],i>=12&&i<20?((i-12)%2?-12:12):f.nativeControls[i]);
});
test('unrecorded native punches bypass arm recovery and a defeated boxer gets no guard correction',()=>{
 const f=fixture();f.repair();f.setTime(1081);f.repair();
 f.ctx.punches[0].until=2000;f.setTime(1500);f.repair();assert.equal(f.writes.length,1);
 f.ctx.ringHealth[0]=0;f.setTime(2200);f.repair();assert.equal(f.writes.length,1);
});
test('original punch keyframes interpolate by simulation time and clamp outside their window',()=>{
 const pair=vm.runInNewContext(code+'\npunchFramePair',{});
 const frames=[{time:0,pose:'guard'},{time:100,pose:'opening'},{time:350,pose:'end'}];
 const mid=pair(frames,225);
 assert.equal(mid[0],frames[1]);assert.equal(mid[1],frames[2]);assert.equal(mid[2],.5);
 assert.equal(pair(frames,-1)[0],frames[0]);assert.equal(pair(frames,400)[0],frames[2]);
});
test('a missing motor layout fails before writing any controls',()=>{
 const f=fixture();f.ctx.stateSize=()=>77;f.repair();f.setTime(1081);
 assert.throws(f.repair,/Gard motorları/);assert.equal(f.writes.length,0);
});
