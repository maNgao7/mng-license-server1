'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AudienceQueue } = require('../src/audience-queue.cjs');
const catalog = require('../assets/gift-catalog.json');
let sequence = 0;
const chat = (id, comment = 'katıl', patch = {}) => ({ id, eventId: `chat-${++sequence}`, comment, nickname: id, ...patch });
const gift = (id, patch = {}) => ({ id, eventId: `gift-${++sequence}`, giftId: '5655', coinUnit: 1, repeatCount: 1, ...patch });
const like = (id, likeCount = 1, patch = {}) => ({ id, eventId: `like-${++sequence}`, likeCount, isDelta: true, ...patch });
function staged(options) {
  const queue = new AudienceQueue(options);
  queue.ingestChat(chat('first')); queue.ingestChat(chat('second'));
  return queue;
}
const ids = queue => queue.snapshot().queue.map(user => user.id);

test('manual next match retires fought players and selects the waiting queue by contribution',()=>{
  const q=staged({kingOfRing:true});
  q.ingestChat(chat('waiting'));
  q.ingestGift(gift('priority',{repeatCount:20}));
  q.startRound();
  const next=q.advanceRound();
  assert.equal(next.active.right.id,'priority');
  assert.equal(next.active.left.id,'waiting');
  assert.equal(next.phase,'staging');
  assert.deepEqual(q.ingestChat(chat('priority','A')).actions,[]);
  q.startRound();
  q.advanceRound();
  assert.deepEqual(q.lineup(),[false,false]);
});

test('manual next after KO retains an unfought promoted challenger in queue priority',()=>{
  const q=staged({kingOfRing:true});
  q.ingestChat(chat('early'));
  q.ingestGift(gift('priority',{repeatCount:20}));
  q.startRound();q.finishRound('right');
  const next=q.advanceRound();
  assert.equal(next.active.right.id,'priority');
  assert.equal(next.active.left.id,'early');
});

test('a defeated fighter explicitly joining again keeps their new seat on manual advance',()=>{
  const q=staged({kingOfRing:true});
  q.startRound();q.finishRound('right');
  q.ingestChat(chat('second'));
  q.advanceRound();
  assert.equal(q.snapshot().active.right.id,'second');
  assert.equal(q.snapshot().active.left,null);
});

test('historical chat and gifts and test joins never fill a fresh ring',()=>{
  const q=new AudienceQueue({kingOfRing:true,settings:{participationMode:'both',likeJoin:true,followJoin:true}});
  for(const flag of ['initial','isInitial','replay','isReplay']){
    const join=chat('old','katıl',{[flag]:true});
    const present=gift('old',{[flag]:true});
    assert.equal(q.ingestChat(join).accepted,false);
    assert.equal(q.ingestGift(present).accepted,false);
    assert.equal(q.ingestChat({...join,[flag]:false}).reason,'duplicate-event');
    assert.equal(q.ingestGift({...present,[flag]:false}).reason,'duplicate-event');
  }
  q.ingestChat(chat('test','katıl',{isTest:true}));
  q.ingestGift(gift('test',{isTest:true}));
  assert.deepEqual(q.lineup(),[false,false]);
  assert.deepEqual(q.snapshot().queue,[]);
  assert.equal(q.ingestChat(chat('red','Katıl')).joined,true);
  assert.deepEqual(q.lineup(),[false,true]);
  assert.equal(q.ingestGift(gift('blue')).joined,true);
  assert.deepEqual(q.lineup(),[true,true]);
});

test('chat and any gift share vacant corners and the ranked queue in mixed punch mode', () => {
  const q=new AudienceQueue({kingOfRing:true,settings:{punchSource:'all',likeThreshold:5,likePunchCount:2}});
  q.ingestGift(gift('red',{giftId:'other',coinUnit:3}));
  q.ingestChat(chat('blue'));
  q.ingestChat(chat('early'));
  q.ingestGift(gift('next',{giftId:'other',coinUnit:2}));
  assert.deepEqual(ids(q),['next','early']);
  assert.equal(q.startRound().active.left.id,'blue');
  assert.deepEqual(q.ingestLike(like('red',4)).actions,[]);
  assert.deepEqual(q.ingestLike(like('blue',4)).actions,[]);
  assert.deepEqual(q.ingestLike(like('next',50)).actions,[]);
  const packet=like('blue',8);
  assert.equal(q.ingestLike(packet).actions[0].count,4);
  assert.deepEqual(q.ingestLike(packet).actions,[]);
  assert.equal(q.ingestLike(like('blue',3)).actions[0].count,2);
  assert.deepEqual(q.ingestChat(chat('red','A')).actions,[]);
  assert.equal(q.ingestGift(gift('blue')).actions[0].source,'gift');
  assert.equal(q.finishRound('left').active.right.id,'next');
  q.startRound();
  assert.deepEqual(q.ingestLike(like('next',1)).actions,[]);
  for (const invalid of [0,1.5,101,'2'])assert.throws(()=>q.configure({likePunchCount:invalid}),RangeError);
});

test('joins stage right then left and extras queue without starting a fight', () => {
  const queue = new AudienceQueue();
  assert.equal(queue.snapshot().active.right, null);
  assert.equal(queue.startRound().reason, 'need-two-participants');
  assert.equal(queue.ingestChat(chat('first', ' KATIL ')).joined, true);
  assert.equal(queue.ingestChat(chat('second', 'KATIL')).joined, true);
  queue.ingestChat(chat('third'));
  queue.ingestChat(chat('first'));
  const state = queue.snapshot();
  assert.equal(state.phase, 'staging');
  assert.equal(state.active.right.id, 'first');
  assert.equal(state.active.left.id, 'second');
  assert.deepEqual(ids(queue), ['third']);
  assert.equal(queue.startRound().accepted, true);
  assert.equal(queue.snapshot().round, 1);
  assert.equal(queue.startRound().reason, 'round-active');
});

test('all gifts rank by cumulative coin value then join order; start picks the top two across staged users and queue', () => {
  const queue = staged();
  for (const who of ['early', 'late', 'spender']) queue.ingestChat(chat(who));
  queue.ingestGift(gift('spender', { giftId: 'any-id', coinUnit: 5, repeatCount: 2 }));
  queue.ingestGift(gift('late', { giftId: 'another-id', coinUnit: 3, repeatCount: 4 }));
  queue.ingestGift(gift('early', { giftId: 'third-id', coinUnit: 6, repeatCount: 2 }));
  assert.deepEqual(ids(queue), ['early', 'late', 'spender']);
  assert.equal(queue.snapshot().queue[0].coins, 12);
  assert.equal(queue.snapshot().active.right.id, 'first');
  const started = queue.startRound();
  assert.equal(started.active.right.id, 'early');
  assert.equal(started.active.left.id, 'late');
  assert.deepEqual(ids(queue), ['spender', 'first', 'second']);
  queue.ingestGift(gift('spender', { coinUnit: 100 }));
  assert.deepEqual(ids(queue), ['spender', 'first', 'second']);
  assert.equal(queue.snapshot().active.right.id, 'early');
  assert.equal(queue.snapshot().active.left.id, 'late');
});

test('third participant donates before P, displaces an initial fighter and retains callback identity after selection', () => {
  const calls = [];
  const queue = staged({ settings: { chatPunches: true }, onPunch: action => calls.push(action) });
  const spenderId = '9007199254740993';
  queue.ingestChat(chat(spenderId, 'katıl', { nickname: 'Third person' }));
  const donation = gift(spenderId, { coinUnit: 5, repeatCount: 3 });
  queue.ingestGift(donation);
  assert.equal(queue.snapshot().active.right.id, 'first');
  assert.equal(queue.snapshot().active.left.id, 'second');
  assert.deepEqual(calls, []);
  const started = queue.startRound();
  assert.equal(started.active.right.id, spenderId);
  assert.equal(started.active.left.id, 'first');
  assert.deepEqual(ids(queue), ['second']);
  assert.equal(started.active.right.coins, 15);
  assert.equal(started.active.right.joinOrder, 3);
  assert.equal(queue.snapshot().queue[0].joinOrder, 2);

  queue.ingestGift(gift('second', { coinUnit: 100 }));
  assert.equal(queue.snapshot().active.right.id, spenderId);
  assert.equal(queue.snapshot().active.left.id, 'first');
  assert.equal(queue.startRound().reason, 'round-active');
  assert.equal(queue.ingestGift(donation).reason, 'duplicate-event');
  const punch = gift(spenderId, { giftId: '5269' });
  const delivered = queue.ingestGift(punch).actions;
  assert.deepEqual(delivered, [{ type: 'punch', side: 'right', action: 'A', count: 1,
    userId: spenderId, eventId: punch.eventId, source: 'gift' }]);
  assert.deepEqual(calls, delivered);
});

test('a reset stages successors but next P reprioritizes all eligible users again', () => {
  const queue = staged(); queue.startRound();
  for (const who of ['a', 'b', 'c']) queue.ingestChat(chat(who));
  queue.finishRound(); queue.resetRound();
  assert.equal(queue.snapshot().active.right.id, 'a');
  assert.equal(queue.snapshot().active.left.id, 'b');
  queue.ingestGift(gift('c', { coinUnit: 20 }));
  const next = queue.startRound();
  assert.equal(next.active.right.id, 'c');
  assert.equal(next.active.left.id, 'a');
  assert.deepEqual(ids(queue), ['b']);
});

test('finish never promotes; only an explicit start or reset chooses the next pair', () => {
  const queue = staged(); queue.startRound();
  for (const who of ['a', 'b', 'c']) queue.ingestChat(chat(who));
  queue.ingestGift(gift('b', { coinUnit: 5 }));
  assert.equal(queue.finishRound().active.right.id, 'first');
  queue.ingestGift(gift('c', { coinUnit: 10 }));
  queue.ingestChat(chat('new'));
  assert.deepEqual(ids(queue), ['c', 'b', 'a', 'new']);
  assert.equal(queue.snapshot().phase, 'finished');
  assert.equal(queue.startRound().active.right.id, 'c');
  assert.equal(queue.snapshot().active.left.id, 'b');
  assert.deepEqual(ids(queue), ['a', 'new']);
  assert.equal(queue.resetRound().phase, 'staging');
  assert.equal(queue.snapshot().active.right.id, 'a');
  assert.equal(queue.snapshot().active.left.id, 'new');
  assert.equal(queue.snapshot().round, 2);
  assert.equal(queue.startRound().round, 3);
  queue.finishRound();
  assert.equal(queue.startRound().accepted, false);
  assert.equal(queue.snapshot().phase, 'finished');
  assert.deepEqual(ids(queue), []); // Previous fighters never automatically rejoin.
});

test('one queued user after a finished round cannot start alone or fill on arrival', () => {
  const queue = staged(); queue.startRound(); queue.finishRound();
  queue.ingestChat(chat('next'));
  assert.equal(queue.startRound().reason, 'need-two-participants');
  queue.resetRound();
  assert.equal(queue.snapshot().active.right.id, 'next');
  queue.ingestChat(chat('last'));
  assert.equal(queue.snapshot().active.left, null);
  assert.equal(queue.startRound().active.left.id, 'last');
});

test('gift participation requires the selected ID; unrelated spending is kept until joining', () => {
  const queue = new AudienceQueue({ settings: { participationMode: 'gift', participationGiftId: 'join' } });
  assert.equal(queue.ingestChat(chat('first')).joined, false);
  assert.equal(queue.ingestGift(gift('first', { giftId: 'other', coinUnit: 10 })).joined, false);
  assert.equal(queue.ingestGift(gift('first', { giftId: 'join', coinUnit: 2 })).joined, true);
  assert.equal(queue.snapshot().active.right.coins, 12);
  queue.configure({ participationMode: 'chat' });
  assert.equal(queue.ingestGift(gift('second', { giftId: 'join' })).joined, false);
  assert.equal(queue.ingestChat(chat('second')).joined, true);
  assert.equal(queue.snapshot().active.right.id, 'first');
});

test('comments never punch even with legacy switches enabled; IDs are still consumed', () => {
  const calls = [];
  const queue = staged({ onPunch: action => calls.push(action) });
  assert.deepEqual(queue.ingestChat(chat('first', 'A')).actions, []);
  queue.ingestChat(chat('queued')); queue.startRound();
  assert.deepEqual(queue.ingestChat(chat('first', 'B')).actions, []);
  queue.configure({ chatPunches: true });
  assert.deepEqual(queue.ingestChat(chat('queued', 'A')).actions, []);
  assert.deepEqual(queue.ingestChat(chat('outsider', 'B')).actions, []);
  assert.deepEqual(queue.ingestChat(chat('first', 'AB')).actions, []);
  for (const comment of ['A', 'a', ' B ', 'b', 'Ａ', 'hello']) {
    const input = chat('first', comment);
    assert.deepEqual(queue.ingestChat(input).actions, []);
    assert.equal(queue.ingestChat(input).reason, 'duplicate-event');
  }
  assert.equal(queue.snapshot().settings.chatPunches, false);
  assert.deepEqual(calls, []);
  queue.finishRound();
  assert.deepEqual(queue.ingestChat(chat('first', 'A')).actions, []);
});

test('gift punches require the sender side selected gift; common gift config works', () => {
  const queue = staged(); queue.startRound();
  assert.deepEqual(queue.ingestGift(gift('first')).actions, []); // Rose is LEFT default.
  assert.equal(queue.ingestGift(gift('first', { giftId: '5269' })).actions[0].side, 'right');
  assert.equal(queue.ingestGift(gift('second', { repeatCount: 3 })).actions[0].count, 3);
  queue.ingestChat(chat('queued'));
  assert.deepEqual(queue.ingestGift(gift('queued', { coinUnit: 100 })).actions, []);
  queue.configure({ punchGiftId: 'common' });
  assert.equal(queue.ingestGift(gift('first', { giftId: 'common' })).actions[0].action, 'A');
  assert.equal(queue.ingestGift(gift('second', { giftId: 'common' })).actions[0].side, 'left');
  assert.deepEqual(queue.ingestGift(gift('second')).actions, []);
  queue.configure({ punchGiftId: '', punchGiftIdRight: 'right', punchGiftIdLeft: 'left' });
  assert.equal(queue.ingestGift(gift('first', { giftId: 'right' })).actions[0].side, 'right');
  assert.equal(queue.ingestGift(gift('second', { giftId: 'left' })).actions[0].side, 'left');
});

test('cumulative streak continuation, final, older counts and replay credit exactly once for every gift', () => {
  const queue = staged(); queue.startRound(); queue.ingestChat(chat('spender'));
  const first = gift('spender', { giftId: 'unmapped', coinUnit: 7, giftType: 1, streakId: 'combo', repeatCount: 2 });
  assert.equal(queue.ingestGift(first).addedCoins, 14);
  assert.equal(queue.ingestGift(first).reason, 'duplicate-event');
  assert.equal(queue.ingestGift(gift('spender', { ...first, eventId: 'continue', repeatCount: 5 })).delta, 3);
  assert.equal(queue.ingestGift(gift('spender', { ...first, eventId: 'older', repeatCount: 3 })).delta, 0);
  assert.equal(queue.ingestGift(gift('spender', { ...first, eventId: 'final', repeatCount: 5, repeatEnd: true })).delta, 0);
  queue.finishRound(); queue.resetRound();
  assert.equal(queue.ingestGift(first).reason, 'duplicate-event');
  assert.equal(queue.snapshot().active.right.coins, 35);
});

test('owner deltas stay deltas even with a group; independent streaks scope by user and gift', () => {
  const queue = staged();
  const base = { giftType: 1, streakId: 'shared-group', repeatCount: 3, coinUnit: 2 };
  assert.equal(queue.ingestGift(gift('first', base)).delta, 3);
  assert.equal(queue.ingestGift(gift('second', base)).delta, 3);
  assert.equal(queue.ingestGift(gift('first', { ...base, giftId: 'other' })).delta, 3);
  for (const count of [1, 3]) assert.equal(queue.ingestGift(gift('first', { ...base, isDelta: true, repeatCount: count })).delta, count);
  assert.equal(queue.snapshot().active.right.coins, 20);
});

test('active streak punches use positive deltas immediately without waiting for repeatEnd', () => {
  const calls = [];
  const queue = staged({ onPunch: action => calls.push(action) }); queue.startRound();
  const base = { giftId: '5269', giftType: 1, streakId: 'punch-combo', repeatEnd: false };
  queue.ingestGift(gift('first', { ...base, repeatCount: 1 }));
  queue.ingestGift(gift('first', { ...base, repeatCount: 5 }));
  queue.ingestGift(gift('first', { ...base, repeatCount: 5, repeatEnd: true }));
  assert.deepEqual(calls.map(action => action.count), [1, 4]);
});

test('a single hundred-gift packet awards one hundred punches at the configured per-punch damage', () => {
  const queue = staged({kingOfRing:true, settings:{giftDamage:{'5269':1}}});
  queue.startRound();
  const packet = gift('first', {giftId:'5269', giftType:1, streakId:'hundred', repeatCount:100, repeatEnd:true});
  const { actions, addedCoins } = queue.ingestGift(packet);
  assert.equal(addedCoins, 100);
  assert.deepEqual(actions.map(({side, count, damage}) => ({side, count, damage})),
    [{side:'right', count:100, damage:1}]);
  assert.deepEqual(queue.ingestGift(packet).actions, []);
  queue.finishRound('right');
  queue.ingestChat(chat('challenger'));
  queue.startRound();
  assert.deepEqual(queue.ingestGift({...packet, eventId:'replayed-final'}).actions, []);
  assert.equal(queue.snapshot().active.right.coins, 100);
});

test('dedupe caches are bounded; retained streak mark still protects an evicted event', () => {
  const queue = new AudienceQueue({ eventCacheSize: 2, streakCacheSize: 2 });
  const first = gift('spender', { streakId: 'old', giftType: 1, repeatCount: 2 });
  queue.ingestGift(first);
  queue.ingestChat(chat('a')); queue.ingestChat(chat('b'));
  assert.equal(queue.ingestGift(first).delta, 0); // Event evicted; streak retained.
  queue.ingestGift(gift('spender', { streakId: 'second' }));
  queue.ingestGift(gift('spender', { streakId: 'third' }));
  assert.equal(queue.ingestGift(first).delta, 2); // Both finite retention windows elapsed.
});

test('catalog supplies verified per-unit price, explicit unit wins and unknown gifts still count units', () => {
  const queue = staged();
  const priced = catalog.find(row => row.coins > 1);
  const value = queue.ingestGift(gift('first', { giftId: priced.id, coinUnit: undefined, repeatCount: 3 }));
  assert.equal(value.addedCoins, priced.coins * 3);
  assert.equal(queue.ingestGift(gift('first', { giftId: priced.id, coinUnit: 2 })).addedCoins, 2);
  assert.equal(queue.ingestGift(gift('first', { giftId: 'unknown', coinUnit: undefined })).delta, 1);
  assert.equal(queue.ingestGift(gift('first', { giftId: 'unknown', coinUnit: undefined })).addedCoins, 0);
});

test('test gifts never join or change coin priority', () => {
  const queue = new AudienceQueue({ settings: { participationMode: 'gift' } });
  assert.equal(queue.ingestGift(gift('test', { isTest: true, coinUnit: 100 })).joined, false);
  assert.equal(queue.snapshot().active.right, null);
  assert.deepEqual(ids(queue), []);
  queue.ingestGift(gift('real'));
  assert.equal(queue.snapshot().active.right.id, 'real');
});

test('snapshots and callback objects are detached; portraits survive missing fields and nickname changes', () => {
  const queue = staged({ settings: { chatPunches: true }, onPunch: action => { action.count = 999; } });
  queue.ingestChat(chat('first', 'hello', { nickname: 'Display', portrait: 'https://cdn.example/large' }));
  queue.startRound();
  queue.ingestChat(chat('first', 'A', { nickname: '' }));
  assert.equal(queue.ingestGift(gift('first', { giftId: '5269', nickname: '' })).actions[0].count, 1);
  const state = queue.snapshot();
  assert.equal(state.active.right.nickname, 'Display');
  assert.equal(state.active.right.portrait, 'https://cdn.example/large');
  state.active.right.profilePictureUrls.push('bad'); state.active.right.coins = 123;
  state.settings.punchGiftId = 'bad';
  assert.equal(queue.snapshot().active.right.coins, 1);
  assert.deepEqual(queue.snapshot().active.right.profilePictureUrls, ['https://cdn.example/large']);
  assert.equal(queue.snapshot().settings.punchGiftId, '');
});

test('reject invalid inputs and numeric overflow without consuming IDs or changing settings', () => {
  const queue = staged();
  for (const event of [null, [], {}, gift('', { eventId: 'no-sender' }), gift('first', { eventId: '' })]) {
    assert.equal(queue.ingestGift(event).accepted, false);
  }
  for (const patch of [{ repeatCount: 0 }, { repeatCount: 1.5 }, { coinUnit: -1 }, { coinUnit: Infinity },
    { giftType: 1 }, { coinUnit: Number.MAX_SAFE_INTEGER, repeatCount: 2 }]) {
    assert.equal(queue.ingestGift(gift('first', patch)).accepted, false);
  }
  const malformed = chat('new', '', { comment: null });
  assert.equal(queue.ingestChat(malformed).accepted, false);
  assert.equal(queue.ingestChat({ ...malformed, comment: 'katıl' }).joined, true);
  assert.throws(() => queue.configure({ participationMode: 'other' }), RangeError);
  assert.throws(() => queue.configure({ punchGiftId: {} }), TypeError);
  assert.equal(queue.snapshot().settings.participationMode, 'chat');
  assert.throws(() => new AudienceQueue({ eventCacheSize: 0 }), RangeError);
});

test('king of ring pins first right/red and second left/blue despite a queued spender before P', () => {
  const queue = staged({ kingOfRing: true });
  queue.ingestChat(chat('spender'));
  queue.ingestGift(gift('spender', { coinUnit: 500 }));
  const started = queue.startRound();
  assert.equal(started.active.right.id, 'first');
  assert.equal(started.active.left.id, 'second');
  assert.deepEqual(ids(queue), ['spender']);
  queue.ingestGift(gift('spender', { coinUnit: 500 }));
  assert.equal(queue.startRound().reason, 'round-active');
  assert.equal(queue.snapshot().active.right.id, 'first');
});

test('king of ring retains either winner in the same corner and fills only the vacancy by coins then join order', () => {
  for (const winnerSide of ['left', 'right']) {
    const queue = staged({ kingOfRing: true }); queue.startRound();
    for (const who of ['early', 'later', 'low']) queue.ingestChat(chat(who));
    queue.ingestGift(gift('later', { coinUnit: 10 }));
    queue.ingestGift(gift('early', { coinUnit: 10 }));
    const loserSide = winnerSide === 'left' ? 'right' : 'left';
    const winnerId = queue.snapshot().active[winnerSide].id;
    const loserId = queue.snapshot().active[loserSide].id;
    const stagedNext = queue.finishRound(winnerSide);
    assert.equal(stagedNext.phase, 'staging');
    assert.equal(stagedNext.round, 1);
    assert.equal(stagedNext.active[winnerSide].id, winnerId);
    assert.equal(stagedNext.active[loserSide].id, 'early');
    assert.deepEqual(ids(queue), ['later', 'low']);
    assert.ok(!Object.values(stagedNext.active).some(user => user.id === loserId));
    assert.deepEqual(queue.finishRound(winnerSide), stagedNext); // Repeated native KO notification.
    assert.deepEqual(queue.finishRound(null), stagedNext);
    assert.deepEqual(queue.resetRound(), stagedNext); // Native ring reset keeps the winner.
    const next = queue.startRound();
    assert.equal(next.round, 2);
    assert.equal(next.active[winnerSide].id, winnerId);
    assert.equal(next.active[loserSide].id, 'early');
  }
});

test('king without a challenger waits for a fresh join, with no automatic fight or loser return', () => {
  const queue = staged({ kingOfRing: true, settings: {participationMode:'chat'} }); queue.startRound();
  const state = queue.finishRound('right');
  assert.equal(state.active.right.id, 'first');
  assert.equal(state.active.left, null);
  assert.equal(queue.startRound().reason, 'need-two-participants');
  queue.ingestGift(gift('second', { coinUnit: 100 })); // Ranking alone cannot rejoin in chat mode.
  assert.equal(queue.snapshot().active.left, null);
  assert.equal(queue.ingestChat(chat('challenger')).joined, true);
  assert.equal(queue.snapshot().active.left.id, 'challenger');
  assert.equal(queue.snapshot().phase, 'staging');
  queue.ingestChat(chat('second')); // Explicit rejoin queues behind the occupied pair.
  assert.deepEqual(ids(queue), ['second']);
  assert.equal(queue.startRound().active.left.id, 'challenger');
});

test('king draw removes both fighters and stages highest queued pair; invalid winner is atomic', () => {
  const queue = staged({ kingOfRing: true }); queue.startRound();
  for (const who of ['third', 'fourth', 'fifth']) queue.ingestChat(chat(who));
  queue.ingestGift(gift('fifth', { coinUnit: 10 }));
  const before = queue.snapshot();
  assert.throws(() => queue.finishRound('red'), RangeError);
  assert.deepEqual(queue.snapshot(), before);
  const drawn = queue.finishRound(null);
  assert.equal(drawn.phase, 'staging');
  assert.equal(drawn.active.right.id, 'fifth');
  assert.equal(drawn.active.left.id, 'third');
  assert.deepEqual(ids(queue), ['fourth']);
  assert.equal(queue.startRound().accepted, true);
});

test('king side gift IDs override a saved common gift, and chat stays disabled even when saved enabled', () => {
  const calls = [];
  const queue = staged({ kingOfRing: true, settings: { punchGiftId: 'old-common',
    punchGiftIdLeft: 'blue-gift', punchGiftIdRight: 'red-gift', chatPunches: true }, onPunch: action => calls.push(action) });
  queue.startRound();
  assert.deepEqual(queue.ingestChat(chat('first', 'A')).actions, []);
  assert.deepEqual(queue.ingestChat(chat('second', 'B')).actions, []);
  assert.deepEqual(queue.ingestGift(gift('first', { giftId: 'old-common' })).actions, []);
  assert.deepEqual(queue.ingestGift(gift('second', { giftId: 'old-common' })).actions, []);
  assert.deepEqual(queue.ingestGift(gift('first', { giftId: 'blue-gift' })).actions, []);
  assert.deepEqual(queue.ingestGift(gift('spectator', { giftId: 'red-gift' })).actions, []);
  const input = gift('first', { giftId: 'red-gift', repeatCount: 5 });
  const delivered = queue.ingestGift(input).actions;
  assert.deepEqual(delivered, [{ type: 'punch', side: 'right', action: 'A', count: 5,
    userId: 'first', eventId: input.eventId, source: 'gift', damage:15 }]);
  assert.deepEqual(calls.slice(-1), delivered);
  assert.equal(queue.ingestGift(gift('second', { giftId: 'blue-gift' })).actions[0].side, 'left');
  queue.configure({ punchGiftIdLeft: '' });
  assert.equal(queue.ingestGift(gift('second', { giftId: 'old-common' })).actions[0].side, 'left');
});

test('king like source counts per-fighter deltas, retains remainder and delivers each ID once', () => {
  const calls = [];
  const queue = staged({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: 10, likePunchCount: 1 }, onPunch: action => calls.push(action) });
  assert.equal(queue.snapshot().settings.likeThreshold, 10);
  queue.ingestLike(like('first', 100)); // Staging likes never bank for P.
  queue.ingestChat(chat('queued')); queue.startRound();
  queue.ingestLike(like('queued', 100));
  queue.ingestLike(like('outsider', 100));
  queue.ingestLike(like('first', 6));
  queue.ingestLike(like('second', 9));
  assert.equal(calls.length, 0);
  const input = like('first', 15);
  const delivered = queue.ingestLike(input);
  assert.equal(delivered.delta, 15);
  assert.deepEqual(delivered.actions, [{ type: 'punch', side: 'right', action: 'A', count: 2,
    userId: 'first', eventId: input.eventId, source: 'like', damage:15 }]);
  assert.equal(queue.ingestLike(input).reason, 'duplicate-event');
  queue.ingestLike(like('first', 9));
  queue.ingestLike(like('second', 1));
  assert.deepEqual(calls.map(action => [action.side, action.count]), [['right', 2], ['right', 1], ['left', 1]]);
  assert.equal(queue.snapshot().active.right.coins, 0);
  assert.deepEqual(ids(queue), ['queued']);
  assert.deepEqual(queue.ingestGift(gift('first', { giftId: '5269' })).actions, []);
  assert.deepEqual(queue.ingestGift(gift('second')).actions, []);
});

test('king like remainder resets at KO, native reset and source/threshold changes; dedupe survives', () => {
  const queue = staged({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: 10, likePunchCount: 1 } });
  queue.startRound();
  const prior = like('first', 9);
  queue.ingestLike(prior); queue.finishRound('right');
  queue.ingestChat(chat('next')); queue.startRound();
  assert.equal(queue.ingestLike(prior).reason, 'duplicate-event');
  assert.deepEqual(queue.ingestLike(like('first', 1)).actions, []);
  queue.resetRound(); queue.startRound();
  assert.deepEqual(queue.ingestLike(like('first', 9)).actions, []);
  queue.configure({ punchSource: 'gift' });
  assert.deepEqual(queue.ingestLike(like('first', 100)).actions, []);
  queue.configure({ punchSource: 'like' });
  assert.deepEqual(queue.ingestLike(like('first', 1)).actions, []);
  queue.configure({ likeThreshold: 2 });
  assert.deepEqual(queue.ingestLike(like('first', 1)).actions, []);
  assert.equal(queue.ingestLike(like('first', 1)).actions[0].count, 1);
});

test('enabled follow and like entry survive restore and patches; historical and test entry is ignored', () => {
  const saved = { likeJoin: true, followJoin: true, likeJoinThreshold: 5 };
  const q = new AudienceQueue({ kingOfRing: true, settings: { ...saved, punchSource: 'like' } });
  for (const flag of ['initial', 'isInitial', 'replay', 'isReplay', 'isTest']) {
    assert.equal(q.ingestLike(like('ignored', 10, { [flag]: true })).joined, false);
    assert.equal(q.ingestFollow({ id: 'ignored', eventId: `follow-${flag}`, [flag]: true }).joined, false);
  }
  assert.deepEqual(q.lineup(), [false, false]);
  assert.equal(q.ingestLike(like('red', 4)).joined, false);
  const first = like('red', 1);
  assert.equal(q.ingestLike(first).joined, true);
  assert.equal(q.ingestLike(first).reason, 'duplicate-event');
  const follow = { id: 'blue', eventId: 'follow' };
  assert.equal(q.ingestFollow(follow).joined, true);
  assert.equal(q.ingestFollow(follow).reason, 'duplicate-event');
  const { settings } = q.configure(saved);
  assert.deepEqual([settings.likeJoin, settings.followJoin, settings.likeJoinThreshold], [true, true, 5]);
  assert.equal(q.snapshot().phase, 'staging');
  q.startRound(); q.finishRound('right');
  assert.deepEqual(q.lineup(), [false, true]);
  assert.equal(q.ingestLike(like('blue', 4)).joined, false);
  assert.equal(q.ingestLike(like('blue', 1)).joined, true);
  assert.equal(q.snapshot().active.left.id, 'blue');
  assert.equal(q.snapshot().phase, 'staging');
  q.configure({ likeJoin: false, followJoin: false });
  assert.equal(q.ingestLike(like('outside', 100)).joined, false);
  assert.equal(q.ingestFollow({ id: 'outside', eventId: 'disabled' }).joined, false);
  assert.deepEqual(ids(q), []);
  assert.throws(() => q.configure({ likeJoin: 'false' }), TypeError);
});

test('king initial likes, cumulative snapshots and malformed counts never create punches', () => {
  const queue = staged({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: 10, likePunchCount: 1 } }); queue.startRound();
  for (const event of [null, [], {}, like('first', 0), like('first', 1.5), like('first', Infinity),
    like('first', 10, { isDelta: false }), like('first', undefined, { likeCount: undefined, totalLikeCount: 1000 })]) {
    assert.equal(queue.ingestLike(event).accepted, false);
  }
  const initial = like('first', 1000, { isInitial: true });
  assert.equal(queue.ingestLike(initial).reason, 'initial-event');
  assert.equal(queue.ingestLike({ ...initial, isInitial: false }).reason, 'duplicate-event');
  assert.deepEqual(queue.ingestLike(like('first', 9)).actions, []);
  assert.equal(queue.ingestLike(like('first', 1)).actions[0].count, 1);
});

test('king likes stay exact for huge bounded counters and only current fighters act after vacancy refill', () => {
  const queue = staged({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: Number.MAX_SAFE_INTEGER, likePunchCount: 1 } });
  queue.startRound();
  assert.deepEqual(queue.ingestLike(like('first', Number.MAX_SAFE_INTEGER - 1)).actions, []);
  assert.equal(queue.ingestLike(like('first', Number.MAX_SAFE_INTEGER - 1)).actions[0].count, 1);
  assert.equal(queue.ingestLike(like('first', 2)).actions[0].count, 1);
  queue.finishRound('left'); queue.ingestChat(chat('new')); queue.startRound();
  assert.deepEqual(queue.ingestLike(like('first', Number.MAX_SAFE_INTEGER)).actions, []);
  assert.equal(queue.ingestLike(like('new', Number.MAX_SAFE_INTEGER)).actions[0].side, 'right');
});

test('king gift participation fills a vacant corner, but ordinary gifts only rank the queue', () => {
  const queue = new AudienceQueue({ kingOfRing: true, settings: { participationMode: 'gift', participationGiftId: 'join' } });
  queue.ingestGift(gift('red', { giftId: 'join' }));
  queue.ingestGift(gift('blue', { giftId: 'join' }));
  queue.startRound(); queue.finishRound('left');
  assert.equal(queue.snapshot().active.right, null);
  queue.ingestGift(gift('red', { giftId: 'other', coinUnit: 100 }));
  assert.equal(queue.snapshot().active.right, null);
  queue.ingestGift(gift('fresh', { giftId: 'join' }));
  assert.equal(queue.snapshot().active.right.id, 'fresh');
  assert.equal(queue.snapshot().active.left.id, 'blue');
  assert.equal(queue.snapshot().phase, 'staging');
});

test('king options validate atomically and unopted legacy queue does not enable like punches', () => {
  assert.throws(() => new AudienceQueue({ kingOfRing: 'true' }), TypeError);
  const queue = staged({ kingOfRing: true });
  const before = queue.snapshot();
  for (const patch of [{ punchSource: 'unknown' }, { likeThreshold: 0 }, { likeThreshold: 1.5 }, { likeThreshold: '10' }]) {
    assert.throws(() => queue.configure(patch), RangeError);
    assert.deepEqual(queue.snapshot(), before);
  }
  const legacy = staged({ settings: { punchSource: 'like' } }); legacy.startRound();
  assert.deepEqual(legacy.ingestLike(like('first', 100)).actions, []);
  assert.equal(legacy.ingestGift(gift('second')).actions[0].side, 'left');
  assert.equal(legacy.finishRound('right').phase, 'finished');
});

test('personal likes before explicit entry and before the gong never count towards a punch',()=>{
  const q=new AudienceQueue({kingOfRing:true,settings:{likeJoinThreshold:7,likeThreshold:5,likePunchCount:1,punchSource:'like',likeDamage:23}});
  q.ingestLike(like('red',6));
  q.ingestLike(like('blue',3));
  assert.deepEqual(q.lineup(),[false,false]);
  const packet=like('red',8);
  assert.equal(q.ingestLike(packet).joined,false);
  assert.equal(q.ingestLike(packet).accepted,false);
  q.ingestLike(like('blue',4));
  q.ingestLike(like('next',7));
  assert.deepEqual(q.lineup(),[false,false]);
  assert.deepEqual(ids(q),[]);
  q.ingestChat(chat('red'));
  q.ingestGift(gift('blue'));
  assert.deepEqual(q.ingestLike(like('red',4)).actions,[]);
  q.startRound();
  assert.deepEqual(q.ingestLike(like('red',4)).actions,[]);
  const [hit]=q.ingestLike(like('red',1)).actions;
  assert.deepEqual([hit.side,hit.count,hit.damage],['right',1,23]);
});

test('all Turkish and ASCII case variants of the exact join command join once without auto-start', () => {
  const variants = ['k', 'K'].flatMap(k => ['a', 'A'].flatMap(a => ['t', 'T'].flatMap(t =>
    ['ı', 'i', 'I', 'İ'].flatMap(i => ['l', 'L'].map(l => `${k}${a}${t}${i}${l}`)))));
  for (const kingOfRing of [false, true]) {
    const q = new AudienceQueue({ kingOfRing });
    for (const [i, comment] of variants.entries()) {
      const event = chat(`viewer-${i}`, ` ${comment} `);
      assert.equal(q.ingestChat(event).joined, true, comment);
      assert.equal(q.ingestChat(event).reason, 'duplicate-event');
    }
    for (const comment of ['katıl!', 'katil now', 'kat ıl', 'A', 'B', 'katilim'])
      assert.equal(q.ingestChat(chat('outsider', comment)).joined, false);
    assert.equal(q.snapshot().phase, 'staging');
    assert.equal(q.snapshot().round, 0);
    assert.equal(q.snapshot().queue.length, variants.length - 2);
  }
});

test('saved chat sources migrate to gifts and no source or legacy flag can revive comment punches', () => {
  for (const kingOfRing of [false, true]) for (const source of ['chat', 'both', 'gift', 'like', 'all']) {
    const q = staged({ kingOfRing, settings: { punchSource: source, chatPunches: true, likeThreshold: 10, likePunchCount: 1 } });
    const expected = ['chat', 'both'].includes(source) ? 'gift' : source;
    assert.equal(q.snapshot().settings.punchSource, expected);
    assert.equal(q.snapshot().settings.chatPunches, false);
    q.startRound();
    for (const comment of ['A', 'a', 'B', 'Ａ', 'katıl'])
      assert.deepEqual(q.ingestChat(chat('first', comment)).actions, []);
    if (kingOfRing) {
      assert.equal(q.ingestGift(gift('first', { giftId: '5269' })).actions.length, expected === 'like' ? 0 : 1);
      assert.equal(q.ingestLike(like('first', 10)).actions.length, ['like', 'all'].includes(expected) ? 1 : 0);
    }
    assert.equal(q.configure({ punchSource: 'chat', chatPunches: true }).settings.punchSource, 'gift');
    assert.deepEqual(q.ingestChat(chat('first', 'A')).actions, []);
  }
});

test('single 30/50/100 cumulative packets enqueue every unit immediately; finals and older counts never replay', () => {
  const calls = [];
  const q = staged({ kingOfRing: true, settings: { giftDamage: { '5269': 3 } }, onPunch: action => calls.push(action) });
  q.startRound();
  for (const count of [30, 50, 100]) {
    const packet = gift('first', { giftId: '5269', giftType: 1, streakId: `burst-${count}`, repeatCount: count, repeatEnd: false });
    const outcome = q.ingestGift(packet);
    assert.deepEqual([outcome.delta, outcome.addedCoins, outcome.actions[0].count, outcome.actions[0].damage], [count, count, count, 3]);
    assert.equal(q.ingestGift(packet).reason, 'duplicate-event');
    for (const repeatCount of [count, count - 1, count]) {
      const replay = q.ingestGift({ ...packet, eventId: `end-${++sequence}`, repeatCount, repeatEnd: true });
      assert.deepEqual([replay.delta, replay.addedCoins, replay.actions.length], [0, 0, 0]);
    }
  }
  assert.deepEqual(calls.map(action => action.count), [30, 50, 100]);
  assert.equal(q.snapshot().active.right.coins, 180);
});

test('interleaved gift bursts retain total coin priority and stable ties across continuation and KO', () => {
  const q = staged({ kingOfRing: true });
  q.startRound();
  for (const who of ['early', 'late', 'high']) q.ingestChat(chat(who));
  for (const [who, unit, totals] of [['early', 2, [30, 50, 100]], ['late', 4, [30, 50]], ['high', 3, [100]]]) {
    for (const count of [...totals, totals.at(-1), 1])
      assert.deepEqual(q.ingestGift(gift(who, { giftId: 'ranking', coinUnit: unit, giftType: 1,
        streakId: `rank-${who}`, repeatCount: count, repeatEnd: count === totals.at(-1) })).actions, []);
  }
  assert.deepEqual(q.snapshot().queue.map(user => [user.id, user.coins]), [['high', 300], ['early', 200], ['late', 200]]);
  assert.equal(q.finishRound('right').active.left.id, 'high');
  assert.equal(q.snapshot().phase, 'staging');
  assert.deepEqual(ids(q), ['early', 'late']);
});

test('like entry accumulates per sender immediately; entry and pre-gong likes never bank punches', () => {
  const q = new AudienceQueue({ kingOfRing: true, settings: { likeJoin: true, likeJoinThreshold: 7,
    followJoin: true, punchSource: 'all', likeThreshold: 5, likePunchCount: 1 } });
  assert.equal(q.ingestLike(like('red', 6)).joined, false);
  q.ingestLike(like('blue', 3));
  const join = like('red', 30, { repeatEnd: false });
  assert.equal(q.ingestLike(join).joined, true);
  assert.equal(q.ingestLike(join).reason, 'duplicate-event');
  assert.equal(q.ingestLike(like('blue', 4)).joined, true);
  assert.equal(q.ingestFollow({ id: 'waiting', eventId: 'follow-waiting' }).joined, true);
  assert.deepEqual(q.ingestLike(like('red', 100)).actions, []);
  assert.equal(q.snapshot().phase, 'staging');
  q.startRound();
  for (const who of ['red', 'blue']) assert.deepEqual(q.ingestLike(like(who, 4)).actions, []);
  assert.deepEqual(q.ingestLike(like('red', 1, { repeatEnd: false })).actions.map(a => [a.side, a.count]), [['right', 1]]);
  assert.deepEqual(q.ingestLike(like('blue', 51, { repeatEnd: false })).actions.map(a => [a.side, a.count]), [['left', 11]]);
  assert.equal(q.snapshot().active.right.coins, 0);
  assert.deepEqual(ids(q), ['waiting']);
});

test('like entry identity promotion, setting changes, bounded counters and huge counts stay exact', () => {
  const q = new AudienceQueue({ kingOfRing: true, eventCacheSize: 2,
    settings: { likeJoin: true, likeJoinThreshold: 10 } });
  q.ingestLike(like('', 9, { uniqueId: 'viewer' }));
  assert.equal(q.ingestLike(like('123', 1, { userId: '123', uniqueId: 'viewer' })).joined, true);
  assert.equal(q.snapshot().active.right.userId, '123');
  for (const who of ['evicted', 'recent', 'newest']) q.ingestLike(like(who, 9));
  assert.equal(q.ingestLike(like('evicted', 1)).joined, false);
  q.ingestLike(like('changed', 9));
  q.configure({ likeJoinThreshold: 11 });
  assert.equal(q.ingestLike(like('changed', 2)).joined, false);
  q.configure({ likeJoin: false }); q.configure({ likeJoin: true });
  assert.equal(q.ingestLike(like('changed', 9)).joined, false);
  q.configure({ likeJoinThreshold: Number.MAX_SAFE_INTEGER });
  assert.equal(q.ingestLike(like('huge', Number.MAX_SAFE_INTEGER - 1)).joined, false);
  assert.equal(q.ingestLike(like('huge', Number.MAX_SAFE_INTEGER - 1)).joined, true);
  assert.equal(q.snapshot().active.left.id, 'huge');
  assert.equal(q.snapshot().phase, 'staging');
});

test('gift/chat/follow entry clears partial like entry; fresh thresholds apply after a loss', () => {
  for (const entry of ['gift', 'chat', 'follow']) {
    const q = new AudienceQueue({ kingOfRing: true, settings: { likeJoin: true, likeJoinThreshold: 5, followJoin: true } });
    q.ingestLike(like('red', 4));
    const outcome = entry === 'gift' ? q.ingestGift(gift('red')) : entry === 'chat'
      ? q.ingestChat(chat('red')) : q.ingestFollow({ id: 'red', eventId: `follow-${entry}` });
    assert.equal(outcome.joined, true);
    q.ingestChat(chat('blue')); q.startRound(); q.finishRound('left');
    assert.equal(q.ingestLike(like('red', 1)).joined, false);
    assert.equal(q.ingestLike(like('red', 4)).joined, true);
    assert.equal(q.snapshot().active.right.id, 'red');
    assert.equal(q.snapshot().phase, 'staging');
  }
});
