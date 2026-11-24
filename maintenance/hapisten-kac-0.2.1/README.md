# Hapisten Kaç 0.2.1

Kazı sırasında kazanılan alet, kullanım ve zaman aşımına karşı korunur. Geçici aletin süresi dolduğunda kazanılan kademeye geri dönülür. Düşürme hediyesi ve yeni tur normal şekilde çalışır.

Yardımcılar oyuncunun yanındaki ayakta durulabilir bir konumda belirir. Oyuncu ilerlerse yanına döner ve baktığı yönde kazıya devam eder. Farklı yönlerdeki duvarlar arasında seçim yaparken çıkış yönünü de hesaba katarlar.

Matkap her blok için ayrı işlem başlatmak yerine oyunun yerleşik kazı işlemini kullanır. Başlangıç hücresinden uzaktayken duvar dekoru güncellemesi atlanır.

## Doğrulama

- Ayrı Unity kurulumunda hediye eylemleriyle yükseltme, aşınma, süre sonunda aletin korunması, kemer yuvasının değişmesi, düşürme ve temiz başlangıç denendi.
- 30 metrelik rotada çıkışa 5,46 metre kala yardımcı kendi başına kazdı. Oyuncu başlangıca döndüğünde onu takip etti. Kaçış sayacı, galibiyet ve temiz yeni tur doğrulandı.
- 640 × 360 pencerede, derin tünelde yardımcıyla birlikte 90 saniyede 894 matkap teması ve 78.435 blok kırılması kaydedildi. Unity kare sürelerinin yüzde 99'u 5,9 ms veya daha kısa, en uzunu 40,9 ms idi. Bu ölçüm tek bilgisayara aittir.
- Dağıtım arşivindeki 4.750 dosyanın boyutu ve SHA-256 özeti doğrulandı. Launcher ile paket 0.2.1 açıldı ve canlı oturum bağlandı. Canlı bağlantı üzerinden beğeni ve hediye alındı. Belirli alet ve yardımcı eşleşmeleri yerel oyun olaylarıyla sınandı. Kullanıcıların bildirdiği kapanma için hata kaydı bulunmadığından özgül neden belirlenemedi.

Masaüstü modunun eklenti kaynakları ile dağıtılan eklenti aynıdır. Launcher paketindeki yayın köprüsü launcher oturumunu paylaşır. Paket Steam uygulaması 5466880, derleme 26583894 ile kullanılır. Kaynakların tamamı arşivde `provenance/plugin-source` altındadır. Test senaryoları yalnız ayrı oyun kopyasına eklenir.