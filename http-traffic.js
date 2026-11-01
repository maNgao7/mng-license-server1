const HOUR = 3600000;
const CATEGORIES = ['overlay-state', 'overlay-images', 'overlay-media', 'overlay-documents', 'overlay-other', 'downloads', 'admin', 'api', 'website'];
const WIDGET_TYPES = new Set(['raconking', 'streambeauty', 'streamhandsome', 'raconlist', 'pk', 'topgift', 'topgifter', 'topliker', 'gifts', 'coinjar', 'giftpusher', 'streamtimer', 'myactions', 'wheel', 'actionwheel', 'firework', 'coindrop', 'likefountain', 'penalty', 'streambuddies', 'game']);

function stateKind(url) {
    const parsed = new URL(url, 'http://localhost');
    if (!/\/widget\/(?:state|(?:top-gift|top-likes|leaderboard|activity)\/state)$/.test(parsed.pathname)) return null;
    const type = parsed.searchParams.get('type');
    const legacy = /\/(top-gift|top-likes|leaderboard|activity)\/state$/.exec(parsed.pathname)?.[1];
    const widget = WIDGET_TYPES.has(type) ? type : legacy ? 'legacy-' + legacy : type ? 'unknown' : 'unscoped';
    return widget + ':' + (parsed.searchParams.get('transport') === 'changes' ? 'changes' : 'snapshot');
}

function category(url) {
    const pathname = String(url || '').split('?')[0];
    if (pathname.startsWith('/overlays/')) {
        if (/\/(?:state|poll)$/.test(pathname)) return 'overlay-state';
        if (/\/widget\/gift-assets\/|\/assets\/widgets\//.test(pathname)) return 'overlay-images';
        if (/\/tikmng\/media\/file\//.test(pathname)) return 'overlay-media';
        if (/\.html$|\/tikmng\/media\/?$|\/widget\/(?:overlay|top-gift|top-likes|leaderboard|gift-feed|activity)$/.test(pathname)) return 'overlay-documents';
        return 'overlay-other';
    }
    if (pathname.startsWith('/download/')) return 'downloads';
    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/admin')) return 'admin';
    return pathname.startsWith('/api/') ? 'api' : 'website';
}

export function createHttpTraffic({ now = Date.now } = {}) {
    const startedAt = now(), buckets = new Map();
    function row(name) {
        const hour = Math.floor(now() / HOUR) * HOUR;
        for (const key of buckets.keys()) if (key < hour - 47 * HOUR) buckets.delete(key);
        if (!buckets.has(hour)) buckets.set(hour, new Map());
        const bucket = buckets.get(hour);
        if (!bucket.has(name)) bucket.set(name, { requests: 0, bodyBytes: 0, completed: 0, aborted: 0, errors: 0, durationMs: 0 });
        return bucket.get(name);
    }
    function middleware(req, res, next) {
        const name = category(req.originalUrl || req.url), began = now();
        const kind = name === 'overlay-state' ? stateKind(req.originalUrl || req.url) : null;
        const names = kind ? [name, 'state:' + kind] : [name];
        for (const name of names) row(name).requests++;
        const write = res.write, end = res.end;
        function count(chunk, encoding) {
            if (req.method === 'HEAD' || [204, 205, 304].includes(res.statusCode) || chunk == null || typeof chunk === 'function') return;
            const bytes = typeof chunk === 'string' ? Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8') : chunk.byteLength;
            if (Number.isFinite(bytes) && bytes > 0) for (const name of names) row(name).bodyBytes += bytes;
        }
        res.write = function(chunk, encoding, callback) { count(chunk, encoding); return write.call(this, chunk, encoding, callback); };
        res.end = function(chunk, encoding, callback) { count(chunk, encoding); return end.call(this, chunk, encoding, callback); };
        let done = false;
        function finish() {
            if (done) return;
            done = true;
            for (const name of names) {
                const value = row(name);
                if (res.writableFinished) { value.completed++; value.durationMs += Math.max(0, now() - began); }
                else value.aborted++;
                if (res.statusCode >= 400) value.errors++;
            }
        }
        res.once('finish', finish); res.once('close', finish);
        next();
    }
    function snapshot(hours = 24) {
        hours = Math.max(1, Math.min(48, Number(hours) || 24));
        const cutoff = Math.floor(now() / HOUR) * HOUR - (hours - 1) * HOUR;
        const totals = Object.fromEntries(CATEGORIES.map(name => [name, { requests: 0, bodyBytes: 0, completed: 0, aborted: 0, errors: 0, durationMs: 0 }]));
        for (const [hour, bucket] of buckets) if (hour >= cutoff) for (const [name, value] of bucket) {
            if (!totals[name]) totals[name] = { requests: 0, bodyBytes: 0, completed: 0, aborted: 0, errors: 0, durationMs: 0 };
            for (const key of Object.keys(value)) totals[name][key] += value[key];
        }
        const describe = ([name, value]) => ({ name, ...value, averageDurationMs: value.completed ? Math.round(value.durationMs / value.completed) : 0 });
        return { startedAt, measuredAt: now(), hours, measurement: 'HTTP response body bytes written; not invoice totals or headers', personalDataRecorded: false,
            categories: Object.entries(totals).filter(([name]) => !name.startsWith('state:')).map(describe).sort((a, b) => b.bodyBytes - a.bodyBytes),
            stateWidgets: Object.entries(totals).filter(([name]) => name.startsWith('state:')).map(([name, value]) => describe([name.slice(6), value])).sort((a, b) => b.bodyBytes - a.bodyBytes) };
    }
    return { middleware, snapshot };
}
