import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { agencySlug, createAgencyKey, parseAgencyKey, validCapacity } from "../agency-licenses.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secret = crypto.randomBytes(32).toString("hex");
const temporaryDirectories = new Set();
after(() => {
    for (const dir of temporaryDirectories) {
        if (dir.startsWith(path.join(os.tmpdir(), "tikmng-agency-test-"))) fs.rmSync(dir, { recursive: true, force: true });
    }
});

async function fixture(t, initial = [], directory) {
    const dir = directory || fs.mkdtempSync(path.join(os.tmpdir(), "tikmng-agency-test-"));
    temporaryDirectories.add(dir);
    if (!directory) {
        for (const name of ["lisanslar", "lisanslar_backup", "aktivasyon_log", "talepler", "kara_liste"]) {
            fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify(name.startsWith("lisanslar") ? initial : []));
        }
    }
    const port = await new Promise(resolve => {
        const probe = net.createServer().listen(0, "127.0.0.1", () => {
            const port = probe.address().port;
            probe.close(() => resolve(port));
        });
    });
    const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", ADMIN_SIFRE: secret, MNG_DATA_DIR: dir };
    for (const name of ["GITHUB_TOKEN", "GITHUB_LICENSE_TOKEN", "GITHUB_LICENSE_REPO", "BACKUP_REPO"]) env[name] = "";
    const child = spawn(process.execPath, ["server.js"], { cwd: root, env, stdio: "ignore", windowsHide: true });
    let stopped = false;
    const stop = async () => {
        if (stopped) return;
        stopped = true;
        await new Promise(resolve => { child.once("exit", resolve); child.kill(); });
    };
    t.after(stop);
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(base + "/api/health")).ok) break; } catch {}
        if (child.exitCode !== null) throw new Error("Fixture server exited before startup.");
        await new Promise(resolve => setTimeout(resolve, 40));
        if (i === 99) throw new Error("Fixture server startup timed out.");
    }
    const login = await fetch(base + "/api/admin/giris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sifre: secret }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    async function request(route, body, admin = false, method = body === undefined ? "GET" : "POST") {
        const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(admin ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    }
    return { request, dir, base, stop, async create(overrides = {}) {
        const result = await request("/api/admin/ajans-lisansi-olustur", { ajans_adi: "Trend Ajans", max_yayinci: 20, sure_birim: "gun", sure_miktar: 30, ...overrides }, true);
        assert.equal(result.status, 200);
        return result.data.kod;
    } };
}

const verify = (f, code, deviceId) => f.request("/api/license/verify", { code, deviceId, clientVersion: "6.5.16" });
const check = (f, code, deviceId, token = {}) => f.request("/api/license/check", { code, deviceId, clientVersion: "6.5.16", ...token });
const detail = (f, code) => f.request(`/api/admin/ajans/${code}`, undefined, true);
const legacyKey = prefix => {
    const payload = `${prefix}-A1B2C3`;
    return `${payload}-${crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 6).toUpperCase()}`;
};

test("agency key fits the deployed launcher, uses the entered name and rejects tampering", () => {
    assert.equal(agencySlug("Işık Çığ Özel Ajans"), "ISIKCIGOZELAJANS");
    const key = createAgencyKey("Trend Ajans", secret);
    assert.match(key, /^TRENDAJ-/);
    assert.ok(key.length <= 25);
    assert.ok(!key.includes("HYPE"));
    assert.match(createAgencyKey("Hype", secret), /^HYPE-/);
    assert.deepEqual(parseAgencyKey(key, secret), { tip: "ajans", recordRequired: true });
    for (const altered of [key.replace("TREND", "OTHER"), key.slice(0, -1) + (key.endsWith("0") ? "1" : "0")]) assert.equal(parseAgencyKey(altered, secret), null);
    for (const invalid of [0, -1, 1001, 1.5, "20x", "", null, {}, true]) assert.equal(validCapacity(invalid), false);
});

test("20 seats admit exactly 20 different devices, not 21; every device passes later checks", async t => {
    const f = await fixture(t);
    const code = await f.create();
    const pending = (await f.request("/api/admin/lisanslar", undefined, true)).data[0];
    assert.equal(pending.aktivasyon_zamani, null);
    assert.equal(pending.bitis_zamani, null);
    const tokens = [];
    for (let i = 0; i < 20; i++) {
        const result = (await verify(f, code, `device-${i}`)).data;
        assert.equal(result.valid, true);
        tokens.push(result.activationToken);
    }
    assert.equal(new Set(tokens).size, 20);
    assert.equal((await verify(f, code, "device-20")).data.reason, "agency_limit_reached");
    assert.equal((await check(f, code, "unknown-device")).data.valid, false);
    assert.equal((await verify(f, code.toLowerCase(), " device-3 ")).data.valid, true);
    for (let i = 0; i < 20; i++) assert.equal((await check(f, code, `device-${i}`, { activationToken: tokens[i] })).data.valid, true);
    const agency = (await detail(f, code)).data;
    assert.equal(agency.kullanilan, 20);
    assert.equal(agency.bos, 0);
    assert.equal(agency.yayincilar[3].giris_sayisi, 2);
    assert.ok(agency.yayincilar.every(member => member.ilk_giris && member.son_kontrol));
});

test("concurrent first registrations cannot overbook a capacity of five", async t => {
    const f = await fixture(t);
    const code = await f.create({ max_yayinci: 5 });
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => verify(f, code, `parallel-${i}`)));
    assert.equal(results.filter(result => result.data.valid).length, 5);
    assert.equal((await detail(f, code)).data.kullanilan, 5);
});

test("agency management is authenticated, capacity changes persist and blocked members stay blocked", async t => {
    const f = await fixture(t);
    const code = await f.create({ max_yayinci: 2 });
    const first = (await verify(f, code, "first")).data;
    await verify(f, code, "second");
    assert.equal((await f.request(`/api/admin/ajans/${code}`)).status, 401);
    for (const action of ["kapasite", "yayinci", "erisim"]) assert.equal((await f.request(`/api/admin/ajans/${code}/${action}`, {})).status, 401);
    assert.equal((await f.request(`/api/admin/ajans/${code}/kapasite`, { max_yayinci: 1 }, true)).status, 409);
    assert.equal((await f.request(`/api/admin/ajans/${code}/kapasite`, { max_yayinci: 3 }, true)).status, 200);
    assert.equal((await verify(f, code, "third")).data.valid, true);
    await f.request(`/api/admin/ajans/${code}/yayinci`, { deviceId: "second", ad: "Yayinci Deniz" }, true);
    await f.request(`/api/admin/ajans/${code}/erisim`, { deviceId: "first", engelli: true }, true);
    assert.equal((await verify(f, code, "first")).data.valid, false);
    assert.equal((await check(f, code, "first", { activationToken: first.activationToken, expiresAt: first.expiresAt })).data.valid, false);
    assert.equal((await verify(f, code, "fourth")).data.valid, true);
    const saved = (await f.request("/api/admin/lisanslar", undefined, true)).data;
    const stale = { ...saved[0], max_cihaz: 100, cihazlar: ["first"] };
    await f.request("/api/admin/lisanslar-senkronize", { lisanslar: [stale] }, true);
    assert.equal((await detail(f, code)).data.kapasite, 3);
    await f.stop();
    const restarted = await fixture(t, [], f.dir);
    const after = (await detail(restarted, code)).data;
    assert.equal(after.kullanilan, 3);
    assert.equal(after.yayincilar.find(member => member.cihaz_kimlik === "second").ad, "Yayinci Deniz");
    assert.equal((await verify(restarted, code, "first")).data.valid, false);
    assert.equal((await check(restarted, code, "second")).data.valid, true);
    await restarted.request(`/api/admin/ajans/${code}/erisim`, { deviceId: "first", engelli: false }, true);
    assert.equal((await verify(restarted, code, "first")).data.reason, "agency_limit_reached");
});

test("creation rejects invalid capacities, names and durations without creating records", async t => {
    const f = await fixture(t);
    const valid = { ajans_adi: "Test", max_yayinci: 20, sure_birim: "gun", sure_miktar: 30 };
    for (const patch of [{ max_yayinci: -1 }, { max_yayinci: 20.5 }, { max_yayinci: 1001 }, { max_yayinci: "20abc" }, { ajans_adi: "" }, { ajans_adi: "x".repeat(81) }, { sure_miktar: 0 }, { sure_miktar: -3 }, { sure_miktar: 1.5 }, { sure_birim: "unknown" }, { notlar: {} }]) {
        assert.equal((await f.request("/api/admin/ajans-lisansi-olustur", { ...valid, ...patch }, true)).status, 400);
    }
    assert.equal((await f.request("/api/admin/lisanslar", undefined, true)).data.length, 0);
    assert.equal((await verify(f, {}, {})).data.valid, false);
    assert.equal((await check(f, "test", {})).data.valid, false);
});

test("legacy agency and individual keys remain compatible; signed new keys can recover", async t => {
    const f = await fixture(t);
    const oldAgency = legacyKey("MNGAJANS2D30");
    for (const device of ["legacy-one", "legacy-two"]) {
        assert.equal((await verify(f, oldAgency, device)).data.valid, true);
        assert.equal((await check(f, oldAgency, device)).data.valid, true);
    }
    assert.equal((await verify(f, oldAgency, "legacy-third")).data.valid, false);
    const individual = legacyKey("MNG7D");
    assert.equal((await verify(f, individual, "single")).data.valid, true);
    assert.equal((await check(f, individual, "single")).data.valid, true);
    assert.equal((await verify(f, individual, "other")).data.reason, "device_mismatch");
    const signed = await f.create({ ajans_adi: "Restore", max_yayinci: 2, sure_birim: "sinirsiz", sure_miktar: -1 });
    assert.equal((await verify(f, signed, "new-restore")).data.valid, true);
});

test("token-only recovery retains agency type and capacity for multiple members", async t => {
    const f = await fixture(t);
    const code = await f.create({ max_yayinci: 2 });
    const members = [];
    for (const deviceId of ["recover-one", "recover-two"]) {
        const result = (await verify(f, code, deviceId)).data;
        members.push({ deviceId, activationToken: result.activationToken, expiresAt: result.expiresAt });
    }
    const recovered = await fixture(t);
    for (const member of members) assert.equal((await check(recovered, code, member.deviceId, member)).data.valid, true);
    assert.equal((await detail(recovered, code)).data.kapasite, 2);
    assert.equal((await detail(recovered, code)).data.kullanilan, 2);
    assert.equal((await detail(recovered, code)).data.ajans_adi, "Trend Ajans");
    const tampered = members[0].activationToken.replace(/^MNG2\./, "MNG2.X");
    const noRecord = await fixture(t);
    assert.equal((await check(noRecord, code, members[0].deviceId, { activationToken: tampered, expiresAt: members[0].expiresAt })).data.valid, false);
    assert.equal((await verify(recovered, code, "recover-third")).data.reason, "agency_limit_reached");
});

test("revoked, expired and archived agencies reject both verification paths", async t => {
    const f = await fixture(t);
    const code = await f.create();
    await verify(f, code, "revoked-device");
    await f.request(`/api/admin/lisans/${code}/iptal`, {}, true);
    assert.equal((await verify(f, code, "revoked-device")).data.reason, "revoked");
    assert.equal((await check(f, code, "revoked-device")).data.reason, "revoked");
    await f.request(`/api/admin/lisans/${code}/aktif-et`, {}, true);
    assert.equal((await check(f, code, "revoked-device")).data.valid, true);
    await f.request(`/api/admin/lisans/${code}`, {}, true, "DELETE");
    assert.equal((await check(f, code, "revoked-device")).data.reason, "revoked");
    const expired = await fixture(t, [{ kod: "EXPIRED-TEST", tip: "ajans", max_cihaz: 2, cihazlar: ["expired-device"], durum: "aktif", sure_birim: "gun", sure_miktar: 1, bitis_zamani: Date.now() - 10000 }]);
    assert.equal((await verify(expired, "EXPIRED-TEST", "expired-device")).data.reason, "expired");
    assert.equal((await check(expired, "EXPIRED-TEST", "expired-device")).data.reason, "expired");
});

test("a failed durable write is an error and does not consume a seat", async t => {
    const f = await fixture(t);
    const code = await f.create({ max_yayinci: 1 });
    const obstruction = path.join(f.dir, "lisanslar.json.tmp");
    fs.mkdirSync(obstruction);
    assert.equal((await verify(f, code, "blocked-write")).status, 503);
    fs.rmdirSync(obstruction);
    assert.equal((await detail(f, code)).data.kullanilan, 0);
    assert.equal((await verify(f, code, "successful-write")).data.valid, true);
});

test("admin assets are reachable, private data stays behind session auth, and public requests work", async t => {
    const f = await fixture(t);
    for (const asset of ["/", "/admin/", "/admin/dashboard.css", "/admin/dashboard.js", "/admin/lucide.js"]) assert.equal((await fetch(f.base + asset)).status, 200);
    for (const route of ["/api/admin/lisanslar", "/api/admin/talepler", "/api/admin/istatistikler"]) assert.equal((await f.request(route)).status, 401);
    const sent = await f.request("/api/talep-gonder", { ad: "Test", iletisim: "test@example.invalid", tur: "lisans", mesaj: "Agency inquiry" });
    assert.equal(sent.data.basarili, true);
    assert.equal((await f.request("/api/admin/talepler", undefined, true)).data.length, 1);
});
