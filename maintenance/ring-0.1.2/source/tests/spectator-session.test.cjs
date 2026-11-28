'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');const {SpectatorSession}=require('../src/spectator-session.cjs');
function fixture(){const native=new EventEmitter();let starts=0,closes=0;native.startMatch=async()=>{starts++;};native.close=()=>{closes++;};
  return {native,session:new SpectatorSession({native}),starts:()=>starts,closes:()=>closes};}
test('loading and live updates never auto-start a spectator fight',async()=>{
 const f=fixture();await assert.rejects(f.session.startMatch(),/hazır değil/);
 f.native.emit('state',{phase:'waiting',health:[1,.8]});assert.equal(f.starts(),0);
 f.session.setPanelOpen(true);assert.equal(f.starts(),0);assert.equal(f.session.snapshot().phase,'waiting');f.session.close();
});
test('P accepts only one pending start and waits for original game confirmation',async()=>{
 const f=fixture();f.native.emit('state',{phase:'waiting'});
 await Promise.all([f.session.startMatch(),f.session.startMatch()]);assert.equal(f.starts(),1);
 f.native.emit('state',{phase:'waiting'});
 await assert.rejects(f.session.startMatch(),/hazır değil/);assert.equal(f.starts(),1);
 assert.equal(f.session.snapshot().phase,'waiting');f.native.emit('state',{phase:'fighting',health:[.9,1]});
 assert.equal(f.session.snapshot().phase,'fighting');await assert.rejects(f.session.startMatch(),/hazır değil/);f.session.close();
});
test('restaging drops the previous result until the next native fight, including while P is pending',async()=>{
 const f=fixture(), state=value=>f.native.emit('state',value);
 state({phase:'waiting'});await f.session.startMatch();
 state({phase:'fighting',winner:'right'});state({phase:'finished'});
 assert.equal(f.session.snapshot().winner,'right');
 state({phase:'waiting'});state({phase:'finished',winner:'right'});
 assert.equal(f.session.snapshot().phase,'waiting');
 await f.session.startMatch();
 state({phase:'finished',winner:'right'});assert.equal(f.session.snapshot().phase,'waiting');
 state({phase:'fighting'});state({phase:'finished',winner:'left'});
 assert.equal(f.session.snapshot().winner,'left');assert.equal(f.starts(),2);f.session.close();
});
test('invalid or missing native health is never replaced with fake healthy values',()=>{
 const f=fixture();f.native.emit('state',{phase:'waiting',health:[NaN,null]});assert.deepEqual(f.session.snapshot().health,[null,null]);
 f.native.emit('state',{phase:'fighting',health:[-1,4]});assert.deepEqual(f.session.snapshot().health,[0,1]);f.session.close();
});
test('closing a spectator session is idempotent and ignores stale callbacks',async()=>{
 const f=fixture();f.session.close();f.session.close();f.native.emit('state',{phase:'fighting'});
 assert.equal(f.closes(),1);assert.equal(f.session.snapshot().phase,'loading');await assert.rejects(f.session.startMatch(),/kapanıyor/);
});

test('a mismatched demo copy gives an actionable desktop startup message',()=>{
 const f=fixture();f.native.emit('state',{phase:'error',error:'Error: Unexpected game module'});
 assert.match(f.session.snapshot().error,/masaüstündeki TikMnG - Hediye Box/);
 f.session.close();
});
