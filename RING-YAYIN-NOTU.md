# Ring yayın adayı — 27 Kasım 2026

Ring 0.1.0 ve TikMnG 7.0.38 bu dalda hazırlanmıştır. Kurulum videosu, altın Ring kapağı, altı kural, FPS sıra puanı ve doğrudan GitHub indirme katalogları eklidir.

## Yayın durumu

**Henüz herkese açık güncelleme değildir.** Güncel taşınabilir pakette seçili köşe hediyesi → native hasar gerçek yayında tamamlanamadığından Ring tam kapısı durur. Bağlantı, doğal katılımcılar, iki profil/can barı ve gerçek beğeniden iki isabet gözlendi. Sentetik hediye testi gerçek hediye kanıtı olarak sayılmaz. GitHub sürümleri taslaktır; mevcut 7.0.37 son sürümü ve main dalı değişmez.

Bu dalı Render'a henüz dağıtmayın. Son gerçek hediye kontrolü, oyun tam kapısı ve taslakların yayımlanması tamamlandıktan sonra main'e alınacak commit ayrıca bildirilir. Render dağıtımını kullanıcı yapar; otomatik dağıtım yapılmadı.

## Kurulum

Ring bir mod paketidir. Steam üzerinden ücretsiz Online Boxing 3D Demo (4793540) önce kurulmalıdır. Oyun EXE'si, Steamworks ve MuJoCo ikilileri Ring ZIP'inde dağıtılmaz. Mevcut doğrulanmış Steam sürümüne 6,6 MB Windows MSDelta uyumluluk farkı yalnız Ring'in kullanıcı veri klasöründeki kopyasında uygulanır; sonuç SHA-256 ile doğrulanır. Steam kurulumu değişmez. Python ve Frida çalışma zamanı pakete dahildir.

## Sonraki işlem

1. Güncel sürümün doğal ring katılımcılarından, B menüsünde seçili köşe hediyesinin native isabetini ve iki profil/can barını doğrula.
2. `apps/hediye-box/tests/release-gate.ps1` tam kapısını geçir; kaynak fingerprint'lerini yeni kanıta bağla.
3. Paket SHA-256 değerlerini ve updater feed'ini yeniden denetle. Sürüm/kurallar güncelse GitHub taslaklarını yayımla ve en son launcher sürümünü 7.0.38 yap.
4. Main commit'ini kullanıcıya Render için bildir. Oyun indirmeleri Render üzerinden proxy edilmez.

Kurulum videosu: https://www.youtube.com/watch?v=Il6t2jrBy1c

## Tamamlanan taşınabilir akış kontrolü

Yeni pakette iki tam yerel maç ve P sıfırlaması çıkış 0 verdi. İki köşede 1 canla gard, nakavt, kazananın kalması ve yeni rakip geçişi gözlendi. Ayrıntılar `maintenance/ring-0.1.0/verification` altındadır. Bu yerel kanıt eksik gerçek hediye kontrolünün yerine geçmez.
