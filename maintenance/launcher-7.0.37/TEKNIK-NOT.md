# TikMnG 7.0.37 bağlantı düzeltmesi

Kaynak: 7.0.36 launcher. Electron 31.7.7 ve tiktok-live-connector 2.4.4 korunur.
Var olan tiktok-live-api-sdk 0.4.0-beta1 doğrudan bağımlılık olarak sabitlenmiştir.

## Sorun ve davranış

SDK'nin public host taban adresi HTTP üretiyordu. Launcher bağlantısındaki
getBaseUrl örnek düzeyinde düzeltilerek HTTPS doğrudan kullanılır. Sistem DNS'i,
sertifika kontrolü veya SDK'nin diğer tüketicilerinin global ayarları değiştirilmez.
Yerel test için açıkça verilen loopback HTTP adresi desteklenir.

Her denemenin ayrı HTTP/HTTPS agent'ı, AbortController'ı ve imzalama istemcisi
vardır. İptalde istekler ve agent'lar kapanır. Geç kalan deneme yeni WebSocket
açamaz. IPv4/IPv6 aile seçimi mevcut Node ağı üzerinden çalışır.
İç içe HTTP tekrarları kapalı; yeniden denemenin sahibi live-session'dır.
Launcher bağlantı süresi 60 saniye; imzalama 12 saniye, WebSocket el sıkışması
15 saniye ile sınırlıdır. Mevcut tek yayın sahibi, eski olayları filtreleme,
hediye ilerlemesi ve oyunlara ortak olay dağıtımı korunur.

DNS/TLS, istek sınırı, kimlik doğrulama ve oda bulma hataları birleşik SDK
hatalarından sınırlı ve döngüye dayanıklı biçimde ayrılır. Destek raporu bellekte
en fazla 40 farklı durum tutar; kullanıcı adı, oda, anahtar, parola, çerez veya
ham hata içermez. Yalnız kullanıcı düğmeye bastığında panoya kopyalanır.
Yeni kalıcı veri veya kayıt yolu eklenmez. Mevcut electron-store, oyun dizinleri,
profil önbelleği ve ayarlar korunur.

## Doğrulama

- Launcher tests/release-gate.ps1: 457 geçti, 0 hata, 0 atlandı.
- Gerçek yayında bağlantı açıldı; sohbet, beğeni, izleyici ve katılım olayları alındı.
  Hediye gelmediği için bu oturum gerçek hediye teslimi kanıtı değildir.
- Electron 31.7.7 içinde rapor düğmesi ve panoya kopyalama denendi.
- Dağıtılacak portable: normal lisans ekranı, ayrı test profiliyle önizleme,
  gerçek yayın bağlantısı, bağlantıyı kesme ve temiz kapanış geçti.
- Kurulum ve portable aynı payload'ı içerir; 2040 dosya açılmış paketle eşleşti.
- ASAR farkı yalnız 9 beklenen dosya; test ve önizleme giriş kodu pakette yoktur.
- 7.0.36 → 7.0.37 diferansiyel güncellemesi yerel HTTP ile doğrulandı:
  3.472.616 bayt indirildi; sonuç SHA-512 eşleşti. Bu ağ hızı garantisi değildir.

Sorun bildirilen diğer bilgisayarda henüz doğrulama yapılmadı. Yeni rapor bu
bilgisayarda devam eden DNS/TLS/ağ veya TikTok yanıt sorununu ayırt etmek içindir.
Kurulumun içeriği doğrulandı; gerçek kullanıcı profilinin üzerine etkileşimli
kurulum yapılmadı. Ring bu sürümün kataloğuna eklenmez.

## Yayın ve geri dönüş

GitHub v7.0.37; Render dağıtımı kullanıcıya aittir. Güncel sürüm ve indirme
metadatası dışında sunucu davranışı ve oyun katalogları değiştirilmez.
Bir genel açılış/bağlantı gerilemesi doğrulanırsa GitHub'ın son sürümü v7.0.36'ya
ve sunucu sürüm metadatası önceki commit'e döndürülebilir. Kullanıcı verileri
silinmez. Bu belge bir geri dönüş işlemi başlatmaz.
