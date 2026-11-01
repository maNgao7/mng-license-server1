'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createSpeechCredentials } = require('../lib/speech-credentials.cjs');

const STORE_KEY = 'speech_credentials_v1';
const SECRET = 'synthetic-private-speech-key';

function fixture() {
    const entries = new Map(); const writes = [];
    const encryptionKey = crypto.randomBytes(32);
    const store = {
        get: (key, fallback) => entries.has(key) ? structuredClone(entries.get(key)) : fallback,
        set: (key, value) => { writes.push({ key, value: structuredClone(value) }); entries.set(key, structuredClone(value)); }
    };
    // A real cipher models safeStorage's opaque Buffer contract without touching OS/user data.
    const safeStorage = {
        isEncryptionAvailable: () => true,
        encryptString(text) {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
            const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            return Buffer.concat([iv, cipher.getAuthTag(), data]);
        },
        decryptString(buffer) {
            assert.ok(Buffer.isBuffer(buffer));
            const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, buffer.subarray(0, 12));
            decipher.setAuthTag(buffer.subarray(12, 28));
            return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
        }
    };
    return { entries, writes, store, safeStorage, credentials: createSpeechCredentials({ store, safeStorage }) };
}

test('unconfigured reads return undefined, empty submissions return {}, and neither needs OS encryption', () => {
    const f = fixture(); f.safeStorage.isEncryptionAvailable = () => false;
    assert.equal(f.credentials.read(), undefined);
    assert.deepEqual(f.credentials.write({ key: '', region: '' }), {});
    assert.deepEqual(f.credentials.write({ key: '', region: 'westeurope' }), {});
    assert.equal(f.writes.length, 0);
    f.entries.set(STORE_KEY, null);
    assert.equal(f.credentials.read(), undefined);
});

test('write returns main-only config and stores exactly ciphertext, marker, and normalized region', () => {
    const f = fixture();
    const config = { key: SECRET, region: 'westeurope' };
    assert.deepEqual(f.credentials.write({ key: ` ${SECRET} `, region: ' WestEurope ' }), config);
    const saved = f.entries.get(STORE_KEY);
    assert.deepEqual(Object.keys(saved).sort(), ['cipher', 'encryptedKey', 'region']);
    assert.equal(saved.cipher, 'electron.safeStorage.v1');
    assert.ok(!JSON.stringify(saved).includes(SECRET));
    assert.notEqual(Buffer.from(saved.encryptedKey, 'base64').toString('utf8'), SECRET);
    assert.deepEqual(f.credentials.read(), config);
    const restarted = createSpeechCredentials({ store: f.store, safeStorage: f.safeStorage });
    assert.deepEqual(restarted.read(), config);
    assert.equal(f.writes[0].key, STORE_KEY);
});

test('blank/omitted key preserves existing key; omitted or blank region preserves region', () => {
    const f = fixture(); f.credentials.write({ key: SECRET, region: 'westeurope' });
    assert.deepEqual(f.credentials.write({ key: ' ', region: 'eastus' }), { key: SECRET, region: 'eastus' });
    assert.deepEqual(f.credentials.write({ region: 'swedencentral' }), { key: SECRET, region: 'swedencentral' });
    assert.deepEqual(f.credentials.write({ key: 'replacement', region: '' }), { key: 'replacement', region: 'swedencentral' });
    assert.deepEqual(f.credentials.write(), { key: 'replacement', region: 'swedencentral' });
});

test('explicit clear writes null, returns {}, and works when encryption or old data is broken', () => {
    const f = fixture(); f.entries.set(STORE_KEY, { key: SECRET });
    f.safeStorage.isEncryptionAvailable = () => false;
    assert.deepEqual(f.credentials.write({ clear: true }), {});
    assert.deepEqual(f.writes, [{ key: STORE_KEY, value: null }]);
    assert.equal(f.credentials.read(), undefined);
});

test('unavailable OS encryption, missing safeStorage, and basic_text reject saves without plaintext', () => {
    for (const unavailable of [false, 'basic_text', 'missing', 'throws']) {
        const f = fixture();
        if (unavailable === false) f.safeStorage.isEncryptionAvailable = () => false;
        if (unavailable === 'basic_text') f.safeStorage.getSelectedStorageBackend = () => 'basic_text';
        if (unavailable === 'throws') f.safeStorage.isEncryptionAvailable = () => { throw Error(SECRET); };
        const credentials = unavailable === 'missing' ? createSpeechCredentials({ store: f.store }) : f.credentials;
        assert.throws(() => credentials.write({ key: SECRET, region: 'westeurope' }), error => error.code === 'CREDENTIALS_UNAVAILABLE' && !String(error).includes(SECRET));
        assert.equal(f.writes.length, 0);
    }
});

test('key and region validation is bounded, rejects CR/LF before trimming, and leaves stored data intact', () => {
    const f = fixture(); f.credentials.write({ key: SECRET, region: 'westeurope' });
    const saved = f.entries.get(STORE_KEY);
    for (const key of [null, 123, {}, 'a'.repeat(513), `${SECRET}\r`, `\n${SECRET}`, `${SECRET}\u0000`]) {
        assert.throws(() => f.credentials.write({ key, region: 'eastus' }), { code: 'CREDENTIALS_INVALID_KEY' });
    }
    for (const region of [null, 123, {}, 'a'.repeat(65), 'https://eastus', 'eastus/path', 'eastus.example', 'eastus\r', '\neastus']) {
        assert.throws(() => f.credentials.write({ key: SECRET, region }), { code: 'CREDENTIALS_INVALID_REGION' });
    }
    const empty = fixture();
    assert.throws(() => empty.credentials.write({ key: SECRET }), { code: 'CREDENTIALS_INVALID_REGION' });
    assert.deepEqual(f.entries.get(STORE_KEY), saved);
    assert.equal(f.writes.length, 1);
});

test('plaintext, unknown markers, malformed base64, and oversized records are never decrypted', () => {
    const f = fixture(); f.credentials.write({ key: SECRET, region: 'westeurope' });
    const good = f.entries.get(STORE_KEY); let decrypts = 0;
    f.safeStorage.decryptString = () => { decrypts++; return SECRET; };
    for (const saved of [SECRET, [], { key: SECRET, region: 'westeurope' },
        { ...good, key: SECRET }, { ...good, cipher: 'plaintext' }, { ...good, encryptedKey: '' },
        { ...good, encryptedKey: '%%%notbase64' }, { ...good, encryptedKey: 'YQ' },
        { ...good, encryptedKey: 'A'.repeat(8196) }, { ...good, region: 'bad/region' }]) {
        f.entries.set(STORE_KEY, saved);
        assert.throws(() => f.credentials.read(), error => error.code === 'CREDENTIALS_CORRUPT' && !String(error).includes(SECRET));
    }
    assert.equal(decrypts, 0);
});

test('loss of encryption and decryption failures never silently clear an existing credential', () => {
    const f = fixture(); f.credentials.write({ key: SECRET, region: 'westeurope' });
    f.safeStorage.isEncryptionAvailable = () => false;
    assert.throws(() => f.credentials.read(), { code: 'CREDENTIALS_UNAVAILABLE' });
    assert.throws(() => f.credentials.write({ key: '', region: 'eastus' }), { code: 'CREDENTIALS_UNAVAILABLE' });
    f.safeStorage.isEncryptionAvailable = () => true;
    f.safeStorage.decryptString = () => { throw Error(SECRET); };
    assert.throws(() => f.credentials.read(), error => error.code === 'CREDENTIALS_DECRYPT_FAILED' && !String(error).includes(SECRET));
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.credentials.write({ key: 'new-key', region: 'eastus' }), { key: 'new-key', region: 'eastus' });
});

test('store and encrypt exceptions expose only fixed errors and never persist plaintext', () => {
    for (const operation of ['get', 'set', 'encrypt']) {
        const f = fixture();
        const fail = () => { throw Object.assign(Error(SECRET), { cause: SECRET }); };
        if (operation === 'encrypt') f.safeStorage.encryptString = fail;
        else f.store[operation] = fail;
        const invoke = operation === 'get' ? () => f.credentials.read() : () => f.credentials.write({ key: SECRET, region: 'westeurope' });
        assert.throws(invoke, error => !String(error).includes(SECRET) && error.cause === undefined && error.code.startsWith('CREDENTIALS_'));
        assert.equal(f.writes.length, 0);
    }
    const f = fixture(); f.safeStorage.encryptString = () => SECRET;
    assert.throws(() => f.credentials.write({ key: SECRET, region: 'westeurope' }), { code: 'CREDENTIALS_ENCRYPT_FAILED' });
    assert.equal(f.writes.length, 0);
});
