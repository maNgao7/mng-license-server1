'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs');
test('Stream Buddies includes only configured preview and reset state',()=>{
 const cold=scopedWidgetSnapshot({audience:[]},'streambuddies');
 assert.deepEqual(cold.studio.tests,{});
 assert.deepEqual(cold.studio.resets,{});
 const preview={events:[]};
 const active=scopedWidgetSnapshot({studio:{tests:{streambuddies:preview,coinjar:{events:[]}},resets:{streambuddies:100}}},'streambuddies');
 assert.deepEqual(active.studio.tests,{streambuddies:preview});
 assert.deepEqual(active.studio.resets,{streambuddies:100});
});
test('hydrated jars omit old gifts while new sources retain full restoration history',()=>{
 const state={channel:'one',activities:[{id:'old',type:'gift',createdAt:100},{id:'new',type:'gift',createdAt:200},{id:'like',type:'like',createdAt:201}],jarGifts:[{id:'saved'}],studio:{settings:{coinjar:{scale:100}},resets:{coinjar:150}}};
 for(const type of ['coinjar','giftpusher','jar-bell','jar-cat']){
  const hydrated=scopedWidgetSnapshot(state,type,{after:200,jarHistory:false});
  assert.equal(hydrated.jarGifts,undefined);assert.deepEqual(hydrated.activities,[state.activities[1]]);
  assert.deepEqual(scopedWidgetSnapshot(state,type).jarGifts,state.jarGifts);
  assert.deepEqual(scopedWidgetSnapshot({},type).jarGifts,[]);
 }
 assert.equal(state.jarGifts.length,1,'saved state remains intact');
});
test('each interaction source receives only its own screen configuration and reset',()=>{
 const settings=Object.fromEntries(Array.from({length:8},(_,i)=>['myactions:'+(i+1),{likeThreshold:i+1}]));
 const value=scopedWidgetSnapshot({studio:{settings,tests:{'myactions:4':{id:'four'}},resets:{'myactions:4':100}}},'myactions',{screen:'4'});
 assert.deepEqual(Object.keys(value.studio.settings),['myactions:4']);assert.equal(value.studio.tests['myactions:4'].id,'four');assert.equal(value.studio.resets['myactions:4'],100);
 assert.equal(scopedWidgetSnapshot({studio:{settings}},'myactions',{screen:'invalid'}).studio.settings['myactions:1'].likeThreshold,1);
});
test('PK overlay exposes only active native bonus state; per-gift receipts cannot start a timer',()=>{
 const now=Date.now(),active={battleId:'900',status:'active',players:[],teams:[]};
 const make=overrides=>({id:'official-x2',source:'native',official:true,kind:'multiplier',battleId:'900',occurredAt:now-1000,expiresAt:now+7000,data:{appliesTo:'gift',multiplier:2},...overrides});
 const state={studio:{pk:active,pkStage:{battleId:'900',status:'active',notifications:[make()]}}};
 assert.equal(scopedWidgetSnapshot(state,'pk').studio.pkMultiplierNotice,null);
 const effect={boostId:'bonus:1',source:'native',official:true,evidence:'native-task-settle',multiplier:2,startsAt:now-1000,expiresAt:now+44000};
 state.studio.pkStage.effects=[effect];
 assert.equal(scopedWidgetSnapshot(state,'pk').studio.pkMultiplierNotice.multiplier,2);
 for(const change of [{official:false},{source:'preview'},{expiresAt:now-1},{multiplier:5},{startsAt:now+1000},{evidence:'gift'},{expiresAt:now+90000}]){
  state.studio.pkStage.effects=[{...effect,...change}];assert.equal(scopedWidgetSnapshot(state,'pk').studio.pkMultiplierNotice,null);
 }
 for(const note of [make({official:false}),make({source:'preview'}),make({battleId:'901'}),make({expiresAt:now-1}),make({data:{appliesTo:'battle',multiplier:3}}),make({data:{appliesTo:'gift',multiplier:5}})]){
  const snapshot=scopedWidgetSnapshot({studio:{pk:active,pkStage:{battleId:'900',status:'active',notifications:[note]}}},'pk');
  assert.equal(snapshot.studio.pkMultiplierNotice,null);
 }
});
