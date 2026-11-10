const shopierOrdersUrl = "https://api.shopier.com/v1/orders/";
const providerIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const checkoutReferencePattern = /^MNG-[A-F0-9]{32}$/;

function moneyInKurus(value) {
    if (typeof value !== "string" || !/^\d{1,10}\.\d{2}$/.test(value)) return null;
    return Number(value.replace(".", ""));
}

export async function checkShopierOffer({ apiToken, productId, priceMinor, fetchProduct = fetch }) {
    if (!/^\d{1,20}$/.test(productId)) return false;
    const response = await fetchProduct(`https://api.shopier.com/v1/products/${productId}`, {
        headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return false;
    if (!response.ok) {
        const error = new Error(`Shopier ürünü doğrulanamadı (${response.status}).`);
        error.shopierStatus = response.status;
        error.shopierResponseType = response.headers.get("content-type")?.includes("application/json") ? "json" : "other";
        throw error;
    }
    const product = await response.json();
    return product?.id === productId && product.type === "digital" && product.stockStatus === "inStock"
        && product.priceData?.currency === "TRY" && product.priceData.discount === false
        && moneyInKurus(product.priceData.price) === priceMinor;
}

/**
 * Fetch payment evidence directly from the seller's Shopier account.
 * The quote must come from TikMnG server storage, never from the buyer's request.
 */
export async function verifyShopierPayment({ apiToken, orderId, quote, fetchOrder = fetch }) {
    if (typeof apiToken !== "string" || !apiToken.trim()) {
        throw new Error("Shopier bağlantı anahtarı yapılandırılmadı.");
    }
    if (typeof orderId !== "string" || !providerIdPattern.test(orderId)) return null;

    const { reference, productId, amountMinor, discountMinor } = quote;
    if (typeof reference !== "string" || !checkoutReferencePattern.test(reference)
        || typeof productId !== "string" || !providerIdPattern.test(productId)
        || !Number.isSafeInteger(amountMinor) || amountMinor <= 0
        || !Number.isSafeInteger(discountMinor) || discountMinor < 0
        || !Number.isSafeInteger(amountMinor + discountMinor)) {
        throw new Error("Shopier sipariş teklifi geçersiz.");
    }

    const response = await fetchOrder(shopierOrdersUrl + orderId, {
        headers: { Authorization: `Bearer ${apiToken.trim()}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Shopier siparişi doğrulanamadı (${response.status}).`);
    const order = await response.json();
    if (order?.id !== orderId || order.paymentStatus !== "paid" || order.currency !== "TRY"
        || typeof order.note !== "string" || order.note.trim() !== reference
        || !Array.isArray(order.lineItems) || order.lineItems.length !== 1) return null;

    const item = order.lineItems[0];
    if (item?.productId !== productId || item.type !== "digital" || item.quantity !== 1) return null;

    // Pending and successful refunds require review before any license is delivered.
    if (order.refunds !== undefined && (!Array.isArray(order.refunds)
        || order.refunds.some(refund => refund?.status !== "failed"))) return null;

    const { subtotal, shipping, discount, total } = order.totals ?? {};
    if (moneyInKurus(subtotal) !== amountMinor + discountMinor || moneyInKurus(shipping) !== 0
        || moneyInKurus(discount) !== discountMinor || moneyInKurus(total) !== amountMinor) return null;

    return { orderId, reference, productId, amountMinor, discountMinor };
}
