'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DesktopController } = require('../src/desktop-controller.cjs');
const { NATIVE_CAPABILITIES } = require('../src/native-capabilities.cjs');
function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hediye-box-controller-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const gamePath = path.join(root, 'boxing.exe'); fs.writeFileSync(gamePath, 'isolated-fixture');
  let spawned = 0, killed = 0;
  const controller = new DesktopController({gamePath, findGames: async () => [],
    capabilities: {...NATIVE_CAPABILITIES, buildSha256:crypto.createHash('sha256').update('isolated-fixture').digest('hex')},
    createLive: () => ({start:async()=>({status:'connected'}),close(){}}), focusGame:async()=>{},
    spawnGame(file,args) {
      spawned++; assert.equal(file,gamePath); assert.deepEqual(args,['player_vs_player']);
      const child=new EventEmitter(); child.exitCode=null; child.pid=777;
      child.kill=()=>{killed++;child.exitCode=0;child.emit('exit',0);};
      queueMicrotask(()=>child.emit('spawn')); return child;
    }, ...extra});
  t.after(()=>controller.close());
  return {controller,spawned:()=>spawned,killed:()=>killed};
}
test('concurrent launches share one original game process and a second play does not duplicate',async t=>{
  const f=fixture(t);
  await Promise.all([f.controller.launchGame(),f.controller.launchGame()]);
  await f.controller.launchGame();
  assert.equal(f.spawned(),1);assert.equal(f.controller.snapshot().gameRunning,true);
  f.controller.closeGame();assert.equal(f.killed(),1);
});
test('an existing game blocks another process before spawning',async t=>{
  const f=fixture(t,{findGames:async()=>[{pid:123,path:'existing/boxing.exe'}]});
  await assert.rejects(f.controller.launchGame(),/başka bir kurulumdan açık/);
  assert.equal(f.spawned(),0);assert.equal(f.controller.snapshot().phase,'error');
});
test('binary version mismatch is a visible failure',async t=>{
  const f=fixture(t,{capabilities:NATIVE_CAPABILITIES});
  await assert.rejects(f.controller.launchGame(),/sürümü değişmiş/);
  assert.equal(f.spawned(),0);
});
test('unimplemented native controls do not consume gifts or claim ready',async t=>{
  const f=fixture(t);await f.controller.launchGame();
  assert.equal(f.controller.snapshot().native.ready,false);
  assert.throws(()=>f.controller.testGift('left'),/henüz hazır değil/);
  assert.throws(()=>f.controller.setCamera('back'),/henüz bağlanmadı/);
  assert.equal(f.controller.snapshot().match.sides.left.pendingPunches,0);
});
test('closing the app terminates only the game child it launched',async t=>{
  const f=fixture(t);await f.controller.launchGame();f.controller.close();
  assert.equal(f.killed(),1);assert.equal(f.controller.snapshot().gameRunning,false);
  assert.throws(()=>f.controller.launchGame(),/kapanıyor/);
});

test('an open private ring is reused and reported open without spawning or closing it',async t=>{
  let f; let focused=0;
  f=fixture(t,{findGames:async()=>[{pid:77,path:f.controller.gamePath}],focusGame:async pid=>{assert.equal(pid,77);focused++;}});
  await f.controller.launchGame();
  assert.equal(f.spawned(),0);assert.equal(f.controller.snapshot().gameRunning,true);
  assert.equal(f.controller.snapshot().phase,'open');assert.equal(focused,1);
  f.controller.close();assert.equal(f.killed(),0);
});

test('early native process exit is reported instead of falsely showing open',async t=>{
  const f=fixture(t,{spawnGame(){
    const child=new EventEmitter();child.exitCode=null;child.kill=()=>{};
    queueMicrotask(()=>{child.emit('spawn');child.exitCode=1;child.emit('exit',1);});return child;
  }});
  await assert.rejects(f.controller.launchGame(),/kapandı/);
  assert.equal(f.controller.snapshot().gameRunning,false);
});

test('closing during the lookup never opens a game afterwards',async t=>{
  let release;
  const f=fixture(t,{findGames:()=>new Promise(resolve=>{release=resolve;})});
  const launch=f.controller.launchGame();f.controller.close();release([]);
  await assert.rejects(launch,/kapanıyor/);assert.equal(f.spawned(),0);
});

test('live callback handoff forwards the exact normalized like event to the host without game or match actions', async t => {
  const likes = [], chats = [], gifts = [];
  const like = { id: '9007199254740993', userId: '9007199254740993', eventId: 'normalized-like', likeCount: 10, isDelta: true };
  const chat = { id: like.id, eventId: 'normalized-chat', comment: 'katıl' };
  const gift = { id: like.id, eventId: 'normalized-gift', giftId: '5655', repeatCount: 1 };
  const f = fixture(t, { onLike: event => likes.push(event), onChat: event => chats.push(event), onGiftRaw: event => gifts.push(event),
    createLive(options) {
      return { async start() {
        options.onLike(like); options.onChat(chat); options.onGiftRaw(gift);
        return { status: 'connected' };
      }, close() {} };
    },
  });
  assert.equal((await f.controller.connect('tester')).status, 'connected');
  assert.strictEqual(likes[0], like);
  assert.strictEqual(chats[0], chat);
  assert.strictEqual(gifts[0], gift);
  assert.equal(f.spawned(), 0);
  assert.equal(f.controller.snapshot().match.sides.left.pendingPunches, 0);
  assert.equal(f.controller.snapshot().match.sides.right.pendingPunches, 0);
});
