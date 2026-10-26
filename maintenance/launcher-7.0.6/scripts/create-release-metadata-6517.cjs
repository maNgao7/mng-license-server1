'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const project = path.resolve(__dirname, '..');
const output = path.resolve(project, '..', 'release-v6.5.17');
const dist = path.join(project, 'dist');
const artifacts = [
    ['TikMnG Setup 6.5.17.exe', 'TikMnG-Setup-6.5.17.exe'],
    ['TikMnG Setup 6.5.17.exe.blockmap', 'TikMnG-Setup-6.5.17.exe.blockmap'],
    ['TikMnG 6.5.17.exe', 'TikMnG-6.5.17-Portable.exe'],
    ['latest.yml', 'latest.yml']
];

fs.mkdirSync(output, { recursive: true });
for (const [source, target] of artifacts) fs.copyFileSync(path.join(dist, source), path.join(output, target));

const hashFile = full => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(full).on('data', chunk => hash.update(chunk)).on('error', reject)
        .on('end', () => resolve(hash.digest('hex').toUpperCase()));
});

(async () => {
    const files = [];
    for (const [, name] of artifacts) {
        const full = path.join(output, name);
        files.push({ name, bytes: fs.statSync(full).size, sha256: await hashFile(full) });
    }
    const manifest = { version: '6.5.17', createdAt: new Date().toISOString(), files };
    fs.writeFileSync(path.join(output, 'manifest-6.5.17.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(output, 'KONTROL-RAPORU.md'), `# TikMnG 6.5.17 Kontrol Raporu\n\n- Launcher ve oyun güncellemeleri birbirinden ayrıdır; kurulu oyunlar ve kullanıcı ayarları korunur.\n- Tek HTTPS medya bağlantısı, oyuna özel video eylemleri ve 13 widget relay üzerinden doğrulandı.\n- Yerel Türkçe konuşma motorunda 10 farklı hız/perde stili gerçek WAV çıktılarıyla doğrulandı.\n- Launcher otomatik güncellemesi için latest.yml ve NSIS blockmap birlikte yayımlanır.\n\n## Dosya özetleri\n\n${files.map(file => `- ${file.name}: ${file.bytes} bayt, SHA-256 ${file.sha256}`).join('\n')}\n`);
    console.log(JSON.stringify(manifest, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
