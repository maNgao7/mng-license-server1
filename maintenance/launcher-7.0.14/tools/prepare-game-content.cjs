'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertSafeTree, safeRelativePath, hashFile } = require('../lib/download.cjs');
const { parseContentManifest, CONTENT_PATH } = require('../lib/game-content.cjs');

async function prepare({ source, output, packageId, version, publicBase }) {
    source = path.resolve(source); output = path.resolve(output);
    if (output === source || output.startsWith(source + path.sep)) throw new Error('Çıktı klasörü oyun klasörünün dışında olmalı.');
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(packageId) || !/^[0-9A-Za-z._+-]+$/.test(version)) throw new Error('Geçersiz paket/sürüm.');
    const origin = new URL(publicBase.endsWith('/') ? publicBase : publicBase + '/');
    if (origin.protocol !== 'https:') throw new Error('İçerik sunucusu HTTPS olmalı.');
    await assertSafeTree(source);
    fs.mkdirSync(output, { recursive: true });
    const assets = path.join(output, 'assets'); fs.mkdirSync(assets, { recursive: true });
    const files = [];
    async function visit(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (['node_modules', '.git', '.game-library', 'logs', 'crash-reports', 'saves', 'screenshots'].includes(entry.name)) continue;
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) { await visit(file); continue; }
            const relative = safeRelativePath(path.relative(source, file).split(path.sep).join('/'));
            if (['.tikmng-package.json', CONTENT_PATH].includes(relative)) continue;
            const sha256 = await hashFile(file), bytes = fs.statSync(file).size;
            const name = sha256 + '.bin', destination = path.join(assets, name);
            if (!fs.existsSync(destination)) fs.copyFileSync(file, destination);
            files.push({ path: relative, sha256, bytes, url: new URL(name, origin).href });
        }
    }
    await visit(source);
    const manifest = { schemaVersion: 1, type: 'tikmng-game-content', package: packageId, version, files };
    parseContentManifest(manifest, { packageId, version });
    const bytes = Buffer.from(JSON.stringify(manifest)), hash = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(assets, hash + '.json'), bytes);
    const descriptor = { path: CONTENT_PATH, url: new URL(hash + '.json', origin).href, sha256: hash, bytes: bytes.length };
    fs.writeFileSync(path.join(output, 'catalog-files.json'), JSON.stringify([descriptor], null, 2));
    const report = { packageId, version, files: files.length, uniqueAssets: fs.readdirSync(assets).length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), descriptor };
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2));
    return report;
}
if (require.main === module) {
    const [source, output, packageId, version, publicBase] = process.argv.slice(2);
    if (!publicBase) throw new Error('Kullanım: node prepare-game-content.cjs <source> <output> <package> <version> <https-assets-base>');
    prepare({ source, output, packageId, version, publicBase }).then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { prepare };
