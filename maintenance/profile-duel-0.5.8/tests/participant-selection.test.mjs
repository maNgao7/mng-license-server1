import test from 'node:test';
import assert from 'node:assert/strict';
import { createLauncherServer } from '../src/server.mjs';

test('shared participants are selectable on either side without changing the feed owner', async () => {
  let receive;
  const host = await createLauncherServer({ channel: 'broadcaster', subscribeSharedEvents: fn => { receive = fn; return () => {}; },
    getParticipants: () => [{ username: 'leftviewer', nickname: 'Sol' }],
    getCachedProfile: username => ({ username, nickname: username, avatarUrl: `/api/portrait?username=${username}` }) });
  try {
    const key = new URL(host.controlUrl).searchParams.get('key');
    const post = (route, body) => fetch(`${host.baseUrl}/api/live/${route}?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    receive('chat', { username: 'rightviewer' }, { source: 'live', channel: 'broadcaster' });
    receive('chat', { username: 'foreign' }, { source: 'live', channel: 'other' });
    assert.equal((await fetch(`${host.baseUrl}/api/participants`)).status, 403);
    const list = await fetch(`${host.baseUrl}/api/participants?key=${key}`).then(r => r.json());
    assert.deepEqual(list.participants.map(p => p.username).sort(), ['broadcaster', 'leftviewer', 'rightviewer']);
    assert.equal((await post('start', { left: 'leftviewer', opponent: 'leftviewer' })).status, 409);
    assert.equal((await post('start', { left: 'leftviewer', opponent: 'rightviewer', durationSeconds: 60 })).status, 200);
    assert.equal((await post('start', { left: 'rightviewer', opponent: 'leftviewer' })).status, 409);
    const gift = { eventId: 'rose-one', username: 'donor', giftId: '5655', coins: 20 };
    receive('gift', gift, { source: 'live', channel: 'broadcaster' });
    receive('gift', gift, { source: 'live', channel: 'broadcaster' });
    receive('gift', { ...gift, eventId: 'wrong-room' }, { source: 'live', channel: 'other' });
    const state = await fetch(`${host.baseUrl}/api/state`).then(r => r.json());
    assert.equal(state.owner.username, 'leftviewer'); assert.equal(state.opponent.username, 'rightviewer');
    assert.deepEqual(state.scores, { left: 20, right: 0 });
  } finally { await host.close(); }
});

test('administrator synthetic test route consumes the gift body once', async () => {
  const host = await createLauncherServer({channel:'host',subscribeSharedEvents:()=>()=>{},allowSyntheticTest:true});
  try {
    const key = new URL(host.controlUrl).searchParams.get('key');
    const post = (route,body)=>fetch(`${host.baseUrl}/api/live/${route}?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    await post('start',{opponent:'guest'});
    const gift={eventId:'test-event-once',giftId:'5269',coins:50};
    await post('test-event',gift);await post('test-event',gift);
    const state=await fetch(`${host.baseUrl}/api/state`).then(r=>r.json());
    assert.deepEqual(state.scores,{left:0,right:50});
  } finally {await host.close();}
});

test('switching a test account leaves both sides empty and carries the current gift settings', async () => {
  const calls=[];
  let saved;
  const host=await createLauncherServer({channel:'initial',autoSelectOwner:false,connectLive:async username=>{calls.push(username);return {status:'connected',username};},
    subscribeSharedEvents:()=>()=>{},getCachedProfile:username=>({username,nickname:'HD '+username,avatarUrl:'/portrait.png'}),
    getGiftCatalog:()=>[{id:'1200',coins:9}],onGiftConfig:config=>{saved=config;}});
  try{
    const key=new URL(host.controlUrl).searchParams.get('key');
    const post=(route,body)=>fetch(host.baseUrl+'/api/live/'+route+'?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(host.getBroadcastState().owner,null);
    const config={roseGiftIds:['1200'],roseGiftLabel:'Alkış',rosePointsPerGift:50,tiktokPointsPerGift:100};
    assert.equal((await post('settings',config)).status,200);
    for (const invalid of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'50',true]) {
      assert.equal((await post('settings',{...config,rosePointsPerGift:invalid})).status,400);
    }
    assert.equal((await post('player',{side:'left',username:'initial'})).status,200);
    assert.equal((await post('player',{side:'right',username:'guest'})).status,200);
    const response=await post('connect',{username:'@test_yayini'});
    assert.equal(response.status,200);const body=await response.json();
    assert.deepEqual(calls,['test_yayini']);assert.equal(body.owner.nickname,'HD test_yayini');assert.equal(body.snapshot.owner,null);
    assert.equal(body.snapshot.opponent,null);
    assert.equal(host.getChannel(),'test_yayini');
    assert.deepEqual(body.snapshot.giftConfig,saved);
    assert.equal(saved.rosePointsPerGift,50);
    assert.equal(saved.tiktokPointsPerGift,100);
    assert.equal(saved.roseUnitCoins,9);
  }finally{await host.close();}
});

test('a pending publisher hides the placeholder and accepts events only for the explicitly connected account', async t => {
  const subscribeSharedEvents = listener => {
    receive = listener;
    return () => { receive = null; };
  };
  let receive;
  await assert.rejects(createLauncherServer({ subscribeSharedEvents }), /Geçerli yayıncı profili gerekli/);
  await assert.rejects(createLauncherServer({ channel: 'invalid name', subscribeSharedEvents }), /Geçerli yayıncı profili gerekli/);
  const host = await createLauncherServer({
    subscribeSharedEvents, connectLive: async username => ({ status: 'connected', username }),
    getParticipants: () => [{ username: 'previous-room-viewer' }],
  });
  t.after(() => host.close());
  const key = new URL(host.controlUrl).searchParams.get('key');
  const get = route => fetch(`${host.baseUrl}/api/${route}?key=${key}`).then(response => response.json());
  const post = (route, body) => fetch(`${host.baseUrl}/api/live/${route}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal(host.getChannel(), '');
  assert.equal(host.getBroadcastState().phase, 'idle');
  assert.equal(host.getBroadcastState().owner, null);
  assert.equal(host.getBroadcastState().opponent, null);
  receive('gift', { eventId: 'idle-gift', giftId: '5655', coins: 1 }, { source: 'live', channel: 'tikmng_no_channel' });
  const meta = await get('meta');
  assert.equal(meta.owner, null);
  assert.equal(meta.diagnostics.gifts, 0);
  assert.equal(meta.broadcastUrlSupported, false);
  assert.deepEqual(await get('participants'), { participants: [] });
  assert.equal((await post('start', { left: 'p1', opponent: 'p2' })).status, 409);

  assert.equal((await post('connect', { username: '@test_yayini' })).status, 200);
  assert.equal(host.getChannel(), 'test_yayini');
  assert.equal(host.getBroadcastState().owner, null);
  assert.equal(host.getBroadcastState().opponent, null);
  assert.equal((await post('settings', { rosePointsPerGift: 50, tiktokPointsPerGift: 100 })).status, 200);
  assert.equal((await post('start', { left: 'p1', opponent: 'p2' })).status, 200);
  const gift = { eventId: 'real-shape-gift', giftId: '5655', coins: 2, repeatCount: 2, giftType: 1, repeatEnd: true };
  receive('gift', gift, { source: 'live', channel: 'previous-room' });
  receive('gift', gift, { source: 'test', channel: 'test_yayini' });
  assert.deepEqual(host.getBroadcastState().scores, { left: 0, right: 0 });
  receive('gift', gift, { source: 'live', channel: 'test_yayini' });
  receive('gift', gift, { source: 'live', channel: 'test_yayini' });
  assert.deepEqual(host.getBroadcastState().scores, { left: 100, right: 0 });
  assert.deepEqual(host.getBroadcastState(), await get('state'));

  assert.equal((await post('reset', {})).status, 200);
  assert.equal((await post('connect', { username: 'second' })).status, 200);
  assert.equal((await post('start', { left: 'p1', opponent: 'p2' })).status, 200);
  receive('gift', gift, { source: 'live', channel: 'second' });
  assert.deepEqual(host.getBroadcastState().scores, { left: 100, right: 0 }, 'Gift IDs are scoped to the connected account');
  assert.equal((await post('reset', {})).status, 200);
  assert.equal((await post('connect', { username: 'test_yayini' })).status, 200);
  assert.equal((await post('start', { left: 'p1', opponent: 'p2' })).status, 200);
  receive('gift', gift, { source: 'live', channel: 'test_yayini' });
  assert.deepEqual(host.getBroadcastState().scores, { left: 0, right: 0 }, 'An earlier gift cannot score again after reconnect');
});
