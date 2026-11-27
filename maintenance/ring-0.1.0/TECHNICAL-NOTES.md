# Hediye Box masaüstü ön izlemesi

25 Kasım 2026. `TikMnG - Hediye Box.lnk` özel yerel kopyadaki Online Boxing 3D Demo ringini açar. Yerel ön izleme sürümü 0.0.15-dev.

## 0.0.15-dev — Nakavt ve P geçişinin onarımı

Gerçek oyun ve native HUD birlikte çalışırken eski sürümde art arda nakavtlar `FIGHT RESULT`, `After round` ve `REPLAYS SET PAUSED` çıktıları üretti. Özgün oyunun hakem/raund sistemi, TikMnG'nin sonuç ve yeni rakip yerleştirmesine paralel çalışıyordu. Sadece sayacı her karede geri almak yeterli olmadı; aynı tick içinde fiziksel düşüş raundu bitirebiliyordu. Sabitlenmiş EXE'nin yerel Capstone incelemesinde `0x9108` alanının 2 değeri özgün hakem güncellemesini atlıyor (RVA `0x295fb3b`, `0x2961723`). Hazırlık tamamlandıktan sonra bu mod uygulanır. Böylece özgün 1–10 sayımı, otomatik raund bitişi ve tekrar gösterimi çalışmaz. Hareket, AI, eldiven teması ve MuJoCo fiziği korunur; P'nin beş saniyelik başlangıcı ayrı kalır. Başka oyun sürümleri hash denetiminden geçemez.

Nakavt sonucu kaybedeni zaten emekli ediyor ve yeni rakibi sıradan alıyordu. `playedMatch` bayrağı açık kaldığından sonraki P kazananı da çıkarıyordu; sonuçta bayrak sıfırlanır. Kazanan kendi köşesinde ve mevcut yatay konumunda kalır. Rakip yokken P kazananı silmez. Rakip gelince sonraki P maçı başlatır. Devam eden maçta P ile iki boksörü çıkarıp sıradakilere geçme davranışı korunur. Yeni yerleştirmede `mj_resetData` ile önceki KO'nun hız, kuvvet ve çözücü başlangıç verisi temizlenir; yeni poz ve yerel bekleme gardı uygulanır. Boksörün özgün düşüş durumu yalnız yeniden yerleştirmede sıfırlanır.

`qa/round-stability.cjs`, gerçek masaüstü akışı ve oyun içi HUD ile sekiz ardışık nakavt, tek kazananın beklemesi, P, yeni rakip ve tekrar başlatmayı geçti. İlk yalnız kazanan 12,5 saniye, son eşleşme 25 saniye fazladan bekletildi. Hiçbir özgün hakem sonucu/tekrar olayı gelmedi, sayımlar sıfır kaldı. `qa/p-next-round.cjs` altı maç başlangıcı ve altı manuel temiz geçişi geçti; eski hediye kuyruğu yeni boksöre zarar vermedi. Oyun görüntüsünde kazananın ringde tek kaldığı görüldü. MuJoCo günlüğüne yeni kararsız fizik uyarısı eklenmedi.

Tam sürüm kapısındaki 152 otomatik test, 69 kamera hesabı ve 49 giriş/temizlik kontrolü geçti. Kapı mevcut sürüme ait canlı hediye-isabet kanıtında durdu. Bu sonuç genel yayının onaylandığı anlamına gelmez; kurulum özel önizlemedir. Uzun yerel testler bütün bilgisayarlarda sınırsız süre sorunsuzluk garantisi değildir. Native kapanış nedeni ve sınırlı hata çıktısı artık uygulamanın startup.log kaydına eklenir; Steam kimlik satırları alınmaz. Testler ayrı geçici uygulama profilleri kullanır ve gerçek ayarlar/galibiyet kaydını değiştirmez.

## 26 Kasım 2026 genel kontrolü

Kurulu 0.0.15-dev kopyasıyla boş açılış, tek ve iki köşe, zemine ayak teması, P öncesi ısınma, serbest kamera ve zoom geçti. Gerçek native maçta dört ayrı 25 hasarlı hediye yumruğuyla nakavt oluştu. Kazanan tek kaldı, yeni rakip geldi ve karşı köşeden yedi ayrı isabetle ikinci sonuç oluştu. 20 hediyelik emrin kalan kısmı yeni eşleşmeye aktarılmadı. Test kaynak yerine kurulu modülleri yükledi.

152 otomatik regresyon ve 118 kamera/giriş kontrolü tekrar geçti. Bunlar B/ESC, hasar ve beğeni eşikleri, tekrar teslim edilen olaylar, sıra önceliği, kazananları sıfırlama/boyutlandırma, pano, yeniden bağlanma ve ayar kalıcılığını içerir. Üç widget düzeni örnek profillerle incelendi; üç gerçek HTTPS belge, durum cevabı ve tarayıcıda hediye simgeleri yüklendi. Bu, LIVE Studio içinde kaynak kabulü testinin yerine geçmez.

`qa/live-ring-run.cjs` iki köşe için aynı favori hediyeyi seçebiliyordu. Sağ köşe seçimi artık solda kullanılan hediyeyi eler ve farklı bir katalog hediyesine döner; dört örnek gerçek ayar doğrulamasından geçti. @tenhaa.34 ile üç dakikalık doğal canlı gözlemde 38 sohbet, 13 hediye paketi ve 1.720 beğeni alındı. Dört gerçek hediye göndericisi katıldı; iki portre, iki can barı ve iki bekleyen görüldü. Maç başladı ve gözlem sırasında kapanmadı. Maçtaki kişilerin seçili köşe hediyeleri tekrar gelmedi; canlı hediye-isabet kanıtı oluşmadı. Bu deneme hediye modundaydı, beğenilerle yumruk doğrulaması olarak raporlanmaz. Tam sürüm kapısı bu eksik canlı kanıt nedeniyle başarısız kalır; özel önizleme genel yayına onaylı değildir. Ayrıntılı kayıt `qa/live-ring-20261126-tenhaa.json` dosyasındadır.

Kurulu kopya 90 saniye boş tutuldu. Eski katılım ayarları, beğeni/takip paketleri, normal sohbet ve geçmiş katıl/hediye olayları kendiliğinden boksör oluşturmadı. Sonrasında yeni KATIL yorumu ve yeni hediye birer köşeyi doldurdu; oyun P beklemeyi sürdürdü. Test süreçleri kapatıldı; gerçek yayın ayarlarına ve galibiyet kayıtlarına test verisi yazılmadı.

## Yayın akışı

- Ring boş açılır. Varsayılan katılımda “katıl” yazan veya herhangi bir hediye gönderen ilk kişi kırmızı, ikinci kişi mavi köşeye geçer. Sonraki adaylar ring dışında bekler. Toplam hediye değeri sırayı belirler. Eşitlikte önce katılan öne geçer. Sıradaki kişinin altında görünen FPS, hediye toplamının oyun içindeki gösterimidir. B menüsünden sıranın diğer sayfaları da görülebilir.
- İki köşe dolunca P beş saniyelik geri sayımı başlatır. Rakamlar oyun penceresinin ortasında görünür ve pencere boyutuna göre ölçeklenir. Kamera artısı sayım bittiğinde geri gelir. Gongdan sonra boksörler oyunun hareket ve gard kontrolleriyle rakiplerine yaklaşır. Uzaktan ilerleyişi kesilen boksör kısa bir yan adımla açı değiştirip yeniden yaklaşır. İkinci bir P aynı geri sayımı tekrar başlatmaz.
- B yayın ve maç ayarlarını açar. Hediye modunda aktif boksör kendi köşesine seçilen hediyeyi gönderince yumruk atar. Varsayılanlar mavi için Gül (5655), kırmızı için TikTok (5269). Yorum modunda her ayrı A mesajı bir yumruk verir. Beğeni modunda aktif boksör kendi beğeni eşiğini her geçtiğinde bir yumruk alır. Bekleyenlerin hediyeleri sıra puanı kazandırır. Tekrar teslim edilen paketler ikinci bir yumruk üretmez.
- İsabetler oyunun hasar sinyali ve MuJoCo eldiven temasından okunur. Vuruş başına tek kayıt tutulur. Her boksör 100 canla başlar. B menüsünde A yorumu, kişisel beğeni eşiği ve her seçili köşe hediyesi için 1–100 arasında hasar seçilir. Menzilde başlayan her seyirci yumruğu seçilen hasarı bir kez uygular. Eldiven veya gard teması önce işlenir. Temas örneği kaçırılırsa vuruş animasyonunun sonunda aynı hasar bir kez tamamlanır. Yeni turda kazananın canı dolar, kaybedenin köşesi boşalır veya sıradaki rakibe geçer. Yeni karşılaşma yeniden P bekler.
- Oyun serbest kamerayla açılır. Köşeler dolduğunda kamera oyuncunun baktığı açıyı korur. Fareyle bakılır, WASD ile dolaşılır, Boşluk ile yükselinir ve Ctrl ile alçalınır. Sağ fare hızlı geçici yakınlaşma, tekerlek kalıcı yakınlaşma, E hedefteki boksörü arkadan takip, Home ring görüntüsüne dönüş içindir. F veya Boşluk tekrar serbest kameraya geçirir.
- B menüsünde son yazılan geçerli TikTok adı, Bağlan’a basılmadan da bu bilgisayardaki oyun profiline kaydedilir. Başındaki @ kaldırılır. Alanı temizlemek kayıtlı adı da temizler. Masaüstü kumandası ve ring aynı Electron profilindeki `hediye-box.last-channel.v1` kaydını okur.
- Baş işaretleri yuvarlak portre ve yeşilden kırmızıya dönen can barıdır. TikMnG sırt yazısı gövdeye yansıtılır. Gong, isabet seyirci tepkisi ve maç sonu sesi ayrı olaylarla çalar.

## Teknik kaynak ve kalıcılık

- Oyun kopyası `D:/TikMnG/Hediye-Box-Private/native-game`. Asıl Steam kurulumu `D:/SteamLibrary/steamapps/common/OnlineBoxing3DDemo`. İki EXE de `9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67` hash'ini taşır.
- Başlatma, tek örnek kilidi ve pencere takibi `main.cjs`, `src/native-spectator.cjs` ve `tools/spectator-worker.py` dosyalarında. Python 3.14 ve Frida 17.27.4 yerel ön izlemenin çalışma bağımlılıklarıdır. Bağdaştırıcı yalnızca doğrulanan oyun sürümünü açar.
- `tools/spectator-native.js` orijinal hareket, gard, yumruk ve temas sistemini kullanır. Bekleme pozunu sabitler, otomatik yumruk girişini süzer ve yalnızca komutla gelen yumrukları yürütür. Köşelerdeki ayakkabı tabanı mesafesi oyunun kendi zemin geometrisinden ölçülür. `tools/native-camera.js` ve `tools/spectator-camera.js` gerçek kamera/projeksiyonu ve MuJoCo baş konumlarını kullanır. Bağdaştırıcı öncesi incelemeler `qa/native-camera-notes.md` belgesinde.
- TikMnG ortak yayın bağlantısı `D:/TikMnG/Animal-Times-Live/bridge` kaynaklarından paketlenir. Ortak yayın sahibi sağlandıysa olayları ondan okur. Tek başına aynı SDK soketinden sohbet ve ham hediye alır. Owner adresi ve erişim bilgisi yalnızca süreç ortamından sağlanır.
- `src/live-client.cjs` aktif oda kapsamlı `eventId`, kullanıcı kimliği, takma ad, portre adayları, `giftId`, adet, `streakId` ve birim jeton taşır. `src/audience-queue.cjs` olay kimliği ve seri sayacıyla tekrarları ayıklar. Portre URL'si profil aday havuzundan veya son gözlenen portreden gelir. Görsel yüklenemezse isim gösterilir.
- Katalogdaki 905 yerel görsel ve ID `assets/gift-catalog-origin.json` içindeki launcher kataloğundan alınır. Varsayılan ayarlar ve seçilen hediyeler `%APPDATA%/TikMnG-Hediye-Box-Private/audience-settings.json` yolunda sürümlü ve atomik kaydedilir. Canlı katılımcı kuyruğu, puanlar ve test verileri bellekte tutulur.
- Yükleme kapağı `assets/loading-ring.png`, ring zemini TikMnG için hazırlanan `assets/ring-mat.svg` dosyasından. Ring varlığının yedeği ve özgün oyun yapılandırması `D:/TikMnG/Hediye-Box-Private/original-assets` içindedir.

## 0.0.6-dev doğrulaması

Aşağıdaki 22 Kasım kaydı önceki sürümün sonucudur. Güncel kontroller en alttadır.

- Yerel ön izleme kapısı için `tests/release-gate.ps1 -FoundationOnly` çalıştırılır. 91 otomatik test, 45 kamera hesabı ve 33 kamera kontrolü geçti. Son olay saatinin arka arkaya 60 kez değiştiği testte panel yalnızca bağlantı durumu değişince güncellendi.
- `node tools/spectator-smoke.cjs --round` gerçek oyun işleminde boş ringi, tek boksörü, iki köşeyi, yakınlaştırmayı, komutsuz can kaybı olmamasını, yumruk isabetini, nakavtı, kazananın canının dolmasını ve ikinci rakibin isabetini kontrol eder.
- Tek boksörün arkadan takibi hem ilk katılımda hem nakavttan sonra denendi. İki köşede de sırt yazısının kamera alanına yansıdığı doğrulandı.
- 22 Kasım saat 23.50'de `@tenhaa.34` ile bir dakikalık canlı bağlantıda 34 hediye ve 49 beğeni paketi alındı. 83 pakette portre adresi vardı. Bu sürede sohbetle katılan olmadı. Sayaçlar ve zamanlar `qa/live-check.json` içinde.
- Kurulu oyunla ikinci canlı kontrolde iki izleyici yerel olarak test köşelerine yerleştirildi. İki gerçek portre görüntülendi. Maç sırasında seçilen hediyelere ait üç paket alındı ve rakibin canı düştü. Test oturumu ayrı profilde kapatıldı. `qa/live-ring-check.json` olay sayısını ve denenen oyun dosyalarının özetlerini içerir. Tam yerel kontrol `tests/release-gate.ps1` ile çalışır.
- Orijinal oyundaki MuJoCo 3.3.7 ile zemin ve eldiven temaslarını hesaplayan işlevlerin imzaları aynı sürümün resmî kaynağıyla karşılaştırıldı. [MuJoCo 3.3.7](https://github.com/google-deepmind/mujoco/blob/3.3.7/include/mujoco/mujoco.h)
- Yayın bağlantısında paketlenmiş TikTok-Live-Connector 2.4.4 kullanılır. Yerel GitHub kopyası `D:/TikMnG-GitHub-Araclari/tiktok-live-connector-2.4.4` içindeki `cdd6715` revizyonudur. [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector)

## 0.0.7-dev yerel ve canlı kontroller

- Aynı yayın bağlantısında v2 sohbetindeki `comment` ve v3 sohbetindeki `content` okunur. Oda ve mesaj kimliği tekrarlı teslimleri ayıklar. Bir portre adresi yüklenemezse sıradaki aday denenir.
- Ring genişlik ayarı 65'ten 72'ye çıktı. Bekleme gardı her iki ayakkabının zemine uzaklığına göre oyunun doğal duruşları arasından seçilir. Asıl oyunda iki köşe, isabet, nakavt, can yenileme ve sonraki rakiple ikinci maç denendi. Dört ayakkabıda ölçülen en büyük başlangıç boşluğu 0,0011 dünya biriminden küçüktü.
- Nakavt sunumu iki dövüşçünün son konumu ve portresiyle 2,1 saniye sürer. Sonuç pozları ve seyirciler kamera katmanında çizilir. Sıra figürleri fizik simülasyonuna eklenmez. Görüşe yakın sıra satırları işlenir, portreler en çok dört eşzamanlı istekle alınır. Yerel [Three.js r170](https://github.com/mrdoob/three.js/tree/r170) kaynağından gereken geometri ve kamera matematiği derlenir (beab9e8).
- 96 otomatik kontrol, 45 kamera matematiği ve 33 kamera kontrolü geçti. 5.000 sentetik adaydan 136’sı ölçülen kamera açısından çizildi. Bu makinede ısınma sonrası sıra çiziminin 95. yüzdeliği 2,6 ms ölçüldü. Ölçüm yalnızca sıra çiziminin işlemci süresini kapsar.
- `qa/live-ring-run.cjs` kurulu uygulamanın gerçek B bağlantısı ve P başlangıcı üzerinden canlı kontrol yapar. Gerçek izleyiciler kendileri katılır. Gözlem süresinde yeterli olay yoksa `qa/live-ring-attempt.json` yazılır. Yalnızca iki portre ve iki can barı ekranda görülüp doğru boksörün gerçek hediyesinden sonra rakibin canı düştüğünde dosya özetleriyle `qa/live-ring-check.json` oluşturulur.
- 23 Kasım 00.26–00.28 İstanbul saatinde @tenhaa.34 ile kurulu sürümde 22 sohbet ve 10 hediye paketi alındı. Oturumda yerel yerleştirme yoktu. İki gerçek portre ve iki can barı göründü. Test profilinde maviye TikTok, kırmızıya Gül seçildi. İki eşleşen hediye paketi ve rakibin canında düşüş görüldü. Bu gözlemde doğal `katıl` mesajı ve bekleme sırası oluşmadı. Sohbetle katılım, tekrar eden A mesajları ve bekleme sırası ayrı yerel senaryolarda denendi.
- `qa/local-ring-result.cjs` kurulu oyunda yayın bağlantısı olmadan dört test izleyicisiyle çalıştırıldı. Ring dışında iki boksörün görünmesi, 100 FPS katkının 0 FPS katkıdan önce gelmesi, nakavt gösterimi ve kazananın tam canla en yüksek sıradaki rakibi beklemesi doğrulandı. Test ayrı bir ayar klasöründe kapandı.

## 0.0.9-dev

- ESC ses ve grafik ayarlarını açar. Oyunun ses düzeyi ve sunum efektleri ayrı ayarlanır. Sıradaki boksörlerin görüntü kalitesi `game-options.json` dosyasında saklanır.
- B menüsünde sağ ve sol hediyeleri ayrı seçilir. Yorum, hediye ve beğeni hasarı ilk kurulumda 15'tir. Yayıncının kaydettiği seçimler yeniden açılışta yüklenir. Takiple katılım açıksa takipçi boş köşeye veya sıraya girer. Beğeni eşiği her boksör için ayrı sayılır.
- Yeni kurulumda “katıl” ve herhangi bir hediye aynı sıraya alır. Gongdan sonra A yorumu, kişisel beğeniler ve seçili köşe hediyesi birlikte yumruk tetikleyebilir. B menüsünden yalnızca beğeni de seçilebilir. Her eşik için 1–100 yumruk ayarlanır. Eski ayarlarda varsayılan değer 1 yumruktur. Kalan beğeniler aynı boksörün bir sonraki eşiğine eklenir. Yeni maçta sayaç sıfırlanır.
- Bekleyenler ringin dışındaki ahşap zeminde yan yana sıralanır. Altın renkli sıra numarası ve katkı katılımcıyla birlikte hareket eder. Dövüşçülerin baş portreleri ve can barları yüzde on büyütüldü.
- Maç sonu için sonradan çizilen kazanan ve kaybeden figürleri kaldırıldı. Son vuruş ve sonuç arasındaki sürede orijinal boksörler ringde kalır. Maç sona erince kazanan ve sıradaki katılımcı yeniden P komutunu bekler.

23 Kasım'daki yerel ring testinde sohbetle ve hediyeyle gelen oyuncular köşeleri doldurdu. Yeni takipçi sıraya girdi. Her 5 beğeniye 2 yumruk ve isabet başına 1 hasar ayarında 20 beğeni rakibin canını 59'dan 51'e indirdi. İki köşede de orijinal boksörün nakavtı ayrı maçlarda gözlendi. 110 otomatik test geçti.

Saat 12.24 İstanbul saatinde kurulu oyundan @benyigit61 hesabına bağlantı denendi. TikTok hesabı çevrimdışı bildirdi. Bu sürümde gerçek yayından hediye ve beğeniyle isabet doğrulaması açık. Son denemenin sayımları `qa/live-ring-attempt.json` içinde.

## 0.0.10-dev

B menüsünde ilk kişisel beğeniyle katılım ve yeni takiple katılım ayrı ayrı açılır. İkisi de ilk kurulumda ve bu ayarları içermeyen eski kayıtlarda açıktır. Beğeniyle katılım kapatılsa da ringdeki boksörün beğeni yumrukları, seçilen yumruk kaynağına göre çalışır. Katılmayı sağlayan beğeni ve sırada beklerken atılan beğeniler maçın yumruk sayacına aktarılmaz. Bekleyenlerin sırasını oturumdaki hediye toplamı, eşitlikte katılım zamanı belirler.

Kurulu oyunda yerel olaylarla yapılan maçta takiple kırmızı köşe, ilk beğeniyle mavi köşe doldu. Gongdan sonra mavinin beğenileri yumruk üretti. Orijinal kırmızı boksör mindere düştü, mavi ayakta kaldı. Kazananın canı yenilendi ve sıradaki 100 puanlı katılımcı boş köşeye geçti. 111 otomatik test geçti. @benyigit61 saat 12.31'de çevrimdışı bildirildiği için canlı hediye, portre ve beğeni doğrulaması bekliyor.

### Masaüstü ön izlemesinde ring çevresi

Özel demo ringin arkasını siyah çizer. Ringin çevresinde 64 sabit telefon konumu vardır. Dört yönden, aralarında kısa gecikmeler olan üçlü flaşlar gelir. Kamera konumu ve ringin derinlik maskesi her parıltının nereden görülebileceğini belirler. ESC içindeki “Seyirci telefon flaşları” tercihi kaydedilir. Sıra konumları oyundaki ahşap zeminin merkezine göre hesaplanır. Grafik kalitesi bekleyen boksörlerin görünme mesafesini ve yazılım çizimindeki ayrıntıyı belirler.

Sıradaki iki model, özel kurulumun zil öncesindeki gard karesinden alındı. RenderDoc 1.47 renk geçişinde her boksörün 23 gövde parçasını, malzemelerini ve dünya ölçeğini kaydetti. Kaynak kare özel kurulumda `original-assets/queue-guard.rdc` dosyasında. `tools/build-queue-boxer.py` kare özetini doğrulayarak iki modeli üretir. Bekleyen boksörlerde ısınma hareketinin temposu kişiye göre değişir. Modelin ayakları zeminde kalırken eldiven, omuz ve baş hareket eder. Sıra çizimi GPU'da her boksör tipi için bir toplu çizim kullanır. Yazılım çiziminde aynı geometri açıya göre önbelleğe alınır. 100 fiziksel konum için modellerin ahşap zeminin içinde kaldığı, halatlara ve birbirlerine değmediği denetlenir. Ring dolduğunda bekleyenlerin tamamı yayın panelinde kalır.

Esc ile ses ve grafik ayarlarını kapatırken odak yalnızca gerçek ring penceresine döner. Windows geri yükleme komutu görev çubuğuna küçültülen oyun için çalışır. `qa/native-escape.cjs --installed` gerçek tuşlarla 1408 × 880 ve 2560 × 1369 pencerelerde boyutun korunduğunu, küçültülen oyunun da geri geldiğini doğruladı.

Saat 12.52'de @benyigit61 yayınından iki profil ve iki can barı görüldü. O maçta beğeniyle üretilen 24 yumruk kabul edildi, 13 isabet hasar verdi. Bu gözlem tribün düzeltmesinden önceki kurulumda yapıldı.

23 Kasım masaüstü testinde zil öncesi gard modelleriyle 2 kişi ringe ve 10 kişi bekleme sırasına yerleşti. Ekran kaydı `qa/arena-ringside-preview.png`. Yerel maçta nakavt, kazananın ayakta kalması ve sıradan yeni rakip doğrulandı. 111 otomatik test geçti. Saat 13.55'te @benyigit61 yayını çevrimdışıydı. Bu paket için gerçek hediye ve portre doğrulaması açık.

Karanlık arka planlı masaüstü sürümünde kamera hareketiyle alınan üç farklı açı oyunun ham karesiyle karşılaştırıldı. Her açıda başların üstündeki 176.000 arka plan pikseli karanlık kaldı. Güncel oyun görüntüsü `qa/arena-ringside-preview.png` dosyasında. 111 otomatik test geçti. @bencezehra yayınında maç başladı, iki portre ve iki can barı göründü. 21 sohbet olayı ve 7 hediye geldi. Aktif dövüşçünün köşe hediyesiyle eşleşen olay görülmedi. Kontrollü maçta 5655 numaralı hediye bir isabet üretti ve can 93’ten 70’e indi.

Telefon flaşlı masaüstü önizlemesinde iki kamera açısından 32 ve 36 aydınlık piksel ölçüldü. 111 otomatik test, 45 kamera kontrolü ve 33 giriş ve görünürlük kontrolü geçti. Kontrollü maçta A yorumu, 5655 hediyesi ve 100 beğeni rakibin canını sırasıyla 100’den 93’e, 70’e ve 59’a indirdi. Nakavt sonrasında kazanan kaldı ve sıradaki rakip ringe girdi. Bu sürümde canlı yayındaki hediye hasarı ayrıca doğrulanmalıdır.

@mezarci_pubg canlı testinde 145 saniyede 74 yorum, 25 hediye, 8 takip ve 1.732 beğeni alındı. Maç başladı, iki portre ve iki can barı göründü. Bekleyen sıra 71 kişiye ulaştı. Katıl yorumu, aktif köşeye uygun hediye veya beğeni yumruğu gözlenmedi. Canlı isabet doğrulaması açık. Ayrıntılar qa/live-ring-attempt.json dosyasında.

23 Kasım akşamı merkezdeki geri sayım kurulu özel kopyadan kaydedildi (`qa/centered-countdown-preview.png`). P ile başlayan beş rakam, pencere sayım sırasında küçültüldüğünde de merkezden bir pikselden az saptı. Yerel maçta kaybeden mindere düştü, kazanan ayakta kaldı ve sıradaki boksör boşalan köşeye girdi. 116 otomatik test, 46 kamera hesabı ve 44 kamera kontrolü geçti. Kurulumdaki 19 çalışma dosyası kaynakla eşleşti.

@mezarci_pubg ile 22.50’de yapılan karma testte 1.814 beğeni alındı ve yedi beğeni yumruğunda hasar doğrulandı. Geri sayım ve uzak mesafedeki adım düzeltmesiyle 23.02’de yapılan son testte iki portre ve iki can barı göründü. 43 hediye, 1.966 beğeni ve 73 sohbet olayı alındı. Aktif dövüşçüden kendi köşesine atanmış hediye gelmediği için son sürümün canlı hediye isabeti açık kaldı. Son denemenin kaydı `qa/live-ring-attempt.json` dosyasında.

Son kontrollü maçta yorum, Gül ve beğeni eşiği garddaki rakibe birer kez vurdu. Can sırasıyla 100 → 93 → 70 → 59 oldu. İki boksör de izleyici eylemleri arasındaki beklemede 2,4 dünya biriminden fazla yer değiştirdi. Nakavt denetimi maçın başındaki dik duruşu referans alır. İkinci maçta yeni rakibin ilk isabeti de doğrulandı.

24 Kasım yerel önizlemesinde ringde iki boksör varken başlangıç kamerası serbest kaldı. Fareyi tuşa basmadan iki yöne hareket ettirince kurulu oyunun bakış açısı iki yönde de değişti. Ayrı bir test profilinde oyun ve kumanda beş kez açılıp kapatılarak kullanıcı adının kaydedilmesi, değiştirilmesi ve silinmesi denendi. 117 otomatik test, 46 kamera hesabı ve 46 kamera kontrolü geçti. Bu denemelerde canlı yayın kullanılmadı.

## 24 Kasım 2026 – Beğeniler, isabet ve maç sonucu

B panelinde beğeniyle giriş eşiği izleyici başına, yumruk eşiği ve hasarı aktif boksör başına uygulanır. Giriş paketinden maça beğeni aktarılmaz. Eski çoklu yumruk ayarı düzenlenip kaydedildiğinde panel tek yumruk kuralına geçer. Eski kaydın etkisi kaydetmeden önce panelde açıklanır.

Hasar sayısı, savunan oyuncu ve efekt aynı isabet olayından gelir. Özel kurulumdaki kısa darbe kaydı seyirci sesinden ayrı çalar. Maç sonunda dört saniyelik portre, galibiyet sayısı ve sol üstte ilk beş görünür. Bu bilgisayardaki oyunlar toplam galibiyete sayılır. Kayıt kullanıcı verisi altındaki `win-standings.json` dosyasında sürümlü ve atomiktir. Testler ayrı profil kullanır.

Windows, şeffaf gösterge penceresini oyunun sahip olduğu bir pencere olarak sıralar. Maç arka planda ilerler, oyun küçültülünce göstergeleri de gizlenir. Yerel maç testinde başka bir pencere odaktayken görünen iki profil ve nakavta kadar süren maç kontrol edildi. Kazanan aynı köşede sağ kaldı, kaybeden yere düştü ve sıradaki katılımcı boş köşeye geçti.

@mrofluu karma canlı testinde 2 portre, 2 can barı, 5 bekleyen ve hasar veren 7 beğeni yumruğu gözlendi. Bu maçta boksörün kendi köşe hediyesiyle isabet kaydı oluşmadı.

Ayrı çalıştırılabilir dosyadan başlatılan renk denemesi “Unexpected game module” uyarısı verdi. Masaüstü kısayolu özel kurulumdaki doğrulanan tek dosyayı başlatır. İzole kariyer verisindeki kıyafet alanlarını değiştirmek doğrudan sparring ringinin yerleşik kıyafetlerini değiştirmedi. Asıl kariyer kaydı ve Steam oyunu bu deneye dahil edilmedi.

## Köşe renkleri ve seri hediyeleri

Özel masaüstü kurulumunda sol köşe mavi, sağ köşe kırmızı giyer. `src/native-spectator.cjs` yalnız başlattığı oyun için `assets/corner-colors` içindeki Vulkan çizim katmanını etkinleştirir. Windows kayıt defterine kurulum gerekmez. Katman özel `native-game/boxing.exe` yolunu ve sparring malzemesinin SHA-256 özetini doğrular. Ten, saç ve ring ipleri kendi renklerini korur. Güncellenen bir oyun farklı malzeme gönderirse kendi çizimine devam eder.

Renk katmanını yeniden derlemek için kurulu özel kopyanın `original-assets/queue-guard.rdc` kaydında 545 numaralı çizimin özgün fragment SPIR-V dosyasını RenderDoc ile dışa aktar. `tools/corner-colors/build.py --help` derleyici girdilerini listeler. Doğrulanan araçlar RenderDoc 1.47 içindeki SPIRV-Cross ve glslang, Khronos Vulkan-Headers v1.4.328 ve Zig 0.13.0'dır. `qa/check-corner-colors.py` başlangıç kamerasında iki şortun ve dört ayakkabının renklerini ölçer.

Seçili köşe hediyesinin her adedi o boksörün sırasına bir yumruk ekler. Aynı seri 5, 20 ve 100 olarak bildirilirse sırasıyla 5, 15 ve 80 yumruk eklenir. Tamamlanma bildirimi ve gecikmiş küçük sayılar yinelenen hasar oluşturmaz. Kendi seri numarası olmayan bağımsız hediyelerde sıfır, ortak bir seri numarası sayılmaz. Kuyruk nakavtta biter.

Normal maç kontrolü `node tools/spectator-smoke.cjs --round` ile kısa bir nakavt ve yeni rakibi doğrular. Seri hediye davranışı değiştiğinde `node tools/spectator-smoke.cjs --hundred-gifts` gerçek oyunda yüz ayrı isabet sayar. İki test de geçici maç ayarları kullanır.

24 Kasım'daki ilk @tenhaa.34 canlı doğrulamasında iki gerçek boksörün portreleri ve can barları göründü. Aktif köşenin bir hediyesi yumruğa dönüştü ve rakibin canı düştü. Kontrollü yerel maçta 100 cana karşı 1 hasarla 100 ayrı kol hareketi ve 100 ayrı hasar olayı sayıldı.

Kurulu masaüstü oyununun köşe ve hareketli maç görüntüleri `qa/corner-uniforms-preview.png` ve `qa/corner-uniforms-match.png` dosyalarındadır. Başlangıç karesindeki iki şort ve dört ayakkabının renk denetimi geçti. Normal kısayolla kullanılan kurulumun kontrollü maçında oyun odağı kaybedince dövüş sürdü. Kaybeden yere düştü, kazanan kaldı ve sıradan bir sonraki boksör geldi. Otomatik kontrollerde 124 test ve iki grupta 46'şar kamera kontrolü geçti.

Güncel renkli kurulumun 17.09–17.13 (İstanbul) canlı gözleminde @tenhaa.34 yayınından 7 hediye bildirimi alındı. İki gerçek profil ve iki can barı göründü, maç başladı ve sıra 21 kişiye ulaştı. Aktif boksörün seçili hediyesi tekrar gelmedi. Bu kurulumun canlı hediye isabeti ve canlı 100'lük seri doğrulaması açık. Son gözlem `qa/live-ring-attempt.json` içindedir.

## 0.0.11-dev masaüstü düzeltmesi

25 Kasım güncellemesinde ringe giriş güncel `katıl` yorumu veya katılım ayarına uygun yeni hediyeyle gerçekleşir. Takip ve beğeni eski ayarlarda açık olsa bile katılımcı oluşturmaz. Beğeni, ringdeki boksörün P sonrasındaki yumruk eşiğinde işlemeye devam eder. Geçmiş, yeniden oynatılan ve test katılım olayları boş ringi doldurmaz. Paylaşılan yayın sahibinin ilk olay sayfaları başlangıç kaydı olarak tüketilir. Bağlantı hatalarında sınırlı gecikmeyle yeniden deneme yapılır.

Masaüstü kısayolu `D:/TikMnG/Hediye-Box-Private/desktop-app/HediyeBox.exe` dosyasını açar. Önceki kurulu kopyada takip ve beğeniyle katılım hâlâ açıktı. Kaynak ve kurulu `resources/app` dosyaları güncellendi ve özetleri karşılaştırıldı. Kurulu native oyunda 30 saniye boyunca eski ayarlar, 3.000 beğeni, 30 takip, sıradan yorumlar ve geçmiş katıl/hediye olaylarıyla ring boş kaldı. Sonraki güncel katıl mesajı ve güncel hediye birer köşe doldurdu ve maç P komutunu bekledi.

B menüsündeki Yayın Sahnesi, gerçek ring görüntüsüyle HUD katmanını tek pencerede birleştirir. Yayın programında Pencere yakalama kaynağından `Hediye Box · Yayın Sahnesi` seçilir. Chromium'un gömülü HUD belgesine verdiği opak koyu zemin kaldırıldı. Doğrulama hem videodaki hem birleşik görüntüdeki renkli ring piksellerini ve HUD görünürlüğünü denetler. Kurulu uygulamanın 30 saniyelik açılışı da boş kaldı. Kare `qa/empty-ring-installed.png` içindedir. Kullanıcının son isteğiyle tek katılımcı beklerken görünen yazı üç animasyonlu noktayla değiştirildi. Erişilebilir etiket görünür metin üretmez. Noktalar ikinci kişi geldiğinde ve geri sayımda gizlenir.

Üç widget yerel, yalnız okunan ve birbirinden ayrı erişim anahtarlı adreslerle aynı bilgisayardaki yayın programında kullanılabilir. Ring kartında mavi/kırmızı hediyeler, katılımcı kimliği ve ölçülen can bulunur. Kazananlar × galibiyet sayısıyla gösterilir. Sıralamayı temizleme yalnız ana uygulamanın B panelinden yapılır. Bu özel bağımsız kurulumda genel HTTPS widget bağlantısı için lisanslı launcher oturumu aktarımı henüz bağlı değildir. Yerel adresler bu nedenle tikmng.com adresi olarak sunulmaz.

Kaynak kontrolünde geçmiş katıl/hediye regresyonu dahil 135 otomatik test, kurulu arayüzde 15 senaryo ve 118 saf kamera kontrolü geçti. Native maç kontrolünde iki köşe gardı, ayak teması, P öncesi sıfır yumruk, gerçek hasar, nakavt ve sonraki maçın temiz yumruk kuyruğu doğrulandı. Altı ardışık maç aynı oyun sürecinde nakavtla tamamlandı ve kazanan her seferinde tek kaldı. Yayın penceresindeki gerçek görüntü ayrıca dosya karesi üzerinden incelendi. Tam sürüm kapısı yeni sürüme ait canlı isabet kanıtı oluşana kadar başarısız döner.

Son @ruzgxrs0 kontrolünde bağlantı açıldı, 11 sohbet olayı alındı ve katılımcı oluşmadı. Gözlem sırasında yayın sona erdi. Ardından kullanıcının verdiği @mlbb_gossipgirl yayınında 13 sohbet, 10 takip, 774 beğeni ve üç hediye paketi alındı. Takip ve beğeniler katılımcı oluşturmadı. İki gerçek hediye göndericisi köşelere yerleşti. İki portre ve iki can barı göründü. Maçta dokuz beğeni yumruğu kabul edildi ve yedi hasarlı isabet doğrulandı. Doğal katıl yorumu ve maç sırasında seçili köşe hediyesi gelmedi. Bu gözlem `qa/live-ring-likes-20261125.json` dosyasında saklıdır. Eski canlı kanıt dosyası yeni sürümün kanıtı olarak kullanılmaz.

Üç noktalı bekleme göstergesi kurulu kopyaya alındıktan sonraki @mlbb_gossipgirl gözleminde 23 sohbet, 15 hediye paketi, üç takip ve 1.427 beğeni geldi. Üç hediye göndericisi katıldı, takip ve beğeniyle katılım sıfırdı. İki portre ve iki can barı görüldü. Beğeniyle 43 yumruk kabul edildi ve 34 hasarlı isabet kaydedildi. QA profilinde köşe hediyeleri katılımcıların daha önce gönderdiği katalog hediyelerinden seçildi. Maç sırasında bu iki aktif katılımcıdan seçili hediye tekrar gelmediği için canlı hediye isabeti açık kaldı. Gözlemde doğal katıl komutu da gelmedi. Güncel rapor `qa/live-ring-attempt.json` içindedir. Test oturumları ve test katılımcıları kapatıldı.

## 0.0.12-dev

Boş ringde uzun beklemede özgün demonun iki modeli yeniden görünür konuma gelebiliyordu. Katılımcı listesi boşken fizik güncellemesinden erken çıkıldığı için sahne dışına alınan poz yeniden uygulanmıyordu; ham konum ölçümü de eski kalıyordu. Bekleme koruması artık sıfır katılımcıda da park edilmiş pozu ve kinematiği düzenli uygular, güncel konumu okumayı sürdürür. Düzeltme kurulu özel kopyaya da alındı. `qa/empty-ring.cjs --long` 90 saniyelik denetim içerir. Kullanıcı oyun içi testi kendisi yapmak istediği için bu son deneme durduruldu; uzun bekleme düzeltmesi oyun içinde doğrulanmış olarak raporlanmaz. Önceki 30 saniyelik başarı bu yeni bulgunun çözüldüğünü kanıtlamaz.

P tuşunun yeni davranışı kullanıcının son tarifini izler. İlk P beş saniyelik geri sayımı ve maçı başlatır. Maç başladıktan sonraki P mevcut iki boksörü çıkarıp bekleyenleri hediye katkısı ve katılım sırasına göre köşelere alır. Kimse beklemiyorsa ring boş kalır. Bir kişi varsa tek köşe dolar. Hazırlanan yeni eşleşme sonraki P komutunu bekler. Nakavttan sonra köşeye geçmiş ama henüz dövüşmemiş aday sıradaki hakkını korur. Açık bir katıl komutuyla geri dönen eski katılımcının yeni katılımı da korunur. Eski yumruk emirleri native yeniden yerleştirmede temizlenir. Önceki turun gecikmiş sonuç örnekleri yeni maç başlamadan galibiyet üretmez.

Kullanıcının isteğiyle mevcut TikMnG 7.0.36 widget ekranı açıldı. Çalışan bağlantının `https://mng-license-server1.onrender.com/overlays/…/widget/view/pk-gloves?studio=1` yapısında olduğu doğrulandı. Hediye Box aynı sunucunun mevcut HTTPS overlay oturumunu ve köprüsünü kullanır. Üç belge `hediye-box-fighters`, `hediye-box-queue` ve `hediye-box-winners` adlarını taşır. Sunucuda yeni dağıtım gerekmedi.

`src/launcher-widget-access.cjs`, mevcut launcher lisans yedeğinin kod ve cihaz kimliği alanlarını ana süreçte okur. Değerler yalnız doğrulanan resmi overlay oturumu adresine iletilir. Lisans yedeği değiştirilmez. Aktivasyon belirteci renderer'a ve widget verilerine aktarılmaz. Hediye Box kendi kurulum kimliğini kendi `widget-connection.json` dosyasında tutar. Lisans dosyası ve hesap kimlikleri teknik notlara veya test raporuna kopyalanmaz.

Yerel URL geri dönüşü kaldırıldı. HTTPS oturumu hazır değilse B menüsü bağlantıyı hazır gibi göstermez. Üç gerçek HTTPS belge ve veri adresi 200 yanıtıyla kontrol edildi. Üç belge ayrı gizli tarayıcı penceresinde açılarak veri ve hediye simgelerinin yüklenmesi de doğrulandı. Bu kontrol TikTok LIVE Studio'ya kaynak ekleme adımını kapsamaz.

141 otomatik test ve 118 saf kamera kontrolü geçti. `qa/p-next-round.cjs` gerçek native oyunu ve asıl masaüstü klavye işleyicisini kullanarak P ile başlatma, ikinci P ile öncelikli adaylara geçme, boş sırada ringin boşalması ve eski yumrukların sonraki eşleşmeye geçmemesini denetler. Test profili gerçek katılımcı veya kayıtlı galibiyet verisine yazılmaz.

## Rakibe dönük gard

Önceki adım kontrolü mesafeyi ayarlıyordu. Dövüşçünün baktığı yön ile rakibinin yönü arasındaki yatay açı izlenmiyordu. Ayakta yakalanan başlangıç pozunda ayakkabıların topuktan buruna yönü, her boksörün başının ileri eksenini belirler. Köşeye yerleşirken oyun dövüşçüyü rakibe çevirir. Maç sırasında kök gövdeyi dikey eksende döndürerek yan adımda ve gard değiştirirken rakibi takip eder. Can sıfıra indiğinde yön takibi bırakılır.

Hedefli kontrol `node qa/facing.cjs` ile iki boksörü yerleştirir ve kontrollü maçta her köşeden birer yumruk bekler. Düzeltmeden önce açının yüzde 95'lik değeri mavi için 49°, kırmızı için 56° idi. Son denemede 166 örnekte bunlar 6° ve 7° ölçüldü. Her iki köşe de birer kez isabet kaydetti. Kurulu masaüstü sürümünde ayrıca nakavt, kazananın ayakta kalması ve yeni rakibin gelişi denetlendi. Maç karesi `qa/facing-match.png` içindedir.

## 0.0.13-dev — Oyun görüntüsüne dahil göstergeler

Önceki şeffaf masaüstü göstergesi Windows'ta oyunun üzerinde görünse de OBS/TikTok Game Capture'ın `boxing.exe` görüntüsüne dahil değildi. Ayrı yayın penceresi açma yolu ana uygulamadan kaldırıldı. Görünür Electron penceresi artık yalnız B/ESC ayar panelidir. `src/native-hud.cjs` görünmeyen offscreen renderer'da aynı HUD'u şeffaf BGRA olarak üretir. `VK_LAYER_TikMnG_native_hud` bunu özgün oyunun swapchain görüntüsüne bir kez birleştirir. Portre, can barı, sıra, galibiyet ve sonuç gösterimi aynı oyun karesinde yer alır. Ayar penceresinin adı `Hediye Box · Ayarlar` oldu.

Katman yalnız oyunu açan alt sürecin ortamına eklenir; kayıt defteri ve sistem genelindeki Vulkan ayarları değiştirilmez. Sabitlenmiş Vulkan-Headers v1.4.328, mevcut Zig 0.14.1 ve RenderDoc 1.47 glslang aracıyla derlenir. Kaynak `tools/native-hud`, çalışır varlıklar `assets/native-hud` altındadır. Kurulum betiği `native-hud` sayfasını da pakete alır.

Özgün özel `queue-guard.rdc` kaydı yerelde okunarak bir karede birden fazla PRESENT geçişi bulunduğu doğrulandı. Her geçişte yeniden çizmek yerine son ilgili komut grubuna HUD komutu eklenir; oyunun render-finished sinyalinden önce tamamlanır. Her swapchain görüntüsü ayrı komut tamponu, doku ve fence kullanır. Normal çizim yolunda queue/device idle beklemesi yoktur; meşgul slotta o kare atlanır. Aynı dokuyu yeni karede yüklemeden kullanma denemesi 24 karelik kontrolde kaybolan can barları ürettiği için kaldırıldı; piksel verisi her HUD çiziminde yeniden yüklenir. Bu kararı değiştiren optimizasyon ardışık kare kontrolünden geçmelidir.

Offscreen üretici 30 kare/sn ile sınırlıdır, meşgulken kare biriktirmez; Windows ekran ölçeği dahil en çok 1920×1080 yükler. Geçici dosyalar `%TEMP%/tikmng-hud-*/frame.bgra` ve tanı günlüğüdür. Sıra numarası tamamlanmamış kareyi reddeder; son tam kare korunur. Çizimin 12 saniyede doğrulanamaması B menüsünde açık hata bildirir.

B menüsünde kazananlar ve sıra için açık `Küçült`, `Büyüt`, göster/gizle düğmeleri vardır. Boyutlar %60–140 arasında kaydedilir. `Kazananları sıfırla` onayından sonra kalıcı galibiyet kaydı sıfırlanır. İki boksör widget'ı yataydır, yuvarlak portre, köşe rengi, can yüzdesi ve seçili hediye gösterir. Sıra katkısı FPS, galibiyet × sayı olarak yazılır. Üç widget mevcut resmi HTTPS overlay altyapısını kullanır.

Son doğrulamalar: FoundationOnly kapısı ve 118 kamera/giriş kontrolü geçti. `qa/native-hud-offscreen.cjs` görünür ek pencere olmadığını ve şeffaf HUD piksellerini doğruladı. Gerçek oyun yerine gizli, bağımsız Vulkan fixture'ında iki katman birlikte yüklendi; 600 ilgisiz komut tamponundan sonra 24 ardışık kare ve fence'li/fence'siz gönderim denendi. GPU görüntüsünden geri okumada 3157 can barı pikseli ve 819496 korunmuş arka plan pikseli bulundu. `qa/widget-visual-check.cjs` üç widget'ın yatay yerleşimini, portrelerini, hediye ikonlarını, FPS ve × galibiyetlerini örnek verilerle doğruladı; görsel `qa/widgets-preview.png` içindedir.

Kullanıcı gerçek oyun testini kendisi yapmak istedi. Bu sürüm için özgün oyun açılışı, OBS/TikTok Game Capture görüntüsü, uzun maç dayanıklılığı ve canlı seçili hediye → hasar kontrolü bu kontrollerle doğrulanmış sayılmaz. Önceki HTTPS 200 ve veri/ikon kontrolleri LIVE Studio'nun kaynağı kabul etme adımını kapsamaz. Tam yayın kapısı açık; paket özel önizlemedir ve `publicReleaseReady` false kalır.

## 0.0.14-dev — Takım widget'ı, pano ve maç öncesi ısınma

Ringdekiler widget'ında mavi ve kırmızı çizgi film eldivenleri, büyük yuvarlak portreler, takım ve kullanıcı adları bulunur. Seçili köşe hediyesinin simgesi formanın göbek kısmındadır; hediye adı da açık yazılır. Resim sabit hediye veya profil içermez. Her köşe `audience.active.left/right` ve o köşenin `punchGiftIdLeft/Right` ayarından okunur. Katılımcı veya hediye değiştiğinde eşleşmenin doğruluğu ayrı test edilir. Kaynak görsel built-in image generation ile oluşturuldu; prompt `assets/widgets/ARTWORK.md` içinde. Alfa kanallı atlas mevcut sharp aracıyla 1024×512 WebP'ye paketlendi. 72.042 baytlık atlas tek HTML belgesine gömülür; yeni sunucu rotası veya Render dağıtımı gerekmez.

Kopyala düğmesinin önceki `navigator.clipboard` çağrısı gerçek ayar penceresinde reddedilebiliyordu. Yeni dar IPC yalnız widget türünü kabul eder; ana süreç güncel resmi HTTPS URL'sini doğrulayıp Electron panosuna yazar. Genel pano yazma veya keyfi metin API'si açılmaz. Gerçek panelde tarayıcı pano erişimi kapalıyken düğmenin uygulama kopyalama yoluna ulaştığı regresyonla denetlendi. Yayın bağlandığında ve yeniden bağlandığında widget oturumu hazırlanır. Yenile, sağlıklı oturumu korur; kopmuş köprüye hemen yeniden bağlanır. Sunucu/izin hatası hazır bağlantı gibi gösterilmez.

Maç öncesi gard kökünün mevcut taban temasları korunur. Özgün boksörün kol/el eklemlerine yakalanmış gard etrafında sınırlı, periyodik hareket eklenir. Bacak eklemleri bu hareketten etkilenmez; boş köşeler sahne dışında kalır. P komutundan sonra özgün maç fiziği ve mevcut izleyici yumruk kuralları devam eder. Win64 `mjModel` alanları resmi MuJoCo 3.3.7 başlığından yerel C aracıyla doğrulandı: njnt 36, jnt_type 1656, jnt_qposadr 1664, jnt_bodyid 1680. Çalışma anında `mj_version()==337`, eklem türü, gövde ve qpos aralığı kontrol edilir. Başlıklar çalışma alanındaki `tools/hediye-box-mujoco-3.3.7` altındadır; oyuna yeni fizik motoru eklenmez.

Özgün oyunun süreye bağlı round gongları ile sunum gongu iki ayrı kaynaktı. `tools/prepare-native-bells.py` yalnız özel kopyadaki iki otomatik round WAV'ının örneklerini sessizleştirir; format ve süre korunur. Orijinaller `original-assets/native-auto-round_start.wav` ve `native-auto-round_end.wav` olarak korunur. Sunumun `assets/audio/round_start.wav` ve `round_end.wav` kayıtları değişmez; bunlar yalnız başlangıç/sonuç olaylarıyla çalar. Yumruk, seyirci ve diğer oyun sesleri korunur. Paketleme bu hazırlığı tekrar güvenle uygular.

FoundationOnly kapısı, kamera/giriş kontrolleri, köşe/hediye değişim testi, kapalı B panelinde bağlantı hazırlama, yeniden bağlanma/yenileme, pano doğrulaması, gard hareketinin sınırlılığı ve yalnız iki native gongu susturma testi geçti. Üç gerçek HTTPS belge ve durum adresi 200 döndürdü; gizli tarayıcıda hediye ikonları da yüklendi. Gerçek oyunda yeni kol ısınması, kullanıcının duyduğu gong davranışı ve OBS/TikTok yakalama sonucu kullanıcı testini bekliyor; oyunu bu turda otomatik açmadık. Canlı seçili hediye → hasar kanıtı ve genel yayın kapısı hâlâ açık.


## 0.0.16-dev — Ring menüsü ve tek tek hediye işleme

B menüsündeki A/yorum yumruğu ve yorum hasarı alanı kaldırıldı. Kaynaklar
beğeni + köşe hediyesi, yalnız köşe hediyesi veya yalnız beğenidir. Eski
chat/both seçimleri gift olarak yüklenir; eski istemci A/B yorumu yollasa da
hasar üretmez. Katıl yorumuyla katılım ayrı kalır: katıl, katil, Katıl, KATIL
ve Türkçe büyük/küçük harf karşılıkları kabul edilir.

Takip/beğeniyle katılım ve katılım beğeni eşiği B menüsünde görünür.
Kaydetmenin bunları kapatması düzeltildi. Beğeni yumruğu eşiği ile her isabetin
hasarı büyük, ayrı alanlardır. Eşik tamamlanınca kalan beğeniler korunarak
hemen yumruk üretilir. FPS sırası hediye toplamına göre devam eder.

Kazananlar ve sıra başlığında standart eksi/geri aç düğmeleri bulunur.
Fareyle ayarlamak için B açılır. standingsCollapsed ve queueCollapsed mevcut
atomik game-options.json şemasında kaydedilir ve oyun içi HUD'a da yansır.
Yeni kurulumun oyun sesi 50, sunum efektleri 60 ve kalite high değerindedir.
Bu kullanıcı isteğiyle özel kurulumdaki ses/kalite ayarları da uygulanır.

Yükleme resmi assets/loading-ring-v2.png; üretim kaydı assets/LOADING-ARTWORK.md.
Yerleşik görsel üretim aracı kullanıldı. Bar zaman sayacıyla sahte ilerlemez:
uygulama, worker açılışı, native pencere ve hazır ring olaylarını 5/30/65/100
olarak gösterir; hata ve zaman aşımı mevcut hata ekranına gider.

Uzun 100 hediyelik yerel maçta ilk denemede 38 isabet, 62 bekleyen yumruk
varken yaklaşma sıkışması görüldü. ringStep'in takılan yaklaşmayı açı değiştirerek
tekrar denemesi, yumruk menzilinin hemen dışındaki aralığa da uygulandı.
Native AI'nin diğer kontrol kodları korunur. Sonuç doğrulama kaydına yazılır;
ilk başarısız test tamamlanmış test olarak sayılmaz.

FoundationOnly: 167 test, 69 kamera matematiği ve 49 giriş/görünürlük kontrolü
geçti. Gerçek @tenhaa.34 yayınında 60 saniyede 12 sohbet, 4 hediye ve 34 beğeni
paketi alındı; 50 pakette portre adresi, 2 hediyeyle katılım görüldü.
Bu bağlantı gözlemi native hediye isabeti veya OBS yakalamasını kanıtlamaz.
Genel yayın ayrı kullanıcı testi sonrasındadır; publicReleaseReady false kalır.

İkinci rakiple uzun seri kontrolünde yaşayan boksörlerin yere düşmesi de sınandı.
Stock hakem devre dışıyken sayım üzerinden tetiklenen ayağa kalkış yürümüyor.
Canı kalan ve 1,6 saniye alçakta kalan boksör, yakalanmış kendi gardına 0,8 saniyede
aynı X/Y konumunda döner. Yalnız o boksörün pozu/hızı güncellenir; canı, yumruk
kuyruğu, karşı tarafın pozu ve fizik durumu sıfırlanmaz. Nakavtta bu kurtarma
kapalıdır. Sıkışık yakın yaklaşmada açı değiştirme ve kalkış yalıtımı regresyonları
eklendi. --round gerçek oyun kontrolü iki nakavtı ve ikinci rakibi geçti.

26 Kasım son uzun seri kontrolü (`qa/hundred-gifts-0016-final.log`) çıkış kodu 0:
100 hediyenin her biri 1 hasarlı ayrı yumruk olarak işlendi ve 100 isabetten sonra
nakavt oluştu. Kazanan yalnız kaldı, yeni rakip geldi; ikinci maçın 20 hediyelik
kuyruğu 7 isabette nakavt olduğunda durdu. Sonraki turun iki yumruk kuyruğu boştu.
Açılışta boş ring, tekli köşeler, bekleme pozu, zoom ve serbest kamera geçti.
Bu ölçüm yerel gerçek oyun/sentetik hediye testidir; gerçek TikTok hediyesi değildir.

Özel kurulum 0.0.16-dev olarak güncellendi. Kaynakla kurulu kopyanın 983 dosyası
SHA-256 ile eşleşti (`qa/install-0.0.16.json`). Kullanıcının kalıcı ses ayarları
oyun 50, efekt 60; kalite high olarak doğrulandı. Genel yayın yapılmadı.

Son kurulu uygulama canlı gözlemi: @tenhaa.34 çevrimdışıydı. @duffyduck212
yayınına bağlanıldı; 145 saniyede 25 sohbet, 7 hediye, 5 takip ve 103 beğeni
paketi alındı. İki doğal hediye katılımcısı ringe geldi; iki portre ve iki can
barı HUD üreticisinde göründü. Seçili köşe hediyesi bir native yumruk ve isabet
üretti, can düştü. Yerel sahte katılımcı kullanılmadı. Bu pencerede doğal katıl
yorumu ve ringdeki katılımcıdan beğeni yumruğu gözlenmedi; mixed test bu açık
kontroller nedeniyle 2 koduyla bitti ve tam yayın kapısı geçirilmiş sayılmadı.
Kanıt: qa/live-ring-0016-duffy.log, qa/validation-0.0.16.json. Kullanıcı testi
devralmak istedi; ek canlı deneme başlatılmadı. OBS/TikTok gerçek yakalama ve
uzun kullanım sonucu kullanıcı kontrolünde; özel önizleme korunur.

## 0.0.17-dev — Kullanıcının 26 Kasım video regresyonu

170730 kaydı boyunca yaşayan mavi boksör eğik kalıyor. 171017 kaydında yaklaşık
13–18. saniyelerde geri sayım sonrası boksör savruluyor. 14:11:33 UTC kullanıcı
startup.log kaydı QACC DOF 3 için NaN/Inf/huge value ve fizik kararsızlığı bildiriyor.
Önceki hasar/KO geçiş kontrolleri bu görsel/fizik başarısızlığını ölçmüyordu.

Maç sırasında kafa yönüne göre serbest kök quaternion'unu aniden değiştirme ve
canlı gövdenin eklemlerini gard pozuna interpolasyonla geri yazma kaldırıldı.
Kalkış gözlemi artık yalnız özgün GetupControl (3) ister. Özgün pivot (26/27),
yürüyüş ve darbe kontrolleri kullanılır; AI walk/weave ve komut yürüyüşü aynı
ayakları eşzamanlı farklı yöne sürmez. Fizik motoru ve eklem modeli değiştirilmedi.

Yerleşimde kazananın maç sonu X/Y'sini koruma kaldırıldı. Her katılımcı ve
korunan kazanan, kendi sabit karşı köşesine (±4.25, ±4.25) aynı taban yüksekliğinde
döner. Maç öncesi gard hareketi korunur; maçta qpos düzeltmesi yapılmaz.

Kazananlar HUD'ı 224 px, dış widget en fazla 256 px tek sütundur. 18 px isimler
kesilmeden satıra sarılır; yanında × galibiyet sayısı bulunur. Küçült/geri aç,
ölçek ve sıfırlama davranışları korunur. Uzun isim/dar ekran UI testi eklendi.

Videolar FFmpeg ile yerelde zaman sırasındaki karelere ayrılarak incelendi.
Karşılaştırma ve yeni tam-uygulama kayıtları qa/video-0017 altında tutulur.
Eski canlı kanıtı yeni fizik davranışının kanıtı sayılmaz. Genel yayın yapılmaz;
bu sürüm de kullanıcının yerel testine teslim edilen özel önizlemedir.

Son yön kontrolü önceki 22 derece p95 kabulünü geçmedi: özgün pivot kullanımı
ve yumruk/recoil sırasında pivotu durdurma ile medyan 15/17 derece, p95 56/47,
maksimum 69/118 derece görüldü (`qa/video-0017/facing-recoil.log`). İki taraf
da isabet üretti. Bu bulgu açık kalır; yön takibi tamamen düzeldi veya tam
sürüm kapısı geçti denmez. Ters pivot denemesi daha kötüydü ve teslim koduna
alınmadı. Otomatik fizik-pozu zorlaması geri getirilmedi.

P sonrası ilk fizik adımında görünür gard korunarak hız, kuvvet ve solver
durumu temizlenir ve mj_forward ile temas hesabı yeniden hazırlanır. Böylece
bekleme sırasında elle çizilen pozun eski fizik ara hesaplarıyla entegrasyona
girmesi önlenir. Yeni native-steering testleri girdilerde tek yürüyüş sahibi,
getup, recoil sırasında pivot olmaması ve aktif maçta pose yazımının reddini
kontrol eder. Dört turluk önceki tam uygulama kontrolü yeni bu değişikliklerin
kanıtı değildir; son kontrol ayrı full-app-final.log içinde tutulur.

Son yerleşim kontrolü iki hızlı katılım arasındaki bir yarışı ortaya çıkardı:
native çağrı sırasında ikinci stage isteği gelince görünürlük yeni listeyi alıyor,
gövde eski listede ring dışında kalıyor ve bekleyen yerleşim isteği kayboluyordu.
Yerleşim artık aynı değişmez katılımcı listesini kullanır; stageVersion değiştiyse
sonraki fizik adımında yeni liste uygulanır. staging-race.test.cjs native çağrı
ortasında ikinci katılımı vererek bu durumu tekrar üretir ve doğrular.

Son kaynakla full-app-atomic.log iki tam maçı, sabit karşı köşeleri, KO sonrası
kazananın kendi köşesine dönüşünü ve yeni rakibin gelişini geçti. 265 dövüş
örneğinde en yüksek kafa 1.466 m; kontrol edilen aralıkta havaya savrulma,
ring dışına çıkma veya kararsız fizik uyarısı görülmedi. Bu sınırlı yerel testtir.
release-gate-atomic.log: 171/171 test, Python sözdizimi, 69 kamera ve 49 giriş
kontrolü geçti. FoundationOnly kullanıldı; tam canlı yayın kapısı geçirilmedi.

Yön bulgusu açık: son iki maçta kafa yönü p95 57/44, maksimum 92/151 derece.
Bu nedenle tüm yön takibi ve uzun kullanım hataları çözülmüş sayılmaz.
0.0.17-dev özel test kopyası install-atomic.log ile kuruldu; genel yayın yok.

## 0.0.18-dev özel Ring testi

Özel kopyada yerel `ring_width` ayarı 72'den 90'a çıktı. Oyun ipleri, logolu minderi ve ahşap döşemeyi kendi malzemeleriyle yeniden oluşturuyor. Sabit kameranın kaydedilmiş görüntülerinde ipler arası kenar 14,4'ten 18'e, minder kenarı 16,4'ten 20'ye, ahşap zemin kenarı 37,4'ten 41'e çıktı. Merkez X/Z (−0,50, 4,00). Görüntüler ve kamera kayıtları `qa/posture-0018/arena-{before,after}.{png,json}`, ölçüm `qa/verify-arena-geometry.py`. Üç boyutlu sıra çizimi, köşeler, boş ring kadrajı ve dövüş hedefi aynı ölçüleri kullanıyor.

Ring canı sıfıra ulaşana kadar oyunun yaralanma kanalları gardı kilitlemiyor. Denge denetimi gövde ve başı rakibe çeviriyor ve iki boksörün orta noktasını logoya yaklaştırıyor. Kollar, bacaklar ve temaslar oyunun kendi fizik sisteminde. Nakavt olan tarafa denge düzeltmesi uygulanmıyor.

Yerel testte iki köşe sırasıyla kazandı. Masaüstü akışı boş açılış, iki katılımcı, P ile başlangıç, nakavt, kazananın köşeye dönmesi ve yeni rakibi geçti (`qa/posture-0018/installed-app.log`). Yerel hediye/yumruk girdileri kullanıldı. Bu sürümde gerçek TikTok hediyesi doğrulanmadı. Maçta fizik saati gerçek zamanın yaklaşık 0,53 katında ilerledi. Görsel ağır çekim şikâyeti bu ölçümle kapanmış sayılmaz.

Kurulu özel kopyada iki maçta toplam 32 yerel isabet, merkezden en fazla 0,104 birim sapma ve iki tarafın 9 canla karşılık vermesi doğrulandı. Kaynaktaki son renkli köşe yerleşimi henüz kurulu kopyaya aktarılmadı. Yerleri değiştirdikten sonra iki tur tamamlandı ama ikinci turda bir yumruk serisinin yüzde 95 yön hatası 23,1 dereceyle 22 derecelik sınırı geçti. Ardından yapılan yön ayarı için gerçek oyun kontrolü, açık kullanıcı oyunu ikinci örneği engellediği için bekliyor.

## 0.0.19-dev yerel ayak hareketi

26 Kasım 21.40 kaydında iki boksör temas mesafesinde sürekli ileri veya geri adım alıyordu. Geniş ringde köşeden geliş ve dövüş sırasında yaklaşma için oyunun kendi adım ve dönüş girdileri kullanılıyor. Temas mesafesine gelince ileri ve geri adım arasındaki geçişe daha geniş bir boşluk bırakıldı. Yumruk sırası doluyken yan adım ancak yaklaşma takılırsa veriliyor. Boşta orijinal kısa yan adımlar devam ediyor. Kollar ve bacaklar oyunun kendi eklemleriyle çalışıyor. Uzun yön sapmalarını ve ringden savrulmayı önlemek için gövde ve merkez desteği sürüyor.

`qa/posture-0018/final-gait.log` iki yerel maçta 32 kontrollü isabeti, iki köşenin düşük canda karşılık vermesini, nakavtı ve rakip değişimini geçti. `gate-native-gait.log` 173 testi, Python sözdizimini ve 69 + 49 kamera/girdi kontrolünü geçti. `rasimbisakin-listen.log` canlı bağlantıda 6 hediye bildirimi ve 21 beğeni olayı kaydetti. Tek katılımcı yerleştiği için bu kayıt gerçek hediyeyle yumruk doğrulaması sayılmaz. Oyun fiziğinin ölçülen hızı yaklaşık 0,53 olarak kaldı.

Kurulu 0.0.19-dev kopyada iki maç, renkli karşı köşeler, P ile başlangıç, nakavt, kazananın kendi köşesine dönüşü ve sıradan gelen rakip `qa/posture-0018/installed-gait.log` ile doğrulandı.

## 0.0.20-dev özgün maç hareketi

Kullanıcı maç sırasında oyunun kendi yaklaşma, yürüme, dönme ve gard hareketlerini istedi. Etkin maçtan ek adım ve pivot komutları, konum/hız desteği ve zorunlu toparlanma kaldırıldı. Oyunun özgün stil ve sersemleme ayarları özel kopyadaki dört dosyada ve yüklenen ZIP içinde bayt bayt geri alındı. CPU'nun yumruk dışındaki komutları sırası ve tekrarlarıyla korunur. İzleyici yumruğu gelince mevcut vuruş komutu eklenir. Boş ring, köşelerde hazırlık, can sayacı ve nakavt sonrası rakip değişimi mevcut maç akışını izler.

`qa/posture-0018/stock-movement-app.log` ve `full-app.json` iki maç ve 519 örnek kaydetti. P sonrası oyunun kendi AI'sı iki boksörü vuruş mesafesine yaklaşık 10 ve 18 saniyede ulaştırdı. İzleyici komutu öncesi hasar yoktu. Komutla iki taraf da ayrı ayrı isabet üretti ve her maçta nakavt, kazananın köşesi ve yeni rakip doğrulandı. Önceki sabit baş açısı ve küçük merkez sapması şartları özgün AI hareketi boyunca geçmedi. Bunlar artık uygulanan yapay hareket kısıtları değildir. 168 temel test ile 69 + 49 kamera/girdi kontrolü geçti. Kurulu özel kopyanın oyun bağdaştırıcısı özeti doğrulandı.

@stycharon yayınına doğrudan dinleyici testi bağlandı ve 2 hediye, 17 sohbet, 27 beğeni olayı aldı. Kurulu 0.0.20-dev uygulaması da aynı hesaba bağlandı. Kırk saniyelik oyun denemesinde köşeler dolmadı. Canlı hediyeden yerel yumruğa uçtan uca kanıt henüz yok. `qa/posture-0018/stock-stycharon-live.log`

## 0.0.21-dev darbe sonrası gard ve geri tepme

26 Kasım testinde canı olan boksör iplerin yanında eğik kalabiliyordu. Yerel tekrarda iyileşmeden önce 1.185 ms süren çökme ölçüldü. Hazırlık ve normal maç hareketi özgün adım, dönüş ve gard kontrollerini kullanıyor. Destek, canı olan boksör darbeden sonra derin eğildiğinde veya düşük hızda yaklaşık 360 ms eğik kaldığında etkinleşir. Yürüyüşün yatay yönünü, ayak komutunu ve kol hareketini yönetmez. Kök yüksekliği ve gövde eklemlerine yalnız toparlanma süresince sınırlı hız düzeltmesi uygular. Darbe ve toparlanma sırasında uç değerlerdeki geri tepme hızı sınırlandırılır. Sıfır can doğal nakavt geçişine girer. Yumruk mesafesi ayak yerleşimi sınırda kaldığında üst gövde yakınlığını da kullanır.

`qa/posture-0018/nonlethal-limits.log` iki ardışık yerel maçı geçti. Kırmızı ve mavi sırayla 1 cana düştü, karşılık verdi ve son isabette nakavt oldu. `gate-limits.log` 171 temel kontrol ve 69 + 49 kamera/girdi kontrolü. Bu doğrulamada gerçek TikTok hediyesi kullanılmadı.

## 0.0.22-dev ip kenarında yaklaşma

22.29 kaydında mavi boksör birkaç saniye boyunca ipler boyunca hareket edip rakibinden uzak kaldı. İp kenarında iki tarafa aynı kuralla içeri doğru destek uygulanır. Bir boksör ilerleyemezse oyun mevcut öne, geriye veya yana adımını hedefe uygun yönde oynatır. Merkezde, olağan vuruş mesafesinde kıskaç veya sürekli adım uygulanmaz. Uzun süren çökmelerde canı olan boksörün gardı bulunduğu yerde toparlanır. Sıfır canla ipte dik kalan boksörün dengesi bırakılır ve düşüşü mevcut fizik hesaplar.

`qa/posture-0018/rope-start-ko.log` iki yerel maçta boksörleri karşılıklı ip kenarlarından başlattı. İkisi de ipten uzaklaşıp yaklaşık 2,2 ve 2,7 saniyede vuruş mesafesine girdi. Mavi ve kırmızı sırayla 1 canla cevap verdi ve 0 canda düştü. İki deneme acil gard sıfırlamasına ihtiyaç duymadı. `gate-rope-ko.log` 173 temel ve 69 + 49 kamera/girdi kontrolünü geçti.

`benyigit61-listen.log` gerçek yayına bağlandı. 6 hediye bildirimi, 51 beğeni olayı ve 2 hediye katılımcısı kaydedildi. Bu dinleme kontrolü yerel maçta gerçek hediye isabeti kanıtı değildir.

Kurulu 0.0.22-dev ile boş açılış, P sonrası yaklaşma, izleyici komutu öncesi hasarsızlık, her köşenin ayrı yumruğu, nakavt ve yeni rakip iki maçta doğrulandı. `installed-rope-ko.log`. İkinci canlı kontrolde yayın çevrimdışı döndü. `live-022-benyigit.log`.

## 0.0.23-dev yakın mesafe ve darbe sırasında ayaklar

22.45 kaydında canı olan boksörün dizi ve ayakkabısı darbe sırasında kalçaya yükseliyordu. Önceki isabet ve nakavt kontrolleri bunu ölçmüyordu. İlk yerel tekrar ayakların kalça hizasını geçtiğini ve iki köşenin ip kenarında 154–158° yön hatasına ulaştığını gösterdi.

Yaklaşırken mevcut adım komutları kullanılıyor. Vuruş mesafesinde yerel gard ve izleyicinin tetiklediği yumruk birbiriyle çakışan adım komutlarından ayrılıyor. Yumruk öncesi iki boksörün yüzü rakibine çevrilir. Darbe sırasında bacak ve gövde eklemi hızı, normal gard aralığını aşacaksa sınırlandırılır. Bekleyen bir yumruk için menzil dışındayken yaklaşma desteği artırılır ve vuruş sırasında kesilir. Düşüş desteği canı olan ve kalıcı biçimde eğik kalan boksöre uygulanır.

`qa/posture-0018/strike-approach-final.log` iki ip kenarı maçında 118 darbe ve hazırlık örneği topladı. İki boksör de 1 canla karşılık verdi. Ayakkabı ölçümleri kalça altında kaldı ve nakavttan önce yerde kalma veya gardı sıfırlama görülmedi. İp kenarı denemelerinde ölçülen maç içi yön hatası yüzde 95 diliminde köşe ve tura göre yaklaşık 19–51° oldu. `gate-strike-approach.log` 176 temel kontrol ve 69 + 49 kamera/girdi kontrolünü geçti. Bu tur yerel komutlarla doğrulandı.

Kurulu 0.0.23-dev iki normal masaüstü maçında boş açılış, karşı köşeler, P ile başlangıç, yaklaşma, her iki köşeden yumruk, nakavt ve yeni rakip akışını geçti. `installed-023.log`.

## 0.0.24-dev tek pencereli açılış

Yükleme sırasında oyun zaten kendi HUD katmanını çiziyordu. Aynı anda görünür yapılan yardımcı ayarlar penceresi masaüstünde ikinci bir görüntü oluşturuyordu. Yükleme görseli ve ilerleme çubuğu artık oyun penceresinin içindeki HUD'da gösteriliyor. Oyun hazır olana kadar yardımcı pencere gizli. Hazır olduktan sonra B ve Esc normal ayar penceresini açıyor. Yükleme hataları diyalogla gösteriliyor.

`qa/posture-0018/single-window-start-{1,2}.log` iki kurulu açılışta tek oyun penceresini, gizli yardımcı pencereleri ve isteğe bağlı ayar açıp kapatmayı doğruladı. `single-window-hud.log` yükleme görselinden saydam oyun içi göstergelere geçişi, `gate-single-window.log` 176 temel test ile 69 ve 49 kamera/girdi denetimini geçti.

## 0.0.25-dev darbe sonrası duruş

0.0.24-dev ölçümünde vuruş bittikten sonra bir boksörün kalça ile üst gövde arasındaki ekseninin eğimi yüzde 95 diliminde 28° kaldı. Darbe penceresine bağlı denge desteği, gövdenin toparlanmasından önce kapanıyordu. Duruş desteği ilk isabetli değişimden sonra tur sonuna kadar devam eder. Eklem hızlarını güvenli aralığa getirir. Yürüme adımları özgün oyundan gelir. Bacak ve dikey konum desteği vuruş ile toparlanma pencereleriyle sınırlıdır. Ayrılmış boksörlerden biri tekrar yaklaşmakta zorlanırsa bekleyen yumruk için rakibe dönmesine yardım edilir. Yeni turda önceki turdan duruş desteği devralınmaz.

`qa/posture-0018/torso-walk-normal.log` ve `torso-walk-ropes.log` normal karşılıklı köşelerden ve ip kenarından ikişer maç geçti. Her iki köşe 1 canla karşılık verdi ve 0 canda kaybeden düştü. Vuruştan 450–1.250 ms sonraki gövde eğimi yüzde 95 diliminde normal ringde en fazla 12°, ip kenarı başlangıçlarında en fazla 18° oldu. Hiçbir maçta zorunlu gard sıfırlaması görülmedi. `gate-torso-025.log` 176 temel test ile 69 ve 49 kamera/girdi denetimini geçti.

`qa/posture-0018/stycharon-posture-listen.log` canlı oda bağlantısını ikinci denemede kurdu. 15 sohbet ve 31 beğeni paketi geldi. Hediye ve yeni katılım gelmedi. Bu gözlem canlı maçta hediyeden yumruğa doğrulama sağlamadı.

## 0.0.26-dev darbe sonrası savrulma

0.0.25-dev kurulu oyun kaydında ikinci maçta iki oyuncunun canı varken bir boksör 0,1 saniyede 5,3 oyun birimi ilerledi. Karşılaşma 99–99 canda takıldı. Darbe penceresi dışında yatay hız sınırsızdı. Temas kuvvetleri de hız denetiminden önce o fizik adımının konumuna işleniyordu.

Yeni sürüm yaşayan boksörün yatay hızını ve her fizik adımında aldığı yolu sınırlar. Sınırı aşan adım kendi doğrultusunda kısalır. İki köşe yeni maça yerleşince ölçüm yeniden başlar. Kurtarma sırasında gövdeyi ve ayakları tek karede eski pozuna taşıyan işlem kaldırıldı. Bekleyen yumruk varsa boksör menzile girerken oyunun dönüş ve ileri adım komutlarını kullanır. Yeni tur ve canı sıfırlanan boksör için hareket ölçümü ayrı ele alınır.

`qa/posture-0018/guard-travel-ropes-final.log` iki ip kenarı maçında her boksörün 1 canla tekrar vurduğunu ve 0 canda düştüğünü doğruladı. Darbe sonrası gövde eğiminin yüzde 95 dilimi her iki maçta 16° altında kaldı. `installed-travel-026.log` kurulu sürümde P ile başlangıç, karşılıklı vuruş, nakavt ve yeni rakibe geçişi art arda iki maçta doğruladı. Canlı iki boksörün 0,08–0,15 saniye arayla alınan örneklerinde en büyük yatay yer değişimi yaklaşık 0,30 oyun birimi oldu. Oyundaki sabit köşelere turlar arası yerleştirme bu ölçüme dahil edilmedi.

Kurulu sürümün 65 saniyelik `@stycharon` testinde iki gerçek katılımcı ringe girdi, dört kişi sıraya geçti. Seçili köşe hediyesi bir isabetle can düşürdü. Beğeni eşiği 5 olarak ayarlandığında kabul edilen 15 yumruktan 14'ünün hasarı gözlem bitmeden doğrulandı. Yanlış köşeye yönlendirme görülmedi. İki portre ve can barı göründü. Sohbette “katıl” komutu gelmediği için karma canlı testin bu adımı açık kaldı. Kanıt `qa/posture-0018/live-travel-026.log` içinde.

## 0.0.27-dev seri yumrukların zamanlaması

İki köşenin bağımsız vuruş süreleri üst üste binebiliyordu. Eski sürümde vuruş ve toparlanma bilgisayar saatine bağlıydı. Yeni sürüm yumruk, temas ve toparlanma sürelerini maç fiziğinde geçen zamanla ilerletir. Diğer köşenin komutu eldivenin geri çekilmesini bekler. Her köşenin hediye ve beğeni emirleri kendi kuyruğunda kalır.

Eski sürümdeki ayrı `motion-room-before.log` gözleminde gerçek yayında 24 beğeni isabeti kaydedildi. 197 duruş örneğinde gövde eğimi 25° altında kaldı. Bu gözlem yayına bağlanmanın tek başına bozulmaya yol açtığını göstermedi. Yeni sürümün `timing-paired.log` regresyonunda iki köşeye aynı anda dörder yumruk gönderildi. Her turda toplam 13 nakavtsız isabet sırayla işlendi. İki turda da 1 canı kalan boksör karşılık verdi ve nakavtta düştü.

`installed-timing-027.log` kurulu sürümde art arda iki tam maç, karşılıklı isabet ve yeni rakibe geçişi doğruladı. `gate-timing-027.log` 177 temel testi ve kamera denetimlerini geçti. `live-timing-027.log` gerçek @stycharon yayınından 50 beğeni yumruğu kabul etti. Oyun süreci kapanana kadar 19 isabet can düşürdü. 258 duruş örneğinde 35° üzeri eğilme görülmedi. 95 saniyeye ayarlanan gözlem yaklaşık 81 saniye sonra oyun süreci sona erince kesildi. Kapanma nedeni belirlenemedi. Bu oturumda maçtaki boksörlerden seçili köşe hediyesi gelmedi.

## 0.0.28-dev vuruşlar arasındaki bekleme

Her iki köşe aynı özgün yumruk ve gard komutlarını kullanır. Ardışık yumrukların başlangıçları arasında en az bir saniye maç fiziği geçer. İki köşede de bekleyen atak varsa daha önce vuran köşe rakibine sıra verir. Geri çekilmeyle sonraki hazırlık arasındaki bölümde oyunun yürüyüş ve gardı tekrar devrededir. Darbe sırasında aşırı ayak hareketini sınırlayan denge desteği korunur. Yaşayan boksörün kalçası normal gard yüksekliğinin altına kaydığında düşüş hızı yumuşakça düzeltilir. Gövde dönüş hızı sınırlanır ve çok yakın temasta iki boksöre gardlarını koruyacak alan açılır.

`installed-rhythm-028.log` kurulu sürümde iki tam maçı doğruladı. İki turda da hediye ve beğeni yayın bağlantısıyla aynı olay işleyicisine birlikte verildi. Her köşe iki kez can kaybetti ve dört isabetten sonra ayrı nakavt komutuyla tur bitti. 140 darbe örneğinde ayaklar kalça altında kaldı. 35° üzeri en uzun eğilme yaklaşık 0,11 saniyeydi. `gate-rhythm-028.log` 177 temel test ile 69 ve 49 kamera/girdi denetimini geçti.

`live-rhythm-028.log` 70 saniye süren @stycharon gözleminde iki doğal katılımcı ve dokuz beğeni isabeti kaydetti. 56 darbe örneğinde ayaklar kalça hizasının altında kaldı. 119 maç örneğinde en büyük gövde eğimi yaklaşık 16° idi. Bu gözlemde hediye gelmedi. Gözlem bittiğinde maç sürüyordu.

## 0.0.29-dev merkezde yakın dövüş

0.0.28-dev kurulu maç ölçümünde ilk isabetten sonra iki boksör arasındaki ortanca mesafe 3,76 oyun birimiydi. İkilinin orta noktası ring merkezinden ortanca 4,11 birim uzaktaydı. Temas çevresinde fizik ilerleme hızı yaklaşık 0,56 simülasyon saniyesi ve diğer aralıklarda yaklaşık 0,55 simülasyon saniyesiydi. İki değer bir duvar saati saniyesine karşılık gelir.

Boksörler merkezden ayrılınca oyunun kendi ileri ve yan adım komutlarıyla içeri yönelir. Merkezde yumruk mesafesindeyken birbirlerine dönük kısa yan adımlar atar. Eldiven geri çekildiğinde yerel adımlar yeniden serbest kalır. Darbe sırasında aşırı savrulmayı sınırlayan destek ve bir saniyelik vuruş aralığı devam eder.

`source-centered-029.log` iki maçta ortanca boksör mesafesini 2,41 ve ikilinin merkezden ortanca uzaklığını 1,94 oyun birimi olarak ölçtü. Bir gerçek saniyede fizik ilerlemesi vuruşta 0,548 saniye ve diğer aralıklarda 0,552 saniye oldu. 131 darbe örneğinde ayakkabılar kalça hizasının altında kaldı. İki maç da nakavt ve yeni rakip geçişine ulaştı. `gate-center-029.log` 178 temel test ile 69 ve 49 kamera/girdi kontrolünü geçti.

`live-center-029.log` kurulu sürümle @stycharon yayınında 55 saniye içinde 16 gerçek beğeni isabeti kaydetti. 99 darbe örneğinde ayakkabılar kalça hizasının altında kaldı. Gözlemde uzun süreli öne eğilme görülmedi ve maç süre dolduğunda devam ediyordu. Altı hediye paketi ulaştı. Aktif boksörlerin seçili köşe hediyesi gözlemlenmedi.

## 0.0.30-dev daha kısa yumruk arası

Yeni vuruşa, 350 ms özgün yumruk hareketinin ardından 200 ms oyun süresi geçince izin verilir. Rakip menzilde ve duruş hazırsa başlangıçlar arasındaki en kısa süre 550 ms oyun süresidir. İki köşenin yumrukları birbirine bindirilmez. Kuyrukta bekleyen komutlar sıra geldikçe işlenir.

`installed-quick-030.log` kurulu sürümde iki maç ve her maçta dört seri hediye/beğeni isabeti kaydetti. En kısa ölçülen vuruş başlangıcı aralığı 550 ms oyun süresiydi. 113 darbe örneğinde ayakkabılar kalça hizasının altında kaldı. Ortanca boksör mesafesi 2,46 ve ikilinin merkezden uzaklığı 2,00 oyun birimi oldu. `gate-quick-030.log` 178 temel testi ve kamera kontrollerini geçti.

## 0.0.31-dev tur başında gard ve yakın adımlar

Açık yayın oturumunda iki boksörün tam canla geri sayım sırasında öne kapandığı ve ilk yakın dövüşte ayağın yere göre fazla yükseldiği görüldü. Önceki kabul ölçümü ayakkabıyı kalçaya göre ölçüyor ve gövdeyi aktif maçta izliyordu. Yeni başlangıçta ayaklar yere basarken baş ve göğüs kafesinin kalça üzerine yakın durduğu özgün pozlar arasından seçim yapılır. Köşe değişiminde ayak tabanı referansı yeniden ölçülür. Yakın dövüşte olağan dışı yükselen ayağa kısa ek denge desteği uygulanır. Gövde dengelemesi iki boksör ilk isabetten önce yumruk mesafesine girince de etkinleşir.

`final-posture-031.log` kurulu oyunda iki maç, nakavt, rakip değişimi ve P ile maç ortasında sıfırlamayı geçti. Sıradaki iki kişi tam canla kendi köşelerinde başladı. Önceki 20 yumrukluk seri temizlendi ve sonraki maçta yeni bir komutla ilk isabet doğrulandı. Normal maçların 306 duruş örneğinde 35° üzeri gövde eğilmesi görülmedi. Yakın dövüşte ölçülen en büyük ayak yükselmesi yaklaşık 0,40 oyun birimiydi. `gate-posture-031.log` 179 temel kontrolü ve kamera/girdi kontrollerini geçti.

## 0.0.33-dev yerel gard ve komut aktarımı

Komut vektörünün uzunluğu aynı kaldığında eski bir erken dönüş, değişen komutların yerel oyuna yazılmasını atlıyordu. Bellekte kalan komut ile ölçümde gösterilen komut farklı olabiliyordu. Yeni kontrol her vektörü gerçekten yazar. Gerçek kanca üzerinde iki taraf için düşük bloktan yüksek garda, otomatik yumruktan yüksek garda ve hareketle birlikte gard değişimine regresyon eklendi.

Canı olan boksörün yerel sersemleme sayaçları `2d88/2d90`, anlık ve raundluk baş/gövde enerjisi ve dayanıklılığı her yerel hareket hesabından önce korunur. Bunlar maçın 100 canlık sayacından ayrı değerlerdir. Maç canı sıfıra geldiğinde yerel yaralanma kanallarına -1 verilir. Sabitlenmiş oyunun düşme koşulu negatif enerjiyle çalışır.

İki boksör ortak Classic stilini ve yerel yüksek gardı kullanır. Yerel stil ayarlarında baş eğimi 15 derece, dört omurga bölgesinin eğim katsayıları 5 ve bob/weave katsayısı 10 olarak hazırlanır. Normal gardın baş ve gövde eğim hedefleri nötrdür. Native yürüyüş, analog yönelme ve jab/cross hareketleri kullanılır. Maç içinde kök konumu, eklem pozu ve hız üzerine ek düzeltme uygulanmaz. Köşe yerleşiminde yerel kontrol geçmişi temizlenir ve fizik zamanıyla motor durumu korunur.

2,244 birimlik eski menzil koşulu, yerel gardda 2,3–2,8 birim aralıkta kalan boksörün beğeni yumruğunu kuyrukta tutabiliyordu. Bu aralıkta da yerel yumruk komutu verilir. Komutların 350 ms yerel hareket süresi ve ardından 200 ms toparlanması sürer. Native komut eşlemeleri ve enerji alanları kurulu Capstone ile sabitlenmiş özel EXE üzerinde incelendi.

`qa/posture-0018/native-footwork-guard-033.log` kurulu sürümde dört ardışık maçı geçti. Her maçta iki köşe de 1 canla vurdu ve gardını korudu. Nakavt, kazananın köşeye dönüşü, yeni rakip, maç ortasında P, eski 20 yumrukluk kuyruğun temizlenmesi ve yeni maçta isabet doğrulandı. Nakavt örneklerinde her kaybedenin başı ayakta durduğu yükseklikten mindere indi. 821 hareket örneğinde 35° üzerinde en uzun eğilme yaklaşık 0,077 oyun saniyesiydi. Ortanca mesafe 1,82 oyun birimiydi. `gate-final-033.log` 176 temel testi, Python sözdizimini ve 69 + 49 kamera/girdi kontrolünü geçti. Kurulu çalışma dosyalarının özetleri kaynakla eşleşti.

`qa/posture-0018/live-upright-033.log`, @tenhaa.34 yayınında 60 saniyelik gerçek oyun gözlemidir. 9 sohbet, 3 hediye paketi ve 439 beğeni alındı. İki doğal katılımcı, iki portre ve iki can barı göründü. 10 beğeni eşiğinden 18 yumruk kabul edildi, gözlem bitmeden 17 isabet doğrulandı ve yönlendirme farkı sıfırdı. 105 duruş örneğinde uzun süreli eğilme görülmedi. Aktif köşelerin seçili hediyesi ve sohbetle katılım gözlemlenmedi. Gerçek hediyeden isabete sürüm kanıtı açık kaldığı için özel önizlemenin genel yayıma hazır işareti kapalıdır.

## 0.0.36-dev uzun maçta kol durumu ve tur geçişi

Önceki bölümler sürüm geçmişidir. Bu sürümde özgün stil başlıkları ve jab/cross tanımları korunur. Gardın kol kimlikleri her özgün stilde mevcut olan normal gardı seçer. Sürekli yüksek gardı yumrukla aynı anda dayatan giriş kaldırıldı. Oyunun kendi adım komutları korunur; AI adım vermediğinde yalnızca yerel ileri/geri/yan adım komutu kullanılır. Aktif dövüşte kök konumu, eklem pozu ve hız yeniden yazılmaz. Vuruş 350 ms simülasyon süresi ve ardından 200 ms toparlanmayla sıraya girer.

Uzun test önce ikinci turda açık kolları, sonra nakavttan sonraki geçişte `finished` durumunda takılmayı tekrar üretti. Köşe RPC'si yerel çağrı sırasında tick girişinden sonra gelebiliyordu. Yeni kadro hem tick girişinde hem köşe yerleşiminde eski nakavt durumunu temizler. Yerel kontrol geçmişinin temizliği kadro bayrağının daha önce tüketilmiş olmasına bağlı değildir.

Yerel tur başlangıcı `295fdd8/295fde2` adreslerinde durum sayacını 1, ayakta enum değerini 0 yazar. Önceden ısınmadan kopyalanan durum yaşı tekrar kullanılıyordu. Yeni başlangıç bu özgün değerleri kullanır. Ayrıca `2995e80` adresindeki özgün tuş tüketicisinin kullandığı mevcut ve önceki tuş vektörlerinin uzunlukları (`2c68/2c80`) temizlenir. Vektörün kapasitesi ve yerel sahipli işaretçileri korunur. Böylece yeni gövde önceki gövdenin basılı tuş kenarını taşımaz. Köşe için saklanan poz yalnızca ayakları yerde, gövdesi dik ve eldivenleri başına yakın özgün gardlardan seçilir.

Yeni dayanıklılık kontrolü her turda her iki köşede fiziksel eldiven hareketini, yumruk sonrası yürüyüşün sürmesini, kalıcı T pozunu ve göğüs arkasında kalan eldiveni ölçer. 1 canla karşılık verme, 0 canda düşme, kazananın köşesi ve yeni rakip de aynı oyun süreci içinde kontrol edilir. P ile sıfırlamada önceki 20 yumrukluk sıra temizlenir. Temel test kaydı `qa/posture-0018/gate-036.log` içindedir; yerel uzun test ile gerçek yayında doğal olay gözlemi ayrı kaydedilir.

## 0.0.39-dev özgün gard hedefi ve tur sınırı

0.0.36–0.0.38 ara denemeleri kalıcı T pozunu tekrar üretti. On dört maç geçen bir deneme on beşinci maçta başarısız oldu; bu sürümler sorun çözülmüş sayılmaz. Sağlam ve bozuk anlarda eklem sınırı, motor dişli ekseni, kuvvet sınırı ve yay referansı değişmiyordu. Sadece tuşları, sağlık değerlerini ve fizik verisini sıfırlamak açık kol hedefini gidermedi. Canlı yayın bağlantısı olmadan da aynı hata görüldü.

Bu sürüm, yaşayan boksörün eldivenleri yumruk dışında kalıcı biçimde açılır veya göğsünün gerisine giderse kendi başlangıcında kaydedilmiş özgün gard hedefine döner. MuJoCo `mj_differentiatePos` hedef için omuz ve dirsek hızlarını hesaplar. Yalnızca sekiz kol motorunun kontrol girdisi fizik çözümünden önce sınırlı hızla değiştirilir. Maç sırasında gövde/kök konumu, eklem pozu ve fizik hızı doğrudan yazılmaz; omurga, baş, bacaklar ve native yürüme hedefleri bu düzeltmeye dahil değildir. Viewer yumruğu sürerken düzeltme kol motorlarına yazmaz. Can sıfırlandıktan sonra özgün nakavt yolu serbesttir. Bozuk hedef tekrar edebildiğinden etkinleşen kol gardı sonraki yumrukların arasında aynı maç boyunca korunur; yeni turda bu durum temizlenir.

`qa/posture-0018/arm-motor-wiring-038.json` gerçek özel oyun kopyasından salt okunur motor eşlemesidir. Her iki boksör için joint aktarım türü 0, birim XYZ/scalar dişlileri ve sekiz doğru kol DOF'u doğrulandı. Motorlar sabit kazançlı, `[0,0,-kazanç]` affine bias kullanan hız servolarıdır. Kontrol değerine ayrıca kazanç çarpılmaz. `native-guard-motor.test.cjs` yalnız sekiz seçili motorun değiştiğini, başka boksörün hedefi ve kök/bacak hedeflerinin korunduğunu, yumruk ve nakavtta yazılmadığını denetler.

Tur yerleşimi `mj_step2` içinden native tick girişine taşındı. Köşe pozu ve bekleme hareketi native kemik snapshot'ları üretilmeden uygulanır. Yeni turda MuJoCo çözüm belleği ve dış kuvvetler sıfırlanırken simülasyon saati korunur. Native tuş süresi/geçmeme süresi tabloları `2a00/2a40/2a98/2ad8` ile mevcut/önceki tuş vektörlerinin uzunlukları temizlenir. Bu skaler Rust tablolarında sahipli pointer, kapasite tahsisi ve hash tohumları değiştirilmez. Ayrı regresyonda yazı sınırlarının dışındaki koruyucu baytlar da denetlenir.

`guard-motor-038.log` dört tam maç, karşılıklı beğeni/hediye vuruşları, iki köşede 1 can, nakavt, yeni rakip ve P sıfırlamasını geçti. Kök hareketi native fizik hızıyla tutarlı kaldı. Kontrol girdisinden sonraki uzun süreli bozuk gövde/kol pozu görülmedi. Native simülasyonun duvar saatine göre ilerlemesi vuruşta yaklaşık 0,549 ve vuruş dışında 0,553 idi. Kullanıcının son isteğiyle son dayanıklılık koşusu beş maçla sınırlandı. Son koşunun kaydı `final-five-039.log/.err`, temel kapının kaydı `gate-final-039.log` içindedir. Sentetik olayların gerçek yayında alınmış hediye kanıtı olmadığı ayrımı korunur.

## 0.0.40–0.0.42-dev kısa vuruş bozulması ve bacak açıklığı

0.0.39 koşusu beş maçı tamamladı fakat kaydı ayrıntılı incelemek, seri vuruşlarda 0,346 simülasyon saniyesi kadar açık/arkaya giden kol pozu buldu. Bu nedenle bu sürüm tam düzelme olarak teslim edilmedi. 0.0.40, iki oyuncuda özgün Classic jab/cross tanımlarını kullanır. Özgün düzgün vuruşlardan en az on örnek ve 300 ms hareket içeren, eldiven açıklığı/derinliği geçerli yerel kol eklem yollarını bir kez kaydeder. Bozuk kol hedefine geçen boksörde sonraki viewer vuruşları bu aynı özgün yoldan izlenir. Quaternion farkı/ara değer için MuJoCo `mj_differentiatePos` ve `mj_integratePos` kullanılır. Yalnız sekiz kol hız motoru sürülür; kök, omurga, baş ve bacak pozu yazılmaz. Geçerli kayıt yokken kaynak oyunun vuruşu devam eder. `native-punch-clip.test.cjs` geçersiz/kısa kaydı reddetme, doğru zaman penceresi, native quaternion hesabına aktarım ve başka eklemlerin korunması için on bir ek test içerir.

`final-five-040.log` ve `final-five-040.json` aynı kurulu oyun sürecinde beş maçtır. İlk dört maçta iki köşeye de hediye/beğeni vuruşu, 1 canla karşılık, nakavt ve rakip değişimi uygulandı. Beşinci maçta kümülatif 5 → 20 → 100 seri hediye tam 100 ayrı 1 hasarlı isabet üretti. Tekrarlanan bitiş/eski seri paketleri ek isabet üretmedi. Sonrasında P eski 20 yumrukluk sırayı temizledi ve yeni oyuncularla tek yeni isabet doğrulandı. 2.212 aktif duruş örneğinde yaşayan boksör native düşme/kalkma durumuna geçmedi. En uzun 3,2 birim üzeri eldiven açıklığı 0,112 simülasyon saniyesiydi. Bu koşunun sıkı 0,15 saniyelik kalıcı T pozu denetimi geçti. Bu sonuç yalnız bu beş yerel/sentetik maçın kanıtıdır.

Kullanıcı 0.0.40 ekranında bacakların vuruşta fazla açıldığını bildirdi. Kaynak Classic vuruşta `wide_start/wide_end=0.5`, normal gardda `wide=0.3` kullanıyordu. 0.0.41 bunları eşitledi fakat tek başına yeterli olmadı; `foot-stance-041.log` açıklık denetiminde başarısızdır. 0.0.42, 350 ms viewer vuruşu boyunca yürüme/pivot hedefini vuruş duruşuyla üst üste bindirmez. Bu bölümde özgün yumruğun ayak basma hedefi çalışır; geri çekilmede native adım komutları yeniden geçer. Ayak/kök konumu veya hızı doğrudan düzeltilmez. Vuruş genişliği her stilin kendi normal gardıyla eşittir. Bu değişiklik, yumruk kaynağını, hasarı, kadroyu veya kamera ayarlarını değiştirmez.

`foot-stance-042.log` ve `foot-stance-result.json` dar native regresyondur. Normal yürüyüşün ardından 12 karşılıklı özgün vuruş uygulandı. Mavi tarafta yürüyüş açıklığının yüzde 95 dilimi 2,940, vuruşta 3,010; diğer tarafta 2,984 ve 2,982 ölçüldü. Açıklık normal yürüyüş aralığında kaldı, 12 ayrı isabet doğrulandı ve yaşayan boksörlerde düşme durumu görülmedi. Son kodun `gate-final-042.log` kapısı 203 temel testi, 69 kamera ve 49 spectator kontrolünü geçti. Beş maçlık geniş koşu 0.0.40'a, son dar bacak koşusu 0.0.42'ye aittir; aynı sürümde beş maç yeniden yapıldığı iddia edilmez.

`connection-observation-039.json` gerçek @thecadyxd bağlantısının 90 saniyelik ayrı gözlemidir. 18 sohbet paketi geldi; yayın bitti ve SDK yeniden bağlanmayı denedi. Gerçek köşe hediyesinden native isabete bu sürüm için kanıt sağlanmadı. Bu nedenle özel önizlemenin genel yayıma hazır işareti kapalı kalır. Test oyuncuları gerçek kullanıcı profiline veya kalıcı kazanan verisine yazılmaz; test sonunda süreçler kapatılır.

## 0.0.43-dev temas, can barı ve seri vuruş zamanlaması

Kullanıcı 0.0.42 hareketlerini onayladı; bu değişiklik gard, kayıtlı özgün yumruk yolu, ayak basma, kamera veya ring yerleşimini değiştirmez. Temas kontrolü 25 ms gövde/arayüz örneklemesinin önüne taşındı ve her özgün fizik adımından sonra çalışır. Böylece kısa bir eldiven teması atlanıp hasar geri çekilme sonrasındaki emniyet hesabına kalmaz. Gerçek temas veya özgün yaralanma kanalı vuruşu yalnız bir kez sayar; temas kaçarsa mevcut 425 ms emniyet yolu korunur. Komut verildiği anda peşin hasar uygulanmaz.

Can değişimi 100 ms gözlem yayın sınırını beklemeden ilk native tick sonunda gönderilir. Can barının 140 ms küçülme geçişi kaldırıldı; darbe parlaması ve hasar yazısı korunur. `hit-timing-baseline.json` sekiz vuruşta en fazla 47,99 ms temas-bilgi yayını gecikmesi ve üç geç emniyet hesabı gösterdi. Aynı kaynak düzeltmesini içeren `hit-timing-fixed.json` koşusunda sekiz vuruşun tamamı eldiven temasında sayıldı; temas-bilgi yayını en fazla 0,833 ms oldu. Bu ölçümler kaynak bridge mesajları arasındadır; monitör, Chromium/Vulkan çizim gecikmesi veya TikTok yayın gecikmesi değildir. Ölçüm dosyalarının sürüm alanı, paket sürümü artırılmadan önceki 0.0.42 etiketini taşır.

Sonraki kullanıcı isteğiyle vuruşlar arasındaki boş toparlanma 200 ms'den 100 ms simülasyon süresine indirildi. Özgün 350 ms hareket süresi korunur; iki köşe birbirinin aktif yumruğu ve toparlanması bitmeden yeni yumruk başlatamaz. Seri hediyeler aynı tekil sıradan geçer. Bu süreler duvar saati veya tam animasyon hızı iddiası değildir.

`native-hit-timing.test.cjs`, kısa temasın telemetri sınırına takılmadığını ve tek isabetin aynı tick içinde yeni can bilgisi yayınlayıp tekrar sayılmadığını doğrular. Son temel kapı `gate-final-043.log`: 205 test, 69 kamera ve 49 spectator kontrolü başarılı. Gerçek yayın hediyesinden isabete yeni kanıt alınmadığından genel yayım işareti kapalı kalır.

`flow-timing-043.log/.err` kurulu 0.0.43 üzerinde iki tam maç ve P sıfırlamasıdır; çıkış kodu 0, hata çıktısı boştur. Karşılıklı hediye/beğeni serileri, her iki köşede 1 canla karşılık, özgün nakavt, kazananın köşeye dönmesi ve yeni rakip geçti. Seri başlangıç aralıkları yaklaşık 451 ms simülasyon süresidir. Oyun içine çizilen iki Chromium HUD can barı da 98 canı `matrix(0.98,...)` ve `transition-duration: 0s` ile gösterdi. 473 canlı duruş örneğinde kalıcı eğilme, T pozu veya ayak yükselmesi denetimi geçildi. Simülasyon/duvar saati oranı vuruşta ve arada aynıydı (0,553); ek vuruş ağır çekimi ölçülmedi. P önceki 20 yumruğu temizledi ve yeni eşleşmenin ilk isabeti ayrı sayıldı. Bu iki maç yerel/sentetiktir; eski beş maçlık 0.0.40 kanıtı yeni sürümde yeniden yapılmış sayılmaz.

## 27 Kasım: @rasimbisakin bağlantısında üç maç ve ek üç maç

`qa/live-three-bouts.cjs` kurulu 0.0.43'ü gerçek yayın bağlantısı ve ayrı geçici uygulama profiliyle çalıştırır. Kullanıcının kalıcı ayarları veya kazananları değiştirilmez. Gerçek callback, kabul edilen native yumruk ve isabet sayıları yerel test girdilerinden ayrı tutulur. Yerel eylemler yayıncıya veya sohbete mesaj göndermez. Oyun çalışma dosyalarının 0.0.43 hash'leri korunmuştur; bu kontrolde oynanış değiştirilmedi.

İlk üç maçın denetimi, rakibin canı sıfırlandıktan sonraki özgün kazanan kol pozunu da T pozu sayarak başarısız oldu (`live-three-043-initial.json`). İnceleme koşusu `live-three-043.json` ve `live-three-043-motion.json`, nakavt sonrası 1,693 simülasyon saniyelik açık kol pozunu, iki boksör de canlıyken en fazla 0,106 saniyelik kısa açıklıktan ayırdı. Üç maç boyunca 529 yaşayan duruş örneği bağlantı açıkken alındı ve hiçbir yaşayan dövüşçü native düşme/kalkma durumuna girmedi. Bu koşuda 7 gerçek hediye, 50 gerçek beğeni paketi, bunlardan 18 native isabet; ayrıca 20 yerel isabet kaydedildi. Doğal katılımcı yeterliydi; yerel oyuncu eklenmedi. Davranış denetimleri geçti fakat test kapanırken açık telemetri isteğinin reddi otomasyonun çıkışını 1 yaptı. Bu test aracı yarışı bekleyen örneğin bitmesini bekleyerek düzeltildi; ayrı `live-three-043-cleanup.log` dar kapanış kontrolü çıkış 0 ile tamamlandı.

Kullanıcının istediği ek üç maç `live-three-043-extra.log/.err/.json` ve `live-three-043-extra-motion.json` içindedir. Süreç çıkışı 0, hata çıktısı boştur. Yaklaşık 90,6 saniye kesintisiz bağlantıda üç maç, nakavt, kazananın köşeye dönüşü ve yeni eşleşmeler tamamlandı. 477 yaşayan duruş örneğinin tamamı bağlantı açıkken alındı; native düşme/kalkma değeri 0 kaldı. Kalıcı eğilme, kalıcı açık kol ve yüksek kalan ayak denetimleri geçti. Dövüşte en uzun 3,2 birim üzeri eldiven açıklığı 0,061, 35 derece üzeri gövde eğilmesi 0,179 simülasyon saniyesiydi. Nakavt sonrası kazanan pozu ayrıca ölçüldü (1,734 saniye) ve dövüş hatası sayılmadı. Bu ek koşuda 27 sohbet, 9 hediye ve 40 beğeni callback'i geldi; bunlar ringdeki kişilere yeni yumruk üretmedi. Maçlar 21 kontrollü yerel vuruşla tamamlandı. Katılımcılar gerçek yayın girdilerinden geldi; yerel oyuncu eklenmedi. Bu nedenle ek koşu yalnız gerçek hediyelerle oynanmış üç maç olarak sunulmaz. Test süreçleri ve bağlantısı kapatıldı. Bu sınırlı gözlem gelecekte her koşulda hatasızlık garantisi veya otomatik genel yayım onayı değildir.

## 0.0.44-dev: gelen beğeni, eşik ve menzil beklemesi

Kullanıcı @noscopex22 yayınına bağlı açık oyunda @mangao7tv hesabından beğeni gönderirken geç veya eksik yumruk bildirdi. `qa/observe-active-likes.cjs` ikinci LIVE bağlantısı veya ikinci oyun açmadan mevcut Electron nesnelerini geçici yerel inspector üzerinden gözledi. Mevcut ayarlar `punchSource=all`, eşik 10, hasar 10 idi. SDK callback'i → eşik hesabı → native komut kabulü 0–1 ms sürdü. Bir gerçek örnekte 14 beğeni paketi aynı callback içinde bir 10 hasarlı komut üretti, 87 ms sonra özgün vuruş başladı, 241 ms sonra temas sayıldı. Beğeni sayımı seri bitişini beklemiyordu.

Ancak native komutun kabulü ile ilk yumruk arasında 5.835 ms bekleme görüldü. Kuyruk mevcutken menzil dışında yan/geri/pivot adımı korunabiliyor, yalnız boş native yürüme girdisinde çalışan ileri-adım yedeği yaklaşmayı öne alamıyordu. 0.0.44, yalnız bekleyen viewer yumruğu varken ve iki boksör 2,8 kök mesafesinin dışındayken özgün ileri adım komutunu (22) seçer. Aktif vuruşta ayak basma kuralı aynıdır. Menzile girince mevcut özgün yumruk ve 100 ms toparlanma çalışır. Kuyruk yokken mevcut native adımlar aynen korunur. Gövde/ayak konumu, hızı, omurga, kol yolu veya fizik çözümü değiştirilmez; menzil kontrolü kaldırılmaz ve uzaktan peşin hasar yazılmaz.

`like-threshold-immediate.test.cjs`, gerçek live-client normalizasyonunu sahte taşıma üzerinden 1/5/10/100/200 eşikleriyle sınar. Eşiği geçen paket aynı senkron çağrı içinde doğru sayıda 10 hasarlı komut oluşturur; kalan beğeni taşınır ve tekrarlanan paket yeni komut üretmez. Bu sonuç TikTok'un telefondaki her dokunuşu anında sunucuya ilettiği anlamına gelmez. Yalnız gelen kişisel delta sayılır; oda toplamı veya başka izleyicinin beğenisi aktif boksöre yazılmaz. Oyuncu değişiminde/eski turda bekleyen komut temizleme kuralları korunur.

Dar regresyon `like-fix-044-unit.log` 21 kontrol; tam temel kapı `gate-final-044.log` 211 test, 69 kamera ve 49 spectator kontrolüyle başarılıdır. Kullanıcı açık maçı/sırayı kapatacak yeniden başlatmayı açıkça onayladı; özel masaüstü paket 0.0.44 olarak güncellendi. Yeni sürüm oyun içi kontrolü ve yeniden bağlanma sonucu ayrı kaydedilir. Geçici gözlem yalnız beğeni sayısı, anonim gönderen eşlemesi, komut/isabet zamanı ve native durumu tutar; parola/çerez okunmaz, sohbete mesaj gönderilmez.

## 0.0.45-dev: beğeni ve takip ile sıra FPS puanı

Sıra önceliği artık gerçek hediye coin toplamı + kişisel her 100 beğenide 1 FPS + ilk takipte 5 FPS olarak hesaplanır. Katıl yorumuyla yeni giriş 0 FPS'dir; eşitlikte önce katılan öndedir. Aynı oturumda yeniden takip olayı ek 5 puan vermez. Kimliği sonradan hesap ID'sine tamamlanan kişinin beğeni kalanı korunur. Kişisel delta olmayan, başlangıç, tekrar oynatım ve test olayları ücretsiz sıra puanı üretmez. Sıra puanı `fps` alanıdır; gerçek hediye toplamı `coins` ayrı kalır. Oyun listesi, native HUD'daki bekleyen model etiketi ve mevcut widget protokolünün FPS gösterimi toplam puanı kullanır.

Sıra için 100'lük kalan, katılım beğeni eşiği ve yumruk beğeni eşiği birbirinden ayrıdır. Yumruk eşiğini değiştirmek veya maç/P geçişi sıra için biriken kalanı silmez. Bu sıralama ringdeki dövüşçüleri maç sırasında yerinden etmez. B menüsündeki açıklama sabit 100/5 kurallarını belirtir; mevcut katılım/yumruk seçenekleri korunur.

`queue-fps.test.cjs` dört regresyon ekler: 99+1 ve farklı izleyiciler, takip bonusunun tek uygulanması, hediye ile birleşik sıralama, eşitlik, kimlik tamamlanması, tur/ayar geçişi, büyük güvenli sayaç ve widget FPS çıktısı. `gate-final-045.log`: 215 temel test, 69 kamera ve 49 spectator kontrolü geçti. Paket 0.0.45-dev kuruldu; altı değişen çalışma dosyası kaynakla hash eşleşmesi verdi. Kullanıcının kalıcı ayarları ve kazanan kaydı silinmedi.

`like-fps-flow-045.log` ve `like-fps-flow-045-motion.json`, kurulu sürümde iki yerel maç, iki köşede 1 canla karşılık, nakavt, kazananın kalması, yeni rakip ve P ile eski yumrukların temizlenmesi denetimlerini geçti. 476 aktif duruş örneğinde kalıcı eğilme/açık kol/ayak yükselmesi denetimleri geçti. Ardından test aracının eksik ayar nesnesi reddedildiği için bu ilk aracın toplam çıkışı 1'dir; oyun çökmesi olarak veya tüm aracın başarılı çıkışı olarak raporlanmaz. Dar ayar denemesi tam ayar nesnesi ve benzersiz olay ID'leriyle düzeltildi. `fps-hud-045-fixed.log/.err` ayrı kurulu uygulama kontrolüdür: çıkış 0, hata çıktısı boş; beğeni 6 FPS, ilk takip 5 FPS, hediye 2 FPS sırası hem panelde hem oyun içine çizilen HUD'da aynıydı. Test profili geçicidir ve test süreçleri kapatıldı.

Önceki .44 koşusunun vuruş sonu anında güncel saatle önceki native girdi vektörünü karşılaştırması bir yanlış test hatası üretti. Son sürüm örneği, her vektörle aynı anda kaydedilen `inputPolicy` ölçümünü kullanır. Bu ek alan yalnız tanı verisidir; vuruş/ayak davranışına yeni bir müdahale eklemez. Gerçek yayın bağlantısı ve doğal hediye/beğeni teslimi ayrıca değerlendirilir; bu yerel kanıt tek başına genel yayım kapısını açmaz.

Normal kullanıcı profili 0.0.45 ile açılıp @noscopex22 hesabına yeniden bağlandı (`reconnect-status-045.json`: connected). İlk bağlantı denemesindeki geçici error durumundan sonra aynı uygulama oturumu bağlandı; ikinci oyun/LIVE sahibi açılmadı. Eşik 10, hasar 10 ve kaynak all korundu. `active-likes-045.json` kısa gerçek gözlemde 19 kişisel beğeni paketi, beşi ringdeki kişilerden kaydetti. Maç P ile başlamadığı için sıfır komut/isabet doğru bekleme davranışıdır; bu kayıt gerçek maçta yumruk gecikmesinin tamamen ortadan kalktığı kanıtı değildir. Görsel kontrolde tek native oyun penceresi, mevcut kazanan kaydı, iki gerçek köşe katılımcısı ve 10/5 FPS sıra etiketleri görüldü. Geçici gözlem sarmalayıcıları kaldırıldı ve yerel inspector kapatıldı. Oyun kullanıcı testi için açık ve bağlı bırakıldı.

## 0.0.46-dev: kurulum anlatımı için ayarlanabilir beğeni yumruk adedi

Yeni varsayılan `likeThreshold=100`, `likePunchCount=2`; kayıtlı 10/1 veya özel kurallar korunur. Normal girişte `main.cjs` zaten `punchSource=all` seçer; kuyruk modülünün `gift` varsayılanı korunur. B menüsünde `#like-threshold` ve yeni `#like-punch-count` (1–100 tam sayı, “Eşik başına yumruk sayısı”) bağımsız düzenlenir. `window.hediyeBox.configureAudience({...ayarlar, likeThreshold, likePunchCount, likeDamage})` aynı API ve şema 2 kayıt yolunu kullanır. Hasar her yumruk içindir; adet değişince hasar değişmez. Kaydetmede zorunlu 1 yumruk dönüşümü kaldırıldı. Adet değişirse iki dövüşçünün maç beğeni kalanı temizlenir; aynı adetle kayıt, sıra FPS/katılım kalanı ve olay tekrar koruması korunur. Yayın oturumu sahipliği ve native davranış değiştirilmedi.

Dar regresyon: `node --test tests/like-rule-settings.test.cjs tests/audience-queue.test.cjs tests/like-threshold-immediate.test.cjs tests/queue-fps.test.cjs tests/live-client.test.cjs tests/desktop-round-flow.test.cjs` — 97 test başarılı, çıkış 0. Beş yeni sayaç/ayar testi, üç yeni gerçek preload/IPC/renderer testi ve iki ek canlı istemci sahte taşıma örneği; eski 10/1 senaryoları açık ayarlarla korunur. B menüsü varsayılanı, yalnız adet değişen taslak, 1/100 sınırları, geçersiz giriş, ilgisiz kayıt ve kalıcı ayardan/renderer yeniden yüklemesinden dönüş doğrulandı. `tests/release-gate.ps1 -FoundationOnly`: 225 temel test, 69 kamera ve 49 spectator kontrolü başarılı; Python/JavaScript sözdizimi geçti, çıkış 0. Bu otomatik testler sahte native/LIVE ile geçici profildedir.

Sonrasında 0.0.46-dev özel masaüstü paketi kuruldu. Kullanıcının açık oyunu kapatma onayıyla ayrı logolu örnek oturumu çekildi. `video-production/ring-guide-20261127/capture-marks.json`: 100 yerel kişisel beğeni, 2 ayrı native 10 hasarlı isabet verdi; gerçek köşe hediyesi kod yoluyla yerel örnek olaylar, native nakavt/kazanan ve sonraki rakip çekildi. `reset-capture-marks.json`, P sıfırlamasında her iki eski boksörün çıktığını ve sıradakilerin iki köşeye geçtiğini doğrular. Gerçek yayına bağlanılmadı veya hediye gönderilmedi. Test süreçleri kapandı. Kullanıcının açık yeni standart isteği üzerine kişisel ayar dosyasındaki yalnız eşik/adet 100/2 olarak atomik güncellendi; önceki dosya `.before-100x2-20261127` ekiyle yedeklendi. Hasar 10 ve diğer kişisel ayarlar korundu. Bu sonuç genel yayım veya gerçek hediye teslimi onayı değildir.

## 0.1.0: GitHub yayın adayı ve taşınabilir mod paketi

Ring ayrı Electron/Python/Frida çalışma zamanı ile paketlendi. Steam Online Boxing 3D Demo 4793540 önce kurulmalıdır. Doğrulanan Steam EXE SHA-256 `fe6f213d0f8eabc4674f9160fcee128f448727c255a8ed8a1a029b5a58d782ed`, bu modun desteklediği native EXE SHA-256 `9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67` değeridir. Uyumluluk farkı yalnız kullanıcı veri dizinindeki kopyaya Windows MSDelta ile uygulanır; Steam dosyaları değiştirilmez ve oyun/Steamworks/MuJoCo ikilileri Ring ZIP'inde dağıtılmaz. Native yol koruması, worker'ın hash ile doğruladığı kesin EXE yolunu kullanır. Köşe DLL'i de taşınabilir doğrulanmış native yolu kabul eder.

`work/ring-release-7038/qa/portable-two-bouts.log`: yeni paket ve paket içi Python ile iki tam yerel/sentetik maç, iki köşede 1 canla gard, nakavt, kazananın kalması, yeni rakip ve P sıfırlaması çıkış 0 verdi. Kalıcı eğilme, açık kol ve havalanan ayak denetimleri geçti. Bu koşu, gerçek hediye tesliminin kanıtı değildir. Yeni paketle @rasimbisakin gerçek yayınına bağlanıldı; iki portre/can barı ile beğeniden iki native isabet gözlendi. Aktif dövüşçüden seçili köşe hediyesi gözlenmedi. Kullanıcı şu anda hediye testi yapamayacağını belirtti. Güncel tam Ring kapısı bu eksik kanıt nedeniyle çıkış 1 verdi; eski kanıt güncelmiş gibi değiştirilmedi.

Launcher 7.0.38 için 467 test, sunucu için 435 başarılı/6 atlanan kontrol, Ring için 228 temel + 69 kamera + 49 spectator kontrolü geçti. Kurulum/portable/ZIP sağlama değerleri ve updater içeriği doğrulandı. Sürüm önce ayrı GitHub dalı ve taslak olarak hazırlandı. Kullanıcı gerçek hediye denemesini şu anda yapamayacağını belirtti ve eksik kontrol açıklandıktan sonra GitHub yayınının tamamlanmasını doğrudan istedi. GitHub yayını bu eksik doğrulama sürüm notunda korunarak tamamlanır; Ring tam kapısı geçmiş sayılmaz. Render dağıtımı kullanıcıya bırakılır. Bağlantı/mod/ayar yolları `src/runtime-paths.cjs`, `src/live-client.cjs`, `src/audience-queue.cjs` ve `main.cjs` içinde korunur; kalıcı kullanıcı ayarları veya kazananlar bu hazırlıkta silinmedi.
