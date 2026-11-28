'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createLauncherWidgetAccess}=require('../src/launcher-widget-access.cjs');
test('existing launcher identity is read without modifying its backup or exposing unrelated fields',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'box-widget-access-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const provider=createLauncherWidgetAccess({documents:dir,settingsFile:path.join(dir,'widget-id.json')});
  assert.equal(await provider.getCredentials(),null);
  const file=path.join(dir,'MNG TikTok Game','license-backup.json');
  fs.mkdirSync(path.dirname(file));fs.writeFileSync(file,JSON.stringify({code:'qa-license',deviceId:'qa-device',activationToken:'private'}));
  const before=fs.readFileSync(file,'utf8');
  assert.deepEqual(await provider.getCredentials(),{licenseCode:'qa-license',deviceId:'qa-device'});
  assert.equal(fs.readFileSync(file,'utf8'),before);
  provider.store.set('overlay_installation_v1','a'.repeat(32));
  assert.equal(provider.store.get('overlay_installation_v1'),'a'.repeat(32));
  assert.equal(fs.readFileSync(path.join(dir,'widget-id.json'),'utf8').includes('qa-license'),false);
});
