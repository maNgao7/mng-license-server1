'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

async function main() {
    const config = parseEnv(fs.readFileSync('D:/TikMnG-Recovery-20261028/render-original.env', 'utf8'));
    const origin = 'https://mng-license-server1.onrender.com';
    const response = await fetch(origin + '/api/admin/giris', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sifre: config.ADMIN_SIFRE }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Admin sign-in HTTP ' + response.status);
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const traffic = await fetch(origin + '/api/admin/http-traffic?hours=24', { headers: { cookie }, signal: AbortSignal.timeout(20000) });
    if (!traffic.ok) throw new Error('Traffic HTTP ' + traffic.status);
    const result = await traffic.json();
    const folder = path.resolve(__dirname, '../../render-traffic-20261101'); fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, 'baseline-' + Date.now() + '.json');
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ file, measuredHours: Number(((result.measuredAt - result.startedAt) / 3600000).toFixed(2)), categories: result.categories }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
