package com.tikmng.snake;

/** Pure pixel coverage; RGBA/ABGR both store alpha in the high byte. */
final class AvatarMask {
    private static final int SAMPLES = 32;

    private AvatarMask() {}

    static int apply(int rgba, int x, int y, int size) {
        int alpha = ((rgba >>> 24) * coverage(x, y, size) + 127) / 255;
        // Retain RGB even outside the circle so linear filtering cannot add a dark fringe.
        return rgba & 0xFFFFFF | alpha << 24;
    }

    static int coverage(int x, int y, int size) {
        if (size <= 0 || x < 0 || y < 0 || x >= size || y >= size) return 0;
        double radius = size * .5, dx = Math.abs(x + .5 - radius), dy = Math.abs(y + .5 - radius);
        double nearX = Math.max(0, dx - .5), nearY = Math.max(0, dy - .5);
        if (nearX * nearX + nearY * nearY >= radius * radius) return 0;
        if ((dx + .5) * (dx + .5) + (dy + .5) * (dy + .5) <= radius * radius) return 255;
        // Only the one-pixel boundary needs area sampling; interior pixels stay exact.
        int inside = 0;
        for (int sy = 0; sy < SAMPLES; sy++) for (int sx = 0; sx < SAMPLES; sx++) {
            double px = dx + (sx + .5) / SAMPLES - .5, py = dy + (sy + .5) / SAMPLES - .5;
            if (px * px + py * py <= radius * radius) inside++;
        }
        return (inside * 255 + SAMPLES * SAMPLES / 2) / (SAMPLES * SAMPLES);
    }
}
