'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { downloadFile } = require('../lib/download.cjs');
const { readRelease } = require('../lib/update-release.cjs');
const root = 'D:/TikMnG-Release-7.0.7-ready';
const games = 'D:/TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4';
const gh = 'C:/Program Files/GitHub CLI/gh.exe';
async function hash(file, algorithm = 'sha256', format = 'hex') {
    const result = crypto.createHash(algorithm);
    for await (const chunk of fs.createReadStream(file)) result.update(chunk);
    return result.digest(format);
}

async function main() {
    const isPublic = process.argv.includes('--public');
    const checks = [];
    for (const [tag, directory, names] of [
        ['minecraft-install-20261027', path.join(games, 'assets'), fs.readdirSync(path.join(games, 'assets'))],
        ['v7.0.7', root, ['TikMnG-Setup-7.0.7.exe', 'TikMnG-Setup-7.0.7.exe.blockmap',
            'TikMnG-7.0.7-Portable.exe', 'latest.yml', 'manifest-7.0.7.json', 'KONTROL-RAPORU.json']]
    ]) {
        const release = JSON.parse(execFileSync(gh, ['release', 'view', tag, '--repo', 'maNgao7/mng-license-server1',
            '--json', 'isDraft,assets,tagName'], { encoding: 'utf8', windowsHide: true }));
        if (isPublic) assert.equal(release.isDraft, false);
        for (const name of names) {
            const local = path.join(directory, name), remote = release.assets.find(asset => asset.name === name);
            assert.ok(remote, name); assert.equal(remote.size, fs.statSync(local).size);
            assert.equal(remote.digest, 'sha256:' + await hash(local), name);
            checks.push({ tag, name, bytes: remote.size, githubDigestVerified: true });
        }
    }
    if (isPublic) {
        const release = await readRelease();
        assert.equal(release.version, '7.0.7');
        const destination = path.join(root, 'qa/public-download', release.name);
        await downloadFile(release.url, destination, { bytes: release.bytes, sha256: release.sha256 });
        const response = await fetch(release.url.replace(release.name, 'latest.yml'));
        assert.equal(response.status, 200);
        const feed = yaml.load(await response.text());
        assert.equal(feed.version, '7.0.7'); assert.equal(feed.path, release.name);
        assert.equal(await hash(destination, 'sha512', 'base64'), feed.sha512);
        const catalog = JSON.parse(fs.readFileSync(path.join(games, 'catalog-candidate.json')));
        for (const id of ['snow-war', 'battle-royale']) {
            const descriptor = catalog.games.find(game => game.id === id).files[0];
            await downloadFile(descriptor.url, path.join(root, 'qa/public-download', path.basename(new URL(descriptor.url).pathname)),
                { bytes: descriptor.bytes, sha256: descriptor.sha256 });
        }
    }
    const report = { passed: true, checkedAt: new Date().toISOString(), public: isPublic,
        assets: checks, installerLaunched: false, anonymousInstallerAndManifestsDownloaded: isPublic };
    fs.writeFileSync(path.join(root, isPublic ? 'public-release-verification.json' : 'draft-release-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, public: isPublic, assets: checks.length }));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
