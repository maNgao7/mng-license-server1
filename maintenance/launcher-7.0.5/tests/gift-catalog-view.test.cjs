'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {group}=require('../renderer/gift-catalog-view.js');
const gifts=require('../renderer/gift-assets/katalog_tam.json');
const groups=require('../renderer/gift-assets/visual-groups.json').groups;
const byId=new Map(groups.flatMap(g=>g.ids.map(id=>[id,g.id])));
const catalog=gifts.map(g=>({...g,visualGroup:byId.get(g.id)}));
test('905 exact gift IDs produce 865 image cards, with no lost or conflated variant',()=>{
    const cards=group(catalog);
    assert.equal(cards.length,865);assert.equal(new Set(cards.map(g=>g.visualGroup)).size,865);
    assert.deepEqual(cards.flatMap(g=>g.variants.map(v=>v.id)).sort(),gifts.map(g=>g.id).sort());
    for(const gift of gifts){const result=group(catalog,gift.id).find(c=>c.variants.some(v=>v.id===gift.id));assert.ok(result);assert.ok(result.variants.some(v=>v.id===gift.id&&v.coins===gift.coins));}
});
test('identical artwork at different prices stays as separate selectable exact-code variants',()=>{
    const card=group(catalog).find(g=>g.variants.some(v=>v.id==='17962'));
    assert.deepEqual(card.variants.map(v=>[v.id,v.coins]),[['17962',200],['17957',4918]]);
    assert.equal(group(catalog,'17957')[0].id,'17957');
});
