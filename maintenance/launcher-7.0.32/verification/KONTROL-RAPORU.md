# TikMnG 7.0.32 kontrol raporu

## Oyun açılışı

Tek Windows bilgisayarda **Oyna** isteğinden launcher’ın hazır sinyaline kadar ölçüldü. Tablo, kurulu oyunlar için yerel ölçümleri gösterir.

| Oyun | 7.0.31 | 7.0.32 |
| --- | ---: | ---: |
| MNG Dodge Hunter | 5,79 sn | 2,58 sn |
| Pony Katırı | 2,97 sn | 1,60 sn |
| Vak Vak Jump | 2,31 sn | 1,09 sn |
| TikTok VS Profil | 3,43 sn | 1,19 sn |
| Profil Puanlama | 1,23 sn | 1,12 sn |
| MNG Orbit | 2,99 sn | 1,82 sn |
| Fetih | 4,74 sn | 4,31 sn |
| Uslu Yaratık | 0,54 sn | 0,47 sn |

- Kartopu Savaşı 7.0.4’ün yayımlanmış arşivinin SHA-256 değeri doğrulandı. Temiz bir Türkçe karakterli klasörde orijinal oyun kod 1 ile kapandı. Oyun motoru ana sınıfı bulamadığını bildirdi. 7.0.32 üzerinden aynı paket açıldı. Oyun dünyası ve Kartopu arenası da doğrudan duman testiyle doğrulandı.
- Minecraft PUBG 7.0.4 için aynı klasör koşulunda paketli launcher açılışı, dünya yüklemesi ve arena hazır sinyali doğrulandı.
- Yaratık Arena ve Turkish Forza için önceki 7.0.31 ölçümleri sırasıyla 9,81 ve 14,56 saniyeydi. 7.0.32 tablosuna yeni ölçüm olarak eklenmedi. Diğer oyunların tamamı farklı bilgisayarlarda veya gerçek yayınlarda tek tek denenmedi.

## Widget bağlantıları

- Paketli launcher ile 103 görünür widget bağlantısı yayın aktarımı üzerinden açıldı. Her bağlantının HTML sayfası, kapsamı ve durum yanıtı kontrol edildi.
- Kavanozlarda saklanan hediyelerin gösterimi, yeni seri hediyenin bir kez düşmesi, yeniden açılış ve sıfırlama test edildi. Oyun skorunun geçici sunucu hatasında korunması ve erişim iptalinde temizlenmesi doğrulandı.
- Yayın olayları yerel test verisiydi.

## Kurulum ve güncelleme

- Launcher’da 416 otomatik test geçti. Sunucu sürüm ve bütünlük kontrolü geçti. Sunucu kapısında altı isteğe bağlı test atlandı. Paketli tarayıcı kontrolü ayrıca çalıştırıldı.
- 7.0.31’e göre beklenen sekiz uygulama dosyası değişti, 6.150 dosya byte düzeyinde eşleşti. Kurulum dosyasının boyutu ve SHA-512 değeri güncelleme bilgisiyle eşleşti.
- Parçalı güncelleme planı yerelde çalıştırıldı ve yeniden oluşturulan kurulum dosyalarının SHA-512 değerleri eşleşti. 7.0.31 → 7.0.32 geçişi 199.975.380 bayt (190,7 MiB) gerektirdi. Yalnızca sürüm numarası değişen, yayımlanmayan 7.0.33 denemesi 1.209.526 bayt (1,15 MiB) gerektirdi. Gelecek güncellemelerin boyutu değişen dosyalara bağlıdır.
