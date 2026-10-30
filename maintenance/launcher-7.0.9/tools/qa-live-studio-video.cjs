'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const { createMediaStudio } = require('../lib/media-studio.cjs');
const root = fs.mkdtempSync('D:/TikMnG-Update-QA-20261030/video-stage-');
const key = 'synthetic-studio-soak-20261030', values = new Map(), telemetry = [];
const store = { get: (k, fallback) => values.get(k) ?? fallback, set: (k, v) => values.set(k, structuredClone(v)) };
const studio = createMediaStudio({ store, root: path.join(root, 'media'), accessKey: key, getChannel: () => 'qa', getActiveGame: () => '' });
let timer, server, origin, bridge, triggered = 0, finishing = false;
const duration = Math.max(60, Math.min(1800, Number(process.env.MNG_STUDIO_QA_SECONDS) || 600));
const measure = String.raw`<script>
(()=>{const client=crypto.randomUUID();let received=0;const E=window.EventSource;
window.EventSource=class extends E{constructor(...a){super(...a);this.addEventListener('studio:play',()=>received=performance.now());}};
const nativeFetch=window.fetch;window.fetch=async(...a)=>{const response=await nativeFetch(...a);const url=String(a[0]);if(url.includes('/tikmng/media/poll')&&!url.includes('qaTelemetry'))response.clone().json().then(data=>{if(data.events?.length)received=performance.now();}).catch(()=>{});return response;};
function send(v,event){const q=v?.getVideoPlaybackQuality?.()||{},base=/^(\/overlays\/[A-Za-z0-9_-]{43})/.exec(location.pathname)?.[1]||'';fetch(base+'/tikmng/media/poll?qaTelemetry='+encodeURIComponent(JSON.stringify({client,event,agent:navigator.userAgent.slice(0,250),hidden:document.hidden,time:v?.currentTime||0,total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0,startMs:event==='playing'?performance.now()-received:0}))).catch(()=>{});}
for(const event of ['playing','waiting','stalled','ended','error'])document.addEventListener(event,e=>{if(e.target.tagName==='VIDEO')send(e.target,event);},true);
setInterval(()=>{const v=document.querySelector('#stage video');if(v)send(v,'sample');},2000);
})();</script>`;
async function finish() {
    if (finishing) return; finishing = true; clearInterval(timer);
    const report = { triggered, seconds: duration, telemetry, studioClients: [...new Set(telemetry.filter(row => /LIVE|Tiktok|TikTok|LiveStudio/i.test(row.agent)).map(row => row.client))] };
    fs.writeFileSync(path.resolve(__dirname, '../qa/20261030/live-studio-video-report.json'), JSON.stringify(report, null, 2));
    bridge?.close(); studio.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    console.log(JSON.stringify({ finished: true, triggered, clients: [...new Set(telemetry.map(row => row.client))].length, records: telemetry.length, report: 'qa/20261030/live-studio-video-report.json' }));
}
async function main() {
    const video = path.join(root, '1080p30-test.mp4');
    execFileSync('C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',
        ['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30',
            '-t','8','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',video],
        { windowsHide: true, timeout: 90000 });
    const [item] = await studio.importFiles([video], [{ title: 'TikMnG 1080p30 Test', volume: 0, interrupt: false }]);
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/tikmng/media/poll' && url.searchParams.has('qaTelemetry')) {
            const data = url.searchParams.get('qaTelemetry');
            try { const row = JSON.parse(data); if (data.length < 2048 && telemetry.length < 10000) telemetry.push({ ...row, at: Date.now() }); } catch {}
            return res.writeHead(204).end();
        }
        if (url.pathname === '/tikmng/media/client.js') {
            const script = fs.readFileSync(path.resolve(__dirname, '../renderer/studio/overlay.js'), 'utf8');
            return res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
                .end(measure.replace(/^<script>|<\/script>$/g, '') + '\n' + script);
        }
        if (url.pathname === '/qa/stage') {
            const html = await fetch(origin + '/tikmng/media?key=' + key + '&channel=qa').then(r => r.text());
            return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
                .end(html.replace('<head>', '<head>' + measure));
        }
        if (url.pathname === '/qa/telemetry' && req.method === 'POST') {
            let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 2048) return res.writeHead(413).end(); }
            try { const row = JSON.parse(data); if (telemetry.length < 10000) telemetry.push({ ...row, at: Date.now() }); } catch {}
            return res.writeHead(204).end();
        }
        if (url.pathname === '/qa/stop' && req.method === 'POST') { res.writeHead(204).end(); return finish(); }
        if (studio.handleRequest(req, res, url)) return;
        res.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    console.log('QA_VIDEO_URL=' + origin + '/qa/stage?key=' + key + '&channel=qa');
    if (process.env.MNG_STUDIO_PUBLIC === '1') {
        const Store = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
        const config = new Store({ cwd: path.resolve(__dirname, '../qa/20261030/packaged-qa-profile'), name: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
        const credentials = { licenseCode: config.get('lisans_kod', ''), deviceId: config.get('cihaz_kimlik', '') };
        bridge = require('../lib/overlay-bridge.cjs').createOverlayBridge({ store, serverURL: fs.readFileSync(path.resolve(__dirname, '../license-server.txt'), 'utf8').trim(),
            port: server.address().port, accessKey: key, getCredentials: () => credentials, getChannel: () => 'qa', namespace: 'video-soak-qa',
            onStatus: status => { if (status.ready) console.log('QA_HTTPS_URL=' + bridge.urlFor(origin + '/tikmng/media?key=' + key + '&channel=qa')); else console.log('QA_HTTPS_STATUS=' + status.status); } });
        bridge.start('qa');
    }
    timer = setInterval(() => { studio.test(item.id); triggered++; }, 10000);
    setTimeout(finish, duration * 1000).unref();
}
main().catch(async error => { console.error(error); process.exitCode = 1; if (server) await finish(); else studio.close(); });
