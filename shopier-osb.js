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

function singleProductPayment(event) {
    const { orderid, currency, price, productcount, productid } = event;
    const orderId = numericValue(orderid);
    const productId = numericValue(productid);
    const amount = numericValue(price);
    if (!/^\d{1,30}$/.test(orderId) || !/^\d{1,20}$/.test(productId)
        || ![0, "0"].includes(currency) || ![1, "1"].includes(productcount)
        || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) return null;
    const [whole, fraction = ""] = amount.split(".");
    const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (amountMinor <= 0) return null;
    return { orderId, productId, amountMinor };
}

export function shopierOsbReceipt(event, products, receivedAt) {
    const payment = singleProductPayment(event);
    const reference = typeof event.customernote === "string" ? event.customernote.trim() : "";
    if (!payment || !Object.values(products).includes(payment.productId)
        || !/^MNG-[A-F0-9]{32}$/.test(reference)) return null;
    return { ...payment, reference, receivedAt };
}

/** Only call after the notification signature is verified. */
export function shopierAutomaticOsbReceipt(event, sessions, receivedAt) {
    if (![0, "0"].includes(event.istest)) return null;
    const payment = singleProductPayment(event);
    if (!payment) return null;
    const matches = sessions.filter(session => session.automatic && session.productId === payment.productId);
    if (matches.length !== 1) return null;
    const [session] = matches;
    const receipt = { ...payment, reference: session.reference, receivedAt };
    return receivedAt - session.createdAt < evidenceLifetime && shopierReceiptMatchesQuote(receipt, session)
        ? receipt : null;
}

export function sameShopierReceipt(a, b) {
    return a.orderId === b.orderId && a.productId === b.productId
        && a.reference === b.reference && a.amountMinor === b.amountMinor
        && (a.discountMinor ?? 0) === (b.discountMinor ?? 0);
}

export function receiptIsCurrent(receipt, now) {
    return now - receipt.receivedAt < evidenceLifetime;
}

export function shopierReceiptMatchesQuote(receipt, quote) {
    const discountMinor = receipt.discountMinor ?? 0;
    return receipt.reference === quote.reference && receipt.productId === quote.productId
        && Number.isSafeInteger(discountMinor) && (discountMinor === 0 || (quote.automatic && discountMinor > 0))
        && Number.isSafeInteger(receipt.amountMinor) && receipt.amountMinor > 0
        && receipt.amountMinor + discountMinor === quote.amountMinor && receipt.receivedAt >= quote.createdAt
        && quote.discountMinor === 0;
}
