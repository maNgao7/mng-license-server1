'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rename, rm, writeFile } = require('node:fs/promises');
const { get } = require('node:http');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');

const script = path.join(__dirname, '../country-leaders-widget.cjs');

async function fixture(t) {
    const dir = await mkdtemp(path.join(tmpdir(), 'country-leaders-widget-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'world-v1.json');
    return {
        file,
        async replace(body) {
            const next = `${file}.tmp`;
            await writeFile(next, body, 'utf8');
            await rename(next, file);
        },
    };
}

function run(t, args) {
    const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const ended = once(child, 'exit');
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        await ended;
    });
    return { child, ended };
}

async function start(t, worldFile, parentPid = process.pid) {
    const widget = run(t, [script, worldFile, String(parentPid), '0']);
    const lines = createInterface({ input: widget.child.stdout });
    let diagnostics = '';
    widget.child.stderr.setEncoding('utf8').on('data', chunk => { diagnostics += chunk; });
    const [url] = await Promise.race([
        once(lines, 'line'),
        widget.ended.then(([code]) => { throw new Error(`Widget exited with ${code}: ${diagnostics}`); }),
    ]);
    return { ...widget, url };
}

test('widget serves only public standings and sees atomic world updates', { timeout: 10000 }, async t => {
    const { file, replace } = await fixture(t);
    const { url } = await start(t, file);
    const dataUrl = `${url}/data`;
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/ulke-liderleri$/);
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<h1 id="title">Ülke Liderleri<\/h1>/);
    assert.deepEqual(await (await fetch(dataUrl)).json(), []);

    const world = { schemaVersion: 1, privateJournal: 'private-root' };
    await replace(JSON.stringify(world));
    assert.deepEqual(await (await fetch(dataUrl)).json(), []);

    world.countryLeaders = {
        '__private-id-a__': { uniqueId: 'efe', displayName: 'Efe', wins: 1, privatePoints: 300 },
        '__private-id-b__': { uniqueId: 'ayse', displayName: 'Ayşe', wins: 2, portrait: 'private-portrait' },
        '__private-id-c__': { uniqueId: 'none', displayName: '', wins: -1 },
    };
    await replace(`\uFEFF${JSON.stringify(world)}`);
    const first = await fetch(dataUrl);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), [
        { uniqueId: 'ayse', displayName: 'Ayşe', wins: 2 },
        { uniqueId: 'efe', displayName: 'Efe', wins: 1 },
    ]);
    const etag = first.headers.get('etag');
    assert.ok(etag);
    const conditional = { headers: { 'If-None-Match': etag } };

    world.privateJournal = 'unrelated change';
    await replace(JSON.stringify(world));
    assert.equal((await fetch(dataUrl, conditional)).status, 304);

    await replace('{');
    assert.equal((await fetch(dataUrl, conditional)).status, 503);

    world.countryLeaders['__private-id-a__'].wins = 3;
    await replace(JSON.stringify(world));
    const updated = await fetch(dataUrl, conditional);
    assert.equal(updated.status, 200);
    assert.notEqual(updated.headers.get('etag'), etag);
    assert.deepEqual((await updated.json()).map(row => row.wins), [3, 2]);
    assert.equal(await (await fetch(dataUrl, { method: 'HEAD' })).text(), '');
    assert.equal((await fetch(dataUrl, { method: 'POST' })).status, 405);
    assert.equal((await fetch(new URL('/world-v1.json', url))).status, 404);
    const foreignHost = await new Promise((resolve, reject) => {
        get(dataUrl, { headers: { Host: 'example.test' } }, response => {
            response.resume();
            resolve(response.statusCode);
        }).once('error', reject);
    });
    assert.equal(foreignHost, 403);
});

test('widget exits when its supplied parent exits', { timeout: 10000 }, async t => {
    const { file } = await fixture(t);
    const parent = run(t, ['-e', 'setInterval(() => {}, 1000)']);
    const widget = await start(t, file, parent.child.pid);
    parent.child.kill();
    await parent.ended;
    assert.deepEqual(await widget.ended, [0, null]);
});

test('army and victory sources expose distinct stable paths and unchanged state responses', { timeout: 10000 }, async t => {
    const { file, replace } = await fixture(t);
    const { url } = await start(t, file);
    const defenders = [
        { name: 'Aydın', soldiers: 210, tanks: 4, helicopters: 0, jets: 5, internal: 'private' },
        { name: 'Zeynep', soldiers: 210, tanks: 5, helicopters: 2, jets: 1 },
        { name: 'Ömer', soldiers: 200, tanks: 14, helicopters: 12, jets: 6 },
        { name: 'Boş', soldiers: 0, tanks: 12, helicopters: 30, jets: 1 }
    ];
    await writeFile(path.join(path.dirname(file), 'widget-armies-v1.json'), JSON.stringify({ rows: defenders }));
    await replace(JSON.stringify({ countryLeaders: { ayse: { displayName: 'Ayşe', wins: 3 } } }));
    const board = new URL('/widget/view/fetih-ordular', url);
    assert.match(await (await fetch(board)).text(), /Ordu Sıralaması/);
    const scores = new URL('/api/widget/state?type=fetih-ordular', url);
    const baseline = await (await fetch(scores)).json();
    assert.deepEqual(baseline.rows.map(army => army.name), ['Zeynep', 'Aydın', 'Ömer']);
    assert.equal(baseline.rows[0].helicopters, 2);
    assert.equal(baseline.rows[1].internal, undefined);
    scores.searchParams.set('revision', baseline.revision);
    assert.equal((await fetch(scores)).status, 204);
    const leaders = new URL('/api/widget/state?type=fetih-liderler', url);
    assert.equal((await (await fetch(leaders)).json()).rows[0].wins, 3);
    assert.equal((await fetch(new URL('/api/widget/state?type=private', url))).status, 404);
});
