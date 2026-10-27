'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const root = path.resolve(process.argv[2] || 'D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3');
const publicCheck = process.argv.includes('--public') || process.argv.includes('--live');
const liveCheck = process.argv.includes('--live');
const gh = process.env.GH_EXECUTABLE || 'C:/Program Files/GitHub CLI/gh.exe';
const tag = 'minecraft-rounds-20261027';
const project = 'maNgao7/mng-license-server1';
const ids = ['snow-war', 'battle-royale'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const {validateCatalog, loadContentCatalog} = require('../launcher-7.0.6/lib/content-catalog.cjs');
const {parseContentManifest} = require('../launcher-7.0.6/lib/game-content.cjs');
const serverURL = 'https://mng-license-server1.onrender.com';

async function localHash(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

async function downloadHash(url, bytes) {
    const response = await fetch(url, {signal:AbortSignal.timeout(180000)});
    assert.equal(response.status, 200, url);
    const hash = crypto.createHash('sha256');
    let count = 0;
    for await (const chunk of response.body) {
        count += chunk.length;
        assert.ok(count <= bytes, 'Remote file exceeds the pinned length');
        hash.update(chunk);
    }
    assert.equal(count, bytes);
    return hash.digest('hex');
}

async function main() {
    const previous = read(path.join(repo, 'content-bootstrap-7.0.6.json'));
    const current = read(path.join(repo, 'content-defaults.json'));
    assert.deepEqual(current, read(path.join(root, 'catalog-candidate.json')));
    validateCatalog(current, {serverURL});
    assert.deepEqual(current.launcher, previous.launcher);
    assert.deepEqual(current.media, previous.media);
    assert.deepEqual(current.games.filter(g=>!ids.includes(g.id)), previous.games.filter(g=>!ids.includes(g.id)));

    const release = JSON.parse(execFileSync(gh, ['release','view',tag,'--repo',project,
        '--json','assets,isDraft,url,tagName'], {encoding:'utf8'}));
    assert.equal(release.tagName, tag);
    if (publicCheck) assert.equal(release.isDraft, false);
    const assets = [];
    const names = fs.readdirSync(path.join(root, 'assets')).sort();
    assert.equal(names.length, 6);
    assert.equal(release.assets.length, names.length);
    for (const name of names) {
        const file = path.join(root, 'assets', name);
        const remote = release.assets.find(a=>a.name===name);
        assert.ok(remote, 'Missing release asset: ' + name);
        assert.equal(remote.state, 'uploaded');
        assert.equal(remote.size, fs.statSync(file).size);
        const sha256 = await localHash(file);
        assert.equal(remote.digest, 'sha256:' + sha256);
        assets.push({name, bytes:remote.size, sha256, githubDigestVerified:true});
    }
    const games = [];
    if (publicCheck) for (const id of ids) {
        const game = current.games.find(g=>g.id===id);
        const descriptor = game.files[0];
        assert.equal(await downloadHash(descriptor.url, descriptor.bytes), descriptor.sha256);
        const manifest = read(path.join(root, 'assets', path.basename(new URL(descriptor.url).pathname)));
        const files = parseContentManifest(manifest, {packageId:id, version:game.version});
        const mods = files.filter(f=>/^game-instance\/mods\/mng.*\.jar$/.test(f.path));
        assert.equal(mods.length, 1);
        const mod = mods[0];
        assert.equal(await downloadHash(mod.url, mod.bytes), mod.sha256);
        const response = await fetch(game.url, {headers:{Range:'bytes=0-15'}, signal:AbortSignal.timeout(30000)});
        if (response.status !== 206) { await response.body?.cancel(); throw new Error('Archive range failed: ' + id); }
        assert.equal(response.headers.get('content-range'), 'bytes 0-15/' + game.bytes);
        const prefix = Buffer.from(await response.arrayBuffer());
        assert.equal(prefix.length, 16);
        assert.equal(prefix.readUInt32LE(0), 0x04034b50);
        games.push({id, version:game.version, manifestDownloadedAndHashed:true,
            modDownloadedAndHashed:true, archiveRange:true});
    }
    if (liveCheck) {
        const loaded = await loadContentCatalog({serverURL, cached:previous, bundled:previous, timeoutMs:30000});
        assert.equal(loaded.status.source, 'remote');
        assert.equal(loaded.status.cacheable, true);
        assert.deepEqual(loaded.catalog, validateCatalog(current, {serverURL}));
    }
    const report = {checkedAt:new Date().toISOString(), release:release.url,
        published:!release.isDraft, publicDownloadsVerified:publicCheck, liveCatalogVerified:liveCheck,
        launcherUnchanged:true, unrelatedGamesUnchanged:14, assets, games};
    fs.writeFileSync(path.join(root, 'remote-verification.json'), JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
