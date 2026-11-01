'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const registry = require('../lib/sound-effects.cjs');
const { CATALOG, getSound } = registry;
const { renderPack } = require('../tools/build-sound-effects.cjs');

const LAUNCHER_ROOT = path.resolve(__dirname, '..');
const ASSET_ROOT = path.join(LAUNCHER_ROOT, 'renderer/assets/sound-effects');
const SOURCE = fs.readFileSync(path.join(LAUNCHER_ROOT, 'lib/sound-effects.cjs'), 'utf8');
const EXPECTED_IDS = ['gift-chime', 'success', 'fail', 'countdown', 'turbo', 'dramatic-sting', 'alert', 'coin', 'bubble-pop', 'laser-zap'];
const TURKISH_LABELS = [
    ['Hediye bildirimi', 'Hediyeler'], ['Zafer', 'Sonuçlar'], ['Kaybetme', 'Sonuçlar'],
    ['Geri sayım', 'Zamanlayıcılar'], ['Turbo', 'Güçlendirmeler'], ['Gerilim', 'Dramatik'],
    ['Yayın uyarısı', 'Bildirimler'], ['Coin', 'Ödüller'], ['Baloncuk', 'Oyun efektleri'], ['Lazer', 'Oyun efektleri']
];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const read = record => fs.readFileSync(path.join(ASSET_ROOT, record.file));

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-sound-effects-'));
    const assets = path.join(root, 'renderer/assets/sound-effects');
    fs.mkdirSync(assets, { recursive: true });
    for (const record of CATALOG) fs.copyFileSync(path.join(ASSET_ROOT, record.file), path.join(assets, record.file));
    fs.copyFileSync(path.join(ASSET_ROOT, 'manifest.json'), path.join(assets, 'manifest.json'));
    t.after(() => {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return {
        root, assets,
        load(source = SOURCE) {
            const context = { require, Buffer, process, __dirname: path.join(root, 'lib'), module: { exports: {} } };
            vm.runInNewContext(source, context, { filename: 'sound-effects.cjs', timeout: 1000 });
            return context.module.exports;
        }
    };
}

function pcm(data) {
    return Array.from({ length: (data.length - 44) / 2 }, (_, i) => data.readInt16LE(44 + i * 2) / 32768);
}

function similarity(a, b, stretch) {
    let dot = 0;
    let aa = 0;
    let bb = 0;
    const length = stretch ? 4096 : Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
        const x = a[stretch ? Math.floor(i * a.length / length) : i];
        const y = b[stretch ? Math.floor(i * b.length / length) : i];
        dot += x * y;
        aa += x * x;
        bb += y * y;
    }
    return Math.abs(dot / Math.sqrt(aa * bb));
}

test('exports exactly the immutable pinned catalog and ID resolver', () => {
    assert.deepEqual(Object.keys(registry).sort(), ['CATALOG', 'getSound']);
    assert.ok(Object.isFrozen(registry));
    assert.ok(Object.isFrozen(CATALOG));
    assert.deepEqual(CATALOG.map(record => record.id), EXPECTED_IDS);
    assert.deepEqual(CATALOG.map(({ title, category }) => [title, category]), TURKISH_LABELS);
    assert.equal(new Set(CATALOG.map(record => record.file)).size, CATALOG.length);
    for (const record of CATALOG) {
        assert.ok(Object.isFrozen(record));
        assert.deepEqual(Object.keys(record).sort(), ['bytes', 'category', 'file', 'id', 'sha256', 'title']);
        assert.match(record.id, /^[a-z]+(?:-[a-z]+)*$/);
        assert.equal(record.file, `${record.id}.wav`);
        assert.match(record.sha256, /^[a-f0-9]{64}$/);
        assert.ok(Number.isSafeInteger(record.bytes) && record.bytes > 44);
        assert.ok(record.title.length > 0 && record.category.length > 0);
        const sound = getSound(record.id);
        assert.deepEqual(sound, { path: path.join(ASSET_ROOT, record.file), title: record.title, category: record.category });
        assert.ok(path.isAbsolute(sound.path));
        assert.ok(Object.isFrozen(sound));
    }
    assert.throws(() => { CATALOG[0].file = '../private.wav'; }, TypeError);
    assert.throws(() => { CATALOG.push({ id: 'injected' }); }, TypeError);
    assert.throws(() => { registry.getSound = () => ({ path: 'private' }); }, TypeError);
    const sound = getSound('gift-chime');
    assert.throws(() => { sound.path = 'private'; }, TypeError);
});

test('rejects unknown IDs, objects, coercion, URLs and arbitrary paths', () => {
    let coercions = 0;
    const tricky = { toString() { coercions++; return 'gift-chime'; } };
    const invalid = [undefined, null, true, 0, {}, [], tricky, new String('gift-chime'), Symbol('gift-chime'),
        '', 'GIFT-CHIME', 'gift-chime ', '__proto__', 'constructor', 'toString', 'then',
        '../gift-chime', '../assets/private.wav', '..\\gift-chime', 'gift-chime.wav',
        'gift-chime\0', '%2e%2e/secret', 'file:///private.wav', 'https://example.invalid/audio.wav',
        path.join(ASSET_ROOT, 'gift-chime.wav'), 'C:\\private.wav'];
    for (const id of invalid) assert.throws(() => getSound(id), { code: 'ERR_SOUND_EFFECT_UNKNOWN' });
    assert.equal(coercions, 0);
});

test('manifest documents every original effect and the entire pack stays below 1 MB', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ASSET_ROOT, 'manifest.json'), 'utf8'));
    assert.equal(manifest.createdFor, 'TikMnG launcher');
    assert.match(manifest.origin, /Original.*not TikOyun assets/);
    assert.equal(manifest.rights.thirdPartyAssets, false);
    assert.deepEqual(manifest.rights.thirdPartyAttribution, []);
    assert.match(manifest.rights.permission, /commercial use/);
    assert.match(manifest.rights.permission, /No attribution is required/);
    assert.deepEqual(manifest.format, { container: 'WAV', codec: 'PCM', sampleRate: 32000, channels: 1, bitsPerSample: 16 });
    assert.deepEqual(manifest.sounds.map(record => record.id), EXPECTED_IDS);
    for (const record of CATALOG) {
        const description = manifest.sounds.find(sound => sound.id === record.id);
        for (const key of Object.keys(record)) assert.equal(description[key], record[key]);
        assert.ok(description.description.length >= 40);
        assert.ok(description.synthesis.length >= 40);
        assert.equal(description.durationSeconds, (record.bytes - 44) / 64000);
    }
    assert.equal(new Set(manifest.sounds.map(sound => sound.description)).size, CATALOG.length);
    assert.equal(new Set(manifest.sounds.map(sound => sound.synthesis)).size, CATALOG.length);
    const files = fs.readdirSync(ASSET_ROOT).sort();
    assert.deepEqual(files, [...CATALOG.map(record => record.file), 'manifest.json'].sort());
    const total = files.reduce((sum, file) => sum + fs.statSync(path.join(ASSET_ROOT, file)).size, 0);
    assert.ok(total <= 1000000, `pack is ${total} bytes`);
    assert.equal(manifest.totalAudioBytes, CATALOG.reduce((sum, record) => sum + record.bytes, 0));
});

test('all assets have complete canonical PCM headers, pinned hashes, audible samples and click-free edges', () => {
    for (const record of CATALOG) {
        const data = read(record);
        assert.equal(data.length, record.bytes);
        assert.equal(digest(data), record.sha256);
        assert.equal(data.toString('latin1', 0, 4), 'RIFF');
        assert.equal(data.readUInt32LE(4), data.length - 8);
        assert.equal(data.toString('latin1', 8, 16), 'WAVEfmt ');
        assert.equal(data.readUInt32LE(16), 16);
        assert.equal(data.readUInt16LE(20), 1);
        assert.equal(data.readUInt16LE(22), 1);
        assert.equal(data.readUInt32LE(24), 32000);
        assert.equal(data.readUInt32LE(28), 64000);
        assert.equal(data.readUInt16LE(32), 2);
        assert.equal(data.readUInt16LE(34), 16);
        assert.equal(data.toString('latin1', 36, 40), 'data');
        assert.equal(data.readUInt32LE(40), data.length - 44);
        const samples = pcm(data);
        const duration = samples.length / 32000;
        assert.ok(duration >= 0.2 && duration <= 1.5, `${record.id} duration: ${duration}`);
        const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
        const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        assert.ok(peak > 0.65 && peak < 0.75, `${record.id} peak: ${peak}`);
        assert.ok(rms > 0.03 && rms < 0.4, `${record.id} RMS: ${rms}`);
        assert.ok(Math.abs(mean) < 0.005, `${record.id} DC offset: ${mean}`);
        assert.equal(samples[0], 0);
        assert.equal(samples.at(-1), 0);
        assert.equal(samples.filter(value => Math.abs(value) >= 0.999).length, 0);
    }
});

test('every effect has distinct PCM, including normalized or duration-stretched comparisons', () => {
    const decoded = CATALOG.map(record => ({ id: record.id, data: read(record), samples: pcm(read(record)) }));
    assert.equal(new Set(decoded.map(sound => digest(sound.data.subarray(44)))).size, decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        for (let j = i + 1; j < decoded.length; j++) {
            const a = decoded[i];
            const b = decoded[j];
            assert.ok(similarity(a.samples, b.samples, false) < 0.96, `${a.id} and ${b.id} share the same waveform`);
            assert.ok(similarity(a.samples, b.samples, true) < 0.96, `${a.id} and ${b.id} are time-scaled copies`);
        }
    }
});

test('synthesis reproduces every shipped byte and check mode is read-only', () => {
    const pack = renderPack();
    for (const sound of pack.sounds) assert.deepEqual(sound.data, read(sound.record), sound.record.id);
    assert.deepEqual(pack.manifestData, fs.readFileSync(path.join(ASSET_ROOT, 'manifest.json')));
    const files = [...CATALOG.map(record => record.file), 'manifest.json'];
    const before = files.map(file => fs.statSync(path.join(ASSET_ROOT, file)).mtimeMs);
    const result = spawnSync(process.execPath, [path.join(LAUNCHER_ROOT, 'tools/build-sound-effects.cjs'), '--check'],
        { cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Verified 10 original TikMnG effects/);
    assert.deepEqual(files.map(file => fs.statSync(path.join(ASSET_ROOT, file)).mtimeMs), before);
});

test('fails closed for missing, truncated, replaced and same-length corrupted files', async t => {
    const cases = [
        ['missing', file => fs.unlinkSync(file)],
        ['truncated', file => fs.truncateSync(file, 40)],
        ['same-length PCM corruption', file => { const data = fs.readFileSync(file); data[100] ^= 1; fs.writeFileSync(file, data); }],
        ['other registered sound', file => fs.copyFileSync(path.join(ASSET_ROOT, 'coin.wav'), file)],
        ['directory instead of WAV', file => { fs.unlinkSync(file); fs.mkdirSync(file); }]
    ];
    for (const [name, mutate] of cases) {
        await t.test(name, sub => {
            const f = fixture(sub);
            const copy = f.load();
            assert.ok(copy.getSound('gift-chime'));
            mutate(path.join(f.assets, 'gift-chime.wav'));
            assert.throws(() => copy.getSound('gift-chime'), { code: 'ERR_SOUND_EFFECT_INTEGRITY' });
        });
    }
});

test('manifest edits cannot register an ID, redirect a path or authorize changed bytes', t => {
    const f = fixture(t);
    const manifestFile = path.join(f.assets, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const tampered = Buffer.from(read(CATALOG[0]));
    tampered[100] ^= 1;
    manifest.sounds[0] = { ...manifest.sounds[0], file: '../../private.wav', sha256: digest(tampered) };
    manifest.sounds.push({ ...manifest.sounds[0], id: 'injected-sound' });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    const copy = f.load();
    assert.equal(copy.getSound('gift-chime').path, path.join(f.assets, 'gift-chime.wav'));
    assert.throws(() => copy.getSound('injected-sound'), { code: 'ERR_SOUND_EFFECT_UNKNOWN' });
    fs.writeFileSync(path.join(f.assets, 'gift-chime.wav'), tampered);
    assert.throws(() => copy.getSound('gift-chime'), { code: 'ERR_SOUND_EFFECT_INTEGRITY' });
});

test('WAV validation rejects malformed headers even if a revised digest matches', async t => {
    const cases = [
        ['magic', data => data.write('RIFX', 0)],
        ['RIFF length', data => data.writeUInt32LE(data.length, 4)],
        ['container', data => data.write('AVI ', 8)],
        ['fmt chunk', data => data.write('JUNK', 12)],
        ['fmt size', data => data.writeUInt32LE(18, 16)],
        ['non-PCM', data => data.writeUInt16LE(3, 20)],
        ['channels', data => data.writeUInt16LE(2, 22)],
        ['sample rate', data => data.writeUInt32LE(44100, 24)],
        ['byte rate', data => data.writeUInt32LE(1, 28)],
        ['block alignment', data => data.writeUInt16LE(4, 32)],
        ['bit depth', data => data.writeUInt16LE(8, 34)],
        ['data chunk', data => data.write('JUNK', 36)],
        ['data size', data => data.writeUInt32LE(2, 40)]
    ];
    for (const [name, mutate] of cases) {
        await t.test(name, sub => {
            const f = fixture(sub);
            const data = read(CATALOG[0]);
            mutate(data);
            fs.writeFileSync(path.join(f.assets, 'gift-chime.wav'), data);
            const copy = f.load(SOURCE.replace(CATALOG[0].sha256, digest(data)));
            assert.throws(() => copy.getSound('gift-chime'), { code: 'ERR_SOUND_EFFECT_INTEGRITY' });
        });
    }
});

test('rejects redirected directories and asset symlinks without following renderer paths', t => {
    const f = fixture(t);
    const moved = path.join(f.root, 'outside-sounds');
    fs.renameSync(f.assets, moved);
    fs.symlinkSync(moved, f.assets, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => f.load().getSound('gift-chime'), { code: 'ERR_SOUND_EFFECT_INTEGRITY' });
    fs.unlinkSync(f.assets);
    fs.renameSync(moved, f.assets);

    // VM filesystem stubs cover file symlinks on Windows without needing admin rights.
    for (const escape of ['symlink', 'realpath']) {
        const filename = path.join(f.assets, 'gift-chime.wav');
        const fakeFs = Object.create(fs);
        if (escape === 'symlink') {
            fakeFs.lstatSync = target => target === filename ? { isFile: () => true, isSymbolicLink: () => true, size: CATALOG[0].bytes } : fs.lstatSync(target);
        } else {
            fakeFs.realpathSync = target => target === filename ? path.join(f.root, 'outside.wav') : fs.realpathSync(target);
        }
        const context = { require: name => name === 'node:fs' ? fakeFs : require(name), Buffer, process,
            __dirname: path.join(f.root, 'lib'), module: { exports: {} } };
        vm.runInNewContext(SOURCE, context, { timeout: 1000 });
        assert.throws(() => context.module.exports.getSound('gift-chime'), { code: 'ERR_SOUND_EFFECT_INTEGRITY' });
    }
});

test('resolves verified assets in ASAR virtual directories with a file as the package root', t => {
    const f = fixture(t);
    const archive = path.join(f.root, 'app.asar');
    fs.writeFileSync(archive, 'synthetic archive-root stat fixture');
    assert.ok(fs.lstatSync(archive).isFile());
    const physical = target => target === archive ? archive : path.join(f.root, path.relative(archive, target));
    const virtualFs = Object.create(fs);
    virtualFs.lstatSync = target => fs.lstatSync(physical(target));
    virtualFs.readFileSync = target => fs.readFileSync(physical(target));
    virtualFs.realpathSync = target => target === archive ? fs.realpathSync(archive) :
        path.join(archive, path.relative(f.root, fs.realpathSync(physical(target))));
    const context = { require: name => name === 'node:fs' ? virtualFs : require(name), Buffer, process,
        __dirname: path.join(archive, 'lib'), module: { exports: {} } };
    vm.runInNewContext(SOURCE, context, { timeout: 1000 });
    for (const record of CATALOG) {
        const sound = context.module.exports.getSound(record.id);
        assert.equal(sound.path, path.join(archive, 'renderer/assets/sound-effects', record.file));
        assert.equal(sound.title, record.title);
        assert.equal(sound.category, record.category);
    }
});

test('verified effects import through Media Studio without changing existing media or settings', async t => {
    const { createMediaStudio } = require('../lib/media-studio.cjs');
    const f = fixture(t);
    const root = path.join(f.root, 'isolated-media');
    const saved = new Map([['other-settings', { volume: 0.41, selectedGame: 'existing-game' }]]);
    const store = { get: (key, fallback) => structuredClone(saved.get(key) ?? fallback),
        set: (key, value) => saved.set(key, structuredClone(value)) };
    const studio = createMediaStudio({ store, root, accessKey: 'isolated-sound-effects-test', getChannel: () => 'sound-effects-test' });
    t.after(() => studio.close());
    const source = path.join(f.root, 'existing-user-sound.wav');
    fs.writeFileSync(source, read(CATALOG[0]));
    const [existing] = await studio.importFiles([source]);
    studio.save({ id: existing.id, giftId: '5655', volume: 0.41, title: 'Existing saved media' });
    const before = studio.list()[0];
    const existingFile = fs.readdirSync(root)[0];
    const existingHash = digest(fs.readFileSync(path.join(root, existingFile)));
    const sounds = CATALOG.map(record => getSound(record.id));
    const imported = await studio.importFiles(sounds.map(sound => sound.path),
        sounds.map(({ title, category }) => ({ title, category })));
    assert.equal(imported.length, CATALOG.length);
    for (const [index, item] of imported.entries()) {
        assert.equal(item.kind, 'audio');
        assert.equal(item.mime, 'audio/wav');
        assert.equal(item.title, CATALOG[index].title);
        assert.equal(item.category, CATALOG[index].category);
        assert.equal(item.bytes, CATALOG[index].bytes);
        assert.equal(item.giftId, '');
    }
    assert.deepEqual(studio.list().find(item => item.id === existing.id), before);
    assert.equal(digest(fs.readFileSync(path.join(root, existingFile))), existingHash);
    assert.deepEqual(saved.get('other-settings'), { volume: 0.41, selectedGame: 'existing-game' });
});
