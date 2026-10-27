package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Items;

public final class SnowWarPowerSmoke {
    private final boolean enabled = Boolean.getBoolean("mng.snowwar.powerSmoke");
    private long started = -1;
    private LivingEntity enemy;
    private LivingEntity ally;
    private boolean gun;
    private boolean quantity;
    private boolean slow;
    private boolean friendly;
    private boolean tornado;
    private boolean separateDuration;
    private boolean effectsStarted;

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!enabled || started == -2 || server.getTickCount() < 100) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        if (started == -1) {
            engine.resetSession(host);
            host.teleportTo(32.5, host.getY(), 24.5);
            ally = create(host, engine, "power-ally", "PowerOwner");
            LivingEntity allyTwo = create(host, engine, "power-ally-two", "PowerOwner");
            enemy = create(host, engine, "power-enemy", "PowerEnemy");
            ally.teleportTo(host.getX() + 3, host.getY(), host.getZ());
            allyTwo.teleportTo(host.getX() + 2, host.getY(), host.getZ() + 2);
            enemy.teleportTo(host.getX() + 4, host.getY(), host.getZ());
            enemy.getAttribute(net.minecraft.world.entity.ai.attributes.Attributes.MAX_HEALTH).setBaseValue(500);
            enemy.setHealth(500);
            for (int i = 0; i < 3; i++) {
                LivingEntity fallen = create(host, engine, "power-dead-" + i, "PowerOwner");
                fallen.hurt(host.level().damageSources().genericKill(), 1000);
            }
            engine.start(host);
            started = server.getTickCount();
            return;
        }
        if (!effectsStarted) {
            if (!engine.state().running()) return;
            engine.applyAction(host, "KARTOPU_SILAHI", "PowerOwner", "", 2, 3);
            engine.applyAction(host, "BUZ_TUZAGI", "PowerOwner", "", 3, 2);
            engine.applyAction(host, "KAR_HORTUMU", "PowerOwner", "", 2, 3);
            long now = host.serverLevel().getGameTime();
            gun = host.getPersistentData().getLong("mng_snow_gun_until") > now
                && host.getMainHandItem().is(Items.CROSSBOW)
                && host.getMainHandItem().getTag() != null
                && host.getMainHandItem().getTag().getBoolean("mng_snow_gun")
                && host.serverLevel().getEntitiesOfClass(LivingEntity.class, host.getBoundingBox().inflate(160),
                    e -> e.isAlive() && e.getPersistentData().getBoolean("mng_snow_fighter")
                        && e.getPersistentData().getLong("mng_snow_gun_until") > now).size() == 2;
            quantity = engine.powers().zoneCount() == 2;
            effectsStarted = true;
            started = server.getTickCount();
            return;
        }
        long elapsed = server.getTickCount() - started;
        if (elapsed <= 30) {
            slow |= enemy.hasEffect(MobEffects.MOVEMENT_SLOWDOWN);
            tornado |= enemy.getDeltaMovement().horizontalDistanceSqr() > 0.002 || enemy.getY() > host.getY() + 0.2;
            friendly = !ally.hasEffect(MobEffects.MOVEMENT_SLOWDOWN);
        }
        if (elapsed == 45) separateDuration = engine.powers().zoneCount() == 1;
        if (elapsed < 80) return;
        long now = host.serverLevel().getGameTime();
        boolean expired = engine.powers().zoneCount() == 0
            && host.getPersistentData().getLong("mng_snow_gun_until") <= now
            && host.serverLevel().getEntitiesOfClass(LivingEntity.class, host.getBoundingBox().inflate(200),
                e -> e.isAlive() && e.getPersistentData().getLong("mng_snow_gun_until") > now).isEmpty();
        SnowWar.LOGGER.info("MNG_POWER_SMOKE_RESULT gun={} quantity={} slow={} friendly={} tornado={} separateDuration={} expired={}",
            gun, quantity, slow, friendly, tornado, separateDuration, expired);
        engine.stop(host);
        engine.resetSession(host);
        host.setHealth(host.getMaxHealth());
        started = -2;
    }

    private LivingEntity create(ServerPlayer host, SnowWarEngine engine, String id, String owner) {
        ViewerFighter fighter = engine.join(host, id, owner, "");
        return (LivingEntity)host.serverLevel().getEntity(fighter.entityId());
    }
}
