package com.tikmng.zombiestrike;

public final class EventCounterChecks {
    public static void main(String[] args) {
        EventCounter counter = new EventCounter();
        expect(counter.add("like", "viewer", 99, 100), 0);
        expect(counter.add("like", "viewer", 1, 100), 1);
        expect(counter.add("like", "viewer", 100, 100), 1);
        expect(counter.add("like", "viewer", 300, 100), 3);
        expect(counter.add("like", "viewer", 50, 100), 0);
        expect(counter.add("like", "other", 50, 100), 0);
        expect(counter.add("like", "VIEWER", 50, 100), 1);
        expect(counter.add("like", "viewer", 0, 100), 0);
        expect(counter.add("gift:5655", "viewer", 1, 1) * 2, 2);
        expect(counter.add("gift:5655", "viewer", 1, 1) * 2, 2);
        expect(counter.add("gift:5319", "viewer", 1, 1) * 5, 5);
        expect(counter.add("follow", "viewer", 1, 1) * 2, 2);
        counter.clear();
        expect(counter.add("like", "other", 50, 100), 0);
        System.out.println("EVENT_COUNTER_CHECKS_PASSED (13 assertions)");
    }
    private static void expect(long actual, long expected) {
        if (actual != expected) throw new AssertionError(actual + " != " + expected);
    }
}
