'use strict';

const STATES = new Set(['disconnected', 'connecting', 'connected', 'waiting', 'error']);
const REASONS = new Set(['idle', 'stopped', 'closed', 'connecting', 'connected', 'offline', 'stream-ended',
    'disconnected', 'timeout', 'sdk-load', 'invalid-connection', 'invalid-room', 'invalid-username',
    'auth', 'rate-limit', 'network', 'dns', 'tls', 'room-discovery', 'connection']);
const STAGES = new Set(['room-discovery', 'room-info', 'signing', 'websocket', 'connection']);
function createLiveReport({ now = Date.now } = {}) {
    const entries = [];
    let previous = '';
    return {
        record(status) {
            const row = { status: STATES.has(status.status) ? status.status : 'error',
                reason: REASONS.has(status.reason) ? status.reason : 'connection',
                attempt: Math.max(0, Math.min(100000, Math.floor(Number(status.attempt) || 0))) };
            if (status.diagnostic) {
                row.stage = STAGES.has(status.diagnostic.stage) ? status.diagnostic.stage : 'connection';
                // Codes are re-selected from structured data, never raw SDK text.
                const known = new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT',
                    'ENETUNREACH','EHOSTUNREACH','EPIPE','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID',
                    'DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE',
                    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID','ERR_SSL_WRONG_VERSION_NUMBER']);
                row.codes = (status.diagnostic.codes || []).filter(code => known.has(code)).slice(0, 8);
                row.httpStatuses = (status.diagnostic.httpStatuses || []).filter(code =>
                    Number.isInteger(code) && code >= 400 && code <= 599).slice(0, 8);
            }
            const signature = JSON.stringify(row);
            if (signature === previous) return;
            previous = signature;
            entries.push({ at: new Date(now()).toISOString(), ...row });
            if (entries.length > 40) entries.shift();
        },
        text(meta) {
            const environment = {};
            for (const key of ['version','node','electron','platform','arch']) {
                const value = String(meta[key] || '');
                environment[key] = /^[a-zA-Z0-9.+_-]{1,40}$/.test(value) ? value : 'unknown';
            }
            return JSON.stringify({ schema: 1, ...environment, entries }, null, 2);
        }
    };
}
module.exports = { createLiveReport };
