import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { agencySlug } from "./agency-licenses.js";
import { agencyEntryAccess, hashAgencyEntryCode } from "./agency-portal.js";
import { verifyShopierPayment } from "./shopier-payment.js";
import { salesPlans } from "./web/sales-catalog.js";

const dayMs = 86_400_000;
const sign = (secret, data) => createHmac("sha256", secret).update(`shopier-checkout-v1:${data}`).digest("base64url");

export function shopierProductIds(json) {
    try {
        const config = JSON.parse(json);
        const ids = salesPlans.map(plan => config[plan.id]);
        return ids.every(id => typeof id === "string" && /^\d{1,20}$/.test(id))
            && new Set(ids).size === salesPlans.length
            ? Object.fromEntries(salesPlans.map((plan, i) => [plan.id, ids[i]])) : null;
    } catch {
        return null;
    }
}

export function createShopierCheckout({
    secret, apiToken, products, licenses, saveLicense, issueCode,
    verifyPayment = verifyShopierPayment, now = Date.now,
}) {
    let pendingLicenseWrite = Promise.resolve();

    function open(planId, username) {
        const plan = salesPlans.find(item => item.id === planId);
        if (!plan || typeof username !== "string") return null;
        const owner = username.trim().replace(/^@/, "");
        if (plan.kind === "individual" ? !/^[a-z\d._]{1,24}$/i.test(owner)
            : owner.length > 80 || !agencySlug(owner)) return null;

        const reference = `MNG-${randomBytes(16).toString("hex").toUpperCase()}`;
        const quote = { reference, planId, owner, productId: products[planId],
            amountMinor: plan.priceMinor, discountMinor: 0, createdAt: now() };
        const data = Buffer.from(JSON.stringify(quote)).toString("base64url");
        return { reference, token: `${data}.${sign(secret, data)}`,
            paymentUrl: `https://www.shopier.com/tikmng/${quote.productId}`, amountMinor: quote.amountMinor };
    }

    function readQuote(token) {
        if (typeof token !== "string" || token.length > 2048) return null;
        const parts = token.match(/^([\w-]+)\.([\w-]{43})$/);
        if (!parts || !timingSafeEqual(Buffer.from(parts[2]), Buffer.from(sign(secret, parts[1])))) return null;
        try {
            const quote = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
            return quote.createdAt <= now() && now() - quote.createdAt < 30 * dayMs ? quote : null;
        } catch {
            return null;
        }
    }

    async function redeem(token, orderId) {
        const quote = readQuote(token);
        if (!quote || typeof orderId !== "string" || !/^\d{1,30}$/.test(orderId)) return null;
        const plan = salesPlans.find(item => item.id === quote.planId);
        if (!plan) return null;

        const paid = await verifyPayment({ apiToken, orderId, quote });
        if (!paid) return null;
        const result = pendingLicenseWrite.then(() => deliver(quote, plan, orderId));
        pendingLicenseWrite = result.catch(() => {});
        return result;
    }

    function panelCode(license) {
        const { orderId, reference } = license.shopier;
        const digest = createHmac("sha256", secret)
            .update(`shopier-agency-panel-v1:${JSON.stringify([license.id, orderId, reference])}`)
            .digest("hex");
        return `MNGA-${digest.toUpperCase()}`;
    }

    async function deliver(quote, plan, orderId) {
        const existing = licenses().find(license =>
            license.shopier?.orderId === orderId || license.shopier?.reference === quote.reference);
        if (existing) {
            if (existing.shopier.orderId !== orderId || existing.shopier.reference !== quote.reference
                || ["iptal", "arsivlendi"].includes(existing.durum)) return null;
            const result = { code: existing.kod, planId: quote.planId };
            if (plan.kind === "agency" && existing.tip === "ajans" && existing.agency_portal_access?.version === 1) {
                const code = panelCode(existing);
                // Rotation or revocation takes precedence over replaying the original delivery.
                if (hashAgencyEntryCode(code) === existing.agency_portal_access.hash) result.panelCode = code;
            }
            return result;
        }

        const days = plan.period === "weekly" ? 7 : 30;
        const agency = plan.kind === "agency";
        const code = issueCode({ agency, owner: quote.owner, days });
        const license = {
            id: randomBytes(12).toString("hex"), kod: code,
            sure_birim: "gun", sure_miktar: days, durum: "beklemede",
            olusturma_zamani: now(), aktivasyon_zamani: null, bitis_zamani: null,
            cihaz_kimlik: null, notlar: "",
            shopier: { orderId, reference: quote.reference, planId: plan.id, amountMinor: quote.amountMinor },
        };
        const result = { code, planId: plan.id };
        if (agency) {
            Object.assign(license, { tip: "ajans", ajans_adi: quote.owner, max_cihaz: plan.seats,
                cihazlar: [], yayinci_kayitlari: [], engelli_cihazlar: [] });
            result.panelCode = panelCode(license);
            license.agency_portal_access = agencyEntryAccess(result.panelCode, license.olusturma_zamani);
        } else {
            license.musteri_adi = quote.owner;
        }
        await saveLicense(license);
        return result;
    }

    return { open, redeem };
}
