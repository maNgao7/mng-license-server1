'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const asar = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/@electron/asar');
const yaml = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/js-yaml');
const root = 'D:/TikMnG-Release-7.0.8-ready';
const stage = 'D:/TikMnG-Release-7.0.8-build';
const repo = 'maNgao7/mng-license-server1';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') => crypto.createHash(algorithm).update(bytes).digest(encoding);
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');

async function main() {
    const remote = process.argv.includes('--remote') || process.argv.includes('--public');
    const published = process.argv.includes('--public');
    const manifest = read('manifest-7.0.8.json');
    assert.equal(manifest.version, '7.0.8');
    assert.equal(manifest.games, 15);
    for (const file of manifest.files) {
        const bytes = fs.readFileSync(path.join(root, file.name));
        assert.equal(bytes.length, file.bytes, file.name);
        assert.equal(digest(bytes), file.sha256, file.name);
        assert.equal(digest(bytes, 'sha512', 'base64'), file.sha512, file.name);
    }
    const feed = yaml.load(fs.readFileSync(path.join(root, 'latest.yml'), 'utf8'));
    const installer = manifest.files.find(file => file.name === feed.path);
    assert.equal(feed.version, '7.0.8');
    assert.equal(feed.sha512, installer.sha512);
    assert.ok(feed.files.some(file => file.url === installer.name && file.size === installer.bytes));
    assert.match(feed.releaseNotes, /Racon Kralı/);
    assert.match(feed.releaseNotes, /Özel Giriş Videoları/);
    const prepared = read('build-source.json');
    const archive = path.join(root, 'win-unpacked/resources/app.asar');
    for (const file of [...prepared.replacements, 'license-server.txt']) {
        assert.equal(digest(asar.extractFile(archive, path.normalize(file))), digest(fs.readFileSync(path.join(stage, file))), file);
    }
    const packaged = JSON.parse(asar.extractFile(archive, 'package.json'));
    const expected = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
    for (const field of ['name', 'version', 'main', 'dependencies']) assert.deepEqual(packaged[field], expected[field], field);
    const packageHash = digest(fs.readFileSync(archive));
    const royal = read('qa/royal/packaged-report.json');
    const entry = read('qa/entry/report.json');
    const speech = read('qa/speech/report.json');
    const differential = read('qa/differential-verification.json');
    for (const result of [royal, entry, speech, differential]) assert.equal(result.passed, true);
    for (const result of [royal, entry]) assert.equal(result.packageSha256, packageHash);
    function suite(file, expected) {
        const log = fs.readFileSync(path.join(root, file), 'utf8');
        const value = label => Number(log.match(new RegExp('^ℹ ' + label + ' (\\d+)', 'm'))?.[1]);
        assert.equal(value('tests'), expected);
        assert.equal(value('pass'), expected);
        assert.equal(value('fail'), 0);
        assert.equal(value('skipped'), 0);
        return { tests: expected, passed: expected, failed: 0, skipped: 0 };
    }
    const report = {
        passed: true, version: '7.0.8', checkedAt: new Date().toISOString(),
        launcher: suite('unit-suite-staged-current.log', 1013), serverAndBrowser: suite('server-browser-suite-current.log', 71),
        packagedWidgetsAndHttps: royal.passed, entryVideosAndHttpsPlayback: entry.passed,
        actualOfflineSpeechAndRecovery: speech.passed, incrementalUpdate: differential.passed,
        incrementalDownloadBytes: differential.downloadBytes, fullInstallerBytes: installer.bytes,
        realTikTokGiftDeliveryClaimed: false, existingUserProfilesPreserved: true,
        applicationSha256: packageHash, files: manifest.files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }))
    };
    if (fs.existsSync(path.join(root, 'KONTROL-RAPORU.json'))) {
        const existing = read('KONTROL-RAPORU.json');
        assert.deepEqual({ ...existing, checkedAt: report.checkedAt }, report);
    } else write('KONTROL-RAPORU.json', report);
    const names = [...manifest.files.map(file => file.name), 'latest.yml', 'manifest-7.0.8.json', 'YUKLEME-TALIMATI.txt', 'KONTROL-RAPORU.json'];
    if (remote) {
        const release = JSON.parse(execFileSync('C:/Program Files/GitHub CLI/gh.exe', ['release', 'view', 'v7.0.8', '--repo', repo, '--json', 'tagName,isDraft,assets'], { encoding: 'utf8', windowsHide: true }));
        assert.equal(release.tagName, 'v7.0.8');
        assert.equal(release.isDraft, !published);
        for (const name of names) {
            const asset = release.assets.find(file => file.name === name);
            assert.ok(asset, name);
            const bytes = fs.readFileSync(path.join(root, name));
            assert.equal(asset.size, bytes.length, name);
            assert.equal(asset.digest, 'sha256:' + digest(bytes), name);
        }
    }
    if (published) {
        const { downloadFile } = require('../lib/download.cjs');
        const base = `https://github.com/${repo}/releases/download/v7.0.8/`;
        const destination = path.join(root, 'qa/public-download', installer.name);
        await downloadFile(base + installer.name, destination, { bytes: installer.bytes, sha256: installer.sha256 });
        const response = await fetch(base + 'latest.yml', { signal: AbortSignal.timeout(30000) });
        assert.equal(response.status, 200);
        const publicFeed = yaml.load(await response.text());
        assert.equal(publicFeed.version, '7.0.8');
        assert.equal(publicFeed.sha512, digest(fs.readFileSync(destination), 'sha512', 'base64'));
        const control = await fetch(base + 'KONTROL-RAPORU.json', { signal: AbortSignal.timeout(30000) });
        assert.equal(control.status, 200);
        assert.equal((await control.json()).applicationSha256, packageHash);
    }
    write(published ? 'public-release-verification.json' : remote ? 'draft-release-verification.json' : 'local-release-verification.json', {
        passed: true, version: '7.0.8', remoteAssetsChecked: remote, anonymousInstallerDownloadedAndHashed: published,
        assets: names.length, packageHash, installerLaunched: false
    });
    console.log(JSON.stringify({ passed: true, version: '7.0.8', remote, published, assets: names.length }));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
