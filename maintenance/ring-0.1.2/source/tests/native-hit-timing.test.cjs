'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');

test('a brief contact is scored even when the next telemetry sample is not due',()=>{
  let solved=0,contacts=0;
  const ctx={NativeCallback:function(fn){return fn;},ready:true,started:true,finished:false,
    resumePhysics:false,pendingStagedSample:false,observeFeet:false,knockoutAt:0,
    maintainNativeGuard(){},solveLivingStep(){solved++;},getState(){},
    stanceClock:{readDouble:()=>1},lastPhysicsRead:995,Date:{now:()=>1000},
    checkGloves(_model,_data,now){assert.equal(solved,contacts+1);assert.equal(now,1000);contacts++;},
    position(){assert.fail('UI telemetry must still be throttled');}};
  const code=source.slice(source.indexOf('const step2=new NativeCallback('),source.indexOf('Interceptor.replace(step2Address'));
  const step=vm.runInNewContext(code+'\nstep2',ctx);
  step(null,null);step(null,null);
  assert.equal(contacts,2);
});

test('a scored hit publishes new HP in the same native frame despite the observer throttle',()=>{
  const messages=[];
  const ctx={Date:{now:()=>1000},lastPublish:990,healthChanged:false,
    health:()=>[1,1],ringHealth:[100,100],scoredSwing:[0,0],visibleLineup:[true,true],
    started:true,ready:true,finished:false,knockoutAt:0,winner:null,lastSignature:'',
    floorGaps:null,shoeGaps:null,steps:1,waitingCalls:0,punches:[{},{}],rootDistance:2,bodyHeight:1,rawHeadWorld:[],
    send:message=>messages.push(message)};
  const score=source.slice(source.indexOf('function scoreContact('),source.indexOf('function checkGloves('));
  const publish=source.slice(source.indexOf('function publish('),source.indexOf('// Observe the original tick'));
  const api=vm.runInNewContext(score+'\n'+publish+'\n({scoreContact,publish})',ctx);
  const game={add:()=>({readU8:()=>0,readS32:()=>0})};
  api.publish(game);assert.equal(messages.length,0);
  const attack={awaitingContact:true,issued:1,damage:15};
  api.scoreContact(1,attack,false,'body',120);
  api.publish(game);
  assert.deepEqual(messages.map(message=>message.type),['hit','state']);
  assert.deepEqual(Array.from(messages[1].value.health),[1,.85]);
  assert.equal(ctx.healthChanged,false);
  api.scoreContact(1,attack);api.publish(game);
  assert.equal(messages.length,2,'Repeated injury/contact cannot repeat damage or bypass throttling');
});
