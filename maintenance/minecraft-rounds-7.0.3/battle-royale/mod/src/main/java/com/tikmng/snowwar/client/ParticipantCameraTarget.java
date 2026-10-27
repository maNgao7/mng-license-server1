package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.SnowFighterEntity;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

public final class ParticipantCameraTarget {
    public static final double REACH = 128.0;
    private SnowFighterEntity target;

    public static boolean valid(SnowFighterEntity fighter) {
        return fighter != null && fighter.isAlive() && !fighter.isRemoved()
            && fighter.isParticipant() && !fighter.isAudience();
    }

    public static SnowFighterEntity pick(Vec3 origin, Vec3 direction, double visibleDistance,
                                         Iterable<SnowFighterEntity> candidates) {
        double nearest = Math.min(REACH, Math.max(0, visibleDistance));
        Vec3 end = origin.add(direction.normalize().scale(nearest));
        SnowFighterEntity picked = null;
        for (SnowFighterEntity fighter : candidates) {
            if (!valid(fighter)) continue;
            var box = fighter.getBoundingBox();
            var hit = box.contains(origin) ? java.util.Optional.of(origin) : box.clip(origin, end);
            if (hit.isEmpty()) continue;
            double distance = origin.distanceTo(hit.get());
            if (distance < nearest) {
                nearest = distance;
                picked = fighter;
            }
        }
        return picked;
    }

    public boolean following() { return target != null; }
    public SnowFighterEntity target() { return target; }

    public boolean toggle(SnowFighterEntity picked) {
        if (following()) clear();
        else if (valid(picked)) target = picked;
        return following();
    }

    public boolean validate(Level level) {
        if (!valid(target) || level == null || target.level() != level || level.getEntity(target.getId()) != target)
            clear();
        return following();
    }

    public void clear() { target = null; }
}
