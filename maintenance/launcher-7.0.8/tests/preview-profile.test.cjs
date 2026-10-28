'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { preparePreviewProfile, initializePreviewStore } = require('../lib/preview-profile.cjs');

test('private preview copies settings once without changing stable files or sharing write roots', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-preview-'));
    const stable = path.join(root, 'mng-tiktok-game');fs.mkdirSync(stable);
    const source = path.join(stable, 'mng-config.json');fs.writeFileSync(source, 'synthetic encrypted fixture');
    const paths={appData:root,userData:stable,documents:root,videos:root};
    const app={getPath:key=>paths[key],setPath:(key,value)=>{paths[key]=value;},setName:()=>{}};
    const preview=preparePreviewProfile(app,root,['--tikmng-preview']);
    assert.equal(preview.enabled,true);assert.notEqual(paths.userData,stable);
    assert.equal(fs.readFileSync(path.join(preview.root,'mng-config.json'),'utf8'),'synthetic encrypted fixture');
    fs.writeFileSync(path.join(preview.root,'mng-config.json'),'test-only changes');
    preparePreviewProfile(app,root,['--tikmng-preview']);
    assert.equal(fs.readFileSync(source,'utf8'),'synthetic encrypted fixture');
    assert.equal(fs.readFileSync(path.join(preview.root,'mng-config.json'),'utf8'),'test-only changes');
    const values=new Map([['library_root_v1',stable],['media_studio_v1',{items:['old']}],['lisans_kod','synthetic-license']]);
    const store={get:(key,fallback)=>values.has(key)?values.get(key):fallback,set:(key,value)=>values.set(key,value),delete:key=>values.delete(key)};
    initializePreviewStore(store,preview);
    assert.notEqual(values.get('library_root_v1'),stable);
    assert.deepEqual(values.get('media_studio_v1'),{version:1,items:[]});
    assert.equal(values.get('lisans_kod'),'synthetic-license');
    values.set('library_root_v1','custom-test-root');initializePreviewStore(store,preview);
    assert.equal(values.get('library_root_v1'),'custom-test-root');
    t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
});

test('ordinary launcher does not create or modify a preview profile',()=>{
    const app={getPath:()=>{throw new Error('Stable path must not be changed');}};
    assert.deepEqual(preparePreviewProfile(app,'Z:/no-preview-marker',[]),{enabled:false});
});
