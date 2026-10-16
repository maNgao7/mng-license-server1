import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './events.js';
import { fixtureSession, gift, like, follow, gifts, emitGift, emitLike } from './proto-fixtures.js';

test('real v3 protobuf like count reaches the bridge intact', () => {
  assert.equal(normalize('like', like(100, 5000)).count, 100);
  assert.equal(normalize('like', like(37, 5037)).count, 37);
  assert.equal(normalize('like', like(0, 5037)), null);
});

for (const giftId of gifts) {
  test(`gift ${giftId}: progress, replay and final apply exactly one cumulative gift total`, async () => {
    const events = [];
    const h = await fixtureSession(e => { if (e.type === 'gift') events.push(e); });
    await emitGift(h.connection, giftId, '101', 1, false, '11');
    await emitGift(h.connection, giftId, '101', 1, true, '12');
    await emitGift(h.connection, giftId, '101', 1, true, '13');
    assert.equal(events.length, 1);
    assert.equal(events[0].count, 1);
    await emitGift(h.connection, giftId, '102', 1, false, '14');
    await emitGift(h.connection, giftId, '102', 1, true, '15');
    assert.equal(events.reduce((n, e) => n + e.count, 0), 2);
    h.session.disconnect();
  });
}

test('a growing 5-gift streak contributes 5, with a final and out-of-order replay', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'gift') events.push(e); });
  for (const [count, end, id] of [[1, false, '1'], [3, false, '2'], [5, false, '3'], [5, true, '4'], [3, false, '5'], [5, true, '6']]) {
    await emitGift(h.connection, '5319', '991', count, end, id);
  }
  assert.deepEqual(events.map(e => e.count), [1, 2, 2]);
  assert.equal(events.reduce((n, e) => n + e.count, 0), 5);
  h.session.disconnect();
});

test('ordinary gifts are deduplicated without suppressing separate rapid gifts', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'gift') events.push(e); });
  await emitGift(h.connection, '11046', '0', 1, false, '1', 'viewer', false);
  await emitGift(h.connection, '11046', '0', 1, false, '1', 'viewer', false);
  await emitGift(h.connection, '11046', '0', 1, false, '2', 'viewer', false);
  assert.equal(events.length, 2);
  h.session.disconnect();
});

test('non-streak gifts with a group ID reject repeated notifications too', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'gift') events.push(e); });
  for (const id of gifts) {
    await emitGift(h.connection, id, '201', 1, false, '101', 'viewer', false);
    await emitGift(h.connection, id, '201', 1, true, '102', 'viewer', false);
    await emitGift(h.connection, id, '202', 1, true, '103', 'viewer', false);
  }
  assert.equal(events.length, gifts.length * 2);
  h.session.disconnect();
});

test('likes keep real 99+1+100+300 amounts and suppress an exact replay', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'like') events.push(e); });
  for (const [count, total] of [[99, 999], [1, 1000], [100, 1100], [100, 1100], [300, 1400]]) {
    await emitLike(h.connection, count, total);
  }
  assert.deepEqual(events.map(e => e.count), [99, 1, 100, 300]);
  h.session.disconnect();
});

test('follow replay with a different message ID counts once per viewer per session', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'follow') events.push(e); });
  h.connection.emit('follow', follow('1'));
  h.connection.emit('follow', follow('2'));
  h.connection.emit('follow', follow('3', 'second_viewer'));
  assert.equal(events.length, 2);
  h.session.disconnect();
});

test('legacy streak without group ID waits for its final total', async () => {
  const events = [];
  const h = await fixtureSession(e => { if (e.type === 'gift') events.push(e); });
  h.connection.emit('gift', { giftId: 5655, giftDetails: { giftType: 1 }, repeatCount: 2, repeatEnd: false, msgId: 'a' });
  h.connection.emit('gift', { giftId: 5655, giftDetails: { giftType: 1 }, repeatCount: 3, repeatEnd: true, msgId: 'b' });
  assert.deepEqual(events.map(e => e.count), [3]);
  h.session.disconnect();
});
