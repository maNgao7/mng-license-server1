import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import { registerAgencyPortal, hashAgencyEntryCode } from "../agency-portal.js";
import { createOverlayAuthorization } from "../overlay-authorization.js";

async function fixture(t) {
    const dir = await mkdtemp(path.join(tmpdir(), "tikmng-agency-portal-"));
    for (const name of ["lisanslar", "lisanslar_backup", "aktivasyon_log", "talepler", "kara_liste"]) {
        await writeFile(path.join(dir, `${name}.json`), "[]");
    }
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const { port } = socket.address();
    await new Promise(resolve => socket.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    const secret = randomBytes(32).toString("hex");
    let child;
    async function stop() {
        if (!child || child.exitCode !== null || child.signalCode !== null) return;
        const done = once(child, "exit"); child.kill(); await done;
    }
    t.after(async () => {
        await stop();
        const resolved = path.resolve(dir);
        assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith("tikmng-agency-portal-"));
        await rm(resolved, { recursive: true, force: true });
    });
    async function start() {
        child = spawn(process.execPath, ["server.js"], { cwd: new URL("../", import.meta.url),
            windowsHide: true, stdio: "ignore", env: { SystemRoot: process.env.SystemRoot,
                PORT: String(port), HOST: "127.0.0.1", MNG_DATA_DIR: dir, ADMIN_SIFRE: secret } });
        for (let i = 0; i < 120; i++) {
            if (child.exitCode !== null) throw Error("Test server exited");
            try { if ((await fetch(base + "/api/health")).ok) return; } catch {}
            await delay(30);
        }
        throw Error("Test server startup timeout");
    }
    async function request(route, body, cookie = "", expected = 200, extra = {}) {
        const response = await fetch(base + route, { method: body === undefined ? "GET" : "POST",
            headers: { "Content-Type": "application/json", "X-TikMnG-Agency": "1", Origin: base, Cookie: cookie, ...extra },
            body: body === undefined ? undefined : JSON.stringify(body) });
        assert.equal(response.status, expected, route);
        return { data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
    }
    await start();
    let admin = (await request("/api/admin/giris", { sifre: secret })).cookie;
    const entryCodes = new Map();
    const issue = async license => {
        const result = await request(`/api/admin/ajans/${license}/panel-kodu`, { islem: "olustur" }, admin);
        entryCodes.set(license, result.data.code);
        return result;
    };
    const create = async (name = "Örnek Ajans", seats = 3) => {
        const { kod } = (await request("/api/admin/ajans-lisansi-olustur",
            { ajans_adi: name, max_yayinci: seats, sure_birim: "gun", sure_miktar: 30 }, admin)).data;
        await issue(kod);
        return kod;
    };
    return { base, dir, request, create, issue, entry: license => entryCodes.get(license), get admin() { return admin; },
        login: async license => request("/api/agency/login", { code: entryCodes.get(license) }),
        verify: async (code, deviceId) => (await request("/api/license/verify", { code, deviceId })).data,
        check: async (code, deviceId, token) => (await request("/api/license/check", { code, deviceId, ...token })).data,
        async restart() { await stop(); await start(); admin = (await request("/api/admin/giris", { sifre: secret })).cookie; },
        rows: async () => JSON.parse(await readFile(path.join(dir, "lisanslar.json"), "utf8")),
    };
}

test("visible owner-code gate uses an isolated session, rejects CSRF and gives no admin access", async t => {
    const f = await fixture(t);
    const html = await (await fetch(f.base)).text();
    assert.match(html, /id="adminEntry">Yönetici Girişi<\/a>\s*<a href="\/agency"[^>]*>Ajans Paneli<\/a>/);
    assert.equal((html.match(/href="\/agency"/g) || []).length, 2);
    const page = await fetch(f.base + "/agency");
    assert.match(page.headers.get("cache-control"), /no-store/);
    assert.match(await page.text(), /TikMnG sahibinin size verdiği ayrı panel giriş kodunu/);
    await f.request("/api/agency/session", undefined, "", 401);
    await f.request("/api/agency/session", undefined, f.admin, 401);
    const code = await f.create();
    await f.request("/api/agency/login", { code }, "", 403);
    await f.request("/api/agency/login", { code }, "", 403, { Origin: "https://tikmng.com" });
    await f.request("/api/agency/login", { code }, "", 403, { "X-TikMnG-Agency": "" });
    await f.request("/api/agency/login", { code: "not-an-issued-code" }, "", 403);
    const login = await f.login(code);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    assert.match(login.headers.get("set-cookie"), /Path=\/api\/agency/);
    assert.doesNotMatch(JSON.stringify(login.data), new RegExp(code));
    await f.request("/api/admin/lisanslar", undefined, login.cookie, 401);
    await f.request("/api/admin/lisans-olustur", { sure_birim: "sinirsiz" }, login.cookie, 401);
    const session = (await f.request("/api/agency/session", undefined, login.cookie)).data;
    assert.equal(session.kullanilan, 0);
    assert.equal((await f.rows())[0].aktivasyon_zamani, null);
    await f.request("/api/agency/logout", {}, login.cookie);
    await f.request("/api/agency/session", undefined, login.cookie, 401);
});

test("only own named licenses are visible/revocable; shared quota cannot be overbooked", async t => {
    const f = await fixture(t);
    const a = await f.create("Birinci Ajans", 3), b = await f.create("İkinci Ajans", 3);
    await f.verify(a, "legacy-device");
    const ac = (await f.login(a)).cookie, bc = (await f.login(b)).cookie;
    await f.request("/api/agency/publishers", { ad: "Yayıncı", max_cihaz: 999 }, ac, 400);
    const results = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
        const r = await fetch(f.base + "/api/agency/publishers", { method: "POST", headers: {
            "Content-Type": "application/json", "X-TikMnG-Agency": "1", Origin: f.base, Cookie: ac }, body: JSON.stringify({ ad: `Yayıncı ${i}` }) });
        return r.status;
    }));
    assert.equal(results.filter(status => status === 201).length, 2);
    assert.equal(results.filter(status => status === 409).length, 5);
    const own = (await f.request("/api/agency/session", undefined, ac)).data;
    assert.equal(own.kullanilan, 3); assert.equal(own.bos, 0);
    assert.equal((await f.verify(a, "overflow-device")).valid, false);
    assert.equal((await f.request("/api/agency/session", undefined, bc)).data.yayincilar.length, 0);
    const publisher = own.yayincilar[0];
    assert.ok(publisher.kod.length <= 25);
    await f.request(`/api/agency/publishers/${publisher.id}/revoke`, {}, bc, 404);
    const activated = await f.verify(publisher.kod, "individual-device");
    assert.equal(activated.valid, true);
    assert.equal((await f.verify(publisher.kod, "second-device")).reason, "device_mismatch");
    const parent = (await f.rows()).find(row => row.kod === a);
    assert.equal(activated.expiresAt, parent.bitis_zamani);
    const auth = createOverlayAuthorization({ licenses: () => [parent, ...(own.yayincilar.map(p => ({ ...p, kod: p.kod,
        agency_parent_id: parent.id, tip: "tekil", durum: "aktif", cihaz_kimlik: "individual-device", bitis_zamani: activated.expiresAt })))], blacklist: () => [] });
    assert.ok(auth({ licenseCode: publisher.kod, deviceId: "individual-device" }));
    parent.durum = "iptal";
    assert.equal(auth({ licenseCode: publisher.kod, deviceId: "individual-device" }), false);
    await f.request(`/api/agency/publishers/${publisher.id}/revoke`, {}, ac);
    assert.equal((await f.check(publisher.kod, "individual-device", { activationToken: activated.activationToken, expiresAt: activated.expiresAt })).valid, false);
    await f.request("/api/agency/publishers", { ad: "Yeni yayıncı" }, ac, 201);
    await f.restart();
    assert.equal((await f.verify(publisher.kod, "individual-device")).valid, false);
    const fresh = (await f.login(a)).cookie;
    assert.equal((await f.request("/api/agency/session", undefined, fresh)).data.kullanilan, 3);
    await f.request("/api/agency/session", undefined, ac, 401);
});

test("first child starts the shared period; parent revoke/expiry invalidate sessions and child checks", async t => {
    const f = await fixture(t);
    const code = await f.create();
    const cookie = (await f.login(code)).cookie;
    const publisher = (await f.request("/api/agency/publishers", { ad: "Deniz" }, cookie, 201)).data.yayincilar[0];
    assert.equal((await f.rows()).find(row => row.kod === code).aktivasyon_zamani, null);
    const token = await f.verify(publisher.kod, "deniz-device");
    assert.equal(token.valid, true);
    assert.equal((await f.check(publisher.kod, "deniz-device", token)).valid, true);
    await f.request(`/api/admin/lisans/${code}/iptal`, {}, f.admin);
    assert.equal((await f.check(publisher.kod, "deniz-device", token)).valid, false);
    await f.request("/api/agency/session", undefined, cookie, 401);
    await f.request("/api/agency/login", { code: f.entry(code) }, "", 403);
    await f.request(`/api/admin/ajans/${code}/panel-kodu`, { islem: "olustur" }, f.admin, 409);
    await f.request(`/api/admin/lisans/${code}/aktif-et`, {}, f.admin);
    await f.request("/api/agency/session", undefined, cookie, 401);
    const renewed = (await f.login(code)).cookie;
    await f.request(`/api/admin/lisans/${code}/duzenle`, { sure: { islem: "azalt", birim: "gun", miktar: 100 } }, f.admin);
    await f.request("/api/agency/session", undefined, renewed, 401);
    await f.request("/api/agency/login", { code: f.entry(code) }, "", 403);
    await f.request(`/api/admin/ajans/${code}/panel-kodu`, { islem: "olustur" }, f.admin, 409);
    assert.equal((await f.verify(publisher.kod, "deniz-device")).valid, false);
    // Even a valid activation receipt cannot recover an independent publisher without its stored parent association.
    const rows = (await f.rows()).filter(row => row.kod !== publisher.kod);
    await writeFile(path.join(f.dir, "lisanslar.json"), JSON.stringify(rows));
    await f.restart();
    assert.equal((await f.check(publisher.kod, "deniz-device", token)).valid, false);
});

test("session lifetime and login rate limit are enforced by the server", async t => {
    let clock = Date.now();
    const entryCode = `MNGA-${randomBytes(32).toString("hex").toUpperCase()}`;
    const rows = [{ id: "fixture", kod: "TEST-ONLY-CODE", tip: "ajans", max_cihaz: 1,
        agency_portal_access: { version: 1, hash: hashAgencyEntryCode(entryCode), issued_at: clock },
        sure_birim: "gun", sure_miktar: 30, durum: "beklemede", bitis_zamani: null }];
    const app = express(); app.use(express.json());
    registerAgencyPortal(app, { licenses: () => rows, blacklist: () => [], save() {},
        durableRoute: fn => fn, configured: () => true, storageReady: () => true, now: () => clock });
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = () => fetch(base + "/api/agency/login", { method: "POST", headers: {
        "Content-Type": "application/json", "X-TikMnG-Agency": "1", Origin: base }, body: JSON.stringify({ code: entryCode }) });
    const response = await login(); assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    clock += 8 * 60 * 60 * 1000 + 1;
    assert.equal((await fetch(base + "/api/agency/session", { headers: { Cookie: cookie } })).status, 401);
    for (let i = 0; i < 9; i++) assert.equal((await login()).status, 200);
    assert.equal((await login()).status, 429);
});

test("a failed disk write returns no publisher code and consumes no quota", async t => {
    const f = await fixture(t);
    const code = await f.create();
    const cookie = (await f.login(code)).cookie;
    await mkdir(path.join(f.dir, "lisanslar.json.tmp"));
    const oldEntry = f.entry(code);
    const failedIssue = await f.request(`/api/admin/ajans/${code}/panel-kodu`, { islem: "olustur" }, f.admin, 503);
    assert.equal(failedIssue.data.code, undefined);
    await f.request("/api/agency/login", { code: oldEntry });
    const failed = await f.request("/api/agency/publishers", { ad: "Deniz" }, cookie, 503);
    assert.equal(failed.data.yayincilar, undefined);
    const session = (await f.request("/api/agency/session", undefined, cookie)).data;
    assert.equal(session.kullanilan, 0);
    assert.equal(session.yayincilar.length, 0);
    assert.equal((await f.rows()).length, 1);
});

test("only the owner issues separate hashed entry codes; rotation/revocation invalidate old access", async t => {
    const f = await fixture(t);
    const license = await f.create();
    const entry = f.entry(license);
    assert.match(entry, /^MNGA-[A-F0-9]{64}$/);
    const firstSession = (await f.login(license)).cookie;
    const route = `/api/admin/ajans/${license}/panel-kodu`;
    await f.request(route, { islem: "olustur" }, "", 401);
    await f.request(route, { islem: "olustur" }, firstSession, 401);
    await f.request(route, { islem: "olustur" }, f.admin, 403, { Origin: "https://tikmng.com" });
    await f.request(route, { islem: "olustur" }, f.admin, 403, { "X-TikMnG-Agency": "" });
    await f.request("/api/agency/login", { code: license }, "", 403);
    assert.equal((await f.verify(entry, "cannot-activate")).valid, false);
    assert.equal((await f.check(entry, "cannot-activate")).valid, false);
    const stored = (await f.rows()).find(row => row.kod === license);
    assert.equal(stored.agency_portal_access.hash, hashAgencyEntryCode(entry));
    for (const file of ["lisanslar.json", "lisanslar_backup.json", "aktivasyon_log.json"]) {
        assert.equal((await readFile(path.join(f.dir, file), "utf8")).includes(entry), false, file);
    }
    const detail = (await f.request(`/api/admin/ajans/${license}`, undefined, f.admin)).data;
    assert.equal(detail.panel_erisim_var, true);
    assert.equal(JSON.stringify(detail).includes(entry), false);
    const rotated = await f.issue(license);
    assert.match(rotated.headers.get("cache-control"), /no-store/);
    assert.notEqual(rotated.data.code, entry);
    await f.request("/api/agency/login", { code: entry }, "", 403);
    await f.request("/api/agency/session", undefined, firstSession, 401);
    await f.restart();
    const newSession = (await f.login(license)).cookie;
    const revoke = await f.request(route, { islem: "iptal" }, f.admin);
    assert.equal(revoke.data.code, undefined);
    assert.equal(revoke.data.panel_erisim_var, false);
    await f.request("/api/agency/login", { code: rotated.data.code }, "", 403);
    await f.request("/api/agency/session", undefined, newSession, 401);
    assert.equal((await f.verify(license, "legacy-still-works")).valid, true);
    assert.equal((await f.rows()).find(row => row.kod === license).agency_portal_access, undefined);
});

test("renewing a parent restores expired children on verify and check, but never revoked children", async t => {
    const f = await fixture(t);
    const code = await f.create();
    const cookie = (await f.login(code)).cookie;
    let data = (await f.request("/api/agency/publishers", { ad: "Bir" }, cookie, 201)).data;
    data = (await f.request("/api/agency/publishers", { ad: "İki" }, cookie, 201)).data;
    const [first, second] = data.yayincilar;
    const firstToken = await f.verify(first.kod, "first-device");
    const secondToken = await f.verify(second.kod, "second-device");
    // Preserve the realistic expired child records when the owner renews the parent.
    const rows = await f.rows();
    for (const row of rows) { row.durum = "suresi_doldu"; row.bitis_zamani = Date.now() - 1000; }
    await writeFile(path.join(f.dir, "lisanslar.json"), JSON.stringify(rows));
    await f.restart();
    await f.request(`/api/admin/lisans/${code}/yenile`, {}, f.admin);
    assert.equal((await f.verify(first.kod, "first-device")).valid, true);
    const checked = await f.check(second.kod, "second-device", secondToken);
    assert.equal(checked.valid, true);
    assert.ok(checked.expiresAt > Date.now());
    await f.request(`/api/admin/lisans/${first.kod}/iptal`, {}, f.admin);
    assert.equal((await f.verify(first.kod, "first-device")).valid, false);
    assert.equal((await f.check(first.kod, "first-device", firstToken)).valid, false);
});
