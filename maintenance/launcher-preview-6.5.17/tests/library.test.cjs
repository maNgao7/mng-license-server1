"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const crypto = require("node:crypto");
const { createGameLibrary } = require("../lib/game-library.cjs");
const { download, checkDiskSpace } = require("../lib/download.cjs");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const valid = dir => fs.existsSync(path.join(dir, "run.txt"));

// Small stored ZIP fixtures; production parsing/extraction uses yauzl/extract-zip.
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function zipFixture(files) {
    const local = [], central = [];
    let offset = 0;
    for (const item of files) {
        const name = Buffer.from(item.name);
        const data = Buffer.from(item.data || "");
        const crc = crc32(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(data.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(name.length, 26);
        local.push(header, name, data);
        const directory = Buffer.alloc(46);
        directory.writeUInt32LE(0x02014b50, 0);
        directory.writeUInt16LE(0x0314, 4);
        directory.writeUInt16LE(20, 6);
        directory.writeUInt32LE(crc, 16);
        directory.writeUInt32LE(data.length, 20);
        directory.writeUInt32LE(data.length, 24);
        directory.writeUInt16LE(name.length, 28);
        directory.writeUInt32LE(((item.mode || 0o100644) * 65536) >>> 0, 38);
        directory.writeUInt32LE(offset, 42);
        central.push(directory, name);
        offset += header.length + name.length + data.length;
    }
    const index = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(index.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, index, end]);
}

async function fixture(t) {
    const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), "mng-library-test-"));
    const root = path.join(temporary, "configured-root");
    const legacy = path.join(temporary, "external-legacy");
    await fsp.mkdir(legacy);
    const routes = new Map();
    const requests = [];
    const server = http.createServer((req, res) => {
        requests.push({ path: req.url, headers: req.headers });
        const route = routes.get(req.url);
        if (!route) { res.writeHead(404).end(); return; }
        if (typeof route === "function") route(req, res);
        else res.writeHead(200, { "Content-Length": route.length, ETag: '"fixture"' }).end(route);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        const resolved = path.resolve(temporary);
        assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
        assert.ok(path.basename(resolved).startsWith("mng-library-test-"));
        await fsp.rm(resolved, { recursive: true, force: true });
    });
    return { temporary, root, legacy, routes, requests, origin };
}

async function write(dir, relative, data) {
    const file = path.join(dir, relative);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, data);
}

function setupLibrary(f, overrides = {}) {
    const archive = zipFixture([{ name: "bundle/run.txt", data: "new executable" }]);
    f.routes.set("/game.zip", archive);
    let pkg = { version: "2.0.0", url: `${f.origin}/game.zip`, bytes: archive.length, sha256: sha(archive) };
    const progress = [];
    const options = { root: f.root, definitions: { game: { id: "game", klasor: "game", paketSurumu: "2.0.0" } },
        resolveLegacy: () => f.legacy, validate: valid, getPackage: () => pkg,
        onProgress: data => progress.push(data), ...overrides };
    return { library: createGameLibrary(options), options, progress, setPackage: next => { pkg = next; } };
}

test('updating one game preserves another game and survives a launcher restart', async t => {
    const f = await fixture(t);
    const packages = {};
    function publish(id, version, executable) {
        const archive = zipFixture([{ name: 'bundle/run.txt', data: executable }]);
        const url = `/${id}-${version}.zip`;
        f.routes.set(url, archive);
        packages[id] = { version, url: f.origin + url, bytes: archive.length, sha256: sha(archive) };
    }
    publish('alpha', '1.0.0', 'alpha old');publish('beta', '4.2.0', 'beta unchanged');
    const options = { root: f.root, definitions: { alpha: { id: 'alpha', klasor: 'alpha' }, beta: { id: 'beta', klasor: 'beta' } },
        getPackage: id => packages[id], validate: valid, preservePaths: () => ['settings.json'] };
    let library = createGameLibrary(options);
    await library.install('alpha');await library.install('beta');
    const oldAlpha = library.pathFor('alpha');const beta = library.pathFor('beta');
    await write(oldAlpha, 'settings.json', '{"giftId":"7934","volume":0.35}');
    await write(beta, 'settings.json', '{"untouched":true}');
    const betaPointer = await fsp.readFile(path.join(f.root, '.game-library', 'beta', 'active.json'));
    const requests = f.requests.length;
    publish('alpha', '1.0.1', 'alpha new');
    assert.equal(library.state('alpha').updateAvailable, true);
    assert.equal(library.state('beta').updateAvailable, false);
    await library.install('alpha');
    assert.notEqual(library.pathFor('alpha'), oldAlpha);
    assert.equal(await fsp.readFile(path.join(library.pathFor('alpha'), 'run.txt'), 'utf8'), 'alpha new');
    assert.equal(await fsp.readFile(path.join(library.pathFor('alpha'), 'settings.json'), 'utf8'), '{"giftId":"7934","volume":0.35}');
    assert.equal(library.pathFor('beta'), beta);
    assert.equal(await fsp.readFile(path.join(beta, 'run.txt'), 'utf8'), 'beta unchanged');
    assert.equal(await fsp.readFile(path.join(beta, 'settings.json'), 'utf8'), '{"untouched":true}');
    assert.deepEqual(await fsp.readFile(path.join(f.root, '.game-library', 'beta', 'active.json')), betaPointer);
    assert.deepEqual(f.requests.slice(requests).map(item=>item.path), ['/alpha-1.0.1.zip']);
    library = createGameLibrary(options);
    assert.equal(library.state('alpha').installedVersion, '1.0.1');
    assert.equal(library.state('beta').installedVersion, '4.2.0');
    assert.equal(library.pathFor('beta'), beta);
});

test("download export resumes an interrupted response with Range and If-Range", async t => {
    const f = await fixture(t);
    const data = crypto.randomBytes(65536);
    let count = 0;
    f.routes.set("/interrupted", (req, res) => {
        count++;
        if (count === 1) {
            res.writeHead(200, { "Content-Length": data.length, ETag: '"resume-v1"' });
            res.write(data.subarray(0, 8192));
            setTimeout(() => res.destroy(), 20);
        } else {
            const start = Number(/^bytes=(\d+)-$/.exec(req.headers.range)?.[1]);
            assert.ok(start > 0 && start < data.length);
            assert.equal(req.headers["if-range"], '"resume-v1"');
            res.writeHead(206, { "Content-Length": data.length - start,
                "Content-Range": `bytes ${start}-${data.length - 1}/${data.length}`, ETag: '"resume-v1"' });
            res.end(data.subarray(start));
        }
    });
    const events = [];
    const file = path.join(f.temporary, "download.bin");
    const result = await download(`${f.origin}/interrupted`, file, {
        sha256: sha(data), bytes: data.length, retryDelayMs: 1, onProgress: p => events.push(p)
    });
    assert.equal(count, 2);
    assert.deepEqual(await fsp.readFile(file), data);
    assert.equal(result.bytes, data.length);
    assert.equal(result.sha256, sha(data));
    assert.equal(fs.existsSync(`${file}.part`), false);
    assert.ok(events.some(p => p.speedBps > 0 && Number.isFinite(p.etaSeconds)));
    assert.equal(events.at(-1).transferredBytes, data.length);
    assert.equal(events.at(-1).percent, 100);
});

test("unknown-size streaming progress stays indeterminate, including completion", async t => {
    const f = await fixture(t);
    f.routes.set("/chunked", (_req, res) => { res.write("one"); setTimeout(() => res.end("two"), 5); });
    const events = [];
    const result = await download(`${f.origin}/chunked`, path.join(f.temporary, "unknown"), { onProgress: p => events.push(p) });
    assert.equal(result.bytes, 6);
    assert.ok(events.length >= 3);
    assert.ok(events.every(p => p.percent === null && p.totalBytes === null && p.etaSeconds === null));
});

test("wrong hashes and byte counts never replace an existing destination", async t => {
    const f = await fixture(t);
    f.routes.set("/wrong", Buffer.from("bad"));
    const file = path.join(f.temporary, "kept.bin");
    await fsp.writeFile(file, "previous");
    await assert.rejects(download(`${f.origin}/wrong`, file, { sha256: sha("good"), retries: 1, retryDelayMs: 1 }), { code: "EHASH" });
    assert.equal((await fsp.readFile(file)).toString(), "previous");
    assert.equal(fs.existsSync(`${file}.part`), false);
    await assert.rejects(download(`${f.origin}/wrong`, file, { bytes: 7, retries: 0 }), { code: "ESIZE" });
    assert.equal((await fsp.readFile(file)).toString(), "previous");
});

test("abort retains partial data; a later call safely resumes it", async t => {
    const f = await fixture(t);
    const data = crypto.randomBytes(131072);
    f.routes.set("/abort", (req, res) => {
        const start = Number(/^bytes=(\d+)-$/.exec(req.headers.range || "")?.[1] || 0);
        const headers = { "Content-Length": data.length - start, ETag: '"abort-v1"' };
        if (start) headers["Content-Range"] = `bytes ${start}-${data.length - 1}/${data.length}`;
        res.writeHead(start ? 206 : 200, headers);
        let cursor = start;
        const timer = setInterval(() => {
            if (cursor >= data.length) { clearInterval(timer); res.end(); return; }
            res.write(data.subarray(cursor, cursor + 2048));
            cursor += 2048;
        }, 3);
        res.on("close", () => clearInterval(timer));
    });
    const file = path.join(f.temporary, "abort.bin");
    const controller = new AbortController();
    let scheduled = false;
    await assert.rejects(download(`${f.origin}/abort`, file, {
        signal: controller.signal, bytes: data.length, sha256: sha(data),
        onProgress: p => {
            if (p.transferredBytes && !scheduled) { scheduled = true; setTimeout(() => controller.abort(), 15); }
        }
    }), { name: "AbortError" });
    assert.ok((await fsp.stat(`${file}.part`)).size > 0);
    assert.equal(fs.existsSync(file), false);
    await download(`${f.origin}/abort`, file, { bytes: data.length, sha256: sha(data) });
    assert.equal(f.requests.at(-1).headers["if-range"], '"abort-v1"');
    assert.deepEqual(await fsp.readFile(file), data);
});

test("a server ignoring Range restarts instead of appending different bytes", async t => {
    const f = await fixture(t);
    const file = path.join(f.temporary, "restart.bin");
    const data = Buffer.from("replacement bytes");
    f.routes.set("/ignore", data);
    await fsp.writeFile(`${file}.part`, "stale");
    await fsp.writeFile(`${file}.part.json`, JSON.stringify({ url: `${f.origin}/ignore`, sha256: sha(data),
        bytes: data.length, validator: '"stale"', totalBytes: data.length }));
    await download(`${f.origin}/ignore`, file, { bytes: data.length, sha256: sha(data) });
    assert.equal(f.requests[0].headers.range, "bytes=5-");
    assert.deepEqual(await fsp.readFile(file), data);
});

test("timeouts, retryable HTTP failures, redirects, and permanent failures are bounded", async t => {
    const f = await fixture(t);
    f.routes.set("/stall", () => {});
    await assert.rejects(download(`${f.origin}/stall`, path.join(f.temporary, "stall"), { retries: 1, timeoutMs: 25, retryDelayMs: 1 }), { code: "ETIMEDOUT" });
    assert.equal(f.requests.filter(r => r.path === "/stall").length, 2);
    let count = 0;
    f.routes.set("/flaky", (_req, res) => { if (++count === 1) res.writeHead(503).end(); else res.end("ok"); });
    f.routes.set("/redirect", (_req, res) => res.writeHead(302, { Location: "/flaky" }).end());
    await download(`${f.origin}/redirect`, path.join(f.temporary, "redirect"), { retryDelayMs: 1 });
    assert.equal(count, 2);
    await assert.rejects(download(`${f.origin}/missing`, path.join(f.temporary, "missing")), /HTTP 404/);
    assert.equal(f.requests.filter(r => r.path === "/missing").length, 1);
});

test("malformed Content-Range is discarded and retried from byte zero", async t => {
    const f = await fixture(t);
    const data = Buffer.from("safe replacement");
    const file = path.join(f.temporary, "range.bin");
    await fsp.writeFile(`${file}.part`, "safe");
    await fsp.writeFile(`${file}.part.json`, JSON.stringify({ url: `${f.origin}/range`, sha256: sha(data),
        bytes: data.length, validator: '"r"', totalBytes: data.length }));
    f.routes.set("/range", (req, res) => {
        if (req.headers.range) res.writeHead(206, { "Content-Range": `bytes 1-4/${data.length}`, "Content-Length": 4 }).end("oops");
        else res.writeHead(200, { "Content-Length": data.length }).end(data);
    });
    await download(`${f.origin}/range`, file, { sha256: sha(data), bytes: data.length, retryDelayMs: 1 });
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].headers.range, undefined);
    assert.deepEqual(await fsp.readFile(file), data);
});

test("old external installs remain playable and report update availability synchronously", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    await write(f.legacy, ".tikmng-package.json", JSON.stringify({ version: "1.0.0" }));
    const { library } = setupLibrary(f);
    const state = library.state("game");
    assert.equal(state.then, undefined);
    assert.deepEqual(state, { installed: true, installedVersion: "1.0.0", availableVersion: "2.0.0", updateAvailable: true, path: f.legacy });
    assert.equal(library.pathFor("game"), f.legacy);
});

test("atomic install honors configured root, preserves settings, and retains the legacy tree", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    await write(f.legacy, "settings.json", "custom settings");
    await write(f.legacy, "saves/world.bin", "precious save");
    await write(f.legacy, "config/user.json", "custom config");
    const { library, progress, options } = setupLibrary(f, { preservePaths: () => ["config", "settings.json", "saves"] });
    const result = await library.install("game");
    assert.ok(result.path.startsWith(path.join(f.root, ".game-library", "game", "versions") + path.sep));
    assert.equal((await fsp.readFile(path.join(result.path, "run.txt"))).toString(), "new executable");
    for (const relative of ["settings.json", "saves/world.bin", "config/user.json"]) {
        assert.deepEqual(await fsp.readFile(path.join(result.path, relative)), await fsp.readFile(path.join(f.legacy, relative)));
    }
    await write(result.path, "settings.json", "edited new settings");
    assert.equal((await fsp.readFile(path.join(f.legacy, "settings.json"))).toString(), "custom settings");
    assert.deepEqual(createGameLibrary(options).state("game"), library.state("game"));
    assert.ok(progress.every(p => p.oyun === "game" && "phase" in p && "etaSeconds" in p));
    assert.ok(progress.filter(p => ["extracting", "preserving", "validating", "activating"].includes(p.phase)).every(p => p.percent === null));
});

test("all current game families preserve their mutable data", async t => {
    const cases = [
        ["battle-royale", { minecraft: true, configFile: "mng-battle-royale.json" }, "game-instance/config/mng-battle-royale.json"],
        ["snow-war", { minecraft: true, configFile: "mng-snow-war.json" }, "game-instance/options.txt"],
        ["zombie-war", {}, "game-instance/config/mng-zombie-strike.json"],
        ["vs", { klasor: "tiktok-vs" }, ".gift-slots.json"],
        ["puanlama", { klasor: "tiktok-vs" }, ".coin-data.json"],
        ["pony-life", {}, "data/pony-live.json"],
        ["frog-river", {}, "settings.json"],
        ["tightrope-balance", {}, "settings.json"],
        ["gelene-gecene", {}, "unturned_mng_config.json"],
        ["orbit", {}, "euler-api-key.txt"],
        ["crowd-control", {}, "euler-api-key.txt"],
        ["battle-game", {}, "saves/round.json"],
        ["duck-hunt", {}, "settings.json"],
        ["penalty-kick", {}, "settings.json"]
    ];
    for (const [id, definition, relative] of cases) {
        await t.test(id, async t => {
            const f = await fixture(t);
            await write(f.legacy, "run.txt", "old");
            await write(f.legacy, relative, `custom ${id}`);
            const { library } = setupLibrary(f, { definitions: { [id]: { id, ...definition } } });
            const state = await library.install(id);
            assert.equal((await fsp.readFile(path.join(state.path, relative))).toString(), `custom ${id}`);
        });
    }
});

test("same-package aliases deduplicate installs and share their pointer", async t => {
    const f = await fixture(t);
    let calls = 0;
    const archive = zipFixture([{ name: "run.txt", data: "alias" }]);
    f.routes.set("/alias", archive);
    const definitions = { vs: { id: "vs", klasor: "tiktok-vs" }, puanlama: { id: "puanlama", klasor: "tiktok-vs" },
        "crowd-control": { id: "crowd-control", klasor: "crowd-control" }, crowdControl: { id: "crowd-control", klasor: "crowd-control" } };
    const { library } = setupLibrary(f, { definitions, getPackage: async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { version: "1", url: `${f.origin}/alias`, sha256: sha(archive) };
    } });
    const first = library.install("vs");
    assert.equal(first, library.install("puanlama"));
    await first;
    assert.equal(calls, 1);
    assert.equal(library.pathFor("vs"), library.pathFor("puanlama"));
    const crowd = library.install("crowdControl");
    assert.equal(crowd, library.install("crowd-control"));
    await crowd;
    assert.equal(calls, 2);
    assert.equal(library.pathFor("crowdControl"), library.pathFor("crowd-control"));
});

test("validation and activation failures keep the previous pointer and playable version", async t => {
    const f = await fixture(t);
    const { library, setPackage } = setupLibrary(f);
    const first = await library.install("game");
    await write(first.path, "settings.json", "keep me");
    const pointer = path.join(f.root, ".game-library/game/active.json");
    const previousPointer = await fsp.readFile(pointer);
    const bad = zipFixture([{ name: "wrong.txt", data: "invalid" }]);
    f.routes.set("/bad", bad);
    setPackage({ version: "3.0.0", url: `${f.origin}/bad`, sha256: sha(bad) });
    await assert.rejects(library.install("game"), { code: "EPACKAGE" });
    assert.deepEqual(await fsp.readFile(pointer), previousPointer);
    assert.equal(library.pathFor("game"), first.path);
    assert.equal(library.state("game").updateAvailable, true);
    const next = zipFixture([{ name: "run.txt", data: "next" }]);
    f.routes.set("/next", next);
    setPackage({ version: "3.0.0", url: `${f.origin}/next`, sha256: sha(next) });
    const rename = fsp.rename;
    const mock = t.mock.method(fsp, "rename", async (from, to) => {
        if (to === pointer) throw Object.assign(new Error("Simulated pointer write failure"), { code: "EACCES" });
        return rename(from, to);
    });
    await assert.rejects(library.install("game"), /Simulated pointer write failure/);
    mock.mock.restore();
    assert.deepEqual(await fsp.readFile(pointer), previousPointer);
    assert.equal(library.pathFor("game"), first.path);
    const updated = await library.install("game");
    assert.notEqual(updated.path, first.path);
    assert.equal((await fsp.readFile(path.join(updated.path, "settings.json"))).toString(), "keep me");
    assert.equal((await fsp.readFile(path.join(first.path, "run.txt"))).toString(), "new executable");
});

test("abort at activation keeps the previous pointer unchanged", async t => {
    const f = await fixture(t);
    const controller = new AbortController();
    const { library } = setupLibrary(f, { onProgress: p => { if (p.phase === "activating") controller.abort(); } });
    await write(f.legacy, "run.txt", "legacy");
    await assert.rejects(library.install("game", { signal: controller.signal }), { name: "AbortError" });
    assert.equal(library.pathFor("game"), f.legacy);
    assert.equal(fs.existsSync(path.join(f.root, ".game-library/game/active.json")), false);
});

test("running games block install/remove and activation rechecks running state", async t => {
    const f = await fixture(t);
    let running = true;
    const { library } = setupLibrary(f, { isRunning: () => running, onProgress: p => { if (p.phase === "validating") running = true; } });
    await assert.rejects(library.install("game"), { code: "EBUSY" });
    await assert.rejects(library.remove("game"), { code: "EBUSY" });
    running = false;
    await assert.rejects(library.install("game"), { code: "EBUSY" });
    assert.equal(library.state("game").installed, false);
});

test("remove deactivates aliases, retains all versions and legacy saves, and allows reinstall", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    const { library } = setupLibrary(f);
    const first = await library.install("game");
    await write(first.path, "settings.json", "managed preferences");
    const removed = await library.remove("game");
    assert.equal(removed.installed, false);
    assert.equal(library.pathFor("game"), null);
    assert.ok(fs.existsSync(path.join(first.path, "run.txt")));
    assert.ok(fs.existsSync(path.join(f.legacy, "run.txt")));
    const next = await library.install("game");
    assert.equal((await fsp.readFile(path.join(next.path, "settings.json"))).toString(), "managed preferences");
    assert.notEqual(first.path, next.path);
});

test("manifest patches hash real files, copy rather than hardlink, and fetch only changed files", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "unchanged");
    await write(f.legacy, "asset.bin", "old asset");
    await write(f.legacy, "settings.json", "user settings");
    f.routes.set("/asset", Buffer.from("new asset"));
    const files = [{ path: "run.txt", sha256: sha("unchanged"), bytes: 9 },
        { path: "asset.bin", url: `${f.origin}/asset`, sha256: sha("new asset"), bytes: 9 }];
    const { library, progress } = setupLibrary(f, { getPackage: () => ({ version: "2", files }) });
    const installed = await library.install("game", { repair: true });
    assert.deepEqual(f.requests.map(r => r.path), ["/asset"]);
    const transfers = progress.filter(p => p.phase === "downloading");
    assert.ok(transfers.length > 0);
    assert.ok(transfers.every(p => p.totalBytes === 9 && p.transferredBytes <= 9));
    await write(installed.path, "run.txt", "modified candidate");
    assert.equal((await fsp.readFile(path.join(f.legacy, "run.txt"))).toString(), "unchanged");
    assert.equal((await fsp.readFile(path.join(installed.path, "settings.json"))).toString(), "user settings");
});

test("manifest missing URLs/hash metadata fail without unsafe archive fallback", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    const { library, setPackage } = setupLibrary(f);
    setPackage({ version: "2", url: `${f.origin}/game.zip`, files: [{ path: "run.txt", bytes: 3, sha256: sha("new") }] });
    await assert.rejects(library.install("game"), { code: "EMANIFEST" });
    assert.equal(library.pathFor("game"), f.legacy);
    assert.equal(f.requests.length, 0);
    setPackage({ version: "2", files: [{ path: "run.txt", url: `${f.origin}/game.zip`, bytes: 3 }] });
    await assert.rejects(library.install("game"), { code: "EMANIFEST" });
    assert.equal(f.requests.length, 0);
});

test("repair rechecks same-version bytes while ordinary install remains a no-op", async t => {
    const f = await fixture(t);
    const { library } = setupLibrary(f);
    const first = await library.install("game");
    assert.equal((await library.install("game")).path, first.path);
    assert.equal(f.requests.length, 1);
    const repaired = await library.install("game", { repair: true });
    assert.notEqual(repaired.path, first.path);
    assert.equal(f.requests.length, 2);
});

test("ZIP traversal, device paths, links, duplicates and case conflicts fail before extraction", async t => {
    const unsafe = [
        [{ name: "../escaped", data: "bad" }], [{ name: "/absolute", data: "bad" }],
        [{ name: "C:/drive", data: "bad" }], [{ name: "..\\escaped", data: "bad" }],
        [{ name: "NUL.txt", data: "bad" }], [{ name: "run.txt:stream", data: "bad" }],
        [{ name: "folder./file", data: "bad" }], [{ name: "link", data: "../outside", mode: 0o120777 }],
        [{ name: "run.txt", data: "a" }, { name: "run.txt", data: "b" }],
        [{ name: "Foo/a", data: "a" }, { name: "foo/b", data: "b" }],
        [{ name: "dir", data: "a" }, { name: "dir/file", data: "b" }]
    ];
    for (let i = 0; i < unsafe.length; i++) {
        await t.test(String(i), async t => {
            const f = await fixture(t);
            const archive = zipFixture(unsafe[i]);
            f.routes.set("/unsafe", archive);
            let extracted = false;
            const { library } = setupLibrary(f, { getPackage: () => ({ version: "2", url: `${f.origin}/unsafe` }),
                extract: async () => { extracted = true; } });
            await assert.rejects(library.install("game"));
            assert.equal(extracted, false);
            assert.equal(library.state("game").installed, false);
            assert.equal(fs.existsSync(path.join(f.temporary, "escaped")), false);
        });
    }
});

test("unsafe identifiers, preserve paths, manifests and activation pointers are rejected", async t => {
    const f = await fixture(t);
    assert.throws(() => setupLibrary(f, { definitions: { bad: { id: "bad", klasor: "../outside" } } }), { code: "EUNSAFEPATH" });
    const { library, setPackage } = setupLibrary(f, { preservePaths: () => ["../outside"] });
    assert.throws(() => library.state("../bad"), { code: "EINVAL" });
    await assert.rejects(library.install("game"), { code: "EUNSAFEPATH" });
    const clean = setupLibrary(f);
    const pointer = path.join(f.root, ".game-library/game/active.json");
    await write(f.root, ".game-library/game/active.json", JSON.stringify({ schema: 1, directory: "../../outside", version: "1" }));
    assert.throws(() => clean.library.state("game"), { code: "EUNSAFEPATH" });
    await fsp.unlink(pointer);
    setPackage({ version: "2", files: [{ path: "../outside", bytes: 0, sha256: sha("") }] });
    const manifest = setupLibrary(f, { getPackage: () => ({ version: "2", files: [{ path: "../outside", bytes: 0, sha256: sha("") }] }) });
    await assert.rejects(manifest.library.install("game"), { code: "EUNSAFEPATH" });
});

test("junctions in roots, legacy trees, preserved data and download destinations are rejected", async t => {
    const f = await fixture(t);
    const target = path.join(f.temporary, "untouched");
    await fsp.mkdir(target);
    await write(target, "secret", "keep");
    const linked = path.join(f.temporary, "linked-root");
    try { await fsp.symlink(target, linked, process.platform === "win32" ? "junction" : "dir"); } catch (error) {
        if (["EPERM", "EACCES"].includes(error.code)) { t.skip("Symlink creation is unavailable"); return; }
        throw error;
    }
    assert.throws(() => setupLibrary(f, { root: linked }), { code: "EUNSAFEPATH" });
    await assert.rejects(download(`${f.origin}/unused`, path.join(linked, "secret")), { code: "EUNSAFEPATH" });
    await write(f.legacy, "run.txt", "old");
    const saves = path.join(f.legacy, "saves");
    await fsp.symlink(target, saves, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(setupLibrary(f).library.install("game"), { code: "EUNSAFEPATH" });
    assert.equal((await fsp.readFile(path.join(target, "secret"))).toString(), "keep");
});

test("legacy DLL installs outside root are recognized without requiring the latest version", async t => {
    const f = await fixture(t);
    await write(f.legacy, "UnturnedModEdition.dll", "dll");
    await write(f.legacy, "UnturnedModEdition.module", "module");
    await write(f.legacy, "mng-version.json", JSON.stringify({ version: "6.4.0" }));
    const { library } = setupLibrary(f, {
        definitions: { "gelene-gecene": { id: "gelene-gecene", klasor: "gelene-gecene", paketSurumu: "6.5.0" } },
        getPackage: () => ({ version: "6.5.0" }),
        validate: dir => fs.existsSync(path.join(dir, "UnturnedModEdition.dll")) && fs.existsSync(path.join(dir, "UnturnedModEdition.module"))
    });
    assert.deepEqual(library.state("gelene-gecene"), { installed: true, installedVersion: "6.4.0", availableVersion: "6.5.0", updateAvailable: true, path: f.legacy });
});

test("availability cache refreshes on install errors and never marks newer installed versions outdated", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    await write(f.legacy, ".tikmng-package.json", JSON.stringify({ version: "3.0.0" }));
    const { library, setPackage } = setupLibrary(f);
    assert.equal(library.state("game").updateAvailable, false);
    await library.install("game");
    assert.equal(f.requests.length, 0);
    setPackage({ version: "4.0.0", url: `${f.origin}/404` });
    await assert.rejects(library.install("game"), /HTTP 404/);
    assert.equal(library.state("game").availableVersion, "4.0.0");
    assert.equal(library.state("game").installed, true);
    assert.equal(library.pathFor("game"), f.legacy);
});

test("disk checks reject impossible reservations before transfer", async t => {
    const f = await fixture(t);
    await assert.rejects(checkDiskSpace(f.temporary, Number.MAX_SAFE_INTEGER), { code: "ENOSPC" });
    f.routes.set("/huge", Buffer.from("tiny"));
    await assert.rejects(download(`${f.origin}/huge`, path.join(f.temporary, "huge"), { bytes: Number.MAX_SAFE_INTEGER, retries: 0 }), { code: "ENOSPC" });
    assert.equal(f.requests.length, 0);
});

test("state reflects a synchronous cached catalog and tolerates offline metadata readers", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    await write(f.legacy, ".tikmng-package.json", JSON.stringify({ version: "1.0.0" }));
    const { library, setPackage } = setupLibrary(f);
    setPackage({ version: "5.0.0" });
    assert.equal(library.state("game").availableVersion, "5.0.0");
    assert.equal(library.state("game").updateAvailable, true);
    assert.equal(f.requests.length, 0);
    const offline = setupLibrary(f, { getPackage: () => { throw new Error("Offline"); } }).library;
    assert.equal(offline.pathFor("game"), f.legacy);
    assert.equal(offline.state("game").availableVersion, "2.0.0");
    let requests = 0;
    const asyncReader = setupLibrary(f, { getPackage: async () => { requests++; throw new Error("Offline"); } }).library;
    assert.equal(asyncReader.pathFor("game"), f.legacy);
    assert.equal(requests, 0);
});

test("changing the root preserves settings from the owner's previous-path resolver", async t => {
    const f = await fixture(t);
    const first = setupLibrary(f);
    const old = await first.library.install("game");
    await write(old.path, "settings.json", "latest managed settings");
    const newRoot = path.join(f.temporary, "new-disk");
    const library = createGameLibrary({ ...first.options, root: newRoot, resolveLegacy: () => old.path });
    assert.equal(library.pathFor("game"), old.path);
    const updated = await library.install("game", { repair: true });
    assert.ok(updated.path.startsWith(newRoot + path.sep));
    assert.equal((await fsp.readFile(path.join(updated.path, "settings.json"))).toString(), "latest managed settings");
    assert.equal((await fsp.readFile(path.join(old.path, "settings.json"))).toString(), "latest managed settings");
});

test("install and remove cannot overlap through aliases", async t => {
    const f = await fixture(t);
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const { library } = setupLibrary(f, { isRunning: async () => { await blocked; return false; } });
    const removal = library.remove("game");
    await assert.rejects(library.install("game"), { code: "EBUSY" });
    release();
    await removal;
    assert.equal(library.state("game").installed, false);
});

test("manifest path conflicts are rejected regardless of file order", async t => {
    const f = await fixture(t);
    for (const paths of [["Foo/a", "foo/b"], ["folder/file", "folder"], ["folder", "folder/file"], ["RUN.txt", "run.txt"]]) {
        const { library } = setupLibrary(f, { getPackage: () => ({ version: "2", files: paths.map(relative => ({
            path: relative, bytes: 0, sha256: sha("")
        })) }) });
        await assert.rejects(library.install("game"), { code: "EMANIFEST" });
    }
    assert.equal(f.requests.length, 0);
});

test("shared-package aliases use one catalog reader and expose consistent availability", async t => {
    const f = await fixture(t);
    await write(f.legacy, "run.txt", "old");
    await write(f.legacy, ".tikmng-package.json", JSON.stringify({ version: "1" }));
    const calls = [];
    const { library } = setupLibrary(f, {
        definitions: { vs: { id: "vs", klasor: "tiktok-vs" }, puanlama: { id: "puanlama", klasor: "tiktok-vs" } },
        getPackage: id => { calls.push(id); return { version: id === "vs" ? "3" : "2" }; }
    });
    assert.equal(library.state("puanlama").availableVersion, "3");
    assert.equal(library.state("vs").availableVersion, "3");
    assert.deepEqual(calls, ["vs", "vs"]);
});
