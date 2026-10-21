'use strict';
(() => {
    const api = window.mngAPI;
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
    const covers = {vs:'vs-v4',puanlama:'puanlama-v4',orbit:'orbit-v4','crowd-control':'crowd-control-v4','battle-game':'battle-game-v3','duck-hunt':'duck-hunt-v3','pony-life':'pony-life-v3','frog-river':'frog-river-v3','penalty-kick':'penalty-kick-v3','battle-royale':'battle-royale-v3','snow-war':'snow-war-v3','zombie-war':'zombie-war-v3','gelene-gecene':'gelene-gecene-v3','tightrope-balance':'tightrope-balance-v4'};
    const state = { view:'games', game:null, data:null, search:'', filter:'all', category:'all', mediaSearch:'', mediaCategory:'', mediaPage:0, progress:new Map(), media:null, gifts:[], voices:[], queue:[], speaking:false, speechGeneration:0, activeSpeech:null, speechDraft:null, sourceDraft:null, lastUsers:new Map(), widgetInfo:null };
    const labels = { games:'Oyunlar', widgets:'Widget’lar', media:'Video Stüdyosu', speech:'Sesli Yorumlar', downloads:'İndirmeler', settings:'Ayarlar' };
    const mb = bytes => bytes ? `${(bytes / 1048576).toFixed(1)} MB` : 'Boyut bekleniyor';
    function notify(text, error=false) { const node=$('workspaceNotice'); node.textContent=text; node.classList.toggle('error',error); node.hidden=false; clearTimeout(notify.timer); notify.timer=setTimeout(()=>{node.hidden=true;},6000); }
    async function call(action,data) { const result=await api.workspace(action,data); if(result?.error) throw new Error(result.error); return result; }
    async function refresh(remote=false) { state.data=await call(remote?'refresh':'snapshot'); render(); }
    const gameCategory = game => ['battle-royale','snow-war','zombie-war'].includes(game.id)?'minecraft':game.id==='gelene-gecene'?'steam':'web';
    const description = game => game.description || document.getElementById(gameKey(game.id)+'Card')?.querySelector('.game-desc')?.textContent || 'Canlı yayın oyunu';
    const cover = game => covers[game.id] ? `<img src="assets/game-covers/${covers[game.id]}.png" alt="${esc(game.ad)}" loading="lazy">` : `<div class="game-letter">${icon(game.id==='zombie-war'?'skull':'gamepad-2')}</div>`;
    function render() {
        if(!state.data)return;
        $('workspaceVersion').textContent='v'+state.data.version+(state.data.preview?' · TEST':'');
        $('workspaceEdition').hidden=!state.data.preview;
        document.querySelectorAll('[data-workspace-view]').forEach(button=>button.classList.toggle('selected',button.dataset.workspaceView===state.view));
        $('workspaceTitle').textContent=state.game ? state.data.games.find(g=>g.id===state.game)?.ad || 'Oyun' : labels[state.view];
        $('workspaceBreadcrumb').textContent=state.game?'OYUN KÜTÜPHANESİ':'TIKMNG / YAYIN MERKEZİ';
        const body=$('workspaceBody');
        if(state.game)renderGame(body);
        else if(state.view==='games')renderGames(body);
        else if(state.view==='media')renderMedia(body);
        else if(state.view==='speech')renderSpeech(body);
        else if(state.view==='widgets')renderWidgets(body);
        else if(state.view==='downloads')renderDownloads(body);
        else renderSettings(body);
        window.lucide?.createIcons();
    }
    function renderGames(body) {
        const games=state.data.games.filter(g=>(state.filter==='all'||(state.filter==='installed'?g.installed:!g.installed))&&(state.category==='all'||gameCategory(g)===state.category)&&[g.ad,description(g)].join(' ').toLocaleLowerCase('tr').includes(state.search));
        body.innerHTML=`<div class="workspace-tools"><div class="library-summary"><h2>Oyun Kütüphanesi</h2><span>${state.data.games.length} oyun · ${state.data.games.filter(g=>g.installed).length} kurulu</span></div><label class="workspace-search">${icon('search')}<input id="librarySearch" type="search" value="${esc(state.search)}" placeholder="Oyun ara" aria-label="Oyun ara"></label><select id="libraryFilter" aria-label="Kurulum durumu"><option value="all">Bütün oyunlar</option><option value="installed">Kurulu oyunlar</option><option value="available">İndirilebilir oyunlar</option></select></div><div class="library-tabs" role="tablist" aria-label="Oyun türü">${[['all','Tümü'],['minecraft','Minecraft'],['web','Web'],['steam','Steam']].map(([id,title])=>`<button role="tab" aria-selected="${state.category===id}" data-category="${id}">${title}<small>${state.data.games.filter(g=>id==='all'||gameCategory(g)===id).length}</small></button>`).join('')}</div><div id="libraryGroups"></div>`;
        $('libraryFilter').value=state.filter;
        const groups=[['Kurulu Oyunlar',games.filter(g=>g.installed)],['Keşfet ve İndir',games.filter(g=>!g.installed)]];
        $('libraryGroups').innerHTML=groups.filter(([,games])=>games.length).map(([title,games])=>`<section class="library-band"><div class="band-heading"><h2>${title}</h2><span>${games.length} oyun</span></div><div class="library-grid">${games.map(g=>`<article class="library-card" data-game-id="${esc(g.id)}"><button class="cover-button" data-open="${esc(g.id)}" aria-label="${esc(g.ad)} sayfasına gir">${cover(g)}<span class="cover-badge ${g.installed?'ready':''}">${icon(g.installed?'check':'download')}${g.installed?(g.updateAvailable?'Güncelleme var':'Kurulu'):'İndirilebilir'}</span><span class="cover-enter">Gir ${icon('arrow-up-right')}</span><span class="cover-caption"><strong>${esc(g.ad)}</strong><small>${esc(g.boyut||'')}${icon('hard-drive')}</small></span></button></article>`).join('')}</div></section>`).join('')||'<p class="workspace-empty">Bu filtrede oyun bulunamadı.</p>';
        $('librarySearch').addEventListener('input',event=>{state.search=event.target.value.toLocaleLowerCase('tr');const start=event.target.selectionStart;renderGames(body);$('librarySearch').focus();$('librarySearch').setSelectionRange(start,start);window.lucide?.createIcons();});
        $('libraryFilter').addEventListener('change',event=>{state.filter=event.target.value;render();});
        body.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{state.category=button.dataset.category;render();}));
    }
    function gameKey(id){return typeof window.oyunElKey==='function'?window.oyunElKey(id):id;}
    function progressMarkup(id) {
        const p=state.progress.get(id);
        if(!p)return '';
        const known=Number.isFinite(p.percent);
        const phaseLabel={downloading:'Oyun paketi indiriliyor',verifying:'Dosyalar doğrulanıyor',extracting:'Oyun dosyaları kuruluyor',activating:'Kurulum tamamlanıyor',preparing:'İndirme hazırlanıyor',complete:'Tamamlandı'}[p.phase];
        return `<div class="download-status" role="status"><div class="download-meta"><strong>${esc(phaseLabel||p.message||p.mesaj||p.phase||'Hazırlanıyor')}</strong><span>${known?Math.round(p.percent)+'%':'İşlem sürüyor'}</span></div><div class="download-track ${known?'':'indeterminate'}"><span style="width:${known?Math.max(0,Math.min(100,p.percent)):32}%"></span></div><div class="download-meta"><span>${mb(p.transferredBytes)}${p.totalBytes?' / '+mb(p.totalBytes):''}</span><span>${p.speedBps?mb(p.speedBps)+'/sn':''}${p.etaSeconds?' · '+Math.ceil(p.etaSeconds)+' sn':''}</span></div></div>`;
    }
    function renderGame(body) {
        const g=state.data.games.find(g=>g.id===state.game); if(!g){state.game=null;return render();}
        const busy=state.progress.has(g.id);
        body.innerHTML=`<button class="back-command" data-back>${icon('arrow-left')} Oyunlara dön</button><div class="game-detail"><div class="game-detail-cover">${cover(g)}</div><div class="game-detail-info"><span class="install-state ${g.installed?'ready':''}">${g.installed?'Kurulu':'Henüz kurulmadı'}</span><h2>${esc(g.ad)}</h2><p>${esc(description(g))}</p><dl><div><dt>Kurulu sürüm</dt><dd>${esc(g.installedVersion||'—')}</dd></div><div><dt>Güncel paket</dt><dd>${esc(g.availableVersion||'—')}</dd></div><div><dt>Gereksinimler</dt><dd>${esc(g.requirements)}</dd></div></dl><div class="detail-commands">${g.installed?`<button class="workspace-button primary" data-play="${esc(g.id)}" ${busy?'disabled':''}>${icon('play')} Oyna</button>`:''}<button class="workspace-button ${g.installed?'':'primary'}" data-install="${esc(g.id)}" ${busy?'disabled':''}>${icon(g.installed?'refresh-cw':'download')} ${g.installed?'Güncelle / Onar':'Yükle'}</button>${g.installed?`<button class="workspace-icon danger" title="Oyunu kaldır" aria-label="Oyunu kaldır" data-remove="${esc(g.id)}">${icon('trash-2')}</button>`:''}</div><div id="detailProgress">${progressMarkup(g.id)}</div>${busy?`<button class="back-command" data-cancel="${esc(g.id)}">${icon('pause')} İndirmeyi durdur</button>`:''}</div></div><section class="detail-band"><h2>Yayın Dosyaları</h2><div class="resource-list">${g.resources?.length?g.resources.map(r=>`<button class="workspace-button" data-url="${esc(r.url)}">${icon('download')} ${esc(r.title)}</button>`).join(''):'<span class="muted">Ek dosya bulunmuyor.</span>'}</div></section>`;
    }
    function renderMedia(body) {
        const categories=[...new Set([...(state.data.media||[]),...(state.data.remoteMedia||[])].map(item=>item.category||'Genel'))].sort((a,b)=>a.localeCompare(b,'tr'));
        if(state.mediaCategory&&!categories.includes(state.mediaCategory))categories.push(state.mediaCategory);
        body.innerHTML=`<div class="band-heading"><div><h2>Yayın Videoları ve Sesleri</h2><span id="mediaCount" role="status"></span></div><div class="detail-commands"><button class="workspace-button" data-action="media-new">${icon('link')} Bağlantı ekle</button><button class="workspace-button" data-action="media-folder">${icon('folder-open')} Arşiv ekle</button><button class="workspace-button primary" data-action="media-import">${icon('folder-plus')} Dosya ekle</button></div></div><div class="overlay-link"><label for="allMediaLink">Bütün eylemler için sabit yayın bağlantısı</label><div><input id="allMediaLink" readonly value="${esc(state.data.overlayUrl)}"><button class="workspace-icon" data-copy="${esc(state.data.overlayUrl)}" title="Bağlantıyı kopyala" aria-label="Bağlantıyı kopyala">${icon('copy')}</button></div></div><div class="workspace-tools media-filters"><label class="workspace-search">${icon('search')}<input id="mediaSearch" type="search" value="${esc(state.mediaSearch)}" placeholder="Video veya ses ara" aria-label="Video veya ses ara" aria-controls="mediaLibrary remoteMediaLibrary"></label><select id="mediaCategory" aria-label="Medya kategorisi" aria-controls="mediaLibrary remoteMediaLibrary"><option value="">Bütün kategoriler</option>${categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></div><div id="mediaLibrary" class="media-library"></div><section class="detail-band"><div class="band-heading"><h2>Yayımlanan Video Kataloğu</h2><span id="remoteMediaCount" role="status"></span></div><div id="remoteMediaLibrary" class="media-library"></div></section>`;
        $('mediaCategory').value=state.mediaCategory;
        $('mediaSearch').addEventListener('input',event=>{state.mediaSearch=event.target.value;state.mediaPage=0;renderMediaLists();});
        $('mediaCategory').addEventListener('change',event=>{state.mediaCategory=event.target.value;state.mediaPage=0;renderMediaLists();});
        renderMediaLists();
    }
    function renderMediaLists(){
        const query=state.mediaSearch.trim().toLocaleLowerCase('tr');
        const matches=item=>(!state.mediaCategory||(item.category||'Genel')===state.mediaCategory)&&[item.title,item.category||'Genel',item.giftId].join(' ').toLocaleLowerCase('tr').includes(query);
        const media=state.data.media||[],remote=state.data.remoteMedia||[],localMatches=media.filter(matches),remoteMatches=remote.filter(matches);
        const pages=Math.max(1,Math.ceil(localMatches.length/24));state.mediaPage=Math.min(state.mediaPage,pages-1);
        $('mediaCount').textContent=`${localMatches.length} / ${media.length} kayıt`;
        $('remoteMediaCount').textContent=`${remoteMatches.length} / ${remote.length} kayıt`;
        $('mediaLibrary').innerHTML=localMatches.slice(state.mediaPage*24,state.mediaPage*24+24).map(item=>`<article class="media-row" data-media-id="${esc(item.id)}"><div class="media-thumb">${item.kind==='audio'?icon('audio-lines'):`<iframe loading="lazy" tabindex="-1" title="${esc(item.title)} kapağı" src="${esc(mediaPreviewUrl(item,'poster'))}"></iframe>`}<button data-edit-media="${esc(item.id)}" aria-label="${esc(item.title)} ön izlemesi">${icon('play')}</button></div><div class="media-info"><small>${esc(item.category||'Genel')} · ${Math.round((item.volume??1)*100)}% ses</small><h3>${esc(item.title)}</h3><div class="gift-assignment">${giftMarkup(item.giftId)}${icon('arrow-right')}${icon(item.kind==='audio'?'audio-lines':'clapperboard')}</div></div><div class="detail-commands"><button class="workspace-icon" title="Ön izle ve test et" aria-label="${esc(item.title)} test et" data-edit-media="${esc(item.id)}">${icon('play')}</button><button class="workspace-icon" title="Düzenle" aria-label="${esc(item.title)} düzenle" data-edit-media="${esc(item.id)}">${icon('sliders-horizontal')}</button><button class="workspace-icon" title="Özel bağlantıyı kopyala" aria-label="Özel bağlantıyı kopyala" data-copy="${esc(item.overlayUrl)}">${icon('link')}</button><button class="workspace-icon danger" title="Eşleştirmeyi kaldır" aria-label="Eşleştirmeyi kaldır" data-delete-media="${esc(item.id)}">${icon('trash-2')}</button></div></article>`).join('')||`<div class="workspace-empty">${media.length?'Bu filtrede medya bulunamadı.':'Henüz video eklenmedi.'}</div>`;
        let pagination=$('mediaPagination');if(!pagination){pagination=document.createElement('div');pagination.id='mediaPagination';pagination.className='media-pagination';$('mediaLibrary').after(pagination);}
        pagination.innerHTML=pages>1?`<button class="workspace-icon" data-media-page="${state.mediaPage-1}" ${state.mediaPage===0?'disabled':''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.mediaPage+1} / ${pages}</span><button class="workspace-icon" data-media-page="${state.mediaPage+1}" ${state.mediaPage===pages-1?'disabled':''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`:'';
        $('remoteMediaLibrary').innerHTML=remoteMatches.map(item=>`<article class="media-row" data-remote-media-id="${esc(item.id)}"><div class="media-thumb">${icon('cloud-download')}</div><div class="media-info"><small>${esc(item.category||'Genel')}</small><h3>${esc(item.title)}</h3></div><button class="workspace-button" data-download-media="${esc(item.id)}">${icon('download')} Kütüphaneme ekle</button></article>`).join('')||`<p class="workspace-empty">${remote.length?'Bu filtrede yayımlanan medya bulunamadı.':'Yayımlanan video yok.'}</p>`;
        window.lucide?.createIcons();
    }
    function renderSpeech(body) {
        const t=state.speechDraft||state.data.tts;
        body.innerHTML=`<form id="speechForm" class="settings-form"><div class="band-heading"><h2>Yorumları Seslendir</h2><label class="toggle-label"><input name="enabled" type="checkbox" ${t.enabled?'checked':''}> Açık</label></div><label>Ses<select name="voiceURI"><option value="">Otomatik Türkçe ses</option>${state.voices.map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===t.voiceURI?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label><p class="muted">${state.voices.some(v=>v.lang.toLowerCase().startsWith('tr'))?'Türkçe sistem sesi bulundu.':'Türkçe sistem sesi bulunamadı. Windows dil ve konuşma ayarlarından Türkçe ses ekleyebilirsin.'}</p><div class="settings-columns"><label>Ses düzeyi <output id="speechVolume">${Math.round(t.volume*100)}%</output><input name="volume" type="range" min="0" max="1" step="0.01" value="${t.volume}"></label><label>Konuşma hızı<input name="rate" type="range" min="0.5" max="2" step="0.05" value="${t.rate}"></label><label>Ses tonu<input name="pitch" type="range" min="0.5" max="2" step="0.05" value="${t.pitch}"></label></div><div class="settings-columns"><label>En fazla karakter<input name="maxLength" type="number" min="20" max="500" value="${t.maxLength}"></label><label>Kişi başına bekleme (sn)<input name="cooldownSeconds" type="number" min="1" max="60" value="${t.cooldownSeconds}"></label></div><label class="toggle-label"><input name="names" type="checkbox" ${t.names?'checked':''}> Kullanıcı adını da oku</label><label>Okunmayacak kelimeler<textarea name="blockedWords" rows="3" placeholder="Virgülle ayır">${esc(t.blockedWords)}</textarea></label><div class="detail-commands"><button type="submit" class="workspace-button primary">${icon('check')} Kaydet</button><button type="button" class="workspace-button" data-action="speech-test">${icon('volume-2')} Sesi dene</button><button type="button" class="workspace-icon" data-action="speech-stop" title="Konuşmayı durdur" aria-label="Konuşmayı durdur">${icon('square')}</button></div><p id="speechStatus" class="muted" role="status">${state.queue.length} yorum sırada</p></form>`;
        const form=$('speechForm'); form.elements.volume.addEventListener('input',()=>{$('speechVolume').textContent=Math.round(form.elements.volume.value*100)+'%';});
        trackDraft(form,'speechDraft');
        updateSpeechVoiceOptions();
        form.querySelector('[data-action="speech-test"]').disabled=!speechAvailable();
        form.querySelector('[data-action="speech-stop"]').disabled=!speechAvailable();
        updateSpeechStatus();
        form.addEventListener('submit',event=>{event.preventDefault();act(async()=>{const submitted=formDraft(form);state.data=await call('tts',speechValues());if(JSON.stringify(state.speechDraft)===JSON.stringify(submitted))state.speechDraft=null;if(!state.data.tts.enabled)stopSpeech();notify('Ses ayarları kaydedildi.');});});
    }
    function formDraft(form){return Object.fromEntries([...form.elements].filter(field=>field.name).map(field=>[field.name,field.type==='checkbox'?field.checked:field.value]));}
    function trackDraft(form,key){const remember=()=>{state[key]=formDraft(form);};form.addEventListener('input',remember);form.addEventListener('change',remember);}
    function speechValues(){const f=$('speechForm').elements;return {enabled:f.enabled.checked,names:f.names.checked,voiceURI:f.voiceURI.value,volume:Number(f.volume.value),rate:Number(f.rate.value),pitch:Number(f.pitch.value),maxLength:Number(f.maxLength.value),cooldownSeconds:Number(f.cooldownSeconds.value),blockedWords:f.blockedWords.value};}
    function speechAvailable(){return typeof window.SpeechSynthesisUtterance==='function'&&typeof window.speechSynthesis?.speak==='function'&&typeof window.speechSynthesis?.cancel==='function';}
    function updateSpeechStatus(){const status=$('speechStatus');if(status)status.textContent=speechAvailable()?state.queue.length+' yorum sırada':'Bu sistemde sesli okuma kullanılamıyor.';}
    function updateSpeechVoiceOptions(){
        const select=$('speechForm')?.elements.voiceURI;if(!select)return;
        const selected=state.speechDraft?.voiceURI??state.data.tts.voiceURI;
        select.innerHTML=`<option value="">Otomatik Türkçe ses</option>${state.voices.map(voice=>`<option value="${esc(voice.voiceURI)}">${esc(voice.name)} (${esc(voice.lang)})</option>`).join('')}${selected&&!state.voices.some(voice=>voice.voiceURI===selected)?`<option value="${esc(selected)}">Kayıtlı ses (şu anda kullanılamıyor)</option>`:''}`;
        select.value=selected;
        select.closest('label').nextElementSibling.textContent=state.voices.some(voice=>String(voice.lang).toLowerCase().startsWith('tr'))?'Türkçe sistem sesi bulundu.':'Türkçe sistem sesi bulunamadı. Windows dil ve konuşma ayarlarından Türkçe ses ekleyebilirsin.';
    }
    function updateVoices(){try{state.voices=window.speechSynthesis?.getVoices?.()||[];}catch{state.voices=[];}updateSpeechVoiceOptions();}
    function cancelSpeech(){try{window.speechSynthesis?.cancel?.();}catch{ /* A missing or shutting-down speech engine has nothing left to stop. */ }}
    function stopSpeech(){
        state.speechGeneration++;
        state.queue=[];
        if(state.activeSpeech){state.activeSpeech.finished=true;clearTimeout(state.activeSpeech.timeout);}
        state.activeSpeech=null;
        state.speaking=false;
        cancelSpeech();
        updateSpeechStatus();
    }
    function speakNext(){
        if(state.speaking||!state.queue.length)return;
        if(!speechAvailable()){stopSpeech();return;}
        const {text,settings}=state.queue.shift();
        const generation=state.speechGeneration;
        const active={finished:false,timeout:null,utterance:null};
        state.activeSpeech=active;
        state.speaking=true;
        updateSpeechStatus();
        // Invalidate completion before cancel: speech engines may fire error/end synchronously.
        function finish(error,cancel=false){
            if(active.finished||state.activeSpeech!==active||state.speechGeneration!==generation)return;
            active.finished=true;
            clearTimeout(active.timeout);
            state.activeSpeech=null;
            state.speaking=false;
            if(cancel)cancelSpeech();
            if(error)notify('Sistem sesi oynatılamadı. Bir ses seçip tekrar dene.',true);
            updateSpeechStatus();
            queueMicrotask(()=>{if(state.speechGeneration===generation)speakNext();});
        }
        try{
            const utterance=active.utterance=new window.SpeechSynthesisUtterance(text);
            const voice=state.voices.find(v=>v.voiceURI===settings.voiceURI)||state.voices.find(v=>String(v.lang).toLowerCase().startsWith('tr'));
            if(voice)utterance.voice=voice;
            utterance.lang=voice?.lang||'tr-TR';utterance.volume=settings.volume;utterance.rate=settings.rate;utterance.pitch=settings.pitch;
            utterance.onend=()=>finish(false);
            utterance.onerror=event=>finish(!['canceled','interrupted'].includes(event?.error));
            active.timeout=setTimeout(()=>finish(true,true),30000);
            window.speechSynthesis.speak(utterance);
        }catch{finish(true,true);}
    }
    function chat(payload){const t=state.data?.tts;if(!t?.enabled||!speechAvailable())return;const name=String(payload.username||payload.uniqueId||'izleyici');let message=String(payload.message||payload.comment||'').replace(/https?:\/\/\S+/gi,'').trim();if(!message||message.startsWith('!'))return;const blocked=String(t.blockedWords||'').split(',').map(x=>x.trim().toLocaleLowerCase('tr')).filter(Boolean);if(blocked.some(word=>message.toLocaleLowerCase('tr').includes(word)))return;const last=state.lastUsers.get(name)||0;if(Date.now()-last<t.cooldownSeconds*1000)return;state.lastUsers.set(name,Date.now());if(state.lastUsers.size>1000)state.lastUsers.delete(state.lastUsers.keys().next().value);if(state.queue.length>=20)return;state.queue.push({text:(t.names?name+': ':'')+message.slice(0,t.maxLength),settings:{...t}});speakNext();updateSpeechStatus();}
    function renderWidgets(body){
        const info=state.widgetInfo;
        body.innerHTML=`<div class="band-heading"><h2>Yayın Widget’ları</h2><button class="workspace-button" data-action="widget-connect">${icon('radio')} Yayın bağlantısı</button></div><div class="library-grid widget-library">${(info?.widgets||[]).map(item=>`<article class="workspace-widget"><iframe loading="lazy" title="${esc(item.name)} ön izlemesi" src="${esc(widgetUrl(item,true))}" sandbox="allow-scripts allow-same-origin"></iframe><div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="detail-commands"><button class="workspace-button" data-widget="${esc(item.id)}">${icon('sliders-horizontal')} Ayarlar</button><button class="workspace-icon" data-copy-widget="${esc(item.id)}" title="Yayın bağlantısını kopyala" aria-label="Yayın bağlantısını kopyala">${icon('copy')}</button></div></div></article>`).join('')||'<p class="muted">Widget’lar yükleniyor.</p>'}</div>`;
    }
    function widgetUrl(item,preview=false){
        // app.js helpers share this channel context with the existing settings panel.
        if(typeof widgetGalleryInfo!=='undefined')widgetGalleryInfo=state.widgetInfo;
        const raw=preview?item.previewUrl:item.url;
        if(preview&&typeof window.widgetOnIzlemeUrl==='function')return window.widgetOnIzlemeUrl(raw,item.id);
        return window.widgetOzellestirilmisUrl?.(raw,item.id)||raw;
    }
    function renderDownloads(body){body.innerHTML=`<div class="band-heading"><h2>İndirme Kuyruğu</h2></div>${[...state.progress].map(([id])=>`<section class="download-row"><h3>${esc(state.data.games.find(g=>g.id===id)?.ad||'Medya')}</h3>${progressMarkup(id)}<button class="workspace-button" data-cancel="${esc(id)}">${icon('pause')} Durdur</button></section>`).join('')||'<p class="workspace-empty">Etkin indirme yok.</p>'}`;}
    function renderSettings(body){
        const draft=state.sourceDraft||{source:state.data.source,endpoint:state.data.tikfinityUrl};
        body.innerHTML=`<form id="sourceForm" class="settings-form"><h2>Canlı Yayın Kaynağı</h2><label>Bağlantı yöntemi<select name="source"><option value="direct">TikMNG doğrudan bağlantı</option><option value="tikfinity">TikFinity Desktop</option></select></label><label>TikFinity yerel bağlantısı<input name="endpoint" value="${esc(draft.endpoint)}" placeholder="ws://127.0.0.1:21213/"></label><button class="workspace-button primary" type="submit">${icon('check')} Kaynağı kaydet</button></form><section class="detail-band"><h2>Depolama</h2><div class="storage-row"><div><strong>Oyun klasörü</strong><p>${esc(state.data.libraryRoot)}</p></div><button class="workspace-button" data-folder="games">${icon('folder')} Değiştir</button></div><div class="storage-row"><div><strong>Video ve ses klasörü</strong><p>${esc(state.data.mediaRoot)}</p></div><button class="workspace-button" data-folder="media">${icon('folder')} Değiştir</button></div></section><section class="detail-band"><h2>İçerik ve Uygulama</h2><p class="muted">İçerik kataloğu: ${esc(state.data.catalogRevision||'Yerel katalog')}${state.data.catalogError?' · '+esc(state.data.catalogError):''}</p><div class="detail-commands"><button class="workspace-button" data-action="refresh">${icon('refresh-cw')} İçerikleri yenile</button><button class="workspace-button" data-action="update">${icon('download-cloud')} Uygulama güncellemesini kontrol et</button><button class="workspace-button" data-action="license">${icon('key-round')} Lisans</button></div></section>`;
        const form=$('sourceForm');form.elements.source.value=draft.source;trackDraft(form,'sourceDraft');
        form.addEventListener('submit',event=>{event.preventDefault();act(async()=>{const submitted=formDraft(form);state.data=await call('source',submitted);if(JSON.stringify(state.sourceDraft)===JSON.stringify(submitted))state.sourceDraft=null;notify('Bağlantı kaynağı kaydedildi. Yayın hesabından Bağlan’a basabilirsin.');render();});});
    }
    function mediaPreviewUrl(item,mode='preview'){const url=new URL(item.overlayUrl);url.searchParams.set(mode,'1');if(mode==='poster')url.searchParams.set('mute','1');return url.href;}
    function giftMarkup(id){const gift=state.gifts.find(g=>String(g.id)===String(id));return gift?`<img src="${esc(gift.image)}" alt=""><span>${esc(gift.name)} · ${esc(gift.coins)} coin</span>`:`<span>${id?'Hediye #'+esc(id):'Hediye seçilmedi'}</span>`;}
    function openGiftPicker(){
        const dialog=$('giftPicker');const selected=$('mediaEditorForm').elements.giftId.value;
        dialog.innerHTML=`<header><h2>Hediye Kataloğu</h2><button class="workspace-icon" data-action="close-gifts" title="Kapat" aria-label="Hediye kataloğunu kapat">${icon('x')}</button></header><label class="workspace-search">${icon('search')}<input id="giftSearch" type="search" placeholder="Hediye adı, ID veya coin" aria-label="Hediye ara"></label><div class="gift-choice-list" id="giftChoices"></div><p id="giftPickerStatus" role="status"></p>`;
        const draw=()=>{const query=$('giftSearch').value.trim().toLocaleLowerCase('tr');const gifts=state.gifts.filter(g=>[g.name,g.id,g.coins].join(' ').toLocaleLowerCase('tr').includes(query));$('giftChoices').innerHTML=`<button class="gift-choice" data-gift-choice="" aria-pressed="${!selected}">${icon('ban')}Hediye yok</button>`+gifts.slice(0,120).map(g=>`<button class="gift-choice" data-gift-choice="${esc(g.id)}" aria-pressed="${String(g.id)===selected}"><img loading="lazy" src="${esc(g.image)}" alt=""><span>${esc(g.name)}</span><small>${esc(g.coins)} coin · #${esc(g.id)}</small></button>`).join('');$('giftPickerStatus').textContent=`${gifts.length} hediye${gifts.length>120?' · İlk 120 sonuç':''}`;window.lucide?.createIcons();};
        $('giftSearch').addEventListener('input',draw);draw();dialog.showModal();$('giftSearch').focus();
    }
    async function editMedia(id){
        if(!state.gifts.length)state.gifts=await api.orbitHediyeKatalogu();
        const item=state.data.media.find(item=>item.id===id)||{title:'',category:'Genel',giftId:'',startSeconds:0,endSeconds:0,volume:0.8,cooldownSeconds:0,enabled:true};
        state.media=item;
        const dialog=$('mediaEditor');
        dialog.innerHTML=`<form id="mediaEditorForm"><header><h2>${id?'Video ve Hediye Eşleştirmesi':'Medya Bağlantısı Ekle'}</h2><button type="button" class="workspace-icon" data-action="close-media" title="Kapat" aria-label="Kapat">${icon('x')}</button></header><div class="media-editor-layout"><div class="media-preview-panel">${id?`<iframe class="media-editor-preview" src="${esc(mediaPreviewUrl(item))}" title="Video ön izlemesi" allow="autoplay"></iframe><label>Sabit yayın bağlantısı<input readonly value="${esc(item.overlayUrl)}"></label><button type="button" class="workspace-button" data-copy="${esc(item.overlayUrl)}">${icon('copy')} Bağlantıyı kopyala</button>`:`<label>HTTPS video veya ses bağlantısı<input name="url" type="url" required placeholder="https://.../video.mp4"></label>`}</div><div class="media-editor-fields"><div class="settings-columns"><label>Başlık<input name="title" required maxlength="160" value="${esc(item.title)}"></label><label>Kategori<input name="category" maxlength="80" value="${esc(item.category)}" list="mediaCategories"><datalist id="mediaCategories">${['Racon','Oryantal','Takım Videoları','Harita Oyunları','Genel'].map(c=>`<option value="${c}">`).join('')}</datalist></label></div><input type="hidden" name="giftId" value="${esc(item.giftId)}"><label>Videoyu çalıştıracak hediye</label><button type="button" class="gift-selector" id="chosenGift" data-action="choose-gift">${giftMarkup(item.giftId)}${icon('chevron-down')}</button><div class="settings-columns"><label>Başlangıç (sn)<input name="startSeconds" type="number" min="0" step="0.1" value="${item.startSeconds||0}"></label><label>Bitiş (0: sonuna kadar)<input name="endSeconds" type="number" min="0" step="0.1" value="${item.endSeconds||0}"></label><label>Bekleme (sn)<input name="cooldownSeconds" type="number" min="0" max="3600" value="${item.cooldownSeconds||0}"></label></div><label>Ses <output id="mediaVolumeLabel">${Math.round((item.volume??0.8)*100)}%</output><input name="volume" type="range" min="0" max="1" step="0.01" value="${item.volume??0.8}"></label><label class="toggle-label"><input type="checkbox" name="enabled" ${item.enabled?'checked':''}> Yayında etkin</label></div></div><footer><button type="button" class="workspace-button" data-action="close-media">Vazgeç</button>${id?`<button type="button" class="workspace-button" data-action="editor-test">${icon('play')} Kaydet ve Test Et</button>`:''}<button type="submit" class="workspace-button primary">${icon('check')} Kaydet</button></footer><p id="mediaEditorError" role="alert"></p></form>`;
        if(!dialog.open)dialog.showModal();window.lucide?.createIcons();const form=$('mediaEditorForm');form.elements.volume.addEventListener('input',()=>{$('mediaVolumeLabel').textContent=Math.round(form.elements.volume.value*100)+'%';});
        form.addEventListener('submit',event=>{event.preventDefault();saveMediaEditor(false);});
    }
    async function saveMediaEditor(test){
        const form=$('mediaEditorForm');if(!form.reportValidity())return;
        const f=form.elements,buttons=[...form.querySelectorAll('footer button')];buttons.forEach(button=>button.disabled=true);
        try{
            const item=state.media;state.data=await call('media-save',{...item,title:f.title.value,category:f.category.value,trigger:'gift',giftId:f.giftId.value,startSeconds:Number(f.startSeconds.value),endSeconds:Number(f.endSeconds.value)||null,volume:Number(f.volume.value),cooldownSeconds:Number(f.cooldownSeconds.value),enabled:f.enabled.checked,...(f.url?{url:f.url.value}:{})});
            if(test){state.media=state.data.media.find(record=>record.id===item.id);await call('media-test',{id:item.id});notify('Eşleştirme kaydedildi ve video testi gönderildi.');}
            else{$('mediaEditor').close();render();notify('Video eşleştirmesi kaydedildi.');}
        }catch(error){$('mediaEditorError').textContent=error.message;}finally{buttons.forEach(button=>button.disabled=false);}
    }
    async function act(fn){try{await fn();}catch(error){notify(error.message,true);}}
    async function click(event){const el=event.target.closest('button');if(!el)return;await act(async()=>{
        if(el.dataset.workspaceView){state.game=null;state.view=el.dataset.workspaceView;if(state.view==='widgets')state.widgetInfo=await api.widgetBilgisi();render();return;}
        if(el.hasAttribute('data-gift-choice')){const id=el.dataset.giftChoice;$('mediaEditorForm').elements.giftId.value=id;$('chosenGift').innerHTML=giftMarkup(id)+icon('chevron-down');$('giftPicker').close();window.lucide?.createIcons();return;}
        if(el.hasAttribute('data-media-page')){state.mediaPage=Math.max(0,Number(el.dataset.mediaPage)||0);renderMediaLists();return;}
        if(el.hasAttribute('data-back')){state.game=null;render();return;}
        if(el.dataset.open){state.game=el.dataset.open;render();return;}
        if(el.dataset.play){await window.oynaButonu(el.dataset.play);return;}
        if(el.dataset.install){const id=el.dataset.install;state.progress.set(id,{phase:'Hazırlanıyor',percent:null});render();try{const result=id==='gelene-gecene'?await api.oyunKur(id):await call('install',{id,repair:true});if(result?.basarili===false)throw new Error(result.hata);notify('Oyun kurulumu tamamlandı.');}finally{state.progress.delete(id);await refresh();}return;}
        if(el.dataset.cancel){await call('cancel',{id:el.dataset.cancel});return;}
        if(el.dataset.remove){if(confirm('Oyunun kurulu paketleri kaldırılsın mı? Kayıtlı ayar ve yedekleri koruyacağız.')){await call('remove',{id:el.dataset.remove});await refresh();}return;}
        if(el.dataset.copyWidget){const item=state.widgetInfo?.widgets.find(item=>item.id===el.dataset.copyWidget);if(item){await navigator.clipboard.writeText(widgetUrl(item));notify('Bağlantı kopyalandı.');}return;}
        if(el.dataset.copy){await navigator.clipboard.writeText(el.dataset.copy);notify('Bağlantı kopyalandı.');return;}
        if(el.dataset.url){await api.hariciLinkAc(el.dataset.url);return;}
        if(el.dataset.folder){state.data=await call('folder',{kind:el.dataset.folder});if(!state.data.canceled)render();else await refresh();return;}
        if(el.dataset.editMedia){await editMedia(el.dataset.editMedia);return;}
        if(el.dataset.testMedia){await call('media-test',{id:el.dataset.testMedia});notify('Video test olayı gönderildi.');return;}
        if(el.dataset.deleteMedia){if(confirm('Bu medya eşleştirmesi kaldırılsın mı?')){state.data=await call('media-remove',{id:el.dataset.deleteMedia});render();}return;}
        if(el.dataset.downloadMedia){el.disabled=true;try{state.data=await call('media-remote',{id:el.dataset.downloadMedia});render();}finally{el.disabled=false;}return;}
        if(el.dataset.widget){await window.widgetAyarlariDogrudanAc?.(el.dataset.widget);return;}
        switch(el.dataset.action){case'choose-gift':openGiftPicker();break;case'close-gifts':$('giftPicker').close();break;case'editor-test':await saveMediaEditor(true);break;case'refresh':await refresh(true);notify(state.data.catalogError||'İçerikler güncellendi.',Boolean(state.data.catalogError));break;case'media-import':state.data=await call('media-import');render();break;case'media-folder':state.data=await call('media-folder');render();break;case'media-new':await editMedia(null);break;case'close-media':$('mediaEditor').close();$('mediaEditor').replaceChildren();break;case'widget-connect':window.tiktokHesapPanelAc();break;case'update':await window.guncellemeKontrolEt();break;case'license':window.yeniLisansGir();break;case'speech-stop':stopSpeech();break;case'speech-test':stopSpeech();state.queue.push({text:'Merhaba! TikMNG sesli yorum sistemi hazır.',settings:speechValues()});speakNext();break;}
    });}
    document.addEventListener('DOMContentLoaded',()=>{
        if(!api?.workspace)return;
        const host=document.createElement('div');host.id='workspaceRoot';host.innerHTML=`<aside class="workspace-sidebar"><div class="workspace-brand"><span class="brand-m">m</span><span class="brand-n">N</span><span class="brand-g">g</span><small>Tik</small></div><span class="workspace-brand-name">TikMnG</span><nav aria-label="Ana menü">${[['games','gamepad-2'],['widgets','panels-top-left'],['media','clapperboard'],['speech','audio-lines'],['downloads','download'],['settings','settings-2']].map(([id,i])=>`<button data-workspace-view="${id}">${icon(i)} ${labels[id]}</button>`).join('')}</nav><div class="sidebar-bottom"><button data-action="widget-connect">${icon('radio')} Yayın hesabı</button><span id="workspaceVersion"></span></div></aside><div class="workspace-content"><header class="workspace-header"><div><small id="workspaceBreadcrumb">TIKMNG / YAYIN MERKEZİ</small><h1 id="workspaceTitle">Oyunlar</h1></div><div class="header-commands"><small id="workspaceEdition" class="preview-edition" hidden>TEST SÜRÜMÜ</small><span id="workspaceLive" class="live-label">Yayın kapalı</span><button class="workspace-button" data-action="widget-connect">${icon('radio')} Yayın hesabı</button></div></header><main id="workspaceBody"><p class="workspace-empty">Kütüphane hazırlanıyor…</p></main></div><div id="workspaceNotice" role="status" hidden></div><dialog id="mediaEditor"></dialog><dialog id="giftPicker"></dialog>`;
        document.querySelector('.main').prepend(host);host.addEventListener('click',click);
        $('mediaEditor').addEventListener('close',event=>{if(!event.target.open){event.target.replaceChildren();state.media=null;}});
        $('giftPicker').addEventListener('close',event=>event.target.replaceChildren());
        updateVoices();window.speechSynthesis?.addEventListener?.('voiceschanged',updateVoices);
        window.addEventListener('pagehide',stopSpeech,{once:true});
        api.workspaceListen('progress',p=>{if(['complete','error','cancelled'].includes(p.phase))state.progress.delete(p.oyun);else state.progress.set(p.oyun,p);if(state.game===p.oyun&&$('detailProgress'))$('detailProgress').innerHTML=progressMarkup(p.oyun);else if(state.view==='downloads')render();});
        api.workspaceListen('catalog',()=>{act(()=>refresh());});api.workspaceListen('chat',chat);
        act(()=>refresh());
        api.orbitHediyeKatalogu().then(gifts=>{state.gifts=gifts||[];if(state.view==='media'&&state.data)renderMediaLists();}).catch(()=>{});
        let activeChannel;
        const connection=async()=>{try{const info=await api.widgetBilgisi();state.widgetInfo=info;const status=info.liveStatus||{};const label=$('workspaceLive');label.className='live-label '+(status.status||'disconnected');label.textContent=(status.status==='connected'?'Canlı · @':status.status==='connecting'?'Bağlanıyor · @':'Yayın kapalı')+(status.status==='connected'||status.status==='connecting'?(status.username||info.channel):'');if(activeChannel!==undefined&&activeChannel!==info.channel)await refresh();activeChannel=info.channel;}catch{}};
        connection();const connectionTimer=setInterval(connection,5000);window.addEventListener('pagehide',()=>clearInterval(connectionTimer),{once:true});
    });
})();
