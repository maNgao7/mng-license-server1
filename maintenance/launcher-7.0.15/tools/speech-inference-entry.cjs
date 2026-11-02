'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
{
 const runtime=require('onnxruntime-web/wasm');
 const physical=__dirname.replace(/\.asar([\\/])/g,'.asar.unpacked$1'),folder=path.join(physical,'onnx-wasm');
 runtime.env.wasm.numThreads=1;runtime.env.wasm.proxy=false;
 runtime.env.wasm.wasmPaths={mjs:pathToFileURL(path.join(folder,'ort-wasm-simd-threaded.mjs')).href,wasm:pathToFileURL(path.join(folder,'ort-wasm-simd-threaded.wasm')).href};
 const create=runtime.InferenceSession.create.bind(runtime.InferenceSession);
 module.exports={...runtime,InferenceSession:{create:(model,options)=>create(typeof model==='string'?fs.readFileSync(model):model,{...options,executionProviders:['wasm']})}};
}
