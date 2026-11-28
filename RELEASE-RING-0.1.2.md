Ring 0.1.2 — güncelleme kurulum hatası düzeltildi

0.1.1 güncellemesinde görülen `Archive version disagrees with package version` hatası düzeltildi. Eski tabandan kalan dış kurulum sürümü oyun sürümüyle eşitlenmediği için launcher kurulumu reddediyordu.

- Arşiv, uygulama ve native manifest artık aynı 0.1.2 sürümünü taşıyor.
- Yeni indirme adresi ve hash eski hatalı paket önbelleğini kullanmıyor.
- Oynanış, kamera, yumruk, sıra ve yayın bağlantısı dosyaları 0.1.1 ile bayt bazında aynı; 0.1.1 düzeltmeleri korunuyor.
- Paketleyiciye üç sürümün eşitliğini ve paket kimliğini zorunlu doğrulayan kontrol eklendi.

Doğrulama: launcher 7.0.39'un gerçek kurulum koduyla hatalı eski ZIP'in reddi, yeni ZIP ile mevcut sürümden güncelleme ve sıfırdan kurulum geçti. Örnek ayarlar/kayıtlar ve diğer oyun korundu; tekrar kurulum gereksiz indirme yapmadı. Dokuz paket sözleşmesi kontrolü, Ring tam sürüm kapısı ve sunucu sürüm kapısı geçti. Bu paketleme düzeltmesinde yeni gerçek TikTok hediyesi gönderilmedi; oynanış dosyaları değişmediği için özgün 0.1.1 canlı kanıtı ayrı ve açıkça korunuyor.

Önce Ring'i kapatın, TikMnG'de oyun kataloğunu yenileyin ve Ring 0.1.2 güncellemesini seçin. Launcher'ı veya diğer oyunları yeniden kurmanız gerekmez. Steam Online Boxing 3D Demo (4793540) gereksinimi sürer.

GitHub yayını hazırlandı. Launcher kataloğunun yeni sürümü göstermesi için ilgili commit Render'da kullanıcı tarafından dağıtılmalıdır.
