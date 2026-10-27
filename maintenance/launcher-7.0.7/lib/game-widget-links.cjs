'use strict';

function mountWidgetLinks(app, {gameId, aliases = [], env = process.env, fetchImpl = globalThis.fetch} = {}) {
    const games = new Set([gameId, ...aliases]);
    app.get('/api/launcher-widget-links', async (req, res) => {
        const game = typeof req.query?.game === 'string' ? req.query.game : games.has(env.MNG_GAME_ID) ? env.MNG_GAME_ID : gameId;
        const port = Number(env.MNG_WIDGET_PORT), key = env.MNG_WIDGET_ACCESS_KEY;
        const unavailable = () => res.status(503).json({ready:false,links:{},message:'HTTPS yayın bağlantısı hazır değil. Launcher içinden yayın bağlantısını hazırlayın.'});
        res.setHeader('Cache-Control','no-store');
        if (!games.has(game)) return res.status(400).json({ready:false,links:{},message:'Geçersiz oyun.'});
        if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof key !== 'string' || key.length < 16 || key.length > 256) return unavailable();
        try {
            const url = new URL(`http://127.0.0.1:${port}/api/widget/game-links`);
            url.searchParams.set('game',game); url.searchParams.set('key',key);
            const response = await fetchImpl(url,{signal:AbortSignal.timeout(4000),redirect:'error'});
            if (!response.ok) { await response.body?.cancel(); return unavailable(); }
            const body = await response.text();
            if (body.length > 65536) return unavailable();
            const data = JSON.parse(body);
            if (!data.ready || !data.links || typeof data.links !== 'object') return unavailable();
            const links = {};
            for (const [mode,value] of Object.entries(data.links)) {
                if (!/^[a-z-]{1,32}$/.test(mode) || typeof value !== 'string') return unavailable();
                const publicURL = new URL(value);
                if (publicURL.protocol !== 'https:' || publicURL.username || publicURL.password || publicURL.hash ||
                    !/^\/overlays\/[A-Za-z0-9_-]{43}\/widget-overlay\.html$/.test(publicURL.pathname) ||
                    publicURL.searchParams.get('game') !== game || publicURL.searchParams.get('mode') !== mode ||
                    publicURL.searchParams.has('key')) return unavailable();
                links[mode] = publicURL.href;
            }
            if (!Object.keys(links).length) return unavailable();
            return res.json({ready:true,links});
        } catch { return unavailable(); }
    });
}

module.exports = {mountWidgetLinks};
