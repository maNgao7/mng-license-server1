'use strict';

const STORE_KEY = 'speech_credentials_v1';
const CIPHER = 'electron.safeStorage.v1';
const MAX_KEY_LENGTH = 512;
const MAX_CIPHERTEXT_LENGTH = 8192;
const CONTROL = /[\u0000-\u001F\u007F]/;

function failure(code) {
    const messages = {
        CREDENTIALS_UNAVAILABLE: 'OS credential encryption is unavailable.',
        CREDENTIALS_INVALID_KEY: 'The speech credential key is invalid.',
        CREDENTIALS_INVALID_REGION: 'The speech credential region is invalid.',
        CREDENTIALS_CORRUPT: 'Saved speech credentials are invalid.',
        CREDENTIALS_READ_FAILED: 'Saved speech credentials could not be read.',
        CREDENTIALS_WRITE_FAILED: 'Speech credentials could not be saved.',
        CREDENTIALS_ENCRYPT_FAILED: 'Speech credentials could not be encrypted.',
        CREDENTIALS_DECRYPT_FAILED: 'Saved speech credentials could not be decrypted.'
    };
    return Object.assign(new Error(messages[code]), { code });
}

function cleanKey(value) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > MAX_KEY_LENGTH || CONTROL.test(value)) throw failure('CREDENTIALS_INVALID_KEY');
    return value.trim();
}

function cleanRegion(value) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 64 || CONTROL.test(value)) throw failure('CREDENTIALS_INVALID_REGION');
    const region = value.trim().toLowerCase();
    if (region && !/^[a-z][a-z0-9]{1,40}$/.test(region)) throw failure('CREDENTIALS_INVALID_REGION');
    return region;
}

// Main-process only: both read() and write() return plaintext configuration.
// Do not return either result to a renderer or include it in a snapshot/log.
// Electron 31 uses the synchronous safeStorage API; instantiate after app.ready.
function createSpeechCredentials({ store, safeStorage } = {}) {
    if (typeof store?.get !== 'function' || typeof store?.set !== 'function') throw new TypeError('Credential store.get/set required.');

    function requireEncryption() {
        let available = false;
        try {
            available = safeStorage?.isEncryptionAvailable?.() === true &&
                typeof safeStorage.encryptString === 'function' && typeof safeStorage.decryptString === 'function';
            if (available && typeof safeStorage.getSelectedStorageBackend === 'function' &&
                safeStorage.getSelectedStorageBackend() === 'basic_text') available = false;
        } catch { available = false; }
        if (!available) throw failure('CREDENTIALS_UNAVAILABLE');
    }

    function persist(value) {
        try { store.set(STORE_KEY, value); }
        catch { throw failure('CREDENTIALS_WRITE_FAILED'); }
    }

    function read() {
        let saved;
        try { saved = store.get(STORE_KEY, null); }
        catch { throw failure('CREDENTIALS_READ_FAILED'); }
        if (saved === null || saved === undefined) return undefined;
        if (typeof saved !== 'object' || Array.isArray(saved) || saved.cipher !== CIPHER ||
            Object.keys(saved).sort().join(',') !== 'cipher,encryptedKey,region' ||
            typeof saved.encryptedKey !== 'string' || !saved.encryptedKey ||
            saved.encryptedKey.length > MAX_CIPHERTEXT_LENGTH ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(saved.encryptedKey)) throw failure('CREDENTIALS_CORRUPT');
        let region;
        try { region = cleanRegion(saved.region); }
        catch { throw failure('CREDENTIALS_CORRUPT'); }
        if (!region || saved.region !== region) throw failure('CREDENTIALS_CORRUPT');
        const encrypted = Buffer.from(saved.encryptedKey, 'base64');
        if (!encrypted.length || encrypted.toString('base64') !== saved.encryptedKey) throw failure('CREDENTIALS_CORRUPT');
        requireEncryption();
        let decrypted;
        try { decrypted = safeStorage.decryptString(encrypted); }
        catch { throw failure('CREDENTIALS_DECRYPT_FAILED'); }
        let key;
        try { key = cleanKey(decrypted); }
        catch { throw failure('CREDENTIALS_CORRUPT'); }
        if (!key) throw failure('CREDENTIALS_CORRUPT');
        return { key, region };
    }

    function write(config = {}) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw failure('CREDENTIALS_INVALID_KEY');
        if (config.clear === true) { persist(null); return {}; }
        const submittedKey = cleanKey(config.key);
        const submittedRegion = cleanRegion(config.region);
        // Complete replacements can recover a corrupt or undecryptable old entry.
        const previous = submittedKey && submittedRegion ? undefined : read();
        const key = submittedKey || previous?.key || '';
        const region = submittedRegion || previous?.region || '';
        if (!key) return {};
        if (!region) throw failure('CREDENTIALS_INVALID_REGION');
        requireEncryption();
        let encrypted;
        try { encrypted = safeStorage.encryptString(key); }
        catch { throw failure('CREDENTIALS_ENCRYPT_FAILED'); }
        if (!Buffer.isBuffer(encrypted) || !encrypted.length ||
            encrypted.toString('base64').length > MAX_CIPHERTEXT_LENGTH) throw failure('CREDENTIALS_ENCRYPT_FAILED');
        persist({ cipher: CIPHER, encryptedKey: encrypted.toString('base64'), region });
        return { key, region };
    }

    return { read, write };
}

module.exports = { createSpeechCredentials };
