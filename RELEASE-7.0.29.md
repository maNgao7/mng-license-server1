# TikMnG 7.0.29 — Fetih tanıtım ve kurulum videosu

Fetih’in oyun sayfasına **Kurulum videosunu izle** düğmesi eklendi. Düğme doğrudan [Fetih tanıtım ve kurulum videosunu](https://youtu.be/v1PtHDv3VhM) YouTube’da açar.

Fetih 0.1.0 oyun paketi, altı maddelik rehber, hazır hediye görseli ve kayıtlı ayarlar korunur. Oyunu yeniden indirmek gerekmez; bu küçük değişiklik launcher 7.0.29 güncellemesiyle gelir.

Launcher’ın mevcut renkleri ve diğer oyunların video bağlantıları aynıdır.


# TikMnG 7.0.29 kontrol raporu

- Launcher tam sürüm kapısı: 410 test geçti, hata yok.
- Sunucu tam sürüm kapısı ve paket bütünlüğü denetimi: hata yok; altı isteğe bağlı tarayıcı testi varsayılan ortamda atlandı.
- Paketlenmiş launcher’da Fetih sayfası açıldı. Video düğmesinin adresi ve gerçek tıklamanın dış bağlantı işleyicisine ilettiği URL `https://youtu.be/v1PtHDv3VhM` olarak doğrulandı. Bu test dış tarayıcı açılışını yakalar; YouTube oynatma testi değildir. Bağlantının kamuya açık sayfası ayrıca kontrol edildi.
- Son uygulama arşivinde yalnızca `package.json` ve `renderer/workspace.js` değişti. Diğer 6.154 dosya önceki genel sürümle birebir eşleşiyor.
- Gerçek oyun ZIP kurulumu, altı anlatım maddesi, orijinal hediye PNG indirmesi, native oyun açılışı ve tekrar Oyna ile tek oturumun kullanılması geçti.
- Kurulum dosyasının SHA-512 değeri otomatik güncelleme bilgisiyle eşleşti; boyut ve SHA-256 değerleri manifestte bulunur.

Fetih 0.1.0 oyun paketi değiştirilmedi. Yeni launcher için oyunu yeniden indirmek gerekmez. Render dağıtımı kullanıcıya bırakıldı.
