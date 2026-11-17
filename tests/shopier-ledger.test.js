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
const osbUsername = "test-seller";
const osbSecret = "test-osb-secret";
const osbOptions = { scope: "individual", paymentSource: "osb" };

function osbNotification(base, event, secret = osbSecret) {
    const res = Buffer.from(JSON.stringify(event)).toString("base64");
    const hash = createHmac("sha256", secret).update(res + osbUsername).digest("hex");
    return fetch(base + "/api/shopier/osb", { method: "POST", body: new URLSearchParams({ res, hash }) });
}

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
const prices = { '/v1/products/5000': '300.00', '/v1/products/5002': '2000.00' };
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
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/products' && options.method === 'POST') {
        const products = existsSync(root + '/created-products.json') ? read('created-products') : [];
        const body = JSON.parse(options.body);
        const product = { ...body, id: String(6200 + products.length), priceData: { ...body.priceData, discount: false } };
        products.push(product);
        writeFileSync(root + '/created-products.json', JSON.stringify(products));
        return Response.json(product);
    }
    if (url.hostname === 'api.shopier.com' && url.pathname.startsWith('/v1/products/') && options.method === 'PUT') {
        const products = read('created-products');
        Object.assign(products.find(p => p.id === url.pathname.split('/').pop()), JSON.parse(options.body));
        writeFileSync(root + '/created-products.json', JSON.stringify(products));
        return Response.json({});
    }
    if (url.hostname === 'api.shopier.com' && url.pathname.startsWith('/v1/products/')
        && process.env.MOCK_AUTO_CHECKOUT === 'true') {
        return new Response(null, { status: 403 });
    }
    if (url.hostname === 'api.shopier.com' && prices[url.pathname]) {
        return Response.json({ id: url.pathname.split('/').pop(), type: 'digital', stockStatus: 'inStock',
            media: [{ type: 'image', url: 'https://example.test/license.jpg', placement: 1 }],
            priceData: { currency: 'TRY', discount: false, price: prices[url.pathname] } });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/products/5001') {
        return new Response(null, { status: 403 });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname.startsWith('/v1/products/')) {
        return new Response(null, { status: 404 });
    }
    if (url.hostname === 'api.shopier.com' && url.pathname === '/v1/orders') {
        if (existsSync(root + '/block-order-reads.json')) return new Response(null, { status: 403 });
        const order = existsSync(root + '/order.json') ? read('order') : null;
        return Response.json(order?.lineItems?.some(item => item.productId === url.searchParams.get('productId')) ? [order] : []);
    }
    if (url.hostname === 'api.shopier.com' && url.pathname.startsWith('/v1/orders/')) {
        if (existsSync(root + '/block-order-reads.json')) return new Response(null, { status: 403 });
        const order = existsSync(root + '/order.json') ? read('order') : null;
        return order?.id === url.pathname.split('/').pop() ? Response.json(order) : new Response(null, { status: 404 });
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
        for (const name of ["github.json", "order.json", "block-order-reads.json", "reject-write.json", "lost-ack.json", "created-products.json",
            "lisanslar.json", "lisanslar_backup.json", "aktivasyon_log.json", "talepler.json", "kara_liste.json", "content-state.json"]) {
            await rm(path.join(root, name), { force: true });
        }
        for (const name of ["content-assets", "content-revisions"]) {
            await rmdir(path.join(root, name)).catch(error => { if (error.code !== "ENOENT") throw error; });
        }
        await rmdir(root);
    });
    async function start({ salesEnabled = true, selfService = true, scope = "all", paymentSource = "api",
        automatic = false, configuredProducts = products } = {}) {
        const module = `data:text/javascript;base64,${Buffer.from(mock).toString("base64")}`;
        server = spawn(process.execPath, ["--import", module, "server.js"], {
            cwd: new URL("../", import.meta.url), stdio: "ignore",
            env: { SystemRoot: process.env.SystemRoot, HOST: "127.0.0.1", PORT: String(port),
                MNG_DATA_DIR: root, MOCK_PROVIDER_DIR: root, ADMIN_SIFRE: password,
                BACKUP_REPO: "test/backup", GITHUB_TOKEN: "test-only", SHOPIER_SALES_ENABLED: String(salesEnabled),
                SHOPIER_SELF_SERVICE_ENABLED: String(selfService),
                SHOPIER_LICENSE_STORAGE: "github", SHOPIER_API_TOKEN: paymentSource === "api" || automatic ? "test-only" : "",
                MOCK_AUTO_CHECKOUT: String(automatic),
                SHOPIER_PAYMENT_SOURCE: paymentSource, SHOPIER_OSB_USERNAME: osbUsername, SHOPIER_OSB_SECRET: osbSecret,
                SHOPIER_CLAIM_SECRET: "test-claim-signing-key-no-production",
                SHOPIER_SALES_SCOPE: scope, SHOPIER_PRODUCT_IDS: JSON.stringify(configuredProducts) },
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
    assert.deepEqual(report.paketler[1].shopierHata, { kod: 403, yanit: "other" });
    assert.doesNotMatch(JSON.stringify(report), /test-only|test-claim-signing-key/);
    const purchase = await fetch(`${base}/satin-al?plan=agency-20-monthly`, { redirect: "manual" });
    assert.equal(purchase.status, 302);
    assert.equal(purchase.headers.get("location"), "https://www.shopier.com/tikmng/52768059");
    const noPlan = await fetch(`${base}/satin-al`, { redirect: "manual" });
    assert.equal(noPlan.headers.get("location"), "/#fiyatlandirma");
    assert.equal((await fetch(`${base}/api/shopier/checkout`, { method: "POST" })).status, 503);
    assert.equal(await readFile(ledgerPath, "utf8"), ledgerBefore);
});

test("individual-only sales deliver one weekly code and leave agencies on the manual route", async t => {
    const { base, start, file, post } = await createLedgerFixture(t);
    await start({ scope: "individual", configuredProducts: {
        "individual-weekly": "5000", "individual-monthly": "5001",
    } });
    assert.match(await (await fetch(base)).text(), /<meta name="tikmng-checkout" content="shopier-individual">/);
    const individual = await fetch(`${base}/satin-al?plan=individual-weekly`);
    assert.equal(individual.status, 200);
    assert.match(await individual.text(), /<meta name="tikmng-checkout" content="shopier-individual">/);
    const agency = await fetch(`${base}/satin-al?plan=agency-10-monthly`, { redirect: "manual" });
    assert.equal(agency.status, 302);
    assert.equal(agency.headers.get("location"), "https://www.shopier.com/tikmng/52768058");
    await post("/api/shopier/checkout", { planId: "agency-10-monthly", username: "Test ajans" }, 400);
    const offer = await post("/api/shopier/checkout", { planId: "individual-weekly", username: "test.creator" }, 201);
    assert.equal(offer.amountMinor, 30000);
    await file("order", { id: "7001", note: offer.reference, paymentStatus: "paid", currency: "TRY",
        lineItems: [{ productId: "5000", type: "digital", quantity: 1 }], refunds: [],
        totals: { subtotal: "300.00", total: "300.00", discount: "0.00", shipping: "0.00" } });
    const claim = { token: offer.token, orderId: "7001" };
    const result = await post("/api/shopier/redeem", claim);
    assert.match(result.code, /^MNGS-[A-F0-9]{20}$/);
    assert.deepEqual(await post("/api/shopier/redeem", claim), result);
});

test("Shopier's signed test can reach a closed store without writing the ledger", async t => {
    const { base, root, start, post } = await createLedgerFixture(t);
    await start({ ...osbOptions, salesEnabled: false });
    const ledgerPath = path.join(root, "github.json");
    const before = await readFile(ledgerPath, "utf8");
    const testEvent = { istest: "1", orderid: "7001", email: "test@example.test", customernote: "private" };
    assert.equal((await osbNotification(base, testEvent, "wrong-key")).status, 403);
    const acknowledged = await osbNotification(base, testEvent);
    assert.equal(acknowledged.status, 200);
    assert.equal(await acknowledged.text(), "success");
    const res = Buffer.from(JSON.stringify(testEvent)).toString("base64");
    const hash = createHmac("sha256", osbSecret).update(res + osbUsername).digest("hex");
    const form = new FormData();
    form.set("res", res);
    form.set("hash", hash);
    const multipart = await fetch(base + "/api/shopier/osb", { method: "POST", body: form });
    assert.equal(multipart.status, 200);
    assert.equal(await multipart.text(), "success");
    assert.equal(await readFile(ledgerPath, "utf8"), before);
    await post("/api/shopier/checkout", { planId: "individual-weekly", username: "test.creator" }, 503);
    const login = await fetch(base + "/api/admin/giris", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: password }),
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const report = await (await fetch(base + "/api/admin/shopier/hazirlik", { headers: { cookie } })).json();
    assert.equal(report.canliSatisAcik, false);
    assert.equal(report.odemeKaynagi, "osb");
    assert.equal(report.shopierBildirimAyariHazir, true);
    assert.ok(Number.isFinite(Date.parse(report.sonShopierBildirimTesti)));
    assert.doesNotMatch(JSON.stringify(report), /test@example|private|test-osb-secret/);
});

test("OSB claims require signed exact payment and deliver one durable code for each paid plan", { timeout: 15_000 }, async t => {
    const { base, root, file, start, stop, post } = await createLedgerFixture(t);
    await start(osbOptions);
    const weekly = await post("/api/shopier/checkout", { planId: "individual-weekly", username: "weekly.creator" }, 201);
    const monthly = await post("/api/shopier/checkout", { planId: "individual-monthly", username: "monthly.creator" }, 201);
    const weekClaim = { token: weekly.token };
    const monthClaim = { token: monthly.token };
    assert.equal(weekly.verification, "osb");
    assert.equal(monthly.verification, "osb");
    await post("/api/shopier/checkout", { planId: "agency-10-monthly", username: "Agency" }, 400);
    const weekEvent = { istest: "0", orderid: "7001", currency: "0", price: "300.00",
        productcount: "1", productid: products["individual-weekly"], customernote: weekly.reference };
    const monthEvent = { ...weekEvent, orderid: "7002", price: "800.00",
        productid: products["individual-monthly"], customernote: monthly.reference };
    assert.equal((await post("/api/shopier/redeem", { ...weekClaim, orderId: weekEvent.orderid }, 409)).code, undefined);
    assert.equal((await osbNotification(base, weekEvent, "wrong-key")).status, 403);
    assert.equal((await osbNotification(base, { ...weekEvent, istest: 1 })).status, 200);
    assert.equal((await osbNotification(base, { ...weekEvent, orderid: "7003",
        customernote: "no-checkout-note" })).status, 200);
    assert.equal((await osbNotification(base, { ...monthEvent, orderid: "7004",
        customernote: weekly.reference, productcount: 2 })).status, 200);
    assert.equal((await post("/api/shopier/redeem", weekClaim, 409)).code, undefined);
    const badAmount = await post("/api/shopier/checkout", { planId: "individual-weekly", username: "weekly.creator" }, 201);
    assert.equal((await osbNotification(base, { ...weekEvent, orderid: "7005", price: "299.99",
        customernote: badAmount.reference })).status, 200);
    assert.equal((await post("/api/shopier/redeem", { token: badAmount.token }, 409)).code, undefined);
    const badProduct = await post("/api/shopier/checkout", { planId: "individual-weekly", username: "weekly.creator" }, 201);
    assert.equal((await osbNotification(base, { ...weekEvent, orderid: "7006", productid: monthEvent.productid,
        customernote: badProduct.reference })).status, 200);
    assert.equal((await post("/api/shopier/redeem", { token: badProduct.token }, 409)).code, undefined);

    await file("reject-write", {});
    assert.equal((await osbNotification(base, weekEvent)).status, 503);
    await rm(path.join(root, "reject-write.json"));
    const acknowledgements = await Promise.all([osbNotification(base, weekEvent), osbNotification(base, weekEvent)]);
    for (const response of acknowledgements) assert.equal(await response.text(), "success");
    assert.equal((await osbNotification(base, { ...monthEvent, orderid: "7001" })).status, 409);
    assert.equal((await post("/api/shopier/redeem", monthClaim, 409)).code, undefined);
    assert.equal((await osbNotification(base, monthEvent)).status, 200);

    await stop();
    await start(osbOptions);
    await file("reject-write", {});
    assert.equal((await post("/api/shopier/redeem", weekClaim, 503)).code, undefined);
    await rm(path.join(root, "reject-write.json"));
    const [week, duplicate, month] = await Promise.all([post("/api/shopier/redeem", weekClaim),
        post("/api/shopier/redeem", weekClaim), post("/api/shopier/redeem", monthClaim)]);
    assert.deepEqual(duplicate, week);
    assert.notEqual(week.code, month.code);
    for (const [receipt, days] of [[week, 7], [month, 30]]) {
        assert.match(receipt.code, /^MNGS-[A-F0-9]{20}$/);
        const activation = await post("/api/license/verify", { code: receipt.code, deviceId: "paid-device" });
        assert.equal(activation.valid, true);
        assert.equal(activation.remainingDays, days);
    }
    await stop();
    await start(osbOptions);
    assert.deepEqual(await post("/api/shopier/redeem", weekClaim), week);
    assert.deepEqual(await post("/api/shopier/redeem", monthClaim), month);
});

test("manual storefront uses catalog products while an existing signed checkout can be recovered", async t => {
    const { base, start, stop, post } = await createLedgerFixture(t);
    const options = { ...osbOptions, automatic: true };
    await start(options);
    const buyer = { planId: "individual-weekly", username: "weekly.creator" };
    const oldOrder = await fetch(base + "/api/shopier/checkout", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(buyer) });
    assert.equal(oldOrder.status, 201);
    const cookie = oldOrder.headers.get("set-cookie").split(";")[0];
    const quote = await oldOrder.json();
    await stop();
    await start({ ...options, selfService: false });

    const home = await (await fetch(base)).text();
    assert.match(home, /<meta name="tikmng-checkout" content="closed">/);
    assert.match(home, /Haftalık aldım · WhatsApp/);
    assert.match(home, /Aylık aldım · WhatsApp/);
    const checkout = base + "/satin-al?plan=individual-weekly";
    const redirect = await fetch(checkout, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "https://www.shopier.com/tikmng/52768054");
    await post("/api/shopier/checkout", buyer, 410);

    assert.equal((await fetch(checkout, { headers: { cookie }, redirect: "manual" })).status, 200);
    assert.deepEqual(await (await fetch(base + "/api/shopier/current", { headers: { cookie } })).json(), quote);
});

test("automatic private-product checkout delivers without a buyer reference and survives restart", { timeout: 20_000 }, async t => {
    const { base, root, file, start, stop, post } = await createLedgerFixture(t);
    const options = { ...osbOptions, automatic: true };
    await start(options);
    await file("reject-write", {});
    await post("/api/shopier/checkout", { planId: "individual-weekly", username: "weekly.creator" }, 503);
    await rm(path.join(root, "reject-write.json"));
    assert.equal(JSON.parse(await readFile(path.join(root, "created-products.json"), "utf8"))[0].stockQuantity, 0);
    const response = await fetch(base + "/api/shopier/checkout", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "individual-weekly", username: "weekly.creator" }) });
    assert.equal(response.status, 201);
    const week = await response.json();
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(week.paymentUrl, /^\/satin-al\/odeme\?token=/);
    const current = await fetch(base + "/api/shopier/current", { headers: { cookie } });
    assert.deepEqual(await current.json(), week);
    const redirect = await fetch(base + week.paymentUrl, { redirect: "manual" });
    assert.equal(redirect.status, 303);
    assert.equal(redirect.headers.get("location"), "https://www.shopier.com/6201");
    assert.equal(redirect.headers.get("referrer-policy"), "no-referrer");
    const month = await post("/api/shopier/checkout", { planId: "individual-monthly", username: "monthly.creator" }, 201);
    await post("/api/shopier/redeem", { token: week.token }, 409);
    await stop();
    await start(options);
    const paidOrder = (id, productId, price) => ({ id, paymentStatus: "paid", currency: "TRY",
        dateCreated: new Date().toISOString(), note: "",
        lineItems: [{ productId, type: "digital", quantity: 1, price, total: price }], refunds: [],
        totals: { subtotal: price, total: price, discount: "0.00", shipping: "0.00" } });
    await file("block-order-reads", {});
    const event = { istest: 0, orderid: "7001", currency: 0, price: "300.00",
        productcount: 1, productid: "6201", customernote: "" };
    assert.equal((await osbNotification(base, event, "wrong-signature")).status, 403);
    assert.equal(await (await osbNotification(base, { ...event, istest: 1 })).text(), "success");
    await post("/api/shopier/redeem", { token: week.token }, 409);
    assert.equal(await (await osbNotification(base, event)).text(), "success");
    assert.equal(await (await osbNotification(base, event)).text(), "success");
    const [issued, duplicate] = await Promise.all([
        post("/api/shopier/redeem", { token: week.token }),
        post("/api/shopier/redeem", { token: week.token }),
    ]);
    assert.deepEqual(issued, duplicate);
    assert.equal((await post("/api/license/verify", { code: issued.code, deviceId: "weekly-device" })).remainingDays, 7);
    await rm(path.join(root, "block-order-reads.json"));
    const discounted = paidOrder("7002", "6202", "800.00");
    discounted.totals.discount = "50.00";
    discounted.totals.total = "750.00";
    discounted.discounts = [{ id: "501", method: "discountCode" }];
    await file("order", discounted);
    // Returning to the site recovers a missed notification from the exact private product.
    const monthly = await post("/api/shopier/redeem", { token: month.token });
    assert.equal((await post("/api/license/verify", { code: monthly.code, deviceId: "monthly-device" })).remainingDays, 30);
    await stop();
    await start(options);
    assert.deepEqual(await post("/api/shopier/redeem", { token: week.token }), issued);
    assert.deepEqual(await post("/api/shopier/redeem", { token: month.token }), monthly);
});

test("only an administrator can recover an already paid legacy checkout without its note", async t => {
    const { base, file, start, stop, post } = await createLedgerFixture(t);
    await start(osbOptions);
    const legacy = await post("/api/shopier/checkout", { planId: "individual-weekly", username: "paid.creator" }, 201);
    await stop();
    await start({ ...osbOptions, automatic: true });
    const claim = { token: legacy.token, orderId: "7001" };
    await file("order", { id: "7001", paymentStatus: "paid", currency: "TRY", note: "",
        dateCreated: new Date().toISOString(),
        lineItems: [{ productId: "5000", type: "digital", quantity: 1, price: "300.00", total: "300.00" }],
        refunds: [], totals: { subtotal: "300.00", total: "300.00", discount: "0.00", shipping: "0.00" } });
    await post("/api/shopier/redeem", { token: legacy.token }, 409);
    await post("/api/admin/shopier/eslestir", claim, 401);
    const login = await fetch(base + "/api/admin/giris", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: password }) });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const recover = () => fetch(base + "/api/admin/shopier/eslestir", { method: "POST",
        headers: { cookie }, body: new URLSearchParams(claim) });
    const recovered = await recover();
    assert.equal(recovered.status, 200);
    const buyerCookie = recovered.headers.get("set-cookie").split(";")[0];
    const restored = await fetch(base + "/api/shopier/current", { headers: { cookie: buyerCookie } });
    assert.equal((await restored.json()).token, legacy.token);
    const license = await recovered.json();
    assert.deepEqual(await (await recover()).json(), license);
    assert.deepEqual(await post("/api/shopier/redeem", { token: legacy.token }), license);
});

test("Shopier code and agency membership survive restarts with no persistent Render disk", { timeout: 15_000 }, async t => {
    const { root, file, base, start, stop, post } = await createLedgerFixture(t);
    await start();
    assert.match(await (await fetch(base)).text(), /<meta name="tikmng-checkout" content="shopier">/);
    assert.equal((await fetch(`${base}/satin-al?plan=agency-10-monthly`)).status, 200);
    const offer = await post("/api/shopier/checkout", { planId: "agency-10-monthly", username: "Test ajans" }, 201);
    await file("order", { id: "7001", note: offer.reference, paymentStatus: "paid", currency: "TRY",
        lineItems: [{ productId: "5002", type: "digital", quantity: 1 }], refunds: [],
        totals: { subtotal: "2000.00", total: "2000.00", discount: "0.00", shipping: "0.00" } });
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
        totals: { subtotal: "300.00", total: "300.00", discount: "0.00", shipping: "0.00" } });
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
    assert.deepEqual(paid.shopier, { orderId, reference: offer.reference, planId, amountMinor: 30000 });
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
