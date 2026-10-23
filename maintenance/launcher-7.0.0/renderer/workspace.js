'use strict';
(() => {
    const api = window.mngAPI;
    const speechEngine = window.MNGSpeechEngine?.createSpeechEngine({ bridge: {
        listVoices: data => call('speech-status',data), synthesize: data => call('speech-synthesize',data), cancel: () => call('speech-cancel') } });
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
    const speechTestText = window.MNGSpeechPreviews?.spokenText || "Tik. Em. En. Ge. Geym lonçır'a hoş geldiniz. Canlı yayın sohbetini sesli okuyabilirim.";
    const covers = {caahr:'caahr-v2',vs:'vs-v4',puanlama:'puanlama-v4',orbit:'orbit-v4','crowd-control':'crowd-control-v4','battle-game':'battle-game-v3','duck-hunt':'duck-hunt-v3','pony-life':'pony-life-v3','frog-river':'frog-river-v3','penalty-kick':'penalty-kick-v3','battle-royale':'battle-royale-v3','snow-war':'snow-war-v3','zombie-war':'zombie-war-v3','gelene-gecene':'gelene-gecene-v3','tightrope-balance':'tightrope-balance-v4'};
    const state = { view:'games', game:null, data:null, search:'', filter:'all', category:'all', mediaSearch:'', mediaCategory:'', mediaPage:0, progress:new Map(), voiceProgress:new Map(), media:null, mediaDuration:0, gifts:[], voices:[], queue:[], speaking:false, speechGeneration:0, activeSpeech:null, speechDraft:null, sourceDraft:null, lastUsers:new Map(), widgetInfo:null };
    const newGames = new Set(['battle-royale','snow-war','zombie-war','caahr']);
    const labels = { games:'Oyunlar', widgets:'Widget’lar', media:'Video Stüdyosu', sounds:'Ses Efektleri', speech:'Sesli Yorumlar', downloads:'İndirmeler', settings:'Ayarlar' };
    let soundPreview = null;
    let remoteVideoPreview = null;
    function stopRemoteVideo(){if(remoteVideoPreview){remoteVideoPreview.pause();remoteVideoPreview.currentTime=0;remoteVideoPreview=null;}}
    async function previewRemoteSound(id,button){
        if(soundPreview?.id==='remote:'+id){stopSoundPreview();return;}
        stopRemoteVideo();stopSoundPreview();const item=(state.data.remoteMedia||[]).find(item=>item.id===id&&mediaKind(item)==='audio');if(!item)return;
        const audio=new Audio(item.url);soundPreview={id:'remote:'+id,audio,button};audio.volume=.8;
        audio.onended=()=>{if(soundPreview?.audio===audio)stopSoundPreview();};audio.onerror=()=>{if(soundPreview?.audio===audio){stopSoundPreview();notify('Ses ön izlemesi açılamadı. Bağlantıyı kontrol edin.',true);}};
        button.innerHTML=icon('square');button.setAttribute('aria-pressed','true');window.lucide?.createIcons();
        try{await audio.play();}catch(error){if(soundPreview?.audio===audio){stopSoundPreview();throw error;}}
    }
    function stopSoundPreview(){if(!soundPreview)return;const previous=soundPreview;soundPreview=null;previous.frame?.remove();if(previous.audio){previous.audio.onended=null;previous.audio.onerror=null;previous.audio.pause();previous.audio.removeAttribute('src');previous.audio.load();}if(previous.button.isConnected){previous.button.innerHTML=icon('play');previous.button.setAttribute('aria-pressed','false');window.lucide?.createIcons();}}
    function soundStarters(){return `<section class="sound-starters"><div class="band-heading"><h2>Başlangıç Sesleri</h2><span>TikMnG · ${(state.data.soundEffects||[]).length} efekt</span></div><div class="starter-sound-list">${(state.data.soundEffects||[]).map(item=>`<article class="asset-sound-row"><button class="workspace-icon" data-builtin-preview="${esc(item.id)}" aria-pressed="false" title="Sesi dinle / durdur" aria-label="${esc(item.title)} sesini dinle">${icon('play')}</button><div><strong>${esc(item.title)}</strong><small>${esc(item.category)}</small></div><button class="workspace-button" data-sound-add="${esc(item.id)}">${icon('plus')} Ekle</button></article>`).join('')}</div></section>`;}
    async function previewBuiltin(id,button){
        if(soundPreview?.id==='builtin:'+id){stopSoundPreview();return;}
        stopSoundPreview();const sound=(state.data.soundEffects||[]).find(item=>item.id===id);if(!sound||!/^[a-z0-9-]+\.wav$/.test(sound.file))return;
        const audio=new Audio('assets/sound-effects/'+sound.file);soundPreview={id:'builtin:'+id,audio,button};audio.volume=.8;
        audio.onended=()=>{if(soundPreview?.audio===audio)stopSoundPreview();};audio.onerror=()=>{if(soundPreview?.audio===audio){stopSoundPreview();notify('Ses örneği açılamadı.',true);}};
        button.innerHTML=icon('square');button.setAttribute('aria-pressed','true');window.lucide?.createIcons();
        try{await audio.play();}catch(error){if(soundPreview?.audio===audio){stopSoundPreview();throw error;}}
    }
    function previewSound(id,button){
        if(soundPreview?.id===id){stopSoundPreview();return;}
        stopSoundPreview();const item=[...(state.data.audioLibrary||[]),...state.data.media].find(item=>item.id===id&&item.kind==='audio');if(!item)return;
        const frame=document.createElement('iframe'),url=new URL(mediaPreviewUrl(item,'hover'));url.searchParams.set('once','1');
        frame.src=url.href;frame.allow='autoplay';frame.title=item.title+' ses ön izlemesi';frame.className='sound-preview-frame';frame.hidden=true;
        $('workspaceRoot').append(frame);soundPreview={id,frame,button};button.innerHTML=icon('square');button.setAttribute('aria-pressed','true');window.lucide?.createIcons();
    }
    const mb = bytes => bytes ? `${(bytes / 1048576).toFixed(1)} MB` : 'Boyut bekleniyor';
    const libraryAssets = () => state.data.mediaAssets || state.data.audioLibrary || [];
    function mediaKind(item){
        if(['video','audio','image'].includes(item.kind))return item.kind;
        try{const pathname=new URL(item.url).pathname.toLowerCase(),extension=pathname.slice(pathname.lastIndexOf('.'));return({'.mp3':'audio','.wav':'audio','.ogg':'audio','.gif':'image','.png':'image','.jpg':'image','.jpeg':'image','.webp':'image','.mp4':'video','.webm':'video'})[extension]||'video';}catch{return '';}
    }
    const mediaInView = item => state.game?Boolean(mediaKind(item)):state.view==='sounds'?mediaKind(item)==='audio':['video','image'].includes(mediaKind(item));
    const mediaKinds = () => state.game?[['','Tümü'],['video','Videolar'],['audio','Sesler'],['image','GIF / Görseller']]:state.view==='sounds'?[['audio','Sesler']]:[['','Tümü'],['video','Videolar'],['image','GIF / Görseller']];
    function mediaCategories(){
        const kind=state.view==='sounds'&&!state.game?'audio':state.mediaKind||'';
        const entries=[...libraryAssets(),...(state.data.media||[]).filter(item=>(item.gameId||'')===(state.game||'')),...(state.data.remoteMedia||[])];
        return [...new Set(entries.filter(mediaInView).filter(item=>!kind||mediaKind(item)===kind).map(item=>item.category||'Genel'))].sort((a,b)=>a.localeCompare(b,'tr'));
    }
    function renderMediaCategories(){
        const categories=mediaCategories();if(state.mediaCategory&&!categories.includes(state.mediaCategory))state.mediaCategory='';
        $('mediaCategoryTabs').innerHTML=['',...categories].map(category=>`<button role="tab" aria-selected="${state.mediaCategory===category}" data-media-category="${esc(category)}">${esc(category||'Tümü')}</button>`).join('');
    }
    const broadcastURL = item => Object.hasOwn(item||{},'broadcastUrl') ? item.broadcastUrl : item?.overlayUrl||'';
    const scrollWorkspaceTop=()=>{$('workspaceBody')?.closest('.main')?.scrollTo(0,0);};
    function notify(text, error=false) { const node=$('workspaceNotice'); node.textContent=text; node.classList.toggle('error',error); node.hidden=false; clearTimeout(notify.timer); notify.timer=setTimeout(()=>{node.hidden=true;},6000); }
    async function call(action,data) { const result=await api.workspace(action,data); if(result?.error) throw Object.assign(new Error(result.error),{code:result.code}); return result; }
    async function refresh(remote=false) { state.data=await call(remote?'refresh':'snapshot'); render(); }
    const gameCategory = game => ['battle-royale','snow-war','zombie-war'].includes(game.id)?'minecraft':game.id==='gelene-gecene'?'steam':'web';
    const description = game => game.description || document.getElementById(gameKey(game.id)+'Card')?.querySelector('.game-desc')?.textContent || 'Canlı yayın oyunu';
    const cover = game => covers[game.id] ? `<img src="assets/game-covers/${covers[game.id]}.png" alt="${esc(game.ad)}" loading="lazy">` : `<div class="game-letter">${icon(game.id==='zombie-war'?'skull':'gamepad-2')}</div>`;
    function render() {
        stopRemoteVideo();
        if(!state.data)return;
        stopSoundPreview();
        $('workspaceVersion').textContent='v'+state.data.version+(state.data.preview?' · TEST':'');
        $('workspaceEdition').hidden=!state.data.preview;
        $('workspaceEdition').textContent='YÖNETİCİ ÖN İZLEME';
        document.querySelectorAll('[data-workspace-view]').forEach(button=>button.classList.toggle('selected',button.dataset.workspaceView===state.view));
        $('workspaceTitle').textContent=state.game ? state.data.games.find(g=>g.id===state.game)?.ad || 'Oyun' : labels[state.view];
        $('workspaceBreadcrumb').textContent=state.game?'OYUN KÜTÜPHANESİ':'TIKMNG / YAYIN MERKEZİ';
        const body=$('workspaceBody');
        if(state.game)renderGame(body);
        else if(state.view==='games')renderGames(body);
        else if(state.view==='media'||state.view==='sounds')renderMedia(body);
        else if(state.view==='speech')renderSpeech(body);
        else if(state.view==='widgets')renderWidgets(body);
        else if(state.view==='downloads')renderDownloads(body);
        else renderSettings(body);
        window.lucide?.createIcons();
    }
    function renderGames(body) {
        const games=state.data.games.filter(g=>(state.filter==='all'||(state.filter==='installed'?g.installed:!g.installed))&&(state.category==='all'||gameCategory(g)===state.category)&&[g.ad,description(g)].join(' ').toLocaleLowerCase('tr').includes(state.search));
        body.innerHTML=`<div class="workspace-tools"><div class="library-summary"><h2>Oyun Kütüphanesi</h2><span>${state.data.games.length} oyun · ${state.data.games.filter(g=>g.installed).length} kurulu</span></div><label class="workspace-search">${icon('search')}<input id="librarySearch" type="search" value="${esc(state.search)}" placeholder="Oyun ara" aria-label="Oyun ara"></label><select id="libraryFilter" aria-label="Kurulum durumu"><option value="all">Bütün oyunlar</option><option value="installed">Kurulu oyunlar</option><option value="available">İndirilebilir oyunlar</option></select></div><div class="library-tabs" role="tablist" aria-label="Oyun türü">${[['all','Tümü'],['minecraft','Minecraft'],['web','TikMnG'],['steam','Steam']].map(([id,title])=>`<button role="tab" aria-selected="${state.category===id}" data-category="${id}">${title}<small>${state.data.games.filter(g=>id==='all'||gameCategory(g)===id).length}</small></button>`).join('')}</div><div id="libraryGroups"></div>`;
        $('libraryFilter').value=state.filter;
        const groups=[['Kurulu Oyunlar',games.filter(g=>g.installed)],['Keşfet ve İndir',games.filter(g=>!g.installed)]];
        $('libraryGroups').innerHTML=groups.filter(([,games])=>games.length).map(([title,games])=>`<section class="library-band"><div class="band-heading"><h2>${title}</h2><span>${games.length} oyun</span></div><div class="library-grid">${games.map(g=>`<article class="library-card" data-game-id="${esc(g.id)}"><button class="cover-button" data-open="${esc(g.id)}" aria-label="${esc(g.ad)} sayfasına gir">${cover(g)}<span class="cover-badge ${g.installed?'ready':''}">${icon(g.installed?'check':'download')}${g.installed?(g.updateAvailable?'Güncelleme var':'Kurulu'):'İndirilebilir'}</span><span class="cover-enter">Gir ${icon('arrow-up-right')}</span><span class="cover-caption"><strong>${esc(g.ad)}</strong><small>${esc(g.boyut||'')}${icon('hard-drive')}</small></span></button></article>`).join('')}</div></section>`).join('')||'<p class="workspace-empty">Bu filtrede oyun bulunamadı.</p>';
        body.querySelectorAll('.library-card').forEach(card=>{const button=card.querySelector('.cover-button');if(newGames.has(card.dataset.gameId))button.insertAdjacentHTML('beforeend','<span class="cover-new">YENİ</span>');button.insertAdjacentHTML('beforeend',`<span class="cover-gifts" aria-hidden="true">${['5655','6064','5879','5303','7934','5658'].map((id,i)=>`<img src="gift-assets/${id}.png" alt="" style="--gift-index:${i}">`).join('')}</span>`);});
        $('librarySearch').addEventListener('input',event=>{state.search=event.target.value.toLocaleLowerCase('tr');const start=event.target.selectionStart;renderGames(body);$('librarySearch').focus();$('librarySearch').setSelectionRange(start,start);window.lucide?.createIcons();});
        $('libraryFilter').addEventListener('change',event=>{state.filter=event.target.value;render();});
        body.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{state.category=button.dataset.category;render();}));
    }
    function gameKey(id){return typeof window.oyunElKey==='function'?window.oyunElKey(id):id;}
    function progressMarkup(id) {
        const p=state.progress.get(id);
        if(!p)return '';
        const known=Number.isFinite(p.percent);
        const phaseLabel={downloading:p.updateMode?'Değişen oyun dosyaları indiriliyor':'Oyun paketi indiriliyor',verifying:'Dosyalar doğrulanıyor',extracting:'Oyun dosyaları kuruluyor',activating:'Kurulum tamamlanıyor',preparing:'İndirme hazırlanıyor',complete:'Tamamlandı'}[p.phase];
        return `<div class="download-status" role="status"><div class="download-meta"><strong>${esc(phaseLabel||p.message||p.mesaj||p.phase||'Hazırlanıyor')}</strong><span>${known?Math.round(p.percent)+'%':'İşlem sürüyor'}</span></div><div class="download-track ${known?'':'indeterminate'}"><span style="width:${known?Math.max(0,Math.min(100,p.percent)):32}%"></span></div><div class="download-meta"><span>${mb(p.transferredBytes)}${p.totalBytes?' / '+mb(p.totalBytes):''}</span><span>${p.speedBps?mb(p.speedBps)+'/sn':''}${p.etaSeconds?' · '+Math.ceil(p.etaSeconds)+' sn':''}</span></div></div>`;
    }
    function renderGame(body) {
        const g=state.data.games.find(g=>g.id===state.game); if(!g){state.game=null;return render();}
        const busy=state.progress.has(g.id);
        body.innerHTML=`<button class="back-command" data-back>${icon('arrow-left')} Oyunlara dön</button><div class="game-detail"><div class="game-detail-cover">${cover(g)}</div><div class="game-detail-info"><span class="install-state ${g.installed?'ready':''}">${g.installed?'Kurulu':'Henüz kurulmadı'}</span><h2>${esc(g.ad)}</h2><p>${esc(description(g))}</p><dl><div><dt>Kurulu sürüm</dt><dd>${esc(g.installedVersion||'—')}</dd></div><div><dt>Güncel paket</dt><dd>${esc(g.availableVersion||'—')}</dd></div><div><dt>Gereksinimler</dt><dd>${esc(g.requirements)}</dd></div></dl><div class="detail-commands">${g.installed?`<button class="workspace-button primary" data-play="${esc(g.id)}" ${busy?'disabled':''}>${icon('play')} Oyna</button>`:''}<button class="workspace-button ${g.installed?'':'primary'}" data-install="${esc(g.id)}" ${busy?'disabled':''}>${icon(g.installed?'refresh-cw':'download')} ${g.installed?(g.updateAvailable?'Oyunu güncelle':'Dosyaları onar'):'Yükle'}</button>${g.installed?`<button class="workspace-icon danger" title="Oyunu kaldır" aria-label="Oyunu kaldır" data-remove="${esc(g.id)}">${icon('trash-2')}</button>`:''}</div><div id="detailProgress">${progressMarkup(g.id)}</div>${busy?`<button class="back-command" data-cancel="${esc(g.id)}">${icon('pause')} İndirmeyi durdur</button>`:''}</div></div><section class="detail-band"><h2>Yayın Dosyaları</h2><div class="resource-list">${g.resources?.length?g.resources.map(r=>`<button class="workspace-button" data-url="${esc(r.url)}">${icon('download')} ${esc(r.title)}</button>`).join(''):'<span class="muted">Ek dosya bulunmuyor.</span>'}</div></section>`;
        if(g.id==='caahr'){
            const commands=body.querySelector('.game-detail-info .detail-commands');
            const steam=`<button class="workspace-button" data-url="https://store.steampowered.com/app/4745400/CAAAHR_Demo/" title="CAAAHR! Demo Steam sayfasını aç">${icon('external-link')} Steam'den indir</button>`;
            const play=commands.querySelector('[data-play]');
            if(play)play.insertAdjacentHTML('afterend',steam);else commands.insertAdjacentHTML('afterbegin',steam);
        }
        if(g.giftGuide)body.querySelector('.game-detail-info .detail-commands').insertAdjacentHTML('beforeend',`<button class="workspace-button guide-download" data-gift-guide="${esc(g.id)}">${icon('image-down')} Hazır hediye görselini indir</button>`);
        body.insertAdjacentHTML('beforeend','<section class="detail-band" id="gameMedia"></section>');
        $('gameMedia').insertAdjacentHTML('beforebegin',`<section class="detail-band game-setup"><h2>Yayına Hazırlık</h2><ol><li><span>01</span><div><strong>Oyunu yükle</strong><p>${g.installed?'Kurulum hazır. Güncelleme varsa Güncelle / Onar ile tamamlayabilirsin.':'Yükle düğmesine bas; indirme ve dosya doğrulaması tamamlanınca oyun hazır olacak.'}</p></div></li><li><span>02</span><div><strong>Yayın görselini hazırla</strong><p>${g.resources?.length?'Yayın Dosyaları bölümündeki hazır görseli indirip yayın sahnene ekle.':'Yayınına ekleyeceğin widget veya medyanın bağlantısını bu sayfadan seç.'}</p></div></li><li><span>03</span><div><strong>Yayın hesabını bağla</strong><p>Yayın Hesabı bölümüne TikTok kullanıcı adını yaz. Canlı yayının açıkken bağlantı durumunu kontrol et.</p></div></li><li><span>04</span><div><strong>Oyna ve başla</strong><p>${gameCategory(g)==='minecraft'?'Oyna ile Minecraft ve mod dosyaları hazırlanır. Oyun açılınca oyun içindeki hediye eşleşmelerini kontrol edip turu başlat.':'Oyna ile oyunu aç. Oyun içindeki hediye eylemlerini kontrol edip yayına başla.'}</p></div></li></ol></section>`);
        if(g.giftGuide)body.querySelector('.game-setup li:nth-child(2) p').textContent='Hazır görseli indir düğmesiyle PNG dosyasını alıp yayın sahnene ekle.';
        renderMedia($('gameMedia'),true);
    }
    function renderMedia(body,game=false) {
        const gameId=game?state.game:'';
        const soundsView=state.view==='sounds'&&!game;
        if(!mediaKinds().some(([kind])=>kind===state.mediaKind))state.mediaKind='';
        const categories=mediaCategories();
        if(state.mediaCategory&&!categories.includes(state.mediaCategory))state.mediaCategory='';
        const url=broadcastURL(gameId?state.data.games.find(g=>g.id===gameId):state.data);
        body.innerHTML=`<div class="band-heading"><div><h2>${game?'Oyuna Özel Medya Eylemleri':'Video Stüdyosu'}</h2><span id="mediaCount" role="status"></span></div><div class="detail-commands">${game?`<button class="workspace-button primary" data-action="media-library">${icon('library')} Eylem ekle</button>`:''}<button class="workspace-button" data-action="media-new">${icon('link')} URL ekle</button>${game?'':`<button class="workspace-icon" title="Arşiv ekle" aria-label="Arşiv ekle" data-action="media-folder">${icon('folder-open')}</button>`}<button class="workspace-button ${game?'':'primary'}" data-action="media-import">${icon('import')} Medya ekle</button></div></div><div class="overlay-link"><label for="allMediaLink">${game?'Bu oyuna özel yayın bağlantısı':'Genel medya yayın bağlantısı'}</label><div><input id="allMediaLink" readonly value="${esc(url)}"><button class="workspace-icon" data-copy="${esc(url)}" title="Bağlantıyı kopyala" aria-label="Bağlantıyı kopyala">${icon('copy')}</button></div></div><div class="workspace-tools media-filters"><label class="workspace-search">${icon('search')}<input id="mediaSearch" type="search" value="${esc(state.mediaSearch)}" placeholder="Video, ses veya görsel ara" aria-label="Video veya ses ara" aria-controls="mediaLibrary remoteMediaLibrary"></label></div><div class="library-tabs media-category-tabs" role="tablist" aria-label="Medya kategorisi">${['',...categories].map(c=>`<button role="tab" aria-selected="${state.mediaCategory===c}" data-media-category="${esc(c)}">${esc(c||'Tümü')}</button>`).join('')}</div><div id="mediaLibrary" class="media-library"></div>${game?'':`<section class="detail-band"><div class="band-heading"><h2>Yayımlanan Medya</h2><span id="remoteMediaCount" role="status"></span></div><div id="remoteMediaLibrary" class="media-library"></div></section>`}`;
        if(soundsView){body.querySelector('h2').textContent='Ses Efektleri Kütüphanesi';body.querySelector('[data-action="media-import"]').innerHTML=icon('import')+' Ses ekle';$('mediaLibrary').insertAdjacentHTML('beforebegin','<section class="shared-sound-catalog"><div class="band-heading"><h2>İndirilen Sesler</h2><span id="soundCatalogCount" role="status"></span></div><div id="soundCatalog" class="starter-sound-list"></div><div id="soundCatalogPages" class="media-pagination"></div></section><h2 id="soundAssignmentsTitle" class="sound-assignments-title">Bu Yayının Ses Eylemleri</h2>');body.insertAdjacentHTML('beforeend',soundStarters());}
        if(!game&&!soundsView){$('mediaLibrary').insertAdjacentHTML('beforebegin','<section class="shared-media-catalog"><div class="band-heading"><h2>Video Kütüphanesi</h2><span id="videoCatalogCount" role="status"></span></div><div id="videoCatalog" class="media-library"></div><div id="videoCatalogPages" class="media-pagination"></div></section><h2 class="sound-assignments-title">Bu Yayının Medya Eylemleri</h2>');}
        if(!game&&!soundsView){const upload=body.querySelector('[data-action="media-import"]');upload.innerHTML=icon('upload')+' Kendi videonu ekle';upload.dataset.importKind='video';}
        const categoryTabs=body.querySelector('.media-category-tabs');categoryTabs.id='mediaCategoryTabs';
        const search=$('mediaSearch'),searchLabel=game?'Video, ses veya görsel ara':soundsView?'Ses efekti ara':'Video veya görsel ara';search.placeholder=searchLabel;search.setAttribute('aria-label',searchLabel);
        search.setAttribute('aria-controls',soundsView?'soundCatalog mediaLibrary remoteMediaLibrary':'videoCatalog mediaLibrary remoteMediaLibrary');
        if(game)body.querySelector('.band-heading .detail-commands').insertAdjacentHTML('beforeend',`<button class="workspace-button" data-action="sound-library">${icon('music-2')} Ses ekle</button>`);
        const kinds=mediaKinds();
        body.querySelector('.media-filters').insertAdjacentHTML('beforeend',`<div class="media-kind-tabs" role="group" aria-label="Medya türü">${kinds.map(([id,label])=>`<button class="workspace-button" data-media-kind="${id}" aria-pressed="${(soundsView?'audio':state.mediaKind||'')===id}">${icon(id==='audio'?'music-2':id==='image'?'image':id==='video'?'clapperboard':'library')}${label}</button>`).join('')}</div>`);
        body.querySelectorAll('[data-media-kind]').forEach(button=>button.addEventListener('click',()=>{stopSoundPreview();state.mediaKind=button.dataset.mediaKind;state.mediaPage=0;state.videoPage=0;body.querySelectorAll('[data-media-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderMediaLists();}));
        $('mediaSearch').addEventListener('input',event=>{stopSoundPreview();state.mediaSearch=event.target.value;state.mediaPage=0;state.soundPage=0;state.videoPage=0;renderMediaLists();});
        categoryTabs.addEventListener('click',event=>{const button=event.target.closest('[data-media-category]');if(!button)return;state.mediaCategory=button.dataset.mediaCategory;state.mediaPage=0;state.soundPage=0;state.videoPage=0;renderMediaLists();});
        renderMediaLists();
        const link=body.querySelector('.overlay-link');link.querySelector('label').textContent=game?'Bu oyuna özel HTTPS yayın bağlantısı':'Genel HTTPS medya yayın bağlantısı';
        link.querySelector('input').placeholder='HTTPS yayın bağlantısı hazırlanmalı';link.querySelector('[data-copy]').disabled=!url;
        link.insertAdjacentHTML('beforeend','<div class="overlay-connection" id="mediaConnection" role="status"><span class="source-dot"></span><span>Yayın kaynağı kontrol ediliyor…</span></div><button class="workspace-button overlay-retry" data-action="overlay-reconnect">'+icon('refresh-cw')+' Yayın bağlantısını hazırla</button>');
        updateMediaConnection();
    }
    function renderMediaLists(){
        stopRemoteVideo();
        stopSoundPreview();
        renderMediaCategories();
        const query=state.mediaSearch.trim().toLocaleLowerCase('tr');
        const kind=state.view==='sounds'&&!state.game?'audio':state.mediaKind||'';
        const matches=item=>mediaInView(item)&&(!kind||mediaKind(item)===kind)&&(!state.mediaCategory||(item.category||'Genel')===state.mediaCategory)&&[item.title,item.category||'Genel',item.giftId].join(' ').toLocaleLowerCase('tr').includes(query);
        const media=(state.data.media||[]).filter(item=>(item.gameId||'')===(state.game||'')&&mediaInView(item)),remote=(state.data.remoteMedia||[]).filter(mediaInView),localMatches=media.filter(matches),remoteMatches=remote.filter(matches);
        const pages=Math.max(1,Math.ceil(localMatches.length/24));state.mediaPage=Math.min(state.mediaPage,pages-1);
        const soundsView=state.view==='sounds'&&!state.game;
        $('mediaCount').textContent=soundsView?`${(state.data.audioLibrary||[]).length} ses · ${media.filter(item=>item.kind==='audio').length} eylem`:`${localMatches.length} / ${media.length} eylem`;
        if(soundsView)renderSoundCatalog(matches);
        if($('videoCatalog'))renderVideoCatalog(matches);
        if($('remoteMediaCount'))$('remoteMediaCount').textContent=`${remoteMatches.length} / ${remote.length} kayıt`;
        $('mediaLibrary').innerHTML=localMatches.slice(state.mediaPage*24,state.mediaPage*24+24).map(item=>`<article class="media-row" data-media-id="${esc(item.id)}"><div class="media-thumb">${item.kind==='audio'?icon('audio-lines'):`<iframe loading="lazy" tabindex="-1" allow="autoplay" title="${esc(item.title)} kapağı" src="${esc(mediaPreviewUrl(item,'poster'))}"></iframe>`}<button data-edit-media="${esc(item.id)}" aria-label="${esc(item.title)} ön izlemesi">${icon('play')}</button></div><div class="media-info"><small>${esc(item.category||'Genel')} · ${Math.round((item.volume??1)*100)}% ses</small><h3>${esc(item.title)}</h3><div class="gift-assignment">${giftMarkup(item.giftId)}${icon('arrow-right')}${icon(item.kind==='audio'?'audio-lines':'clapperboard')}</div></div><div class="detail-commands"><button class="workspace-icon" title="Ön izle ve test et" aria-label="${esc(item.title)} test et" data-edit-media="${esc(item.id)}">${icon('play')}</button><button class="workspace-icon" title="Düzenle" aria-label="${esc(item.title)} düzenle" data-edit-media="${esc(item.id)}">${icon('sliders-horizontal')}</button><button class="workspace-icon" title="Özel bağlantıyı kopyala" aria-label="Özel bağlantıyı kopyala" data-copy="${esc(broadcastURL(item))}" ${broadcastURL(item)?'':'disabled'}>${icon('link')}</button><button class="workspace-icon danger" title="Eşleştirmeyi kaldır" aria-label="Eşleştirmeyi kaldır" data-delete-media="${esc(item.id)}">${icon('trash-2')}</button></div></article>`).join('')||`<div class="workspace-empty">${media.length?'Bu filtrede medya bulunamadı.':'Henüz video eklenmedi.'}</div>`;
        let pagination=$('mediaPagination');if(!pagination){pagination=document.createElement('div');pagination.id='mediaPagination';pagination.className='media-pagination';$('mediaLibrary').after(pagination);}
        pagination.innerHTML=pages>1?`<button class="workspace-icon" data-media-page="${state.mediaPage-1}" ${state.mediaPage===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.mediaPage+1} / ${pages}</span><button class="workspace-icon" data-media-page="${state.mediaPage+1}" ${state.mediaPage===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
        if($('remoteMediaLibrary'))renderRemoteMedia(remoteMatches,remote.length);
        $('mediaLibrary').querySelectorAll('[data-media-id]').forEach(tile=>{tile.dataset.hoverMedia=tile.dataset.mediaId;});
        $('mediaLibrary').classList.toggle('sound-library',kind==='audio');
        if($('remoteMediaLibrary'))$('remoteMediaLibrary').closest('section').hidden=!remoteMatches.length;
        $('mediaLibrary').querySelectorAll('[data-media-id]').forEach(tile=>{const item=state.data.media.find(record=>record.id===tile.dataset.mediaId);if(item.kind!=='audio')return;tile.classList.add('sound-row');tile.querySelector('.media-thumb').innerHTML=`<button class="workspace-icon sound-play" data-sound-preview="${esc(item.id)}" aria-pressed="false" title="Sesi dinle / durdur" aria-label="${esc(item.title)} sesini dinle">${icon('play')}</button><span class="sound-file-kind">${esc((item.mime||'audio').split('/').at(-1).toUpperCase())}</span>`;});
        $('mediaLibrary').querySelectorAll('[data-media-id]').forEach(tile=>{const item=state.data.media.find(item=>item.id===tile.dataset.mediaId),button=tile.querySelector('[data-copy]');button.dataset.copy=broadcastURL(item);button.disabled=!button.dataset.copy;button.title=button.disabled?'HTTPS yayın bağlantısı henüz hazır değil':'HTTPS eylem bağlantısını kopyala';});
        bindMediaHovers($('mediaLibrary'));
        if(soundsView){$('mediaLibrary').hidden=!localMatches.length;$('soundAssignmentsTitle').hidden=!localMatches.length;}
        window.lucide?.createIcons();
    }
    function renderRemoteMedia(matches,total){
        const root=$('remoteMediaLibrary'),signature=[state.mediaSearch,state.mediaKind,state.mediaCategory,state.game,state.view].join('|');
        if(state.remoteFilter!==signature){state.remotePage=0;state.remoteFilter=signature;}
        const pageSize=12,pages=Math.max(1,Math.ceil(matches.length/pageSize));state.remotePage=Math.min(state.remotePage||0,pages-1);
        root.innerHTML=matches.slice(state.remotePage*pageSize,state.remotePage*pageSize+pageSize).map(item=>`<article class="media-row remote-media-row" data-remote-media-id="${esc(item.id)}"><div class="media-thumb">${mediaKind(item)==='video'?`<video src="${esc(item.url)}" preload="metadata" playsinline loop aria-label="${esc(item.title)} ön izlemesi"></video>`:mediaKind(item)==='image'?`<img loading="lazy" src="${esc(item.url)}" alt="${esc(item.title)}">`:`<button class="workspace-icon" data-remote-preview="${esc(item.id)}" aria-pressed="false" title="Sesi dinle / durdur" aria-label="${esc(item.title)} sesini dinle">${icon('play')}</button>`}</div><div class="media-info"><small>${esc(item.category||'Genel')} · ${mb(item.bytes)}</small><h3>${esc(item.title)}</h3></div><button class="workspace-button" data-download-media="${esc(item.id)}">${icon('download')} Kütüphaneme ekle</button></article>`).join('')||`<p class="workspace-empty">${total?'Bu filtrede yayımlanan medya bulunamadı.':'Yayımlanan medya yok.'}</p>`;
        let pager=$('remoteMediaPages');if(!pager){pager=document.createElement('div');pager.id='remoteMediaPages';pager.className='media-pagination';root.after(pager);}
        pager.innerHTML=pages>1?`<button class="workspace-icon" data-remote-page="${state.remotePage-1}" ${state.remotePage===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.remotePage+1} / ${pages}</span><button class="workspace-icon" data-remote-page="${state.remotePage+1}" ${state.remotePage===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
        root.querySelectorAll('video').forEach(video=>{
            const row=video.closest('article'),start=()=>{if(remoteVideoPreview===video)return;stopRemoteVideo();stopSoundPreview();remoteVideoPreview=video;video.volume=.8;video.play().catch(()=>{if(remoteVideoPreview===video)remoteVideoPreview=null;});};
            row.addEventListener('pointerenter',start);row.addEventListener('focusin',start);row.addEventListener('pointerleave',()=>{if(remoteVideoPreview===video)stopRemoteVideo();});row.addEventListener('focusout',event=>{if(!row.contains(event.relatedTarget)&&remoteVideoPreview===video)stopRemoteVideo();});
        });
    }
    function renderSoundCatalog(matches){
        const all=state.data.audioLibrary||[],list=all.filter(matches),pages=Math.max(1,Math.ceil(list.length/24));
        state.soundPage=Math.min(state.soundPage||0,pages-1);
        $('soundCatalogCount').textContent=`${list.length} / ${all.length} ses`;
        $('soundCatalog').innerHTML=list.slice(state.soundPage*24,state.soundPage*24+24).map(item=>`<article class="asset-sound-row"><button class="workspace-icon" data-sound-preview="${esc(item.id)}" aria-pressed="false" title="Sesi dinle / durdur" aria-label="${esc(item.title)} sesini dinle">${icon('play')}</button><div><strong>${esc(item.title)}</strong><small>${esc(item.category)} · ${item.bytes<1048576?Math.ceil(item.bytes/1024)+' KB':mb(item.bytes)}</small></div><button class="workspace-button" data-library-asset="${esc(item.id)}">${icon('plus')} Eylem ekle</button></article>`).join('')||'<p class="workspace-empty">Ses bulunamadı.</p>';
        $('soundCatalogPages').innerHTML=pages>1?`<button class="workspace-icon" data-sound-page="${state.soundPage-1}" ${state.soundPage===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.soundPage+1} / ${pages}</span><button class="workspace-icon" data-sound-page="${state.soundPage+1}" ${state.soundPage===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
    }
    function renderVideoCatalog(matches){
        const all=libraryAssets().filter(item=>['video','image'].includes(mediaKind(item))),list=all.filter(matches),pageSize=12,pages=Math.max(1,Math.ceil(list.length/pageSize));
        state.videoPage=Math.min(state.videoPage||0,pages-1);
        $('videoCatalogCount').textContent=`${list.length} / ${all.length} video ve görsel`;
        $('videoCatalog').innerHTML=list.slice(state.videoPage*pageSize,state.videoPage*pageSize+pageSize).map(item=>`<article class="media-row" data-library-media="${esc(item.id)}" data-hover-media="${esc(item.id)}"><div class="media-thumb"><iframe loading="lazy" tabindex="-1" allow="autoplay" title="${esc(item.title)} ön izlemesi" src="${esc(mediaPreviewUrl(item,'poster'))}"></iframe></div><div class="media-info"><small>${esc(item.category||'Genel')} · ${mb(item.bytes)}</small><h3>${esc(item.title)}</h3></div><div class="detail-commands"><button class="workspace-button" data-library-asset="${esc(item.id)}">${icon('plus')} Hediye eylemi ekle</button></div></article>`).join('')||'<p class="workspace-empty">Bu filtrede video bulunamadı.</p>';
        $('videoCatalogPages').innerHTML=pages>1?`<button class="workspace-icon" data-video-page="${state.videoPage-1}" ${state.videoPage===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.videoPage+1} / ${pages}</span><button class="workspace-icon" data-video-page="${state.videoPage+1}" ${state.videoPage===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
        bindMediaHovers($('videoCatalog'));
    }
    async function updateMediaConnection(){
        const node=$('mediaConnection'),gameId=state.game||'';if(!node)return;
        try{const status=await call(state.data.overlayTransport?'overlay-status':'media-status',{gameId});if(!node.isConnected)return;const count=Number(status.receivers)||0,transport=status.transport;
            node.classList.toggle('connected',transport?transport.ready&&count>0:count>0);node.querySelector('span:last-child').textContent=transport&&!transport.ready?transport.message:count?`${count} yayın kaynağı bağlı · ${status.configured||0} etkin eşleştirme`:'HTTPS bağlantısı hazır · Yayın kaynağı henüz bağlı değil';
            if(transport){const input=$('allMediaLink'),button=input?.parentElement.querySelector('[data-copy]');if(input)input.value=status.url||'';if(button){button.dataset.copy=status.url||'';button.disabled=!status.url;}}
            node.title=gameId&&status.activeGame!==gameId?'Hediye eylemleri bu oyun açıkken çalışır.':'OBS / TikTok LIVE Studio yayın kaynağı';}catch{node.querySelector('span:last-child').textContent='Yayın kaynağı durumu alınamadı';}
    }
    function renderSpeech(body) {
        const t=state.speechDraft||state.data.tts;
        body.innerHTML=`<form id="speechForm" class="settings-form"><div class="band-heading"><div><h2>Sesli Yorumlar</h2><span>Canlı yayındaki yorumlar</span></div><label class="toggle-label"><input name="enabled" type="checkbox" ${t.enabled?'checked':''}> Açık</label></div>
        <div class="settings-columns"><label>Kimlerin yorumları okunsun?<select name="audience">${[['all','Herkes'],['gift','Seçilen hediyeyi gönderenler'],['follow','Bu oturumda takip edenler'],['gift-or-follow','Hediye gönderen veya takip edenler'],['selected','Belirlediğim kullanıcılar'],['fanclub','Hayran kulübü üyeleri']].map(([id,label])=>`<option value="${id}" ${t.audience===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Okuma hakkı veren hediye<input type="hidden" name="giftId" value="${esc(t.giftId||'7934')}"><button type="button" class="gift-selector" id="speechGift" data-action="speech-gift">${giftMarkup(t.giftId||'7934')}${icon('chevron-down')}</button></label></div>
        <label>İzin verilen kullanıcı adları<input name="allowedUsers" maxlength="4000" value="${esc(t.allowedUsers||'')}" placeholder="@kullanici1, @kullanici2"></label>
        <p class="muted" id="audienceNote"></p>
        <input type="hidden" name="voicePreset" value="natural"><select name="provider" hidden><option value="">Tüm sesler</option><option value="offline">Çevrimdışı</option><option value="chatterbox">Doğal Türkçe</option><option value="windows">Windows</option></select>
        <select name="voiceURI" hidden></select><input name="allowOfflineFallback" type="checkbox" hidden ${t.allowOfflineFallback?'checked':''}><p id="speechAvailability" class="speech-availability" role="status"></p>
        <div class="settings-columns"><label>Ses düzeyi <output id="speechVolume">${Math.round(t.volume*100)}%</output><input name="volume" type="range" min="0" max="1" step="0.01" value="${t.volume}"></label><label>Konuşma hızı<input name="rate" type="range" min="0.5" max="2" step="0.05" value="${t.rate}"></label></div>
        <div class="settings-columns"><label>En fazla karakter<input name="maxLength" type="number" min="20" max="500" value="${t.maxLength}"></label><label>Kişi başına bekleme (sn)<input name="cooldownSeconds" type="number" min="1" max="60" value="${t.cooldownSeconds}"></label></div>
        <label>Okunmayacak kelimeler<textarea name="blockedWords" rows="3" placeholder="Virgülle ayır">${esc(t.blockedWords)}</textarea></label>
        <div class="detail-commands"><button type="submit" class="workspace-button primary">${icon('check')} Kaydet</button><button type="button" class="workspace-button" data-action="speech-test">${icon('volume-2')} Sesi dene</button><button type="button" class="workspace-icon" data-action="speech-stop" title="Konuşmayı durdur" aria-label="Konuşmayı durdur">${icon('square')}</button><button type="button" class="workspace-icon" data-action="speech-refresh" title="Sesleri yenile" aria-label="Sesleri yenile">${icon('refresh-cw')}</button></div><p id="speechStatus" class="muted" role="status"></p><section class="speech-text-test"><label for="speechTryText">Özel metin denemesi</label><textarea id="speechTryText" maxlength="500" rows="3">${esc(state.speechTryText??window.MNGSpeechPreviews?.text??'Merhaba, iyi yayınlar.')}</textarea><button type="button" class="workspace-button" data-action="speech-read">${icon('audio-lines')} Metni okut</button></section></form>
        <section class="speech-packs speech-voice-library detail-band"><div class="band-heading"><div><h2>Ses Kütüphanesi</h2><span>${state.voices.filter(voice=>['offline','chatterbox','windows'].includes(voice.provider)).length} ses hazır</span></div></div><div id="speechVoiceLibrary"></div></section>`;
        const form=$('speechForm');
        form.elements.provider.value=['offline','chatterbox','windows'].includes(t.provider)?t.provider:'';
        const packs=body.querySelector('.speech-packs'),layout=document.createElement('div');layout.className='speech-layout';form.before(layout);layout.append(form,packs);
        const visibility=()=>{const mode=form.elements.audience.value;form.elements.allowedUsers.closest('label').hidden=mode!=='selected';form.elements.giftId.closest('label').hidden=!['gift','gift-or-follow'].includes(mode);$('audienceNote').textContent=mode==='fanclub'?'Yalnızca yayıncının aktif hayran kulübü üyeleri. Üyelik bilgisi bulunmayan yorumlar okunmaz.':mode==='selected'?'Yalnızca belirlediğin kullanıcılar.':mode==='all'?'Yayındaki tüm yorumlar.':mode==='follow'?'Bu oturumda takip edenler.': 'Seçilen hediyeyi gönderenlerin hakkı bu oturumda kalır. Hediye değiştirildiğinde yeniden hediye göndermeleri gerekir.';};visibility();form.elements.audience.addEventListener('change',visibility);
        form.elements.volume.addEventListener('input',()=>{$('speechVolume').textContent=Math.round(form.elements.volume.value*100)+'%';});
        form.elements.provider.addEventListener('change',()=>{stopSpeech();updateSpeechVoiceOptions(true);});
        form.elements.voiceURI.addEventListener('change',()=>{stopSpeech();state.speechDraft=formDraft(form);updateSpeechVoiceOptions();});
        form.elements.audience.addEventListener('change',stopSpeech);trackDraft(form,'speechDraft');updateSpeechVoiceOptions();
        $('speechTryText').addEventListener('input',event=>{state.speechTryText=event.target.value;});
        form.addEventListener('submit',event=>{event.preventDefault();act(async()=>{const submitted=formDraft(form);state.data=await call('tts',speechValues());if(JSON.stringify(state.speechDraft)===JSON.stringify(submitted))state.speechDraft=null;stopSpeech();notify('Ses ayarları kaydedildi.');});});
    }
    function renderSpeechLibrary(){
        const root=$('speechVoiceLibrary');if(!root)return;
        const ready=state.voices.filter(voice=>['offline','chatterbox','windows'].includes(voice.provider));
        const packs=state.speechCatalog?.packs||window.MNGSpeechPreviews?.fastVoices||[];
        const natural=state.speechCatalog?.voiceLibrary||state.data.voiceLibrary||[];
        const naturalProgress=[...state.voiceProgress.values()].find(progress=>(progress.id==='chatterbox-tr-v1'||progress.id.startsWith('chatterbox:'))&&!['complete','cancelled','error'].includes(progress.phase));
        const naturalInstalling=Boolean(naturalProgress);
        const engineReady=state.speechCatalog?.providers?.chatterbox?.engineReady||ready.some(voice=>voice.provider==='chatterbox');
        const commonBytes=Number(state.speechCatalog?.downloadPack?.commonBytes||state.speechCatalog?.downloadPack?.downloadBytes||0);
        const checking=!state.speechCatalog;
        const selected=$('speechForm')?.elements.voiceURI.value||state.speechDraft?.voiceURI||state.data.tts.voiceURI;
        const previewTools=voice=>`${window.MNGSpeechPreviews?.source(voice.voiceURI)||ready.some(item=>item.voiceURI===voice.voiceURI)?`<button type="button" class="workspace-icon" data-voice-test="${esc(voice.voiceURI)}" title="${esc(voice.name)} sesini dinle" aria-label="${esc(voice.name)} sesini dinle">${icon('volume-2')}</button>`:''}${window.MNGSpeechPreviews?.source(voice.voiceURI)?`<button type="button" class="workspace-icon" data-voice-sample-download="${esc(voice.voiceURI)}" title="${esc(voice.name)} ses örneğini indir" aria-label="${esc(voice.name)} ses örneğini indir">${icon('file-down')}</button>`:''}`;
        const row=(voice,available,pack)=>`<article class="speech-voice-row ${selected===voice.voiceURI?'chosen':''}" data-voice-uri="${esc(voice.voiceURI)}"><button type="button" class="speech-voice-choice" data-voice-select="${esc(voice.voiceURI)}" ${available?'':'disabled'} aria-pressed="${selected===voice.voiceURI}"><span class="voice-monogram" aria-hidden="true">${esc(voice.name.slice(0,1))}</span><span><strong>${esc(voice.name)}</strong><small>${voice.gender==='female'?'Kadın':voice.gender==='male'?'Erkek':'Türkçe'} · ${available?'Hazır':pack?.installing?'İndiriliyor':pack?.size?mb(pack.size):'Paket gerekli'}</small></span>${selected===voice.voiceURI?icon('check'):''}</button>${previewTools(voice)}${!available&&pack?`<button type="button" class="workspace-button" data-voice-install="${esc(pack.id)}" ${checking||pack.installing?'disabled':''} title="${esc(pack.name)} paketini indir ve seç" aria-label="${esc(pack.name)} paketini indir ve seç">${icon('download')} İndir</button>`:''}</article>`;
        const naturalRow=voice=>{
            const available=ready.some(item=>item.voiceURI===voice.voiceURI);
            const spec=state.speechCatalog?.downloadPack?.voices?.find(item=>item.id===voice.id);
            const progress=state.voiceProgress.get(voice.voiceURI);
            const installing=progress&&!['complete','cancelled','error'].includes(progress.phase);
            const bytes=(engineReady?0:commonBytes)+(spec?.downloadBytes||0);
            return `<article class="speech-voice-row natural-voice-row ${selected===voice.voiceURI?'chosen':''}" data-voice-uri="${esc(voice.voiceURI)}"><button type="button" class="speech-voice-choice" data-voice-select="${esc(voice.voiceURI)}" ${available?'':'disabled'} aria-pressed="${selected===voice.voiceURI}"><span class="voice-monogram" aria-hidden="true">${esc(voice.name.slice(0,1))}</span><span><strong>${esc(voice.name)}</strong><small>${voice.gender==='female'?'Kadın':'Erkek'} · ${available?'Hazır':installing?'İndiriliyor':!engineReady&&commonBytes?(bytes/1073741824).toFixed(2)+' GB · motor dahil':spec?Math.ceil(spec.downloadBytes/1024)+' KB · motor kurulu':'İndirilmedi'}</small></span>${selected===voice.voiceURI?icon('check'):''}</button>${previewTools(voice)}<button type="button" class="${available?'workspace-icon':'workspace-button'}" data-natural-voice="${esc(voice.id)}" ${checking||naturalInstalling||state.speechCatalog?.downloadPack?.downloadReady===false?'disabled':''} title="${esc(voice.name)} ${available?'ses dosyasını doğrula':'sesini indir'}" aria-label="${esc(voice.name)} ${available?'ses dosyasını doğrula':'sesini indir'}">${icon(available?'refresh-cw':'download')}${available?'':installing?'İndiriliyor':engineReady?'İndir':'Motoru kur'}</button><div id="voiceProgress-${esc(voice.voiceURI)}" class="voice-download-status" role="status"></div></article>`;
        };
        root.innerHTML=`<section class="speech-voice-group"><div class="band-heading"><h3>Hızlı Türkçe</h3><span class="voice-recommended">Küçük paket</span></div>${packs.map(pack=>row({...pack,provider:'offline'},ready.some(voice=>voice.voiceURI===pack.voiceURI),pack)+`<div class="voice-download-status" id="voiceProgress-${esc(pack.id)}" role="status"></div>`).join('')}</section><section class="speech-voice-group"><div class="band-heading"><h3>Gelişmiş Doğal Türkçe</h3><span>${ready.filter(voice=>voice.provider==='chatterbox').length} / 10 hazır</span></div><p class="voice-common">Ortak ses motoru · ${checking?'Kontrol ediliyor':engineReady?'Hazır':(commonBytes/1073741824).toFixed(2)+' GB'}</p><p class="voice-latency">İlk kurulum büyük · CPU üzerinde daha yavaş</p>${natural.map(naturalRow).join('')}<div class="detail-commands">${naturalInstalling?`<button type="button" class="workspace-button" data-action="speech-natural-cancel">${icon('square')} İndirmeyi durdur</button>`:''}<button type="button" class="workspace-button" data-action="speech-local-select">${icon('folder-open')} Paket klasörünü seç</button></div></section>${ready.some(voice=>voice.provider==='windows')?`<section class="speech-voice-group"><h3>Bilgisayardaki Sesler</h3>${ready.filter(voice=>voice.provider==='windows').map(voice=>row(voice,true)).join('')}</section>`:''}`;
        const naturalGroup=root.querySelector('.speech-voice-group:nth-child(2)');
        for(const progress of state.voiceProgress.values())if(progress.id.startsWith('chatterbox:'))updateVoiceProgress(progress);
        root.querySelectorAll('.speech-voice-row').forEach(node=>{const pack=packs.find(pack=>pack.voiceURI===node.dataset.voiceUri&&pack.installed);if(pack)node.insertAdjacentHTML('beforeend',`<button type="button" class="workspace-icon" data-voice-install="${esc(pack.id)}" title="${esc(pack.name)} paketini onar" aria-label="${esc(pack.name)} paketini onar">${icon('refresh-cw')}</button>`);});
        if(checking)root.querySelectorAll('.speech-voice-choice small').forEach(node=>{node.textContent='Kontrol ediliyor';});
        if(state.speechCatalog&&!natural.length)naturalGroup.insertAdjacentHTML('beforeend','<p class="muted">Ses listesi yenileniyor.</p>');
    }
    function updateVoiceProgress(progress){
        state.voiceProgress.set(progress.id,progress);const node=$('voiceProgress-'+progress.id);if(!node)return;
        const percent=progress.totalBytes?Math.min(100,Math.round((progress.completedBytes||0)/progress.totalBytes*100)):0;
        const phase={complete:'Ses hazır',preparing:'Ses paketi hazırlanıyor',extracting:'Ses motoru kuruluyor',verifying:'Ses dosyaları doğrulanıyor','checking-space':'Disk alanı kontrol ediliyor',cancelled:'İndirme durduruldu',error:'İndirme tamamlanamadı'}[progress.phase];
        node.textContent=phase||`İndiriliyor · %${percent}${progress.totalBytes?' · '+mb(progress.completedBytes)+' / '+mb(progress.totalBytes):''}`;
    }
    function selectSpeechVoice(uri){
        const voice=state.voices.find(voice=>voice.voiceURI===uri);if(!voice)return false;
        stopSpeech();const form=$('speechForm');form.elements.provider.value=voice.provider;
        state.speechDraft={...formDraft(form),voiceURI:voice.voiceURI,voicePreset:'natural'};
        updateSpeechVoiceOptions();renderSpeechLibrary();window.lucide?.createIcons();return true;
    }
    function formDraft(form){return Object.fromEntries([...form.elements].filter(field=>field.name).map(field=>[field.name,field.type==='checkbox'?field.checked:field.value]));}
    function trackDraft(form,key){const remember=()=>{state[key]=formDraft(form);};form.addEventListener('input',remember);form.addEventListener('change',remember);}
    function speechValues(){const f=$('speechForm').elements;return {enabled:f.enabled.checked,names:false,voiceURI:f.voiceURI.value,voicePreset:f.voicePreset.value,provider:f.provider.value,allowOfflineFallback:f.allowOfflineFallback.checked,audience:f.audience.value,allowedUsers:f.allowedUsers.value,giftId:f.giftId.value,volume:Number(f.volume.value),rate:Number(f.rate.value),pitch:1,maxLength:Number(f.maxLength.value),cooldownSeconds:Number(f.cooldownSeconds.value),blockedWords:f.blockedWords.value};}
    function speechAvailable(){return Boolean(speechEngine&&state.voices.length);}
    function updateSpeechStatus(){const status=$('speechStatus');if(status)status.textContent=state.speaking?'Konuşuyor…':state.queue.length+' yorum sırada';}
    function updateSpeechVoiceOptions(reset=false){
        const form=$('speechForm');if(!form)return;const f=form.elements,selected=reset?f.voiceURI.value:state.speechDraft?.voiceURI??state.data.tts.voiceURI,provider=f.provider.value;
        const voices=state.voices.filter(voice=>!provider||voice.provider===provider);
        f.voiceURI.innerHTML=(voices.length?'':'<option value="">Kullanılabilir ses yok</option>')+voices.map(voice=>`<option value="${esc(voice.voiceURI)}">${esc(voice.name)} · ${voice.provider==='offline'?'Çevrimdışı':voice.neural?'Doğal':'Windows standart'} · ${voice.gender==='female'?'Kadın':voice.gender==='male'?'Erkek':'Yapay ses'}</option>`).join('')+(!reset&&selected&&!voices.some(voice=>voice.voiceURI===selected)?`<option value="${esc(selected)}" disabled>Kayıtlı ses kullanılamıyor</option>`:'');
        f.voiceURI.value=voices.some(v=>v.voiceURI===selected)||(!reset&&selected)?selected:(voices[0]?.voiceURI||'');const chosen=voices.find(voice=>voice.voiceURI===f.voiceURI.value),available=Boolean(chosen);
        form.querySelector('[data-action="speech-test"]').disabled=!available&&!window.MNGSpeechPreviews?.source(f.voiceURI.value);
        form.querySelector('[data-action="speech-read"]').disabled=!available;
        const label=$('speechAvailability');label.classList.toggle('unavailable',!available);label.textContent=!state.speechCatalog?'Sesler kontrol ediliyor…':available?`${chosen.name} · ${['azure','tikmng'].includes(chosen.provider)?'Çevrim içi':chosen.provider==='chatterbox'?'Doğal Türkçe · Cihazda üretim':chosen.provider==='offline'?'Çevrimdışı':'Windows'}`:provider==='chatterbox'?'Doğrulanmış doğal Türkçe ses paketini seçin.':provider==='azure'?'Azure Speech anahtarı doğrulanmalı.':provider==='tikmng'?'TikMnG merkezi ses hizmeti henüz hazır değil.':'Bu motorda kullanılabilir Türkçe konuşmacı yok.';
        updateSpeechStatus();
        renderSpeechLibrary();
    }
    async function updateVoices(refresh=false){try{state.speechCatalog=await speechEngine?.listVoices({refresh});state.voices=state.speechCatalog?.voices||[];}catch{state.voices=[];}if(state.view==='speech'&&state.data)render();else updateSpeechVoiceOptions();}
    function stopSpeech(){
        state.speechGeneration++;state.queue=[];state.activeSpeech=null;state.speaking=false;speechEngine?.stop();updateSpeechStatus();
    }
    async function previewSpeechVoice(uri){
        const source=window.MNGSpeechPreviews?.source(uri);
        if(!source){if(!selectSpeechVoice(uri))return;state.queue.push({text:speechTestText,settings:{...speechValues(),rate:1}});speakNext();return;}
        stopSpeech();const generation=state.speechGeneration;state.speaking=true;updateSpeechStatus();
        try{await speechEngine.preview(source,{volume:speechValues().volume});}
        catch(error){if(generation===state.speechGeneration&&error.code!=='SPEECH_CANCELLED')notify(error.message||'Ses ön izlemesi açılamadı.',true);}
        finally{if(generation===state.speechGeneration){state.speaking=false;updateSpeechStatus();queueMicrotask(speakNext);}}
    }
    async function speakNext(){
        if(state.speaking||!state.queue.length)return;if(!speechAvailable()){stopSpeech();return;}
        const {text,settings}=state.queue.shift(),generation=state.speechGeneration;state.speaking=true;updateSpeechStatus();
        try{const result=await speechEngine.speak(text,settings);if(generation!==state.speechGeneration)return;if(result.fallbackUsed)notify('Doğal ses bağlantısı kesildi; '+result.voice.name+' kullanıldı.');}
        catch(error){if(generation!==state.speechGeneration)return;if(error.code!=='SPEECH_CANCELLED'){notify(error.message||'Ses oynatılamadı.',true);state.queue=[];}}
        finally{if(generation===state.speechGeneration){state.speaking=false;updateSpeechStatus();queueMicrotask(speakNext);}}
    }
    function chat(payload){const t=state.data?.tts;if(!t?.enabled||!speechAvailable())return;const name=String(payload.username||payload.uniqueId||'izleyici');let message=String(payload.message||payload.comment||'').replace(/https?:\/\/\S+/gi,'').trim();if(!message||message.startsWith('!'))return;const blocked=String(t.blockedWords||'').split(',').map(x=>x.trim().toLocaleLowerCase('tr')).filter(Boolean);if(blocked.some(word=>message.toLocaleLowerCase('tr').includes(word)))return;const last=state.lastUsers.get(name)||0;if(Date.now()-last<t.cooldownSeconds*1000)return;state.lastUsers.set(name,Date.now());if(state.lastUsers.size>1000)state.lastUsers.delete(state.lastUsers.keys().next().value);if(state.queue.length>=20)return;state.queue.push({text:message.slice(0,t.maxLength),settings:{...t,names:false}});speakNext();updateSpeechStatus();}
    function renderWidgets(body){
        const info=state.widgetInfo;
        body.innerHTML=`<div class="band-heading"><h2>Yayın Widget’ları</h2><button class="workspace-button" data-action="widget-connect">${icon('radio')} Yayın bağlantısı</button></div><div class="library-grid widget-library">${(info?.widgets||[]).map(item=>`<article class="workspace-widget"><iframe loading="lazy" title="${esc(item.name)} ön izlemesi" src="${esc(widgetUrl(item,true))}" sandbox="allow-scripts allow-same-origin"></iframe><div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="detail-commands"><button class="workspace-button" data-widget="${esc(item.id)}">${icon('sliders-horizontal')} Ayarlar</button><button class="workspace-icon" data-copy-widget="${esc(item.id)}" title="Yayın bağlantısını kopyala" aria-label="Yayın bağlantısını kopyala">${icon('copy')}</button></div></div></article>`).join('')||'<p class="muted">Widget’lar yükleniyor.</p>'}</div>`;
        body.querySelectorAll('[data-copy-widget]').forEach(button=>{const item=info?.widgets.find(item=>item.id===button.dataset.copyWidget);button.disabled=!item||!widgetUrl(item);});
        if(info?.overlayTransport)body.querySelector('.band-heading').insertAdjacentHTML('afterend',`<div class="broadcast-service-status" role="status"><span>${esc(info.overlayTransport.message)}</span><button class="workspace-button" data-action="overlay-reconnect">${icon('refresh-cw')} Bağlantıyı hazırla</button></div>`);
    }
    function widgetUrl(item,preview=false){
        // app.js helpers share this channel context with the existing settings panel.
        if(typeof widgetGalleryInfo!=='undefined')widgetGalleryInfo=state.widgetInfo;
        const raw=preview?item.previewUrl:(item.broadcastUrl??item.url);if(!raw)return '';
        if(preview&&typeof window.widgetOnIzlemeUrl==='function')return window.widgetOnIzlemeUrl(raw,item.id);
        return window.widgetOzellestirilmisUrl?.(raw,item.id)||raw;
    }
    function renderDownloads(body){
        const installed=state.data.games.filter(game=>game.installed);
        body.innerHTML=`<div class="band-heading"><div><h2>İndirmeler ve Kurulu Oyunlar</h2><span>${state.progress.size} işlem · ${installed.length} kurulu oyun</span></div></div>${[...state.progress].map(([id])=>`<section class="download-row"><h3>${esc(state.data.games.find(g=>g.id===id)?.ad||'Medya')}</h3>${progressMarkup(id)}<button class="workspace-button" data-cancel="${esc(id)}">${icon('pause')} Durdur</button></section>`).join('')||'<p class="download-idle">Şu anda indirme yapılmıyor.</p>'}<section class="detail-band"><h2>Kurulu Oyunlar</h2><div class="installed-list">${installed.map(game=>`<article><img src="assets/game-covers/${covers[game.id]}.png" alt=""><div><strong>${esc(game.ad)}</strong><small>${esc(game.installedVersion||'Kurulu')}${game.updateAvailable?' · Güncelleme var':''}</small></div><button class="workspace-button" data-open="${esc(game.id)}">${icon('arrow-up-right')} Gir</button></article>`).join('')||'<p class="workspace-empty">Henüz oyun kurulmadı.</p>'}</div></section>`;
        const media=state.data.mediaDownloads;
        if(media)body.insertAdjacentHTML('afterbegin',`<section class="detail-band"><div class="band-heading"><div><h2>Video ve Ses Kütüphanesi</h2><span>${media.completed} / ${media.total} hazır${media.failed?' · '+media.failed+' dosya yeniden denenecek':''}</span></div><button class="workspace-button" data-media-background="${!media.enabled}">${icon(media.enabled?'pause':'download-cloud')} ${media.enabled?'Duraklat':'Devam et / yeniden dene'}</button></div>${media.current?`<p class="muted">${esc(media.current)} · ${Math.round(media.progress?.percent||0)}%</p>`:`<p class="muted">${media.total&&media.completed===media.total?'Kütüphane hazır.':media.enabled?'Medya arka planda hazırlanıyor.':'Arka plan indirmesi duraklatıldı.'}</p>`}</section>`);
    }
    function renderSettings(body){
        const draft=state.sourceDraft||{source:state.data.source,endpoint:state.data.tikfinityUrl};
        body.innerHTML=`<section class="connection-settings"><div class="band-heading"><h2>Yayın Hesabı</h2><button class="workspace-button primary" data-action="widget-connect">${icon('radio')} Hesabı yönet</button></div><p id="settingsConnectionStatus" role="status">${esc(state.widgetInfo?.liveStatus?.message||'Yayın bağlantısı kapalı.')}</p></section><details class="connection-advanced"><summary>Gelişmiş bağlantı</summary><form id="sourceForm" class="settings-form"><label>Yayın bağlantısı<select name="source"><option value="direct">TikMnG bağlantısı</option><option value="tikfinity">TikFinity genel bağlantı</option></select></label><label>Yerel köprü adresi<input name="endpoint" value="${esc(draft.endpoint)}" placeholder="ws://127.0.0.1:21213/"></label><button class="workspace-button" type="submit">${icon('check')} Kaydet</button></form></details><section class="detail-band"><h2>Depolama</h2><div class="storage-row"><div><strong>Oyun klasörü</strong><p>${esc(state.data.libraryRoot)}</p></div><button class="workspace-button" data-folder="games">${icon('folder')} Değiştir</button></div><div class="storage-row"><div><strong>Medya klasörü</strong><p>${esc(state.data.mediaRoot)}</p></div><button class="workspace-button" data-folder="media">${icon('folder')} Değiştir</button></div></section><section class="detail-band"><h2>İçerik ve Uygulama</h2><p class="muted">İçerik kataloğu: ${esc(state.data.catalogRevision||'Yerel katalog')}${state.data.catalogError?' · '+esc(state.data.catalogError):''}</p><div class="detail-commands"><button class="workspace-button" data-action="refresh">${icon('refresh-cw')} İçerikleri yenile</button><button class="workspace-button" data-action="update">${icon('download-cloud')} Uygulama güncellemesini kontrol et</button><button class="workspace-button" data-action="license">${icon('key-round')} Lisans</button></div></section>`;
        const form=$('sourceForm');form.elements.source.value=draft.source;trackDraft(form,'sourceDraft');
        body.querySelector('.connection-settings').insertAdjacentHTML('afterend',`<section class="broadcast-service-status"><div><h2>HTTPS Yayın Servisi</h2><p id="httpsServiceStatus" role="status">${esc(state.data.overlayTransport?.message||'Bağlantı kontrol ediliyor.')}</p></div><button class="workspace-button" data-action="overlay-reconnect">${icon('refresh-cw')} Yeniden dene</button></section>`);
        form.addEventListener('submit',event=>{event.preventDefault();act(async()=>{const submitted=formDraft(form);state.data=await call('source',submitted);if(JSON.stringify(state.sourceDraft)===JSON.stringify(submitted))state.sourceDraft=null;notify('Bağlantı kaynağı kaydedildi. Yayın hesabından Bağlan’a basabilirsin.');render();});});
    }
    function mediaPreviewUrl(item,mode='preview'){const url=new URL(item.overlayUrl);url.searchParams.set(mode,'1');if(mode==='poster')url.searchParams.set('mute','1');return url.href;}
    const stamp = seconds => {const n=Math.max(0,Number(seconds)||0);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;};
    function previewTrim(play=false){
        const frame=$('mediaEditor')?.querySelector('iframe'),f=$('mediaEditorForm')?.elements;if(!frame||!f)return;
        frame.contentWindow.postMessage({type:'tikmng-preview-trim',id:state.media.id,startSeconds:Number(f.startSeconds.value)||0,endSeconds:Number(f.endSeconds.value)||null,volume:Number(f.volume.value),play},new URL(frame.src).origin);
    }
    function updateTrim(changed){
        const f=$('mediaEditorForm')?.elements;if(!f)return;
        const duration=state.mediaDuration||Math.max(60,Number(f.endSeconds.value)||0),a=$('trimStart'),b=$('trimEnd');
        if(changed==='start')f.startSeconds.value=a.value;if(changed==='end')f.endSeconds.value=b.value;
        let start=Math.max(0,Math.min(duration-0.1,Number(f.startSeconds.value)||0));let end=Math.min(duration,Number(f.endSeconds.value)||duration);
        if(end<=start){if(changed==='end')start=Math.max(0,end-0.1);else end=Math.min(duration,start+0.1);}
        f.startSeconds.value=start.toFixed(1);if(Number(f.endSeconds.value))f.endSeconds.value=end.toFixed(1);
        a.max=b.max=duration;a.value=start;b.value=end;
        $('trimTrack').style.setProperty('--start',100*start/duration+'%');$('trimTrack').style.setProperty('--end',100*end/duration+'%');
        $('trimSelection').textContent=`${stamp(start)} – ${stamp(end)}`;$('trimDuration').textContent=state.mediaDuration?stamp(state.mediaDuration):'Süre bekleniyor';
        previewTrim();
    }
    function bindMediaHovers(root){
        root.querySelectorAll('iframe').forEach(frame=>frame.addEventListener('load',()=>frame.classList.add('preview-ready')));
        let activeStop=null;
        root.querySelectorAll('[data-hover-media]').forEach(tile=>{
            const frame=tile.querySelector('iframe'),records=tile.dataset.libraryMedia?libraryAssets():[...state.data.media,...libraryAssets()],item=records.find(record=>record.id===tile.dataset.hoverMedia);if(!frame||!item||item.kind!=='video')return;
            let mode='poster',stopTimer;
            const reset=()=>{clearTimeout(stopTimer);if(mode==='poster')return;mode='poster';frame.classList.remove('preview-ready');frame.src=mediaPreviewUrl(item,'poster');};
            const start=()=>{clearTimeout(stopTimer);if(mode==='hover')return;activeStop?.();activeStop=reset;mode='hover';frame.classList.remove('preview-ready');frame.src=mediaPreviewUrl(item,'hover');};
            const stop=()=>{clearTimeout(stopTimer);stopTimer=setTimeout(()=>{if(tile.matches(':hover')||tile.matches(':focus-within'))return;mode='poster';frame.classList.remove('preview-ready');frame.src=mediaPreviewUrl(item,'poster');},80);};
            tile.addEventListener('pointerenter',start);tile.addEventListener('mouseenter',start);tile.addEventListener('pointerover',start);
            tile.addEventListener('pointerleave',stop);tile.addEventListener('mouseleave',stop);
            tile.addEventListener('focusin',start);tile.addEventListener('focusout',stop);
        });
    }
    async function openMediaLibrary(initialKind=''){
        const dialog=$('mediaAssetPicker');
        const ownAssets=(state.data.media||[]).filter(item=>!item.gameId);
        const assets=[...ownAssets,...libraryAssets().filter(item=>!ownAssets.some(own=>own.id===item.id))],categories=[...new Set(assets.map(item=>item.category||'Genel'))].sort((a,b)=>a.localeCompare(b,'tr'));
        let selected='',page=0,kind=initialKind;
        dialog.innerHTML=`<header><div><small class="muted">${esc(state.data.games.find(g=>g.id===state.game)?.ad||'Yayın medyası')}</small><h2>Medya Kütüphanesi</h2></div><button class="workspace-icon" data-action="close-assets" title="Kapat" aria-label="Kapat">${icon('x')}</button></header><div class="asset-toolbar"><label class="workspace-search">${icon('search')}<input id="assetSearch" type="search" placeholder="Video, ses veya görsel ara" aria-label="Kütüphanede medya ara"></label><span id="assetCount" role="status"></span><button class="workspace-button" data-action="asset-import">${icon('import')} Dosyadan ekle</button><button class="workspace-button" data-action="asset-url">${icon('link')} URL ekle</button></div><div id="assetCategories" class="library-tabs media-category-tabs" role="tablist" aria-label="Kütüphane kategorileri">${['',...categories].map(c=>`<button data-asset-category="${esc(c)}" role="tab" aria-selected="${!c}">${esc(c||'Tümü')}</button>`).join('')}</div><div id="assetChoices" class="asset-choice-list"></div><div id="assetPages" class="media-pagination"></div>`;
        dialog.querySelector('.asset-toolbar').insertAdjacentHTML('afterend',`<div class="media-kind-tabs asset-kind-tabs" role="group" aria-label="Kütüphane medya türü">${[['','Tümü'],['video','Videolar'],['audio','Sesler'],['image','GIF / Görseller']].map(([id,label])=>`<button class="workspace-button" data-asset-kind="${id}" aria-pressed="${kind===id}">${label}</button>`).join('')}</div>`);
        const draw=()=>{
            stopSoundPreview();
            dialog.dataset.kind=kind;
            const q=$('assetSearch').value.toLocaleLowerCase('tr'),list=assets.filter(item=>(!kind||item.kind===kind)&&(!selected||(item.category||'Genel')===selected)&&[item.title,item.category].join(' ').toLocaleLowerCase('tr').includes(q)),pages=Math.max(1,Math.ceil(list.length/24));page=Math.min(page,pages-1);
            $('assetCount').textContent=`${list.length} medya`;
            $('assetChoices').innerHTML=list.slice(page*24,page*24+24).map(item=>`<button class="asset-choice" data-asset="${esc(item.id)}" data-hover-media="${esc(item.id)}"><span class="asset-poster">${item.kind==='audio'?icon('audio-lines'):`<iframe loading="lazy" tabindex="-1" title="${esc(item.title)} ön izlemesi" src="${esc(mediaPreviewUrl(item,'poster'))}" allow="autoplay"></iframe>`}<span class="asset-play">${icon('play')}</span></span><span class="asset-title"><strong>${esc(item.title)}</strong><small>${esc(item.category||'Genel')} · ${item.kind==='audio'?'Ses':item.kind==='image'?'GIF / Görsel':'Video'}</small></span><span class="asset-add">${icon('plus')}</span></button>`).join('')||'<p class="workspace-empty">Medya bulunamadı.</p>';
            $('assetPages').innerHTML=pages>1?`<button class="workspace-icon" data-asset-page="${page-1}" ${page===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${page+1} / ${pages}</span><button class="workspace-icon" data-asset-page="${page+1}" ${page===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
            $('assetChoices').classList.toggle('sound-choices',kind==='audio');
            $('assetChoices').querySelectorAll('[data-asset]').forEach(button=>{const item=assets.find(item=>item.id===button.dataset.asset);if(item.kind!=='audio')return;const row=document.createElement('article');row.className='asset-sound-row';row.innerHTML=`<button class="workspace-icon" data-sound-preview="${esc(item.id)}" aria-pressed="false" title="Sesi dinle / durdur" aria-label="${esc(item.title)} sesini dinle">${icon('play')}</button><div><strong>${esc(item.title)}</strong><small>${esc(item.category||'Genel')} · Ses</small></div><button class="workspace-button" ${item.libraryAsset?'data-library-asset':'data-asset'}="${esc(item.id)}">${icon('plus')} Seç</button>`;button.replaceWith(row);});
            $('assetChoices').querySelectorAll('[data-asset]').forEach(button=>{if(assets.find(item=>item.id===button.dataset.asset)?.libraryAsset){button.dataset.libraryAsset=button.dataset.asset;delete button.dataset.asset;}});
            bindMediaHovers($('assetChoices'));window.lucide?.createIcons();
        };
        dialog.onclick=event=>{const category=event.target.closest('[data-asset-category]'),pager=event.target.closest('[data-asset-page]');if(category){selected=category.dataset.assetCategory;page=0;dialog.querySelectorAll('[data-asset-category]').forEach(b=>b.setAttribute('aria-selected',b===category));draw();}if(pager){page=Number(pager.dataset.assetPage);draw();}};
        $('assetSearch').addEventListener('input',()=>{page=0;draw();});draw();dialog.showModal();$('assetSearch').focus();
        dialog.querySelectorAll('[data-asset-kind]').forEach(button=>button.addEventListener('click',()=>{kind=button.dataset.assetKind;page=0;dialog.querySelectorAll('[data-asset-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();}));
        dialog.addEventListener('close',stopSoundPreview,{once:true});
        if(initialKind==='audio')dialog.querySelector('#assetPages').insertAdjacentHTML('beforebegin',soundStarters());
    }
    function giftMarkup(id){const gift=state.gifts.find(g=>String(g.id)===String(id));return gift?`<img src="${esc(gift.image)}" alt=""><span>${esc(gift.name)} · ${esc(gift.coins)} coin</span>`:`<span>${id?'Hediye #'+esc(id):'Hediye seçilmedi'}</span>`;}
    function openGiftPicker(target='media'){
        const dialog=$('giftPicker');dialog.dataset.target=target;const selected=$(target==='speech'?'speechForm':'mediaEditorForm').elements.giftId.value;let page=0;
        dialog.innerHTML=`<header><h2>Hediye Kataloğu</h2><button class="workspace-icon" data-action="close-gifts" title="Kapat" aria-label="Hediye kataloğunu kapat">${icon('x')}</button></header><label class="workspace-search">${icon('search')}<input id="giftSearch" type="search" placeholder="Hediye adı, ID veya coin" aria-label="Hediye ara"></label><div class="gift-choice-list" id="giftChoices"></div><p id="giftPickerStatus" role="status"></p>`;
        const draw=()=>{const query=$('giftSearch').value.trim().toLocaleLowerCase('tr');const gifts=state.gifts.filter(g=>[g.name,g.id,g.coins].join(' ').toLocaleLowerCase('tr').includes(query)).sort((a,b)=>Number(a.coins||0)-Number(b.coins||0)||String(a.name).localeCompare(String(b.name),'tr'));const pages=Math.max(1,Math.ceil(gifts.length/60));page=Math.min(page,pages-1);$('giftChoices').innerHTML=(target==='media'?`<button class="gift-choice" data-gift-choice="" aria-pressed="${!selected}">${icon('ban')}Hediye yok</button>`:'')+gifts.slice(page*60,page*60+60).map(g=>`<button class="gift-choice" data-coins="${Number(g.coins||0)}" data-gift-choice="${esc(g.id)}" aria-pressed="${String(g.id)===selected}"><img loading="lazy" src="${esc(g.image)}" alt="${esc(g.name)}"><span>${esc(g.name)}</span><small>${esc(g.coins)} coin · #${esc(g.id)}</small></button>`).join('');$('giftPickerStatus').innerHTML=`${gifts.length} hediye · ${page+1} / ${pages} <button class="workspace-icon" data-gift-page="${page-1}" ${page===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><button class="workspace-icon" data-gift-page="${page+1}" ${page===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`;window.lucide?.createIcons();};
        dialog.onclick=event=>{const button=event.target.closest('[data-gift-page]');if(button){page=Number(button.dataset.giftPage);draw();$('giftChoices').scrollTop=0;}};
        $('giftSearch').addEventListener('input',()=>{page=0;draw();});draw();dialog.showModal();$('giftSearch').focus();
    }
    async function editMedia(id){
        if(!state.gifts.length)state.gifts=await api.orbitHediyeKatalogu();
        const item=state.data.media.find(item=>item.id===id)||{title:'',category:'Genel',giftId:'',startSeconds:0,endSeconds:0,volume:0.8,cooldownSeconds:0,enabled:true,gameId:state.game||'',kind:'video'};
        state.media=item;state.mediaDuration=0;
        if(!id&&!state.game)item.kind=state.view==='sounds'?'audio':state.mediaKind==='image'?'image':'video';
        const dialog=$('mediaEditor');
        dialog.innerHTML=`<form id="mediaEditorForm"><header><div><small class="muted">${esc(item.gameId?state.data.games.find(g=>g.id===item.gameId)?.ad||'Oyuna özel':'Genel yayın')}</small><h2>Medya Eylemi</h2></div><button type="button" class="workspace-icon" data-action="close-media" title="Kapat" aria-label="Kapat">${icon('x')}</button></header><div class="media-editor-layout"><div class="media-preview-panel">${id?`<iframe class="media-editor-preview" src="${esc(mediaPreviewUrl(item))}" title="Video ön izlemesi" allow="autoplay"></iframe>`:`<label>Medya türü<select name="kind"><option value="video">Video</option><option value="audio">Ses</option><option value="image">GIF / Görsel</option></select></label><label>HTTPS medya bağlantısı<input name="url" type="url" required placeholder="https://.../video.mp4"></label>`}<div class="clip-timeline" ${item.kind==='image'?'hidden':''}><div class="trim-caption"><span id="trimSelection">00:00 – 00:00</span><span id="trimDuration">Süre bekleniyor</span></div><div class="trim-track" id="trimTrack"><input id="trimStart" type="range" aria-label="Klip başlangıcı" min="0" max="60" step="0.1" value="${item.startSeconds||0}"><input id="trimEnd" type="range" aria-label="Klip bitişi" min="0" max="60" step="0.1" value="${item.endSeconds||60}"></div><div class="settings-columns"><label>Başlangıç (sn)<input name="startSeconds" type="number" min="0" max="86400" step="0.1" value="${item.startSeconds||0}"></label><label>Bitiş (sn, 0: tamamı)<input name="endSeconds" type="number" min="0" max="86400" step="0.1" value="${item.endSeconds||0}"></label></div>${id?`<button type="button" class="workspace-button clip-preview-command" data-action="preview-clip">${icon('play')} Seçili kısmı oynat</button>`:''}</div>${id?`<div class="media-private-link"><label>Eylem bağlantısı<input readonly value="${esc(broadcastURL(item))}"></label><button type="button" class="workspace-icon" title="Eylem bağlantısını kopyala" aria-label="Eylem bağlantısını kopyala" data-copy="${esc(broadcastURL(item))}">${icon('copy')}</button></div>`:''}</div><div class="media-editor-fields"><div class="settings-columns"><label>Eylem adı<input name="title" required maxlength="160" value="${esc(item.title)}"></label><label>Kategori<input name="category" maxlength="80" value="${esc(item.category)}" list="mediaCategories"><datalist id="mediaCategories">${['Racon','Oryantal','Takım Videoları','Harita Oyunları','Genel'].map(c=>`<option value="${c}">`).join('')}</datalist></label></div><input type="hidden" name="giftId" value="${esc(item.giftId)}"><label>Hediye tetikleyicisi</label><button type="button" class="gift-selector" id="chosenGift" data-action="choose-gift">${giftMarkup(item.giftId)}${icon('chevron-down')}</button><label>Medya sesi <output id="mediaVolumeLabel">${Math.round((item.volume??0.8)*100)}%</output><input name="volume" type="range" min="0" max="1" step="0.01" value="${item.volume??0.8}"></label><div class="settings-columns"><label>Bekleme (sn)<input name="cooldownSeconds" type="number" min="0" max="3600" value="${item.cooldownSeconds||0}"></label><label>Oynatma limiti (0: sınırsız)<input name="playLimit" type="number" min="0" max="10000" value="${item.playLimit||0}"></label><label>Görsel süresi (sn)<input name="displaySeconds" type="number" min="0.1" max="3600" step="0.1" value="${item.displaySeconds||5}"></label></div><div class="media-toggles"><label class="toggle-label"><input type="checkbox" name="enabled" ${item.enabled?'checked':''}> Yayında etkin</label><label class="toggle-label"><input type="checkbox" name="interrupt" ${item.interrupt?'checked':''}> Sonraki eyleme geç</label><label class="toggle-label"><input type="checkbox" name="fade" ${item.fade?'checked':''}> Yumuşak giriş / çıkış</label><label class="toggle-label"><input type="checkbox" name="combineGifts" ${item.combineGifts?'checked':''}> Hediye kombinasyonları</label></div></div></div><footer><button type="button" class="workspace-button" data-action="close-media">Vazgeç</button>${id?`<button type="button" class="workspace-button" data-action="editor-test">${icon('play')} Kaydet ve Test Et</button>`:''}<button type="submit" class="workspace-button primary">${icon('check')} Kaydet</button></footer><p id="mediaEditorError" role="alert"></p></form>`;
        if(!dialog.open)dialog.showModal();window.lucide?.createIcons();const form=$('mediaEditorForm');if(form.elements.kind){for(const option of [...form.elements.kind.options])if(!mediaInView({kind:option.value}))option.remove();form.elements.kind.value=item.kind;}form.elements.volume.addEventListener('input',()=>{$('mediaVolumeLabel').textContent=Math.round(form.elements.volume.value*100)+'%';});
        const publicLink=dialog.querySelector('.media-private-link');if(publicLink){publicLink.querySelector('label').firstChild.textContent='HTTPS eylem bağlantısı';publicLink.querySelector('input').placeholder='HTTPS yayın bağlantısı henüz hazır değil';publicLink.querySelector('[data-copy]').disabled=!broadcastURL(item);}
        form.elements.volume.addEventListener('change',()=>previewTrim());
        $('trimStart').addEventListener('input',()=>updateTrim('start'));$('trimEnd').addEventListener('input',()=>updateTrim('end'));
        form.elements.startSeconds.addEventListener('change',()=>updateTrim('number'));form.elements.endSeconds.addEventListener('change',()=>updateTrim('number'));updateTrim();
        form.addEventListener('submit',event=>{event.preventDefault();saveMediaEditor(false);});
    }
    async function saveMediaEditor(test){
        const form=$('mediaEditorForm');if(!form.reportValidity())return;
        const f=form.elements,buttons=[...form.querySelectorAll('footer button')];buttons.forEach(button=>button.disabled=true);
        try{
            const item=state.media;state.data=await call('media-save',{...item,title:f.title.value,category:f.category.value,trigger:'gift',giftId:f.giftId.value,startSeconds:Number(f.startSeconds.value),endSeconds:Number(f.endSeconds.value)||null,volume:Number(f.volume.value),cooldownSeconds:Number(f.cooldownSeconds.value),enabled:f.enabled.checked,playLimit:Number(f.playLimit.value),displaySeconds:Number(f.displaySeconds.value),interrupt:f.interrupt.checked,fade:f.fade.checked,combineGifts:f.combineGifts.checked,...(f.url?{url:f.url.value,kind:f.kind.value}:{})});
            if(test){state.media=state.data.media.find(record=>record.id===item.id);const result=await call('media-test',{id:item.id});notify(result.receivers>0?'Test bağlı yayın kaynağına gönderildi.':'Ön izleme testi gönderildi. OBS / TikTok yayın kaynağı henüz bağlı değil.');}
            else{$('mediaEditor').close();render();notify('Video eşleştirmesi kaydedildi.');}
        }catch(error){$('mediaEditorError').textContent=error.message;}finally{buttons.forEach(button=>button.disabled=false);}
    }
    async function act(fn){try{await fn();}catch(error){notify(error.message,true);}}
    async function importMedia(kind=state.game?'':state.view==='sounds'?'audio':state.mediaKind==='image'?'image':'video'){
        const before=new Set(state.data.media.map(item=>item.id));state.data=await call('media-import',{gameId:state.game||'',...(kind?{kind}:{})});
        const added=state.data.media.find(item=>!before.has(item.id));if(added){state.mediaSearch='';state.mediaCategory='';state.mediaKind='';state.mediaPage=0;state.videoPage=0;state.soundPage=0;}
        render();if(added)await editMedia(added.id);
    }
    async function click(event){const el=event.target.closest('button');if(!el)return;await act(async()=>{
        if(el.dataset.remotePreview){await previewRemoteSound(el.dataset.remotePreview,el);return;}
        if(el.hasAttribute('data-remote-page')){state.remotePage=Math.max(0,Number(el.dataset.remotePage)||0);renderMediaLists();return;}
        if(el.dataset.workspaceView){state.game=null;state.view=el.dataset.workspaceView;state.mediaSearch='';state.mediaCategory='';state.mediaKind='';state.mediaPage=0;state.soundPage=0;state.videoPage=0;if(state.view==='widgets')state.widgetInfo=await api.widgetBilgisi();render();scrollWorkspaceTop();return;}
        if(el.hasAttribute('data-video-page')){state.videoPage=Math.max(0,Number(el.dataset.videoPage)||0);renderMediaLists();return;}
        if(el.hasAttribute('data-sound-page')){state.soundPage=Math.max(0,Number(el.dataset.soundPage)||0);renderMediaLists();return;}
        if(el.dataset.libraryAsset){const before=new Set(state.data.media.map(item=>item.id));state.data=await call('media-library-add',{id:el.dataset.libraryAsset,gameId:state.game||''});if($('mediaAssetPicker').open)$('mediaAssetPicker').close();render();const added=state.data.media.find(item=>!before.has(item.id));if(added)await editMedia(added.id);return;}
        if(el.dataset.soundPreview){previewSound(el.dataset.soundPreview,el);return;}
        if(el.dataset.builtinPreview){await previewBuiltin(el.dataset.builtinPreview,el);return;}
        if(el.dataset.soundAdd){const before=new Set(state.data.media.map(item=>item.id));state.data=await call('media-sound-add',{id:el.dataset.soundAdd,gameId:state.game||''});if($('mediaAssetPicker').open)$('mediaAssetPicker').close();render();const added=state.data.media.find(item=>!before.has(item.id));if(added)await editMedia(added.id);return;}
        if(el.dataset.action==='sound-library'){await openMediaLibrary('audio');return;}
        if(el.hasAttribute('data-gift-choice')){const id=el.dataset.giftChoice,speech=$('giftPicker').dataset.target==='speech',form=$(speech?'speechForm':'mediaEditorForm');form.elements.giftId.value=id;form.elements.giftId.dispatchEvent(new Event('change',{bubbles:true}));$(speech?'speechGift':'chosenGift').innerHTML=giftMarkup(id)+icon('chevron-down');$('giftPicker').close();window.lucide?.createIcons();return;}
        if(el.dataset.action==='speech-gift'){openGiftPicker('speech');return;}
        if(el.hasAttribute('data-media-page')){state.mediaPage=Math.max(0,Number(el.dataset.mediaPage)||0);renderMediaLists();return;}
        if(el.hasAttribute('data-back')){state.game=null;render();scrollWorkspaceTop();return;}
        if(el.dataset.open){state.game=el.dataset.open;state.mediaSearch='';state.mediaCategory='';state.mediaKind='';state.mediaPage=0;render();scrollWorkspaceTop();return;}
        if(el.dataset.play){await window.oynaButonu(el.dataset.play);return;}
        if(el.dataset.install){const id=el.dataset.install;state.progress.set(id,{phase:'Hazırlanıyor',percent:null});render();try{const result=id==='gelene-gecene'?await api.oyunKur(id):await call('install',{id,repair:true});if(result?.basarili===false)throw new Error(result.hata);notify('Oyun kurulumu tamamlandı.');}finally{state.progress.delete(id);await refresh();}return;}
        if(el.dataset.cancel){await call('cancel',{id:el.dataset.cancel});return;}
        if(el.dataset.remove){if(confirm('Oyunun kurulu paketleri kaldırılsın mı? Kayıtlı ayar ve yedekleri koruyacağız.')){await call('remove',{id:el.dataset.remove});await refresh();}return;}
        if(el.dataset.giftGuide){el.disabled=true;try{const result=await call('gift-guide-save',{id:el.dataset.giftGuide});if(result.saved)notify('Hazır hediye görseli indirildi.');}finally{el.disabled=false;}return;}
        if(el.dataset.copyWidget){const item=state.widgetInfo?.widgets.find(item=>item.id===el.dataset.copyWidget);if(item){await navigator.clipboard.writeText(widgetUrl(item));notify('Bağlantı kopyalandı.');}return;}
        if(el.dataset.copy){await navigator.clipboard.writeText(el.dataset.copy);notify('Bağlantı kopyalandı.');return;}
        if(el.dataset.url){await api.hariciLinkAc(el.dataset.url);return;}
        if(el.dataset.folder){state.data=await call('folder',{kind:el.dataset.folder});if(!state.data.canceled)render();else await refresh();return;}
        if(el.dataset.editMedia){await editMedia(el.dataset.editMedia);return;}
        if(el.dataset.asset){const before=new Set(state.data.media.map(item=>item.id));state.data=await call('media-duplicate',{id:el.dataset.asset,gameId:state.game||''});$('mediaAssetPicker').close();render();const added=state.data.media.find(item=>!before.has(item.id));if(added)await editMedia(added.id);return;}
        if(el.dataset.testMedia){await call('media-test',{id:el.dataset.testMedia});notify('Video test olayı gönderildi.');return;}
        if(el.dataset.deleteMedia){if(confirm('Bu medya eşleştirmesi kaldırılsın mı?')){state.data=await call('media-remove',{id:el.dataset.deleteMedia});render();}return;}
        if(el.dataset.mediaBackground){state.data=await call('media-background',{enabled:el.dataset.mediaBackground==='true'});render();return;}
        if(el.dataset.downloadMedia){el.disabled=true;try{state.data=await call('media-remote',{id:el.dataset.downloadMedia,gameId:state.game||''});render();}finally{el.disabled=false;}return;}
        if(el.dataset.widget){await window.widgetAyarlariDogrudanAc?.(el.dataset.widget);return;}
        if(el.dataset.voiceSelect){selectSpeechVoice(el.dataset.voiceSelect);return;}
        if(el.dataset.action==='speech-read'){const text=$('speechTryText').value.trim();if(!text)return;stopSpeech();state.queue.push({text,settings:{...speechValues()}});speakNext();return;}
        if(el.dataset.voiceInstall){el.disabled=true;try{state.speechDraft=speechValues();state.speechCatalog=await call('speech-pack-install',{id:el.dataset.voiceInstall});state.voices=state.speechCatalog.voices||[];render();const voice=state.voices.find(voice=>voice.id===el.dataset.voiceInstall);if(voice)selectSpeechVoice(voice.voiceURI);notify('Ses indirildi ve seçildi. Kaydet ile canlı sohbete uygula.');}finally{el.disabled=false;}return;}
        if(el.dataset.voiceRemove){stopSpeech();state.speechCatalog=await call('speech-pack-remove',{id:el.dataset.voiceRemove});state.voices=state.speechCatalog.voices||[];render();return;}
        if(el.dataset.voiceTest){selectSpeechVoice(el.dataset.voiceTest);await previewSpeechVoice(el.dataset.voiceTest);return;}
        if(el.dataset.voiceSampleDownload){const result=await call('speech-preview-save',{voiceURI:el.dataset.voiceSampleDownload});if(result.saved)notify('Ses örneği kaydedildi.');return;}
        if(el.dataset.action==='speech-refresh'){el.disabled=true;try{await updateVoices(true);render();}finally{el.disabled=false;}return;}
        if(el.dataset.action==='speech-local-select'){el.disabled=true;try{state.speechDraft=speechValues();const result=await call('speech-local-select');if(!result.canceled){stopSpeech();state.speechCatalog=result;state.voices=result.voices||[];state.speechDraft={...state.speechDraft,provider:'chatterbox',voiceURI:state.voices.find(voice=>voice.provider==='chatterbox')?.voiceURI||'',voicePreset:'natural'};render();notify('10 doğal Türkçe konuşmacı hazır.');}}finally{el.disabled=false;}return;}
        if(el.dataset.naturalVoice){const voiceId=el.dataset.naturalVoice,id='chatterbox:'+voiceId;const engineReady=state.speechCatalog?.providers?.chatterbox?.engineReady||state.voices.some(voice=>voice.provider==='chatterbox');if(!engineReady&&!confirm('Bu gelişmiş ses ilk kez kurulurken yaklaşık '+((state.speechCatalog?.downloadPack?.commonBytes||0)/1073741824).toFixed(2)+' GB ortak motor indirir. Daha küçük ve hızlı Okur / EMA seçenekleri de var. Büyük motor kurulsun mu?'))return;state.speechDraft=speechValues();state.voiceProgress.set(id,{id,voiceId,phase:'preparing'});renderSpeechLibrary();window.lucide?.createIcons();try{state.speechCatalog=await call('speech-natural-install',{voiceId});state.voices=state.speechCatalog.voices||[];state.voiceProgress.set(id,{id,voiceId,phase:'complete'});render();notify('Seçilen doğal Türkçe ses hazır.');}catch(error){state.voiceProgress.set(id,{id,voiceId,phase:'error'});render();throw error;}return;}
        if(el.dataset.action==='speech-natural-cancel'){await call('speech-natural-cancel');return;}
        if(el.dataset.action==='speech-clear'){stopSpeech();state.speechCatalog=await call('speech-configure',{clear:true});state.voices=state.speechCatalog.voices||[];render();return;}
        if(el.dataset.action==='overlay-reconnect'){el.disabled=true;try{state.data=await call('overlay-reconnect');render();notify('HTTPS yayın bağlantısı kontrol ediliyor.');}finally{el.disabled=false;}return;}
        switch(el.dataset.action){case'media-library':await openMediaLibrary();break;case'close-assets':$('mediaAssetPicker').close();break;case'asset-import':$('mediaAssetPicker').close();await importMedia();break;case'asset-url':$('mediaAssetPicker').close();await editMedia(null);break;case'preview-clip':previewTrim(true);break;case'choose-gift':openGiftPicker();break;case'close-gifts':$('giftPicker').close();break;case'editor-test':await saveMediaEditor(true);break;case'refresh':await refresh(true);notify(state.data.catalogError||'İçerikler güncellendi.',Boolean(state.data.catalogError));break;case'media-import':await importMedia(el.dataset.importKind);break;case'media-folder':state.data=await call('media-folder');render();break;case'media-new':await editMedia(null);break;case'close-media':$('mediaEditor').close();$('mediaEditor').replaceChildren();break;case'widget-connect':window.tiktokHesapPanelAc();break;case'update':await window.guncellemeKontrolEt();break;case'license':window.yeniLisansGir();break;case'speech-stop':stopSpeech();break;case'speech-test':await previewSpeechVoice(speechValues().voiceURI);break;}
    });}
    document.addEventListener('DOMContentLoaded',()=>{
        if(!api?.workspace)return;
        const host=document.createElement('div');host.id='workspaceRoot';host.innerHTML=`<aside class="workspace-sidebar"><div class="workspace-brand"><span class="brand-m">m</span><span class="brand-n">N</span><span class="brand-g">g</span><small>Tik</small></div><span class="workspace-brand-name">TikMnG</span><nav aria-label="Ana menü">${[['games','gamepad-2'],['widgets','panels-top-left'],['media','clapperboard'],['speech','audio-lines'],['downloads','download'],['settings','settings-2']].map(([id,i])=>`<button data-workspace-view="${id}">${icon(i)} ${labels[id]}</button>`).join('')}</nav><div class="sidebar-bottom"><button data-action="widget-connect">${icon('radio')} Yayın hesabı</button><span id="workspaceVersion"></span></div></aside><div class="workspace-content"><header class="workspace-header"><div><small id="workspaceBreadcrumb">TIKMNG / YAYIN MERKEZİ</small><h1 id="workspaceTitle">Oyunlar</h1></div><div class="header-commands"><small id="workspaceEdition" class="preview-edition" hidden>TEST SÜRÜMÜ</small><span id="workspaceLive" class="live-label">Yayın kapalı</span><button class="workspace-button" data-action="widget-connect">${icon('radio')} Yayın hesabı</button></div></header><main id="workspaceBody"><p class="workspace-empty">Kütüphane hazırlanıyor…</p></main></div><div id="workspaceNotice" role="status" hidden></div><dialog id="mediaEditor"></dialog><dialog id="giftPicker"></dialog>`;
        const designerButton=document.createElement('button');designerButton.dataset.action='gift-designer';designerButton.innerHTML=icon('image-plus')+' Hediye Tasarımı';
        designerButton.addEventListener('click',()=>window.hediyeTasarimiAc?.());
        host.querySelector('.workspace-sidebar nav').appendChild(designerButton);
        document.querySelector('.main').prepend(host);host.addEventListener('click',click);
        window.addEventListener('tikmng-notice',event=>{if(typeof event.detail?.text==='string')notify(event.detail.text,Boolean(event.detail.error));});
        host.insertAdjacentHTML('beforeend','<dialog id="mediaAssetPicker"></dialog>');
        host.querySelector('[data-workspace-view="media"]').insertAdjacentHTML('afterend',`<button data-workspace-view="sounds">${icon('music-2')} ${labels.sounds}</button>`);
        window.addEventListener('message',event=>{const preview=soundPreview;if(preview?.frame&&event.source===preview.frame.contentWindow&&event.origin===new URL(preview.frame.src).origin&&event.data?.type==='tikmng-media-preview-ended'&&event.data.id===preview.id)stopSoundPreview();});
        window.addEventListener('message',event=>{const frame=$('mediaEditor')?.querySelector('iframe');const data=event.data;if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||data?.type!=='tikmng-media-metadata'||data.id!==state.media?.id)return;const duration=Number(data.duration);if(!Number.isFinite(duration)||duration<=0||duration>86400||duration===state.mediaDuration)return;state.mediaDuration=duration;const end=$('mediaEditorForm').elements.endSeconds;if(!Number(end.value))end.value=duration.toFixed(1);updateTrim();});
        $('mediaEditor').addEventListener('close',event=>{if(!event.target.open){event.target.replaceChildren();state.media=null;}});
        $('giftPicker').addEventListener('close',event=>event.target.replaceChildren());
        $('mediaAssetPicker').addEventListener('close',event=>{event.target.onclick=null;event.target.replaceChildren();});
        updateVoices();
        api.workspaceListen('voice-progress',updateVoiceProgress);
        api.workspaceListen('media-downloads',status=>{if(state.data){state.data.mediaDownloads=status;if(state.view==='downloads')renderDownloads($('workspaceBody'));}});
        window.addEventListener('pagehide',stopSpeech,{once:true});
        window.addEventListener('pagehide',stopSoundPreview,{once:true});
        api.workspaceListen('progress',p=>{if(['complete','error','cancelled'].includes(p.phase))state.progress.delete(p.oyun);else state.progress.set(p.oyun,p);if(state.game===p.oyun&&$('detailProgress'))$('detailProgress').innerHTML=progressMarkup(p.oyun);else if(state.view==='downloads')render();});
        api.workspaceListen('catalog',()=>{act(()=>refresh());});api.workspaceListen('chat',chat);
        api.workspaceListen('overlay',status=>{if(state.data){const wasReady=state.data.overlayTransport?.ready;state.data.overlayTransport=status;const label=$('httpsServiceStatus');if(label)label.textContent=status.message;updateMediaConnection();if(wasReady!==status.ready)act(async()=>{state.widgetInfo=await api.widgetBilgisi();await refresh();});}});
        api.workspaceListen('live',status=>{state.widgetInfo={...state.widgetInfo,liveStatus:status};showLiveStatus(status,state.widgetInfo.channel);});
        act(()=>refresh());
        api.orbitHediyeKatalogu().then(gifts=>{state.gifts=gifts||[];if(['media','sounds'].includes(state.view)&&state.data)renderMediaLists();}).catch(()=>{});
        let activeChannel;
        const connection=async()=>{try{const info=await api.widgetBilgisi();state.widgetInfo=info;showLiveStatus(info.liveStatus||{},info.channel);if(activeChannel!==undefined&&activeChannel!==info.channel){stopSpeech();state.lastUsers.clear();await refresh();}activeChannel=info.channel;}catch{}};
        connection();const connectionTimer=setInterval(()=>{connection();updateMediaConnection();},5000);window.addEventListener('pagehide',()=>clearInterval(connectionTimer),{once:true});
    });
    function showLiveStatus(status,channel){
        const label=$('workspaceLive');if(!label)return;
        label.className='live-label '+(status.status||'disconnected');const name=status.username||channel;
        const names={connected:'Canlı',connecting:'Yayın aranıyor',waiting:'Yayın bekleniyor',error:status.nextRetryAt?'Yeniden deneniyor':'Bağlantı hatası',disconnected:'Yayın kapalı'};
        label.textContent=(names[status.status]||'Yayın kapalı')+(name&&status.status!=='disconnected'?' · @'+name:'');label.title=status.message||'';
        const details=$('settingsConnectionStatus');if(details)details.textContent=status.message||'Yayın bağlantısı kapalı.';
    }
})();
