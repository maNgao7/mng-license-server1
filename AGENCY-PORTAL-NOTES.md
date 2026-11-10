# Ajans paneli — yerel güncelleme, 10 Kasım 2026

## Kapsam ve dosyalar

- `web/index.html`, `web/agency-entry.css`: Yönetici Girişi sonrasında görünür `/agency` bağlantısı; alt menüde ikinci bağlantı.
- `web/agency.html`, `web/agency.css`, `web/agency.js`: mevcut sitenin koyu/mint tasarımını kullanan kod girişi, ajansa özel liste, adla tekil lisans oluşturma, kopyalama ve iptal.
- `agency-portal.js`: ayrı ajans oturumu, aynı kaynak denetimi, giriş/işlem sınırı ve ajansa göre yetkilendirme.
- `admin/public/dashboard.js`, `admin/public/index.html`, `admin/public/agency-access.css`: gerçek yönetici panelinde ajansa özel giriş kodu üretme/yenileme, bir kez gösterme/kopyalama ve kapatma.
- `agency-licenses.js`, `server.js`, `overlay-authorization.js`: ortak kota, ana lisans süresi/iptali ve yayın bağlantısı yetkisi.
- `tests/agency-portal.test.js`: yedi odaklı regresyon testi.

## Kimlik ve kalıcı kayıt

Panel giriş kodu oyun lisansından ayrıdır. Paylaşılan ajans oyun lisansı ve bireysel lisanslar paneli açmaz. Sahip, mevcut yönetici panelinde ajans satırını açıp **Panel giriş kodu oluştur** düğmesine basar. Oluşan 256 bit rastgele `MNGA-` kodu yalnızca o yanıtta gösterilir ve kopyalanabilir. Sonradan okunamaz; kaybolursa yeni kod üretilir. Bu kod oyun aktivasyonunda ve kontrolünde reddedilir; yanlışlıkla oyun alanına yazılsa da aktivasyon günlüğüne kaydedilmez. Prototip, demo kodu, yönetici geçişi veya yeni fiyatlandırma sistemi eklenmedi.

Sahibe özel uç nokta: `POST /api/admin/ajans/:kod/panel-kodu`; `:kod` ajansın mevcut oyun lisansıdır. Gövde `{"islem":"olustur"}` kod üretir/yeniler; `{"islem":"iptal"}` panel girişini kapatır. Yönetici oturumu, aynı kaynak `Origin`, JSON ve `X-TikMnG-Agency: 1` zorunludur. Durum bilgisi mevcut ajans ayrıntısındaki `panel_erisim_var` alanıdır; ayrıntı ve liste yanıtlarından düz giriş kodu okunamaz.

Kalıcı kayıtta yalnızca `agency_portal_access: { version: 1, hash, issued_at }` saklanır. Özet, uygulamaya özel önekle SHA-256 üzerinden hesaplanır; düz giriş kodu diske, yedeğe, günlüğe veya tarayıcı saklama alanına yazılmaz. Üretim, yenileme ve kapatma mevcut kalıcı kayıt işlemiyle onaylanır. Başarısız yazım kod vermez ve eski erişimi değiştirmez. Yenileme ve kapatma `agency_session_version` alanını artırır; eski kod ve tüm eski oturumlar geçersiz olur.

Ajans çerezi `mng_agency_session`: HttpOnly, SameSite=Strict, `/api/agency` kapsamı, HTTPS üzerinde Secure, sekiz saat. Oturum sunucuda tutulur; yeniden başlatmada tekrar giriş gerekir. İptal/silme kalıcı oturum sürümünü değiştirir; lisansı yeniden açmak eski oturumu açmaz. Her istekte ajans durumu ve süre sonu yeniden okunur. Yönetici çerezi ve yetkisi ayrıdır.

Yeni tekil kayıtlar mevcut `${MNG_DATA_DIR}/lisanslar.json` havuzunda `schema_version: 1`, `agency_parent_id` ve değişmez kayıt kimliğiyle saklanır. `MNGP-` kodları yalnızca kayıt üzerinden doğrulanır; kayıt yoksa aktivasyon makbuzuyla bağımsız lisans olarak kurtarılamaz. Bekleyen kodlar da yer ayırır; mevcut ortak kod cihazları aynı kotayı kullanır. İlk yayıncı aktivasyonu ortak süreyi başlatır. Ana ajans yenilendiğinde süresi dolmuş bağlı kodlar iki doğrulama yolunda da güncellenir; iptal edilmiş kodlar açılmaz.

Mevcut atomik disk yazımı veya yapılandırılmış GitHub lisans işlem kuyruğu kullanılır. Render üzerinde kalıcı disk/GitHub kaydı hazır değilse üretim ve iptal kapalıdır. Yazım onaylanmadan yeni kod teslim edilmez. Yeni yayın bağlantısı veya profil kaynağı eklenmedi; yayın bağlantılarının mevcut yetki kontrolü ana ajans iptalini de denetler.

## Yerel doğrulama ve sınırlar

- `node --test tests/agency-portal.test.js tests/agency-api.test.js tests/overlay-authorization.test.js tests/shopier-checkout.test.js tests/shopier-ledger.test.js tests/shopier-payment.test.js`: 37/37 geçti. Paylaşılan oyun kodunun panelde reddi, giriş kodunun oyun aktivasyonu/kontrolünde reddi, yalnızca sahibin kod üretmesi, özeti dışında kayıt bulunmaması, kod/oturum yenileme ve iptali, kapalı/süresi dolmuş ajansın reddi dahil.
- `git sparse-checkout add admin` ve `git sparse-checkout add tests` ile var olan, değiştirilmemiş kaynaklar açıldı; kullanıcı dosyaları korunuyor. Önceki yönetici varlığı 404 sorunu giderildi; mevcut ajans API regresyonlarının tamamı geçti.
- Mevcut GitHub kayıt testinin bellekte uyarlanan ek senaryosu: ayrı giriş kodunun üretimi/yenilenmesi sırasında başarısız uzak yazımda kod vermeme ve eski oturumu koruma; başarılı yenilemede eski kod/oturumu kapatma; tekil kod üretimi/ortak kota; yeniden başlatmada ayrı giriş koduyla giriş; kalıcı iptalden ve tekrar başlatmadan sonra kodun reddi geçti. Gerçek GitHub/ödeme ağı kullanılmadı.
- Chrome: mevcut menü betikleri çalıştıktan sonra 1440/1280/768/390 px genişliklerinde bağlantı görünür ve Yönetici Girişi sonrasında. Mobil kod giriş ekranı görsel olarak kontrol edildi.
- Gerçek yönetici ekranında üret/kopyala/yenile/kapat düğmeleri; ajans ekranında ortak kodun reddi ve ayrı giriş kodunun kabulü; yenilemede oturumun kapanması ve iptalde yeniden girişin reddi doğrulandı. Tarayıcı betik hatası yok. Yönetici modalı mevcut açık yüzey/#087f79 düğme tasarımını kullanır. Yalnızca geçici, sentetik test verileri kullanıldı.
- Görsel hedef: `web/index.html` + `portal-v3.css`/`portal-v4.css`; koyu #101415, yüzey #191f20, mint #63ded1, 5 px köşeler. Harici tasarım araması abonelik nedeniyle kullanılamadı; mevcut site ve yerel form/erişilebilirlik rehberi esas alındı.
- Bu web projesinde `tests/release-gate.ps1` yok. Canlı site, gerçek sahip/ajans kodu veya gerçek launcher kurulumu denenmedi. Test süreçleri ve tarayıcı kapatıldı; gerçek lisans verisi okunmadı/değiştirilmedi.
- Deploy, push ve commit yapılmadı. Kullanıcıya ait önceden mevcut izlenmeyen dosyalar ve ses/video dosyaları korunuyor.
