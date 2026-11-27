(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TikMnGStatePatch = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const MAX_DEPTH = 32, MAX_OPS = 2048, MAX_ROWS = 10000;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const clone = value => JSON.parse(JSON.stringify(value));
    const equal = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
    const validPart = part => typeof part === 'string' && part.length <= 256 || Number.isSafeInteger(part) && part >= 0 && part < MAX_ROWS;
    const validPath = parts => Array.isArray(parts) && parts.length <= MAX_DEPTH && parts.every(validPart);
    function identity(row) {
        if (!object(row)) return null;
        for (const name of ['id', 'username']) if (Object.hasOwn(row, name) &&
                ['string', 'number'].includes(typeof row[name]) && String(row[name]).length)
            return name + ':' + JSON.stringify(row[name]);
        return null;
    }
    function indexed(rows) {
        const map = new Map();
        for (let i = 0; i < rows.length; i++) {
            const id = identity(rows[i]);
            if (id === null || map.has(id)) return null;
            map.set(id, i);
        }
        return map;
    }
    function diff(before, after) {
        const operations = [];
        function emit(operation) {
            if (operations.length >= MAX_OPS || !validPath(operation[1])) throw new Error('Patch limit');
            operations.push(operation);
        }
        function visit(a, b, parts) {
            if (equal(a, b)) return;
            if (parts.length >= MAX_DEPTH) { emit([0, parts, b]); return; }
            if (Array.isArray(a) && Array.isArray(b)) {
                const oldRows = a.length <= MAX_ROWS && indexed(a), newRows = b.length <= MAX_ROWS && indexed(b);
                const reordered = oldRows && newRows && (a.length !== b.length || b.some((row, i) => identity(row) !== identity(a[i])));
                if (reordered) {
                    const entries = b.map(row => {
                        const index = oldRows.get(identity(row));
                        if (index === undefined) return { value: row };
                        if (equal(a[index], row)) return index;
                        const patch = diff(a[index], row), entry = patch && { index, patch };
                        return entry && JSON.stringify(entry).length < JSON.stringify({ value: row }).length ? entry : { value: row };
                    });
                    emit([2, parts, entries]); return;
                }
                if (a.length === b.length) { for (let i = 0; i < b.length; i++) visit(a[i], b[i], [...parts, i]); return; }
            } else if (object(a) && object(b)) {
                for (const key of Object.keys(a)) if (!Object.hasOwn(b, key)) emit([1, [...parts, key]]);
                for (const key of Object.keys(b)) {
                    if (!Object.hasOwn(a, key)) emit([0, [...parts, key], b[key]]);
                    else visit(a[key], b[key], [...parts, key]);
                }
                return;
            }
            emit([0, parts, b]);
        }
        try {
            visit(before, after, []);
            let total = 0;
            function count(list, depth) {
                if (depth > MAX_DEPTH) throw new Error('Patch nesting limit');
                for (const operation of list) {
                    if (++total > MAX_OPS) throw new Error('Patch operation limit');
                    if (operation[0] === 2) for (const entry of operation[2])
                        if (object(entry) && Object.hasOwn(entry, 'patch')) count(entry.patch, depth + 1);
                }
            }
            count(operations, 0);
            return operations;
        } catch { return null; }
    }
    function apply(before, operations) {
        let consumed = 0;
        function run(value, list, depth) {
            if (!Array.isArray(list) || depth > MAX_DEPTH) throw new Error('Invalid patch');
            for (const operation of list) {
                if (++consumed > MAX_OPS || !Array.isArray(operation) || ![0, 1, 2].includes(operation[0]) ||
                        operation.length !== (operation[0] === 1 ? 2 : 3) || !validPath(operation[1])) throw new Error('Invalid patch operation');
                const [kind, parts, data] = operation;
                let parent = null, target = value, key;
                for (const part of parts) {
                    if (target === null || typeof target !== 'object' || Array.isArray(target) &&
                            (!Number.isSafeInteger(part) || part < 0 || part >= target.length)) throw new Error('Invalid patch path');
                    parent = target; key = part;
                    if (!Object.hasOwn(target, part)) {
                        if (part !== parts.at(-1) || kind !== 0 || Array.isArray(target)) throw new Error('Missing patch path');
                        target = undefined;
                    } else target = target[part];
                }
                let next;
                if (kind === 0) next = clone(data);
                else if (kind === 1) {
                    if (!parent || Array.isArray(parent) || !Object.hasOwn(parent, key)) throw new Error('Invalid patch deletion');
                    delete parent[key]; continue;
                } else {
                    if (!Array.isArray(target) || !Array.isArray(data) || data.length > MAX_ROWS) throw new Error('Invalid patch rows');
                    const used = new Set();
                    next = data.map(entry => {
                        if (object(entry) && Object.keys(entry).length === 1 && Object.hasOwn(entry, 'value')) return clone(entry.value);
                        const index = Number.isSafeInteger(entry) ? entry : object(entry) && Object.keys(entry).length === 2 && entry.index;
                        if (!Number.isSafeInteger(index) || index < 0 || index >= target.length || used.has(index)) throw new Error('Invalid patch reference');
                        used.add(index);
                        return Number.isSafeInteger(entry) ? target[index] : run(clone(target[index]), entry.patch, depth + 1);
                    });
                }
                if (parent) Object.defineProperty(parent, key, { value: next, enumerable: true, writable: true, configurable: true });
                else value = next;
            }
            return value;
        }
        return run(clone(before), operations, 0);
    }
    return { diff, apply };
});
