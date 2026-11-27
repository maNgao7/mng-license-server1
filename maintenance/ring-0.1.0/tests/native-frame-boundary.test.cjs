'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const boundarySource=source.slice(source.indexOf('function prepareNativeTick('),source.indexOf('const step2='));

function boundary(overrides={}){
 const calls=[];
 const ctx={ready:true,started:false,finished:true,stageDirty:true,resumePhysics:false,
   corners:[[1,1,0],[-1,-1,0]],nativePhysics:{model:'model',data:'data'},
   retainManualRound(){calls.push('release-native-inputs');if(ctx.finished&&ctx.stageDirty)ctx.finished=false;},
   protectHealth(){calls.push('health');},
   placeCorners(){assert.equal(ctx.started,false);calls.push('corners');ctx.stageDirty=false;},
   forwardPhysics(){calls.push('forward');},
   refreshNativeSnapshot(game,side){calls.push('snapshot-'+side);},
   applyStandingGuard(){calls.push('warmup');},updateStandingContacts(){calls.push('feet');},
   guardStartedAt:Date.now(),
   getState(){calls.push('clock');},stanceClock:{readDouble:()=>125.5,writeDouble(value){assert.equal(value,125.5);}},
   resetPhysics(){calls.push('reset-physics');},setState(model,data,clock,spec){assert.equal(spec,1);calls.push('restore-clock');},
   ...overrides};
 const prepare=vm.runInNewContext(boundarySource+'\nprepareNativeTick',ctx);
 return {ctx,calls,prepare};
}

test('new-round pose and both stock bone snapshots are ready before native AI runs',()=>{
 const {ctx,calls,prepare}=boundary();
 prepare('game');
 assert.deepEqual(calls,['release-native-inputs','health','clock','reset-physics','restore-clock','corners','release-native-inputs','health','forward','snapshot-0','snapshot-1']);
 assert.equal(ctx.pendingStagedSample,true);
 assert.equal(ctx.stageDirty,false);
 assert.equal(ctx.finished,false);
});

test('P resumes at the next native tick with the staged pose instead of mid-solve',()=>{
 const {ctx,calls,prepare}=boundary({started:true,finished:false,stageDirty:false,resumePhysics:true});
 prepare('game');
 assert.deepEqual(calls,['release-native-inputs','health','forward','snapshot-0','snapshot-1','clock']);
 assert.equal(ctx.resumePhysics,false);
 assert.equal(ctx.combatMs,125500);
 assert.equal(ctx.traceSteps,0);
});

test('waiting animation also precedes the stock bone snapshot and active fights keep native poses',()=>{
 const waiting=boundary({finished:false,stageDirty:false});waiting.prepare('game');
 assert.deepEqual(waiting.calls,['release-native-inputs','health','warmup','feet','forward','snapshot-0','snapshot-1']);
 const active=boundary({started:true,finished:false,stageDirty:false});active.prepare('game');
 assert.deepEqual(active.calls,['release-native-inputs','health']);
});

test('physics callback cannot stage a roster or rewrite the waiting guard after motor calculation',()=>{
 const code=source.slice(source.indexOf('const step2=new NativeCallback('),source.indexOf('Interceptor.replace(step2Address'));
 assert.ok(!code.includes('placeCorners('));
 assert.ok(!code.includes('applyStandingGuard('));
 assert.ok(!code.includes('setState('));
 assert.ok(!code.includes('forwardPhysics('));
});
