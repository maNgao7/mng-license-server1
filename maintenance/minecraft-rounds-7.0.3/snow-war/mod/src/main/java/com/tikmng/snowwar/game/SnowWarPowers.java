package com.tikmng.snowwar.game;

import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.protocol.game.ClientboundStopSoundPacket;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.level.levelgen.Heightmap;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class SnowWarPowers {
    private static final DustParticleOptions ICE = new DustParticleOptions(new Vector3f(0.24F, 0.8F, 1), 1.25F);
    private final List<Zone> zones = new ArrayList<>();
    private long clock;

    public int zoneCount() { return zones.size(); }
    public int revengeCount() { return 0; }

    public void reset() { zones.clear(); clock = 0; }

    public void pauseTick() {
        for (Zone zone : zones) zone.freezeUntil++;
    }

    public void cast(ServerPlayer host, SnowWarEngine engine, String action, String name, String profile,
                     int amount, int seconds) {
        long duration = Math.max(1, Math.min(120, seconds)) * 20L;
        boolean tornado = action.equals("KAR_HORTUMU");
        List<LivingEntity> enemies = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            host.getBoundingBox().inflate(100), e -> enemy(e, name)).stream()
            .sorted(Comparator.<LivingEntity>comparingInt(e -> e instanceof Player ? 1 : 0)
                .thenComparingDouble(host::distanceToSqr)).toList();
        int count = 1;
        if (!tornado) {
            long freezeUntil = host.serverLevel().getGameTime() + duration;
            for (LivingEntity enemy : enemies) {
                if (protectedPlayer(enemy)) continue;
                enemy.getPersistentData().putLong("mng_frozen_until", Math.max(freezeUntil,
                    enemy.getPersistentData().getLong("mng_frozen_until")));
                enemy.setDeltaMovement(0, enemy.getDeltaMovement().y, 0);
                if (enemy instanceof net.minecraft.world.entity.Mob mob) mob.getNavigation().stop();
                enemy.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN,
                    (int)Math.min(Integer.MAX_VALUE, duration), 10, false, true));
                burst(host.serverLevel(), enemy.position(), 24);
            }
        }
        // Every zone has its own lifetime; rapid gifts never overwrite earlier casts.
        for (int i = 0; i < count; i++) {
            Vec3 point;
            if (tornado) {
                LivingEntity target = enemies.stream().filter(e -> !(e instanceof Player) && tornadoTarget(e, name))
                    .max(Comparator.comparingLong(candidate -> enemies.stream()
                        .filter(other -> !(other instanceof Player)
                            && horizontalDistanceSqr(candidate.position(), other.position()) <= 400.0)
                        .count()))
                    .orElse(enemies.isEmpty() ? null : enemies.get(0));
                point = target == null ? host.position().add(host.getLookAngle().multiply(12, 0, 12))
                    : target.position();
            } else {
                point = enemies.isEmpty() ? host.position().add(7 + i % 5 * 5, 0, i / 5 * 5)
                    : enemies.get(i % enemies.size()).position();
                if (i >= enemies.size() && !enemies.isEmpty())
                    point = point.add(Math.cos(i * 2.4) * 4, 0, Math.sin(i * 2.4) * 4);
            }
            int groundY = host.serverLevel().getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES,
                (int)Math.floor(point.x), (int)Math.floor(point.z));
            point = new Vec3(point.x, groundY + 0.15, point.z);
            zones.add(new Zone(host.serverLevel(), name, profile, point, clock + duration,
                host.serverLevel().getGameTime() + duration, tornado));
        }
        host.serverLevel().playSound(null, host.blockPosition(), tornado ? SoundEvents.ELYTRA_FLYING
            : SoundEvents.GLASS_BREAK, tornado ? SoundSource.WEATHER : SoundSource.PLAYERS,
            effectVolume(host, tornado ? 3.5F : 1.0F), tornado ? 0.35F : 0.8F);
        host.displayClientMessage(net.minecraft.network.chat.Component.literal("@" + name + " · "
            + (tornado ? "Kar Hortumu" : "Buz Tuzağı") + ": " + count + " adet, " + seconds + " saniye"), false);
    }

    public void tick(ServerPlayer host, SnowWarEngine engine) {
        clock++;
        boolean expiredTornado = zones.stream().anyMatch(zone -> zone.tornado && clock >= zone.until
            && zone.level == host.serverLevel());
        zones.removeIf(zone -> clock >= zone.until);
        if (expiredTornado && zones.stream().noneMatch(zone -> zone.tornado && zone.level == host.serverLevel())) {
            for (ServerPlayer player : host.serverLevel().players()) player.connection.send(
                new ClientboundStopSoundPacket(SoundEvents.ELYTRA_FLYING.getLocation(), SoundSource.WEATHER));
        }
        for (Zone zone : zones) {
            if (zone.level != host.serverLevel()) continue;
            List<LivingEntity> targets = zone.level.getEntitiesOfClass(LivingEntity.class,
                new AABB(zone.center, zone.center).inflate(zone.tornado ? 16 : 4, zone.tornado ? 28 : 5,
                    zone.tornado ? 16 : 4),
                e -> (zone.tornado ? tornadoTarget(e, zone.owner) : iceTarget(e, zone.owner))
                    && horizontalDistanceSqr(e.position(), zone.center) <= (zone.tornado ? 256 : 36));
            if (zone.tornado) {
                LivingEntity closest = zone.level.getEntitiesOfClass(LivingEntity.class,
                    new AABB(zone.center, zone.center).inflate(24), e -> tornadoTarget(e, zone.owner)).stream()
                    .min(Comparator.<LivingEntity>comparingInt(e -> e instanceof Player ? 1 : 0)
                        .thenComparingDouble(e -> e.position().distanceToSqr(zone.center))).orElse(null);
                if (closest != null) {
                    Vec3 movement = closest.position().subtract(zone.center).multiply(1, 0, 1);
                    if (movement.lengthSqr() > 1) zone.motion = zone.motion.scale(0.72).add(movement.normalize().scale(0.28));
                }
                zone.center = new Vec3(
                    net.minecraft.util.Mth.clamp(zone.center.x + zone.motion.x * 0.16, -88.0, 88.0),
                    zone.center.y,
                    net.minecraft.util.Mth.clamp(zone.center.z + zone.motion.z * 0.16, -88.0, 88.0));
                for (LivingEntity target : targets) {
                    if (protectedPlayer(target)) continue;
                    Vec3 toward = zone.center.subtract(target.position()).multiply(1, 0, 1);
                    Vec3 tangent = new Vec3(-toward.z, 0, toward.x).normalize().scale(0.38);
                    Vec3 velocity = target.getDeltaMovement().scale(0.35).add(toward.scale(0.08)).add(tangent);
                    target.setDeltaMovement(velocity.x, Math.min(0.58, velocity.y + 0.28), velocity.z);
                    target.hurtMarked = true;
                    if (clock % 20 == 0) {
                        float damage = target.getHealth() <= 10.0F ? target.getHealth()
                            : Math.max(1.0F, target.getHealth() - 1.0F);
                        engine.damageFromPower(target, zone.owner, zone.profile, damage);
                    }
                }
            } else {
                for (LivingEntity target : targets) {
                    if (protectedPlayer(target)) continue;
                    target.getPersistentData().putLong("mng_frozen_until", Math.max(zone.freezeUntil,
                        target.getPersistentData().getLong("mng_frozen_until")));
                    target.setDeltaMovement(0, target.getDeltaMovement().y, 0);
                    if (target instanceof net.minecraft.world.entity.Mob mob) mob.getNavigation().stop();
                    target.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 12, 10, false, true));
                }
            }
            if (zone.tornado && clock % 12 == 0) zone.level.playSound(null,
                net.minecraft.core.BlockPos.containing(zone.center), SoundEvents.ELYTRA_FLYING,
                SoundSource.WEATHER, effectVolume(host, 4.0F), 0.35F);
            if (clock % 2 == 0) render(zone);
        }
    }

    private static boolean enemy(LivingEntity entity, String owner) {
        if (!entity.isAlive()) return false;
        boolean fighter = entity.getPersistentData().getBoolean("mng_snow_fighter")
            || entity.getPersistentData().getBoolean("mng_snow_boss");
        return (entity instanceof Player || fighter) && (!fighter
            || !entity.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(owner));
    }

    private static boolean iceTarget(LivingEntity entity, String owner) {
        if (!entity.isAlive()) return false;
        if (entity instanceof Player) return true;
        return SnowWarEngine.isArenaCombatant(entity)
            && !entity.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(owner);
    }

    private static boolean tornadoTarget(LivingEntity entity, String owner) {
        if (!entity.isAlive() || entity.getPersistentData().getBoolean("mng_tree_reindeer")) return false;
        if (entity instanceof SnowBeastEntity beast && beast.renderScale() > 1.1F) return false;
        boolean ownCombatant = SnowWarEngine.isArenaCombatant(entity)
            && entity.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(owner);
        return !ownCombatant;
    }

    private static boolean protectedPlayer(LivingEntity entity) {
        return entity instanceof Player player && (player.getAbilities().flying || entity.level().getGameTime()
            < entity.getPersistentData().getLong("mng_spawn_protected_until"));
    }

    private void render(Zone zone) {
        int points = zone.tornado ? 480 : 32;
        for (int i = 0; i < points; i++) {
            double height = zone.tornado ? (i % 40) * 0.68 : 0.08;
            double angle = i * Math.PI * 2 / 8 + clock * (zone.tornado ? 0.28 : 0.012);
            double radius = zone.tornado ? 0.65 + height * 0.48 : 3.6;
            double x = zone.center.x + Math.cos(angle) * radius;
            double z = zone.center.z + Math.sin(angle) * radius;
            zone.level.sendParticles(ICE, x, zone.center.y + height, z, 1, 0.06, 0.04, 0.06, 0);
            if (zone.tornado) {
                zone.level.sendParticles(ParticleTypes.SNOWFLAKE, x, zone.center.y + height,
                    z, 2, 0.12, 0.18, 0.12, 0.04);
                if (i % 3 == 0) zone.level.sendParticles(ParticleTypes.CLOUD, x, zone.center.y + height,
                    z, 1, 0.16, 0.08, 0.16, 0.01);
            }
        }
    }

    private static void burst(ServerLevel level, Vec3 point, int amount) {
        level.sendParticles(ParticleTypes.SNOWFLAKE, point.x, point.y + 1, point.z, amount, 0.6, 1, 0.6, 0.06);
    }

    private static double horizontalDistanceSqr(Vec3 a, Vec3 b) {
        double x = a.x - b.x;
        double z = a.z - b.z;
        return x * x + z * z;
    }

    private static float effectVolume(ServerPlayer host, float base) {
        int percent = host.getPersistentData().contains("mng_effect_volume")
            ? host.getPersistentData().getInt("mng_effect_volume") : 55;
        return base * net.minecraft.util.Mth.clamp(percent / 55.0F, 0.0F, 2.0F);
    }

    private static final class Zone {
        final ServerLevel level;
        final String owner;
        final String profile;
        Vec3 center;
        Vec3 motion;
        final long until;
        long freezeUntil;
        final boolean tornado;
        Zone(ServerLevel level, String owner, String profile, Vec3 center, long until, long freezeUntil, boolean tornado) {
            this.level = level; this.owner = owner; this.profile = profile; this.center = center;
            this.until = until; this.freezeUntil = freezeUntil; this.tornado = tornado;
            double angle = Math.floorMod((owner + center).hashCode(), 360) * Math.PI / 180.0;
            this.motion = new Vec3(Math.cos(angle), 0, Math.sin(angle));
        }
    }
}
