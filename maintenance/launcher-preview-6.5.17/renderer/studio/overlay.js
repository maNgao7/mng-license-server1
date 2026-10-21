(() => {
    'use strict';

    const stage = document.getElementById('stage');
    const parameters = new URLSearchParams(location.search);
    const key = parameters.get('key');
    const channel = document.body.dataset.channel;
    const itemId = document.body.dataset.item;
    const queue = [];
    const seen = new Set();
    const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    let playing = null;
    let source = null;
    let disposed = false;
    let staticPreview = null;
    const poster = parameters.get('poster') === '1';
    const preview = parameters.get('preview') === '1';

    function mediaUrl(item) {
        if (!idPattern.test(item.id) || typeof item.mediaUrl !== 'string') return null;
        const expected = new URL(`/tikmng/media/file/${item.id}`, location.origin);
        expected.search = new URLSearchParams({ key, channel }).toString();
        const supplied = new URL(item.mediaUrl, location.origin);
        return supplied.href === expected.href ? expected.href : null;
    }

    function playNext() {
        if (playing || disposed || !queue.length) return;
        const event = queue.shift();
        const item = event.item;
        const element = document.createElement(item.kind === 'audio' ? 'audio' : 'video');
        const start = item.startSeconds;
        const end = item.endSeconds;
        let timer;
        let clipTimer;
        let started = false;
        let finished = false;
        const cleanup = () => {
            clearTimeout(timer);
            clearTimeout(clipTimer);
            for (const [name, listener] of handlers) element.removeEventListener(name, listener);
            element.pause();
            element.removeAttribute('src');
            element.load();
            element.remove();
        };
        const finish = () => {
            if (finished) return;
            finished = true;
            cleanup();
            playing = null;
            queueMicrotask(playNext);
        };
        const begin = () => {
            if (started || finished) return;
            started = true;
            try {
                const promise = element.play();
                if (promise && typeof promise.catch === 'function') promise.catch(finish);
            } catch { finish(); }
        };
        const metadata = () => {
            if (Number.isFinite(element.duration) && start >= element.duration) return finish();
            if (start > 0) {
                try { element.currentTime = start; } catch { finish(); }
            } else begin();
        };
        const progress = () => {
            if (end !== null && element.currentTime >= end) finish();
        };
        const running = () => {
            clearTimeout(timer);
            clearTimeout(clipTimer);
            const duration = Number.isFinite(element.duration) ? element.duration : start + 86400;
            const remaining = Math.max(0, Math.min(end ?? duration, duration) - element.currentTime);
            clipTimer = setTimeout(finish, Math.min(86400000, remaining * 1000 + 150));
        };
        const waiting = () => {
            clearTimeout(timer);
            timer = setTimeout(finish, 15000);
        };
        const handlers = [['loadedmetadata', metadata], ['seeked', begin], ['ended', finish], ['error', finish],
            ['timeupdate', progress], ['playing', running], ['waiting', waiting], ['stalled', waiting]];
        playing = { finish };
        element.preload = 'auto';
        element.autoplay = false;
        element.loop = false;
        element.playsInline = true;
        element.controls = preview;
        element.volume = item.volume;
        element.muted = parameters.get('mute') === '1';
        element.setAttribute('aria-label', item.title || 'Media');
        for (const [name, listener] of handlers) element.addEventListener(name, listener);
        timer = setTimeout(finish, 15000);
        element.src = event.safeUrl;
        if (staticPreview) { staticPreview.pause(); staticPreview.removeAttribute('src'); staticPreview.load(); staticPreview = null; }
        stage.replaceChildren(element);
        element.load();
    }

    function receive(message) {
        try {
            const event = JSON.parse(message.data);
            const item = event.item;
            if (event.type !== 'studio:play' || !idPattern.test(event.id) || event.channel !== channel ||
                !item || item.channel !== channel || (itemId && item.id !== itemId) || seen.has(event.id) ||
                !['video', 'audio'].includes(item.kind) || !Number.isFinite(item.startSeconds) || item.startSeconds < 0 ||
                item.startSeconds > 86400 || !Number.isFinite(item.volume) || item.volume < 0 || item.volume > 1 ||
                (item.endSeconds !== null && (!Number.isFinite(item.endSeconds) || item.endSeconds <= item.startSeconds || item.endSeconds > 86400))) return;
            const safeUrl = mediaUrl(item);
            if (!safeUrl) return;
            seen.add(event.id);
            if (seen.size > 256) seen.delete(seen.values().next().value);
            if (queue.length >= 64) return;
            queue.push({ ...event, safeUrl });
            playNext();
        } catch { /* Malformed messages never become media sources. */ }
    }

    if ((poster || preview) && key && channel && stage) {
        try {
            const item = JSON.parse(document.body.dataset.media);
            const safeUrl = item.id === itemId && item.channel === channel && mediaUrl(item);
            if (safeUrl) {
                const element = document.createElement(item.kind === 'audio' ? 'audio' : 'video');
                element.muted = poster || parameters.get('mute') === '1';
                element.volume = item.volume;
                element.controls = preview;
                element.playsInline = true;
                element.preload = poster ? 'metadata' : 'auto';
                element.setAttribute('aria-label', item.title);
                element.addEventListener('loadedmetadata', () => {
                    const start = Math.max(0, Number(item.startSeconds) || 0);
                    if (Number.isFinite(element.duration)) element.currentTime = Math.min(start + (poster ? 0.1 : 0), Math.max(0, element.duration - 0.05));
                }, { once: true });
                element.addEventListener('error', () => { if (!disposed) stage.textContent = 'Ön izleme açılamadı'; }, { once: true });
                element.src = safeUrl;
                staticPreview = element;
                stage.replaceChildren(element);
                if (preview) document.body.classList.add('preview');
            }
        } catch { /* Only an authenticated, same-channel item can become a preview. */ }
    }
    if (!poster && key && channel && stage) {
        const eventsUrl = new URL('/tikmng/media/events', location.origin);
        eventsUrl.search = new URLSearchParams({ key, channel, ...(itemId ? { item: itemId } : {}) }).toString();
        source = new EventSource(eventsUrl.href);
        source.addEventListener('studio:play', receive);
    }
    window.addEventListener('pagehide', () => {
        disposed = true;
        source?.close();
        queue.length = 0;
        playing?.finish();
        if (staticPreview) { staticPreview.pause(); staticPreview.removeAttribute('src'); staticPreview.load(); staticPreview = null; }
        seen.clear();
    }, { once: true });
})();
