# Dünya oyun atlası

`world.json`, Natural Earth 1:110m ülke sınırlarından oluşturulmuştur. Girdi,
HyperFrames testleriyle yerelde gelen world-atlas `countries-110m.json`
dosyasıdır. Natural Earth verisi kamu malıdır.
[Natural Earth kullanım koşulları](https://www.naturalearthdata.com/about/terms-of-use/)

`build/generate-world.py`, Shapely 2.1.2 ile ülke sınırlarını 34 oyun
bölgesinde birleştirir. Oyun bölgelerinin sınırları ve kesikli deniz yolları
oynanış için uyarlanmıştır. Antarktika kapsam dışıdır. Küçük adalar kıyı
ayrıntısı olarak gösterilir. Bölge sırası `world-v1.json` içindeki
`mapWorlds.world` kayıtlarının kimliklerini belirler.
