const test=require('node:test'),assert=require('node:assert/strict');
const {transferPool}=require('../lib/transfer-pool.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('content transfers are concurrent but bounded, and each runs once',async()=>{
    let active=0,peak=0;const seen=[];
    await transferPool(Array.from({length:17},(_,i)=>i),async i=>{active++;peak=Math.max(peak,active);await sleep(10);seen.push(i);active--;});
    assert.equal(peak,4);assert.equal(active,0);assert.equal(new Set(seen).size,17);
});
test('first failure aborts peers and settles them before returning',async()=>{
    let active=0;const seen=[];
    await assert.rejects(transferPool([0,1,2,3,4,5],async(i,signal)=>{
        active++;seen.push(i);
        try{if(i===0){await sleep(5);throw Error('hash mismatch');}await sleep(25);assert.equal(signal.aborted,true);}
        finally{active--;}
    }),/hash mismatch/);
    assert.equal(active,0);assert.equal(seen.length,4);
});
test('aborted caller cannot start another transfer',async()=>{
    const c=new AbortController();c.abort();let runs=0;
    await assert.rejects(transferPool([1,2],async()=>runs++,{signal:c.signal}),{code:'ABORT_ERR'});
    assert.equal(runs,0);
});
