'use strict';

// Bound disk pressure and drain in-flight checks before reporting a failure or canceling a launch.
async function checkFiles(files, check, signal) {
    const iterator = files[Symbol.iterator]();
    let failure;
    async function worker() {
        while (!failure) {
            try {
                signal?.throwIfAborted();
                const next = iterator.next();
                if (next.done) return;
                await check(next.value);
            } catch (error) {
                failure ??= error;
                return;
            }
        }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    if (failure) throw failure;
}

module.exports = { checkFiles };
