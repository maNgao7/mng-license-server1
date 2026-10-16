package com.tikmng.zombiestrike;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Keeps each viewer's unfinished threshold for the next live batch. */
final class EventCounter {
    private final Map<String, Long> remainders = new HashMap<>();

    void clear() { remainders.clear(); }

    long add(String trigger, String viewer, int count, int threshold) {
        if (count <= 0) return 0;
        String key = trigger + ":" + viewer.toLowerCase(Locale.ROOT);
        long total = remainders.getOrDefault(key, 0L) + count;
        int required = Math.max(1, threshold);
        remainders.put(key, total % required);
        return total / required;
    }
}
