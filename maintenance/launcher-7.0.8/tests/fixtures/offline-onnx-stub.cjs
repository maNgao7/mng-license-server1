'use strict';
// Loaded only in worker contract tests, so both bundled entries exercise their real lifecycle without models.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const log = event => fs.appendFileSync(process.env.MNG_OFFLINE_STUB_LOG, JSON.stringify(event) + '\n');
class Tensor {
    constructor(type, data, dims) { Object.assign(this, { type, data, dims }); }
    async getData() { return this.data; }
}
const ort = { Tensor, InferenceSession: { async create(file) {
    const name = path.basename(file, '.onnx');
    log({ action: 'create', name });
    if (name === process.env.MNG_OFFLINE_STUB_FAIL) throw Error('private/model/path');
    return {
        async run(input) {
            log({ action: 'run', name });
            if (name === 'text') return { h: new Tensor('float32', new Float32Array(1), [1, 1]),
                dur: new Tensor('float32', new Float32Array(input.ids.data.length).fill(1), [1, input.ids.data.length]) };
            if (name === 'sample') return { z: new Tensor('float32', new Float32Array(64 * 4), [1, 64, 4]) };
            if (name === 'sound') return { latents: new Tensor('float32', new Float32Array(input.fw.data.length * 64), [input.fw.data.length, 64]) };
            return { audio: new Tensor('float32', new Float32Array(input.z.dims[2] * 1920).fill(0.25), [1]) };
        },
        async release() { log({ action: 'release', name }); }
    };
} } };
const originalLoad = Module._load;
Module._load = function(request, ...args) {
    return request === 'onnxruntime-node' ? ort : originalLoad.call(this, request, ...args);
};
WebAssembly.instantiate = async () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    let resultLength = 0;
    return { instance: { exports: {
        memory, alloc: () => 0, dealloc: () => {},
        letters(_ptr, length) {
            const input = new Uint8Array(memory.buffer, 0, length).slice();
            new DataView(memory.buffer).setUint32(8192, length, true);
            new Uint8Array(memory.buffer, 8196, length).set(input);
            return 8192;
        },
        normalize(_ptr, length) { resultLength = length; }, result_ptr: () => 0, result_len: () => resultLength
    } } };
};
