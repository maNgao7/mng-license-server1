'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../license-server/web');
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/hediye-tasarimi/'){res.writeHead(308,{Location:'/hediye-tasarimi'});res.end();return;}
    const relative=url.pathname==='/hediye-tasarimi'?'/gift-designer.html':url.pathname==='/'?'/index.html':url.pathname;
    const file=path.resolve(root,'.'+decodeURIComponent(relative));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(400);res.end();}
});
server.listen(Number(process.env.PORT)||4198,'127.0.0.1',()=>console.log(`Local designer preview: http://127.0.0.1:${server.address().port}/hediye-tasarimi`));
server.on('error',error=>{console.error(error.code);process.exitCode=1;});
