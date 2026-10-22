'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const sourcePath = path.resolve(__dirname, '../lib/chatterbox-runtime.cjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const model = vm.runInNewContext(source.match(/const MODEL = (Object.freeze\([\s\S]*?\));/)[1]);
const ids = ['d2-00331', 'd2-00919', 'd1-00525', 'd1-02311', 'd1-02057', 'd2-00703', 'd1-01027', 'd1-00884', 'd1-00781', 'd1-00727'];
const names = ['Ece', 'Mert', 'Ada', 'Efe', 'Derya', 'Arda', 'Neva', 'Bora', 'Beste', 'Usta'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));
const speak = { text: 'Merhaba, yayına hoş geldin.', voiceURI: 'chatterbox:d2-00331', rate: 1 };
function wav() {
    const b = Buffer.alloc(48); b.write('RIFF'); b.writeUInt32LE(40, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(4, 40); return b;
}
function fakeWorker(options = {}) {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.messages = []; child.kills = 0;
    child.respond = (request, patch = {}) => child.stdout.write(JSON.stringify({ v: 1, id: request.id,
        type: request.type === 'init' ? 'ready' : 'audio', ...(request.type === 'init' ? {} : { audioBase64: wav().toString('base64'), mimeType: 'audio/wav' }), ...patch }) + '\n');
    child.stdin = new Writable({ write(chunk, _encoding, done) {
        const request = JSON.parse(chunk); child.messages.push(request);
        if (options.onRequest) options.onRequest(child, request);
        else setImmediate(() => child.respond(request));
        done();
    } });
    child.kill = () => { child.kills++; setImmediate(() => child.emit('close', 1)); return true; };
    return child;
}

function fixture(t, options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-chatterbox-unit-'));
    fs.mkdirSync(path.join(root, 'runtime')); fs.mkdirSync(path.join(root, 'model-v3')); fs.mkdirSync(path.join(root, 'references'));
    fs.writeFileSync(path.join(root, 'runtime/python.exe'), 'test-python-not-executable');
    const worker = path.join(root, 'test-worker.py'); fs.writeFileSync(worker, '# inert test worker');
    const runtimeFiles = [{ path: 'runtime/python.exe', bytes: 26, sha256: hash('test-python-not-executable') }];
    const runtimeManifest = JSON.stringify({ schemaVersion: 1, offlineImportsVerified: true, files: runtimeFiles });
    fs.writeFileSync(path.join(root, 'runtime-manifest.json'), runtimeManifest);
    const manifest = { repo: 'ResembleAI/chatterbox', revision: '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18',
        files: Object.entries(model).map(([name, [bytes, sha256]]) => ({ name, bytes, sha256 })) };
    fs.writeFileSync(path.join(root, 'model-v3/tikmng-model-manifest.json'), JSON.stringify(manifest));
    for (const name of Object.keys(model)) fs.writeFileSync(path.join(root, 'model-v3', name), 'MODEL:' + name);
    const references = { voices: ids.map((id, index) => {
        const data = Buffer.from(('reference-' + id).padEnd(60, '.'));
        fs.writeFileSync(path.join(root, 'references', id + '.flac'), data);
        return { id, name: names[index], gender: index % 2 ? 'male' : 'female', file: id + '.flac', bytes: data.length, sha256: hash(data) };
    }) };
    fs.writeFileSync(path.join(root, 'references/manifest.json'), JSON.stringify(references));
    const spawned = [], spawnCalls = [];
    // Only multi-gigabyte pinned weights are virtualized. References/runtime files,
    // integrity failures, path checks and HTTP-independent worker protocol are real.
    const fakeFs = { ...fs, promises: { ...fs.promises, async lstat(file) {
        const stat = await fs.promises.lstat(file), entry = model[path.basename(file)];
        if (path.dirname(file) === path.join(root, 'model-v3') && entry) stat.size = entry[0];
        return stat;
    } } };
    const fakeCrypto = { ...crypto, createHash(algorithm) {
        const real = crypto.createHash(algorithm), chunks = [];
        return { update(data) { chunks.push(Buffer.from(data)); real.update(data); return this; }, digest(encoding) {
            const value = Buffer.concat(chunks).toString();
            if (value.startsWith('MODEL:') && model[value.slice(6)]) return model[value.slice(6)][1];
            return real.digest(encoding);
        } };
    } };
    const code = options.untrusted ? source : source.replace(/const TRUSTED_RUNTIME_MANIFESTS = new Set\(\[[\s\S]*?\]\);/,
        `const TRUSTED_RUNTIME_MANIFESTS = new Set(['${hash(runtimeManifest)}']);`);
    const loaded = { exports: {} };
    const wrapper = vm.runInNewContext('(function(require,module,exports,__dirname){' + code + '\n})', {
        Buffer, process, setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args)
    });
    const clock = { value: 0 };
    wrapper(name => name === 'node:fs' ? fakeFs : name === 'node:crypto' ? fakeCrypto
        : name === 'node:perf_hooks' ? { performance: { now: () => clock.value } } : require(name), loaded, loaded.exports, path.dirname(sourcePath));
    const runtime = loaded.exports.createChatterboxRuntime({ root, worker, ...options.runtime, spawnImpl: (...args) => {
        spawnCalls.push(args); const child = fakeWorker(options); spawned.push(child); return child;
    } });
    t.after(async () => { runtime.close(); t.mock.timers.reset(); await turn(); fs.rmSync(root, { recursive: true, force: true }); });
    return { root, runtime, spawned, spawnCalls, references, manifest, advanceCache: () => { clock.value += 2001; } };
}

async function until(predicate) {
    const deadline = Date.now() + 3000;
    while (!predicate() && Date.now() < deadline) await turn();
    assert.ok(predicate(), 'expected worker state reached');
}

test('exports constructor and rejects ambiguous roots', () => {
    const { createChatterboxRuntime } = require(sourcePath);
    for (const root of [undefined, '', 'relative']) assert.throws(() => createChatterboxRuntime({ root }), { code: 'CHATTERBOX_ROOT_REQUIRED' });
});
test('status returns ten verified reference voices and does not spawn or expose paths', async t => {
    const f = fixture(t); const state = await f.runtime.status();
    assert.equal(state.available, true); assert.equal(state.voices.length, 10); assert.equal(state.reason, null);
    assert.deepEqual(Array.from(state.voices, v => v.id), ids); assert.deepEqual(Array.from(state.voices, v => v.name), names);
    for (const voice of state.voices) {
        assert.equal(voice.provider, 'chatterbox'); assert.equal(voice.voiceURI, 'chatterbox:' + voice.id);
        assert.equal(voice.lang, 'tr-TR'); assert.equal(voice.localService, true); assert.equal(voice.neural, true);
        assert.equal(voice.latencyHint, 'CPU yavaş');
    }
    assert.ok(state.installBytes > 3_000_000_000); assert.equal(state.performance.realtime, false);
    assert.ok(!JSON.stringify(state).includes(f.root)); assert.equal(f.spawned.length, 0);
    assert.equal((await f.runtime.listVoices()).length, 10);
    state.voices[0].name = 'Changed'; assert.equal((await f.runtime.listVoices())[0].name, 'Ece');
});
test('untrusted same-folder runtime manifest and extra executable modules are refused', async t => {
    const untrusted = fixture(t, { untrusted: true });
    assert.equal((await untrusted.runtime.status()).reason, 'CHATTERBOX_RUNTIME_UNTRUSTED');
    await assert.rejects(untrusted.runtime.synthesize(speak), { code: 'CHATTERBOX_RUNTIME_UNTRUSTED' }); assert.equal(untrusted.spawned.length, 0);
    const f = fixture(t); assert.equal((await f.runtime.status()).available, true);
    fs.writeFileSync(path.join(f.root, 'runtime/evil.py'), 'malicious');
    f.advanceCache();
    assert.equal((await f.runtime.status()).reason, 'CHATTERBOX_RUNTIME_UNTRUSTED');
});
test('missing Python, model or references never produce placeholder voices', async t => {
    for (const relative of ['runtime/python.exe', 'model-v3/ve.pt', 'references/d1-00525.flac']) {
        const f = fixture(t); fs.unlinkSync(path.join(f.root, relative));
        const state = await f.runtime.status(); assert.equal(state.available, false); assert.equal(state.voices.length, 0);
        assert.equal(state.reason, 'CHATTERBOX_PACK_MISSING'); assert.equal(f.spawned.length, 0);
    }
});
test('hash tampering invalidates a cached pack; forged model manifests are refused', async t => {
    for (const relative of ['runtime/python.exe', 'references/d2-00331.flac', 'model-v3/ve.pt']) {
        const f = fixture(t); assert.equal((await f.runtime.status()).available, true);
        fs.writeFileSync(path.join(f.root, relative), 'tampered'.padEnd(relative.includes('references') ? 60 : 26, '!'));
        f.advanceCache();
        assert.equal((await f.runtime.status()).available, false); assert.equal(f.spawned.length, 0);
    }
    const f = fixture(t); f.manifest.files[0].sha256 = '0'.repeat(64);
    fs.writeFileSync(path.join(f.root, 'model-v3/tikmng-model-manifest.json'), JSON.stringify(f.manifest));
    assert.equal((await f.runtime.status()).reason, 'CHATTERBOX_PACK_INVALID');
});
test('duplicate voices, traversal reference paths and partial catalogs are rejected', async t => {
    for (const change of [refs => refs.voices.pop(), refs => { refs.voices[0].file = '../outside.flac'; }, refs => { refs.voices[1] = refs.voices[0]; }]) {
        const f = fixture(t); change(f.references); fs.writeFileSync(path.join(f.root, 'references/manifest.json'), JSON.stringify(f.references));
        assert.equal((await f.runtime.status()).available, false);
    }
});
test('worker lazily loads once, stays resident and selects actual voice IDs', async t => {
    const f = fixture(t);
    assert.deepEqual(await f.runtime.synthesize(speak), wav());
    assert.deepEqual(await f.runtime.synthesize({ ...speak, voiceURI: 'chatterbox:d2-00919' }), wav());
    assert.equal(f.spawned.length, 1); assert.equal(f.spawned[0].messages.filter(m => m.type === 'init').length, 1);
    assert.equal(f.spawned[0].messages[2].voiceId, 'd2-00919');
    const [python, args, config] = f.spawnCalls[0];
    assert.equal(python, path.join(f.root, 'runtime/python.exe')); assert.deepEqual(Array.from(args.slice(0, 3)), ['-I', '-B', '-u']);
    assert.equal(config.windowsHide, true); assert.equal(config.env.HF_HUB_OFFLINE, '1'); assert.equal(config.env.OMP_NUM_THREADS, '6');
    assert.equal(config.env.PYTHONHOME, undefined); assert.equal(config.env.PYTHONPATH, undefined);
    assert.equal(config.env.AZURE_SPEECH_KEY, undefined); assert.equal(config.env.HF_TOKEN, undefined);
    assert.equal(f.spawned[0].messages[1].rate, 1);
});
test('input limits, unknown voice and unsupported rate never become paths or fake voices', async t => {
    const f = fixture(t);
    for (const patch of [{ text: '' }, { text: 'x'.repeat(501) }, { text: '\ud800' }, { text: '\u0000' }, { voiceURI: '../evil' }, { voiceURI: 'chatterbox:../evil' }]) {
        await assert.rejects(f.runtime.synthesize({ ...speak, ...patch }), { code: 'CHATTERBOX_INPUT' });
    }
    await assert.rejects(f.runtime.synthesize({ ...speak, voiceURI: 'chatterbox:d1-99999' }), { code: 'CHATTERBOX_VOICE_INVALID' });
    await assert.rejects(f.runtime.synthesize({ ...speak, rate: 1.2 }), { code: 'CHATTERBOX_RATE_UNSUPPORTED' });
    assert.equal(f.spawned.length, 0);
    assert.deepEqual(await f.runtime.synthesize({ ...speak, text: '😀'.repeat(500) }), wav());
});
test('one active request plus four queued; fifth pending fails without spawning another worker', async t => {
    const f = fixture(t, { onRequest(child, request) { if (request.type === 'init') setImmediate(() => child.respond(request)); } });
    const first = f.runtime.synthesize(speak); await until(() => f.spawned[0]?.messages.length === 2);
    const queued = Array.from({ length: 4 }, () => f.runtime.synthesize(speak));
    await assert.rejects(f.runtime.synthesize(speak), { code: 'CHATTERBOX_BUSY' });
    f.spawned[0].respond(f.spawned[0].messages[1]); await first;
    for (let index = 0; index < queued.length; index++) {
        await until(() => f.spawned[0].messages.length >= index + 3);
        f.spawned[0].respond(f.spawned[0].messages[index + 2]); await queued[index];
    }
    assert.equal(f.spawned.length, 1);
});
test('aborting active request kills only owned worker and next request starts a fresh one', async t => {
    const f = fixture(t, { onRequest(child, request) { if (request.type === 'init') setImmediate(() => child.respond(request)); } });
    const controller = new AbortController(); const pending = f.runtime.synthesize(speak, { signal: controller.signal });
    await until(() => f.spawned[0]?.messages.length === 2); controller.abort();
    await assert.rejects(pending, { code: 'SPEECH_CANCELLED' }); assert.equal(f.spawned[0].kills, 1);
    const next = f.runtime.synthesize(speak); await until(() => f.spawned[1]?.messages.length === 2);
    f.spawned[1].respond(f.spawned[1].messages[1]); await next; assert.equal(f.spawned.length, 2);
});
test('aborting queued request leaves active generation running; cancel rejects all waiting work', async t => {
    const f = fixture(t, { onRequest(child, request) { if (request.type === 'init') setImmediate(() => child.respond(request)); } });
    const first = f.runtime.synthesize(speak); await until(() => f.spawned[0]?.messages.length === 2);
    const controller = new AbortController(); const queued = f.runtime.synthesize(speak, { signal: controller.signal }); controller.abort();
    await assert.rejects(queued, { code: 'SPEECH_CANCELLED' }); assert.equal(f.spawned[0].kills, 0);
    const waiting = f.runtime.synthesize(speak); const firstCheck = assert.rejects(first, { code: 'SPEECH_CANCELLED' });
    const waitingCheck = assert.rejects(waiting, { code: 'SPEECH_CANCELLED' }); f.runtime.cancel(); await Promise.all([firstCheck, waitingCheck]);
});
test('idle unload after sixty seconds frees worker; next synthesis reloads', async t => {
    const f = fixture(t); t.mock.timers.enable({ apis: ['setTimeout'] });
    await f.runtime.synthesize(speak); t.mock.timers.tick(60001); await turn();
    assert.equal(f.spawned[0].kills, 1); await f.runtime.synthesize(speak); assert.equal(f.spawned.length, 2);
});
test('ninety-second timeout kills a stalled worker and releases the queue', async t => {
    const f = fixture(t, { onRequest() {} }); t.mock.timers.enable({ apis: ['setTimeout'] });
    const first = f.runtime.synthesize(speak); const failed = assert.rejects(first, { code: 'CHATTERBOX_TIMEOUT' });
    await until(() => f.spawned[0]?.messages.length === 1); t.mock.timers.tick(90001); await failed;
    assert.equal(f.spawned[0].kills, 1);
});
test('invalid protocol, oversized lines, invalid WAV and unsafe errors are bounded and sanitized', async t => {
    for (const mode of ['protocol', 'oversize', 'wave', 'error', 'id']) {
        const f = fixture(t, { onRequest(child, request) {
            if (request.type === 'init') return setImmediate(() => child.respond(request));
            setImmediate(() => {
                if (mode === 'protocol') child.stdout.write('private text cannot be logged\n');
                if (mode === 'oversize') child.stdout.write(Buffer.alloc(16 * 1024 * 1024 + 1));
                if (mode === 'wave') child.respond(request, { audioBase64: Buffer.from('RIFFbrokenWAVE').toString('base64') });
                if (mode === 'error') child.respond(request, { type: 'error', code: 'raw provider error with private text' });
                if (mode === 'id') child.respond(request, { id: 100000 });
            });
        } });
        await assert.rejects(f.runtime.synthesize(speak), err => /^CHATTERBOX_/.test(err.code) && !err.message.includes('private'));
        assert.equal(f.spawned[0].kills, 1);
    }
});
test('close is idempotent, prevents new work, and reports unavailable', async t => {
    const f = fixture(t); await f.runtime.synthesize(speak); f.runtime.close(); f.runtime.close();
    assert.equal((await f.runtime.status()).reason, 'CHATTERBOX_CLOSED'); assert.equal((await f.runtime.listVoices()).length, 0);
    await assert.rejects(f.runtime.synthesize(speak), { code: 'CHATTERBOX_CLOSED' }); assert.equal(f.spawned[0].kills, 1);
});
test('closing during pack verification cannot start a worker after cancellation', async t => {
    const f = fixture(t);
    const pending = f.runtime.synthesize(speak);
    const checked = assert.rejects(pending, { code: 'SPEECH_CANCELLED' });
    f.runtime.close(); await checked; await turn();
    assert.equal(f.spawned.length, 0); assert.equal((await f.runtime.status()).available, false);
});
test('UI readiness cache expires after two seconds and never authorizes execution', async t => {
    const f = fixture(t); assert.equal((await f.runtime.status()).available, true);
    fs.writeFileSync(path.join(f.root, 'runtime/evil.py'), 'malicious');
    assert.equal((await f.runtime.status()).available, true, 'UI may reuse a recently checked state');
    await assert.rejects(f.runtime.synthesize(speak), { code: 'CHATTERBOX_RUNTIME_UNTRUSTED' });
    assert.equal(f.spawned.length, 0); assert.equal((await f.runtime.status()).available, false);
    const second = fixture(t); assert.equal((await second.runtime.status()).available, true);
    fs.unlinkSync(path.join(second.root, 'runtime/python.exe')); second.advanceCache();
    assert.equal((await second.runtime.status()).available, false);
});
