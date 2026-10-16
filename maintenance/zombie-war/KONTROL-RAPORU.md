# TikMnG 6.5.13 - Zombie War

## Duzeltmeler

- TikTok connector 2.5.0 modern v3 mesajlarindaki `gift.type`, `gift.name` ve `like.count` alanlari okunur. Eski veri bicimi de desteklenir.
- Hediye serisinin ilk/ara/bitis bildirimleri ayni izleyici, hediye ve grup kimligiyle izlenir. Yalnizca yeni eklenen adet uygulanir.
- Bu koruma 13 standart hediyenin tamamina ve ozel atanmis hediyelere uygulanir.
- Tekrar gelen ayni yerel WebSocket bildirimi oyun tarafinda tekrar uygulanmaz.
- Her izleyicinin 100 begenisi kayitli eylemi yeniden tetikler; kalan begeniler sonraki esik icin tutulur. Farkli izleyiciler ayri sayilir.
- Takip bildirimleri oturum boyunca izleyici basina bir kez islenir.
- Yayin servisi protokolu 9, oyun paketi ve launcher surumu 6.5.13. Diger oyun paketlerinin surumleri degismez.

## Dogrulama

- 34 Node testi: BASARILI. Mesajlar gercek TikTok v3 protobuf kodlayicisiyla olusturulup gercek connector olay isleyicisinden gecirildi.
- Java esik sayaci: 13 kontrol BASARILI (99+1, tekrar 100, 300, farkli izleyici, oturum/round sifirlama ve hediye miktarlari).
- Forge derlemesi: BASARILI.
- Minecraft oyun ici 9 senaryo: BASARILI. TikTok olay bildirimleri ve yerel WebSocket aktarimi bilerek tekrarlandi.

| Senaryo | Beklenen ve gerceklesen |
| --- | --- |
| 1 gul + seri bitisi + tekrar bildirim | 2 zombi |
| Ayni izleyiciden yeni gul | 2 yeni zombi, toplam 4 |
| 1 nazar boncugu + tekrar bildirimler | 5 zombi |
| 99 begeni | 0 zombi |
| Ardindan 1 begeni | 2 zombi |
| Ardindan 100 begeni ve ayni paket tekrari | 2 yeni zombi |
| Ardindan 300 begeni | 6 yeni zombi |
| Takip + farkli mesaj kimlikli tekrar | 2 zombi |
| Turk kahvesi + seri bitisi + tekrar bildirim | 5 orumcek |

Oyun ici sonuc: `MNG_LIVE_CHECKS_PASSED`.

Kontroller kontrollu TikTok mesajlariyla gercek Minecraft dunyasi, WebSocket alicisi, hediye kurallari ve spawn kuyrugu uzerinde yapildi. Bu surum icin harici bir yayinda gercek para ile tum hediyeler gonderilmedi.

## Dagitim

GitHub: v6.5.13. Google Drive yuklemesi ve gerekirse Render deploy islemi kullanici tarafindan yapilir.
Kurulu eski launcher da 6.5.13'e yukseltilmelidir; eski launcher 6.5.12 oyun paketine sabitlenmistir.
