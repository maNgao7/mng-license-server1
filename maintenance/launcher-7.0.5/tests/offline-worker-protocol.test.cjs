'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-offline-contract-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ sample_rate: 48000, hop: 1920, latent_dim: 64,
        times: [0, 0.5], symbols: [...' merhaba.'], files: { text: 'text.onnx', sample: 'sample.onnx', decoder: 'decoder.onnx' } }));
    fs.writeFileSync(path.join(root, 'meta.json'), JSON.stringify({ sample_rate: 48000, hop: 1920, latent_dim: 64,
        times: [0, 0.5], vocab: [...' merhaba.'] }));
    for (const file of ['frontend.wasm', 'normalizer.wasm']) fs.writeFileSync(path.join(root, file), 'stub');
    const log = path.join(root, 'sessions.jsonl');
    return { root, log, events: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [] };
}

async function invoke(t, name, input, { jsonl = true, log, fail = '' } = {}) {
    const child = spawn(process.execPath, ['--require', path.join(__dirname, 'fixtures/offline-onnx-stub.cjs'),
        path.resolve(__dirname, '../lib/vendor/' + name + '-worker.cjs'), ...(jsonl ? ['--jsonl'] : [])], {
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1',
            MNG_OFFLINE_STUB_LOG: log, MNG_OFFLINE_STUB_FAIL: fail }
    });
    t.after(() => child.kill('SIGKILL'));
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.stdin.on('error', () => {});
    const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Worker contract timed out')); }, 5000);
        child.on('error', reject);
        child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
    child.stdin.end(input);
    return result;
}

for (const name of ['okur', 'ema']) {
    test(name + ' JSONL reuses three sessions, handles multiple frames serially, releases at EOF', async t => {
        const f = fixture(t);
        const requests = ['1', '2', '3'].map(id => ({ v: 1, id, root: f.root, text: 'merhaba', speed: id === '2' ? 1.5 : 1 }));
        const result = await invoke(t, name, requests.map(request => JSON.stringify(request) + '\n').join(''), { log: f.log });
        assert.equal(result.code, 0, result.stderr);
        const frames = result.stdout.trim().split('\n').map(JSON.parse);
        assert.deepEqual(frames.map(frame => frame.id), ['1', '2', '3']);
        for (const frame of frames) {
            const audio = Buffer.from(frame.audio, 'base64');
            assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
            assert.ok(audio.length > 44);
        }
        assert.equal(frames[0].audio, frames[2].audio);
        const events = f.events();
        assert.equal(events.filter(event => event.action === 'create').length, 3);
        assert.equal(events.filter(event => event.action === 'release').length, 3);
        assert.equal(events.filter(event => event.action === 'run' && event.name === 'text').length, 3);
        const lastRun = events.findLastIndex(event => event.action === 'run');
        assert.ok(events.findIndex(event => event.action === 'release') > lastRun);
    });

    test(name + ' preserves one-shot JSON/base64 compatibility and releases sessions', async t => {
        const f = fixture(t);
        const result = await invoke(t, name, JSON.stringify({ root: f.root, text: 'merhaba', speed: 1 }), { jsonl: false, log: f.log });
        assert.equal(result.code, 0, result.stderr);
        assert.ok(!result.stdout.includes('\n'));
        assert.equal(Buffer.from(result.stdout, 'base64').toString('ascii', 0, 4), 'RIFF');
        assert.equal(f.events().filter(event => event.action === 'release').length, 3);
    });

    test(name + ' releases partially initialized sessions and sanitizes errors', async t => {
        const f = fixture(t);
        const result = await invoke(t, name, JSON.stringify({ v: 1, id: '1', root: f.root, text: 'merhaba' }) + '\n',
            { log: f.log, fail: name === 'okur' ? 'sample' : 'sound' });
        assert.equal(result.code, 1);
        assert.deepEqual(JSON.parse(result.stdout), { v: 1, id: '1', error: 'OFFLINE_UNAVAILABLE' });
        assert.ok(!result.stderr.includes('private'));
        assert.deepEqual(f.events().filter(event => event.action === 'release').map(event => event.name), ['text']);
    });

    test(name + ' pins the initial pack; mismatched roots cannot use cached sessions', async t => {
        const f = fixture(t);
        const requests = [{ v: 1, id: '1', root: f.root, text: 'merhaba' },
            { v: 1, id: '2', root: path.join(f.root, 'other'), text: 'merhaba' }];
        const result = await invoke(t, name, requests.map(request => JSON.stringify(request) + '\n').join(''), { log: f.log });
        assert.equal(result.code, 1);
        const frames = result.stdout.trim().split('\n').map(JSON.parse);
        assert.ok(frames[0].audio);
        assert.equal(frames[1].error, 'OFFLINE_UNAVAILABLE');
        assert.equal(f.events().filter(event => event.action === 'create').length, 3);
        assert.equal(f.events().filter(event => event.action === 'run' && event.name === 'text').length, 1);
        assert.equal(f.events().filter(event => event.action === 'release').length, 3);
    });

    test(name + ' rejects oversized/truncated protocol input and sanitizes single-shot errors', async t => {
        for (const jsonl of [false, true]) {
            const f = fixture(t);
            const oversized = await invoke(t, name, 'x'.repeat(16385), { jsonl, log: f.log });
            assert.equal(oversized.code, 1);
            assert.equal(oversized.stdout, '');
            assert.equal(oversized.stderr, 'Offline synthesis failed.');
            assert.deepEqual(f.events(), []);
        }
        const f = fixture(t);
        const invalid = await invoke(t, name, JSON.stringify({ root: path.join(f.root, 'private'), text: 'merhaba' }), { jsonl: false, log: f.log });
        assert.equal(invalid.code, 1);
        assert.equal(invalid.stderr, 'Offline synthesis failed.');
        const truncated = await invoke(t, name, '{"v":1', { log: f.log });
        assert.equal(truncated.code, 1);
        assert.equal(truncated.stderr, 'Offline synthesis failed.');
    });
}
