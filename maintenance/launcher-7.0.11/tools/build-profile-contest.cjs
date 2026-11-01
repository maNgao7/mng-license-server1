'use strict';
const path=require('node:path');
const source=path.resolve(__dirname,'../../profil-yarismasi-release-0.3.0');
require('esbuild').buildSync({entryPoints:[path.join(source,'serve.cjs')],outfile:path.join(source,'host.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20',external:['sharp'],nodePaths:[path.resolve(__dirname,'../../profil-yarismasi-onizleme/node_modules')],legalComments:'none'});
console.log('Profile Contest host bundled without changing the approved test application.');
