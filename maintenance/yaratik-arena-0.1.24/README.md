# TikMnG Yaratik Arena - 0.1.24

## 0.1.24 Yaratik Dengesi Ve Sureli Destek

- Hediye ile gelen destekciler 20 oyun saniyesinde temizlenir; ceset, silah veya hedef referansi birakmaz. Menu ve duraklatmada sure islemez. Destekci cani 20 kalir.
- Kucuk yaratiklarin cani her silah kademesinde %50 artar (yukari yuvarlanir): 12, 18, 27, 41, 61, 92, 137, 206. Mevcut canlilar ayni can oranini koruyarak guclenir; oluleri diriltmez. Silah dusurmek o tur kazanilmis yaratik gucunu dusurmez; yeni tur bunu sifirlar.
- Tam canli kucuk yaratik ilk roket isabetinden en az 10 canla sag cikar; sonraki isabetlerde normal sekilde olebilir. Boss ve Big Boss cani %10 artarak 264 ve 528 oldu.
- Butun dusmanlarin yurume/kosma hizi onceki surume gore %5 artirildi; destekci hizi ve yuzdelik saldiri hasarlari degismedi.
- Sarjor, hararet, kalabalik takip, olum sonrasi sifirlama ve kullanici ayarlari korunur. Yalnizca oyun paketi guncellenir.

## 0.1.23 Sarjor, Hararet Ve Kalabalik Takibi

- Boss cani 240, Big Boss cani 480 oldu; onceki degerlerin iki kati. Boyut, yuzdelik hasar ve buyuk yaratiklarin daha yavas saldiri ritmi korundu.
- Tabanca 12, Uzi ve AK-47 30, pompali 6, roket 1 mermilik sarjor kullanir. R ile kismi sarjor doldurulabilir; bos sarjor otomatik dolar. Doldurma suresince ates edilmez ve silah elle asagi indirilir. Yedek mermi sinirsizdir. Silah/vakum degistirmek bedava sarjor vermez. Otomatik oyun ayni mermi kurallarina uyar.
- Alev silahi 4 saniyelik kesintisiz ateste asiri isinir. Bes oyun saniyesi boyunca ates edemez; soguyunca yeniden kullanilir. Silah degistirmek sogumayi silmez; duraklatma sarjor/soguma sayacini durdurur.
- Sag alttaki mermi/hararet gostergesi can barinin krem, koyu lacivert, turuncu detayli temasini kullanir. Can gostergesi 0.1.22'ye gore yaklasik %12 buyudu. Dar ekranda gostergeler cakismayacak sekilde yerlesir.
- Kalabalik yol istekleri FIFO sirasinda islenir. Yaratiklar farkli temas noktalarina yonelir, sikisanlar ayni katta yan rota dener. Saldiri menzilindekiler oyuncuyu itmeye devam etmez. Canli yaratik ile oyuncu arasindaki fiziksel itme kapatildi; gercek yakin dovus hasari, dunya duvarlari, zemin, kafes ve silah/vakum carpisma sorgulari korunur. Olu bedenlerin normal fiziksel davranisi geri gelir.
- Gereksiz kapsul yenilemesi kaldirildi, oyuncu fizigi yumusatildi. Yaratik yonu carpisma darbelerinden degil hareket yonunden alinir. Boss adimlarinin istenen kisa kamera sarsintisi korunur.
- Yalnizca oyun paketi guncellenir; launcher 7.0.15, kayitli hesap ve eylemler, ses ayarlari ve yerel Steam kopyasi korunur. Steam demosunu yeniden indirmek gerekmez. Asagidaki eski yayinlanmadi ifadeleri gelistirme tarihcesidir; guncel yayin durumu surume ait VERIFICATION.json ve GitHub Release kaydindan kontrol edilir.

## 0.1.22 Kapanis Ve Baglanti Duzeltmesi

- Acilis yardimcisi oyun kapanana kadar kendi baslattigi asil Process nesnesini ve handle'ini korur. Acilis gorselinin kapanmasi bu kaynagi erken serbest birakmaz. Normal cikis 0, gercek hata kodlari degismeden launcher'a aktarilir.
- B > Yayin ve test bolumunde Baglan ve Baglantiyi kes ayri komutlardir. Son kaydedilen oyun hesabi saklanir; launcher'dan gelen baska bir hesap bu secimi her acilista degistiremez. Yeni kurulumda hesap adi bostur.
- Canli baglanti kesildiginde oyun son secilen hesabi yeniden dener; kullanici Baglantiyi kes dediginde deneme durur ve kullanici adi unutulmaz.

## 0.1.21 Acil Oyun Duzeltmesi

- Yaratiklarin profil ve can gostergeleri bas noktasina sabit kalir; cakisan etiketler baska yere tasinmaz, gizlenir. Uzaklastikca kuculur. Can cubuklarindaki sayilar kaldirildi. En fazla 24 (dar ekranda 16) etiket cizilir ve her karede en fazla bir yeni profil resmi yuklenir.
- Oyuncu oldukten sonra son darbeyi vuran kisinin profili gosterilir. Ardindan eski turun canlilari, cesetleri, yardimcilari, vakum referanslari ve etkileri temizlenir. Kayitli ayarlar ve yayin baglantisi korunur. Sonuc ekraninda gelen yeni eylemler yeni tura aktarilir.
- Gercek son hasardan 7 oyun saniyesi sonra saniyede azami canin %1'i yenilenir (500 canda saniyede 5). Yeni hasar beklemeyi sifirlar. Duraklatma veya olum ekraninda yenilenme olmaz.
- Oyuncu can gostergesi %18 buyutuldu ve alt kenardan 52 piksel yukari alindi. Oyun-only guncelleme mevcut launcher 7.0.15 ile kurulabilir.

Asagidaki eski surum notlari gelistirme tarihcesidir; 0.1.20 launcher 7.0.15 ile yayinlandi. 0.1.21 paket, native test ve yayin kanitlari ayri `VERIFICATION.json` kaydinda tutulur.

Masaustundeki **TikMnG Yaratik Arena - Prototip** kisayolu ile acilir.

Bu bir Can 'Em All Demo modudur; bagimsiz yeniden yapim degildir. Steam'deki orijinal kurulum yerine bu klasordeki ayri test kopyasini kullanir. Normal TikMnG launcher'a eklenmedi ve yayinlanmadi.

## Launcher Yayini Icin Steam Demo Gereksinimi

2026-11-02 kullanici onayi: oyuncular once Steam'den ucretsiz **Can 'Em All Demo** oyununu kuracak. Oyun sayfasinda **Steam'den Demoyu Indir** dugmesi bulunacak. Dogru demo App ID'si **5364590**, baglantisi <https://store.steampowered.com/app/5364590/>. Steam'in resmi uygulama API'sinde ad, demo turu ve ucretsiz oldugu dogrulandi. Ucretli tam oyun baglantisi kullanilmayacak.

Yayin hazirliginin `assets/publishing/manifest.json` dosyasinda bu on kosul kayitlidir. Launcher entegrasyonunda demo yoksa Oyna yerine once demo kurulumu istenecek; demo kurulduktan sonra TikMnG modu kendi acilis yardimcisiyla baslatilacak. Steam kutuphaneleri farkli disklerde olabilir. Yalnizca Steam'in kurulu olmasi veya bos bir oyun klasorunun bulunmasi yeterli kabul edilmeyecek. Mevcut demo dosyalari, kullanici kayitlari ve Steam kurulumlari silinmeyecek.

Bu kayit, launcher dugmesinin veya temiz kurulum akisinin tamamlandigi anlamina gelmez. Yayindan once demo olmayan sistem, farkli diskten demo kurulumu, kurulumdan sonra yeniden kontrol ve gercek mod acilisi test edilmelidir. Mevcut masaustu prototipin calisan baslatma akisi bu gereksinim kaydiyla degistirilmedi. Son canli test ve launcher paket testi gecmeden GitHub/Drive/Render yayini veya yeni oyun bildirimi acilmayacak.

## 0.1.20 TikMnG Acilisi Ve Ses Tercihleri

Mevcut masaustu kisayolu ayni `start.ps1` dosyasini acmaya devam eder. Kucuk, Windows'un yerlesik .NET Framework'unu kullanan `bootstrap/TikMnG.Arena.Startup.exe`, gercek oyun kapagi/logo, hafif yakinlasma ve hareketli turkuaz-kirmizi yukleme cizgisini oyun baslamadan cizer. Gercek Unity penceresi, uzerine kapak baglandiktan sonra gorunur olur. Yalnizca o oyun PID'sinin ilk basarili oyun karesi hazir sinyali acilisi kapatir; sabit bekleme veya sahte yuzde yoktur. Son gecis 180 ms'dir. Ayni kisayola tekrar basmak ikinci oyun baslatmaz. Acilis yardimcisi oyuna devrettikten sonra kapanir; arka planda surekli animasyon calistirmaz ve ses calmaz.

Acilis iptali yalnizca kendi baslattigi oyunu kapatir. Hata veya 90 saniyelik zaman asiminda sonsuz yukleme yerine durum/gunluk/kapat sunulur. Kapak eksikse koyu marka/durum ekrani kalir. Kurulu ayarlar, hediye eslestirmeleri ve Windows sesi degistirilmez. Gelecek launcher paketinde giris dosyasi dogrudan eski oyun EXE'si yerine bootstrap EXE olmalidir; yerel asset manifest buna gore gunceldir. Yeni bir masaustu kisayolu veya kullaniciya ek kurulum olusturulmadi.

Kullanicinin bu gorev sirasinda kaydettigi son ses tercihi ana ses %71, muzik %3, efekt %80'dir. `defaults/audio-settings.json` yalnizca native ayar kaydi olmayan ilk kurulumda bu uc alani uygular; var olan kayitlarin ustune yazilmaz, grafik ve kontrol alanlari korunur. Modun ayri ses seviyesi %60 olarak kaldi. Erken gorev yedegindeki eski ses dosyasi geri yuklenmedi. Motor cikisi kontrolu yapildi; bu kulaklikta insan dinlemesi veya Windows mikser ayarini degistirme iddiasi degildir.

Kaniti: `qa/startup-result.json`, `qa/startup-tests.cjs`, 1280x720 / 800x600 on izlemeleri ve `qa/startup-launch.json`. Derlemek icin `bootstrap/build.ps1`; normal `build.ps1` de acilis yardimcisini derler. Resmi launcher/GitHub/Drive/Render yayini yapilmadi.

## 0.1.19 Kalabalik Ve Yayin Dosyalari

- Canli bir yaratigin ustunde duran oyuncu da gercek yakin dovus hasari alir. Gercek collider boyu ve oyuncunun ayak yuksekligi kullanilir; duvar/kat gorus kontrolu ve uzak hava hedefi siniri korunur.
- Normal, Boss, Big Boss ve desteklerin native yuruyus hizi %20 artirildi. Her dogumda kaynak prefab hizindan hesaplanir; havuzda katlanmaz.
- Dogumlar oyuncunun onunde, ayni kattaki guvenli alana 4,5-12,5 metre araliginda dagilir. On sektor kapaliysa arena icine dogru guvenli sektor aranir; duvara bakmak kuyrugu kalici kilitlemez. Tek bir dar halka veya arkadan aniden tam cevreleme yoktur. Engel, pano arkasi ve kafes kontrolleri korunur.
- Profil ve can etiketi tek bir cakisma-denetimli bloktur. Nisan alinan, yeni hasar almis ve yakin yaratiklar onceliklidir. Yer bulunamayan etiket baska etiketin ustune cizilmez; yer acilinca geri gelir. En fazla 48, dar ekranda 24 blok cizilir; gercekte sigan sayi daha az olabilir. Baglanti cizgileri kaldirildi.
- B > Yayin dosyalari: kullanicinin orijinal saydam hediye PNG'si ve yeni kapak on izlenir; Indirilenler'e kayipsiz kopyalanir. Ayni ad varsa sayili yeni dosya olusur, eski dosya degistirilmez. Kapak uretim kaydi `assets/publishing/cover-prompt.md` icindedir.
- `defaults/game-settings.json`: son onayli 12 hediye eslestirmesi, 100 begenide 5 yaratik, ilk takipte 5 yaratik, Blue Bead (5319) 10 yaratik, Parfum (5658) 25 yaratik, 500 baslangic cani, 180 saniye / 500 oldurme / 21 win, 60 + kademe basina 20 toplama. Yalnizca kullanici kaydi yoksa uygulanir; mevcut kayitlarin ustune yazilmaz. Yayin kullanici adi pakete dahil degildir.
- Gorseller sonraki launcher oyun sayfasi icin yerel olarak hazirdir. Bu surum launcher'a, Drive'a, GitHub'a veya Render'a yayimlanmadi.

Yeni surum kanitlari: `qa/crowd-polish-result.json`, `qa/final-event-result.json`, `qa/combat-polish-result.json`. Hediye/takip fixture'lari ayni normalize etme ve oyun tuketim akisini kullanir; gercek satin alinmis hediye testi iddiasi degildir.

## B Kontrol Merkezi

Gercek TikMnG logosu, oyunun kendi ekipman gostergesine uyumlu acik baslik, koyu icerik ve net beyaz metinler kullanilir. Secimler ve kaydet turkuaz, silme kirmizi, sureli eylemler amber renklidir. Yayin ve test, eylemler, hediye katalogu ve oyun ayarlari ayni B panelindedir. Eylemlerde oynat simgesi test, cop kutusu silmedir; fareyle beklenince adlari gorunur. Menu oyunu duraklatir; ESC hala orijinal menuye gider.

Eylemde Hediye sec tiklaninca kart/sayfa sistemi yerine tek bir kaydirilabilir katalog listesi acilir. Gorsel, ad, coin ve ID sabit sutunlardadir; dusuk coin'den yuksege siralanir. Fare tekerlegi ve sagdaki suruklenebilir cubukla gezilir. Ad/ID/coin aramasi vardir. Satira tiklamak dogru eyleme hediyenin gercek ID'sini kaydeder ve eylemlere dondurur; yazilan adet/saniye/kademe degismez. Sol ust geri oku secmeden doner. Yayin testindeki hediye secimi de ayni listeyi kullanir. Liste yalnizca gorunen satirlari cizer; arama sonucu ve yuklenmis kucuk gorseller onbellege alinir.

B > Oyun ayarlari > Tur ve kalabalik altindaki **Canavar siniri** en fazla 2.500 olabilir. Kuyruk ve sahadaki canli toplam kabul bu tavani asmaz; eski 5.000 ayarlari 2.500'e alinir. Olu bedenler bu canli sinirina sayilmaz; vakumlanana kadar saklanir.

Onceki 5.000 stres testi bu bilgisayarda RAM nedeniyle tamamlanamadi. Yaklasik 2.500 native yaratikta tum oyun islemi 17,7 GB calisma bellegine ulasti; yeni tavan kullanicinin istegiyle 2.500'dur. Model/kaplama kalitesi dusurulmedi. Buyuk dijital sayi yalnizca gercekten sahadaki canlilari gosterir; kuyruk sahadaymis gibi toplama eklenmez. Bos fiziksel RAM 2 GB altindayken yeni native nesne ayirma durur; mevcut havuzdaki nesneler kullanilabilir. Kuyruk silinmez, sayacta SAHADA / SIRADA ve BELLEK BEKLENIYOR gorulur. Bos RAM 2,5 GB uzerine ciktiginda yeni ayirma devam eder. Buyuk ceset yiginlarinin maliyeti ayrica vardir.

## Kontroller

- WASD: hareket. Fare: bakis. Sol tik: secili silah / vakum.
- R: sarjorlu silahta sarjor degistir. Alev silahi asiri isininca 5 saniye sogumasini bekle.
- Space: zipla. Havadayken ikinci Space, kameranin baktigi yone en fazla 25 metre atilir; duvar, zemin ve tavanda durur. Yere inmeden tekrar zincirlenmez.
- CTRL basili: egil. Kamera ve fiziksel kapsul birlikte alcalir; yurume yavaslar. Birakilinca tavanda yeterli bosluk varsa ayaga kalkar.
- E: vakum ve mevcut silah arasinda gecis.
- P: otomatik oyunu ac / kapat. Panonun ust sagindaki OTO dugmesi veya B > Oyun ayarlari > Silahlar altindaki kutu da ayni kontrolu kullanir. G artik otomatik oyunu acmaz.
- Panodaki BASLAT: otomatik oyunu acmadan sureli gorevi baslatir. Sayaci durdurmak icin panodaki DURDUR kullanilir.
- B: yalnizca bu moda ait yayin testi, eylemler, gorselli hediye katalogu ve ayarlar.
- ESC: oyunun orijinal duraklatma menusu; Settings ile orijinal oyun ayarlari.
- F1 / F2 / F3: yerel testte 1 / 10 / 50 yaratik.
- F6 / F7: bir kademe silah yukseltme / dusurme testi.

Oyun odaktayken fare imleci oyun icinde kilitli ve gizlidir. B/ESC menulerinde veya Alt+Tab ile baska pencereye gecildiginde serbest kalir. Oyuna donuldugunde tekrar kilitlenir.

## Kurallar

Baslangic bos alan ve beyzbol sopasidir. Silah yalnizca vakumla gercekten toplanan cesetlerle yukselir; oldurme ve kombo sayisi ayri tutulur. Varsayilan kademe hedefleri sopa 50, bicak 60, tabanca 70, Uzi 80, AK-47 90, pompali 100 ve roketatar 110 toplamadir; sonra alev makinesinde MAX olur. B > Oyun ayarlari > Silahlar altinda Ilk silah / toplanan (1-1000) ve her kademedeki artis (0-1000) ayarlanir. Artis sifirsa her silahta ayni hedef kullanilir. Hediye eylemleri bir kademe yukseltir veya dusurur; toplam oldurme silinmez. Ara ilerleme korunur, yeni hedef daha dusukse bir sonraki gercek toplamadan once otomatik yukselme olmamasi icin hedefin bir altina sinirlanir. Ust ve alt silah siniri asilmaz. Eski ayar alanlarinin adlari kayit uyumlulugu icin korunur; kullanicinin onceki hedefleri varsayilana zorlanmaz.

Otomatik oyun her acilista kapalidir; bir oturumda acik kalmasi yeni turlarda da devam etmesini saglar. Karakter fiziksel olarak hedefe yurur, kamerayi cevirir, secili silahin native hasar/animasyon/seslerini kullanir. Sadece en yakin yaratigi her kare secmez: mesafe ve bakis yonune gore yakindaki gruplardan hedef secer, hedefi bir sure takip eder, vurus aralarinda yan adim atar ve yeni hedeflere yonelir. Sopada gercek BaseballBat, bicakta Knife/Knife2 controller durumlari oynatilir; animasyon klibinin rig| adi controller durumu yerine kullanilmaz. Sopa hasari kendi gecikmeli temas coroutine'iyle verilir.

Otomatik vakum en az 100 ceset birikince baslar. Baslayan toplama turu, ceset sayisi 99'a dustu diye kesilmez; kalanlar da toplandiktan sonra yeniden savasa doner. 100'den az ceset, canli kalmasa veya tur bitse bile otomatik vakumlanmaz; yeni olumlerle 100'e ulasabilir veya oyuncu E ile istedigi zaman elle toplayabilir. Uzaktan toplanamayanlara fiziksel olarak yaklasir. Uretim makineleri kapali oldugu icin eski makine korumasi devre disidir. Native Suck icinde kalan sabit fabrika-tarafi filtresinin atladigi gorunur cesetler, manuel veya otomatik vakum aktifken fiziksel hizla ayni nozula cekilir; ancak nozula ulastiklarinda native OnGrabbed/toplama akisina girer. Duvar/kafes, menzil ve gorus acisi kontrolleri korunur. Tum yaratiklari bir komutla aniden silmez veya oldurme sayisi uydurmaz.

P tekrar basildiginda veya WASD ile manuel harekete gecildiginde kontrol oyuncuya doner. E de otomatik modu kapatip alet degistirir. B/ESC ve hapis/flash sirasinda otomatik hareket/ates bekler; kosul kalkinca devam eder. P ile otomatik oyun acildiginda hazirlik geri sayimi yoktur: hedef varsa hemen hareket/ates ve sureli gorev baslar. Panodan daha once baslatilmis hazirlik da atlanir; secilen gorev suresinin tamami korunur. Bos turu kendiliginden baslatmaz. Kurulu modeller, grafik kalitesi ve profil fotograflari degistirilmez.

Oyun sesi B > Oyun ayarlari > Genel'den ayarlanir. Windows Ses Karistiricisi oyunu ayrica sessize alabilir; bu durumda oyun ve ESC ses ayarlari acik olsa bile ses duyulmaz. 0.1.11 kontrolunde bu bilgisayardaki oyuna ozel Windows sesi 0 ve sessizdeydi; yalnizca oyunun sesi acildi. Mod kullanicinin Windows sesini kendiliginden degistirmez. Yerel audio-probe/audio-sample QA komutlari mikseri, kaynagi ve motorun gercek cikis sinyalini olcer; mikrofon kaydi yapmaz.

Yaratiklar oyuncuyu kovalar ve yakindan gorunur hamleyle saldirir. Baslangic cani varsayilan 500'dur; B > Oyun ayarlari > Savas'ta 1-1000 arasinda ayarlanir. Can ayari mevcut saglik oranini korur; sonraki tur yeni ust sinirla tam canla baslar. Normal yaratik maksimum canin %1'ini, Boss %30'unu, Big Boss %80'ini goturur: 500 canda 5/150/400 hasar. Kesirli hasar en az 1'e yukari yuvarlanir. Destekler de kendi maksimum canlari uzerinden hasar alir. Normal vurusun hazirligi .38 saniye, sonraki dinlenmesi varsayilan 1.2 saniyedir; Boss icin .65/2.4, Big Boss icin 1/3.6 saniyedir. Tam hamle ve yeniden hedefe erisme de toplam vurus araligina eklenir. Kalabaligin ayni anda tek karede oldurmemesi icin kabul edilen darbeler arasinda 0,7 saniye koruma vardir. Duvar arkasindan veya baska kattan temas hasari verilmez. Ayni sayfada saldirilar, normal hasar yuzdesi ve temel vurus araligi ayarlanir. Iki merdivenden ust kata cikma ve tekrar alt kata inme native fizik testleriyle kontrol edilir.

Yaratik boyutu ayni Savas sayfasinda %100-150 arasinda secilir; varsayilan %150'dir. Model ve carpismasi birlikte buyur. Havuza geri donup dogan yaratiklarda buyume tekrar tekrar carpilmaz. Olmus cesetlerin boyutu sonradan degistirilmez. Canli yaratiklara oldurmeyen darbeler geri kacma panigi veya itme baslatmaz; gercek hasar, isabet sesi/gorseli ve olum/ceset fizigi korunur.

### Begeni, Takip, Boss ve Destek

B > Eylemler sayfasinin en ustunde bagimsiz ac/kapat, eylem secimi, miktar ve test tusuyla begeni/takip satirlari bulunur. Begeni esigi varsayilan kisi basina 100'dur: 99'da eylem olmaz, her tamamlanan 100'de tekrarlanir, artan begeniler sonraki esige kalir. Farkli izleyicilerin begenileri birlestirilmez. Takip ayni yayin odasinda kisi basina bir kez calisir. Yeni tur bu sayaclari silmez; yeni yayin odasi siler. Esik degistirilirse eski kismi begeniler sifirlanir. Native mesaj kimlikleri yinelenen olaylari engeller; v1/v2 likeCount ve v3 count alanlari desteklenir, toplam yayin begenisi kisiye yazilmaz.

Hediye eylemlerinde Boss %400, Big Boss %650 ve Destek / 20 can eklenmistir. Eski hediye ID'leri, adetleri ve kullanici secimleri korunur; yeni eylemlerin hediyesi ilk basta bostur. Boss 120, Big Boss 240 canlidir; boyutlari normal boyut ayarindan bagimsizdir. Hareket eden devlerin yakin adimlari kisa, mesafeyle azalan kamera sarsintisi yapar; menu/duraklamada calismaz ve kamerada kalici kayma birakmaz. Devler de gercek fiziksel carpismaya tabidir, dar gecitlerden bedenlerini geciremezler.

Destek karakteri silindir cubuk yerine oyunun kendi kaplamali sopa meshlerini gorunur eldivenli tutusta tasir; bilek ve onkol hamleyle birlikte hareket eder. Bu modeller GPU animasyonlu oldugu ve native el kemigi bulunmadigi icin yalnizca desteklerde yerel el/tutus noktasi kullanilir. Dusmanlari kovalayip 6 hasar verir. Dusmanlar da yakindaki desteklere saldirabilir. Destek yalnizca 20 canlidir; oyuncuya vurmaz, oyuncunun silahlari da dost atesi yapmaz. Ayni anda en fazla 12 destek bulunur. Destegin olumu dusman oldurme sayisina, vakumlanmasi silah ilerlemesine eklenmez; otomatik vakumun 100 dusman bedeni esigini de doldurmaz. Yeni turda canli destekler temizlenir; cesetler vakumu bekler, sopa nesneleri havuzdaki baska yaratiga sizmaz.

Gorunen canli yaratiklarin ustunde sayili can barlari bulunur; normal turkuaz, destek yesil, Boss amber, Big Boss kirmizi renkle ayrilir. Az canda bar kirmiziya doner. Etiket yerlestirmesi 0.1.19'daki oncelikli/cakismasiz butceyi kullanir; HUD ve hediye balonu alanlari korunur. Oyuncu hasarinda iki kenarda yaklasik .9 saniye iceri dogru sonen belirgin kirmizi efekt gorulur. Hediye balonu sol ustte, sureli modda gorev panelinin altinda belirir ve dort saniye sonra kaybolur.

Yeni yaratiklar oyuncunun bulundugu katta on taraftaki daginik alanda dogar (4,5-12,5 metre hedef, navigation orneklemesi icin 4-13,5 metre tolerans). Duvar, pano arkasi, kafes ici, dolu hacim ve baska kat reddedilir. Alan doluysa yeni katilimcilar kuyrukta bekler; ust uste dogurma yapilmaz. Yuksek/desteksiz bir noktada da guvenli yer bulunana kadar kuyruk korunur.

Can gostergesi alt ortadaki krem pahli plaka, kalp/koruma simgesi ve egik bolmeli barla gosterilir. Eski stamina gostergesi gizlenmistir. Ust ekipman basliginin ortasinda TikMnG vardir; eski oyun adi kaldirildi. Sag ustte yalnizca CANLI YARATIK basligi ve gercek canli sayaci bulunur. Sol ust gorev yalnizca sureli modda gorunur. Profiller bu uc HUD alaninin ustune cizilmez.

Son darbe oyuncuyu oldururse merkezde yalnizca o darbenin sahibinin profili ve kullanici adi gosterilir. Daha sonra gelen darbeler kisiyi degistirmez. Bes saniye sonra yeni tur ve ayarlanmis tam canla devam edilir; yenilgi bir win dusurur. Buyuk fotograf icin gercek yuksek cozunurluklu kaynak onceliklidir; yalnizca kucuk kaynak varsa yapay ayrinti uydurulmaz. Oyun acilisinda ve yeni turda iki saniye ilk darbe korumasi vardir.

Hapiste oyuncu kafesin icinde yuruyebilir; duvar ve tavan disari cikmayi engeller. Yaratiklar kafesin disinda kalir ve sure bitene kadar oyuncuya hasar veremez. Sure bitince normal takip/saldiri devam eder. Panonun altindaki aciklik fiziksel zeminle kapatilmistir.

Olu yaratiklar oyunun kendi vakum fizigi ve sesleriyle toplanir, depolanmadan temizlenir. Konserve uretimi, satis, otomatik kamyon dalgalari, asansor baslangici ve gece-gunduz dongusu devre disidir. Demo fabrika meshleri CPU'da okunamadigi icin savas yolu dogrulanmis zemin kutulari, gercek merdiven rampalari ve ust platformdan uretilir. Eski bolucu/makine yol engelleri kaldirilir; pano ve gecici kafes korumalari korunur.

Ek vakum taramasi 14 oyun birimiyle sinirlidir; cekis kuvveti ve tasima hizi artirilmistir. Native vakum ayrica kendi taramasini yapar ve bazi durumlarda 18 birimden de cekebilir; toplam sistem icin kesin 14 birim siniri iddia edilmez. Orijinal duvar/engel kontrolleri korunur.

Serbest modda son canli yaratik oldugunde 10 saniye sayilir. Yeni yaratik sayaci iptal eder. Sure sonunda bir win kazanilir, ardindan canli katilimcisi olmayan yeni tur ve sopa ile devam edilir. Yerdeki cesetler yeni turda da kalir. Ilk acilista bos arena kazanma sayilmaz. Menuler acikken geri sayim durur.

WINNER veya SURE DOLDU ekranindaki dort saniyede gelen eslesmis hediye eylemleri kaybolmaz. Yaratiklar gonderenin kimligi ve adediyle sonraki tura alinir; silah yukseltme/dusurme sirasi yeni turun baslangic silahina uygulanir. Gelen dalga sonuc ekraninin altinda gosterilir. Sonraki turda bir kez uygulanir, yeniden sifirlamak ayni hediyeyi tekrarlamaz. Toplam yaratik siniri sonraki tur icin de gecerlidir. Sureli gorevde otomatik oyun kapaliysa yeni tur panodan baslatilir; otomatik aciksa sonraki dalgada hazirlik beklemeden devam eder.

Ust ortadaki silah gostergesi eldeki aleti, siradaki silahi ve o kademenin toplama hedefini gosterir. Hedef tamamlaninca silah ilerler ve cubuk yeni kademe icin sifirlanir. Son silah olan alev makinesinde MAX gorunur. Vakuma gecmek silah ilerlemesini silmez. Nozula ulasip native yakalama akisindan gecen her ceset icin bir toplama sesi calar; bos vakum veya sadece oldurme bu sesi ve ilerlemeyi uretmez. Ayni karede cok sayida toplamada ses kazanci azaltilir.

Gostergede kademe ilerlemesi `00 / 50`, toplam oldurme sayisi ise ayri satirda gosterilir. Dokuz yerel yaratik modeli karisik gelir; normal yaratiklarin baslangic cani 12'dir. Yururken modelin bakis yonu hareket yonune duzeltilir.

Bu modda tabanca, Uzi, AK-47, pompali, roketatar ve alev makinesinin mermisi/yakiti otomatik yenilenir. Ates etmeye devam etmek icin ceset toplamak veya E ile alet degistirmek gerekmez. Onceki surumde native muhimmat bitince ates kesiliyordu; vakumdan geri donmek `ApplyWeapon` uzerinden muhimmati yeniledigi icin toplamayla baglantili gorunuyordu. E yalnizca vakum/silah secimidir. Hapis sirasinda silah kullanimi hala engellenir.

## Kombo, Hediye Balonlari ve Tur Ozeti

Uc saniye icinde art arda gercek oldurmeler kombo olusturur. Ekranin altinda kucuk, acik renkli bir oyun konusma balonu belirir; seri kesilince yumusakca kaybolur. On, 25, 50, 100 ve sonraki yuzluk esiklerde seyrek kisa ses vardir. Kombo hasari veya silah ilerleme kurallarini degistirmez.

Hediye balonu da alt bolumdedir: gonderenin profil fotografi, katalogdaki gercek hediye gorseli, tekrar sayisi ve gercekte kabul edilen eylem miktari gosterilir. Dolu sinirda gercekte eklenmeyen yaratiklar eklenmis gibi yazilmaz. Uzun adlar sigacak sekilde kisaltilir. Kisa giris/cikis animasyonu ve dort saniyelik gorunum kullanilir; nisan ve stamina alani acik kalir. Yerel denemeler TEST olarak etiketlenir. En fazla sekiz bekleyen bildirim saklanir; bu gorsel sinir hediye eylemlerini azaltmaz. Sonuc ekraninda gelen bildirimler sonraki tura ertelenir. Profil gelene kadar yer tutucu kullanilir.

B > Oyun ayarlari > Yayin'da kombo, hediye bildirimleri ve tur sonu ozeti ayri ayri kapatilabilir. Ayri vakum yan hedefi 0.1.13'te kaldirildi; toplama ilerlemesi silah gostergesinde bulunur. Otomatik vakumun sabit 100 ceset esigi degismedi. Eski yan hedef ayarlari kayit uyumlulugu icin korunur, ekranda ikinci hedef uretilmez.

WINNER/SURE DOLDU ekraninda gercek oldurme, toplanan ceset, en iyi kombo, ulasilan en yuksek silah, tur suresi ve win skoru gorulur. Sonuc bir kez kaydedilir; daha sonra gelen hediye veya degisen ayar onu yeniden yazmaz. B > Yayin > Son tur ozeti ile ayni oturumdaki sonuca tekrar bakilabilir. Yeniden acilista tur istatistikleri sifirdan baslar.

## Kan Rengi ve Isabet

B > Oyun ayarlari > Gorunum altinda Kan acik kutusu kapatilabilir. Kapaliyken tum renklerde kan parcaciklari, zemindeki kan izleri ve kanli hasar bolgeleri gizlenir; yeni kan uretilmez. Gercek silah isabetlerinde bunun yerine seyrek kucuk sari impact/kivilcim gorulur. Kan yeniden acilabilir; renk secimi korunur.

Ayni yerde Kirmizi, Pembe, Kahverengi, Turuncu, Beyaz ve Siyah secilebilir. Secim kan sicramalarina, yerdeki izlere ve yaratiklarin hasar bolgelerine uygulanir; yaratiklarin ana renklerini degistirmez. Kaydet, Oyuna don veya B ile kapatildiginda ayarlar saklanir.

Beyaz kanin malzeme yogunlugu ve isima/parlakligi azaltildi; fabrikanin genel isik ve bloom ayarlari degistirilmedi. Tur sonucunda ve tur sifirlaninca butun renklerdeki zemin/yaratik kan izleri temizlenir. Temizlenmis eski cesetler tekrar kan izi uretmez; cesetlerin kendileri yerinde kalir.

Isabet isareti ayni sayfadan acilip kapatilabilir. Ortadaki kucuk arti yalnizca takip edilen bir yaratigin cani silahla gercekten azaldiginda kisa sure belirginlesir. Iskada veya sifir hasarda yanmaz; oldurmede amber renkle onay verir.

## Kayitlar ve Katalog

Hediye eslestirmelerini Eylemler ekraninda Kaydet ile saklayin. Kayitlar `userdata/mod-settings.json` dosyasindadir. Orijinal oyun kaydi kullanilmaz; modun oyun kayitlari da `userdata/` altindadir. Katalog mevcut TikMnG katalogundan alinan 905 benzersiz hediye ID'si ve yerel gorsellerini icerir, coin degerine gore siralanir.

Eylemler ekraninda satir eklenip X ile tamamen silinebilir. Turleri Yaratik gonder, Flash, Hapse at, Hapisten kurtar, Silah yukselt ve Silah dusur'dur. Her satirin hediye ID'si ve adet/saniye/kademe degeri ayri saklanir. Birden fazla satira ayni ID atanirsa hepsi uygulanir. Sayfalar arasinda eklenen satirlar tekrar acilista kaybolmaz. Eski bes satir korunur; ilk geciste flash/hapis/kurtarma satirlari eslesmemis olarak eklenir, silindiklerinde tekrar eklenmezler.

Flash yapilandirilan saniye boyunca gorusu beyaza tasir; varsayilan satir 3 saniyedir. Ilk 0,42 saniye genisleyen kisa darbe/patlama iziyle beyaza gecis, sonunda kisa yumusak geri donus kullanilir. Bir darbe ve dusuk seviyeli cinlama sesi bir kez calar; sure sayaci ekranin ortasinda koyu metinle gorulur. Hapis sayaci da ekranin ortasindadir. Ikisi ayni anda etkinken sureler ust uste binmeden alt alta gosterilir.

Hapis satirinin varsayilani hediye basina 1 saniyedir. 100 hediye 100 saniye ekler; 50 adet, 1 saniyelik kurtarma hediyesi 50 saniye dusurur. Oyun oynanirken gecen gercek sure ayrica azalir. Ayar 2 saniye yapilirsa bes kurtarma hediyesi 10 saniye dusurur. Kurtarma sifirin altina inmez veya gelecege kredi biriktirmez. Menulerde sureler durur. Kafesin duvarlari carpisma ile kapalidir, silah ve vakum devre disidir; canli yaratiklar kafes disinda tutulur. Serbest kalinca onceki silah/vakum secimi geri gelir. Hapis ve flash yeni tur baslarken keyfi sifirlanmaz.

## Marka Kaplamalari

Iki buyuk reklam panosunda TikTok motifli TikMnG gorseli kullanilir. Beyzbol sopasi ve vakumda ek levha veya havada duran yazi yoktur; marka yalnizca bu iki aletin ozel renk haritasi kopyasina islenir. Orijinal model, UV, normal haritasi, shader ve diger silahlar degistirilmez. M mavi, n siyah, G kirmizi; Tik koyudur. Vakumdaki kucuk yazi beyaz yan paneldedir; sopanin gorunen yuzundeki UV aynalamasi ayrica duzeltilir. Steam'deki asil dosyalara yazilmaz.

## TikTok Baglantisi

B > Yayin ve test ekranindan TikTok yayin kullanici adi girilip Yayina baglan secilir. Ayri Node baglanti islemi oyunla birlikte baslar ve kapanir; yayin sahibi hesaba bu panelde giris yapmak zorunda degildir. Yayin kapaliysa bekleme ve yeniden deneme durumu gosterilir. Bilerek Baglantiyi kes secilirse sonraki acilista otomatik baglanilmaz.

Hediye tetikleme yalnizca gercek sayisal hediye ID'si ile yapilir. Eylemler ekraninda her satira katalogdan bir hediye atanabilir; atanmis hediye ve adetler kaydedilir. Seri hediyeler tamamlandiginda tek olay olarak, gercek tekrar sayisiyla uygulanir. Yeniden baglantida eski olaylarin tekrari engellenir. Eslesmeyen hediyeler yeni bir ID uydurularak tetiklenmez; panelde sayaci ve son hediye bilgisi gorulur.

Gercek yayin profil fotograflari guvenli CDN indirmesiyle 256 piksel PNG onbellegine alinir, yaratik ustunde yuvarlak olarak gosterilir. Fotograf gelene kadar yer tutucu kullanilir. Yerel eylem testindeki isimler ve simgeler canli yayindan geldigi iddiasi tasimaz. Canli baglanti, avatar indirmesi ve hediye eylemi ayri test edilmelidir; yayina baglanilmasi tek basina gercek bir hediyenin test edildigi anlamina gelmez.

Yaratiklarin ustunde kullanici adi yazisi gosterilmez. Yumusak kenarli yuvarlak profil fotografi ve can etiketi gosterilir; 256 piksel kaynak oyun icinde 128 piksel dokuya alinir. 0.1.19'da oncelikli, ekrana sigan cakismasiz bloklar kullanilir. Fotografin baglandigi nokta modelin basinin uzerindedir. Yerel yaratigin modeli, kaplamasi veya grafik kalite secenegi bu degisikliklerle degistirilmez.

## Meydan, Sayac ve Sure

Ortadaki uretim makinesi gizlidir, altindaki aciklik oyunun kendi zemin kapagiyla kapatilir. Yaratik dogumlari oyuncunun katindaki yakin ve fiziksel engel kontrolunden gecen zeminlerde yapilir; farkli kattaki oyuncunun altinda dogum yapilmaz. Girisler kisa bir havalanma, kucuk yerel impact/toz efekti ve dusuk sesli pop ile dagilir. Alevli patlama kullanilmaz; her 0,65 saniyede en fazla bir giris efekti ve pop sesi calar. Silahlarin kendi patlama efektleri degistirilmez.

Sag ustteki sayac sahadaki gercek canli sayisini dijital saat tipi yedi segmentli rakamlarla gosterir. Sirada bekleyenler buyuk sayiya eklenmez. Kompakt 276x80 piksel alan, CANLI YARATIK basligi ve nane yesili rakamlar kullanir; tur, mod ve ikinci saat kaldirilmistir. Yeni canli kabul tavaninin tamami 2.500'dur; ustundeki hediye dalgalari kuyrugu sinirsiz buyutmez. Olduruldukce ve yakin alanda bos yer acildikca siradakiler sahaya girer; kuyruk bilgisi B panelinde gorulur. Oldurme sayisi yalnizca gercek yaratik olumleriyle artar.

Yuruyen yaratiklar arena kenarina geldiklerinde aniden merkeze veya sinira tasinmaz. Savas acikken ayri Unity NavMesh yol agi oyuncunun katina uygun merdiveni bulur; eski zemine-ozel yukseklik siniri uygulanmaz. Yol hesaplari kare basina sinirlidir, hedef hareket ettiginde yeniden hesaplanir. Fiziksel duvarlar, korkuluklar ve yercekimi korunur. Rigidbody interpolasyonu hareket goruntusunu yumusatir. Yalnizca gercekten dunyanin cok altina dusme halinde acil kurtarma kalir. Yakin dogum alani doluysa kuyruk bekler; yuruyen yaratiklar buna yer acmak icin tasinmaz.

Serbest mod varsayilandir. Sureli mod secilince ayri gorev alaninda dakika/saniye (toplam 1-3600 saniye), oldurme hedefi ve win hedefi secilir. Otomatik oyun kapaliysa ilk dalga veya ilk vurus sayaci kendiliginden baslatmaz. Panonun BASLAT dugmesi 10 saniye hazirlik baslatir; ardindan gorev suresi ilerler. P ile otomatik oyunda hazirlik atlanir, ilk gercek oldurme goreve sayilir. Sure bitmeden hedef tamamlanirsa WINNER ve +1 win; sure dolarsa -1 win verilir. Skor negatif olabilir. Win hedefi bir esiktir, ust sinir degildir; 25 hedefinden 26'ya devam edilebilir. Skor oturum icindir, uygulama yeniden acilinca sifirdan baslar. Menulerde sure durur. Dort saniyelik sonuctan sonra otomatik oyun kapaliysa yeni tur elle baslatilmayi bekler. Cesetler temizlenmez.

Isaretlenen orta boru agzindaki pano ile sol ust gostergesi ayni sureyi, oldurme ilerlemesini ve win skorunu gosterir. TikMnG logosu ustte ortadadir; Creature Arena yazisi yoktur. Panoya nisan alip sol tikla Serbest/Sureli, dakika/saniye, oldurme hedefi ve win hedefi ayarlanabilir. Panoya sopa veya mermi isabeti de sureli gorevi baslatir; ayar dugmelerine vurus yanlislikla baslatmaz. Otomatik oynanis da ayni gorev baslatma yolunu kullanir. Gorev basladiktan sonra pano ayarlari kilitlenir; B'den tur sifirlanabilir. Ayarlar kalici kaydedilir, imlec oyun disina cikarilmaz.

Panodaki WIN - / WIN + dugmeleri kazanilmis skoru duzeltir. Ust satirdaki ayri - / + dugmeleri yalnizca hedefi degistirir. Skor hedefin ustune cikabilir ve eksi olabilir; manuel duzeltme turu kazanilmis saymaz veya hedefi degistirmez. Yaratik testi icin yeni pano dugmeleri bu surume eklenmedi; F1/F2/F3 testleri korunur.

Pano duvarin iki yanindaki gercek yuzey olculerek duvara 5 cm mesafede monte edilir; ince kapali kasa aradaki boslugu kapatir. Panonun icinden gecen eski buyuk borunun goruntusu gizlenir, carpisma parcasi da panonun gerisinde kalir. Pano tasarimi, diger fabrika nesneleri ve orijinal oyun dosyalari degistirilmez. `qa/board-mount-tests.cjs` duvara yakinligi, on/yan goruntuleri, gercek kamera isinlariyla dugmeleri ve native sopa/mermi baslatmasini denetler.

Panonun alt sagindaki DURDUR dugmesi hem hazirlik hem aktif gorev sayacini oldugu saniyede durdurur. Dugme DEVAM ET olur; tekrar tiklaninca kalan sure kaldigi yerden ilerler. P durdurulmus gorevi sifirlamaz veya kendiliginden devam ettirmez. Yalnizca sayac durur: oyun, hediye akisi ve aktif gorevdeki gercek oldurme ilerlemesi devam eder. Hedef bu sirada tamamlanirsa normal win verilir. Yeni turda durdurma durumu temizlenir; bekleyen veya bitmis gorevde dugme kapalidir.

Cesetler oldukleri yerde yerel fizik ve carpismalariyla birikir. Yas, adet, yeni dalga, kazanma veya tur yenileme nedeniyle kendiliginden silinmez ya da canli yaratiga donusturulmez. Yalnizca E ile vakuma gecilip sol tikla gercekten toplandiklarinda kaldirilirlar. Zeminin altina yanlislikla dusen ceset silinmez, son guvenli zemin konumuna geri alinir. Cok buyuk ceset yiginlari fizik ve bellek maliyetini artirabilir; bir milyon toplami destekleyen kuyruk sistemi, bir milyon eszamanli ceset garantisi degildir. Oyun kapatilinca sahne sonlanir; cesetler uygulama yeniden acilisina kaydedilmez.

## Teknik

- Unity 6000.2.15f1 / IL2CPP; MelonLoader 0.7.3.
- Oyun kopyasi ve mod kaynaklari D: diskindedir. .NET 6 calisma zamani yalnizca bu klasore kuruludur; sistem .NET kurulumu degistirilmedi.
- `build.ps1`: kaynaklari derler. `tests/Rules.Tests.csproj`: saf kural testleri.
- `qa/hud-controls-tests.cjs`: ayarlanabilir can, model/carpisma boyutu ve havuz yeniden kullanimi, oldurmeyen darbede kacmama, egilme/tavan guvenligi, alt/ust katta bes metre dogum, gercek pano isinlariyla ayri skor/hedef ve 800/1280 HUD/bildirim yerlesimi.
- `qa/chase-tests.cjs`: eski gorunmez bolucuyu gecme, her iki merdivenle ust platforma fiziksel takip/saldiri ve oyuncuyu yeniden alt kata takip. Isinlanma kurtarmasi kullanilmadigini kontrol eder.
- `qa/survival-crowd-tests.cjs`: 300 yerel yaratikla takip hesaplari, kafes korumasi ve on saniyelik kare suresi olcumu. Bu, 2.500 yaratikta performans garantisi degildir.
- `qa/survival-tests.cjs`: temas hasari, fiziksel duvar, kafeste yurume/korunma, serbest kalma, son darbe sahibinin 512px kaynakli portresi, yeni tur ve otomatik oyun kontrolleri. Profil fixture'i onbellekteki gercek fotografla yerel testtir; satin alinmis canli hediye testi degildir.
- `qa/original-portrait-tests.cjs`: gercek buyuk kaynak secimi, kimlik dogrulamasi, eski kanal iptali ve kucuk resmi buyuterek sahte ayrinti uretilmemesi.
- `qa/floor-vacuum-dash-tests.cjs`: pano tabani, iki bolgeden manuel toplama, 25 metre yatay/yukari atilma ve duvar/tavan/zemin duruslari.
- `qa/vacuum-progression-tests.cjs`: oldurmenin silahi yukseltmemesi, sekiz fiziksel toplamada esik/ilerleme ve her cesette tek ses, bos vakumda tekrar sayilmama, yan hedefin kaldirilmasi, 800/1280 HUD ve ayarlarin geri yuklenmesi. 2026-11-01 devam kontrolunde dort native kontrol grubu ve 139 saf kural kontrolu gecti.
- `qa/smoke.cjs`: gercek oyun nesneleri uzerinde yerel otomatik test; bir test turunda kontroller kisa sure kilitlenir, en gec 100 saniyede kilit kendiliginden kalkar.
- `qa/challenge-tests.cjs`: 2.500 kabul tavani, fiziksel pano dugmeleri, native mermi/sopa baslatmasi, P ile ortak 10 saniye, signed win, tekrar manuel baslatma ve 800/1280 gorunumleri.
- `qa/pause-tests.cjs`: panodaki gercek durdur/devam ray isabeti, hazirlik/aktif sayacini dondurma, P ile sifirlanmama, devamda kalan sure ve normal zaman asimi.
- `qa/catalog-list-tests.cjs`: tekerlek/kaydirma cubugu olaylari, ilk/son coin, arama/bos sonuc, 800/1280 liste gorunumu, secimi iptal ve eylem adedini koruyarak gercek ID kaydi/hediye tetiklemesi.
- `qa/blood-profile-tests.cjs`: alti renkte tur sonu kan temizligi ve ceset koruma, 300 yerel yaratikta onbellekteki gercek profil dokulari ve kare suresi olcumu. Yeni gercek yayin testi olarak sunulmaz.
- `qa/combat-tests.cjs`: alti kan rengi, kalici kayit, iki ekran boyutunda B ayarlari ve gercek hasarda isabet isareti testleri.
- `qa/round-gifts-tests.cjs`: sonuc ekraninda gelen kayitli hediye eylemlerinin yeni tura bir kez aktarilmasi, karisik silah eylemi sirasi ve sureli modda tam on saniyelik kazanma sayimi. Test eslestirmeleri ve ayarlar sonunda geri yuklenir.
- `qa/corpse-tests.cjs`: 64'u asan ceset birikimi, zemine geri alma, kazanma/manuel/sureli tur gecisinde koruma, havuza geri donmeme ve gercek vakumla temizleme. Test komutunun ozel temiz sifirlamasi disinda tur yenileme cesetleri kaldirmaz.
- `qa/effects-tests.cjs`: alti renkte kansiz mod, sari isabet efekti, tam beyaz flash piksel kontrolu, hediye adediyle artan/azalan hapis suresi, kapali kafes ve dinamik eylem ekleme/silme. Sonunda eslestirmeler ve ayarlar geri yuklenir.
- `qa/live-connected-tests.cjs`: var olan canli hesabi veya eslestirmeleri degistirmeden gercek profil dokusunun render edilmesi, sentetik hediye IPC'si ve tekrar engelleme. Profil yaratiklari yerel testle dogar; gercek satin alinmis hediye iddiasi tasimaz.
- `qa/bridge-tests.cjs`: baglanti sozlesmesi, kimlik, seri hediye, tekrar engelleme, yeniden baglanti, avatar guvenligi ve gercek SDK/PNG donusumu testleri.
- `qa/menu-visual-tests.cjs`: dort B sekmesi, eylem ekleme/sayfalama ve dort ayar gorunumu; 1280x720 ve 800x600'de 18 yerel ekran goruntusu.
- `qa/audio-keyboard-tests.cjs`: 0.1.11'e ait eski P/G ve ses regresyonudur; sekiz yaratikta otomatik vakum beklentisi 0.1.12'deki 100 esigiyle degistirilmistir. Fiziksel P/P/G ve Windows ses gozlemi gecmis raporda saklidir.
- `qa/highlights-tests.cjs`: gercek olum/kombo, B'de durma, kazanma/zaman asimi ozeti, kapatilabilir yan hedef, hediye miktari/tekrar engelleme/kuyruk, kayit koruma ve 800/1280 gorunumleri.
- `qa/bubble-batch-tests.cjs`: alt balonlarin yerlesimi ve kaybolmasi, otomatik oyunda hazirlik atlama, 99 cesette vakum yapmama, 100'de baslayip tum partiyi fiziksel toplama, yeniden savasa donme ve esikten bagimsiz manuel vakum.
- `qa/crowd-performance.cjs`: 0/300/400/500 yerel canli yaratikla 15 saniyelik gercek kare suresi olcumleri; orijinal kalite, donanim, odak, GC ve bellek bilgisi raporda saklanir.
- `qa/profile-crowd-tests.cjs 1000`: istenen gercek yayindan gelen fotograflarla 1.000 canli yaratik, ayrica 450 ceset birikimi ve kansiz mod. Yerel kalabalik testidir; bu kadar gercek hediye satin alindigi iddia edilmez.
- `qa/requested-live-tests.cjs`: kullanicinin verdigi bes hesap icin izole salt-alici TikTok baglanti/profil/hediye gozlemi. Oyundaki eylem uygulamasindan ayri kanittir.
- `qa/effect-presentation-tests.cjs`: 100-50 hapis suresi, ortadaki sayaclar, flash'in beyaza gecisi/native ses oynatimi ve alti silahin vakumsuz muhimmat yenilemesi. Gercek fareyle uzun ates kaydi degil, native durum/eylem testidir.
- `qa/crowd-5000-tests.cjs`: 5.000 fiziksel hedefi gercek nesnelerle doldurmaya calisan, RAM'i takip ederek guvenli seviyede duran stres testi. Bu makinedeki sonuc basarili tam-5.000 olarak isaretlenmedi. Ayrica ani hareket ve dusme kurtarmalari olculur.
- `qa/memory-guard-tests.cjs`: zorlanmis dusuk bellek durumunda kuyrugun korunmasi ve koruma kalkinca 1.200 gercek yaratigin kayipsiz sahaya gelmesi.
- Ilk mod altyapisi olusumu bu bilgisayarda tamamlandi. Oyun surumu degistiginde uyumluluk yeniden test edilmelidir.
- Orijinal oyun dosyalari bu ozel test icin kopyalandi; orijinal oyun dosyalari yayinlanmamalidir. Daha sonraki launcher dagitimi yalnizca kendi mod dosyalarimizi ve izinli bagimliliklari icermelidir.

Bagimliliklar: [MelonLoader](https://github.com/LavaGang/MelonLoader) (Apache-2.0), [StbImageSharp](https://github.com/StbSharp/StbImageSharp) (MIT), tiktok-live-connector 2.4.4 ve sharp 0.34.5 (kilitli bridge paket dosyasina bakiniz). Oyun ve orijinal oyun varliklari LuisDev'e aittir.
