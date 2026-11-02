'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { createLiveSession } = require('./live-session.cjs');
const { CommandCursor, normalizeGift, normalizeProfile, terminalGift } = require('./normalize.cjs');
const { layout, acquireLock, optionalJson, atomicWrite, processAlive, DedupeJournal, EventSpool } = require('./storage.cjs');
const { AvatarCache } = require('./avatars.cjs');

const KEY_FILE = 'C:\\Users\\User\\Desktop\\MNG-TikTok-Game\\apps\\tiktok-vs\\euler-api-key.txt';

function readApiKey(env = process.env, keyFile = KEY_FILE) {
    if (typeof env.EULER_API_KEY === 'string' && env.EULER_API_KEY.trim()) return env.EULER_API_KEY.trim();
    try {
        if (fs.statSync(keyFile).size > 16384) throw new Error('credential-file-too-large');
        return fs.readFileSync(keyFile, 'utf8').replace(/^\uFEFF/, '').trim();
    } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw new Error('credential-file-unreadable');
    }
}

async function loadSdk(env = process.env) {
    const supplied = env.TIKTOK_SDK_MODULE_PATH;
    if (supplied) {
        let entry = path.resolve(supplied);
        if (fs.statSync(entry).isDirectory()) {
            const info = JSON.parse(fs.readFileSync(path.join(entry, 'package.json'), 'utf8'));
            if (info.name !== 'tiktok-live-connector' || info.version !== '2.4.4') throw new Error('sdk-version-mismatch');
            entry = path.resolve(entry, info.main || 'dist/index.js');
        }
        return import(pathToFileURL(entry).href);
    }
    const info = require('tiktok-live-connector/package.json');
    if (info.version !== '2.4.4') throw new Error('sdk-version-mismatch');
    return import('tiktok-live-connector');
}

function createSdkFactory({ env = process.env, keyFile = KEY_FILE } = {}) {
    let sdk;
    const connections = new Set();
    let closed = false;
    async function createConnection(username) {
        sdk ||= loadSdk(env).catch(error => { sdk = null; throw error; });
        const module = await sdk;
        if (closed) throw new Error('bridge-closed');
        const apiKey = readApiKey(env, keyFile);
        const options = { processInitialData: false, enableExtendedGiftInfo: false };
        if (apiKey) options.signApiKey = apiKey;
        const connection = new module.TikTokLiveConnection(username, options);
        connections.add(connection);
        const disconnect = connection.disconnect.bind(connection);
        connection.disconnect = () => {
            let result;
            try { result = disconnect(); } catch { connections.delete(connection); return Promise.resolve(); }
            return Promise.resolve(result).catch(() => {}).finally(() => connections.delete(connection));
        };
        return connection;
    }
    async function close() {
        closed = true;
        await Promise.allSettled([...connections].map(async connection => {
            try { connection.wsClient?.terminate(); } catch {}
            await connection.disconnect();
        }));
    }
    return { createConnection, close };
}

function createBridge({ root = path.resolve(__dirname, '..'), parentPid = 0, createConnection,
    closeConnections = async () => {}, avatarOptions = {}, now = Date.now,
    timers = globalThis, sessionOptions = {}, eventLimit = 2000, journalLimit = 2000,
    isParentAlive = processAlive, log = message => process.stderr.write(`${message}\n`) } = {}) {
    const paths = layout(root);
    const releaseLock = acquireLock(paths.lock);
    let session;
    let avatars;
    let pollTimer;
    let closing;
    let closed = false;
    let dirty = true;
    let fault = null;
    let epoch = randomUUID();
    let received = 0;
    let giftEvents = 0;
    let lastEventAt = 0;
    let snapshot = { status: 'disconnected', reason: 'idle', message: 'Waiting for a newer connect command.', username: '', roomId: '' };
    let spool;
    let journal;
    let cursor;

    function status() {
        return { status: fault?.fatal ? 'error' : snapshot.status, reason: fault?.reason || snapshot.reason,
            message: fault?.message || snapshot.message, username: snapshot.username || '', roomId: snapshot.roomId || '',
            epoch, lastEventAt, received, giftEvents };
    }

    function flush() {
        if (!dirty) return;
        try { atomicWrite(paths.status, status()); dirty = false; }
        catch { log('TikTok bridge: atomic status write failed; retrying on the next poll.'); }
    }

    function issue(reason, message, fatal = false) {
        if (fault?.fatal && !fatal) return;
        fault = { reason, message, fatal };
        dirty = true;
        log(`TikTok bridge: ${reason}: ${message}`);
        if (fatal) { session?.stop(); avatars?.reset(); }
        flush();
    }

    function enqueue(event) {
        try { spool.enqueue(event); return true; }
        catch (error) {
            issue(error.code === 'EVENT_OVERFLOW' ? 'overflow' : 'event-write',
                error.code === 'EVENT_OVERFLOW'
                    ? `Event capacity ${spool.limit} reached. Event was not queued; connection stopped. Drain events and send a newer connect command.`
                    : 'Atomic event write failed; connection stopped. Send a newer connect command after fixing storage.', true);
            return false;
        }
    }

    try {
        spool = new EventSpool(paths.events, eventLimit, now);
        journal = new DedupeJournal(paths.journal, journalLimit);
        let boot;
        try { boot = optionalJson(paths.command, 16384); } catch { boot = null; }
        cursor = new CommandCursor(boot);
        spool.prune(epoch);
        avatars = new AvatarCache(paths.avatars, { ...avatarOptions,
            onIssue: (reason, message) => issue(reason, message),
            onReady: event => { if (!closed && event.epoch === epoch && !fault?.fatal) enqueue(event); } });
        session = createLiveSession({ ...sessionOptions, createConnection,
            onStatus: value => { snapshot = value; dirty = true; },
            onEvent: (type, payload) => {
                if (closed || fault?.fatal) return;
                received++;
                lastEventAt = now();
                dirty = true;
                if (type === 'gift') {
                    if (!terminalGift(payload)) return;
                    const normalized = normalizeGift(payload, epoch, snapshot.roomId);
                    if (!normalized) {
                        issue('invalid-gift', 'A gift without valid native IDs, sender, or repeat count was rejected.');
                        return;
                    }
                    if (journal.has(normalized.keys)) return;
                    if (!enqueue(normalized.event)) return;
                    giftEvents++;
                    try { journal.remember(normalized.keys); }
                    catch { issue('journal-write', 'Gift queued, but persisted dedupe failed; connection stopped.', true); return; }
                    avatars.request(normalized.profile, epoch, true);
                } else avatars.request(normalizeProfile(payload), epoch);
            } });
        flush();
    } catch (error) { avatars?.close(); releaseLock(); throw error; }

    function newEpoch() {
        epoch = randomUUID();
        fault = null;
        avatars.reset();
        spool.prune(epoch);
        dirty = true;
    }

    function command(value) {
        const next = cursor.take(value);
        if (!next || closed) return;
        if (next.op === 'shutdown') { void close('shutdown'); return; }
        if (next.op === 'invalid') { issue('invalid-command', 'Command requires a newer integer seq, supported op, and string username.'); return; }
        try { newEpoch(); }
        catch { issue('event-cleanup', 'Owned stale event cleanup failed; connection stopped.', true); return; }
        if (next.op === 'disconnect') session.stop();
        else {
            received = giftEvents = lastEventAt = 0;
            void session.start(next.username);
        }
        flush();
    }

    function tick() {
        if (closed) return;
        if (parentPid && !isParentAlive(parentPid)) { void close('parent-dead'); return; }
        try { command(optionalJson(paths.command, 16384)); }
        catch (error) {
            // A writer can be between truncate and replacement. Re-read on the next 200 ms tick.
            if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') issue('command-read', 'Command file could not be safely read.');
        }
        flush();
    }

    async function close(reason = 'shutdown') {
        if (closing) return closing;
        closed = true;
        if (pollTimer !== undefined) timers.clearInterval(pollTimer);
        avatars.close();
        fault = null;
        session.close();
        snapshot = { ...session.status(), status: 'disconnected', reason, message: `TikTok bridge stopped (${reason}).` };
        dirty = true;
        flush();
        closing = (async () => {
            let timeout;
            try {
                await Promise.race([Promise.resolve().then(closeConnections), new Promise(resolve => { timeout = setTimeout(resolve, 1500); })]);
            } finally {
                clearTimeout(timeout);
                releaseLock();
            }
        })();
        return closing;
    }

    function start() {
        if (!closed && pollTimer === undefined) pollTimer = timers.setInterval(tick, 200);
        return api;
    }

    const api = { paths, status, command, tick, start, close, get closed() { return closed; }, get done() { return closing; } };
    return api;
}

function parseArgs(args) {
    const result = { root: path.resolve(__dirname, '..'), parentPid: 0 };
    const seen = new Set();
    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        if (!['--root', '--parent-pid'].includes(flag) || !value || seen.has(flag)) throw new Error('invalid-arguments');
        seen.add(flag);
        if (flag === '--root') result.root = path.resolve(value);
        else {
            if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('invalid-parent-pid');
            result.parentPid = Number(value);
        }
    }
    return result;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const factory = createSdkFactory();
    const { createOriginalPortraitResolver } = require('./original-portraits.cjs');
    const bridge = createBridge({ ...options, createConnection: factory.createConnection, closeConnections: factory.close,
        avatarOptions: { resolveHighResolution: createOriginalPortraitResolver() } }).start();
    let exiting = false;
    async function finish(reason) {
        if (exiting) return;
        exiting = true;
        await bridge.close(reason);
        process.exit(0);
    }
    process.once('SIGINT', () => void finish('signal'));
    process.once('SIGTERM', () => void finish('signal'));
    process.once('disconnect', () => void finish('parent-dead'));
    const watcher = setInterval(() => { if (bridge.closed) { clearInterval(watcher); void finish(bridge.status().reason); } }, 100);
    process.once('uncaughtException', () => {
        process.stderr.write('TikTok bridge: unexpected runtime failure; closing sidecar.\n');
        void finish('runtime-error');
    });
    process.once('unhandledRejection', () => {
        process.stderr.write('TikTok bridge: unexpected asynchronous failure; closing sidecar.\n');
        void finish('runtime-error');
    });
}

if (require.main === module) main().catch(() => {
    process.stderr.write('TikTok bridge could not start. Check arguments, storage, and existing sidecar ownership.\n');
    process.exitCode = 1;
});

module.exports = { KEY_FILE, readApiKey, loadSdk, createSdkFactory, createBridge, parseArgs };
