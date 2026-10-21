'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const launcherRoot = path.resolve(__dirname, '..');
const artworkRoot = path.join(launcherRoot, 'renderer/assets/game-covers');
const catalog = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'lib/catalog-defaults.json'), 'utf8'));
const artwork = JSON.parse(fs.readFileSync(path.join(artworkRoot, 'artwork-current.json'), 'utf8'));
const acceptedCovers = {
    'battle-royale': 'battle-royale-v3',
    'snow-war': 'snow-war-v3',
    vs: 'vs-v4',
    puanlama: 'puanlama-v4',
    orbit: 'orbit-v4',
    'crowd-control': 'crowd-control-v4',
    'battle-game': 'battle-game-v3',
    'gelene-gecene': 'gelene-gecene-v3',
    'duck-hunt': 'duck-hunt-v3',
    'pony-life': 'pony-life-v3',
    'frog-river': 'frog-river-v3',
    'penalty-kick': 'penalty-kick-v3',
    'tightrope-balance': 'tightrope-balance-v4',
    'zombie-war': 'zombie-war-v3'
};

function readWorkspaceCovers() {
    const source = fs.readFileSync(path.join(launcherRoot, 'renderer/workspace.js'), 'utf8');
    const declarations = source.match(/\bconst\s+covers\s*=\s*\{[\s\S]*?\}\s*;/g) || [];
    assert.equal(declarations.length, 1, 'workspace.js must expose one const covers object');
    // Evaluate only the cover data declaration, without starting the renderer.
    return JSON.parse(vm.runInNewContext(`${declarations[0]}\nJSON.stringify(covers);`,
        Object.create(null), { timeout: 1000 }));
}

const covers = readWorkspaceCovers();

function assertCoverage(games, coverMap, manifest) {
    assert.ok(Array.isArray(games), 'catalog games must be an array');
    assert.ok(Array.isArray(manifest.covers), 'current artwork covers must be an array');
    const ids = games.map(game => game.id);
    assert.equal(new Set(ids).size, ids.length, 'catalog game IDs must be unique');
    const records = new Map(manifest.covers.map(record => [record.id, record]));
    assert.equal(records.size, manifest.covers.length, 'current artwork game IDs must be unique');
    for (const game of games) {
        assert.ok(Object.hasOwn(coverMap, game.id), `${game.id} needs its own dedicated cover in const covers`);
        assert.equal(typeof coverMap[game.id], 'string', `${game.id} cover must be a filename stem`);
        assert.ok(coverMap[game.id].trim(), `${game.id} needs a nonempty cover filename`);
        assert.ok(records.has(game.id), `${game.id} needs a current artwork record`);
    }
    assert.deepEqual(Object.keys(coverMap).sort(), [...ids].sort(), 'const covers must match the entire catalog');
    assert.deepEqual([...records.keys()].sort(), [...ids].sort(), 'current artwork must match the entire catalog');
    return records;
}

function assertLandscapePng(bytes, label) {
    assert.ok(bytes.length >= 33, `${label} must contain a complete PNG header`);
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        `${label} must have PNG magic bytes`);
    assert.equal(bytes.readUInt32BE(8), 13, `${label} must have a 13-byte IHDR chunk`);
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${label} must start with IHDR`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    assert.ok(height > 0 && width > height && width <= 0x7fffffff,
        `${label} must have positive landscape dimensions, got ${width}x${height}`);
    assert.deepEqual(bytes.subarray(-12), Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
        `${label} must end with a complete PNG IEND chunk`);
}

test('the catalog retains all 14 current game IDs', () => {
    const ids = new Set(catalog.games.map(game => game.id));
    for (const id of Object.keys(acceptedCovers)) {
        assert.ok(ids.has(id), `current game ${id} must remain covered`);
    }
});

test('every catalog game has an explicit renderer cover and current artwork record', () => {
    assertCoverage(catalog.games, covers, artwork);
});

test('current artwork records match catalog titles, connected files and imagegen concepts', () => {
    const records = assertCoverage(catalog.games, covers, artwork);
    const concepts = new Set();
    for (const game of catalog.games) {
        const record = records.get(game.id);
        assert.equal(record.title, game.title, `${game.id} title must match the catalog`);
        assert.equal(record.currentFile, `${covers[game.id]}.png`, `${game.id} must document its connected cover`);
        assert.equal(record.source, 'built-in image_gen', `${game.id} must record its built-in imagegen source`);
        assert.equal(typeof record.concept, 'string', `${game.id} needs a concept summary`);
        const concept = record.concept.trim().replace(/\s+/g, ' ').toLowerCase();
        assert.ok(concept.length >= 40, `${game.id} needs a descriptive concept summary`);
        assert.ok(!concepts.has(concept), `${game.id} needs its own distinct concept summary`);
        concepts.add(concept);
    }
});

test('all 14 accepted cover revisions remain connected', () => {
    const records = new Map(artwork.covers.map(record => [record.id, record]));
    for (const [id, stem] of Object.entries(acceptedCovers)) {
        assert.equal(covers[id], stem, `${id} must use the accepted artwork revision`);
        assert.equal(records.get(id)?.currentFile, `${stem}.png`, `${id} must document the accepted revision`);
    }
});

test('all referenced artwork exists as landscape PNGs with distinct paths and content', () => {
    const paths = new Map();
    const contents = new Map();
    for (const [id, stem] of Object.entries(covers)) {
        assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'game IDs must be filename-safe');
        assert.match(stem, /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9]\d*$/, `${id} needs a versioned cover filename`);
        assert.ok(stem.startsWith(`${id}-v`), `${id} must reference its own artwork`);
        const filename = path.join(artworkRoot, `${stem}.png`);
        assert.ok(fs.existsSync(filename), `${id} references a missing PNG: ${stem}.png`);
        assert.ok(fs.statSync(filename).isFile(), `${id} artwork must be a file`);
        const realPath = fs.realpathSync(filename);
        assert.equal(path.dirname(realPath), fs.realpathSync(artworkRoot), `${id} artwork must stay in game-covers`);
        const pathKey = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
        assert.ok(!paths.has(pathKey), `${id} shares an artwork path with ${paths.get(pathKey)}`);
        paths.set(pathKey, id);
        const bytes = fs.readFileSync(filename);
        assertLandscapePng(bytes, `${id} (${stem}.png)`);
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');
        assert.ok(!contents.has(digest), `${id} duplicates the artwork content of ${contents.get(digest)}`);
        contents.set(digest, id);
    }
});

test('a future catalog game without a renderer cover fails coverage even with artwork metadata', () => {
    const future = { id: 'future-game', title: 'Future Game' };
    const manifest = { ...artwork, covers: [...artwork.covers, {
        ...future,
        currentFile: 'future-game-v1.png',
        source: 'built-in image_gen',
        concept: 'A dedicated original concept for a future catalog game.'
    }] };
    assert.throws(() => assertCoverage([...catalog.games, future], covers, manifest),
        /future-game needs its own dedicated cover in const covers/);
});

test('a future catalog game with a renderer cover still requires a current artwork record', () => {
    const future = { id: 'future-game', title: 'Future Game' };
    assert.throws(() => assertCoverage([...catalog.games, future],
        { ...covers, [future.id]: 'future-game-v1' }, artwork),
    /future-game needs a current artwork record/);
});
