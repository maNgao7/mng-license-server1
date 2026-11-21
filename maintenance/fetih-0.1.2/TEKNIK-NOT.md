# Fetih 0.1.2 kapalı önizleme

21 Kasım 2026. Windows x64 paketi Godot 4.7.2 ile üretildi. Çalışan önizleme verileri `oyun-profili` klasöründe tutulur.

- Yayın kaynağı mevcut TikMnG LIVE köprüsüdür. Launcher oturumu varsa oyun onun `owner-helper.cjs` adaptöründen ortak olayları alır. Bağlıyken oyunun yerel köprü sorgu aralığı 180 ms'dir. `gift`, `follow` ve `like` olayları tek sorgu paketi halinde kaydedilir. Oyun olay sırasını kayıt başarılı olunca ilerletir.
- Oyuncu kimliği olayın kullanıcı adından, portre `avatars` klasöründeki önbellekten gelir. Asker kredisi ve sol liste portre indirmesinden bağımsız çalışır.
- Harita turları, bekleyen ordular ve olay kimlikleri `world-v1.json` içindedir. Hediye kuralları `settings-v1.json` içindedir. Savaş bitişi ve sonraki boş tur aynı kayıtta saklanır.
- Saldırı tek savaş olarak hesaplanır. Savunanın sahip olduğu her bölgede ortak ilerlemeye bağlı bir cephe gösterilir. Uzak saldırılarda kara birlikleri kendi bölgelerinden ateş eder. H savaş süresini ayarlar. Karargâh ve fabrika üretimi gerçek saniyeyi kullanır.
- 50 askerle ilk yerleşimde bir tank, bir helikopter ve bir jet verilir. Başlangıç ödülü tur başına bir kez uygulanır. Otomatik birlik eşikleri sırasıyla 150, 300 ve 700 askerdir. Hediye eylemi, normal coin karşılığına eklenir.

Yerel doğrulamada 862 kural, 635 savaş görseli ve 20 ses kontrolü geçti. Oyun içi test, birden çok cephe, bekleyen ordular, yinelenen hediye ve yenilen ordunun listeye dönüşünü doğruladı. Paket, gerçek pencere açılışı ve temiz tur testini geçti.

`0.1.2-preview.2` sürümünde güvenilir grup kimliği ve adet içeren seri hediye ilerleme olayları oyun köprüsüne iletilir. Grup için son kayıtlı toplamdan büyük olan kısım hemen işlenir. Aynı toplamla gelen bitiş olayı, tekrar ya da sıra dışı teslim yeni ödül üretmez. Doğrudan bağlantı, launcher olay akışı ve oyun köprüsüyle üç yerel test geçti. `@bencezehra` oturumu launcher kapalıyken bağlandı ve altı sohbet olayı geldi. Bu oturumda hediye görülmedi. Sonraki denemede yayın çevrimdışı bildirildi.

Güncel önizleme `@tenhaa.34` yayınına bağlandı. Yaklaşık 55 saniyede 16 sohbet ve 2 gerçek hediye olayı işlendi. Her iki hediyenin asker ve coin değerleri sol listede doğrulandı. Oyunun yerel köprü yanıtını almasından güncel liste değerine kadar en uzun ölçüm 33 ms idi. TikTok'taki gönderim ile köprüye ulaşma arasındaki süre ölçülmedi. Windows paketi açılış, oyun içi görsel kontrol ve temiz tur kapısını geçti.

## 0.1.2-preview.3

B menüsünde Füze saldırısı seçilen hediyeye atanır. Varsayılan taban hasar 5.000 askerdir. Her rakip ordu, taban hasar veya mevcut askerlerinin %70'i, hangisi yüksekse o kadar kayıp alır. Kayıp ordunun mevcudunu aşamaz. Rakip birden çok bölgeye sahipse hasar bir kez hesaplanır. Tamamen tükenen ordunun isabet alan bölgeleri devredilir. Henüz bölgesi olmayan gönderenin saldırısı sırada bekler. Gönderen coin karşılığı asker ödülünü de alır.

Bekleyen hediyeler `world-v1.json` içinde haritaya göre saklanır. Oyun, hasarı ve kuyruk güncellemesini aynı kayıtla saklar. Uçuş sırasında harita değişirse görsel iptal edilir ve eski haritaya dönülünce bekleyen saldırı tekrar çizilir. Ana ses çıkışına karışan füze kanalı kamera mesafesinden bağımsızdır. Piyadenin ek görselleri gerçek ordu mevcuduna göre değişir ve sınırlı bir tekil model havuzu kullanılır.

`tests/release-gate.ps1` Godot 4.7.2 üzerinde tamamlandı. Piyade yoğunluğu, füze görseli ve ses kanalı, eşzamanlı hasar, iki bölgeli ele geçirme, harita değişiminde kuyruk, hediye tekrarı ve temiz tur yerel ortamda doğrulandı. Yeni hediye kuralı sentetik olayla test edildi. Masaüstü kısayolu `D:/TikMnG/Fetih/0.1.2-preview.3/Fetih-Masaustu.exe` üzerinden doğrulanan Windows paketini açtı.

## 0.1.2-preview.4

B menüsündeki atanmış hediye kartı sürüklenebilir. Haritada test et düğmesi aynı denemeyi tıklamayla başlatır. Her ikisi de mevcut menü taslağını normal hediye işleyicisinden geçirir. Test turu gerçek harita kaydını ve sıralamaları yazmaz. Bağlı yayın köprüsü gerçek olayları kendi kuyruğunda tutar. Test bitince oyun eski olay konumundan okumaya devam eder.

Savaş hızı 2× başlar. H ve üst çubuk 2× → 3× → 1× → 2× sırasını izler. Ek piyadeler de muharebe sırasında harekete geçer ve kendi sıralarında ateş eder. Hediye sürükleme, 35.000 askerlik Para Tabancası denemesi, testin temiz kapanması ve 3× geçişi grafik arayüzde doğrulandı.

## 0.1.2

Varsayılan savaş hızı 1×. H basılıyken 3×, bırakınca veya pencere odağı kaybolunca 1×. Balina Dalışı (6820, 2.150 coin) füze saldırısının varsayılan hediyesidir. Kaydedilmiş kural veya farklı füze ataması korunur. Füze sesi kamera mesafesinden bağımsızdır. Diğer savaş ve araç sesleri kameraya bağlıdır. Füze isabetindeki sarsıntı 0,88 saniyede söner ve kamera ofseti geri yüklenir.

Windows tam paket kapısı geçti. 1280×800 pencerede, Radeon RX 9070 XT üzerinde sekiz adet 50.000 askerlik ordu ve dört muharebe sırasında 34 eşzamanlı füze isabeti sınandı. Ölçülen en yüksek p95 13,66 ms, en uzun tek kare 17,98 ms. Ölçüm bu makineye ve senaryoya aittir. Balina Dalışı katalog, kayıt geçişi ve oyun içi sentetik olaylarla kontrol edildi. Bu sürümde gerçek yayın hediyesi harcanmadı.
