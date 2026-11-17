import { salesPlans } from "./web/sales-catalog.js";

const apiUrl = "https://api.shopier.com/v1";
const defaultApprovedImageUrl = "https://tikmng.com/portal-hero-v2.png";
const productIdPattern = /^[1-9]\d{0,19}$/;
const orderIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const referencePattern = /^MNG-[A-F0-9]{32}$/;
const pageSize = 50;

function moneyInKurus(value) {
    if (typeof value !== "string" || !/^\d{1,10}\.\d{2}$/.test(value)) return null;
    return Number(value.replace(".", ""));
}

function validQuote(quote) {
    return quote && typeof quote.reference === "string" && referencePattern.test(quote.reference)
        && Number.isSafeInteger(quote.amountMinor) && quote.amountMinor > 0 && quote.amountMinor <= 999999999999
        && (quote.discountMinor === undefined || quote.discountMinor === 0)
        && Number.isSafeInteger(quote.createdAt) && quote.createdAt >= 0 && quote.createdAt <= 8640000000000000;
}

function validProductId(id) {
    return typeof id === "string" && productIdPattern.test(id);
}

function providerError(status) {
    const validStatus = Number.isInteger(status) && status >= 100 && status <= 599;
    const error = new Error(`Shopier API isteği tamamlanamadı${validStatus ? ` (${status})` : ""}.`);
    if (validStatus) error.shopierStatus = status;
    return error;
}

async function request({ apiToken, fetchProvider }, path, options = {}, { allow404 = false, readJson = true } = {}) {
    if (typeof apiToken !== "string" || !apiToken.trim() || /[\r\n]/.test(apiToken)) {
        throw new Error("Shopier bağlantı anahtarı yapılandırılmadı.");
    }
    const signal = AbortSignal.timeout(10000);
    let response;
    try {
        response = await fetchProvider(apiUrl + path, {
            ...options,
            headers: { Authorization: `Bearer ${apiToken.trim()}`, Accept: "application/json",
                ...(options.body && { "Content-Type": "application/json" }) },
            redirect: "error",
            signal,
        });
    } catch {
        // Never surface provider bodies, transport errors, URLs or token-bearing causes.
        throw providerError();
    }
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw providerError(response.status);
    if (!readJson) return;
    try {
        return await response.json();
    } catch {
        throw providerError(response.status);
    }
}

function matchesProductPrice(product, amountMinor) {
    return product?.type === "digital" && product.priceData?.currency === "TRY"
        && product.priceData.discount === false && moneyInKurus(product.priceData.price) === amountMinor
        && (product.priceData.shippingPrice === undefined || moneyInKurus(product.priceData.shippingPrice) === 0);
}

function approvedImage(value) {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password && /\.png$/i.test(url.pathname);
    } catch {
        return false;
    }
}

/** The caller owns quote signing and durable product-to-checkout storage. No POST retries. */
export async function createShopierPaymentProduct({ apiToken, templateProductId, quote,
    approvedImageUrl = defaultApprovedImageUrl, fetchProvider = fetch }) {
    const plan = salesPlans.find(plan => plan.id === quote?.planId);
    if (!validProductId(templateProductId) || !validQuote(quote) || !plan || plan.priceMinor !== quote.amountMinor) {
        throw new Error("Shopier sipariş teklifi geçersiz.");
    }
    if (!approvedImage(approvedImageUrl)) throw new Error("Shopier onaylı ürün görseli geçersiz.");

    // Catalog prices and the server-approved PNG are authoritative; product GETs may be forbidden.
    // Official POST schema: title, type, media (including placement), priceData, shippingPayer.
    // https://developer.shopier.com/reference/post-products.md
    const days = plan.period === "weekly" ? 7 : 30;
    const title = plan.kind === "agency"
        ? `TikMnG ${days} Günlük Dijital Ajans Lisansı (${plan.seats} Yayıncı)`
        : `TikMnG ${days} Günlük Dijital Bireysel Lisans`;
    const price = `${Math.floor(quote.amountMinor / 100)}.${String(quote.amountMinor % 100).padStart(2, "0")}`;
    const product = await request({ apiToken, fetchProvider }, "/products", {
        method: "POST",
        body: JSON.stringify({ title, type: "digital",
            media: [{ type: "image", url: approvedImageUrl, placement: 1 }],
            priceData: { currency: "TRY", price }, shippingPayer: "sellerPays",
            stockQuantity: 1, customListing: true }),
    });
    if (!validProductId(product?.id) || product.id === templateProductId
        || !matchesProductPrice(product, quote.amountMinor)
        || product.stockQuantity !== 1 || product.customListing !== true) {
        throw new Error("Shopier ödeme ürünü doğrulanamadı.");
    }
    return { productId: product.id };
}

/** Reversible cleanup when a created checkout cannot be saved; never deletes a product. */
export async function disableShopierPaymentProduct({ apiToken, productId, fetchProvider = fetch }) {
    if (!validProductId(productId)) throw new Error("Shopier ürün kimliği geçersiz.");
    await request({ apiToken, fetchProvider }, `/products/${productId}`, {
        method: "PUT", body: JSON.stringify({ stockQuantity: 0 }),
    }, { readJson: false });
}

/** Raw provider evidence; authorization and quote matching belong to the caller. */
export async function getShopierOrder({ apiToken, orderId, fetchProvider = fetch }) {
    if (typeof orderId !== "string" || !orderIdPattern.test(orderId)) return null;
    const order = await request({ apiToken, fetchProvider }, `/orders/${orderId}`, {}, { allow404: true });
    if (order !== null && (typeof order !== "object" || Array.isArray(order))) throw providerError();
    return order;
}

export async function findShopierOrdersForProduct({ apiToken, productId, fetchProvider = fetch }) {
    if (!validProductId(productId)) throw new Error("Shopier ürün kimliği geçersiz.");
    const orders = [];
    // GET returns a bare array, limit <= 50, page starts at 1. Do not guess a data/orders envelope.
    // https://developer.shopier.com/reference/get-orders.md
    for (let page = 1; page <= 20; page++) {
        const query = `productId=${productId}&limit=${pageSize}${page > 1 ? `&page=${page}` : ""}`;
        const batch = await request({ apiToken, fetchProvider }, `/orders?${query}`);
        if (!Array.isArray(batch) || batch.length > pageSize) throw providerError();
        orders.push(...batch);
        if (batch.length < pageSize) return orders;
    }
    // A stock-one checkout should never hit this bound. Fail instead of silently truncating evidence.
    throw providerError();
}

function providerCreationDate(value) {
    if (typeof value !== "string") return null;
    // Shopier documents yyyy-MM-ddTHH:mm:ssZ, e.g. 2022-07-21T13:24:51+0300.
    // Also accept explicit fractional seconds, but do not grant them second-precision tolerance.
    const parts = value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/);
    const time = Date.parse(value);
    if (!parts || !Number.isFinite(time)) return null;
    const day = new Date(`${parts[1]}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== parts[1]) return null;
    return { time, secondPrecision: !parts[2] };
}

/**
 * Only use a trusted, signed/durably stored quote. Exactly one digital line is supported.
 * The private product ID binds payment to the quote; buyer notes are deliberately irrelevant.
 * https://developer.shopier.com/reference/get-orders-id.md
 */
export function matchShopierAutomaticPayment(order, quote) {
    if (!validQuote(quote) || !validProductId(quote.productId)
        || typeof order?.id !== "string" || !orderIdPattern.test(order.id)
        || order.paymentStatus !== "paid" || order.currency !== "TRY"
        || !Array.isArray(order.lineItems) || order.lineItems.length !== 1) return null;
    const created = providerCreationDate(order.dateCreated);
    if (!created || created.time < (created.secondPrecision ? Math.floor(quote.createdAt / 1000) * 1000 : quote.createdAt)) {
        return null;
    }
    const item = order.lineItems[0];
    if (item?.productId !== quote.productId || item.type !== "digital" || item.quantity !== 1
        || moneyInKurus(item.price) !== quote.amountMinor || moneyInKurus(item.total) !== quote.amountMinor) return null;
    if (order.refunds !== undefined && (!Array.isArray(order.refunds)
        || order.refunds.some(refund => refund?.status !== "failed"))) return null;
    const { subtotal, shipping, discount, total } = order.totals ?? {};
    const discountMinor = moneyInKurus(discount);
    const amountMinor = moneyInKurus(total);
    if (moneyInKurus(subtotal) !== quote.amountMinor || moneyInKurus(shipping) !== 0
        || discountMinor === null || amountMinor === null || amountMinor <= 0
        || amountMinor + discountMinor !== quote.amountMinor) return null;
    if (discountMinor > 0 && (!quote.automatic || !Array.isArray(order.discounts) || order.discounts.length !== 1
        || order.discounts[0]?.method !== "discountCode" || typeof order.discounts[0]?.id !== "string"
        || !order.discounts[0].id.trim())) return null;
    return { orderId: order.id, productId: quote.productId, reference: quote.reference,
        amountMinor, ...(discountMinor > 0 && { discountMinor }), receivedAt: Date.now() };
}
