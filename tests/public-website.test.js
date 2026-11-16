import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import express from "express";
import { registerPublicWebsite, servePublicAssets } from "../public-website.js";

const webRoot = fileURLToPath(new URL("../web", import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(webRoot, "game-catalog.json"), "utf8"));
const origin = "https://tikmng.com";
let server, checkoutReady = false;

before(async () => {
    const app = express();
    registerPublicWebsite(app, { webRoot, checkoutAvailable: () => checkoutReady });
    app.use(servePublicAssets(webRoot));
    app.get("/api/test", (_req, res) => res.json({ data: "example ".repeat(300) }));
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
});

after(() => new Promise(resolve => server.close(resolve)));

function get(route, headers = {}, method = "GET") {
    return new Promise((resolve, reject) => {
        const request = http.request({ hostname: "127.0.0.1", port: server.address().port, path: route, method, headers }, response => {
            const chunks = [];
            response.on("data", part => chunks.push(part));
            response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
            response.on("error", reject);
        });
        request.on("error", reject);
        request.end();
    });
}

test("robots, canonicals, HTML links and sitemap agree for the catalog", async () => {
    const robots = await get("/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(robots.body.toString(), /^Sitemap: https:\/\/tikmng\.com\/sitemap\.xml$/m);
    assert.deepEqual([...robots.body.toString().matchAll(/^Disallow: (.*)$/gm)].map(match => match[1].trim()), ["/admin", "/api/"]);
    const sitemap = await get("/sitemap.xml");
    assert.match(sitemap.headers["content-type"], /^application\/xml/);
    const urls = [...sitemap.body.toString().matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);
    const games = catalog.games.map(game => "/oyunlar/" + game.id);
    assert.deepEqual(urls, ["/", "/hediye-tasarimi", "/widgetlar", "/privacy.html", "/terms.html", ...games].map(route => origin + route));
    const html = (await get("/")).body.toString();
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.deepEqual(ld.filter(item => item["@type"] === "WebSite"), [{
        "@context": "https://schema.org", "@type": "WebSite", name: "TikMnG", alternateName: "Tik MNG", url: origin + "/"
    }]);
    assert.match(html, /name="google-site-verification"/);
    assert.deepEqual([...html.matchAll(/class="catalog-open" href="([^"]+)"/g)].map(match => match[1]), games);

    for (const url of urls) {
        const res = await get(new URL(url).pathname);
        const source = res.body.toString();
        assert.equal(res.status, 200, url);
        assert.deepEqual([...source.matchAll(/rel="canonical" href="([^"]+)"/g)].map(match => match[1]), [url]);
        assert.equal([...source.matchAll(/name="description"/g)].length, 1, url);
        assert.match(source.match(/<title>([^<]+)<\/title>/)?.[1] || "", /TikMnG/, url);
        assert.doesNotMatch(source, /<meta name="robots" content="noindex/i, url);
    }
    const prison = (await get("/oyunlar/hapisten-kac")).body.toString();
    assert.match(prison, /<h1>Hapisten Kaç<\/h1>/);
    assert.match(prison, /Punch Your Way Out Demo \(App ID: 5466880\)/);
    assert.match(prison, /href="https:\/\/store\.steampowered\.com\/app\/5466880\/"/);
    assert.match(prison, /href="\/gift-guides\/TikMnG-Hapisten-Kac-Hediyeler\.png" download/);
    assert.equal((await get("/oyunlar/bilinmeyen")).status, 404);
});

test("public duplicate paths redirect permanently without dropping query parameters", async () => {
    for (const [alias, target] of [
        ["/index.html?ref=oyun", "/?ref=oyun"],
        ["/gift-designer.html", "/hediye-tasarimi"],
        ["/hediye-tasarimi/", "/hediye-tasarimi"],
        ["/widgets.html", "/widgetlar"],
        ["/widgetlar/", "/widgetlar"],
        ["/oyunlar/HAPISTEN-KAC/?ref=katalog", "/oyunlar/hapisten-kac?ref=katalog"]
    ]) {
        const response = await get(alias);
        assert.equal(response.status, 301, alias);
        assert.equal(response.headers.location, target);
    }
});

test("public text negotiates compression and retains conditional requests, HEAD and byte ranges", async () => {
    const identity = await get("/");
    assert.match(identity.headers["cache-control"], /max-age=0, must-revalidate/);
    assert.match(identity.headers.vary, /Accept-Encoding/i);

    const br = await get("/", { "Accept-Encoding": "br, gzip" });
    assert.equal(br.headers["content-encoding"], "br");
    assert.deepEqual(brotliDecompressSync(br.body), identity.body);
    assert.ok(br.body.length < identity.body.length / 2);
    const gzip = await get("/", { "Accept-Encoding": "br;q=0, gzip;q=1" });
    assert.equal(gzip.headers["content-encoding"], "gzip");
    assert.deepEqual(gunzipSync(gzip.body), identity.body);

    const unchanged = await get("/", { "If-None-Match": identity.headers.etag, "Accept-Encoding": "br" });
    assert.equal(unchanged.status, 304);
    assert.equal(unchanged.body.length, 0);
    assert.match(unchanged.headers.vary, /Accept-Encoding/i);
    const head = await get("/", { "Accept-Encoding": "gzip" }, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);

    const css = await get("/portal-v4.css?v=20261115-web", { "Accept-Encoding": "gzip" });
    assert.equal(css.headers["content-encoding"], "gzip");
    assert.match(css.headers["cache-control"], /max-age=3600/);
    const range = await get("/portal-v4.css", { Range: "bytes=0-35", "Accept-Encoding": "br" });
    assert.equal(range.status, 206);
    assert.equal(range.headers["content-encoding"], undefined);
    assert.deepEqual(range.body, gunzipSync(css.body).subarray(0, 36));
    const hero = await get("/portal-hero-mobile-v3.webp", { "Accept-Encoding": "br" });
    assert.match(hero.headers["cache-control"], /max-age=31536000, immutable/);
    assert.equal(hero.headers["content-encoding"], undefined);
    assert.ok(hero.body.length < 130_000);
    assert.equal((await get("/api/test", { "Accept-Encoding": "br" })).headers["content-encoding"], undefined);
    assert.match((await get("/content-catalog-7.0.0.json")).headers["cache-control"], /max-age=0/);
});

test("checkout mode changes the homepage representation without leaving a stale response", async () => {
    const closed = await get("/");
    assert.match(closed.body.toString(), /name="tikmng-checkout" content="closed"/);
    checkoutReady = true;
    try {
        const available = await get("/", { "If-None-Match": closed.headers.etag });
        assert.equal(available.status, 200);
        assert.match(available.body.toString(), /name="tikmng-checkout" content="shopier"/);
        assert.notEqual(available.headers.etag, closed.headers.etag);
        assert.match(available.headers["cache-control"], /max-age=0, must-revalidate/);
    } finally {
        checkoutReady = false;
    }
});
