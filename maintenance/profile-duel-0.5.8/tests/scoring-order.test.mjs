import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGift,
  advanceWinner,
  createDuelState,
  resetRound,
  selectPlayer,
  setGiftConfig,
  setOpponent,
  startRound,
  tick,
} from '../src/core.mjs';
import { createProfileDuelController } from '../src/launcher-adapter.mjs';
import { mountProfileDuel } from '../src/launcher-entry.mjs';

function readyState() {
  const state = createDuelState({ owner: { username: '@kanal', nickname: 'Kanal sahibi' } });
  assert.equal(setOpponent(state, { username: 'rakip', nickname: 'Rakip' }), true);
  return state;
}

test('owner stays left, opponent stays right, and only configured gifts score their coin total', () => {
  const state = readyState();
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'rakip');

  assert.deepEqual(startRound(state, { durationSeconds: 60, now: 1000 }), { ok: true });
  assert.deepEqual(state.scores, { left: 0, right: 0 });

  const rose = applyGift(state, { eventId: 'rose-1', giftId: 5655, giftName: 'Gül', coins: 1 }, 2000);
  const other = applyGift(state, { eventId: 'other-1', giftId: 999, giftName: 'TikTok', coins: 1 }, 3000);
  assert.equal(rose.ok, true);
  assert.equal(rose.side, 'left');
  assert.equal(rose.points, 1);
  assert.equal(other.ok, true);
  assert.equal(other.side, 'right');
  assert.equal(other.points, 1);
  assert.deepEqual(state.scores, { left: 1, right: 1 });
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'rakip');
});

test('completed combo event scores once and repeated event IDs never score again', () => {
  const state = readyState();
  startRound(state, { now: 1000 });

  const incomplete = applyGift(state, {
    eventId: 'combo-a', giftId: 999, giftName: 'TikTok', coins: 30, giftType: 1, repeatEnd: false, repeatCount: 30,
  }, 2000);
  assert.equal(incomplete.ok, false);
  assert.deepEqual(state.scores, { left: 0, right: 0 });

  const completed = applyGift(state, {
    eventIds: ['event:combo-end', 'combo:room:7:fan:99'], giftId: 999, giftName: 'TikTok', coins: 30,
    giftType: 1, repeatEnd: true, repeatCount: 30,
  }, 3000);
  const replay = applyGift(state, {
    eventId: 'combo:room:7:fan:99', giftId: 999, giftName: 'TikTok', coins: 30, repeatEnd: true,
  }, 4000);
  assert.equal(completed.ok, true);
  assert.equal(completed.points, 30);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(state.scores, { left: 0, right: 30 });
});

test('configured points use completed gift quantity per side and unset points use the original coin score', () => {
  const state = createDuelState({
    owner: { username: 'host' },
    opponent: { username: 'guest' },
    giftConfig: { rosePointsPerGift: 50, tiktokPointsPerGift: 100 },
  });
  assert.equal(startRound(state, { now: 1000 }).ok, true);
  const rose = { eventId: 'rose', giftId: '5655', coins: 1 };
  assert.equal(applyGift(state, rose, 1100).points, 50);
  const combo = { eventId: 'combo', giftId: '5269', coins: 3, repeatCount: '3', giftType: 1 };
  assert.equal(applyGift(state, { ...combo, repeatEnd: false }, 1200).ok, false);
  assert.deepEqual(state.scores, { left: 50, right: 0 });
  const completed = { ...combo, repeatEnd: true };
  assert.equal(applyGift(state, completed, 1300).points, 300);
  assert.equal(applyGift(state, completed, 1400).duplicate, true);
  assert.deepEqual(state.scores, { left: 50, right: 300 });

  resetRound(state);
  setGiftConfig(state, { rosePointsPerGift: null, tiktokPointsPerGift: 100 });
  assert.equal(startRound(state, { now: 2000 }).ok, true);
  assert.equal(applyGift(state, completed, 2100).duplicate, true);
  assert.equal(applyGift(state, { ...rose, eventId: 'rose-coins', coins: 7, repeatCount: 2 }, 2200).points, 7);
  assert.equal(applyGift(state, { ...completed, eventId: 'combo-new', repeatCount: undefined, count: 2 }, 2300).points, 200);
  assert.deepEqual(state.scores, { left: 7, right: 200 });
});

test('shared-event adapter consumes one shared feed and always presents channel owner first', () => {
  const listeners = new Set();
  let subscribeCalls = 0;
  const profiles = new Map([
    ['kanal', { username: 'kanal', nickname: 'Yayıncı HD', avatarUrl: '/portraits/channel.webp' }],
    ['rakip', { username: 'rakip', nickname: 'Rakip HD', avatarUrl: '/portraits/opponent.webp' }],
  ]);
  const controller = createProfileDuelController({
    channel: '@Kanal',
    subscribe(listener) { subscribeCalls++; listeners.add(listener); return () => listeners.delete(listener); },
    getProfile: username => profiles.get(username),
    now: () => 5000,
  });

  assert.equal(subscribeCalls, 1);
  assert.equal(controller.chooseOpponent({ username: 'rakip' }), true);
  assert.equal(controller.start(90).ok, true);
  const gift = {
    type: 'gift', eventId: 'shared-gift-1', username: 'viewer', giftId: 5655, giftName: 'Rose', coins: 1, repeatEnd: true,
  };
  for (const listener of listeners) listener(gift);
  for (const listener of listeners) listener(gift);

  const snapshot = controller.snapshot();
  assert.equal(snapshot.owner.username, 'kanal');
  assert.equal(snapshot.owner.nickname, 'Yayıncı HD');
  assert.equal(snapshot.owner.avatarUrl, '/portraits/channel.webp');
  assert.equal(snapshot.opponent.username, 'rakip');
  assert.deepEqual(snapshot.scores, { left: 1, right: 0 });
  controller.close();
  assert.equal(listeners.size, 0);
});

test('launcher mount uses its supplied shared feed once and releases only its subscription', () => {
  const listeners = new Set();
  const snapshots = [];
  let subscribeCalls = 0;
  const mounted = mountProfileDuel({
    channel: 'kanal',
    subscribeSharedEvents(listener) { subscribeCalls++; listeners.add(listener); return () => listeners.delete(listener); },
    getCachedProfile: username => username === 'kanal' ? {
      username, nickname: 'Cached channel', avatarUrl: '/portraits/cached.webp',
    } : null,
    opponent: { username: 'rakip' },
    onSnapshot: snapshot => snapshots.push(snapshot),
  });
  assert.equal(subscribeCalls, 1);
  assert.equal(mounted.controller.start(90).ok, true);
  for (const listener of listeners) listener({
    type: 'gift', eventId: 'host-event-1', username: 'viewer', giftId: 5655, giftName: 'Rose', coins: 1,
  });
  assert.equal(snapshots.at(-1).owner.nickname, 'Cached channel');
  assert.equal(snapshots.at(-1).owner.avatarUrl, '/portraits/cached.webp');
  assert.deepEqual(snapshots.at(-1).scores, { left: 1, right: 0 });
  mounted.destroy();
  assert.equal(listeners.size, 0);
});

test('a new round starts at zero, preserves side ownership, and retains event dedupe', () => {
  const state = readyState();
  startRound(state, { now: 1000 });
  applyGift(state, { eventId: 'one', giftId: 5655, giftName: 'Gül', coins: 1 }, 2000);
  applyGift(state, { eventId: 'two', giftId: 999, giftName: 'TikTok', coins: 1 }, 3000);

  resetRound(state);
  assert.deepEqual(startRound(state, { now: 4000 }), { ok: true });
  assert.deepEqual(state.scores, { left: 0, right: 0 });
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'rakip');
  assert.equal(applyGift(state, { eventId: 'one', giftId: 5655, giftName: 'Gül', coins: 1 }, 5000).duplicate, true);
  assert.deepEqual(state.scores, { left: 0, right: 0 });
});

test('distinct completed gifts in one combo can each score, while an event replay cannot', () => {
  const listeners = new Set();
  const controller = createProfileDuelController({
    channel: 'kanal', subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, now: () => 5000,
  });
  controller.chooseOpponent({ username: 'rakip' });
  controller.start(90);
  const completed = { type: 'gift', giftId: 999, giftName: 'TikTok', coins: 1, giftType: 1, repeatEnd: true, groupId: 'combo-1', username: 'viewer' };
  for (const listener of listeners) listener({ ...completed, eventId: 'gift-1' });
  for (const listener of listeners) listener({ ...completed, eventId: 'gift-1' });
  for (const listener of listeners) listener({ ...completed, eventId: 'gift-2' });
  assert.deepEqual(controller.snapshot().scores, { left: 0, right: 2 });
  controller.close();
});

test('event idempotency is retained for the full round and there is no hidden win target', () => {
  const state = readyState();
  startRound(state, { durationSeconds: 3600, now: 1000 });
  for (let i = 0; i < 4200; i++) {
    assert.equal(applyGift(state, { eventId: `event-${i}`, giftId: 999, giftName: 'TikTok', coins: 1 }, 1100 + i).ok, true);
  }
  assert.equal(applyGift(state, { eventId: 'event-0', giftId: 999, giftName: 'TikTok', coins: 1 }, 6000).duplicate, true);
  assert.deepEqual(state.scores, { left: 0, right: 4200 });
  assert.equal(state.phase, 'running');
});

test('one hundred coin value gives one hundred points; unrelated gifts do not score', () => {
  const state = readyState();
  startRound(state, { now: 1000 });
  const unrelated = applyGift(state, { eventId: 'unrelated', giftId: 222, giftName: 'Galaxy', coins: 100 }, 1100);
  assert.equal(unrelated.ok, false);
  assert.deepEqual(state.scores, { left: 0, right: 0 });
  const coinGift = applyGift(state, { eventId: 'coin-many', giftId: 999, giftName: 'TikTok', coins: 100 }, 1200);
  assert.equal(coinGift.ok, true);
  assert.equal(coinGift.points, 100);
  assert.equal(coinGift.side, 'right');
  assert.deepEqual(state.scores, { left: 0, right: 100 });
});

test('TikTok gift matches its exact configured name or ID; other paid gifts never affect either side', () => {
  const state = createDuelState({
    owner: { username: 'kanal' }, opponent: { username: 'rakip' },
    giftConfig: { tiktokGiftIds: ['777'], tiktokGiftNames: ['TikTok'] },
  });
  startRound(state, { now: 1000 });
  const tiktok = applyGift(state, { eventId: 'tiktok-one', giftId: 777, giftName: 'TikTok', coins: 1 }, 1100);
  const paid = applyGift(state, { eventId: 'other-paid', giftId: 778, giftName: 'Lion', coins: 500 }, 1200);
  assert.equal(tiktok.side, 'right');
  assert.equal(tiktok.points, 1);
  assert.equal(paid.ok, false);
  assert.deepEqual(state.scores, { left: 0, right: 1 });
});

test('winner remains for the next duel and the losing profile leaves when the timer ends', () => {
  const state = readyState();
  startRound(state, { durationSeconds: 10, now: 1000 });
  applyGift(state, { eventId: 'rose-one', giftId: 5655, giftName: 'Rose', coins: 1 }, 2000);
  applyGift(state, { eventId: 'rose-two', giftId: 5655, giftName: 'Rose', coins: 1 }, 3000);
  applyGift(state, { eventId: 'right-one', giftId: 999, giftName: 'TikTok', coins: 1 }, 4000);
  assert.equal(tick(state, 11000), true);
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent, null);
  assert.equal(state.lastResult.winner.username, 'kanal');
  assert.equal(state.lastResult.loser.username, 'rakip');
  assert.deepEqual(state.lastResult.scores, { left: 2, right: 1 });
  assert.equal(advanceWinner(state), true);
  assert.equal(state.opponent, null);
  assert.equal(setOpponent(state, { username: 'yeni' }), true);
  assert.equal(startRound(state, { now: 12000 }).ok, true);
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'yeni');
  assert.deepEqual(state.scores, { left: 0, right: 0 });
});

test('right-side winner stays right and a new left player can be selected from the result', () => {
  const state = readyState();
  startRound(state, { durationSeconds: 10, now: 1000 });
  applyGift(state, { eventId: 'right-one', giftId: 999, giftName: 'TikTok', coins: 1 }, 2000);
  assert.equal(tick(state, 11000), true);
  assert.equal(state.owner, null);
  assert.equal(state.opponent.username, 'rakip');
  assert.equal(state.lastResult.loser.username, 'kanal');
  assert.equal(state.lastResult.winnerSide, 'right');
  assert.equal(selectPlayer(state, 'left', { username: 'yeni' }), true);
  assert.equal(state.phase, 'idle');
  assert.equal(state.owner.username, 'yeni');
  assert.equal(state.opponent.username, 'rakip');
  assert.deepEqual(state.scores, { left: 0, right: 0 });
  assert.equal(startRound(state, { now: 12000 }).ok, true);
});

test('a draw keeps both players on their sides through the next round reset', () => {
  const state = readyState();
  startRound(state, { durationSeconds: 10, now: 1000 });
  applyGift(state, { eventId: 'rose-one', giftId: 5655, coins: 2 }, 2000);
  applyGift(state, { eventId: 'right-one', giftId: 5269, coins: 2 }, 3000);
  assert.equal(tick(state, 11000), true);
  assert.equal(state.lastResult.winner, null);
  assert.equal(state.lastResult.loser, null);
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'rakip');
  assert.deepEqual(state.scores, { left: 2, right: 2 });
  assert.equal(advanceWinner(state), true);
  assert.equal(state.phase, 'idle');
  assert.equal(state.owner.username, 'kanal');
  assert.equal(state.opponent.username, 'rakip');
  assert.deepEqual(state.scores, { left: 0, right: 0 });
});
