package com.tikmng.snowwar.game;

import java.util.Random;

/** Server-owned nested circles with separate warning and movement phases. */
public final class BattleZone {
    public static final double FINAL_STAGE_RADIUS = 12;
    public static final double MIN_RADIUS = 0.025;
    private static final long FINAL_STEP_TICKS = 200;
    public double x, z, radius = 178, targetX, targetZ, targetRadius = 178;
    public boolean moving;
    public int phase;
    private double fromX, fromZ, fromRadius;
    private long phaseStart, phaseEnd;
    private final Random random = new Random();

    public void reset(long now, int seconds) {
        x = z = targetX = targetZ = 0;
        radius = targetRadius = 178;
        phase = 0;
        moving = false;
        chooseNext(now, seconds);
    }

    private void chooseNext(long now, int seconds) {
        targetRadius = radius > FINAL_STAGE_RADIUS ? Math.max(FINAL_STAGE_RADIUS, radius * 0.82)
            : Math.max(MIN_RADIUS, radius - 1);
        double angle = random.nextDouble() * Math.PI * 2;
        double shift = (radius - targetRadius) * Math.sqrt(random.nextDouble()) * 0.9;
        targetX = x + Math.cos(angle) * shift;
        targetZ = z + Math.sin(angle) * shift;
        phaseStart = now;
        phaseEnd = now + Math.max(1, seconds) * 20L;
    }

    public void force(long now) { if (radius > FINAL_STAGE_RADIUS) phaseEnd = now; }

    private void startMovement(long now, int seconds) {
        moving = true;
        phase++;
        fromX = x; fromZ = z; fromRadius = radius;
        phaseStart = now;
        phaseEnd = now + (radius <= FINAL_STAGE_RADIUS ? FINAL_STEP_TICKS : Math.max(1, seconds) * 20L);
    }

    public void tick(long now, int seconds) {
        if (!moving && radius > MIN_RADIUS && (now >= phaseEnd || radius <= FINAL_STAGE_RADIUS)) startMovement(now, seconds);
        if (moving) {
            double t = Math.min(1, Math.max(0, (now - phaseStart) / (double)(phaseEnd - phaseStart)));
            x = fromX + (targetX - fromX) * t;
            z = fromZ + (targetZ - fromZ) * t;
            radius = fromRadius + (targetRadius - fromRadius) * t;
            if (t >= 1) {
                radius = targetRadius;
                moving = false;
                chooseNext(now, seconds);
                // The final 12 metres shrink continuously, without an extra warning wait.
                if (radius <= FINAL_STAGE_RADIUS && radius > MIN_RADIUS) startMovement(now, seconds);
                else if (radius <= MIN_RADIUS) phaseEnd = now;
            }
        }
    }

    public int secondsLeft(long now) { return Math.max(0, (int)Math.ceil((phaseEnd - now) / 20.0)); }
    public double progress(long now) {
        return Math.max(0, Math.min(1, (now - phaseStart) / (double)Math.max(1, phaseEnd - phaseStart)));
    }
    public boolean outside(double px, double pz) {
        return (px-x)*(px-x) + (pz-z)*(pz-z) > radius*radius;
    }

    public boolean needsRetreat(double px, double pz) {
        double margin = radius * 0.72;
        double nextMargin = targetRadius * 0.65;
        return (px-x)*(px-x) + (pz-z)*(pz-z) > margin*margin
            || (px-targetX)*(px-targetX) + (pz-targetZ)*(pz-targetZ) > nextMargin*nextMargin;
    }
}
