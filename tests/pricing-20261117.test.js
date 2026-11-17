import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createPreviewPricing, manualShopierUrl, pricingVersion, salesPlans } from "../web/sales-catalog.js";
import { createShopierCheckout } from "../shopier-checkout.js";
import { verifyShopierPayment } from "../shopier-payment.js";

const approved = {
    "individual-weekly": [30000, "52768054"],
    "individual-monthly": [80000, "52768056"],
    "agency-10-monthly": [200000, "52768058"],
    "agency-20-monthly": [350000, "52768059"],
    "agency-35-monthly": [500000, "52768060"],
    "agency-120-monthly": [1000000, "52768061"],
    "agency-200-monthly": [1500000, "52768062"],
};

test("17 November approved base prices and existing Shopier product identities match every plan", () => {
    assert.equal(pricingVersion, "20261117-approved-v2");
    assert.equal(salesPlans.length, 7);
    const preview = createPreviewPricing();
    for (const plan of salesPlans) {
        const [minor, product] = approved[plan.id];
        assert.equal(plan.priceMinor, minor, plan.id);
        assert.equal(manualShopierUrl(plan.id), `https://www.shopier.com/tikmng/${product}`);
        assert.equal(plan.kind === "agency" ? preview.agencyTiers[plan.seats] : preview.prices[plan.period], minor);
    }
    const homepage = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
    const loader = readFileSync(new URL("../web/portal-pricing.js", import.meta.url), "utf8");
    assert.match(homepage, /portal-pricing\.js\?v=20261117-individual/);
    assert.match(loader, /sales-catalog\.js\?v=20261117-prices-v2/);
});

test("new weekly offers use 300 TL while an already signed paid 500 TL offer remains redeemable", async () => {
    const secret = "pricing-migration-test-only-secret";
    const quote = { reference: "MNG-0123456789ABCDEF0123456789ABCDEF", planId: "individual-weekly",
        owner: "existing.creator", productId: "52768054", amountMinor: 50000,
        discountMinor: 0, createdAt: 1000 };
    const data = Buffer.from(JSON.stringify(quote)).toString("base64url");
    const token = `${data}.${createHmac("sha256", secret).update(`shopier-checkout-v1:${data}`).digest("base64url")}`;
    const rows = [];
    const checkout = createShopierCheckout({ secret, apiToken: "test-only", now: () => 2000,
        products: Object.fromEntries(Object.entries(approved).map(([id, [, product]]) => [id, product])),
        licenses: () => rows, saveLicense: row => rows.push(row), issueCode: () => "TEST-PRESERVED",
        verifyPayment: request => verifyShopierPayment({ ...request, fetchOrder: async () => Response.json({
            id: "555", note: quote.reference, paymentStatus: "paid", currency: "TRY", refunds: [],
            lineItems: [{ productId: quote.productId, type: "digital", quantity: 1 }],
            totals: { subtotal: "500.00", total: "500.00", discount: "0.00", shipping: "0.00" },
        }) }),
    });
    assert.equal(checkout.open("individual-weekly", "new.creator").amountMinor, 30000);
    assert.equal((await checkout.redeem(token, "555")).code, "TEST-PRESERVED");
    assert.equal(rows[0].shopier.amountMinor, 50000);
    assert.equal(rows[0].sure_miktar, 7);
    assert.equal((await checkout.redeem(token, "555")).code, "TEST-PRESERVED");
    assert.equal(rows.length, 1);
});
