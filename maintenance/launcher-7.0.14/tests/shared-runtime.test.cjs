'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { parseContentPackage } = require('../lib/game-content.cjs');
const { runtimeDirectory } = require('../lib/runtime-location.cjs');
const { zipFiles } = require('../tools/prepare-shared-game.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

async function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-shared-'));
    const routes = new Map(), requests = [];
    const server = http.createServer((req, res) => {
        requests.push(req.url);
        const data = routes.get(req.url);
        if (!data) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Length': data.length }); res.end(data);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    async function collection(values) {
        const files = Object.entries(values).map(([relative, text]) => {
            const data = Buffer.from(text), digest = sha(data);
            routes.set('/' + digest, data);
            return { path: relative, data, bytes: data.length, sha256: digest, url: origin + '/' + digest };
        });
        const zip = path.join(root, crypto.randomUUID() + '.zip'); await zipFiles(files, zip);
        const data = fs.readFileSync(zip), digest = sha(data); routes.set('/' + digest + '.zip', data);
        return { archive: { url: origin + '/' + digest + '.zip', bytes: data.length, sha256: digest },
            files: files.map(({ data, ...file }) => file) };
    }
    const runtime = await collection({ 'java/bin/java.exe': 'independent-java', 'profile.json': '{"standalone":true}',
        'client.jar': 'client', 'libraries/test.jar': 'library', 'assets/objects/sound.ogg': 'sound' });
    const packages = {}, manifests = {};
    async function publish(id, version, change = {}) {
        const game = await collection({ 'run.txt': id + version, 'settings.json': 'default', ...change });
        const manifest = { schemaVersion: 2, type: 'tikmng-game-content', package: id, version,
            files: game.files, runtime: { archive: runtime.archive, files: runtime.files.map(({ url, ...f }) => f) }, payloadArchive: game.archive };
        manifests[id] = manifest;
        setManifest(id, manifest);
        return manifest;
    }
    function setManifest(id, manifest) {
        const data = Buffer.from(JSON.stringify(manifest)); const url = '/manifest/' + id + '/' + sha(data); routes.set(url, data);
        packages[id] = { version: manifest.version, files: [{ path: '.tikmng-content.json', url: origin + url, bytes: data.length, sha256: sha(data) }] };
    }
    let running = false;
    const options = { root, definitions: { one: { minecraft: true }, two: { minecraft: true } },
        getPackage: id => packages[id], isRunning: () => running,
        validate: dir => fs.existsSync(path.join(dir, 'run.txt')) && fs.existsSync(path.join(runtimeDirectory(dir), 'java/bin/java.exe')) };
    return { root, runtime, routes, requests, packages, manifests, publish, setManifest, options,
        library: createGameLibrary(options), running: value => { running = value; } };
}

test('clean machine installs Java itself; second game shares one verified runtime without fetching it again', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.publish('two', '1');
    await f.library.install('one');
    const first = f.library.pathFor('one'), runtime = runtimeDirectory(first);
    assert.equal(fs.existsSync(path.join(first, 'runtime')), false);
    assert.equal(fs.readFileSync(path.join(runtime, 'java/bin/java.exe'), 'utf8'), 'independent-java');
    f.requests.length = 0; await f.library.install('two');
    assert.equal(runtimeDirectory(f.library.pathFor('two')), runtime);
    assert.equal(f.requests.some(value => value === new URL(f.runtime.archive.url).pathname), false);
    assert.equal(f.requests.filter(value => value.endsWith('.zip')).length, 1);
    const restarted = createGameLibrary(f.options);
    assert.equal(runtimeDirectory(restarted.pathFor('one')), runtime);
    const start = performance.now(); await restarted.remove('one');
    assert.ok(performance.now() - start < 1000);
    assert.ok(fs.existsSync(runtime)); assert.ok(restarted.pathFor('two'));
});

test('game update fetches only changed game files, never the engine, and preserves settings and other game', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.publish('two', '1');
    await f.library.install('one'); await f.library.install('two');
    const second = f.library.pathFor('two'), old = f.library.pathFor('one');
    fs.writeFileSync(path.join(old, 'settings.json'), 'my gifts');
    await f.publish('one', '2'); f.requests.length = 0; await f.library.install('one');
    assert.equal(fs.readFileSync(path.join(f.library.pathFor('one'), 'settings.json'), 'utf8'), 'my gifts');
    assert.equal(f.library.pathFor('two'), second);
    assert.equal(f.requests.some(value => value.endsWith('.zip')), false);
    assert.equal(f.requests.filter(value => !value.startsWith('/manifest')).length, 1);
});

test('simultaneous games download the shared engine only once', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.publish('two', '1');
    await Promise.all([f.library.install('one'), f.library.install('two')]);
    assert.equal(f.requests.filter(value => value === new URL(f.runtime.archive.url).pathname).length, 1);
    assert.equal(runtimeDirectory(f.library.pathFor('one')), runtimeDirectory(f.library.pathFor('two')));
});

test('archive-only shared packages update, repair and reinstall without per-file URLs; settings and engine survive', async t => {
    const f = await fixture(t);await f.publish('one','1');await f.publish('two','1');
    await f.library.install('one');await f.library.install('two');
    const original=f.library.pathFor('one'),other=f.library.pathFor('two'),engine=runtimeDirectory(other);
    fs.writeFileSync(path.join(original,'settings.json'),'my saved gifts');
    const manifest=await f.publish('one','2');manifest.payloadMode='archive';
    manifest.files=manifest.files.map(({url,...file})=>file);f.setManifest('one',manifest);
    f.requests.length=0;await f.library.install('one');
    assert.equal(fs.readFileSync(path.join(f.library.pathFor('one'),'settings.json'),'utf8'),'my saved gifts');
    assert.equal(fs.readFileSync(path.join(f.library.pathFor('one'),'run.txt'),'utf8'),'one2');
    assert.equal(runtimeDirectory(f.library.pathFor('one')),engine);assert.equal(f.library.pathFor('two'),other);
    assert.deepEqual(f.requests.filter(p=>!p.startsWith('/manifest')), [new URL(manifest.payloadArchive.url).pathname]);
    fs.writeFileSync(path.join(f.library.pathFor('one'),'run.txt'),'corrupt');
    await f.library.install('one',{repair:true});assert.equal(fs.readFileSync(path.join(f.library.pathFor('one'),'run.txt'),'utf8'),'one2');
    await f.library.remove('one');await f.library.install('one');
    assert.equal(runtimeDirectory(f.library.pathFor('one')),engine);
    for(const mutate of [m=>{delete m.payloadArchive;},m=>{delete m.payloadMode;},m=>{m.payloadMode='unknown';},m=>{m.schemaVersion=1;}]){
        const invalid=structuredClone(manifest);mutate(invalid);assert.throws(()=>parseContentPackage(invalid,{packageId:'one',version:'2'}));
    }
    const assets=path.join(f.root,'private-assets');fs.mkdirSync(assets);
    for(const archive of [manifest.runtime.archive,manifest.payloadArchive])fs.writeFileSync(path.join(assets,archive.sha256+'.zip'),f.routes.get(new URL(archive.url).pathname));
    const data=Buffer.from(JSON.stringify(manifest)),file=path.join(f.root,'private-manifest.json');fs.writeFileSync(file,data);
    const preview=require('../lib/preview-package.cjs').createPreviewPackages({enabled:true,port:31976,accessKey:'qa-only',games:[
        {id:'one',version:'2',adminOnly:true,package:{localComponentManifest:file,localAssets:assets,contentSha256:sha(data)}}
    ]});
    assert.equal(preview.descriptor('one').format,'shared-runtime-v2');
});

test('corrupt runtime fails before activation; existing working game stays active on corrupt game update', async t => {
    const f = await fixture(t); await f.publish('one', '1');
    const route = new URL(f.runtime.archive.url).pathname, original = f.routes.get(route);
    f.routes.set(route, Buffer.alloc(original.length, 33));
    await assert.rejects(f.library.install('one'), { code: 'EHASH' });
    assert.equal(f.library.pathFor('one'), null);
    f.routes.set(route, original); await f.library.install('one');
    const active = f.library.pathFor('one'); await f.publish('one', '2');
    const changed = f.manifests.one.files.find(file => file.path === 'run.txt');
    f.routes.set(new URL(changed.url).pathname, Buffer.alloc(changed.bytes, 33));
    await assert.rejects(f.library.install('one'), { code: 'EHASH' });
    assert.equal(f.library.pathFor('one'), active);
});

test('runtime repair verifies hashes; running games block replacement; repaired engine serves both games', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.publish('two', '1');
    await f.library.install('one'); await f.library.install('two');
    const runtime = runtimeDirectory(f.library.pathFor('one'));
    fs.writeFileSync(path.join(runtime, 'client.jar'), 'bad');
    f.running(true); await assert.rejects(f.library.install('one', { repair: true }), { code: 'EBUSY' });
    f.running(false); await f.library.install('one', { repair: true });
    assert.equal(fs.readFileSync(path.join(runtimeDirectory(f.library.pathFor('two')), 'client.jar'), 'utf8'), 'client');
});

test('manifest rejects overlapping, reserved, incomplete, unsafe and legacy component data', async t => {
    const f = await fixture(t); const valid = await f.publish('one', '1');
    const expected = { packageId: 'one', version: '1' };
    for (const mutate of [
        value => { value.files[0].path = 'runtime/client.jar'; },
        value => { value.files[0].path = '.tikmng-runtime.json'; },
        value => { value.runtime.files = value.runtime.files.filter(file => file.path !== 'java/bin/java.exe'); },
        value => { value.runtime.files[0].path = '../outside'; },
        value => { value.runtime.archive.url = 'http://untrusted.example/runtime.zip'; },
        value => { value.schemaVersion = 1; }
    ]) { const value = structuredClone(valid); mutate(value); assert.throws(() => parseContentPackage(value, expected)); }
});

test('reference cannot direct launch outside managed root or through a junction', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.library.install('one');
    const dir = f.library.pathFor('one'), reference = path.join(dir, '.tikmng-runtime.json');
    fs.writeFileSync(reference, JSON.stringify({ schema: 1, sha256: '../../bad' }));
    assert.throws(() => runtimeDirectory(dir));
    const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, '.tikmng-runtime.json'), JSON.stringify({ schema: 1, sha256: f.runtime.archive.sha256 }));
    assert.throws(() => runtimeDirectory(outside));
});

test('existing verified Java/runtime migrates without download and without copying generated cache files', async t => {
    const f = await fixture(t); await f.publish('one', '1');
    const legacy = path.join(f.root, 'legacy'); fs.mkdirSync(legacy);
    fs.writeFileSync(path.join(legacy, 'run.txt'), 'old'); fs.writeFileSync(path.join(legacy, 'settings.json'), 'my settings');
    for (const file of f.runtime.files) {
        const target = path.join(legacy, 'runtime', file.path); fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.routes.get(new URL(file.url).pathname));
    }
    fs.mkdirSync(path.join(legacy, 'runtime/natives')); fs.writeFileSync(path.join(legacy, 'runtime/natives/jna123.dll'), 'temporary');
    const library = createGameLibrary({ ...f.options, resolveLegacy: id => id === 'one' ? { path: legacy, version: '0' } : null });
    await library.install('one');
    assert.equal(f.requests.some(url => url === new URL(f.runtime.archive.url).pathname), false);
    assert.equal(fs.existsSync(path.join(runtimeDirectory(library.pathFor('one')), 'natives/jna123.dll')), false);
    assert.equal(fs.readFileSync(path.join(library.pathFor('one'), 'settings.json'), 'utf8'), 'my settings');
    assert.equal(fs.readFileSync(path.join(legacy, 'run.txt'), 'utf8'), 'old');
});

test('skin cache does not invalidate common engine; cancellation releases the engine lock for safe retry', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.publish('two', '1');
    const controller = new AbortController(); let cancelled = false;
    const library = createGameLibrary({ ...f.options, onProgress: progress => {
        if (!cancelled && progress.phase === 'runtime-preparing') { cancelled = true; controller.abort(); }
    } });
    await assert.rejects(library.install('one', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(library.pathFor('one'), null);
    await library.install('one');
    const skin = path.join(runtimeDirectory(library.pathFor('one')), 'assets/skins/aa', 'a'.repeat(40));
    fs.mkdirSync(path.dirname(skin), { recursive: true }); fs.writeFileSync(skin, 'cached skin image');
    f.requests.length = 0; await library.install('two');
    assert.equal(f.requests.some(url => url === new URL(f.runtime.archive.url).pathname), false);
});

test('shared component junction cannot redirect a game launch to another directory', async t => {
    const f = await fixture(t); await f.publish('one', '1'); await f.library.install('one');
    const game = f.library.pathFor('one'), component = path.dirname(runtimeDirectory(game)), elsewhere = path.join(f.root, 'elsewhere');
    fs.renameSync(component, elsewhere);
    fs.symlinkSync(elsewhere, component, process.platform === 'win32' ? 'junction' : 'dir');
    try { assert.throws(() => runtimeDirectory(game), /Unsafe runtime path/); }
    finally { fs.unlinkSync(component); }
});
