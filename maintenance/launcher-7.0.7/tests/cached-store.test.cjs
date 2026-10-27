'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const dotProp = createRequire(require.resolve('conf'))('dot-prop');
const { createCachedStore } = require('../lib/cached-store.cjs');

class FakeStore {
    constructor(initial = {}, { defaults = {}, dotted = true } = {}) {
        this.defaults = structuredClone(defaults);
        this.dotted = dotted;
        this.data = { ...structuredClone(defaults), ...structuredClone(initial) };
        this.events = new EventEmitter();
        this.reads = 0;
        this.writes = 0;
        this.calls = [];
    }

    get store() {
        this.reads++;
        return Object.assign(Object.create(null), structuredClone(this.data));
    }

    set store(value) {
        this.data = structuredClone(value);
        this.writes++;
        this.events.emit('change');
    }

    get(key, defaultValue) {
        const data = this.store;
        return this.dotted ? dotProp.get(data, key, defaultValue) : key in data ? data[key] : defaultValue;
    }

    has(key) {
        const data = this.store;
        return this.dotted ? dotProp.has(data, key) : key in data;
    }

    set(key, value) {
        this.calls.push(['set', key, value]);
        if (typeof key !== 'object' && typeof key !== 'string') throw new TypeError('Invalid key');
        const data = this.store;
        for (const [name, item] of typeof key === 'object' ? Object.entries(key) : [[key, value]]) {
            if (item === undefined) throw new TypeError('Use delete()');
            if (this.dotted) dotProp.set(data, name, item);
            else data[name] = item;
        }
        this.store = data;
        return 'set-result';
    }

    delete(key) {
        this.calls.push(['delete', key]);
        const data = this.store;
        if (this.dotted) dotProp.delete(data, key);
        else delete data[key];
        this.store = data;
        return 'delete-result';
    }

    clear() {
        this.calls.push(['clear']);
        this.store = this.defaults;
        return 'clear-result';
    }

    reset(...keys) {
        for (const key of keys) {
            if (this.defaults[key] !== undefined) this.set(key, this.defaults[key]);
        }
    }

    onDidAnyChange(callback) {
        this.events.on('change', callback);
        return () => this.events.removeListener('change', callback);
    }
}

class EncryptedFakeStore extends FakeStore {
    constructor(file, initial = {}) {
        super();
        this.path = file;
        this.key = crypto.randomBytes(32);
        this.store = initial;
        this.reads = 0;
        this.writes = 0;
    }

    get store() {
        this.reads++;
        let bytes;
        try { bytes = fs.readFileSync(this.path); }
        catch (error) {
            if (error.code === 'ENOENT') return Object.create(null);
            throw error;
        }
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12), { authTagLength: 16 });
        decipher.setAuthTag(bytes.subarray(12, 28));
        const text = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
        return Object.assign(Object.create(null), JSON.parse(text));
    }

    set store(value) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const payload = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
        fs.writeFileSync(this.path, Buffer.concat([iv, cipher.getAuthTag(), payload]));
        this.writes++;
        this.events.emit('change');
    }
}

function temporaryStore(t, initial = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-cache-test-'));
    t.after(() => {
        assert.equal(path.dirname(root), os.tmpdir());
        assert.match(path.basename(root), /^tikmng-cache-test-/);
        fs.rmSync(root, { recursive: true, force: true });
    });
    return new EncryptedFakeStore(path.join(root, 'synthetic-config.bin'), initial);
}

function clocked(backing) {
    let time = 0;
    let stats = 0;
    const store = createCachedStore(backing, {
        checkIntervalMs: 1000,
        now: () => time,
        statSync(file) { stats++; return fs.statSync(file); }
    });
    return { store, advance: ms => { time += ms; }, stats: () => stats };
}

test('repeated gets/has across keys decrypt one snapshot without repeated metadata checks', t => {
    const backing = temporaryStore(t, { widget: { score: 12 }, account: 'synthetic' });
    const f = clocked(backing);
    assert.equal(backing.reads, 0, 'wrapping is lazy');
    for (let i = 0; i < 1000; i++) {
        assert.equal(f.store.get('widget.score'), 12);
        assert.equal(f.store.get('account'), 'synthetic');
        assert.equal(f.store.has('widget.score'), true);
        assert.equal(f.store.has('missing'), false);
    }
    assert.equal(backing.reads, 1);
    assert.equal(f.stats(), 1);
    f.advance(1000);
    assert.equal(f.store.get('account'), 'synthetic');
    assert.equal(f.stats(), 2);
    assert.equal(backing.reads, 1, 'unchanged metadata must not decrypt again');
    assert.equal(backing.writes, 0);
});

test('defaults remain per call and are never cached or persisted with another write', t => {
    const backing = temporaryStore(t, { present: null, zero: 0, disabled: false, empty: '' });
    const store = createCachedStore(backing);
    const before = fs.readFileSync(backing.path);
    const secretDefault = { token: 'synthetic-ephemeral-secret' };
    assert.strictEqual(store.get('credentials', secretDefault), secretDefault);
    secretDefault.token = 'changed-default';
    assert.equal(store.get('credentials', 'another-default'), 'another-default');
    assert.equal(store.get('credentials'), undefined);
    assert.equal(store.has('credentials'), false);
    for (const [key, value] of Object.entries({ present: null, zero: 0, disabled: false, empty: '' })) {
        assert.equal(store.get(key, 'fallback'), value);
        assert.equal(store.has(key), true);
    }
    assert.deepEqual(fs.readFileSync(backing.path), before);
    assert.equal(backing.writes, 0);
    store.set('unrelated', 'persisted');
    assert.equal(Object.hasOwn(backing.store, 'credentials'), false);
    assert.equal(backing.writes, 1);
});

test('dotted, escaped, array and guarded paths match the installed structured helper', () => {
    const backing = new FakeStore({
        nested: { value: 7, nullable: null }, 'literal.key': { value: 8 },
        items: [{ name: 'first' }], '': 'empty-key'
    });
    const store = createCachedStore(backing);
    for (const key of ['nested', 'nested.value', 'nested.nullable', 'nested.nullable.child',
        'literal\\.key.value', 'literal.key.value', 'items.0.name', '', 'missing',
        '__proto__.polluted', 'constructor', 'toString', undefined, null, 1]) {
        for (const fallback of [undefined, null, 'fallback']) {
            assert.deepEqual(store.get(key, fallback), backing.get(key, fallback), String(key));
        }
        assert.equal(store.has(key), backing.has(key), String(key));
    }
    assert.equal(Object.getPrototypeOf(store.get()), null);
    store.set('literal\\.key.value', 9);
    assert.equal(store.get('literal\\.key.value'), 9);
    store.delete('items.0.name');
    assert.equal(store.has('items.0.name'), false);
});

test('literal-key mode matches a store configured without dot notation', () => {
    const backing = new FakeStore({ 'a.b': 1, a: { b: 2 } }, { dotted: false });
    const store = createCachedStore(backing, { accessPropertiesByDotNotation: false });
    assert.equal(store.get('a.b'), 1);
    assert.equal(store.has('a.b'), true);
    store.set('a.b', 3);
    assert.equal(store.get('a.b'), 3);
    assert.deepEqual(store.get('a'), { b: 2 });
    store.delete('a.b');
    assert.equal(store.has('a.b'), false);
    assert.equal(store.get('a.b', 4), 4);
});

test('returned objects, arrays, whole snapshots and write inputs cannot mutate the cache', () => {
    const backing = new FakeStore({ widget: { score: 4 }, items: [{ score: 5 }] });
    const store = createCachedStore(backing);
    store.get('widget').score = 99;
    store.get('items')[0].score = 99;
    store.store.widget.score = 99;
    store.get().items.push({ score: 100 });
    assert.deepEqual(store.get('widget'), { score: 4 });
    assert.deepEqual(store.get('items'), [{ score: 5 }]);
    const input = { score: 6 };
    store.set('widget', input);
    assert.equal(store.get('widget.score'), 6);
    input.score = 88;
    assert.equal(store.get('widget.score'), 6);
    assert.equal(backing.get('widget.score'), 6);
});

test('all successful mutations write through and invalidate parent, child and missing lookups', () => {
    const backing = new FakeStore({ widget: { score: 1 }, old: true }, { defaults: { enabled: true } });
    const store = createCachedStore(backing);
    assert.deepEqual(store.get('widget'), { score: 1 });
    assert.equal(store.has('new'), false);
    assert.equal(store.set('widget.score', 2), 'set-result');
    assert.deepEqual(store.get('widget'), { score: 2 });
    assert.equal(store.get('widget.score'), 2);
    store.set({ widget: { changed: true }, new: 3 });
    assert.equal(store.has('widget.score'), false);
    assert.equal(store.get('widget.changed'), true);
    assert.equal(store.has('new'), true);
    assert.equal(store.delete('widget'), 'delete-result');
    assert.equal(store.has('widget.changed'), false);
    assert.equal(store.get('widget', 'missing'), 'missing');
    store.set('enabled', false);
    store.reset('enabled');
    assert.equal(store.get('enabled'), true);
    assert.equal(store.clear(), 'clear-result');
    assert.deepEqual({ ...store.store }, { enabled: true });
    assert.equal(store.has('new'), false);
    assert.equal(backing.writes, 6);
});

test('store replacement, size, iteration and synchronous change callbacks stay coherent', () => {
    const backing = new FakeStore({ count: 1 });
    const store = createCachedStore(backing);
    assert.equal(store.get('count'), 1);
    const seen = [];
    const unsubscribe = store.onDidAnyChange(() => seen.push(store.get('count')));
    store.set('count', 2);
    store.store = { count: 3, other: true };
    assert.deepEqual(seen, [2, 3]);
    assert.equal(store.size, 2);
    assert.deepEqual([...store], [['count', 3], ['other', true]]);
    assert.strictEqual(store.path, backing.path);
    assert.equal(store instanceof FakeStore, true);
    unsubscribe();
});

test('failed or partially committed mutations propagate errors and discard stale snapshots', () => {
    for (const method of ['set', 'delete', 'clear', 'reset']) {
        const backing = new FakeStore({ value: 1 });
        const store = createCachedStore(backing);
        assert.equal(store.get('value'), 1);
        const failure = new Error('synthetic write failure');
        backing[method] = () => { backing.data.value = 2; throw failure; };
        assert.throws(() => store[method]('value', 3), error => error === failure);
        assert.equal(store.get('value'), 2);
    }
    const backing = new FakeStore({ value: 1 });
    const store = createCachedStore(backing);
    store.get('value');
    assert.throws(() => store.set('value', undefined), /Use delete/);
    assert.equal(store.get('value'), 1);
    assert.equal(backing.writes, 0);
});

test('external edits, deletion, recreation and path replacement are noticed after the throttle', t => {
    const backing = temporaryStore(t, { value: 'old' });
    const f = clocked(backing);
    assert.equal(f.store.get('value'), 'old');
    backing.set('value', 'external-longer-value');
    f.advance(999);
    assert.equal(f.store.get('value'), 'old');
    assert.equal(f.stats(), 1);
    f.advance(1);
    assert.equal(f.store.get('value'), 'external-longer-value');
    fs.unlinkSync(backing.path);
    f.advance(1000);
    assert.equal(f.store.has('value'), false);
    backing.set('value', 'recreated');
    f.advance(1000);
    assert.equal(f.store.get('value'), 'recreated');
    const nextFile = path.join(path.dirname(backing.path), 'other-synthetic-config.bin');
    fs.copyFileSync(backing.path, nextFile);
    const reads = backing.reads;
    f.store.path = nextFile;
    assert.equal(f.store.get('value'), 'recreated');
    assert.equal(backing.reads, reads + 1);
});

test('inode/ctime changes invalidate even when file size and mtime stay the same', () => {
    const backing = new FakeStore({ value: 1 });
    backing.path = 'synthetic-path-never-opened';
    let time = 0;
    const metadata = { dev: 1, ino: 2, size: 8, mtimeMs: 10, ctimeMs: 10 };
    const store = createCachedStore(backing, { now: () => time, statSync: () => ({ ...metadata }) });
    assert.equal(store.get('value'), 1);
    backing.data.value = 2;
    metadata.ino++;
    time += 1000;
    assert.equal(store.get('value'), 2);
    backing.data.value = 3;
    metadata.ctimeMs++;
    time += 1000;
    assert.equal(store.get('value'), 3);
});

test('explicit reload bypasses throttle and refreshes in-memory stores without a path', () => {
    const backing = new FakeStore({ value: 1 });
    const store = createCachedStore(backing);
    assert.equal(store.get('value'), 1);
    backing.data.value = 2;
    assert.equal(store.get('value'), 1);
    assert.strictEqual(store.reload(), store);
    assert.equal(store.get('value'), 2);
    assert.equal(backing.writes, 0);
});

test('reload forces a fresh decrypt even when metadata is unchanged', t => {
    const backing = temporaryStore(t, { value: 1 });
    const f = clocked(backing);
    f.store.get('value');
    f.store.reload();
    assert.equal(backing.reads, 2);
    assert.equal(f.stats(), 2);
    assert.equal(backing.writes, 0);
});

test('metadata and decrypt failures are surfaced, then a repaired store can be reloaded', t => {
    const backing = temporaryStore(t, { value: 1 });
    const f = clocked(backing);
    assert.equal(f.store.get('value'), 1);
    fs.writeFileSync(backing.path, 'synthetic corrupt fixture');
    f.advance(1000);
    assert.throws(() => f.store.get('value'));
    backing.store = { value: 2 };
    assert.equal(f.store.reload().get('value'), 2);
    const denied = Object.assign(new Error('synthetic permission error'), { code: 'EACCES' });
    const deniedStore = createCachedStore(backing, { statSync: () => { throw denied; } });
    assert.throws(() => deniedStore.get('value'), error => error === denied);
});

test('writes keep synthetic backing bytes encrypted and persist immediately', t => {
    const backing = temporaryStore(t, { token: 'synthetic-persisted-secret' });
    const store = createCachedStore(backing);
    assert.equal(store.get('token'), 'synthetic-persisted-secret');
    store.set('token', 'synthetic-new-secret');
    const bytes = fs.readFileSync(backing.path);
    assert.equal(bytes.includes(Buffer.from('synthetic-new-secret')), false);
    assert.equal(bytes.includes(Buffer.from('token')), false);
    assert.throws(() => JSON.parse(bytes.toString('utf8')));
    assert.equal(backing.get('token'), 'synthetic-new-secret');
    assert.equal(backing.writes, 1);
    assert.equal(backing.calls[0][0], 'set');
});

test('existing fallback stores pass through without probing data or writing defaults', () => {
    const values = new Map();
    const fallback = {
        get: (key, value) => values.has(key) ? values.get(key) : value,
        set: (key, value) => values.set(key, value),
        delete: key => values.delete(key)
    };
    assert.strictEqual(createCachedStore(fallback), fallback);
    assert.equal(fallback.get('missing', 'ephemeral'), 'ephemeral');
    assert.equal(values.size, 0);
});

test('invalid stores and throttle options fail before reading any data', () => {
    assert.throws(() => createCachedStore(null), /get\/set/);
    assert.throws(() => createCachedStore({}), /get\/set/);
    const backing = new FakeStore();
    for (const checkIntervalMs of [0, -1, NaN, Infinity, '1000']) {
        assert.throws(() => createCachedStore(backing, { checkIntervalMs }), /positive finite/);
    }
    assert.throws(() => createCachedStore(backing, { now: 1 }), /must be functions/);
    assert.throws(() => createCachedStore(backing, { statSync: null }), /must be functions/);
    assert.equal(backing.reads, 0);
});
