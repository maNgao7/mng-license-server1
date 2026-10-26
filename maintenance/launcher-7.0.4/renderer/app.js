// =====================================================================
// TikMnG Launcher — Ana Uygulama Mantığı (Merkezi Lisans)
// =====================================================================

const API = window.mngAPI;

let lisansDurumu = null;
let kalanSaniyeInterval = null;
let bekleyenUygulama = null;
let guncellemeBilgisi = null;
let aktifOyunAcilisi = null;
const LAUNCHER_SLOGANS = [
    "Siz de hep aynı oyunlardan sıkılmadınız mı?",
    "Canlı yayınını oyuna dönüştür.",
    "Hediyeler gelsin, oyun değişsin.",
    "Kolay ve pratik kurulum.",
    "Her zaman yeni oyunlar.",
    "İzleyicin oyunun bir parçası olsun.",
    "Tek launcher, onlarca yayın deneyimi.",
    "Etkileşim arttıkça eğlence büyür.",
    "Yayına bağlan, oyunu başlat.",
    "TikMnG ile yayın akışını değiştir."
];
const ORBIT_DEFAULTS = { followMass: 250, likeEnterMass: 200, likeThreshold: 100, likeReward: 150, rules: [
    { id: "5655", growth: 200 }, { id: "17473", growth: 900 }, { id: "5879", growth: 1100 }, { id: "5303", growth: 1400 }
], shatter: { id: "11879" } };
let orbitCatalog = [], orbitSettings = null;

function orbitAyarlariniAl() { try { const saved=JSON.parse(localStorage.getItem("mng_orbit_settings")); return saved?.shatter && Array.isArray(saved.rules) && saved.rules.length===4 ? saved : structuredClone(ORBIT_DEFAULTS); } catch { return structuredClone(ORBIT_DEFAULTS); } }
function orbitAyarlariniKoy(settings) { orbitSettings = settings; if(document.getElementById("orbitFollowMass")) document.getElementById("orbitFollowMass").value=settings.followMass; if(document.getElementById("orbitLikeThreshold")) document.getElementById("orbitLikeThreshold").value=settings.likeThreshold; if(document.getElementById("orbitLikeReward")) document.getElementById("orbitLikeReward").value=settings.likeReward; orbitKurallariCiz(); }
async function orbitAyarlariAc() { if (!orbitCatalog.length) orbitCatalog = await API.orbitHediyeKatalogu(); orbitAyarlariniKoy(orbitAyarlariniAl()); document.getElementById("orbitSettingsModal").style.display="grid"; }
function orbitAyarlariKapat() { document.getElementById("orbitSettingsModal").style.display="none"; }
function orbitKurallariCiz() {
    const grid = document.getElementById("orbitRuleGrid");
    const cards = orbitSettings.rules.map((rule, index) => orbitKuralKarti(rule, index, false));
    cards.push(orbitKuralKarti(orbitSettings.shatter, "shatter", true));
    grid.replaceChildren(...cards);
}
function orbitKuralKarti(rule, index, isShatter) {
        const gift = orbitCatalog.find(item => item.id === rule.id) || { id: rule.id, name: "Hediye", coins: 0, image: null };
        const card = document.createElement("div");
        card.className = "orbit-rule" + (isShatter ? " shatter-rule" : "");
        const image = gift.image ? `<img src="${gift.image}" alt="${gift.name}">` : '<div class="gift-fallback">🎁</div>';
        const options = orbitCatalog.map(item => `<option value="${item.id}" ${item.id === rule.id ? "selected" : ""}>${item.name} · ${item.coins} coin</option>`).join("");
        const growth = isShatter ? '<div class="rule-detail">Tüm oyuncular parçalanır</div>' : `<label class="growth-label">Büyüme kütlesi<input data-growth="${index}" type="number" min="1" max="100000" value="${rule.growth}" aria-label="Büyüme değeri"></label>`;
        card.innerHTML = `${image}<div><div class="rule-type">${isShatter ? "HARİTAYI PARÇALA" : `BÜYÜME HEDİYESİ ${Number(index)+1}`}</div><select data-index="${index}">${options}</select><div class="rule-name">${gift.name} · ${gift.coins} coin</div>${growth}<button class="orbit-test" type="button" data-test="${index}">Test et</button></div>`;
        card.querySelector("select").addEventListener("change", event => { if (isShatter) orbitSettings.shatter.id=event.target.value; else orbitSettings.rules[Number(index)].id=event.target.value; orbitKurallariCiz(); });
        card.querySelector(".orbit-test").addEventListener("click", () => orbitAyariTest(isShatter ? "shatter" : Number(index)));
        return card;
}
function orbitAyariTest(kind) { const config=orbitAyarlariniTopla(); const label=kind==="shatter" ? "Haritayı parçala" : `Büyüme hediyesi ${kind+1}`; oyunuBaslat("orbit", { orbitSettings: config, orbitTest: kind, orbitTestLabel: label }); }
function orbitAyarlariniTopla() { orbitSettings.followMass=Math.max(1,Number(document.getElementById("orbitFollowMass")?.value)||250); orbitSettings.likeThreshold=Math.max(1,Number(document.getElementById("orbitLikeThreshold")?.value)||100); orbitSettings.likeReward=Math.max(1,Number(document.getElementById("orbitLikeReward")?.value)||150); orbitSettings.likeEnterMass=200; document.querySelectorAll("#orbitRuleGrid [data-growth]").forEach(input=>orbitSettings.rules[Number(input.dataset.growth)].growth=Math.max(1,Number(input.value)||1)); return structuredClone(orbitSettings); }
function orbitAyarlariKaydet() { const settings=orbitAyarlariniTopla(); localStorage.setItem("mng_orbit_settings",JSON.stringify(settings)); orbitSettings=settings; orbitAyarlariKapat(); }
function orbitAyarlariSifirla() { orbitAyarlariniKoy(structuredClone(ORBIT_DEFAULTS)); }

// =====================================================================
// BAŞLATMA
// =====================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // Sunucu durum olaylarını dinle
    API.durumDinle((data) => {
        if (oyunAcilisDurumunuIsle(data)) return;
        if (data.tip === "baslatiliyor" || data.tip === "yukleniyor") {
            statusGoster(data.mesaj);
        } else if (data.tip === "hazir") {
            statusGizle();
        } else if (data.tip === "hata") {
            statusGizle();
            hataGoster(data.mesaj);
        } else if (data.tip === 'hesap-uyari') {
            window.dispatchEvent(new CustomEvent('tikmng-notice', { detail: { text: data.mesaj, error: true } }));
        }
    });

    // Kart parlama efekti ve video döngüsünü başlat
    if (!API.workspace) kartParlamaEfektiBaslat();
    // Background downloads are opt-in; the library opens without loading a video pack.
    API.onArkaPlanHazir?.(() => {
        document.getElementById('backgroundGrid')?.replaceChildren();
        videoDongusuBaslat().then(() => {
            if (!document.getElementById('backgroundModal').hidden) arkaPlanPanelAc();
        });
    });
    await tiktokHesaplariniYukle();

    // Modüler oyun kurulum ilerlemesini dinle
    if (API.oyunKurulumIlerlemeDinle) {
        API.oyunKurulumIlerlemeDinle((prog) => {
            const o = oyunElKey(prog.oyun === 'crowdControl' ? 'crowd-control' : prog.oyun);
            const bar = document.getElementById(`${o}ProgressBar`);
            const pct = document.getElementById(`${o}ProgressPct`);
            const mb = document.getElementById(`${o}ProgressMb`);
            if (bar) bar.style.width = prog.percent == null ? '35%' : `${prog.percent}%`;
            if (pct) pct.textContent = prog.percent == null ? 'İndiriliyor' : `%${prog.percent}`;
            if (mb && prog.transferredMB) mb.textContent = `${prog.transferredMB} MB / ${prog.totalMB || "?"} MB`;
        });
    }

    // Oyun kapandığında butonları ve durumu sıfırla
    if (API.onOyunKapandi) {
        API.onOyunKapandi(() => {
            if (aktifOyunAcilisi) return;
            statusGizle();
            ["vs", "puanlama", "orbit", "crowdControl", "ponyLife", "duckHunt"].forEach(k => {
                const b = document.getElementById(`${k}PlayBtn`);
                if (b) b.disabled = false;
            });
        });
    }

    // Oyunların kurulum durumunu kontrol et
    await oyunDurumlariniGuncelle();

    // Açılışta lisans ve sürüm kontrolü yap
    await ilkAcilisLisansKontrol();
    if (lisansDurumu?.gecerli && aktifTikTokHesabi) API.tiktokBaglan(aktifTikTokHesabi).catch(()=>{});
});

// =====================================================================
// GLOBAL TİKTOK BAĞLANTI KARTI
// =====================================================================

function globalTikTokUserYukle() {
    try {
        const kayitli = localStorage.getItem("mng_tiktok_user") || "";
        const input = document.getElementById("globalTikTokUser");
        if (input && kayitli) {
            input.value = kayitli;
            const statusEl = document.getElementById("tiktokConnectStatus");
            if (statusEl) {
                statusEl.textContent = "✅ @" + kayitli + " — oyun açılınca otomatik bağlanır";
                statusEl.style.color = "#00d4aa";
            }
        }
    } catch (e) {}
}

function globalTikTokUserKaydet() {
    const input = document.getElementById("globalTikTokUser");
    const statusEl = document.getElementById("tiktokConnectStatus");
    if (!input) return;

    const kullanici = input.value.trim().replace(/^@/, "");
    if (!kullanici) {
        if (statusEl) {
            statusEl.textContent = "⚠️ Kullanıcı adı boş olamaz";
            statusEl.style.color = "#ff6b6b";
        }
        return;
    }

    try {
        localStorage.setItem("mng_tiktok_user", kullanici);
        input.value = kullanici;
        if (statusEl) {
            statusEl.textContent = "✅ @" + kullanici + " kaydedildi — oyun açılınca otomatik bağlanır";
            statusEl.style.color = "#00d4aa";
        }
    } catch (e) {}
}

function globalTikTokUserAl() {
    try {
        return localStorage.getItem("mng_tiktok_user") || "";
    } catch (e) {
        return "";
    }
}

let aktifTikTokHesabi = "";
let tiktokHesaplari = [];
async function tiktokHesaplariniYukle() {
    if (!API.tiktokHesaplari) return;
    const data = await API.tiktokHesaplari();
    tiktokHesaplari = (data.accounts || []).filter(name=>/^[a-zA-Z0-9_.]{1,24}$/.test(name));
    aktifTikTokHesabi = data.active || "";
    const label = document.getElementById("tiktokAccountLabel");
    if (label) label.textContent = aktifTikTokHesabi ? `@${aktifTikTokHesabi}` : "TikTok hesabı ekle";
    tiktokHesapListesiniCiz();
    await tiktokBaglantiDurumunuYukle();
}
let tiktokStatusTimer = null;
function tiktokHesapPanelAc(){ document.getElementById("tiktokAccountModal").hidden=false; tiktokHesapListesiniCiz(); tiktokBaglantiDurumunuYukle(); clearInterval(tiktokStatusTimer); tiktokStatusTimer=setInterval(tiktokBaglantiDurumunuYukle,1500); }
function tiktokHesapPanelKapat(){ document.getElementById("tiktokAccountModal").hidden=true; clearInterval(tiktokStatusTimer); tiktokStatusTimer=null; }
async function tiktokBaglantiDurumunuYukle(){
    if(!API.widgetBilgisi)return;
    try{
        const data=await API.widgetBilgisi(); const live=data.liveStatus||{}; const el=document.getElementById("accountConnectionStatus");
        if(el){el.textContent=live.message||"Yayın bağlantısı kapalı.";el.style.color=live.status==="connected"?"#25f4a5":live.status==="error"||live.status==="offline"?"#ff8585":"#a9bed4";}
        const dot=document.querySelector(".tiktok-account-dot"); if(dot)dot.style.background=live.status==="connected"?"#25f4a5":live.status==="connecting"?"#ffd166":"#7d8ba0";
    }catch{}
}
function tiktokHesapListesiniCiz(){
    const list=document.getElementById("accountList"); if(!list)return;
    list.innerHTML=tiktokHesaplari.length?tiktokHesaplari.map(name=>`
        <div class="account-item-row ${name===aktifTikTokHesabi?'active':''}">
            <button class="account-item ${name===aktifTikTokHesabi?'active':''}" onclick="tiktokHesapSec('${String(name).replace(/'/g,"\\'")}')">
                <span>@${name}</span>
                <b>${name===aktifTikTokHesabi?'AKTİF':'SEÇ'}</b>
            </button>
            <button class="account-remove-btn" type="button" title="Hesabı Listeden Çıkar" onclick="tiktokHesapSil('${String(name).replace(/'/g,"\\'")}')">✕</button>
        </div>`).join(""):'<div class="empty-state">Henüz hesap eklenmedi.</div>';
}
async function tiktokHesapEkle(){
    const input=document.getElementById("accountUsername"); const result=await API.tiktokHesapKaydet(input.value);
    if(!result.basarili)return hataGoster(result.hata); input.value=""; await tiktokHesaplariniYukle();
    await tiktokYayinaBaglan();
}
async function tiktokYayinaBaglan(){
    const input=document.getElementById("accountUsername");
    if(input?.value.trim()){
        const saved=await API.tiktokHesapKaydet(input.value);
        if(!saved.basarili)return hataGoster(saved.hata);
        input.value="";
    }
    const data=await API.tiktokHesaplari(); const username=data.active||aktifTikTokHesabi;
    if(!username)return hataGoster("Önce TikTok kullanıcı adını ekleyin.");
    const result=await API.tiktokBaglan(username); if(!result.basarili)return hataGoster(result.hata);
    await tiktokBaglantiDurumunuYukle();
}
async function tiktokYayinBaglantisiniKes(){await API.tiktokBaglantiyiKes();await tiktokBaglantiDurumunuYukle();}
async function tiktokHesapSec(username){ const result=await API.tiktokHesapSec(username); if(result.basarili){await tiktokHesaplariniYukle();await tiktokYayinaBaglan();} }
async function tiktokHesapSil(username){
    if(!API.tiktokHesapSil) return;
    const result=await API.tiktokHesapSil(username);
    if(result.basarili) await tiktokHesaplariniYukle();
}
async function copyToClipboardSafe(text, msg) {
    let ok = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            ok = true;
        }
    } catch {}
    if (!ok) {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            ok = true;
        } catch {}
    }
    statusGoster(msg || "Bağlantı kopyalandı.");
    setTimeout(statusGizle, 1400);
}

let widgetGalleryInfo = null;
let widgetObserver = null;
let widgetActiveCategory = "TÜMÜ";
const widgetKindColors = { HEDİYE:"pink", BEĞENİ:"pink", SOHBET:"cyan", SIRALAMA:"gold", ANİMASYON:"violet", OYUN:"gold", CANLI:"cyan", HEDEF:"pink" };
const widgetSettingsKey = "mng_widget_settings_v2";
const widgetSettingsBase = { accent:"#25f4ee", items:10, scale:100, opacity:100, speed:100, position:"center", offsetX:0, offsetY:0 };
const widgetExtraFields = {
    coinjar:[
        { key:"capacity", label:"Kavanoz kapasitesi", min:20, max:200, value:120 },
        { key:"giftSize", label:"Hediye PNG boyutu", min:14, max:38, value:22 },
        { key:"jarTint", label:"Cam rengi", type:"color", value:"#25f4ee" },
        { key:"giftMinCoins", label:"En az coin", min:0, max:100000, value:0 },
        { key:"showCount", label:"Toplam hediyeyi göster", type:"checkbox", value:true },
        { key:"showAlert", label:"Yeni hediye uyarısı", type:"checkbox", value:true },
        { key:"showJarRanking", label:"Kavanoz puan sıralaması", type:"checkbox", value:true },
        { key:"pointsPerCoins", label:"Kaç coine 1 puan", min:1, max:10000, value:100 },
        { key:"rankingCount", label:"Görünecek destekçi", min:1, max:10, value:5 }
    ],
    wheel:[
        { key:"segments", label:"Çark dilimleri (her satıra bir yazı veya sayı)", type:"textarea", value:"1\n2\n3\n4\n5\n6" },
        { key:"wheelColors", label:"Dilim renkleri (virgülle ayırın)", type:"text", value:"#fe2c55,#25f4ee,#ffd65a,#8d6bff,#50d28b,#ff8a4c" }
    ],
    timer:[],
    tinydiny:[{ key:"goal", label:"Hedef coin", min:100, max:1000000, value:5000 }],
    likefountain:[{ key:"particles", label:"Kalp sayısı", min:5, max:80, value:24 }],
    firework:[{ key:"particles", label:"Işık sayısı", min:8, max:100, value:48 }],
    emojify:[{ key:"particles", label:"Emoji sayısı", min:4, max:60, value:18 }],
    coindrop:[{ key:"particles", label:"Coin sayısı", min:5, max:80, value:26 }]
};
let widgetSettingsTarget = null;
let widgetConnectionTimer = null;
function widgetAyarDeposu(){ try { return JSON.parse(localStorage.getItem(widgetSettingsKey) || "{}"); } catch { return {}; } }
function widgetAyarlariniOku(id){
    const studioItem=widgetGalleryInfo?.widgets?.find(item=>item.id===id&&item.studio);
    if(studioItem){const screen=widgetSettingsTarget?.id===id?widgetSettingsTarget.screen||'1':'1';return {...widgetGalleryInfo.studio?.settings?.[id==='myactions'?`${id}:${screen}`:id],...(id==='myactions'?{screen}:{})};}
    const channel = widgetGalleryInfo?.channel || "varsayilan";
    const saved = widgetAyarDeposu()[channel]?.[id] || {};
    return { ...widgetSettingsBase, items:Number(document.getElementById("widgetItemCount")?.value || 10), accent:document.getElementById("widgetAccent")?.value || widgetSettingsBase.accent, ...saved };
}
function widgetAyarlariniKaydet(id, settings){
    const all = widgetAyarDeposu(), channel = widgetGalleryInfo?.channel || "varsayilan";
    all[channel] ||= {}; all[channel][id] = settings;
    localStorage.setItem(widgetSettingsKey, JSON.stringify(all));
}

async function widgetPanelAc(){
    widgetGalleryInfo = await API.widgetBilgisi();
    widgetActiveCategory = "TÜMÜ";
    const search = document.getElementById("widgetSearch");
    if(search) search.value = "";
    document.getElementById("widgetModal").hidden = false;
    document.getElementById("widgetChannelLabel").textContent = widgetGalleryInfo.active ? `@${widgetGalleryInfo.channel}` : "@hesap seçilmedi";
    const usernameInput=document.getElementById("widgetUsername");
    if(usernameInput) usernameInput.value=widgetGalleryInfo.liveStatus?.username||widgetGalleryInfo.channel||"";
    widgetYayinDurumunuGuncelle(widgetGalleryInfo.liveStatus);
    clearInterval(widgetConnectionTimer);
    widgetConnectionTimer=setInterval(widgetYayinDurumunuYukle,1500);
    widgetGalerisiniOlustur(widgetGalleryInfo.widgets || []);
}
function widgetPanelKapat(){
    document.getElementById("widgetModal").hidden=true;
    clearInterval(widgetConnectionTimer);
    widgetConnectionTimer=null;
    document.querySelectorAll("#widgetCollection iframe").forEach(frame=>{frame.src="about:blank";frame.removeAttribute("data-loaded")});
    widgetObserver?.disconnect();
}
function widgetYayinDurumunuGuncelle(live={}){
    const status=document.getElementById("widgetConnectionStatus");
    const button=document.getElementById("widgetConnectButton");
    if(status){
        status.textContent=live.message||"Yayın bağlantısı kapalı.";
        status.dataset.state=live.status||"disconnected";
    }
    if(button){
        button.disabled=live.status==="connecting";
        button.textContent=live.status==="connecting"?"BAĞLANIYOR…":"BAĞLAN";
    }
    const label=document.getElementById("widgetChannelLabel");
    if(label&&live.status==="connected"&&live.username)label.textContent=`@${live.username}`;
}
async function widgetYayinDurumunuYukle(){
    if(!API.widgetBilgisi)return;
    try{
        widgetGalleryInfo=await API.widgetBilgisi();
        widgetYayinDurumunuGuncelle(widgetGalleryInfo.liveStatus);
        const label=document.getElementById("widgetChannelLabel");
        if(label&&widgetGalleryInfo.liveStatus?.status!=="connected")label.textContent=widgetGalleryInfo.active?`@${widgetGalleryInfo.channel}`:"@hesap seçilmedi";
    }catch{}
}
async function widgetYayinBaglan(){
    const input=document.getElementById("widgetUsername");
    const username=String(input?.value||"").replace(/^@/,"").trim();
    if(!username){
        widgetYayinDurumunuGuncelle({status:"error",message:"Bağlanmak için TikTok kullanıcı adını yazın."});
        input?.focus();
        return;
    }
    const current=await API.widgetBilgisi();
    const live=current.liveStatus||{};
    if(live.status==="connected"&&String(live.username||"").toLowerCase()===username.toLowerCase()){
        widgetYayinDurumunuGuncelle(live);
        return;
    }
    widgetYayinDurumunuGuncelle({status:"connecting",username,message:`@${username} yayınına bağlanılıyor…`});
    const accountState=await API.tiktokHesaplari();
    const active=String(accountState.active||"").toLowerCase();
    const savedUsername=(accountState.accounts||[]).find(item=>String(item).toLowerCase()===username.toLowerCase());
    let accountResult;
    if(!savedUsername) accountResult=await API.tiktokHesapKaydet(username);
    else if(active!==username.toLowerCase()) accountResult=await API.tiktokHesapSec(savedUsername);
    if(accountResult&&!accountResult.basarili){
        widgetYayinDurumunuGuncelle({status:"error",message:accountResult.hata||"Hesap seçilemedi."});
        return;
    }
    const result=await API.tiktokBaglan(username);
    if(!result.basarili)widgetYayinDurumunuGuncelle({status:"error",message:result.hata||"Yayına bağlanılamadı."});
    else await widgetYayinDurumunuYukle();
}
async function widgetYayinBaglantiyiKes(){
    await API.tiktokBaglantiyiKes();
    await widgetYayinDurumunuYukle();
}
function widgetGalerisiniOlustur(widgets){
    const categories=["TÜMÜ",...new Set(widgets.map(item=>item.kind))];
    document.getElementById("widgetCategoryBar").innerHTML=categories.map(kind=>`<button type="button" class="${kind===widgetActiveCategory?'active':''}" data-widget-category="${kind}">${kind}</button>`).join("");
    document.querySelectorAll("[data-widget-category]").forEach(button=>button.onclick=()=>{widgetActiveCategory=button.dataset.widgetCategory;widgetGalerisiniFiltrele(document.getElementById("widgetSearch").value)});
    const collection=document.getElementById("widgetCollection");
    collection.innerHTML=widgets.map((item,index)=>{
        const previewId=`widgetPreview${index}`,urlId=`widgetUrl${index}`,tone=widgetKindColors[item.kind]||"cyan";
        const broadcast = item.broadcastUrl ?? item.url;
        const transportMessage = widgetGalleryInfo?.overlayTransport?.message || 'Yayın bağlantısı kontrol ediliyor.';
        return `<section class="widget-row" data-widget data-kind="${item.kind}" data-search="${(item.name+' '+item.description+' '+item.kind).toLocaleLowerCase('tr-TR')}"><div class="widget-visual"><iframe id="${previewId}" data-widget-id="${item.id}" title="${item.name} ön izlemesi" loading="lazy"></iframe><span class="widget-live-badge">● CANLI ÖN İZLEME</span></div><div class="widget-info"><div class="widget-title-line"><span class="widget-kind ${tone}">${item.kind}</span><span class="widget-local-badge">${broadcast ? 'YAYIN BAĞLANTISI HAZIR' : 'YAYIN SERVİSİ BEKLENİYOR'}</span></div><b>${item.name.toLocaleUpperCase('tr-TR')}</b><small>${item.description}</small><label>TikTok LIVE Studio bağlantısı</label><div class="widget-url-row"><input id="${urlId}" value="${broadcast || ''}" readonly><button type="button" data-widget-copy="${urlId}" data-widget-id="${item.id}" ${broadcast ? '' : 'disabled'}>KOPYALA</button></div><div class="widget-actions"><button class="settings-primary" type="button" data-widget-settings="${item.id}" data-preview="${previewId}">AYRINTILI AYARLAR</button><button class="secondary" type="button" data-widget-test="${item.id}" data-preview="${previewId}">CANLI TEST</button><button class="danger" type="button" data-widget-reset="${item.id}" data-preview="${previewId}">VERİYİ SIFIRLA</button></div><p class="widget-link-note">${transportMessage}</p></div><span class="widget-preview-source" data-preview-url="${item.previewUrl}" data-preview-id="${previewId}" data-widget-id="${item.id}"></span></section>`;
    }).join("");
    collection.querySelectorAll("[data-widget-copy]").forEach(button=>button.onclick=()=>widgetBaglantiKopyala(button.dataset.widgetCopy,button.dataset.widgetId));
    collection.querySelectorAll("[data-widget-settings]").forEach(button=>button.onclick=()=>widgetAyarPanelAc(button.dataset.widgetSettings,button.dataset.preview));
    collection.querySelectorAll("[data-widget-test]").forEach(button=>button.onclick=()=>widgetGenelTestEt(button.dataset.widgetTest,button.dataset.preview));
    collection.querySelectorAll("[data-widget-reset]").forEach(button=>button.onclick=()=>widgetGenelSifirla(button.dataset.widgetReset,button.dataset.preview));
    widgetBaglantilariGuncelle();
    widgetObserver?.disconnect();
    collection.querySelectorAll(".widget-preview-source").forEach(source=>{
        const frame=document.getElementById(source.dataset.previewId);
        if(!frame)return;
        frame.dataset.loaded="1";
        frame.src=widgetOnIzlemeUrl(source.dataset.previewUrl,source.dataset.widgetId);
    });
    widgetGalerisiniFiltrele("");
}
function widgetOzellestirilmisUrl(raw, id, settings = widgetAyarlariniOku(id)) {
    if (!raw) return '';
    const url = new URL(raw);
    if(widgetGalleryInfo?.widgets?.some(item=>item.id===id&&item.studio)){
        url.searchParams.set('studio','1');
        if(id==='myactions')url.searchParams.set('screen',settings.screen||'1');
        return url.href;
    }
    for (const [key,value] of Object.entries(settings)) url.searchParams.set(key, String(value));
    return url.href;
}
function widgetBaglantilariGuncelle(){
    document.querySelectorAll("#widgetCollection [data-widget-copy]").forEach(button=>{
        const input=document.getElementById(button.dataset.widgetCopy);
        const item=widgetGalleryInfo?.widgets?.find(item=>item.id===button.dataset.widgetId);
        const original=item?.broadcastUrl ?? item?.url;
        if(input){input.value=original?widgetOzellestirilmisUrl(original,button.dataset.widgetId):'';input.placeholder=original?'':'HTTPS yayın servisi henüz hazır değil';button.disabled=!original;}
    });
}
function widgetOnIzlemeUrl(raw,id,settings){
    const url=new URL(widgetOzellestirilmisUrl(raw,id,settings));
    url.searchParams.set("preview","1");
    url.searchParams.set("t",String(Date.now()));
    if(settings&&widgetGalleryInfo?.widgets?.some(item=>item.id===id&&item.studio))for(const[key,value]of Object.entries(settings))url.searchParams.set(key,String(value));
    return url.href;
}
async function widgetBaglantiKopyala(inputId,widgetId){
    const input = document.getElementById(inputId);
    if(!input?.value)return hataGoster('HTTPS yayın bağlantısı henüz hazır değil. Ayarlar bölümünden bağlantı durumunu kontrol edin.');
    await copyToClipboardSafe(widgetOzellestirilmisUrl(input.value,widgetId), "Widget bağlantısı kopyalandı.");
}
function widgetOnIzlemeyiYenile(el) {
    if(!el||!el.src||el.src==="about:blank")return;
    el.src=widgetOnIzlemeUrl(el.src,el.dataset.widgetId);
}
function widgetOnIzlemeleriGuncelle(){
    widgetBaglantilariGuncelle();
    document.querySelectorAll("#widgetCollection iframe[data-loaded]").forEach(widgetOnIzlemeyiYenile);
}
function widgetGalerisiniFiltrele(value=""){
    const query=String(value).trim().toLocaleLowerCase('tr-TR');
    document.querySelectorAll("[data-widget-category]").forEach(button=>button.classList.toggle("active",button.dataset.widgetCategory===widgetActiveCategory));
    document.querySelectorAll("#widgetCollection [data-widget]").forEach(row=>{row.hidden=!((widgetActiveCategory==="TÜMÜ"||row.dataset.kind===widgetActiveCategory)&&(!query||row.dataset.search.includes(query)))});
}
async function widgetGenelTestEt(type,previewId){if(widgetGalleryInfo?.widgets?.some(item=>item.id===type&&item.studio))await API.widgetStudioTest(type,widgetSettingsTarget?.screen||'1');else{await API.widgetUniversalTest(type);widgetOnIzlemeyiYenile(document.getElementById(previewId));}}
async function widgetGenelSifirla(type,previewId){if(!confirm('Yalnızca bu widgetın biriken verisi sıfırlansın mı?'))return;if(widgetGalleryInfo?.widgets?.some(item=>item.id===type&&item.studio))await API.widgetStudioSifirla(type,widgetSettingsTarget?.screen||'1');else{await API.widgetUniversalSifirla(type);widgetOnIzlemeyiYenile(document.getElementById(previewId));}}
function widgetAyarAlanlari(id, settings){
    const fields = widgetGalleryInfo?.widgets?.find(item=>item.id===id&&item.studio)?.fields || [
        { key:"accent", label:"Vurgu rengi", type:"color", value:"#25f4ee" },
        { key:"items", label:"Liste / görünür öğe", min:1, max:13, value:6 },
        { key:"scale", label:"Boyut (%)", min:50, max:160, value:100 },
        { key:"opacity", label:"Saydamlık (%)", min:25, max:100, value:100 },
        { key:"speed", label:"Animasyon hızı (%)", min:40, max:250, value:100 },
        { key:"position", label:"Konum", type:"select", value:"center", options:[["left","Sol"],["center","Orta"],["right","Sağ"]] },
        { key:"offsetX", label:"Yatay kaydır (px)", min:-500, max:500, value:0 },
        { key:"offsetY", label:"Dikey kaydır (px)", min:-500, max:500, value:0 },
        ...(widgetExtraFields[id] || [])
    ];
    const attr=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    return fields.map(field=>{
        const value=settings[field.key] ?? field.value;
        if(field.type==='gift')return `<div class="widget-wide widget-gift-field"><span>${field.label}</span><input name="${field.key}" type="hidden" value="${attr(value)}"><button type="button" class="workspace-button widget-gift-selector" data-widget-gift>${window.widgetGiftSummary?.(value)||attr(value?'Hediye #'+value:'Tüm hediyeler')}<i data-lucide="chevron-down"></i></button></div>`;
        const control=field.type==="select" ? `<select name="${field.key}">${field.options.map(([key,name])=>`<option value="${key}" ${String(key)===String(value)?'selected':''}>${name}</option>`).join("")}</select>` : field.type==="checkbox" ? `<input name="${field.key}" type="checkbox" value="true" ${value?'checked':''}>` : field.type==="textarea" ? `<textarea name="${field.key}" rows="7">${attr(value)}</textarea>` : `<input name="${field.key}" type="${field.type||'number'}" value="${attr(value)}" ${field.type==='color'||field.type==='text'?'':`min="${field.min}" max="${field.max}" step="${field.step||1}"`}>`;
        return `<label class="${field.type==='checkbox'?'widget-toggle':field.type==='textarea'?'widget-wide':''}">${field.label}${control}</label>`;
    }).join("");
}
function widgetAyarPanelAc(id,previewId){
    const item=widgetGalleryInfo?.widgets?.find(widget=>widget.id===id); if(!item)return;
    widgetSettingsTarget={id,previewId,item,screen:'1'};
    document.getElementById("widgetSettingsTitle").textContent=item.name;
    document.getElementById("widgetSettingsFields").innerHTML=widgetAyarAlanlari(id,widgetAyarlariniOku(id));
    document.getElementById("widgetSettingsModal").hidden=false;
    document.getElementById('widgetSettingsPreview').allow='autoplay';
    const form=document.getElementById("widgetSettingsForm");
    form.onclick=event=>{if(event.target.closest('[data-widget-gift]'))window.widgetGiftPickerOpen?.()?.catch(hataGoster);};
    form.oninput=widgetAyarOnIzleme;
    form.onchange=event=>{if(item.studio&&event.target.name==='screen'){widgetSettingsTarget.screen=event.target.value;document.getElementById('widgetSettingsFields').innerHTML=widgetAyarAlanlari(id,widgetAyarlariniOku(id));}widgetAyarOnIzleme();};
    form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const values=widgetAyarFormDegerleri();if(item.studio){const result=await API.widgetStudioKaydet(id,values,widgetSettingsTarget.screen);if(!result.basarili)return hataGoster(result.hata);widgetGalleryInfo=await API.widgetBilgisi();}else widgetAyarlariniKaydet(id,values);widgetBaglantilariGuncelle();widgetOnIzlemeyiYenile(document.getElementById(previewId));widgetAyarPanelKapat();statusGoster(item.studio?'Widget ayarları kaydedildi. Yayın bağlantısı aynı kalır.':'Widget ayarları kaydedildi. Yeni bağlantıyı kopyalayın.');setTimeout(statusGizle,2200);};
    let commands=document.getElementById('widgetStudioCommands');
    if(!commands){commands=document.createElement('div');commands.id='widgetStudioCommands';commands.className='widget-studio-commands';document.getElementById('widgetSettingsTitle').after(commands);}
    commands.innerHTML=item.studio?`<button type="button" class="workspace-button" id="widgetStudioCopy"><i data-lucide="copy"></i> Bağlantıyı kopyala</button><button type="button" class="workspace-button" id="widgetStudioTest"><i data-lucide="play"></i> Test et</button><button type="button" class="workspace-icon" id="widgetStudioReset" title="Bu widgetı sıfırla" aria-label="Bu widgetı sıfırla"><i data-lucide="rotate-ccw"></i></button>${id==='penalty'?'<button type="button" class="workspace-button" id="widgetStudioScores"><i data-lucide="list-ordered"></i> Skor bağlantısını kopyala</button>':''}`:'';
    window.lucide?.createIcons();
    if(item.studio){document.getElementById('widgetStudioCopy').onclick=()=>widgetStudioLinkKopyala();document.getElementById('widgetStudioTest').onclick=()=>{const frame=document.getElementById('widgetSettingsPreview');if(frame?.src)frame.contentWindow.postMessage({type:'tikmng-widget-audition'},new URL(frame.src).origin);return widgetGenelTestEt(id);};document.getElementById('widgetStudioReset').onclick=()=>widgetGenelSifirla(id);if(id==='penalty')document.getElementById('widgetStudioScores').onclick=()=>widgetStudioLinkKopyala('scores');}
    widgetAyarOnIzleme();
}
async function widgetAyarlariDogrudanAc(id) {
    widgetGalleryInfo = await API.widgetBilgisi();
    widgetAyarPanelAc(id);
}
function widgetAyarFormDegerleri(){
    const data=new FormData(document.getElementById("widgetSettingsForm")),result={};
    for(const control of document.querySelectorAll('#widgetSettingsFields [name]'))result[control.name]=control.type==='checkbox'?control.checked:control.type==='number'?Number(control.value):control.value;
    return result;
}
function widgetAyarOnIzleme(){
    if(!widgetSettingsTarget)return;
    const frame=document.getElementById("widgetSettingsPreview");
    const settings=widgetAyarFormDegerleri(),key=`${widgetSettingsTarget.id}:${settings.screen||'1'}`;
    if(widgetSettingsTarget.item.studio&&frame.dataset.studioKey===key&&frame.src!=='about:blank')frame.contentWindow.postMessage({type:'tikmng-widget-draft',settings},new URL(frame.src).origin);
    else{frame.dataset.studioKey=key;frame.onload=()=>{if(widgetSettingsTarget?.item.studio&&frame.src!=='about:blank')frame.contentWindow.postMessage({type:'tikmng-widget-draft',settings:widgetAyarFormDegerleri()},new URL(frame.src).origin);};frame.src=widgetOnIzlemeUrl(widgetSettingsTarget.item.previewUrl,widgetSettingsTarget.id,settings);}
}
async function widgetStudioLinkKopyala(mode){
    const target=widgetSettingsTarget;if(!target)return;
    const raw=target.item.broadcastUrl;if(!raw)return hataGoster('HTTPS yayın servisi hazır değil.');
    const url=new URL(widgetOzellestirilmisUrl(raw,target.id,{screen:target.screen}));if(mode)url.searchParams.set('mode',mode);
    await copyToClipboardSafe(url.href,'Widget bağlantısı kopyalandı.');
}
function widgetAyarVarsayilan(){
    if(!widgetSettingsTarget)return;
    document.getElementById("widgetSettingsFields").innerHTML=widgetAyarAlanlari(widgetSettingsTarget.id,widgetSettingsBase);
    widgetAyarOnIzleme();
}
function widgetAyarPanelKapat(){
    document.getElementById("widgetSettingsModal").hidden=true;
    document.getElementById("widgetSettingsPreview").src="about:blank";
    delete document.getElementById('widgetSettingsPreview').dataset.studioKey;
    widgetSettingsTarget=null;
}
function arkaPlanPanelAc(){
    document.getElementById("backgroundModal").hidden=false; const grid=document.getElementById("backgroundGrid");
    if(!grid.children.length) bgVideoListesi.forEach((src,index)=>{const button=document.createElement("button");button.type="button";button.className="background-choice";button.innerHTML=`<video src="${src}" muted loop playsinline preload="metadata"></video><b>${String(index+1).padStart(2,"0")}</b>`;button.onmouseenter=()=>button.querySelector("video").play().catch(()=>{});button.onmouseleave=()=>{const v=button.querySelector("video");v.pause();v.currentTime=0};button.onclick=()=>arkaPlanSec(index);grid.append(button)});
}
function arkaPlanPanelKapat(){document.getElementById("backgroundModal").hidden=true}
function arkaPlanSec(index){localStorage.setItem("mng_selected_background",String(index));if(bgVideoTimer)clearInterval(bgVideoTimer);if(index<0){videoDongusuBaslat()}else{const a=document.getElementById("bgVideoA"),b=document.getElementById("bgVideoB");a.src=bgVideoListesi[index];a.currentTime=0;a.play().catch(()=>{});a.classList.add("active");b.classList.remove("active")}arkaPlanPanelKapat()}


// =====================================================================
// İLK AÇILIŞ LİSANS VE SÜRÜM KONTROLÜ
// =====================================================================
async function ilkAcilisLisansKontrol() {
    overlay("Lisans ve sürüm kontrol ediliyor...");

    try {
        const durum = await API.lisansDurumu();
        lisansDurumu = durum;
        overlayGizle();

        if (durum.gecerli) {
            anaEkraniGoster();
            lisansUIGuncelle(durum);

            // Arka planda yeni sürüm kontrolü yap
            setTimeout(guncellemeKontrolEt, 1000);
        } else {
            // Zorunlu güncelleme kontrolü
            if (durum.reason === "update_required") {
                const footerEl = document.getElementById("footerVersion");
                const curVer = footerEl ? footerEl.textContent.replace("v", "").trim() : "1.0.4";
                const latestVer = durum.latestVersion || "1.0.5";
                guncellemeBilgisi = {
                    guncellemeVar: true,
                    currentVersion: curVer,
                    latestVersion: latestVer,
                    downloadUrl: durum.downloadUrl,
                    changelog: durum.changelog || []
                };

                // Lisans kutusunda güncelle butonunu göster
                const licBox = document.getElementById("licenseUpdateBox");
                const licVer = document.getElementById("licenseUpdateVer");
                if (licBox) licBox.style.display = "block";
                if (licVer) licVer.textContent = `v${latestVer}`;

                // Zorunlu güncelleme modalını aç
                updateModalAc(guncellemeBilgisi, true);
                lisansEkraniGoster(durum.hata || `⚠️ YENİ GÜNCELLEME MEVCUT (v${latestVer})!`);
                return;
            }

            // Normal lisans ekranı
            if (durum.sebep === "internet_yok") {
                lisansEkraniGoster("İnternet bağlantısı kurulamadı. Lisans doğrulaması için internet gereklidir.");
            } else if (durum.hata) {
                lisansEkraniGoster(durum.hata);
            } else {
                lisansEkraniGoster("Lütfen devam etmek için lisans anahtarınızı girin.");
            }
        }
    } catch (hata) {
        overlayGizle();
        lisansEkraniGoster("Lisans sunucusuna ulaşılamıyor. İnternet bağlantınızı kontrol edin.");
    }
}

// =====================================================================
// ANA EKRAN UI
// =====================================================================
function anaEkraniGoster() {
    overlayGizle();
    document.getElementById("launcher").style.display = "flex";
    document.getElementById("licensePage").style.display = "none";
}

function anaEkranaDon() {
    overlayGizle();
    if (lisansDurumu && lisansDurumu.gecerli) {
        document.getElementById("licensePage").style.display = "none";
        document.getElementById("launcher").style.display = "flex";
    } else {
        hataGoster("Uygulamayı kullanabilmek için geçerli bir lisans gereklidir.");
    }
}

function lisansUIGuncelle(durum) {
    const dot = document.getElementById("licenseDot");
    const status = document.getElementById("licenseStatus");
    const remaining = document.getElementById("licenseRemaining");
    const vsBtn = document.getElementById("vsPlayBtn");
    const puanlamaBtn = document.getElementById("puanlamaPlayBtn");
    const orbitBtn = document.getElementById("orbitPlayBtn");
    const crowdControlBtn = document.getElementById("crowdControlPlayBtn");

    if (durum && durum.gecerli) {
        dot.className = "license-dot aktif";
        status.textContent = "Lisans Aktif";

        if (durum.is_unlimited) {
            if (kalanSaniyeInterval) clearInterval(kalanSaniyeInterval);
            remaining.textContent = "♾️ Sınırsız Kullanım";
        } else {
            kalanSaniyeGuncelle(durum.kalan_saniye || 0, durum.bitis_zamani);
        }

        // Oyun butonlarını aktif et
        vsBtn.disabled = false;
        vsBtn.className = "play-btn";
        vsBtn.innerHTML = '<span class="play-icon">▶</span> OYNA';

        puanlamaBtn.disabled = false;
        puanlamaBtn.className = "play-btn";
        puanlamaBtn.innerHTML = '<span class="play-icon">▶</span> OYNA';

        orbitBtn.disabled = false;
        if (crowdControlBtn) crowdControlBtn.disabled = false;
        orbitBtn.className = "play-btn";
        orbitBtn.innerHTML = '<span class="play-icon">▶</span> OYNA';

        if (crowdControlBtn) {
            crowdControlBtn.disabled = false;
            crowdControlBtn.className = "play-btn";
            crowdControlBtn.innerHTML = '<span class="play-icon">▶</span> OYNA';
        }

    } else {
        if (kalanSaniyeInterval) clearInterval(kalanSaniyeInterval);

        dot.className = "license-dot hatali";
        status.textContent = "Lisans Gerekli";
        remaining.textContent = durum && durum.hata ? durum.hata : "Lisans anahtarı bekleniyor";

        vsBtn.disabled = false;
        vsBtn.className = "play-btn kilitli";
        vsBtn.innerHTML = '<span class="lock-icon">🔒</span> Lisans Gerekli';

        puanlamaBtn.disabled = false;
        puanlamaBtn.className = "play-btn kilitli";
        puanlamaBtn.innerHTML = '<span class="lock-icon">🔒</span> Lisans Gerekli';

        orbitBtn.disabled = false;
        orbitBtn.className = "play-btn kilitli";
        orbitBtn.innerHTML = '<span class="lock-icon">🔒</span> Lisans Gerekli';

        if (crowdControlBtn) {
            crowdControlBtn.disabled = false;
            crowdControlBtn.className = "play-btn kilitli";
            crowdControlBtn.innerHTML = '<span class="lock-icon">🔒</span> Lisans Gerekli';
        }
    }
    // Lisans görünümü düğme metinlerini değiştirdikten sonra gerçek modüler
    // kurulum durumunu yeniden uygula; indirilmeyen oyun "Oyna" görünmesin.
    queueMicrotask(() => oyunDurumlariniGuncelle());
}

function kalanSaniyeGuncelle(kalanSaniye, bitisSaniye) {
    if (kalanSaniyeInterval) clearInterval(kalanSaniyeInterval);

    const hedefZaman = bitisSaniye ? bitisSaniye : (Date.now() + kalanSaniye * 1000);

    function guncelle() {
        const remaining = document.getElementById("licenseRemaining");
        const dot = document.getElementById("licenseDot");
        const kalanMs = hedefZaman - Date.now();

        if (kalanMs <= 0) {
            clearInterval(kalanSaniyeInterval);
            remaining.textContent = "Lisans süresi doldu";
            dot.className = "license-dot doldu";
            lisansUIGuncelle({ gecerli: false, hata: "Lisansınızın süresi dolmuş." });
            lisansEkraniGoster("Lisansınızın süresi dolmuş. Devam etmek için yeni bir lisans kodu girin.");
            return;
        }

        const gun = Math.floor(kalanMs / (1000 * 60 * 60 * 24));
        const saat = Math.floor((kalanMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const dakika = Math.floor((kalanMs % (1000 * 60 * 60)) / (1000 * 60));

        let metin;
        if (gun > 0) {
            metin = `${gun} gün ${saat} saat kaldı`;
        } else if (saat > 0) {
            metin = `${saat} saat ${dakika} dakika kaldı`;
        } else {
            const saniye = Math.floor((kalanMs % (1000 * 60)) / 1000);
            metin = `${dakika} dakika ${saniye} saniye kaldı`;
        }

        remaining.textContent = metin;
    }

    guncelle();
    kalanSaniyeInterval = setInterval(guncelle, 1000);
}

// =====================================================================
// LİSANS EKRANI
// =====================================================================
function lisansEkraniGoster(aciklama) {
    overlayGizle();
    document.getElementById("launcher").style.display = "none";
    document.getElementById("licensePage").style.display = "flex";

    const desc = document.getElementById("licenseDesc");
    desc.textContent = aciklama || "Uygulamayı kullanabilmek için yöneticinizden aldığınız lisans kodunu girin.";

    const input = document.getElementById("licenseInput");
    input.value = "";
    document.getElementById("licenseError").classList.remove("visible");

    const btn = document.getElementById("licenseBtn");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Giriş yap";
    btn.style.background = "";

    setTimeout(() => input.focus(), 150);
}

function licenseInputTemizle(input) {
    let v = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    input.value = v;
    document.getElementById("licenseError").classList.remove("visible");
}

async function lisansDogrula() {
    const input = document.getElementById("licenseInput");
    const btn = document.getElementById("licenseBtn");
    const error = document.getElementById("licenseError");
    const kod = input.value.trim();
    const username = String(document.getElementById('licenseUsername')?.value || '').trim().replace(/^@/, '');

    if (!/^[a-zA-Z0-9_.]{1,24}$/.test(username)) {
        error.textContent = 'Geçerli TikTok kullanıcı adını yazın.';
        error.classList.add('visible');
        document.getElementById('licenseUsername')?.focus();
        return;
    }

    if (!kod) {
        error.textContent = "Lütfen bir lisans kodu girin.";
        error.classList.add("visible");
        return;
    }

    btn.disabled = true;
    btn.classList.add("loading");
    btn.textContent = "Doğrulanıyor...";
    error.classList.remove("visible");

    try {
        const sonuc = await API.lisansDogrula(kod);

        if (sonuc.gecerli) {
            lisansDurumu = sonuc;
            const account = await API.tiktokHesapKaydet(username);
            if (!account.basarili) throw new Error(account.hata || 'Yayın hesabı kaydedilemedi.');
            await tiktokHesaplariniYukle();
            await API.tiktokBaglan(username);
            btn.textContent = "✓ Aktifleştirildi!";
            btn.style.background = '#37dad2';

            setTimeout(async () => {
                anaEkraniGoster();
                lisansUIGuncelle(sonuc);
                btn.disabled = false;
                btn.classList.remove("loading");
                btn.textContent = "Giriş yap";
                btn.style.background = "";

                if (bekleyenUygulama) {
                    const hedef = bekleyenUygulama;
                    bekleyenUygulama = null;
                    await oyunuBaslat(hedef);
                }
            }, 500);
        } else {
            error.textContent = sonuc.hata || "Geçersiz lisans kodu.";
            error.classList.add("visible");
            btn.disabled = false;
            btn.classList.remove("loading");
            btn.textContent = "Giriş yap";
            btn.style.background = "";

            if (sonuc.reason === "update_required") {
                const latestVer = sonuc.latestVersion || "1.0.2";
                guncellemeBilgisi = {
                    guncellemeVar: true,
                    currentVersion: "1.0.1",
                    latestVersion: latestVer,
                    downloadUrl: sonuc.downloadUrl
                };
                const licBox = document.getElementById("licenseUpdateBox");
                const licVer = document.getElementById("licenseUpdateVer");
                if (licBox) licBox.style.display = "block";
                if (licVer) licVer.textContent = `v${latestVer}`;
                updateModalAc(guncellemeBilgisi, true);
            }
        }
    } catch (hata) {
        error.textContent = "Lisans sunucusuna ulaşılamıyor. İnternet bağlantınızı kontrol edin.";
        error.classList.add("visible");
        btn.disabled = false;
        btn.classList.remove("loading");
        btn.textContent = "Giriş yap";
        btn.style.background = "";
    }
}

// =====================================================================
// OYUN DURUMLARI VE MODÜLER KURULUM YÖNETİMİ
// =====================================================================
let oyunDurumlariKonteyner = {
    vs: { kurulu: true, boyut: "410 MB" },
    puanlama: { kurulu: true, boyut: "410 MB" },
    orbit: { kurulu: true, boyut: "340 MB" },
    "crowd-control": { kurulu: true, boyut: "280 MB" },
    crowdControl: { kurulu: true, boyut: "280 MB" },
    "battle-game": { kurulu: false, boyut: "120 MB" },
    "gelene-gecene": { kurulu: false, boyut: "65 MB" },
    "pony-life": { kurulu: true, boyut: "205 MB" },
    "duck-hunt": { kurulu: true, boyut: "185 MB" },
    "frog-river": { kurulu: true, boyut: "75 MB" },
    "penalty-kick": { kurulu: true, boyut: "90 MB" },
    "tightrope-balance": { kurulu: false, boyut: "30 MB" },
    "zombie-war": { kurulu: false, boyut: "340 MB" }
    ,"battle-royale": { kurulu: false, boyut: "1.1 GB" }
    ,"snow-war": { kurulu: false, boyut: "1 GB" }
};

function oyunElKey(oyun) {
    return oyun === "crowd-control" ? "crowdControl"
        : oyun === "battle-game" ? "savasAlani"
        : oyun === "gelene-gecene" ? "geleneGecene"
        : oyun === "pony-life" ? "ponyLife"
        : oyun === "duck-hunt" ? "duckHunt"
        : oyun === "frog-river" ? "frogRiver"
        : oyun === "penalty-kick" ? "penaltyKick"
        : oyun === "tightrope-balance" ? "tightropeBalance"
        : oyun === "zombie-war" ? "zombieWar"
        : oyun === "battle-royale" ? "battleRoyale"
        : oyun === "snow-war" ? "snowWar"
        : oyun;
}

async function oyunDurumlariniGuncelle() {
    try {
        if (API.oyunDurumlari) {
            const durumlar = await API.oyunDurumlari();
            if (durumlar) {
                oyunDurumlariKonteyner = durumlar;
            }
        }
    } catch (e) {
        console.warn("Oyun durumları okunamadı:", e);
    }

    ["vs", "puanlama", "orbit", "crowd-control", "battle-game", "gelene-gecene", "pony-life", "duck-hunt", "frog-river", "penalty-kick", "tightrope-balance", "zombie-war", "battle-royale", "snow-war"].forEach(oyun => {
        const elKey = oyunElKey(oyun);
        const durum = oyunDurumlariKonteyner[oyun] || { kurulu: false };
        const badge = document.getElementById(`${elKey}Badge`);
        const btn = document.getElementById(`${elKey}PlayBtn`);
        const playText = document.getElementById(`${elKey}PlayText`);
        const playIcon = document.getElementById(`${elKey}PlayIcon`);

        if (durum.kurulu) {
            if (badge) {
                badge.className = "game-badge kurulu";
                badge.textContent = "✓ HAZIR";
            }
            if (playText) playText.textContent = "OYNA";
            if (playIcon) playIcon.textContent = "▶";
            if (btn) { btn.classList.remove("kur-btn"); btn.disabled = false; }
        } else {
            const boyut = durum.boyut || "";
            if (badge) {
                badge.className = "game-badge indirilebilir";
                badge.textContent = `İNDİRİLEBİLİR (${boyut})`;
            }
            if (playText) playText.textContent = `YÜKLE (${boyut})`;
            if (playIcon) playIcon.textContent = "⬇";
            if (btn) btn.classList.add("kur-btn");
        }
    });
}

async function oyunAksiyon(uygulama) {
    const durum = oyunDurumlariKonteyner[uygulama];
    if (durum && !durum.kurulu) {
        await oyunKur(uygulama);
    } else {
        await oynaButonu(uygulama);
    }
}

async function oyunKur(uygulama) {
    const elKey = oyunElKey(uygulama === "crowdControl" ? "crowd-control" : uygulama);
    const btn = document.getElementById(`${elKey}PlayBtn`);
    const playText = document.getElementById(`${elKey}PlayText`);
    const playIcon = document.getElementById(`${elKey}PlayIcon`);
    const badge = document.getElementById(`${elKey}Badge`);
    const progressWrap = document.getElementById(`${elKey}ProgressWrap`);
    const progressBar = document.getElementById(`${elKey}ProgressBar`);
    const progressPct = document.getElementById(`${elKey}ProgressPct`);

    if (btn) btn.disabled = true;
    if (playText) playText.textContent = "İndiriliyor...";
    if (playIcon) playIcon.textContent = "⏳";
    if (badge) {
        badge.className = "game-badge indiriliyor";
        badge.textContent = "YÜKLENİYOR...";
    }
    if (progressWrap) progressWrap.style.display = "flex";
    if (progressBar) progressBar.style.width = "0%";
    if (progressPct) progressPct.textContent = "%0";

    statusGoster("Oyun paketi indiriliyor ve kuruluyor...");

    try {
        const res = await API.oyunKur(uygulama);
        if (res && res.basarili) {
            if (progressBar) progressBar.style.width = "100%";
            if (progressPct) progressPct.textContent = "%100";
            if (badge) {
                badge.className = "game-badge kurulu";
                badge.textContent = "✓ HAZIR";
            }
            statusGoster("Kurulum başarıyla tamamlandı!");
            setTimeout(() => {
                if (progressWrap) progressWrap.style.display = "none";
                statusGizle();
            }, 1200);
            await oyunDurumlariniGuncelle();
        } else {
            hataGoster("Kurulum başarısız: " + (res?.hata || "Bilinmeyen hata"));
            if (progressWrap) progressWrap.style.display = "none";
            await oyunDurumlariniGuncelle();
        }
    } catch (err) {
        hataGoster("Kurulum hatası: " + err.message);
        if (progressWrap) progressWrap.style.display = "none";
        await oyunDurumlariniGuncelle();
    } finally {
        if (btn) btn.disabled = false;
    }
}

// =====================================================================
// OYNA BUTONU
// =====================================================================
async function oynaButonu(uygulama) {
    if (aktifOyunAcilisi) return;
    bekleyenUygulama = uygulama;

    // Lisans kontrolü
    if (!lisansDurumu || !lisansDurumu.gecerli) {
        lisansEkraniGoster("Bu uygulamayı kullanabilmek için lisans anahtarınızı girin.");
        return;
    }

    // Süre kontrolü
    if (!lisansDurumu.is_unlimited && lisansDurumu.bitis_zamani && Date.now() > lisansDurumu.bitis_zamani) {
        lisansUIGuncelle({ gecerli: false });
        lisansEkraniGoster("Lisansınızın süresi dolmuş. Lütfen yeni bir lisans anahtarı girin.");
        return;
    }

    await oyunuBaslat(uygulama);
}

function oyunAcilisDurumunuIsle(data) {
    const acilis = aktifOyunAcilisi;
    if (!acilis || !['baslatiliyor', 'yukleniyor', 'hazir', 'hata'].includes(data.tip)) return false;
    // Closing the previous game can emit events while the next launch is pending.
    if (!acilis.backendBasladi || oyunElKey(data.oyun) !== oyunElKey(acilis.oyun)) return true;
    if (data.tip === 'hazir' || data.tip === 'hata') {
        acilis.tamamla({ basarili: data.tip === 'hazir', hata: data.mesaj });
    } else {
        document.getElementById('gameLaunchPhase').textContent = data.mesaj || 'Oyun hazırlanıyor';
    }
    return true;
}

function oyunAcilisGorseliniAl(uygulama) {
    const card = Array.from(document.querySelectorAll('[data-game-id]')).find(node => node.dataset.gameId === uygulama);
    const play = Array.from(document.querySelectorAll('.game-detail [data-play]')).find(node => node.dataset.play === uygulama);
    const detail = play?.closest('.game-detail');
    const legacy = document.getElementById(`${oyunElKey(uygulama)}Card`);
    const cover = card?.querySelector('.cover-button > img') || detail?.querySelector('.game-detail-cover img');
    const title = card?.querySelector('.cover-caption strong') || detail?.querySelector('.game-detail-info h2') || legacy?.querySelector('.game-title');
    return { cover, title: title?.textContent.trim() || cover?.alt || uygulama };
}

async function oyunuBaslat(uygulama, directOptions) {
    if (aktifOyunAcilisi || window.tikmngGameLaunching) return;
    const acilis = { oyun: uygulama, backendBasladi: false };
    const terminal = new Promise(resolve => { acilis.tamamla = resolve; });
    aktifOyunAcilisi = acilis;
    window.tikmngGameLaunching = true;
    const launch = document.getElementById('gameLaunchOverlay');
    const previousFocus = document.activeElement;
    const oyunButonlari = Array.from(document.querySelectorAll('[data-play], .play-btn, .orbit-test'))
        .map(button => ({ button, disabled: button.disabled }));
    // Escape cannot cancel a backend request; keep the modal until its real outcome.
    const preventCancel = event => event.preventDefault();

    try {
        const { cover, title } = oyunAcilisGorseliniAl(uygulama);
        document.getElementById('gameLaunchTitle').textContent = title;
        const art = document.getElementById('gameLaunchCover');
        if (cover) { art.src = cover.src; art.hidden = false; }
        else { art.removeAttribute('src'); art.hidden = true; }
        document.getElementById('gameLaunchPhase').textContent = 'Yayın hesabı kontrol ediliyor';
        launch.addEventListener('cancel', preventCancel);
        launch.showModal();
        launch.focus({ preventScroll: true });
        oyunButonlari.forEach(({ button }) => { button.disabled = true; });
        statusGizle();

        const liveInfo = await API.widgetBilgisi();
        const connectedUser = liveInfo?.liveStatus?.status === "connected" ? liveInfo.liveStatus.username : "";
        const account = await API.tiktokHesaplari();
        const options = { ...(directOptions || {}), tiktokUser: directOptions?.tiktokUser || connectedUser || account?.active || '' };
        document.getElementById('gameLaunchPhase').textContent = 'Oyun başlatma isteği gönderiliyor';
        acilis.backendBasladi = true;
        // Either the ready/error event or the completed IPC request is authoritative.
        const sonuc = await Promise.race([API.uygulamaAc(uygulama, options), terminal]);
        if (!sonuc?.basarili) throw new Error(sonuc?.hata || 'Bilinmeyen hata');
    } catch (hata) {
        hataGoster('Oyun başlatılamadı: ' + (hata?.message || 'Bilinmeyen hata'));
    } finally {
        aktifOyunAcilisi = null;
        window.tikmngGameLaunching = false;
        oyunButonlari.forEach(({ button, disabled }) => { button.disabled = disabled; });
        launch?.removeEventListener('cancel', preventCancel);
        if (launch?.open) launch.close();
        if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus({ preventScroll: true });
    }
}

// Yeni lisans gir butonu
function yeniLisansGir() {
    bekleyenUygulama = null;
    lisansEkraniGoster("Yeni lisans anahtarınızı girin.");
}

// =====================================================================
// YARDIMCI UI FONKSİYONLARI
// =====================================================================
function overlay(mesaj) {
    const o = document.getElementById("loadingOverlay");
    if (o) {
        o.style.display = "flex";
        document.getElementById("loadingText").textContent = mesaj || "Yükleniyor...";
    }
}

function overlayGizle() {
    const o = document.getElementById("loadingOverlay");
    if (o) o.style.display = "none";
}

function statusGoster(mesaj) {
    const bar = document.getElementById("statusBar");
    document.getElementById("statusMsg").textContent = mesaj;
    bar.style.display = "flex";
}

function statusGizle() {
    document.getElementById("statusBar").style.display = "none";
}

function hataGoster(mesaj) {
    if (API.workspace) { window.dispatchEvent(new CustomEvent('tikmng-notice', { detail: { text: String(mesaj), error: true } })); return; }
    statusGizle();
    const bar = document.getElementById("statusBar");
    bar.style.display = "flex";
    bar.innerHTML = `<span style="color:var(--red)">⚠️ ${mesaj}</span>`;

    setTimeout(() => {
        bar.style.display = "none";
        bar.innerHTML = '<div class="status-spinner"></div><span id="statusMsg"></span>';
    }, 5000);
}

// Periyodik lisans kontrolü (10 dakikada bir merkezi sunucudan doğrula)
setInterval(async () => {
    if (lisansDurumu && lisansDurumu.gecerli) {
        try {
            const durum = await API.lisansDurumu();
            if (!durum.gecerli) {
                lisansDurumu = durum;
                lisansUIGuncelle(durum);
                lisansEkraniGoster(durum.hata || "Lisansınız geçersiz veya iptal edilmiş.");
            } else {
                lisansDurumu = durum;
                lisansUIGuncelle(durum);
            }
        } catch {}
    }
}, 10 * 60 * 1000);

// =====================================================================
// OTOMATİK GÜNCELLEME İŞLEMLERİ
// =====================================================================
async function guncellemeKontrolEt() {
    try {
        const bilgi = await API.surumKontrolEt();
        if (bilgi && bilgi.guncellemeVar) {
            guncellemeBilgisi = bilgi;
            updateModalAc(bilgi, false);
            return true;
        }
    } catch (e) {}
    return false;
}

function surumKarsilastirHelper(v1, v2) {
    if (!v1 || !v2) return 0;
    const p1 = String(v1).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

function updateModalAc(bilgi, zorunlu = false) {
    guncellemeBilgisi = bilgi;
    const footerEl = document.getElementById("footerVersion");
    const curVer = (bilgi.currentVersion || (footerEl ? footerEl.textContent.replace("v", "").trim() : "1.0.6")).replace(/^v/i, "");
    const latestVer = (bilgi.latestVersion || curVer).replace(/^v/i, "");

    // KESİN GÜVENLİK KONTROLÜ: Yeni sürüm mevcut sürümden daha büyük değilse güncelleme modalı asla açılmaz!
    // Bu sayede "yeni sürümden eski sürüme geçiş" gibi bir hata asla yaşanmaz.
    if (surumKarsilastirHelper(latestVer, curVer) <= 0) {
        console.log(`Mevcut sürümünüz (${curVer}) zaten güncel veya sunucudan yeni. Güncelleme penceresi açılmadı.`);
        return;
    }

    const modal = document.getElementById("updateModal");
    const currentPill = document.getElementById("currentVerTag");
    const newPill = document.getElementById("newVerTag");
    const laterBtn = document.getElementById("btnUpdateLater");
    const listEl = document.getElementById("modalChangelogList");
    const titleEl = document.getElementById("changelogVersionTitle");

    if (currentPill) currentPill.textContent = `v${curVer}`;
    if (newPill) newPill.textContent = `v${latestVer}`;
    if (titleEl) titleEl.textContent = `✨ v${latestVer} İLE GELEN YENİLİKLER`;

    // Yenilikler listesini dinamik ve net doldur
    if (listEl) {
        listEl.innerHTML = "";
        if (Array.isArray(bilgi.changelog) && bilgi.changelog.length > 0) {
            bilgi.changelog.forEach(madde => {
                const li = document.createElement("li");
                li.textContent = madde;
                listEl.appendChild(li);
            });
        } else {
            const varsayilanlar = [
                "Kalıcı Lisans Mimarisi: Güncellemelerde lisans süreniz sıfırlanmaz, kaldığı süreden devam eder.",
                "Otomatik Süre Kilidi: Süresi dolan lisansların girişi engellenir, açık oyunlar kapatılır.",
                "TikTok VS OBS Widget'ı: Profil fotoğrafları ve hediye puanları kristal netliğinde yenilendi.",
                "Profil Puanlama: Süre bitince profil ekrandan otomatik kayboluyor ve neon sayaç çalışıyor.",
                "İzleyici Listesi: Canlı yayında mesaj yazanlar ve çift tıklayanlar listenin en üstüne çıkıyor."
            ];
            varsayilanlar.forEach(madde => {
                const li = document.createElement("li");
                li.textContent = madde;
                listEl.appendChild(li);
            });
        }
    }

    if (laterBtn) {
        laterBtn.style.display = zorunlu ? "none" : "block";
    }

    if (modal) modal.style.display = "flex";
}

function updateModalKapat() {
    const modal = document.getElementById("updateModal");
    if (modal) modal.style.display = "none";
}

async function guncellemeBaslat() {
    const btn = document.getElementById("btnUpdateNow");
    const licBtn = document.getElementById("licenseUpdateBtn");
    const progressBox = document.getElementById("updateProgressBox");
    const progressBar = document.getElementById("updateProgressBar");
    const percentSpan = document.getElementById("updatePercent");
    const mbStat = document.getElementById("updateMbStat");
    const statusMsg = document.getElementById("updateStatusMsg");

    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ İndiriliyor...";
    }
    if (licBtn) {
        licBtn.disabled = true;
        licBtn.textContent = "⏳ İndiriliyor...";
    }

    // Modalı aç ve ilerleme kutusunu göster
    const modal = document.getElementById("updateModal");
    if (modal) modal.style.display = "flex";
    const laterBtn = document.getElementById("btnUpdateLater");
    if (laterBtn) laterBtn.style.display = "none";
    if (progressBox) progressBox.style.display = "block";

    API.guncellemeIlerlemeDinle((prog) => {
        const pct = prog.percent || 0;
        if (progressBar) progressBar.style.width = pct + "%";
        if (percentSpan) percentSpan.textContent = `%${pct}`;
        if (mbStat) mbStat.textContent = `${prog.transferredMB || 0} MB / ${prog.totalMB || "?"} MB`;
        if (statusMsg) statusMsg.textContent = prog.mesaj || "Yeni sürüm dosyaları indiriliyor...";
    });

    API.guncellemeBittiDinle(() => {
        if (progressBar) progressBar.style.width = "100%";
        if (percentSpan) percentSpan.textContent = "%100";
        if (statusMsg) statusMsg.textContent = "İndirme tamamlandı! Uygulama güncelleniyor ve yeniden başlatılıyor...";
        const installingOverlay = document.getElementById("installingOverlay");
        const installingMessage = document.getElementById("installingMessage");
        if (installingMessage) installingMessage.textContent = "Yeni sürüm kuruluyor. Lütfen uygulamayı kapatmayın.";
        if (installingOverlay) installingOverlay.style.display = "flex";
    });

    try {
        const downloadUrl = (guncellemeBilgisi && guncellemeBilgisi.downloadUrl) ? guncellemeBilgisi.downloadUrl : null;
        const res = await API.guncellemeIndirVeKur(downloadUrl);
        if (!res.basarili) {
            if (statusMsg) statusMsg.textContent = "Hata: " + (res.hata || "İndirme başarısız");
            if (btn) {
                btn.disabled = false;
                btn.textContent = "⚡ Tekrar Dene";
            }
            if (licBtn) {
                licBtn.disabled = false;
                licBtn.textContent = "⚡ Tekrar Dene";
            }
        }
    } catch (err) {
        if (statusMsg) statusMsg.textContent = "Güncelleme hatası: " + err.message;
        if (btn) {
            btn.disabled = false;
            btn.textContent = "⚡ Tekrar Dene";
        }
        if (licBtn) {
            licBtn.disabled = false;
            licBtn.textContent = "⚡ Tekrar Dene";
        }
    }
}

// =====================================================================
// DİNAMİK ARKA PLAN VİDEO DÖNGÜSÜ (48+ Video, 2-4 sn Sınırsız Crossfade)
// =====================================================================
let bgVideoListesi = [];
let bgAktifIndex = 0;
let bgVideoTimer = null;
let bgAktifKanal = "A"; // "A" veya "B"

async function videoDongusuBaslat() {
    const videoA = document.getElementById("bgVideoA");
    const videoB = document.getElementById("bgVideoB");
    if (!videoA || !videoB) return;

    try {
        if (API.arkaPlanVideolari) {
            bgVideoListesi = await API.arkaPlanVideolari();
        }
    } catch (e) {
        console.warn("Video listesi IPC hatası:", e);
    }

    if (bgVideoTimer) clearInterval(bgVideoTimer);
    if (!bgVideoListesi?.length) return;

    // İlk videoyu başlat
    const savedIndex=Number(localStorage.getItem("mng_selected_background")||-1);
    const initialIndex=savedIndex>=0&&savedIndex<bgVideoListesi.length?savedIndex:0;
    videoA.src = bgVideoListesi[initialIndex];
    videoA.muted = true;
    videoA.play().catch(() => {});
    videoA.classList.add("active");
    videoB.classList.remove("active");
    bgAktifKanal = "A";
    bgAktifIndex = initialIndex;

    if(savedIndex>=0)return;

    // Sonraki videoyu önceden B'ye hazırla
    if (bgVideoListesi.length > 1) {
        videoB.src = bgVideoListesi[1];
        videoB.muted = true;
    }

    // Her 3.2 saniyede bir sonraki videoya yumuşak geçiş yap
    if (bgVideoTimer) clearInterval(bgVideoTimer);
    bgVideoTimer = setInterval(sonrakiArkaPlanVideosu, 3200);
}

function sonrakiArkaPlanVideosu() {
    if (!bgVideoListesi || bgVideoListesi.length <= 1) return;

    const videoA = document.getElementById("bgVideoA");
    const videoB = document.getElementById("bgVideoB");
    if (!videoA || !videoB) return;

    bgAktifIndex = (bgAktifIndex + 1) % bgVideoListesi.length;
    const sonrakiUrl = bgVideoListesi[bgAktifIndex];
    const birSonrakiIndex = (bgAktifIndex + 1) % bgVideoListesi.length;

    if (bgAktifKanal === "A") {
        // B kanalına geçiş yap
        videoB.src = sonrakiUrl;
        videoB.muted = true;
        const playPromise = videoB.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                videoB.classList.add("active");
                videoA.classList.remove("active");
                bgAktifKanal = "B";
                // A kanalına bir sonrakini hazırla
                setTimeout(() => {
                    if (videoA) videoA.src = bgVideoListesi[birSonrakiIndex];
                }, 1300);
            }).catch(() => {
                // Oynatılamadıysa direkt index ilerlet
                videoA.classList.add("active");
            });
        }
    } else {
        // A kanalına geçiş yap
        videoA.src = sonrakiUrl;
        videoA.muted = true;
        const playPromise = videoA.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                videoA.classList.add("active");
                videoB.classList.remove("active");
                bgAktifKanal = "A";
                // B kanalına bir sonrakini hazırla
                setTimeout(() => {
                    if (videoB) videoB.src = bgVideoListesi[birSonrakiIndex];
                }, 1300);
            }).catch(() => {
                videoB.classList.add("active");
            });
        }
    }
}

// =====================================================================
// OYUN KARTLARINA DİNAMİK MOUSE HOVER PARLAMA EFEKTİ (Glow Effect)
// =====================================================================
function kartParlamaEfektiBaslat() {
    // Sayfadaki mevcut ve sonradan eklenecek tüm kartlar için event delegation
    document.addEventListener("mousemove", (e) => {
        const kart = e.target.closest(".game-card");
        if (!kart) return;

        const rect = kart.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        kart.style.setProperty("--mouse-x", `${x}px`);
        kart.style.setProperty("--mouse-y", `${y}px`);
    });

    document.addEventListener("mouseleave", (e) => {
        const kart = e.target.closest && e.target.closest(".game-card");
        if (kart) {
            kart.style.setProperty("--mouse-x", "50%");
            kart.style.setProperty("--mouse-y", "50%");
        }
    }, true);
}

// =====================================================================
// OBS WIDGET LINK KOPYALAMA
// =====================================================================
function obsLinkKopyala(oyun) {
    let url = "";
    let aciklama = "";
    if (oyun === "vs") {
        url = "http://localhost:3000/widget-vs.html";
        aciklama = "TikTok VS Arena OBS Widget linki";
    } else if (oyun === "puanlama") {
        url = "http://localhost:3000/widget.html";
        aciklama = "Profil Puanlama OBS Widget linki";
    } else if (oyun === "orbit") {
        url = "http://localhost:3010/winner-widget.html";
        aciklama = "MNG Orbit Yörünge OBS Widget linki";
    } else if (oyun === "crowdControl" || oyun === "crowd-control") {
        url = "http://localhost:3020/widget.html";
        aciklama = "MNG Crowd Control OBS Sıralama Widget linki";
    }
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        statusGoster(`✓ ${aciklama} kopyalandı! OBS'te 'Tarayıcı' kaynağı ekleyip bu linki yapıştırın.`);
        setTimeout(() => statusGizle(), 4500);
    }).catch(() => {
        prompt("OBS Widget Linkiniz (kopyalayın):", url);
    });
}

function launcherGorselEfektleriniBaslat() {
    const loginSlogan = document.getElementById('licenseSlogan');
    if (loginSlogan) {
        let index = 0;
        setInterval(() => {
            if (!loginSlogan.getClientRects().length) return;
            index = (index + 1) % LAUNCHER_SLOGANS.length;
            loginSlogan.textContent = LAUNCHER_SLOGANS[index];
        }, 4800);
    }
    if (API.workspace) return;
    let gifts = [], last = 0;
    const slogans = LAUNCHER_SLOGANS;
    const headline = document.getElementById("gamesHeadline");
    let sloganIndex = 0;
    const showSlogan = () => {
        if (!headline) return;
        headline.classList.add("headline-out");
        setTimeout(() => {
            headline.innerHTML = `<span>${slogans[sloganIndex]}</span>`;
            headline.classList.remove("headline-out");
            headline.classList.add("headline-in");
            setTimeout(() => headline.classList.remove("headline-in"), 520);
            sloganIndex = (sloganIndex + 1) % slogans.length;
        }, 360);
    };
    showSlogan();
    setInterval(showSlogan, 4800);
    fetch("gift-assets/katalog_tam.json").then(r => r.json()).then(async list => {
        gifts = list.filter(g => g.file).map(g => g.file);
        if (!headline || !gifts.length) return;
        const picks = gifts.filter((_, index) => index % Math.max(1, Math.floor(gifts.length / 12)) === 0).slice(0, 12);
        const images = await Promise.all(picks.map(file => new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = `gift-assets/${encodeURIComponent(file)}`;
        })));
        const texture = document.createElement("canvas"); texture.width = 720; texture.height = 180;
        const textureContext = texture.getContext("2d");
        images.filter(Boolean).forEach((image, index) => {
            const x = 12 + (index % 6) * 118, y = 8 + Math.floor(index / 6) * 88;
            textureContext.drawImage(image, x, y, 76, 76);
        });
        headline.style.setProperty("--gift-headline-texture", `url(${texture.toDataURL("image/png")})`);
        for (const side of ["left", "right"]) {
            const rail = document.createElement("div");
            rail.className = `launcher-gift-rail ${side}`;
            for (let i = 0; i < 10; i++) {
                const bubble = document.createElement("img");
                bubble.src = `gift-assets/${encodeURIComponent(gifts[(i * 7 + (side === "right" ? 3 : 0)) % gifts.length])}`;
                bubble.style.setProperty("--delay", `${-i * 1.15}s`);
                bubble.style.setProperty("--offset", `${8 + Math.random() * 48}px`);
                bubble.style.setProperty("--bubble-size", `${60 + Math.random() * 24}px`);
                bubble.style.setProperty("--drift", `${(Math.random() - .5) * 55}px`);
                bubble.style.setProperty("--rise-time", `${11 + Math.random() * 9}s`);
                rail.appendChild(bubble);
            }
            document.body.appendChild(rail);
        }
    }).catch(() => {});
    document.addEventListener("mousemove", event => {
        const now = performance.now(); if (!gifts.length || now - last < 48) return; last = now;
        const img = document.createElement("img"); img.className = "gift-cursor-particle"; img.src = `gift-assets/${encodeURIComponent(gifts[Math.floor(Math.random() * gifts.length)])}`;
        img.style.left = `${event.clientX}px`; img.style.top = `${event.clientY}px`; img.style.setProperty("--drift-x", `${(Math.random() - .5) * 80}px`); img.style.setProperty("--turn", `${(Math.random() - .5) * 55}deg`);
        document.body.appendChild(img); setTimeout(() => img.remove(), 950);
    }, { passive: true });
}
document.addEventListener("DOMContentLoaded", launcherGorselEfektleriniBaslat, { once: true });
