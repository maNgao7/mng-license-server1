# TikMnG 7.0.39 — Ring Steam bağlantısı

Ring’in Steam düğmeleri kurulu Steam uygulamasında Online Boxing 3D Demo mağazasını açar. Steam kurulu değilse, kayıtlı protokol bozuksa veya Steam çağrısı reddedilirse resmi HTTPS mağaza sayfası açılır. Düğme oyunu çalıştırmaz veya indirmeyi kendiliğinden başlatmaz.

Önceki sürüm HTTPS bağlantısını yalnız varsayılan tarayıcıya gönderiyordu. Renderer’dan gelen girdiler hâlâ yalnız kimlik bilgisi içermeyen HTTPS adresleri olabilir; doğrudan steam/file/javascript komutları kabul edilmez. Steam komutu yalnız resmi store.steampowered.com/app/<sayısal kimlik> adresinden türetilir. Yalnız Windows’un herkese açık Steam protokol kaydı okunur; hesap, parola veya çerez okunmaz.

Bu klasör maintenance/launcher-7.0.38 üzerine uygulanacak dar kaynak katmanıdır. Önce 7.0.38 kaynaklarını ayrı bir derleme dizinine kopyalayın, sonra bu klasördeki main.js, package.json, lib/, tests/ ve tools/ dosyalarını üzerine uygulayın. Önceki üretim bağımlılıklarını ve kilitli Electron 31.7.7 motorunu kullanın. Üretim bağımlılığı eklenmedi.

Doğrulama: tests/release-gate.ps1 475/475 başarılı. Paketlenmiş 7.0.39 uygulamasında Ring detay düğmesi, iç SVG simgesi ve Yayın Dosyaları Steam düğmesi gerçek renderer/IPC üzerinden sınandı; bozuk Steam çağrısının HTTPS geri dönüşü de gözlendi. Dış açıcı bu regresyonda kontrollü bir sahteydi, gerçek Steam mağazasının açıldığı iddia edilmez. Eski Ring metadata testi yayınlanmış video + Steam kaynaklarına eşitlendi. Hapisten Kaç testleri mevcut değişmeyen paket fikstürünü, fast-check mevcut yerel kurulumu kullanır.

Ring 0.1.0 ZIP’i, oyun akışı, hediye/beğeni kuralları, kalıcı ayarlar, lisans ve LIVE davranışı değiştirilmedi. Render dağıtılmadı; GitHub son-sürüm beslemesi launcher güncellemesini sağlar. Mevcut kaynak katalogları 7.0.38 sunucu sürümüyle bırakıldı.
