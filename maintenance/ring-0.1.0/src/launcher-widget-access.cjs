'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Uses TikMnG's existing license backup contract. Credentials stay in the main
// process and are sent only to the same official overlay endpoint as the launcher.
function createLauncherWidgetAccess({documents,settingsFile}){
  return {
    getCredentials:async()=>{
      try{
        const file=path.join(documents,'MNG TikTok Game','license-backup.json');
        if(fs.statSync(file).size>65536)return null;
        const saved=JSON.parse(fs.readFileSync(file,'utf8'));
        if(typeof saved.code!=='string'||!saved.code.trim()||saved.code.length>160 ||
          typeof saved.deviceId!=='string'||!saved.deviceId.trim()||saved.deviceId.length>256)return null;
        return {licenseCode:saved.code,deviceId:saved.deviceId};
      }catch{return null;}
    },
    store:{
      get(key,fallback){
        if(key!=='overlay_installation_v1')return fallback;
        try{
          const saved=JSON.parse(fs.readFileSync(settingsFile,'utf8'));
          return saved.schemaVersion===1&&/^[a-f0-9]{32}$/.test(saved.installationId)?saved.installationId:fallback;
        }catch{return fallback;}
      },
      set(key,value){
        if(key!=='overlay_installation_v1'||!/^[a-f0-9]{32}$/.test(value))throw new Error('Geçersiz widget kurulumu.');
        fs.mkdirSync(path.dirname(settingsFile),{recursive:true});
        fs.writeFileSync(settingsFile+'.tmp',JSON.stringify({schemaVersion:1,installationId:value}));
        fs.renameSync(settingsFile+'.tmp',settingsFile);
      },
    },
  };
}
module.exports={createLauncherWidgetAccess};
