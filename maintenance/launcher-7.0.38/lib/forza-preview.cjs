'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assertSafePath } = require('./download.cjs');

function readIndex() {
    return JSON.parse(fs.readFileSync(assertSafePath(path.join(__dirname, 'forza-preview-package.json')), 'utf8'));
}

function resolvePackage(index, { root = __dirname, resourcesPath = process.resourcesPath } = {}) {
    if (index.schemaVersion !== 1 || !['0.5.0-preview.2', '0.5.0-preview.3', '0.5.0-preview.4', '0.5.0-preview.5', '0.5.0-preview.6'].includes(index.version) || !index.package || typeof index.package.localArchive !== 'string'
        || !/^[a-f0-9]{64}$/.test(index.package.sha256 || '') || !Number.isSafeInteger(index.package.bytes)) return null;
    const resource = 'private-games/forza-' + index.package.sha256 + '.zip';
    const candidates = [...(resourcesPath ? [path.join(resourcesPath, resource)] : []), path.resolve(root, index.package.localArchive)];
    for (const candidate of candidates) {
        try {
            const file = assertSafePath(candidate), stat = fs.statSync(file);
            if (stat.isFile() && stat.size === index.package.bytes) return { ...index.package, localArchive: file };
        } catch {}
    }
    return null;
}

function privateResources() {
    try {
        const index = readIndex(), item = resolvePackage(index, { resourcesPath: undefined });
        if (item) return [{ from: item.localArchive, to: 'private-games/forza-' + item.sha256 + '.zip' }];
    } catch {}
    return [];
}

function adminGames() {
    const games = require('./admin-games.json').games;
    let descriptor;
    try {
        descriptor = resolvePackage(readIndex());
        if (!descriptor) return games;
    } catch { return games; }
    return games.map(game => game.id === 'turkish-forza-05' ? { ...game, package: descriptor } : game);
}
module.exports = { adminGames, resolvePackage, privateResources };

