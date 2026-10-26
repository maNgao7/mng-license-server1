'use strict';

const http = require('node:http');
const { execFile } = require('node:child_process');

const isRunning = child => child && child.exitCode == null && child.signalCode == null;

async function terminateOwnedChild(child, options = {}) {
    if (!isRunning(child) || !Number.isSafeInteger(child.pid) || child.pid <= 0 || child.pid === process.pid) return;
    const platform = options.platform || process.platform;
    const timeoutMs = options.timeoutMs || 5000;
    if (platform === 'win32') {
        await new Promise((resolve, reject) => {
            (options.execFile || execFile)('taskkill', ['/pid', String(child.pid), '/f', '/t'],
                { windowsHide: true, timeout: timeoutMs }, error => {
                    if (error && isRunning(child)) reject(new Error(`Oyun sureci kapatilamadi (PID ${child.pid}): ${error.message}`));
                    else resolve();
                });
        });
        return;
    }
    await new Promise((resolve, reject) => {
        const finish = error => {
            clearTimeout(timer);
            child.removeListener('exit', exited);
            if (error) reject(error); else resolve();
        };
        const exited = () => finish();
        const timer = setTimeout(() => finish(new Error(`Oyun sureci kapatilamadi (PID ${child.pid}).`)), timeoutMs);
        child.once('exit', exited);
        try { child.kill('SIGKILL'); } catch (error) { finish(error); }
    });
}

class GameLaunchSession {
    constructor({ game, title, onProgress = () => {}, onClosed = () => {}, terminate = terminateOwnedChild }) {
        this.game = game;
        this.title = title;
        this.onProgress = onProgress;
        this.onClosed = onClosed;
        this.terminate = terminate;
        this.children = new Set();
        this.disposers = new Set();
        this.waiters = new Set();
        this.closed = false;
        this.ready = false;
        this.window = null;
        this.error = null;
        this.cleanupError = null;
    }

    progress(phase, message) {
        if (this.closed) throw this.error || new Error(`${this.title} baslatma islemi iptal edildi.`);
        this.onProgress({ oyun: this.game, tip: 'baslatiliyor', phase, mesaj: message });
    }

    wait(operation, timeoutMs, message) {
        if (this.closed) return Promise.reject(this.error || new Error(`${this.title} baslatma islemi iptal edildi.`));
        return new Promise((resolve, reject) => {
            const finish = (error, value) => {
                clearTimeout(timer);
                this.waiters.delete(cancel);
                if (error) reject(error); else resolve(value);
            };
            const cancel = error => finish(error);
            const timer = setTimeout(() => finish(new Error(message)), timeoutMs);
            this.waiters.add(cancel);
            Promise.resolve(operation).then(value => finish(null, value), finish);
        });
    }

    async stage(phase, message, operation, timeoutMs = 30000) {
        this.progress(phase, message);
        try {
            return await this.wait(Promise.resolve().then(() => {
                if (this.closed) throw this.error || new Error('Oyun baslatma islemi iptal edildi.');
                return operation();
            }), timeoutMs, `${this.title}: ${message} Zaman asimi (${Math.round(timeoutMs / 1000)} saniye).`);
        } catch (error) { await this.close(error); throw this.error || error; }
    }

    ownChild(child, { name = this.title, normalExit = false } = {}) {
        if (this.closed) throw new Error('Kapali oyun oturumuna surec eklenemez.');
        this.children.add(child);
        let stdout = '';
        let stderr = '';
        const captureOut = chunk => { stdout = (stdout + String(chunk)).slice(-3000); };
        const captureError = chunk => { stderr = (stderr + String(chunk)).slice(-3000); };
        const fail = error => { if (!this.closed) void this.close(error); };
        child.stdout?.on('data', captureOut);
        child.stderr?.on('data', captureError);
        // Keep a guarded error listener through termination, including failed spawns with no exit event.
        child.on('error', error => fail(new Error(`${name} baslatilamadi: ${error.message}`)));
        const exited = (code, signal) => {
            if (this.closed) return;
            if (normalExit && this.ready && code === 0 && !signal) { void this.close(); return; }
            const detail = stderr.trim() || stdout.trim();
            fail(new Error(`${name} ${this.ready ? 'kapandi' : 'hazir olmadan kapandi'} (kod: ${code ?? signal ?? 'bilinmiyor'}).${detail ? '\n' + detail : ''}`));
        };
        child.once('exit', exited);
        this.disposers.add(() => {
            child.stdout?.removeListener('data', captureOut);
            child.stderr?.removeListener('data', captureError);
            child.removeListener('exit', exited);
        });
        return child;
    }

    async waitForMarker(child, timeoutMs = 180000) {
        let output = '';
        let listener;
        const marker = /\bMNG_(?:GAME_READY|WORLD_LOADED|STARTUP_WORLD_SECONDS|(?:SNOW|BATTLE)_ARENA_READY)\b/;
        const ready = new Promise(resolve => {
            listener = chunk => {
                output = (output + String(chunk)).slice(-6000);
                if (marker.test(output)) resolve();
            };
            child.stdout?.on('data', listener);
        });
        try {
            await this.wait(ready, timeoutMs, `${this.title} hazir sinyali vermedi (${Math.round(timeoutMs / 1000)} saniye). game-instance/launch.log kaydini kontrol edin.`);
        } catch (error) {
            await this.close(error);
            throw this.error || error;
        } finally { child.stdout?.removeListener('data', listener); }
    }

    async waitForHttp(url, { timeoutMs = 30000, validate = null } = {}) {
        let request;
        let timer;
        let stopped = false;
        let lastFailure = '';
        const stop = () => { stopped = true; clearTimeout(timer); request?.destroy(); };
        const polling = new Promise(resolve => {
            const retry = () => { if (!stopped) timer = setTimeout(probe, 250); };
            const probe = () => {
                if (stopped) return;
                request = http.get(url, { timeout: 2000 }, response => {
                    let body = '';
                    response.setEncoding('utf8');
                    response.on('data', chunk => { body = (body + chunk).slice(-16000); });
                    response.on('error', retry);
                    response.on('end', () => {
                        if (stopped) return;
                        try {
                            if (response.statusCode >= 200 && response.statusCode < 400 && (!validate || validate(JSON.parse(body)))) resolve();
                            else { lastFailure = `HTTP ${response.statusCode}`; retry(); }
                        } catch (error) { lastFailure = error.message; retry(); }
                    });
                });
                request.on('timeout', () => request.destroy(new Error('Baglanti zaman asimi.')));
                request.on('error', error => { lastFailure = error.message; retry(); });
            };
            probe();
        });
        this.disposers.add(stop);
        try {
            await this.wait(polling, timeoutMs, `${this.title} sunucusu hazir olmadi (${Math.round(timeoutMs / 1000)} saniye): ${url}`);
        } catch (error) {
            throw new Error(`${error.message}${lastFailure ? '\n' + lastFailure : ''}`);
        } finally { stop(); this.disposers.delete(stop); }
    }

    async loadWindow(window, url, timeoutMs = 30000) {
        this.window = window;
        const contents = window.webContents;
        let loaded = false;
        let drawable = false;
        let finish;
        const readiness = new Promise(resolve => { finish = resolve; });
        const check = () => { if (loaded && drawable) finish(); };
        const didFinish = () => { loaded = true; check(); };
        const readyToShow = () => { drawable = true; check(); };
        const fail = error => { if (!this.closed) void this.close(error); };
        const loadFailed = (_event, code, description, _url, isMainFrame) => {
            if (isMainFrame !== false) fail(new Error(`${this.title} sayfasi yuklenemedi: ${description} (${code}).`));
        };
        const crashed = (_event, details) => fail(new Error(`${this.title} goruntusu kapandi: ${details?.reason || 'renderer hatasi'}.`));
        window.once('closed', () => { void this.close(); });
        contents.on('did-finish-load', didFinish);
        window.once('ready-to-show', readyToShow);
        contents.on('did-fail-load', loadFailed);
        contents.on('render-process-gone', crashed);
        this.disposers.add(() => {
            contents.removeListener('did-fail-load', loadFailed);
            contents.removeListener('render-process-gone', crashed);
        });
        try {
            const navigation = window.loadURL(url);
            await this.wait(Promise.all([readiness, navigation]), timeoutMs,
                `${this.title} penceresi hazir olmadi (${Math.round(timeoutMs / 1000)} saniye). ${url}`);
            if (this.closed || window.isDestroyed()) throw this.error || new Error('Oyun penceresi kapatildi.');
            window.maximize();
            window.show();
            window.focus();
        } catch (error) {
            await this.close(error);
            throw this.error || error;
        } finally {
            contents.removeListener('did-finish-load', didFinish);
            window.removeListener('ready-to-show', readyToShow);
        }
    }

    markReady(message = `${this.title} hazir.`) {
        if (this.closed) throw this.error || new Error('Oyun hazir olmadan kapatildi.');
        this.ready = true;
        this.onProgress({ oyun: this.game, tip: 'hazir', phase: 'ready', mesaj: message });
    }

    close(error = null) {
        if (this.closePromise) return this.closePromise;
        this.closed = true;
        this.error = error;
        let done;
        this.closePromise = new Promise(resolve => { done = resolve; });
        const reason = error || new Error(`${this.title} baslatma islemi iptal edildi.`);
        for (const cancel of this.waiters) cancel(reason);
        const cleanupFailures = [];
        for (const dispose of this.disposers) {
            try { dispose(); } catch (failure) { cleanupFailures.push(failure.message); }
        }
        this.disposers.clear();
        try { if (this.window && !this.window.isDestroyed()) this.window.destroy(); }
        catch (failure) { cleanupFailures.push(failure.message); }
        Promise.allSettled([...this.children].map(child => {
            try { return this.terminate(child); } catch (failure) { return Promise.reject(failure); }
        })).then(results => {
            const failures = cleanupFailures.concat(results.filter(result => result.status === 'rejected').map(result => result.reason.message));
            if (failures.length) {
                this.cleanupError = new Error(failures.join('\n'));
                this.error = new Error([this.error?.message, this.cleanupError.message].filter(Boolean).join('\n'));
            }
            try { this.onClosed(this.error); }
            catch (failure) { this.error = new Error([this.error?.message, failure.message].filter(Boolean).join('\n')); }
            finally { done(); }
        });
        return this.closePromise;
    }
}

module.exports = { GameLaunchSession, terminateOwnedChild };
