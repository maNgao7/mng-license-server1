'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { parseContentManifest } = require('../lib/game-content.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

test('complete content update downloads only changed bytes, drops obsolete code and preserves two games', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-content-'));
    const requests = [], routes = new Map();
    const server = http.createServer((req, res) => {
        requests.push(req.url);const value = routes.get(req.url);
        if (!value) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Length': value.length });res.end(value);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections();await new Promise(resolve => server.close(resolve));fs.rmSync(root, { recursive: true, force: true }); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const packages = {}, progress = [];
    function publish(id, version, values) {
        const files = Object.entries(values).map(([name, value]) => {
            const data = Buffer.from(value), hash = sha(data);routes.set('/' + hash, data);
            return { path: name, bytes: data.length, sha256: hash, url: origin + '/' + hash };
        });
        const content = Buffer.from(JSON.stringify({ schemaVersion: 1, type: 'tikmng-game-content', package: id, version, files }));
        const name = '/manifest-' + id + '-' + version;routes.set(name, content);
        packages[id] = { version, url: origin + '/never-download.zip', files: [{ path: '.tikmng-content.json', bytes: content.length, sha256: sha(content), url: origin + name }] };
    }
    const unchanged = 'stable resource'.repeat(100000);
    publish('one', '1', { 'run.txt': 'v1', 'resource.dat': unchanged, 'obsolete.txt': 'old', 'settings.json': 'default' });
    publish('two', '1', { 'run.txt': 'other', 'settings.json': 'other-default' });
    const library = createGameLibrary({ root, definitions: { one: { klasor: 'one' }, two: { klasor: 'two' } },
        validate: dir => fs.existsSync(path.join(dir, 'run.txt')), getPackage: id => packages[id], onProgress: data => progress.push(data) });
    await library.install('one');await library.install('two');
    const other = library.pathFor('two');
    fs.writeFileSync(path.join(library.pathFor('one'), 'settings.json'), 'my gift settings');
    publish('one', '2', { 'run.txt': 'v2', 'resource.dat': unchanged, 'settings.json': 'new-default' });
    requests.length = 0;
    await library.install('one');
    assert.equal(library.pathFor('two'), other);
    assert.equal(fs.readFileSync(path.join(other, 'run.txt'), 'utf8'), 'other');
    assert.equal(fs.readFileSync(path.join(library.pathFor('one'), 'settings.json'), 'utf8'), 'my gift settings');
    assert.equal(fs.existsSync(path.join(library.pathFor('one'), 'obsolete.txt')), false);
    assert.equal(requests.filter(url => !url.startsWith('/manifest')).length, 1);
    assert.equal(requests.includes('/' + sha(Buffer.from(unchanged))), false);
    const done = progress.filter(p => p.phase === 'complete').at(-1);
    assert.equal(done.transferredBytes, 2);assert.ok(done.reusedBytes > 1000000);
    const invalid = { schemaVersion: 1, type: 'tikmng-game-content', package: 'one', version: '2', files: [{ path: '../bad', bytes: 1, sha256: '0'.repeat(64), url: origin }] };
    assert.throws(() => parseContentManifest(invalid, { packageId: 'one', version: '2' }));
});

test('content transfers use four slots and a corrupt update cannot replace a working game', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-content-pool-'));
    const routes = new Map();
    let active = 0, peak = 0, slow = false;
    const server = http.createServer((req, res) => {
        const data = routes.get(req.url);
        if (!data) return res.writeHead(404).end();
        if (!slow || req.url.startsWith('/manifest')) return res.end(data);
        active++; peak = Math.max(peak, active);
        let counted = true;
        res.on('close', () => { if (counted) { counted = false; active--; } });
        res.writeHead(200, { 'Content-Length': data.length });
        res.write(data.subarray(0, 1));
        setTimeout(() => { if (!res.destroyed) res.end(data.subarray(1)); }, 80);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    let descriptor;
    function publish(version, corrupt = false) {
        const files = Array.from({ length: 9 }, (_, index) => {
            const data = Buffer.from(version + '-content-' + index), url = '/' + version + '/' + index;
            routes.set(url, corrupt && index === 0 ? Buffer.alloc(data.length, 88) : data);
            return { path: index === 0 ? 'run.txt' : 'data/' + index, bytes: data.length, sha256: sha(data), url: origin + url };
        });
        const content = Buffer.from(JSON.stringify({ schemaVersion: 1, type: 'tikmng-game-content', package: 'one', version, files }));
        const url = '/manifest-' + version; routes.set(url, content);
        descriptor = { version, files: [{ path: '.tikmng-content.json', bytes: content.length, sha256: sha(content), url: origin + url }] };
    }
    const library = createGameLibrary({ root, definitions: { one: { klasor: 'one' } },
        validate: dir => fs.existsSync(path.join(dir, 'run.txt')), getPackage: () => descriptor });
    publish('1'); await library.install('one');
    slow = true;
    publish('2'); await library.install('one');
    assert.equal(peak, 4);
    const working = library.pathFor('one');
    assert.equal(fs.readFileSync(path.join(working, 'run.txt'), 'utf8'), '2-content-0');
    fs.writeFileSync(path.join(working, 'settings.json'), 'my saved gifts');
    publish('3', true);
    await assert.rejects(library.install('one'), { code: 'EHASH' });
    assert.equal(library.pathFor('one'), working);
    assert.equal(fs.readFileSync(path.join(working, 'run.txt'), 'utf8'), '2-content-0');
    assert.equal(fs.readFileSync(path.join(working, 'settings.json'), 'utf8'), 'my saved gifts');
    assert.ok(peak <= 4);
});
