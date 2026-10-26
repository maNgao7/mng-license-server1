const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const releaseDir = path.join(root, 'release-v6.5.13');
const files = [
  ['TikMnG-Setup-6.5.13.exe', path.join(root, 'launcher', 'dist', 'TikMnG Setup 6.5.13.exe')],
  ['TikMnG-6.5.13-Portable.exe', path.join(root, 'launcher', 'dist', 'TikMnG 6.5.13.exe')],
  ['zombie-war.zip', path.join(releaseDir, 'zombie-war.zip')]
];
const manifest = { version: '6.5.13', releaseDate: '2026-10-16', files: files.map(([name, file]) => ({ name, bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })) };
fs.writeFileSync(path.join(releaseDir, 'manifest-6.5.13.json'), JSON.stringify(manifest, null, 2));
console.log('3 dağıtım dosyası doğrulandı.');
