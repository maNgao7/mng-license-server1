'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const buildRequire = require('node:module').createRequire('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/package.json');
const asar = buildRequire('@electron/asar'), yaml = buildRequire('js-yaml');
const root = 'D:/TikMnG-Release-7.0.9-ready', stage = 'D:/TikMnG-Release-7.0.9-build';
const archive = path.join(root, 'win-unpacked/resources/app.asar');
const hash = (data, algorithm = 'sha256', encoding = 'hex') => crypto.createHash(algorithm).update(data).digest(encoding);
const read = file => fs.readFileSync(file);
const pkg = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(pkg.version, '7.0.9');
for (const file of ['main.js', 'preload.js', 'lib/game-library.cjs', 'lib/game-content.cjs', 'lib/preview-package.cjs', 'lib/runtime-location.cjs',
    'lib/platform.cjs', 'lib/admin-games.json', 'renderer/workspace.js', 'renderer/app.js']) {
    assert.equal(hash(asar.extractFile(archive, file)), hash(read(path.join(stage, file))), file);
}
assert.equal(hash(asar.extractFile(archive, 'lib/admin-games.json')), hash(read('D:/TikMnG-Release-7.0.8-build/lib/admin-games.json')));
const copies = [
    ['TikMnG Setup 7.0.9.exe', 'TikMnG-Setup-7.0.9.exe'],
    ['TikMnG Setup 7.0.9.exe.blockmap', 'TikMnG-Setup-7.0.9.exe.blockmap'],
    ['TikMnG 7.0.9.exe', 'TikMnG-7.0.9-Portable.exe']
];
const files = copies.map(([from, name]) => {
    const data = read(path.join(root, from)); fs.copyFileSync(path.join(root, from), path.join(root, name));
    return { name, bytes: data.length, sha256: hash(data), sha512: hash(data, 'sha512', 'base64') };
});
const feed = yaml.load(read(path.join(root, 'latest.yml')).toString('utf8'));
assert.equal(feed.version, '7.0.9'); assert.equal(feed.path, files[0].name);
assert.equal(feed.sha512, files[0].sha512); assert.equal(feed.files[0].size, files[0].bytes);
assert.ok(feed.releaseNotes.includes('Racon Listesi') && feed.releaseNotes.includes('WhatsApp'));
const manifest = { version: '7.0.9', createdAt: new Date().toISOString(), files, published: false,
    installation: 'per-user-one-click', signedPublisher: false, sharedGameRolloutEnabled: false };
fs.writeFileSync(path.join(root, 'manifest-7.0.9.json'), JSON.stringify(manifest, null, 2));
const instructions = 'TikMnG 7.0.9 - DAGITIM DOSYALARI\r\n\r\n' +
    'Genel yayin GitHub dosya kontrolleri ve Render dagitimi ile tamamlanir. Mevcut uygulamayi kaldirmadan guncelleyin; lisans ve ayarlar korunur.\r\n\r\n' +
    'Drive yedegi icin dort dosya: TikMnG-Setup-7.0.9.exe, latest.yml, manifest-7.0.9.json, YUKLEME-TALIMATI.txt.\r\n' +
    'Eski EXE, oyun kayitlari veya lisans dosyalarini silmeyin. Oyun bilesenleri ayri, hash dogrulamali GitHub yayinlariyla etkinlestirilir.\r\n';
fs.writeFileSync(path.join(root, 'YUKLEME-TALIMATI.txt'), instructions);
const drive = 'D:/TikMnG-Drive-7.0.9-Hazir'; fs.mkdirSync(drive, { recursive: true });
for (const name of [files[0].name, 'latest.yml', 'manifest-7.0.9.json', 'YUKLEME-TALIMATI.txt']) {
    fs.copyFileSync(path.join(root, name), path.join(drive, name));
    assert.equal(hash(read(path.join(root, name))), hash(read(path.join(drive, name))));
}
const report = { passed: true, version: '7.0.9', installerBytes: files[0].bytes, notesTurkish: true,
    installerChecksumMatchesFeed: true, publicAdminMetadataUnchanged: true, published: false, drivePrepared: drive };
fs.writeFileSync(path.join(root, 'private-artifact-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
