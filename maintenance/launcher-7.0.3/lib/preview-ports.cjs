'use strict';
const net = require('node:net');

async function assertPreviewPortsAvailable(ports) {
    for (const port of new Set(ports)) {
        if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid test port');
        await new Promise((resolve, reject) => {
            const probe = net.createServer();
            probe.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
                ? 'Bu oyun için gereken bağlantı kullanımda. Normal launcher ve açık oyununu kapatıp test sürümünden yeniden dene.'
                : 'Test oyununun yerel bağlantısı açılamadı.')));
            probe.listen(port, '127.0.0.1', () => probe.close(resolve));
        });
    }
}
module.exports = { assertPreviewPortsAvailable };
