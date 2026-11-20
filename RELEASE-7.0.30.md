# TikMnG 7.0.30

- Kavanoz widgetları yeniden açıldığında biriken hediyeleri geri yükler.
- Yeni hediyeler ve seri hediyeler yayın kaynağında görünür. Aynı hediye olayı tekrar gelirse ikinci kez işlenmez.
- Launcher’dan kopyalanan yayın bağlantıları, bağlı yayın sunucusunun HTTPS adresini kullanır. Eski bağlantı açılmıyorsa launcher’ı güncelledikten sonra widget bağlantısını yeniden kopyalayıp yayın kaynağına yapıştırın.
- Oyun paketleri ve kayıtlı ayarlar korunur. Oyunları yeniden indirmeniz gerekmez.

# TikMnG 7.0.30 kontrol raporu

- 7.0.29’da kavanoz çeşidine ait ilk durum yanıtı, kayıtlı üç hediye yerine boş bir liste döndürdü. 7.0.30’da normal istek ve değişiklik isteği üç hediyeyi de döndürdü.
- Paketlenmiş launcher, yerel yayın aktarım sunucusu ve Chromium ile Klasik Cam, Cam Fanus ve Pofuduk Kedi kavanozlarının ayrı yayın bağlantıları doğrulandı. Kayıtlı hediyeler geri geldi. İki parçalı yeni seri hediye iki parça olarak gösterildi. Aynı olay kimliği tekrar geldiğinde toplam artmadı. Kaynak yenileme ve sıfırlamadan sonra yeni hediye kontrolleri geçti.
- İlk eşitlemenin ardından kavanoz geçmişi tekrar gönderilmedi. Test hediyeleri gerçek TikTok yayınından gelmedi.
- Launcher sürüm kapısı 411 testle geçti. Sunucu sürüm kapısı ve paket bütünlüğü kontrolü geçti. Altı isteğe bağlı sunucu tarayıcı testi varsayılan ortamda atlandı.
- Paket arşivinde beş dosya değişti ve diğer 6.151 dosya önceki sürümle birebir eşleşti. Kurulum dosyasının boyutu ve SHA-512 değeri güncelleme bilgisiyle eşleşti.
