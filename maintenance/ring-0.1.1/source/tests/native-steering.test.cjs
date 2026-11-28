'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const controlsSource=source.slice(source.indexOf('function nativeMatchControls('),source.indexOf('function activeStrike('));
const nativeMatchControls=vm.runInNewContext(controlsSource+'\nnativeMatchControls',{});
test('native steps continue between swings and the native punch stance plants during a swing',()=>{
 const original=Object.freeze([21,22,7,18,24,8,21,9,13,10,27,11,18,12,29,6,13]);
 assert.deepEqual(Array.from(nativeMatchControls(original,0)),[21,22,18,24,21,27,29]);
 assert.deepEqual(Array.from(nativeMatchControls(original,12)),[21,12,21]);
});
test('without a native punch slot a viewer punch appends once, even to empty input',()=>{
 for(const original of [[18],[18,22,22,24]]){
   assert.deepEqual(Array.from(nativeMatchControls(original,0)),original);
   assert.deepEqual(Array.from(nativeMatchControls(original,7)),[7]);
 }
 assert.deepEqual(Array.from(nativeMatchControls([],0)),[18]);
 assert.deepEqual(Array.from(nativeMatchControls([13,14,15,16,17,19,21,22,25],7)),[21,7]);
});
test('idle close-range footwork uses native steps and preserves an active native step',()=>{
 assert.deepEqual(Array.from(nativeMatchControls([],0,24)),[24,18]);
 assert.deepEqual(Array.from(nativeMatchControls([21],12,25)),[21,12]);
 assert.deepEqual(Array.from(nativeMatchControls([21,22],12,25)),[21,12]);
 assert.deepEqual(Array.from(nativeMatchControls([21,22],0,25,true)),[21,18]);
});
test('a pending out-of-range viewer punch closes with the original forward step instead of retreating',()=>{
 const original=Object.freeze([21,23,24,27,18]);
 assert.deepEqual(Array.from(nativeMatchControls(original,0,24,false,true)),[21,18,22]);
 assert.deepEqual(Array.from(nativeMatchControls([21,22,22,25,20],0,25,false,true)),[21,18,22]);
 assert.deepEqual(Array.from(nativeMatchControls(original,0,24,false,false)),[21,23,24,27,18]);
 assert.deepEqual(Array.from(nativeMatchControls(original,7,24,true,true)),[21,7]);
});
const controlsHookSource=source.slice(source.indexOf('const controlsHook='),source.indexOf('let latest='));
for(const [original,expected] of [[[20],[18]],[[20,22],[18,22]],[[7],[18]],[[0],[18]],[[19,22],[22,18]]]){
 test('controlsHook writes native input '+JSON.stringify(original)+' as '+JSON.stringify(expected),()=>{
  for(const side of [0,1]){
   const bytes=Uint8Array.from(original);
   let length=bytes.length,onEnter;
   const owned={add:index=>({
     readU8:()=>bytes[index],
     writeU8:value=>{assert.ok(index>=0&&index<bytes.length);bytes[index]=value;},
   })};
   const vector={
     readU64:()=>({toNumber:()=>bytes.length}),
     add(offset){
       if(offset===8)return{readPointer:()=>owned};
       assert.equal(offset,16,'Only the owned vector length may change');
       return{readU64:()=>({toNumber:()=>length}),writeU64:value=>{length=Number(value);}};
     },
   };
   const ctx={
     gameModule:{base:{add:rva=>{assert.equal(rva,0x2995e80);return rva;}}},
     Interceptor:{attach(_address,callbacks){onEnter=callbacks.onEnter;return{detach(){}};}},
     started:true,finished:false,resumePhysics:false,knockoutAt:0,combatMs:1000,rootDistance:null,
     punches:[{until:0,filtered:0},{until:0,filtered:0}],issuePunch(){},
     nativeMatchControls,nativeInputs:[[],[]],inputCodes:[[],[]],inputPolicy:[null,null],
     activeStrike:()=>false,
     nativeAllocate(){assert.fail('Same-length replacement must reuse the owned buffer');},
     freeHeap(){assert.fail('Same-length replacement must retain the owned buffer');},
   };
   vm.runInNewContext(controlsHookSource,ctx);
   assert.equal(typeof onEnter,'function');
   onEnter([null,{toInt32:()=>side},vector]);
   assert.equal(length,expected.length);
   assert.deepEqual(Array.from(bytes).slice(0,length),expected,'The original native vector must receive the filtered bytes');
   assert.deepEqual(Array.from(ctx.nativeInputs[side]),original,'Telemetry must preserve the incoming controls');
   assert.deepEqual(Array.from(ctx.inputCodes[side]),Array.from(bytes).slice(0,length),'Telemetry must match the controls passed to native');
  }
 });
}

test('live facing correction cannot rewrite a fighting body pose',()=>{
 const code=source.slice(source.indexOf('function faceOpponent('),source.indexOf('function shoeContacts('));
 const face=vm.runInNewContext(code+'\nfaceOpponent',{started:true,finished:false});
 assert.throws(()=>face(null,null,[true,true]),/Aktif maçta/);
});
test('an active tick takes both fighters’ positions from the native physics step',()=>{
 const code=source.slice(source.indexOf('const step2=new NativeCallback('),source.indexOf('Interceptor.replace(step2Address'));
 const roots=[[-4,1,0],[3,-1,0]];
 const positions={5:roots[0],26:roots[1],17:[-4,1,1],38:[3,-1,1]};
 let steps=0;
 const ctx={
   NativeCallback:function(callback){return callback;},
   ready:true,started:true,finished:false,resumePhysics:false,stageDirty:false,pendingStagedSample:false,visibleLineup:[true,true],
   solveLivingStep(){
     steps++;
     roots[0][0]+=.25;
     roots[1][1]-=.5;
   },
   maintainNativeGuard(){},
   getState(){},stanceClock:{readDouble:()=>1},lastPhysicsRead:0,
   motionState:{add:()=>({readByteArray:size=>new ArrayBuffer(size)})},qposCount:114,qvelCount:90,
   position:(_data,id)=>[...positions[id]],positionOutputs:[],observeFeet:false,
   facingError:()=>0,knockoutAt:0,checkGloves(){},backCorners:()=>null,
 };
 const step=vm.runInNewContext(code+'\nstep2',ctx);
 step(null,null);
 assert.equal(steps,1);
 assert.deepEqual(Array.from(ctx.motion.roots),[[-3.75,1,0],[3,-1.5,0]]);
});
