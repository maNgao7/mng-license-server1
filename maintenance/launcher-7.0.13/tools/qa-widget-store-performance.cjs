'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Store=require('electron-store');
const {performance}=require('node:perf_hooks');
const {createCachedStore}=require('../lib/cached-store.cjs');
const output='D:/TikMnG-Widget-Revision-20261026';fs.mkdirSync(output,{recursive:true});
const source=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17','mng-config.json');
const directory=fs.mkdtempSync(path.join(output,'store-benchmark-'));
fs.copyFileSync(source,path.join(directory,'mng-config.json'));
const store=new Store({cwd:directory,name:'mng-config',projectVersion:'7.0.2-preview.8',encryptionKey:'mng-electron-secret-key-2024'});
const keys=['tiktok_active_account','library_root_v1','tts_settings_v1','media_studio_v1','preview_initialized_v1'];
function run(reader){const start=performance.now();for(let i=0;i<200;i++)reader.get(keys[i%keys.length]);return performance.now()-start;}
const directMs=run(store),cached=createCachedStore(store),cachedMs=run(cached);
for(const key of keys)assert.deepEqual(cached.get(key),store.get(key));
assert.ok(cachedMs<directMs/3,'Repeated encrypted reads should avoid repeated decrypt/parse');
const result={reads:200,profileBytes:fs.statSync(source).size,directMs,cachedMs,speedup:directMs/cachedMs,scope:'Encrypted-store reads only, not a claim about total app startup'};
fs.writeFileSync(path.join(output,'store-performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
