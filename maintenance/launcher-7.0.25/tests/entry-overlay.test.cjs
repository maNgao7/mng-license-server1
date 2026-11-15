'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const key='qa-entry-key',channel='alice';
function event(title='intro'){
    const id=crypto.randomUUID();
    return {type:'studio:play',id:crypto.randomUUID(),channel,test:false,item:{id,title,kind:'video',channel,gameId:'entry-videos',startSeconds:0,endSeconds:null,volume:.8,fade:false,interrupt:false,playLimit:0,combineGifts:false,displaySeconds:5,mediaUrl:'/tikmng/media/file/'+id+'?key='+key+'&channel='+channel}};
}
function harness({events=[],hidden=false,play=()=>new Promise(()=>{})}={}){
    const timers=new Map(),polls=[],elements=[],listeners=new Map();let now=0,id=0;
    const stage={replaceChildren(element){this.child=element;}},cursor=crypto.randomUUID();
    class Element{
        constructor(){this.handlers=new Map();this.currentTime=0;this.duration=30;this.videoWidth=640;this.classList={add(){},remove(){}};elements.push(this);}
        setAttribute(){} removeAttribute(){} load(){} pause(){} remove(){this.removed=true;}
        addEventListener(name,fn){this.handlers.set(name,fn);} removeEventListener(name){this.handlers.delete(name);}
        dispatch(name){this.handlers.get(name)?.();} play(){return play();}
        requestVideoFrameCallback(fn){this.frame=fn;}
    }
    const document={hidden,getElementById:()=>stage,createElement:()=>new Element(),addEventListener:(name,fn)=>listeners.set(name,fn),body:{dataset:{channel,item:'',game:'entry-videos'},classList:{add(){}}}};
    const context={document,window:{addEventListener(){}},location:{origin:'http://127.0.0.1:1234',pathname:'/tikmng/media',search:'?key='+key+'&channel='+channel+'&game=entry-videos'},crypto,URL,URLSearchParams,AbortController,queueMicrotask,
        Date:class extends Date{static now(){return now;}},setTimeout(fn,ms){const value=++id;timers.set(value,{fn,at:now+ms});return value;},clearTimeout(value){timers.delete(value);},
        fetch:async url=>{polls.push(new URL(url));return {ok:true,json:async()=>({cursor,events})};}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/studio/overlay.js'),'utf8'),context);
    const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
    async function advance(ms){await settle();const until=now+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();await settle();}now=until;}
    return {elements,polls,document,settle,advance};
}
test('entry source polls while hidden and acknowledges only after a presented frame',async()=>{
    const intro=event(),h=harness({events:[intro],hidden:true});await h.settle();assert.equal(h.elements.length,1);
    const video=h.elements[0];video.dispatch('loadedmetadata');video.dispatch('playing');await h.advance(800);
    assert.ok(h.polls.length>1);assert.equal(h.polls.some(url=>url.searchParams.has('ack')),false);
    video.frame();await h.advance(800);
    const ack=h.polls.find(url=>url.searchParams.get('ack')===intro.id);assert.equal(ack.searchParams.get('playback'),'started');assert.equal(h.elements.length,1);
});
test('unresolved play promise retains startup watchdog and advances the next queued video',async()=>{
    const a=event('first'),b=event('second'),h=harness({events:[a,b]});await h.settle();
    h.elements[0].dispatch('loadedmetadata');await h.advance(16000);
    assert.equal(h.elements[0].removed,true);assert.ok(h.elements.length>=2);assert.equal(h.polls.some(url=>url.searchParams.get('ack')===a.id&&url.searchParams.get('failure')==='timeout'),true);
});
test('rejected audible autoplay is reported, not marked played or retried forever',async()=>{
    const intro=event(),h=harness({events:[intro],play:()=>Promise.reject(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}))});await h.settle();h.elements[0].dispatch('loadedmetadata');await h.advance(800);
    const ack=h.polls.find(url=>url.searchParams.get('ack')===intro.id);assert.equal(ack.searchParams.get('playback'),'failed');assert.equal(ack.searchParams.get('failure'),'blocked');
    await h.advance(20000);assert.equal(h.elements.length,1);
});
test('transient loading failures have bounded retries and do not consume a playback receipt',async()=>{
    const intro=event(),h=harness({events:[intro]});await h.settle();
    for(let i=0;i<3;i++){const video=h.elements.at(-1);video.error={code:2};video.dispatch('error');await h.advance(4000);}
    await h.advance(20000);assert.equal(h.elements.length,3);assert.equal(h.polls.some(url=>url.searchParams.get('playback')==='started'),false);
});
