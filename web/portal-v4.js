'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const catalog = JSON.parse(document.getElementById('publicGameCatalog').textContent);
  const games = catalog.games;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const search = document.getElementById('gameSearch');
  let category = '';
  const normalize = value => value.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  function filterGames() {
    let count = 0;
    for (const game of games) {
      const visible = (!category || game.category === category) && normalize([game.title,game.category,game.description].join(' ')).includes(normalize(search.value.trim()));
      document.querySelector(`[data-game="${game.id}"]`).hidden = !visible;
      if (visible) count++;
    }
    document.getElementById('catalogCount').textContent = `${count} oyun`;
    document.querySelector('.catalog-search-count').textContent = count;
    document.getElementById('catalogEmpty').hidden = Boolean(count);
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  }
  search.addEventListener('input', filterGames);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; filterGames(); }));
  document.getElementById('clearGameFilters').addEventListener('click', () => { category = ''; search.value = ''; filterGames(); search.focus(); });

  const dialog = document.createElement('dialog');
  dialog.className = 'portal-dialog';
  dialog.id = 'portalDetail';
  dialog.setAttribute('aria-labelledby','portalDialogTitle');
  document.body.append(dialog);
  let opener;
  function openDialog(content, source) {
    opener = source;
    dialog.innerHTML = `<button type="button" class="portal-dialog-close" aria-label="Kapat" autofocus>${icon('x')}</button>${content}`;
    window.lucide?.createIcons({root:dialog});
    dialog.showModal();
    document.documentElement.classList.add('portal-modal-open');
    dialog.querySelector('.portal-dialog-close').addEventListener('click', () => dialog.close());
  }
  dialog.addEventListener('close', () => { if (dialog.open) return; document.documentElement.classList.remove('portal-modal-open'); opener?.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  function openGame(id, source) {
    const game = games.find(game => game.id === id);
    if (!game) return;
    openDialog(`<div class="game-dialog-layout"><img class="game-dialog-art" src="/game-covers/${game.cover}-1000.webp" alt="${esc(game.title)} kapağı" width="1000" height="667"><div class="game-dialog-content"><span class="catalog-eyebrow">${esc(game.category)}</span><h2 id="portalDialogTitle">${esc(game.title)}</h2><p>${esc(game.description)}</p><ul>${game.features.map(feature => `<li>${icon('check')}${esc(feature)}</li>`).join('')}</ul><p class="game-dialog-requirement">${esc(game.requirements)}</p><a class="portal-command primary" href="/download/setup">${icon('download')} Launcher'ı indir</a></div></div>`, source);
  }
  document.querySelectorAll('[data-game-open]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.gameOpen,button)));
  const newsButton = document.createElement('button');
  newsButton.type = 'button';
  newsButton.className = 'portal-news-button';
  newsButton.setAttribute('aria-label','Yenilikler');
  newsButton.title = 'Yenilikler';
  newsButton.innerHTML = icon('bell');
  document.querySelector('.nav-actions').prepend(newsButton);
  try { newsButton.classList.toggle('is-read',localStorage.getItem('tikmng-website-news') === catalog.revision); } catch {}
  function openNews(source) {
    openDialog(`<div class="portal-news-content"><span class="catalog-eyebrow">TIKMNG'DE YENİLİKLER</span><h2 id="portalDialogTitle">15 oyun, yepyeni bir keşif alanı.</h2><p>Oyunların kendi kapaklarını, mekaniklerini ve kurulum gereksinimlerini bir arada keşfet. Launcher'daki hediye tasarım aracını webde de kullan.</p><div class="portal-news-list">${games.map(game => `<a href="#games" data-news-game="${game.id}"><img src="/game-covers/${game.cover}-500.webp" alt="" width="72" height="48" loading="lazy"><span>${esc(game.title)}<small>${esc(game.category)}${game.isNew ? ' · Yeni' : ''}</small></span></a>`).join('')}</div><a class="portal-command primary" href="/hediye-tasarimi">${icon('gift')} Hediye tasarımını aç</a></div>`,source);
    try { localStorage.setItem('tikmng-website-news',catalog.revision); newsButton.classList.add('is-read'); } catch {}
    dialog.querySelectorAll('[data-news-game]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault(); const id = link.dataset.newsGame; dialog.close(); openGame(id,source);
    }));
  }
  newsButton.addEventListener('click', () => openNews(newsButton));
  document.querySelectorAll('[data-news-open]').forEach(button => button.addEventListener('click', () => openNews(button)));
  // The catalogue is the next primary experience after the announcement band.
  const demo = document.querySelector('.portal-demo');
  demo.before(document.getElementById('games'));
  window.dispatchEvent(new Event('resize'));
  window.lucide?.createIcons();
});
