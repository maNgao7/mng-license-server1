'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { PortraitCache, portraitCandidates } = require('../vendor/portrait-engine.cjs');
const USERNAME = /^[a-z0-9_.]{1,64}$/;
const SOURCE_MIN_SHORT_SIDE = 750;
// Match the native decoder and the shared owner's HTTP size limit.
const NATIVE_MAX_BYTES = 4 * 1024 ** 2;
const NATIVE_MAX_PIXELS = 4096 ** 2;
const SOURCE_RETRY_MS = 60_000;
const DIRECT_SOURCE_GRACE_MS = 250;
const PROFILE_LIMIT = 1500;
const PASSIVE_JOB_LIMIT = 8;
const TOTAL_JOB_LIMIT = 16;

function eventPortraitCandidates(payload, username) {
    const groups = new Map();
    const thumbnails = new Set();
    const legacy = new Set();
    const matchesSender = row => {
        const name = row?.username ?? row?.uniqueId ?? row?.unique_id ?? row?.displayId ?? row?.display_id;
        return typeof name === 'string' && name.trim().replace(/^@/, '').toLowerCase() === username;
    };
    for (const row of [payload.user, payload, ...[payload.userInfo, payload.profile].filter(matchesSender)]) {
        if (!row || typeof row !== 'object') continue;
        // Read each sender representation independently so a top-level field
        // cannot hide the SDK's nested userDetails fallback, or vice versa.
        const fields = { user: row, avatarLarger: row.bestPortraitUrl,
            avatarLarge: row.userDetails?.profilePictureUrls,
            avatar: row.avatar, profilePicture: row.userDetails?.profilePictureUrl,
            profilePictureUrl: row.profile_picture_url, profilePictureUrls: row.profile_picture_urls,
            avatarThumb: row.avatarUrl, avatar_thumb: row.avatar_url };
        for (const { rank, urls } of portraitCandidates(fields)) {
            const group = groups.get(rank) || new Set();
            for (const url of urls) {
                if (group.size >= 16) break;
                if (/^https:\/\//i.test(url)) group.add(url);
            }
            groups.set(rank, group);
        }
        // Vendor deduplication prefers the larger field when the same URL
        // appears twice. Keep the explicit thumbnail hint for scheduling.
        for (const { urls } of portraitCandidates({ avatarThumb: row.avatarThumb,
            avatar_thumb: row.avatar_thumb, user: { avatarThumb: row.avatarUrl } })) {
            for (const url of urls) if (/^https:\/\//i.test(url)) thumbnails.add(url);
        }
        for (const { urls } of portraitCandidates({ profilePictureUrl: row.profilePictureUrl,
            profilePictureUrls: row.profile_picture_url, avatar: row.avatar })) {
            for (const url of urls) if (/^https:\/\//i.test(url)) legacy.add(url);
        }
    }
    return { groups: [...groups].sort(([a], [b]) => b - a)
        .filter(([, urls]) => urls.size).map(([rank, urls]) => ({ rank, urls: [...urls] })),
        thumbnails: thumbnails.size ? thumbnails : legacy };
}

// A small adapter around the installed launcher's unchanged portrait engine.
// Its CDN allowlist, public DNS checks, redirect/size limits and image parsing
// remain the source of truth. An optional ProfileSources instance supplies
// username-bound public profile candidates without cookies or desktop login.
function createProfiles(directory, { sources = null, getCachedPortrait = null, ...cacheOptions } = {}) {
    const people = new Map(), pending = new Map();
    const nextSourceCheck = new Map();
    const participants = new Map();
    const rejectedVersions = new Map();
    const sourceWaiters = [];
    const updates = new Map();
    const cache = directory ? new PortraitCache(directory, cacheOptions) : null;
    const indexFile = directory && path.join(directory, 'profiles-v1.json');
    let closed = false, issue = '';
    let sourceRequests = 0;
    let portraitSessionId = randomUUID(), portraitCursor = 0;
    if (indexFile) {
        try {
            const saved = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
            if (saved.schemaVersion === 1 && Array.isArray(saved.people)) {
                for (const entry of saved.people.slice(-PROFILE_LIMIT)) {
                    if (!Array.isArray(entry) || entry.length !== 2) continue;
                    const [username, value] = entry;
                    if (!USERNAME.test(username) || typeof value?.image !== 'string') continue;
                    // Old schema-1 indexes stored only the short side in `width`.
                    // Re-read actual image dimensions; never trust stale metadata.
                    const backup = typeof value.backup === 'string' ? describe(value.backup) : null;
                    const restored = describe(value.image) || backup;
                    if (restored) {
                        if (backup && backup.qualityVersion !== restored.qualityVersion) restored.backup = backup.image;
                        people.set(username, restored);
                        publish(username, restored);
                    }
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') issue = 'Portre dizini okunamadı; kimlikler ve olaylar korunuyor.';
        }
    }
    function imageFile(image) {
        const id = /^\.\/tikmng\/media\/file\/([a-f0-9-]{36})$/.exec(image || '')?.[1];
        return id && cache ? cache.file(id) : '';
    }
    function describe(image) {
        const size = cache?.info(image), file = imageFile(image);
        if (!file || !/\.(?:png|jpg|webp)$/.test(file)
            || !Number.isSafeInteger(size?.width) || !Number.isSafeInteger(size?.height)
            || size.width < 1 || size.height < 1 || size.width > 8192 || size.height > 8192
            || size.width * size.height > NATIVE_MAX_PIXELS || (fs.statSync(file, { throwIfNoEntry: false })?.size ?? Infinity) > NATIVE_MAX_BYTES) return null;
        return { image, width: size.width, height: size.height,
            shortSide: Math.min(size.width, size.height),
            qualityVersion: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
    }
    function better(next, old) {
        return !old || next.shortSide > old.shortSide
            || (next.shortSide === old.shortSide && next.width * next.height > old.width * old.height);
    }
    function metadata({ width, height, shortSide, qualityVersion }) {
        return { width, height, shortSide, qualityVersion };
    }
    function publish(username, record) {
        if (updates.get(username)?.qualityVersion === record.qualityVersion) return;
        updates.delete(username);
        updates.set(username, { username, ...metadata(record), cursor: ++portraitCursor });
        if (updates.size > PROFILE_LIMIT) updates.delete(updates.keys().next().value);
    }
    function changes(after, sessionId) {
        if ((sessionId && sessionId !== portraitSessionId) || after > portraitCursor) after = 0;
        const portraitUpdates = [];
        for (const entry of after === portraitCursor ? [] : updates.values()) {
            if (entry.cursor <= after) continue;
            portraitUpdates.push(entry);
            if (portraitUpdates.length === 128) break;
        }
        return { portraitSessionId, portraitCursor: portraitUpdates.at(-1)?.cursor ?? portraitCursor, portraitUpdates };
    }
    function save() {
        const temporary = indexFile + '.' + randomUUID() + '.tmp';
        let fd;
        try {
            fd = fs.openSync(temporary, 'wx', 0o600);
            fs.writeFileSync(fd, JSON.stringify({ schemaVersion: 1, people: [...people] }));
            fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
            fs.renameSync(temporary, indexFile);
        } finally {
            if (fd !== undefined) fs.closeSync(fd);
            fs.rmSync(temporary, { force: true });
        }
    }
    function collect(work, groups, limit, thumbnails = new Set()) {
        const candidates = [];
        for (const { rank, urls } of groups) {
            if (!Array.isArray(urls)) continue;
            for (const url of urls.slice(0, 16)) {
                if (candidates.length >= limit) return candidates;
                if (typeof url !== 'string' || url.length > 4096 || work.seen.has(url)) continue;
                work.seen.add(url);
                candidates.push({ rank, url, thumbnail: rank === 1 || thumbnails.has(url) });
            }
        }
        return candidates;
    }
    function canLookUp(username, sourceWanted) {
        const record = people.get(username);
        return !closed && !!(sources || getCachedPortrait) && sourceWanted && (record?.shortSide || 0) < SOURCE_MIN_SHORT_SIDE
            && (nextSourceCheck.get(username) || 0) <= Date.now();
    }
    function sourceSlot(work) {
        if (closed) return false;
        if (sourceRequests < (work.donor ? 2 : 1)) {
            sourceRequests++;
            return true;
        }
        return new Promise(resolve => sourceWaiters.push({ work, resolve }));
    }
    function admitSourceWaiter() {
        if (sourceRequests >= 2 || !sourceWaiters.length) return;
        const donor = sourceWaiters.findIndex(waiter => waiter.work.donor);
        if (donor < 0 && sourceRequests > 0) return;
        sourceRequests++;
        sourceWaiters.splice(Math.max(0, donor), 1)[0].resolve(true);
    }
    async function lookUp(username, work, renderOnly) {
        const slot = sourceSlot(work);
        if (slot !== true && !await slot) return [];
        try {
            if (closed || (people.get(username)?.shortSide || 0) >= SOURCE_MIN_SHORT_SIDE) return [];
            if (!renderOnly) {
                if (!canLookUp(username, work.sourceWanted)) return [];
                nextSourceCheck.set(username, Date.now() + SOURCE_RETRY_MS);
                if (nextSourceCheck.size > PROFILE_LIMIT) nextSourceCheck.delete(nextSourceCheck.keys().next().value);
                let sharedImage;
                try {
                    const bytes = getCachedPortrait?.(username);
                    if (Buffer.isBuffer(bytes) && bytes.length <= NATIVE_MAX_BYTES) sharedImage = cache.import(bytes);
                } catch {
                    // An unavailable or unsupported shared file cannot block the event or public fallback.
                }
                if (sharedImage) remember(username, sharedImage);
                if (!sources || (people.get(username)?.shortSide || 0) >= SOURCE_MIN_SHORT_SIDE) return [];
            }
            const candidates = await sources.get(username, { renderOnly });
            return !closed && Array.isArray(candidates) ? collect(work, candidates.slice(0, 4), renderOnly ? 4 : 16) : [];
        } catch {
            // Failed public lookup leaves the existing image available.
            return [];
        } finally {
            sourceRequests--;
            admitSourceWaiter();
        }
    }
    async function cacheCandidate(username, work, { url }) {
        if (closed) return;
        work.downloading.add(url);
        let image;
        try {
            // The vendor list API stops at its first success. Fetch individual
            // candidates to measure every original. Only donors use its two
            // priority slots, so passive event traffic cannot occupy them.
            image = await cache.get([url], { priority: work.donor });
        } finally {
            work.downloading.delete(url);
        }
        if (!closed && image) remember(username, image);
    }
    function remember(username, image) {
        const old = people.get(username);
        if (old?.image === image || old?.backup === image) return;
        const next = describe(image);
        if (!next || next.qualityVersion === old?.qualityVersion || rejectedVersions.get(username)?.has(next.qualityVersion)) return;
        if (!better(next, old)) {
            // Native can reject bytes that pass the cache's dimension check,
            // for example a fully transparent WebP or an incomplete image.
            if (better(next, describe(old.backup))) {
                old.backup = image;
                save();
            }
            return;
        }
        if (old) next.backup = old.image;
        people.delete(username);
        people.set(username, next);
        if (people.size > PROFILE_LIMIT) people.delete(people.keys().next().value);
        publish(username, next);
        save();
        issue = '';
    }
    function replaceRejected(username, record) {
        const versions = rejectedVersions.get(username) || new Set();
        versions.add(record.qualityVersion);
        if (versions.size > 4) versions.delete(versions.values().next().value);
        rejectedVersions.delete(username);
        rejectedVersions.set(username, versions);
        if (rejectedVersions.size > PROFILE_LIMIT) rejectedVersions.delete(rejectedVersions.keys().next().value);
        const backup = describe(record.backup);
        if (backup) {
            people.set(username, backup);
            publish(username, backup);
        } else {
            people.delete(username);
            updates.delete(username);
        }
        try { save(); }
        catch { issue = 'Portre önbelleği yazılamadı; kimlikler ve olaylar korunuyor.'; }
        return backup;
    }
    async function upgrade(username, work) {
        if (work.direct) {
            // Let a likely full-size event image satisfy the request by itself
            // if it is already fast. A slow CDN candidate cannot stall lookup.
            let timer;
            const grace = new Promise(resolve => { timer = setTimeout(resolve, DIRECT_SOURCE_GRACE_MS); });
            try { await Promise.race([work.direct.catch(() => {}), grace]); }
            finally { clearTimeout(timer); }
        }
        if (!canLookUp(username, work.sourceWanted)) return;
        for (const candidate of await lookUp(username, work, false)) await cacheCandidate(username, work, candidate);
        if (typeof sources?.render === 'function') {
            // The vendor can return a thumbnail under an original-size field.
            for (const candidate of await lookUp(username, work, true)) await cacheCandidate(username, work, candidate);
        }
    }
    function schedule(username, work) {
        if (closed || work.scheduled) return;
        work.scheduled = true;
        queueMicrotask(() => {
            work.scheduled = false;
            if (closed) return;
            if (work.promote) {
                work.promote = false;
                // Rejoin the vendor cache to promote queued URLs without
                // starting duplicate downloads.
                for (const url of work.downloading) void cache.get([url], { priority: true });
                admitSourceWaiter();
            }
            const start = (slot, promise) => {
                work[slot] = promise.catch(() => {
                    issue = 'Portre önbelleği yazılamadı; kimlikler ve olaylar korunuyor.';
                }).finally(() => {
                    work[slot] = null;
                    schedule(username, work);
                });
            };
            if (!work.thumbnail && !people.has(username)) {
                const index = work.candidates.findIndex(candidate => candidate.thumbnail);
                if (index >= 0) start('thumbnail', cacheCandidate(username, work, work.candidates.splice(index, 1)[0]));
            }
            if (!work.event && work.candidates.length) {
                const candidate = work.candidates.shift();
                const download = cacheCandidate(username, work, candidate);
                if (candidate.rank >= 3) work.direct = download;
                start('event', download);
            }
            if (!work.source && !work.lookupTried && canLookUp(username, work.sourceWanted)) {
                work.lookupTried = true;
                start('source', upgrade(username, work));
            }
            if (work.thumbnail || work.event || work.source) return;
            if (work.eventCount && !people.has(username)) issue = 'Portre henüz indirilemedi; kimlikler ve olaylar korunuyor.';
            pending.delete(username);
            work.done.resolve();
        });
    }
    function queue(username, groups = [], sourceWanted = false, thumbnails) {
        if (!cache || closed || !USERNAME.test(username)) return false;
        const donor = participants.get(username)?.donor === true;
        let work = pending.get(username);
        if (!work) {
            if (pending.size >= (donor ? TOTAL_JOB_LIMIT : PASSIVE_JOB_LIMIT)
                || (!groups.length && !canLookUp(username, sourceWanted))) return false;
            work = { candidates: [], seen: new Set(), downloading: new Set(), eventCount: 0, done: Promise.withResolvers(), donor };
            pending.set(username, work);
        }
        if (donor && !work.donor) {
            work.donor = true;
            work.promote = true;
        }
        work.sourceWanted ||= sourceWanted;
        const candidates = collect(work, groups, 64 - work.eventCount, thumbnails);
        work.eventCount += candidates.length;
        if (candidates.length) {
            work.candidates.push(...candidates);
            work.candidates.sort((a, b) => b.rank - a.rank);
        }
        schedule(username, work);
        return true;
    }
    function observe(value, payload) {
        if (!value.username || value.type === 'viewer') return { ...value, avatarUrl: '', bestPortraitUrl: '' };
        const route = '/portrait/' + value.username;
        // A compatible shared owner serves the same authenticated relative route.
        const relayed = payload.avatarUrl === route || payload.bestPortraitUrl === route;
        const { groups, thumbnails } = eventPortraitCandidates(payload, value.username);
        const sourceWanted = value.type === 'gift';
        let participant = participants.get(value.username);
        if (cache && (sourceWanted || value.type === 'like' || value.type === 'follow') && USERNAME.test(value.username)) {
            participant ||= { donor: false };
            participant.donor ||= sourceWanted;
            participants.delete(value.username);
            participants.set(value.username, participant);
            if (participants.size > PROFILE_LIMIT) participants.delete(participants.keys().next().value);
        }
        const hasPortrait = relayed || people.has(value.username) || !!(cache && (groups.length || participant && (sources || getCachedPortrait)));
        // Only gifts start an automatic lookup. Like/follow traffic can warm
        // event URLs, but an actual portrait request promotes sparse events.
        if (!queue(value.username, groups, sourceWanted, thumbnails) && participant && groups.length) {
            participant.deferred ||= { groups, thumbnails };
        }
        return { ...value, avatarUrl: hasPortrait ? route : '', bestPortraitUrl: hasPortrait ? route : '' };
    }
    return { observe,
        file(username, excludedVersion) {
            // Keep serving the existing image immediately during an upgrade.
            let record = people.get(username);
            // The authenticated native decoder rejected this exact version.
            // Promote the fallback so a same-size repair has its own update.
            if (excludedVersion && excludedVersion === record?.qualityVersion) record = replaceRejected(username, record);
            const file = imageFile(record?.image);
            if (!file && people.delete(username)) updates.delete(username);
            const participant = participants.get(username);
            if (file || participant) {
                const deferred = participant?.deferred;
                if (queue(username, deferred?.groups, true, deferred?.thumbnails) && deferred) delete participant.deferred;
            }
            return file;
        },
        info(username) {
            const record = people.get(username);
            return record ? metadata(record) : null;
        },
        changes,
        relayUpdates(rows, reset) {
            if (reset) {
                updates.clear();
                portraitSessionId = randomUUID();
                portraitCursor = 0;
            }
            for (const row of rows.slice(0, 128)) {
                if (typeof row?.username !== 'string' || !USERNAME.test(row.username)
                    || !Number.isSafeInteger(row.width) || !Number.isSafeInteger(row.height)
                    || row.width < 1 || row.height < 1 || row.width > 8192 || row.height > 8192
                    || row.width * row.height > NATIVE_MAX_PIXELS || row.shortSide !== Math.min(row.width, row.height)
                    || typeof row.qualityVersion !== 'string' || !/^[a-f0-9]{64}$/.test(row.qualityVersion)) continue;
                publish(row.username, row);
            }
        },
        loading: username => pending.has(username),
        get issue() { return issue; },
        async idle() { await Promise.all([...pending.values()].map(work => work.done.promise)); },
        close() {
            if (closed) return;
            closed = true;
            for (const { resolve } of sourceWaiters.splice(0)) resolve(false);
            for (const work of pending.values()) work.done.resolve();
            pending.clear();
            cache?.close();
            sources?.close?.();
        }
    };
}
module.exports = { createProfiles };
