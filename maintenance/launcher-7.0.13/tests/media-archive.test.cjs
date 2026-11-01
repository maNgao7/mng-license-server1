'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { readMediaArchive } = require('../lib/media-archive.cjs');
const { createMediaStudio } = require('../lib/media-studio.cjs');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-archive-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const category = path.join(root, 'Racon');
    fs.mkdirSync(category);
    const bytes = Buffer.from('isolated synthetic video fixture');
    fs.writeFileSync(path.join(category, '001-id164-ESREF-TEK.mp4'), bytes);
    const entry = { id: 164, title: 'EŞREF TEK', category: 'Racon', relativePath: 'Racon/001-id164-ESREF-TEK.mp4',
        localPath: 'Z:/ignored-stale-location.mp4', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    return { root, entry, write(entries = [entry]) { fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(entries)); } };
}

test('archive original titles and categories survive import, restart, and rename without changing overlay ID', async t => {
    const f = fixture(t); f.write();
    const archive = await readMediaArchive(f.root);
    assert.equal(archive[0].title, 'EŞREF TEK');
    assert.equal(archive[0].category, 'Racon');
    const values = new Map();
    const store = { get: (key, fallback) => values.get(key) ?? fallback, set: (key, value) => values.set(key, structuredClone(value)) };
    const config = { store, root: path.join(f.root, 'owned'), accessKey: 'isolated-test-key' };
    let studio = createMediaStudio(config);
    const [item] = await studio.importFiles(archive.map(file => file.path), archive);
    assert.equal(item.title, 'EŞREF TEK');
    assert.equal(item.filename, '001-id164-ESREF-TEK.mp4');
    assert.equal(item.category, 'Racon');
    studio.close(); studio = createMediaStudio(config); t.after(() => studio.close());
    const [saved] = studio.list();
    assert.equal(saved.title, 'EŞREF TEK');
    assert.equal(saved.category, 'Racon');
    const renamed = studio.save({ id: saved.id, title: 'Benim videom', giftId: '5655' });
    assert.equal(renamed.previewUrl, saved.previewUrl);
    assert.equal(renamed.id, item.id);
    assert.equal(renamed.giftId, '5655');
});

test('ordinary folders fall back to file titles and directory categories', async t => {
    const f = fixture(t);
    const [item] = await readMediaArchive(f.root);
    assert.equal(item.title, '001-id164-ESREF-TEK');
    assert.equal(item.category, 'Racon');
});

for (const [name, change] of [
    ['path traversal', entry => { entry.relativePath = '../outside.mp4'; }],
    ['absolute path', entry => { entry.relativePath = 'C:/outside.mp4'; }],
    ['wrong bytes', entry => { entry.bytes++; }],
    ['wrong hash', entry => { entry.sha256 = '0'.repeat(64); }],
    ['invalid title', entry => { entry.title = ''; }],
    ['invalid category', entry => { entry.category = 'a'.repeat(81); }]
]) test(`archive rejects ${name} before import`, async t => {
    const f = fixture(t); change(f.entry); f.write();
    await assert.rejects(readMediaArchive(f.root));
});

test('duplicate manifest records are not silently duplicated', async t => {
    const f = fixture(t); f.write([f.entry, f.entry]);
    await assert.rejects(readMediaArchive(f.root), /birden fazla/);
});

test('malformed metadata does not copy any media or change the store', async t => {
    const f = fixture(t);
    const store = { get: (_key, fallback) => fallback, set: () => assert.fail('must not persist invalid import') };
    const owned = path.join(f.root, 'owned');
    const studio = createMediaStudio({ store, root: owned, accessKey: 'isolated-test-key' });
    t.after(() => studio.close());
    await assert.rejects(studio.importFiles([path.join(f.root, f.entry.relativePath)], [{ title: '', category: 'Racon' }]));
    assert.equal(fs.existsSync(owned), false);
});
