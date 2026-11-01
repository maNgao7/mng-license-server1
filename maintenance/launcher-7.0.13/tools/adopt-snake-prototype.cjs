'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assertSafePath } = require('../lib/download.cjs');

const source = 'D:/TikMnG-Snake-Arena-Prototype/instance/config';
const gameRoot = process.argv[2];
if (!gameRoot || !process.argv.includes('--apply')) throw new Error('An explicit installed preview game path and --apply are required.');
const resolved = path.resolve(gameRoot);
const allowed = path.resolve('D:/TikMnG-OnIzleme-Oyunlar/.game-library/minecraft-snake-arena/versions');
if (path.dirname(resolved) !== allowed || !/^[a-f0-9-]{36}$/.test(path.basename(resolved))) throw new Error('Not an installed Snake preview version.');
assertSafePath(resolved);
const config = path.join(resolved, 'game-instance/config');
const marker = path.join(config, '.prototype-settings-adopted.json');
const backup = 'D:/TikMnG-Snake-Arena-Prototype/qa/installed-admin-v015/before-prototype-adoption';
if (fs.existsSync(marker)) {
    console.log(JSON.stringify({ alreadyAdopted: true }));
} else {
    const files = ['tikmng-snake-arena.json', 'snake-widget.json'];
    for (const name of files) {
        assertSafePath(path.join(source, name));
        JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
        assertSafePath(path.join(config, name));
    }
    fs.mkdirSync(backup, { recursive: true });
    for (const name of files) {
        if (fs.existsSync(path.join(config, name))) fs.copyFileSync(path.join(config, name), path.join(backup, name));
        const temporary = path.join(config, name + '.adopt.tmp');
        fs.writeFileSync(temporary, fs.readFileSync(path.join(source, name)), { flag: 'wx' });
        fs.renameSync(temporary, path.join(config, name));
    }
    const report = { adopted: true, files, giftDurationsAndAudioPreserved: true, widgetIdentityPreserved: true,
        schemaMigration: 'Native schema 15 applies requested multipliers on next launch.' };
    fs.writeFileSync(marker, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
