'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {waitingTarget}=require('../src/queue-target.cjs');
const {waitingSeats}=require('../assets/queue-layout.js');
const seats=waitingSeats(require('../assets/ring-layout.js'));
test('E selects only a waiting boxer under the crosshair using the rendered seat layout',()=>{
  const queue=seats.map((_,id)=>({id:id+1}));
  for(const index of [0,4,12,seats.length-1]){
    const seat=seats[index],view={position:[seat.x,1.25,seat.z+.5],rotation:[0,0,0,1],scale:[1,1,1],fov:Math.PI/3,aspect:16/9,floor:0};
    const result=waitingTarget(queue,view);
    assert.equal(result.userId,index+1);assert.deepEqual(result.point,[seat.x,1.25,seat.z]);
    assert.equal(waitingTarget([],view),null);
    const behind=waitingTarget(queue,{...view,position:[seat.x,1.25,seat.z-4]});
    assert.notEqual(behind?.userId,index+1,'A target behind the camera cannot be selected');
  }
});
test('unsupported camera state cannot select or remove a participant',()=>{
  for(const view of [null,{}, {floor:NaN}, {floor:0,rotation:[0,0,0,0],position:[0,0,0],scale:[1,1,1],fov:1,aspect:1}])assert.equal(waitingTarget([{id:'a'}],view),null);
});
