'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { HediyeBoxMatch } = require('../src/match-core.cjs');
const { AudienceQueue } = require('../src/audience-queue.cjs');
const { DesktopController } = require('../src/desktop-controller.cjs');
const { createHediyeBoxLive, sharedModules } = require('../src/live-client.cjs');
class FakeConnection extends EventEmitter {
  isConnected = false;
  async connect() { this.isConnected = true; return { roomId: '123456', isConnected: true }; }
  disconnect() { this.isConnected = false; }
}
function ownerTimers() {
  const pending = new Map();
  return {
    pending,
    setTimeout(fn, delay) { pending.set(fn, delay); return fn; },
    clearTimeout(fn) { pending.delete(fn); },
    async tick() {
      assert.equal(pending.size, 1);
      const [[fn, delay]] = pending;
      pending.delete(fn);
      fn();
      await new Promise(resolve => setImmediate(resolve));
      return delay;
    },
  };
}
test('live follows retain sender identity and duplicate follows and likes have one game effect',async()=>{
  const connection=new FakeConnection(),queue=new AudienceQueue({kingOfRing:true,settings:{punchSource:'like',likeThreshold:100,likePunchCount:1}});
  const hits=[], follows=[];
  const live=createHediyeBoxLive({env:{},shared:{...sharedModules(),detectOwner:async()=>[]},createConnection:async()=>connection,
    onChat:event=>queue.ingestChat(event),onFollow:event=>follows.push([event.userId,queue.ingestFollow(event).accepted]),
    onLike:event=>hits.push(...queue.ingestLike(event).actions)});
  const user=id=>({id,uniqueId:'p'+id,nickname:'P'+id});
  try{
    await live.start('tester');
    for(const id of ['11','22','33'])connection.emit('chat',{msgId:'join'+id,user:user(id),comment:'katıl'});
    connection.emit('follow',{msgId:'old',user:user('55'),isReplay:true});
    for(const id of ['11','11','22','33'])connection.emit('follow',{common:{msgId:'f'+id},user:user(id)});
    assert.deepEqual(follows,[['11',true],['11',false],['22',true],['33',true]]);
    assert.equal(queue.snapshot().active.right.userId,'11');assert.equal(queue.snapshot().active.left.userId,'22');
    assert.deepEqual(queue.snapshot().queue.map(p=>p.userId),['33']);
    queue.configure({followJoin:false});connection.emit('follow',{common:{msgId:'f44'},user:user('44')});
    assert.equal(queue.snapshot().queue.length,1);
    assert.equal(queue.updatePortrait({userId:'33',portrait:'file:///portrait.png'}),true);
    assert.equal(queue.snapshot().queue[0].portrait,'file:///portrait.png');
    queue.startRound();
    for(const [msgId,likeCount] of [['1',99],['2',2],['2',2],['3',99]]){
      connection.emit('like',{common:{msgId},user:user('11'),likeCount});
    }
    assert.deepEqual(hits.map(p=>[p.side,p.count]),[['right',1],['right',1]]);
  }finally{live.close();}
});
test('v3 content and v2 comment seat real identities without comment punches', async () => {
  const connection=new FakeConnection();
  const queue=new AudienceQueue({kingOfRing:true,settings:{punchSource:'chat'}});
  const punches=[];
  const live=createHediyeBoxLive({env:{},shared:{...sharedModules(),detectOwner:async()=>[]},
    createConnection:async()=>connection,onChat:event=>punches.push(...queue.ingestChat(event).actions)});
  const sender={id:'123',uniqueId:'red',avatarLarge:{urlList:['https://cdn.example/red']}};
  try{
    await live.start('tester');
    connection.emit('chat',{common:{msgId:'1'},user:sender,content:'Katıl'});
    connection.emit('chat',{common:{msgId:'2'},user:{id:'456',uniqueId:'blue'},comment:'katil'});
    assert.equal(queue.snapshot().active.right.portrait,'https://cdn.example/red');
    assert.equal(queue.startRound().accepted,true);
    for(const msgId of ['3','3','4'])connection.emit('chat',{common:{msgId},user:sender,content:'A'});
    connection.emit('chat',{common:{msgId:'5'},user:{id:'789',uniqueId:'waiting'},content:'A'});
    assert.deepEqual(punches,[]);
    assert.equal(queue.snapshot().settings.punchSource,'gift');
  }finally{live.close();}
});
const gift = patch => ({ msgId: 'a', groupId: 'streak', giftId: 5655, giftType: 1,
  repeatCount: 1, repeatEnd: false, user: { id: '123', uniqueId: 'tester', nickname: 'İzleyici' }, ...patch });

test('packaged resources/app loads queue and live client with only its bundled asset catalog', t => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hediye-box-package-'));
  t.after(() => {
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryRoot).startsWith('hediye-box-package-'));
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const app = path.join(temporaryRoot, 'resources', 'app');
  fs.mkdirSync(path.join(app, 'src'), { recursive: true });
  fs.mkdirSync(path.join(app, 'assets'));
  for (const name of ['audience-queue.cjs', 'live-client.cjs', 'gift-normalizer.cjs']) {
    fs.copyFileSync(path.join(__dirname, '../src', name), path.join(app, 'src', name));
  }
  fs.copyFileSync(path.join(__dirname, '../assets/gift-catalog.json'), path.join(app, 'assets/gift-catalog.json'));
  const child = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { AudienceQueue } = require('./src/audience-queue.cjs');
    assert.equal(typeof require('./src/live-client.cjs').createHediyeBoxLive, 'function');
    const catalog = require('./assets/gift-catalog.json');
    const gift = catalog.find(row => row.coins > 1);
    const queue = new AudienceQueue();
    queue.ingestChat({ id: 'sender', eventId: 'join', comment: 'katıl' });
    assert.equal(queue.ingestGift({ id: 'sender', eventId: 'gift', giftId: gift.id,
      repeatCount: 3 }).addedCoins, gift.coins * 3);
  `], { cwd: app, encoding: 'utf8' });
  assert.equal(child.status, 0, child.error?.message || child.stderr || child.stdout);
});

test('shared session keeps one socket and raw listener credits intermediate gifts once', async () => {
  const match = new HediyeBoxMatch(); let created = 0;
  const connection = new FakeConnection();
  const live = createHediyeBoxLive({ match, env: {},
    shared: { ...sharedModules(), detectOwner: async () => [] },
    createConnection: async () => { created++; return connection; },
  });
  try {
    assert.equal((await live.start('tenhaa.34')).status, 'connected');
    connection.emit('gift', gift());
    assert.equal(match.snapshot().sides.left.pendingPunches, 1);
    connection.emit('gift', gift({ msgId: 'b', repeatCount: 3 }));
    assert.equal(match.snapshot().sides.left.pendingPunches, 3);
    connection.emit('gift', gift({ msgId: 'c', repeatCount: 3, repeatEnd: true }));
    assert.equal(match.snapshot().sides.left.pendingPunches, 3);
    await live.start('@tenhaa.34');
    assert.equal(created, 1);
  } finally { live.close(); }
  connection.emit('gift', gift({ msgId: 'after-close', repeatCount: 4 }));
  assert.equal(match.snapshot().sides.left.pendingPunches, 3);
});
test('owner without authenticated sharing blocks a second connection', async () => {
  let created = 0;
  const live = createHediyeBoxLive({ match: new HediyeBoxMatch(), env: {},
    shared: { ...sharedModules(), detectOwner: async () => [31975] },
    createConnection: async () => { created++; return new FakeConnection(); },
  });
  try {
    assert.equal((await live.start('tenhaa.34')).status, 'error');
    assert.equal(created, 0);
  } finally { live.close(); }
});

test('shared-owner connect and poll failures back off, stop, and allow a manual restart', async t => {
  const timers = ownerTimers(), routes = [];
  let failConnect = true, failPoll = true, sockets = 0;
  const live = createHediyeBoxLive({ timers, env: {}, createConnection: () => { sockets++; return new FakeConnection(); },
    shared: { ...sharedModules(), ownerFromEnvironment: () => ({ kind: 'owner' }),
      async requestJSON(_base, route) {
        routes.push(route);
        if (route === '/connect' ? failConnect : failPoll) throw new Error('owner-timeout');
        return { schemaVersion: 1, sessionId: 'room', status: { status: 'connected', username: 'tester' }, events: [] };
      },
    },
  });
  t.after(() => live.close());
  assert.equal((await live.start('tester')).status, 'error');
  for (const delay of [500, 1000, 2000, 4000, 8000]) assert.equal(await timers.tick(), delay);
  assert.deepEqual(routes, Array(6).fill('/connect'));
  assert.equal(live.status().nextRetryAt, null);
  assert.equal(timers.pending.size, 0);
  failConnect = false;
  await live.start('tester');
  assert.equal(live.status().status, 'error');
  assert.equal(await timers.tick(), 500);
  failPoll = false;
  assert.equal(await timers.tick(), 1000);
  assert.deepEqual(routes.slice(6), ['/connect', '/state?after=0', '/state?after=0', '/state?after=0']);
  assert.equal(live.status().status, 'connected');
  assert.equal(live.status().nextRetryAt, null);
  assert.equal(sockets, 0);
  live.close();
  assert.equal(timers.pending.size, 0);
});

test('switching during owner discovery or SDK creation keeps the latest channel and raw gift listener', async t => {
  let discovery, factory;
  const first = new Promise(resolve => { discovery = resolve; });
  const second = new Promise(resolve => { factory = resolve; });
  const created = [], delivered = [], active = new FakeConnection(), retired = new FakeConnection();
  let probes = 0;
  const live = createHediyeBoxLive({ env: {}, onGiftRaw: event => delivered.push(event),
    shared: { ...sharedModules(), detectOwner: () => ++probes === 1 ? first : [] },
    createConnection(username) { created.push(username); return username === 'second' ? second : active; },
  });
  t.after(() => live.close());
  const pendingDiscovery = live.start('first');
  const pendingFactory = live.start('second');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(created, ['second']);
  await live.start('third');
  discovery([]);
  factory(retired);
  await Promise.all([pendingDiscovery, pendingFactory]);
  assert.deepEqual(created, ['second', 'third']);
  assert.equal(live.status().username, 'third');
  assert.equal(live.status().status, 'connected');
  retired.emit('gift', gift());
  assert.equal(delivered.length, 0);
  active.emit('gift', gift());
  assert.equal(delivered.length, 1);
});

test('late owner connect failure after a channel switch cannot change status or schedule a retry', async t => {
  const timers = ownerTimers(), requests = [];
  let rejectFirst;
  const first = new Promise((_resolve, reject) => { rejectFirst = reject; });
  const live = createHediyeBoxLive({ env: {}, timers, shared: { ...sharedModules(),
    ownerFromEnvironment: () => ({ kind: 'owner' }),
    async requestJSON(_base, route, { body }) {
      requests.push(body?.username || route);
      if (body?.username === 'first') return first;
      return { schemaVersion: 1, status: { status: 'connected', username: 'second' }, events: [] };
    },
  } });
  t.after(() => live.close());
  const old = live.start('first');
  await live.start('second');
  rejectFirst(new Error('late failure'));
  await old;
  assert.equal(live.status().username, 'second');
  assert.equal(live.status().status, 'connected');
  assert.deepEqual(requests, ['first', 'second', '/state?after=0']);
  assert.deepEqual([...timers.pending.values()], [100]);
});

test('generic gifts include every gift ID and per-unit raw, details or verified catalog coins', async () => {
  const raw = [], legacy = [];
  const match = new HediyeBoxMatch();
  const connection = new FakeConnection();
  const live = createHediyeBoxLive({ match, env: {}, onGiftRaw: event => raw.push(event),
    onGift: envelope => legacy.push(envelope),
    shared: { ...sharedModules(), detectOwner: async () => [] },
    createConnection: async () => connection,
  });
  try {
    await live.start('tester');
    connection.emit('gift', gift({ msgId: 'raw', giftId: 'unknown', giftType: 0, diamondCount: 7, repeatCount: 2 }));
    connection.emit('gift', gift({ msgId: 'details', giftId: 'details-only', giftType: 0, giftDetails: { diamondCount: 9 } }));
    connection.emit('gift', gift({ msgId: 'catalog', giftType: 0 }));
    connection.emit('gift', gift({ msgId: 'zero', giftId: 'unknown-zero', giftType: 0, diamondCount: 0 }));
    connection.emit('gift', gift({ msgId: 'none', giftId: 'unknown-free', giftType: 0 }));
    assert.deepEqual(raw.map(event => [event.giftId, event.coinUnit]),
      [['unknown', 7], ['details-only', 9], ['5655', 1], ['unknown-zero', 0], ['unknown-free', 0]]);
    assert.equal(raw[0].repeatCount, 2); // Unit price is not pre-multiplied.
    assert.equal(raw[0].id, '123');
    assert.equal(raw[0].isDelta, false);
    assert.equal(legacy.length, 1); // Old supported-gift acceptance path is intact.
    assert.equal(legacy[0].event.giftId, '5655');
    assert.equal(match.snapshot().sides.left.pendingPunches, 1);
  } finally { live.close(); }
});

test('generic-only client delivers normalized chat and gifts from the existing single socket', async () => {
  const chats = [], gifts = []; let created = 0;
  const connection = new FakeConnection();
  const live = createHediyeBoxLive({ env: {}, onChat: event => chats.push(event), onGiftRaw: event => gifts.push(event),
    shared: { ...sharedModules(), detectOwner: async () => [] },
    createConnection: async () => { created++; return connection; },
  });
  const message = { msgId: 'chat-1', comment: 'katıl',
    user: { id: '123', uniqueId: 'tester', nickname: 'Görünen Ad', avatarLarge: { urlList: ['https://cdn.example/large'] } } };
  try {
    await live.start('tester');
    connection.emit('chat', { ...message, msgId: 'old-chat', isInitial: true });
    connection.emit('gift', gift({ msgId: 'old-gift', replay: true }));
    connection.emit('gift', gift({ msgId: 'old-meta' }), { initial: true });
    connection.emit('chat', message);
    connection.emit('gift', gift());
    connection.emit('gift', gift({ msgId: 'more', repeatCount: 4 }));
    connection.emit('gift', gift({ msgId: 'end', repeatCount: 4, repeatEnd: true }));
    connection.emit('chat', { comment: 'katıl', user: message.user }); // No event identity.
    assert.equal(chats.length, 1);
    assert.equal(chats[0].id, '123');
    assert.equal(chats[0].nickname, 'Görünen Ad');
    assert.equal(chats[0].uniqueId, 'tester');
    assert.equal(chats[0].portrait, 'https://cdn.example/large');
    assert.equal(chats[0].comment, 'katıl');
    assert.deepEqual(gifts.map(event => event.repeatCount), [1, 4, 4]);
    assert.equal(gifts[0].streakId, gifts[1].streakId);
    await live.start('@tester');
    assert.equal(created, 1);
  } finally { live.close(); }
  connection.emit('chat', { ...message, msgId: 'closed' });
  connection.emit('gift', gift({ msgId: 'closed' }));
  assert.equal(chats.length, 1);
  assert.equal(gifts.length, 3);
});

test('desktop connect skips owner history, then forwards fresh chat and delta gifts once', async () => {
  const timers = ownerTimers(), chats = [], gifts = [], routes = []; let created = 0;
  const rows = [
    { seq: 1, value: { type: 'chat', eventId: 'join', userId: '123', uniqueId: 'tester', comment: 'katıl', nickname: 'Owner Ad' } },
    { seq: 2, value: { type: 'gift', eventId: 'owner-1', userId: '123', uniqueId: 'tester', giftId: 'unknown', count: 1, diamondCount: 8 } },
    { seq: 3, value: { type: 'gift', eventId: 'owner-2', userId: '123', uniqueId: 'tester', giftId: 'unknown', count: 3, giftDetails: { diamondCount: 8 } } },
  ];
  const audience = new AudienceQueue({ settings: { participationMode: 'both' } });
  const history = rows.map(row => ({ ...row, value: { ...row.value, userId: '999', uniqueId: 'old' } }));
  const fresh = rows.map(row => ({ ...row, seq: row.seq + 3 }));
  const tagged = [{ ...rows[0], seq: 7, isReplay: true },
    { seq: 8, value: { ...rows[1].value, isInitial: true } }];
  const controller = new DesktopController({
    onChat(event) { chats.push(event); audience.ingestChat(event); },
    onGiftRaw(event) { gifts.push(event); audience.ingestGift(event); },
    createLive: options => createHediyeBoxLive({ ...options, env: {}, timers,
      createConnection: async () => { created++; return new FakeConnection(); },
      shared: { ...sharedModules(), ownerFromEnvironment: () => ({ kind: 'owner', url: 'http://127.0.0.1:1', token: 'test-only' }),
        requestJSON: async (_base, route) => {
          routes.push(route);
          return route === '/connect' ? {} : { schemaVersion: 1, sessionId: 'owner-room',
            status: { status: 'connected', username: 'tester' },
            events: route.includes('after=0') ? history : [...fresh, ...tagged] };
        },
      },
    }),
  });
  try {
    await controller.connect('tester'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(chats.length + gifts.length, 0);
    assert.equal(audience.snapshot().active.right, null);
    await timers.tick();
    assert.equal(created, 0);
    assert.equal(chats.length, 1);
    assert.equal(chats[0].id, '123');
    assert.equal(chats[0].nickname, 'Owner Ad');
    assert.equal(audience.snapshot().active.right.id, '123');
    assert.deepEqual(gifts.map(event => [event.repeatCount, event.coinUnit, event.isDelta, event.streakId]),
      [[1, 8, true, ''], [3, 8, true, '']]);
    await timers.tick();
    assert.match(routes.at(-1), /after=8/);
    assert.equal(gifts.length, 2);
    assert.equal(chats.length, 1);
  } finally { controller.close(); }
  assert.equal(timers.pending.size, 0);
});

test('normal live callbacks feed AudienceQueue: frozen pair, coin priority, streak deltas and active-only actions', async () => {
  const actions = [];
  const audience = new AudienceQueue({ settings: { punchGiftId: 'all-gift', chatPunches: true }, onPunch: action => actions.push(action) });
  const connection = new FakeConnection();
  const live = createHediyeBoxLive({ env: {}, onChat: event => audience.ingestChat(event), onGiftRaw: event => audience.ingestGift(event),
    shared: { ...sharedModules(), detectOwner: async () => [] }, createConnection: async () => connection,
  });
  const user = id => ({ id, uniqueId: `user${id}`, nickname: `Person ${id}` });
  try {
    await live.start('tester');
    for (const id of ['11', '22', '33', '44']) connection.emit('chat', { msgId: `join-${id}`, comment: 'katıl', user: user(id) });
    assert.equal(audience.snapshot().phase, 'staging');
    audience.startRound();
    for (const [msgId, repeatCount] of [['one', 1], ['more', 5], ['final', 5]]) {
      connection.emit('gift', gift({ msgId, repeatCount, repeatEnd: msgId === 'final', giftId: 'all-gift', diamondCount: 6, user: user('44') }));
    }
    assert.equal(audience.snapshot().queue[0].id, '44');
    assert.equal(audience.snapshot().queue[0].coins, 30);
    assert.equal(audience.snapshot().active.right.id, '11');
    assert.equal(actions.length, 0);
    connection.emit('chat', { msgId: 'active-b', comment: 'B', user: user('22') });
    connection.emit('chat', { msgId: 'active-b', comment: 'B', user: user('22') });
    connection.emit('gift', gift({ msgId: 'punch', giftId: 'all-gift', groupId: 'fighter', repeatCount: 5, user: user('11'), diamondCount: 6 }));
    assert.deepEqual(actions.map(action => [action.side, action.action, action.count]), [['right', 'A', 5]]);
    audience.finishRound();
    assert.equal(audience.snapshot().active.right.id, '11');
    assert.equal(audience.startRound().active.right.id, '44');
  } finally { live.close(); }
});

test('generic callback mutation cannot alter legacy gift processing', async () => {
  const match = new HediyeBoxMatch();
  const connection = new FakeConnection();
  const live = createHediyeBoxLive({ match, env: {}, onGiftRaw: event => { event.repeatCount = 900; event.profilePictureUrls.push('mutated'); },
    shared: { ...sharedModules(), detectOwner: async () => [] }, createConnection: async () => connection,
  });
  try {
    await live.start('tester'); connection.emit('gift', gift());
    assert.equal(match.snapshot().sides.left.pendingPunches, 1);
    assert.equal(match.snapshot().sides.left.leader.profilePictureUrls.includes('mutated'), false);
  } finally { live.close(); }
});

test('live likes normalize packet deltas and profiles on one socket, dropping initial and room total snapshots', async () => {
  const actions = [], likes = [];
  const audience = new AudienceQueue({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: 10, likePunchCount: 1 }, onPunch: action => actions.push(action) });
  const user = { id: '9007199254740993', uniqueId: 'fighter', nickname: 'Red fighter',
    avatarLarge: { urlList: ['https://cdn.example/large'] } };
  audience.ingestChat({ id: user.id, eventId: 'red-join', comment: 'katıl' });
  audience.ingestChat({ id: 'other', eventId: 'blue-join', comment: 'katıl' }); audience.startRound();
  class InitialConnection extends FakeConnection {
    async connect() {
      this.emit('like', { msgId: 'initial', user, likeCount: 5000 });
      return super.connect();
    }
  }
  const connection = new InitialConnection(); let created = 0;
  const live = createHediyeBoxLive({ env: {}, onLike: event => { likes.push(event); audience.ingestLike(event); },
    shared: { ...sharedModules(), detectOwner: async () => [] },
    createConnection: async () => { created++; return connection; },
  });
  try {
    await live.start('tester');
    assert.equal(likes.length, 0);
    connection.emit('like', { msgId: 'room-total', user, totalLikeCount: 100000 });
    connection.emit('like', { msgId: 'initial-tagged', user, likeCount: 1000, isInitial: true });
    connection.emit('like', { msgId: 'no-count', user });
    connection.emit('like', { user, likeCount: 10 });
    connection.emit('like', { msgId: 'invalid', user, likeCount: -1 });
    assert.equal(likes.length, 0);
    const packet = { msgId: 'delta-6', user, likeCount: 6, totalLikeCount: 100000 };
    connection.emit('like', packet); connection.emit('like', packet);
    connection.emit('like', { msgId: 'delta-4', user, count: 4 });
    assert.equal(likes.length, 3);
    assert.equal(likes[0].eventId, likes[1].eventId);
    assert.equal(likes[0].id, user.id);
    assert.equal(likes[0].isDelta, true);
    assert.equal(likes[0].likeCount, 6);
    assert.equal(likes[0].portrait, 'https://cdn.example/large');
    assert.equal(likes[0].nickname, 'Red fighter');
    assert.equal(likes[0].uniqueId, 'fighter');
    assert.deepEqual(actions.map(action => [action.source, action.side, action.count, action.userId]),
      [['like', 'right', 1, user.id]]);
    await live.start('@tester');
    assert.equal(created, 1);
    assert.equal(connection.listenerCount('like'), 1);
  } finally { live.close(); }
  connection.emit('like', { msgId: 'late', user, likeCount: 100 });
  assert.equal(likes.length, 3);
  assert.equal(connection.listenerCount('like'), 0);
});

test('owner likes drain every initial journal page, then deliver idempotent fighter deltas without an SDK socket', async () => {
  const tasks = new Set(), likes = [], actions = [], routes = []; let created = 0, page = 0;
  const timers = { setTimeout(fn) { tasks.add(fn); return fn; }, clearTimeout(fn) { tasks.delete(fn); } };
  const audience = new AudienceQueue({ kingOfRing: true, settings: { punchSource: 'like', likeThreshold: 10, likePunchCount: 1 }, onPunch: action => actions.push(action) });
  audience.ingestChat({ id: '123', eventId: 'red-join', comment: 'katıl' });
  audience.ingestChat({ id: '456', eventId: 'blue-join', comment: 'katıl' }); audience.startRound();
  const row = (seq, count, eventId = `like-${seq}`) => ({ seq, value: {
    type: 'like', eventId, userId: '123', username: 'fighter', nickname: 'Owner fighter', likeCount: count,
  } });
  const pages = [Array.from({ length: 250 }, (_, i) => row(i + 1, 1000)), [row(251, 1000)],
    [row(252, 3), row(253, 7)], [row(254, 7, 'like-253')]];
  const live = createHediyeBoxLive({ env: {}, timers, onLike: event => { likes.push(event); audience.ingestLike(event); },
    createConnection: async () => { created++; return new FakeConnection(); },
    shared: { ...sharedModules(), ownerFromEnvironment: () => ({ kind: 'owner', url: 'http://127.0.0.1:1', token: 'test-only' }),
      requestJSON: async (_base, route) => {
        routes.push(route);
        return route === '/connect' ? {} : { schemaVersion: 1, sessionId: 'owner-likes',
          status: { status: 'connected', username: 'tester' }, events: pages[page++] || [] };
      },
    },
  });
  const poll = async () => {
    const task = [...tasks][0]; assert.equal(typeof task, 'function'); tasks.delete(task); task();
    await new Promise(resolve => setImmediate(resolve));
  };
  try {
    await live.start('tester'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(likes.length, 0);
    await poll(); assert.equal(likes.length, 0);
    assert.match(routes.at(-1), /after=250/);
    await poll();
    assert.match(routes.at(-1), /after=251/);
    assert.deepEqual(likes.map(event => [event.likeCount, event.isDelta, event.id]), [[3, true, '123'], [7, true, '123']]);
    assert.equal(likes[0].nickname, 'Owner fighter');
    assert.equal(actions.length, 1);
    await poll();
    assert.equal(likes.length, 3);
    assert.equal(actions.length, 1);
    assert.equal(created, 0);
    assert.equal(live.status().status, 'connected');
  } finally { live.close(); }
  assert.equal(tasks.size, 0);
});

test('Forza owner uses the same normalized like callback and initial history protection', async () => {
  const tasks = new Set(), likes = []; let page = 0;
  const timers = { setTimeout(fn) { tasks.add(fn); return fn; }, clearTimeout(fn) { tasks.delete(fn); } };
  const row = seq => ({ seq, value: { type: 'like', eventId: `forza-${seq}`, username: 'fighter', likeCount: 10 } });
  const pages = [Array.from({ length: 100 }, (_, i) => row(i + 1)), [], [row(101)]];
  const live = createHediyeBoxLive({ env: {}, timers, onLike: event => likes.push(event),
    createConnection: async () => { throw new Error('Must never create SDK connection'); },
    shared: { ...sharedModules(), ownerFromEnvironment: () => ({ kind: 'forza', url: 'http://127.0.0.1:1', token: 'test-only' }),
      requestJSON: async (_base, route) => {
        assert.match(route, /^\/poll\?/);
        return { schemaVersion: 1, status: { status: 'connected', username: 'tester' }, events: pages[page++] || [] };
      },
    },
  });
  try {
    await live.start('tester'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(likes.length, 0);
    for (let i = 0; i < 2; i++) {
      const task = [...tasks][0]; tasks.delete(task); task(); await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(likes.length, 1);
    assert.equal(likes[0].id, 'fighter');
    assert.equal(likes[0].likeCount, 10);
    assert.equal(likes[0].isDelta, true);
  } finally { live.close(); }
});
