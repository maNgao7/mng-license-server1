# TikMnG 7.0.25 kontrol raporu

Hapisten Kaç 0.2.0, Teke Tek Profil 0.5.7 ve genel launcher güncellemesi.

- Kullanıcının tercih ettiği ilk Hapisten Kaç kapağı launcher ve web kataloğuna bağlandı.
- Launcher: 342 otomatik kontrol geçti. Kayıt koruma, ayrı oyun güncellemesi, tek süreç, bağlantı devri, hediye tekrarları, video kuyruğu ve Steam tarama önbelleği kapsandı.
- Teke Tek: 36 kontrol geçti. 1000 tekrar/puan dizisi ve 1000 dakika/saniye dönüşümü; gerçek yerel tarayıcı ve farklı ekran boyutları kontrol edildi.
- Sunucu: tests/release-gate.ps1 -RequireReleaseIntegrity geçti; sıfır hata. Altı isteğe bağlı tarayıcı testi atlandı; ayrıca web sitesi yedi boyutta kontrol edildi, 17 kapak açıldı ve 119 oyun ayrıntısı kontrolü geçti.
- Hapisten Kaç: mevcut modun derleme/kayıt/vakum test kapısı geçti. Paket için ek 14 güvenlik, kayıt ve tek yayın sahibi testi genel 342 kontrolün içindedir.
- Gerçek native oyun: ilk hazırlama/açılış 31,7 sn, önbellekli tekrar açılış 10,6 sn. Steam demosu doğrulanır ve ayrı oyun kopyası kullanılır. Özgün oyun dosyaları ZIP içinde dağıtılmaz.
- Gerçek oyun ekranında 30 m HUD, hazır hediye eşleştirmeleri ve ikonları, B paneli, kaydet ve çık, devam menüsü ve PNG indirme doğrulandı. Boş kayıtta görünmeyen menü düğmeleri düzeltildi ve yeniden kontrol edildi.
- Kaynak ve paketlenmiş launcher gerçek Electron önizlemesinde açıldı. Ana pencere yaklaşık 1,9 sn’de çizildi. Bu ölçüm bütün oyunların aynı sürede açılacağını garanti etmez.
- Verilen dört hesaba salt okunur canlı bağlantı testi uygulandı. Son turda lola.wqq, keremusers ve king_jux bağlı; bencezehra çevrimdışı/bekliyor. Önceki turda keremusers ve king_jux için ikişer gerçek hediye olayı alındı. Gerçek hediyenin native oyundaki eylemi bu turda gözlenmedi; sentetik test bunun yerine gerçek teslim olarak sunulmaz.
- Paketlenmiş kaynak, oyun ZIP’leri, SHA-256 ve güncelleme SHA-512 bilgileri manifest-7.0.25.json ile doğrulandı. Kişisel profiller, lisanslar, kayıtlar, önbellekler ve test katılımcıları yayımlanan dosyalara eklenmedi. Test pencereleri kapatıldı.

## Kullanılan kaynaklar

Mevcut BepInEx/HarmonyX altyapısı, Playwright, fast-check ve RTK kullanıldı. Resmî electron-builder kaynakları ayrıca indirildi; electron-updater 6.8.10 önbellek düzeltmesi sürüme alındı. TikTok Live Connector v2.4.4 kaynakları incelendi; mevcut sürüm ve tek ortak yayın oturumu korundu. Depo indirme ile uygulamaya bağımlılık ekleme ayrı tutuldu.

## Dağıtım

GitHub sürümü yayımlandıktan sonra doğrudan yeni installer indirilir. Web sitesi ve sunucunun 7.0.25 değişiklikleri için RELEASE-WORKFLOW.md uyarınca Render’dan son commit’in kullanıcı tarafından deploy edilmesi gerekir. Google Drive’a kopyalama da kullanıcı adımıdır; hazır klasördeki dosya adları değiştirilmez.

## Geri dönüş

Önceki 7.0.24 GitHub sürümü ve eski oyun ZIP’leri korunur. Güncelleme kullanıcı kayıtlarını silmez. Sunucu dağıtımı sorun çıkarırsa bir önceki commit’e dönülebilir; katalog geçişi önceki durumu yedekler ve kişisel yönetici değişikliklerini üzerine yazmaz.

## Doğrulanmış oyun arşivleri

[
  {
    "name": "profile-duel.zip",
    "bytes": 123171,
    "sha256": "1f32788cd6f6905659d35cf3b9c850d3b9462461e90a0ed43b6b66c46b609e0a"
  },
  {
    "name": "hapisten-kac.zip",
    "bytes": 123633159,
    "sha256": "053b4e16eba615f9b49aeec3c0f1b83687585d8e905a84ab4b314c7b75e92e08"
  }
]
