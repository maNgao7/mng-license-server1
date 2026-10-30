'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseContentPackage } = require('../lib/game-content.cjs');
const { hashFile } = require('../lib/download.cjs');
const root = 'D:/TikMnG-Update-QA-20261030/shared-packages';
const publicBase = 'https://github.com/maNgao7/mng-license-server1/releases/download/game-components-7.0.9/';
const assetURL = name => new URL(name, publicBase).href;
const previous = { 'battle-royale': '7.0.4', 'snow-war': '7.0.4', 'minecraft-snake-arena': '0.16.0', 'zombie-war': '6.5.17' };
const assets = new Map(), games = [];
async function main() {
    for (const [id, previousVersion] of Object.entries(previous)) {
        const manifestFile = path.join(root, id + '-manifest.json'), summaryFile = path.join(root, id + '-summary.json');
        const manifest = JSON.parse(fs.readFileSync(manifestFile)), summary = JSON.parse(fs.readFileSync(summaryFile));
        // This rollout publishes four compressed payloads and one common engine.
        // Per-file hashes still verify every extracted file, without 7000 API uploads.
        manifest.payloadMode = 'archive';
        manifest.files = manifest.files.map(({ url, ...file }) => file);
        for (const file of [manifest.runtime.archive, manifest.payloadArchive]) file.url = assetURL(file.sha256 + '.zip');
        parseContentPackage(manifest, { packageId: id, version: manifest.version });
        const data = Buffer.from(JSON.stringify(manifest)), sha256 = crypto.createHash('sha256').update(data).digest('hex');
        const descriptor = { path: '.tikmng-content.json', bytes: data.length, sha256, url: assetURL(sha256 + '.json') };
        fs.writeFileSync(manifestFile, data); fs.writeFileSync(path.join(root, 'assets', sha256 + '.json'), data);
        Object.assign(summary, { descriptor, runtimeArchive: manifest.runtime.archive, payloadArchive: manifest.payloadArchive });
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        games.push({ id, previousVersion, version: manifest.version, ...manifest.payloadArchive, files: [descriptor] });
        for (const file of [manifest.runtime.archive, manifest.payloadArchive, descriptor]) {
            const name = path.basename(new URL(file.url).pathname), local = path.join(root, 'assets', name);
            if (assets.has(name)) { assert.equal(assets.get(name).bytes, file.bytes); continue; }
            assert.equal(fs.statSync(local).size, file.bytes);
            assert.equal(await hashFile(local), file.sha256, 'Upload asset must match its content address: ' + name);
            assets.set(name, { name, local, url: file.url, sha256: file.sha256, bytes: file.bytes });
        }
    }
    const buckets = {};
    for (const asset of assets.values()) {
        const tag = new URL(asset.url).pathname.split('/').at(-2);
        (buckets[tag] ||= []).push(asset);
    }
    for (const files of Object.values(buckets)) assert.ok(files.length <= 1000, 'GitHub release asset limit');
    const report = { published: false, enabled: false, minimumLauncher: '7.0.9', payloadMode: 'archive', assetCount: assets.size,
        releaseCount: Object.keys(buckets).length, maxAssetsPerRelease: Math.max(...Object.values(buckets).map(files => files.length)),
        source: 'https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases', buckets };
    fs.writeFileSync(path.join(root, 'publication-inventory.json'), JSON.stringify(report, null, 2));
    const prepared = path.resolve(__dirname, '../../server-update-20261030/content-components.prepared.json');
    fs.writeFileSync(prepared, JSON.stringify({ enabled: false, revision: 2026103001, games }, null, 2));
    console.log(JSON.stringify({ assets: report.assetCount, releaseBuckets: report.releaseCount,
        maxAssetsPerRelease: report.maxAssetsPerRelease, enabled: false, published: false }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
