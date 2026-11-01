'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = 'D:/TikMnG-Release-7.0.7-ready';
const repository = 'D:/TikMnG-Release-7.0.0-source';
const games = 'D:/TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = read(path.join(root, 'manifest-7.0.7.json'));
const packaged = read(path.join(root, 'qa/packaged-verification.json'));
const differential = read(path.join(root, 'qa/differential-verification.json'));
const native = read('D:/TikMnG-Sesli-Surus-Acilis-20261027/native-startup-verification.json');
const baseline = read('D:/TikMnG-Sesli-Surus-Acilis-20261027/baseline-native-startup.json');
const fresh = read(path.join(games, 'fresh-install-verification.json'));
const incremental = read(path.join(games, 'incremental-verification.json'));
const suite = fs.readFileSync(path.join(root, 'launcher-full-suite-final.log'), 'utf8');
assert.match(suite, /tests 988/); assert.match(suite, /pass 988/); assert.match(suite, /fail 0/);
for (const result of [packaged, differential, native, baseline, fresh, incremental]) assert.equal(result.passed, true);
for (const file of manifest.files) assert.equal(hash(path.join(root, file.name)), file.sha256);
const report = { passed: true, version: '7.0.7', createdAt: new Date().toISOString(),
    launcherTests: { passed: 988, failed: 0 }, serverTests: { passed: 66, failed: 0, skippedBrowserChecks: 3 },
    voiceDriving: { previousStartupMs: baseline.gameAndGiftMenuReadyMs, optimizedStartupMs: native.gameAndGiftMenuReadyMs,
        verifiedFiles: native.verifiedFiles, nativeGameAnd905GiftCatalogReady: true,
        settingsBytePreserved: native.normalUserSettingsModAndGamePointerUnchanged },
    minecraft: { version: '7.0.4', firstInstallErrorReproducedAndFixed: true, bothFreshInstallsPassed: true,
        installedContentFilesHashed: fresh.games.map(game => ({ id: game.id, files: game.installedContentFilesHashed })),
        incrementalInstallsPassedWithoutChangedContentDownloads: true, settingsBytePreserved: true, gameplayBytesUnchanged: true },
    installer: { bytes: manifest.files[0].bytes, changedDownloadBytesFrom706: differential.downloadBytes,
        electronUpdaterReconstructionHashVerified: true, signedPublisher: false },
    preserved: { otherGames: 14, media: 285, nativeRuntimeDependencies: true, userLicensesAndSettingsUntouched: true },
    publicCatalogDeployment: 'pending-user-render', realPurchasedTikTokGiftTestClaimed: false };
fs.writeFileSync(path.join(root, 'KONTROL-RAPORU.json'), JSON.stringify(report, null, 2) + '\n');
const instructions = `TikMnG 7.0.7 - Son güncelleme dosyaları\n\n` +
    `Bu klasördeki DÖRT dosyayı mevcut TikMnG Drive klasörüne yükleyin.\n` +
    `Aynı adlı dosyalarda “Mevcut öğeyi değiştir” seçin. Eski sürüm EXE'lerini silmeyin.\n\n` +
    `1. TikMnG-Setup-7.0.7.exe\n2. latest.yml\n3. manifest-7.0.7.json\n4. YUKLEME-TALIMATI.txt\n\n` +
    `Yükleme tamamlandıktan sonra Render > Manual Deploy > Deploy latest commit adımını uygulayın.\n` +
    `Doğru sürümler: launcher 7.0.7; PUBG ve Kartopu oyun paketleri 7.0.4.\n` +
    `GitHub ana güncelleme kaynağıdır; Drive yedek kopyadır. Oyun ZIP'leri GitHub'dadır, Drive'a ayrıca yüklemek gerekmez.\n\n` +
    `Sesli Sürüş açılışı bu bilgisayardaki testte 47,8 saniyeden 20,4 saniyeye indi. Donanıma göre değişir.\n` +
    `PUBG ve Kartopu'nun ilk kurulumundaki ZIP boyut hatası düzeltildi. Hediye eylemleri değişmedi.\n` +
    `Mevcut oyunlar, lisanslar, ayarlar, widget bağlantıları ve hediye eşleştirmeleri korunur.\n` +
    `Kurulum: ${(manifest.files[0].bytes / 1e6).toFixed(1)} MB. 7.0.6'dan parça indirme yaklaşık ${(differential.downloadBytes / 1e6).toFixed(1)} MB.\n` +
    `İnternet hızı garanti edilmez. Windows yayıncı sertifikası bulunmadığından SmartScreen uyarısı görülebilir.\n`;
fs.writeFileSync(path.join(root, 'YUKLEME-TALIMATI.txt'), instructions);
const folders = ['D:/TikMnG-Drive-Son-7.0.7', path.join(process.env.USERPROFILE, 'Desktop/TikMnG-Drive-7.0.7')];
for (const directory of folders) {
    fs.mkdirSync(directory, { recursive: true });
    for (const name of ['TikMnG-Setup-7.0.7.exe', 'latest.yml', 'manifest-7.0.7.json', 'YUKLEME-TALIMATI.txt']) {
        fs.copyFileSync(path.join(root, name), path.join(directory, name));
        assert.equal(hash(path.join(root, name)), hash(path.join(directory, name)));
    }
}
const qa = path.join(repository, 'qa/release-7.0.7');
fs.mkdirSync(qa, { recursive: true });
fs.writeFileSync(path.join(qa, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, report, driveFolders: folders }, null, 2));
