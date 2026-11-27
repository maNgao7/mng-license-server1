(() => {
    'use strict';
    let info, hub, editing, timer, frameTimer, disposed = false, pending = false, screen = '1';
    const root = document.querySelector('#preview-root'), dialog = document.querySelector('#settings');
    const form = dialog.querySelector('form'), fields = document.querySelector('#fields'), frame = document.querySelector('#settings-preview');
    const requests = new Set();
    const icons = () => window.lucide?.createIcons();
    const notify = message => {
        const node = document.querySelector('#notice');node.textContent = message;node.hidden = false;
        clearTimeout(timer);timer = setTimeout(() => { node.hidden = true; }, 4000);
    };
    async function request(url, body) {
        const controller = new AbortController();requests.add(controller);
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-store', ...(body ? {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            } : {}) });
            const value = await response.json();
            if (!response.ok) throw Error(value.error || 'İşlem tamamlanamadı.');
            return value;
        } catch (error) { throw Error(error.name === 'AbortError' ? 'İstek zaman aşımına uğradı.' : error.message); }
        finally { clearTimeout(timeout);requests.delete(controller); }
    }
    function accept(value) {
        if (disposed) return;
        // Keep the shared hub in review mode even if a response is malformed.
        info = { ...value, preview: true, widgets: (value.widgets || []).map(item => ({ ...item, url: '', broadcastUrl: '' })) };
        if (hub) hub.update(info);else hub = window.TikMnGWidgetHub.mount(root, { info });
        root.setAttribute('aria-busy', 'false');
    }
    async function refresh() {
        document.querySelector('#load-error').hidden = true;
        root.setAttribute('aria-busy', 'true');
        try { accept(await request('/preview/info')); }
        catch (error) {
            root.setAttribute('aria-busy', 'false');root.querySelector('.review-loading')?.remove();
            const node = document.querySelector('#load-error');node.querySelector('p').textContent = error.message;node.hidden = false;
        }
    }
    async function action(action, id, settings) {
        const value = await request('/preview/action', { action, id, settings });accept(value);return value;
    }
    function savedSettings(id, selectedScreen = screen) {
        const item = info.widgets.find(item => item.id === id);
        const key = id === 'myactions' ? id + ':' + selectedScreen : id;
        return { ...Object.fromEntries((item?.fields || []).map(field => [field.key, field.value])), ...info.studio?.settings?.[key], ...(id === 'myactions' ? { screen: selectedScreen } : {}) };
    }
    function values() {
        const settings = {};
        for (const control of form.elements) if (control.name) {
            settings[control.name] = control.dataset.kind === 'checkbox' ? control.checked : control.dataset.kind === 'number' ? Number(control.value) : control.value;
        }
        if (fields.querySelector('[data-ranking]')) settings.rankingRows = [...fields.querySelectorAll('[data-ranking-row]')].map(row => ({
            username: row.querySelector('[data-rank-username]').value.trim(), nickname: row.querySelector('[data-rank-nickname]').value.trim(),
            count: Number(row.querySelector('[data-rank-count]').value)
        }));
        return settings;
    }
    function post(type) { if (dialog.open) frame.contentWindow?.postMessage({ type, settings: values() }, location.origin); }
    function loadFrame() {
        clearTimeout(frameTimer);document.querySelector('#preview-error').hidden = true;
        const url = new URL(editing.previewUrl, location.origin);url.searchParams.set('preview', '1');
        if (editing.id === 'myactions') url.searchParams.set('screen', screen);
        frame.src = url.href;
        frameTimer = setTimeout(() => { if (dialog.open) document.querySelector('#preview-error').hidden = false; }, 15000);
    }
    frame.onload = () => { clearTimeout(frameTimer);post('tikmng-widget-draft'); };
    frame.onerror = () => { clearTimeout(frameTimer);document.querySelector('#preview-error').hidden = false; };
    function rankingRow(container, value = {}) {
        const row = document.createElement('div');row.dataset.rankingRow = '';row.className = 'ranking-row';
        for (const [key, title, type, content] of [
            ['username', 'Kullanıcı adı', 'text', value.username || ''], ['nickname', 'Görünen ad', 'text', value.nickname || ''], ['count', 'Adet', 'number', value.count || 1]
        ]) {
            const label = document.createElement('label');label.textContent = title;
            const input = document.createElement('input');input.type = type;input.dataset['rank' + key[0].toUpperCase() + key.slice(1)] = '';input.value = content;
            if (key === 'username') input.required = true;
            if (type === 'number') { input.min = 1;input.max = 1000000000;input.step = 1; }
            label.append(input);row.append(label);
        }
        const remove = document.createElement('button');remove.type = 'button';remove.className = 'icon-button';remove.title = 'Katılımcıyı kaldır';remove.setAttribute('aria-label', remove.title);
        remove.innerHTML = '<i data-lucide="trash-2"></i>';remove.onclick = () => { row.remove();post('tikmng-widget-draft'); };
        row.append(remove);container.append(row);icons();
    }
    function renderFields(settings) {
        fields.replaceChildren();
        for (const field of editing.fields || []) {
            if (field.hidden) continue;
            if (field.type === 'ranking') {
                const group = document.createElement('fieldset');group.dataset.ranking = '';group.className = 'ranking-fields';
                const legend = document.createElement('legend');legend.textContent = field.label;group.append(legend);
                const rows = document.createElement('div');group.append(rows);
                const pool = editing.scenePreset ? info.studio?.sceneRankings?.[editing.id] : info.studio;
                for (const row of pool?.raconRanking || []) rankingRow(rows, row);
                const add = document.createElement('button');add.type = 'button';add.innerHTML = '<i data-lucide="user-plus"></i>Katılımcı ekle';
                add.onclick = () => { rankingRow(rows);rows.lastElementChild.querySelector('input').focus(); };group.append(add);fields.append(group);continue;
            }
            const label = document.createElement('label');label.className = 'setting-field';
            const caption = document.createElement('span');caption.textContent = field.label;label.append(caption);
            const control = document.createElement(['select', 'gift'].includes(field.type) ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
            control.name = field.key;control.dataset.kind = field.type;
            if (field.type === 'select') for (const [value, title] of field.options) control.add(new Option(title, value));
            else if (field.type === 'gift') {
                for (const [value, title] of [['', 'Tüm hediyeler'], ['5655', 'Gül'], ['6427', 'Taç'], ['5282', 'Kalp']]) control.add(new Option(title, value));
                const saved = String(settings[field.key] || '');
                if (![...control.options].some(option => option.value === saved)) control.add(new Option('Hediye #' + saved, saved));
            } else if (control.tagName === 'INPUT') control.type = ['checkbox', 'number', 'color'].includes(field.type) ? field.type : 'text';
            const value = settings[field.key] ?? field.value;
            if (field.type === 'checkbox') { control.checked = !!value;label.classList.add('toggle-field'); }
            else control.value = value;
            if (field.type === 'number') { control.min = field.min;control.max = field.max;control.step = field.step || 1;control.required = true; }
            if (field.type === 'text') control.maxLength = field.key === 'title' ? 64 : 240;
            label.append(control);fields.append(label);
        }
        icons();
    }
    async function edit(id) {
        accept(await request('/preview/info'));
        editing = info.widgets.find(item => item.id === id);
        if (!editing?.studio) return notify('Bu kaplamanın düzenlenebilir ayarı yok.');
        screen = '1';document.querySelector('#settings-title').textContent = editing.name;
        renderFields(savedSettings(id));dialog.showModal();loadFrame();
    }
    async function run(button, task) {
        if (pending) return;
        pending = true;button.disabled = true;dialog.setAttribute('aria-busy', 'true');
        try { await task(); } catch (error) { if (!disposed) notify(error.message); }
        finally { pending = false;button.disabled = false;dialog.removeAttribute('aria-busy'); }
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('button');if (!button || button.disabled) return;
        if (button.dataset.widget) void run(button, () => edit(button.dataset.widget));
        else if (button.dataset.testWidget) void run(button, async () => {
            await action('test', button.dataset.testWidget);
            for (const preview of root.querySelectorAll('iframe')) preview.contentWindow?.postMessage({ type: 'tikmng-widget-audition' }, location.origin);
            notify('Örnek test olayı gönderildi.');
        });
    });
    // The shared hub uses this hook for data resets; no LIVE or licensed API is exposed.
    window.widgetGenelSifirla = async id => { await action('reset', id);notify('Örnek veriler sıfırlandı.'); };
    const observer = new MutationObserver(() => {
        for (const button of root.querySelectorAll('[data-action="widget-connect"],[data-action="overlay-reconnect"]')) {
            button.disabled = true;button.title = 'Tasarım incelemesi';
        }
    });
    observer.observe(root, { childList: true, subtree: true });
    document.querySelector('#close-settings').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { clearTimeout(frameTimer);frame.removeAttribute('src'); });
    dialog.addEventListener('input', event => {
        if (event.target.name !== 'screen') post('tikmng-widget-draft');
    });
    dialog.addEventListener('change', event => {
        if (event.target.name === 'screen') { screen = event.target.value;renderFields(savedSettings(editing.id));loadFrame(); }
    });
    document.querySelector('#test-settings').onclick = event => void run(event.currentTarget, async () => {
        if (!form.reportValidity()) return;
        await action('test', editing.id);post('tikmng-widget-draft');post('tikmng-widget-audition');notify('Örnek test olayı gönderildi.');
    });
    document.querySelector('#reset-settings').onclick = event => void run(event.currentTarget, async () => {
        const draft = values();await action('reset', editing.id);renderFields(draft);loadFrame();notify('Örnek veriler sıfırlandı.');
    });
    form.onsubmit = event => {
        event.preventDefault();void run(form.querySelector('[type=submit]'), async () => {
            await action('save', editing.id, { ...savedSettings(editing.id), ...values() });
            notify('Ayarlar bu inceleme oturumunda kaydedildi.');dialog.close();
        });
    };
    document.querySelector('#retry').onclick = () => { void refresh(); };
    document.querySelector('#nav-overlays').onclick = () => {
        root.querySelector('[data-hub-category="*"]')?.click();
        const search = root.querySelector('[data-hub-search]');
        if (search) { search.value = '';search.dispatchEvent(new Event('input', { bubbles: true }));search.focus(); }
        window.scrollTo({ top: 0 });
    };
    icons();void refresh();
    addEventListener('pagehide', () => {
        disposed = true;hub?.dispose();observer.disconnect();clearTimeout(timer);clearTimeout(frameTimer);
        for (const controller of requests) controller.abort();delete window.widgetGenelSifirla;
    }, { once: true });
})();
