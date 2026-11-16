import compression from "compression";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const origin = "https://tikmng.com";
const documentCache = "public, max-age=0, must-revalidate";
const shortCache = "public, max-age=300";
const checkoutClosed = '<meta name="tikmng-checkout" content="closed">';
const pages = [
    ["/hediye-tasarimi", "gift-designer.html"],
    ["/widgetlar", "widgets.html"],
    ["/privacy.html", "privacy.html"],
    ["/terms.html", "terms.html"]
];

const compressionMiddleware = compression({
    filter: (req, res) => res.statusCode === 200 && !req.headers.range && compression.filter(req, res)
});

function compressPublicText(req, res, next) {
    res.vary("Accept-Encoding");
    compressionMiddleware(req, res, next);
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function gamePage(game, url) {
    const title = escapeHtml(game.title);
    const description = escapeHtml(game.description);
    const cover = "/game-covers/" + escapeHtml(game.cover);
    const mobileWidth = game.id === "hapisten-kac" ? 480 : 500;
    const steam = game.steamUrl ? '<a class="back" href="' + escapeHtml(game.steamUrl) + '">Steam’den ücretsiz demoyu indir</a>' : "";
    const guide = game.giftGuide ? '<a class="back" href="' + escapeHtml(game.giftGuide) + '" download>Hediye görselini indir</a>' : "";
    return `<!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · TikTok Canlı Yayın Oyunu | TikMnG</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url}">
    <link rel="icon" href="/favicon.png" sizes="96x96" type="image/png">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="tr_TR">
    <meta property="og:site_name" content="TikMnG">
    <meta property="og:title" content="${title} | TikMnG">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${origin}${cover}-1000.webp">
    <link rel="stylesheet" href="/legal.css">
</head>
<body class="game-page">
    <header><nav aria-label="Ana gezinme"><a class="brand" href="/">Tik<span>MnG</span></a><a class="back" href="/#games">Tüm oyunlar</a></nav></header>
    <main>
        <div class="eyebrow">${escapeHtml(game.category)} · TikTok LIVE</div>
        <h1>${title}</h1>
        <p class="summary">${description}</p>
        <img class="game-cover" src="${cover}-1000.webp" srcset="${cover}-${mobileWidth}.webp ${mobileWidth}w, ${cover}-1000.webp 1000w"
            sizes="(max-width: 820px) calc(100vw - 48px), 772px" width="1000" height="563" alt="${title} oyun kapağı" fetchpriority="high">
        <h2>Oyun özellikleri</h2>
        <ul>${game.features.map(feature => "<li>" + escapeHtml(feature) + "</li>").join("")}</ul>
        <h2>Kurulum ve gereksinimler</h2>
        <p>${escapeHtml(game.requirements)}</p>
        <p>TikMnG Launcher’da oyunu seç, kurulumu tamamla ve hediye eşleşmelerini oyun içinden kontrol et.</p>
        <div class="game-links">
            <a class="back game-download" href="/download/setup">Windows için TikMnG Launcher’ı indir</a>
            ${steam}
            ${guide}
        </div>
    </main>
</body>
</html>`;
}

function redirectTo(req, res, target) {
    const queryIndex = req.originalUrl.indexOf("?");
    res.redirect(301, target + (queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : ""));
}

function assetCache(file) {
    if (/^portal-hero-(?:mobile|1280|1672)-v3\.webp$|^portal-icons-v1\.svg$|^portal-fonts-v1\.css$|^fonts\/portal-v1\/[\w-]+\.woff2$/.test(file)) {
        return "public, max-age=31536000, immutable";
    }
    if (/^game-covers\/[\w-]+\.webp$|^portal-hero-v2\.png$|^favicon\.png$/.test(file)) return "public, max-age=86400";
    if (/^(?:portal-v[234]|agency-entry|pricing-section|portal-pricing|legal)\.(?:css|js)$/.test(file)) return "public, max-age=3600";
}

export function registerPublicWebsite(app, { webRoot, fallbackHome, checkoutAvailable }) {
    const catalog = JSON.parse(fs.readFileSync(path.join(webRoot, "game-catalog.json"), "utf8"));
    const games = new Map(catalog.games.map(game => [game.id, gamePage(game, origin + "/oyunlar/" + game.id)]));
    const gameUrls = Array.from(games.keys(), id => "  <url><loc>" + escapeHtml(origin + "/oyunlar/" + id) + "</loc></url>");
    const sitemap = fs.readFileSync(path.join(webRoot, "sitemap.xml"), "utf8").replace("</urlset>", gameUrls.join("\n") + "\n</urlset>");
    const home = path.join(webRoot, "index.html");

    app.get("/index.html", (req, res) => redirectTo(req, res, "/"));
    app.get("/", compressPublicText, (_req, res) => {
        res.set("Cache-Control", documentCache);
        if (checkoutAvailable() && fs.existsSync(home)) {
            return fs.readFile(home, "utf8", (error, html) => {
                if (error) return res.sendFile(home);
                res.type("html").send(html.replace(checkoutClosed, checkoutClosed.replace("closed", "shopier")));
            });
        }
        if (fs.existsSync(home)) return res.sendFile(home);
        if (fs.existsSync(fallbackHome)) return res.sendFile(fallbackHome);
        res.send("TikMnG Web Portal");
    });

    for (const [route, file] of pages) {
        if ("/" + file !== route) app.get("/" + file, (req, res) => redirectTo(req, res, route));
        app.get(route, compressPublicText, (req, res) => {
            if (req.path !== route) return redirectTo(req, res, route);
            res.set("Cache-Control", documentCache);
            res.sendFile(path.join(webRoot, file));
        });
    }

    app.get("/oyunlar/:id", compressPublicText, (req, res, next) => {
        const id = req.params.id.toLowerCase();
        const html = games.get(id);
        if (!html) return next();
        const route = "/oyunlar/" + id;
        if (req.path !== route) return redirectTo(req, res, route);
        res.set("Cache-Control", documentCache).type("html").send(html);
    });

    app.get("/robots.txt", (_req, res) => {
        res.set("Cache-Control", shortCache).sendFile(path.join(webRoot, "robots.txt"));
    });
    app.get("/sitemap.xml", compressPublicText, (_req, res) => {
        res.set("Cache-Control", shortCache).type("application/xml").send(sitemap);
    });
}

export function servePublicAssets(webRoot) {
    const serve = express.static(webRoot, {
        setHeaders(res, file) {
            const policy = assetCache(path.relative(webRoot, file).split(path.sep).join("/"));
            if (policy) res.setHeader("Cache-Control", policy);
        }
    });
    return (req, res, next) => {
        const publicText = /^\/(?:portal-[\w-]+|agency-entry|pricing-section|legal)\.(?:css|js|svg)$/.test(req.path);
        if (publicText && (req.method === "GET" || req.method === "HEAD")) {
            return compressPublicText(req, res, () => serve(req, res, next));
        }
        return serve(req, res, next);
    };
}
