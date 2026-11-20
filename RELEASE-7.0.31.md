# TikMnG 7.0.31

- **Oyna** düğmesi, widget listesinin yüklenmesini beklemeden oyun açılışını başlatır.
- **Yaratık Arena** ve **Turkish Forza** hazırlık sırasında oyun dosyalarının bütünlüğünü daha hızlı kontrol eder.
- **Turkish Forza**, pist hazır olduğunda açılış müziğini kısarak pist ekranına geçer.
- Kavanoz widgetı düzeltmeleri bu sürüme dahildir. Kurulu oyunları yeniden indirmeniz gerekmez.

# TikMnG 7.0.31 kontrol raporu

Aynı Windows bilgisayarda, aynı kurulu oyun kopyalarıyla ve her ölçümde launcher yeniden başlatılarak, **Oyna** isteğinden oyun hazır olana kadar ölçüldü. İlk kurulum ve Unity’nin ilk önbellek oluşturma süresi tabloya dahil edilmedi.

| Oyun | 7.0.30 | 7.0.31 |
| --- | ---: | ---: |
| Yaratık Arena 0.1.31 | 13,77 sn | 9,81 sn |
| Turkish Forza 0.5.6 | 23,33 sn | 14,56 sn |

- Yaratık Arena’nın ilk karesi ve Forza’nın Tsukuba’da serbest kamera, sıfır araç ve bekleme durumu doğrulandı. Test oturumları yerel test lisansıyla çalıştı.
- Soğuk launcher hazırlık denemesinde Arena 5,52 sn’den 1,94 sn’ye, Forza 3,33 sn’den 2,39 sn’ye indi. İki sürümde de aynı sayıda dosyanın SHA-256 değeri doğrulandı.
- Launcher sürüm kapısı 412 testle geçti. Sunucu sürüm ve paket bütünlüğü kapısı geçti. Altı isteğe bağlı tarayıcı testi varsayılan sunucu ortamında atlandı.
- 7.0.31 paketinde kavanoz bağlantıları, kayıtlı hediyeler, yeni seri hediye, tekrar olay koruması ve sıfırlama yeniden doğrulandı.
- 7.0.30 ile paket karşılaştırmasında yalnızca beklenen altı dosya değişti. Diğer 6.151 dosya birebir eşleşti. Kurulum dosyası boyutu ve SHA-512 değeri güncelleme bilgisiyle eşleşti.
