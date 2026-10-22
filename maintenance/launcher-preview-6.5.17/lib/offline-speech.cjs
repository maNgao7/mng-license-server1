'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');

function runOffline(root, settings, { signal, worker = path.join(__dirname, 'vendor', 'okur-worker.cjs'), timeoutMs = 45000 } = {}) {
    if (signal?.aborted) return Promise.reject(Object.assign(new Error('Ses durduruldu.'), { code: 'SPEECH_CANCELLED' }));
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [worker], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, signal });
        const chunks = []; let bytes = 0, settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            if (error) reject(error); else resolve(value);
        };
        const unavailable = () => Object.assign(new Error('Çevrimdışı ses üretilemedi.'), { code: signal?.aborted ? 'SPEECH_CANCELLED' : 'OFFLINE_UNAVAILABLE' });
        const timer = setTimeout(() => { child.kill(); finish(unavailable()); }, timeoutMs);
        child.on('error', () => finish(unavailable()));
        child.stdin.on('error', () => finish(unavailable()));
        child.stderr.resume();
        child.stdout.on('data', data => {
            bytes += data.length;
            if (bytes > 16 * 1024 * 1024) { child.kill(); finish(unavailable()); }
            else chunks.push(data);
        });
        child.on('close', code => {
            if (code !== 0) return finish(unavailable());
            finish(null, Buffer.from(Buffer.concat(chunks).toString('ascii').trim(), 'base64'));
        });
        child.stdin.end(JSON.stringify({ root, text: settings.text, speed: settings.rate / settings.pitchFactor }));
    });
}

function applyPitch(audio, factor) {
    if (!Buffer.isBuffer(audio) || audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
        throw Object.assign(new Error('Geçersiz ses kaydı.'), { code: 'INVALID_AUDIO' });
    }
    const result = Buffer.from(audio);
    const sampleRate = Math.round(result.readUInt32LE(24) * factor);
    result.writeUInt32LE(sampleRate, 24);
    result.writeUInt32LE(sampleRate * result.readUInt16LE(32), 28);
    return result;
}
module.exports = { runOffline, applyPitch };
