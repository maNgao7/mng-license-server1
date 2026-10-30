'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
test('widget sound themes render distinct audio, obey volume/mute, and keep gallery silent',{timeout:90000},async t=>{
    const output='D:/TikMnG-Widget-Preview12-20261026/audio',html=fs.readFileSync(path.resolve(__dirname,'../renderer/widgets/reference-widgets.html'));
    fs.mkdirSync(output,{recursive:true});let browser,fixtureState={activities:[],studio:{settings:{}}};
    const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://qa');res.setHeader('Content-Type',url.pathname==='/api/widget/state'?'application/json':'text/html; charset=utf-8');res.end(url.pathname==='/api/widget/state'?JSON.stringify(fixtureState):html);});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const origin=`http://127.0.0.1:${server.address().port}`;
    await page.goto(origin+'/widget-overlay.html?type=gifts&preview=1');await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.audioState),'idle','Gallery preview never starts unsolicited audio');
    await page.goto(origin+'/widget-overlay.html?type=gifts');await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    await page.evaluate(()=>clearTimeout(pollTimer));
    const capture=options=>page.evaluate(async({kind,volume=100,muted=false,midMute=false})=>{
        audio=new OfflineAudioContext(1,44100*2,44100);audioOwner=null;audioMaster=null;audioVoices=0;soundTimes.clear();
        config={...config,sound:!muted,volume};const before=soundCount;sound(kind);
        const context=audio,suspension=midMute?context.suspend(.2):null,rendering=context.startRendering();
        if(suspension){await suspension;config.sound=false;syncAudioLevel();await context.resume();}
        const rendered=await rendering,values=rendered.getChannelData(0),pcm=new Int16Array(values.length);let peak=0,sum=0,crossings=0,tail=0;
        for(let i=0;i<values.length;i++){const value=values[i];peak=Math.max(peak,Math.abs(value));sum+=value*value;if(i&&value*values[i-1]<0)crossings++;if(i>44100*.4)tail+=value*value;pcm[i]=Math.round(Math.max(-1,Math.min(1,value))*32767);}
        await new Promise(resolve=>setTimeout(resolve,0));
        const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
        return {kind,peak,rms:Math.sqrt(sum/values.length),tailRms:Math.sqrt(tail/(values.length-44100*.4)),crossings,voicesRemaining:audioVoices,played:soundCount-before,pcm:btoa(binary)};
    },options);
    const kinds=['shimmer','like','kick','goal','save','launch','marble-hit','drop','wheel-tick','wheel-start','wheel-win','follow','subscribe','share','coin','gift-arrive','gift-alert','rocket','burst'];
    const results=[];
    for(const kind of kinds){const result=await capture({kind});assert.ok(result.peak>.005&&result.peak<.98,kind+' is audible and not clipped');assert.ok(result.rms>.0005,kind+' has nontrivial audio');assert.equal(result.voicesRemaining,0,kind+' releases its audio nodes');assert.equal(result.played,1);
        const pcm=Buffer.from(result.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(44100,24);header.writeUInt32LE(88200,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);fs.writeFileSync(path.join(output,kind+'.wav'),Buffer.concat([header,pcm]));
        const {pcm:_,...metrics}=result;results.push({...metrics,sha256:crypto.createHash('sha256').update(pcm).digest('hex')});
    }
    assert.equal(new Set(results.map(row=>row.sha256)).size,kinds.length,'Every theme has different rendered audio');
    for(const kind of ['shimmer','like','goal','launch','follow','subscribe']){const muted=await capture({kind,muted:true});assert.equal(muted.peak,0);assert.equal(muted.played,0);}
    const low=await capture({kind:'follow',volume:25}),high=results.find(row=>row.kind==='follow');assert.ok(high.rms>low.rms*2.5,'Volume control changes actual output level');
    const midMute=await capture({kind:'shimmer',midMute:true});assert.ok(midMute.peak>.005);assert.ok(midMute.tailRms<.00001,'Muting suppresses already scheduled shimmer notes');
    await page.goto(origin+'/widget-overlay.html?type=wheel&preview=1');await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    const began=Date.now();await page.evaluate(()=>window.postMessage({type:'tikmng-widget-audition'},location.origin));
    await page.waitForFunction(()=>window.__widgetDiagnostics?.current?.startsWith('audition-')&&window.__widgetDiagnostics.audioState==='running');
    const auditionMs=Date.now()-began;assert.ok(auditionMs<1000,'Manual audition starts immediately, without awaiting the next poll');
    fixtureState={activities:[],studio:{settings:{},tests:{wheel:{events:[{id:'server-copy',type:'chat',username:'qa',message:'!wheel',createdAt:Date.now()}]}}}};
    await page.waitForTimeout(2000);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.queue),0,'Published test event is not duplicated in local audition queue');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,results,muted:true,volumeRatio:high.rms/low.rms,midMuteTailRms:midMute.tailRms,auditionMs,duplicatePreviewQueue:false,errors},null,2));
    t.diagnostic('19 original sound themes rendered as WAV; silence, volume, mid-effect mute and node cleanup verified. '+output);
});
