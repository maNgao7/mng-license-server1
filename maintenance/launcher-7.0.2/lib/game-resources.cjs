"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const manifest = require("./game-resources.json");
const { assertSafePath, safeRelativePath, failure } = require("./download.cjs");

const DEFAULT_ROOT = path.resolve(__dirname, "../renderer/assets/gift-guides");
const MAX_GUIDE_BYTES = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

function validateManifest(value) {
    if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
        !Array.isArray(value.games)) throw failure("EGUIDE_MANIFEST", "Invalid gift-guide manifest");
    const ids = new Set();
    for (const game of value.games) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) || ids.has(game.id) ||
            typeof game.title !== "string" || !game.title || typeof game.packageId !== "string") {
            throw failure("EGUIDE_MANIFEST", "Invalid gift-guide game entry");
        }
        ids.add(game.id);
        const guide = game.guide;
        if (guide === null) {
            if (!game.missingReason) throw failure("EGUIDE_MANIFEST", "Missing guides require a reason");
            continue;
        }
        if (!guide || guide.file !== `${game.id}.png` || !/^[a-f0-9]{64}$/.test(guide.sha256) ||
            !Number.isSafeInteger(guide.bytes) || guide.bytes < 33 || guide.bytes > MAX_GUIDE_BYTES ||
            ![guide.width, guide.height].every(n => Number.isSafeInteger(n) && n > 0) ||
            typeof guide.version !== "string" || !guide.version ||
            typeof guide.filename !== "string" || !/^[A-Za-z0-9_-]+\.png$/.test(guide.filename)) {
            throw failure("EGUIDE_MANIFEST", "Invalid gift-guide asset");
        }
        safeRelativePath(guide.file);
    }
    for (const [alias, id] of Object.entries(value.aliases || {})) {
        if (!/^[A-Za-z0-9_-]+$/.test(alias) || ids.has(alias) || !ids.has(id)) {
            throw failure("EGUIDE_MANIFEST", "Invalid gift-guide alias");
        }
    }
}

validateManifest(manifest);

/** Main-process API. assetRoot is a trusted dependency override, never IPC input.
 * getGuide/listGuides expose metadata only. readGuide returns verified bytes.
 * downloadGuide's destination must come from a native save dialog, not renderer input.
 */
function createGameResources({ assetRoot = DEFAULT_ROOT } = {}) {
    if (typeof assetRoot !== "string" || !path.isAbsolute(assetRoot)) {
        throw failure("EINVAL", "Gift-guide asset root must be absolute");
    }
    const root = path.resolve(assetRoot);
    const games = new Map(manifest.games.map(game => [game.id, game]));
    function entryFor(id) {
        if (typeof id !== "string") return null;
        const canonical = Object.hasOwn(manifest.aliases, id) ? manifest.aliases[id] : id;
        return games.get(canonical) || null;
    }
    function metadata(game) {
        const guide = game.guide;
        return { id: game.id, gameId: game.id, packageId: game.packageId, gameTitle: game.title,
            title: "Haz\u0131r hediye g\u00f6rseli (PNG)", filename: guide.filename,
            mimeType: "image/png", version: guide.version, sha256: guide.sha256,
            bytes: guide.bytes, width: guide.width, height: guide.height };
    }
    function readGuide(id) {
        const game = entryFor(id);
        if (!game?.guide) return null;
        const file = assertSafePath(path.join(root, game.guide.file));
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size !== game.guide.bytes) throw failure("EGUIDE_INTEGRITY", "Gift-guide size mismatch");
        const data = fs.readFileSync(file);
        if (crypto.createHash("sha256").update(data).digest("hex") !== game.guide.sha256 ||
            !data.subarray(0, 8).equals(PNG_SIGNATURE) || data.readUInt32BE(8) !== 13 ||
            data.toString("ascii", 12, 16) !== "IHDR" ||
            data.readUInt32BE(16) !== game.guide.width || data.readUInt32BE(20) !== game.guide.height) {
            throw failure("EGUIDE_INTEGRITY", "Gift-guide content mismatch");
        }
        return { guide: metadata(game), data };
    }
    function getGuide(id) {
        return readGuide(id)?.guide || null;
    }
    function listGuides() {
        return manifest.games.filter(game => game.guide).map(game => getGuide(game.id));
    }
    function listGameResources() {
        return manifest.games.map(game => ({ gameId: game.id, packageId: game.packageId, title: game.title,
            available: Boolean(game.guide), guide: getGuide(game.id),
            missingReason: game.guide ? null : game.missingReason }));
    }
    async function downloadGuide(id, destination, { overwrite = false } = {}) {
        const verified = readGuide(id);
        if (!verified) throw failure("EGUIDE_UNAVAILABLE", "No ready gift guide for this game");
        if (typeof destination !== "string" || !path.isAbsolute(destination)) {
            throw failure("EINVAL", "An absolute native save-dialog destination is required");
        }
        const target = assertSafePath(destination);
        const relative = path.relative(root, target);
        if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
            throw failure("EUNSAFEPATH", "Bundled gift guides cannot be overwritten");
        }
        if (path.extname(target).toLowerCase() !== ".png") throw failure("EINVAL", "A PNG destination is required");
        const directory = assertSafePath(path.dirname(target));
        if (!fs.statSync(directory).isDirectory()) throw failure("EINVAL", "Save directory is missing");
        const temporary = path.join(directory, `.tikmng-guide-${crypto.randomUUID()}.tmp`);
        let handle;
        try {
            handle = await fs.promises.open(temporary, "wx", 0o600);
            await handle.writeFile(verified.data);
            await handle.sync();
            await handle.close();
            handle = null;
            assertSafePath(target);
            if (overwrite) await fs.promises.rename(temporary, target);
            else await fs.promises.copyFile(temporary, target, fs.constants.COPYFILE_EXCL);
            return { saved: true, ...verified.guide };
        } finally {
            await handle?.close().catch(() => {});
            await fs.promises.rm(temporary, { force: true }).catch(() => {});
        }
    }
    return { getGuide, listGuides, listGameResources, readGuide, downloadGuide };
}

module.exports = { createGameResources, ...createGameResources() };
