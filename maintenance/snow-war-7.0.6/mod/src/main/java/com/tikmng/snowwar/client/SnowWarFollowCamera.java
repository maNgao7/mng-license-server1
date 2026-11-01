package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.SnowBeastEntity;
import com.tikmng.snowwar.game.SnowFighterEntity;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.ArrayList;
import java.util.UUID;

final class SnowWarFollowCamera {
    record Target(int entityId, UUID uuid, AABB bounds, boolean alive, boolean participant) {
        boolean eligible() { return alive && participant; }
    }

    private Target target;
    private CameraType previousPerspective;
    private ClientLevel level;
    private LocalPlayer owner;

    void toggle(Minecraft minecraft) {
        if (following()) {
            exit(minecraft);
            return;
        }
        if (minecraft.level == null || minecraft.player == null || !minecraft.player.isAlive()) return;
        var camera = minecraft.gameRenderer.getMainCamera();
        Vec3 origin = camera.getPosition();
        var look = camera.getLookVector();
        Vec3 end = origin.add(look.x() * 256.0, look.y() * 256.0, look.z() * 256.0);
        end = minecraft.level.clip(new ClipContext(origin, end, ClipContext.Block.COLLIDER,
            ClipContext.Fluid.NONE, minecraft.player)).getLocation();
        var candidates = new ArrayList<Target>();
        for (Entity entity : minecraft.level.getEntities(minecraft.player, new AABB(origin, end).inflate(1.0)))
            candidates.add(snapshot(entity));
        Target selected = pickTarget(origin, end, candidates);
        if (selected == null) return;
        begin(selected, minecraft.options.getCameraType());
        level = minecraft.level;
        owner = minecraft.player;
        minecraft.setCameraEntity(level.getEntity(selected.entityId()));
        minecraft.options.setCameraType(CameraType.THIRD_PERSON_BACK);
    }

    void tick(Minecraft minecraft) {
        if (!following()) return;
        Entity entity = minecraft.level == null ? null : minecraft.level.getEntity(target.entityId());
        boolean sameSession = minecraft.level == level && minecraft.player == owner
            && owner != null && owner.isAlive() && minecraft.getCameraEntity() == entity;
        if (shouldExit(entity == null ? null : snapshot(entity), sameSession)) exit(minecraft);
    }

    private void exit(Minecraft minecraft) {
        CameraType perspective = clear();
        minecraft.setCameraEntity(minecraft.player);
        if (perspective != null) minecraft.options.setCameraType(perspective);
    }

    private static Target snapshot(Entity entity) {
        boolean participant = (entity instanceof SnowFighterEntity fighter && !fighter.isAudience()
            || entity instanceof SnowBeastEntity)
            && Math.abs(entity.getX()) <= 110 && Math.abs(entity.getZ()) <= 110;
        return new Target(entity.getId(), entity.getUUID(), entity.getBoundingBox(),
            entity instanceof LivingEntity living && living.isAlive() && !entity.isRemoved(), participant);
    }

    static Target pickTarget(Vec3 origin, Vec3 end, Iterable<Target> candidates) {
        Target nearest = null;
        double distance = Double.POSITIVE_INFINITY;
        for (Target candidate : candidates) {
            if (!candidate.eligible()) continue;
            var hit = candidate.bounds().contains(origin) ? java.util.Optional.of(origin)
                : candidate.bounds().clip(origin, end);
            if (hit.isEmpty()) continue;
            double next = origin.distanceToSqr(hit.get());
            if (next < distance) {
                nearest = candidate;
                distance = next;
            }
        }
        return nearest;
    }

    boolean following() { return target != null; }

    void begin(Target selected, CameraType perspective) {
        target = selected;
        previousPerspective = perspective;
    }

    boolean shouldExit(Target current, boolean sameSession) {
        return !sameSession || current == null || !current.eligible()
            || current.entityId() != target.entityId() || !current.uuid().equals(target.uuid());
    }

    CameraType clear() {
        CameraType perspective = previousPerspective;
        target = null;
        previousPerspective = null;
        level = null;
        owner = null;
        return perspective;
    }
}
