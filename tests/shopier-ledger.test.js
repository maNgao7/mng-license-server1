import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm, rmdir } from "node:fs/promises";
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
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/products/5002') {
        return Response.json({ id: '5002', type: 'digital', stockStatus: 'inStock',
            priceData: { currency: 'TRY', discount: false, price: '2500.00' } });
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

test("Shopier code and agency membership survive restarts with no persistent Render disk", { timeout: 15_000 }, async t => {
    const root = await mkdtemp(path.join(tmpdir(), "tikmng-ledger-test-"));
    const file = (name, data) => writeFile(path.join(root, `${name}.json`), JSON.stringify(data));
    const seed = { version: 1, licenses: [], blacklist: [], activationLogs: [], requests: [] };
    await file("github", { sha: "initial", content: encryptedBackup(seed) });
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    let server;
    async function stop() {
        if (!server || server.exitCode !== null) return;
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
    async function start() {
        const module = `data:text/javascript;base64,${Buffer.from(mock).toString("base64")}`;
        server = spawn(process.execPath, ["--import", module, "server.js"], {
            cwd: new URL("../", import.meta.url), stdio: "ignore",
            env: { SystemRoot: process.env.SystemRoot, HOST: "127.0.0.1", PORT: String(port),
                MNG_DATA_DIR: root, MOCK_PROVIDER_DIR: root, ADMIN_SIFRE: password,
                BACKUP_REPO: "test/backup", GITHUB_TOKEN: "test-only", SHOPIER_SALES_ENABLED: "true",
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
