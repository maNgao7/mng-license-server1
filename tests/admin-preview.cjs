const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function main() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-admin-demo-'));
    for (const name of ['lisanslar', 'lisanslar_backup', 'aktivasyon_log', 'talepler', 'kara_liste']) fs.writeFileSync(path.join(dir, name + '.json'), '[]');
    const port = await new Promise(resolve => {
        const probe = net.createServer();
        probe.once('error', () => {
            const fallback = net.createServer().listen(0, '127.0.0.1', () => {
                const port = fallback.address().port;
                fallback.close(() => resolve(port));
            });
        });
        probe.listen(4197, '127.0.0.1', () => probe.close(() => resolve(4197)));
    });
    // This password only opens disposable demo data on loopback, never production records.
    const password = 'TikMnG-Deneme-Paneli-2026';
    const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), windowsHide: true,
        env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), MNG_DATA_DIR: dir, ADMIN_SIFRE: password,
            GITHUB_TOKEN: '', GITHUB_LICENSE_TOKEN: '', GITHUB_LICENSE_REPO: '', BACKUP_REPO: '' }, stdio: 'ignore' });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
        if (child.exitCode !== null) throw new Error('Demo server could not start.');
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    const login = await fetch(base + '/api/admin/giris', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sifre: password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    async function post(route, body) {
        return (await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) })).json();
    }
    const agency = await post('/api/admin/ajans-lisansi-olustur', { ajans_adi: 'Trend Ajans', max_yayinci: 20, sure_birim: 'gun', sure_miktar: 30, notlar: 'Ornek yayin ekibi' });
    for (const [i, name] of ['Deniz', 'Ece', 'Emre'].entries()) {
        const deviceId = 'demo-cihaz-' + (i + 1);
        await post('/api/license/verify', { code: agency.kod, deviceId });
        await post(`/api/admin/ajans/${agency.kod}/yayinci`, { deviceId, ad: name });
    }
    await post('/api/admin/lisans-olustur', { sure_birim: 'gun', sure_miktar: 7, notlar: 'Ornek bireysel lisans' });
    console.log(`Preview: ${base}/admin/`);
    console.log(`Demo password: ${password}`);
    console.log('Only disposable sample data is used. Real licenses are untouched.');
    const stop = () => { child.kill(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    child.on('exit', () => process.exit(0));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
