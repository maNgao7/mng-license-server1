'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { createOfflineRuntime, closeOffline, applyPitch } = require('../lib/offline-speech.cjs');
const worker = path.join(__dirname, 'fixtures/offline-protocol-worker.cjs');

function fixture(t, options) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-offline-runtime-'));
    const runtime = createOfflineRuntime(options);
    t.after(async () => { await runtime.closeOffline(); fs.rmSync(root, { recursive: true, force: true }); });
    const run = (text = 'hello', settings = {}, extra = {}) => runtime.runOffline(root, { text, rate: 1, pitchFactor: 1, ...settings }, { worker, timeoutMs: 5000, ...extra });
    return { root, runtime, run };
}
const info = audio => JSON.parse(audio.subarray(44).toString());
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function waitForJobs(root, count) {
    for (let i = 0; i < 400; i++) {
        const file = path.join(root, 'jobs.jsonl');
        if (fs.existsSync(file)) {
            const jobs = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
            if (jobs.length >= count) return jobs;
        }
        await delay(5);
    }
    throw Error('Worker did not receive job');
}

test('reuses a process, serializes concurrent jobs, and resets request settings', async t => {
    const { run } = fixture(t);
    const first = info(await run('split', { rate: 1.5, pitchFactor: 1.25, seed: 7, pause: 2, temperature: 0.5 }));
    const [second, third] = (await Promise.all([run('slow-one'), run('hello')])).map(info);
    assert.equal(first.pid, second.pid);
    assert.equal(second.pid, third.pid);
    assert.deepEqual([first.sequence, second.sequence, third.sequence], [1, 2, 3]);
    assert.equal(first.speed, 1.2);
    assert.deepEqual([third.speed, third.seed, third.pause, third.temperature], [1, 0, 1, 1]);
});

test('isolates pack roots, worker paths, and independent runtimes', async t => {
    const { root, runtime, run } = fixture(t);
    const other = path.join(root, 'second-pack'); fs.mkdirSync(other);
    const first = info(await run());
    const second = info(await runtime.runOffline(other, { text: 'hello' }, { worker }));
    assert.notEqual(first.pid, second.pid);
    assert.equal(first.root, root);
    assert.equal(second.root, other);
    const copy = path.join(root, 'other-worker.cjs'); fs.copyFileSync(worker, copy);
    const third = info(await run('hello', {}, { worker: copy }));
    assert.notEqual(third.pid, first.pid);
    assert.notEqual(third.pid, second.pid);
    assert.equal(alive(first.pid), false, 'LRU idle process was not reaped');
    const independent = fixture(t);
    const fourth = info(await independent.run());
    await runtime.closeOffline();
    assert.equal(alive(fourth.pid), true);
    assert.equal(info(await independent.run()).pid, fourth.pid);
});

test('cancel of an active job kills its worker, preserves another pack, and restarts queued work', async t => {
    const { root, runtime, run } = fixture(t);
    const other = path.join(root, 'second-pack'); fs.mkdirSync(other);
    const retained = info(await runtime.runOffline(other, { text: 'hello' }, { worker }));
    const signal = new AbortController();
    const active = assert.rejects(run('hang', {}, { signal: signal.signal }), { code: 'SPEECH_CANCELLED' });
    const [{ pid }] = await waitForJobs(root, 1);
    const next = run();
    signal.abort();
    await active;
    const replacement = info(await next);
    assert.notEqual(replacement.pid, pid);
    assert.equal(alive(pid), false);
    assert.equal(info(await runtime.runOffline(other, { text: 'hello' }, { worker })).pid, retained.pid);
});

test('queued abort, queued timeout and already-aborted signals do not kill active inference', async t => {
    const { root, run } = fixture(t, { maxWorkers: 1 });
    const active = run('slow-one');
    const [{ pid }] = await waitForJobs(root, 1);
    const abort = new AbortController();
    const queued = assert.rejects(run('unused', {}, { signal: abort.signal }), { code: 'SPEECH_CANCELLED' });
    abort.abort();
    await queued;
    await assert.rejects(run('unused-timeout', {}, { timeoutMs: 15 }), { code: 'OFFLINE_TIMEOUT' });
    await assert.rejects(run('unused-abort', {}, { signal: abort.signal }), { code: 'SPEECH_CANCELLED' });
    assert.equal(info(await active).pid, pid);
    assert.equal(info(await run()).pid, pid);
    assert.equal((await waitForJobs(root, 2)).length, 2);
});

test('active timeout retires only its worker and queued work recovers', async t => {
    const { root, runtime, run } = fixture(t);
    const other = path.join(root, 'second-pack'); fs.mkdirSync(other);
    const retained = info(await runtime.runOffline(other, { text: 'hello' }, { worker }));
    const timedOut = assert.rejects(run('hang', {}, { timeoutMs: 500 }), { code: 'OFFLINE_TIMEOUT' });
    const [{ pid }] = await waitForJobs(root, 1);
    const next = run();
    await timedOut;
    assert.notEqual(info(await next).pid, pid);
    assert.equal(alive(pid), false);
    assert.equal(info(await runtime.runOffline(other, { text: 'hello' }, { worker })).pid, retained.pid);
});

for (const text of ['error', 'exit', 'bad-json', 'wrong-id', 'bad-audio', 'overflow', 'stderr']) {
    test('sanitizes ' + text + ' and recovers on a new worker', async t => {
        const { root, run } = fixture(t, { maxWorkers: 1 });
        await assert.rejects(run(text), error => {
            assert.equal(error.code, 'OFFLINE_UNAVAILABLE');
            assert.ok(!error.message.includes('private'));
            assert.ok(!error.message.includes(root));
            return true;
        });
        const jobs = await waitForJobs(root, 1);
        const replacement = info(await run());
        assert.notEqual(replacement.pid, jobs[0].pid);
        assert.equal(alive(jobs[0].pid), false);
    });
}

test('spawn errors are sanitized and do not prevent future jobs', async t => {
    const { root, run } = fixture(t, { maxWorkers: 1 });
    await assert.rejects(run('hello', {}, { worker: path.join(root, 'not-found.cjs') }), { code: 'OFFLINE_UNAVAILABLE' });
    assert.ok(info(await run()).pid);
});

test('bounds waiting jobs and validates input before spawning', async t => {
    const { root, run } = fixture(t, { maxWorkers: 1, maxQueue: 1 });
    for (const settings of [{ text: 'x'.repeat(8193) }, { text: '' }, { rate: Infinity }, { pitchFactor: 0 }, { rate: 0.001 }, { seed: -1 }]) {
        await assert.rejects(run('hello', settings), error => ['INVALID_TEXT', 'INVALID_INPUT'].includes(error.code));
    }
    assert.ok(!fs.existsSync(path.join(root, 'jobs.jsonl')));
    const active = run('slow-one');
    const queued = run();
    await assert.rejects(run(), { code: 'OFFLINE_BUSY' });
    const results = (await Promise.all([active, queued])).map(info);
    assert.equal(results[0].pid, results[1].pid);
});

test('reaps idle workers; close cancels active and queued jobs, awaits children, and is reusable', async t => {
    const { root, runtime, run } = fixture(t, { maxWorkers: 1, idleMs: 25 });
    const first = info(await run());
    for (let i = 0; i < 100 && alive(first.pid); i++) await delay(10);
    assert.equal(alive(first.pid), false);
    const active = assert.rejects(run('hang'), { code: 'SPEECH_CANCELLED' });
    const jobs = await waitForJobs(root, 2);
    const queued = assert.rejects(run(), { code: 'SPEECH_CANCELLED' });
    await runtime.closeOffline();
    await Promise.all([active, queued, runtime.closeOffline()]);
    assert.equal(alive(jobs[1].pid), false);
    assert.notEqual(info(await run()).pid, first.pid);
    assert.equal(typeof closeOffline, 'function');
    await closeOffline();
});

test('idle children cannot outlive a parent that exits normally', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-offline-parent-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const script = `require(${JSON.stringify(path.resolve(__dirname, '../lib/offline-speech.cjs'))}).runOffline(${JSON.stringify(root)}, {text:'hello'}, {worker:${JSON.stringify(worker)}}).then(audio=>console.log(JSON.parse(audio.subarray(44)).pid));`;
    const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(() => child.kill('SIGKILL'));
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.resume();
    const exited = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Idle worker kept its parent alive')); }, 5000);
        child.on('error', reject);
        child.on('close', code => { clearTimeout(timer); resolve(code); });
    });
    assert.equal(exited, 0);
    const pid = Number(output.trim()); assert.ok(pid > 0);
    for (let i = 0; i < 100 && alive(pid); i++) await delay(10);
    assert.equal(alive(pid), false);
});

test('preserves applyPitch buffer copying and invalid-audio behavior', async t => {
    const { run } = fixture(t);
    const audio = await run();
    const pitched = applyPitch(audio, 1.25);
    assert.equal(audio.readUInt32LE(24), 48000);
    assert.equal(pitched.readUInt32LE(24), 60000);
    assert.equal(pitched.readUInt32LE(28), 120000);
    assert.throws(() => applyPitch(Buffer.alloc(44), 1), { code: 'INVALID_AUDIO' });
});
