'use strict';

const id = value => (typeof value === 'string' || typeof value === 'bigint' ||
    typeof value === 'number' && Number.isSafeInteger(value)) && /^[1-9]\d{0,31}$/.test(String(value)) ? String(value) : '';
const text = (value, limit = 64) => typeof value === 'string' ? value.slice(0, limit) : '';
const https = value => typeof value === 'string' && /^https:\/\//i.test(value) ? value.slice(0, 2048) : '';
function readProfile(user, expectedId) {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
    const aliases = [expectedId, user.id_str, user.userIdStr, user.user_id_str, user.userId, user.user_id, user.id]
        .filter(value => value !== undefined && value !== null && value !== '' && value !== '0' && value !== 0);
    const key = aliases.map(id).find(Boolean);
    // Room JSON often includes an exact string plus a duplicate rounded by JSON.parse.
    // Use the exact identifier, and never accept an unsafe number by itself.
    if (!key || aliases.some(value => id(value) !== key &&
        !(typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value) && value === Number(key)))) return null;
    let avatar = '';
    for (const urls of [user.avatarLarge?.urlList, user.avatar_large?.url_list, user.avatarMedium?.urlList,
        user.avatar_medium?.url_list, user.avatarThumb?.urlList, user.avatar_thumb?.url_list]) {
        if (Array.isArray(urls)) avatar ||= https(urls.slice(0, 8).find(url => https(url)));
    }
    return { id: key, username: text(user.uniqueId) || text(user.unique_id) || text(user.displayId) || text(user.display_id),
        nickname: text(user.nickname) || text(user.nickName), avatar: avatar || https(user.profilePictureUrl) };
}
function collectProfiles(payload, known = new Map()) {
    const seen = new Set(); let visited = 0;
    function walk(value, depth = 0, expectedId) {
        if (!value || typeof value !== 'object' || depth > 8 || seen.has(value) || ++visited > 3000) return;
        seen.add(value);
        // A wrapper key and its embedded user must describe the same account.
        if (value.value?.user && Object.hasOwn(value, 'key')) {
            if (id(value.key) && readProfile(value.value.user, value.key)) walk(value.value.user, depth + 1, value.key);
            return;
        }
        const profile = readProfile(value, expectedId);
        if (profile && (profile.username || profile.nickname || profile.avatar)) {
            const old = known.get(profile.id) || {};
            known.set(profile.id, { id: profile.id, username: profile.username || old.username || '',
                nickname: profile.nickname || old.nickname || '', avatar: profile.avatar || old.avatar || '' });
        }
        for (const [name, child] of Object.entries(value)) if (!/armies|support|cookie|token|signature/i.test(name)) walk(child, depth + 1);
    }
    walk(payload);
    while (known.size > 500) known.delete(known.keys().next().value);
    return known;
}
function anchors(known) {
    return [...known.values()].map(row => ({ key: row.id, value: { user: { userId: row.id, displayId: row.username,
        nickName: row.nickname, avatarLarge: { urlList: row.avatar ? [row.avatar] : [] } } } }));
}
module.exports = { collectProfiles, anchors, readProfile };
