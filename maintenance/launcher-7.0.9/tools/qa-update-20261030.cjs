'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createEntryVideos}=require('../lib/entry-videos.cjs'),{createStudio,definitions}=require('../lib/widget-studio.cjs');
const {scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs'),{TTS_DEFAULTS}=require('../lib/platform.cjs');
const root=path.resolve(__dirname,'..'),renderer=path.join(root,'renderer'),output=path.join(root,'qa/20261030');fs.mkdirSync(output,{recursive:true});
const data=new Map(),store={get:(key,fallback)=>structuredClone(data.get(key)??fallback),set:(key,value)=>data.set(key,structuredClone(value))};
const key='isolated-browser-qa-key',entry=createEntryVideos({store,root:path.join(output,'media'),accessKey:key,getChannel:()=> 'qa'}),studio=createStudio(store,(_,id)=>'/widget/gift-assets/'+id+'.png');
let browser,server,origin,qaPage;const errors=[];
const gifts=JSON.parse(fs.readFileSync(path.join(renderer,'gift-assets/katalog_tam.json'),'utf8')).map(g=>({...g,id:String(g.id),image:'gift-assets/'+g.file}));
const games=['snow-war','battle-royale'].map(id=>({id,ad:id==='snow-war'?'Minecraft Kartopu Savaşı':'Minecraft PUBG',installed:true,installedVersion:'7.0.4',availableVersion:'7.0.5-candidate',updateAvailable:true,downloadReady:true,description:'',requirements:'Windows 10/11'}));
const widgetUrl=id=>origin+'/widget-overlay.html?type='+id+'&key='+key+'&channel=qa';
function widgetInfo(){return {channel:'qa',active:true,liveStatus:{status:'connected'},studio:studio.state('qa'),widgets:definitions.map(d=>({...d,url:widgetUrl(d.id),previewUrl:widgetUrl(d.id),broadcastUrl:widgetUrl(d.id)}))};}
function snapshot(){return {version:'7.0.8-candidate',preview:true,games,media:[],mediaAssets:[],audioLibrary:[],remoteMedia:[],soundEffects:[],tts:data.get('tts')||TTS_DEFAULTS,entryVideos:entry.list(),entryVideoStatus:entry.status(),entryVideoUrl:origin+'/tikmng/media?game=entry-videos&key='+key+'&channel=qa',libraryRoot:output,mediaRoot:output};}
async function api(action,value={}){
    if(action==='speech-status')return {voices:[],providers:{},packs:[]};
    if(action==='tts'){data.set('tts',value);return snapshot();}
    if(action==='entry-status')return entry.status();
    if(action==='entry-save'){entry.save(value);return snapshot();}
    return snapshot();
}
function file(res,filename){res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'})[path.extname(filename)]||'application/octet-stream');fs.createReadStream(filename).pipe(res);}
async function main(){
    const asset=await entry.importAsset('D:/TikMnG-Release-7.0.8-ready/entry-test.mp4');
    entry.save({assetId:asset.id,username:'qa_viewer',trigger:'entry',oncePerLive:false,cooldownSeconds:600});
    studio.save('qa','raconlist',{giftId:'7934'});for(let i=0;i<5;i++)studio.ingest('qa',{id:'qa'+i,type:'gift',username:'destekci'+i,nickname:'Destekçi '+i,avatar:'/widget/gift-assets/logo-v3.png',giftId:'7934',count:5-i,coins:5-i,createdAt:Date.now()});
    studio.ingestPK('qa',{battleId:'123',armies:{111:{hostscore:'150'},222:{hostscore:'275'}}});
    server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://127.0.0.1');
        if(entry.handleRequest(req,res,url))return;
        if(url.pathname==='/api/widget/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(scopedWidgetSnapshot({channel:'qa',studio:studio.state('qa')},url.searchParams.get('type'))));return;}
        if(url.pathname==='/widget-overlay.html'){const type=url.searchParams.get('type');file(res,path.join(renderer,'widgets',type==='raconlist'||type==='pk'?'live-score-widgets.html':['raconking','streambeauty','streamhandsome'].includes(type)?'royal-widgets.html':'reference-widgets.html'));return;}
        if(url.pathname==='/widget/gift-assets/logo-v3.png'){file(res,path.join(renderer,'assets/logo-v3.png'));return;}
        if(url.pathname==='/widget/gift-assets/royal-racon.png'){file(res,path.join(renderer,'widgets/royal-assets/royal-racon.png'));return;}
        if(url.pathname==='/'){
            res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(renderer,'index.html'),'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'').replace('<script src="license-entry.js"></script>',''));return;
        }
        if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(renderer,'app.js'),'utf8').replace('document.addEventListener("DOMContentLoaded", async () => {','document.addEventListener("qa-disabled-auth-init", async () => {'));return;}
        let filename=path.resolve(renderer,'.'+decodeURIComponent(url.pathname));
        if(url.pathname.startsWith('/widget/gift-assets/'))filename=path.join(renderer,'gift-assets',path.basename(url.pathname));
        if(!filename.startsWith(renderer+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);res.end();return;}file(res,filename);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:1440,height:960}});qaPage=page;page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__call',api);await page.exposeFunction('__widgets',widgetInfo);await page.exposeFunction('__gifts',()=>gifts);
    await page.exposeFunction('__saveWidget',(id,value)=>{studio.save('qa',id,value);return {basarili:true};});
    await page.addInitScript(()=>{window.__listeners={};window.mngAPI=new Proxy({workspace:(a,v)=>window.__call(a,v),workspaceListen:(name,fn)=>{window.__listeners[name]=fn;},widgetBilgisi:()=>window.__widgets(),orbitHediyeKatalogu:()=>window.__gifts(),widgetStudioKaydet:(id,value)=>window.__saveWidget(id,value),surumKontrolEt:async()=>({guncellemeVar:false}),tiktokHesaplari:async()=>({accounts:[],activeAccount:'qa'})},{get:(target,key)=>key in target?target[key]:()=>{}});});
    await page.goto(origin);await page.locator('[data-game-id="snow-war"]').waitFor();
    await page.locator('[data-open="snow-war"]').first().click();assert.equal(await page.locator('[data-play]').count(),0);await page.getByText('Güncelle · Zorunlu',{exact:true}).waitFor();
    assert.equal(await page.locator('[aria-label="WhatsApp destek"]').count(),1);await page.screenshot({path:path.join(output,'mandatory-update-support.png')});
    await page.locator('[data-workspace-view="speech"]').click();await page.locator('#speechForm').waitFor();
    await page.locator('[name="prefixEnabled"]').check();await page.locator('[name="messagePrefix"]').selectOption('/');
    await page.locator('[name="profanityFilter"]').check();await page.screenshot({path:path.join(output,'speech-prefix-filter.png')});
    await page.locator('[data-workspace-view="entryvideos"]').click();await page.locator('.entry-video-row iframe').waitFor();
    await page.locator('.entry-video-row iframe').evaluate(frame=>{window.qaOriginalFrame=frame;});
    await page.evaluate(()=>window.__listeners['entry-status']({roomVerified:true,receivers:1}));await page.waitForTimeout(400);
    assert.equal(await page.locator('.entry-video-row iframe').evaluate(frame=>window.qaOriginalFrame===frame),true,'status must not recreate decoder/frame');
    await page.locator('[data-entry-edit]').click();await page.locator('#entryVideoForm [name="cooldownMinutes"]').waitFor();assert.equal(await page.locator('[name="cooldownMinutes"]').inputValue(),'10');assert.equal(await page.locator('[name="oncePerLive"]').isDisabled(),false);
    await page.screenshot({path:path.join(output,'entry-cooldown-editor.png')});await page.locator('#entryVideoEditor [data-entry-close]').first().click();
    await page.locator('[data-workspace-view="widgets"]').click();await page.locator('[data-widget="raconlist"]').click();await page.locator('[data-ranking-row]').first().waitFor();assert.equal(await page.locator('[data-ranking-row]').count(),5);
    await page.locator('[data-ranking-remove]').first().click();assert.equal(await page.locator('[data-ranking-row]').count(),4);
    await page.locator('[data-ranking-count]').first().fill('12');await page.screenshot({path:path.join(output,'racon-ranking-editor.png')});
    await page.locator('#widgetSettingsForm [type="submit"]').click();await page.locator('#widgetSettingsModal').waitFor({state:'hidden'});assert.equal(studio.state('qa').raconRanking[0].count,12);assert.equal(studio.state('qa').raconRanking.length,4);
    for(const width of [1440,900]){await page.setViewportSize({width,height:960});await page.screenshot({path:path.join(output,'widget-gallery-'+width+'.png')});assert.equal(await page.locator('#workspaceRoot').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);}
    const overlay=await browser.newPage({viewport:{width:900,height:600}});
    for(const type of ['raconlist','pk']){const selector=type==='pk'?'.pk-team':'.rank';await overlay.goto(widgetUrl(type));await overlay.locator(selector).first().waitFor();assert.equal(await overlay.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await overlay.locator(selector).count(),type==='pk'?2:4);await overlay.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));await overlay.waitForTimeout(650);await overlay.screenshot({path:path.join(output,type+'-transparent.png'),omitBackground:true});if(type==='raconlist'){await overlay.setViewportSize({width:360,height:640});await overlay.screenshot({path:path.join(output,'raconlist-compact.png'),omitBackground:true});assert.equal(await overlay.locator('#root').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),true);await overlay.setViewportSize({width:900,height:600});}}
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({passed:true,checks:['mandatory-update/no-play','support-buttons','speech-prefix/filter-controls','entry-frame-retained-on-status','entry-ten-minute-editor','racon-edit/remove','transparent-ranking','real-PK-schema-render','1440/900-no-horizontal-overflow'],errors},null,2));
    console.log('Browser QA passed; output '+output);
}
main().catch(async error=>{console.error(error.stack);console.error(JSON.stringify({errors,notice:await qaPage?.locator('#workspaceNotice').textContent(),entryRows:entry.list().length}));await qaPage?.screenshot({path:path.join(output,'failure.png')});process.exitCode=1;}).finally(async()=>{entry.close();await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());});
