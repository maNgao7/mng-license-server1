'use strict';
const assert=require('node:assert/strict');
const {desktopTests}=require('../qa/desktop-round-harness.cjs');
desktopTests(__filename,{
  async 'manual countdown starts the two-fighter side camera once and F can return to free view'(box){
    box.native.emit('state',{phase:'waiting',lineup:[false,false],health:[null,null]});
    for(const id of ['red','blue'])box.events.onChat({eventId:'camera-join-'+id,userId:id,uniqueId:id,comment:'katıl'});
    await box.key('P');
    assert.deepEqual(box.calls.cameras,[],'Do not move the camera before the countdown ends');
    for(let tick=0;tick<5;tick++)await box.tick();
    for(let i=0;i<20&&!box.calls.cameras.length;i++)await new Promise(r=>setTimeout(r,10));
    assert.equal(box.calls.starts,1);assert.deepEqual(box.calls.cameras,['ring']);
    await box.evaluate(()=>window.hediyeBox.setCamera('free'));
    assert.deepEqual(box.calls.cameras,['ring','free']);
  },
  async 'B-menu removal deletes a waiting boxer but cannot remove either active fighter'(box){
    box.native.setCamera=async()=>({mode:'free'});
    box.native.emit('state',{phase:'waiting',lineup:[false,false],health:[null,null]});
    for(const id of ['red','blue','waiter'])box.events.onChat({eventId:'remove-join-'+id,userId:id,uniqueId:id,comment:'katıl'});
    await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
    let state=await box.state();assert.equal(state.audience.queue.length,1);
    const key=state.audience.queue[0].id;
    await box.evaluate(()=>document.querySelector('#queue-list .queue-remove').click());
    for(let i=0;i<50&&(await box.state()).audience.queue.length;i++)await new Promise(r=>setTimeout(r,20));
    state=await box.state();assert.equal(state.audience.queue.length,0);
    assert.ok(state.audience.active.left&&state.audience.active.right);
    const error=await box.evaluate(async()=>{try{await window.hediyeBox.removeWaiting((await window.hediyeBox.getState()).audience.active.left.id);return null;}catch(e){return e.message;}});
    assert.match(error,/bekleme/);
    box.events.onChat({eventId:'remove-join-waiter',userId:'waiter',comment:'katıl'});
    assert.equal((await box.state()).audience.queue.length,0,'Old event cannot undo removal');
    box.events.onChat({eventId:'fresh-waiter',userId:'waiter',comment:'katıl'});
    assert.equal((await box.state()).audience.queue[0].fps,0);
  },
  async 'E focuses a waiting boxer and P removes that boxer without resetting the active match'(box){
    const seat=require('../assets/queue-layout.js').waitingSeats(require('../assets/ring-layout.js'))[0];
    box.native.followTarget=async value=>({mode:'queue',waitingId:value.waitingId});
    box.native.setCamera=async()=>({mode:'free'});
    box.native.emit('state',{phase:'waiting',lineup:[false,false],health:[null,null]});
    for(const id of ['red','blue','waiter'])box.events.onChat({eventId:'focus-join-'+id,userId:id,uniqueId:id,comment:'katıl'});
    box.native.emit('camera',{sceneView:{position:[seat.x,1.25,seat.z+4],rotation:[0,0,0,1],scale:[1,1,1],fov:Math.PI/3,aspect:16/9,floor:0},camera:{mode:'free'}});
    await box.evaluate(()=>window.hediyeBox.followTarget());
    await box.evaluate(()=>window.hediyeBox.startMatch());
    const state=await box.state();
    assert.equal(state.audience.queue.length,0);assert.equal(box.calls.starts,0);
    assert.ok(state.audience.active.left&&state.audience.active.right);
  }
});
