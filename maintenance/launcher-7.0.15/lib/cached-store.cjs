'use strict';

const fs = require('node:fs');
const { createRequire } = require('node:module');
const { performance } = require('node:perf_hooks');

function copy(value) {
    const result = structuredClone(value);
    // Conf returns a dictionary without Object.prototype at the root.
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === null) {
        Object.setPrototypeOf(result, null);
    }
    return result;
}

/**
 * Cache an electron-store/Conf snapshot; all mutations still use the backing store.
 * Match accessPropertiesByDotNotation to the Store constructor (default: true).
 * Metadata is checked at most once per checkIntervalMs (default: 1000), on reads.
 * reload() immediately refreshes the snapshot and returns the wrapper. Stores
 * without a public .store snapshot (including main.js's fallback) pass through.
 * now/statSync are injectable so tests never need a profile or real-time waits.
 */
function createCachedStore(backing, options = {}) {
    if (!backing || typeof backing.get !== 'function' || typeof backing.set !== 'function') {
        throw new TypeError('A store with get/set methods is required');
    }
    if (!('store' in backing)) return backing;

    const {
        accessPropertiesByDotNotation = true,
        checkIntervalMs = 1000,
        now = () => performance.now(),
        statSync = fs.statSync
    } = options;
    if (!Number.isFinite(checkIntervalMs) || checkIntervalMs <= 0) {
        throw new TypeError('checkIntervalMs must be a positive finite number');
    }
    if (typeof now !== 'function' || typeof statSync !== 'function') {
        throw new TypeError('now/statSync must be functions');
    }

    // Resolve the same structured helper as Conf, including a nested dependency.
    const dotProp = createRequire(require.resolve('conf'))('dot-prop');
    let snapshot;
    let valid = false;
    let signature;
    let nextCheckAt = 0;
    let wrapper;
    let batchData = null;
    let batchChanged = false;

    function fingerprint() {
        const file = backing.path;
        if (typeof file !== 'string' || !file) return undefined;
        try {
            const stat = statSync(file);
            return JSON.stringify([file, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]);
        } catch (error) {
            if (error.code === 'ENOENT') return JSON.stringify([file, 'missing']);
            throw error;
        }
    }

    function read() {
        if (batchData) return batchData;
        const time = now();
        if (!valid || time >= nextCheckAt) {
            const current = fingerprint();
            if (!valid || signature !== current) {
                valid = false;
                snapshot = copy(backing.store);
                signature = current;
                valid = true;
            }
            nextCheckAt = time + checkIntervalMs;
        }
        return snapshot;
    }

    function invalidate() {
        valid = false;
        snapshot = undefined;
    }

    function mutate(operation) {
        // Invalidate before synchronous change callbacks, and after failed writes.
        invalidate();
        try {
            return operation();
        } finally {
            invalidate();
        }
    }

    const methods = {
        batch(operation) {
            if (typeof operation !== 'function') throw new TypeError('A synchronous batch callback is required');
            if (batchData) return operation();
            batchData = copy(read()); batchChanged = false;
            try {
                const result = operation();
                if (result && typeof result.then === 'function') throw new TypeError('Store batches must be synchronous');
                if (batchChanged) {
                    const value = batchData; batchData = null;
                    mutate(() => { backing.store = value; });
                }
                return result;
            } finally { batchData = null; batchChanged = false; }
        },
        get(key, defaultValue) {
            const data = read();
            const value = accessPropertiesByDotNotation
                ? dotProp.get(data, key, defaultValue)
                : key in data ? data[key] : defaultValue;
            // A caller's default is ephemeral and must never enter the snapshot.
            return value === defaultValue ? defaultValue : copy(value);
        },
        has(key) {
            const data = read();
            return accessPropertiesByDotNotation ? dotProp.has(data, key) : key in data;
        },
        reload() {
            invalidate();
            read();
            return wrapper;
        }
    };

    for (const method of ['set', 'delete', 'clear', 'reset']) {
        if (typeof backing[method] === 'function') {
            methods[method] = (...args) => {
                if (!batchData) return mutate(() => backing[method](...args));
                if (method === 'set') {
                    const entries = typeof args[0] === 'object' && args[0] !== null ? Object.entries(args[0]) : [[args[0], args[1]]];
                    for (const [key, value] of entries) {
                        if (typeof key !== 'string' || value === undefined) throw new TypeError('Invalid store entry');
                        if (accessPropertiesByDotNotation) dotProp.set(batchData, key, copy(value));
                        else Object.defineProperty(batchData, key, {value:copy(value),enumerable:true,writable:true,configurable:true});
                    }
                } else if (method === 'delete') {
                    if (accessPropertiesByDotNotation) dotProp.delete(batchData, args[0]); else delete batchData[args[0]];
                } else throw new TypeError('clear/reset are not supported inside a store batch');
                batchChanged = true;
            };
        }
    }

    wrapper = new Proxy(backing, {
        get(target, property) {
            if (Object.hasOwn(methods, property)) return methods[property];
            if (property === 'store') return copy(read());
            if (property === 'size') return Object.keys(read()).length;
            if (property === Symbol.iterator) {
                return function* () { yield* Object.entries(copy(read())); };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, property, value) {
            if (property === 'store' || property === 'path') {
                return mutate(() => Reflect.set(target, property, value, target));
            }
            return Reflect.set(target, property, value, target);
        }
    });
    return wrapper;
}

module.exports = { createCachedStore };
