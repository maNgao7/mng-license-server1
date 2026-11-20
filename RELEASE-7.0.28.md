# TikMnG 7.0.28 — Yeni oyun: Fetih

Fetih artık TikMnG oyun kütüphanesinden indirilebilir. Türkiye haritasına izleyici ordularını yerleştir; asker, tank, helikopter ve jetlerle gerçek zamanlı savaşı yönet.

- **Steam kurulumu gerekmez.** Oyun motoru Windows paketine dahildir. Launcher’dan Fetih’i yükleyip Oyna düğmesiyle açabilirsin.
- **Altı adımlı kurulum ve kullanım anlatımı:** yayın bağlantısı, orduları haritaya sürükleme, hediye/beğeni/takip eylemleri, kamera kontrolleri, savaş sonucu ve Ülke Liderleri widget’ı oyun sayfasında açıklanır.
- **Yayın rehberini mutlaka kullan:** oyun içindeki “İhlal riskini azaltma rehberi”, gerçek LIVE Studio ekranlarıyla kamera, oyun ve isteğe bağlı kayıtlı klip düzenini gösterir. Kayıtlı klibi açıkça belirt; rehber platform kurallarına uyma yükümlülüğünü kaldırmaz.
- **Hazır hediye görseli:** onaylanan orijinal PNG, launcher’ın Fetih sayfasında görünür ve indirilebilir. Görseldeki eylemleri kullanacaksan B menüsündeki hediye ve miktar ayarlarını aynı şekilde eşleştir.
- **Yayın etkileşimleri:** varsayılan 1 coin 50 asker; her 500 askerde helikopter, her 1.000 askerde jet. Beğeni, takip ve hediye eylemleri oyun içinden ayarlanabilir. Bölgesi olan izleyicinin sohbetten yazdığı saldır isteği listede görünür.
- **Savaş ve sunum:** yakınlaşıp savaş seslerini duy, ok tuşlarıyla açıyı ayarla, T ile yalnızca haritayı göster. Savaşı bitirdiğinde kazanan Fetih sahnesinde ilan edilir; yeni tur temiz haritayla açılır.

Mevcut launcher renkleri, logo ve diğer oyun paketleri korunmuştur. Önceki oyun kurulumlarını kaldırman gerekmez.

## Dosyalar

- `TikMnG-Setup-7.0.28.exe`: normal kurulum ve güncelleme.
- `TikMnG-7.0.28-Portable.exe`: taşınabilir launcher.
- `Fetih-Windows-x64.zip`: oyun motoru dahil Fetih 0.1.0 paketi; launcher otomatik indirip kurar.
- `TikMnG-Fetih-Hediyeler.png`: orijinal hazır hediye görseli.
- `manifest-7.0.28.json`: boyut ve SHA-256 doğrulama bilgileri.
- `KONTROL-RAPORU.md`: bu yayında uygulanan kontroller ve sınırları.


# TikMnG 7.0.28 / Fetih 0.1.0 kontrol raporu

20 Kasım 2026. Render dağıtımı bu çalışmada yapılmadı; kullanıcı tarafından başlatılacak.

## Tamamlanan kontroller

- Launcher tam sürüm kapısı: 410 test geçti, hata yok.
- Sunucu tam sürüm kapısı ve paket bütünlük denetimi: hata yok; altı isteğe bağlı tarayıcı testi varsayılan ortamda atlandı.
- Ek yerel web tarayıcı kontrolü: mobil ve masaüstü katalog, JavaScript kapalıyken tüm oyun sayfaları, Fetih kapağı ve hediye görseli bağlantısı geçti.
- Onaylı oyun kaynaklarının tam sürüm kapısı: Godot 4.3 mevcut oyun kontrolleri, iki harita, hava araçları, ortak yayın köprüsü ve iki yükleme yolu geçti.
- Bağımsız Godot 4.7.2 Windows paketinin gerçek açılışı, savaş, sonuç ve temiz tur senaryosu geçti.
- Paketlenmiş 7.0.28 launcher: yönetici önizlemesi kullanılmadan gerçek ZIP kurulumu, Fetih sayfası, altı açıklama, hediye PNG indirmesi ve yerel oyun açılışı geçti. İkinci Oyna isteği mevcut oturumu kullandı.
- Son uygulama arşivi test edilen kaynaklarla eşleşti. Önceki genel sürümün renkleri ve icon-v4 logosu birebir korundu; özel önizleme dosyaları dışarıda bırakıldı.
- Fetih ZIP içindeki 3.611 dosya ve 162 Godot paket girdisi doğrulandı. Steam çalıştırıcısı veya Steam runtime bağımlılığı yok.
- Oyun, hediye görseli ve kurulum dosyalarının boyutları ve SHA-256 değerleri manifestte; otomatik güncelleme dosyasının SHA-512 değeri gerçek kurulumla eşleşiyor.
- Mevcut yönetici katalog düzenlemelerinin korunması ve eski standart kataloğun tek seferlik yükseltilmesi regresyon testlerinden geçti.

## Doğrulama sınırı

Bu sürüm kontrolleri yerel ve sentetik oturumlarla yapıldı. Gerçek TikTok yayınında yeni hediye teslimi veya her uzak hesabın portre kaynağı ayrıca yeniden test edilmiş sayılmaz. Onaylı oyun paketi değiştirilmeden yayımlandı. Render sonrası canlı site/sürüm denetimi bu rapora dahil değildir.

## Geri alma

Yeni bir sorun görülürse önceki sunucu commit’i ve v7.0.27 launcher yayını kullanılabilir. Kullanıcı kayıtlarını ve oyun kurulumlarını silmek gerekmez; bu yayın veritabanı şeması değişikliği içermez.
