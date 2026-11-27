'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {idleGuardJoint,idleGuardRoot}=require('../tools/native-camera.js');
test('waiting warm-up animates each arm continuously without accumulating rotation',()=>{
 for(const side of [0,1])for(let joint=0;joint<6;joint++){
  const neutral=[1,0,0,0];assert.deepEqual(idleGuardJoint(neutral,0,side,joint),neutral);
  const frames=Array.from({length:401},(_,i)=>idleGuardJoint(neutral,i/40,side,joint));
  assert.ok(frames.some(q=>Math.abs(q[1])>.01));
  for(let i=0;i<frames.length;i++){
   assert.ok(Math.abs(Math.hypot(...frames[i])-1)<1e-10);
   assert.ok(Math.abs(frames[i][1])<=.076);
   if(i)assert.ok(Math.hypot(...frames[i].map((v,k)=>v-frames[i-1][k]))<.005);
  }
  assert.deepEqual(idleGuardJoint(neutral,.5,side,joint),idleGuardJoint(neutral,.5,side,joint));
  assert.deepEqual(neutral,[1,0,0,0]);
 }
});
test('hinge warm-up stays near captured guard and does not change the planted root input',()=>{
 const root=[0,0,1,1,0,0,0],soles=[[-.25,0,0],[.25,0,0]];
 for(let i=0;i<500;i++){
  assert.ok(Math.abs(idleGuardJoint([.8],i/30,1,2)[0]-.8)<=.15);
  const pose=idleGuardRoot(root,soles,i/30,0);assert.ok(pose.every(Number.isFinite));
 }
 assert.deepEqual(root,[0,0,1,1,0,0,0]);
});
