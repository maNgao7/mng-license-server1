import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { readShopierOsb } from "../shopier-osb.js";

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
