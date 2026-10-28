'use strict';
window.TikMnGEntryVideos={create({call,icon,esc,notify,onSaved,chooseGift,giftMarkup}){
    const triggers=[['entry','Yayına giriş'],['comment','Yorum yazınca'],['gift','Seçilen hediye'],['interaction','Herhangi bir etkileşim']];
    let snapshot={},query='',filter='',dialog,busy=false,source=null;
    const label=trigger=>triggers.find(([value])=>value===trigger)?.[1]||trigger;
    const button=(name,title,action,id)=>`<button type="button" class="workspace-icon" data-entry-${action}="${esc(id)}" title="${title}" aria-label="${title}">${icon(name)}</button>`;
    const previewURL=raw=>{if(!raw)return '';const url=new URL(raw);url.searchParams.set('preview','1');return url.href;};
    const posterURL=raw=>{const url=new URL(raw);url.searchParams.set('poster','1');return url.href;};
    const playbackLabel=item=>item.playbackError?({blocked:'Tarayıcı otomatik oynatmayı engelledi',unsupported:'Video biçimi oynatılamadı',timeout:'Video yüklenirken zaman aşımı',network:'Video bağlantısı kurulamadı',aborted:'Video başlatılamadı'}[item.playbackError]||'Video başlatılamadı'):item.playedThisLive?'Bu yayında oynadı':item.pendingThisLive?'Yayın kaynağında oynatma bekleniyor':item.oncePerLive?'İlk eşleşme bekleniyor':Number(item.cooldownSeconds)+' sn aralık';
    function connection(){
        const node=document.getElementById('entryConnection');if(!node)return;
        const status=snapshot.entryVideoStatus||{};
        node.innerHTML=`<span class="entry-status-dot ${status.roomVerified?'connected':''}"></span><span>${esc(status.error||(status.roomVerified?'Yayın odası doğrulandı':'Yayın bağlantısı bekleniyor'))}</span><span class="entry-receivers">${Number(status.receivers)||0} yayın alıcısı</span>`;
    }
    function rows(){
        const host=document.getElementById('entryVideoRows');if(!host)return;
        const items=(snapshot.entryVideos||[]).filter(item=>(!filter||item.trigger===filter)&&[item.username,item.title,item.filename].join(' ').toLocaleLowerCase('tr').includes(query));
        document.getElementById('entryFilteredCount').textContent=items.length+' video';
        host.innerHTML=items.length?items.map(item=>`<article class="entry-video-row" data-entry-row="${esc(item.id)}">
            <button class="entry-poster" type="button" data-entry-preview="${esc(item.id)}" aria-label="${esc(item.title)} ön izlemesi"><iframe loading="lazy" tabindex="-1" src="${esc(posterURL(item.previewUrl))}" title="${esc(item.title)} video karesi"></iframe><span>${icon('play')}</span></button>
            <div class="entry-identity"><strong>@${esc(item.username)}</strong><span>${esc(item.title)}</span><small>${esc(item.filename)}</small></div>
            <div class="entry-trigger"><span>${esc(label(item.trigger))}</span>${item.trigger==='gift'?`<small>${giftMarkup(item.giftId)}</small>`:''}</div>
            <div class="entry-repeat"><span>${item.oncePerLive?'Yayında bir kez':'Her eşleşmede'}</span><small data-entry-playback="${esc(item.id)}">${esc(playbackLabel(item))}</small></div>
            <label class="entry-enable"><input type="checkbox" data-entry-enabled="${esc(item.id)}" ${item.enabled?'checked':''}><span>${item.enabled?'Etkin':'Kapalı'}</span></label>
            <div class="entry-row-tools">${button('eye','Ön izle','preview',item.id)}${button('radio','Yayın bağlantısında test et','test',item.id)}${button('rotate-ccw','İlk giriş hakkını sıfırla','reset',item.id)}${button('pencil','Düzenle','edit',item.id)}${button('trash-2','Videoyu kaldır','delete',item.id)}</div>
        </article>`).join(''):`<div class="entry-empty">${icon('clapperboard')}<h3>${snapshot.entryVideos?.length?'Video bulunamadı':'Henüz özel giriş videosu yok'}</h3>${!snapshot.entryVideos?.length?'<button type="button" class="workspace-button primary" data-entry-new>Video ekle</button>':''}</div>`;
        window.lucide?.createIcons();
    }
    function render(body,data){
        snapshot=data;
        body.innerHTML=`<section id="entryVideoPage"><div class="band-heading"><div><h2>Özel Giriş Videoları</h2><span>${(data.entryVideos||[]).length} video · ${(data.entryVideos||[]).filter(item=>item.enabled).length} etkin</span></div><button type="button" class="workspace-button primary" data-entry-new>${icon('plus')} Video ekle</button></div>
            <div class="entry-broadcast"><label>Özel giriş yayın bağlantısı<input id="entryBroadcastUrl" readonly value="${esc(data.entryVideoUrl||'')}" placeholder="HTTPS bağlantısı hazırlanıyor"></label><button type="button" class="workspace-icon" data-entry-copy ${data.entryVideoUrl?'':'disabled'} title="Yayın bağlantısını kopyala" aria-label="Yayın bağlantısını kopyala">${icon('copy')}</button></div><div id="entryConnection" role="status"></div>
            <div class="entry-toolbar"><label class="workspace-search">${icon('search')}<input id="entryVideoSearch" type="search" aria-label="Özel giriş videosu ara" placeholder="Kullanıcı adı veya video" value="${esc(query)}"></label><select id="entryTriggerFilter" aria-label="Tetikleme koşulu"><option value="">Bütün koşullar</option>${triggers.map(([value,name])=>`<option value="${value}" ${filter===value?'selected':''}>${name}</option>`).join('')}</select><span id="entryFilteredCount"></span></div>
            <div class="entry-column-labels" aria-hidden="true"><span>Video / kullanıcı</span><span>Koşul</span><span>Tekrar</span><span>Durum</span><span></span></div><div id="entryVideoRows"></div></section>`;
        const page=document.getElementById('entryVideoPage');
        page.onclick=event=>{const target=event.target.closest('button');if(!target)return;void action(target).catch(error=>notify(error.message,true));};
        page.onchange=event=>{const input=event.target.closest('[data-entry-enabled]');if(!input)return;input.disabled=true;void call('entry-save',{id:input.dataset.entryEnabled,enabled:input.checked}).then(onSaved).catch(error=>{input.checked=!input.checked;input.disabled=false;notify(error.message,true);});};
        document.getElementById('entryVideoSearch').oninput=event=>{query=event.target.value.toLocaleLowerCase('tr');rows();};
        document.getElementById('entryTriggerFilter').onchange=event=>{filter=event.target.value;rows();};
        connection();rows();
    }
    async function action(target){
        if(target.hasAttribute('data-entry-new'))return edit();
        if(target.hasAttribute('data-entry-copy')){await navigator.clipboard.writeText(snapshot.entryVideoUrl);notify('Özel giriş yayın bağlantısı kopyalandı.');return;}
        if(target.dataset.entryEdit)return edit(target.dataset.entryEdit);
        if(target.dataset.entryPreview)return preview(target.dataset.entryPreview);
        if(target.dataset.entryTest){target.disabled=true;try{await call('entry-test',{id:target.dataset.entryTest});notify('Video testi yayın bağlantısına gönderildi. İlk giriş hakkı değişmedi.');}finally{target.disabled=false;}return;}
        if(target.dataset.entryReset){target.disabled=true;try{await onSaved(await call('entry-reset',{id:target.dataset.entryReset}));notify('İlk giriş hakkı sıfırlandı.');}finally{target.disabled=false;}return;}
        if(target.dataset.entryDelete){
            const item=snapshot.entryVideos.find(item=>item.id===target.dataset.entryDelete);if(!item)return;
            if(!confirm('@'+item.username+' için “'+item.title+'” kaldırılacak.'))return;
            target.disabled=true;try{await onSaved(await call('entry-remove',{id:item.id}));}finally{target.disabled=false;}
        }
    }
    function getDialog(){
        if(!dialog){dialog=document.createElement('dialog');dialog.id='entryVideoEditor';dialog.className='entry-video-dialog';document.getElementById('workspaceRoot').append(dialog);
            dialog.addEventListener('close',()=>{dialog.replaceChildren();source=null;});
            dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});}
        return dialog;
    }
    function close(){if(!busy&&dialog?.open)dialog.close();}
    function preview(id){
        const item=snapshot.entryVideos.find(item=>item.id===id);if(!item)return;
        const modal=getDialog();modal.innerHTML=`<header><div><small>ÖZEL GİRİŞ VİDEOSU</small><h2>@${esc(item.username)}</h2></div><button type="button" class="workspace-icon" data-entry-close title="Kapat" aria-label="Kapat">${icon('x')}</button></header><div class="entry-watch"><iframe src="${esc(previewURL(item.previewUrl))}" allow="autoplay" title="${esc(item.title)}"></iframe></div><footer><span>${esc(item.title)}</span><button type="button" class="workspace-button" data-entry-close>Kapat</button></footer>`;
        modal.onclick=event=>{if(event.target.closest('[data-entry-close]'))close();};modal.showModal();window.lucide?.createIcons();
    }
    function edit(id){
        const item=id?snapshot.entryVideos.find(item=>item.id===id):null;if(id&&!item)return;
        let sourceMode=item?.remote?'url':'file';
        source=item?{id:item.id,previewUrl:item.previewUrl,filename:item.filename,url:item.url||'',assetId:''}:null;
        const modal=getDialog();
        modal.innerHTML=`<form id="entryVideoForm"><header><div><small>ÖZEL GİRİŞ VİDEOSU</small><h2>${item?'Videoyu düzenle':'Video ekle'}</h2></div><button type="button" class="workspace-icon" data-entry-close title="Kapat" aria-label="Kapat">${icon('x')}</button></header>
            <div class="entry-editor-grid"><div class="entry-source-panel"><div class="entry-source-modes" role="group" aria-label="Video kaynağı"><button type="button" data-entry-source-mode="file" aria-pressed="${sourceMode==='file'}">${icon('folder-open')} Dosya</button><button type="button" data-entry-source-mode="url" aria-pressed="${sourceMode==='url'}">${icon('link')} HTTPS bağlantısı</button></div><div class="entry-video-surface" id="entrySourcePreview"></div><div class="entry-source-commands"><button type="button" class="workspace-button" id="entryPickFile">${icon('folder-open')} Video dosyası seç</button><span id="entrySourceFilename"></span></div><label id="entryUrlField">Video bağlantısı (HTTPS)<input name="url" type="url" spellcheck="false" placeholder="https://…/giris.mp4" value="${esc(item?.url||'')}"></label></div>
            <div class="entry-rule-fields"><label>TikTok kullanıcı adı<input name="username" required maxlength="65" autocomplete="off" spellcheck="false" placeholder="@kullaniciadi" value="${esc(item?'@'+item.username:'')}"></label><label>Video adı<input name="title" maxlength="160" value="${esc(item?.title||'')}" placeholder="Özel giriş videosu"></label><label>Tetikleme koşulu<select name="trigger">${triggers.map(([value,name])=>`<option value="${value}" ${item?.trigger===value?'selected':''}>${name}</option>`).join('')}</select></label><div id="entryGiftField"><label>Tetikleyen hediye</label><input type="hidden" name="giftId" value="${esc(item?.giftId||'')}"><button type="button" class="workspace-button entry-gift-selector" id="entryGiftSelect">${giftMarkup(item?.giftId||'')}${icon('chevron-down')}</button></div>
            <label class="entry-check"><input name="oncePerLive" type="checkbox" ${item?.oncePerLive===false?'':'checked'}><span>Yayında bir kez oynat</span></label><label id="entryCooldownField">Tekrar aralığı (sn)<input name="cooldownSeconds" type="number" min="0" max="86400" step="1" value="${Number(item?.cooldownSeconds??30)}"></label><label>Ses seviyesi <output id="entryVolumeValue">${Math.round((item?.volume??.8)*100)}%</output><input name="volume" type="range" min="0" max="100" step="1" value="${Math.round((item?.volume??.8)*100)}"></label><div class="entry-toggle-line"><label class="entry-check"><input name="enabled" type="checkbox" ${item?.enabled===false?'':'checked'}><span>Etkin</span></label><label class="entry-check"><input name="fade" type="checkbox" ${item?.fade===false?'':'checked'}><span>Yumuşak geçiş</span></label></div></div></div>
            <p id="entryEditorError" role="alert" hidden></p><footer><button type="button" class="workspace-button" data-entry-close>Vazgeç</button><button type="submit" class="workspace-button primary">${icon('check')} Kaydet</button></footer></form>`;
        const form=document.getElementById('entryVideoForm'),f=form.elements;
        const error=text=>{const node=document.getElementById('entryEditorError');node.textContent=text;node.hidden=!text;};
        const showSource=()=>{
            const selected=source&&(sourceMode==='url'?source.url&&source.url===f.url.value.trim():!source.url);
            document.getElementById('entrySourcePreview').innerHTML=selected&&source.previewUrl?`<iframe src="${esc(previewURL(source.previewUrl))}" allow="autoplay" title="Özel giriş videosu ön izlemesi"></iframe>`:`<span class="entry-video-empty">${icon('film')}</span>`;
            document.getElementById('entryPickFile').hidden=sourceMode!=='file';
            document.getElementById('entryUrlField').hidden=sourceMode!=='url';f.url.disabled=sourceMode!=='url';
            document.getElementById('entrySourceFilename').textContent=selected?source.filename:sourceMode==='file'?'MP4 · WebM':'HTTPS video bağlantısı';
            modal.querySelectorAll('[data-entry-source-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.entrySourceMode===sourceMode)));window.lucide?.createIcons();
        };
        const condition=()=>{const entry=f.trigger.value==='entry';if(entry)f.oncePerLive.checked=true;f.oncePerLive.disabled=entry;document.getElementById('entryGiftField').hidden=f.trigger.value!=='gift';document.getElementById('entryCooldownField').hidden=f.oncePerLive.checked;};
        modal.onclick=event=>{if(event.target.closest('[data-entry-close]'))close();const mode=event.target.closest('[data-entry-source-mode]');if(mode&&!busy){sourceMode=mode.dataset.entrySourceMode;showSource();}};
        document.getElementById('entryGiftSelect').onclick=()=>chooseGift();
        f.giftId.onchange=()=>{document.getElementById('entryGiftSelect').innerHTML=giftMarkup(f.giftId.value)+icon('chevron-down');window.lucide?.createIcons();};
        f.trigger.onchange=condition;f.oncePerLive.onchange=condition;f.volume.oninput=()=>{document.getElementById('entryVolumeValue').textContent=f.volume.value+'%';};
        f.url.oninput=()=>{if(f.url.value!==source?.url){document.getElementById('entrySourcePreview').replaceChildren();document.getElementById('entrySourceFilename').textContent=f.url.value?'HTTPS video bağlantısı':'';}};
        document.getElementById('entryPickFile').onclick=async event=>{
            if(busy)return;busy=true;event.currentTarget.disabled=true;error('');
            try{const selected=await call('entry-pick');if(!selected.canceled){source={...selected,assetId:selected.id,url:''};f.url.value='';showSource();if(!f.title.value)f.title.value=selected.title;}}
            catch(problem){error(problem.message);}finally{busy=false;if(dialog.open)document.getElementById('entryPickFile').disabled=false;}
        };
        form.onsubmit=async event=>{
            event.preventDefault();if(busy||!form.reportValidity())return;
            if(sourceMode==='url'?!f.url.value.trim():!source||source.url){error('Bir video dosyası veya HTTPS video bağlantısı seçin.');return;}
            if(f.trigger.value==='gift'&&!f.giftId.value){error('Tetikleyen hediyeyi seçin.');return;}
            busy=true;error('');const submit=form.querySelector('[type="submit"]');submit.disabled=true;
            try{const next=await call('entry-save',{...(item?{id:item.id}:{}),username:f.username.value,title:f.title.value,trigger:f.trigger.value,giftId:f.giftId.value,oncePerLive:f.oncePerLive.checked,cooldownSeconds:Number(f.cooldownSeconds.value),volume:Number(f.volume.value)/100,enabled:f.enabled.checked,fade:f.fade.checked,...(sourceMode==='url'?{url:f.url.value.trim()}:source?.assetId?{assetId:source.assetId}:{})});busy=false;close();await onSaved(next);notify('Özel giriş videosu kaydedildi.');}
            catch(problem){busy=false;submit.disabled=false;error(problem.message);}
        };
        condition();showSource();modal.showModal();f.username.focus();window.lucide?.createIcons();
    }
    function update(data){snapshot=data;const input=document.getElementById('entryBroadcastUrl');if(input){input.value=data.entryVideoUrl||'';document.querySelector('[data-entry-copy]').disabled=!data.entryVideoUrl;}for(const item of data.entryVideos||[]){const node=document.querySelector('[data-entry-playback="'+item.id+'"]');if(node)node.textContent=playbackLabel(item);}connection();}
    return {render,update,close};
}};
