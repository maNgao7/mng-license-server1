import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDuelState,startRound,applyGift,tick,selectPlayer} from '../src/core.mjs';
import {createProfileDuelController} from '../src/launcher-adapter.mjs';
test('a selected portrait upgrades from shared cache without another gift',()=>{
 let clock=1000,width=64;
 const controller=createProfileDuelController({channel:'a',subscribe:()=>()=>{},now:()=>clock,getProfile:username=>({username,avatarUrl:'./api/portrait?username='+username+'&v='+width})});
 try{controller.chooseOpponent({username:'b'});width=1024;clock=3000;controller.tick();assert.match(controller.snapshot().owner.avatarUrl,/v=1024/);assert.match(controller.snapshot().opponent.avatarUrl,/v=1024/);}finally{controller.close();}
});
test('normalized zero coin metadata uses the selected catalog unit exactly once',()=>{
 const s=createDuelState({owner:{username:'a'},opponent:{username:'b'}});startRound(s,{now:1000});
 const rose={eventId:'zero-meta-rose',giftId:'5655',coins:0,repeatCount:20,giftType:1,repeatEnd:true};
 assert.equal(applyGift(s,rose,1100).points,20);assert.equal(applyGift(s,rose,1100).duplicate,true);
 assert.equal(applyGift(s,{...rose,eventId:'tiktok',giftId:'5269',repeatCount:50},1200).points,50);
 assert.deepEqual(s.scores,{left:20,right:50});
});
test('tie completion permits direct profile removal and fresh selection',()=>{
 const s=createDuelState({owner:{username:'a'},opponent:{username:'b'},durationSeconds:10});startRound(s,{now:1000});tick(s,11000);
 assert.equal(s.phase,'finished');assert.equal(selectPlayer(s,'right',null),true);assert.equal(s.phase,'idle');
 assert.equal(selectPlayer(s,'right',{username:'c'}),true);assert.equal(startRound(s,{now:12000}).ok,true);
});
