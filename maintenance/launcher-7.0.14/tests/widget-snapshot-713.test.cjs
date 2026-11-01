'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs');
test('hydrated jars omit old gifts while new sources retain full restoration history',()=>{
 const state={channel:'one',activities:[{id:'old',createdAt:100},{id:'new',createdAt:200}],jarGifts:[{id:'saved'}],studio:{settings:{coinjar:{scale:100}},resets:{coinjar:150}}};
 for(const type of ['coinjar','giftpusher']){
  const hydrated=scopedWidgetSnapshot(state,type,{after:200,jarHistory:false});
  assert.equal(hydrated.jarGifts,undefined);assert.deepEqual(hydrated.activities,[state.activities[1]]);
  assert.deepEqual(scopedWidgetSnapshot(state,type).jarGifts,state.jarGifts);
 }
 assert.equal(state.jarGifts.length,1,'saved state remains intact');
});
test('each interaction source receives only its own screen configuration and reset',()=>{
 const settings=Object.fromEntries(Array.from({length:8},(_,i)=>['myactions:'+(i+1),{likeThreshold:i+1}]));
 const value=scopedWidgetSnapshot({studio:{settings,tests:{'myactions:4':{id:'four'}},resets:{'myactions:4':100}}},'myactions',{screen:'4'});
 assert.deepEqual(Object.keys(value.studio.settings),['myactions:4']);assert.equal(value.studio.tests['myactions:4'].id,'four');assert.equal(value.studio.resets['myactions:4'],100);
 assert.equal(scopedWidgetSnapshot({studio:{settings}},'myactions',{screen:'invalid'}).studio.settings['myactions:1'].likeThreshold,1);
});
