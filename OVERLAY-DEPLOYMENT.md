# TikMnG HTTPS Yayin Baglantilari

Bu sunucu guncellemesi launcher kurulumunu veya oyun paketlerini yayinlamaz.
6.5.17 masaustu surumu ayri bir test uygulamasidir. Kararli surum 6.5.16 kalir.

## Render'da Etkinlestirme

1. Mevcut lisans verilerinin yedegini ve kalici disk yolunu kontrol edin.
   `MNG_DATA_DIR`, yonetici ve mevcut GitHub yedekleme ayarlarini koruyun.
   Yeni bir bos lisans sunucusu kurmayin; mevcut servisi guncelleyin.
2. GitHub'daki HTTPS yayin servisi degisikligini Render'in izledigi dala alin.
   Render > ilgili Web Service > Manual Deploy > Deploy latest commit secin.
   Mevcut Build Command paket bagimliliklarini kurmali; `npm ci` uygundur.
   Start Command `npm start` olarak kalabilir.
3. `ADMIN_SIFRE` mevcut ve en az 16 karakterse HTTPS servisi onunla calisir.
   Tercihen ayri, rastgele, en az 32 ASCII karakterlik
   `OVERLAY_RELAY_SECRET` tanimlayin. Bu sirri bir kez ayarlayip koruyun.
   Sirrin degismesi daha once kopyalanmis yayin adreslerini degistirir.
   Gercek sirri GitHub'a, ekran goruntusune veya sohbet mesajina eklemeyin.
4. Dagitim bittiginde asagidaki saglik adresini acin:
   `https://mng-license-server1.onrender.com/api/overlay/health`.
   Beklenen: HTTP 200 ve `{"available":true,"protocolVersion":1}`.
   404 eski sunucu surumudur; `available:false` sir ayarinin eksik oldugudur.
5. TikMnG Test Launcher'i acin. Etkin lisansi ve yayin hesabini secin.
   Ayarlar > HTTPS Yayin Servisi > Yeniden dene tusuna basin.
   Video Studyosu ve Widget'lar artik yerel adres yerine HTTPS adresi verir.

Mevcut GitHub ana dalinda onceden eklenmis icerik katalogu ve Zombie War
varsayilan paket degisiklikleri de bulunur. Eski Render dagitimindan ana dala
gecerken bunlari gozden gecirin; bu HTTPS degisikligi yeni oyun paketi yuklemez.

## Yayin Kabul Testi

- Genel video kaynagini ve bir oyuna ozel medya kaynagini ayri ekleyin.
  Eski localhost adresini kullanmayin; yeni HTTPS adresini launcher'dan kopyalayin.
- Adresi TikTok LIVE Studio'da baglanti kaynagi olarak ekleyin ve sesi acin.
  Launcher acik kalmalidir. Internet ve sunucu baglantisi gereklidir.
- Bir videoya hediye atayin. Once test tusuyla oynatmayi, sonra gercek yayindan
  gelen tek bir deneme hediyesini dogrulayin. Bunlar farkli testlerdir.
- Oyun kaynagi sadece ilgili oyun acikken o oyunun eslesmelerini oynatir.
  Genel eslesmeler ve diger oyunlar bu kaynaga karismaz.
- Bir widget ekleyin; hediye, begeni, izleyici ve kullanici adi verisini kontrol edin.
- Interneti kisa sure kesip yeniden baglayin. Ayni kaynak adresi kalmalidir.
  Son 90 saniye / 256 olay icindeki kisa kesintiler telafi edilir; uzun sureli
  kapanmalar icin sinirsiz olay kurtarma veya kesintisizlik garantisi yoktur.
- Uygulamayi kapatin: yayin servisi gecici olarak kullanilamaz olur. Yeniden acip
  ayni hesapla baglanin; ayni test profili ve sunucu sirriyle adres korunmalidir.

Kullanici adini kaydetmek, TikTok'a OAuth girisi veya gercek LIVE baglantisi
anlamina gelmez. Launcher ancak gercek yayin odasi dogrulandiginda Canli yazar.
TikTok tarafi istegi reddederse neden ve yeniden deneme durumu gorunur.

## Calisma Sinirlari

- Bu surum tek Render instance uzerinde calisan relay icindir. Birden fazla
  instance icin ortak baglanti yonlendirme katmani eklenmeden olceklendirmeyin.
- Render Free servisleri uyuyabilir ve yeniden baslayabilir. Uretimde surekli
  acik servis secilmesi tavsiye edilir. Ucretli plan da kesintisizlik garantisi
  degildir. [Render Free](https://render.com/docs/free),
  [WebSocket davranisi](https://render.com/docs/websocket).
- Her video yayin bilgisayarindan sunucu uzerinden aktarilir; hem bilgisayarin
  yukleme hizi hem sunucunun bant genisligi kullanilir. Dosya siniri 512 MiB'dir.
- HTTPS adresi salt okunur bir erisim anahtari gibidir. Herkese acik paylasmayin.
  Lisans anahtari, yerel servis anahtari ve yonetici oturumu adreste bulunmaz.
- Lisansin silinmesi/engellenmesi veya cihazin yetkisinin kaldirilmasi aktif
  yayin erisimini en gec sonraki periyodik yetki kontrolunde kapatir.
- Oyunun kendi eski OBS-yerel kaynaklari farkli servislerdir. Bu relay Video
  Studyosu, oyuna ozel medya eylemleri ve launcher'in 13 ortak widget'ini kapsar.

## Otomatik Dogrulama

- Sunucu: `node --test tests/*.test.js`.
- Launcher: `node --test tests/*.test.cjs`.
- Gercek yerel HTTPS/WSS, 13 widget ve MP4: `node tools/qa-https-overlay.cjs`.
  Bu arac kisa omurlu test sertifikasi ve sentetik lisans/hediye kullanir.
  Gercek TikTok hediyesi veya LIVE Studio kabul testi yerine gecmez.

Canli lisanslar, kullanici ayarlari, yayin videolari ve hesap anahtarlari test
kaynak paketine veya GitHub degisikligine eklenmez.
