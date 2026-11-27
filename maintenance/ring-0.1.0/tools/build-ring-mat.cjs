'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('D:/TikMnG-GitHub-Araclari/runtime/npm-tools/node_modules/sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  const output=path.join(root,'assets/ring-mat.png');
  await sharp(path.join(root,'assets/ring-mat.svg')).png().toFile(output);
  const privateRoot=path.resolve('D:/TikMnG/Hediye-Box-Private');
  const target=path.join(privateRoot,'native-game/assets/images/c64.png');
  if(!target.startsWith(privateRoot+path.sep))throw new Error('Unexpected private asset destination');
  const backup=path.join(privateRoot,'original-assets/c64.png');
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(!fs.existsSync(backup))fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(output,target);
  console.log('TikMnG ring mat prepared in the isolated game copy.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
