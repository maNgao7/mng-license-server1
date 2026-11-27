'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const fsp = fs.promises;

const MODEL = Object.freeze({
    't3_mtl23ls_v3.safetensors': [2143989928, '5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953'],
    's3gen.pt': [1057165844, '9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3'],
    've.pt': [5698626, '4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1'],
    'conds.pt': [107374, '6552d70568833628ba019c6b03459e77fe71ca197d5c560cef9411bee9d87f4e'],
    'Cangjie5_TC.json': [1920163, '7073fd9de919443ae88e0bd2449917a65fe54898a4413ed1edcc4b67f28bce8c'],
    'grapheme_mtl_merged_expanded_v1.json': [69989, '69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf']
});
const REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18';
const IDS = new Set(['d2-00331', 'd2-00919', 'd1-00525', 'd1-02311', 'd1-02057', 'd2-00703', 'd1-01027', 'd1-00884', 'd1-00781', 'd1-00727']);
const CAP = 16 * 1024 * 1024, TIMEOUT = 90000, IDLE = 60000;
// Filled only from the locally verified preparation artifact, never from the pack.
const TRUSTED_RUNTIME_MANIFESTS = new Set(['bbe50d9d515bee7f0cc4d78f8352c55efce20f16c1137b33e994b7884edc8dc6']);
const READINESS_CACHE = new Map(), READINESS_MS = 2000;
const VERIFIED_FILES = new Map();
const cloneStatus = state => ({ ...state, voices: state.voices.map(voice => ({ ...voice })), ...(state.performance ? { performance: { ...state.performance } } : {}) });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const error = code => Object.assign(new Error(code), { code });
const inside = (root, file) => { const relative = path.relative(root, file); return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };

async function regular(file, root) {
    const stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || (root && !inside(root, await fsp.realpath(file)))) throw error('CHATTERBOX_PACK_INVALID');
    return stat;
}
async function json(file, root) {
    const stat = await regular(file, root);
    if (stat.size > 65536) throw error('CHATTERBOX_PACK_INVALID');
    return JSON.parse(await fsp.readFile(file, 'utf8'));
}
async function digest(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}
async function verifyDigest(file, expected) {
    const stat = await fsp.lstat(file);
    const fingerprint = JSON.stringify([stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino]);
    const key = file + ':' + expected;
    if (VERIFIED_FILES.get(key) === fingerprint) return;
    if (await digest(file) !== expected) throw error('CHATTERBOX_PACK_INVALID');
    const after = await fsp.lstat(file);
    if (fingerprint !== JSON.stringify([after.size, after.mtimeMs, after.ctimeMs, after.ino])) throw error('CHATTERBOX_PACK_INVALID');
    if (VERIFIED_FILES.size >= 50000) VERIFIED_FILES.delete(VERIFIED_FILES.keys().next().value);
    VERIFIED_FILES.set(key, fingerprint);
}
function validWave(audio) {
    if (audio.length < 44 || audio.length > CAP || audio.toString('ascii', 0, 4) !== 'RIFF'
        || audio.toString('ascii', 8, 12) !== 'WAVE' || audio.readUInt32LE(4) + 8 !== audio.length) return false;
    let offset = 12, format = false, data = false;
    while (offset + 8 <= audio.length) {
        const size = audio.readUInt32LE(offset + 4), start = offset + 8, end = start + size;
        if (end > audio.length) return false;
        const name = audio.toString('ascii', offset, offset + 4);
        if (name === 'fmt ') {
            if (format || size < 16 || audio.readUInt16LE(start) !== 1 || audio.readUInt16LE(start + 2) !== 1
                || audio.readUInt32LE(start + 4) !== 24000 || audio.readUInt32LE(start + 8) !== 48000
                || audio.readUInt16LE(start + 12) !== 2 || audio.readUInt16LE(start + 14) !== 16) return false;
            format = true;
        }
        if (name === 'data') { if (!format || data || !size || size % 2) return false; data = true; }
        offset = end + (size % 2);
    }
    return format && data && offset === audio.length;
}

function createChatterboxRuntime({ root, python, worker, spawnImpl = spawn, timeoutMs = TIMEOUT } = {}) {
    if (typeof root !== 'string' || !path.isAbsolute(root) || typeof spawnImpl !== 'function') throw error('CHATTERBOX_ROOT_REQUIRED');
    root = path.resolve(root);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw error('CHATTERBOX_INPUT');
    python = python || path.join(root, 'runtime', 'python.exe');
    worker = (worker || path.join(__dirname, 'vendor', 'chatterbox-worker.py')).replace(/\.asar([\\/])/, '.asar.unpacked$1');
    const cacheKey = JSON.stringify([root, python, worker]);
    const jobs = [];
    let verified, runtimeVerified, verifying, child, transport, idle, active, stopped = Promise.resolve(), closed = false, sequence = 0;

    async function verifyRuntime(base) {
        const manifestFile = path.join(root, 'runtime-manifest.json');
        const manifestStat = await regular(manifestFile, base);
        if (manifestStat.size > 8 * 1024 * 1024) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
        const encoded = await fsp.readFile(manifestFile);
        const pin = crypto.createHash('sha256').update(encoded).digest('hex');
        if (!TRUSTED_RUNTIME_MANIFESTS.has(pin)) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
        const manifest = JSON.parse(encoded.toString('utf8'));
        if (manifest.schemaVersion !== 1 || !manifest.offlineImportsVerified || !Array.isArray(manifest.files)
            || !manifest.files.length || manifest.files.length > 30000) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
        const expected = new Map();
        for (const entry of manifest.files) {
            if (!object(entry) || typeof entry.path !== 'string' || !/^runtime\/[A-Za-z0-9_.+@() -]+(?:\/[A-Za-z0-9_.+@() -]+)*$/.test(entry.path)
                || entry.path.split('/').some(p => p === '..' || p === '.') || expected.has(entry.path)
                || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
            expected.set(entry.path, entry);
        }
        if (!expected.has('runtime/python.exe') || path.resolve(python) !== path.join(root, 'runtime', 'python.exe')) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
        const fingerprint = [pin];
        const files = [];
        async function walk(directory) {
            for (const dirent of await fsp.readdir(directory, { withFileTypes: true })) {
                if (dirent.isSymbolicLink()) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
                const file = path.join(directory, dirent.name);
                if (dirent.isDirectory()) await walk(file);
                else {
                    const key = path.relative(root, file).split(path.sep).join('/'), entry = expected.get(key);
                    if (!entry) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
                    files.push({ file, key, ...entry });
                }
            }
        }
        await walk(path.join(root, 'runtime'));
        if (files.length !== expected.size) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
        // Bound filesystem parallelism while retaining every file and path check.
        for (let offset = 0; offset < files.length; offset += 32) {
            const stats = await Promise.all(files.slice(offset, offset + 32).map(async entry => {
                const stat = await regular(entry.file, base);
                if (stat.size !== entry.bytes) throw error('CHATTERBOX_RUNTIME_UNTRUSTED');
                return [entry.key, stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino];
            }));
            fingerprint.push(...stats);
        }
        const serialized = JSON.stringify(fingerprint);
        if (serialized !== runtimeVerified) {
            try { for (const file of files) await verifyDigest(file.file, file.sha256); }
            catch { throw error('CHATTERBOX_RUNTIME_UNTRUSTED'); }
            runtimeVerified = serialized;
        }
        return manifest.files.reduce((bytes, file) => bytes + file.bytes, 0);
    }

    async function inspect() {
        try {
            if (closed) return { available: false, voices: [], reason: 'CHATTERBOX_CLOSED' };
            const base = await fsp.realpath(root);
            await regular(python, python === path.join(root, 'runtime', 'python.exe') ? base : undefined);
            await regular(worker);
            const runtimeBytes = await verifyRuntime(base);
            const modelDir = await fsp.stat(path.join(root, 'model-v3')).then(() => path.join(root, 'model-v3'), () => path.join(root, 'model'));
            const model = await json(path.join(modelDir, 'tikmng-model-manifest.json'), base);
            const refs = await json(path.join(root, 'references', 'manifest.json'), base);
            if (model.repo !== 'ResembleAI/chatterbox' || model.revision !== REVISION || !Array.isArray(model.files)
                || model.files.length !== Object.keys(MODEL).length || !Array.isArray(refs.voices) || refs.voices.length !== 10) throw error('CHATTERBOX_PACK_INVALID');
            const entries = [], ids = new Set(), names = new Set();
            for (const [name, [bytes, sha256]] of Object.entries(MODEL)) {
                if (model.files.filter(f => f.name === name && f.bytes === bytes && f.sha256 === sha256).length !== 1) throw error('CHATTERBOX_PACK_INVALID');
                entries.push({ file: path.join(modelDir, name), bytes, sha256 });
            }
            const catalog = refs.voices.map(voice => {
                if (!object(voice) || !IDS.has(voice.id) || ids.has(voice.id) || typeof voice.name !== 'string'
                    || !voice.name.trim() || voice.name.length > 50 || /[\x00-\x1f\x7f]/.test(voice.name) || names.has(voice.name)
                    || !['female', 'male'].includes(voice.gender) || voice.file !== voice.id + '.flac'
                    || !Number.isSafeInteger(voice.bytes) || voice.bytes < 44 || voice.bytes > 4 * 1024 * 1024
                    || !/^[a-f0-9]{64}$/.test(voice.sha256)) throw error('CHATTERBOX_PACK_INVALID');
                ids.add(voice.id); names.add(voice.name);
                return voice;
            });
            const voices = [];
            // A missing optional speaker is not a missing engine. Present files remain strictly verified.
            for (const voice of catalog) {
                const file = path.join(root, 'references', voice.file);
                try { await fsp.lstat(file); } catch (err) { if (err.code === 'ENOENT') continue; throw err; }
                entries.push({ file, bytes: voice.bytes, sha256: voice.sha256 });
                voices.push({ id: voice.id, name: voice.name, gender: voice.gender, voiceURI: 'chatterbox:' + voice.id,
                    provider: 'chatterbox', lang: 'tr-TR', neural: true, localService: true, latencyHint: 'CPU yavaş' });
            }
            const stats = await Promise.all(entries.map(async entry => {
                const stat = await regular(entry.file, base);
                if (stat.size !== entry.bytes) throw error('CHATTERBOX_PACK_INVALID');
                return [entry.file, stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino];
            }));
            const fingerprint = JSON.stringify([model, refs, stats]);
            if (fingerprint !== verified?.fingerprint) {
                for (const entry of entries) await verifyDigest(entry.file, entry.sha256);
                verified = { fingerprint, voices };
            }
            return { available: voices.length > 0, engineReady: true, voices: voices.map(v => ({ ...v })), reason: voices.length ? null : 'CHATTERBOX_VOICE_REQUIRED',
                installBytes: runtimeBytes + entries.reduce((sum, entry) => sum + entry.bytes, 0), performance: { device: 'cpu', threads: 6, realtime: false } };
        } catch (err) {
            verified = undefined;
            return { available: false, voices: [], reason: err.code === 'ENOENT' ? 'CHATTERBOX_PACK_MISSING'
                : err.code === 'CHATTERBOX_RUNTIME_UNTRUSTED' ? err.code : 'CHATTERBOX_PACK_INVALID' };
        }
    }
    async function freshStatus() {
        if (!verifying) verifying = inspect().finally(() => { verifying = undefined; });
        const state = await verifying;
        if (closed) return { available: false, voices: [], reason: 'CHATTERBOX_CLOSED' };
        if (state.available) {
            if (READINESS_CACHE.size >= 4 && !READINESS_CACHE.has(cacheKey)) READINESS_CACHE.delete(READINESS_CACHE.keys().next().value);
            READINESS_CACHE.set(cacheKey, { until: performance.now() + READINESS_MS, state: cloneStatus(state) });
        } else READINESS_CACHE.delete(cacheKey);
        return state;
    }
    async function status({ refresh = false } = {}) {
        if (closed) return { available: false, voices: [], reason: 'CHATTERBOX_CLOSED' };
        if (refresh) return freshStatus();
        const cached = READINESS_CACHE.get(cacheKey);
        if (cached && performance.now() < cached.until) return cloneStatus(cached.state);
        return freshStatus();
    }
    function retire(code) {
        clearTimeout(idle); idle = undefined;
        if (!child) return;
        const owned = child, channel = transport;
        child = undefined; transport = undefined;
        channel.dead = true; channel.waiter?.reject(error(code)); channel.waiter = undefined;
        stopped = channel.exited;
        try { owned.stdin.destroy(); owned.kill(); } catch {}
    }
    function exchange(type, fields = {}) {
        const channel = transport;
        if (!channel || channel.dead || channel.waiter) return Promise.reject(error('CHATTERBOX_UNAVAILABLE'));
        const id = ++sequence;
        return new Promise((resolve, reject) => {
            channel.waiter = { id, type: type === 'init' ? 'ready' : 'audio', resolve, reject };
            const line = JSON.stringify({ v: 1, id, type, ...fields }) + '\n';
            try { child.stdin.write(line, err => { if (err && transport === channel) retire('CHATTERBOX_UNAVAILABLE'); }); }
            catch { retire('CHATTERBOX_UNAVAILABLE'); }
        });
    }
    async function ensureWorker(job) {
        if (child) return;
        await Promise.race([stopped, new Promise((_, reject) => {
            const timer = setTimeout(() => reject(error('CHATTERBOX_UNAVAILABLE')), 5000); timer.unref?.();
            stopped.finally(() => clearTimeout(timer));
        })]);
        if (closed || active !== job || job.cancelled || job.signal?.aborted) throw error('SPEECH_CANCELLED');
        const windowsRoot = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
        const env = { SystemRoot: windowsRoot, WINDIR: windowsRoot, PATH: path.dirname(python) + path.delimiter + path.join(windowsRoot, 'System32'),
            TEMP: process.env.TEMP || path.join(root, 'cache'), TMP: process.env.TMP || path.join(root, 'cache'),
            PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1',
            TOKENIZERS_PARALLELISM: 'false', OMP_NUM_THREADS: '6', MKL_NUM_THREADS: '6', OPENBLAS_NUM_THREADS: '6',
            HF_HOME: path.join(root, 'cache', 'hf'), NUMBA_CACHE_DIR: path.join(root, 'cache', 'numba') };
        const owned = spawnImpl(python, ['-I', '-B', '-u', worker], { cwd: path.dirname(python), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env });
        let exitResolve;
        const channel = { dead: false, waiter: undefined, buffer: Buffer.alloc(0), stderrBytes: 0, exited: new Promise(resolve => { exitResolve = resolve; }) };
        child = owned; transport = channel;
        const failed = () => { if (transport === channel) retire('CHATTERBOX_UNAVAILABLE'); };
        owned.once('error', () => { exitResolve(); failed(); });
        owned.once('close', () => { exitResolve(); failed(); });
        owned.stdin.on('error', failed);
        owned.stderr.on('data', chunk => { channel.stderrBytes += chunk.length; if (channel.stderrBytes > 1024 * 1024 && transport === channel) retire('CHATTERBOX_OUTPUT_LIMIT'); });
        owned.stdout.on('data', chunk => {
            if (channel.dead) return;
            if (channel.buffer.length + chunk.length > CAP) { retire('CHATTERBOX_OUTPUT_LIMIT'); return; }
            channel.buffer = Buffer.concat([channel.buffer, chunk]);
            let newline;
            while (!channel.dead && (newline = channel.buffer.indexOf(10)) !== -1) {
                const line = channel.buffer.subarray(0, newline); channel.buffer = channel.buffer.subarray(newline + 1);
                let message;
                try { message = JSON.parse(line.toString('utf8')); } catch { retire('CHATTERBOX_PROTOCOL'); return; }
                const pending = channel.waiter;
                if (!pending || !object(message) || message.v !== 1 || message.id !== pending.id
                    || ![pending.type, 'error'].includes(message.type)) { retire('CHATTERBOX_PROTOCOL'); return; }
                channel.waiter = undefined;
                if (message.type === 'error') {
                    pending.reject(error(['CHATTERBOX_PACK_INVALID', 'CHATTERBOX_INPUT', 'CHATTERBOX_VOICE_INVALID', 'CHATTERBOX_RATE_UNSUPPORTED'].includes(message.code) ? message.code : 'CHATTERBOX_FAILED'));
                } else pending.resolve(message);
            }
        });
        await exchange('init', { root });
    }
    async function pump() {
        if (active || closed || !jobs.length) return;
        clearTimeout(idle);
        const job = jobs.shift(); active = job;
        let timer;
        try {
            const deadline = new Promise((_, reject) => {
                job.rejectOperation = reject;
                timer = setTimeout(() => { job.cancelled = true; retire('CHATTERBOX_TIMEOUT'); reject(error('CHATTERBOX_TIMEOUT')); }, timeoutMs);
            });
            const operation = (async () => {
                // UI readiness can be cached briefly; execution always checks afresh.
                const state = await freshStatus();
                if (!state.available) throw error(state.reason);
                if (job.cancelled || job.signal?.aborted || closed) throw error('SPEECH_CANCELLED');
                if (!state.voices.some(v => v.voiceURI === job.settings.voiceURI)) throw error('CHATTERBOX_VOICE_INVALID');
                await ensureWorker(job);
                if (job.cancelled || job.signal?.aborted || closed) throw error('SPEECH_CANCELLED');
                const result = await exchange('synthesize', { text: job.settings.text, voiceId: job.settings.voiceURI.slice(11), rate: job.settings.rate });
                if (result.mimeType !== 'audio/wav' || typeof result.audioBase64 !== 'string' || !result.audioBase64.length
                    || result.audioBase64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.audioBase64)) throw error('CHATTERBOX_INVALID_AUDIO');
                const audio = Buffer.from(result.audioBase64, 'base64');
                if (!validWave(audio)) throw error('CHATTERBOX_INVALID_AUDIO');
                return audio;
            })();
            job.resolve(await Promise.race([operation, deadline]));
        } catch (err) {
            retire('CHATTERBOX_UNAVAILABLE');
            job.reject(error(err.code?.startsWith('CHATTERBOX_') || err.code === 'SPEECH_CANCELLED' ? err.code : 'CHATTERBOX_UNAVAILABLE'));
        } finally {
            clearTimeout(timer); job.signal?.removeEventListener('abort', job.abort); job.rejectOperation = undefined;
            active = undefined;
            if (jobs.length && !closed) void pump();
            else if (child) { idle = setTimeout(() => retire('CHATTERBOX_IDLE'), IDLE); idle.unref?.(); }
        }
    }
    function synthesize(settings, { signal } = {}) {
        if (closed) return Promise.reject(error('CHATTERBOX_CLOSED'));
        if (signal?.aborted) return Promise.reject(error('SPEECH_CANCELLED'));
        if (!object(settings) || typeof settings.text !== 'string' || !settings.text.trim() || [...settings.text].length > 500
            || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uD800-\uDFFF]/u.test(settings.text)
            || typeof settings.voiceURI !== 'string' || !/^chatterbox:d[12]-\d{5}$/.test(settings.voiceURI)) return Promise.reject(error('CHATTERBOX_INPUT'));
        // Rate remains natural; the parent may use its pitch-preserving playback path.
        if (settings.rate !== undefined && settings.rate !== 1) return Promise.reject(error('CHATTERBOX_RATE_UNSUPPORTED'));
        if (active && jobs.length >= 4) return Promise.reject(error('CHATTERBOX_BUSY'));
        return new Promise((resolve, reject) => {
            const job = { settings: { text: settings.text, voiceURI: settings.voiceURI, rate: 1 }, signal, resolve, reject };
            job.abort = () => {
                job.cancelled = true;
                if (active === job) { retire('SPEECH_CANCELLED'); job.rejectOperation?.(error('SPEECH_CANCELLED')); }
                else { const index = jobs.indexOf(job); if (index !== -1) jobs.splice(index, 1); signal.removeEventListener('abort', job.abort); reject(error('SPEECH_CANCELLED')); }
            };
            signal?.addEventListener('abort', job.abort, { once: true }); jobs.push(job); void pump();
        });
    }
    function cancel() {
        for (const job of jobs.splice(0)) { job.signal?.removeEventListener('abort', job.abort); job.reject(error('SPEECH_CANCELLED')); }
        if (active) { active.cancelled = true; retire('SPEECH_CANCELLED'); active.rejectOperation?.(error('SPEECH_CANCELLED')); }
        else retire('SPEECH_CANCELLED');
    }
    return { status, async listVoices() { return (await status()).voices; }, synthesize, cancel,
        close() { closed = true; cancel(); verified = undefined; } };
}

module.exports = { createChatterboxRuntime };
