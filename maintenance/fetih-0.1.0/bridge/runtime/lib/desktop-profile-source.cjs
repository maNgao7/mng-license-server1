'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');

// Existing, locally installed runtime; never search browsers, launcher accounts,
// cookies, PATH or registry. A distribution can carry this exact runtime beside
// the bridge. Missing/mismatched infrastructure is an explicit degraded mode.
const DESKTOP_RUNTIME = Object.freeze({
    version: '31.7.7',
    sha256: '1fa93c3471c11dc8128998c662c705104e4528b98901b61c8a25216acda424c5',
    installed: 'D:/TikMnG-Forza-Countdown-Hotfix/stable-7.0.18-build/node_modules/electron/dist/electron.exe'
});
const valid = name => typeof name === 'string' && /^[a-z0-9_.]{1,64}$/.test(name);

function findDesktopRuntime() {
    for (const [source, executable] of [
        ['bundled', path.join(__dirname, '../desktop-electron/electron.exe')],
        ['installed-local', DESKTOP_RUNTIME.installed]
    ]) {
        try {
            if (!fs.lstatSync(executable).isFile()) continue;
            const sha = createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
            if (sha === DESKTOP_RUNTIME.sha256) return { source, executable, version: DESKTOP_RUNTIME.version };
        } catch {}
    }
    return null;
}

function helperEnvironment(env = process.env) {
    const result = {};
    // Do not forward owner tokens, SDK secrets, proxy credentials, NODE_OPTIONS,
    // Electron flags, or an authenticated browser's user-data directory.
    for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC']) {
        if (env[key]) result[key] = env[key];
    }
    return result;
}

function createDesktopSource({ backend = findDesktopRuntime(), spawnHelper = spawn, timeoutMs = 25_000,
    report = message => process.stderr.write('[bridge] portraits: ' + message + '\n') } = {}) {
    let child, profile, closed = false, failed = false, serial = 0, announced = false;
    const pending = new Map();
    const capability = () => ({ available: !!backend && !failed && !closed,
        backend: backend ? 'auxiliary-electron' : 'unavailable',
        source: backend?.source || null, version: backend?.version || null,
        publicOnly: true, liveConnection: false,
        state: closed ? 'closed' : failed ? 'failed' : child ? 'running' : backend ? 'ready' : 'unavailable' });
    function settleAll() {
        for (const { resolve, timer } of pending.values()) { clearTimeout(timer); resolve([]); }
        pending.clear();
    }
    function announce(message) {
        if (!announced) { announced = true; report(message); }
    }
    function start() {
        if (child || closed || failed || !backend) return;
        profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-public-portraits-'));
        try {
            child = spawnHelper(backend.executable, [path.join(__dirname, 'desktop-profile-worker.cjs'),
                '--parent-pid', String(process.pid), '--user-data', profile], {
                cwd: __dirname, env: helperEnvironment(), windowsHide: true,
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'], shell: false
            });
            announce('public-only Electron ' + backend.version + ' (' + backend.source + '); no LIVE connection.');
            child.on('message', message => {
                if (!message || typeof message !== 'object') return;
                const job = pending.get(message.id);
                if (!job || message.username !== job.username) return;
                pending.delete(message.id); clearTimeout(job.timer);
                job.resolve(Array.isArray(message.sources) ? message.sources.slice(0, 4) : []);
            });
            child.once('error', () => { failed = true; settleAll(); });
            child.once('close', () => {
                failed = !closed; settleAll();
                // The directory was created by this instance, never supplied by
                // a caller. Electron's in-memory partition is not persisted.
                try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
            });
        } catch {
            failed = true; settleAll();
            if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
        }
    }
    return {
        capability,
        get(username) {
            if (!valid(username) || closed || failed) return Promise.resolve([]);
            if (!backend) {
                announce('HD renderer unavailable; using measured event/public sources.');
                return Promise.resolve([]);
            }
            if (pending.size >= 2) return Promise.resolve([]);
            start();
            if (failed) return Promise.resolve([]);
            return new Promise(resolve => {
                const id = ++serial;
                const timer = setTimeout(() => {
                    pending.delete(id); resolve([]);
                    // A hung renderer must not leave a public-source job or an
                    // invisible process alive indefinitely.
                    failed = true; settleAll(); if (child?.connected) child.disconnect();
                    const stop = setTimeout(() => child?.kill(), 2000); stop.unref();
                }, timeoutMs);
                pending.set(id, { username, resolve, timer });
                child.send({ id, username }, error => { if (error) { failed = true; settleAll(); } });
            });
        },
        close() {
            if (closed) return;
            closed = true; settleAll();
            if (child && child.exitCode === null) {
                if (child.connected) child.disconnect();
                const stop = setTimeout(() => child.kill(), 2000); stop.unref();
                child.once('exit', () => clearTimeout(stop));
            }
        }
    };
}
module.exports = { createDesktopSource, findDesktopRuntime, helperEnvironment, DESKTOP_RUNTIME };
