package com.tikmng.snowwar.game;

import java.util.UUID;

public final class ViewerFighter {
    private final String viewerId;
    private String displayName;
    private String profileUrl;
    private UUID entityId;
    private double maxHealth = 30.0;
    private double damage = 10.0;
    private double scale = 1.0;
    private double speed = 1.0;
    private int kills;

    public ViewerFighter(String viewerId, String displayName, String profileUrl) {
        this.viewerId = viewerId;
        this.displayName = displayName;
        this.profileUrl = profileUrl;
    }

    public String viewerId() { return viewerId; }
    public String displayName() { return displayName; }
    public String profileUrl() { return profileUrl; }
    public UUID entityId() { return entityId; }
    public double maxHealth() { return maxHealth; }
    public double damage() { return damage; }
    public double scale() { return scale; }
    public double speed() { return speed; }
    public int kills() { return kills; }

    public void refreshIdentity(String name, String profile) {
        if (name != null && !name.isBlank()) displayName = name;
        if (profile != null && !profile.isBlank()) profileUrl = profile;
    }

    public void bind(UUID id) { entityId = id; }
    public void addHealth(double value) { maxHealth = Math.min(60.0, Math.max(1.0, maxHealth + value)); }
    public void addDamage(double value) { damage = Math.min(20.0, Math.max(0.25, damage + value)); }
    public void addScale(double value) { scale = Math.min(3.0, Math.max(0.6, scale + value)); }
    public void addSpeed(double value) { speed = Math.min(2.0, Math.max(0.5, speed + value)); }
    public void addKill() { kills++; }
}
