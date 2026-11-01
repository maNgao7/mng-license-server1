'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const folder = 'D:/TikMnG-Update-QA-20261030/shared-packages';
const target = path.resolve(__dirname, '../lib/admin-games.json');
const data = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const id of ['battle-royale', 'snow-war', 'minecraft-snake-arena', 'zombie-war']) {
    const file = path.join(folder, id + '-manifest.json');
    const bytes = fs.readFileSync(file), manifest = JSON.parse(bytes);
    require('../lib/game-content.cjs').parseContentPackage(manifest, { packageId: id, version: manifest.version });
    let row = data.games.find(game => game.id === id);
    if (!row) { row = { id, title: 'Zombie War', adminOnly: true }; data.games.push(row); }
    row.version = manifest.version;
    row.package = { localComponentManifest: file, localAssets: path.join(folder, 'assets'), contentSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    if (row.definition) { row.definition.paketSurumu = manifest.version; row.definition.boyut = Math.ceil(manifest.payloadArchive.bytes / 1048576) + ' MB + ortak motor'; }
}
fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
console.log('Synchronized four private component packages. No public metadata changed.');
