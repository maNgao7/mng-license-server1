'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const output = 'D:/TikMnG-Snake-Arena-Prototype/qa/minecraft-preview-installed';
const exe = process.env.MNG_QA_EXE || 'D:/TikMnG-Manager-Snake-0.15.0-candidate/win-unpacked/TikMnG.exe';
const username = process.env.MNG_QA_TIKTOK_USER || 'keremusers';
if (!/^[a-z0-9_.]{2,32}$/.test(username)) throw new Error('Invalid test channel');
const observeSeconds = Math.min(60, Math.max(0, Number(process.env.MNG_QA_OBSERVE_SECONDS) || 0));
const targets = [
    { id: 'battle-royale', version: '7.0.2-preview.5', config: 'mng-battle-royale.json', ready: 'MNG_BATTLE_ARENA_READY' },
    { id: 'snow-war', version: '7.0.2-preview.5', config: 'mng-snow-war.json', ready: 'MNG_SNOW_ARENA_READY' }
];
fs.mkdirSync(output, { recursive: true });
let application;

async function main() {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.MNG_TEST_PROFILE;
    application = await _electron.launch({ executablePath: exe, args: ['--tikmng-preview'], env, timeout: 60000 });
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => window.mngAPI && document.querySelector('#workspaceRoot'), null, { timeout: 60000 });
    const before = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    assert.equal(before.preview, true);
    const unchanged = before.games.filter(game => game.installed && !targets.some(target => target.id === game.id));
    const results = [];
    for (const target of targets) {
        await page.evaluate(()=>{window.qaInstallProgress=[];window.mngAPI.workspaceListen('progress',p=>window.qaInstallProgress.push(p));});
        console.log('INSTALL',target.id);
        const previous = before.games.find(game => game.id === target.id);
        const oldConfig = previous.installed ? path.join(previous.path, 'game-instance/config', target.config) : null;
        const saved = oldConfig && fs.existsSync(oldConfig) ? fs.readFileSync(oldConfig) : null;
        if (saved) fs.writeFileSync(path.join(output, target.id + '-config-before.json'), saved);
        const installStarted=Date.now();
        const installed = await page.evaluate(id => window.mngAPI.workspace('install', { id }), target.id);
        const installMs=Date.now()-installStarted,progress=await page.evaluate(()=>window.qaInstallProgress);
        assert.equal(installed.basarili, true, installed.hata || installed.error);
        const snapshot = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
        const game = snapshot.games.find(game => game.id === target.id);
        assert.equal(game.installedVersion, target.version);
        console.log('INSTALLED',target.id,game.installedVersion);
        assert.match(game.path, /^D:[\\/]/i);
        if (saved) assert.deepEqual(fs.readFileSync(path.join(game.path, 'game-instance/config', target.config)), saved, 'install must preserve exact prior config bytes');
        const launchStarted=Date.now();
        const launch = await page.evaluate(({id,username}) => window.mngAPI.uygulamaAc(id, { tiktokUser: username }), {id:target.id,username});
        const launchMs=Date.now()-launchStarted;
        assert.equal(launch.basarili, true, launch.hata);
        const logPath = path.join(game.path, 'game-instance/launch.log');
        let ready = false;
        for (let attempt = 0; attempt < 360; attempt++) {
            const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
            if (log.includes(target.ready)) { ready = true; break; }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        assert.equal(ready, true, target.id + ' native arena ready');
        console.log('ARENA_READY',target.id);
        const args=fs.readFileSync(path.join(game.path,'game-instance/launch-args.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
        const port=args.find(arg=>arg.startsWith('-Dmng.bridge.port='))?.split('=')[1];
        assert.ok(port);
        let live;
        for(let attempt=0;attempt<30;attempt++){
            live=await fetch(`http://127.0.0.1:${port}/health`).then(response=>response.json());
            if(live.clients>0&&live.username===username&&/^[a-f0-9]+$/.test(live.session))break;
            await new Promise(resolve=>setTimeout(resolve,500));
        }
        assert.ok(live.clients>0,'Java event receiver actually connected');
        assert.equal(live.username,username,'launcher-selected account reaches native Java');
        assert.match(live.session,/^[a-f0-9]+$/,'bridge keeps Java-owned session, not a second launcher UUID');
        console.log('JAVA_LIVE_RECEIVER',target.id,live.state);
        const observations=[];
        const until=Date.now()+observeSeconds*1000;
        while(Date.now()<until){
            live=await fetch(`http://127.0.0.1:${port}/health`).then(response=>response.json());
            if(!observations.length||observations.at(-1).state!==live.state||observations.at(-1).retryScheduled!==Boolean(live.nextRetryAt)){
                observations.push({elapsedSeconds:Math.round((Date.now()-(until-observeSeconds*1000))/1000),state:live.state,retryScheduled:Boolean(live.nextRetryAt)});
            }
            await new Promise(resolve=>setTimeout(resolve,1000));
        }
        const metrics=progress.findLast(p=>p.updateMode==='content');
        results.push({ id: target.id, version: game.installedVersion, path: game.path, priorConfigBytePreserved: Boolean(saved), nativeArenaReady: ready,installMs,launchMs,
            contentUpdate:metrics?{updateMode:metrics.updateMode,packageBytes:metrics.packageBytes,reusedBytes:metrics.reusedBytes,changedFiles:metrics.changedFiles,transferredBytes:metrics.totalBytes}:null,
            nativeEventReceiverConnected:true,accountReceivedByJava:true,javaSessionPreserved:true,liveState:live.state,
            liveObservation:{username,seconds:observeSeconds,states:observations,syntheticEvents:false} });
    }
    const after = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    for (const previous of unchanged) {
        const actual = after.games.find(game => game.id === previous.id);
        assert.equal(actual.path, previous.path);
        assert.equal(actual.installedVersion, previous.installedVersion);
    }
    assert.deepEqual(after.media.map(item => item.id).sort(), before.media.map(item => item.id).sort());
    assert.deepEqual(after.tts, before.tts);
    assert.deepEqual(errors, []);
    const report = { passed: true, sourceExe: exe, games: results, otherInstalledGamesPreserved: unchanged.length,
        mediaIdsPreserved: true, ttsPreserved: true, liveGiftDeliveryNotClaimed: true, errors };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => { await application?.close(); });
