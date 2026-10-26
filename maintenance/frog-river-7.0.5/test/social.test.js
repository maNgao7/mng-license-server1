import test from 'node:test';
import assert from 'node:assert/strict';
import {socialSettings,SocialActions} from '../public/social-rules.js';
import {normalizeLiveEvent} from '../live-events.js';

test('fresh defaults: recurring 100 likes and each follow move 50m',()=>{
  const config=socialSettings(),rules=new SocialActions();
  assert.equal(config.likeThreshold,100);assert.equal(config.followDistance,50);assert.equal(config.likeDistance,50);
  assert.equal(config.followBackwardEnabled,false);assert.equal(config.likeBackwardEnabled,false);
  for(let i=0;i<3;i++){
    rules.accept({event:'like',count:99},config);assert.equal(rules.queue.length,0);
    rules.accept({event:'like',count:1},config);assert.equal(rules.queue.shift().distance,50);
  }
  for(let i=0;i<3;i++){rules.accept({event:'follow'},config);assert.equal(rules.queue.shift().distance,50);}
});
test('packet remainder and 350 likes produce three actions, then fourth',()=>{
  const config=socialSettings(),rules=new SocialActions();
  rules.accept({event:'like',count:350},config);assert.equal(rules.queue.shift().distance,150);assert.equal(rules.likes,50);
  rules.accept({event:'like',count:50},config);assert.equal(rules.queue.shift().distance,50);
});
test('backward options persist independently and do not require forward enabled',()=>{
  const config=socialSettings(JSON.parse(JSON.stringify({likeEnabled:false,followEnabled:false,likeBackwardEnabled:true,followBackwardEnabled:true,likeBackwardDistance:75,followBackwardDistance:25}))),rules=new SocialActions();
  rules.accept({event:'like',count:200},config);rules.accept({event:'follow'},config);
  assert.equal(rules.queue[0].distance,-175);
});
test('invalid likes never award distance and queued actions survive busy frames',()=>{
  const config=socialSettings(),rules=new SocialActions();
  for(const count of [NaN,0,-1,'bad'])rules.accept({event:'like',count},config);
  assert.equal(rules.queue.length,0);
  rules.accept({event:'follow'},config);
  for(let i=0;i<60;i++)assert.equal(rules.queue[0].distance,50);
});
test('connector-like packet uses likeCount, never gift repeatCount or total',()=>{
  assert.equal(normalizeLiveEvent('like',{likeCount:100,repeatCount:1,total:10000}).count,100);
  assert.equal(normalizeLiveEvent('like',{count:100}).count,100);
  assert.equal(normalizeLiveEvent('like',{total:100}),null);
  assert.equal(normalizeLiveEvent('follow',{repeatCount:80}).count,1);
  assert.equal(normalizeLiveEvent('gift',{repeatCount:3}).count,3);
});
