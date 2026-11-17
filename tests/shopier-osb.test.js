import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { readShopierOsbForm, readShopierOsb, shopierAutomaticOsbReceipt } from "../shopier-osb.js";

const credentials = { username: "osb-test-seller", secret: "osb-test-secret" };
const event = { istest: 1, email: "private@example.test", customernote: "private note" };
function signed(payload) {
    const res = Buffer.from(JSON.stringify(payload)).toString("base64");
    const hash = createHmac("sha256", credentials.secret).update(res + credentials.username).digest("hex");
    return { res, hash };
}

test("OSB diagnostics identify rejected envelopes without exposing their contents", () => {
    const cases = [
        [{}, "missing-fields"],
        [{ res: "private invalid payload", hash: "0".repeat(64) }, "payload-encoding"],
        [{ ...signed(event), hash: "private invalid signature" }, "signature-format"],
        [{ ...signed(event), hash: "0".repeat(64) }, "signature-mismatch"],
        [signed({ ...event, istest: true }), "test-flag-boolean"],
    ];
    for (const [body, reason] of cases) {
        const diagnostics = [];
        assert.equal(readShopierOsb(body, credentials, item => diagnostics.push(item)), null);
        assert.deepEqual(diagnostics, [reason]);
        assert.doesNotMatch(JSON.stringify(diagnostics), /private|osb-test-secret|osb-test-seller/);
    }
    assert.deepEqual(readShopierOsb(signed(event), credentials, () => assert.fail("Valid test rejected")), event);
});

test("native multipart parsing retains signed values and rejects ambiguous or file fields", async () => {
    const envelope = signed(event);
    async function parse(form) {
        const response = new Response(form);
        return readShopierOsbForm(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
    }
    const form = new FormData();
    for (const [name, value] of Object.entries(envelope)) form.set(name, value);
    assert.deepEqual(await parse(form), envelope);
    assert.deepEqual(readShopierOsb(await parse(form), credentials), event);
    form.append("res", "duplicate");
    assert.equal(await parse(form), null);
    form.set("res", new Blob(["invalid file"]), "payload.txt");
    assert.equal(await parse(form), null);
    assert.equal(await readShopierOsbForm(Buffer.from("invalid body"), "multipart/form-data"), null);
});

test("an automatic receipt binds one paid private product to one unexpired checkout at the exact price", () => {
    const createdAt = Date.parse("2026-11-17T10:00:00Z");
    const receivedAt = createdAt + 1000;
    const session = { automatic: true, productId: "6201", reference: "MNG-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        amountMinor: 30000, discountMinor: 0, createdAt };
    const event = { istest: "0", orderid: 7001, currency: 0, price: "300.00", productcount: 1,
        productid: "6201", customernote: "MNG-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" };
    assert.deepEqual(shopierAutomaticOsbReceipt(event, [session], receivedAt), {
        orderId: "7001", productId: "6201", reference: session.reference, amountMinor: 30000, receivedAt,
    });
    for (const changed of [{ productid: "6202" }, { price: "1.00" }, { currency: 1 }, { productcount: 2 }, { istest: 1 }]) {
        assert.equal(shopierAutomaticOsbReceipt({ ...event, ...changed }, [session], receivedAt), null);
    }
    assert.equal(shopierAutomaticOsbReceipt(event, [{ ...session, automatic: false }], receivedAt), null);
    assert.equal(shopierAutomaticOsbReceipt(event, [session, { ...session, reference: event.customernote }], receivedAt), null);
    assert.equal(shopierAutomaticOsbReceipt(event, [session], createdAt - 1), null);
    assert.equal(shopierAutomaticOsbReceipt(event, [session], createdAt + 30 * 86_400_000), null);
});
