'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { test } = require('node:test');
const stage = path.resolve(process.env.FORZA_QA_LAUNCHER);
const fastCheck = require('../../profile-duel-release-0.1.0/node_modules/fast-check');
const { acquireForzaLaunchLock } = require(path.join(stage, 'lib/forza-launch-lock.cjs'));
const { createForzaPublisher } = require(path.join(stage, 'lib/forza-publisher.cjs'));
const { createSharedGameEvents } = require(path.join(stage, 'lib/shared-game-events.cjs'));
const identity = value => value;
const check = () => {};

test('Windows launch lock survives abnormal exit and preserves exclusive startup', async () => {
    const dir = await fs.mkdtemp(path.join(path.dirname(stage), 'launch-lock-test-'));
    const lock = path.join(dir, '.launch-lock');
    let release, holder;
    try {
        const exited = spawnSync(process.execPath, ['-e', '']);
        assert.equal(exited.status, 0);
        await fs.writeFile(lock, JSON.stringify({ schemaVersion: 1, pid: exited.pid }));
        release = await acquireForzaLaunchLock(dir, identity, check);
        await assert.rejects(acquireForzaLaunchLock(dir, identity, check), /başlatılıyor/);
        await release();
        await assert.rejects(fs.access(lock), { code: 'ENOENT' });

        holder = spawn(process.execPath, ['-e',
            "require(process.argv[1]).acquireForzaLaunchLock(process.argv[2], p=>p, ()=>{}).then(()=>console.log('locked'))",
            path.join(stage, 'lib/forza-launch-lock.cjs'), dir], { windowsHide: true });
        const output = await once(holder.stdout, 'data');
        assert.match(String(output[0]), /locked/);
        await assert.rejects(acquireForzaLaunchLock(dir, identity, check), /başlatılıyor/);
        const exit = once(holder, 'exit');
        holder.kill();
        await exit;
        release = await acquireForzaLaunchLock(dir, identity, check);
        await release();

        await fs.writeFile(lock, '');
        const stale = new Date(Date.now() - 30_000);
        await fs.utimes(lock, stale, stale);
        await assert.rejects(acquireForzaLaunchLock(dir, identity, () => { throw Error('real game open'); }), /real game open/);
        release = await acquireForzaLaunchLock(dir, identity, check);
        await release();
    } finally {
        if (holder?.exitCode === null && !holder.killed) holder.kill();
        if (release) await release();
        await fs.rm(lock, { force: true });
        await fs.rmdir(dir);
    }
});

test('gift streak progress reaches Forza before the final event and replays award no additional coins', async () => {
    const events = createSharedGameEvents();
    const feed = await createForzaPublisher({ events, getChannel: () => 'qa', getStatus: () => ({ status: 'connected' }),
        username: 'qa', directory: stage });
    let cursor = 0, group = 0;
    const publish = (type, data) => events.publish(type, data, { channel: 'qa', source: 'live' });
    async function poll() {
        const response = await fetch(feed.url + '/poll?username=qa&after=' + cursor, {
            headers: { Authorization: 'Bearer ' + feed.token },
        });
        assert.equal(response.status, 200);
        const { events: batch } = await response.json();
        cursor = batch.at(-1)?.seq ?? cursor;
        return batch.map(row => row.value);
    }
    try {
        await fastCheck.assert(fastCheck.asyncProperty(fastCheck.array(fastCheck.integer({ min: 1, max: 24 }),
            { minLength: 2, maxLength: 20 }), async counts => {
            const gift = { username: 'driver', groupId: 'combo-' + ++group, giftId: '5879', giftType: 1, unitCoins: 5 };
            const first = counts[0];
            publish('forza-gift-progress', { ...gift, repeatCount: first, repeatEnd: false });
            const firstPacket = await poll();
            assert.equal(firstPacket[0]?.repeatCount, first);
            for (const count of counts) publish('forza-gift-progress', { ...gift, repeatCount: count, repeatEnd: false });
            const final = Math.max(...counts);
            publish('gift', { ...gift, repeatCount: final, repeatEnd: true });
            publish('gift', { ...gift, repeatCount: final, repeatEnd: true });
            publish('like', { username: 'driver', eventId: 'like-' + group, like_count: 100 });
            const batch = await poll();
            const allGifts = [...firstPacket, ...batch].filter(e => e.type === 'gift');
            assert.equal(allGifts.reduce((sum, e) => sum + e.coins * e.repeatCount, 0), final * 5);
            assert.equal(new Set(allGifts.map(e => e.eventId)).size, allGifts.length);
            assert.equal(batch.find(e => e.type === 'like')?.likeCount, 100);
        }), { numRuns: 35 });
    } finally { await feed.close(); events.close(); }
});

test('room counters identify ID-less likes without awarding the room total or counting a replay', async () => {
    const events = createSharedGameEvents();
    const feed = await createForzaPublisher({ events, getChannel: () => 'qa',
        getStatus: () => ({ status: 'connected', roomId: '901' }), directory: stage });
    const meta = { channel: 'qa', source: 'live' };
    try {
        const likes = { user: { displayId: 'viewer' }, count: 100, common: { msgId: '0' } };
        for (const total of ['1200', '1300', '1300', '1400']) {
            events.publish('forza-like', { ...likes, total }, meta);
        }
        events.publish('like', { username: 'viewer', likeCount: 100, eventId: 'widget', forzaRawLike: true }, meta);
        events.publish('forza-like', { user: { displayId: 'someone' }, total: '8000' }, meta);
        const response = await fetch(feed.url + '/poll?username=qa&after=0',
            { headers: { Authorization: 'Bearer ' + feed.token } });
        const { events: batch } = await response.json();
        assert.deepEqual(batch.map(({value}) => [value.username, value.likeCount]),
            [['viewer',100],['viewer',100],['viewer',100]]);
    } finally { await feed.close(); events.close(); }
});

test('a portrait arriving during lookup is retried without replaying the speed reward', async () => {
    const events = createSharedGameEvents();
    const directory = await fs.mkdtemp(path.join(path.dirname(stage), 'portrait-retry-'));
    let release, started;
    const lookupStarted = new Promise(resolve => { started = resolve; });
    const first = new Promise(resolve => { release = resolve; });
    const image = await fs.readFile(path.resolve(__dirname,'../assets/logo.png'));
    const feed = await createForzaPublisher({ events, getChannel: () => 'qa',
        getStatus: () => ({ status: 'connected' }), directory, portrait: async (_name, payload) => {
            if (payload.avatar) return image;
            started();
            await first;
            return null;
        } });
    const meta = { channel: 'qa', source: 'live' };
    try {
        events.publish('gift', { username: 'viewer', eventId: 'first', coins: 5 }, meta);
        await lookupStarted;
        events.publish('like', { username: 'viewer', eventId: 'next', likeCount: 100, avatar: 'new-url' }, meta);
        release();
        const poll = after => fetch(feed.url + '/poll?username=qa&after=' + after,
            { headers: { Authorization: 'Bearer ' + feed.token } }).then(response => response.json());
        const { events: firstBatch } = await poll(0);
        assert.deepEqual(firstBatch.map(({value}) => value.type), ['gift','like']);
        const { events: secondBatch } = await poll(firstBatch.at(-1).seq);
        assert.equal(secondBatch.length, 1);
        assert.equal(secondBatch[0].value.type, 'avatar');
        assert.deepEqual(await fs.readFile(path.join(directory,'control/live/portraits',secondBatch[0].value.avatarFile)),image);
    } finally {
        release();
        await feed.close();
        events.close();
        const resolved = await fs.realpath(directory);
        assert.equal(path.dirname(resolved),await fs.realpath(path.dirname(stage)));
        assert.match(path.basename(resolved),/^portrait-retry-/);
        await fs.rm(resolved,{recursive:true,force:true});
    }
});
