package com.tikmng.snowwar.game;

public final class ParticipantCapacity {
    public static final int DEFAULT = 300;
    public static final int MIN = 1;
    public static final int MAX = 500;

    private ParticipantCapacity() {}

    public static int validate(int value) {
        return Math.max(MIN, Math.min(MAX, value));
    }
}
