'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { assertSafePath, safeRelativePath } = require('./download.cjs');

function launchNativeGame({ session, directory, executable, spawnProcess = spawn }) {
    safeRelativePath(executable);
    const file = assertSafePath(path.join(directory, executable));
    return new Promise((resolve, reject) => {
        const child = spawnProcess(file, [], {
            cwd: directory, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe']
        });
        child.once('spawn', () => resolve(child));
        child.once('error', reject);
        session.ownChild(child, { normalExit: true });
    });
}

function findVoiceDrivingGame({exists=fs.existsSync,env=process.env,requireMod=true}={}){
    const libraries=[path.join(env['ProgramFiles(x86)']||'C:/Program Files (x86)','Steam')];
    for(let code=67;code<=90;code++)libraries.push(String.fromCharCode(code)+':/SteamLibrary');
    for(const root of libraries)for(const name of ['CAAAHR! Demo','CAAAHR!','CAAAHR']){
        const directory=path.join(root,'steamapps/common',name);
        if(exists(path.join(directory,'CAAAHR.exe'))&&(!requireMod||exists(path.join(directory,'BepInEx/plugins/TikMnG.Caaahr.Voice.dll'))))return directory;
    }
    return null;
}
function voiceDrivingVersion(directory){
    try{return /TikMnG Sesli Surus (\d+\.\d+\.\d+) loaded/.exec(fs.readFileSync(path.join(directory,'BepInEx/config/TikMnG-Diagnostics/loaded.txt'),'utf8'))?.[1]||null;}catch{return null;}
}
module.exports = { launchNativeGame, findVoiceDrivingGame, voiceDrivingVersion };
