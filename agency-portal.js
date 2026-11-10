import crypto from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { agencyAccessAllowed, agencyMembers, agencySummary } from "./agency-licenses.js";

const COOKIE = "mng_agency_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

export function hashAgencyEntryCode(code) {
    return crypto.createHash("sha256").update(`TikMnG-agency-entry:v1:${code}`).digest("hex");
}

export function registerAgencyPortal(app, { licenses, blacklist, save, durableRoute, storageReady, configured,
    adminKontrol, findAgency, now = Date.now }) {
    const sessions = new Map();
    const digest = value => crypto.createHash("sha256").update(value).digest("hex");
    function cookie(req) {
        const value = String(req.headers.cookie || "").split(";").map(part => part.trim())
            .find(part => part.startsWith(`${COOKIE}=`));
        return value ? value.slice(COOKIE.length + 1) : "";
    }
    function setCookie(req, res, token, maxAge) {
        res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", path: "/api/agency",
            secure: req.secure, maxAge });
    }
    function cleanup() {
        for (const [key, session] of sessions) if (session.expires <= now()) sessions.delete(key);
    }
    function authenticate(req, res, next) {
        const token = cookie(req);
        const key = digest(token);
        const session = sessions.get(key);
        const agency = session && licenses().find(item => item.id === session.id
            && item.agency_portal_access?.version === 1 && item.agency_portal_access.hash === session.accessHash);
        if (!session || session.expires <= now() || !agencyAccessAllowed(agency, blacklist(), now())
            || session.version !== (Number(agency.agency_session_version) || 0)) {
            sessions.delete(key);
            setCookie(req, res, "", 0);
            return res.status(401).json({ error: "Ajans oturumu gerekli. Kodunuzla yeniden giriş yapın." });
        }
        // Carry only the immutable identity; durableRoute may swap the database before staging.
        req.agencyId = agency.id;
        req.agencyVersion = session.version;
        next();
    }
    const current = req => licenses().find(item => item.id === req.agencyId);
    function details(agency) {
        return { ajans_adi: agency.ajans_adi, durum: agency.durum, bitis_zamani: agency.bitis_zamani,
            sure_birim: agency.sure_birim, sure_miktar: agency.sure_miktar,
            ...agencySummary(agency, licenses()),
            mevcut_cihazlar: agencyMembers(agency).map(member => ({ ad: member.ad,
                ilk_giris: member.ilk_giris, son_kontrol: member.son_kontrol })),
            yayincilar: licenses().filter(item => item.agency_parent_id === agency.id).map(item => ({
                id: item.id, ad: item.musteri_adi, kod: item.kod, durum: item.durum,
                olusturma_zamani: item.olusturma_zamani, aktivasyon_zamani: item.aktivasyon_zamani,
                bitis_zamani: item.bitis_zamani,
            })) };
    }
    function writable(req, res, next) {
        if (!storageReady()) return res.status(503).json({ error: "Kalıcı lisans kaydı şu anda kullanılamıyor. Daha sonra tekrar deneyin." });
        next();
    }
    // Both the origin check and a custom header are required, including for login/logout.
    // No cross-site form or credentialed request from another allowed CORS site can mutate this portal.
    function portalRequest(req, res, next) {
        res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
        if (req.method !== "GET" && req.method !== "HEAD") {
            if (req.get("Origin") !== `${req.protocol}://${req.get("host")}`
                || req.get("X-TikMnG-Agency") !== "1" || !req.is("application/json")
                || req.get("Sec-Fetch-Site") === "cross-site") {
                return res.status(403).json({ error: "Bu işlem için ajans panelini kullanın." });
            }
        }
        next();
    }
    app.use("/api/agency", portalRequest);
    const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7",
        legacyHeaders: false, message: { error: "Çok fazla giriş denemesi yapıldı. 15 dakika sonra tekrar deneyin." } });
    const writeLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7",
        legacyHeaders: false, message: { error: "Çok fazla işlem yapıldı. Bir dakika sonra tekrar deneyin." } });

    if (adminKontrol && findAgency) app.post("/api/admin/ajans/:kod/panel-kodu", portalRequest, adminKontrol,
        writeLimit, writable, durableRoute((req, res) => {
            const agency = findAgency(req, res);
            if (!agency) return;
            const action = req.body?.islem;
            if (!["olustur", "iptal"].includes(action) || Object.keys(req.body).some(key => key !== "islem")) {
                return res.status(400).json({ error: "Geçerli bir panel giriş kodu işlemi seçin." });
            }
            if (action === "olustur" && !agencyAccessAllowed(agency, blacklist(), now())) {
                return res.status(409).json({ error: "Kapalı veya süresi dolmuş ajansa giriş kodu verilemez." });
            }
            const code = action === "olustur" ? `MNGA-${crypto.randomBytes(32).toString("hex").toUpperCase()}` : null;
            if (code) agency.agency_portal_access = { version: 1, hash: hashAgencyEntryCode(code), issued_at: now() };
            else delete agency.agency_portal_access;
            // Both rotation and revocation invalidate every existing agency session.
            agency.agency_session_version = (Number(agency.agency_session_version) || 0) + 1;
            save();
            // Only this owner-only response contains the plaintext, after the durable checkpoint.
            res.json({ ok: true, panel_erisim_var: Boolean(code), ...(code ? { code } : {}) });
        }));

    app.post("/api/agency/login", loginLimit, (req, res) => {
        if (!configured()) return res.status(503).json({ error: "Ajans girişi şu anda kullanılamıyor." });
        const code = typeof req.body?.code === "string" && req.body.code.length <= 160
            ? req.body.code.trim().toUpperCase() : "";
        const hash = hashAgencyEntryCode(code);
        const agency = /^MNGA-[A-F0-9]{64}$/.test(code) && licenses().find(item => item.tip === "ajans"
            && item.agency_portal_access?.version === 1 && item.agency_portal_access.hash === hash);
        // Shared launcher licenses never authenticate agency managers; access must be separately issued by the owner.
        if (!agencyAccessAllowed(agency, blacklist(), now())) {
            return res.status(403).json({ error: "Ajans kodu geçersiz veya erişime kapalı. Size verilen kodu kontrol edin." });
        }
        cleanup();
        const oldToken = cookie(req);
        if (oldToken) sessions.delete(digest(oldToken));
        const ownSessions = [...sessions].filter(([, session]) => session.id === agency.id);
        while (ownSessions.length >= 5) sessions.delete(ownSessions.shift()[0]);
        if (sessions.size >= 5000) return res.status(503).json({ error: "Giriş şu anda yoğun. Daha sonra tekrar deneyin." });
        const token = crypto.randomBytes(32).toString("base64url");
        sessions.set(digest(token), { id: agency.id, accessHash: hash, expires: now() + SESSION_MS,
            version: Number(agency.agency_session_version) || 0 });
        setCookie(req, res, token, SESSION_MS);
        res.json({ ok: true });
    });
    app.get("/api/agency/session", authenticate, (req, res) => res.json(details(current(req))));
    app.post("/api/agency/logout", (req, res) => {
        sessions.delete(digest(cookie(req)));
        setCookie(req, res, "", 0);
        res.json({ ok: true });
    });
    app.post("/api/agency/publishers", authenticate, writeLimit, writable, durableRoute((req, res) => {
        const agency = current(req);
        if (!agencyAccessAllowed(agency, blacklist(), now()) || req.agencyVersion !== (Number(agency.agency_session_version) || 0)) return res.status(401).json({ error: "Ajans erişimi kapalı." });
        if (Object.keys(req.body || {}).some(key => key !== "ad") || typeof req.body?.ad !== "string"
            || !req.body.ad.trim() || req.body.ad.trim().length > 80) {
            return res.status(400).json({ error: "Yalnızca 1–80 karakter uzunluğunda bir yayıncı adı girin." });
        }
        if (agencySummary(agency, licenses()).bos < 1) return res.status(409).json({ error: "Ajans yayıncı kapasitesi dolu." });
        // 80 random bits, 25 characters: compatible with the deployed launcher.
        // This namespace is record-only; no stateless recovery or independent duration is allowed.
        let code;
        do { code = `MNGP-${crypto.randomBytes(10).toString("hex").toUpperCase()}`; }
        while (licenses().some(item => item.kod === code) || blacklist().includes(code));
        licenses().unshift({ schema_version: 1, id: crypto.randomUUID(), kod: code, tip: "tekil",
            agency_parent_id: agency.id, musteri_adi: req.body.ad.trim(),
            sure_birim: agency.sure_birim, sure_miktar: agency.sure_miktar, durum: "beklemede",
            olusturma_zamani: now(), aktivasyon_zamani: null, bitis_zamani: null, cihaz_kimlik: null });
        save();
        res.status(201).json(details(agency));
    }));
    app.post("/api/agency/publishers/:id/revoke", authenticate, writeLimit, writable, durableRoute((req, res) => {
        const agency = current(req);
        if (!agencyAccessAllowed(agency, blacklist(), now()) || req.agencyVersion !== (Number(agency.agency_session_version) || 0)) return res.status(401).json({ error: "Ajans erişimi kapalı." });
        const publisher = licenses().find(item => item.id === req.params.id && item.agency_parent_id === agency.id);
        if (!publisher) return res.status(404).json({ error: "Yayıncı lisansı bulunamadı." });
        if (!["iptal", "arsivlendi"].includes(publisher.durum)) {
            publisher.durum = "iptal";
            publisher.iptal_zamani = now();
            delete publisher.activation_token;
            save();
        }
        res.json(details(agency));
    }));
    return { authenticate };
}
