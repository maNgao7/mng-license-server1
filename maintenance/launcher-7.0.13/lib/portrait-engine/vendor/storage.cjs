'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_EVENTS = 2000;
const OWN_EVENT = /^\d{20}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tiktok-bridge\.json$/;
const OWN_AVATAR = /^tiktok-bridge-avatar-[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

function regularFile(file) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe-file');
    return stat;
}

function readJson(file, limit = 1024 * 1024) {
    if (regularFile(file).size > limit) throw new Error('file-too-large');
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function optionalJson(file, limit) {
    try { return readJson(file, limit); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function atomicWrite(file, value) {
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.bridge-${randomUUID()}.tmp`);
    let fd;
    try {
        try { regularFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        fd = fs.openSync(temp, 'wx', 0o600);
        fs.writeFileSync(fd, Buffer.isBuffer(value) ? value : JSON.stringify(value));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        fs.renameSync(temp, file);
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
        try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}

function safeDirectory(parent, name) {
    const target = path.join(parent, name);
    fs.mkdirSync(target, { recursive: true });
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) throw new Error('unsafe-directory');
    return target;
}

function layout(root) {
    const resolvedRoot = fs.realpathSync(path.resolve(root));
    const data = safeDirectory(resolvedRoot, 'userdata');
    return { root: resolvedRoot, data, events: safeDirectory(data, 'live-events'),
        avatars: safeDirectory(data, 'avatars'), command: path.join(data, 'live-command.json'),
        status: path.join(data, 'live-status.json'), journal: path.join(data, 'live-bridge-journal.json'),
        lock: path.join(data, 'live-bridge-lock.json') };
}

function processAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function acquireLock(file) {
    const token = randomUUID();
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(file, JSON.stringify({ owner: 'tiktok-bridge', pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
            return () => {
                const current = optionalJson(file, 2048);
                if (current?.token === token && current?.owner === 'tiktok-bridge') fs.unlinkSync(file);
            };
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            const old = readJson(file, 2048);
            if (old.owner !== 'tiktok-bridge' || !Number.isSafeInteger(old.pid) || old.pid < 1 || processAlive(old.pid)) {
                throw new Error('bridge-already-running-or-unowned-lock');
            }
            fs.unlinkSync(file);
        }
    }
    throw new Error('bridge-lock-failed');
}

class DedupeJournal {
    constructor(file, limit = MAX_EVENTS) {
        this.file = file;
        this.limit = Math.min(MAX_EVENTS, Math.max(1, limit));
        const saved = optionalJson(file);
        if (saved && (saved.version !== 1 || !Array.isArray(saved.entries))) throw new Error('invalid-journal');
        this.entries = (saved?.entries || []).slice(-this.limit);
        this.keys = new Set();
        for (const entry of this.entries) {
            if (!Array.isArray(entry) || entry.length < 1 || entry.length > 2
                || entry.some(key => typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key))) throw new Error('invalid-journal');
            for (const key of entry) this.keys.add(key);
        }
    }

    has(keys) { return keys.some(key => this.keys.has(key)); }

    remember(keys) {
        if (this.has(keys)) return false;
        const next = [...this.entries, [...keys]].slice(-this.limit);
        atomicWrite(this.file, { version: 1, entries: next });
        this.entries = next;
        this.keys = new Set(next.flat());
        return true;
    }
}

class EventSpool {
    constructor(directory, limit = MAX_EVENTS, now = Date.now) {
        this.directory = directory;
        this.limit = Math.min(MAX_EVENTS, Math.max(1, limit));
        this.now = now;
        this.sequence = 0n;
        for (const name of fs.readdirSync(directory)) {
            if (OWN_EVENT.test(name)) this.sequence = this.sequence > BigInt(name.slice(0, 20)) ? this.sequence : BigInt(name.slice(0, 20));
        }
    }

    count() { return fs.readdirSync(this.directory).filter(name => name.endsWith('.json')).length; }

    prune(epoch) {
        for (const name of fs.readdirSync(this.directory)) {
            if (!OWN_EVENT.test(name)) continue;
            const file = path.join(this.directory, name);
            try {
                const event = readJson(file, 16384);
                if (['gift', 'avatar'].includes(event.kind) && typeof event.epoch === 'string' && event.epoch !== epoch) fs.unlinkSync(file);
            } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
    }

    enqueue(event) {
        if (this.count() >= this.limit) throw Object.assign(new Error(`Event spool capacity ${this.limit} reached`), { code: 'EVENT_OVERFLOW' });
        const timestamp = BigInt(Math.max(0, Math.floor(this.now()))) * 1000n;
        this.sequence = timestamp > this.sequence ? timestamp : this.sequence + 1n;
        const name = `${String(this.sequence).padStart(20, '0')}-${randomUUID()}.tiktok-bridge.json`;
        atomicWrite(path.join(this.directory, name), event);
        return name;
    }
}

module.exports = { MAX_EVENTS, OWN_EVENT, OWN_AVATAR, regularFile, readJson, optionalJson, atomicWrite,
    safeDirectory, layout, processAlive, acquireLock, DedupeJournal, EventSpool };
