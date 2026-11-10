import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, rmdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { salesPlans } from "../web/sales-catalog.js";

const password = "test-admin-password-only";
const products = Object.fromEntries(salesPlans.map((plan, i) => [plan.id, String(5000 + i)]));

function encryptedBackup(state) {
    const iv = randomBytes(12);
    const key = createHash("sha256").update(`${password}:mng-license-backup:v1`).digest();
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
    return Buffer.from(JSON.stringify({ v: 1, iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") })).toString("base64");
}

// The child process cannot contact GitHub or Shopier. Its mock GitHub file
// outlives each server start and implements the Contents API revision check.
const mock = `
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = process.env.MOCK_PROVIDER_DIR;
const read = (name) => JSON.parse(readFileSync(root + '/' + name + '.json', 'utf8'));
const prices = { '/v1/products/5000': '500.00', '/v1/products/5002': '2500.00' };
globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'api.github.com') {
        const current = read('github');
        if (options.method === 'GET') return Response.json(current);
        const body = JSON.parse(options.body);
        if (body.sha !== current.sha) return new Response(null, { status: 409 });
        if (existsSync(root + '/reject-write.json')) return new Response(null, { status: 503 });
        const sha = createHash('sha1').update(body.content).digest('hex');
        writeFileSync(root + '/github.json', JSON.stringify({ sha, content: body.content }));
        if (existsSync(root + '/lost-ack.json')) throw new Error('simulated lost acknowledgement');
        return Response.json({ content: { sha } });
    }
    if (url.hostname === 'api.shopier.com' && prices[url.pathname]) {
        return Response.json({ id: url.pathname.split('/').pop(), type: 'digital', stockStatus: 'inStock',
            priceData: { currency: 'TRY', discount: false, price: prices[url.pathname] } });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/products/5001') {
        return new Response(null, { status: 403 });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname.startsWith('/v1/products/')) {
        return new Response(null, { status: 404 });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/orders/7001') {
        return Response.json(read('order'));
    }
    throw new Error('Unexpected test network request');
};`;

async function freePort() {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const { port } = socket.address();
    await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
    return port;
}

async function createLedgerFixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), "tikmng-ledger-test-"));
    const file = (name, data) => writeFile(path.join(root, `${name}.json`), JSON.stringify(data));
    const seed = { version: 1, licenses: [], blacklist: [], activationLogs: [], requests: [] };
    const resetLedger = () => file("github", { sha: "initial", content: encryptedBackup(seed) });
    await resetLedger();
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    let server;
    async function stop() {
        if (!server || server.exitCode !== null || server.signalCode !== null) return;
        const exited = once(server, "exit");
        server.kill();
        await exited;
    }
    t.after(async () => {
        await stop();
        for (const name of ["github.json", "order.json", "reject-write.json", "lost-ack.json",
            "lisanslar.json", "lisanslar_backup.json", "aktivasyon_log.json", "talepler.json", "kara_liste.json", "content-state.json"]) {
            await rm(path.join(root, name), { force: true });
        }
        for (const name of ["content-assets", "content-revisions"]) {
            await rmdir(path.join(root, name)).catch(error => { if (error.code !== "ENOENT") throw error; });
        }
        await rmdir(root);
    });
    async function start({ salesEnabled = true } = {}) {
        const module = `data:text/javascript;base64,${Buffer.from(mock).toString("base64")}`;
        server = spawn(process.execPath, ["--import", module, "server.js"], {
            cwd: new URL("../", import.meta.url), stdio: "ignore",
            env: { SystemRoot: process.env.SystemRoot, HOST: "127.0.0.1", PORT: String(port),
                MNG_DATA_DIR: root, MOCK_PROVIDER_DIR: root, ADMIN_SIFRE: password,
                BACKUP_REPO: "test/backup", GITHUB_TOKEN: "test-only", SHOPIER_SALES_ENABLED: String(salesEnabled),
                SHOPIER_LICENSE_STORAGE: "github", SHOPIER_API_TOKEN: "test-only",
                SHOPIER_CLAIM_SECRET: "test-claim-signing-key-no-production", SHOPIER_PRODUCT_IDS: JSON.stringify(products) },
        });
        for (let attempt = 0; attempt < 100; attempt++) {
            if (server.exitCode !== null) throw Error("Test server failed to start.");
            try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
            await delay(50);
        }
        throw Error("Test server did not become ready.");
    }
    async function post(route, payload, status = 200) {
        const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload) });
        assert.equal(response.status, status, route);
        return response.json();
    }
    return { root, file, resetLedger, base, start, stop, post };
}

test("Shopier readiness requires admin login and checks all plans with live sales closed", async t => {
    const { root, base, start } = await createLedgerFixture(t);
    await start({ salesEnabled: false });
    const ledgerPath = path.join(root, "github.json");
    const ledgerBefore = await readFile(ledgerPath, "utf8");
    const url = `${base}/api/admin/shopier/hazirlik`;
    assert.equal((await fetch(url)).status, 401);
    const login = await fetch(`${base}/api/admin/giris`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const response = await fetch(url, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const report = await response.json();
    assert.equal(report.canliSatisAcik, false);
    assert.equal(report.shopierAnahtariGirildi, true);
    assert.equal(report.urunEslemesiGecerli, true);
    assert.equal(report.kodGuvenlikAyariGecerli, true);
    assert.equal(report.kaliciLisansKaydiHazir, true);
    assert.equal(report.paketler.length, salesPlans.length);
    assert.deepEqual(report.paketler.slice(0, 3).map(plan => plan.durum),
        ["Uygun", "Shopier anahtarı reddedildi", "Uygun"]);
    assert.equal(report.paketler.at(-1).durum, "Ürün, fiyat veya stok kontrol edilmeli");
    assert.doesNotMatch(JSON.stringify(report), /test-only|test-claim-signing-key/);
    assert.equal((await fetch(`${base}/satin-al`)).status, 503);
    assert.equal(await readFile(ledgerPath, "utf8"), ledgerBefore);
});

test("Shopier code and agency membership survive restarts with no persistent Render disk", { timeout: 15_000 }, async t => {
    const { root, file, base, start, stop, post } = await createLedgerFixture(t);
    await start();
    assert.match(await (await fetch(base)).text(), /<meta name="tikmng-checkout" content="shopier">/);
    assert.equal((await fetch(`${base}/satin-al?plan=agency-10-monthly`)).status, 200);
    const offer = await post("/api/shopier/checkout", { planId: "agency-10-monthly", username: "Test ajans" }, 201);
    await file("order", { id: "7001", note: offer.reference, paymentStatus: "paid", currency: "TRY",
        lineItems: [{ productId: "5002", type: "digital", quantity: 1 }], refunds: [],
        totals: { subtotal: "2500.00", total: "2500.00", discount: "0.00", shipping: "0.00" } });
    const claim = { token: offer.token, orderId: "7001" };
    await file("reject-write", {});
    assert.equal((await post("/api/shopier/redeem", claim, 503)).code, undefined);
    await rm(path.join(root, "reject-write.json"));
    await file("lost-ack", {});
    const { code } = await post("/api/shopier/redeem", claim);
    assert.ok(code);
    await rm(path.join(root, "lost-ack.json"));
    for (let i = 0; i < 10; i++) {
        assert.equal((await post("/api/license/verify", { code, deviceId: `device-${i}` })).valid, true);
    }
    await stop();
    await start();
    assert.equal((await post("/api/shopier/redeem", claim)).code, code);
    assert.equal((await post("/api/license/verify", { code, deviceId: "device-over-capacity" })).reason, "agency_limit_reached");
});

test("Paid individual licenses require their persisted row for verify and check", { timeout: 15_000 }, async t => {
    const { root, file, resetLedger, start, stop, post } = await createLedgerFixture(t);
    await start();
    const planId = "individual-weekly";
    const orderId = "7001";
    const productId = products[planId];
    const offer = await post("/api/shopier/checkout", { planId, username: "test.creator" }, 201);
    await file("order", { id: orderId, note: offer.reference, paymentStatus: "paid", currency: "TRY",
        lineItems: [{ productId, type: "digital", quantity: 1 }], refunds: [],
        totals: { subtotal: "500.00", total: "500.00", discount: "0.00", shipping: "0.00" } });
    const claim = { token: offer.token, orderId };
    const { code } = await post("/api/shopier/redeem", claim);
    assert.match(code, /^MNGS-[A-F0-9]{20}$/);

    const paidDevice = { code, deviceId: "paid-device", clientVersion: "7.0.17" };
    const { valid, activationToken, expiresAt, remainingDays } = await post("/api/license/verify", paidDevice);
    assert.equal(valid, true);
    assert.equal(remainingDays, 7);
    assert.match(activationToken, /^[a-f0-9]{64}$/);
    const paidCheck = { ...paidDevice, activationToken, expiresAt };
    assert.equal((await post("/api/license/check", paidCheck)).valid, true);

    // A pre-existing signed code must still activate and restore from its activation token.
    const legacyPayload = "MNG7D-ABCDEF";
    const signature = createHmac("sha256", password).update(legacyPayload).digest("hex").slice(0, 6).toUpperCase();
    const legacyDevice = { code: `${legacyPayload}-${signature}`, deviceId: "legacy-device", clientVersion: "7.0.17" };
    const legacy = await post("/api/license/verify", legacyDevice);
    assert.equal(legacy.valid, true);

    await stop();
    await start();
    const licenses = JSON.parse(await readFile(path.join(root, "lisanslar.json"), "utf8"));
    const paid = licenses.find(license => license.kod === code);
    assert.deepEqual(paid.shopier, { orderId, reference: offer.reference, planId, amountMinor: 50000 });
    assert.equal(paid.activation_token, activationToken);
    assert.equal((await post("/api/shopier/redeem", claim)).code, code);
    assert.equal((await post("/api/license/verify", paidDevice)).expiresAt, expiresAt);
    assert.equal((await post("/api/license/check", paidCheck)).valid, true);

    await stop();
    await resetLedger();
    await start();
    for (const [route, payload] of [["check", paidCheck], ["verify", paidDevice]]) {
        const result = await post(`/api/license/${route}`, payload);
        assert.equal(result.valid, false);
        assert.equal(result.reason, "invalid_license");
    }
    const restored = await post("/api/license/check", { ...legacyDevice,
        activationToken: legacy.activationToken, expiresAt: legacy.expiresAt });
    assert.equal(restored.valid, true);
    assert.equal(restored.expiresAt, legacy.expiresAt);
});
