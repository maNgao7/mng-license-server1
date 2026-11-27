'use strict';

const number = (key, label, value, min, max, step = 1) => ({ key, label, value, min, max, step, type: 'number' });
const text = (key, label, value = '', type = 'text') => ({ key, label, value, type });
const check = (key, label, value = true) => ({ key, label, value, type: 'checkbox' });
const select = (key, label, value, options) => ({ key, label, value, type: 'select', options });
const common = [text('title', 'Baslik'), text('accent', 'Vurgu rengi', '#5ce8cc', 'color'), select('background', 'Arka plan', 'transparent', [['transparent', 'Saydam']]), select('format', 'Yayin bicimi', 'landscape', [['landscape', 'Yatay'], ['portrait', 'Dikey'], ['compact', 'Kompakt']]), number('scale', 'Boyut (%)', 100, 25, 180), number('opacity', 'Opaklik (%)', 100, 0, 100), number('offsetX', 'Yatay konum', 0, -1920, 1920), number('offsetY', 'Dikey konum', 0, -1920, 1920)];
const sound = [check('sound', 'Ses efekti', false), number('volume', 'Ses seviyesi (%)', 35, 0, 100)];
const gifts = [text('giftId', 'Hediye kimligi'), number('giftMinCoins', 'En az coin', 1, 1, 1000000)];
const count = number('itemCount', 'Gorunur kisi', 5, 1, 12);
const duration = number('duration', 'Gosterim suresi (sn)', 6, 2, 30, .5);
const metric = select('metric', 'Hedef kaynagi', 'totalCoins', [['totalCoins', 'Coin'], ['totalLikes', 'Begeni'], ['followers', 'Takip'], ['totalShares', 'Paylasim'], ['subscribers', 'Abonelik'], ['totalGifts', 'Hediye']]);
// Layout/source metadata is also consumed by fixture tools, never inferred from a display name.
const specs = [
    ['likepodium', 'Begeni Sampiyonlari', 'SIRALAMA', 'Begeni', 'Uc basamakli cam kursu, yukselen lider ve kalan izleyici seridi.', 'podium', 'topLikes'],
    ['likelist', 'Begeni Canli Liste', 'SIRALAMA', 'Begeni', 'Sabit avatarli, sirali ve oransal cubuklu dikey skor tablosu.', 'list', 'topLikes'],
    ['likecarousel', 'Begeni Vitrini', 'SIRALAMA', 'Begeni', 'Sirayla odaga gelen buyuk portre ve minyatur gezinme seridi.', 'carousel', 'topLikes'],
    ['likeorbit', 'Begeni Yorungesi', 'SIRALAMA', 'Begeni', 'Ortada lider, sabit kimlikli uydu portreler ve eliptik izler.', 'orbit', 'topLikes'],
    ['likecards', 'Begeni Koleksiyonu', 'SIRALAMA', 'Begeni', 'Yan yana uzanan numarali, buyuk portreli izleyici kartlari.', 'cards', 'topLikes'],
    ['giftvault', 'Destek Hazinesi', 'SIRALAMA', 'Destek', 'Coin miktarina gore yukselen altigen destekci basamaklari.', 'vault', 'topGifters'],
    ['giftmarquee', 'Destekci Gecidi', 'SIRALAMA', 'Destek', 'Gecen coin siralamasi, dikey ayiricilar ve ince altin hat.', 'marquee', 'topGifters'],
    ['giftmosaic', 'Destekci Mozaigi', 'SIRALAMA', 'Destek', 'Lideri buyuten portre mozaigi ve her hucrede gercek coin.', 'mosaic', 'topGifters'],
    ['giftscepter', 'Destegin Muhru', 'VITRIN', 'Destek', 'Coin lideri icin islemeli madalyon ve iki yanda ikinciler.', 'scepter', 'topGifters'],
    ['memberportal', 'Katilim Kapisi', 'BILDIRIM', 'Katilim', 'Yayina katilan kisinin cevresinde acilan capraz isik kapisi.', 'portal', 'member'],
    ['memberticket', 'Yayina Bilet', 'BILDIRIM', 'Katilim', 'Katilimci portresi ve kullanici adi ile delikli giris bileti.', 'ticket', 'member'],
    ['followradar', 'Takip Radari', 'BILDIRIM', 'Takip', 'Takipcinin portresini bulan radar taramasi ve koordinat izleri.', 'radar', 'follow'],
    ['followribbon', 'Takip Kurdelesi', 'BILDIRIM', 'Takip', 'Portreden acilan asimetrik katli takip kurdelesi.', 'ribbon', 'follow'],
    ['sharecomet', 'Paylasim Kuyrukluyildizi', 'BILDIRIM', 'Paylasim', 'Paylasimci portresinden yayilan renkli uzun izler.', 'comet', 'share'],
    ['sharewave', 'Paylasim Dalgasi', 'BILDIRIM', 'Paylasim', 'Merkezde gercek profil ve disari acilan paylasim halkalari.', 'wave', 'share'],
    ['submarquee', 'Abone Sahnesi', 'BILDIRIM', 'Abonelik', 'Abone portresi icin tiyatro isiklari ve genis isim sahnesi.', 'theater', 'subscribe'],
    ['subseal', 'Abonelik Rozeti', 'BILDIRIM', 'Abonelik', 'Kesimli yildiz muhru, abone portresi ve iki kuyruklu rozet.', 'seal', 'subscribe'],
    ['giftmeteor', 'Hediye Meteoru', 'ANIMASYON', 'Hediye', 'Gercek hediye gorseli ve coin degeriyle diyagonal meteor izi.', 'meteor', 'gift'],
    ['giftunbox', 'Hediye Acilisi', 'ANIMASYON', 'Hediye', 'Acilan kurdeleli kutudan yukselen hediye ve gonderen kimligi.', 'unbox', 'gift'],
    ['giftreceipt', 'Hediye Fisi', 'BILDIRIM', 'Hediye', 'Hediye adi, adet ve coin iceren yazarkasa fisi.', 'receipt', 'gift'],
    ['combocounter', 'Kombo Tipografisi', 'ANIMASYON', 'Hediye', 'Coklu hediyenin gercek tekrar adedini buyuk tipografiyle gosterir.', 'combo', 'gift'],
    ['combotower', 'Kombo Kulesi', 'ANIMASYON', 'Hediye', 'Gercek kombo adedine gore aydinlanan katlar ve yanda portre.', 'tower', 'gift'],
    ['likebloom', 'Begeni Cicegi', 'ANIMASYON', 'Begeni', 'Begenen kisinin etrafinda acilan kalp tac yapraklari.', 'bloom', 'like'],
    ['chatbubble', 'Sohbet Balonu', 'BILDIRIM', 'Sohbet', 'Gercek mesaji portreye bagli konusma balonunda one cikarir.', 'bubble', 'chat'],
    ['likegauge', 'Begeni Gostergesi', 'HEDEF', 'Hedef', 'Yarim daire kadran ve gercek begeni toplami.', 'gauge', 'stats', 'totalLikes'],
    ['coinring', 'Coin Halkasi', 'HEDEF', 'Hedef', 'Kesikli konsantrik coin halkalari ve merkezde kalan miktar.', 'ring', 'stats', 'totalCoins'],
    ['followsteps', 'Takip Basamaklari', 'HEDEF', 'Hedef', 'Her esikte dolan basamaklar, iz ve takip toplami.', 'steps', 'stats', 'followers'],
    ['sharebridge', 'Paylasim Koprusu', 'HEDEF', 'Hedef', 'Paylasimlarla tamamlanan asma kopru ve ilerleme isaretleri.', 'bridge', 'stats', 'totalShares'],
    ['subconstellation', 'Abone Takimyildizi', 'HEDEF', 'Hedef', 'Abonelerle yanan dokuz yildiz ve baglanti cizgileri.', 'stars', 'stats', 'subscribers'],
    ['giftthermometer', 'Hediye Termometresi', 'HEDEF', 'Hedef', 'Dikey cam hazne, seviye cizgileri ve toplam hediye sayisi.', 'thermo', 'stats', 'totalGifts'],
    ['communityquest', 'Topluluk Gorevleri', 'HEDEF', 'Hedef', 'Begeni, takip ve coin icin birbirinden bagimsiz uc gorev.', 'quest', 'stats'],
    ['goalodometer', 'Canli Hedef Sayaci', 'HEDEF', 'Hedef', 'Secilen yayin metrigini mekanik rakam sutunlarinda gosterir.', 'odometer', 'stats'],
    ['hypeequalizer', 'Topluluk Ekolayzeri', 'TOPLULUK', 'Topluluk', 'Son etkilesimlerin yogunluguna gore tepki veren ses cubuklari.', 'equalizer', 'activities'],
    ['hypereactor', 'Topluluk Reaktoru', 'TOPLULUK', 'Topluluk', 'Son etkilesimlerden enerji toplayan uc kollu cekirdek.', 'reactor', 'activities'],
    ['hypewave', 'Yayin Nabzi', 'TOPLULUK', 'Topluluk', 'Gercek etkilesim yogunlugunu cizen osiloskop ve anlik olay sayisi.', 'pulse', 'activities'],
    ['activityrail', 'Etkilesim Rayi', 'AKIS', 'Akis', 'Olay turu simgeleriyle kronolojik dikey etkinlik rayi.', 'rail', 'activities'],
    ['socialticker', 'Canli Haber Bandi', 'AKIS', 'Akis', 'Gercek yayin olaylarini ince kayan haber bandinda sunar.', 'ticker', 'activities'],
    ['broadcaststrip', 'Yayin Alt Seridi', 'AKIS', 'Akis', 'Coin, begeni ve takip toplamlarini yayin alt kusaginda sunar.', 'strip', 'stats'],
    ['communitywall', 'Topluluk Duvari', 'TOPLULUK', 'Topluluk', 'Son farkli izleyicileri petek dokulu bir portre duvarinda toplar.', 'wall', 'activities'],
    ['supporterspotlight', 'Destekci Spotu', 'VITRIN', 'Destek', 'Gercek liderin portresine yonelen iki sahne projektoru.', 'spotlight', 'topGifters'],
    ['chatspotlight', 'Sohbet Alintisi', 'VITRIN', 'Sohbet', 'Bir izleyici mesajini genis alinti dizgisinde gosterir.', 'quote', 'chat'],
    ['firstarrival', 'Katilim Yoklamasi', 'AKIS', 'Katilim', 'Yeni katilanlari zaman cizgili numarali yoklama olarak sunar.', 'arrival', 'member'],
    ['chatpoll', 'Sohbet Oylamasi', 'ETKILESIM', 'Sohbet', 'A ve B komutlariyla oy; kisi basina son oy gecerlidir.', 'poll', 'chat'],
    ['keywordrace', 'Sohbet Kelime Yarisi', 'ETKILESIM', 'Sohbet', 'Secili iki kelimeyi farkli izleyicilerin mesajlarinda sayar.', 'race', 'chat']
];

const definitions = specs.map(([id, name, kind, category, description, layout, source, sourceMetric]) => {
    const event = ['member', 'follow', 'share', 'subscribe', 'gift', 'like', 'chat'].includes(source);
    let fields = [...common];
    fields.push(select('theme','Sahne teması','platinum',[['platinum','Platin'],['inferno','Alev'],['rose','Pembe kristal'],['botanical','Çiçek bahçesi']]),select('quality','Görsel kalite','auto',[['auto','Otomatik'],['high','Yüksek'],['low','Düşük']]));
    if (event || source === 'activities') fields.push(duration, ...sound);
    if (source === 'gift') fields.push(...gifts);
    if (layout === 'unbox') fields.push(select('unboxStyle', 'Acilis stili', 'reel', [['reel', 'Hediye ruleti'], ['case', 'Kasa acilisi'], ['pack', 'Kart paketi']]));
    if ((['topLikes', 'topGifters', 'activities'].includes(source) && !['spotlight', 'equalizer', 'reactor', 'pulse'].includes(layout)) || layout === 'arrival') fields.push({ ...count, label: 'Katilimci sayisi' });
    if (layout === 'carousel') fields.push(number('cycleSeconds', 'Portre gecisi (sn)', 5, 2, 30));
    if (source === 'stats') fields.push(number('goal', 'Hedef', sourceMetric === 'totalLikes' ? 10000 : sourceMetric === 'totalCoins' ? 5000 : 100, 1, 100000000), ...(layout === 'odometer' ? [metric] : []));
    if (layout === 'quest') fields.push(number('likeGoal', 'Begeni hedefi', 10000, 1, 100000000), number('followGoal', 'Takip hedefi', 100, 1, 1000000));
    if (['poll', 'race'].includes(layout)) fields.push(text('optionA', 'A secenegi', 'Mavi'), text('optionB', 'B secenegi', 'Mercan'), text('commandA', 'A komutu', '!a'), text('commandB', 'B komutu', '!b'), check('showPercent', 'Yuzde goster'));
    const stateKeys = source === 'stats' ? ['stats'] : ['topLikes', 'topGifters'].includes(source) ? [source] : ['activities'];
    const eventTypes = event ? [source] : source === 'topLikes' ? ['like'] : source === 'topGifters' ? ['gift'] : source === 'stats' ? [sourceMetric === 'totalLikes' ? 'like' : sourceMetric === 'followers' ? 'follow' : sourceMetric === 'totalShares' ? 'share' : sourceMetric === 'subscribers' ? 'subscribe' : 'gift'] : ['gift', 'like', 'follow', 'share', 'subscribe', 'member', 'chat'];
    return { id, name, kind, description, category, studio: true, expansion: true, layout, source, stateKeys, eventTypes, ...(sourceMetric ? { metric: sourceMetric } : {}), fields: structuredClone(fields) };
});
const ids = new Set(definitions.map(item => item.id));
function normalize(id, input = {}) {
    const definition = definitions.find(item => item.id === id);
    if (!definition) throw new RangeError('Unknown expansion widget');
    return Object.fromEntries(definition.fields.map(field => {
        const raw = Object.hasOwn(input, field.key) ? input[field.key] : field.value;
        const value = field.type === 'number' ? Math.max(field.min, Math.min(field.max, Number.isFinite(Number(raw)) ? Number(raw) : field.value))
            : field.type === 'checkbox' ? [true, 1, 'true', '1'].includes(raw)
                : field.type === 'color' ? /^#[a-f0-9]{6}$/i.test(String(raw)) ? raw : field.value
                    : field.type === 'select' ? field.options.some(([key]) => key === String(raw)) ? String(raw) : field.value
                        : String(raw ?? '').slice(0, field.key === 'title' ? 64 : 120);
        return [field.key, value];
    }));
}

module.exports = { definitions, ids, normalize };
