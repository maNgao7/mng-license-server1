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

test('widget portraits keep shared CDN candidates and reject private or lookalike origins',()=>{
 const candidates=['https://p16.ibyteimg.com/a.jpg','https://p16.ibytedtos.com/b.jpg',
  'https://p16.muscdn.com/c.jpg','https://p16.pstatp.com/d.jpg','https://p16.douyinpic.com/e.jpg',
  'https://p16.douyincdn.com/f.jpg','https://p16.tiktokcdn.com/g.jpg'];
 const fighter={uniqueId:'fighter',portrait:candidates[0],profilePictureUrls:candidates};
 const profile=widgetSnapshot({audience:{active:{left:fighter},queue:[fighter]},celebration:{fighter,wins:2}});
 for(const person of [profile.fighters.rows[0].fighter,profile.queue.rows[0],profile.winners.champion]){
  assert.equal(person.portrait,candidates[0]);
  assert.deepEqual(person.portraitAlternatives,candidates.slice(1));
 }
 for(const portrait of ['file:///private.png','data:image/png;base64,secret','http://p16.tiktokcdn.com/a',
  'https://tiktokcdn.com.attacker.invalid/a','https://attacker-tiktokcdn.com/a',
  'https://secret@p16.tiktokcdn.com/a','https://p16.tiktokcdn.com:444/a','https://127.0.0.1/a']){
  const actual=widgetSnapshot({audience:{active:{left:{nickname:'Visible name',portrait}}}}).fighters.rows[0].fighter;
  assert.equal(actual.name,'Visible name');assert.equal(actual.portrait,'');assert.deepEqual(actual.portraitAlternatives,[]);
 }
});
