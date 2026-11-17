import { createHmac, timingSafeEqual } from "node:crypto";

const evidenceLifetime = 30 * 86_400_000;

export async function readShopierOsbForm(body, contentType) {
    if (!/^multipart\/form-data(?:;|$)/i.test(contentType || "")) return body;
    try {
        const form = await new Response(body, { headers: { "content-type": contentType } }).formData();
        if ([...form].length > 8) return null;
        const values = {};
        for (const name of ["res", "hash"]) {
            const items = form.getAll(name);
            if (items.length !== 1 || typeof items[0] !== "string") return null;
            values[name] = items[0];
        }
        return values;
    } catch {
        return null;
    }
}

export function readShopierOsb(form, { username, secret }, onReject = () => {}) {
    function reject(reason) {
        onReject(reason);
        return null;
    }
    const { res, hash } = form ?? {};
    if (typeof res !== "string" || typeof hash !== "string") return reject("missing-fields");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(res)) return reject("payload-encoding");
    if (!/^[a-f\d]{64}$/i.test(hash)) return reject("signature-format");
    const expected = createHmac("sha256", secret).update(res + username).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return reject("signature-mismatch");
    try {
        const event = JSON.parse(Buffer.from(res, "base64").toString("utf8"));
        return [0, 1, "0", "1"].includes(event?.istest) ? event : reject("test-flag-" + typeof event?.istest);
    } catch {
        return reject("payload-json");
    }
}

const numericValue = value => typeof value === "string" || typeof value === "number" ? String(value) : "";

export function shopierOsbReceipt(event, products, receivedAt) {
    const { orderid, currency, price, productcount, productid, customernote } = event;
    const orderId = numericValue(orderid);
    const productId = numericValue(productid);
    const reference = typeof customernote === "string" ? customernote.trim() : "";
    const amount = numericValue(price);
    if (!/^\d{1,30}$/.test(orderId) || !Object.values(products).includes(productId)
        || ![0, "0"].includes(currency) || ![1, "1"].includes(productcount)
        || !/^MNG-[A-F0-9]{32}$/.test(reference)
        || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) return null;
    const [whole, fraction = ""] = amount.split(".");
    const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (amountMinor <= 0) return null;
    return { orderId, productId, reference, amountMinor, receivedAt };
}

export function sameShopierReceipt(a, b) {
    return a.orderId === b.orderId && a.productId === b.productId
        && a.reference === b.reference && a.amountMinor === b.amountMinor;
}

export function receiptIsCurrent(receipt, now) {
    return now - receipt.receivedAt < evidenceLifetime;
}

export function shopierReceiptMatchesQuote(receipt, quote) {
    return receipt.reference === quote.reference && receipt.productId === quote.productId
        && receipt.amountMinor === quote.amountMinor && receipt.receivedAt >= quote.createdAt
        && quote.discountMinor === 0;
}
