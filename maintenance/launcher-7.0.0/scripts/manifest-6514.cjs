const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const releaseDir = path.join(root, 'release-v6.5.14');
const files = [
  ['TikMnG-Setup-6.5.14.exe', path.join(root, 'launcher', 'dist', 'TikMnG Setup 6.5.14.exe')],
  ['TikMnG-6.5.14-Portable.exe', path.join(root, 'launcher', 'dist', 'TikMnG 6.5.14.exe')],
  ['zombie-war.zip', path.join(releaseDir, 'zombie-war.zip')],
  ['KONTROL-RAPORU.md', path.join(releaseDir, 'KONTROL-RAPORU.md')],
  ['YUKLEME-TALIMATI.txt', path.join(releaseDir, 'YUKLEME-TALIMATI.txt')]
];
const manifest = {
  version: '6.5.14',
  releaseDate: new Date().toISOString().slice(0, 10),
  files: files.map(([name, file]) => ({
    name,
    bytes: fs.statSync(file).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  }))
};
const out = path.join(releaseDir, 'manifest-6.5.14.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(out);
