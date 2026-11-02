'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {updatePK}=require('../lib/pk-state.cjs');
const output=path.resolve(__dirname,'../qa/20261030');
let server,browser;
const raw={battleId:'777',teamArmies:[{teamId:'11',teamTotalScore:'999',teamUser:[{userId:'111',score:'10'},{userId:'222',score:'20'}]},
    {teamId:'22',teamTotalScore:'888',teamUser:[{userId:'333',score:'30'},{userId:'444',score:'40'}]}]};
const state=updatePK(null,raw);
for(const [i,p] of state.players.entries())Object.assign(p,{nickname:i===0?'Uzun Kullanici Adi Denemesi':'Test Yayinci '+(i+1),avatar:'/widget/gift-assets/logo-v3.png'});
let data={studio:{pk:state,settings:{pk:{layout:'teams'}}}};
async function main(){
    server=http.createServer((req,res)=>{
        if(req.url.startsWith('/api/widget/state')){res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}
        const logo=req.url.startsWith('/widget/gift-assets/logo-v3.png');
        res.setHeader('content-type',logo?'image/png':'text/html; charset=utf-8');
        fs.createReadStream(path.resolve(__dirname,logo?'../renderer/assets/logo-v3.png':'../renderer/widgets/live-score-widgets.html')).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:900,height:520}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?type=pk');
    await page.locator('.pk-team').first().waitFor();assert.equal(await page.locator('.team-member').count(),4);
    assert.deepEqual(await page.locator('.pk-total').allTextContents(),['999','888']);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    await page.locator('.team-member .avatar').first().evaluate(n=>{window.qaAvatar=n;});
    data.studio.pk.teams[0].score=1001;await page.evaluate(data=>paint(data),data);
    assert.equal(await page.locator('.team-member .avatar').first().evaluate(n=>window.qaAvatar===n),true,'score updates must not recreate profile images');
    await page.screenshot({path:path.join(output,'pk-teams-900.png'),omitBackground:true});
    data.studio.settings.pk.swapSides=true;await page.evaluate(data=>paint(data),data);
    assert.deepEqual(await page.locator('.pk-total').allTextContents(),['888','1.001']);
    data.studio.settings.pk.swapSides=false;data.studio.pk.teams[0].score=9007199254740991;
    await page.setViewportSize({width:360,height:640});await page.evaluate(data=>paint(data),data);
    const fit=await page.evaluate(()=>[...document.querySelectorAll('.pk-team,.pk-total,.team-member')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth+1;}));
    assert.equal(fit,true);await page.screenshot({path:path.join(output,'pk-teams-360.png'),omitBackground:true});
    assert.equal(await page.locator('.team-members').evaluateAll(nodes=>Math.abs(nodes[0].getBoundingClientRect().top-nodes[1].getBoundingClientRect().top)<1),true,'large scores must not move the profile rows');
    data.studio.settings.pk.layout='players';await page.evaluate(data=>paint(data),data);assert.equal(await page.locator('.rank').count(),4);
    data.studio.settings.pk.layout='teams';data.studio.pk.teams=[];await page.evaluate(data=>paint(data),data);
    assert.equal(await page.locator('.pk-team').count(),0);assert.match(await page.locator('.waiting').textContent(),/takım bilgisi/);
    const report=JSON.parse(fs.readFileSync(path.join(output,'live-pk-teams-report.json'))),live=[];
    for(const r of report.reports){let s;let checked=0;for(const sample of r.samples.filter(x=>x.event==='linkMicArmies')){
        s=updatePK(s,sample.data,sample.at);if(s.players.length===2){assert.equal(s.teams.length,2);for(const t of s.teams)assert.equal(t.score,s.players.find(p=>p.id===t.memberIds[0]).score);checked++;}
    }live.push({host:r.host,scorePacketsChecked:checked,players:s?.players.length||0,sourceTeamGroups:r.samples.some(x=>x.data.teamArmies?.length)});}
    assert.deepEqual(errors,[]);
    const observed=JSON.parse(fs.readFileSync(path.join(output,'live-pk-teams-followup.json')));
    const known=new Map(observed.reports.filter(r=>r.owner?.id).map(r=>[r.owner.id,r.owner]));let actual;
    for(const sample of observed.reports[0].samples.filter(s=>s.event==='linkMicArmies'))actual=updatePK(actual,sample.data,sample.at);
    assert.equal(actual.players.length,2);
    for(const p of actual.players)Object.assign(p,known.get(p.id)||{});
    data={studio:{pk:actual,settings:{pk:{layout:'teams'}}}};
    await page.setViewportSize({width:900,height:520});await page.evaluate(data=>paint(data),data);
    await page.waitForTimeout(600);
    await page.screenshot({path:path.join(output,'pk-observed-duel.png'),omitBackground:true});
    const result={passed:true,officialTeamTotals:true,twoTeamsFourMembers:true,swapSides:true,individualModePreserved:true,noGuessedTeams:true,transparent:true,smallAndDesktopFit:true,liveReplay:live,observedHostNames:actual.players.map(p=>p.username),real2v2Observed:live.some(r=>r.sourceTeamGroups),errors};
    fs.writeFileSync(path.join(output,'pk-teams-ui-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
