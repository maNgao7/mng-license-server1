import assert from "node:assert/strict";
import { test } from "node:test";
import { checkShopierOffer, verifyShopierPayment } from "../shopier-payment.js";
import { salesPlans } from "../web/sales-catalog.js";

const orderId = "order_test";
const reference = "MNG-0123456789ABCDEF0123456789ABCDEF";
const apiToken = "local-test-only";
const decimal = minor => (minor / 100).toFixed(2);

function checkoutFixture(plan, discountMinor = 0) {
    const productId = `fixture-${plan.id}`;
    const amountMinor = plan.priceMinor - discountMinor;
    const quote = { reference, productId, amountMinor, discountMinor };
    const order = {
        id: orderId,
        paymentStatus: "paid",
        currency: "TRY",
        note: reference,
        lineItems: [{ productId, type: "digital", quantity: 1 }],
        totals: {
            subtotal: decimal(plan.priceMinor), shipping: "0.00",
            discount: decimal(discountMinor), total: decimal(amountMinor),
        },
        refunds: [],
    };
    return { quote, order };
}

function verify(quote, order) {
    return verifyShopierPayment({
        apiToken, orderId, quote,
        fetchOrder: async (url, options) => {
            assert.equal(url, "https://api.shopier.com/v1/orders/order_test");
            assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
            assert.equal(options.redirect, "error");
            return Response.json(order);
        },
    });
}

test("verifies a matching simulated paid order for every catalog plan", async () => {
    for (const plan of salesPlans) {
        const { quote, order } = checkoutFixture(plan);
        assert.deepEqual(await verify(quote, order), { orderId, ...quote });
    }
});

test("matches the server-calculated discount and total in kuruş", async () => {
    const { quote, order } = checkoutFixture(salesPlans[0], 6250);
    assert.equal((await verify(quote, order)).amountMinor, 43750);
    order.totals.discount = "0.00";
    assert.equal(await verify(quote, order), null);
});

test("rejects mismatched or nonpayable Shopier orders", async () => {
    const changes = [
        order => { order.id = "different-order"; },
        order => { order.paymentStatus = "unpaid"; },
        order => { order.currency = "USD"; },
        order => { order.note = "someone-elses-order"; },
        order => { order.lineItems[0].productId = "other-plan"; },
        order => { order.lineItems[0].type = "physical"; },
        order => { order.lineItems[0].quantity = 2; },
        order => { order.lineItems.push(order.lineItems[0]); },
        order => { order.totals.total = "499.99"; },
        order => { order.totals.shipping = "1.00"; },
        order => { order.refunds.push({ status: "pending" }); },
        order => { order.refunds.push({ status: "succeeded" }); },
    ];
    for (const change of changes) {
        const { quote, order } = checkoutFixture(salesPlans[0]);
        change(order);
        assert.equal(await verify(quote, order), null);
    }
});

test("handles an unknown order and distinguishes Shopier service failure", async () => {
    const { quote } = checkoutFixture(salesPlans[0]);
    const request = { apiToken, orderId, quote };
    const mockStatus = status => async () => new Response(null, { status });
    assert.equal(await verifyShopierPayment({ ...request, fetchOrder: mockStatus(404) }), null);
    await assert.rejects(verifyShopierPayment({ ...request, fetchOrder: mockStatus(503) }), /503/);
    await assert.rejects(verifyShopierPayment({ ...request, apiToken: "", fetchOrder: mockStatus(200) }), /anahtarı/);
});

test("opens payment only for the matching active digital product and price", async () => {
    const product = { id: "5010", type: "digital", stockStatus: "inStock",
        priceData: { price: "500.00", currency: "TRY", discount: false } };
    const request = { apiToken, productId: "5010", priceMinor: 50000,
        fetchProduct: async (url, options) => {
            assert.equal(url, "https://api.shopier.com/v1/products/5010");
            assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
            return Response.json(product);
        } };
    assert.equal(await checkShopierOffer(request), true);
    product.priceData.price = "505.00";
    assert.equal(await checkShopierOffer(request), false);
    product.priceData.price = "500.00";
    product.stockStatus = "outOfStock";
    assert.equal(await checkShopierOffer(request), false);
});
