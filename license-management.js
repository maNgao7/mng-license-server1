import { validAgencyDuration } from "./agency-licenses.js";

function reject(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    error.publicMessage = true;
    throw error;
}

export function assertLicenseEditable(license) {
    if (license.durum === "arsivlendi") reject("Silinen lisans kalıcı olarak kapatılmıştır. Yeni bir lisans oluşturun.", 410);
}

function durationMs(unit, amount) {
    return unit === "dakika" ? amount * 60000 : amount * 86400000;
}

export function editLicense(license, payload, now = Date.now()) {
    assertLicenseEditable(license);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) reject("Geçerli lisans bilgileri gönderin.");
    const result = { ...license };
    if (payload.ad !== undefined) {
        if (typeof payload.ad !== "string" || payload.ad.trim().length > 80
            || (license.tip === "ajans" && !payload.ad.trim())) reject("İsim en fazla 80 karakter olmalı. Ajans adı boş bırakılamaz.");
        result[license.tip === "ajans" ? "ajans_adi" : "musteri_adi"] = payload.ad.trim();
    }
    if (payload.notlar !== undefined) {
        if (typeof payload.notlar !== "string" || payload.notlar.length > 1000) reject("Not en fazla 1000 karakter olabilir.");
        result.notlar = payload.notlar.trim();
    }
    if (payload.sure !== undefined) {
        const change = payload.sure;
        if (!change || typeof change !== "object" || Array.isArray(change)) reject("Geçerli bir süre seçin.");
        const { islem, birim, miktar } = change;
        if (!["ayarla", "ekle", "azalt"].includes(islem) || !validAgencyDuration(birim, miktar)) reject("Geçerli bir süre ve işlem seçin.");
        const pending = license.durum === "beklemede";
        if (islem !== "ayarla" && (pending || !license.bitis_zamani || birim === "sinirsiz")) {
            reject("Başlamamış veya sınırsız lisanslarda 'Süreyi yeniden belirle' işlemini kullanın.", 409);
        }
        if (islem === "ayarla") {
            result.sure_birim = birim;
            result.sure_miktar = birim === "sinirsiz" ? -1 : miktar;
            result.bitis_zamani = pending || birim === "sinirsiz" ? null : now + durationMs(birim, miktar);
        } else {
            const end = Number(license.bitis_zamani);
            const delta = durationMs(birim, miktar);
            result.bitis_zamani = islem === "ekle" ? Math.max(now, end) + delta : Math.max(now, end - delta);
        }
        if (!pending && license.durum !== "iptal") {
            result.durum = result.bitis_zamani && result.bitis_zamani <= now ? "suresi_doldu" : "aktif";
        }
        delete result.activation_token;
        result.sure_duzenleme_zamani = now;
    }
    result.duzenleme_zamani = now;
    return result;
}

export function renewLicense(license, now = Date.now()) {
    assertLicenseEditable(license);
    if (license.durum === "iptal") reject("Önce lisansın erişimini yeniden açın.", 409);
    if (license.durum === "beklemede") reject("Lisans henüz başlamadı. İlk girişte süresi başlayacak.", 409);
    if (license.sure_birim === "sinirsiz" || license.sure_miktar === -1) reject("Sınırsız lisansın yenilenmesine gerek yok.", 409);
    if (!validAgencyDuration(license.sure_birim, license.sure_miktar)) reject("Önce lisansın süresini yeniden belirleyin.", 409);
    const result = { ...license,
        bitis_zamani: Math.max(now, Number(license.bitis_zamani) || now) + durationMs(license.sure_birim, license.sure_miktar),
        durum: "aktif", yenileme_zamani: now };
    delete result.activation_token;
    return result;
}
