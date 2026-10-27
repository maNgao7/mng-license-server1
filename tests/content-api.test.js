import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MAX_UPLOAD_BYTES } from "../content-management.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const licenseFiles = ["lisanslar", "lisanslar_backup", "aktivasyon_log", "talepler", "kara_liste"];
const remote = "https://93.184.216.34/download/game.zip";
const mp4 = Buffer.concat([Buffer.from("000000186674797069736f6d0000020069736f6d6d703432", "hex"), Buffer.from("000000086d646174", "hex")]);
const webm = Buffer.from("1a45dfa3874282847765626d1853806700", "hex");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const legacyPackages = [
    ["vs", "6.5.7", "tiktok-vs"], ["puanlama", "6.5.7", "tiktok-vs"],
    ["crowd-control", "6.5.5", "crowd-control"], ["battle-game", "6.5.5", "battle-game"],
    ["duck-hunt", "6.5.5", "duck-hunt"], ["pony-life", "6.5.5", "pony-life"],
    ["frog-river", "6.5.5", "frog-river"], ["gelene-gecene", "6.1.2", "gelene-gecene"]
];

async function fixture(t, downloadOverrides = {}, { seed = true, initialCatalog } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tikmng-content-test-"));
    for (const name of licenseFiles) fs.writeFileSync(path.join(dir, `${name}.json`), "[]");
    if (seed) {
        const initial = JSON.parse(fs.readFileSync(path.join(root, 'content-defaults.json'), 'utf8'));
        initial.revision = 0; initial.publishedAt = null; initial.media = [];
        const catalog = initialCatalog || initial;
        fs.writeFileSync(path.join(dir, 'content-state.json'), JSON.stringify({draft:catalog,published:catalog}));
    }
    const secret = crypto.randomBytes(32).toString("hex");
    let child;
    let base;
    let cookie;
    async function stop() {
        if (!child || child.exitCode !== null || child.signalCode !== null) return;
        await new Promise(resolve => { child.once("exit", resolve); child.kill(); });
    }
    t.after(async () => {
        await stop();
        assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(), "tikmng-content-test-")));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    async function start() {
        const port = await new Promise(resolve => {
            const probe = net.createServer().listen(0, "127.0.0.1", () => {
                const port = probe.address().port; probe.close(() => resolve(port));
            });
        });
        const env = { ...process.env, HOST: "127.0.0.1", PORT: String(port), ADMIN_SIFRE: secret, MNG_DATA_DIR: dir,
            GITHUB_TOKEN: "", GITHUB_LICENSE_TOKEN: "", GITHUB_LICENSE_REPO: "", BACKUP_REPO: "" };
        for (const [, , folder] of legacyPackages) env[`GAME_DOWNLOAD_${folder.toUpperCase().replaceAll("-", "_")}_URL`] = "";
        Object.assign(env, downloadOverrides);
        child = spawn(process.execPath, ["server.js"], { cwd: root, env, windowsHide: true, stdio: "ignore" });
        base = `http://127.0.0.1:${port}`;
        let ready = false;
        for (let i = 0; i < 100; i++) {
            try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {}
            if (child.exitCode !== null) throw new Error("Isolated content server exited.");
            await new Promise(resolve => setTimeout(resolve, 40));
        }
        assert.ok(ready, "isolated server ready");
        const login = await fetch(base + "/api/admin/giris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: secret }) });
        assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
    }
    await start();
    const f = {
        dir, stop, start, secret, get base() { return base; }, get cookie() { return cookie; },
        async request(route, method = "GET", body, admin = true) {
            const response = await fetch(base + route, { method, headers: { ...(admin ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
            return { status: response.status, headers: response.headers, data: await response.json() };
        },
        async get() { return (await f.request("/api/admin/content")).data; },
        async public() { return (await f.request("/api/content/catalog", "GET", undefined, false)).data; },
        async save(draft, expectedRevision = draft.revision) { return f.request("/api/admin/content", "PUT", { draft, expectedRevision }); },
        async publish(expectedRevision) { return f.request("/api/admin/content/publish", "POST", { expectedRevision }); },
        async upload(body = mp4, filename = "sample.mp4", type = "video/mp4", headers = {}, admin = true) {
            const response = await fetch(`${base}/api/admin/content/upload?filename=${encodeURIComponent(filename)}`, { method: "POST", headers: { ...(admin ? { Cookie: cookie } : {}), "Content-Type": type, ...headers }, body });
            return { status: response.status, data: await response.json() };
        }
    };
    return f;
}
function draftGame() {
    return { schemaVersion: 1, revision: 0, publishedAt: null, games: [{ id: "vs", title: "Test game", description: "Plain text", version: "6.5.7", url: remote,
        sha256: null, bytes: null, requirements: "Windows", resources: [{ title: "Guide", url: "https://93.184.216.34/guide" }] }], media: [] };
}

test('server keeps the published catalog while the Minecraft candidate awaits private acceptance', async t => {
    const previous = JSON.parse(fs.readFileSync(path.join(root, 'content-bootstrap-7.0.6.json'), 'utf8'));
    const current = JSON.parse(fs.readFileSync(path.join(root, 'content-defaults.json'), 'utf8'));
    const f = await fixture(t, {}, { initialCatalog: previous });
    assert.deepEqual(await f.public(), current);
    const backup = path.join(f.dir, 'content-state.backup.json');
    assert.equal(fs.existsSync(backup), false);
    await f.stop(); await f.start();
    assert.deepEqual(await f.public(), current);
    assert.equal(fs.existsSync(backup), false);
});

test('server leaves a customized 7.0.6 catalog unchanged during the game release', async t => {
    const previous = JSON.parse(fs.readFileSync(path.join(root, 'content-bootstrap-7.0.6.json'), 'utf8'));
    previous.games[0].description = 'Administrator custom description';
    const f = await fixture(t, {}, { initialCatalog: previous });
    assert.deepEqual(await f.public(), previous);
    assert.equal(fs.existsSync(path.join(f.dir, 'content-state.backup.json')), false);
});

test("public defaults promote 16 games with pinned complete content and retain independent packages", async t => {
    const f = await fixture(t, {}, {seed:false});
    const response = await f.request("/api/content/catalog", "GET", undefined, false);
    assert.equal(response.status, 200); assert.equal(response.data.schemaVersion, 1);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("etag"), /^"[a-f0-9]{64}"$/);
    assert.equal(response.data.launcher, undefined);
    const byId = Object.fromEntries(response.data.games.map(item => [item.id, item]));
    assert.equal(response.data.games.length, 16);
    assert.equal(response.data.media.length, 285);
    assert.equal(response.data.revision, 6);
    assert.equal(byId.caahr.version, '0.6.12');
    assert.equal(byId.caahr.bytes, 63233577);
    assert.equal(byId['frog-river'].version,'7.0.5');
    assert.equal(byId['frog-river'].bytes,70661187);
    for(const id of ['caahr','frog-river']){assert.match(byId[id].sha256,/^[a-f0-9]{64}$/);assert.match(byId[id].url,/\/game-hotfix-7\.0\.5\//);}
    for (const [id, version, folder] of legacyPackages.filter(([id]) => id==='gelene-gecene')) {
        assert.equal(byId[id].version, version);
        assert.equal(byId[id].url, `https://mng-license-server1.onrender.com/download/game/${folder}.zip`);
        // These routes can redirect via GAME_DOWNLOAD_*_URL or serve a higher-priority data-directory ZIP.
        assert.equal(byId[id].sha256, null);
        assert.equal(byId[id].bytes, null);
    }
    const pinned = [
        ["battle-royale", "7.0.2", "battle-royale-7.0.2", 958445695, "01f1698f85fba3020c3d8a01057d8dbcc00bd4475e30cd0e7a4720a5f027bc68", "game-installers-7.0.2"],
        ["snow-war", "7.0.2", "snow-war-7.0.2", 914734468, "00fbd267ce37fa7877ebd0d42b38ea47233438b2f5f6dbd5210acdedb3e35fae", "game-installers-7.0.2"],
        ["zombie-war", "6.5.17", "zombie-war", 947576508, "9d2d641f05d2bec905522202d0f523e64bd5b4868e45f03148bfe37ece466749", "zombie-war-6.5.17"]
    ];
    for (const [id, version, folder, bytes, sha256, tag = `v${version}`] of pinned) {
        assert.equal(byId[id].version, version);
        assert.equal(byId[id].url, `https://github.com/maNgao7/mng-license-server1/releases/download/${tag}/${folder}.zip`);
        assert.equal(byId[id].bytes, bytes);
        assert.equal(byId[id].sha256, sha256);
    }
    for (const id of ['vs','puanlama','orbit','crowd-control','battle-game','duck-hunt','pony-life','penalty-kick','tightrope-balance','battle-royale','snow-war','minecraft-snake-arena']) {
        const game = byId[id];
        assert.equal(game.version, id === 'minecraft-snake-arena' ? '0.16.0' : '7.0.2');
        assert.match(game.url, id === 'minecraft-snake-arena' ? /\/game-snake-0\.16\.0\/[^/]+\.zip$/ : /\/game-installers-7\.0\.2\/[^/]+\.zip$/);
        assert.match(game.sha256, /^[a-f0-9]{64}$/); assert.ok(game.bytes > 0);
        assert.equal(game.files.length, 1); assert.equal(game.files[0].path, '.tikmng-content.json');
        assert.match(game.files[0].sha256, /^[a-f0-9]{64}$/); assert.ok(game.files[0].bytes > 0);
    }
    assert.deepEqual(byId.vs.files, byId.puanlama.files);
    assert.equal(byId.vs.url, byId.puanlama.url);
    assert.match(byId["gelene-gecene"].requirements, /Steam.*Unturned.*304930/);
    assert.ok(response.data.games.every(game => !/releases\/download\/v6\.5\.(?:0|5|7)\//.test(game.url)));
    assert.ok(!JSON.stringify(response.data).includes("C:\\"));
    for (const name of licenseFiles) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, `${name}.json`))), []);
});

test("legacy download URLs map to real root ZIPs and the existing Gelene Geçene mod package", async t => {
    const f = await fixture(t);
    // Reproduce the real downloads/games layout inside the isolated data directory.
    const modDirectory = path.join(f.dir, "downloads", "games");
    fs.mkdirSync(modDirectory, { recursive: true });
    fs.copyFileSync(path.join(root, "downloads", "games", "gelene-gecene.zip"), path.join(modDirectory, "gelene-gecene.zip"));
    for (const folder of new Set(legacyPackages.map(([, , folder]) => folder))) {
        const url = new URL(`/download/game/${folder}.zip`, "https://mng-license-server1.onrender.com");
        const response = await fetch(f.base + url.pathname, { headers: { Range: "bytes=0-15" }, redirect: "manual" });
        assert.equal(response.status, 206, folder);
        const local = path.join(root, ...(folder === "gelene-gecene" ? ["downloads", "games"] : []), `${folder}.zip`);
        const fd = fs.openSync(local, "r");
        const expected = Buffer.alloc(16);
        try { assert.equal(fs.readSync(fd, expected, 0, expected.length, 0), expected.length); }
        finally { fs.closeSync(fd); }
        assert.equal(expected.readUInt32LE(0), 0x04034b50);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
        assert.equal(response.headers.get("content-range"), `bytes 0-15/${fs.statSync(local).size}`);
    }
});

test("legacy overrides cannot replace the immutable published package or its hash", async t => {
    const f = await fixture(t, { GAME_DOWNLOAD_BATTLE_GAME_URL: remote });
    const game = (await f.public()).games.find(item => item.id === "battle-game");
    assert.match(game.url, /\/game-installers-7\.0\.2\/battle-game-7\.0\.2\.zip$/);
    assert.match(game.sha256, /^[a-f0-9]{64}$/); assert.ok(game.bytes > 0);
    const response = await fetch(f.base + '/download/game/battle-game.zip', { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), remote);
    await response.arrayBuffer();
});

test("admin reads, saves, publishing and binary uploads require the existing cookie session", async t => {
    const f = await fixture(t);
    for (const [url, method, body] of [["/api/admin/content", "GET"], ["/api/admin/content", "PUT", {}], ["/api/admin/content/publish", "POST", {}]]) {
        assert.equal((await f.request(url, method, body, false)).status, 401);
    }
    assert.equal((await f.upload(mp4, "test.mp4", "video/mp4", {}, false)).status, 401);
    const state = await f.get(); assert.deepEqual(Object.keys(state).sort(), ["draft", "published"]);
    const html = await (await fetch(f.base + "/admin/content.html")).text();
    assert.ok(html.includes('href="/admin/"'));
    const index = await (await fetch(f.base + "/admin/")).text();
    assert.match(index, /<a[^>]+href="\/admin\/content.html"/);
    assert.doesNotMatch(index, /data-view="content"/);
});

test("draft is private, expectedRevision protects save/publish, immutable snapshots and backup survive restart", async t => {
    const f = await fixture(t);
    const before = await f.public();
    const saved = await f.save(draftGame()); assert.equal(saved.status, 200);
    assert.equal(saved.data.draft.revision, 1); assert.equal(saved.data.draft.publishedAt, null);
    assert.deepEqual(await f.public(), before);
    assert.equal((await f.save(draftGame(), 0)).status, 409);
    assert.equal((await f.publish(0)).status, 409);
    assert.equal((await f.request("/api/admin/content/publish", "POST", {})).status, 400);
    const first = await f.publish(1); assert.equal(first.status, 200);
    assert.equal(first.data.published.revision, 2); assert.ok(Date.parse(first.data.published.publishedAt));
    assert.deepEqual(await f.public(), first.data.published);
    const snapshot = fs.readFileSync(path.join(f.dir, "content-revisions", "2.json"), "utf8");
    const secondDraft = structuredClone(first.data.draft); secondDraft.games[0].title = "Unpublished replacement";
    const second = await f.save(secondDraft); assert.equal(second.status, 200);
    assert.equal((await f.public()).games[0].title, "Test game");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, "content-state.backup.json"))).published, first.data.published);
    await f.stop(); await f.start();
    assert.deepEqual(await f.get(), second.data);
    const third = await f.publish(second.data.draft.revision); assert.equal(third.status, 200);
    assert.equal(fs.readFileSync(path.join(f.dir, "content-revisions", "2.json"), "utf8"), snapshot);
    assert.equal(third.data.published.games[0].title, "Unpublished replacement");
    const current = await f.public();
    const cached = await fetch(f.base + "/api/content/catalog", { headers: { "If-None-Match": `"${digest(JSON.stringify(current))}"` } });
    assert.equal(cached.headers.get("cache-control"), "no-store"); assert.ok([200, 304].includes(cached.status));
    for (const url of ["/content-state.json", "/content-state.backup.json", "/content-revisions/2.json", "/content-defaults.json", "/content-management.js"]) assert.equal((await fetch(f.base + url)).status, 404);
});

test("parallel writers cannot overwrite a revision", async t => {
    const f = await fixture(t);
    const a = draftGame(), b = draftGame(); b.games[0].title = "Concurrent";
    const results = await Promise.all([f.save(a), f.save(b)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const publications = await Promise.all([f.publish(1), f.publish(1)]);
    assert.deepEqual(publications.map(result => result.status).sort(), [200, 409]);
});

test("controlled fields, bounded lists, duplicate IDs, plain text, integrity and public-only URLs validate atomically", async t => {
    const f = await fixture(t);
    const original = await f.get();
    const cases = [
        d => { d.gifts = []; }, d => { d.games[0].actions = {}; }, d => { d.games[0].id = "../bad"; },
        d => { d.games.push(structuredClone(d.games[0])); }, d => { d.media = [{ id: "x", title: "X", category: "C", url: remote, sha256: null, bytes: null }, { id: "x", title: "X", category: "C", url: remote, sha256: null, bytes: null }]; },
        d => { d.games[0].title = "<script>alert(1)</script>"; }, d => { d.games[0].title = "x".repeat(121); },
        d => { d.games[0].description = "x".repeat(2001); }, d => { d.games[0].bytes = 100; }, d => { d.games[0].sha256 = "invalid"; },
        d => { d.games[0].version = "v 1"; }, d => { d.games[0].resources = Array(9).fill({ title: "X", url: remote }); },
        d => { d.games = Array(65).fill(d.games[0]); }, d => { d.media = Array(2001).fill({}); },
        ...["http://example.com/x", "javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com/file", "https://127.0.0.1/video", "https://2130706433/video", "https://10.0.0.1/a", "https://169.254.169.254/latest/meta-data", "https://172.16.0.1/", "https://192.168.0.1/", "https://100.64.0.1/", "https://[::1]/", "https://[::ffff:127.0.0.1]/", "https://localhost/", "https://device.local/x", "//example.com/x", "/content-assets/../server.js", "/content-assets/" + "a".repeat(64) + ".mp4", "https://example.com:444/x"].map(url => d => { d.games[0].url = url; })
    ];
    for (const mutate of cases) {
        const draft = draftGame(); mutate(draft);
        const result = await f.save(draft); assert.equal(result.status, 400, JSON.stringify(draft));
        assert.deepEqual(await f.get(), original);
        assert.ok(!JSON.stringify(result.data).includes(f.dir));
    }
    const large = draftGame(); large.media = Array.from({ length: 1200 }, (_, i) => ({id:`media-${i}`,title:'Test',category:'Test',url:'https://93.184.216.34/'+ 'x'.repeat(1800)+'.mp4',sha256:null,bytes:null}));
    assert.equal((await f.save(large)).status, 413);
    assert.deepEqual(await f.get(), original);
});

test("per-file patches and optional launcher metadata round-trip without changing release endpoints", async t => {
    const f = await fixture(t);
    const draft = draftGame();
    draft.games[0].files = [{ path: "public/game.js", url: "https://93.184.216.34/game.js", sha256: "a".repeat(64), bytes: 123 }];
    // Explicitly supplied metadata is independent from the existing release/version APIs.
    draft.launcher = { version: "6.5.16", downloadUrl: "https://93.184.216.34/TikMnG-Setup-6.5.16.exe", sha256: "b".repeat(64), bytes: 987, changelog: "Existing release" };
    const result = await f.save(draft); assert.equal(result.status, 200);
    assert.equal((await f.public()).launcher, undefined);
    const published = await f.publish(result.data.draft.revision); assert.equal(published.status, 200);
    assert.deepEqual((await f.public()).launcher, draft.launcher);
    assert.deepEqual((await f.public()).games[0].files, draft.games[0].files);
    const base = structuredClone(published.data.draft);
    for (const relative of ["../a.js", "/a.js", "./a.js", "a//b.js", "a\\b.js", "C:/a.js", "a:stream", "%2e%2e/a.js", "folder/NUL.txt", "CON", "a. ", "a/../b.js"]) {
        const invalid = structuredClone(base); invalid.games[0].files[0].path = relative;
        assert.equal((await f.save(invalid)).status, 400, relative);
    }
    for (const modify of [
        d => { d.games[0].files.push({ ...d.games[0].files[0], path: "PUBLIC/Game.js" }); },
        d => { d.games[0].files[0].sha256 = null; d.games[0].files[0].bytes = null; },
        d => { d.games[0].files[0].url = "https://127.0.0.1/a.js"; },
        d => { d.launcher.downloadUrl = "https://localhost/setup.exe"; },
        d => { d.launcher.changelog = "<b>bad</b>"; },
        d => { d.launcher.bytes = null; }, d => { d.launcher.extra = true; }
    ]) { const invalid = structuredClone(base); modify(invalid); assert.equal((await f.save(invalid)).status, 400); }
});

test("complete content descriptors round-trip, while nested, mixed and oversized control files are rejected", async t => {
    const f = await fixture(t);
    const draft = draftGame();
    const descriptor = { path: ".tikmng-content.json", url: "https://93.184.216.34/content.json", sha256: "c".repeat(64), bytes: 4096 };
    draft.games[0].files = [descriptor];
    const saved = await f.save(draft); assert.equal(saved.status, 200);
    assert.equal((await f.publish(saved.data.draft.revision)).status, 200);
    const base = (await f.get()).draft;
    assert.deepEqual(base.games[0].files, [descriptor]);
    for (const files of [
        [{ ...descriptor, path: "nested/.tikmng-content.json" }],
        [{ ...descriptor, path: ".tikmng-package.json" }],
        [{ ...descriptor, bytes: 16 * 1024 * 1024 + 1 }],
        [descriptor, { ...descriptor, path: "ordinary.js" }]
    ]) {
        const invalid = structuredClone(base); invalid.games[0].files = files;
        assert.equal((await f.save(invalid)).status, 400);
    }
});

test("MP4 and WebM uploads are immutable, hashed, ranged, private storage paths stay hidden and assets survive restart", async t => {
    const f = await fixture(t);
    const originalPublic = await f.public();
    for (const [body, name, type] of [[mp4, "movie.mp4", "video/mp4"], [webm, "movie.webm", "video/webm"]]) {
        const result = await f.upload(body, name, type); assert.equal(result.status, 201);
        assert.equal(result.data.sha256, digest(body)); assert.equal(result.data.bytes, body.length);
        assert.match(result.data.url, /^\/content-assets\/[a-f0-9]{64}\.(mp4|webm)$/);
        assert.ok(!JSON.stringify(result.data).includes(f.dir));
        const response = await fetch(f.base + result.data.url); assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), type);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
        const partial = await fetch(f.base + result.data.url, { headers: { Range: "bytes=0-7" } });
        assert.equal(partial.status, 206); assert.equal(partial.headers.get("content-range"), `bytes 0-7/${body.length}`);
        assert.deepEqual(Buffer.from(await partial.arrayBuffer()), body.subarray(0, 8));
        const suffix = await fetch(f.base + result.data.url, { headers: { Range: "bytes=-4" } });
        assert.equal(suffix.status, 206); assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), body.subarray(-4));
        assert.equal((await fetch(f.base + result.data.url, { headers: { Range: "bytes=99999-" } })).status, 416);
        assert.equal((await fetch(f.base + result.data.url, { method: "HEAD" })).status, 200);
        assert.equal((await f.upload(body, name, type)).data.url, result.data.url);
    }
    const upload = (await f.upload()).data;
    const draft = draftGame(); draft.media = [{ ...upload, title: "Uploaded video", category: "Background" }];
    draft.games[0].files = [{ path: "background.mp4", url: upload.url, sha256: upload.sha256, bytes: upload.bytes }];
    const saved = await f.save(draft); assert.equal(saved.status, 200);
    assert.deepEqual((await f.public()).media, originalPublic.media);
    const invalid = structuredClone(saved.data.draft); invalid.media[0].bytes++;
    assert.equal((await f.save(invalid)).status, 400);
    assert.equal((await f.publish(saved.data.draft.revision)).status, 200);
    await f.stop(); await f.start();
    assert.deepEqual((await f.public()).media, draft.media);
    assert.equal((await fetch(f.base + upload.url)).status, 200);
    assert.deepEqual(fs.readdirSync(path.join(f.dir, "content-assets")).sort(), [`${digest(mp4)}.mp4`, `${digest(webm)}.webm`].sort());
    for (const target of ["/content-assets/..%2fcontent-state.json", "/content-assets/%2e%2e/server.js", "/content-assets/.hidden.tmp", "/content-assets/unknown.exe"]) assert.equal((await fetch(f.base + target)).status, 404);
});

test("video upload rejects executable data, MIME/header mismatches, traversal, encoding and oversized declarations", async t => {
    const f = await fixture(t);
    for (const [body, name, type, headers, status] of [
        [Buffer.from("MZ executable"), "movie.mp4", "video/mp4", {}, 415],
        [webm, "movie.mp4", "video/mp4", {}, 415], [mp4, "movie.webm", "video/webm", {}, 415],
        [mp4, "movie.mp4", "application/octet-stream", {}, 415], [mp4, "movie.mp4", "video/mp4", { "Content-Encoding": "gzip" }, 415],
        [Buffer.alloc(0), "movie.mp4", "video/mp4", {}, 415],
        [mp4, "../movie.mp4", "video/mp4", {}, 400], [mp4, "..\\movie.mp4", "video/mp4", {}, 400],
        [mp4, "movie.exe", "video/mp4", {}, 400], [mp4, "movie.mp4.exe", "video/mp4", {}, 400],
        [mp4, "movie.svg", "video/mp4", {}, 400]
    ]) assert.equal((await f.upload(body, name, type, headers)).status, status, name);
    // Expect: 100-continue lets the server reject the size without transmitting 100 MB.
    const http = await import("node:http");
    const oversized = await new Promise((resolve, reject) => {
        const request = http.request(f.base + "/api/admin/content/upload?filename=large.mp4", { method: "POST", headers: { Cookie: f.cookie, "Content-Type": "video/mp4", "Content-Length": MAX_UPLOAD_BYTES + 1, Expect: "100-continue" } }, response => { response.resume(); resolve(response.statusCode); request.destroy(); });
        request.on("error", error => { if (error.code !== "ECONNRESET") reject(error); });
        request.flushHeaders();
    });
    assert.equal(oversized, 413);
    assert.deepEqual(fs.readdirSync(path.join(f.dir, "content-assets")), []);
});

test("chunked uploads enforce the streaming byte limit and remove partial files", async t => {
    const f = await fixture(t);
    const chunk = Buffer.alloc(256 * 1024); mp4.copy(chunk);
    let count = 0;
    const body = new ReadableStream({ pull(controller) {
        if (count++ < MAX_UPLOAD_BYTES / chunk.length + 1) controller.enqueue(chunk); else controller.close();
    } });
    const response = await fetch(f.base + "/api/admin/content/upload?filename=large.mp4", { method: "POST", duplex: "half", headers: { Cookie: f.cookie, "Content-Type": "video/mp4" }, body });
    assert.equal(response.status, 413); await response.arrayBuffer();
    assert.deepEqual(fs.readdirSync(path.join(f.dir, "content-assets")), []);
});

test("backup recovery preserves the previous committed catalog and skips orphan immutable revision numbers", async t => {
    const f = await fixture(t);
    const saved = await f.save(draftGame()); assert.equal(saved.status, 200);
    const published = await f.publish(saved.data.draft.revision); assert.equal(published.status, 200);
    const next = structuredClone(published.data.draft); next.games[0].title = "Later draft";
    await f.save(next);
    await f.stop();
    fs.writeFileSync(path.join(f.dir, "content-state.json"), "broken");
    fs.writeFileSync(path.join(f.dir, "content-revisions", "20.json"), "orphan snapshot");
    await f.start();
    assert.deepEqual(await f.public(), published.data.published);
    const restored = await f.get();
    const result = await f.publish(restored.draft.revision); assert.equal(result.status, 200);
    assert.equal(result.data.published.revision, 21);
    assert.equal(fs.readFileSync(path.join(f.dir, "content-revisions", "20.json"), "utf8"), "orphan snapshot");
});

test("failed durable saves and publications leave committed memory, public catalog and snapshots unchanged", async t => {
    const f = await fixture(t);
    const original = await f.get();
    const backup = path.join(f.dir, "content-state.backup.json");
    fs.mkdirSync(backup);
    assert.equal((await f.save(draftGame())).status, 503);
    assert.deepEqual(await f.get(), original);
    fs.rmdirSync(backup);
    const saved = await f.save(draftGame()); assert.equal(saved.status, 200);
    fs.unlinkSync(backup); fs.mkdirSync(backup);
    const result = await f.publish(saved.data.draft.revision); assert.equal(result.status, 503);
    assert.deepEqual(await f.get(), saved.data);
    assert.deepEqual(await f.public(), original.published);
    assert.deepEqual(fs.readdirSync(path.join(f.dir, "content-revisions")), []);
    assert.ok(!JSON.stringify(result.data).includes(f.dir));
    fs.rmdirSync(backup);
    assert.equal((await f.publish(saved.data.draft.revision)).status, 200);
});

test("browser forms cover login, game patches, media upload/edit/delete, launcher opt-in, conflicts and responsive layout", { skip: !process.env.PLAYWRIGHT_MODULE }, async t => {
    const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
    const f = await fixture(t);
    assert.equal((await f.save(draftGame())).status, 200);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(f.base + "/admin/content.html");
    await page.locator("#authRequired").waitFor({ state: "visible" });
    await page.getByRole("link", { name: "Yönetici girişine git" }).click();
    await page.locator("#adminPassword").fill(f.secret);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.locator("#adminPanel").waitFor({ state: "visible" });
    await page.getByRole("link", { name: "İçerik kataloğu", exact: true }).click();
    await page.locator("#catalogApp").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Test game düzenle", exact: true }).click();
    await page.locator('[name="title"]').fill("Updated game");
    await page.locator('[name="version"]').fill("6.5.8");
    await page.locator("#addFile").click();
    await page.locator('[data-patch="path"]').fill("public/game.js");
    await page.locator('[data-patch="url"]').fill("https://93.184.216.34/game.js");
    await page.locator('[data-patch="sha256"]').fill("c".repeat(64));
    await page.locator('[data-patch="bytes"]').fill("432");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#editStatus").textContent === "Taslak kaydedildi");
    assert.equal((await f.get()).draft.games[0].files[0].path, "public/game.js");
    assert.equal((await f.public()).games.some(item => item.title === "Updated game"), false);
    page.once("dialog", dialog => dialog.accept()); await page.locator("#publish").click();
    await page.waitForFunction(() => document.querySelector("#status").textContent.includes("ile güncel"));
    assert.equal((await f.public()).games[0].title, "Updated game");
    assert.equal((await f.public()).games[0].version, "6.5.8");
    await page.locator("#publishedMode").click();
    await page.getByRole("button", { name: "Updated game görüntüle" }).click();
    assert.equal(await page.locator('[name="title"]').getAttribute("readonly"), "");
    assert.equal(await page.locator("#save").isVisible(), false);
    await page.locator("#draftMode").click();
    await page.locator("#mediaTab").click(); await page.locator("#add").click();
    await page.locator("#videoFile").setInputFiles({ name: "intro.mp4", mimeType: "video/mp4", buffer: mp4 });
    await page.locator("#upload").click();
    await page.waitForFunction(() => document.querySelector("#uploadStatus").textContent === "Yüklendi");
    await page.locator('[name="id"]').fill("intro"); await page.locator('[name="title"]').fill("Intro video");
    await page.locator('[name="category"]').fill("Background");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#editStatus").textContent === "Taslak kaydedildi");
    await page.locator("#categoryFilter").selectOption("Background");
    assert.equal(await page.locator("#rows tr").count(), 1);
    await page.locator('[name="category"]').fill("Scenes"); await page.locator("#save").click();
    await page.waitForFunction(() => document.querySelector("#editStatus").textContent === "Taslak kaydedildi");
    assert.equal((await f.get()).draft.media[0].category, "Scenes");
    page.once("dialog", dialog => dialog.accept()); await page.locator("#deleteEntry").click();
    await page.waitForFunction(() => document.querySelector("#mediaCount").textContent === "0");
    assert.deepEqual((await f.get()).draft.media, []);
    await page.locator("#launcherTab").click();
    assert.equal(await page.locator("#launcherEnabled").isChecked(), false);
    await page.locator("#launcherEnabled").check();
    await page.locator("#launcherVersion").fill("6.5.16"); await page.locator("#launcherUrl").fill("https://93.184.216.34/installer.exe");
    await page.locator("#launcherHash").fill("d".repeat(64)); await page.locator("#launcherBytes").fill("1024");
    await page.locator("#launcherChangelog").fill("Current release"); await page.locator("#saveLauncher").click();
    await page.waitForFunction(() => document.querySelector("#launcherStatus").textContent === "Taslak kaydedildi");
    assert.equal((await f.get()).draft.launcher.version, "6.5.16");
    assert.equal((await f.public()).launcher, undefined);
    await page.locator("#launcherEnabled").uncheck(); await page.locator("#saveLauncher").click();
    await page.waitForFunction(() => document.querySelector("#launcherStatus").textContent === "Taslak kaydedildi");
    assert.equal((await f.get()).draft.launcher, undefined);
    await page.locator("#gamesTab").click();
    await page.getByRole("button", { name: "Updated game düzenle" }).click();
    await page.locator('[name="description"]').fill("Browser pending edit");
    const concurrent = (await f.get()).draft; concurrent.games[0].description = "Other administrator";
    assert.equal((await f.save(concurrent)).status, 200);
    await page.locator("#save").click();
    await page.locator("#error").waitFor({ state: "visible" });
    assert.ok((await page.locator("#error").textContent()).includes("başka bir oturumda"));
    assert.equal(await page.locator('[name="description"]').inputValue(), "Browser pending edit");
    page.once("dialog", dialog => dialog.accept()); await page.locator("#reload").click();
    await page.getByRole("button", { name: "Updated game düzenle" }).click();
    await page.waitForFunction(() => document.querySelector('[name="description"]').value === "Other administrator");
    const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), "tikmng-content-browser-"));
    for (const width of [1440, 760, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({ path: path.join(screenshots, `${width}.png`), fullPage: true });
        const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(element => {
            const r = element.getBoundingClientRect(); return r.width && r.right > innerWidth && !element.closest(".table-scroll");
        }).map(element => `${element.tagName}.${element.className}#${element.id}`));
        if (overflow.length) t.diagnostic(JSON.stringify({ width, overflow, screenshots }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}`);
        assert.ok(await page.locator("#save").isVisible());
    }
    t.diagnostic(`Browser screenshots: ${screenshots}`);
    assert.deepEqual(errors, []);
    await context.clearCookies(); await page.locator("#reload").click();
    await page.locator("#authRequired").waitFor({ state: "visible" });
});
