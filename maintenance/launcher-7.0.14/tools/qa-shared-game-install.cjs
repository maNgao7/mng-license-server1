'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { runtimeDirectory } = require('../lib/runtime-location.cjs');
const { parseContentPackage } = require('../lib/game-content.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const output = path.resolve(process.env.MNG_SHARED_PACKAGE_QA || 'D:/TikMnG-Update-QA-20261030/shared-packages');
const root = fs.mkdtempSync(path.resolve(output, '../shared-install-'));
const routes = new Map(), transfers = [], packages = {};
let server, child;

async function nativeSnow(directory) {
    const instance = path.join(directory, 'game-instance');
    const launch = require(path.join(directory, 'launch-game.cjs'));
    const args = launch.launchArguments(0);
    args.unshift('-Dmng.snowwar.spectatorQa=true');
    // Only this freshly generated QA installation is changed; no user game/config.
    fs.writeFileSync(path.join(instance, 'options.txt'), 'fullscreen:false\nguiScale:2\nrenderDistance:6\nsimulationDistance:4\npauseOnLostFocus:false\nmaxFps:40\nclouds:false\n');
    const file = path.join(instance, 'qa-launch-args.txt');
    fs.writeFileSync(file, args.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
    const log = fs.createWriteStream(path.join(instance, 'shared-native.log'));
    return new Promise((resolve, reject) => {
        let passed = false, line = '', ready = false;
        const started = performance.now();
        child = spawn(path.join(runtimeDirectory(directory), 'java/bin/java.exe'), ['@' + file],
            { cwd: instance, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const timeout = setTimeout(() => { child.kill(); reject(new Error('Native spectator test timeout')); }, 180000);
        child.stdout.on('data', data => {
            log.write(data); line += String(data);
            if (!ready && line.includes('MNG_SNOW_ARENA_READY')) { ready = true; console.log('MNG_SHARED_SNOW_WORLD_READY'); }
            const result = /MNG_SPECTATOR_QA passed=(true|false) snowball=(true|false) power=(true|false) melee=(true|false) noHostTarget=(true|false)/.exec(line);
            if (result) { passed = result.slice(1).every(value => value === 'true'); console.log(result[0]); child.kill(); }
            line = line.slice(-10000);
        });
        child.stderr.on('data', data => log.write(data));
        child.once('error', reject);
        child.once('exit', code => { clearTimeout(timeout); log.end(); child = null;
            if (!passed) reject(new Error('Native spectator test failed; exit ' + code));
            else resolve({ passed, worldReady: ready, elapsedMs: Math.round(performance.now() - started) }); });
    });
}

async function nativeBattle(directory) {
    return new Promise((resolve, reject) => {
        let text = '';
        child = spawn(process.execPath, [path.join(directory, 'launch-game.cjs'), '--smoke'],
            { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const timeout = setTimeout(() => { child.kill(); reject(new Error('PUBG native QA timeout')); }, 160000);
        child.stdout.on('data', data => { text += data; if (String(data).includes('MNG_BATTLE_ARENA_READY')) console.log('MNG_SHARED_PUBG_WORLD_READY'); });
        child.stderr.on('data', data => { text += data; });
        child.once('error', reject);
        child.once('exit', code => { clearTimeout(timeout); child = null;
            if (code !== 0 || !text.includes('MNG_BATTLE_ARENA_READY')) reject(new Error('PUBG shared-runtime launch failed: ' + text.slice(-1500)));
            else resolve({ passed: true, worldReady: true, startupWorldSeconds: Number(/MNG_STARTUP_WORLD_SECONDS=([\d.]+)/.exec(text)?.[1] || 0) }); });
    });
}

async function nativeZombie(directory) {
    return new Promise((resolve, reject) => {
        let text = '';
        child = spawn(process.execPath, [path.join(directory, 'launch-game.cjs'), '--smoke'],
            { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const timeout = setTimeout(() => { child.kill(); reject(new Error('Zombie world test timeout')); }, 160000);
        child.stdout.on('data', data => { text += data; }); child.stderr.on('data', data => { text += data; });
        child.once('error', reject);
        child.once('exit', code => { clearTimeout(timeout); child = null;
            if (code !== 0 || !text.includes('MNG_WORLD_LOADED')) reject(new Error('Zombie shared launch failed: ' + text.slice(-1500)));
            else { console.log('MNG_SHARED_ZOMBIE_WORLD_READY'); resolve({ passed: true, worldReady: true }); } });
    });
}

async function nativeSnake(directory) {
    const instance = path.join(directory, 'game-instance');
    fs.writeFileSync(path.join(instance, 'config/tikmng-snake-arena.json'), JSON.stringify({ arenaSize: 96, schemaVersion: 13, username: '', musicVolume: 0, effectsVolume: 0,
        collapsingFloor: true, floorWarningSeconds: 1, floorMovementSeconds: 3 }));
    const args = require(path.join(directory, 'launch-game.cjs')).launchArguments(0, true);
    args.unshift('-Dtikmng.snake.collapseQa=true');
    const file = path.join(instance, 'shared-qa-args.txt');
    fs.writeFileSync(file, args.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
    const log = fs.createWriteStream(path.join(instance, 'shared-native.log'));
    return new Promise((resolve, reject) => {
        child = spawn(path.join(runtimeDirectory(directory), 'java/bin/java.exe'), ['@' + file], { cwd: instance, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
        const timeout = setTimeout(() => { child.kill(); reject(new Error('Shared snake native test timeout')); }, 180000);
        child.stdout.on('data', chunk => log.write(chunk)); child.stderr.on('data', chunk => log.write(chunk));
        child.once('error', reject);
        child.once('exit', code => { clearTimeout(timeout); log.end(); child = null;
            const resultFile = path.join(instance, 'collapse-result.json');
            const result = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile)) : null;
            if (code !== 0 || !result?.passed) reject(new Error('Shared snake collapse test failed: ' + JSON.stringify(result)));
            else { console.log('MNG_SHARED_SNAKE_COLLAPSE_PASSED'); resolve(result); } });
    });
}

async function main() {
    server = http.createServer((req, res) => {
        const route = routes.get(req.url);
        if (!route) return res.writeHead(404).end();
        const data = route.data, bytes = data ? data.length : fs.statSync(route.file).size;
        transfers.push({ path: req.url, bytes }); res.writeHead(200, { 'Content-Length': bytes });
        if (data) res.end(data); else fs.createReadStream(route.file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    for (const id of ['battle-royale', 'snow-war', 'minecraft-snake-arena', 'zombie-war']) {
        const manifest = JSON.parse(fs.readFileSync(path.join(output, id + '-manifest.json')));
        for (const file of [...manifest.files, manifest.runtime.archive, manifest.payloadArchive].filter(file => file.url)) {
            const name = path.basename(new URL(file.url).pathname);
            file.url = origin + '/' + name; routes.set('/' + name, { file: path.join(output, 'assets', name) });
        }
        const data = Buffer.from(JSON.stringify(manifest)), name = '/manifest/' + id;
        routes.set(name, { data });
        packages[id] = { version: manifest.version, files: [{ path: '.tikmng-content.json', url: origin + name, bytes: data.length, sha256: sha(data) }] };
        parseContentPackage(manifest, { packageId: id, version: manifest.version });
    }
    const library = createGameLibrary({ root, definitions: Object.fromEntries(Object.keys(packages).map(id => [id, { minecraft: true }])),
        getPackage: id => packages[id], validate: dir => fs.existsSync(path.join(dir, 'launch-game.cjs')) &&
            fs.existsSync(path.join(runtimeDirectory(dir), 'java/bin/java.exe')) });
    const report = { root, passed: false, installs: [] };
    for (const id of ['battle-royale', 'snow-war', 'minecraft-snake-arena', 'zombie-war']) {
        const started = performance.now(), before = transfers.length;
        await library.install(id);
        const directory = library.pathFor(id);
        const checked = execFileSync(process.execPath, [path.join(directory, 'launch-game.cjs'), '--check'],
            { cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, JAVA_HOME: '', MINECRAFT_HOME: '', TLAUNCHER_HOME: '' } });
        if (!JSON.parse(checked.trim()).ok) throw new Error('Standalone launch check failed');
        const row = { id, elapsedMs: Math.round(performance.now() - started), runtime: runtimeDirectory(directory),
            transferredBytes: transfers.slice(before).reduce((sum, row) => sum + row.bytes, 0),
            runtimeDownloads: transfers.slice(before).filter(row => row.bytes > 700000000).length, launchCheck: true };
        report.installs.push(row); console.log(JSON.stringify(row));
    }
    if (report.installs.some((row, i) => row.runtime !== report.installs[0].runtime || i > 0 && row.runtimeDownloads !== 0)) throw new Error('Runtime was not shared');
    report.nativeBattle = await nativeBattle(library.pathFor('battle-royale'));
    report.nativeSnow = await nativeSnow(library.pathFor('snow-war'));
    report.nativeSnake = await nativeSnake(library.pathFor('minecraft-snake-arena'));
    report.nativeZombie = await nativeZombie(library.pathFor('zombie-war'));
    const beforeRepair = transfers.length;
    await library.install('snow-war', { repair: true });
    report.runtimeStillValidAfterTwoNativeGames = !transfers.slice(beforeRepair).some(row => row.bytes > 700000000);
    if (!report.runtimeStillValidAfterTwoNativeGames) throw new Error('Native game modified shared runtime');
    report.passed = true;
    fs.writeFileSync(path.resolve(__dirname, '../qa/20261030/shared-install-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (child) child.kill();
    server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
});
