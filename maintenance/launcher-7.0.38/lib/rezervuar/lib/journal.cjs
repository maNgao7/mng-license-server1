'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createJournal(file) {
    let sessionId = randomUUID(), sequence = 0, acknowledged = 0, fd;
    const pending = [], receipts = new Map();
    if (file) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (fs.existsSync(file)) {
            const lines = fs.readFileSync(file, 'utf8').split('\n');
            const header = JSON.parse(lines.shift());
            if (header.schemaVersion !== 1 || typeof header.sessionId !== 'string') throw new Error('journal-schema');
            sessionId = header.sessionId;
            for (const line of lines) {
                if (!line) continue;
                const entry = JSON.parse(line);
                if (entry.op === 'event' && entry.row?.seq === sequence + 1 && typeof entry.receipt === 'string'
                    && Number.isSafeInteger(entry.total) && entry.total > 0 && entry.row.value?.eventId) {
                    pending.push(entry.row); sequence++; receipts.set(entry.receipt, entry.total);
                } else if (entry.op === 'ack' && Number.isSafeInteger(entry.seq) && entry.seq >= acknowledged && entry.seq <= sequence) {
                    acknowledged = entry.seq;
                    while (pending[0]?.seq <= acknowledged) pending.shift();
                } else throw new Error('journal-record');
            }
        }
        fd = fs.openSync(file, 'a', 0o600);
        if (fs.fstatSync(fd).size === 0) write({ schemaVersion: 1, sessionId });
    }
    function write(entry) {
        if (fd === undefined) return;
        const bytes = Buffer.from(JSON.stringify(entry) + '\n');
        let offset = 0;
        while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset);
        fs.fsyncSync(fd);
    }
    function push({ value, receipt, total }) {
        const row = { seq: sequence + 1, value };
        write({ op: 'event', row, receipt, total });
        sequence++; receipts.set(receipt, total); pending.push(row);
        return row;
    }
    function ack(seq) {
        if (!Number.isSafeInteger(seq) || seq < 0 || seq > sequence) throw new Error('invalid-cursor');
        if (seq <= acknowledged) return;
        write({ op: 'ack', seq });
        acknowledged = seq;
        while (pending[0]?.seq <= seq) pending.shift();
    }
    return { sessionId, receipts, push, ack,
        rows: after => pending.filter(row => row.seq > after).slice(0, 250),
        get sequence() { return sequence; }, get acknowledged() { return acknowledged; },
        get pendingCount() { return pending.length; },
        close() { if (fd !== undefined) { fs.closeSync(fd); fd = undefined; } } };
}
module.exports = { createJournal };
