'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const games = { arena: 'yaratik-arena', forza: 'turkish-forza-05' };
const mutable = new Set(['game', 'userdata', 'qa']);

async function measure({ game, directory, dataDirectory, steam, phases }) {
    const { prepareLaunch } = require(`../lib/${game}-package.cjs`);
    const original = { readStream: fs.createReadStream, stat: fs.lstatSync, readdir: fsp.readdir };
    let counts;
    fs.createReadStream = (...args) => { counts.hashReads++; return original.readStream(...args); };
    fs.lstatSync = (...args) => { counts.syncStats++; return original.stat(...args); };
    fsp.readdir = (...args) => { counts.dirReads++; return original.readdir(...args); };
    try {
        for (const phase of phases) {
            counts = { hashReads: 0, syncStats: 0, dirReads: 0 };
            const start = performance.now();
            const result = await prepareLaunch({ directory, dataDirectory, steam });
            console.log(JSON.stringify({ game, phase, ms: Math.round(performance.now() - start), copiedBytes: result.copiedBytes, ...counts }));
        }
    } finally {
        fs.createReadStream = original.readStream;
        fs.lstatSync = original.stat;
        fsp.readdir = original.readdir;
    }
}

async function benchmark(parent, selected) {
    const inventory = require('../../qa/installed-inventory.json');
    const root = await fsp.mkdtemp(path.join(path.resolve(parent), 'tikmng-native-qa-'));
    try {
        for (const game of selected) {
            const pkg = require(`../lib/${game}-package.cjs`);
            const steam = pkg.findSteamDemo();
            if (!steam) throw new Error(`Steam demo not installed for ${game}`);
            const row = inventory.managed.find(row => row.id === games[game]);
            const source = path.join(inventory.libraryRoot, '.game-library', row.id, 'versions', row.directory);
            const manifest = JSON.parse(await fsp.readFile(path.join(source, 'manifest.json'), 'utf8'));
            if (manifest.version !== row.version || manifest.steam.buildId !== steam.buildId) {
                throw new Error(`Installed package and Steam build do not match the benchmark for ${game}`);
            }
            const directory = path.join(root, game), dataDirectory = path.join(root, `${game}-data`);
            await fsp.cp(source, directory, {
                recursive: true,
                filter: file => game !== 'arena' || !mutable.has(path.relative(source, file).split(path.sep)[0])
            });
            for (const phases of [['fresh runtime'], ['launcher restart', 'warm', 'warm', 'warm']]) {
                const run = spawnSync(process.execPath, [__filename, '--measure', JSON.stringify({ game, directory, dataDirectory, steam, phases })],
                    { stdio: 'inherit' });
                if (run.error) throw run.error;
                if (run.status !== 0) throw new Error(`Native prepare benchmark failed for ${game}`);
            }
        }
    } finally {
        if (path.dirname(root) !== path.resolve(parent) || !path.basename(root).startsWith('tikmng-native-qa-')) {
            throw new Error('Refusing to remove a path outside the benchmark directory');
        }
        await fsp.rm(root, { recursive: true, force: true });
    }
}

async function main([parent, ...selected]) {
    if (parent === '--measure') return measure(JSON.parse(selected[0]));
    if (!parent || selected.some(game => !Object.hasOwn(games, game))) {
        throw new Error('Usage: node tests/startup-native-benchmark.cjs <existing scratch directory> [arena] [forza]');
    }
    await benchmark(parent, selected.length ? selected : Object.keys(games));
}

main(process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
