'use strict';

(() => {
  const api = window.hediyeBox;
  const embedded = window.parent !== window;
  document.body.classList.toggle('controls-only',api?.controlsOnly===true);
  const byId = id => document.getElementById(id);
  const panel = byId('control-panel');
  const optionsPanel = byId('game-options');
  let optionsDirty=false;
  const usernameInput = byId('username');
  const phases = new Set(['loading', 'waiting', 'fighting', 'finished', 'error']);
  const pending = new Set();
  const liveLabels = {
    connected: 'Yayın bağlı.', connecting: 'Yayına bağlanıyor…',
    reconnecting: 'Yeniden bağlanıyor…', waiting: 'Yayın bekleniyor.',
    disconnected: 'Yayın bağlı değil.', idle: 'Yayın bağlı değil.',
    offline: 'Yayın çevrimdışı.', ended: 'Yayın sona erdi.', error: 'Yayın bağlantı hatası.',
  };
  let state = null;
  let revision = 0;
  let readId = 0;
  const showCurrentChannel = window.bindChannelField(usernameInput);
  let actionError = '';
  let bridgeError = '';
  let subscriptionError = '';
  let unsubscribe, unsubscribeView;
  let disposed = false;
  let draftSettings = null;
  let settingsDirty = false;
  let catalog = null;
  let catalogError = '';
  let catalogRevision = 0;
  let queueSignature = '';
  let queuePage = 0;
  const ringDisplay = window.createRingside?.(byId('ringside'));
  let audioBusy = false;
  let unlockBusy = false;
  const soundIds = new Set();
  const queuedSounds = new Map();
  const giftFields = { participation: 'participationGiftId', left: 'punchGiftIdLeft', right: 'punchGiftIdRight' };
  const giftById = new Map();
  const numberFormat = new Intl.NumberFormat('tr-TR');

  const text = value => typeof value === 'string' ? value.trim() : '';
  const username = value => text(value).replace(/^@/, '').toLowerCase();
  const errorText = error => text(error?.message) || text(error) || 'İşlem tamamlanamadı. Yeniden deneyin.';
  const giftId = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : /^\d+$/.test(text(value)) ? text(value) : '';
  const coins = value => Number.isSafeInteger(value) && value >= 0 ? numberFormat.format(value) : '—';
  const settingsKey = value => value ? JSON.stringify([value.participationMode, value.participationGiftId,
    value.punchGiftIdLeft, value.punchGiftIdRight, value.punchSource, value.likeThreshold, value.likePunchCount, value.followJoin, value.likeJoin, value.likeJoinThreshold,value.likeDamage,value.giftDamage]) : '';
  const validDamage=n=>Number.isInteger(n)&&n>=1&&n<=100;
  const validPunchCount=n=>Number.isInteger(n)&&n>=1&&n<=100;
  const validThreshold = n => Number.isSafeInteger(n) && n >= 1;
  const validSettings = value => value && ['both', 'chat', 'gift'].includes(value.participationMode) && giftId(value.participationGiftId)
    && ['gift', 'like', 'all'].includes(value.punchSource) && validThreshold(value.likeThreshold) && validPunchCount(value.likePunchCount) && validThreshold(value.likeJoinThreshold)
    && [value.likeDamage,...Object.values(value.giftDamage)].every(validDamage);
  const profileName = value => text(value?.nickname) || (text(value?.uniqueId) ? `@${username(value.uniqueId)}` : text(value?.userId));
  const profileHandle = profile => text(profile?.uniqueId) ? '@'+username(profile.uniqueId) : profileName(profile);
  const validHead = head => head?.visible === true && [head.x, head.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
  const editing = element => element instanceof Element && (element.isContentEditable || element.closest('input, textarea, select, [role="textbox"]'));

  const layoutKey = 'hediyeBox.spectator.layout.v1';
  function readLayout() {
    try { return JSON.parse(localStorage.getItem(layoutKey)) || {}; }
    catch { return {}; }
  }
  let layout = readLayout();
  function listOptions(list) {
    const showKey = list === 'queue' ? 'showQueue' : 'showStandings';
    const scaleKey = list + 'Scale';
    const options = { ...state?.gameOptions, ...layout };
    const size = options[scaleKey];
    return {
      visible: options[showKey] !== false,
      scale: Number.isFinite(size) ? Math.min(140, Math.max(60, size)) : 100,
    };
  }
  function renderLayout() {
    for (const list of ['standings', 'queue']) {
      const { visible, scale } = listOptions(list);
      byId('show-' + list).checked = visible;
      byId(list + '-scale').value = scale;
      byId(list + '-percent').textContent = scale + '%';
      document.body.style.setProperty('--' + list + '-scale', String(scale / 100));
    }
  }
  function changeLayout(list) {
    layout = { ...layout, [list === 'queue' ? 'showQueue' : 'showStandings']: byId('show-' + list).checked,
      [list + 'Scale']: byId(list + '-scale').valueAsNumber };
    try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch { /* Session settings still apply. */ }
    render();
  }
  for (const list of ['standings', 'queue']) {
    for(const [suffix,delta] of [['smaller',-10],['larger',10]]) {
      byId(list+'-'+suffix).addEventListener('click',()=>{
        const slider=byId(list+'-scale');
        slider.value=String(Math.max(60,Math.min(140,listOptions(list).scale+delta)));
        slider.dispatchEvent(new Event('input'));
        slider.dispatchEvent(new Event('change'));
      });
    }
    byId('show-' + list).addEventListener('change', () => changeLayout(list));
    byId(list + '-scale').addEventListener('input', () => changeLayout(list));
    for (const id of ['show-' + list, list + '-scale']) {
      byId(id).addEventListener('change', () => {
        const key = id.endsWith('-scale') ? list + 'Scale' : list === 'queue' ? 'showQueue' : 'showStandings';
        if (Object.hasOwn(state?.gameOptions || {}, key)) {
          api.configureGameOptions({ [key]: layout[key] }).catch(error => { actionError = errorText(error); render(); });
        }
      });
    }
  }
  window.addEventListener('storage', event => {
    if (event.key === layoutKey || event.key === null) { layout = readLayout(); render(); }
  });

  function renderCollapsedLists(){
    for(const list of ['standings','queue']){
      const collapsed=state?.gameOptions?.[list+'Collapsed']===true;
      const root=byId(list==='queue'?'audience-queue':list);
      root.classList.toggle('list-collapsed',collapsed);
      const button=byId(list+'-minimize');
      button.textContent=collapsed?'□':'−';
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',(list==='queue'?'Sıradakiler':'Kazananlar')+' listesini '+(collapsed?'geri aç':'küçült'));
    }
  }
  for(const list of ['standings','queue'])byId(list+'-minimize').addEventListener('click',()=>{
    void action('list-'+list,'configureGameOptions',{[list+'Collapsed']:state?.gameOptions?.[list+'Collapsed']!==true});
  });
  let linksRequest = 0, linkedLiveChannel = '';
  async function loadWidgetLinks(refresh=false) {
    const request = ++linksRequest;
    const available = typeof api?.getWidgetLinks === 'function';
    byId('refresh-links').disabled = true;
    const buttons = byId('widget-links').querySelectorAll('[data-copy]');
    for (const button of buttons) {
      const field = byId('widget-' + button.dataset.copy);
      field.value = '';
      field.placeholder = available ? 'Yükleniyor…' : 'Kullanılamıyor';
      button.disabled = true;
    }
    let status = '';
    let links;
    try { if (available) links = await api.getWidgetLinks({username:username(state?.live?.status==='connected'?state.live.username:usernameInput.value),refresh:refresh===true}); }
    catch (error) { status = errorText(error); }
    if (disposed || request !== linksRequest) return;
    for (const button of buttons) {
      const field = byId('widget-' + button.dataset.copy);
      field.value = text(links?.[button.dataset.copy]);
      field.placeholder = 'Kullanılamıyor';
      button.disabled = !field.value;
    }
    byId('refresh-links').disabled = !available;
    message('link-status', status || ([...buttons].every(button => button.disabled) ? 'Widget bağlantıları kullanılamıyor.' : 'HTTPS yayın bağlantıları hazır.'));
  }
  byId('refresh-links').addEventListener('click', ()=>loadWidgetLinks(true));
  byId('widget-links').addEventListener('click', async event => {
    const button = event.target.closest('button[data-copy]');
    if (!button || button.disabled) return;
    const field = byId('widget-' + button.dataset.copy);
    try {
      await api.copyWidgetLink(button.dataset.copy);
      message('link-status', 'Bağlantı kopyalandı.');
    } catch (error) {
      field.focus();
      field.select();
      message('link-status', errorText(error)+' Seçili bağlantıyı Ctrl+C ile de kopyalayabilirsiniz.');
    }
  });

  const confirmReset = byId('reset-confirmation');
  byId('reset-standings').addEventListener('click', () => {
    confirmReset.hidden = false;
    byId('cancel-reset').focus();
    message('reset-status', '');
  });
  byId('cancel-reset').addEventListener('click', () => {
    confirmReset.hidden = true;
    byId('reset-standings').focus();
  });
  byId('confirm-reset').addEventListener('click', async () => {
    if (panel.hidden || confirmReset.hidden || pending.has('reset')) return;
    confirmReset.hidden = true;
    if (await action('reset', 'resetStandings')) message('reset-status', 'Galibiyetler sıfırlandı.');
    if (!panel.hidden) byId('reset-standings').focus();
  });

  function normalizedSettings(value) {
    if (!value || !['both', 'chat', 'gift'].includes(value.participationMode) || !giftId(value.participationGiftId)) return null;
    return { participationMode: value.participationMode, participationGiftId: giftId(value.participationGiftId),
      punchGiftIdLeft: giftId(value.punchGiftIdLeft) || giftId(value.punchGiftId),
      punchGiftIdRight: giftId(value.punchGiftIdRight) || giftId(value.punchGiftId),
      punchSource: ['gift','like','all'].includes(value.punchSource)?value.punchSource:['chat','both'].includes(value.punchSource)?'gift':'all', likeThreshold: value.likeThreshold ?? 100, likePunchCount: value.likePunchCount ?? 2,
      followJoin:value.followJoin===true,likeJoin:value.likeJoin===true,likeJoinThreshold:value.likeJoinThreshold??1,
      likeDamage:value.likeDamage??15,giftDamage:{...value.giftDamage} };
  }

  function imageUrl(value) {
    let source = text(value);
    if (!source) return '';
    if (/^[a-z]:[\\/]/i.test(source)) source = `file:///${source.replaceAll('\\', '/')}`;
    if (source.startsWith('/catalog-assets/')) source = `../../public${source}`;
    try {
      const url = new URL(source, document.baseURI);
      return !url.username && !url.password && (['https:', 'file:'].includes(url.protocol) || (url.protocol === 'http:' && url.origin === location.origin)) ? url.href : '';
    } catch { return ''; }
  }

  function setImage(element, source) {
    const url = imageUrl(source);
    if (element.dataset.source === url) return;
    element.dataset.source = url;
    element.hidden = !url;
    if (url) element.src = url;
    else element.removeAttribute('src');
    element.onerror = () => { element.hidden = true; };
  }

  function portraitUrls(profile) {
    return [...new Set([profile?.portrait,profile?.profilePictureUrl,...(profile?.profilePictureUrls || [])]
      .filter(Boolean).map(imageUrl).filter(Boolean))];
  }

  function setPortrait(img, profile) {
    const urls=portraitUrls(profile);
    const signature=JSON.stringify(urls);
    if(img.dataset.portrait===signature)return;
    img.dataset.portrait=signature;
    let index=0;
    function next(){
      if(img.dataset.portrait!==signature)return;
      if(index>=urls.length){img.onerror=null;img.hidden=true;img.removeAttribute('src');return;}
      img.hidden=false;img.src=urls[index++];
    }
    img.onerror=next;
    next();
  }

  function renderQueue(phase) {
    const queue = Array.isArray(state?.audience?.queue) ? state.audience.queue : [];
    const list=byId('audience-queue'),container=panel.hidden?document.querySelector('.right-rail'):panel;
    if(container&&list.parentNode!==container)container.append(list);
    list.hidden = !optionsPanel.hidden || !queue.length || phase === 'loading' || phase === 'unknown' || (panel.hidden && !listOptions('queue').visible);
    queuePage=panel.hidden?0:Math.min(queuePage,Math.max(0,Math.ceil(queue.length/5)-1));
    const entries=queue.slice(queuePage*5,queuePage*5+5);
    const signature = JSON.stringify([queue.length, queuePage, panel.hidden, entries]);
    if (signature === queueSignature) return;
    queueSignature = signature;
    byId('queue-count').textContent = String(queue.length);
    const rows = entries.map(profile => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'queue-name';
      name.textContent = profileName(profile) || 'İsimsiz katılımcı';
      name.title = name.textContent;
      const amount = document.createElement('span');
      amount.className = 'queue-coins';
      amount.textContent = `${coins(profile?.fps??profile?.coins)} FPS`;
      const img=document.createElement('img');
      img.alt='';img.referrerPolicy='no-referrer';img.className='queue-portrait';
      setPortrait(img,profile);
      row.append(img,name,amount);
      if(!embedded&&typeof api.removeWaiting==='function'){
        const remove=document.createElement('button');
        remove.type='button';remove.className='queue-remove';remove.textContent='×';
        remove.title=name.textContent+' · sıradan çıkar';
        remove.setAttribute('aria-label',remove.title);
        remove.addEventListener('click',()=>void action('remove-'+profile.id,'removeWaiting',profile.id));
        row.append(remove);
      }
      return row;
    });
    byId('queue-list').replaceChildren(...rows);
    message('queue-more', queue.length > 5 ? `${queuePage*5+1}–${queuePage*5+entries.length} / ${queue.length}` : '');
    byId('queue-pages').hidden=panel.hidden||queue.length<=5;
    byId('queue-prev').disabled=queuePage===0;
    byId('queue-next').disabled=(queuePage+1)*5>=queue.length;
  }

  function renderGiftResults(kind) {
    const list = byId(`${kind}-results`);
    const query = text(byId(`${kind}-search`).value).toLocaleLowerCase('tr-TR');
    const selected = draftSettings?.[giftFields[kind]];
    const signature = JSON.stringify([catalogRevision, query, selected]);
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    const matches = (catalog || []).filter(gift => gift.search.includes(query));
    const rows = matches.slice(0, 40).map(gift => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gift-result';
      button.dataset.giftId = gift.id;
      button.setAttribute('aria-pressed', String(gift.id === selected));
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      setImage(img, gift.image);
      const label = document.createElement('span');
      label.textContent = gift.name;
      const detail = document.createElement('small');
      detail.textContent = `ID ${gift.id} · ${coins(gift.coins)} jeton`;
      label.append(detail);
      button.append(img, label);
      row.append(button);
      return row;
    });
    list.replaceChildren(...rows);
    byId(`${kind}-results-status`).textContent = !catalog ? 'Hediye kataloğu bekleniyor.' : matches.length > 40
      ? `${matches.length} hediye · İlk 40 gösteriliyor, aramayı daraltın.` : `${matches.length} hediye`;
  }

  function renderSettings() {
    const actual = normalizedSettings(state?.audience?.settings);
    if (validSettings(actual)) {
      if (settingsKey(actual) === settingsKey(draftSettings)) settingsDirty = false;
      if (!settingsDirty) draftSettings = { ...actual };
    }
    const available = !!validSettings(actual);
    byId('audience-fields').disabled = !available || pending.has('settings');
    byId('participation-mode').value = draftSettings?.participationMode || 'chat';
    byId('punch-source').value = draftSettings?.punchSource || 'gift';
    const usesLikes=['like','all'].includes(draftSettings?.punchSource);
    byId('like-settings').hidden = !usesLikes;
    const usesGifts=['gift','both','all'].includes(draftSettings?.punchSource);
    byId('corner-gifts').hidden = !usesGifts;
    if(draftSettings){
      for(const side of ['left','right','like']){
        const field=byId(side+'-damage');
        const amount=side==='like'?draftSettings[side+'Damage']:draftSettings.giftDamage[draftSettings[giftFields[side]]]??15;
        if(document.activeElement!==field)field.value=Number.isFinite(amount)?String(amount):'';
      }
    }
    if(draftSettings){
      byId('follow-join').checked=draftSettings.followJoin;byId('like-join').checked=draftSettings.likeJoin;
      if(document.activeElement!==byId('like-join-threshold'))byId('like-join-threshold').value=draftSettings.likeJoinThreshold;
      byId('like-join-threshold').disabled=!draftSettings.likeJoin;
    }
    for (const [id, key] of [['like-threshold','likeThreshold'],['like-punch-count','likePunchCount']]) {
      const field = byId(id);
      if (document.activeElement !== field) field.value = draftSettings?.[key] ?? '';
    }
    byId('like-help').textContent = 'Eşiğe her ulaşıldığında seçtiğin sayıda yumruk verilir; her yumruğun hasarı ayrı ayarlanır. Katılım ve sırada bekleme sırasında verilen beğeniler yumruğa sayılmaz. Maçta artan beğeniler aynı boksörün sonraki eşiğine eklenir.';
    byId('participation-gift-field').hidden = draftSettings?.participationMode !== 'gift';
    byId('participation-help').textContent = !available ? '' : draftSettings.participationMode === 'chat'
      ? 'İzleyiciler sohbette “katıl”, “katil”, “Katıl” veya “KATIL” yazarak sıraya girer.' : draftSettings.participationMode === 'gift'
        ? 'İzleyiciler seçilen katılım hediyesiyle sıraya girer.' : '“Katıl” yazan veya herhangi bir hediye gönderen boş köşeye geçer. İki köşe de doluysa sıraya girer. Bekleyenler toplam FPS puanına, eşitlikte katılım sırasına göre dövüşür.';
    for (const kind of Object.keys(giftFields)) {
      const id = draftSettings?.[giftFields[kind]];
      const gift = giftById.get(id);
      byId(`${kind}-selected`).textContent = gift ? `${gift.name} · ID ${id} · ${coins(gift.coins)} jeton` : id ? `ID ${id} · Katalogda doğrulanmadı`
        : available ? 'Hediye seçin' : 'Durum bekleniyor';
      byId(`${kind}-picker`).querySelector('summary').tabIndex = !available || pending.has('settings') ? -1 : 0;
      setImage(byId(`${kind}-image`), gift?.image);
      renderGiftResults(kind);
    }
    const selectedKnown = (!usesGifts || (giftById.has(draftSettings?.punchGiftIdLeft) && giftById.has(draftSettings?.punchGiftIdRight)))
      && (draftSettings?.participationMode !== 'gift' || giftById.has(draftSettings.participationGiftId));
    byId('save-audience').disabled = !available || !validSettings(draftSettings) || !settingsDirty || !selectedKnown || pending.has('settings');
    byId('save-audience').textContent = pending.has('settings') ? 'Kaydediliyor…' : 'Ayarları kaydet';
    byId('settings-status').textContent = !available ? 'Katılım ayarları bekleniyor.' : pending.has('settings') ? 'Ayarlar kaydediliyor…'
      : settingsDirty ? 'Değişiklikler henüz kaydedilmedi.' : 'Geçerli katılım ayarları gösteriliyor.';
    message('catalog-error', catalogError);
    byId('catalog-retry').hidden = !catalogError;
    byId('catalog-retry').disabled = pending.has('catalog');
  }

  async function loadCatalog() {
    if (disposed || pending.has('catalog') || catalog) return;
    pending.add('catalog');
    catalogError = '';
    try {
      if (typeof api?.getGiftCatalog !== 'function') throw new Error('Hediye kataloğu bağlantısı hazır değil.');
      const rows = await api.getGiftCatalog();
      if (disposed) return;
      if (!Array.isArray(rows)) throw new Error('Hediye kataloğu alınamadı.');
      giftById.clear();
      for (const row of rows) {
        const id = giftId(row?.id);
        if (!id || giftById.has(id)) continue;
        const name = text(row.name) || text(row.trName) || `ID ${id}`;
        giftById.set(id, { id, name, coins: row.coins,
          image: row.imageUrl || row.localPath || row.localpath || row.image || row.source || (row.file ? `../../public/catalog-assets/gift-images/${encodeURIComponent(row.file)}` : ''),
          search: `${id} ${name} ${text(row.trName)} ${Array.isArray(row.keywords) ? row.keywords.join(' ') : ''}`.toLocaleLowerCase('tr-TR') });
      }
      catalog = [...giftById.values()];
      catalogRevision++;
    } catch (error) { if (!disposed) catalogError = errorText(error); }
    finally { pending.delete('catalog'); if (!disposed) renderSettings(); }
  }

  function message(id, value) {
    const element = byId(id);
    element.textContent = value;
    element.hidden = !value;
  }

  // Points are ordered top-left, top-right, bottom-right, bottom-left on the native back.
  // Map a 160 x 48 label to that projected quad using a planar homography.
  function brandMatrix(quad) {
    if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(point => point && [point.x, point.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1))) return '';
    let winding = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-8 || (winding && Math.sign(cross) !== winding)) return '';
      winding = Math.sign(cross);
    }
    const points = quad.map(point => ({ x: point.x * window.innerWidth, y: point.y * window.innerHeight }));
    const [p0, p1, p2, p3] = points;
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
    let g = 0, h = 0;
    if (Math.abs(dx3) + Math.abs(dy3) > 1e-8) {
      const denominator = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(denominator) < 1e-8) return '';
      g = (dx3 * dy2 - dx2 * dy3) / denominator;
      h = (dx1 * dy3 - dx3 * dy1) / denominator;
    }
    if ([1 + g, 1 + h, 1 + g + h].some(value => value <= 1e-8)) return '';
    const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
    const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
    const matrix = [a / 160, d / 160, 0, g / 160, b / 48, e / 48, 0, h / 48, 0, 0, 1, 0, p0.x, p0.y, 0, 1];
    return matrix.every(Number.isFinite) ? `matrix3d(${matrix.join(',')})` : '';
  }

  function renderBrands() {
    if (disposed) return;
    const gameplay = ['waiting', 'fighting', 'finished'].includes(state?.spectator?.phase);
    for (const [index, side] of ['left', 'right'].entries()) {
      const backs = state?.spectator?.backs;
      const quad = Array.isArray(backs) ? backs[index] : backs?.[side];
      const transform = gameplay ? brandMatrix(quad) : '';
      const element = byId(`back-brand-${side}`);
      element.hidden = !transform;
      element.style.transform = transform;
    }
  }

  async function flushSounds() {
    const audio = window.hediyeBoxAudio;
    if (disposed || audioBusy || typeof audio?.play !== 'function') return;
    audioBusy = true;
    try {
      for (const [id, name] of queuedSounds) {
        if (disposed) break;
        // false can also mean the audio module's cooldown. Never replay that event later.
        queuedSounds.delete(id);
        if(name==='hit')void audio.play('contact',{eventId:id}).catch(()=>{});
        await audio.play(name);
        message('audio-status', '');
      }
    } catch { if (!disposed) message('audio-status', 'Sesi açmak için bir tuşa basın veya tıklayın.'); }
    finally { audioBusy = false; }
  }

  function receiveSound(sound) {
    const id = typeof sound?.id === 'string' ? text(sound.id) : Number.isSafeInteger(sound?.id) ? String(sound.id) : '';
    if (id && ['gong', 'knockout', 'hit'].includes(sound?.name) && !soundIds.has(id)) {
      soundIds.add(id);
      if (soundIds.size > 128) soundIds.delete(soundIds.values().next().value);
      if (!embedded) queuedSounds.set(id, sound.name);
      if(sound.name==='hit'&&[0,1].includes(sound.defender)){
        const heads=state?.spectator?.heads;
        const target=heads?.[sound.defender],other=heads?.[1-sound.defender];
        const right=validHead(target)?target.x>(validHead(other)?other.x:.5):sound.defender===1;
        const edge=byId(right?'impact-right':'impact-left');
        edge.getAnimations().forEach(animation=>animation.cancel());
        edge.animate([{opacity:.9},{opacity:.36,offset:.32},{opacity:0}],{duration:360,easing:'ease-out'});
        const damage=byId('damage-'+sound.defender);
        const bar=byId('health-'+sound.defender);
        bar.getAnimations().forEach(a=>a.cancel());
        bar.animate([{boxShadow:'0 0 0 3px #ffd9bf',backgroundColor:'#f56c59'},{boxShadow:'0 2px 4px #0009',backgroundColor:'#111821'}],{duration:420});
        if(Number.isFinite(sound.damage)&&sound.damage>0){
          damage.textContent='−'+Math.round(sound.damage);
          damage.getAnimations().forEach(a=>a.cancel());
          damage.animate([{opacity:1,transform:'translateY(0)'},{opacity:1,offset:.55},{opacity:0,transform:'translateY(-14px)'}],{duration:650});
        }
      }
      void flushSounds();
    }
  }

  async function unlockAudio() {
    const audio = window.hediyeBoxAudio;
    if (disposed || embedded || unlockBusy || !audio) return;
    unlockBusy = true;
    try {
      if (typeof audio.unlock === 'function') await audio.unlock();
      await flushSounds();
    } catch { /* A later user gesture can unlock audio without affecting the game. */ }
    finally { unlockBusy = false; }
  }

  const placedHeads=[null,null];
  // Bound portrait size with the visible fighter's distance and field of view.
  // Keep the head anchor fixed even when a camera cut changes scale immediately.
  function fighterScale(view, index) {
    const fighter = view?.fighters?.[index];
    if (!fighter || !view.position || !(view.fov > 0 && view.fov < Math.PI)) return 1;
    const distance = Math.hypot(...fighter.map((value, axis) => value - view.position[axis]));
    if (!Number.isFinite(distance)) return 1;
    const size = 4 / (Math.max(.01, distance) * Math.tan(view.fov / 2));
    return Math.round(Math.max(.55, Math.min(1, size)) * 40) / 40;
  }
  function placeFighters(spectator,audience,gameplay) {
    for (let i=0;i<2;i++) {
      const card=byId('participant-'+i), head=spectator?.heads?.[i];
      const profile=audience?.active?.[i===0?'left':'right'];
      card.hidden=!gameplay || !profileName(profile) || !validHead(head);
      if (card.hidden) {
        placedHeads[i]=null; card.style.translate='';
        continue;
      }
      const previous=placedHeads[i];
      if (!previous || Math.abs(head.x-previous.x)*innerWidth>=.75 || Math.abs(head.y-previous.y)*innerHeight>=.75) {
        card.style.translate=head.x*100+'vw '+head.y*100+'vh';
        placedHeads[i]=head;
      }
      card.style.setProperty('--fighter-scale', fighterScale(spectator.sceneView, i));
    }
    renderBrands();
    ringDisplay?.update(gameplay?spectator?.sceneView:null,audience?.queue,state?.gameOptions);
  }

  function renderFighters(spectator, audience, gameplay) {
    placeFighters(spectator,audience,gameplay);
    for (let index=0;index<2;index++) {
      const ratio=spectator?.health?.[index];
      const known=Number.isFinite(ratio) && ratio>=0 && ratio<=1;
      const bar=byId('health-'+index);
      const profile=audience?.active?.[index===0?'left':'right'];
      const name=profileName(profile);
      byId('profile-'+index+'-name').textContent=name;
      byId('profile-'+index+'-name').title=name;
      byId('handle-'+index).textContent=profileHandle(profile);
      setPortrait(byId('profile-'+index+'-image'),profile);
      bar.hidden=!known;
      const fill=byId('health-'+index+'-fill');
      fill.style.transform='scaleX('+(known?ratio:0)+')';
      fill.style.backgroundColor=known?'hsl('+ratio*120+' 70% 45%)':'';
      if (known) bar.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
      else bar.removeAttribute('aria-valuenow');
    }
  }

  let standingsKey='';
  function renderResult(gameplay){
    const result=state?.celebration;
    const banner=byId('winner');
    banner.hidden=!(gameplay && result);
    if(!banner.hidden){
      const label=profileHandle(result.fighter);
      byId('winner-name').textContent=label;
      byId('winner-initial').textContent=Array.from(label.replace(/^@/,'')).slice(0,1).join('').toLocaleUpperCase('tr');
      byId('winner-total').textContent='Galibiyet ×'+result.wins;
      setPortrait(byId('winner-image'),result.fighter);
    }
    const rows=state?.standings||[];
    byId('standings').hidden=!gameplay||!rows.length||(!embedded && state?.spectator?.panelKind==='settings')||!listOptions('standings').visible;
    const key=JSON.stringify(rows);
    if(key===standingsKey)return;
    standingsKey=key;
    byId('standings-list').replaceChildren(...rows.map(row=>{
      const line=document.createElement('li'), label=document.createElement('span'), score=document.createElement('b');
      label.textContent=label.title=row.label;score.textContent='×'+row.wins;score.title=row.wins+' galibiyet';
      line.append(label,score);return line;
    }));
  }
  function render() {
    const spectator = state?.spectator;
    const phase = phases.has(spectator?.phase) ? spectator.phase : 'unknown';
    document.body.dataset.phase = phase;
    byId('loading-screen').hidden = phase !== 'loading';
    const progress=state?.loadingProgress??5;
    byId('loading-progress').value=progress;
    byId('loading-label').textContent=progress>=100?'Ring hazır':progress>=65?'Ring ve göstergeler hazırlanıyor…':progress>=30?'Oyun açılıyor…':'Ring hazırlanıyor…';
    byId('waiting-hint').hidden = phase !== 'waiting' && phase !== 'finished';
    const gameplay = ['waiting', 'fighting', 'finished'].includes(phase);
    const countdown = state?.countdown;
    message('countdown', gameplay && Number.isInteger(countdown) && countdown >= 1 && countdown <= 5 ? String(countdown) : '');
    renderLayout();
    renderResult(gameplay);
    renderCollapsedLists();
    const audience = state?.audience;
    const entrants = [audience?.active?.left, audience?.active?.right].filter(Boolean).length;
    byId('opponent-wait').hidden = entrants !== 1 || !['waiting','finished'].includes(phase)
      || (!embedded && spectator?.panelOpen === true) || !byId('countdown').hidden || !byId('winner').hidden;
    byId('crosshair').hidden = !gameplay || !byId('countdown').hidden || !byId('opponent-wait').hidden;
    const ringStatus = phase==='fighting'?'Maç sürüyor':phase === 'finished' ? 'Maç bitti' : 'Ring hazır';
    const waitingForPlayers = phase === 'waiting' && entrants < 2;
    const nextMatch = state?.pAction === 'next';
    const startLabel = nextMatch ? 'Sonraki eşleşme' : entrants < 2 ? 'Katılımcı bekleniyor' : 'Maçı başlat';
    byId('start-key').hidden = !nextMatch && (waitingForPlayers||phase==='fighting');
    if (byId('ring-status').textContent !== ringStatus) byId('ring-status').textContent = ringStatus;
    byId('start-label').textContent = phase==='fighting'&&!nextMatch?'':startLabel;
    renderFighters(spectator, audience, gameplay);

    // The parent owns panel visibility and native mouse passthrough together.
    const wasOpen = !panel.hidden;
    panel.hidden = embedded || spectator?.panelOpen !== true || spectator.panelKind==='settings';
    const liveChannel=state?.live?.status==='connected'?username(state.live.username):'';
    if(!liveChannel)linkedLiveChannel='';
    if(!embedded&&liveChannel&&liveChannel!==linkedLiveChannel){linkedLiveChannel=liveChannel;void loadWidgetLinks();}
    const optionsWasHidden=optionsPanel.hidden;
    optionsPanel.hidden=embedded || !(spectator?.panelOpen&&spectator.panelKind==='settings');
    if (!panel.hidden && !wasOpen) {
      void loadWidgetLinks();
      message('reset-status', typeof api?.resetStandings !== 'function' ? 'Sıfırlama kullanılamıyor.' : '');
    }
    if (panel.hidden) confirmReset.hidden = true;
    byId('reset-standings').disabled = pending.has('reset') || typeof api?.resetStandings !== 'function';
    if(optionsPanel.hidden || optionsWasHidden)optionsDirty=false;
    if(!optionsPanel.hidden&&!optionsDirty&&state?.gameOptions){
      const opts=state.gameOptions;
      byId('game-volume').value=opts.gameVolume;
      byId('effects-volume').value=opts.effectsVolume;
      byId('scene-quality').value=opts.quality;
      byId('crowd-flashes').checked=opts.flashes;
      volumeLabels();
    }
    if(!optionsPanel.hidden&&optionsWasHidden){byId('options-status').textContent='';byId('game-volume').focus();}
    const cameraStatus = byId('camera-status');
    cameraStatus.hidden = !panel.hidden || !spectator?.camera?.ready;
    if (!cameraStatus.hidden) {
      const step = Math.round(spectator.camera.zoomSteps || 0);
      const mode = spectator.camera.mode === 'free' ? 'Serbest kamera' : spectator.camera.mode === 'follow' ? 'Yakın takip' : 'Ring kamerası';
      const label = `${mode} · ${step === 0 ? 'Normal mesafe' : `Yakınlaştırma ${step > 0 ? '+' : ''}${step}`}`;
      if (cameraStatus.getAttribute('aria-label') !== label) cameraStatus.setAttribute('aria-label', label);
    }
    if (wasOpen && panel.hidden && panel.contains(document.activeElement)) document.activeElement.blur();
    byId('panel-close').disabled = pending.has('panel');
    renderQueue(phase);
    renderSettings();
    if (!panel.hidden && !catalog && !catalogError) void loadCatalog();
    byId('camera-free').disabled = pending.has('camera') || typeof api?.setCamera !== 'function';
    byId('camera-ring').disabled = byId('camera-free').disabled;
    byId('camera-follow').disabled = pending.has('camera') || typeof api?.followTarget !== 'function';

    const live = state?.live;
    const status = text(live?.status).toLowerCase();
    const channel = username(live?.username);
    showCurrentChannel(channel);
    const liveMessage = text(live?.message) || liveLabels[status] || 'Yayın durumu bekleniyor.';
    byId('live-status').textContent = channel && !liveMessage.includes(`@${channel}`) ? `@${channel} · ${liveMessage}` : liveMessage;
    byId('live-status').dataset.status = status;
    const connecting = pending.has('connect') || status === 'connecting' || status === 'reconnecting';
    byId('connect-button').disabled = connecting;
    byId('connect-button').textContent = connecting ? 'Bağlanıyor…'
      : status === 'connected' && channel === username(usernameInput.value) ? 'Yeniden bağlan' : 'Bağlan';
    message('action-error', actionError);
    const gameError = text(spectator?.error) || (phase === 'error' ? 'Oyun açılamadı.' : '');
    message('overlay-error', [gameError, subscriptionError, bridgeError, panel.hidden ? actionError : ''].filter(Boolean).join(' '));
  }

  function acceptState(next) {
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Oyun durumu alınamadı.');
    state = next;
    if(next.gameOptions)window.hediyeBoxAudio?.setEffectsVolume?.(next.gameOptions.effectsVolume);
    bridgeError = '';
    render();
    receiveSound(next.sound);
  }

  async function refresh() {
    if (typeof api?.getState !== 'function') throw new Error('Oyun bağlantısı bulunamadı.');
    const requestedAtRevision = revision;
    const request = ++readId;
    try {
      const next = await api.getState();
      // A delayed initial read must never replace a newer pushed snapshot.
      if (!disposed && requestedAtRevision === revision && request === readId) acceptState(next);
    } catch (error) {
      if (!disposed && requestedAtRevision === revision && request === readId) throw error;
    }
  }

  async function action(group, method, ...args) {
    if (disposed || pending.has(group)) return false;
    pending.add(group);
    actionError = '';
    render();
    try {
      if (typeof api?.[method] !== 'function') throw new Error('Bu işlem için oyun bağlantısı hazır değil.');
      const result = await api[method](...args);
      if (disposed) return;
      if (result?.ok === false || result?.success === false) {
        throw new Error(text(result.error?.message) || text(result.error) || text(result.message) || 'İşlem kabul edilmedi.');
      }
      await refresh();
      return true;
    } catch (error) {
      if (!disposed) actionError = errorText(error);
      return false;
    } finally {
      pending.delete(group);
      if (!disposed) render();
    }
  }

  function setPanelOpen(open) {
    if (state?.spectator?.panelOpen === open) return;
    void action('panel', 'setPanelOpen', open);
  }

  function volumeLabels(){
    byId('game-level').textContent=byId('game-volume').value+'%';
    byId('effects-level').textContent=byId('effects-volume').value+'%';
  }
  byId('options-form').addEventListener('input',()=>{optionsDirty=true;volumeLabels();byId('options-status').textContent='';});
  byId('options-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const saved=await action('game-options','configureGameOptions',{gameVolume:byId('game-volume').valueAsNumber,
      effectsVolume:byId('effects-volume').valueAsNumber,quality:byId('scene-quality').value,
      flashes:byId('crowd-flashes').checked});
    if(saved){optionsDirty=false;byId('options-status').textContent='Ayarlar uygulandı.';render();}
  });
  byId('options-close').addEventListener('click',()=>setPanelOpen(false));
  for(const kind of ['like','left','right']){
    byId(kind+'-damage').addEventListener('input',event=>{
      if(!draftSettings)return;
      const value=event.currentTarget.valueAsNumber;
      if(kind==='like')draftSettings[kind+'Damage']=value;
      else draftSettings.giftDamage[draftSettings[giftFields[kind]]]=value;
      settingsDirty=true;renderSettings();
    });
  }

  for(const id of ['follow-join','like-join','like-join-threshold'])byId(id).addEventListener('input',()=>{
    if(!draftSettings)return;
    const key={'follow-join':'followJoin','like-join':'likeJoin','like-join-threshold':'likeJoinThreshold'}[id];
    draftSettings[key]=id==='like-join-threshold'?byId(id).valueAsNumber:byId(id).checked;
    settingsDirty=true;renderSettings();
  });
  byId('participation-mode').addEventListener('change', () => {
    if (!draftSettings || byId('audience-fields').disabled) return;
    draftSettings.participationMode = byId('participation-mode').value;
    settingsDirty = true;
    renderSettings();
  });
  byId('punch-source').addEventListener('change', event => {
    if (!draftSettings || byId('audience-fields').disabled) return;
    draftSettings.punchSource = event.currentTarget.value;
    settingsDirty = true;
    renderSettings();
  });
  for (const [id, key] of [['like-threshold','likeThreshold'],['like-punch-count','likePunchCount']]) byId(id).addEventListener('input', event => {
    if (!draftSettings || byId('audience-fields').disabled) return;
    draftSettings[key] = event.currentTarget.valueAsNumber;
    settingsDirty = true;
    renderSettings();
  });
  for (const kind of Object.keys(giftFields)) {
    byId(`${kind}-search`).addEventListener('input', () => renderGiftResults(kind));
    byId(`${kind}-results`).addEventListener('click', event => {
      const button = event.target.closest('button[data-gift-id]');
      if (!button || !draftSettings || byId('audience-fields').disabled || !giftById.has(button.dataset.giftId)) return;
      draftSettings[giftFields[kind]] = button.dataset.giftId;
      settingsDirty = true;
      byId(`${kind}-picker`).open = false;
      byId(`${kind}-picker`).querySelector('summary').focus();
      renderSettings();
    });
  }
  byId('catalog-retry').addEventListener('click', () => void loadCatalog());
  byId('audience-form').addEventListener('submit', event => {
    event.preventDefault();
    if (byId('save-audience').disabled || !validSettings(draftSettings)) return;
    // Clear the legacy shared override and chat punches when saving this UI's settings.
    void action('settings', 'configureAudience', { ...draftSettings, punchGiftId: '', chatPunches: false });
  });
  byId('camera-free').addEventListener('click', () => void action('camera', 'setCamera', 'free'));
  byId('camera-ring').addEventListener('click', () => void action('camera', 'setCamera', 'ring'));
  byId('camera-follow').addEventListener('click', () => void action('camera', 'followTarget'));

  byId('panel-close').addEventListener('click', () => setPanelOpen(false));
  byId('queue-prev').addEventListener('click',()=>{queuePage=Math.max(0,queuePage-1);renderQueue(state?.spectator?.phase);});
  byId('queue-next').addEventListener('click',()=>{queuePage++;renderQueue(state?.spectator?.phase);});
  usernameInput.addEventListener('input', () => {
    usernameInput.removeAttribute('aria-invalid');
    actionError = '';
    render();
  });
  byId('connect-form').addEventListener('submit', event => {
    event.preventDefault();
    if (byId('connect-button').disabled) return;
    const channel = username(usernameInput.value);
    if (!/^[a-z0-9_.]{1,64}$/.test(channel)) {
      actionError = 'Geçerli bir TikTok kullanıcı adı girin.';
      usernameInput.setAttribute('aria-invalid', 'true');
      usernameInput.focus();
      render();
      return;
    }
    usernameInput.value = channel;
    void action('connect', 'connect', channel);
  });

  document.addEventListener('keydown', event => {
    if (embedded) return;
    void unlockAudio();
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (state?.spectator?.panelOpen === true) setPanelOpen(false);
      else void action('panel','openGameOptions');
      return;
    }
    if (editing(document.activeElement) || editing(event.target)) return;
    if(!optionsPanel.hidden)return;
    const key = event.key.toLowerCase();
    if (key === 'b' && typeof state?.spectator?.panelOpen === 'boolean') {
      event.preventDefault();
      setPanelOpen(!state.spectator.panelOpen);
    } else if (key === 'p') {
      event.preventDefault();
      void action('start', 'startMatch');
    } else if (key === 'e') {
      event.preventDefault();
      void action('camera', 'followTarget');
    } else if (key === 'home') {
      event.preventDefault();
      void action('camera', 'setCamera', 'ring');
    } else if (key === 'f') {
      event.preventDefault();
      void action('camera', 'setCamera', 'free');
    }
  });
  // Space/Ctrl and held right mouse remain native movement/zoom controls.
  document.addEventListener('pointerdown', () => void unlockAudio(), { capture: true });
  window.addEventListener('resize', renderBrands);
  window.addEventListener('load', () => void flushSounds(), { once: true });

  render();
  try {
    if (typeof api?.onState !== 'function') throw new Error('Oyun durum bağlantısı bulunamadı.');
    unsubscribeView = api.onView?.(view => {
      if (disposed || !state?.spectator) return;
      Object.assign(state.spectator, view);
      // Apply the newest camera sample before the next browser paint. The queue
      // schedules its own draw for that same frame.
      placeFighters(state.spectator,state.audience,['waiting','fighting','finished'].includes(state.spectator.phase));
    });
    unsubscribe = api.onState(next => {
      if (disposed) return;
      revision++;
      try { acceptState(next); }
      catch (error) {
        state = null;
        bridgeError = errorText(error);
        render();
      }
    });
  } catch (error) { subscriptionError = errorText(error); render(); }
  void refresh().catch(error => {
    if (!disposed) { bridgeError = errorText(error); render(); }
  });
  window.addEventListener('beforeunload', () => {
    disposed = true;
    queuedSounds.clear();
    ringDisplay?.dispose();
    window.removeEventListener('resize', renderBrands);
    if (typeof unsubscribe === 'function') unsubscribe();
    unsubscribeView?.();
  }, { once: true });
})();
