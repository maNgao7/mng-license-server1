'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {assertSafePath,assertSafeTree}=require('../lib/download.cjs');
const source='D:/TikMnG-Update-QA-20261030/preview-build/win-unpacked/resources';
const target='D:/TikMnG-Manager-7.0.0/win-unpacked/resources';
const hash=f=>fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null;
async function main(){
    const processes=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process -Filter \"Name='TikMnG.exe'\" | Where-Object { $_.ExecutablePath -eq 'D:\\TikMnG-Manager-7.0.0\\win-unpacked\\TikMnG.exe' }).Count"],{encoding:'utf8',windowsHide:true}).trim();
    assert.equal(processes,'0','Existing manager is open; close it before replacing resources');
    assertSafePath(target);assertSafePath(source);
    assert.ok(fs.existsSync(path.join(target,'tikmng-preview.json')),'Only the existing private manager may be updated');
    const profiles=['mng-tiktok-game','TikMnG-Test-6.5.17'].map(name=>path.join(process.env.APPDATA,name,'mng-config.json'));
    const before=profiles.map(hash),backup=fs.mkdtempSync('D:/TikMnG-Update-QA-20261030/manager-backup-');
    const old=path.join(target,'app.asar'),from=path.join(source,'app.asar');
    fs.copyFileSync(old,path.join(backup,'app.asar'));assert.equal(hash(old),hash(path.join(backup,'app.asar')));
    fs.copyFileSync(path.join(target,'tikmng-preview.json'),path.join(backup,'tikmng-preview.json'));
    const natives=path.join(target,'app.asar.unpacked');
    if(fs.existsSync(natives)){await assertSafeTree(natives);fs.cpSync(natives,path.join(backup,'app.asar.unpacked'),{recursive:true});}
    await assertSafeTree(path.join(source,'app.asar.unpacked'));
    fs.cpSync(path.join(source,'app.asar.unpacked'),natives,{recursive:true});
    const temporary=path.join(target,'app.asar.update-'+crypto.randomUUID());
    fs.copyFileSync(from,temporary);assert.equal(hash(from),hash(temporary));fs.renameSync(temporary,old);
    assert.equal(hash(old),hash(from));assert.deepEqual(profiles.map(hash),before);
    const result={updated:true,publicReleaseChanged:false,manager:'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe',
        version:'7.0.9-preview.20261030',backup,settingsAndLicensesUnchangedDuringUpdate:true,sha256:hash(old)};
    fs.writeFileSync(path.resolve(__dirname,'../qa/20261030/existing-manager-update.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
