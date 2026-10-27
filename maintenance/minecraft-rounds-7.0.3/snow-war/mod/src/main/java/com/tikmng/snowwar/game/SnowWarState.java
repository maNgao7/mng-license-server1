package com.tikmng.snowwar.game;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class SnowWarState {
    private final Map<String, ViewerFighter> fighters = new ConcurrentHashMap<>();
    private volatile boolean running;
    private int startTicksRemaining;
    private boolean paused;
    private boolean contested;

    public ViewerFighter fighter(String viewerId, String name, String profile) {
        String key = normalize(viewerId == null || viewerId.isBlank() ? name : viewerId);
        ViewerFighter fighter = fighters.computeIfAbsent(key, ignored -> new ViewerFighter(key, name, profile));
        fighter.refreshIdentity(name, profile);
        return fighter;
    }

    public Collection<ViewerFighter> fighters() { return fighters.values(); }
    public void remove(String viewerId) { fighters.remove(normalize(viewerId)); }
    public boolean running() { return running && !paused; }
    public boolean paused() { return paused; }
    public boolean started() { return running || startTicksRemaining > 0; }
    public int startCountdownSeconds() { return (startTicksRemaining + 19) / 20; }

    public void toggle() {
        if (started() && !paused) stop();
        else start();
    }

    public boolean start() {
        if (paused) {
            paused = false;
            return true;
        }
        if (running || startTicksRemaining > 0) return false;
        startTicksRemaining = 200;
        return true;
    }

    public void tickStartCountdown() {
        if (!paused && startTicksRemaining > 0 && --startTicksRemaining == 0) running = true;
    }

    public boolean observeTeams(int teams) {
        if (!running()) return false;
        if (teams > 1) contested = true;
        return contested && teams == 1;
    }

    public void stop() {
        if (running || startTicksRemaining > 0) paused = true;
    }

    public void reset() {
        running = false;
        startTicksRemaining = 0;
        paused = false;
        contested = false;
        fighters.clear();
    }

    private static String normalize(String value) {
        return value == null ? "viewer" : value.trim().toLowerCase(java.util.Locale.ROOT).replaceFirst("^@", "");
    }
}
