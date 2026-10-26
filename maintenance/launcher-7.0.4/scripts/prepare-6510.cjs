const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const version = '6.5.10';
for (const relative of ['launcher/package.json','launcher/package-lock.json','launcher/main.js','launcher/renderer/index.html','license-server/package.json','license-server/package-lock.json','license-server/server.js','license-server/web/index.html','license-server/web/portal-v2.js','license-server/web/admin.html']) {
 const file = path.join(root, relative);
 if (fs.existsSync(file)) fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('6.5.9',version));
}
for (const name of ['stage','bundle','publish']) {
 const text = fs.readFileSync(path.join(__dirname,`${name}-659.cjs`),'utf8').replaceAll('6.5.9',version);
 fs.writeFileSync(path.join(__dirname,`${name}-6510.cjs`),text);
}
fs.mkdirSync(path.join(root,'release-v6.5.10'),{recursive:true});
console.log('6.5.10 release paths prepared');
