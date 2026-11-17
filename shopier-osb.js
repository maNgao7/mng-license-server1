import { createHmac, timingSafeEqual } from "node:crypto";

const evidenceLifetime = 30 * 86_400_000;

export function readShopierOsb(form, { username, secret }) {
    const { res, hash } = form ?? {};
    if (typeof res !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(res)
        || typeof hash !== "string" || !/^[a-f\d]{64}$/i.test(hash)) return null;
    const expected = createHmac("sha256", secret).update(res + username).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;
    try {
        const event = JSON.parse(Buffer.from(res, "base64").toString("utf8"));
        return [0, 1, "0", "1"].includes(event?.istest) ? event : null;
    } catch {
        return null;
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
