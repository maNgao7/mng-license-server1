import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pathToFileURL} from 'node:url';
const project='C:/Users/User/Desktop/MNG-TikTok-Game/apps';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await pause(2);}assert.fail('retry did not settle');}
for(const game of ['battle-royale','snow-war']){
    const {LiveSession}=await import(pathToFileURL(`${project}/${game}/prototype/live-bridge/live-session.js`));
    function harness(t,fail=0){
        const connections=[],events=[];
        const factory=username=>{const c=new EventEmitter();c.username=username;c.connect=()=>connections.length<=fail?Promise.reject(new Error('Failed to retrieve Room ID')):Promise.resolve();c.disconnect=()=>{c.stopped=true;};connections.push(c);return c;};
        const options={autoReconnect:true,retryDelays:[5,10,15]};
        const args=[factory,[['gift','gift'],['follow','follow']],event=>events.push(event),100];
        if(game==='battle-royale')args.push({resolve:async()=>''});args.push(options);
        const session=new LiveSession(...args);t.after(()=>session.disconnect());return {session,connections,events};
    }
    test(game+': failed initial Room ID lookup retries and keeps the native session identity',async t=>{
        const h=harness(t,1);await h.session.connect('streamer','native-session');
        assert.equal(h.session.state,'waiting');assert.ok(h.session.nextRetryAt>Date.now());
        await until(()=>h.session.state==='connected');
        assert.equal(h.connections.length,2);assert.equal(h.session.session,'native-session');assert.equal(h.session.nextRetryAt,0);
    });
    test(game+': a disconnect retries once and never repeats a delivered gift',async t=>{
        const h=harness(t);await h.session.connect('streamer','native-session');
        const gift={gift:{id:5655,diamondCount:1},common:{msgId:'gift-one'},user:{uniqueId:'viewer'}};
        h.connections[0].emit('gift',gift);h.connections[0].emit('disconnected');h.connections[0].emit('error',new Error('late duplicate error'));
        await until(()=>h.connections.length===2&&h.session.state==='connected');
        h.connections[1].emit('gift',gift);h.connections[1].emit('gift',{...gift,common:{msgId:'gift-two'}});
        assert.equal(h.events.filter(e=>e.type==='gift').length,2);
        assert.equal(h.events.filter(e=>e.state==='waiting').length,1);
    });
    test(game+': manual disconnect cancels retry without a late connection',async t=>{
        const h=harness(t,10);await h.session.connect('streamer','native-session');h.session.disconnect();
        await pause(30);assert.equal(h.connections.length,1);assert.equal(h.session.state,'disconnected');assert.equal(h.session.retryTimer,undefined);
    });
    test(game+': switching account cancels the old scheduled reconnect',async t=>{
        const h=harness(t,1);await h.session.connect('old','old-session');await h.session.connect('new','new-session');
        await pause(30);assert.equal(h.connections.length,2);assert.equal(h.session.username,'new');assert.equal(h.session.session,'new-session');
        h.connections[0].emit('follow',{uniqueId:'old-viewer'});assert.equal(h.events.filter(e=>e.type==='follow').length,0);
    });
    test(game+': repeated failures back off and stop cleanly',async t=>{
        const h=harness(t,100);await h.session.connect('streamer','native-session');
        await until(()=>h.connections.length>=3);assert.ok(h.session.retryAttempts>=2);h.session.disconnect();
        const calls=h.connections.length;await pause(35);assert.equal(h.connections.length,calls);
    });
}
