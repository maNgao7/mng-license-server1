"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const resources = require("../lib/game-resources.cjs");
const manifest = require("../lib/game-resources.json");
const catalog = require("../lib/catalog-defaults.json");
const assetRoot = path.resolve(__dirname, "../renderer/assets/gift-guides");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const available = ["battle-royale", "snow-war", "orbit", "duck-hunt", "frog-river",
    "penalty-kick", "tightrope-balance", "zombie-war", "caahr", "minecraft-snake-arena"];
const missing = ["vs", "puanlama", "crowd-control", "battle-game", "gelene-gecene", "pony-life"];

async function temporary(t) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tikmng-gift-guide-"));
    t.after(async () => {
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith("tikmng-gift-guide-"));
        await fs.promises.rm(directory, { recursive: true, force: true });
    });
    return directory;
}

test("manifest accounts for every catalog game without conflating package aliases", () => {
    const rows = resources.listGameResources();
    const ids = [...new Set([...catalog.games.map(row => row.id), ...require('../lib/admin-games.json').games.map(row => row.id)])];
    assert.equal(rows.length, ids.length);
    assert.deepEqual(rows.map(row => row.gameId).sort(), ids.sort());
    assert.deepEqual(resources.listGuides().map(row => row.gameId).sort(), [...available].sort());
    assert.deepEqual(rows.filter(row => !row.available).map(row => row.gameId).sort(), [...missing].sort());
    const vs = rows.find(row => row.gameId === "vs");
    const score = rows.find(row => row.gameId === "puanlama");
    assert.equal(vs.packageId, score.packageId);
    assert.notEqual(vs.gameId, score.gameId);
    assert.notEqual(vs.missingReason, score.missingReason);
    assert.equal(resources.getGuide("crowdControl"), resources.getGuide("crowd-control"));
    assert.ok(rows.filter(row => !row.available).every(row => row.missingReason && row.guide === null));
});

test("all ready guides are bundled, byte-verified PNGs usable without installed games or a server", () => {
    const expectedFiles = available.map(id => `${id}.png`).sort();
    assert.deepEqual(fs.readdirSync(assetRoot).sort(), expectedFiles);
    for (const id of available) {
        const { guide, data } = resources.readGuide(id);
        assert.equal(guide.mimeType, "image/png");
        assert.equal(guide.gameId, id);
        assert.equal(data.length, guide.bytes);
        assert.equal(sha(data), guide.sha256);
        assert.equal(data.readUInt32BE(16), guide.width);
        assert.equal(data.readUInt32BE(20), guide.height);
        assert.equal(data.toString("ascii", data.length - 8, data.length - 4), "IEND");
        assert.ok(guide.version && /^[A-Za-z0-9_-]+\.png$/.test(guide.filename));
        assert.ok(Object.values(guide).every(value => typeof value !== "string" || !path.isAbsolute(value)));
        assert.ok(!("source" in guide) && !("path" in guide) && !("url" in guide));
    }
});

test("latest user-supplied Zombie War and PUBG guides cannot be swapped", () => {
    assert.equal(resources.getGuide("zombie-war").sha256,
        "9c8fab556afa507002232f1ef99e0c5b5edde0aaf35e5c74c95fcabf7dce7f52");
    assert.equal(resources.getGuide("battle-royale").sha256,
        "cd8de10c40f8cd7896197e6eed7da2197f383efc64059b1b4807220ada02f66d");
    assert.notEqual(resources.getGuide("battle-royale").sha256, resources.getGuide("snow-war").sha256);
    assert.notEqual(resources.getGuide("penalty-kick").sha256, resources.getGuide("tightrope-balance").sha256);
    assert.equal(manifest.games.find(game => game.id === "tightrope-balance").guide.file, "tightrope-balance.png");
});

test("unknown IDs, URLs, traversal and object coercion cannot select a source file", async t => {
    const directory = await temporary(t);
    for (const id of ["../zombie-war", "zombie-war.png", "C:/Windows/win.ini", "__proto__", "constructor",
        "https://example.com/guide.png", {}, null, ["zombie-war"], "", "ORBIT"]) {
        assert.equal(resources.getGuide(id), null);
        assert.equal(resources.readGuide(id), null);
        await assert.rejects(resources.downloadGuide(id, path.join(directory, "output.png")), { code: "EGUIDE_UNAVAILABLE" });
    }
    assert.deepEqual(fs.readdirSync(directory), []);
});

test("save helper exports identical bytes and preserves existing files unless overwrite is explicit", async t => {
    const directory = await temporary(t);
    const destination = path.join(directory, "guide.png");
    const first = await resources.downloadGuide("battle-royale", destination);
    assert.equal(first.saved, true);
    assert.equal(sha(fs.readFileSync(destination)), first.sha256);
    await assert.rejects(resources.downloadGuide("zombie-war", destination), { code: "EEXIST" });
    assert.equal(sha(fs.readFileSync(destination)), first.sha256);
    const next = await resources.downloadGuide("zombie-war", destination, { overwrite: true });
    assert.equal(sha(fs.readFileSync(destination)), next.sha256);
    assert.ok(!("path" in next));
    assert.deepEqual(fs.readdirSync(directory), ["guide.png"]);
});

test("save refuses relative paths, wrong extensions, and any bundled-asset destination", async t => {
    const directory = await temporary(t);
    await assert.rejects(resources.downloadGuide("orbit", "relative.png"), { code: "EINVAL" });
    await assert.rejects(resources.downloadGuide("orbit", path.join(directory, "file.exe")), { code: "EINVAL" });
    await assert.rejects(resources.downloadGuide("orbit", path.join(assetRoot, "zombie-war.png"), { overwrite: true }), { code: "EUNSAFEPATH" });
    await assert.rejects(resources.downloadGuide("orbit", path.join(directory, "missing", "guide.png")), { code: "ENOENT" });
    assert.equal(resources.getGuide("zombie-war").sha256,
        "9c8fab556afa507002232f1ef99e0c5b5edde0aaf35e5c74c95fcabf7dce7f52");
});

test("missing or corrupt bundled content fails before writing a destination", async t => {
    const directory = await temporary(t);
    const broken = resources.createGameResources({ assetRoot: directory });
    const destination = path.join(directory, "out", "guide.png");
    assert.throws(() => broken.getGuide("frog-river"), { code: "ENOENT" });
    const source = resources.readGuide("frog-river").data;
    const tampered = Buffer.from(source);
    tampered[100] ^= 1;
    fs.writeFileSync(path.join(directory, "frog-river.png"), tampered);
    assert.throws(() => broken.getGuide("frog-river"), { code: "EGUIDE_INTEGRITY" });
    await assert.rejects(broken.downloadGuide("frog-river", destination), { code: "EGUIDE_INTEGRITY" });
    assert.equal(fs.existsSync(destination), false);
    fs.writeFileSync(path.join(directory, "frog-river.png"), source.subarray(0, 50));
    assert.throws(() => broken.getGuide("frog-river"), { code: "EGUIDE_INTEGRITY" });
});

test("source/destination links and junctions are rejected", async t => {
    const directory = await temporary(t);
    const linked = path.join(directory, "linked-assets");
    try { await fs.promises.symlink(assetRoot, linked, process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
        if (["EPERM", "EACCES"].includes(error.code)) { t.skip("Cannot create test links on this machine"); return; }
        throw error;
    }
    const unsafe = resources.createGameResources({ assetRoot: linked });
    assert.throws(() => unsafe.getGuide("orbit"), { code: "EUNSAFEPATH" });
    await assert.rejects(resources.downloadGuide("orbit", path.join(linked, "new.png")), { code: "EUNSAFEPATH" });
});
