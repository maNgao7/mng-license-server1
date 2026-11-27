import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { registerContentRoutes } from '../content-management.js';

const read = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
const previous = read('content-bootstrap-pre-ring-0.1.0.json');
const current = read('content-defaults.json');
const website = read('web/game-catalog.json');
const videoUrl = 'https://www.youtube.com/watch?v=Il6t2jrBy1c';
const steamUrl = 'https://store.steampowered.com/app/4793540/';
const stateFor = catalog => ({ draft: structuredClone(catalog), published: structuredClone(catalog) });

async function fixture(t, initialState) {
    const prefix = path.join(os.tmpdir(), 'tikmng-ring-catalog-');
    const dataDir = fs.mkdtempSync(prefix);
    const stateFile = path.join(dataDir, 'content-state.json');
    const backupFile = path.join(dataDir, 'content-state.backup.json');
    let server;
    async function stop() {
        if (!server?.listening) return;
        const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        server.closeAllConnections();
        await closed;
    }
    t.after(async () => {
        await stop();
        assert.ok(path.resolve(dataDir).startsWith(prefix));
        fs.rmSync(dataDir, { recursive: true, force: true });
    });
    if (initialState) fs.writeFileSync(stateFile, JSON.stringify(initialState));
    async function start() {
        const app = express();
        registerContentRoutes(app, { dataDir, adminKontrol: (_req, _res, next) => next() });
        server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
    }
    await start();
    return {
        dataDir, stateFile, backupFile,
        async get(route) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`);
            assert.equal(response.status, 200, route);
            return response.json();
        },
        async restart() { await stop(); await start(); }
    };
}

test('Ring 0.1.0 metadata identifies the supplied video and Steam demo without a gift image', () => {
    const ring = current.games.find(game => game.id === 'ring');
    const publicRing = website.games.find(game => game.id === 'ring');
    assert.equal(read('package.json').version, '7.0.38');
    assert.equal(ring.title, 'Ring');
    assert.equal(ring.version, '0.1.0');
    assert.equal(ring.url, 'https://github.com/maNgao7/mng-license-server1/releases/download/ring-0.1.0/Ring-Windows-x64.zip');
    assert.deepEqual(ring.resources.map(resource => resource.url), [videoUrl, steamUrl]);
    assert.equal(publicRing.tutorialUrl, videoUrl);
    assert.equal(publicRing.steamUrl, steamUrl);
    assert.equal(publicRing.cover, 'ring-v1');
    for (const field of ['title', 'description', 'requirements']) assert.equal(publicRing[field], ring[field], field);
    assert.match(ring.requirements, /Online Boxing 3D Demo \(4793540\)/);
    for (const game of [ring, publicRing]) assert.equal(Object.hasOwn(game, 'giftGuide'), false);
    // Package SHA-256 and byte size are supplied by the packaging owner and are not verified here.
});

test('the Ring catalog adds exactly one game and preserves all 19 previous game records, media and launcher', () => {
    assert.equal(previous.revision, 2026112502);
    assert.equal(previous.games.length, 19);
    assert.equal(current.revision, 2026112701);
    assert.ok(Date.parse(current.publishedAt) > Date.parse(previous.publishedAt));
    const ring = current.games.find(game => game.id === 'ring');
    assert.deepEqual(current, {
        ...previous, revision: current.revision, publishedAt: current.publishedAt,
        games: [ring, ...previous.games]
    });
    assert.equal(new Set(current.games.map(game => game.id)).size, 20);
    assert.deepEqual(read('web/content-catalog-7.0.0.json'), current);
    const publicIds = website.games.map(game => game.id);
    assert.equal(new Set(publicIds).size, publicIds.length);
    assert.deepEqual([...publicIds].sort(), current.games.filter(game => game.id !== 'profile-contest').map(game => game.id).sort());
});

test('fresh content storage publishes Ring with the full current catalog and does not migrate again on restart', async t => {
    const f = await fixture(t);
    const retained = fs.readFileSync(f.stateFile, 'utf8');
    for (let attempt = 0; attempt < 2; attempt++) {
        assert.deepEqual(await f.get('/api/content/catalog'), current);
        assert.deepEqual(await f.get('/api/admin/content'), stateFor(current));
        assert.equal(fs.readFileSync(f.stateFile, 'utf8'), retained);
        assert.equal(fs.existsSync(f.backupFile), false);
        assert.deepEqual(fs.readdirSync(path.join(f.dataDir, 'content-revisions')), []);
        if (attempt === 0) await f.restart();
    }
});

test('the untouched pre-Ring state migrates once with a complete unchanged backup', async t => {
    const initialState = stateFor(previous);
    const retained = structuredClone(initialState);
    const f = await fixture(t, initialState);
    const backup = fs.readFileSync(f.backupFile, 'utf8');
    const migrated = fs.readFileSync(f.stateFile, 'utf8');
    assert.deepEqual(JSON.parse(backup), retained);
    assert.deepEqual(JSON.parse(migrated), stateFor(current));
    for (let attempt = 0; attempt < 2; attempt++) {
        assert.deepEqual(await f.get('/api/content/catalog'), current);
        assert.deepEqual(await f.get('/api/admin/content'), stateFor(current));
        assert.equal(fs.readFileSync(f.backupFile, 'utf8'), backup);
        assert.equal(fs.readFileSync(f.stateFile, 'utf8'), migrated);
        assert.deepEqual(fs.readdirSync(path.join(f.dataDir, 'content-revisions')), []);
        if (attempt === 0) await f.restart();
    }
    assert.deepEqual(initialState, retained);
});

test('Ring bootstrap preserves administrator changes in either draft or published storage across restart', async t => {
    const edits = [
        ['game title', catalog => catalog.games[0].title = 'Administrator custom title'],
        ['game removal', catalog => catalog.games.shift()],
        ['game order', catalog => catalog.games.reverse()],
        ['media', catalog => catalog.media[0].title = 'Administrator custom video'],
        ['launcher', catalog => catalog.launcher = { version: '8.0.0', downloadUrl: 'https://github.com/custom/setup.exe', sha256: 'a'.repeat(64), bytes: 123, changelog: 'Custom launcher' }],
        ['revision', catalog => catalog.revision++],
        ['unpublished timestamp', catalog => catalog.publishedAt = null]
    ];
    const scenarios = [
        { catalog: previous, edits },
        { catalog: current, edits: [['removed Ring', catalog => catalog.games = catalog.games.filter(game => game.id !== 'ring')]] }
    ];
    for (const scenario of scenarios) for (const field of ['draft', 'published']) for (const [name, edit] of scenario.edits) {
        await t.test(`rev${scenario.catalog.revision} ${field}: ${name}`, async st => {
            const initialState = stateFor(scenario.catalog);
            edit(initialState[field]);
            const retained = structuredClone(initialState);
            const f = await fixture(st, initialState);
            const rawState = fs.readFileSync(f.stateFile, 'utf8');
            for (let attempt = 0; attempt < 2; attempt++) {
                assert.deepEqual(await f.get('/api/admin/content'), retained);
                assert.deepEqual(await f.get('/api/content/catalog'), retained.published);
                assert.equal(fs.readFileSync(f.stateFile, 'utf8'), rawState);
                assert.equal(fs.existsSync(f.backupFile), false);
                assert.deepEqual(fs.readdirSync(path.join(f.dataDir, 'content-revisions')), []);
                if (attempt === 0) await f.restart();
            }
            assert.deepEqual(initialState, retained);
        });
    }
});
