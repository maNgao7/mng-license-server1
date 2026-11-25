function initials(profile, fallback) {
  const label = String(profile?.nickname || profile?.username || fallback).trim();
  return [...label][0]?.toLocaleUpperCase('tr-TR') || fallback;
}

function formatTime(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const winnerRevealMs = 3000;
let victoryArtId = 0;

function victoryArt() {
  const id = `duel-victory-${++victoryArtId}`;
  const wing = mirrored => `<g transform="${mirrored ? 'translate(448 113) scale(-1 1)' : 'translate(352 113)'}">
    <g class="winner-wing">
      <g class="wing-flight">
        <use href="#${id}-feathers"/>
        <use href="#${id}-veins"/>
      </g>
      <use href="#${id}-filigree"/>
    </g>
  </g>`;
  const sparks = [
    [75, 106], [104, 65], [129, 141], [166, 37], [181, 168], [216, 78], [228, 188],
    [262, 28], [281, 145], [308, 60], [492, 60], [519, 145], [538, 28], [572, 188],
    [584, 78], [619, 168], [634, 37], [671, 141], [696, 65], [725, 106],
  ].map(([x, y], index) => `<g transform="translate(${x} ${y}) scale(${[.56, .8, .65, 1][index % 4]})">
    <use class="winner-spark" href="#${id}-spark"
      style="--drift-x:${Math.round((x - 400) * .13)}px;--drift-y:${Math.round((y - 111) * .18)}px;--spark-delay:${index % 5 * 65}ms"/>
  </g>`).join('');

  return `<svg class="winner-art" viewBox="0 0 800 240" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}-metal" gradientUnits="userSpaceOnUse" x1="-248" y1="-73" x2="-13" y2="43">
        <stop stop-color="#fff4bf"/><stop offset=".25" stop-color="#eaaa49"/>
        <stop offset=".46" stop-color="#80400f"/><stop offset=".61" stop-color="#f5ca71"/>
        <stop offset=".8" stop-color="#b77324"/><stop offset="1" stop-color="#4d1e0b"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x2=".85" y2="1">
        <stop stop-color="#fff7c8"/><stop offset=".42" stop-color="#f2be60"/>
        <stop offset="1" stop-color="#8f4b1e"/>
      </linearGradient>
      <radialGradient id="${id}-rays" gradientUnits="userSpaceOnUse" cx="400" cy="111" r="332">
        <stop stop-color="#fff6be" stop-opacity=".88"/>
        <stop offset=".45" stop-color="#f0ac49" stop-opacity=".37"/>
        <stop offset="1" stop-color="#f0ac49" stop-opacity="0"/>
      </radialGradient>
      <g id="${id}-feathers" fill="url(#${id}-metal)" stroke="url(#${id}-rim)" stroke-width="1.25" stroke-linejoin="round">
        <path d="M-5 9C-78-12-148-46-259-83c41 49 98 66 184 86Z"/>
        <path d="M-8 13C-88 4-162-34-247-55c45 42 106 61 171 66Z"/>
        <path d="M-11 18C-94 19-176-19-234-31c38 35 91 51 160 52Z"/>
        <path d="M-14 24C-98 31-171 2-214-5c35 31 81 41 140 35Z"/>
        <path d="M-17 28C-96 44-152 23-192 17c27 28 71 36 125 22Z"/>
        <path d="M-19 32C-89 55-129 42-166 39c26 23 63 25 107 9Z"/>
        <path d="M-19 37C-65 59-99 56-137 56c29 19 57 13 88-3Z"/>
        <path d="M-18 41C-50 63-75 68-106 70c23 13 49 6 71-12Z"/>
      </g>
      <path id="${id}-veins" d="M-242-72c45 33 110 50 152 68m-141-44c47 28 96 43 136 51m-124-26c32 20 78 35 111 38m-90-13c25 15 56 20 81 23m-60-1 48 12m-22 9 27 3m-2 12 25-3m4 15 23-6" fill="none" stroke="#fff0b2" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/>
      <g id="${id}-filigree">
        <path d="M2 12C-32-28-83-35-124-41c26 18 49 29 73 38C-82-7-111-9-140-16c19 17 53 31 82 33-16 6-37 11-57 12 29 12 65 9 88-3 10 1 17 3 25 7Z"
          fill="#412218" stroke="url(#${id}-rim)" stroke-width="1.5"/>
        <path d="M-126-34C-79-24-51-19-34-5s11 30-4 29c-13-1-15-13-7-17 7-4 13 4 9 7m-86-24c21 11 44 16 67 19m-45 20c18-1 30-6 46-12m-7-35c-14 1-21-8-24-16"
          fill="none" stroke="#f8cc79" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M-62 17c-3-7-10-12-9-22 3 3 6 6 10 6-1-6 1-10 4-14 2 4 4 8 2 14 5-2 7-4 10-8 0 9-5 15-13 20l-3 9-3-1Z"
          fill="#ffdb86" stroke="#a35429" stroke-width=".8"/>
        <path d="m-14-8 12 15-12 15-12-15Z" fill="#a44b37" stroke="#ffe3a0" stroke-width="2"/>
        <path d="m-14-4 5 9-5 5-5-5Z" fill="#ffdbaa"/>
      </g>
      <path id="${id}-spark" d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4Z"/>
    </defs>
    <g class="winner-rays" fill="url(#${id}-rays)">
      <path d="M400 111 91 21l61 6Zm0 0L26 86l43 16Zm0 0L11 145l83-7Zm0 0L64 202l69-11Zm0 0L172 238l49-9Zm0 0L258 0l25 4Zm0 0L369 0h17Zm0 0L431 0h-17Zm0 0L542 0l-25 4Zm0 0L709 21l-61 6Zm0 0L774 86l-43 16Zm0 0L789 145l-83-7Zm0 0L736 202l-69-11Zm0 0L628 238l-49-9Z"/>
    </g>
    <g fill="none" stroke="url(#${id}-rim)">
      <path opacity=".5" d="M207 57h105l21-18 37-1m60 0 37 1 21 18h105M117 173h164l26 23h48m90 0h48l26-23h164"/>
      <path opacity=".45" d="M325 113a75 75 0 0 1 150 0m0 0a75 75 0 0 1-150 0" stroke-dasharray="1 4"/>
      <circle opacity=".35" cx="400" cy="113" r="68"/>
      <path opacity=".8" d="m113 173 4-4 4 4-4 4Zm566 0 4-4 4 4-4 4Z"/>
    </g>
    ${wing(false)}${wing(true)}
    <g class="winner-sparks">${sparks}</g>
  </svg>`;
}

export function mountDuelWidget(root = document, { localPortraits = true } = {}) {
  const stage = root.matches?.('.duel-stage') ? root : root.querySelector('.duel-stage');
  if (!stage) throw new TypeError('Teke Tek Profil widget markup is missing.');
  const bar=document.createElement('div');bar.className='duel-balance';
  bar.setAttribute('aria-label','Canlı puan dengesi');
  bar.innerHTML='<strong class="balance-left">0</strong><span class="balance-rail" aria-hidden="true"><i></i></span><strong class="balance-right">0</strong>';
  stage.prepend(bar);
  const railFill = bar.querySelector('.balance-rail i');
  const query = selector => stage.querySelector(selector);
  const elements = {
    stage,
    timer: query('#timer'), phase: query('#phase'),
    left: {
      avatar: query('#left-avatar'), fallback: query('#left-fallback'),
      name: query('#left-name'), handle: query('#left-handle'),
      score: query('#left-score'), track: query('#left-track'), card: query('.duelist-left'),
      gift: query('#left-gift'),
    },
    right: {
      avatar: query('#right-avatar'), fallback: query('#right-fallback'),
      name: query('#right-name'), handle: query('#right-handle'),
      score: query('#right-score'), track: query('#right-track'), card: query('.duelist-right'),
      gift: query('#right-gift'),
    },
    flash: query('#gift-flash'),
  };
    if (Object.values(elements).some(value => !value) || Object.values(elements.left).some(value => !value)
    || Object.values(elements.right).some(value => !value)) {
    throw new TypeError('Teke Tek Profil widget markup is incomplete.');
  }

  let latest = null;
  let lastActivity = '';
  let snapshotReceivedAt = 0;
  let flashTimer;
  let winnerTimer;
  let destroyed = false;
  const portraitRetries = new Map();
  const winnerReveal = document.createElement('div');
  winnerReveal.className = 'winner-reveal';
  winnerReveal.hidden = true;
  stage.style.setProperty('--victory-duration', `${winnerRevealMs}ms`);
  winnerReveal.innerHTML = `${victoryArt()}
    <div class="winner-card" role="status">
      <span class="winner-label">
        <svg viewBox="0 0 32 24" aria-hidden="true" focusable="false">
          <path d="M16 2A10 10 0 1 0 23 16 8 8 0 0 1 16 2Zm9 1 1.3 3.5H30l-2.9 2.2 1.1 3.5L25 10l-3.2 2.2 1.1-3.5L20 6.5h3.7Z"/>
        </svg>
        KAZANAN
      </span>
      <div class="winner-portrait"><img class="winner-avatar" alt="" hidden><span class="winner-fallback"></span></div>
      <strong class="winner-name"></strong><span class="winner-handle"></span>
    </div>`;
  stage.append(winnerReveal);
  const winnerPortrait = {
    name: winnerReveal.querySelector('.winner-name'),
    handle: winnerReveal.querySelector('.winner-handle'),
    avatar: winnerReveal.querySelector('img'),
    fallback: winnerReveal.querySelector('.winner-fallback'),
  };

  function setProfile(side, profile, fallbackName, fallbackLetter) {
    side.name.textContent = profile?.nickname || profile?.username || fallbackName;
    side.handle.textContent = profile?.username ? `@${profile.username}` : '';
    side.fallback.textContent = initials(profile, fallbackLetter);
    const localUrl = localPortraits && profile?.username ? `./api/portrait?username=${encodeURIComponent(profile.username)}` : '';
    const url = profile?.avatarUrl || localUrl;
    let resolvedUrl = '';
    try { if (url) resolvedUrl = new URL(url, location.href).href; } catch {}
    const avatar = side.avatar;
    if (resolvedUrl && avatar.dataset.original === resolvedUrl) return;

    clearTimeout(portraitRetries.get(side)?.timer);
    portraitRetries.delete(side);
    avatar.hidden = true;
    side.fallback.hidden = false;
    if (!resolvedUrl) {
      delete avatar.dataset.original;
      avatar.onload = avatar.onerror = null;
      avatar.removeAttribute('src');
      return;
    }

    avatar.dataset.original = resolvedUrl;
    const localSource = localUrl ? new URL(localUrl, location.href) : null;
    let portraitSource = resolvedUrl;
    const current = () => !destroyed && avatar.dataset.original === resolvedUrl;
    avatar.onerror = () => {
      if (!current()) return;
      avatar.hidden = true;
      side.fallback.hidden = false;
      const source = new URL(portraitSource);
      if (localSource && (source.origin !== localSource.origin || source.pathname !== localSource.pathname)) {
        portraitSource = localSource.href;
        avatar.src = portraitSource;
        return;
      }
      const retry = portraitRetries.get(side) || { count: 0, timer: null };
      if (retry.timer || retry.count >= 4) return;
      retry.count++;
      retry.timer = setTimeout(() => {
        retry.timer = null;
        if (!current()) return;
        source.searchParams.set('retry', String(retry.count));
        avatar.src = source.href;
      }, 2500);
      portraitRetries.set(side, retry);
    };
    avatar.onload = () => {
      if (!current() || !avatar.complete || !avatar.naturalWidth) return;
      avatar.hidden = false;
      side.fallback.hidden = true;
    };
    avatar.src = resolvedUrl;
  }

  function hideWinner() {
    if (winnerReveal.hidden) return;
    clearTimeout(winnerTimer);
    winnerReveal.hidden = true;
    stage.removeAttribute('data-celebrating');
    setProfile(winnerPortrait, null, '', '');
  }

  function renderWinner(snapshot, previous) {
    const username = snapshot.phase === 'finished' && snapshot.lastResult?.winner?.username;
    // The relay rewrites the side portraits for browser sources.
    const profile = username && [snapshot.owner, snapshot.opponent].find(player => player?.username === username);
    if (!profile) {
      hideWinner();
      return;
    }
    if (!winnerReveal.hidden) {
      setProfile(winnerPortrait, profile, '', '+');
      return;
    }
    const resultAge = Date.now() - snapshot.lastResult.endedAt;
    const watchedRound = previous?.phase === 'running' || previous?.phase === 'paused';
    if (previous?.phase === 'finished' || (!watchedRound && !(resultAge >= 0 && resultAge < winnerRevealMs))) return;

    setProfile(winnerPortrait, profile, '', '+');
    winnerReveal.hidden = false;
    stage.setAttribute('data-celebrating', '');
    winnerTimer = setTimeout(hideWinner, winnerRevealMs);
  }

  function clearFlash() {
    clearTimeout(flashTimer);
    elements.flash.textContent = '';
    elements.flash.classList.remove('bump');
  }

  function pulse(event) {
    if (!event?.eventId || event.eventId === lastActivity) return;
    lastActivity = event.eventId;
    const card = event.side === 'left' ? elements.left.card : elements.right.card;
    card.classList.remove('scored');
    elements.flash.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('scored');
    elements.flash.textContent = `${event.giftName || 'Hediye'} · +${Number(event.points) || 1}`;
    elements.flash.dataset.side = event.side;
    elements.flash.classList.add('bump');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(clearFlash, 650);
  }

  function render(snapshot) {
    if (!snapshot || destroyed) return;
    const previous = latest;
    latest = snapshot;
    snapshotReceivedAt = Date.now();
    const left = Number(snapshot.scores?.left) || 0;
    const right = Number(snapshot.scores?.right) || 0;
    const maxScore = Math.max(left, right);
    const share=left+right?left/(left+right):.5;
    railFill.style.width=`${Math.round(share*10000)/100}%`;
    bar.querySelector('.balance-rail').style.setProperty('--flame-share', railFill.style.width);
    bar.querySelector('.balance-left').textContent=String(left);
    bar.querySelector('.balance-right').textContent=String(right);
    stage.dataset.leader=left===right?'tie':left>right?'left':'right';
    setProfile(elements.left, snapshot.owner, 'Bir oyuncu seç', '+');
    setProfile(elements.right, snapshot.opponent, 'Bir oyuncu seç', '+');
    const labels = [[elements.left.gift, snapshot.giftConfig?.roseGiftLabel || 'Gül'], [elements.right.gift, snapshot.giftConfig?.tiktokGiftLabel || 'Hediye']];
    for (const [chip, label] of labels) {
      const image = chip.querySelector('img');
      chip.querySelector('span').textContent = label;
      chip.setAttribute('aria-label',label);
      const activity = snapshot.activity?.find(item => item.side === (chip.id === 'left-gift' ? 'left' : 'right') && item.giftImage)?.giftImage;
      const configured = chip.id === 'left-gift' ? snapshot.giftConfig?.roseGiftImage : snapshot.giftConfig?.tiktokGiftImage;
      const source = activity || configured || (chip.id === 'left-gift' ? './gifts/5655.png' : './gifts/5269.png');
      if (source) { image.src = source; image.hidden = false; }
      else { image.removeAttribute('src'); image.hidden = true; }
    }
    for (const [side, value] of [[elements.left, left], [elements.right, right]]) {
      side.score.textContent = String(value);
      side.track.style.width = `${Math.max(0, Math.min(100, maxScore ? (value / maxScore) * 100 : 0))}%`;
    }
    elements.timer.textContent = formatTime(snapshot.remainingMs ?? 0);
    const phases = { idle: 'HAZIR', running: 'CANLI', paused: 'DURAKLATILDI', finished: 'SÜRE BİTTİ' };
    elements.phase.textContent = phases[snapshot.phase] || 'HAZIR';
    if (snapshot.phase === 'finished' && snapshot.lastResult) {
      const result = snapshot.lastResult;
      elements.phase.textContent = result.winner ? 'YENİ RAKİP' : 'BERABERE · YENİ TUR BEKLENİYOR';
    }
    elements.stage.dataset.phase = snapshot.phase || 'idle';
    renderWinner(snapshot, previous);
    if (snapshot.phase === 'running') pulse(snapshot.activity?.[0]);
    else clearFlash();
  }

  const timer = setInterval(() => {
    if (!latest) return;
    const elapsed = latest.phase === 'running' ? Date.now() - snapshotReceivedAt : 0;
    elements.timer.textContent = formatTime((latest.remainingMs ?? 0) - elapsed);
  }, 200);

  return {
    render,
    destroy() {
      destroyed = true;
      clearInterval(timer);
      clearFlash();
      hideWinner();
      for (const retry of portraitRetries.values()) clearTimeout(retry.timer);
      portraitRetries.clear();
      winnerReveal.remove();
      stage.style.removeProperty('--victory-duration');
    },
  };
}
