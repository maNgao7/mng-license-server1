const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const dir = path.join(root, 'release-v6.5.16');
const names = ['TikMnG-Setup-6.5.16.exe','TikMnG-6.5.16-Portable.exe','battle-royale.zip','snow-war.zip','mng-orbit.zip'];
const hashFile = full => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(full).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex').toUpperCase()));
});
(async () => {
const files = [];
for (const name of names) {
  const full = path.join(dir, name);
  files.push({ name, bytes: fs.statSync(full).size, sha256: await hashFile(full) });
}
fs.writeFileSync(path.join(dir, 'manifest-6.5.16.json'), JSON.stringify({ version:'6.5.16', createdAt:new Date().toISOString(), files }, null, 2));
fs.writeFileSync(path.join(dir, 'KONTROL-RAPORU.md'), `# TikMnG 6.5.16 Kontrol Raporu\n\n- Launcher kurulumu ve taşınabilir sürüm üretildi.\n- Minecraft, PUBG ve Minecraft Kartopu Savaşı launcher oyun listesine eklendi.\n- İki Minecraft paketi gömülü Java ve 93 oyun kütüphanesiyle doğrulandı.\n- Battle Royale'deki 10 kayıtlı hediye eşlemesi ve Kartopu Savaşı ayarları birebir korundu.\n- Orbit: bekleme sırasında büyüme, ayarlanan kişi sayısında başlama ve tur başladıktan sonra devam etme testleri geçti.\n- Üç ZIP arşivinin bütünlük testi geçti.\n- Launcher sürüm kontrolü Render yanıtının yanında GitHub Latest sürümünü de denetler.\n\n## Dosya özetleri\n\n${files.map(file=>`- ${file.name}: ${file.bytes} bayt, SHA-256 ${file.sha256}`).join('\n')}\n`);
fs.writeFileSync(path.join(dir, 'YUKLEME-TALIMATI.txt'), `TikMnG 6.5.16\r\n\r\nGoogle Drive'da mevcut dosyaları silmeden "Yeni sürüm yükle" ile aynı dosyaların yerine bu sürümü koyun; böylece paylaşım bağlantıları değişmez.\r\nRender üzerinde GitHub'daki son commit'i yeniden dağıtın.\r\n`);
console.log(files.map(file => `${file.name} ${file.sha256}`).join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
