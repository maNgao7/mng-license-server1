# TikMnG CAAAHR! Sesli Surus Beta 0.6.10

## 0.6.10 (Guncel)

- O tusu ses ile WASD arasinda gecis yapar. Klavye modunda W ileri, S geri,
  A/D direksiyon; tus birakilinca gaz sifirlanir ve arac frenler. Otomatik
  ilerleme yoktur. Ses bu modda kendiliginden araci hareket ettirmez.
- Ortadaki bagir yazisi yalnizca ses modunda dururken yanip soner. Hareket,
  konusma, kafes, patlama, menu ve bitis sirasinda gizlenir.
- Lav parkuru kaldirildi. Ayarlanabilir 100-5000 m duz parkur kalir.
- Kavsak basina alti arac, sabit hizli gidis-gelis ve gorus disinda kapali
  tunel icinde geri donus. Uzakta gorunen trafik de donmaz. Guvenli gecis
  araliklari ve B ile duraklama korunur. Engel govdeleri celik takviyelidir.
- 14 eylem vardir: patlat, basa dondur, ileri, geri roket, bitise isinla,
  lastik sok, kafes, kafesten kurtar, turbo, yavaslat, ters direksiyon,
  hortum, karsidan arac ve yumurta. Kaldirilan eski eslesmeler kapali saklanir.
- Patlama duman/kivilcim ve dort eksik lastikle surelidir (varsayilan 10 sn).
  Sure sonunda arac ayni yerde toparlanir. Lastik hediyesi ayri sure tutar;
  daha uzun lastik hediyesi patlama bitince erken onarilmaz.
- Kafes ustunde geri sayim vardir. Kafesten kurtar, ayarlanan saniyeyi
  sayactan duser; sifirda acilir. B menusunde kafes/hasar sureleri durur.
- Standart GG (6064) kafese 1 saniye ekler; IceCream (5827) 1 saniye
  azaltir. Yeni kayit ve ilk cevrimdisi acilis ayni standartlari kullanir.
  Kayitli ozel eslesmeler ve sureler korunur; standartlari yeniden uygulamak
  mevcut kurallar icin onay gerektirir.
- Turbo surerken destek verir; ileri/geri hediyesi metre bazli itistir.
  Geri hediyesinde on roketler gorunur, normal carpisma geri gelir.
- WIN hedefi daha buyuk ve kontrastli, kutusuz olarak gosterilir.

Bu surum yalnizca yerel test oyununa kurulur; genel launcher yayini yapilmaz.
Asagidaki surum notlari gecmis davranislarin kaydidir; guncel kurallar usttedir.

## 0.6.9

- 17 eylem: el freni, buzlu lastikler ve ziplayan suspansiyon katalogdan
  kaldirildi. Eski hediye baglari silinmeden devre disi tutulur.
- Lastik hediyeleri ayni taraftaki on/arka lastikleri sirayla, sonra diger
  tarafi soker; tamir veya sure sonu hepsini geri getirir.
- Kalas yalnizca aracin seridine gelir. Buyuk kamyonlar ve genis yan yollar,
  uygun kavsaklarda dort aracin dondugu donel kavsak eklendi.
- Lav Parkuru gercek platform bosluklari, rampalar ve dusme kurtarmasi sunar.
  Her iki ozel parkur 100-5000 metre ayarlanir. Demo harita menude gosterilmez;
  orijinal oyun dosyalari ve lisans kilitleri degistirilmez.
- Bitiste 10 saniye beklenir. Bu arada engelleyici hediye kazanmayi bozarsa
  -1 win; sure tamamlanirsa +1 win ve ardindan yeni tur. Kalkan hediyeyi
  engellerse geri sayim bozulmaz. B menusu sayaci durdurur.
- Win hedefi klavye veya 10/20/30/50 kisayollariyla ayarlanir. Win sayisi
  yerel wins.txt dosyasinda saklanir ve negatif olabilir.
- Saydam mesafe/win gostergesi, sol altta yesil mikrofon seviyesi, ibreli hiz
  gostergesi ve ortada ILERLEMEK ICIN BAGIR yazisi. Konusurken sabit,
  sessizlikte yanip soner; otomatik surus/menu/bitiste gosterilmez.
- Varsayilanlar: %25 hassasiyet, 139 km/sa, %50 oyun sesi, Windows mikrofonu.
  Bu oturumda kullanicinin istedigi ses ayarlari mevcut kayda da uygulandi;
  hediye kurallari korundu. Daha yuksek hassasiyet kisik sesi daha kolay algilar.
- Pencereli acilisi yerel oyun ayarlari gecersiz kilarsa sinirli yeniden
  uygulama yapilir. Tam ekran ve kenarliksiz secimleri ayri korunur.

Yeni yerel motor testi: --tikmng-revision-smoke. Gercek canli yayin hediyesi
ayri dogrulanmalidir; bu test kontrollu komutlar ve ses seviyeleri kullanir.
Genel launcher guncellemesi bu beta ile otomatik yayimlanmaz.

## 0.6.8

- Duz yol 28 metreye genisledi: dort serit, uc ayirici cizgi, dort baslangic yeri.
  Rampalar, bariyer acikliklari ve yol kenari elemanlari yeni genislige uyarlandi.
- Aralikli alcak atlama engelleri eklendi. Bunlar otomatik ziplatmaz; Bosluk ile
  uzerlerinden atlamak gerekir. Eski hareketli engellerden ve rampalardan ayridir.
- Dag gecitlerinden gelen yan yollar ve iki yonlu trafik eklendi. Kavsaklarda
  uyarici isiklar ve gecise uygun bos zaman araligi vardir. Parkur uzadikca
  kavsak sayisi artar; her yerde veya rampanin ustunde kavsak olusmaz.
- Trafik arabasina carpmak arabayi baslangica dondurur. Kalkan bir carpismayi
  engeller. Eski yumusak engellerin 10 metre geri atma cezasi korunur.
- Iki yeni hediye eylemi: Dort seride kalas gonder ve Karsidan araba gonder.
  Kalaslar her seritten yuvarlanarak gelir; karsi arabanin hizi ayarlanabilir.
  Yeni eylemler icin hediyeyi kullanici secer; eski eslesmeler degistirilmez.
- Kuslar sivrilen tuy kanatlari, bas, gaga ve kuyrukla yeniden modellendi.
  Yumurta hediyesinde once kus ucar, yumurtayi kameraya birakir, sonra beyaz/sari
  iz ekrana yayilir. Kayitli sure yumurta izinin ekranda kalma suresidir.
- B menusu acikken yeni trafik ve hediye engelleri de hareket etmez.

## 0.6.7

- Tribundeki izleyicinin ustunde kullanici adi ve yuvarlak profil fotografi
  gosterilir. Canli olayda gelen en buyuk fotograf secilir; WebP dahil kaynaklar
  256 piksel PNG'ye donusturulur. Kaynak fotograf dusuk cozunurlukteyse yapay
  ayrinti uretilmez. Fotograf gelmemisse gecici siluet kullanilir.
- Adlar ve profiller gercek oyun kamerasina doner; ters yazi sorunu giderildi.
  Fotograf indirme, bellek ve tribun koltuk sayilari sinirlidir.
- Yan ruzgarda eski mavi cizgiler yerine renkli yapraklar ucusur; sag/sol
  savrulma korunur. Yakindaki kuslarin kanat hareketi ve boyutu belirginlestirildi.
- Hortumla geri savur: mesafesi ayarlanir; araba yukari kaldirilir, donerek
  geriye tasinir ve guvenli zemine iner. Tek kullanimlik kalkan bunu engeller.
  Hortumun goruntusu ve ruzgar sesi etki bittiginde birlikte temizlenir.
- Kalkan artik ince koruma kubbesi ve kameraya donuk mavi/gumus simgedir;
  eski alti buyuk enerji paneli kaldirildi. Bir zararli temasta kirilir.
- Onceki hediye kurallari, ses, grafik, parkur ve arac rengi korunur.

## 0.6.6

- Hediye/eylem katalogu acikken arka plandaki butonlar ve alanlar girdi almaz.
- Test alani tam panel genisliginde, eylem ve kayitli hediye testleri ayridir.
- Eylem gecmisi sekmesinin yerinde Arac ve renk: klasik, spor, ralli gorunumu
  ve sekiz govde rengi. Gorunumu kaydet, hediye/mikrofon/grafik ayarina dokunmaz.
- Turbo hizinda ince engeller icin ileriye fizik temasi kontrol edilir.
  Her yeni carpismada geri itis olur; ortak 1.3 saniyelik muafiyet kaldirildi.
- Yumurta firlat: sureli, beyaz/sari ekran izi. Kafesten kurtar: tek seferlik.
  Dusuk yercekimi kaldirildi; eski eslesmesi varsa hediye bilgisi korunup kapatilir.
- Yan ruzgar, etkisi surerken rastgele araliklarla sag/sol yon degistirir.
- Kalkan saydam alti enerji panelidir; bir zararli hediye veya temasi engeller.
- Yayina katilim/yorum/begeni/hediye olaylarindan bilinen izleyiciler tribunlerde
  insan figuru olur, begendiklerinde veya hediye attiklarinda tezahurat eder.
  Baglanmadan onceki tum izleyicilerin listesi servisten gelmedigi icin uydurulmaz.
  En fazla 132 figur, kurulu tribun koltugu sayisi kadar gosterilir.
- Katmanli dag orguleri, karli tepeler ve hareketli kuslar eklendi.


## 0.6.5

- Mikrofonun yuksek dip sesi artik gaz olarak sayilmaz. Hizlandirma pedinin
  motor destegi ses veya bilerek acilan otomatik surus ile calisir.
- B menusunde araba, direksiyon ve kamera sabitlenir. Canli hediyeler bekler;
  oyuna donuldugunde sirayla uygulanir. Menu acikken kuyruk suresi korunur.
- Lastik sokme govdeyi dondurmez; bir gercek teker gizlenir, hiz ve tutus
  hafifce azalir. Sure dolunca ya da tamir ile teker ve surus geri gelir.
- Bes yeni eylem: el freni, yan ruzgar, buzlu lastikler, dusuk yercekimi,
  ziplayan suspansiyon. Sureleri ayarlanir; ruzgar ve suspansiyon gucu secilir.
- Bastan baslat hediyesinde once onde meteor gorunur, carpinca araba
  baslangica dogru savrulur. Meteor ve carpma halkasi kendiliginden temizlenir.
- Kamera yuzde 28 uzaklastirildi, baslangic/bitis taklari gorusu acacak
  sekilde yukseltildi; tribunlere renkli yaris balonlari eklendi.
- Hediye eslesmeleri, mikrofon, grafik ve parkur tercihleri aynen korunur.

## 0.6.4
- Bitiste YAYINCI KAZANDI ekrani ve uc saniyelik yeni tur geri sayimi vardir.
  Arac, kamera, tur suresi ve engeller ayni parkurun baslangicina sifirlanir;
  yeniden harita secmek/yuklemek gerekmez. Otomatik surus tercihi korunur.
- Ses egrisi dusuk mikrofon seviyelerinde de yuksek hiza ulasabilir.
  Kisik ses daha yavas, yukseltilen ses belirgin hizli kalir; sessizlik frenler.
- O ile otomatik surus acikken de ses hizlandirabilir. Sessizlikte otomatik
  temel hiz devam eder; ses kapaliysa mikrofon ek gaz vermez.
- Sag altta gercek km/sa, gaz ve hedef hiz gosterilir. Gorunen hedef hiz,
  turboyu ve lastik etkisini de hesaplayan surus denetimiyle ayni degerdir.
- Gercek hiz yukseldikce kamera gorus acisi yumusakca genisler.
- B > Mikrofon ve ses icinde azami hiz araligi 6-45 m/s (22-162 km/sa)
  oldu. Mevcut kullanicinin 25 m/s tercihi ve diger kayitlari degistirilmez.
- Kazanan ekrani sirasinda yaris etkin degildir; hediye eylemi kuyruga
  saklanmaz. Yeni turda eylemler yeniden kullanilabilir.

## 0.6.3
- Mesafe, sure ve guc kutularina klavyeden sayi girilebilir; arti/eksi kalir.
  Bos veya sinir disi deger kayit/test icin kabul edilmez.
- Ileri gotur, gorunur ve kisa bir roket itisi yapar. Engellerin uzerinden
  gecer; kapi, hareketli engel veya atlama boslugunun ustune birakmaz.
- Geri gotur ve basa dondur tek Bastan baslat eyleminde birlestirildi.
  Donus de animasyonludur. Eski backward kayitlari hediye kimligi korunarak
  restart olarak okunur; dosya kendiliginden yeniden yazilmaz.
- Turbo mikrofon gazi olmadan da belirgin hizlanir; iki roket alevi vardir.
  Turbo testi gorulebilsin diye menuyu kapatir. B tekrar menuyu acar.
- Lastigi sok, tek tekerin goruntusunu sureli gizler; hiz azalir ve arac yana
  ceker. Sure sonunda veya Araci ve lastigi duzelt ile teker geri gelir.
- Tek kullanimlik kalkan gorunur mavi halkalarla belirtilir. Bir sonraki
  zararlı hediye/engel etkisini engeller ve kirilir; suresi dolunca kaybolur.
- Animasyon sirasinda oyun baglantisi kesilmez; tekrar gelen komut ayni
  eylemi iki kere uygulamaz. Sonuc ancak itis bitince onaylanir.

## 0.6.2
- B menusunde Grafik ve ekran: tam ekran, pencereli tam ekran, pencere,
  cozunurluk, dusuk/orta/yuksek/ultra kalite, V-Sync ve FPS siniri.
- Kalite; gercek render olcegini, kenar yumusatmayi, golge uzakligini,
  doku ve detay seviyesini degistirir. Oyunun varsayilani da secilebilir.
- Uygula yeni goruntuyu dener; Koru ile kalici kayit yapilir. Geri al veya
  15 saniye onay verilmemesi onceki goruntuye doner. Hediye/mikrofon degismez.
- Eski kayitlarda goruntu ayari yoksa mevcut ekran ve kalite oldugu gibi kalir.
- Windows/DXGI bu oturumda ozel tam ekrani reddetti; pencereli tam ekran ve
  pencere dogrulandi. Desteklenmeyen mod otomatik geri alinir ve kaydedilmez.

## 0.6.1
- Test dugmesi kaydedilmemis eylemi ve ekrandaki guncel mesafeyi deneyebilir.
- Yaris acik degilse test parkuru hazirlanir; yayin baglantisi gerekmez.
- Sonuc, gercek oyun uygulama onayindan sonra gosterilir. Test ayarlari kaydetmez.
- Isikli baslangic/bitis kapilari, baslangic gridi, damali cizgiler ve bitis konfeti kutlamasi.

## 0.6.0
- 22 metre yol; degisken aralikli alti engel turu, salincak ve slalom.
- Fiziksel hizlanma pedi, rampa, alttaki engellerin uzerinden atlama ve inis bolumleri.
- Bosluga dusunce rampanin oncesinden toparlanma; hediye tasimalari guvenli zemine gider.
- Parkur parcalar halinde hazirlanir, yukleme asamasi ve ilerlemesi ekranda gorunur.
- Eylem gecmisinde gercek hediyenin algilanmasi, eslesmesi ve oyun onayi izlenebilir.
- Kayitli hediye, mikrofon ve surus tercihleri korunur. Test yayincisi varsayilan olarak kaydedilmez.

Orijinal Steam CAAAHR! Demo icin tek oyunculu sesle surus modu.
Orijinal oyun haritasi, araba, fizik, direksiyon ve klavyeyle ziplama korunur.
Eski Gumball/Darwin ve Minecraft uygulamalari degistirilmez.

## Acilis ve Menu

Masaustundeki TikMnG Sesli Surus.vbs oyunu ve yerel hediye hizmetini acar.
Ilk ekrandan haritayi secip Oyuna gir'e basin. Yayin baglantisi zorunlu degildir.
Oyun surerken sadece B kendi menumuzu acar/kapatir; F1 kullanilmaz.
Menu sag ustte kucuk panel olarak acilir; arka plandaki parkur gorunur kalir.
Bosluk tusu ve orijinal oyunda secilen ziplama tusu klavyeden ziplatir.
Ziplama mikrofon gazindan bagimsizdir; menu acikken veya kafesteyken engellenir.
Haritalar sekmesi veya ustteki Harita sec dugmesi kurulu parkurlari gosterir.
Orijinal oyunun menu ve ayar ekranlari gosterilmez.
Demo kurulumda yalnizca demo parkuru acilir; tam oyun kilitleri asilmaz.
Modun yaris kayitlari ayri bir klasore yazilir; orijinal kayit yuvalari korunur.

Harita ve mikrofon menusu yerel kayitlardan hemen hazirlanir. Yerel hediye
hizmeti gecikse bile yayina baglanmadan duz parkura girilebilir. Servis
hazir olmadan varsayilan ayarlar mevcut hediye kayitlarinin ustune yazilmaz.
Reddedilen baglanti anahtari yeniden okunur ve basarili kimlik dogrulamadan
sonra oyun klasorundeki kopyasi eslestirilir. Servis kapaliysa kurulumun
kayitli baslaticisi gorunmez olarak yalnizca yerel hizmeti hazirlar.
B menusundeki Baglantiyi onar dugmesi ayni kurtarmayi elle baslatir.
Masaustu acilisi, yeni oyun surecinin ayar ve 686 hediyeyi gercekten aldigini
dogrulamadan hazir sayilmaz; onceki oyun oturumunun nabzi yeterli degildir.

## Kendi Duz Parkurumuz

Haritalar > TikMnG Duz Parkur, orijinal demo haritasindan ayri yeni bir yoldur.
Hedef mesafesi 100-5.000 metre arasinda tam metre olarak secilir.
250, 500, 1.000 ve 2.000 metre hazir secenekleri de vardir.
Mesafeyi kaydet kalici saklar; secilen uzunluk parkura girerken uygulanir.
Aktif parkurun uzunlugunu degistirmek icin parkuru yeniden baslatin.
Ustte hedefe kalan metre ve ilerleme cizgisi gorunur. Bitiste araba durur.

O tusu sesle surus ile WASD surusu arasinda gecis yapar. W ileri, S geri,
A/D direksiyondur. Tus birakilinca gaz kesilir; Bosluk ile ziplanir.
B > Haritalar bolumunden de mod degistirilir. Menu ve odak kaybi gaz keser.
Parkura girerken sesle surus secilir; kendiliginden ilerleme yoktur.

Parkurda katmanli cam agaclari, kayalik tepeler, tribunler, bayraklar,
isikli yol direkleri ve baslangicta pit binasi bulunur. Yol duz kalir.
Statik cevre birlikte islenir; uzaktaki engeller surekli guncellenmez.

Engeller arasinda kisa bolumler ve 170-240 metre bos surus alanlari bulunur.
Engeller degisken araliklarla alti cesittir: yana kayan yumusak tampon,
donen kol, ileri savurma pedi, acilip kapanan kapi, slalom ve salincak.
Kirmizi engeller 10 metre
geri atar, turkuaz pedler 8 saniye hizlandirir. Kapi yukaridayken altindan gecilir;
isigi acikken yesil, kapanirken/kapaliyken amber olur. Engel temasi icin
kisa bir koruma araligi vardir; tek temasta defalarca savrulmazsiniz.
Kalkan bir engeli durdurur. Hediye eylemleri ve mesafe ayarlari bu yolda da
calisir; ileri/geri tasima yolun baslangici ile hedefi arasinda tutulur.
Rampa oncesindeki turkuaz ped hizi yukseltir; araba bosluk ve alttaki
engellerin uzerinden genis inis alanina atlar. Bosluga dusulurse rampanin
oncesine doner. Hediye tasimalari bosluga birakmaz. Orijinal haritaya geri donulebilir.

## Mikrofon ve Ses

Otomatik mod standarttir; iki ayri ses esigi olcmek zorunlu degildir.
Windows'un secili mikrofonu ismi ve cihaz kimligiyle takip edilir. Varsayilan
giris degisince yeni mikrofona gecilir; listedeki ilk aygit korlemesine secilmez.
Takilan kulakligin mikrofonunu Windows giris aygiti olarak secmek yeterlidir.
Elle belirli bir mikrofon secmek de mumkundur.

Canli mikrofon gostergesi yaris baslamadan da calisir. Ortam sesi otomatik
ogrenilir; kisik konusmada asgari kalkis hizi vardir. Ses yukselince hedef hiz
artar. Kelimeler arasindaki kisa bosluklar arabayi durdurmaz; sessizlik veya
ses akisinin kesilmesi gazi keser. Donan ses akisi otomatik yeniden acilir.

Otomatik modda kisik ses hassasiyeti, azami hiz ve oyun sesi ayarlanir.
Elle ayarla modunda eski dB esikleri ve yumusatma korunur. Kolay ayara don
dugmesi yalnizca ses kontrolunu duzeltir; hediye eslesmelerini silmez.
Kaydet ile ayarlar kalici saklanir. Menu acikken araba gaz vermez.

Sessizlikte gaz hemen sifirlanir ve yerdeki araba frenlenir. Hafif konusma
dusuk hedef hiz, yuksek konusma yuksek hedef hiz verir. Klavye gazinin
ve eski ikili mikrofon gazinin bu kontrolu atlamasina izin verilmez.
Mikrofon kaybi veya odak kaybinda gaz kesilir. Havadayken yercekimi korunur.
Ses kayitlari hicbir sunucuya gonderilmez; yalnizca dB, gaz ve hiz yerel
hizmete aktarilir. Mikrofon ve ses ayarlari hediye eslesmelerini silmez.

## Hediyeler ve Test

686 gorselli katalogdan hediye ve 20 eylemden islem secilir.
Mesafe, sure ve guc yalnizca ilgili eylemlerde gosterilir.
Hediye kurallarini Kaydet ile saklayin.
Satirdaki Test, Kaydet'e basmadan ekranda duzenlenen eylemi dener; kayitli
eslesmeleri degistirmez. Gerekirse secili parkuru acar. Test uygulandi sonucu
yalnizca oyun eylemi gercekten uyguladiginda gorunur; reddedilme nedeni belirtilir.
Test alani, yayina baglanmadan dogrudan eylem veya kayitli hediye denemesi yapar.
Fizik eylemleri icin yaris acik olmalidir. Gercek sonuc yerel tani kaydina yazilir.
Etkin olmayan yaris icin hediyeler biriktirilmez.

Eylemler: patlat, bastan baslat, ileri gotur, lastigi sok, sureli kafes,
kafesten kurtar, turbo, yavaslatma, ters direksiyon, havalandirma,
araci ve lastigi duzelt, tek kullanimlik kalkan, el freni, yan ruzgar,
hortumla geri savur, buzlu lastikler, yumurta firlat, ziplayan suspansiyon,
dort seride kalas gonder ve karsidan araba gonder.
Ileri itisin varis noktasi engel/bosluk ustundeyse
en yakin guvenli yol bolumune ilerletilir ve gercek mesafe sonucu yazilir.
Orijinal haritada guvensiz hedef reddedilir; kendi parkurumuzda hedef yolu
ve engel mesafeleri bilinir. Koruma yalnizca itis boyunca gecerlidir.

## Dosyalar ve Kurulum

Kurulum.vbs oyun kapaliyken yeni DLL ve JSON bagimliligini kurar.
BepInEx yukleyicisi korunur; orijinal oyun yurutucusu ve Assembly-CSharp.dll
degistirilmez. Yayin kullanici adi her acilista yeniden istenir.
Ayarlar: %LOCALAPPDATA%/TikMnG-CAAAHR/settings.json
Mod kayitlari: %LOCALAPPDATA%/TikMnG-CAAAHR/saves/

Bu beta, diger uygulamalardaki katalog ve Node bagimliliklarini kullanir;
tek basina genel dagitim paketi degildir. Gercek TikTok yayini testi ayri
olarak yapilmalidir. Gecici test yayincisi varsayilan ayarlara yazilmaz.
Eylem gecmisi algilanan gercek hediyeyi, eslesmeyen hediyeyi, kuyruk durumunu
ve oyundan gelen uygulama onayini ayri gosterir. Tek hediye olayinda ve
bekleyen kuyrukta en fazla 100 eylem vardir; kismi uygulama acikca belirtilir.

## Gelistirici Testleri

- node --test test/*.test.mjs: kalici ayar, kuyruk, tekrarli hediye, yerel API,
  guvenli fotograf kaynaklari, WebP donusumu, yuvarlak PNG ve onbellek sinirlari.
- test/voice-math.ps1: sessizlik, RMS, orantili gaz ve hiz, gecis ve gecersiz ses.
- test/track-layout.ps1: 100-5.000 metre araligindaki tum uzunluklarda
  engel dagilimi, rampa koridoru, guvenli hediye konumu ve dusme kurtarmasi.
- node test-ui.mjs: 686 gorselin acilmasi, katalog ve kural regresyonu.
- plugin/build.ps1: kurulu oyunun derlemelerine karsi DLL derlemesi.
- --tikmng-revision-smoke: 0.6.10 icin guncel kontrollu native test; 14 eylem,
  WASD ileri/geri/durma, merkez yazi gorunurlugu, sureli hasar, kafes sayaci,
  kademeli lastikler, on saniye bitis, win/yeniden baslama, B menu duraklamasi,
  pencereli ekran, geri roket ve bitise isinlama kontrolu.
  Sonuc revision-smoke.json dosyasindadir; gercek canli hediye testi degildir.
  --tikmng-traffic-visual eklenirse dort aracin donmesi ve B ile durmasi
  ayri revision-traffic-visual.json raporunda kontrol edilir.
- Asagidaki eski smoke bayraklari onceki surumlerin senaryolaridir; eski
  20 eylem ve uc saniyelik bitis beklentileri yeni kurallarla uyusmayabilir.
  Bu surumun kabul testi icin --tikmng-revision-smoke kullanilir.
- --tikmng-smoke: acikca verilirse oyun ici harita, menu, kontrollu ses,
  otomatik ilerleme, alti engel, acik/kapali kapi, fiziksel rampa atlayisi,
  20 eylem destegi, katalog, yukleme ekrani, bitis ve yeni fizik efektleri testi.
  Sonuclar BepInEx/config/TikMnG-Diagnostics/native-smoke.json icindedir.
  Normal masaustu acilisinda test sesleri veya otomatik test surusu kullanilmaz.
- --tikmng-offline-smoke: kapali servisle ilk haritaya giris, otomatik hizmet
  acilisi, anahtar eslestirme ve kurtarma sonrasi eylem testi.
- --tikmng-preview-smoke: kaydedilmemis 17/23 metre eylem testi, otomatik
  parkur girisi, ayarlarin korunmasi, baslangic/bitis kutlamasi, dort gercek
  kalite seviyesi, ekran modu ve otomatik goruntu geri alma kontrolu.
- --tikmng-actions-smoke: klavye sayi alani, gorunur itis ve geri donus,
  iki sirali itis, guvenli inis, gercek turbo hizi ve alev, tek tekerin
  gizlenmesi, yana cekme, sure sonu onarim ve tek kullanimlik kalkan testi.
- --tikmng-rounds-smoke: gercek fizik hizinin kisik/yuksek sesle karsilastirilmasi,
  sessizlikte fren, hiz gostergesi/gorus acisi, iki otomatik tur, arac/kamera
  eslesmesi, yaris suresinin sifirlanmasi ve yeni turda hediye eylemi kontrolu.
- --tikmng-control-smoke: itis/lastik/turbo kontrolleri, gurultulu mikrofon,
  B menusunde sabit kamera ve fizik, bes yeni eylemin gercek hareketi,
  etki suresinin dolmasi ve gorunur meteorun carpma/geri donus kontrolu.
- --tikmng-latest-smoke: katalog girdi yalitimi, arac/rengi, tekrarli turbo
  carpismasi, tribunler, yumurta/kafesten kurtarma, yaprakli ruzgar ve hortum.
  --tikmng-avatar=/avatars/<32-hex>.png verilirse mevcut yerel fotograf
  onbellegindeki gercek bir profil de oyun icinde dogrulanir.
- --tikmng-traffic-smoke: dort serit, zorunlu kucuk atlama, gercek trafik temasi,
  baslangica donus, B ile trafik durdurma, kalas/araba hediyesi, kalkan ve kus
  yumurtasinin dogru sirada gorunmesi ve temizlenmesi testi.
- Start.ps1 -VerifyStartup: masaustu baslaticisinin ayni acilis yoluyla oyun
  ici testleri calistirir. Normal VBS kisayolu test bayragi vermez.

Newtonsoft.Json 13.0.3, MIT lisansi ile plugin/deps altinda tutulur.
