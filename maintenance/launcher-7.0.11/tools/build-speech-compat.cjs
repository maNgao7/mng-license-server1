'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild'),root=path.resolve(__dirname,'..'),deps=path.resolve(root,'../speech-compat-build/node_modules');
esbuild.buildSync({entryPoints:[path.join(__dirname,'speech-inference-entry.cjs')],outfile:path.join(root,'lib/vendor/speech-inference-worker.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20',nodePaths:[deps],external:['onnxruntime-node'],logLevel:'warning'});
const folder=path.join(root,'lib/vendor/onnx-wasm');fs.mkdirSync(folder,{recursive:true});
for(const file of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])fs.copyFileSync(path.join(deps,'onnxruntime-web/dist',file),path.join(folder,file));
console.log('Bundled portable ONNX WASM speech runtime.');
