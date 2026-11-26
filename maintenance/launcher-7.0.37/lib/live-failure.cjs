'use strict';

// The SDK keeps causes in exception/cause and fallback failures in
// InvalidResponseCompositeError.config.requestErrs. Never serialize those errors.
const MAX_NODES = 64;
const MAX_DEPTH = 12;
const MAX_ALTERNATIVES = 8;
const MAX_TEXT = 2048;
const MAX_DIAGNOSTICS = 8;
const STAGES = new Set(['room-discovery', 'room-info', 'signing', 'websocket', 'connection']);
const ROUTES = new Map([
    ['fetchRoomIdRoute', 'room-discovery'],
    ['fetchIsLiveRoute', 'room-discovery'],
    ['fetchRoomIdFromEulerRoute', 'room-discovery'],
    ['fetchRoomInfoRoute', 'room-info'],
    ['fetchRoomInfoFromEulerRoute', 'room-info'],
    ['fetchRoomInfoHtmlRoute', 'room-info'],
    ['fetchRoomInfoApiLiveRoute', 'room-info'],
    ['fetchSignedWebSocketFromEulerRoute', 'signing'],
    ['fetchWebcastSignatureFromEulerRoute', 'signing']
]);
const CODE_REASONS = new Map([
    ...['ENOTFOUND', 'EAI_AGAIN', 'EAI_FAIL', 'EAI_NODATA'].map(code => [code, 'dns']),
    ...['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'CERT_REVOKED',
        'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
        'ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED', 'ERR_TLS_CERT_ALTNAME_FORMAT',
        'ERR_SSL_WRONG_VERSION_NUMBER', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
        'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'EPROTO'].map(code => [code, 'tls']),
    ...['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ERR_SOCKET_CONNECTION_TIMEOUT',
        'ERR_TLS_HANDSHAKE_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT', 'ECONNABORTED'].map(code => [code, 'timeout']),
    ...['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN',
        'EPIPE', 'ERR_NETWORK', 'ERR_SOCKET_CLOSED', 'UND_ERR_SOCKET'].map(code => [code, 'network']),
    ['ERR_HTTP_RESPONSE_CODE', 'connection'], ['ERR_BAD_RESPONSE', 'connection'],
    ['ERR_BAD_REQUEST', 'connection']
]);
const PRIORITY = ['rate-limit', 'dns', 'tls', 'offline', 'timeout', 'auth', 'network', 'room-discovery'];
const SIGNING_ERRORS = new Set(['SignAPIError', 'SignatureRateLimitError',
    'SignatureMissingTokensError', 'PremiumFeatureError', 'AuthenticatedWebSocketConnectionError']);

function read(value, key) {
    if (!value || !['object', 'function'].includes(typeof value)) return undefined;
    try { return value[key]; } catch { return undefined; }
}

function text(value) { return typeof value === 'string' ? value.slice(0, MAX_TEXT) : ''; }
function isArray(value) { try { return Array.isArray(value); } catch { return false; } }
function status(value) {
    if (typeof value === 'string' && /^[1-5]\d{2}$/.test(value)) return Number(value);
    return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}
function unknown(stage = 'connection') { return { reason: 'connection', stage }; }

function choose(results, fallback) {
    for (const reason of PRIORITY) {
        const result = results.find(item => item.reason === reason);
        if (result) return result;
    }
    return fallback;
}

function aggregate(results, stage) {
    if (!results.length) return unknown(stage);
    // A failed fallback is not proof that every discovery source rejected auth,
    // or that the broadcaster is offline. Preserve concrete transport failures.
    for (const reason of ['rate-limit', 'dns', 'tls', 'timeout']) {
        const result = results.find(item => item.reason === reason);
        if (result) return result;
    }
    if (results.every(item => item.reason === results[0].reason)) return results[0];
    return { reason: stage === 'room-discovery' ? 'room-discovery' : 'connection', stage };
}

/**
 * Return only allowlisted reasons/stages/codes and numeric HTTP statuses.
 * Limits: 64 nodes, 12 edges deep, 8 entries per alternative list, 2048 chars
 * per message, and 8 unique codes/statuses each. No SDK import or I/O occurs.
 */
function classifyLiveFailure(error) {
    const codes = new Set(), httpStatuses = new Set();
    const active = new WeakSet(), completed = new WeakMap();
    let nodes = 0;
    const record = (set, value) => { if (set.size < MAX_DIAGNOSTICS) set.add(value); };

    function visit(value, depth, inheritedStage) {
        if (depth > MAX_DEPTH || nodes >= MAX_NODES) return unknown(inheritedStage);
        const object = value !== null && (typeof value === 'object' || typeof value === 'function');
        if (object) {
            if (active.has(value)) return unknown(inheritedStage);
            if (completed.has(value)) return completed.get(value);
            active.add(value);
        }
        nodes++;
        const config = read(value, 'config'), context = read(value, 'context');
        const message = typeof value === 'string' ? text(value) : text(read(value, 'message'));
        const names = [read(value, 'name'), read(read(value, 'constructor'), 'name')];
        const named = name => names.includes(name);
        const signing = names.some(name => SIGNING_ERRORS.has(name));
        let ownStage;
        for (const holder of [config, context, value]) {
            const route = read(holder, 'routeId');
            if (ROUTES.has(route)) { ownStage = ROUTES.get(route); break; }
        }
        if (!ownStage) {
            for (const [route, stage] of ROUTES) {
                if (message.includes(`[${route}]`)) { ownStage = stage; break; }
            }
        }
        if (!ownStage) {
            const explicit = read(value, 'stage');
            if (STAGES.has(explicit) && explicit !== 'connection') ownStage = explicit;
            else if (signing) ownStage = 'signing';
            else if (named('UserOfflineError')) ownStage = 'room-info';
            else if (named('ConnectTimeoutError')) ownStage = 'websocket';
            else if (/\b(?:retrieve|fetch|extract|resolve) room (?:id|identifier)\b/i.test(message)) ownStage = 'room-discovery';
            else if (/\bwebsocket\b/i.test(message)) ownStage = 'websocket';
        }
        const stage = ownStage || inheritedStage;
        const localCodes = new Set();
        const code = read(value, 'code');
        if (CODE_REASONS.has(code)) localCodes.add(code);
        // SignAPIError flattens an underlying Error into its message.
        for (const token of message.match(/\b[A-Z][A-Z0-9_]{1,63}\b/g) || []) {
            if (CODE_REASONS.has(token)) localCodes.add(token);
        }
        for (const item of localCodes) record(codes, item);
        const statuses = new Set();
        const response = read(value, 'response');
        for (const holder of [value, response]) {
            for (const key of ['statusCode', 'status']) {
                const parsed = status(read(holder, key));
                if (parsed !== null) statuses.add(parsed);
            }
        }
        // Do not treat arbitrary digits in usernames, request IDs or URLs as HTTP.
        const leading = message.match(/^\s*([45]\d{2})(?=\s|:|$)/);
        if (leading) statuses.add(Number(leading[1]));
        const statusPattern = /\b(?:HTTP(?:\/\d(?:\.\d)?)?\s+|(?:response\s+)?status(?:\s+code)?\s*[:=]?\s*|response code\s+|unexpected server response\s*:\s*)([1-5]\d{2})\b/gi;
        for (const match of message.matchAll(statusPattern)) statuses.add(Number(match[1]));
        for (const item of statuses) record(httpStatuses, item);

        const reasons = new Set([...localCodes].map(item => CODE_REASONS.get(item)));
        const sdkReason = read(value, 'reason');
        if (statuses.has(429) || named('SignatureRateLimitError') || (signing && sdkReason === 'Rate Limited') ||
            /\brate[ -]?limit(?:ed|ing)?\b|\btoo many requests\b/i.test(message)) reasons.add('rate-limit');
        if (named('UserOfflineError') ||
            /^(?:(?:the requested )?(?:user|host|streamer|broadcaster)\s+)?(?:is(?:n't| not)\s+(?:online|(?:currently )?live)|not\s+(?:online|(?:currently )?live))\b/i.test(message) ||
            /^(?:user|host|streamer|broadcaster) is offline\b|^offline[.!]?\s*$|^(?:the )?(?:live|stream|broadcast) (?:has )?ended\b/i.test(message)) reasons.add('offline');
        if (named('ConnectTimeoutError') || named('TimeoutError') || /\btimeout\b|\btimed out\b/i.test(message)) reasons.add('timeout');
        if (statuses.has(401) || statuses.has(403) || named('SignatureMissingTokensError') ||
            named('PremiumFeatureError') || named('AuthenticatedWebSocketConnectionError') ||
            (signing && ['Empty Cookies', 'Premium Feature', 'Authenticated WS'].includes(sdkReason)) ||
            /\bunauthorized\b|\bforbidden\b|\bauthentication failed\b|\b(?:invalid|missing) (?:api[ -]?key|credentials)\b|\black of permission\b/i.test(message)) reasons.add('auth');
        if ((signing && sdkReason === 'Connect Error') || /\bnetwork\b|\bfetch failed\b|\bsocket\b/i.test(message)) reasons.add('network');
        const local = choose([...reasons].map(reason => ({ reason, stage })), unknown(stage));

        const alternatives = [];
        const lists = isArray(value) ? [value] : [read(value, 'errors'), read(value, 'requestErrs'),
            read(context, 'requestErrs'), read(config, 'requestErrs')];
        for (const list of lists) {
            if (!isArray(list)) continue;
            const length = read(list, 'length');
            if (!Number.isSafeInteger(length) || length < 0) continue;
            for (let i = 0; i < Math.min(length, MAX_ALTERNATIVES); i++) {
                alternatives.push(visit(read(list, i), depth + 1, stage));
            }
            if (length > MAX_ALTERNATIVES) alternatives.push(unknown(stage));
        }
        const results = [local];
        if (alternatives.length) results.push(aggregate(alternatives, stage));
        for (const key of ['exception', 'cause']) {
            const child = read(value, key);
            if (child !== undefined && child !== null) results.push(visit(child, depth + 1, stage));
        }
        const fallback = { reason: stage === 'room-discovery' ? 'room-discovery' : 'connection', stage };
        const selected = choose(results, fallback);
        const result = { reason: selected.reason, stage: ownStage || selected.stage };
        if (object) { active.delete(value); completed.set(value, result); }
        return result;
    }

    const result = visit(error, 0, 'connection');
    return { reason: result.reason, diagnostic: {
        stage: result.stage, codes: [...codes].sort(), httpStatuses: [...httpStatuses].sort((a, b) => a - b)
    } };
}

module.exports = { classifyLiveFailure };
