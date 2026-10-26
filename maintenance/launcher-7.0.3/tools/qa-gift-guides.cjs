"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const resources = require("../lib/game-resources.cjs");
const manifest = require("../lib/game-resources.json");
const catalog = require("../lib/catalog-defaults.json");

function audit() {
    const main = fs.readFileSync(path.resolve(__dirname, "../main.js"), "utf8");
    const block = main.match(/const OYUN_TANIMLARI\s*=\s*\{([\s\S]*?)\r?\n\};/);
    assert.ok(block, "Game definitions not found; audit must be updated");
    const definitionIds = [...new Set([...block[1].matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map(match => match[1]))].sort();
    const rows = resources.listGameResources();
    const listedIds = rows.map(row => row.gameId).sort();
    assert.deepEqual(listedIds, definitionIds, "Guide manifest must account for every game definition");
    assert.deepEqual(listedIds, catalog.games.map(game => game.id).sort(), "Guide manifest/catalog mismatch");
    const available = rows.filter(row => row.available);
    const missing = rows.filter(row => !row.available);
    const assets = fs.readdirSync(path.resolve(__dirname, "../renderer/assets/gift-guides")).sort();
    assert.deepEqual(assets, manifest.games.filter(game => game.guide).map(game => game.guide.file).sort(), "Unexpected guide asset");
    return { schemaVersion: 1, revision: manifest.revision, totalGames: rows.length,
        available: available.length, missing: missing.length,
        bundledBytes: available.reduce((sum, row) => sum + row.guide.bytes, 0),
        games: rows.map(row => ({ ...row, audit: row.available ? "sha256-size-png-verified" : "missing-source-asset" })),
        integration: {
            module: "lib/game-resources.cjs",
            buttonLookup: "getGuide(gameId): metadata or null; verified on every call",
            save: "downloadGuide(gameId, nativeSaveDialogPath, { overwrite: true }): verified PNG bytes; no game install/network needed",
            ipcInput: "Only accept a known game ID from the renderer. Obtain the output path in the main process with showSaveDialog.",
            notice: "Ready images describe the default gift actions; this helper does not regenerate images from user-customized assignments.",
            uiIntegrated: false
        },
        findings: [
            "Denge public/hediye-sablonu.png is actually the Penalty guide; use denge-hediye-listesi.png.",
            "PUBG source still contains a snow-war guide in its guide folder; use downloads/MC-PUBG.png, matching the user's supplied image.",
            "VS and Profil Puanlama share tiktok-vs but have separate resource entries; no guide inferred between them.",
            "Only Zombie War currently has an explicit ready-PNG catalog resource. Local assets avoid that network dependency.",
            "All eight selected originals were visually inspected; images are copied unchanged, not generated covers."
        ] };
}

if (require.main === module) {
    try {
        const report = audit();
        if (process.argv.includes("--write-report")) {
            const destination = path.join(__dirname, "qa-gift-guides.report.json");
            fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
            console.log(destination);
        }
        console.log(JSON.stringify({ totalGames: report.totalGames, available: report.available,
            missing: report.missing, bundledBytes: report.bundledBytes,
            missingIds: report.games.filter(game => !game.available).map(game => game.gameId) }, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { audit };
