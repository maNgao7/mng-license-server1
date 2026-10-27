'use strict';

// All workers settle before the caller removes staging or releases its game lock.
async function transferPool(items, work, {signal, concurrency=4}={}) {
    const stopped=new AbortController();
    const combined=signal?AbortSignal.any([signal,stopped.signal]):stopped.signal;
    let next=0,firstError;
    await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
        while(next<items.length&&!combined.aborted){
            const item=items[next++];
            try{await work(item,combined);}
            catch(error){firstError??=error;stopped.abort();}
        }
    }));
    if(firstError)throw firstError;
    if(signal?.aborted)throw Object.assign(new Error('Operation aborted'),{code:'ABORT_ERR',name:'AbortError'});
}
module.exports={transferPool};
