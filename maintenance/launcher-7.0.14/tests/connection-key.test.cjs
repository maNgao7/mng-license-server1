'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../main.js'),'utf8');
const start=source.indexOf('function widgetEulerAnahtariniBul()');
const end=source.indexOf('function widgetTikTokProfiliniOku(',start);
assert.ok(start>=0&&end>start);
function fixture({environment='',files={},unreadable=[]}={}){
    const root=path.resolve('/isolated-qa/launcher');
    const resources=path.resolve('/isolated-qa/resources');
    const reads=[],paths=[path.join(root,'..','apps','tiktok-vs','euler-api-key.txt'),path.join(resources,'apps','tiktok-vs','euler-api-key.txt')];
    const result=vm.runInNewContext(source.slice(start,end)+'\nwidgetEulerAnahtariniBul()',{
        __dirname:root,path,process:{env:{EULER_API_KEY:environment},resourcesPath:resources},
        fs:{existsSync:file=>Object.hasOwn(files,paths.indexOf(file)),readFileSync:file=>{
            const index=paths.indexOf(file);reads.push(index);if(unreadable.includes(index))throw new Error('denied');return files[index];
        }}
    });
    return{result,reads};
}
test('missing signer files never become a filesystem-path API key',()=>{
    assert.equal(fixture().result,'');
    assert.equal(fixture({environment:'undefined'}).result,'');
});
test('explicit environment signer key is used literally before files',()=>{
    const f=fixture({environment:'  synthetic-owned-key  ',files:{0:'different-file-key'}});
    assert.equal(f.result,'synthetic-owned-key');assert.deepEqual(f.reads,[]);
});
test('existing signer files are read in order, not sent as filenames',()=>{
    assert.equal(fixture({files:{0:'  synthetic-first  ',1:'second'}}).result,'synthetic-first');
    assert.equal(fixture({files:{1:'synthetic-packaged'}}).result,'synthetic-packaged');
});
test('empty, placeholder and inaccessible key files cannot block valid fallback',()=>{
    for(const invalid of ['','   ','undefined'])assert.equal(fixture({files:{0:invalid,1:'synthetic-fallback'}}).result,'synthetic-fallback');
    assert.equal(fixture({files:{0:'unreadable',1:'synthetic-fallback'},unreadable:[0]}).result,'synthetic-fallback');
    assert.equal(fixture({files:{0:'unreadable'},unreadable:[0]}).result,'');
});
