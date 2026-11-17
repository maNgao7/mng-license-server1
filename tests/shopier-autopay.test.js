import assert from "node:assert/strict";
import { test } from "node:test";
import {
    createShopierPaymentProduct, disableShopierPaymentProduct, getShopierOrder,
    findShopierOrdersForProduct, matchShopierAutomaticPayment,
} from "../shopier-autopay.js";
import { salesPlans } from "../web/sales-catalog.js";

const apiToken = "mock-provider-token-never-a-real-secret";
const templateProductId = "5000";
const reference = "MNG-0123456789ABCDEF0123456789ABCDEF";
const imageUrl = "https://tikmng.com/portal-hero-v2.png";
const decimal = minor => (minor / 100).toFixed(2);

function fixture(plan = salesPlans[0]) {
    const quote = { reference, planId: plan.id, owner: "private-buyer", productId: "91001",
        amountMinor: plan.priceMinor, discountMinor: 0, createdAt: Date.parse("2026-11-17T10:00:00.678Z") };
    const product = { id: quote.productId, title: "Digital license", type: "digital",
        priceData: { price: decimal(plan.priceMinor), currency: "TRY", discount: false, shippingPrice: "0.00" },
        media: [{ type: "image", url: imageUrl, placement: 1 }], stockQuantity: 1, customListing: true };
    const order = { id: "70001", paymentStatus: "paid", currency: "TRY", status: "unfulfilled",
        dateCreated: "2026-11-17T13:00:01+0300", note: "",
        lineItems: [{ productId: quote.productId, title: "Digital license", type: "digital", quantity: 1,
            price: decimal(quote.amountMinor), total: decimal(quote.amountMinor) }],
        totals: { subtotal: decimal(quote.amountMinor), shipping: "0.00", discount: "0.00", total: decimal(quote.amountMinor) },
        refunds: [] };
    return { quote, product, order };
}

function checkRequest(options, method) {
    assert.equal(options.method ?? "GET", method);
    assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    if (options.body) assert.equal(options.headers["Content-Type"], "application/json");
}

function creationFetch(product, calls = []) {
    return async (url, options) => {
        calls.push({ url, options });
        assert.equal(calls.length, 1, "creation must make a single POST without a template GET or retry");
        assert.equal(url, "https://api.shopier.com/v1/products");
        checkRequest(options, "POST");
        return Response.json(product);
    };
}

test("creates each approved 7/30-day offer with only documented fields and one approved image", async () => {
    for (const plan of salesPlans) {
        const { quote, product } = fixture(plan);
        const originalQuote = structuredClone(quote);
        const calls = [];
        assert.deepEqual(await createShopierPaymentProduct({ apiToken: ` ${apiToken} `, templateProductId, quote,
            fetchProvider: creationFetch(product, calls) }), { productId: product.id });
        assert.equal(calls.length, 1);
        const body = JSON.parse(calls[0].options.body);
        assert.match(body.title, new RegExp(`TikMnG ${plan.period === "weekly" ? 7 : 30} Günlük Dijital`));
        if (plan.kind === "agency") assert.ok(body.title.includes(`${plan.seats} Yayıncı`));
        assert.deepEqual(body, { title: body.title, type: "digital",
            media: [{ type: "image", url: imageUrl, placement: 1 }],
            priceData: { currency: "TRY", price: decimal(plan.priceMinor) },
            shippingPayer: "sellerPays", stockQuantity: 1, customListing: true });
        assert.equal(calls[0].options.body.includes(reference), false);
        assert.equal(calls[0].options.body.includes(quote.owner), false);
        assert.deepEqual(quote, originalQuote);
    }
});

test("creates a fresh provider product on every checkout without reusing the template", async () => {
    const { quote, product } = fixture();
    let creations = 0;
    const fetchProvider = async (url, options) => {
        assert.equal(url, "https://api.shopier.com/v1/products");
        checkRequest(options, "POST");
        creations++;
        return Response.json({ ...product, id: String(91000 + creations) });
    };
    const first = await createShopierPaymentProduct({ apiToken, templateProductId, quote, fetchProvider });
    const second = await createShopierPaymentProduct({ apiToken, templateProductId,
        quote: { ...quote, reference: "MNG-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, fetchProvider });
    assert.deepEqual([first, second], [{ productId: "91001" }, { productId: "91002" }]);
    assert.equal(creations, 2);
});

test("rejects invalid or unapproved checkout inputs before making any provider request", async t => {
    const cases = {
        "missing quote": args => { args.quote = null; },
        "bad reference": args => { args.quote.reference = "buyer-note"; },
        "missing reference": args => { delete args.quote.reference; },
        "fractional amount": args => { args.quote.amountMinor = 30000.1; },
        "string amount": args => { args.quote.amountMinor = "30000"; },
        "zero amount": args => { args.quote.amountMinor = 0; },
        "unsafe amount": args => { args.quote.amountMinor = Number.MAX_SAFE_INTEGER + 1; },
        "unapproved price": args => { args.quote.amountMinor = 29999; },
        "unknown plan": args => { args.quote.planId = "other-weekly"; },
        "discounted quote": args => { args.quote.discountMinor = 1; },
        "missing time": args => { delete args.quote.createdAt; },
        "nonfinite time": args => { args.quote.createdAt = NaN; },
        "negative time": args => { args.quote.createdAt = -1; },
        "invalid template id": args => { args.templateProductId = "5000?other=1"; },
        "numeric template id": args => { args.templateProductId = 5000; },
        "noncanonical template id": args => { args.templateProductId = "05000"; },
    };
    for (const [label, mutate] of Object.entries(cases)) await t.test(label, async () => {
        const args = { apiToken, templateProductId, quote: fixture().quote,
            fetchProvider: async () => assert.fail("invalid quote contacted the provider") };
        mutate(args);
        await assert.rejects(createShopierPaymentProduct(args), /geçersiz/);
    });
});

test("uses an explicitly approved HTTPS PNG override without looking up the template", async () => {
    const { quote, product } = fixture();
    const approvedImageUrl = "https://approved.example.test/license.png?version=2";
    const calls = [];
    await createShopierPaymentProduct({ apiToken, templateProductId, quote, approvedImageUrl,
        fetchProvider: creationFetch(product, calls) });
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(calls[0].options.body).media, [{ type: "image", url: approvedImageUrl, placement: 1 }]);
});

test("rejects invalid approved image overrides before contacting the provider", async () => {
    const { quote } = fixture();
    for (const approvedImageUrl of [null, "", "not-a-url", "http://example.test/a.png", "https://example.test/a.webp",
        "https://user:pass@example.test/a.png", "https://example.test/a.webp?format=.png"]) {
        await assert.rejects(createShopierPaymentProduct({ apiToken, templateProductId, quote, approvedImageUrl,
            fetchProvider: async () => assert.fail("invalid image contacted the provider") }), /görseli geçersiz/);
    }
});

test("never accepts an unverified product response as a checkout product", async t => {
    const cases = {
        "template reused": value => { value.id = templateProductId; },
        "missing id": value => { delete value.id; },
        "numeric id": value => { value.id = 91001; },
        "noncanonical id": value => { value.id = "05000"; },
        "nonnumeric id": value => { value.id = "https://example.test/product"; },
        "physical product": value => { value.type = "physical"; },
        "wrong currency": value => { value.priceData.currency = "EUR"; },
        "wrong price": value => { value.priceData.price = "300.01"; },
        "discounted price": value => { value.priceData.discount = true; },
        "shipping charge": value => { value.priceData.shippingPrice = "1.00"; },
        "public listing": value => { value.customListing = false; },
        "missing hidden flag": value => { delete value.customListing; },
        "wrong stock": value => { value.stockQuantity = 2; },
    };
    for (const [label, mutate] of Object.entries(cases)) await t.test(label, async () => {
        const { quote, product } = fixture();
        mutate(product);
        await assert.rejects(createShopierPaymentProduct({ apiToken, templateProductId, quote,
            fetchProvider: creationFetch(product) }), /ödeme ürünü/);
    });
});

test("gets the raw full order, preserves provider fields, and returns null for 404", async () => {
    const { order } = fixture();
    order.buyer = { email: "mock@example.test" };
    assert.deepEqual(await getShopierOrder({ apiToken, orderId: order.id, fetchProvider: async (url, options) => {
        assert.equal(url, `https://api.shopier.com/v1/orders/${order.id}`);
        checkRequest(options, "GET");
        return Response.json(order);
    } }), order);
    assert.equal(await getShopierOrder({ apiToken, orderId: order.id,
        fetchProvider: async () => new Response("non-sensitive mock", { status: 404 }) }), null);
    for (const orderId of [null, 70001, "", "../orders", "70001?token=bad", "a".repeat(81)]) {
        assert.equal(await getShopierOrder({ apiToken, orderId,
            fetchProvider: async () => assert.fail("invalid order id reached the provider") }), null);
    }
});

test("finds orders using the documented bare-array response and product filter", async () => {
    const { quote, order } = fixture();
    assert.deepEqual(await findShopierOrdersForProduct({ apiToken, productId: quote.productId,
        fetchProvider: async (url, options) => {
            const parsed = new URL(url);
            assert.equal(parsed.origin + parsed.pathname, "https://api.shopier.com/v1/orders");
            assert.equal(parsed.searchParams.get("productId"), quote.productId);
            assert.equal(parsed.searchParams.get("limit"), "50");
            checkRequest(options, "GET");
            return Response.json([order]);
        } }), [order]);
    assert.deepEqual(await findShopierOrdersForProduct({ apiToken, productId: quote.productId,
        fetchProvider: async () => Response.json([]) }), []);
    for (const body of [{ orders: [order] }, { data: [order] }, null, {}]) {
        await assert.rejects(findShopierOrdersForProduct({ apiToken, productId: quote.productId,
            fetchProvider: async () => Response.json(body) }), /Shopier/);
    }
});

test("search pagination retains full orders on subsequent pages", async () => {
    const { quote, order } = fixture();
    const first = Array.from({ length: 50 }, (_, index) => ({ ...order, id: String(70000 + index) }));
    let requests = 0;
    const orders = await findShopierOrdersForProduct({ apiToken, productId: quote.productId,
        fetchProvider: async url => {
            requests++;
            assert.equal(new URL(url).searchParams.get("page") ?? "1", String(requests));
            return Response.json(requests === 1 ? first : [{ ...order, id: "80000" }]);
        } });
    assert.equal(requests, 2);
    assert.deepEqual(orders, [...first, { ...order, id: "80000" }]);
});

test("search fails safely instead of silently truncating endless full pages", async () => {
    const { quote, order } = fixture();
    let requests = 0;
    await assert.rejects(findShopierOrdersForProduct({ apiToken, productId: quote.productId,
        fetchProvider: async () => { requests++; return Response.json(Array(50).fill(order)); } }), /Shopier/);
    assert.equal(requests, 20);
});

test("disables an orphan using only reversible stock-zero PUT and accepts an empty success body", async () => {
    const { quote } = fixture();
    let requests = 0;
    await disableShopierPaymentProduct({ apiToken, productId: quote.productId, fetchProvider: async (url, options) => {
        requests++;
        assert.equal(url, `https://api.shopier.com/v1/products/${quote.productId}`);
        checkRequest(options, "PUT");
        assert.deepEqual(JSON.parse(options.body), { stockQuantity: 0 });
        return new Response(null, { status: 204 });
    } });
    assert.equal(requests, 1);
});

test("product lookup and cleanup reject invalid ids without contacting the provider", async () => {
    for (const action of [findShopierOrdersForProduct, disableShopierPaymentProduct]) {
        for (const productId of [null, 5000, "", "0", "05000", "5000?other=1", "1".repeat(21)]) {
            await assert.rejects(action({ apiToken, productId,
                fetchProvider: async () => assert.fail("invalid product id contacted provider") }), /geçersiz/);
        }
    }
});

function operations(fetchProvider, { apiToken: overrideToken } = { apiToken }) {
    const { quote } = fixture();
    return [
        () => createShopierPaymentProduct({ apiToken: overrideToken, templateProductId, quote, fetchProvider }),
        () => getShopierOrder({ apiToken: overrideToken, orderId: "70001", fetchProvider }),
        () => findShopierOrdersForProduct({ apiToken: overrideToken, productId: quote.productId, fetchProvider }),
        () => disableShopierPaymentProduct({ apiToken: overrideToken, productId: quote.productId, fetchProvider }),
    ];
}

test("missing or malformed credentials never reach fetch", async () => {
    for (const token of [undefined, null, "", "  ", "token\r\ninjected: bad"]) {
        for (const operation of operations(async () => assert.fail("invalid token reached fetch"), { apiToken: token })) {
            await assert.rejects(operation(), /anahtarı/);
        }
    }
});

test("all provider operations expose safe HTTP statuses without provider bodies or tokens", async () => {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
        for (const [index, operation] of operations(async () => new Response(`PRIVATE ${apiToken}`, { status })).entries()) {
            if (index === 1 && status === 404) { assert.equal(await operation(), null); continue; }
            await assert.rejects(operation(), error => {
                assert.equal(error.shopierStatus, status);
                assert.ok(error.message.includes(String(status)));
                assert.equal(error.message.includes(apiToken), false);
                assert.equal(error.message.includes("PRIVATE"), false);
                assert.equal(error.cause, undefined);
                return true;
            });
        }
    }
});

test("network errors are sanitized for every provider operation", async () => {
    for (const operation of operations(async () => { throw new Error(`PRIVATE ${apiToken}`); })) {
        await assert.rejects(operation(), error => {
            assert.match(error.message, /Shopier/);
            assert.equal(error.message.includes(apiToken), false);
            assert.equal(error.message.includes("PRIVATE"), false);
            assert.equal(error.cause, undefined);
            return true;
        });
    }
});

test("malformed success JSON is sanitized for operations that consume a JSON body", async () => {
    const actions = operations(async () => new Response(`PRIVATE ${apiToken}`, { status: 200 }));
    for (const operation of actions.slice(0, 3)) {
        await assert.rejects(operation(), error => {
            assert.match(error.message, /Shopier/);
            assert.equal(error.message.includes(apiToken), false);
            assert.equal(error.message.includes("PRIVATE"), false);
            assert.equal(error.cause, undefined);
            return true;
        });
    }
    await actions[3](); // Stock-zero PUT does not require a response body.
});

test("each HTTP request has a 10-second abort signal, including POST and PUT", async t => {
    const { quote, product, order } = fixture();
    const durations = [];
    t.mock.method(AbortSignal, "timeout", duration => {
        durations.push(duration);
        return new AbortController().signal;
    });
    await createShopierPaymentProduct({ apiToken, templateProductId, quote,
        fetchProvider: creationFetch(product) });
    await getShopierOrder({ apiToken, orderId: order.id, fetchProvider: async () => Response.json(order) });
    await findShopierOrdersForProduct({ apiToken, productId: quote.productId, fetchProvider: async () => Response.json([]) });
    await disableShopierPaymentProduct({ apiToken, productId: quote.productId, fetchProvider: async () => new Response(null, { status: 204 }) });
    assert.deepEqual(durations, [10000, 10000, 10000, 10000]);
});

test("timeout aborts are sanitized instead of leaking transport error text", async t => {
    let controller;
    t.mock.method(AbortSignal, "timeout", duration => {
        assert.equal(duration, 10000);
        controller = new AbortController();
        return controller.signal;
    });
    for (const operation of operations(async (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }))) {
        const pending = operation();
        const rejection = assert.rejects(pending, error => {
            assert.match(error.message, /Shopier/);
            assert.equal(error.message.includes(apiToken), false);
            assert.equal(error.cause, undefined);
            return true;
        });
        controller.abort(new DOMException(`PRIVATE ${apiToken}`, "TimeoutError"));
        await rejection;
    }
});

test("POST failure does not retry or return the template product", async () => {
    const { quote } = fixture();
    let requests = 0;
    await assert.rejects(createShopierPaymentProduct({ apiToken, templateProductId, quote, fetchProvider: async (_url, options) => {
        checkRequest(options, "POST");
        requests++;
        return new Response("PRIVATE", { status: 503 });
    } }), /503/);
    assert.equal(requests, 1);
});

test("matches each plan using only paid evidence and private product binding, without a buyer reference", () => {
    for (const plan of salesPlans) {
        const { quote, order } = fixture(plan);
        for (const note of [undefined, "", "unrelated buyer note", reference]) {
            if (note === undefined) delete order.note;
            else order.note = note;
            const before = Date.now();
            const receipt = matchShopierAutomaticPayment(order, quote);
            const after = Date.now();
            assert.deepEqual(receipt, { orderId: order.id, productId: quote.productId,
                reference, amountMinor: quote.amountMinor, receivedAt: receipt?.receivedAt });
            assert.ok(Number.isInteger(receipt.receivedAt) && receipt.receivedAt >= before && receipt.receivedAt <= after);
        }
    }
});

test("does not match a different checkout even when the buyer note contains its reference", () => {
    const { quote, order } = fixture();
    order.note = quote.reference;
    assert.equal(matchShopierAutomaticPayment(order, { ...quote, productId: "91002" }), null);
});

test("matches a Shopier-approved discount code to the private product and exact paid total", () => {
    const { quote, order } = fixture();
    quote.automatic = true;
    order.totals.discount = "50.00";
    order.totals.total = "250.00";
    order.discounts = [{ id: "70007", method: "discountCode" }];
    const receipt = matchShopierAutomaticPayment(order, quote);
    assert.deepEqual(receipt, { orderId: order.id, productId: quote.productId, reference,
        amountMinor: 25000, discountMinor: 5000, receivedAt: receipt?.receivedAt });
    assert.equal(matchShopierAutomaticPayment(order, { ...quote, automatic: false }), null);
    assert.equal(matchShopierAutomaticPayment({ ...order, discounts: [] }, quote), null);
    assert.equal(matchShopierAutomaticPayment({ ...order, discounts: [{ id: "70007", method: "automaticDiscount" }] }, quote), null);
    assert.equal(matchShopierAutomaticPayment({ ...order, totals: { ...order.totals, total: "249.99" } }, quote), null);
});

test("payment matching rejects mismatched, malformed, or ambiguous evidence", async t => {
    const cases = {
        "missing order": value => { value.order = null; },
        "missing quote": value => { value.quote = null; },
        "missing order id": ({ order }) => { delete order.id; },
        "unsafe order id": ({ order }) => { order.id = "../payment"; },
        "missing reference": ({ quote }) => { delete quote.reference; },
        "invalid product id": ({ quote }) => { quote.productId = "bad-id"; },
        "string quote amount": ({ quote }) => { quote.amountMinor = "30000"; },
        "zero quote amount": ({ quote }) => { quote.amountMinor = 0; },
        "negative quote amount": ({ quote }) => { quote.amountMinor = -30000; },
        "fractional quote amount": ({ quote }) => { quote.amountMinor = 30000.5; },
        "unsafe quote amount": ({ quote }) => { quote.amountMinor = Number.MAX_SAFE_INTEGER + 1; },
        "discounted quote": ({ quote }) => { quote.discountMinor = 10; },
        "missing quote time": ({ quote }) => { delete quote.createdAt; },
        "unpaid order": ({ order }) => { order.paymentStatus = "unpaid"; },
        "pending payment": ({ order }) => { order.paymentStatus = "pending"; },
        "wrong currency": ({ order }) => { order.currency = "USD"; },
        "missing lines": ({ order }) => { delete order.lineItems; },
        "no lines": ({ order }) => { order.lineItems = []; },
        "multiple lines": ({ order }) => { order.lineItems.push(structuredClone(order.lineItems[0])); },
        "extra free line": ({ order }) => { order.lineItems.push({ type: "digital", price: "0.00", total: "0.00", quantity: 1 }); },
        "null line": ({ order }) => { order.lineItems = [null]; },
        "different product": ({ order }) => { order.lineItems[0].productId = "91002"; },
        "numeric product id": ({ order }) => { order.lineItems[0].productId = 91001; },
        "physical line": ({ order }) => { order.lineItems[0].type = "physical"; },
        "two units": ({ order }) => { order.lineItems[0].quantity = 2; },
        "string quantity": ({ order }) => { order.lineItems[0].quantity = "1"; },
        "missing unit price": ({ order }) => { delete order.lineItems[0].price; },
        "wrong unit price": ({ order }) => { order.lineItems[0].price = "299.99"; },
        "wrong line total": ({ order }) => { order.lineItems[0].total = "300.01"; },
        "missing totals": ({ order }) => { delete order.totals; },
        "wrong subtotal": ({ order }) => { order.totals.subtotal = "300.01"; },
        "wrong grand total": ({ order }) => { order.totals.total = "299.99"; },
        "shipping fee": ({ order }) => { order.totals.shipping = "0.01"; },
        "discount": ({ order }) => { order.totals.discount = "0.01"; },
        "offsetting shipping and discount": ({ order }) => { order.totals.shipping = order.totals.discount = "1.00"; },
        "pending refund": ({ order }) => { order.refunds = [{ status: "pending", type: "partial", total: "0.01" }]; },
        "successful refund": ({ order }) => { order.refunds = [{ status: "succeeded", type: "full", total: "300.00" }]; },
        "failed and pending refunds": ({ order }) => { order.refunds = [{ status: "failed" }, { status: "pending" }]; },
        "unknown refund status": ({ order }) => { order.refunds = [{ status: "other" }]; },
        "missing refund status": ({ order }) => { order.refunds = [{}]; },
        "null refund entry": ({ order }) => { order.refunds = [null]; },
        "invalid refunds container": ({ order }) => { order.refunds = {}; },
        "null refunds container": ({ order }) => { order.refunds = null; },
    };
    for (const [label, mutate] of Object.entries(cases)) await t.test(label, () => {
        const value = fixture();
        mutate(value);
        assert.equal(matchShopierAutomaticPayment(value.order, value.quote), null);
    });
});

test("money fields require exact two-decimal strings rather than floating-point coercion", () => {
    for (const value of [undefined, null, 300, "300", "300.0", "300.000", "3e2", "300,00", " 300.00", "+300.00", "-300.00", "Infinity", "99999999999.00"]) {
        for (const target of ["price", "lineTotal", "subtotal", "total"]) {
            const { order, quote } = fixture();
            if (target === "price") order.lineItems[0].price = value;
            else if (target === "lineTotal") order.lineItems[0].total = value;
            else order.totals[target] = value;
            assert.equal(matchShopierAutomaticPayment(order, quote), null, `${target}: ${String(value)}`);
        }
    }
});

test("requires zero-valued shipping and discount fields, not absent or coercible values", () => {
    for (const target of ["shipping", "discount"]) for (const value of [undefined, null, 0, "0", "0.0", "-0.00", " 0.00", "NaN"]) {
        const { order, quote } = fixture();
        order.totals[target] = value;
        assert.equal(matchShopierAutomaticPayment(order, quote), null);
    }
});

test("accepts failed refunds, absent refund arrays, and fulfilled digital orders", () => {
    const { order, quote } = fixture();
    order.refunds = [{ status: "failed" }];
    assert.ok(matchShopierAutomaticPayment(order, quote));
    delete order.refunds;
    order.status = "fulfilled";
    assert.ok(matchShopierAutomaticPayment(order, quote));
    delete quote.discountMinor;
    assert.ok(matchShopierAutomaticPayment(order, quote));
});

test("creation time is exact except for documented truncation within the same second", () => {
    const { order, quote } = fixture();
    const cases = [
        ["2026-11-17T10:00:00Z", true],
        ["2026-11-17T13:00:00+0300", true],
        ["2026-11-17T13:00:00+03:00", true],
        ["2026-11-17T10:00:00.677Z", false],
        ["2026-11-17T10:00:00.678Z", true],
        ["2026-11-17T10:00:00.679Z", true],
        ["2026-11-17T10:00:00.000Z", false],
        ["2026-11-17T09:59:59Z", false],
        ["2026-11-17T09:59:59.999Z", false],
        ["2026-11-17T10:00:01Z", true],
    ];
    for (const [dateCreated, accepted] of cases) {
        order.dateCreated = dateCreated;
        assert.equal(Boolean(matchShopierAutomaticPayment(order, quote)), accepted, dateCreated);
    }
    order.dateCreated = "2026-11-17T10:00:00Z";
    quote.createdAt = Date.parse("2026-11-17T10:00:00.999Z");
    assert.ok(matchShopierAutomaticPayment(order, quote), "999ms of second truncation is accepted");
    quote.createdAt += 1;
    assert.equal(matchShopierAutomaticPayment(order, quote), null, "1000ms earlier is rejected");
});

test("rejects missing, timezone-free, malformed, or normalized invalid calendar timestamps", () => {
    for (const dateCreated of [undefined, null, 1794909600000, "", "not-a-date", "2026-11-17", "2026-11-17T10:00:01",
        "2026-02-30T10:00:01Z", "2026-13-17T10:00:01Z", "2026-11-17T24:00:00Z", "2026-11-17T10:00:01+0300 trailing"]) {
        const { order, quote } = fixture();
        order.dateCreated = dateCreated;
        quote.createdAt = Date.parse("2026-01-01T00:00:00Z");
        assert.equal(matchShopierAutomaticPayment(order, quote), null, String(dateCreated));
    }
});

test("matching leaves raw provider evidence and the durable quote untouched", () => {
    const { order, quote } = fixture();
    const original = structuredClone({ order, quote });
    assert.ok(matchShopierAutomaticPayment(order, quote));
    assert.deepEqual({ order, quote }, original);
});
