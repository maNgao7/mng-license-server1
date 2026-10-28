'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {assertGameInstructions}=require('../tools/qa-newgame-notes.cjs');
const root=path.resolve(__dirname,'../renderer'),output='D:/TikMnG-Game-Setup-20261026';
const catalog=[...require('../lib/catalog-defaults.json').games,...require('../lib/admin-games.json').games].filter((game,index,all)=>game.id!=='crowd-control'&&all.findIndex(item=>item.id===game.id)===index);
const games=catalog.map((g,i)=>({id:g.id,ad:g.title,description:g.description,cover:g.cover,requirements:g.requirements||'Windows 10/11',installed:i%2===0,resources:[],downloadReady:true}));
const snapshot={games,gameAnnouncements:[],version:'qa',preview:true,media:[],mediaAssets:[],audioLibrary:[],remoteMedia:[],soundEffects:[],tts:{},source:'direct',mediaDownloads:{active:[],pending:[]}};
const html='<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><link rel="stylesheet" href="/gift-guide.css"><body><div class="launcher"><main class="main"></main></div><script src="/vendor/lucide.js"></script><script src="/gift-catalog-view.js"></script><script src="/entry-videos.js"></script><script src="/workspace.js"></script></body></html>';

test('all game preparation guides use six prominent ordered steps without losing instructions or overflowing',{timeout:90000},async t=>{
    const errors=[],results=[];let browser;
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://fixture');
        if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
        const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    fs.mkdirSync(output,{recursive:true});browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.exposeFunction('__workspace',action=>action==='speech-status'?{voices:[],packs:[],voiceLibrary:[],providers:{}}:snapshot);
    await page.addInitScript(()=>{window.mngAPI={workspace:action=>window.__workspace(action),workspaceListen(){},orbitHediyeKatalogu:async()=>[],widgetBilgisi:async()=>({channel:'qa',widgets:[],liveStatus:{status:'disconnected'}})};});
    for(const viewport of [{width:1920,height:1080},{width:1440,height:960},{width:900,height:800},{width:390,height:844},{width:360,height:800}]){
        await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.library-card').first().waitFor();
        for(const game of games){
            await page.locator(`[data-open="${game.id}"]`).first().click();await page.locator('.game-setup').waitFor();
            const notes=await page.locator('.game-setup li').allTextContents();assertGameInstructions(game,notes);
            assert.deepEqual(await page.locator('.setup-step-number').allTextContents(),['1','2','3','4','5','6']);
            const layout=await page.locator('.game-setup').evaluate(section=>{
                const rows=[...section.querySelectorAll('li')].map(n=>n.getBoundingClientRect());
                const nodes=[section,...section.querySelectorAll('li,li>div,h2,strong,p')];
                return {heading:parseFloat(getComputedStyle(section.querySelector('h2')).fontSize),title:parseFloat(getComputedStyle(section.querySelector('strong')).fontSize),text:parseFloat(getComputedStyle(section.querySelector('p')).fontSize),badge:section.querySelector('.setup-step-number').getBoundingClientRect().width,icon:!!section.querySelector('h2>svg'),overflow:nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.tagName),overlap:rows.some((a,i)=>rows.some((b,j)=>j>i&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)),pageFits:document.documentElement.scrollWidth<=innerWidth+1};
            });
            assert.ok(layout.heading>=22);assert.ok(layout.title>=16);assert.ok(layout.text>=14);assert.equal(layout.badge,38);assert.equal(layout.icon,true);assert.deepEqual(layout.overflow,[],game.id+' text overflow');assert.equal(layout.overlap,false);assert.equal(layout.pageFits,true);
            if(game.id==='minecraft-snake-arena')await page.locator('.game-setup').screenshot({path:path.join(output,`guide-${viewport.width}.png`)});
            results.push({game:game.id,width:viewport.width,...layout});
            await page.locator('[data-back]').click();await page.locator('.library-card').first().waitFor();
        }
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,games:games.length,checks:results,errors},null,2));
    t.diagnostic(`${games.length} games x 5 viewports: prominent six-step instructions, text preserved, no overflow. ${output}`);
});
