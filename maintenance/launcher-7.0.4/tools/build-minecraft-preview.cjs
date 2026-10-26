'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const archiver = require('archiver');

const launcher = path.resolve(__dirname, '..');
const project = path.dirname(launcher);
const version = process.argv.find(arg => arg.startsWith('--version='))?.slice(10) || '7.0.2-preview.2';
if (!/^\d+\.\d+\.\d+-preview\.\d+$/.test(version)) throw new Error('Invalid preview version.');
const definitions = {
    'snow-war': { title: 'Minecraft Kartopu Savaşı', jar: 'mng-snow-war-1.0.0.jar', sourceJar: 'mng_snow_war-1.0.0.jar', config: 'mng-snow-war.json' },
    'battle-royale': { title: 'Minecraft, PUBG', jar: 'mng_battle_royale-1.0.0.jar', config: 'mng-battle-royale.json' }
};

function copy(source, target) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true, dereference: true });
}

async function build(id, prepareOnly) {
    const definition = definitions[id];
    if (!definition) throw new Error('Unsupported preview package.');
    const source = path.join(project, 'apps', id);
    const prototype = path.join(source, 'prototype');
    const stage = `D:/TikMnG-${id}-Admin-${version}`;
    const archive = `${stage}.zip`;
    fs.mkdirSync(stage, { recursive: true });
    if (!fs.existsSync(path.join(stage, 'runtime/profile.json'))) {
        copy(path.join(prototype, 'runtime'), path.join(stage, 'runtime'));
    }
    if (prepareOnly) return console.log(JSON.stringify({ id, stage, prepared: true }));

    const jar = path.join(source, 'mod/build/libs', definition.sourceJar || definition.jar);
    if (!fs.existsSync(jar)) throw new Error(`Build the current mod first: ${id}`);
    for (const name of ['launch-game.cjs', 'loading.hta']) {
        if (fs.existsSync(path.join(prototype, name))) copy(path.join(prototype, name), path.join(stage, name));
    }
    const bridge = path.join(prototype, 'live-bridge');
    for (const name of ['server.js', 'events.js', 'profiles.js', 'live-session.js', 'package.json', 'package-lock.json', 'node_modules']) {
        if (fs.existsSync(path.join(bridge, name))) copy(path.join(bridge, name), path.join(stage, 'live-bridge', name));
    }
    for (const name of ['defaultconfigs', 'resourcepacks', 'tacz']) {
        if (fs.existsSync(path.join(prototype, 'game-instance', name))) {
            copy(path.join(prototype, 'game-instance', name), path.join(stage, 'game-instance', name));
        }
    }
    const mods = path.join(stage, 'game-instance/mods');
    fs.mkdirSync(mods, { recursive: true });
    for (const item of fs.readdirSync(path.join(prototype, 'game-instance/mods'), { withFileTypes: true })) {
        if (item.isFile() && item.name.endsWith('.jar') && item.name !== definition.jar) {
            copy(path.join(prototype, 'game-instance/mods', item.name), path.join(mods, item.name));
        }
    }
    copy(jar, path.join(mods, definition.jar));
    // Private local preview only: no saved worlds, accounts, license, logs or sessions.
    const config = path.join(stage, 'game-instance/config', definition.config);
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(config, '{}\n');
    fs.writeFileSync(path.join(stage, '.tikmng-package.json'), JSON.stringify({ id, version }, null, 2) + '\n');
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archive);
        const zip = archiver('zip', { zlib: { level: 1 } });
        output.once('close', resolve); output.once('error', reject); zip.once('error', reject);
        zip.pipe(output); zip.directory(stage, false); zip.finalize();
    });
    const hash = crypto.createHash('sha256');
    for await (const block of fs.createReadStream(archive)) hash.update(block);
    const descriptor = { localArchive: archive, bytes: fs.statSync(archive).size, sha256: hash.digest('hex'),
        ...await require('./build-preview-content.cjs').buildPreviewContent(stage,id,version) };
    const manifestPath = path.join(launcher, 'lib/admin-games.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const entry = { id, title: definition.title, version, adminOnly: true, package: descriptor };
    const index = manifest.games.findIndex(game => game.id === id);
    if (index < 0) manifest.games.push(entry); else manifest.games[index] = { ...manifest.games[index], ...entry };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const report = { id, version, stage, ...descriptor, publicRelease: false, localAdminOnly: true };
    const reportPath = `D:/TikMnG-Snake-Arena-Prototype/qa/${id}-preview-package.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}

build(process.argv[2], process.argv.includes('--prepare-only')).catch(error => { console.error(error.stack); process.exitCode = 1; });
