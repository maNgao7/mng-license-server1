'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const code=source.slice(source.indexOf('function clearNativeInputHistory('),source.indexOf('function resetMatch('));
const clear=vm.runInNewContext(code+'\nclearNativeInputHistory',{});
test('a new bout clears both press and release durations and retains native allocations and seeds',()=>{
 const maps=new Map([0x2a00,0x2a40,0x2a98,0x2ad8].map((offset,i)=>{
  const mask=[0,3,15,31][i],storage=Buffer.alloc(mask+19,12);
  storage[0]=93;storage[storage.length-1]=94;
  return[offset,{mask,count:3,growth:0,storage,control:storage.subarray(1,-1),seed:12345,pointer:{}}];
 }));
 const base={add(offset){const map=maps.get(offset);assert.ok(map);return{
   readPointer(){assert.ok(map.mask>0);return{writeByteArray:bytes=>{assert.equal(bytes.length,map.mask+17);Buffer.from(bytes).copy(map.control);}};},
   add(field){return{readU64:()=>({toNumber:()=>{assert.equal(field,8);return map.mask;}}),
     writeU64:value=>{if(field===24)map.count=value;else{assert.equal(field,16);map.growth=value;}}};},
 };}};
 const pointers=[...maps.values()].map(map=>map.pointer);
 clear(base);
 for(const [i,map] of [...maps.values()].entries()){
  assert.equal(map.count,0);assert.equal(map.growth,[0,3,14,28][i]);
  assert.equal(map.seed,12345);assert.equal(map.pointer,pointers[i]);
  assert.equal(map.storage[0],93);assert.equal(map.storage[map.storage.length-1],94);
  if(map.mask)assert.ok(map.control.every(byte=>byte===255));
 }
});
test('an unsupported input table fails before writing through its pointer',()=>{
 const base={add(){return{add(){return{readU64:()=>({toNumber:()=>12})};},readPointer(){assert.fail('Invalid mask must not be dereferenced');}};}};
 assert.throws(()=>clear(base),/komut geçmişi/);
});
