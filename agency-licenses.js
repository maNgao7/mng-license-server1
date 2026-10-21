import crypto from "node:crypto";

export const MAX_AGENCY_SEATS = 1000;

export function agencySlug(name) {
    return String(name || "").replace(/ı/g, "i").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toUpperCase()
        .replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

export function validCapacity(value) {
    if (typeof value !== "number" && typeof value !== "string") return false;
    if (String(value).trim() === "") return false;
    const count = Number(value);
    return Number.isInteger(count) && count >= 1 && count <= MAX_AGENCY_SEATS;
}

export function validAgencyDuration(unit, amount) {
    return unit === "sinirsiz" || (["gun", "dakika"].includes(unit)
        && Number.isInteger(amount) && amount >= 1
        && amount <= (unit === "gun" ? 36500 : 52560000));
}

export function createAgencyKey(name, secret) {
    // The deployed launcher accepts at most 25 characters. Full agency data stays in storage and signed activation receipts.
    const payload = `${agencySlug(name).slice(0, 7)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 8).toUpperCase();
    return `${payload}-${signature}`;
}

export function parseAgencyKey(code, secret) {
    const compact = String(code).match(/^(([A-Z0-9]{1,7})-[A-F0-9]{8})-([A-F0-9]{8})$/);
    if (compact) {
        const expected = crypto.createHmac("sha256", secret).update(compact[1]).digest("hex").slice(0, 8).toUpperCase();
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(compact[3])) ? { tip: "ajans", recordRequired: true } : null;
    }
    const match = String(code).match(/^((?:MNG-|TIKMNG-HYPE-)([A-Z0-9]{1,24})-A(\d+)(INF|[MD]\d+)-[A-F0-9]{12})-([A-F0-9]{24})$/);
    if (!match) return null;
    const expected = crypto.createHmac("sha256", secret).update(match[1]).digest("hex").slice(0, 24).toUpperCase();
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(match[5]))) return null;
    const capacity = Number(match[3]);
    const tail = match[4];
    const unit = tail === "INF" ? "sinirsiz" : tail[0] === "M" ? "dakika" : "gun";
    const amount = tail === "INF" ? -1 : Number(tail.slice(1));
    if (!validCapacity(capacity) || !validAgencyDuration(unit, amount)) return null;
    return { tip: "ajans", ajans_adi: match[2], max_cihaz: capacity, birim: unit, miktar: amount };
}

export function createAgencyReceipt(license, deviceId, secret) {
    const payload = Buffer.from(JSON.stringify({ k: license.kod, d: deviceId, n: license.ajans_adi,
        c: license.max_cihaz, u: license.sure_birim, q: license.sure_miktar,
        e: license.bitis_zamani || null, a: license.aktivasyon_zamani })).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(`MNG2.${payload}`).digest("hex");
    return `MNG2.${payload}.${signature}`;
}

export function readAgencyReceipt(token, code, deviceId, expiresAt, secret) {
    if (typeof token !== "string" || token.length > 2048) return null;
    const match = token.match(/^MNG2\.([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/);
    if (!match) return null;
    const expected = crypto.createHmac("sha256", secret).update(`MNG2.${match[1]}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(match[2]))) return null;
    try {
        const data = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
        if (data.k !== code || data.d !== deviceId || (data.e || null) !== (expiresAt ? Number(expiresAt) : null)
            || !validCapacity(data.c) || !validAgencyDuration(data.u, data.q)) return null;
        return { tip: "ajans", ajans_adi: data.n, max_cihaz: data.c, birim: data.u, miktar: data.q, aktivasyon_zamani: data.a };
    } catch { return null; }
}

// cihazlar remains the membership authority so older backups and launchers stay compatible.
export function agencyMembers(license) {
    const ids = [...new Set((Array.isArray(license.cihazlar) ? license.cihazlar : [])
        .filter(id => typeof id === "string" && id.trim()).map(id => id.trim()))];
    const records = Array.isArray(license.yayinci_kayitlari) ? license.yayinci_kayitlari : [];
    return ids.map(id => {
        const record = records.find(item => item.cihaz_kimlik === id);
        return {
            cihaz_kimlik: id,
            ad: typeof record?.ad === "string" ? record.ad : "",
            ilk_giris: record?.ilk_giris || null,
            son_kontrol: record?.son_kontrol || null,
            giris_sayisi: Number(record?.giris_sayisi) || 0
        };
    });
}

export function touchAgencyMember(license, deviceId, isLogin = false) {
    const members = agencyMembers(license);
    let member = members.find(item => item.cihaz_kimlik === deviceId);
    const now = Date.now();
    if (!member) {
        member = { cihaz_kimlik: deviceId, ad: "", ilk_giris: now, son_kontrol: now, giris_sayisi: 0 };
        members.push(member);
    }
    member.ilk_giris ||= now;
    member.son_kontrol = now;
    if (isLogin) member.giris_sayisi++;
    license.cihazlar = members.map(item => item.cihaz_kimlik);
    license.yayinci_kayitlari = members;
    license.cihaz_kimlik = `Ajans (${members.length}/${license.max_cihaz || 1})`;
    return member;
}

export function agencySummary(license) {
    const used = agencyMembers(license).length;
    const capacity = Number(license.max_cihaz) || 1;
    return { kullanilan: used, kapasite: capacity, bos: Math.max(0, capacity - used) };
}
