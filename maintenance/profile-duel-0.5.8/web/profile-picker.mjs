// Editor controls are local to the keyed game preview. The copied widget stays read-only.
export function mountProfilePicker({ render }) {
  const key = new URL(location.href).searchParams.get('key');
  if (!key) return { render() {}, destroy() {} };
  const endpoint = route => `./api/${route}?key=${encodeURIComponent(key)}`;
  let snapshot, side = 'right', group = 'gift', people = [], limit = 40, closed = false, pending = false, signature = '';
  const controls = [];
  const cards = new Map();
  let refreshing = false;
  // The editor can use the full control window while the broadcast stage stays compact.
  const previewFrame = window.frameElement;
  const dialogDocument = previewFrame?.matches('iframe[data-profile-editor]')
    ? previewFrame.ownerDocument
    : document;
  const dialog = dialogDocument.createElement('dialog');
  dialog.className = 'profile-dialog';
  dialog.innerHTML = `<div class="picker-heading"><h2 id="picker-title">Bir oyuncu seç</h2><button class="picker-close" aria-label="Seçim penceresini kapat">×</button></div><div class="picker-tabs" role="tablist" aria-label="Katılımcılar"><button role="tab" data-group="gift">Hediye atanlar</button><button role="tab" data-group="chat">Yazanlar</button><button role="tab" data-group="like">Beğenenler</button></div><input class="picker-search" aria-label="Profillerde ara" placeholder="Profil veya kullanıcı ara"><div class="picker-people"></div><p class="picker-status" role="status"></p>`;
  dialog.setAttribute('aria-labelledby', 'picker-title');
  const search = dialog.querySelector('input'), list = dialog.querySelector('.picker-people'), status = dialog.querySelector('.picker-status');
  const otherPlayer = state => (side === 'left' ? state?.opponent : state?.owner)?.username;
  async function select(username) {
    if (pending) return;
    pending = true;
    try {
      const response = await fetch(endpoint('live/player'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, username }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Profil seçilemedi.');
      render(data.snapshot); dialog.close();
    } catch (error) { status.textContent = error.message; }
    finally { pending = false; }
  }
  function makeCard(username) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-person';
    button.dataset.person = username;
    button.innerHTML = '<span class="picker-face"><span></span><img alt="" loading="lazy"></span><span class="picker-copy"><strong></strong><small></small></span><span class="picker-quality"></span>';
    button.querySelector('small').textContent = '@' + username;
    button.addEventListener('click', () => select(username));
    const photo = button.querySelector('img');
    const quality = button.querySelector('.picker-quality');
    const local = new URL(`./api/portrait?username=${encodeURIComponent(username)}`, location.href);
    let source, timer;
    const setQuality = () => {
      quality.textContent = button.disabled ? 'SEÇİLİ' : Math.min(photo.naturalWidth, photo.naturalHeight) >= 512 ? 'HD' : '';
    };
    return {
      button,
      update(profile, selected) {
        const name = profile.nickname || username;
        button.querySelector('strong').textContent = name;
        button.querySelector('.picker-face span').textContent = name[0].toLocaleUpperCase('tr');
        button.disabled = selected;
        setQuality();
        let next = new URL(local);
        try { if (profile.avatarUrl) next = new URL(profile.avatarUrl, location.href); } catch {}
        if (source === next.href) return;
        source = next.href;
        clearTimeout(timer);
        delete photo.dataset.ready;
        let retry = 0;
        let current = next;
        photo.onload = () => { photo.dataset.ready = ''; setQuality(); };
        photo.onerror = () => {
          delete photo.dataset.ready;
          setQuality();
          if (current.origin !== local.origin || current.pathname !== local.pathname) {
            current = new URL(local);
            photo.src = current.href;
            return;
          }
          const delays = [350, 750, 1500, 3000];
          if (retry === delays.length) return;
          timer = setTimeout(() => {
            current.searchParams.set('retry', String(retry));
            photo.src = current.href;
          }, delays[retry++]);
        };
        photo.src = source;
      },
      dispose() {
        clearTimeout(timer);
        photo.onload = photo.onerror = null;
        button.remove();
      },
    };
  }
  function rows() {
    for (const button of dialog.querySelectorAll('[data-group]')) button.setAttribute('aria-selected', String(button.dataset.group === group));
    const query = search.value.trim().toLocaleLowerCase('tr');
    const other = otherPlayer(snapshot);
    const found = people.filter(p => (group === 'gift' ? p.coins > 0 : group === 'chat' ? p.commented : p.totalLikes > 0)
      && `${p.nickname} ${p.username}`.toLocaleLowerCase('tr').includes(query));
    const visible = found.slice(0, limit);
    const nextSignature = JSON.stringify([side, group, query, limit, other, found.length,
      visible.map(({username, nickname, avatarUrl}) => [username, nickname, avatarUrl])]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const names = new Set(visible.map(profile => profile.username));
    for (const [username, card] of cards) {
      if (names.has(username)) continue;
      card.dispose();
      cards.delete(username);
    }
    const nodes = visible.map(profile => {
      let card = cards.get(profile.username);
      if (!card) {
        card = makeCard(profile.username);
        cards.set(profile.username, card);
      }
      card.update(profile, profile.username === other);
      return card.button;
    });
    if(!nodes.length){const empty=document.createElement('p');empty.className='picker-empty';empty.textContent=query?'Bu aramada profil bulunamadı.':group==='gift'?'Yayından hediye atanlar burada görünecek.':group==='chat'?'Yayından mesaj yazanlar burada görünecek.':'Yayından beğenenler burada görünecek.';nodes.push(empty);}
    if(found.length>limit){const more=document.createElement('button');more.className='picker-more';more.textContent='Daha fazla profil göster';more.onclick=()=>{limit+=40;rows();};nodes.push(more);}
    list.querySelector('.picker-empty, .picker-more')?.remove();
    nodes.forEach((node, index) => {
      const current = list.children[index];
      if (node !== current) list.insertBefore(node, current || null);
    });
    status.textContent=found.length+' profil · '+(side==='left'?'sol':'sağ')+' taraf';
  }
  async function refresh() {
    if (closed || refreshing) return;
    refreshing = true;
    try {
      const response=await fetch(endpoint('participants'),{cache:'no-store'});if(!response.ok)return;
      people=(await response.json()).participants;if(!closed&&dialog.open)rows();
    } catch {if(dialog.open)status.textContent='Katılımcı listesi yeniden bağlanıyor.';}
    finally { refreshing = false; }
  }
  function clearCards() {
    for (const card of cards.values()) card.dispose();
    cards.clear();
  }
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    clearCards();
    controls.find(item => item.side === side)?.pick.focus({ preventScroll: true });
  });
  async function open(slot) {
    side = slot;
    group = 'gift';
    limit = 40;
    signature = '';
    search.value = '';
    dialog.dataset.side = side;
    dialog.querySelector('h2').textContent = (side === 'left' ? 'Sol' : 'Sağ') + ' · Bir oyuncu seç';
    dialog.showModal();
    rows();
    list.scrollTop = 0;
    search.focus({ preventScroll: true });
    await refresh();
  }
  dialog.querySelector('.picker-close').onclick=()=>dialog.close();
  dialog.querySelector('.picker-tabs').onclick=event=>{const button=event.target.closest('[data-group]');if(button){group=button.dataset.group;limit=40;rows();list.scrollTop=0;}};
  search.oninput=()=>{limit=40;rows();list.scrollTop=0;};
  function update(state){
    const previousOther = otherPlayer(snapshot);
    snapshot=state;const locked=!['idle','finished'].includes(state?.phase);
    for(const item of controls){const selected=item.side==='left'?state?.owner:state?.opponent;item.pick.disabled=locked;item.remove.disabled=locked;item.remove.hidden=!selected;item.pick.classList.toggle('has-player',!!selected);item.pick.textContent=selected?'Profili değiştir':'Bir oyuncu seç';}
    if(dialog.open){if(locked)dialog.close();else if(previousOther!==otherPlayer(state))rows();}
  }
  void fetch(endpoint('meta')).then(response=>{
    if(!response.ok||closed)return;
    dialogDocument.body.append(dialog);
    for(const slot of ['left','right']){
      const card=document.querySelector('.duelist-'+slot),pick=document.createElement('button'),remove=document.createElement('button');
      pick.className='player-select';pick.type='button';pick.setAttribute('aria-haspopup','dialog');pick.setAttribute('aria-label',(slot==='left'?'Sol':'Sağ')+' oyuncu seç');pick.onclick=()=>open(slot);
      remove.className='player-remove';remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',(slot==='left'?'Sol':'Sağ')+' profili kaldır');
      remove.onclick=()=>{side=slot;void select(null);};card.append(pick,remove);controls.push({side:slot,pick,remove});
    }
    if(snapshot)update(snapshot);void refresh();
  }).catch(()=>{});
  const timer=setInterval(() => { if (dialog.open) void refresh(); }, 1500);
  return {render:update,destroy(){closed=true;clearInterval(timer);clearCards();dialog.remove();for(const item of controls){item.pick.remove();item.remove.remove();}}};
}
