(() => {
    'use strict';
    const view = mountDuelWidget(document, { localPortraits: false });
    const page = new URL(location.href);
    const prefix = page.pathname.match(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/)?.[0] || '';
    const endpoint = new URL(prefix + '/api/widget/state', page.origin);
    endpoint.searchParams.set('type', 'profile-duel');
    for (const key of ['channel', 'key']) {
        if (page.searchParams.has(key)) endpoint.searchParams.set(key, page.searchParams.get(key));
    }
    const image = path => /^\/widget\/gift-assets\/(?:\d{1,12}|portrait-[a-f0-9-]{36})\.png$/.test(path || '')
        ? prefix + path + (page.searchParams.has('key') ? '?key=' + encodeURIComponent(page.searchParams.get('key')) : '')
        : '';
    const abort = new AbortController();
    let timer, failures = 0;

    async function poll() {
        try {
            const response = await fetch(endpoint, { cache: 'no-store', signal: abort.signal });
            if (!response.ok) throw new Error('Widget state unavailable');
            const state = await response.json();
            if (abort.signal.aborted) return;
            for (const side of ['owner', 'opponent']) {
                if (state[side]) state[side].avatarUrl = image(state[side].avatarUrl);
            }
            state.giftConfig ||= {};
            state.giftConfig.roseGiftImage = image(state.giftConfig.roseGiftImage || '/widget/gift-assets/5655.png');
            state.giftConfig.tiktokGiftImage = image(state.giftConfig.tiktokGiftImage || '/widget/gift-assets/5269.png');
            if (state.phase === 'running' && Number.isFinite(state.time)) {
                state.remainingMs = Math.max(0, state.remainingMs - Math.max(0, Date.now() - state.time));
            }
            view.render(state);
            failures = 0;
        } catch {
            failures = Math.min(failures + 1, 5);
            if (failures >= 2) view.render({ phase: 'idle', remainingMs: 0 });
        } finally {
            if (!abort.signal.aborted) {
                const delay = failures ? 500 * 2 ** failures : window.TikMnGWidgetTransport?.changesSupported ? 0 : 2000;
                timer = setTimeout(poll, delay);
            }
        }
    }
    window.addEventListener('pagehide', () => {
        abort.abort();
        clearTimeout(timer);
        view.destroy();
    }, { once: true });
    poll();
})();
