'use strict';

const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { test } = require('node:test');
const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');

test('copied widget links use the connected HTTPS relay and omit the local key', { timeout: 3000 }, async t => {
    const relay = 'https://mng-license-server1.onrender.com';
    const token = 'a'.repeat(43);
    const status = new EventEmitter();
    class Socket extends EventEmitter {
        constructor(url) {
            super();
            assert.equal(url, 'wss://mng-license-server1.onrender.com/api/overlay/bridge');
            queueMicrotask(() => this.emit('open'));
        }
        close() {}
    }
    const bridge = createOverlayBridge({
        store: new Map(), serverURL: relay, port: 3077, accessKey: 'local-only', WebSocketImpl: Socket,
        getCredentials: () => ({ licenseCode: 'test-license', deviceId: 'test-device' }),
        fetchImpl: async url => {
            assert.equal(url, relay + '/api/overlay/session');
            return Response.json({ token, path: '/overlays/' + token, ticket: 'fixture',
                protocolVersion: 1, expiresAt: Date.now() + 120000, namedWidgetPaths: true });
        },
        onStatus: state => { if (state.ready) status.emit('connected'); }
    });
    t.after(() => bridge.close());
    const connected = once(status, 'connected');
    bridge.start('test_channel');
    await connected;
    const link = bridge.urlFor('http://127.0.0.1:3077/widget-overlay.html?type=jar-bell&engine=coinjar&channel=test_channel&key=local-only', { namedWidget: 'jar-bell' });
    assert.equal(link, `${relay}/overlays/${token}/widget/view/jar-bell`);
});
