'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSteamInstallationCache}=require('../lib/steam-installation-cache.cjs');
test('Steam status responds immediately, coalesces probes and reports completion',async()=>{
 let resolve;const changed=new Promise(r=>resolve=r);
 const status=createSteamInstallationCache({onChange:resolve,ttl:60000});
 const started=performance.now();
 const first=status('prison-package.cjs','5466880','https://store.steampowered.com/app/5466880/');
 assert.equal(first.checking,true);assert.ok(performance.now()-started<100);
 assert.deepEqual(status('prison-package.cjs','5466880',first.storeUrl),first);
 await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Steam probe did not finish')),15000).unref())]);
 const ready=status('prison-package.cjs','5466880',first.storeUrl);
 assert.equal(ready.checking,false);assert.equal(typeof ready.installed,'boolean');
 status.invalidate();
 assert.equal(status('prison-package.cjs','5466880',first.storeUrl).checking,true,'explicit recheck bypasses cached age');
});
