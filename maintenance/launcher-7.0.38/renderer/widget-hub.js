(() => {
    'use strict';
    const mounts = new WeakMap();
    const favoritesKey = 'tikmng.widget-hub.favorites.v1';
    let sequence = 0;
    const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const escapeHTML = value => text(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fold = value => text(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
    const categoryKinds = [
        ['pk', 'Canlı PK', 'Yayın', 'swords', ['pk', 'pkhub', 'canli pk']],
        ['score', 'Skor & sıralama', 'Yayın', 'trophy', ['topgifter', 'topliker', 'raconlist', 'score', 'ranking', 'rankings', 'skor', 'siralama']],
        ['jars', 'Kavanoz', 'Etkileşim', 'archive', ['jars', 'jar', 'kavanoz', 'coinjar']],
        ['portraits', 'Profil sahneleri', 'Yayın', 'contact-round', ['portraits', 'portrait', 'profil', 'profiller', 'profil sahneleri']],
        ['gift', 'Hediyeler', 'Etkileşim', 'gift', ['topgift', 'gifts', 'coinjar', 'giftpusher', 'raconking', 'streambeauty', 'streamhandsome', 'hediye', 'hediyeler', 'gift', 'gifts']],
        ['likes', 'Beğeni', 'Etkileşim', 'heart', ['begeni', 'like', 'likes']],
        ['support', 'Destek', 'Etkileşim', 'gem', ['destek', 'support', 'supporters']],
        ['members', 'Katılım', 'Etkileşim', 'user-plus', ['katilim', 'member', 'members', 'join']],
        ['follow', 'Takip', 'Etkileşim', 'user-check', ['takip', 'follow', 'followers']],
        ['share', 'Paylaşım', 'Etkileşim', 'share-2', ['paylasim', 'share', 'shares']],
        ['subscription', 'Abonelik', 'Etkileşim', 'badge-check', ['abonelik', 'subscription', 'subscribe']],
        ['effects', 'Efektler', 'Etkileşim', 'sparkles', ['firework', 'coindrop', 'likefountain', 'effects', 'animation', 'animasyon', 'efekt', 'efektler']],
        ['games', 'Oyunlar', 'Etkileşim', 'gamepad-2', ['wheel', 'actionwheel', 'penalty', 'streambuddies', 'giftpusher', 'games', 'game', 'oyun', 'oyunlar']],
        ['goals', 'Hedefler', 'Yayın', 'target', ['goals', 'goal', 'hedef', 'hedefler']],
        ['stream', 'Yayın araçları', 'Yayın', 'radio', ['streamtimer', 'timer', 'viewercount', 'stream', 'yayin', 'sure', 'yayin araclari']],
        ['activity', 'Bildirim & sohbet', 'Yayın', 'message-square', ['myactions', 'chat', 'activity', 'notification', 'alerts', 'bildirim', 'sohbet']],
        ['flow', 'Canlı akış', 'Yayın', 'rows-3', ['flow', 'feed', 'carousel', 'akis']],
        ['community', 'Topluluk', 'Etkileşim', 'users', ['community', 'topluluk']]
    ];
    function categoryOf(item) {
        const supplied = item.category, raw = typeof supplied === 'object' && supplied ? supplied.id || supplied.name || supplied.label : supplied;
        const match = categoryKinds.find(row => row[4].includes(fold(raw || item.id))) || (!raw && categoryKinds.find(row => row[4].includes(fold(item.kind))));
        return {
            id: text(match?.[0] || fold(raw) || 'other'),
            name: text(supplied?.label || (typeof supplied === 'object' ? supplied?.name : '') || match?.[1] || raw || 'Diğer'),
            group: ['broadcast', 'stream', 'yayin'].includes(fold(supplied?.group || item.categoryGroup)) ? 'Yayın' : ['interaction', 'interactions', 'etkilesim'].includes(fold(supplied?.group || item.categoryGroup)) ? 'Etkileşim' : text(supplied?.group || item.categoryGroup || match?.[2] || 'Diğer'),
            icon: match?.[3] || 'layout-grid'
        };
    }
    function connection(value, overlay = false) {
        const status = value?.status;
        if (overlay ? value?.ready === true : status === 'connected') return { label: overlay ? 'HTTPS hazır' : 'Hesap bağlı', tone: 'good' };
        if (['connecting', 'retrying', 'reconnecting'].includes(status)) return { label: status === 'connecting' ? 'Bağlanıyor' : 'Yeniden bağlanıyor', tone: 'pending' };
        if (status === 'waiting') return { label: 'Yayın bekleniyor', tone: 'pending' };
        if (['error', 'failed', 'license-required'].includes(status)) return { label: status === 'license-required' ? 'Lisans gerekli' : 'Bağlantı hatası', tone: 'bad' };
        return { label: status === 'disconnected' || status === 'idle' || value?.ready === false ? 'Bağlı değil' : 'Durum bilinmiyor', tone: 'neutral' };
    }
    function mount(body, { info = {}, icon, esc, widgetUrl } = {}) {
        if (!body?.ownerDocument || typeof body.replaceChildren !== 'function') throw new TypeError('Widget hub requires a DOM container');
        mounts.get(body)?.dispose();
        const doc = body.ownerDocument, win = doc.defaultView || window, uid = 'widget-hub-' + ++sequence;
        const e = typeof esc === 'function' ? value => esc(text(value)) : escapeHTML;
        const i = typeof icon === 'function' ? icon : name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
        const root = doc.createElement('section');root.className = 'widget-hub';root.setAttribute('aria-label', 'Widget yöneticisi');
        let disposed = false, all = [], items = [], selected = '', inspectId = '', category = '*', query = '', sort = 'recommended', lastFilter = '';
        let favorites = new Set(), storageAvailable = true, hovered = '', focused = '', forced = '', paused = false, editorSuspended = false, lastFocus = null;
        const cards = new Map(), sections = new Map(), frames = new Map(), markup = new WeakMap(), failures = new WeakMap(), drafts = new Map(), busy = new Set(), pendingRequests = new Set();
        const html = (node, value) => {
            if (markup.get(node) === value) return;
            const focused = node.contains(doc.activeElement) ? doc.activeElement : null;
            const key = focused && ['data-hub-category', 'data-hub-favorite', 'data-hub-action', 'data-hub-reset', 'data-widget', 'data-test-widget', 'data-copy-widget', 'data-action', 'aria-label'].find(key => focused.hasAttribute(key));
            const identity = key ? focused.getAttribute(key) : null;
            node.innerHTML = value;markup.set(node, value);
            if (key) [...node.querySelectorAll('button')].find(button => button.getAttribute(key) === identity && !button.disabled)?.focus({ preventScroll: true });
        };
        const tool = (symbol, label, attrs = '', extra = '') => `<button type="button" class="wh-icon ${extra}" ${attrs} title="${e(label)}" aria-label="${e(label)}">${i(symbol)}</button>`;
        try { const saved = JSON.parse(win.localStorage.getItem(favoritesKey) || 'null');if (saved?.version === 1 && Array.isArray(saved.ids)) favorites = new Set(saved.ids.filter(id => typeof id === 'string' && id.length <= 256).slice(0, 2000)); } catch { storageAvailable = false; }
        root.innerHTML = `<header class="wh-header"><div><h2>Widget’lar</h2><p data-hub-summary></p></div><div class="wh-header-actions"><button type="button" class="wh-status-button" data-hub-action="health" aria-label="Bağlantı durumu" aria-haspopup="dialog" aria-controls="${uid}-health" aria-expanded="false"></button>${tool('pause', 'Önizlemeleri duraklat', 'data-hub-action="pause" aria-pressed="false"')}<button type="button" class="wh-button wh-connect" data-action="widget-connect">${i('radio')}<span>Yayın hesabı</span></button></div></header>
            <div class="wh-layout"><aside class="wh-sidebar"><nav class="wh-navigation" aria-label="Widget kategorileri"></nav><label class="wh-mobile-category"><span>Kategori</span><select data-hub-category-select aria-label="Widget kategorisi"></select></label><p class="wh-storage" role="status"></p></aside>
            <section class="wh-catalog" aria-labelledby="${uid}-catalog"><header class="wh-catalog-heading"><div><span class="wh-eyebrow">KÜTÜPHANE</span><h3 id="${uid}-catalog">Tüm widget’lar</h3></div><span class="wh-results" role="status" aria-live="polite"></span></header>
            <div class="wh-toolbar"><label class="wh-search">${i('search')}<input type="search" data-hub-search placeholder="Widget ara" aria-label="Widget ara" maxlength="200" autocomplete="off"></label><label class="wh-sort"><span>Sıralama</span><select data-hub-sort aria-label="Widget sıralaması"><option value="recommended">Önerilen</option><option value="name">Ada göre</option><option value="category">Kategoriye göre</option></select></label></div>
            <div class="wh-catalog-scroll" role="region" aria-label="Widget listesi" tabindex="0"><p class="wh-notice" role="status" aria-live="polite" hidden></p><div class="wh-grid" role="list" aria-label="Widget kataloğu"></div><div class="wh-empty" hidden>${i('search-x')}<h4>Widget bulunamadı</h4><button type="button" class="wh-button" data-hub-action="clear-filters">Tüm widget’lar</button></div></div>
            </section></div>
            <dialog class="wh-inspector" aria-labelledby="${uid}-inspect-title"><article class="wh-inspection" data-widget-card=""><header class="wh-inspect-heading"><div><span class="wh-eyebrow">İNCELE</span><h3 id="${uid}-inspect-title" tabindex="-1"></h3></div><div class="wh-inspect-tools"></div></header><div class="wh-inspect-controls"><div class="wh-inspect-themes"></div><label class="wh-format"><span>Biçim</span><select data-hub-format aria-label="Widget biçimi"></select></label></div><div class="wh-inspect-stage wh-media"><div class="wh-poster-fallback">${i('image')}<span>Görsel hazırlanıyor</span></div></div><footer class="wh-inspect-footer"><span class="wh-inspect-state" role="status"></span><p class="wh-inspect-description"></p><div class="wh-inspect-actions"></div></footer></article></dialog>
            <dialog id="${uid}-health" class="wh-health-drawer" aria-labelledby="${uid}-health-title"><header><div><span class="wh-eyebrow">YAYIN DURUMU</span><h3 id="${uid}-health-title">Bağlantılar & ölçümler</h3></div>${tool('x', 'Durumu kapat', 'data-hub-action="close-health" autofocus')}</header><div class="wh-health-content"></div></dialog>`;
        body.replaceChildren(root);
        const $ = selector => root.querySelector(selector), nodes = {
            summary: $('[data-hub-summary]'), nav: $('.wh-navigation'), category: $('[data-hub-category-select]'), storage: $('.wh-storage'),
            heading: $('.wh-catalog-heading h3'), results: $('.wh-results'), search: $('[data-hub-search]'), grid: $('.wh-grid'), scroller: $('.wh-catalog-scroll'), empty: $('.wh-empty'),
            notice: $('.wh-notice'), pause: $('[data-hub-action="pause"]'),
            inspector: $('.wh-inspector'), inspection: $('.wh-inspection'), inspectTitle: $('.wh-inspect-heading h3'), inspectTools: $('.wh-inspect-tools'),
            inspectThemes: $('.wh-inspect-themes'), inspectMedia: $('.wh-inspect-stage'), format: $('[data-hub-format]'), inspectState: $('.wh-inspect-state'),
            inspectDescription: $('.wh-inspect-description'), inspectActions: $('.wh-inspect-actions'), status: $('.wh-status-button'), drawer: $('.wh-health-drawer'), health: $('.wh-health-content')
        };
        const inspectPoster = { media: nodes.inspectMedia, posterKey: '', image: null };
        const find = id => all.find(item => item.id === id);
        const baseId = item => item?.scenePreset ? item.id : item?.baseId || item?.id;
        const icons = () => {
            // Replace only new markers; replacing an SVG during pointer/focus events loses clicks.
            if (!win.lucide?.createElement) return;
            for (const marker of root.querySelectorAll('i[data-lucide]')) {
                const name = marker.getAttribute('data-lucide'), key = name.replace(/(^|[-_])(\w)/g, (_, gap, char) => char.toUpperCase()), definition = win.lucide.icons?.[key];
                if (!definition) continue;
                const svg = win.lucide.createElement(definition);
                for (const attr of marker.attributes) if (attr.name !== 'data-lucide') svg.setAttribute(attr.name, attr.value);
                svg.classList.add('lucide', 'lucide-' + name);marker.replaceWith(svg);
            }
        };
        function notice(message = '') { nodes.notice.textContent = message;nodes.notice.hidden = !message; }
        function previewURL(item) {
            try {
                const raw = typeof widgetUrl === 'function' ? widgetUrl(item, true) : item?.previewUrl;
                if (!raw) return '';const url = new URL(raw, doc.baseURI);
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
                url.searchParams.delete('t');url.searchParams.set('preview', '1');
                if (item.scenePreset) {
                    const values = settings(item);
                    for (const key of ['theme', 'motif', 'entrance', 'notification', 'profileLayout', 'portraitStyle', 'effectStyle', 'jarStyle', 'jarTint', 'jarMascot', 'chatTheme', 'portraitFrame', 'frameStyle', 'unboxStyle', 'participants']) if (values[key] !== undefined) url.searchParams.set(key, text(values[key]));
                }
                return url.href;
            } catch { return ''; }
        }
        function broadcastURL(item) {
            if (info?.overlayTransport?.ready !== true || typeof item?.broadcastUrl !== 'string' || !item.broadcastUrl) return '';
            try {
                const url = new URL(typeof widgetUrl === 'function' ? widgetUrl(item, false) : item.broadcastUrl);
                const host = url.hostname.toLowerCase();
                if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(host) || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.invalid') || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || !/^\/overlays\/[A-Za-z0-9_-]{43}\//.test(url.pathname) || ['key', 'preview', 'demo'].some(key => url.searchParams.has(key))) return '';
                return url.href;
            } catch { return ''; }
        }
        function posterURLs(item) {
            const urls = [], theme = settings(item).theme;
            const raw = item?.scenePreset ? item.posterUrl : item?.themePosters?.[theme] || item?.posterUrl;
            const base = previewURL(item) || doc.baseURI;
            let prefix = '';try { prefix = new URL(base).pathname.match(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/)?.[0] || ''; } catch {}
            for (const value of [raw, prefix + '/widget/cinematic/posters/' + encodeURIComponent(item.id) + '.webp']) {
                try { if (!value) continue;const url = new URL(value, base);if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !urls.includes(url.href)) urls.push(url.href); } catch {}
            }
            return urls;
        }
        function settings(item) { return { ...Object.fromEntries((Array.isArray(item?.fields) ? item.fields : []).filter(field => field?.key).map(field => [field.key, field.value])), ...(info?.studio?.settings?.[item?.id] || {}), ...drafts.get(item?.id) }; }
        function canWrite() { return typeof win.mngAPI?.widgetStudioKaydet === 'function' || typeof win.api?.widgetStudioSave === 'function' || Boolean(info?.preview && ['127.0.0.1', 'localhost'].includes(win.location.hostname)); }
        function actions(item, expanded = false) {
            const id = e(item.id), reset = item.studio && (canWrite() || typeof win.widgetGenelSifirla === 'function');
            return `${tool('sliders-horizontal', item.name + ' ayarları', `data-widget="${id}"`)}${item.studio ? tool('play', item.name + ' test et', `data-test-widget="${id}"`) : ''}${reset ? tool('rotate-ccw', item.name + ' verisini sıfırla', `data-hub-reset="${id}" ${busy.has(item.id) ? 'disabled' : ''}`, 'wh-danger') : ''}${broadcastURL(item) ? tool('copy', item.name + ' yayın bağlantısını kopyala', `data-copy-widget="${id}"`) : ''}${expanded ? tool('x', 'İncelemeyi kapat', 'data-hub-action="close-inspect"') : ''}`;
        }
        function saveFavorites() { try { win.localStorage.setItem(favoritesKey, JSON.stringify({ version: 1, ids: [...favorites] }));storageAvailable = true; } catch { storageAvailable = false; } }
        function renderNavigation() {
            const counts = new Map();
            for (const item of items) { const c = item._category;if (!counts.has(c.id)) counts.set(c.id, { ...c, count: 0 });counts.get(c.id).count++; }
            const categories = [...counts.values()].sort((a, b) => Number(b.id === 'pk') - Number(a.id === 'pk') || categoryKinds.findIndex(c => c[0] === a.id) - categoryKinds.findIndex(c => c[0] === b.id));
            const nav = (id, label, symbol, count) => `<button type="button" class="wh-nav-item" data-hub-category="${e(id)}" aria-current="${id === category ? 'page' : 'false'}">${i(symbol)}<span>${e(label)}</span><small>${count}</small></button>`;
            html(nodes.nav, `<span class="wh-nav-label">KÜTÜPHANE</span>${nav('*', 'Tümü', 'panels-top-left', items.length)}${nav('favorites', 'Favoriler', 'star', items.filter(item => favorites.has(item.id)).length)}${categories.length ? '<span class="wh-nav-label wh-category-label">KATEGORİLER</span>' : ''}${categories.map(c => nav('category:' + c.id, c.name, c.icon, c.count)).join('')}`);
            html(nodes.category, `<option value="*">Tüm kategoriler</option><option value="favorites">Favoriler</option>${categories.map(c => `<option value="category:${e(c.id)}">${e(c.name)}</option>`).join('')}`);nodes.category.value = category;
            nodes.summary.textContent = `${items.length} widget`;
            nodes.storage.textContent = storageAvailable ? '' : 'Favoriler bu oturumda';
        }
        function buildCard(item) {
            const node = doc.createElement('article');node.className = 'wh-card';node.dataset.widgetCard = item.id;node.setAttribute('role', 'listitem');
            node.innerHTML = '<header class="wh-card-heading"></header><div class="wh-media"><div class="wh-poster-fallback"><span>Görsel hazırlanıyor</span></div><div class="wh-media-caption"><span class="wh-preview-status"></span></div></div><footer class="wh-card-footer"></footer>';
            const record = { node, header: node.querySelector('header'), media: node.querySelector('.wh-media'), footer: node.querySelector('footer'), posterKey: '', image: null };
            record.media.dataset.hubMedia = item.id;
            observer?.observe(record.media);return record;
        }
        function syncPoster(record, item) {
            const urls = posterURLs(item), key = urls.join('\n');if (record.posterKey === key) return;
            record.posterKey = key;record.image?.remove();record.image = null;record.media.dataset.poster = 'pending';
            if (!urls.length) { record.media.dataset.poster = 'missing';return; }
            const img = doc.createElement('img');record.image = img;img.className = 'wh-poster';img.alt = item.name + ' render önizlemesi';img.loading = 'lazy';img.decoding = 'async';img.referrerPolicy = 'no-referrer';
            let index = 0;img.onload = () => { if (record.image === img) record.media.dataset.poster = 'ready'; };
            img.onerror = () => { if (record.image !== img || disposed) return;if (++index < urls.length) img.src = urls[index];else { img.remove();record.media.dataset.poster = 'missing'; } };
            img.src = urls[0];record.media.prepend(img);
        }
        function updateCard(record, item) {
            record.node.dataset.category = item._category.id;
            record.media.dataset.category = item._category.id;
            record.node.classList.toggle('is-selected', selected === item.id);
            html(record.header, `<div><span class="wh-card-category">${e(item._category.name)}</span><h5 title="${e(item.name)}">${e(item.name)}</h5></div><div class="wh-card-tools">${actions(item)}</div>`);
            html(record.footer, `<p>${e(item.description || '')}</p><button type="button" class="wh-inspect-button" data-hub-inspect="${e(item.id)}" aria-label="${e(item.name)} incele">${i('scan')}<span>İncele</span></button>${tool('star', favorites.has(item.id) ? 'Favorilerden çıkar' : 'Favorilere ekle', `data-hub-favorite="${e(item.id)}" aria-pressed="${favorites.has(item.id)}"`, 'wh-favorite')}`);
            syncPoster(record, item);
        }
        function renderCatalog() {
            const filter = JSON.stringify([category, query, sort]);
            if (filter !== lastFilter) { nodes.scroller.scrollTop = 0;lastFilter = filter; }
            const needle = fold(query.trim());
            const order = item => { const index = categoryKinds.findIndex(row => row[0] === item._category.id);return index < 0 ? categoryKinds.length : index; };
            const filtered = items.filter(item => (category === '*' || category === 'favorites' && favorites.has(item.id) || category === 'category:' + item._category.id) && (!needle || item._search.includes(needle))).sort((a, b) => (sort === 'category' ? a._category.name.localeCompare(b._category.name, 'tr') : order(a) - order(b)) || (sort === 'name' ? a.name.localeCompare(b.name, 'tr') : Number(b.id === 'pkhub') - Number(a.id === 'pkhub') || Number(b.id === 'pk') - Number(a.id === 'pk') || Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || a._index - b._index));
            const shown = filtered, ids = new Set(shown.map(item => item.id));
            for (const [id, record] of cards) if (!ids.has(id)) { dropFrame(record.media);observer?.unobserve(record.media);record.node.remove();cards.delete(id); }
            const children = [], groupIds = new Set();
            for (const item of shown) {
                const c = item._category;
                if (!groupIds.has(c.id)) {
                    groupIds.add(c.id);let heading = sections.get(c.id);
                    if (!heading) { heading = doc.createElement('div');heading.className = 'wh-section-heading';heading.setAttribute('role', 'presentation');sections.set(c.id, heading); }
                    html(heading, `<h4>${i(c.icon)}<span>${e(c.name)}</span></h4><span>${filtered.filter(entry => entry._category.id === c.id).length}</span>`);children.push(heading);
                }
                let record = cards.get(item.id);if (!record) { record = buildCard(item);cards.set(item.id, record); }
                updateCard(record, item);children.push(record.node);
            }
            for (const [id, heading] of sections) if (!groupIds.has(id)) { heading.remove();sections.delete(id); }
            children.forEach((node, index) => {
                if (nodes.grid.children[index] !== node) { const record = cards.get(node.dataset.widgetCard);if (record) dropFrame(record.media);nodes.grid.insertBefore(node, nodes.grid.children[index] || null); }
            });
            nodes.heading.textContent = category === 'favorites' ? 'Favoriler' : items.find(item => 'category:' + item._category.id === category)?._category.name || 'Tüm widget’lar';
            nodes.results.textContent = `${filtered.length} widget`;nodes.empty.hidden = Boolean(shown.length);
            icons();syncFrames();
        }
        function visible(media) {
            if (!media.isConnected) return false;
            const r = media.getBoundingClientRect();let left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(win.innerWidth, r.right), bottom = Math.min(win.innerHeight, r.bottom);
            for (let parent = media.parentElement; parent && right > left && bottom > top; parent = parent.parentElement) {
                const style = win.getComputedStyle(parent), clip = parent.getBoundingClientRect();
                if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, clip.left);right = Math.min(right, clip.right); }
                if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, clip.top);bottom = Math.min(bottom, clip.bottom); }
            }
            return right > left && bottom > top;
        }
        function dropFrame(media) {
            const entry = frames.get(media);if (!entry) return;
            frames.delete(media);win.clearTimeout(entry.timer);win.clearTimeout(entry.readyTimer);entry.frame.onload = entry.frame.onerror = null;entry.frame.removeAttribute('src');entry.frame.remove();entry.resolve(false);delete media.dataset.active;
        }
        function startFrame(media, item, force = false) {
            const url = previewURL(item);if (!url || disposed || !visible(media) || !force && failures.get(media) === url) return null;
            let entry = frames.get(media);if (entry?.url === url && !force) return entry;if (entry) dropFrame(media);
            const frame = doc.createElement('iframe');frame.title = item.name + ' hareketli önizlemesi';frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');frame.setAttribute('allow', 'autoplay');frame.setAttribute('referrerpolicy', 'no-referrer');
            let resolve;const ready = new Promise(done => { resolve = done; });entry = { id: item.id, url, frame, ready, resolve, loaded: false, timer: null };frames.set(media, entry);media.dataset.active = 'loading';delete media.dataset.error;
            const failed = () => { if (frames.get(media) !== entry) return;failures.set(media, url);dropFrame(media);media.dataset.error = 'true';notice('Önizleme yüklenemedi. İncele bölümünden yeniden deneyebilirsiniz.'); };
            frame.onload = () => {
                if (frames.get(media) !== entry || disposed) return;
                win.clearTimeout(entry.timer);failures.delete(media);entry.loaded = true;sendDraft(item.id);
                if (item.baseId === 'pkhub') {
                    media.dataset.active = 'loading-scene';entry.readyDeadline = Date.now() + 10000;
                    const waitForScene = () => {
                        if (frames.get(media) !== entry || disposed) return;
                        if (media.dataset.active === 'ready') return;
                        let ready = false;
                        try { const scene = frame.contentDocument?.querySelector('#scene');ready = !!scene && !scene.hidden && !!scene.dataset.source; } catch {}
                        if (ready) {
                            media.dataset.active = 'ready';entry.resolve(true);
                            if (media === nodes.inspectMedia) nodes.inspectState.textContent = 'Hareketli önizleme';
                        } else if (Date.now() < entry.readyDeadline) entry.readyTimer = win.setTimeout(waitForScene, 50);
                        else { delete media.dataset.active;entry.resolve(false); }
                    };
                    waitForScene();return;
                }
                media.dataset.active = 'ready';entry.resolve(true);if (media === nodes.inspectMedia) nodes.inspectState.textContent = 'Hareketli önizleme';
            };
            frame.onerror = failed;frame.src = url;media.append(frame);entry.timer = win.setTimeout(failed, 15000);return entry;
        }
        function onPreviewReady(event) {
            if (event.data?.type !== 'tikmng-widget-ready' || disposed) return;
            for (const [media, entry] of frames) {
                if (entry.frame.contentWindow !== event.source || event.data.id !== entry.id) continue;
                if (event.origin !== new URL(entry.url).origin && event.origin !== 'null') continue;
                win.clearTimeout(entry.readyTimer);win.clearTimeout(entry.timer);
                media.dataset.active = 'ready';entry.resolve(true);
                if (media === nodes.inspectMedia) nodes.inspectState.textContent = 'Hareketli önizleme';
            }
        }
        function editorVisible() { return [...doc.querySelectorAll('#widgetSettingsModal,#settings')].some(node => node.tagName === 'DIALOG' ? node.open : !node.hidden && win.getComputedStyle(node).display !== 'none'); }
        function syncFrames() {
            if (disposed) return;
            let wanted = [];
            if (!doc.hidden && !paused && !editorSuspended && !editorVisible() && !nodes.drawer.open) {
                if (nodes.inspector.open) { const item = find(inspectId);if (item && visible(nodes.inspectMedia)) wanted = [[nodes.inspectMedia, item]]; }
                else {
                    const candidates = [...new Set([forced, ...cards.keys()])];
                    for (const id of candidates) { const record = cards.get(id), item = find(id);if (record && item && visible(record.media) && !wanted.some(([media]) => media === record.media)) wanted.push([record.media, item]); }
                }
            }
            wanted = wanted.slice(0, 4);
            for (const media of frames.keys()) if (!wanted.some(([target]) => target === media)) dropFrame(media);
            for (const [media, item] of wanted) startFrame(media, item);
            nodes.pause.setAttribute('aria-pressed', String(paused));nodes.pause.title = paused ? 'Önizlemeleri devam ettir' : 'Önizlemeleri duraklat';nodes.pause.setAttribute('aria-label', nodes.pause.title);html(nodes.pause, i(paused ? 'play' : 'pause'));
            if (nodes.inspector.open && paused) nodes.inspectState.textContent = 'Duraklatıldı';icons();
        }
        function renderInspector() {
            if (!nodes.inspector.open) return;
            const item = find(inspectId);if (!item) { nodes.inspector.close();return; }
            nodes.inspection.dataset.widgetCard = item.id;nodes.inspectTitle.textContent = item.name;nodes.inspectDescription.textContent = item.description || '';
            html(nodes.inspectTools, actions(item, true));nodes.inspectThemes.hidden = true;
            syncPoster(inspectPoster, item);
            const base = baseId(item), formats = item.scenePreset ? [item] : all.filter(entry => entry.id === base || entry.preset === true && !entry.scenePreset && entry.baseId === base);
            html(nodes.format, formats.map(entry => `<option value="${e(entry.id)}">${e(entry.preset ? entry.format === 'portrait' ? 'Dikey' : entry.format === 'compact' ? 'Kompakt' : entry.name : 'Yatay')}</option>`).join(''));nodes.format.value = item.id;nodes.format.parentElement.hidden = formats.length < 2;
            html(nodes.inspectActions, `${tool('rotate-cw', 'Önizlemeyi yenile', 'data-hub-action="reload-inspect"')}<button type="button" class="wh-button" data-widget="${e(item.id)}">${i('sliders-horizontal')}<span>Ayarlar</span></button>${broadcastURL(item) ? `<button type="button" class="wh-button wh-copy" data-copy-widget="${e(item.id)}">${i('copy')}<span>Yayın bağlantısını kopyala</span></button>` : ''}`);
            nodes.inspectMedia.dataset.format = item.preset ? item.format : 'landscape';icons();syncFrames();
        }
        function openInspector(id, button) {
            const item = find(id);if (!item) return;lastFocus = button || doc.activeElement;inspectId = id;selected = baseId(item);hovered = focused = forced = '';paused = false;editorSuspended = false;
            if (!nodes.inspector.open) nodes.inspector.showModal();renderInspector();nodes.inspectTitle.focus();
        }
        function onInspectClose() { dropFrame(nodes.inspectMedia);renderCatalog();if (!disposed && lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); }
        async function previewAction(action, id, values) {
            const controller = new AbortController();pendingRequests.add(controller);
            try {
                const response = await win.fetch(new URL('/preview/action', win.location.href).href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, settings: values }), signal: controller.signal });
                const result = await response.json();if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');return result;
            } finally { pendingRequests.delete(controller); }
        }
        function sendDraft(id) { for (const entry of frames.values()) if (entry.id === id && entry.loaded) entry.frame.contentWindow?.postMessage({ type: 'tikmng-widget-draft', settings: settings(find(id)) }, new URL(entry.url).origin); }
        async function reset(id) {
            if (busy.has(id)) return;const item = find(id);if (!item) return;
            busy.add(id);renderCatalog();renderInspector();
            try {
                let fresh;
                if (typeof win.widgetGenelSifirla === 'function') { await win.widgetGenelSifirla(id);fresh = await win.mngAPI?.widgetBilgisi?.(); }
                else {
                    if (!win.confirm('Bu widgetın biriken verisi sıfırlansın mı?')) return;
                    if (typeof win.mngAPI?.widgetStudioSifirla === 'function') { const result = await win.mngAPI.widgetStudioSifirla(id, '1');if (result?.basarili === false) throw new Error(result.hata || 'Sıfırlanamadı.');fresh = await win.mngAPI.widgetBilgisi?.(); }
                    else if (info?.preview && canWrite()) fresh = await previewAction('reset', id);
                }
                if (fresh?.widgets && !disposed) update(fresh);
                for (const [media, entry] of [...frames]) if (entry.id === id) startFrame(media, find(id), true);
            } catch (error) { if (!disposed) notice(error.message || 'Widget sıfırlanamadı.'); }
            finally { busy.delete(id);if (!disposed) { renderCatalog();renderInspector(); } }
        }
        function time(value) {
            if (value == null || value === '' || value === 0) return 'Veri yok';
            const date = new Date(value);return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Veri yok';
        }
        function renderHealth() {
            const health = info?.streamHealth, measured = health?.schemaVersion === 1;
            const live = connection(info?.liveStatus?.status ? info.liveStatus : measured ? health.connection : null), overlay = connection(info?.overlayTransport, true);
            html(nodes.status, `${i('activity')}<span class="wh-status-part" data-tone="${live.tone}"><span class="wh-dot"></span>${e(live.label)}</span><span class="wh-status-part" data-tone="${overlay.tone}"><span class="wh-dot"></span>${e(overlay.label)}</span>`);
            const account = text(info?.liveStatus?.username || info?.channel).replace(/^@/, '');
            const band = (label, state, message, action, command) => `<section class="wh-health-band"><div class="wh-health-band-heading"><h4>${label}</h4><span class="wh-status-part" data-tone="${state.tone}"><span class="wh-dot"></span>${e(state.label)}</span></div>${message ? `<p>${e(message)}</p>` : ''}<button type="button" class="wh-button" data-action="${action}">${i(action === 'widget-connect' ? 'radio' : 'refresh-cw')}<span>${command}</span></button></section>`;
            const metrics = health?.metrics && typeof health.metrics === 'object' ? { ...health, ...health.metrics } : health || {};
            const get = keys => keys.map(key => metrics[key]).find(value => value !== undefined && value !== null);
            const value = (number, suffix = '', missing = 'Veri yok') => typeof number === 'number' && Number.isFinite(number) && number >= 0 ? number.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + suffix : missing;
            const number = (keys, suffix = '') => value(get(keys), suffix);
            const counter = record => record?.available === true ? (record.countIsLowerBound ? '≥ ' : '') + value(record.windowDelta) : 'Ölçüm yok';
            const measurement = (record, key, suffix) => record?.available === true ? value(record[key], suffix, 'Ölçüm yok') : 'Ölçüm yok';
            const rows = measured ? [
                ['Widget RTT (p95)', measurement(health.widget?.rttMs, 'p95', ' ms')],
                ['Yerel çizim FPS', measurement(health.widget?.renderFPS, 'mean', ' FPS')],
                ['Son olay', time(health.connection?.lastEventAt)],
                ['Gözlenen olay', value(health.session?.observedEvents)],
                ['Gözlenen etkileşim / dk', health.eventDensity?.rateReady === true && health.eventDensity?.windowComplete !== false ? value(health.eventDensity?.observedInteractionEventsPerMinute, '', 'Yeterli ölçüm yok') : 'Yeterli ölçüm yok'],
                ['Yeniden deneme', value(health.connection?.retryAttempts)],
                ['Yeniden bağlantı (pencere)', counter(health.counters?.reconnects)],
                ['Düşen olay (pencere)', counter(health.counters?.droppedEvents)],
                ['Kimliksiz olay', value(health.session?.eventsWithoutId)],
                ['Kalp atışı', ({ 'not-supplied': 'Ölçüm yok', awaiting: 'Bekleniyor', observed: 'Gözlendi', fresh: 'Güncel', overdue: 'Gecikmiş · doğrulanmalı' })[health.connection?.heartbeat?.state] || 'Ölçüm yok'],
                ['Örnek kapsamı', health.eventDensity?.windowComplete === false ? 'Sınırlı örnek' : health.eventDensity?.windowComplete === true ? 'Tam örnek' : 'Veri yok']
            ] : [
                ['Gecikme', number(['latencyMs', 'rttMs'], ' ms')], ['Son olay', time(get(['lastEventAt', 'lastEventReceivedAt']))],
                ['Alıcılar', number(['receivers', 'receiverCount'])], ['Alınan olay', number(['receivedEvents', 'eventCount'])],
                ['Olay / dakika', number(['eventsPerMinute'])], ['Bekleyen istek', number(['pendingRequests'])],
                ['Tekrarlanan olay', number(['duplicateEvents'])], ['Düşen olay', number(['droppedEvents'])], ['Yeniden bağlantı', number(['reconnects', 'reconnectCount'])]
            ];
            const labels = {
                'connection-error': 'Bağlantı yeniden deneniyor', 'live-waiting': 'Canlı yayın bekleniyor', 'connection-disconnected': 'Yayın bağlantısı kapalı',
                'heartbeat-overdue': 'Kalp atışı gecikmiş · doğrulama gerekli', 'observed-reconnects': 'Yeniden bağlantı gözlendi', 'observed-dropped-events': 'Düşen olay bildirildi',
                'widget-rtt-high': 'Widget yanıt süresi yüksek', 'render-fps-low': 'Yerel çizim hızı düşük', 'sample-buffer-limited': 'Örnek kapsamı sınırlı',
                'observed-events-dense': 'Yoğun etkileşim gözlendi', 'observed-interactions-quiet': 'Etkileşim gözlenmedi'
            };
            const diagnostics = measured && Array.isArray(health.diagnostics) ? health.diagnostics.filter(entry => Object.hasOwn(labels, entry?.code)).slice(0, 12) : [];
            const stamp = measured ? health.at : health?.updatedAt;
            const retryAt = info?.overlayTransport?.nextRetryAt ?? info?.liveStatus?.nextRetryAt;
            html(nodes.health, `${account ? `<p class="wh-health-account">@${e(account)}</p>` : ''}${band('Canlı yayın', live, info?.liveStatus?.message, 'widget-connect', 'Hesabı yönet')}${band('OBS / Live Studio', overlay, info?.overlayTransport?.message, 'overlay-reconnect', 'Yeniden bağlan')}<section class="wh-health-band"><div class="wh-health-band-heading"><h4>Ölçümler</h4><span>${health ? 'Sağlanan veriler' : 'Ölçüm verisi yok'}</span></div><dl class="wh-metrics">${rows.map(([label, reading]) => `<div><dt>${label}</dt><dd>${e(reading)}</dd></div>`).join('')}</dl>${stamp != null ? `<p class="wh-measured-at">Son ölçüm · ${e(time(stamp))}</p>` : ''}${retryAt != null ? `<p class="wh-measured-at">Sonraki deneme · ${e(time(retryAt))}</p>` : ''}</section>${diagnostics.length ? `<section class="wh-health-band"><h4>Yerel ölçüm uyarıları</h4><ul class="wh-diagnostics">${diagnostics.map(entry => `<li data-severity="${entry.severity === 'warning' ? 'warning' : 'info'}">${i(entry.severity === 'warning' ? 'triangle-alert' : 'info')}<span>${e(labels[entry.code])}</span></li>`).join('')}</ul></section>` : ''}`);
            icons();
        }
        function onClick(event) {
            const button = event.target.closest('button');if (!button || !root.contains(button) || button.disabled) return;
            if (button.dataset.widget) { editorSuspended = true;for (const media of frames.keys()) dropFrame(media);if (nodes.inspector.open) nodes.inspector.close();return; }
            if (button.dataset.testWidget) {
                const id = button.dataset.testWidget, media = nodes.inspector.open ? nodes.inspectMedia : cards.get(id)?.media;selected = baseId(find(id));forced = id;hovered = '';editorSuspended = false;paused = false;syncFrames();
                const entry = media && frames.get(media);
                if (!entry) { event.stopPropagation();notice('Önizleme hazır değil. İncele bölümünden yeniden deneyebilirsiniz.'); }
                else if (!entry.loaded) { event.stopPropagation();if (!entry.testPending) { entry.testPending = true;entry.ready.then(ready => { entry.testPending = false;if (ready && !disposed && button.isConnected && frames.get(media) === entry) button.click(); }); } }
                return;
            }
            if (button.dataset.copyWidget) { if (!broadcastURL(find(button.dataset.copyWidget))) event.stopPropagation();return; }
            if (button.hasAttribute('data-hub-inspect')) { openInspector(button.dataset.hubInspect, button);return; }
            if (button.hasAttribute('data-hub-reset')) { reset(button.dataset.hubReset);return; }
            if (button.hasAttribute('data-hub-favorite')) { const id = button.dataset.hubFavorite;favorites.has(id) ? favorites.delete(id) : favorites.add(id);saveFavorites();renderNavigation();renderCatalog();return; }
            if (button.hasAttribute('data-hub-category')) { category = button.dataset.hubCategory;hovered = forced = '';renderNavigation();renderCatalog();return; }
            switch (button.dataset.hubAction) {
                case 'health': lastFocus = button;nodes.drawer.showModal();nodes.status.setAttribute('aria-expanded', 'true');syncFrames();break;
                case 'close-health': nodes.drawer.close();break;
                case 'close-inspect': nodes.inspector.close();break;
                case 'reload-inspect': failures.delete(nodes.inspectMedia);dropFrame(nodes.inspectMedia);paused = false;syncFrames();break;
                case 'pause': paused = !paused;syncFrames();break;
                case 'clear-filters': query = '';category = '*';nodes.search.value = '';renderNavigation();renderCatalog();nodes.search.focus();break;
            }
        }
        function onInput(event) { if (event.target === nodes.search) { query = nodes.search.value;hovered = forced = '';renderCatalog(); } }
        function onChange(event) {
            const target = event.target;
            if (target === nodes.category) { category = target.value;hovered = forced = '';renderNavigation();renderCatalog(); }
            else if (target.hasAttribute('data-hub-sort')) { sort = target.value;renderCatalog(); }
            else if (target === nodes.format) { inspectId = target.value;dropFrame(nodes.inspectMedia);renderInspector(); }
        }
        function onHover(event) { const card = event.target.closest('.wh-card');if (card && !card.contains(event.relatedTarget)) { hovered = card.dataset.widgetCard;forced = '';syncFrames(); } }
        function onLeave(event) { const card = event.target.closest('.wh-card');if (card && !card.contains(event.relatedTarget)) { if (hovered === card.dataset.widgetCard) hovered = '';forced = '';syncFrames(); } }
        function onFocus(event) { const card = event.target.closest('.wh-card');if (card && !editorSuspended) { focused = card.dataset.widgetCard;syncFrames(); } }
        function onBlur(event) { const card = event.target.closest('.wh-card');if (card && !card.contains(event.relatedTarget)) { focused = '';syncFrames(); } }
        function onVisibility() { syncFrames(); }
        function fitViewport() {
            if (disposed) return;
            let bottom = win.innerHeight;
            // Respect the native launcher's scrollport as well as the browser viewport.
            for (let parent = body; parent && parent !== doc.body; parent = parent.parentElement) {
                if (/(auto|scroll)/.test(win.getComputedStyle(parent).overflowY)) {
                    bottom = Math.min(bottom, parent.getBoundingClientRect().top + parent.clientTop + parent.clientHeight);
                }
            }
            const padding = parseFloat(win.getComputedStyle(body).paddingBottom) || 0;
            const height = Math.max(0, Math.floor(bottom - root.getBoundingClientRect().top - padding)) + 'px';
            if (root.style.getPropertyValue('--wh-viewport-height') !== height) root.style.setProperty('--wh-viewport-height', height);
            syncFrames();
        }
        function onHealthClose() { nodes.status.setAttribute('aria-expanded', 'false');syncFrames();if (!disposed && lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); }
        const observer = typeof win.IntersectionObserver === 'function' ? new win.IntersectionObserver(() => syncFrames(), { threshold: .05 }) : null;
        const modalObserver = typeof win.MutationObserver === 'function' ? new win.MutationObserver(() => { editorSuspended = editorVisible();syncFrames(); }) : null;
        const viewportObserver = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(fitViewport) : null;
        for (let parent = body; parent && parent !== doc.body; parent = parent.parentElement) viewportObserver?.observe(parent);
        const shellHeader = body.closest('.workspace-content')?.querySelector('.workspace-header');
        if (shellHeader) viewportObserver?.observe(shellHeader);
        for (const node of doc.querySelectorAll('#widgetSettingsModal,#settings')) modalObserver?.observe(node, { attributes: true, attributeFilter: ['hidden', 'open', 'style', 'class'] });
        root.addEventListener('click', onClick, true);root.addEventListener('input', onInput);root.addEventListener('change', onChange);root.addEventListener('pointerover', onHover);root.addEventListener('pointerout', onLeave);root.addEventListener('focusin', onFocus);root.addEventListener('focusout', onBlur);
        nodes.inspector.addEventListener('close', onInspectClose);nodes.drawer.addEventListener('close', onHealthClose);doc.addEventListener('visibilitychange', onVisibility);doc.addEventListener('scroll', onVisibility, true);win.addEventListener('resize', fitViewport);win.addEventListener('message', onPreviewReady);
        function update(nextInfo) {
            if (disposed) return;info = nextInfo && typeof nextInfo === 'object' ? nextInfo : {};const seen = new Set();
            all = (Array.isArray(info.widgets) ? info.widgets : []).filter(item => { if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 256 || seen.has(item.id) || item.available === false || item.implemented === false || ['planned', 'definition'].includes(item.status)) return false;seen.add(item.id);return true; }).map((item, index) => { const value = { ...item, name: text(item.name || item.id), _index: index, _category: categoryOf(item) };value._search = fold([value.id, value.name, value.description, value.kind, value._category.name].join(' '));return value; });
            items = all.filter(item => item.catalogHidden !== true && (item.scenePreset === true || item.preset !== true && !(item.baseId && all.some(base => base.id === item.baseId))));
            if (!items.some(item => item.id === selected)) selected = items.find(item => item._category.id === 'pk')?.id || items[0]?.id || '';
            if (category.startsWith('category:') && !items.some(item => 'category:' + item._category.id === category)) category = '*';
            renderNavigation();renderCatalog();renderInspector();renderHealth();
        }
        function dispose() {
            if (disposed) return;disposed = true;for (const media of frames.keys()) dropFrame(media);for (const controller of pendingRequests) controller.abort();observer?.disconnect();modalObserver?.disconnect();viewportObserver?.disconnect();
            root.removeEventListener('click', onClick, true);root.removeEventListener('input', onInput);root.removeEventListener('change', onChange);root.removeEventListener('pointerover', onHover);root.removeEventListener('pointerout', onLeave);root.removeEventListener('focusin', onFocus);root.removeEventListener('focusout', onBlur);
            doc.removeEventListener('visibilitychange', onVisibility);doc.removeEventListener('scroll', onVisibility, true);win.removeEventListener('resize', fitViewport);win.removeEventListener('message', onPreviewReady);nodes.inspector.removeEventListener('close', onInspectClose);nodes.drawer.removeEventListener('close', onHealthClose);
            if (nodes.inspector.open) nodes.inspector.close();if (nodes.drawer.open) nodes.drawer.close();root.remove();if (mounts.get(body)?.dispose === dispose) mounts.delete(body);
        }
        const api = { dispose, update };mounts.set(body, api);fitViewport();update(info);return api;
    }
    window.TikMnGWidgetHub = Object.freeze({ mount });
})();
