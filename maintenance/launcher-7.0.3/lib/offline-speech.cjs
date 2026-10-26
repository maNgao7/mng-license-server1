'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_WORKER = path.join(__dirname, 'vendor', 'okur-worker.cjs');
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024 + 1024;

function failure(code = 'OFFLINE_UNAVAILABLE') {
    return Object.assign(new Error(code === 'SPEECH_CANCELLED' ? 'Ses durduruldu.' : 'Çevrimdışı ses üretilemedi.'), { code });
}

// Paths identify already-verified packs. Hash verification belongs to the caller.
function createOfflineRuntime({ maxWorkers = 2, maxQueue = 32, idleMs = 60000 } = {}) {
    if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 4 ||
        !Number.isInteger(maxQueue) || maxQueue < 1 || maxQueue > 128 ||
        !Number.isFinite(idleMs) || idleMs < 1 || idleMs > 300000) throw new TypeError('Invalid offline runtime limits');
    const workers = new Map();
    const owned = new Set();
    const queue = [];
    let sequence = 0, pumping = false, scheduled = false;

    const killOnExit = () => { for (const state of owned) state.child.kill('SIGKILL'); };
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; pump(); });
    }
    function settle(job, error, audio) {
        if (job.settled) return;
        job.settled = true;
        clearTimeout(job.timer);
        job.signal?.removeEventListener('abort', job.abort);
        const index = queue.indexOf(job);
        if (index !== -1) queue.splice(index, 1);
        job.state = null;
        if (error) job.reject(error); else job.resolve(audio);
    }
    function stop(state, error = failure()) {
        if (state.stopping) return;
        state.stopping = true;
        clearTimeout(state.idleTimer);
        if (workers.get(state.key) === state) workers.delete(state.key);
        if (state.active) settle(state.active, error);
        state.active = null;
        state.chunks = [];
        // Only this ChildProcess is ours; never kill by image name, port, or process tree.
        refs(state, true);
        state.child.kill('SIGKILL');
    }
    function refs(state, active) {
        const method = active ? 'ref' : 'unref';
        for (const handle of [state.child, state.child.stdin, state.child.stdout, state.child.stderr]) handle[method]?.();
    }
    function idle(state) {
        state.lastUsed = performance.now();
        state.idleTimer = setTimeout(() => stop(state), idleMs);
        state.idleTimer.unref();
        refs(state, false);
    }
    function response(state, data) {
        if (state.stopping) return;
        if (!state.active) return stop(state);
        state.bytes += data.length;
        if (state.bytes > MAX_RESPONSE_BYTES) return stop(state);
        const newline = data.indexOf(10);
        if (newline === -1) { state.chunks.push(data); return; }
        if (newline !== data.length - 1) return stop(state);
        state.chunks.push(data.subarray(0, newline));
        try {
            const result = JSON.parse(Buffer.concat(state.chunks).toString('utf8'));
            if (result.v !== 1 || result.id !== state.active.id || result.error || typeof result.audio !== 'string' ||
                result.audio.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.audio)) return stop(state);
            const audio = Buffer.from(result.audio, 'base64');
            if (audio.length < 44 || audio.length > MAX_AUDIO_BYTES || audio.toString('ascii', 0, 4) !== 'RIFF' ||
                audio.toString('ascii', 8, 12) !== 'WAVE' || audio.readUInt32LE(4) + 8 !== audio.length) return stop(state);
            settle(state.active, null, audio);
            state.active = null;
            state.chunks = [];
            idle(state);
            schedule();
        } catch { stop(state); }
    }
    function launch(job) {
        const child = spawn(process.execPath, [job.worker, '--jsonl'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        const state = { child, key: job.key, active: null, chunks: [], bytes: 0, stderrBytes: 0, stopping: false, lastUsed: 0 };
        state.closed = new Promise(resolve => { state.resolveClosed = resolve; });
        if (!owned.size) process.once('exit', killOnExit);
        owned.add(state);
        workers.set(job.key, state);
        child.on('error', () => stop(state));
        child.stdin.on('error', () => stop(state));
        child.stdout.on('error', () => stop(state));
        child.stderr.on('error', () => stop(state));
        child.stdout.on('data', data => response(state, data));
        child.stderr.on('data', data => {
            state.stderrBytes += data.length;
            if (state.stderrBytes > 64 * 1024) stop(state);
        });
        child.on('exit', () => stop(state));
        child.on('close', () => {
            stop(state);
            owned.delete(state);
            if (!owned.size) process.removeListener('exit', killOnExit);
            state.resolveClosed();
            schedule();
        });
        return state;
    }
    function pump() {
        if (pumping) return;
        pumping = true;
        try {
            for (const job of [...queue]) {
                if (job.settled) continue;
                let state = workers.get(job.key);
                if (state?.active) continue;
                if (!state) {
                    if (owned.size >= maxWorkers) {
                        // A retiring child already frees a slot; don't evict another pack while awaiting close.
                        if ([...owned].some(item => item.stopping)) continue;
                        const victim = [...workers.values()].filter(item => !item.active).sort((a, b) => a.lastUsed - b.lastUsed)[0];
                        if (victim) stop(victim);
                        continue;
                    }
                    try { state = launch(job); }
                    catch { settle(job, failure()); continue; }
                }
                queue.splice(queue.indexOf(job), 1);
                clearTimeout(state.idleTimer);
                refs(state, true);
                state.active = job;
                state.bytes = state.stderrBytes = 0;
                state.chunks = [];
                job.state = state;
                state.child.stdin.write(job.line, error => { if (error) stop(state); });
            }
        } finally { pumping = false; }
    }
    function runOffline(root, settings, { signal, worker = DEFAULT_WORKER, timeoutMs = 45000 } = {}) {
        if (signal?.aborted) return Promise.reject(failure('SPEECH_CANCELLED'));
        let line, key;
        const id = String(++sequence);
        try {
            if (typeof root !== 'string' || !root || root.length > 4096 || root.includes('\0') ||
                typeof worker !== 'string' || !worker || worker.length > 4096 || worker.includes('\0') ||
                !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw failure('INVALID_INPUT');
            root = path.resolve(root);
            worker = path.resolve(worker);
            if (typeof settings?.text !== 'string' || !settings.text.trim() || Buffer.byteLength(settings.text) > 8192) throw failure('INVALID_TEXT');
            const rate = settings.rate ?? 1, pitch = settings.pitchFactor ?? 1;
            const speed = rate / pitch;
            const seed = settings.seed ?? 0, pause = settings.pause ?? 1, temperature = settings.temperature ?? 1;
            if (!Number.isFinite(rate) || !Number.isFinite(pitch) || pitch <= 0 || !Number.isFinite(speed) || speed < 0.25 || speed > 4 ||
                !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(pause) || pause < 0 || pause > 4 ||
                !Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw failure('INVALID_INPUT');
            line = JSON.stringify({ v: 1, id, root, text: settings.text, speed, seed, pause, temperature }) + '\n';
            if (Buffer.byteLength(line) > MAX_INPUT_BYTES) throw failure('INVALID_INPUT');
            key = JSON.stringify([worker, root]);
        } catch (error) { return Promise.reject(failure(['INVALID_TEXT', 'INVALID_INPUT'].includes(error.code) ? error.code : 'INVALID_INPUT')); }
        if (queue.length >= maxQueue) return Promise.reject(failure('OFFLINE_BUSY'));
        return new Promise((resolve, reject) => {
            const job = { id, key, root, worker, line, signal, resolve, reject, state: null, settled: false };
            const cancel = code => {
                if (job.state?.active === job) stop(job.state, failure(code));
                else settle(job, failure(code));
                schedule();
            };
            job.abort = () => cancel('SPEECH_CANCELLED');
            job.timer = setTimeout(() => cancel('OFFLINE_TIMEOUT'), timeoutMs);
            signal?.addEventListener('abort', job.abort, { once: true });
            queue.push(job);
            if (signal?.aborted) job.abort();
            pump();
        });
    }
    // Cancels current/queued jobs and awaits owned children. Later calls may start a fresh pool.
    function closeOffline() {
        for (const job of [...queue]) settle(job, failure('SPEECH_CANCELLED'));
        const closing = [...owned];
        for (const state of closing) stop(state, failure('SPEECH_CANCELLED'));
        return Promise.all(closing.map(state => state.closed)).then(() => undefined);
    }
    return { runOffline, closeOffline };
}

const { runOffline, closeOffline } = createOfflineRuntime();

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
module.exports = { runOffline, closeOffline, createOfflineRuntime, applyPitch };
