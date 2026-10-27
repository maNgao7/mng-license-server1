'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = process.argv[2] || 'D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3';
const launcher = 'C:/Users/User/Desktop/MNG-TikTok-Game/launcher';
const {validateCatalog} = require(path.join(launcher, 'lib/content-catalog.cjs'));
const {parseContentManifest} = require(path.join(launcher, 'lib/game-content.cjs'));
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const previous = read(process.argv[3] || 'D:/TikMnG-Release-7.0.0-source/content-bootstrap-7.0.6.json');
const candidate = read(path.join(root, 'catalog-candidate.json'));
validateCatalog(candidate, {serverURL:'https://mng-license-server1.onrender.com'});
const ids = ['snow-war', 'battle-royale'];
assert.deepEqual(candidate.launcher, previous.launcher);
assert.deepEqual(candidate.media, previous.media);
assert.deepEqual(candidate.games.filter(g => !ids.includes(g.id)), previous.games.filter(g => !ids.includes(g.id)));
const details = [];
for (const id of ids) {
    const game = candidate.games.find(g => g.id === id);
    const descriptor = game.files[0];
    const manifestFile = path.join(root, 'assets', new URL(descriptor.url).pathname.split('/').at(-1));
    assert.equal(fs.statSync(manifestFile).size, descriptor.bytes);
    assert.equal(hash(manifestFile), descriptor.sha256);
    const manifest = parseContentManifest(read(manifestFile), {packageId:id, version:game.version});
    const old = read('D:/TikMnG-Release-7.0.2-games/game-content-' + id + '-7.0.2.json');
    assert.equal(manifest.length, old.files.length);
    const changed = manifest.filter((file, index) => JSON.stringify(file) !== JSON.stringify(old.files[index]));
    assert.equal(changed.length, 1);
    assert.match(changed[0].path, /^game-instance\/mods\/mng.*\.jar$/);
    const blob = path.join(root, 'assets', new URL(changed[0].url).pathname.split('/').at(-1));
    assert.equal(hash(blob), changed[0].sha256);
    assert.equal(fs.statSync(blob).size, changed[0].bytes);
    const archive = path.join(root, 'assets', new URL(game.url).pathname.split('/').at(-1));
    assert.equal(hash(archive), game.sha256);
    assert.equal(fs.statSync(archive).size, game.bytes);
    details.push({game:id, version:game.version, changedFiles:changed.length, updateBytes:changed[0].bytes,
        descriptorHash:true, modHash:true, archiveHash:true});
}
const result = {verified:true, published:false, launcherUnchanged:true, mediaUnchanged:true,
    unrelatedGamesUnchanged:previous.games.length - ids.length, details};
fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
