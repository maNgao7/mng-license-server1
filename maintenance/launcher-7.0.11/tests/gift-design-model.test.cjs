'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../renderer/gift-design-model.js');
const regions=['top','top-secondary','left','left-secondary','right'];
function document(settings={}){return M.normalizeDesign({name:'Deneme',settings,items:regions.flatMap(region=>Array.from({length:3},(_,index)=>({uid:region+index,region,giftId:'5655',lines:[{text:'UZUN TÜRKÇE YAZI ŞĞİÇÖÜ'},{text:'2X ZOMBİ',textColor:'#ff426c'}]})))});}
test('six layouts and exact region sets',()=>{
  assert.equal(Object.keys(M.layouts).length,6);
  assert.deepEqual(M.activeRegions('double-top'),['top','top-secondary']);
  assert.deepEqual(M.activeRegions('double-side'),['left','left-secondary']);
});
for(const layout of Object.keys(M.layouts))test(layout+' has bounded, non-overlapping gift boxes',()=>{
  const d=document({giftSize:250,textGap:-100,fontSize:72,lineGap:20,strokeWidth:20,autoBlur:20});d.layout=layout;
  const result=M.layoutDesign(d);
  assert.equal(result.items.length,M.activeRegions(layout).length*3);
  for(const item of result.items){
    assert.ok(item.x>=0&&item.y>=0);assert.ok(item.x+item.width<=result.width+.01);assert.ok(item.y+item.height<=result.height+.01);
    assert.ok(item.image.y>=0);
    for(const line of item.lines)assert.ok(line.y>=0&&line.y+line.fontSize*1.25<=item.height);
  }
  for(let i=0;i<result.items.length;i++)for(let j=i+1;j<result.items.length;j++){
    const a=result.items[i],b=result.items[j];
    assert.ok(a.x+a.width<=b.x+.01||b.x+b.width<=a.x+.01||a.y+a.height<=b.y+.01||b.y+b.height<=a.y+.01);
  }
});
test('negative text gaps and six lines stay within the image',()=>{
  const d=document({giftSize:25,textGap:-100,fontSize:6,lineGap:-20});d.items[0].lines=Array.from({length:6},()=>({text:'A'}));
  const result=M.layoutDesign(d);for(const item of result.items){assert.ok(item.image.y>=0);for(const line of item.lines)assert.ok(line.y>=0);}
});
test('legacy migration preserves names, ids, captions and gifts without mutating input',()=>{
  const old=[{id:'legacy-1',name:'Eski',settings:{layoutType:'sides',textSize:'32',giftSize:'142'},items:[{uid:'a',region:'left',gift:{id:5655,name:'Gül',coins:1},caption:'2X ZOMBİ',captionColor:'#aabbcc'}]}];
  const before=JSON.stringify(old),[d]=M.migrateLegacyV605(old);assert.equal(JSON.stringify(old),before);
  assert.equal(d.id,'legacy-1');assert.equal(d.layout,'both-sides');assert.equal(d.items[0].giftId,'5655');assert.equal(d.settings.fontSize,32);assert.equal(d.items[0].lines[2].text,'2X ZOMBİ');assert.equal(d.items[0].lines[2].textColor,'#aabbcc');
});
test('malformed data is bounded and identity remains stable on editing',()=>{
  const d=M.normalizeDesign({id:'stable',layout:'unknown',settings:{fontSize:Infinity,grayscale:'true',textColor:'bad'},items:[{uid:'same',lines:[{text:'x'.repeat(1000)}]},{uid:'same'}]});
  assert.equal(d.id,'stable');assert.equal(d.layout,'classic');assert.equal(d.settings.fontSize,24);assert.equal(d.settings.grayscale,false);assert.equal(d.items[0].lines[0].text.length,400);assert.notEqual(d.items[0].uid,d.items[1].uid);assert.equal(M.normalizeDesign(d).id,'stable');
});
test('oversized canvases are rejected before allocation',()=>{
  const d=document();d.layout='side-only';d.items=Array.from({length:100},(_,index)=>({uid:String(index),region:'left',giftId:'5655',lines:[{text:'a'}]}));d.settings.giftSize=250;d.settings.giftGap=200;
  assert.throws(()=>M.layoutDesign(d),/çok büyük/);
});
test('safe downloadable filenames',()=>{
  assert.equal(M.filename('CON'),'TikMnG-CON.png');assert.equal(M.filename('A/B:C?'),'A-B-C-.png');assert.equal(M.filename('Türkçe isim'),'Türkçe isim.png');
});
