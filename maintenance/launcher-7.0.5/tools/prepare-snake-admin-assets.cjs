'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = 'D:/TikMnG-Snake-Arena-Prototype/assets';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const game = require('../lib/admin-games.json').games[0];
for (const [from, relative] of [['minecraft-yilan-cover-v2.png', 'renderer/assets/game-covers/minecraft-yilan-cover-v2.png'],
    ['snake-gift-guide.png', 'renderer/assets/gift-guides/minecraft-snake-arena.png']]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, from), target);
}
const guide = fs.readFileSync(path.join(root, 'renderer/assets/gift-guides/minecraft-snake-arena.png'));
const file = path.join(root, 'lib/game-resources.json'), manifest = read(file);
const entry = { id: game.id, packageId: game.id, title: game.title, adminOnly: true,
    guide: { version: '2026-10-25.1', file: game.id + '.png', filename: 'TikMnG-Minecraft-Yilan-Hediye-Listesi.png',
        bytes: guide.length, width: guide.readUInt32BE(16), height: guide.readUInt32BE(20), sha256: sha(guide),
        source: 'D:/TikMnG-Snake-Arena-Prototype/assets/snake-gift-guide.png',
        evidence: 'Parent supplied the ready gift guide; copied byte-for-byte. Tea 5303 remains an unresolved source/action blocker.' } };
const index = manifest.games.findIndex(row => row.id === game.id);
if (index < 0) manifest.games.push(entry); else manifest.games[index] = entry;
manifest.revision = Math.max(3, manifest.revision);
write(file, manifest);
const coversFile = path.join(root, 'renderer/assets/game-covers/artwork-current.json'), covers = read(coversFile);
const cover = { id: game.id, title: game.title, currentFile: game.cover + '.png', adminOnly: true,
    source: 'D:/TikMnG-Snake-Arena-Prototype/assets/minecraft-yilan-cover-v2.png',
    previousSource: 'D:/TikMnG-Snake-Arena-Prototype/assets/minecraft-yilan-cover-v1.png',
    concept: 'Original voxel snake arena key art supplied by parent. Version 2 has no typography; title stays in the launcher UI.',
    sha256: sha(fs.readFileSync(path.join(root, 'renderer/assets/game-covers', game.cover + '.png'))) };
const coverIndex = covers.covers.findIndex(row => row.id === game.id);
if (coverIndex < 0) covers.covers.push(cover); else covers.covers[coverIndex] = cover;
write(coversFile, covers);
console.log(JSON.stringify({ id: game.id, cover: cover.currentFile, guide: entry.guide.file, guideSha256: entry.guide.sha256 }));
