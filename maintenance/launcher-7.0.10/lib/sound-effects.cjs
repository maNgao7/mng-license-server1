'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const ASSET_ROOT = path.join(PACKAGE_ROOT, 'renderer', 'assets', 'sound-effects');

// Reviewed pins live in code, never in renderer input or the descriptive manifest.
// `file` is a basename: preview at assets/sound-effects/<file> in the renderer.
const CATALOG = Object.freeze([
    {
        id: 'gift-chime', title: 'Hediye bildirimi', category: 'Hediyeler', file: 'gift-chime.wav', bytes: 61484,
        sha256: '34b6b45d02234726c15bb9645ce62ef6786da9f6f0edd2c2307e5d63a8f7db6f'
    },
    {
        id: 'success', title: 'Zafer', category: 'Sonuçlar', file: 'success.wav', bytes: 49964,
        sha256: '7b1330bfaba36ea6ac802783f9cba9003736d95209b5806a350942e29bee5bad'
    },
    {
        id: 'fail', title: 'Kaybetme', category: 'Sonuçlar', file: 'fail.wav', bytes: 56364,
        sha256: 'f0514ae43a5206f3c6bc9bc75e3ebb5f1f515ad9e16e11ccbc94424122a90f08'
    },
    {
        id: 'countdown', title: 'Geri sayım', category: 'Zamanlayıcılar', file: 'countdown.wav', bytes: 89644,
        sha256: 'ece583b7602fb08a63218db0963f151471730a12e4f85e66b4ccb08fa3e49b15'
    },
    {
        id: 'turbo', title: 'Turbo', category: 'Güçlendirmeler', file: 'turbo.wav', bytes: 58924,
        sha256: '6964a2b01fb111bf54112c1380ac055d74fcde081d2807453b3a1f6799abe996'
    },
    {
        id: 'dramatic-sting', title: 'Gerilim', category: 'Dramatik', file: 'dramatic-sting.wav', bytes: 76844,
        sha256: '3039cd7ab5da1077ce524fbd5138d07f67f79293757c2a2fa697c6f44c4a633e'
    },
    {
        id: 'alert', title: 'Yayın uyarısı', category: 'Bildirimler', file: 'alert.wav', bytes: 43564,
        sha256: 'f067bd5792046975ddb436026fa88ffaea3549a876dfdb150543df7f9f25ff9d'
    },
    {
        id: 'coin', title: 'Coin', category: 'Ödüller', file: 'coin.wav', bytes: 26924,
        sha256: 'e1195e2da6726954c8ba7087de25e6a1ba7de61560afe2c72117648a25b896b0'
    },
    {
        id: 'bubble-pop', title: 'Baloncuk', category: 'Oyun efektleri', file: 'bubble-pop.wav', bytes: 15404,
        sha256: '25ff344e708335b8af7db35bb3625b841cbc7a40fe4b6903c9c3a68559cd1430'
    },
    {
        id: 'laser-zap', title: 'Lazer', category: 'Oyun efektleri', file: 'laser-zap.wav', bytes: 32044,
        sha256: '8a8d1ce7b924b05d7d6f88ba1df000b18d8eabd454f2b97925d332ae0bfcdaea'
    }
].map(record => Object.freeze(record)));

const REGISTERED = new Map(CATALOG.map(record => [record.id, record]));

function failure(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function samePath(a, b) {
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isPcmWav(data) {
    if (data.length < 44 || data.length > 128044) return false;
    return data.toString('latin1', 0, 4) === 'RIFF' &&
        data.readUInt32LE(4) === data.length - 8 &&
        data.toString('latin1', 8, 16) === 'WAVEfmt ' &&
        data.readUInt32LE(16) === 16 &&
        data.readUInt16LE(20) === 1 &&
        data.readUInt16LE(22) === 1 &&
        data.readUInt32LE(24) === 32000 &&
        data.readUInt32LE(28) === 64000 &&
        data.readUInt16LE(32) === 2 &&
        data.readUInt16LE(34) === 16 &&
        data.toString('latin1', 36, 40) === 'data' &&
        data.readUInt32LE(40) === data.length - 44 &&
        (data.length - 44) % 2 === 0 &&
        data.length - 44 >= 6400;
}

function getSound(id) {
    const record = typeof id === 'string' ? REGISTERED.get(id) : undefined;
    if (!record) throw failure('ERR_SOUND_EFFECT_UNKNOWN', 'Unknown built-in sound effect.');

    try {
        // app.asar itself is a file. Only its virtual child directories need directory stats.
        let directory = PACKAGE_ROOT;
        for (const segment of ['renderer', 'assets', 'sound-effects']) {
            directory = path.join(directory, segment);
            const stat = fs.lstatSync(directory);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Linked asset directory');
        }
        const trustedRoot = path.join(fs.realpathSync(PACKAGE_ROOT), 'renderer', 'assets', 'sound-effects');
        if (!samePath(fs.realpathSync(ASSET_ROOT), trustedRoot)) throw new Error('Asset directory escaped package');

        const filename = path.join(ASSET_ROOT, record.file);
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.bytes) throw new Error('Invalid sound file');
        if (!samePath(fs.realpathSync(filename), path.join(trustedRoot, record.file))) throw new Error('Sound path escaped package');

        // Check on every lookup so a previously verified file cannot mask corruption.
        const data = fs.readFileSync(filename);
        if (data.length !== record.bytes || !isPcmWav(data) ||
            crypto.createHash('sha256').update(data).digest('hex') !== record.sha256) {
            throw new Error('Sound integrity mismatch');
        }
        return Object.freeze({ path: filename, title: record.title, category: record.category });
    } catch {
        throw failure('ERR_SOUND_EFFECT_INTEGRITY', 'Built-in sound effect could not be verified.');
    }
}

module.exports = Object.freeze({ CATALOG, getSound });
