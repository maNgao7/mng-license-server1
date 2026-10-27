package com.tikmng.snowwar.game;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class SnowWarState {
    private final Map<String, ViewerFighter> fighters = new ConcurrentHashMap<>();
    private volatile boolean running;

    public ViewerFighter fighter(String viewerId, String name, String profile) {
        String key = normalize(viewerId == null || viewerId.isBlank() ? name : viewerId);
        ViewerFighter fighter = fighters.computeIfAbsent(key, ignored -> new ViewerFighter(key, name, profile));
        fighter.refreshIdentity(name, profile);
        return fighter;
    }

    public Collection<ViewerFighter> fighters() { return fighters.values(); }
    public void remove(String viewerId) { fighters.remove(normalize(viewerId)); }
    public boolean running() { return running; }
    public void start() { running = true; }
    public void stop() { running = false; }
    public void reset() { running = false; fighters.clear(); }

    private static String normalize(String value) {
        return value == null ? "viewer" : value.trim().toLowerCase(java.util.Locale.ROOT).replaceFirst("^@", "");
    }
}
