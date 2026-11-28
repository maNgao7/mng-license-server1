'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createWidgetPublisher}=require('../src/widget-publisher.cjs');
test('widgets use the existing HTTPS relay, keep credentials private and reject writes',async t=>{
  let transport,sessionRequests=0;
  class Relay extends EventEmitter{
    readyState=1;bufferedAmount=0;
    constructor(){super();transport=this;setImmediate(()=>this.emit('open'));}
    send(value){this.emit('outgoing',JSON.parse(value));}
    close(){this.readyState=3;}
    ping(){this.emit('pong');}
  }
  const token='q'.repeat(43);
  const publisher=await createWidgetPublisher({
    channel:'tester',store:{get:()=> 'a'.repeat(32),set(){}},
    getCredentials:async()=>({licenseCode:'test-only-license',deviceId:'test-only-device'}),
    WebSocketImpl:Relay,fetchImpl:async(url,options)=>{
      if(url==='https://mng-license-server1.onrender.com/api/overlay/session'){
        sessionRequests++;
        assert.equal(JSON.parse(options.body).licenseCode,'test-only-license');
        return Response.json({token,ticket:'test-ticket',expiresAt:Date.now()+120000,path:'/overlays/'+token,protocolVersion:1,namedWidgetPaths:true});
      }
      return fetch(url,options);
    },
  });
  t.after(()=>publisher.close());
  publisher.setSnapshot({
    audience:{active:{left:{uniqueId:'blue',nickname:'Blue'},right:{uniqueId:'red',nickname:'Red'}},
      settings:{punchGiftIdLeft:'5655',punchGiftIdRight:'5269'},queue:[{nickname:'Next',coins:51}]},
    spectator:{phase:'waiting',health:[1,.5]},standings:[{label:'Blue',wins:3}],privateCredential:'must-never-leak',
  });
  const urls=await publisher.getWidgetLinks();
  assert.deepEqual(await publisher.getWidgetLinks(),urls);
  let seq=0;
  function request(path,method='GET'){
    return new Promise((resolve,reject)=>{
      const id='request'+(++seq),chunks=[];let status;
      const timer=setTimeout(()=>{transport.off('outgoing',receive);reject(Error('Relay request timeout'));},3000);
      function receive(value){
        if(value.id!==id)return;
        if(value.type==='headers')status=value.status;
        if(value.type==='chunk')chunks.push(Buffer.from(value.data,'base64'));
        if(value.type==='end'||value.type==='error'){
          clearTimeout(timer);transport.off('outgoing',receive);
          resolve({status,body:Buffer.concat(chunks).toString()});
        }
      }
      transport.on('outgoing',receive);
      transport.emit('message',JSON.stringify({type:'request',id,path,method}));
    });
  }
  for(const [kind,value] of Object.entries(urls)){
    const url=new URL(value);
    assert.equal(url.origin,'https://mng-license-server1.onrender.com');
    assert.equal(url.pathname,'/overlays/'+token+'/widget/view/hediye-box-'+kind);
    assert.equal(url.searchParams.get('studio'),'1');
    assert.equal(url.searchParams.has('key'),false);
    const page=await request('/widget/view/hediye-box-'+kind);
    assert.equal(page.status,200);
    assert.match(page.body,new RegExp('data-kind="'+kind+'"'));
    const data=await request('/api/widget/state?type=hediye-box-'+kind);
    assert.equal(data.status,200);
    assert.equal(data.body.includes('must-never-leak'),false);
    assert.equal(data.body.includes('test-only-license'),false);
    if(kind==='fighters')assert.deepEqual(JSON.parse(data.body).rows.map(r=>[r.hp,r.gift.id]),[[100,'5655'],[50,'5269']]);
    if(kind==='queue')assert.equal(JSON.parse(data.body).rows[0].coins,51);
    if(kind==='winners')assert.equal(JSON.parse(data.body).rows[0].wins,3);
  }
  assert.equal((await request('/api/widget/state?type=hediye-box-winners','POST')).status,400);
  assert.deepEqual(await publisher.getWidgetLinks({refresh:true}),urls);
  assert.equal(sessionRequests,1,'Healthy refresh keeps the same session');
  transport.emit('close');
  assert.deepEqual(await publisher.getWidgetLinks({refresh:true}),urls);
  assert.equal(sessionRequests,2,'Refresh retries a disconnected session immediately');
});
test('an unavailable HTTPS session never returns a local address',async t=>{
  const publisher=await createWidgetPublisher({channel:'tester',store:{get(){},set(){}},getCredentials:async()=>null});
  t.after(()=>publisher.close());
  await assert.rejects(publisher.getWidgetLinks(),/lisans/);
  assert.deepEqual(Object.values(publisher.getUrls()),['','','']);
});
