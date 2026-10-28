import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { upgradedBootstrapState } from "./content-bootstrap.js";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const ASSET = /^\/content-assets\/([a-f0-9]{64})\.(mp4|webm)$/;
const defaults = JSON.parse(fs.readFileSync(new URL("./content-defaults.json", import.meta.url), "utf8"));
const legacyDefaults = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-6.5.17.json", import.meta.url), "utf8"));
const releasedDefaults = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-7.0.1.json", import.meta.url), "utf8"));
const hotfixBaseline = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-7.0.4.json", import.meta.url), "utf8"));
const snakeBaseline = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-7.0.5.json", import.meta.url), "utf8"));
const minecraftBaseline = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-7.0.6.json", import.meta.url), "utf8"));
const minecraftInstallBaseline = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-minecraft-7.0.3.json", import.meta.url), "utf8"));
const launcher707Baseline = JSON.parse(fs.readFileSync(new URL("./content-bootstrap-7.0.7.json", import.meta.url), "utf8"));
const clone = value => structuredClone(value);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function fields(value, allowed, at) {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).some(key => !allowed.includes(key))) fail(`${at}: unsupported fields.`);
}

function text(value, max, at, empty = false) {
    if (typeof value !== "string" || value.length > max || (!empty && !value.trim())
        || /[<>\x00-\x08\x0b-\x1f\x7f]/.test(value)) fail(`${at}: invalid plain text (max ${max}).`);
    return value.trim();
}

const blocked = new net.BlockList();
for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
    ["203.0.113.0", 24], ["224.0.0.0", 3]]) blocked.addSubnet(ip, bits, "ipv4");
const globalV6 = new net.BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [ip, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]) blocked.addSubnet(ip, bits, "ipv6");

function publicAddress(address) {
    const family = net.isIP(address);
    return family === 4 ? !blocked.check(address, "ipv4")
        : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

function parseUrl(value, at, assetsDir) {
    const raw = text(value, 2048, at);
    const local = ASSET.exec(raw);
    if (local) {
        const target = path.join(assetsDir, raw.slice("/content-assets/".length));
        if (!fs.existsSync(target) || !fs.lstatSync(target).isFile()) fail(`${at}: uploaded asset not found.`);
        return { url: raw, local, target };
    }
    let url;
    try { url = new URL(raw); } catch { fail(`${at}: HTTPS URL required.`); }
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port
        || /[\s\\]/.test(raw) || !host || host.endsWith(".")
        || /(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host)
        || (!net.isIP(host) && (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host)))
        || (net.isIP(host) && !publicAddress(host))) fail(`${at}: public HTTPS URL without credentials required.`);
    return { url: url.href, host };
}

function catalogShape(value, assetsDir) {
    fields(value, ["schemaVersion", "revision", "publishedAt", "games", "media", "launcher"], "catalog");
    if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
        || !(value.publishedAt === null || (typeof value.publishedAt === "string"
            && !Number.isNaN(Date.parse(value.publishedAt))))) fail("Invalid catalog metadata.");
    const hosts = new Set();
    const url = (raw, at) => {
        const result = parseUrl(raw, at, assetsDir);
        if (result.host) hosts.add(result.host);
        return result;
    };
    function integrity(item, location, at, allowUnknown = true) {
        const unknown = allowUnknown && item.sha256 === null && item.bytes === null;
        if (!unknown && !(typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256)
            && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 100 * 1024 ** 3)) fail(`${at}: valid SHA-256 and bytes required together.`);
        if (location.local && (item.sha256 !== location.local[1] || item.bytes !== fs.statSync(location.target).size)) fail(`${at}: uploaded asset integrity mismatch.`);
    }
    function version(raw, at) {
        if (typeof raw !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,39}$/.test(raw)) fail(`${at}: invalid version.`);
        return raw;
    }
    function list(items, kind, max) {
        if (!Array.isArray(items) || items.length > max) fail(`${kind}: max ${max} items.`);
        const ids = new Set();
        return items.map(item => {
            fields(item, kind === "games"
                ? ["id", "title", "description", "version", "url", "sha256", "bytes", "requirements", "resources", "files"]
                : ["id", "title", "category", "url", "sha256", "bytes"], kind);
            if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(item.id)
                || ids.has(item.id) || ["__proto__", "constructor", "prototype"].includes(item.id)) fail(`${kind}: invalid or duplicate ID.`);
            ids.add(item.id);
            const location = url(item.url, `${item.id}.url`);
            integrity(item, location, item.id);
            const common = { id: item.id, title: text(item.title, 120, `${item.id}.title`), url: location.url, sha256: item.sha256, bytes: item.bytes };
            if (kind === "media") return { id: common.id, title: common.title, category: text(item.category, 60, `${item.id}.category`), url: common.url, sha256: common.sha256, bytes: common.bytes };
            if (!Array.isArray(item.resources) || item.resources.length > 8) fail(`${item.id}: max 8 resources.`);
            let files;
            if (item.files !== undefined) {
                if (!Array.isArray(item.files) || item.files.length > 256) fail(`${item.id}: max 256 patch files.`);
                const paths = new Set();
                files = item.files.map(file => {
                    fields(file, ["path", "url", "sha256", "bytes"], "file");
                    const relative = text(file.path, 240, "file.path");
                    const contentManifest = relative === ".tikmng-content.json";
                    if (relative !== file.path || (!contentManifest && relative.split("/").some(part =>
                        !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,119}$/.test(part) || /[. ]$/.test(part)
                        || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)))
                        || paths.has(relative.toLowerCase())) fail("file.path: unsafe or duplicate relative path.");
                    if (contentManifest && (item.files.length !== 1 || file.bytes > 16 * 1024 * 1024)) fail("Content manifest must be the sole file and fit 16 MB.");
                    paths.add(relative.toLowerCase());
                    const location = url(file.url, "file.url");
                    integrity(file, location, "file", false);
                    return { path: relative, url: location.url, sha256: file.sha256, bytes: file.bytes };
                });
            }
            return { id: common.id, title: common.title, description: text(item.description, 2000, `${item.id}.description`, true),
                version: version(item.version, item.id), url: common.url, sha256: common.sha256, bytes: common.bytes,
                requirements: text(item.requirements, 1000, `${item.id}.requirements`, true), resources: item.resources.map(resource => {
                    fields(resource, ["title", "url"], "resource");
                    return { title: text(resource.title, 120, "resource.title"), url: url(resource.url, "resource.url").url };
                }), ...(files === undefined ? {} : { files }) };
        });
    }
    const catalog = { schemaVersion: 1, revision: value.revision, publishedAt: value.publishedAt,
        games: list(value.games, "games", 64), media: list(value.media, "media", 2000) };
    if (value.launcher !== undefined) {
        fields(value.launcher, ["version", "downloadUrl", "sha256", "bytes", "changelog"], "launcher");
        const location = url(value.launcher.downloadUrl, "launcher.downloadUrl");
        if (location.local) fail("launcher.downloadUrl: HTTPS installer URL required.");
        integrity(value.launcher, location, "launcher", false);
        catalog.launcher = { version: version(value.launcher.version, "launcher"), downloadUrl: location.url,
            sha256: value.launcher.sha256, bytes: value.launcher.bytes, changelog: text(value.launcher.changelog, 4000, "launcher.changelog", true) };
    }
    if (Buffer.byteLength(JSON.stringify(catalog)) > MAX_CATALOG_BYTES) fail("Catalog exceeds 2 MB.", 413);
    if (hosts.size > 64) fail("Catalog allows at most 64 distinct URL hosts.");
    return { catalog, hosts };
}

async function checkHosts(hosts) {
    await Promise.all([...hosts].map(async host => {
        if (net.isIP(host)) return;
        let addresses;
        let timer;
        try {
            addresses = await Promise.race([lookup(host, { all: true }), new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error("DNS timeout")), 5000);
            })]);
        } catch { fail("URL host could not be verified."); }
        finally { clearTimeout(timer); }
        if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) fail("URL must resolve only to public addresses.");
    }));
}

function atomicWrite(filename, contents) {
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    let fd;
    try {
        fd = fs.openSync(temporary, "wx", 0o600);
        fs.writeFileSync(fd, contents);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        fs.renameSync(temporary, filename);
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
        fs.rmSync(temporary, { force: true });
    }
}

function videoHeader(buffer, extension) {
    if (extension === "mp4") {
        const size = buffer.length >= 16 ? buffer.readUInt32BE(0) : 0;
        return size >= 16 && size <= buffer.length && size <= 4096 && size % 4 === 0
            && buffer.toString("ascii", 4, 8) === "ftyp"
            && /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V |MSNV|qt  )$/.test(buffer.toString("ascii", 8, 12));
    }
    if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x1a45dfa3) return false;
    function vint(offset, id = false) {
        if (offset >= buffer.length || !buffer[offset]) return null;
        let width = 1;
        while (width <= 8 && !(buffer[offset] & (1 << (8 - width)))) width++;
        if (width > (id ? 4 : 8) || offset + width > buffer.length) return null;
        let value = id ? buffer[offset] : buffer[offset] & ((1 << (8 - width)) - 1);
        for (let i = 1; i < width; i++) value = value * 256 + buffer[offset + i];
        return Number.isSafeInteger(value) ? { value, end: offset + width } : null;
    }
    const header = vint(4);
    if (!header || header.value > 4096 || header.end + header.value > buffer.length) return false;
    const end = header.end + header.value;
    let offset = header.end;
    let webm = false;
    while (offset < end) {
        const id = vint(offset, true);
        const size = id && vint(id.end);
        if (!size || size.end + size.value > end) return false;
        if (id.value === 0x4282) {
            if (buffer.toString("ascii", size.end, size.end + size.value) !== "webm") return false;
            webm = true;
        }
        offset = size.end + size.value;
    }
    return webm;
}

// One synchronous state replacement commits draft and published together. Revision files are never overwritten.
export function registerContentRoutes(app, { dataDir, adminKontrol }) {
    const assetsDir = path.join(dataDir, "content-assets");
    const revisionsDir = path.join(dataDir, "content-revisions");
    const stateFile = path.join(dataDir, "content-state.json");
    const backupFile = path.join(dataDir, "content-state.backup.json");
    fs.mkdirSync(assetsDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(revisionsDir, { recursive: true, mode: 0o700 });
    let state;
    function load(filename) {
        const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
        fields(saved, ["draft", "published"], "state");
        return { draft: catalogShape(saved.draft, assetsDir).catalog, published: catalogShape(saved.published, assetsDir).catalog };
    }
    if (fs.existsSync(stateFile) || fs.existsSync(backupFile)) {
        try { state = load(stateFile); }
        catch {
            try { state = load(backupFile); atomicWrite(stateFile, JSON.stringify(state)); }
            catch { throw new Error("Content storage could not be loaded."); }
        }
    } else {
        const initial = catalogShape(defaults, assetsDir).catalog;
        state = { draft: clone(initial), published: clone(initial) };
        atomicWrite(stateFile, JSON.stringify(state));
    }
    const currentDefaults = catalogShape(defaults, assetsDir).catalog;
    const upgraded = upgradedBootstrapState(state, catalogShape(launcher707Baseline, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true })
        || upgradedBootstrapState(state, catalogShape(minecraftInstallBaseline, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true })
        || upgradedBootstrapState(state, catalogShape(minecraftBaseline, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true })
        || upgradedBootstrapState(state, catalogShape(snakeBaseline, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true })
        || upgradedBootstrapState(state, catalogShape(hotfixBaseline, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true })
        || upgradedBootstrapState(state, catalogShape(legacyDefaults, assetsDir).catalog, currentDefaults)
        || upgradedBootstrapState(state, catalogShape(releasedDefaults, assetsDir).catalog, currentDefaults, { allowReleasedBaseline: true });
    if (upgraded) {
        atomicWrite(backupFile, JSON.stringify(state));
        atomicWrite(stateFile, JSON.stringify(upgraded));
        state = upgraded;
    }
    let highestRevision = Math.max(state.draft.revision, state.published.revision);
    for (const name of fs.readdirSync(revisionsDir)) {
        if (/^\d+\.json$/.test(name)) highestRevision = Math.max(highestRevision, Number(name.slice(0, -5)));
    }
    function nextRevision() {
        const revision = highestRevision + 1;
        if (!Number.isSafeInteger(revision)) fail("Revision limit reached.", 409);
        return revision;
    }
    function save(next) {
        atomicWrite(backupFile, JSON.stringify(state));
        atomicWrite(stateFile, JSON.stringify(next));
        state = next;
        highestRevision = Math.max(highestRevision, state.draft.revision, state.published.revision);
    }
    function expected(body) {
        if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail("expectedRevision is required.");
        if (body.expectedRevision !== state.draft.revision) fail("Catalog changed. Reload before saving or publishing.", 409);
    }
    const route = handler => async (req, res) => {
        res.set("Cache-Control", "no-store");
        try { await handler(req, res); }
        catch (error) {
            if (!res.headersSent && !res.destroyed) res.status(error.status || 503).json({ error: error.status ? error.message : "Content storage unavailable." });
        }
    };
    app.get("/api/content/catalog", (req, res) => {
        const body = JSON.stringify({ ...state.published, games: state.published.games.filter(game => game.id !== 'crowd-control') });
        res.set({ "Cache-Control": "no-store", ETag: `"${crypto.createHash("sha256").update(body).digest("hex")}"` }).type("json").send(body);
    });
    app.get("/api/admin/content", adminKontrol, route((req, res) => res.json(state)));
    app.put("/api/admin/content", adminKontrol, route(async (req, res) => {
        fields(req.body, ["draft", "expectedRevision"], "request");
        expected(req.body);
        const { catalog, hosts } = catalogShape(req.body.draft, assetsDir);
        await checkHosts(hosts);
        expected(req.body);
        const revision = nextRevision();
        save({ draft: { ...catalog, revision, publishedAt: null }, published: state.published });
        res.json(state);
    }));
    app.post("/api/admin/content/publish", adminKontrol, route(async (req, res) => {
        fields(req.body, ["expectedRevision"], "request");
        expected(req.body);
        const { catalog, hosts } = catalogShape(state.draft, assetsDir);
        await checkHosts(hosts);
        expected(req.body);
        const revision = nextRevision();
        const published = { ...catalog, revision, publishedAt: new Date().toISOString() };
        const snapshot = path.join(revisionsDir, `${revision}.json`);
        let created = false;
        try {
            const fd = fs.openSync(snapshot, "wx", 0o600);
            created = true;
            try { fs.writeFileSync(fd, JSON.stringify(published)); fs.fsyncSync(fd); }
            finally { fs.closeSync(fd); }
            save({ draft: clone(published), published });
        } catch (error) {
            if (created) fs.rmSync(snapshot, { force: true });
            throw error;
        }
        res.json(state);
    }));

    let activeUploads = 0;
    app.post("/api/admin/content/upload", adminKontrol, route(async (req, res) => {
        const filename = req.query.filename;
        if (typeof filename !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,119}\.(mp4|webm)$/i.test(filename)) fail("Invalid video filename.");
        const extension = filename.split(".").pop().toLowerCase();
        if (req.headers["content-type"]?.toLowerCase() !== `video/${extension}` || req.headers["content-encoding"]) fail("Send an unencoded video/mp4 or video/webm body.", 415);
        const declared = req.headers["content-length"];
        if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_UPLOAD_BYTES)) fail("Video exceeds 100 MB.", 413);
        if (activeUploads >= 2) fail("Two uploads are already in progress.", 429);
        activeUploads++;
        const temporary = path.join(assetsDir, `.${crypto.randomUUID()}.tmp`);
        let handle;
        let bytes = 0;
        let header = Buffer.alloc(0);
        let verified = false;
        const hash = crypto.createHash("sha256");
        try {
            handle = await fs.promises.open(temporary, "wx", 0o600);
            for await (const chunk of req.iterator({ destroyOnReturn: false })) {
                bytes += chunk.length;
                if (bytes > MAX_UPLOAD_BYTES) fail("Video exceeds 100 MB.", 413);
                if (!verified) {
                    header = Buffer.concat([header, chunk.subarray(0, 4096 - header.length)]);
                    if (header.length === 4096) {
                        if (!videoHeader(header, extension)) fail("Video header does not match its type.", 415);
                        verified = true;
                    }
                }
                hash.update(chunk);
                // FileHandle writes can be partial; keep backpressure until the whole chunk is stored.
                let offset = 0;
                while (offset < chunk.length) offset += (await handle.write(chunk, offset, chunk.length - offset)).bytesWritten;
            }
            if (!bytes || (!verified && !videoHeader(header, extension))) fail("Video header does not match its type.", 415);
            await handle.sync();
            await handle.close();
            handle = undefined;
            const sha256 = hash.digest("hex");
            const target = path.join(assetsDir, `${sha256}.${extension}`);
            try { fs.linkSync(temporary, target); }
            catch (error) { if (error.code !== "EEXIST" || fs.statSync(target).size !== bytes) throw error; }
            res.status(201).json({ id: sha256, url: `/content-assets/${sha256}.${extension}`, sha256, bytes });
        } finally {
            if (handle) await handle.close();
            fs.rmSync(temporary, { force: true });
            activeUploads--;
            if (!req.complete) req.resume();
        }
    }));
    const serveAssets = express.static(assetsDir, { dotfiles: "deny", index: false, redirect: false, fallthrough: false,
        immutable: true, maxAge: "1y", setHeaders(res) {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
        } });
    app.use("/content-assets", (req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method) || !ASSET.test(`/content-assets${req.url}`)) return res.status(404).json({ error: "Asset not found." });
        serveAssets(req, res, error => {
            if (!error) return next();
            if (error.status === 416 && error.headers?.["Content-Range"]) res.set("Content-Range", error.headers["Content-Range"]);
            res.status(error.status === 416 ? 416 : 404).json({ error: "Asset not available." });
        });
    });
    // These names are private even if a future broad static/fallback handler is added.
    app.use(["/content-state.json", "/content-state.backup.json", "/content-revisions", "/content-defaults.json", "/content-management.js"], (req, res) => res.sendStatus(404));
}
