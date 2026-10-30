(() => {
    'use strict';

    const stage = document.getElementById('stage');
    const parameters = new URLSearchParams(location.search);
    const key = parameters.get('key');
    const overlayBase = /^(\/overlays\/[A-Za-z0-9_-]{43})(?=\/tikmng\/media(?:\/|$))/.exec(location.pathname || '')?.[1] || '';
    const channel = document.body.dataset.channel;
    const itemId = document.body.dataset.item;
    const gameId = document.body.dataset.game || '';
    const reliableEntry = gameId === 'entry-videos';
    const playbackReceipts = new Map();
    const retries = new Map();
    const poster = parameters.get('poster') === '1';
    const hover = !poster && parameters.get('hover') === '1';
    const once = hover && parameters.get('once') === '1';
    const preview = !poster && parameters.get('preview') === '1';
    const libraryPreview = location.pathname === `${overlayBase}/tikmng/media/library/${itemId}` && (poster || preview || hover);
    const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const gamePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
    const queue = [];
    const seen = new Set();
    const playCounts = new Map();
    const fadeMilliseconds = 200;
    let playing = null;
    let staticPreview = null;
    let selectedMedia = null;
    let previewTrim = null;
    let source = null;
    let disposed = false;
    let hoverLoops = 0;
    let stopPolling = () => {};

    function mediaUrl(item) {
        if (!idPattern.test(item.id) || typeof item.mediaUrl !== 'string') return null;
        const pathname = libraryPreview ? `/tikmng/media/library/file/${item.id}` : `/tikmng/media/file/${item.id}`;
        // Validate the original local route before translating it to the public relay.
        if (item.mediaUrl.split('?')[0] !== pathname || /[\x00-\x20\x7f\\#]/.test(item.mediaUrl)) return null;
        const supplied = new URL(item.mediaUrl, location.origin);
        if (supplied.pathname !== pathname || supplied.searchParams.getAll('channel').length !== 1 ||
            supplied.searchParams.get('channel') !== channel || supplied.searchParams.getAll('key').length > 1 ||
            [...supplied.searchParams.keys()].some(name => !['key', 'channel', 'revision'].includes(name)) ||
            supplied.searchParams.getAll('revision').length > 1 ||
            (supplied.searchParams.has('revision') && !/^[a-f0-9]{24}$/.test(supplied.searchParams.get('revision'))) ||
            (!overlayBase && (!key || supplied.searchParams.get('key') !== key))) return null;
        const expected = new URL(`${overlayBase}${pathname}`, location.origin);
        expected.search = new URLSearchParams({ ...(!overlayBase ? { key } : {}), channel, ...(supplied.searchParams.has('revision') ? {revision:supplied.searchParams.get('revision')} : {}) }).toString();
        return expected.href;
    }

    function normalizeItem(value) {
        if (!value || typeof value !== 'object') return null;
        const item = { gameId: '', interrupt: false, fade: false, playLimit: 0,
            combineGifts: false, displaySeconds: 5, ...value };
        if (item.channel !== channel || item.gameId !== gameId || (itemId && item.id !== itemId) ||
            !['video', 'audio', 'image'].includes(item.kind) || !Number.isFinite(item.startSeconds) ||
            item.startSeconds < 0 || item.startSeconds > 86400 || !Number.isFinite(item.volume) || item.volume < 0 || item.volume > 1 ||
            (item.endSeconds !== null && (!Number.isFinite(item.endSeconds) || item.endSeconds <= item.startSeconds || item.endSeconds > 86400)) ||
            !Number.isSafeInteger(item.playLimit) || item.playLimit < 0 ||
            !Number.isFinite(item.displaySeconds) || item.displaySeconds <= 0 || item.displaySeconds > 86400 ||
            ['interrupt', 'fade', 'combineGifts'].some(name => typeof item[name] !== 'boolean')) return null;
        return mediaUrl(item) ? item : null;
    }

    function notifyDuration(item, duration) {
        if (preview && item.id === itemId && Number.isFinite(duration) && duration > 0 && window.parent !== window) {
            // Only public identifiers and duration cross the frame boundary, never protected URLs.
            window.parent.postMessage({ type: 'tikmng-media-metadata', id: item.id, duration }, '*');
        }
    }

    function clampTrim(trim, duration) {
        const maximum = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 86400) : 86400;
        const gap = Math.min(0.001, maximum);
        const startSeconds = Math.max(0, Math.min(trim.startSeconds, maximum - gap));
        return { startSeconds, endSeconds: trim.endSeconds === null ? null : Math.min(maximum, Math.max(startSeconds + gap, trim.endSeconds)),
            volume: Math.max(0, Math.min(1, trim.volume)) };
    }

    function createSession(item, safeUrl, autoplay, onFinish, onStarted, onFailure) {
        const image = item.kind === 'image';
        const element = document.createElement(image ? 'img' : item.kind);
        const timers = new Set();
        let settings = { ...item, ...(preview && previewTrim ? clampTrim(previewTrim) : null) };
        let loaded = false;
        let wanted = autoplay;
        let done = false;
        let ending = false;
        let started = false;
        let lastDuration;
        let loadTimer;
        let clipTimer;
        let volumeTimer;
        const later = (fn, milliseconds) => {
            const id = setTimeout(() => { timers.delete(id); fn(); }, milliseconds);
            timers.add(id);
            return id;
        };
        const clear = id => { clearTimeout(id); timers.delete(id); };
        const stopTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
        const release = () => {
            if (done) return;
            done = true;
            stopTimers();
            for (const [name, listener] of handlers) element.removeEventListener(name, listener);
            if (!image) element.pause();
            element.removeAttribute('src');
            if (!image) element.load();
            element.remove();
            onFinish?.();
        };
        const failed = reason => {
            if (done) return;
            if (!started) onFailure?.(reason);
            release();
        };
        const rampVolume = target => {
            if (image) return;
            clear(volumeTimer);
            const from = element.volume;
            let step = 0;
            const tick = () => {
                if (done) return;
                element.volume = Math.max(0, Math.min(1, from + (target - from) * (++step / 10)));
                if (step < 10) volumeTimer = later(tick, fadeMilliseconds / 10);
            };
            tick();
        };
        const finish = () => {
            if (done || ending) return;
            ending = true;
            stopTimers();
            if (item.fade && loaded) {
                element.classList.remove('fade-in');
                element.classList.add('fade-out');
                rampVolume(0);
                later(release, fadeMilliseconds);
            } else release();
        };
        const remaining = () => image ? item.displaySeconds : Math.max(0,
            Math.min(settings.endSeconds ?? Infinity, Number.isFinite(element.duration) ? element.duration : 86400) - element.currentTime);
        const scheduleEnd = () => {
            clear(clipTimer);
            if (done || ending || poster) return;
            const milliseconds = remaining() * 1000;
            clipTimer = later(() => {
                if (preview && !autoplay && !image) { wanted = false; element.pause(); }
                else finish();
            }, Math.max(0, milliseconds - (item.fade && !(preview && !autoplay) ? fadeMilliseconds : 0)));
        };
        const enter = () => {
            if (item.fade) {
                element.classList.add('fade-in');
                if (!image) { element.volume = 0; rampVolume(settings.volume); }
            }
        };
        const begin = () => {
            if (done || ending || !loaded || !wanted || poster) return;
            if (!reliableEntry || !autoplay || started) clear(loadTimer);
            if (image) { enter(); scheduleEnd(); return; }
            try {
                const promise = element.play();
                if (promise && typeof promise.catch === 'function') promise.catch(error => { if (wanted) failed(error?.name === 'NotAllowedError' ? 'blocked' : error?.name === 'AbortError' ? 'aborted' : error?.name === 'NotSupportedError' ? 'unsupported' : 'network'); });
            } catch { failed('unsupported'); }
        };
        const publishDuration = () => {
            const duration = image ? item.displaySeconds : element.duration;
            if (duration !== lastDuration && Number.isFinite(duration) && duration > 0) {
                lastDuration = duration;
                notifyDuration(item, duration);
            }
        };
        const metadata = () => {
            if (done) return;
            loaded = true;
            if (!reliableEntry || !autoplay || started) clear(loadTimer);
            publishDuration();
            if (image) { begin(); return; }
            if (preview) settings = { ...settings, ...clampTrim(settings, element.duration) };
            if (Number.isFinite(element.duration) && settings.startSeconds >= element.duration) return release();
            const start = poster && Number.isFinite(element.duration) ? Math.min(settings.startSeconds + 0.1, Math.max(0, element.duration - 0.05)) : settings.startSeconds;
            try {
                if (element.currentTime !== start) element.currentTime = start;
                else begin();
            } catch { release(); }
        };
        const progress = () => {
            if (done || ending || poster) return;
            if (reliableEntry && !started && element.currentTime > settings.startSeconds + .01 && element.videoWidth > 0) presented();
            if (settings.endSeconds !== null && element.currentTime >= settings.endSeconds) {
                if (preview && !autoplay) { wanted = false; element.pause(); }
                else finish();
            }
        };
        const presented = () => {
            if (done || ending || started) return;
            started = true;
            clear(loadTimer);
            onStarted?.();
        };
        const running = () => {
            if (done || ending) return;
            if (!reliableEntry) presented();
            else if (typeof element.requestVideoFrameCallback === 'function') element.requestVideoFrameCallback(presented);
            wanted = true;
            enter();
            scheduleEnd();
        };
        const waiting = () => {
            clear(clipTimer);
            clear(loadTimer);
            loadTimer = later(() => failed('timeout'), 15000);
        };
        const handlers = image ? [['load', metadata], ['error', release]] : [
            ['loadedmetadata', metadata], ['durationchange', () => {
                publishDuration();
                if (preview) settings = { ...settings, ...clampTrim(settings, element.duration) };
                if (loaded && wanted && !element.paused) scheduleEnd();
            }], ['seeked', () => { if (wanted) begin(); }], ['ended', finish], ['error', () => failed(element.error?.code === 4 || element.error?.code === 3 ? 'unsupported' : 'network')],
            ['timeupdate', progress], ['playing', running], ['pause', () => { clear(clipTimer); }],
            ['waiting', waiting], ['stalled', waiting]
        ];
        element.setAttribute('aria-label', item.title || 'Media');
        element.setAttribute('referrerpolicy', 'no-referrer');
        if (!image) {
            element.preload = poster ? 'metadata' : 'auto';
            element.autoplay = false;
            element.loop = false;
            element.playsInline = true;
            element.controls = preview && !hover;
            element.volume = settings.volume;
            element.muted = poster || parameters.get('mute') === '1';
        } else element.draggable = false;
        for (const [name, listener] of handlers) element.addEventListener(name, listener);
        stage.replaceChildren(element);
        loadTimer = later(() => failed('timeout'), 15000);
        element.src = safeUrl;
        if (!image) element.load();
        return { item, cancel: release, trim(value) {
            if (done) return;
            const trim = clampTrim(value, image ? item.displaySeconds : element.duration);
            settings = { ...settings, ...trim };
            wanted = value.play;
            clear(clipTimer);
            clear(volumeTimer);
            if (!image) {
                element.volume = trim.volume;
                if (!wanted) element.pause();
                try { element.currentTime = trim.startSeconds; } catch { /* Seek after metadata instead. */ }
            }
            if (loaded) begin();
        } };
    }

    function showPreview() {
        if (disposed || !selectedMedia) return;
        const session = createSession(selectedMedia, mediaUrl(selectedMedia), hover, () => {
            if (staticPreview === session) staticPreview = null;
            if (once && window.parent !== window) window.parent.postMessage({ type: 'tikmng-media-preview-ended', id: selectedMedia.id }, '*');
            if (hover && !once && !disposed && hoverLoops++ < 10) setTimeout(showPreview, 1000);
        });
        staticPreview = session;
    }

    function playNext() {
        if (playing || disposed || !queue.length) return;
        const event = queue.shift();
        staticPreview?.cancel();
        staticPreview = null;
        if (event.item.id === itemId) selectedMedia = event.item;
        if (event.test !== true) playCounts.set(event.item.id, Math.min(Number.MAX_SAFE_INTEGER, (playCounts.get(event.item.id) || 0) + 1));
        const receipt = (state, failure = '') => {
            if (reliableEntry && !preview) playbackReceipts.set(event.id, { ack: event.id, playback: state, ...(failure ? { failure } : {}) });
            if (reliableEntry && state === 'failed' && ['network', 'timeout', 'aborted'].includes(failure)) {
                const previous = retries.get(event.id) || { attempts: 0 };
                if (previous.attempts < 2) { retries.set(event.id, { attempts: previous.attempts + 1, after: Date.now() + 3000 }); seen.delete(event.id); }
            }
        };
        const session = createSession(event.item, event.safeUrl, true, () => {
            if (playing === session) playing = null;
            queueMicrotask(playNext);
        }, () => receipt('started'), reason => receipt('failed', reason));
        playing = session;
    }

    function receive(message) {
        try {
            const event = JSON.parse(message.data);
            if (disposed || event.type !== 'studio:play' || !idPattern.test(event.id) || event.channel !== channel || seen.has(event.id)) return;
            if (reliableEntry && retries.get(event.id)?.after > Date.now()) return;
            const item = normalizeItem(event.item);
            if (!item) return;
            if (reliableEntry && queue.length >= 64) return;
            seen.add(event.id);
            if (seen.size > 256) seen.delete(seen.values().next().value);
            if (event.test !== true && item.playLimit > 0) {
                const pending = queue.filter(entry => entry.item.id === item.id && entry.test !== true).length;
                if ((playCounts.get(item.id) || 0) + (item.interrupt ? 0 : pending) >= item.playLimit) return;
            }
            if (item.interrupt) {
                queue.length = 0;
                playing?.cancel();
            }
            if (queue.length >= 64) return;
            queue.push({ ...event, item, safeUrl: mediaUrl(item) });
            playNext();
        } catch { /* Malformed messages never become media sources. */ }
    }

    if (poster || preview || hover) document.body.classList.add(poster ? 'poster' : 'preview');
    const validScope = !gameId || gamePattern.test(gameId);
    if ((poster || preview || hover) && (key || overlayBase) && channel && stage && validScope) {
        try {
            selectedMedia = normalizeItem(JSON.parse(document.body.dataset.media));
            if (selectedMedia && selectedMedia.id === itemId) {
                showPreview();
            }
        } catch { /* Only an authenticated, same-scope item can become a preview. */ }
    }
    if (preview && itemId) window.addEventListener('message', event => {
        if (disposed || event.source !== window.parent || window.parent === window || !selectedMedia) return;
        const data = event.data;
        if (!data || data.type !== 'tikmng-preview-trim' || data.id !== itemId ||
            !Number.isFinite(data.startSeconds) || (data.endSeconds !== null && !Number.isFinite(data.endSeconds)) ||
            !Number.isFinite(data.volume) || typeof data.play !== 'boolean') return;
        previewTrim = { startSeconds: data.startSeconds, endSeconds: data.endSeconds, volume: data.volume };
        if (!playing && !staticPreview) showPreview();
        (playing || staticPreview)?.trim(data);
    });
    if (!libraryPreview && !poster && !hover && (key || overlayBase) && channel && stage && validScope) {
        const scope = { channel, ...(preview ? { preview: '1' } : {}), ...(gameId ? { game: gameId } : {}), ...(itemId ? { item: itemId } : {}) };
        if (overlayBase || reliableEntry) {
            const client = crypto.randomUUID();
            let cursor = '';
            let timer;
            let request = null;
            let delay = 800;
            stopPolling = () => {
                clearTimeout(timer);
                request?.abort();
                cursor = '';
            };
            const poll = async () => {
                if (disposed || (preview && !reliableEntry && document.hidden) || request) return;
                const controller = new AbortController();
                request = controller;
                const timeout = setTimeout(() => controller.abort(), 5000);
                try {
                    const url = new URL(`${overlayBase}/tikmng/media/poll`, location.origin);
                    const receipt = playbackReceipts.entries().next().value;
                    url.search = new URLSearchParams({ ...(!overlayBase ? { key } : {}), ...scope, client, ...(cursor ? { cursor } : {}), ...(receipt?.[1] || {}) }).toString();
                    const response = await fetch(url.href, { signal: controller.signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
                    if (!response.ok) throw new Error('Media poll failed');
                    const data = await response.json();
                    if (disposed || (preview && !reliableEntry && document.hidden) || controller.signal.aborted) return;
                    if (!data || !idPattern.test(data.cursor) || !Array.isArray(data.events) || data.events.length > 256) throw new Error('Invalid media poll');
                    if (receipt && playbackReceipts.get(receipt[0]) === receipt[1]) playbackReceipts.delete(receipt[0]);
                    cursor = data.cursor;
                    for (const event of data.events) receive({ data: JSON.stringify(event) });
                    delay = 800;
                } catch {
                    delay = Math.min(delay * 2, 5000);
                } finally {
                    clearTimeout(timeout);
                    request = null;
                    if (!disposed && (!preview || reliableEntry || !document.hidden)) timer = setTimeout(poll, delay);
                }
            };
            document.addEventListener('visibilitychange', () => {
                if (reliableEntry || !preview) return;
                stopPolling();
                if (!document.hidden) { delay = 800; poll(); }
            });
            poll();
        } else {
            const eventsUrl = new URL('/tikmng/media/events', location.origin);
            eventsUrl.search = new URLSearchParams({ key, ...scope }).toString();
            source = new EventSource(eventsUrl.href);
            source.addEventListener('studio:play', receive);
        }
    }
    window.addEventListener('pagehide', () => {
        disposed = true;
        source?.close();
        stopPolling();
        queue.length = 0;
        playing?.cancel();
        staticPreview?.cancel();
        staticPreview = null;
        seen.clear();
        playCounts.clear();
    }, { once: true });
})();
