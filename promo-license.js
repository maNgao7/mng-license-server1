import { randomBytes } from "node:crypto";

export const promoLicense = Object.freeze({
    code: "MNG-DENEME-C9A67D3E",
    days: process.env.TIKMNG_TRIAL_DAYS === "14" ? 14 : 7,
    enabled: process.env.TIKMNG_TRIAL_ENABLED !== "false",
});

export const promoRecordCode = /^MNGTR-[0-9A-F]{20}$/;
export const promoDeviceId = /^[0-9a-f]{32}$/;

export function findLauncherLicense(licenses, code, deviceId) {
    if (code === promoLicense.code) {
        return licenses.find(item => item.promo_code === code && item.cihaz_kimlik === deviceId);
    }
    return licenses.find(item => item.kod === code && !item.promo_code);
}

export function createPromoLicense(deviceId) {
    const now = Date.now();
    const kod = "MNGTR-" + randomBytes(10).toString("hex").toUpperCase();
    return {
        id: kod,
        kod,
        promo_code: promoLicense.code,
        tip: "tekil",
        max_cihaz: 1,
        cihaz_kimlik: deviceId,
        sure_birim: "gun",
        sure_miktar: promoLicense.days,
        durum: "beklemede",
        olusturma_zamani: now,
        aktivasyon_zamani: null,
        bitis_zamani: null,
        notlar: "Sürpriz Kutu deneme lisansı",
    };
}
