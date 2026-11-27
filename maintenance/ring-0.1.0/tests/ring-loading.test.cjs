'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {setTimeout:wait}=require('node:timers/promises');
const {desktopTests}=require('../qa/desktop-round-harness.cjs');
desktopTests(__filename,{
 async 'Ring loading progress follows native readiness and uses real artwork'(box){
  const first=await box.state();assert.equal(first.spectator.phase,'loading');assert.equal(first.loadingProgress,30);
  await wait(150);
  const loading=await box.evaluate(()=>({visible:document.getElementById('loading-screen').checkVisibility(),value:document.getElementById('loading-progress').value,image:document.querySelector('#loading-screen img').naturalWidth}));
  assert.equal(loading.visible,true);assert.equal(loading.value,30);assert.ok(loading.image>1000);
  box.native.emit('window',{visible:false,focused:false});
  assert.equal((await box.state()).loadingProgress,30);
  box.native.emit('window',{visible:true,focused:true,bounds:{x:0,y:0,width:1000,height:700}});
  assert.equal((await box.state()).loadingProgress,65);
  assert.deepEqual(box.calls.windowShows,[]);
  assert.equal(box.shortcuts.size,0);
  const duringLoading=await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
  assert.equal(duringLoading.spectator.panelOpen,false);
  assert.deepEqual(box.calls.windowShows,[]);
  box.native.emit('state',{phase:'waiting',lineup:[false,false],health:[null,null]});
  assert.equal((await box.state()).loadingProgress,100);
  assert.deepEqual(box.calls.windowShows,[]);
  assert.ok(box.shortcuts.has('B'));
  await wait(70);
  assert.equal(await box.evaluate(()=>document.getElementById('loading-screen').hidden),true);
  await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
  assert.deepEqual(box.calls.windowShows,['show']);
  await wait(150);
  const view=await box.evaluate(()=>({
   sources:[...document.getElementById('punch-source').options].map(x=>x.value),
   chat:!!document.getElementById('chat-damage'),
   font:parseFloat(getComputedStyle(document.querySelector('label[for="like-damage"]')).fontSize),
   input:document.getElementById('like-damage').getBoundingClientRect().height
  }));
  assert.deepEqual(view.sources,['all','gift','like']);assert.equal(view.chat,false);assert.ok(view.font>=17);
  fs.writeFileSync(path.resolve(__dirname,'../qa/ring-menu-0016.png'),(await box.capture()).toPNG());
 }
});
