# FETİH 0.1.5 bakım ve doğrulama

## 0.1.4 üzerine uygulanacak dosyalar

`delta.json` içindeki her `file` kaydını tam 0.1.4 derleme ağacındaki `target` yoluna kopyalayın. `remove` kaydı yalnızca hazırlanan yeni derleme ağacı için geçerlidir. Godot modülleri ve ses dosyaları `project/`, dağıtılan rehber görseli ve README ise `payload/` altında çalışır.

0.1.4 ve iki ardışık önizlemenin paket indeksleri karşılaştırıldı. İlk önizleme bekleyen hediye akışını, ikincisi bağımsız rehberleri içerir. Orijinal MP4, 0.1.4 paketiyle bayt düzeyinde aynıdır. Önizleme 2 ile kararlı PCK arasındaki oyun kodu farkı LiveWar içindeki özel eşleşmenin saklanma biçimidir. Kararlı sürüm numarası derlenmiş proje ayarındadır.

## Oyun ve kayıt

Olaylar paket içindeki LIVE köprüsünden gelir. Launcher yayın oturumunu açtıysa oyun köprüsü bu oturumu kullanır. Doğrudan açılışta yayıncı oyundan bağlantı kurabilir. Hediye kuyruğu, köprünün olay kimliğini ve ait olduğu haritayı korur.

`TIKMNG_ANIMAL_PROFILE` oyun veri dizinini seçer. Standalone varsayılanı `%LOCALAPPDATA%/TikMnG/FetihStandalone` dizinidir. Mevcut ayarlar `settings-v1.json`, tur ve bekleyen işlemler `world-v1.json`, portre önbelleği `avatars/` üzerinden yüklenir.

## Yerel doğrulama

- Godot 4.7.2 resmi Windows x64 sürümüyle tam `tests/release-gate.ps1` kapısı ve üç köprü testi geçti. Doğrudan ve ortak bağlantıda tekrarlanan hediye teslimi sentetik olaylarla sınandı.
- Yeni ZIP ayrı bir dizine çıkarıldı. Paketin kendi Fetih.exe dosyası açılış, Türkiye haritası, ordu yerleştirme, yayıncının başlattığı muharebe, zafer ekranı ve temiz sonraki turu geçti. İki rehberin menü girişleri, üç rehber görseli, özgün MP4 indirmesinin SHA-256 eşitliği ve ayrı dilekler görseli de aynı çalıştırmada doğrulandı.
- Hediye testinde ilk onay, kuyrukta ve onaydan sonra yinelenen mesaj, bekleme sırasında harita değişimi, yeniden açılış, tur sonu ve ertelenen saldırının sonradan onayı geçti.
- Paketlenmiş PCK, doğrulanmış Godot ikilisiyle `--main-pack` üzerinden açıldı. `tests/check-packaged-startup.gd` ana oyun sahnesini çalıştırdı ve 0.1.5 sürüm alanını, temiz haritayı ve köprünün beklemesini doğruladı. Boş kurulum, yalnızca oyun seçeneklerini içeren izole kayıt ve farklı hasar değerli sentetik kayıt geçti. Kayıtlı hediye kuralları, araç güçleri ve füze hasarı eşleşti. Asıl ayar dosyasının çalışma öncesi ve sonrası özeti eşitti.
- Bakım doğrulaması yerel ve sentetiktir. Bu sürüm kapısında gerçek yayın bağlantısı veya gerçek hediye teslimi sınanmadı.

Windows x64 ZIP boyutu 178128539 bayttır. SHA-256 `fafea22857e06fef45a17839af28e96d3b47d0b666869beac9dcb9a53b45808c`. İçerik dökümünde 4521 ZIP dosyası ve 186 Godot paket girdisi vardır.
