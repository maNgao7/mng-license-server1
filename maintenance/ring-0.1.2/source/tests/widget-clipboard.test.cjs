'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {copyWidgetLink}=require('../src/widget-clipboard.cjs');
const links=Object.fromEntries(['fighters','queue','winners'].map(k=>[k,'https://mng-license-server1.onrender.com/overlays/'+'q'.repeat(43)+'/widget/view/hediye-box-'+k+'?studio=1']));
test('each widget button writes its current HTTPS link through the native clipboard',async()=>{
 const writes=[],clipboard={writeText:value=>writes.push(value)};
 for(const kind of Object.keys(links))assert.deepEqual(await copyWidgetLink(kind,{getLinks:async()=>links,clipboard}),{copied:true});
 assert.deepEqual(writes,Object.values(links));
});
test('invalid or stale widget links cannot write unrelated clipboard content',async()=>{
 let written=false;const clipboard={writeText:()=>{written=true;}};
 for(const invalid of ['http://localhost:8080/','https://example.com/widget','https://mng-license-server1.onrender.com/overlays/'+'q'.repeat(43)+'/widget/view/hediye-box-queue'])
  await assert.rejects(copyWidgetLink('fighters',{getLinks:async()=>({fighters:invalid}),clipboard}));
 await assert.rejects(copyWidgetLink('arbitrary',{getLinks:async()=>links,clipboard}));
 assert.equal(written,false);
});
