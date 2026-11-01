package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Snowball;
import net.minecraft.world.level.GameType;

/** Explicitly enabled only by the isolated native QA launcher. */
public final class SpectatorSafetyCheck {
    private final boolean enabled = Boolean.getBoolean("mng.snowwar.spectatorQa");
    private long started = -1;
    private LivingEntity attacker;
    private boolean checked, directSafe, powerSafe, meleeSafe;
    private float health;

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!enabled || started == -2) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null || server.getTickCount() < 160) return;
        if (started == -1) {
            host.setGameMode(GameType.SURVIVAL);
            host.getAbilities().invulnerable = false;
            host.getPersistentData().remove("mng_spawn_protected_until");
            host.setHealth(host.getMaxHealth());
            host.setNoGravity(true);
            health = host.getHealth();
            ViewerFighter fighter = engine.join(host, "qa-attacker", "QA_Attacker", "");
            attacker = (LivingEntity)host.serverLevel().getEntity(fighter.entityId());
            attacker.setInvulnerable(true);
            attacker.teleportTo(host.getX() + 4, host.getY(), host.getZ());
            engine.start(host);
            started = server.getTickCount();
            return;
        }
        long elapsed = server.getTickCount() - started;
        if (elapsed < 220 || !engine.state().running()) return;
        if (!checked) {
            checked = true;
            Snowball shot = new Snowball(host.level(), attacker);
            shot.setOwner(attacker);
            shot.getPersistentData().putUUID("mng_owner_uuid", attacker.getUUID());
            engine.hitBySnowball(shot, host);
            directSafe = host.getHealth() == health;
            engine.damageFromPower(host, "QA_Attacker", "", 1000.0F);
            powerSafe = host.getHealth() == health;
            host.invulnerableTime = 0;
            host.hurt(host.damageSources().mobAttack(attacker), 1000.0F);
            meleeSafe = host.getHealth() == health;
            engine.applyAction(host, "KAR_ADAMI", "QA_Attacker", "", 1);
            engine.applyAction(host, "CIG", "QA_Attacker", "", 1);
        }
        if (elapsed < 300) return;
        boolean noHostTarget = host.serverLevel().getEntitiesOfClass(net.minecraft.world.entity.Mob.class,
            host.getBoundingBox().inflate(160), SnowWarEngine::isArenaCombatant).stream()
            .noneMatch(mob -> mob.getTarget() == host);
        boolean passed = directSafe && powerSafe && meleeSafe && noHostTarget && host.getHealth() == health;
        SnowWar.LOGGER.info("MNG_SPECTATOR_QA passed={} snowball={} power={} melee={} noHostTarget={}",
            passed, directSafe, powerSafe, meleeSafe, noHostTarget);
        engine.stop(host);
        started = -2;
    }
}
