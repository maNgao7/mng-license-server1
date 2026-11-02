# Yaratık Arena 0.1.23

Yalnızca Yaratık Arena oyun güncellemesidir. TikMnG Launcher 7.0.15 olarak kalır.

## Yenilikler

- Boss canı 240, Big Boss canı 480 oldu. Önceki değerlerin iki katıdır. Boyut, yüzdeye dayalı hasar ve büyük yaratıkların daha yavaş saldırı ritmi korunur.
- Tabancada 12, Uzi ve AK-47'de 30, pompalıda 6, rokette 1 mermilik şarjör vardır. R ile doldurulur; boşalınca otomatik doldurma başlar. Doldururken ateş edilmez ve silah indirme hareketi oynar. Yedek mermi sınırsızdır.
- Silah veya vakum değiştirerek şarjör bedelsiz doldurulamaz. Otomatik oynanış da aynı şarjör kurallarına uyar.
- Alev silahı 4 saniyelik kesintisiz ateşle aşırı ısınır. 5 oyun saniyesi soğuyana kadar ateş edemez. Silah değiştirmek soğumayı silmez. Menüde şarjör ve soğuma süreleri durur.
- Mermi ve hararet göstergesi can göstergesiyle aynı krem, koyu lacivert ve turuncu detaylı temaya geçti. Can göstergesi yaklaşık yüzde 12 büyütüldü. Küçük ekranlarda göstergeler birbirinin üstüne gelmez.
- Kalabalıkta yol istekleri adil sırayla işlenir; arkadaki yaratıklar yol hesabından mahrum kalmaz. Farklı yaklaşma noktaları, yakın komşudan kaçınma ve aynı kattaki yan yaklaşma rotaları eklendi.
- Canlı yaratıkların oyuncuyu fiziksel olarak itmesi kapatıldı; saldırı hasarı devam eder. Dünya duvarları, zemin, kafes koruması, silah ve vakum sorguları korunur. Ölü bedenlerin normal fiziksel davranışı geri gelir.
- Değişmeyen oyuncu kapsülünün her karede yeniden oluşturulması kaldırıldı. Fizik hareketi yumuşatıldı; yaratıklar çarpışmanın ittiği yöne göre titreyerek dönmez. Boss adımlarındaki istenen kısa sarsıntı korunur.

## Kurulum

Launcher'da Yaratık Arena için Güncelle düğmesini kullanın. Steam demosunu yeniden indirmek, launcher'ı kaldırmak veya Drive'daki launcher kurulum dosyasını değiştirmek gerekmez. Kayıtlı yayın hesabı, hediye/beğeni/takip eylemleri ve ses ayarları korunur.

Yeni kurulum için ücretsiz Can 'Em All Demo gereksinimi devam eder:
https://store.steampowered.com/app/5364590/

## Paket

- Arşiv: `yaratik-arena.zip`
- Boyut: `151519428` bayt
- SHA-256: `f66af3d9536f5c5dfa61f16d80e500853abbb2089ab82419ec45b866af8f09b0`
- Dağıtım: https://github.com/maNgao7/mng-license-server1/releases/tag/yaratik-arena-0.1.23

Steam'in orijinal dosyaları, kullanıcı kayıtları ve hesap anahtarları arşive dahil değildir. Oyun paketi doğrudan GitHub'dan iner; Render üzerinden aktarılmaz.

## Katalog Güvenliği

Rev13 kataloğunun değişmez kopyası `content-bootstrap-arena-0.1.22.json` dosyasında tutulur. Yalnızca taslak ve yayınlanan katalog bu eski sürümle tam eşleşiyorsa rev14'e geçirilir. Sadece Arena'nın sürümü, URL'si, boyutu ve SHA-256 değeri ile katalog revizyonu ve yayın zamanı değişir. Diğer oyunlar, medya, launcher bilgisi ve lisans kayıtları değiştirilmez. Yönetici tarafından özelleştirilmiş kataloglar otomatik olarak ezilmez.

## Doğrulama

Ayrıntılı kanıtlar `maintenance/yaratik-arena-0.1.23/VERIFICATION.json` ve bu klasördeki `qa` raporlarıdır. 438 oyun mantığı kontrolü ve 153 sunucu/tarayıcı testi geçti; atlanan veya başarısız test yok. Temiz kurulum, ayar koruyan yükseltme, gerçek paket içinden şarjör/hararet, 180 ve 600 yaratıkla takip, merdiven, kafes, normalize edilmiş hediye/beğeni/takip olayları ve normal kapanış testleri tekrar tamamlandı. Üç gerçek açılış/kapanış döngüsü sıfır çıkış koduyla bitti. Yükseltmede Steam oyunundan yeniden kopyalanan veri sıfır bayttı.

Canlı sohbete mesaj veya ücretli hediye gönderilmez. Kalabalık testleri bu bilgisayarı temsil eder; bütün müşteri donanımları için performans garantisi değildir.
