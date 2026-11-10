export function createLicenseLedger({ read, write, checkpoint, scheduleBackup }) {
    let queue = Promise.resolve();
    let staging = false;

    function transact(operation) {
        const result = queue.then(async () => {
            const previous = read();
            const draft = structuredClone(previous);
            let reply;
            let updated;
            write(draft);
            staging = true;
            try {
                reply = operation();
                if (reply && typeof reply.then === "function") {
                    throw new Error("License changes must be staged synchronously.");
                }
                updated = read();
            } finally {
                staging = false;
                write(previous);
            }

            if (accessState(updated) !== accessState(previous)) {
                await checkpoint(updated, () => write(updated));
            } else {
                write(updated);
            }
            scheduleBackup();
            return reply;
        });
        queue = result.catch(() => {});
        return result;
    }

    return { transact, isStaging: () => staging };
}

function accessState({ licenses, blacklist }) {
    return JSON.stringify([licenses, blacklist], (key, value) =>
        key === "son_kontrol" || key === "giris_sayisi" ? undefined : value);
}
