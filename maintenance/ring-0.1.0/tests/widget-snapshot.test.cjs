'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {widgetSnapshot}=require('../src/widgets/snapshot.cjs');
test('profiles and gifts follow the actual blue and red corners across replacements',()=>{
 const a={uniqueId:'ayse',nickname:'Ayşe'},b={uniqueId:'deniz',nickname:'Deniz'};
 const state={audience:{active:{left:a,right:b},settings:{punchGiftIdLeft:'5655',punchGiftIdRight:'5269'}},spectator:{health:[.75,.4]}};
 const summarize=()=>widgetSnapshot(state).fighters.rows.map(r=>[r.side,r.fighter.handle,r.hp,r.gift.name]);
 assert.deepEqual(summarize(),[['left','ayse',75,'Gül'],['right','deniz',40,'TikTok']]);
 state.audience.active={left:b,right:a};state.spectator.health=[1,1];
 assert.deepEqual(summarize(),[['left','deniz',100,'Gül'],['right','ayse',100,'TikTok']]);
 state.audience.settings={punchGiftIdLeft:'5269',punchGiftIdRight:'5655'};
 assert.deepEqual(summarize(),[['left','deniz',100,'TikTok'],['right','ayse',100,'Gül']]);
});
