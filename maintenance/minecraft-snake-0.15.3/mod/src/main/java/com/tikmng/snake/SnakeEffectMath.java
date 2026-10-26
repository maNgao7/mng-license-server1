package com.tikmng.snake;

/** Stateless presentation math shared by the renderers and offline checks. */
final class SnakeEffectMath {
    static final int FEED_PARTICLES = 8;
    static final double FEED_FLIGHT = .46, FEED_SHRINK = .78;
    static final int MAX_STREAKS = 128, MAX_SPARKLES = 48;
    static final int STREAK_QUADS = 4, SPARKLE_QUADS = 8;
    static final int MAX_BOOST_QUADS = MAX_STREAKS * STREAK_QUADS + MAX_SPARKLES * SPARKLE_QUADS;

    record BoostStyle(int tier, int color, int core, int samples, double lifetime, double length) {}
    static final BoostStyle NONE = new BoostStyle(0, 0, 0, 0, 0, 0);
    private static final BoostStyle CYAN = new BoostStyle(3, 0x38EAF5, 0xDFFFFF, 7, .30, 1.25);
    private static final BoostStyle GOLD = new BoostStyle(5, 0xFFC83D, 0xFFF5CE, 10, .34, 1.65);
    private static final BoostStyle MAGENTA = new BoostStyle(10, 0xF45BE7, 0xFFE3FC, 14, .38, 2.10);

    private SnakeEffectMath() {}

    /** Reused frame counters enforce the same limits in rendering and offline stress checks. */
    static final class BoostBudget {
        int streaks, sparkles, quads;
        boolean capped;

        boolean streak() {
            if (streaks >= MAX_STREAKS || quads + STREAK_QUADS > MAX_BOOST_QUADS) {
                capped = true; return false;
            }
            streaks++; quads += STREAK_QUADS; return true;
        }

        boolean sparkle() {
            if (sparkles >= MAX_SPARKLES || quads + SPARKLE_QUADS > MAX_BOOST_QUADS) {
                capped = true; return false;
            }
            sparkles++; quads += SPARKLE_QUADS; return true;
        }

        void clear() { streaks = sparkles = quads = 0; capped = false; }
    }

    static double feedAge(double progress, int particle) {
        if (!Double.isFinite(progress) || progress < 0 || progress >= 1
                || particle < 0 || particle >= FEED_PARTICLES) return -1;
        double start = particle * (1 - FEED_FLIGHT) / (FEED_PARTICLES - 1);
        double age = (progress - start) / FEED_FLIGHT;
        return age >= 0 && age < 1 ? age : -1;
    }

    static double feedHalfSize(double radius) {
        return Double.isFinite(radius) && radius > 0 ? Math.min(.42, radius * .20) : 0;
    }

    static double feedApproach(double age) { return smooth(age / FEED_SHRINK); }
    static double feedScale(double age) { return 1 - smooth((age - FEED_SHRINK) / (1 - FEED_SHRINK)); }
    static int feedAlpha(double age) { return (int)Math.ceil(255 * smooth(age / .07)); }
    static double feedAhead(double radius, double age) {
        return Math.min(4.8, radius * 2.4) * (1 - feedApproach(age))
            - radius * .12 * smooth((age - FEED_SHRINK) / (1 - FEED_SHRINK));
    }

    static BoostStyle boostStyle(double multiplier, double until, double now, boolean paused, double motionSquared) {
        if (paused || !Double.isFinite(now) || !Double.isFinite(until) || until <= now
                || !Double.isFinite(multiplier) || multiplier <= 1
                || !Double.isFinite(motionSquared) || motionSquared <= 1e-10) return NONE;
        return multiplier >= 10 ? MAGENTA : multiplier >= 5 ? GOLD : CYAN;
    }

    static int boostSamples(BoostStyle style, double distance, double radius) {
        if (style.tier == 0 || !Double.isFinite(distance) || distance < 0
                || !Double.isFinite(radius) || radius < .04 || distance > 320 + radius * 28) return 0;
        if (distance > 180 + radius * 12) return Math.max(2, style.samples / 3);
        if (distance > 90 + radius * 8) return Math.max(3, style.samples / 2);
        return style.samples;
    }

    // Wrapping a fade-to-zero pulse produces a moving trail without retaining world particles.
    static double boostAge(BoostStyle style, double time, int seed, int sample) {
        if (style.tier == 0 || !Double.isFinite(time)) return 0;
        double phase = time / style.lifetime + (seed & 1023) / 1024.0 + sample * .61803398875;
        return Double.isFinite(phase) ? (phase - Math.floor(phase)) * style.lifetime : 0;
    }

    static double boostFade(BoostStyle style, double age) {
        if (style.tier == 0 || !Double.isFinite(age) || age < 0 || age >= style.lifetime) return 0;
        double t = age / style.lifetime;
        return smooth(t / .14) * (1 - smooth((t - .65) / .35));
    }

    static double unit(double value) { return Math.max(0, Math.min(1, value)); }
    static double smooth(double value) { double t = unit(value); return t * t * (3 - 2 * t); }
}
