'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGiftNormalizer } = require('../src/gift-normalizer.cjs');
const { HediyeBoxMatch } = require('../src/match-core.cjs');
const { AudienceQueue } = require('../src/audience-queue.cjs');
const normalize = createGiftNormalizer({
  readProfile: user => user?.id ? { id: user.id, username: user.uniqueId,
    nickname: user.nickname, avatar: user.avatar } : null,
  portraitCandidates: payload => [{ rank: 4, urls: payload.user?.avatarLarge?.urlList || [] },
    { rank: 1, urls: payload.user?.avatarThumb?.urlList || [] }],
});
const gift = patch => ({ msgId: 'event', groupId: 'combo', giftId: 5655, giftType: 1,
  repeatCount: 1, repeatEnd: false, user: { id: '123', uniqueId: 'tester', nickname: 'İzleyici' }, ...patch });

test('ongoing combo is credited immediately and final total does not duplicate', () => {
  const match = new HediyeBoxMatch();
  assert.equal(match.ingestGift(normalize(gift(), { roomId: '1' })).addedPunches, 1);
  assert.equal(match.ingestGift(normalize(gift({ msgId: 'next', repeatCount: 4 }), { roomId: '1' })).addedPunches, 3);
  assert.equal(match.ingestGift(normalize(gift({ msgId: 'final', repeatCount: 4, repeatEnd: true }), { roomId: '1' })).addedPunches, 0);
  assert.equal(match.snapshot().sides.left.pendingPunches, 4);
});
test('larger portrait source and nickname remain separate from username', () => {
  const result = normalize(gift({ user: { id: '123', uniqueId: 'tester', nickname: 'İzleyici',
    avatarLarge: { urlList: ['https://cdn.example/large'] },
    avatarThumb: { urlList: ['https://cdn.example/thumb'] } } }));
  assert.equal(result.profilePictureUrl, 'https://cdn.example/large');
  assert.equal(result.uniqueId, 'tester');
  assert.equal(result.nickname, 'İzleyici');
});
test('combo without reliable group is rejected instead of double counting', () => {
  assert.equal(normalize(gift({ groupId: '' })), null);
});

test('alternate connector fields keep one hundred gifts in a single series', () => {
  const match = new HediyeBoxMatch();
  const additions = [5, 20, 100, 100, 20].map((repeatCount, i) => {
    const event = normalize(gift({msgId:String(i), giftId:undefined, gift_id:5655,
      giftType:undefined, extendedGiftInfo:{giftType:1}, groupId:0, combo_id:'series',
      repeatCount, repeatEnd:i === 3}));
    assert.equal(event.giftType, 1);
    return match.ingestGift(event).addedPunches;
  });
  assert.deepEqual(additions, [5, 15, 80, 0, 0]);
  assert.equal(match.snapshot().sides.left.pendingPunches, 100);
});

test('independent non-combo gifts with group zero all count, while a replay counts once', () => {
  const match = new HediyeBoxMatch();
  const counts = ['a', 'b', 'b'].map(msgId => match.ingestGift(normalize(gift({
    msgId, giftType:0, groupId:'0',
  }))).addedPunches || 0);
  assert.deepEqual(counts, [1, 1, 0]);
});
test('already-normalized owner deltas do not become cumulative again', () => {
  const match = new HediyeBoxMatch();
  for (const [msgId, repeatCount] of [['a', 1], ['b', 3]])
    match.ingestGift(normalize(gift({ msgId, repeatCount }), { roomId: '1', isDelta: true }));
  assert.equal(match.snapshot().sides.left.pendingPunches, 4);
});
test('distinct single gifts sharing a transport group each punch once despite profile changes on replay', () => {
  const match = new HediyeBoxMatch();
  const packet = gift({giftType:0, groupId:'transport'});
  for (const event of [packet, {...packet, msgId:'second'}, {...packet, user:{...packet.user, uniqueId:'renamed'}}]) {
    match.ingestGift(normalize(event));
  }
  for (const now of [0, 300]) {
    const punch = match.nextPunch('left', now);
    assert.equal(match.reportHit(punch.punchId).damageApplied, 5);
    assert.equal(match.reportHit(punch.punchId), null);
  }
  assert.equal(match.nextPunch('left', 600), null);
});
test('room identity separates a new broadcast from a replay', () => {
  const first = normalize(gift(), { roomId: '1' });
  const second = normalize(gift(), { roomId: '2' });
  assert.notEqual(first.eventId, second.eventId);
  assert.notEqual(first.streakId, second.streakId);
});
test('missing event identity never manufactures a punch', () => {
  assert.equal(normalize(gift({ msgId: '' })), null);
});

test('single 30/50/100 combos and cumulative jumps reach the ring immediately without end replays', () => {
  for (const total of [30, 50, 100]) {
    const q = new AudienceQueue({ kingOfRing: true });
    q.ingestChat({ eventId: 'red', id: '123', uniqueId: 'tester', comment: 'KATİL' });
    q.ingestChat({ eventId: 'blue', id: '456', comment: 'katıl' });
    q.startRound();
    let punches = 0;
    for (const [i, count] of [total, total, 1, total + 30, total + 30].entries()) {
      const event = normalize(gift({ msgId: `packet-${i}`, giftId: 5269, repeatCount: count, repeatEnd: i === 1 || i === 4 }), { roomId: 'ring' });
      const outcome = q.ingestGift(event);
      assert.equal(outcome.delta, i === 0 ? total : i === 3 ? 30 : 0);
      punches += outcome.actions.reduce((sum, action) => sum + action.count, 0);
      assert.equal(q.ingestGift(event).reason, 'duplicate-event');
    }
    assert.equal(punches, total + 30);
    assert.equal(q.snapshot().active.right.coins, total + 30);
  }
});

test('snake case combo fields and padded group IDs retain cumulative identity', () => {
  const q = new HediyeBoxMatch();
  for (const [i, count] of [30, 50, 100, 100].entries()) {
    const event = normalize(gift({ msgId: `snake-${i}`, giftType: undefined, gift_type: 1,
      repeatCount: undefined, repeat_count: count, repeatEnd: undefined, repeat_end: i === 3,
      groupId: i % 2 ? ' combo ' : 'combo' }));
    assert.equal(event.repeatCount, count);
    assert.equal(event.repeatEnd, i === 3);
    assert.equal(q.ingestGift(event).addedPunches, [30, 20, 50, 0][i]);
  }
  assert.equal(q.snapshot().sides.left.pendingPunches, 100);
});

test('padded zero groups and invalid types cannot turn malformed combos into independent gifts', () => {
  assert.equal(normalize(gift({ groupId: ' 0 ' })), null);
  for (const giftType of ['bad', -1, 1.5, Infinity]) assert.equal(normalize(gift({ giftType })), null);
  assert.equal(normalize(gift({ msgId: '   ' })), null);
});
