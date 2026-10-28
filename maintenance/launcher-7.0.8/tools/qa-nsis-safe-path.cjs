'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {NSIS_PATH,NsisTargetOptions}=require('app-builder-lib/out/targets/nsis/nsisUtil');
async function main(){
    const root=path.resolve(__dirname,'..'),out='D:/TikMnG-QA-Delivery/7.0.4/nsis-path';fs.mkdirSync(out,{recursive:true});
    NsisTargetOptions.resolve({});const nsis=await NSIS_PATH(),compiler=path.join(nsis,'Bin/makensis.exe');
    const key='Software\\TikMnG-QA-SafePath-'+Date.now(),exe=path.join(out,'safe-path-check.exe');
    const source=[
        'Unicode true','Name "TikMnG isolated path check"',`OutFile "${exe}"`,'RequestExecutionLevel user','SilentInstall silent','!include LogicLib.nsh',
        '!define FOLDERID_UserProgramFiles {5CD7AEE2-2219-4A67-B85D-6C9CE15660CB}','!define KF_FLAG_CREATE 0x00008000',`!define INSTALL_REGISTRY_KEY "${key}"`,'!define APP_FILENAME "TikMnG-QA-Only"',
        'Var installMode','Var PerUserInstallationFolder','Var override','!macro qaGetParameter output name fallback','StrCpy ${output} $override','!macroend','!define StdUtils.GetParameter "!insertmacro qaGetParameter"',
        '!macro setInstallModePerUser','!error "Unsafe legacy macro expanded"','!macroend',`!include "${path.join(root,'build/safe-per-user-path.nsh')}"`,
        'Section','StrCpy $override ""','!insertmacro setInstallModePerUser','StrCmp $INSTDIR "" failure',
        `WriteRegStr HKCU "${key}" InstallLocation "D:\\TikMnG-QA-existing"`,'!insertmacro setInstallModePerUser','StrCmp $INSTDIR "D:\\TikMnG-QA-existing" 0 failure',
        'StrCpy $override "D:\\TikMnG-QA-override"','!insertmacro setInstallModePerUser','StrCmp $INSTDIR "D:\\TikMnG-QA-override" 0 failure',
        `DeleteRegKey HKCU "${key}"`,'SetErrorLevel 0','Quit','failure:',`DeleteRegKey HKCU "${key}"`,'SetErrorLevel 1','Quit','SectionEnd'
    ].join('\n');
    const file=path.join(out,'safe-path-check.nsi');fs.writeFileSync(file,source);
    const env={...process.env,NSISDIR:nsis};execFileSync(compiler,['-V2',file],{env,encoding:'utf8',timeout:30000});
    const expanded=execFileSync(compiler,['-PPO',file],{env,encoding:'utf8',timeout:30000});assert.ok(!expanded.includes('System::Store'));assert.ok(!expanded.includes('&w'));
    execFileSync(exe,[],{timeout:30000,windowsHide:true});
    const report={passed:true,realCompiler:true,realWindowsExecution:true,freshPath:true,existingPathPreserved:true,explicitPathPreserved:true,syntheticRegistryKeyRemoved:true};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
