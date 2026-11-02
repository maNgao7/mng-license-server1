'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { frames } = require('../lib/portrait-frames.cjs');
const { normalize } = require('../lib/widget-studio.cjs');
const championArt = require('../lib/champion-art.json');
const root = path.resolve(__dirname, '..');
const previewRoot = path.resolve(root, '../widget-preview-7.0.14');
const royal = new Set(['raconking', 'streambeauty', 'streamhandsome']);
const names = ['Deniz', 'Yıldız', 'Mavi', 'Atlas', 'Nehir', 'Sakura', 'Gece', 'Limon', 'Bulut'];
function fixture(type) {
    const rows = names.map((nickname, i) => ({username:'viewer'+i,nickname,avatar:'',totalCoins:9200-i*850,totalLikes:4200-i*380}));
    return {topGifters:rows,topLikes:rows,activities:[],studio:{settings:{[type]:normalize(type,{sound:false})}}};
}
async function start(port = 0) {
    const states = new Map();
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405);res.end();return; }
        if (url.pathname === '/api/widget/state') {
            const type = url.searchParams.get('type');
            res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
            res.end(JSON.stringify(states.get(type) || fixture(type)));return;
        }
        const name = path.basename(url.pathname);
        let file;
        if (url.pathname === '/') file = path.join(previewRoot,'index.html');
        else if (url.pathname === '/frame-motion.js') file = path.join(previewRoot,'frame-motion.js');
        else if (url.pathname === '/frame-motion-v2.js') file = path.join(previewRoot,'frame-motion-v2.js');
        else if (url.pathname === '/vendor/three/RoomEnvironment.js') file = path.join(previewRoot,'node_modules/three/examples/jsm/environments/RoomEnvironment.js');
        else if (/^\/vendor\/three\/(three\.module|three\.core)\.js$/.test(url.pathname)) file = path.join(previewRoot,'node_modules/three/build',name);
        else if (url.pathname === '/widget') file = path.join(root,'renderer/widgets',royal.has(url.searchParams.get('type'))?'royal-widgets.html':'reference-widgets.html');
        else if (url.pathname === '/widget/champion-motion.js') file = path.join(root,'renderer/widgets/champion-motion.js');
        else if (url.pathname.startsWith('/concepts/')) file = path.join(previewRoot,'assets',name);
        else if (url.pathname === '/widget/vendor/matter.js') file = require.resolve('matter-js/build/matter.min.js');
        else if (url.pathname === '/vendor/lucide.js') file = path.join(root,'node_modules/lucide/dist/umd/lucide.min.js');
        else if (url.pathname === '/assets/widgets/glass-gift-jar.png') file = path.join(root,'renderer/assets/widgets/glass-gift-jar.png');
        else if (url.pathname.startsWith('/widget/gift-assets/')) {
            file = ['renderer/widgets/royal-assets','renderer/gift-assets','renderer/assets'].map(dir=>path.join(root,dir,name)).find(fs.existsSync);
        }
        if (!file || !fs.existsSync(file)) { res.writeHead(404);res.end();return; }
        const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.webp':'image/webp'}[path.extname(file)] || 'application/octet-stream';
        res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','no-store');
        if (req.method === 'HEAD') {res.end();return;}
        const source = fs.readFileSync(file);
        res.end(path.extname(file)==='.html'?source.toString().replace('/*PORTRAIT_FRAME_CATALOG*/[]',JSON.stringify(frames)).replace('/*CHAMPION_ART*/{}',JSON.stringify(championArt)):source);
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    return {server,origin:'http://127.0.0.1:'+server.address().port,setState:(type,state)=>states.set(type,state),close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
module.exports={start};
if(require.main===module)start(Number(process.env.PORT)||0).then(({origin})=>console.log(origin)).catch(error=>{console.error(error.message);process.exitCode=1;});
