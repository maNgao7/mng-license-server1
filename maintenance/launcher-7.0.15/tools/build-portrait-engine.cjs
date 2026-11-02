'use strict';
const path=require('node:path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../lib/portrait-engine/index.mjs')],outfile:path.join(__dirname,'../lib/portrait-engine.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20',external:['sharp'],nodePaths:[path.resolve(__dirname,'../../profil-yarismasi-onizleme/node_modules')],legalComments:'none'});
console.log('Shared original-photo engine built.');
