import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { readShopierOsbForm, readShopierOsb } from "../shopier-osb.js";

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
