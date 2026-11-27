# Ring 0.1.0 ve TikMnG 7.0.38 — GitHub yayını

Kurulum videosu, altın Ring kapağı, altı kural, FPS sıra puanı ve GitHub indirme katalogları bu sürümdedir. Kullanıcı GitHub yayınının tamamlanmasını istedi; Render dağıtımını istediği zaman kendisi yapacak. Render'a dağıtım yapılmadı. Main commit mesajı otomatik dağıtımı atlamak için `[skip render]` içerir.

## Doğrulama durumu

Launcher 467/467, sunucu 435 başarılı / 6 atlanan, Ring 228 temel + 69 kamera + 49 spectator kontrolü geçti. Yeni taşınabilir pakette iki yerel maç, iki köşede 1 canla gard, nakavt, kazananın kalması, yeni rakip ve P sıfırlaması çıkış 0 verdi. @rasimbisakin gerçek yayınında bağlantı, iki profil/can barı ve beğeniden iki native isabet gözlendi.

**Güncel paketin son gerçek köşe hediyesi → native hasar kontrolü yapılmadı.** Aktif dövüşçüden seçili hediye gözlenmedi ve kullanıcı şu anda hediye denemesi yapamıyor. Bu nedenle Ring'in tam yayın kapısı eksik kanıtla çıkış 1 verdi; geçmiş kanıt kopyalanmadı, test sonucu değiştirilmedi. Kullanıcının bu durum açıklandıktan sonraki doğrudan GitHub yayın isteğiyle paket sunulur. Bu eksik doğrulama sürüm notunda da yazılıdır; tüm senaryoların hatasızlığı iddia edilmez.

## Kurulum ve Render

Ring bir mod paketidir. Steam üzerinden ücretsiz Online Boxing 3D Demo (4793540) önce kurulmalıdır. Oyun EXE'si, Steamworks ve MuJoCo ikilileri Ring ZIP'inde dağıtılmaz. Doğrulanmış mevcut Steam sürümüne uyumluluk farkı yalnız Ring'in kullanıcı veri klasöründeki kopyasında uygulanır; Steam kurulumu değişmez. Python ve Frida çalışma zamanı pakete dahildir.

GitHub yayınları: https://github.com/maNgao7/mng-license-server1/releases/tag/ring-0.1.0 ve https://github.com/maNgao7/mng-license-server1/releases/tag/v7.0.38

Render'da yeni main commit'i kullanıcı istediği zaman elle dağıtabilir. İndirmeler GitHub'dan yapılır; Render üzerinden ZIP proxy edilmez. Kalıcı ayar ve kazananlar silinmedi. Geri dönüş gerekirse önceki main `fa2de28fe02c0203ac1f40e2fba7aafc103f8921` ve launcher `v7.0.37` korunmaktadır.

Kurulum videosu: https://www.youtube.com/watch?v=Il6t2jrBy1c
