'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const packs = path.resolve(process.env.MNG_OFFLINE_PACKS || path.join(os.homedir(), 'AppData/Roaming/TikMnG-Test-6.5.17/voices/v1'));
const output = path.resolve(process.env.MNG_OFFLINE_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-offline-runtime-qa'));
const text = 'Merhaba, yayina hos geldiniz.';

function singleShot(root, worker) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [worker], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        let size = 0;
        const chunks = [];
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Single-shot benchmark timed out')); }, 120000);
        child.on('error', reject);
        child.stdin.on('error', reject);
        child.stderr.resume();
        child.stdout.on('data', data => {
            size += data.length;
            if (size > 17 * 1024 * 1024) { child.kill('SIGKILL'); reject(new Error('Single-shot output limit')); }
            else chunks.push(data);
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) reject(new Error('Single-shot worker failed'));
            else resolve(Buffer.from(Buffer.concat(chunks).toString('ascii').trim(), 'base64'));
        });
        child.stdin.end(JSON.stringify({ root, text, speed: 1 }));
    });
}

function record(audio, pack, mode, ms) {
    assert.ok(audio.length > 44);
    assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
    assert.equal(audio.toString('ascii', 8, 12), 'WAVE');
    assert.equal(audio.readUInt32LE(4) + 8, audio.length);
    assert.equal(audio.readUInt32LE(40) + 44, audio.length);
    assert.ok(audio.subarray(44).some(value => value !== 0));
    const file = path.join(output, pack + '-' + mode + '.wav');
    fs.writeFileSync(file, audio);
    return { pack, mode, ms: Math.round(ms), bytes: audio.length, sampleRate: audio.readUInt32LE(24),
        seconds: Number(((audio.length - 44) / audio.readUInt32LE(28)).toFixed(3)),
        sha256: crypto.createHash('sha256').update(audio).digest('hex'), file };
}

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const baselineOnly = process.argv.includes('--single-shot-only');
    const runtime = baselineOnly ? null : require('../lib/offline-speech.cjs').createOfflineRuntime();
    const results = [];
    try {
        for (const name of ['okur', 'ema']) {
            const pack = name + '-tr-v1';
            const root = path.join(packs, pack);
            assert.ok(fs.existsSync(path.join(root, name === 'okur' ? 'config.json' : 'meta.json')), 'Installed pack missing: ' + root);
            const worker = path.resolve(__dirname, '../lib/vendor/' + name + '-worker.cjs');
            const started = performance.now();
            results.push(record(await singleShot(root, worker), pack, 'single-shot', performance.now() - started));
            if (runtime) {
                for (const mode of ['cold', 'warm-1', 'warm-2', 'warm-3', 'alternate', 'warm-after-alternate']) {
                    const start = performance.now();
                    const settings = mode === 'alternate'
                        ? { text: 'Tesekkurler, yeni tur basliyor.', rate: 1.3, pitchFactor: 1.1, seed: 17, pause: 0.9, temperature: 1.1 }
                        : { text, rate: 1, pitchFactor: 1 };
                    const audio = await runtime.runOffline(root, settings, { worker, timeoutMs: 120000 });
                    results.push(record(audio, pack, mode, performance.now() - start));
                }
                const hashes = results.filter(row => row.pack === pack && row.mode !== 'alternate').map(row => row.sha256);
                assert.equal(new Set(hashes).size, 1, 'Session reuse changed deterministic audio');
                assert.notEqual(results.find(row => row.pack === pack && row.mode === 'alternate').sha256, hashes[0]);
            }
        }
    } finally { await runtime?.closeOffline(); }
    const report = { timestamp: new Date().toISOString(), node: process.version, packs, text, results };
    fs.writeFileSync(path.join(output, baselineOnly ? 'baseline.json' : 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
