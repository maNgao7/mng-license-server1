'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assertSafePath } = require('./download.cjs');
const crypto=require('node:crypto');
const {manifestFiles,CONTENT_PATH,MAX_MANIFEST_BYTES}=require('./game-content.cjs');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');

// Only a trusted preview manifest can nominate a local archive. IPC cannot set paths.
function createPreviewPackages({ enabled, games = [], port, accessKey } = {}) {
    const packages = new Map();
    if (enabled && accessKey && Number.isInteger(port) && port > 0) for (const game of games) {
        const item = game.package;
        if (!game.adminOnly || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) ||
            !item || typeof item.localArchive !== 'string' || !path.isAbsolute(item.localArchive) ||
            !/^[a-f0-9]{64}$/i.test(item.sha256 || '') || !Number.isSafeInteger(item.bytes) || item.bytes < 1) continue;
        try {
            const file = assertSafePath(item.localArchive), stat = fs.statSync(file);
            if (!stat.isFile() || stat.size !== item.bytes)continue;
            const entry={ ...item,file,version:game.version,url:`http://127.0.0.1:${port}/tikmng/admin-package/${game.id}.zip?key=${encodeURIComponent(accessKey)}` };
            if(item.localContentManifest!==undefined){
                if(!path.isAbsolute(item.localRoot||'')||!path.isAbsolute(item.localContentManifest)||!/^[a-f0-9]{64}$/.test(item.contentSha256||''))continue;
                const data=fs.readFileSync(assertSafePath(item.localContentManifest));
                if(data.length>MAX_MANIFEST_BYTES||digest(data)!==item.contentSha256)continue;
                const index=JSON.parse(data);
                const packageId=item.packageId||game.id;
                if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageId)||index.schemaVersion!==1||index.type!=='tikmng-game-content'||index.package!==packageId||index.version!==game.version)continue;
                const root=assertSafePath(item.localRoot),prefix=`http://127.0.0.1:${port}/tikmng/admin-package/${game.id}`;
                entry.contentFiles=new Map();
                const files=manifestFiles(index.files).map(f=>{
                    // Index trusted names without statting every ancestor of every
                    // game file at boot. Each requested file is reparse-checked below.
                    const local=path.resolve(root,f.path);
                    const relative=path.relative(root,local);
                    if(relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Package escape');
                    entry.contentFiles.set(f.sha256,{...f,file:local});
                    return {...f,url:`${prefix}/file/${f.sha256}?key=${encodeURIComponent(accessKey)}`};
                });
                entry.content=Buffer.from(JSON.stringify({...index,files}));
                if(entry.content.length>MAX_MANIFEST_BYTES)continue;
                entry.files=[{path:CONTENT_PATH,bytes:entry.content.length,sha256:digest(entry.content),url:`${prefix}/manifest?key=${encodeURIComponent(accessKey)}`}];
            }
            packages.set(game.id,entry);
        } catch {}
    }
    function descriptor(id) { const item = packages.get(id); return item ? { version: item.version, url: item.url, bytes: item.bytes, sha256: item.sha256,...(item.files?{files:item.files}:{}) } : null; }
    function handleRequest(req, res, url) {
        if (!url.pathname.startsWith('/tikmng/admin-package/')) return false;
        const match = /^\/tikmng\/admin-package\/([a-z0-9]+(?:-[a-z0-9]+)*)\.zip$/.exec(url.pathname);
        const contentMatch=/^\/tikmng\/admin-package\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(manifest|file\/([a-f0-9]{64}))$/.exec(url.pathname);
        const item = packages.get(match?.[1]||contentMatch?.[1]);
        const remote = req.socket.remoteAddress;
        const finish = status => { res.writeHead(status, { 'Cache-Control': 'no-store' }); res.end(); return true; };
        if (!enabled || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote) || url.searchParams.get('key') !== accessKey) return finish(403);
        if (!['GET','HEAD'].includes(req.method)) return finish(405);
        if (!item) return finish(404);
        try {
            if(contentMatch?.[2]==='manifest'){
                if(!item.content)return finish(404);
                res.writeHead(200,{'Content-Type':'application/json','Content-Length':item.content.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
                res.end(req.method==='HEAD'?undefined:item.content);return true;
            }
            const source=contentMatch?item.contentFiles?.get(contentMatch[3]):item;
            if(!source)return finish(404);
            const stat = fs.statSync(assertSafePath(source.file));
            if (!stat.isFile() || stat.size !== source.bytes) return finish(409);
            let start = 0, end = stat.size - 1;
            if (req.headers.range) {
                const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
                if (!range) return finish(416);
                start = Number(range[1]); end = range[2] ? Math.min(end, Number(range[2])) : end;
                if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) return finish(416);
            }
            const headers = { 'Content-Type':contentMatch?'application/octet-stream':'application/zip', 'Content-Length':end-start+1,
                'Accept-Ranges':'bytes', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
            if (req.headers.range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
            res.writeHead(req.headers.range ? 206 : 200, headers);
            if (req.method === 'HEAD') { res.end(); return true; }
            if(stat.size===0){res.end();return true;}
            const stream = fs.createReadStream(source.file, { start, end });
            stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
            return true;
        } catch { return finish(404); }
    }
    return { descriptor, handleRequest };
}
module.exports = { createPreviewPackages };
