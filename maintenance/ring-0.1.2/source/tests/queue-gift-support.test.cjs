'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AudienceQueue } = require('../src/audience-queue.cjs');
const { createHediyeBoxLive, sharedModules } = require('../src/live-client.cjs');
let sequence = 0;
const event = (id, extra) => ({ id, eventId: `support-${++sequence}`, ...extra });
function fixture(options = {}) {
  const q = new AudienceQueue({ kingOfRing: true, settings: { participationMode: 'chat', ...options.settings }, onPunch: options.onPunch });
  for (const id of ['red', 'blue', 'waiting']) q.ingestChat(event(id, { comment: 'katıl' }));
  q.startRound();
  return q;
}

for (const side of ['left', 'right']) for (const sender of ['own', 'opponent', 'waiting', 'unseated']) {
  for (const isDelta of [false, true]) test(`${side} selected gift routes ${isDelta ? 'delta' : 'cumulative'} 1/30/50/100 from ${sender} sender exactly once`, () => {
    const delivered = [];
    const q = fixture({ settings: { giftDamage: { '5655': 7, '5269': 9 } }, onPunch: action => delivered.push(action) });
    const owner = side === 'right' ? 'red' : 'blue';
    const opponent = side === 'right' ? 'blue' : 'red';
    const id = sender === 'own' ? owner : sender === 'opponent' ? opponent : sender;
    const giftId = side === 'right' ? '5269' : '5655';
    for (const count of [1, 30, 50, 100]) {
      const packet = event(id, { giftId, repeatCount: count, coinUnit: 1, isDelta,
        giftType: 1, streakId: `burst-${count}`, repeatEnd: false });
      const outcome = q.ingestGift(packet);
      assert.equal(outcome.delta, count); assert.equal(outcome.addedCoins, count);
      assert.deepEqual(outcome.actions.map(({ side, count, damage, userId }) => ({ side, count, damage, userId })),
        [{ side, count, damage: side === 'right' ? 9 : 7, userId: id }]);
      assert.equal(q.ingestGift(packet).reason, 'duplicate-event');
      if (!isDelta) for (const repeatCount of [count, Math.max(1, count - 1), count]) {
        const final = q.ingestGift({ ...packet, eventId: `support-${++sequence}`, repeatCount, repeatEnd: true });
        assert.deepEqual([final.delta, final.addedCoins, final.actions.length], [0, 0, 0]);
      }
    }
    assert.deepEqual(delivered.map(action => action.count), [1, 30, 50, 100]);
    assert.equal(q.snapshot().active.right.id, 'red'); assert.equal(q.snapshot().active.left.id, 'blue');
    assert.deepEqual(q.snapshot().queue.map(user => user.id), ['waiting']);
  });
}

test('corner support honors source settings, active phase, occupied target and history/test filtering', () => {
  const q = fixture();
  const gift = extra => event('outside', { giftId: '5655', repeatCount: 30, isDelta: true, ...extra });
  for (const punchSource of ['gift', 'all', 'like']) {
    q.configure({ punchSource });
    assert.equal(q.ingestGift(gift()).actions.length, punchSource === 'like' ? 0 : 1);
  }
  q.configure({ punchSource: 'all' });
  for (const flag of ['initial', 'isInitial', 'replay', 'isReplay', 'isTest'])
    assert.deepEqual(q.ingestGift(gift({ [flag]: true })).actions, []);
  assert.deepEqual(q.ingestGift(gift({ giftId: 'unselected' })).actions, []);
  q.removeWaiting('waiting');
  q.finishRound('right');
  assert.equal(q.snapshot().active.left, null);
  assert.deepEqual(q.ingestGift(gift()).actions, []);
  assert.deepEqual(q.ingestGift(gift({ giftId: '5269' })).actions, []);
  q.ingestChat(event('new-challenger',{comment:'katıl'}));
  q.startRound();
  assert.equal(q.ingestGift(gift()).actions[0].side, 'left');
});

test('normal LIVE callbacks support both corners, expire/remove waiters and preserve a manual next round on one connection', async () => {
  class Connection extends EventEmitter {
    isConnected = false;
    async connect() { this.isConnected = true; return { roomId: '123456', isConnected: true }; }
    disconnect() { this.isConnected = false; }
  }
  let now = 0, created = 0;
  const connection = new Connection(), commands = [];
  const q = new AudienceQueue({ kingOfRing: true, clock: () => now,
    settings: { participationMode: 'chat', likeJoin: true, likeJoinThreshold: 100, punchSource: 'all' },
    onPunch: command => commands.push(command) });
  const live = createHediyeBoxLive({ env: {}, shared: { ...sharedModules(), detectOwner: async () => [] },
    createConnection: async () => { created++; return connection; },
    onChat: packet => q.ingestChat(packet), onGiftRaw: packet => q.ingestGift(packet), onLike: packet => q.ingestLike(packet) });
  const user = id => ({ id, uniqueId: `viewer${id}`, nickname: `Viewer ${id}` });
  try {
    await live.start('host');
    const giftListeners = connection.listenerCount('gift');
    assert.ok(giftListeners > 0);
    for (const id of ['11', '22', '33']) connection.emit('chat', { msgId: `join-${id}`, user: user(id), comment: 'katıl' });
    assert.equal(q.startRound().accepted, true);
    let last;
    for (const [giftId, side, sender] of [['5269', 'right', '33'], ['5655', 'left', '44']]) {
      for (const count of [1, 30, 50, 100]) {
        last = { msgId: `live-${giftId}-${count}`, user: user(sender), giftId, giftType: 1,
          groupId: `combo-${giftId}-${count}`, repeatCount: count, repeatEnd: false, diamondCount: 1 };
        const before = commands.length;
        connection.emit('gift', last); connection.emit('gift', last);
        connection.emit('gift', { ...last, msgId: `final-${giftId}-${count}`, repeatEnd: true });
        assert.equal(commands.length, before + 1);
        assert.equal(commands.at(-1).side, side); assert.equal(commands.at(-1).count, count);
      }
    }
    connection.emit('like', { msgId: 'like-join', user: user('55'), likeCount: 199 });
    now = 60_000; assert.equal(q.expireInactiveLikes().changed, true);
    assert.deepEqual(q.snapshot().queue.map(profile => profile.id), ['33']);
    assert.equal(q.removeWaiting(q.snapshot().queue[0].id).accepted, true);
    const before = commands.length;
    connection.emit('gift', last); assert.equal(commands.length, before);
    assert.equal(q.finishRound('right').phase, 'staging');
    assert.equal(q.snapshot().active.left, null);
    connection.emit('chat',{msgId:'new-bout-join-22',user:user('22'),comment:'katıl'});
    assert.equal(q.startRound().accepted, true);
    assert.equal(created, 1); assert.equal(connection.listenerCount('gift'), giftListeners);
  } finally { live.close(); }
  assert.equal(connection.isConnected, false); assert.equal(connection.listenerCount('gift'), 0);
});
