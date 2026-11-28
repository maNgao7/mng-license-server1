'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const workspace = path.resolve(__dirname, '../../..');
const launcher = path.join(workspace, 'work/ring-steam-hotfix-7039/launcher');
const {createGameLibrary} = require(path.join(launcher, 'lib/game-library.cjs'));
const {validatePackageDirectory} = require(path.join(launcher, 'lib/ring-package.cjs'));
const stage = path.join(workspace, 'work/ring-hotfix-012');
const archive = path.join(stage, 'release/Ring-Windows-x64.zip');
const previousArchive = path.join(workspace, 'work/ring-hotfix-011/release/Ring-Windows-x64.zip');
const meta = require(path.join(stage, 'release/ring-manifest.json'));
const qa = path.join(stage, 'qa');
const root = path.join(qa, 'launcher-install-' + Date.now());
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function put(root, name, text) {
    const file = path.join(root, name);
    await fsp.mkdir(path.dirname(file), {recursive:true});
    await fsp.writeFile(file, text);
}
async function main() {
    await fsp.mkdir(qa, {recursive:true});
    const legacy = path.join(root, 'legacy-ring'), other = path.join(root, 'other-game');
    for (const [name,text] of Object.entries({
        'Ring.exe':'legacy fixture', 'resources/app/package.json':'{"main":"main.cjs","version":"0.1.0"}',
        'resources/app/main.cjs':'legacy fixture', 'bridge/runtime/owner-helper.cjs':'legacy fixture',
        'bridge/runtime/gift-assets/katalog_tam.json':'[]', '.tikmng-package.json':'{"game":"ring","version":"0.1.0"}',
        'settings.json':'{"volume":0.37,"preserve":"exact user settings"}', 'saves/wins.json':'{"winner":17}'
    })) await put(legacy,name,text);
    await put(other,'run.txt','other game bytes remain identical');
    await put(other,'settings.json','other game settings');
    const otherHash = digest(path.join(other,'run.txt')), settings = fs.readFileSync(path.join(legacy,'settings.json'));
    let requests = 0;
    const server = http.createServer((req,res) => {
        requests++;
        const file = req.url === '/old.zip' ? previousArchive : req.url === '/new.zip' ? archive : null;
        if (!file) return res.writeHead(404).end();
        res.writeHead(200, {'Content-Length':fs.statSync(file).size});
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    let pkg = {version:'0.1.1', url:origin+'/old.zip', bytes:fs.statSync(previousArchive).size, sha256:digest(previousArchive)};
    const make = (name, legacyPaths) => createGameLibrary({
        root:path.join(root,name), definitions:{ring:{id:'ring'},other:{id:'other'}},
        validate:(dir,id) => id === 'ring' ? validatePackageDirectory(dir) : fs.existsSync(path.join(dir,'run.txt')),
        resolveLegacy:id => legacyPaths ? {path:id === 'ring' ? legacy : other,version:'0.1.0'} : null,
        getPackage:id => id === 'ring' ? pkg : {version:'0.1.0',url:origin+'/other.zip'}
    });
    try {
        const library = make('existing-library',true);
        const otherState = library.state('other');
        await assert.rejects(library.install('ring'), {code:'EPACKAGE',message:'Archive version disagrees with package version'});
        assert.equal(library.pathFor('ring'),legacy);
        assert.deepEqual(fs.readFileSync(path.join(legacy,'settings.json')),settings);
        pkg = {...meta, url:origin+'/new.zip'};
        const updated = await library.install('ring');
        assert.equal(updated.installedVersion,'0.1.2');
        assert.equal(validatePackageDirectory(updated.path),true);
        assert.deepEqual(fs.readFileSync(path.join(updated.path,'settings.json')),settings);
        assert.equal(fs.readFileSync(path.join(updated.path,'saves/wins.json'),'utf8'),'{"winner":17}');
        assert.deepEqual(library.state('other'),otherState);
        assert.equal(digest(path.join(other,'run.txt')),otherHash);
        const before = requests;
        await library.install('ring');
        assert.equal(requests,before,'Already installed package must not download again');
        const fresh = await make('fresh-library',false).install('ring');
        assert.equal(fresh.installedVersion,'0.1.2');
        assert.equal(validatePackageDirectory(fresh.path),true);
        const report = {passed:true,launcher:'7.0.39',oldArchiveRejected:true,existingInstallUpdated:true,
            freshInstallPassed:true,userSettingsAndSavesPreserved:true,otherGameUnchanged:true,
            repeatInstallDidNotDownload:true,installedPath:fresh.path,sha256:meta.sha256,bytes:meta.bytes};
        await fsp.writeFile(path.join(qa,'launcher-install-result.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => {console.error(error);process.exitCode=1;});
