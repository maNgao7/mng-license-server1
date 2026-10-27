# Minecraft PUBG ve Kartopu Savaşı 7.0.4

- Sıfırdan kurulumda görülen `compressed/uncompressed size mismatch for stored file: 2 != 0` hatası giderildi.
- Hatalı ZIP kaydına yol açan boş, geçici Java `.dll.x` dosyası iki oyunun tam kurulum paketinden ve içerik listesinden çıkarıldı.
- Oyun kodu, hediye eylemleri ve savaş kuralları 7.0.3 ile aynıdır. Mevcut çalışan kurulumların büyük ZIP paketini yeniden indirmesi gerekmez.
- İki paket de boş bir oyun kütüphanesine gerçek launcher indirme, arşiv denetimi, çıkarma ve etkinleştirme yoluyla kuruldu. Kartopu'nun 11.007, PUBG'nin 10.310 içerik dosyasının SHA-256 değeri ayrı ayrı doğrulandı.
- Eski hatalı arşivlerde bildirilen hata tekrar üretildi; güvenlik kontrolleri gevşetilmedi. Diğer oyunların kayıtları değiştirilmedi.

Bu oyun güncellemesinin launcher sürümünden bağımsız sürüm numarası 7.0.4'tür. Launcher 7.0.7 ayrıca Sesli Sürüş açılışını hızlandırır.
