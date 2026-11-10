import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createShopierCheckout, shopierProductIds } from "../shopier-checkout.js";
import { verifyShopierPayment } from "../shopier-payment.js";
import { salesPlans } from "../web/sales-catalog.js";

const products = Object.fromEntries(salesPlans.map((plan, i) => [plan.id, String(5000 + i)]));

test("public WhatsApp contact links use the TikMnG username", () => {
    const homepage = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
    const links = [...homepage.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(([, href]) => new URL(href));
    assert.equal(links.length, 2);
    for (const link of links) {
        assert.equal(link.pathname, "/tikmng");
        assert.ok(link.searchParams.get("text")?.includes("TikMnG"));
    }
});

function fixture({ rows = [], saveLicense, verifyPayment, now } = {}) {
    return {
        rows,
        checkout: createShopierCheckout({
            secret: "test-signing-secret-keep-out-of-production",
            apiToken: "test-only", products, now,
            licenses: () => rows,
            issueCode: () => `MOCK-${rows.length + 1}`,
            saveLicense: saveLicense ?? (license => rows.push(license)),
            verifyPayment: verifyPayment ?? (async () => ({ verified: true })),
        }),
    };
}

test("checkout requires seven distinct configured Shopier products", () => {
    assert.deepEqual(shopierProductIds(JSON.stringify(products)), products);
    assert.equal(shopierProductIds("{}"), null);
    assert.equal(shopierProductIds(JSON.stringify({ ...products, "individual-monthly": "5000" })), null);
    assert.equal(shopierProductIds(JSON.stringify({ ...products, "individual-weekly": "https://bad.example" })), null);
});

test("all seven offers save the configured duration, agency capacity and price", async () => {
    const { rows, checkout } = fixture();
    for (const [index, plan] of salesPlans.entries()) {
        const order = checkout.open(plan.id, "@ornek");
        assert.match(order.reference, /^MNG-[A-F0-9]{32}$/);
        assert.equal(order.paymentUrl, `https://www.shopier.com/tikmng/${products[plan.id]}`);
        assert.equal(order.amountMinor, plan.priceMinor);
        const result = await checkout.redeem(order.token, String(800 + index));
        const license = rows[index];
        assert.equal(result.code, license.kod);
        assert.equal(license.sure_miktar, plan.period === "weekly" ? 7 : 30);
        assert.equal(license.max_cihaz ?? 1, plan.seats);
        assert.equal(license.shopier.amountMinor, plan.priceMinor);
    }
});

test("overlapping redemptions, reload and competing claims cannot issue a second code", async () => {
    const { rows, checkout } = fixture();
    const { token } = checkout.open("agency-10-monthly", "Örnek ajans");
    const results = await Promise.all([checkout.redeem(token, "815"), checkout.redeem(token, "815")]);
    assert.equal(rows.length, 1);
    assert.deepEqual(results[0], results[1]);
    const restarted = fixture({ rows: structuredClone(rows) }).checkout;
    assert.deepEqual(await restarted.redeem(token, "815"), results[0]);
    assert.equal(await restarted.redeem(token, "816"), null);
    assert.equal(await restarted.redeem(restarted.open("agency-10-monthly", "Başka ajans").token, "815"), null);
});

test("missing payment, a tampered or expired claim and a write failure never reveal a code", async () => {
    let clock = 1000;
    const { rows, checkout } = fixture({ verifyPayment: async () => null, now: () => clock });
    assert.equal(checkout.open("invalid", "ornek"), null);
    assert.equal(checkout.open("individual-weekly", "invalid name"), null);
    const { token } = checkout.open("individual-weekly", "ornek");
    assert.equal(await checkout.redeem(token, "810"), null);
    const canVerify = fixture({ rows, now: () => clock }).checkout;
    const [data, signature] = token.split(".");
    assert.equal(await canVerify.redeem(`${data}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`, "810"), null);
    const failing = fixture({ rows, now: () => clock, saveLicense: () => { throw Error("disk error"); } }).checkout;
    await assert.rejects(failing.redeem(token, "810"), /disk error/);
    clock += 30 * 86_400_000;
    assert.equal(await canVerify.redeem(token, "810"), null);
    assert.equal(rows.length, 0);
});

test("a simulated Shopier response completes a purchase without charging a card", async () => {
    let providerOrder;
    const { rows, checkout } = fixture({
        verifyPayment: request => verifyShopierPayment({
            ...request, fetchOrder: async () => Response.json(providerOrder),
        }),
    });
    const pending = checkout.open("agency-120-monthly", "Örnek ajans");
    providerOrder = {
        id: "825", note: pending.reference, paymentStatus: "unpaid", currency: "TRY",
        lineItems: [{ productId: products["agency-120-monthly"], type: "digital", quantity: 1 }],
        totals: { subtotal: "12500.00", total: "12500.00", discount: "0.00", shipping: "0.00" },
        refunds: [],
    };
    assert.equal(await checkout.redeem(pending.token, "825"), null);
    assert.equal(rows.length, 0);
    providerOrder.paymentStatus = "paid";
    assert.equal((await checkout.redeem(pending.token, "825")).code, "MOCK-1");
    assert.equal(rows[0].max_cihaz, 120);
});

test("a remote write must finish before the code is delivered or a second claim can issue one", async () => {
    const rows = [];
    let startWrite;
    let releaseWrite;
    const writing = new Promise(resolve => { startWrite = resolve; });
    const remoteAcknowledgement = new Promise(resolve => { releaseWrite = resolve; });
    let writeCount = 0;
    const { checkout } = fixture({ rows, async saveLicense(license) {
        writeCount++;
        startWrite();
        await remoteAcknowledgement;
        rows.push(license);
    } });
    const { token } = checkout.open("individual-weekly", "ornek");
    let delivered = false;
    const first = checkout.redeem(token, "826").then(result => { delivered = true; return result; });
    const second = checkout.redeem(token, "826");
    await writing;
    assert.equal(delivered, false);
    assert.equal(rows.length, 0);
    releaseWrite();
    const results = await Promise.all([first, second]);
    assert.equal(writeCount, 1);
    assert.equal(rows.length, 1);
    assert.deepEqual(results[0], results[1]);
});
