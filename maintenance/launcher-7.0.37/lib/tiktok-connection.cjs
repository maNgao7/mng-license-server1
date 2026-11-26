'use strict';

const http = require('node:http');
const https = require('node:https');
const { isIP } = require('node:net');

function secureBaseUrl(host) {
    const url = new URL(String(host).includes('://') ? host : `https://${host}`);
    const loopback = ['localhost', '[::1]', '::1'].includes(url.hostname) ||
        (isIP(url.hostname) === 4 && url.hostname.startsWith('127.'));
    if (url.username || url.password) throw new TypeError('Invalid connection host');
    if (!loopback) url.protocol = 'https:';
    return url.origin;
}

// One transport lifetime per attempt. Do not modify global DNS, SDK routes,
// certificate checks or the cached signing client used by other consumers.
function createTikTokConnection({ sdk, ApiClient, username, signApiKey = '' }) {
    const abort = new AbortController();
    const agentOptions = { keepAlive: true, autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 };
    const httpAgent = new http.Agent(agentOptions);
    const httpsAgent = new https.Agent(agentOptions);
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        abort.abort();
        httpAgent.destroy();
        httpsAgent.destroy();
    };
    try {
        const { cachedInstance, ...signConfig } = sdk.SignConfig;
        const eulerApiInstance = new ApiClient({
            ...signConfig,
            apiKey: signApiKey || signConfig.apiKey,
            baseOptions: { ...signConfig.baseOptions, timeout: 12000,
                signal: abort.signal, httpAgent, httpsAgent }
        });
        const connection = new sdk.TikTokLiveConnection(username, {
            processInitialData: true, enableExtendedGiftInfo: false,
            eulerApiInstance,
            // The session owns retries. HTTP's nested retries otherwise consume
            // the entire connection deadline before the next room source runs.
            webClientOptions: { signal: abort.signal, retry: { limit: 0 },
                agent: { http: httpAgent, https: httpsAgent } },
            wsClientOptions: { agent: httpsAgent, handshakeTimeout: 15000 }
        });
        // SDK 2.4.4 reverses its loopback test: public hosts start as HTTP.
        // Correct only this instance; HTTPS no longer depends on a redirect.
        if (connection.webClient) connection.webClient.getBaseUrl = secureBaseUrl;
        let stage = 'room-discovery';
        Object.defineProperty(connection, 'liveStage', { get: () => stage });
        for (const [method, before, after] of [
            ['fetchRoomId', 'room-discovery', 'room-info'],
            ['fetchRoomInfo', 'room-info', 'signing'],
            ['setupWebsocket', 'websocket', 'websocket']
        ]) {
            const original = connection[method];
            if (typeof original !== 'function') continue;
            connection[method] = async function (...args) {
                abort.signal.throwIfAborted();
                stage = before;
                const result = await original.apply(this, args);
                abort.signal.throwIfAborted();
                stage = after;
                return result;
            };
        }
        const disconnect = connection.disconnect.bind(connection);
        connection.disconnect = () => {
            let result;
            try { result = disconnect(); }
            finally { dispose(); }
            return result;
        };
        return connection;
    } catch (error) {
        dispose();
        throw error;
    }
}

module.exports = { createTikTokConnection };
