import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'maintenance', 'zombie-war');
const standards = JSON.parse(fs.readFileSync(path.join(directory, 'standard-gifts.json'), 'utf8'));

test('Zombie War distribution contains exactly the requested 15 gift mappings', () => {
    assert.equal(standards.version, 11);
    assert.equal(standards.gifts.length, 15);
    const expected = {
        '5655': ['ZOMBIE', 2, 'zombie'], '5319': ['ZOMBIE', 5, 'zombie'],
        '5879': ['HELPER', 3, 'zombie'], '5658': ['FLASH', 5, 'zombie'],
        '17473': ['INFINITE', 300, 'zombie'], '8913': ['UPGRADE', 1, 'zombie'],
        '5303': ['VOICE_FIRE', 180, 'zombie'], '5282': ['DOWNGRADE', 1, 'zombie'],
        '5486': ['STRONG_ZOMBIE', 1, 'mutant'], '6427': ['CHAOS', 1, 'zombie'],
        '7168': ['VOICE_FIRE', 300, 'zombie'], '5994': ['ZOMBIE', 5, 'spider'],
        '6267': ['CLEAR', 1, 'zombie'], '11046': ['VOICE_FIRE', 600, 'zombie'],
        '7934': ['HELPER', 1, 'zombie']
    };
    const ids = new Set();
    for (const gift of standards.gifts) {
        assert.equal(ids.has(gift.id), false); ids.add(gift.id);
        assert.deepEqual([gift.action, gift.amount, gift.target], expected[gift.id]);
        assert.equal(gift.threshold, 1);
        assert.ok(gift.name.trim());
    }
    assert.deepEqual([...ids].sort(), Object.keys(expected).sort());
});

test('downloadable guide is the unmodified user image at full resolution', () => {
    const png = fs.readFileSync(path.join(directory, 'assets', 'tikmng_zombie_war_gift_guide.png'));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 8091);
    assert.equal(png.readUInt32BE(20), 4695);
    assert.equal(crypto.createHash('sha256').update(png).digest('hex'), '9c8fab556afa507002232f1ef99e0c5b5edde0aaf35e5c74c95fcabf7dce7f52');
});

test('catalog keeps the independent game update while the approved launcher release advances', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'content-defaults.json'), 'utf8'));
    const game = catalog.games.find(game => game.id === 'zombie-war');
    assert.equal(game.version, '6.5.17');
    assert.equal(game.url, 'https://github.com/maNgao7/mng-license-server1/releases/download/zombie-war-6.5.17/zombie-war.zip');
    assert.equal(game.sha256, '9d2d641f05d2bec905522202d0f523e64bd5b4868e45f03148bfe37ece466749');
    assert.equal(game.bytes, 947576508);
    assert.ok(game.resources.some(resource => resource.url.endsWith('/TikMnG-Zombie-War-Hediye-Listesi.png')));
    const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    assert.match(source, /const EN_GUNCEL_SURUM = "6\.5\.17"/);
});
