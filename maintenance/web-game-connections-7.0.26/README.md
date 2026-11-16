# TikMnG 7.0.26 bağlantı ve test kaydı

Launcher’ın ortak yayın oturumu `lib/live-session.cjs` ile yönetilir. Profil
Yarışması aynı işlemde `shared-live-connection.cjs` kullanır. VS, Puanlama,
Orbit, Dodge Hunter, Pony Katırı ve Vak Vak Jump yeni paketlerindeki
`launcher-live.mjs` üzerinden `game-live-client.cjs` istemcisini kullanır.
Launcher bu oyunlara yalnızca oturumluk, yetkili bir localhost adresi verir.
Oyun kapanınca istemci ayrılır. Ortak yayın oturumu devam eder.

Oyuncunun launcher’dan yaptığı hesap değişimi veya bağlantıyı kesme kararı,
oyunun otomatik yeniden bağlantısından önceliklidir. Bu davranış
`game-live-owner.cjs` ile test edilir.

## Oyun sahipliği

| Oyun | Yayın kaynağı |
|---|---|
| Hapisten Kaç | Launcher ortak oturumu, yetkili yerel yayıncı köprüsü |
| Uslu Yaratık | Launcher ortak oturumu ve olay günlüğü |
| Teke Tek Profil | Launcher ortak oturumu |
| Profil Yarışması | Launcher ortak oturumu ve mevcut oyun bağlantı fabrikası |
| Turkish Forza | Launcher ortak oturumu ve yerel yayıncı köprüsü |
| VS ve Puanlama | Launcher ortak oturumu, iki görünüm için tek fiziksel paket |
| Orbit, Dodge Hunter, Pony Katırı, Vak Vak Jump | Launcher ortak oturumu ve yetkili yerel olay akışı |
| Yaratık Arena ve Sesli Sürüş | Mevcut yerel oyun köprüsü |
| Minecraft PUBG, Kartopu, Zombie War, Yılan | Paket sürümünün mevcut Java/yerel köprüsü |
| Gelene Geçene | Mevcut Unturned köprüsü |

Hediye, yorum, beğeni, takip ve kullanıcı profili verileri SDK'nın özgün
olaylarından gelir. Oyunun mevcut normalleştirme, yinelenen olay koruması ve
eylem mantığı korunur. Ortak oturumdan gelen olaylar oyun tarafından
launcher’a ikinci kez geri gönderilmez.

## Kalıcı dosyalar ve paketler

Kütüphane konumu launcher’ın `library_root_v1` ayarındadır. Varsayılan konum
`%APPDATA%/mng-tiktok-game/games` dizinidir. Yönetilen oyunların etkin sürümü
`.game-library/<paket>/active.json` ile seçilir. `game-library.cjs` kurulum
sırasında hediye eşleşmelerini, ayarları ve kayıtları korur.

Yeni oyun arşivlerinin kaynağı, yerel konumu, SHA-256 değeri ve tek dosya
güncelleme listesi `game-packages/packages.json` içinde kayıtlıdır. Geçerli
kurulumlarda yalnızca değişen dosyalar indirilir. Temiz kurulum tam arşivi
kullanır. Dosyalar GitHub'dan gelir.

## Doğrulama

`qa/all-web-live-final.json` dosyası gerçek launcher üzerinden sekiz web
oyununun açılışını ve @rebelliouss için gözlenen ortak bağlantı durumunu
kaydeder. Bu kontrol her oyunda gerçek bir hediye eylemi uygulandığı iddiası
taşımaz. Yerel sözleşme testleri oyun sunucularına sentetik SDK sonuçları
vererek başarılı bağlantı, hata ve bağlantı kopması davranışlarını kontrol eder.

Eski ve yeni native açılış sonuçları `qa/native-launch-results.json`,
`qa/native-optimized.json` ve `qa/caahr-packaged.json` içindedir.
İlk kurulum doğrulaması, Unity motorunun başlaması ve oyun menüsünün hazırlanması
toplam açılış süresine dahildir.

Web performansı yavaş mobil bağlantı benzetiminde ölçüldü. Canlı sunucudaki
dağıtım ve Google Search Console sonucu ayrıca doğrulanır.
