'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const extract = require('extract-zip');
const { zipFiles } = require('./prepare-shared-game.cjs');
const { parseContentPackage } = require('../lib/game-content.cjs');
const { hashFile } = require('../lib/download.cjs');

const source = path.resolve(__dirname, '..');
const previous = 'D:/TikMnG-Update-QA-20261030/shared-packages';
const output = 'D:/TikMnG-Release-7.0.13-ready/games/snow-war';
const version = '7.0.6';
const base = 'https://github.com/maNgao7/mng-license-server1/releases/download/game-snow-war-7.0.6/';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

async function main() {
    const manifest = JSON.parse(fs.readFileSync(path.join(previous, 'snow-war-manifest.json'), 'utf8'));
    const original = structuredClone(manifest);
    const payload = path.join(previous, 'assets', manifest.payloadArchive.sha256 + '.zip');
    assert.equal(await hashFile(payload), manifest.payloadArchive.sha256);
    fs.mkdirSync(output, { recursive: true });
    const assets = path.join(output, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    const unpacked = fs.mkdtempSync(path.join(output, 'verified-payload-'));
    await extract(payload, { dir: unpacked });
    for (const file of manifest.files) {
        assert.equal(await hashFile(path.join(unpacked, file.path)), file.sha256, file.path);
    }
    const replacements = {
        'live-bridge/events.js': path.resolve(source, '../snow-war-update-713/live-bridge/events.js'),
        'game-instance/mods/mng-snow-war-1.0.0.jar': path.resolve(source, '../snow-war-update-713/mod/build/libs/mng_snow_war-1.0.0.jar')
    };
    for (const [relative, input] of Object.entries(replacements)) {
        const record = manifest.files.find(file => file.path === relative);
        assert.ok(record, relative);
        const data = fs.readFileSync(input);
        record.sha256 = digest(data);
        record.bytes = data.length;
        record.url = base + record.sha256 + '.bin';
        fs.copyFileSync(input, path.join(assets, record.sha256 + '.bin'));
        fs.copyFileSync(input, path.join(unpacked, relative));
    }
    const intermediate = path.join(output, 'snow-war-7.0.6.zip');
    assert.equal(fs.existsSync(intermediate), false, 'Do not overwrite a game candidate');
    await zipFiles(manifest.files.map(file => ({ path: file.path, source: path.join(unpacked, file.path) })), intermediate);
    manifest.version = version;
    manifest.payloadArchive = { sha256: await hashFile(intermediate), bytes: fs.statSync(intermediate).size };
    manifest.payloadArchive.url = base + manifest.payloadArchive.sha256 + '.zip';
    fs.renameSync(intermediate, path.join(assets, manifest.payloadArchive.sha256 + '.zip'));
    const parsed = parseContentPackage(manifest, { packageId: 'snow-war', version });
    assert.deepEqual(manifest.runtime, original.runtime, 'Existing shared engine is unchanged');
    const changed = manifest.files.filter((file, index) => file.sha256 !== original.files[index].sha256).map(file => file.path);
    assert.deepEqual(changed.sort(), Object.keys(replacements).sort());
    const data = Buffer.from(JSON.stringify(manifest));
    const descriptor = { path: '.tikmng-content.json', bytes: data.length, sha256: digest(data), url: base + digest(data) + '.json' };
    fs.writeFileSync(path.join(assets, descriptor.sha256 + '.json'), data);
    fs.writeFileSync(path.join(output, 'snow-war-manifest.json'), data);
    const summary = { packageId: 'snow-war', version, previousVersion: original.version, descriptor,
        payloadArchive: manifest.payloadArchive, runtimeArchive: manifest.runtime.archive, runtimeId: parsed.runtime.id,
        changed, runtimeUnchanged: true, published: false, unpacked };
    fs.writeFileSync(path.join(output, 'snow-war-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
