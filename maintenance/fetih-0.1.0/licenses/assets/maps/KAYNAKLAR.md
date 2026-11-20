# Türkiye oyun atlası

`turkiye.json` 81 ilin geometrisinden birleştirilen 15 oyun bölgesini içerir.
Oyun bölgelerinin sınırları ve köprü simgelerinin ölçeği oynanış için
uyarlanmıştır. Adalar ve göller oyun alanı ayrıntısı olarak gösterilir.

- Kıyılar ve il geometrisi geoBoundaries TUR ADM1 (TUR-ADM1-25984515,
  9469f09), © OpenStreetMap katkıcıları. Veri kaydı CC BY-SA 2.0 belirtiyor.
  Birleştirilmiş ve sadeleştirilmiş sınır verisi aynı lisans altında.
  [Kaynak kaydı](https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM1/)
  · [OSM atfı](https://www.openstreetmap.org/copyright)
  · [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)
- Göl geometrileri Natural Earth 1:10m Lakes + Reservoirs, v5.1.2.
  [Veri](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/)
  · [Kullanım koşulları](https://www.naturalearthdata.com/about/terms-of-use/)
- Boğaz köprülerinin adları Karayolları Genel Müdürlüğünün kaydına dayanır.
  Küçük köprü ve şehir modelleri bu oyun için oluşturulmuştur.
  [KGM köprüleri](https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Projeler/ABProjeleri/4-SENSKIN%20%28Sabri%20TEK%C4%B0N%29.pdf)

`build/generate-turkiye.py` kaynak GeoJSON dosyalarını Shapely 2.1.2 ile
birleştirir. Oyun açılışta paket içindeki atlası okur.
