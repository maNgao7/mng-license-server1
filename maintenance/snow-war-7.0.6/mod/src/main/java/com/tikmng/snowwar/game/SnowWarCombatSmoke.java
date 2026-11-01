package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.entity.projectile.Snowball;
import net.minecraft.world.entity.animal.SnowGolem;

public final class SnowWarCombatSmoke {
    private final boolean enabled = Boolean.getBoolean("mng.snowwar.combatSmoke");
    private long started = -1;
    private ViewerFighter first;
    private ViewerFighter second;
    private ViewerFighter hostAttacker;
    private long initialShots;
    private long initialMovingShots;
    private boolean movingShotPassed;
    private boolean fighterDamagePassed;
    private boolean playerPhase;
    private float playerStartHealth;
    private long playerPhaseShots;
    private boolean playerDamagePassed;
    private boolean actionPhase;
    private boolean threeHitPlayerPassed;
    private boolean threeHitFighterPassed;
    private boolean preStartThrowPassed;
    private boolean gunDamagePassed;
    private boolean rangePassed;
    private boolean protectedPassed;
    private boolean unlimitedPassed;
    private ViewerFighter stormVictim;
    private float firstHitHealth = -1;
    private float firstHitMax = -1;
    private boolean winnerPhase;
    private long winnerRoundStarted;
    private boolean winnerRivalRemoved;
    private boolean stormDamagePassed;
    private long bossCountBeforeReset;

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!enabled || started == -2) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null || server.getTickCount() < 100) return;
        if (started == -1) {
            host.teleportTo(32.5, host.getY(), 24.5);
            first = engine.join(host, "combat-smoke-a", "CombatA", "");
            second = engine.join(host, "combat-smoke-b", "CombatB", "");
            move(host, first, 12);
            move(host, second, -12);
            host.getPersistentData().remove("mng_player_throw_at");
            long beforePreStartThrow = engine.snowballsThrown();
            engine.throwPlayerSnowball(host);
            preStartThrowPassed = engine.snowballsThrown() == beforePreStartThrow;
            engine.start(host);
            initialShots = engine.snowballsThrown();
            initialMovingShots = engine.movingSnowballsThrown();
            started = server.getTickCount();
            return;
        }
        long elapsed = server.getTickCount() - started;
        if (!playerPhase && elapsed >= 620) {
            movingShotPassed = engine.movingSnowballsThrown() > initialMovingShots;
            Entity a = entity(host, first);
            Entity b = entity(host, second);
            fighterDamagePassed = a == null || b == null
                || (a instanceof LivingEntity living && living.getHealth() < living.getMaxHealth())
                || (b instanceof LivingEntity living && living.getHealth() < living.getMaxHealth());
            if (a != null) a.discard();
            if (b != null) b.discard();
            hostAttacker = engine.join(host, "combat-host", "CombatHost", "");
            engine.start(host);
            move(host, hostAttacker, 0);
            host.setHealth(host.getMaxHealth());
            playerStartHealth = host.getHealth();
            playerPhaseShots = engine.snowballsThrown();
            playerPhase = true;
            return;
        }
        if (!playerPhase || elapsed < 1120) return;
        if (!actionPhase) {
            playerDamagePassed = host.getHealth() < playerStartHealth;
            Entity attacker = entity(host, hostAttacker);
            if (attacker != null) attacker.discard();
            ViewerFighter targetFighter = engine.join(host, "one-hit-target", "OneHitTarget", "");
            Entity target = entity(host, targetFighter);
            if (target instanceof LivingEntity living) {
                engine.stop(host);
                host.setHealth(host.getMaxHealth());
                Snowball shot = new Snowball(host.level(), host);
                shot.setOwner(host);
                shot.getPersistentData().putUUID("mng_owner_uuid", host.getUUID());
                engine.hitBySnowball(shot, living);
                firstHitHealth = living.getHealth();
                firstHitMax = living.getMaxHealth();
                threeHitPlayerPassed = !living.isAlive();
                ViewerFighter gunTargetFighter = engine.join(host, "gun-target", "GunTarget", "");
                Entity gunTarget = entity(host, gunTargetFighter);
                if (gunTarget instanceof LivingEntity gunLiving) {
                    Snowball gunShot = new Snowball(host.level(), host);
                    gunShot.setOwner(host);
                    gunShot.getPersistentData().putBoolean("mng_snow_gun", true);
                    gunShot.getPersistentData().putUUID("mng_owner_uuid", host.getUUID());
                    engine.hitBySnowball(gunShot, gunLiving);
                    gunDamagePassed = Math.abs(gunLiving.getHealth() - 15.0F) < 0.01F;
                }
                engine.start(host);
            }
            ViewerFighter three = engine.join(host, "three-hit-target", "ThreeHitTarget", "");
            ViewerFighter shooter = engine.join(host, "rule-shooter", "RuleShooter", "");
            LivingEntity threeTarget = (LivingEntity)entity(host, three);
            LivingEntity mobShooter = (LivingEntity)entity(host, shooter);
            threeTarget.teleportTo(host.getX() + 3, host.getY(), host.getZ());
            mobShooter.teleportTo(host.getX() + 5, host.getY(), host.getZ());
            Snowball mobShot = new Snowball(host.level(), mobShooter);
            mobShot.setOwner(mobShooter);
            mobShot.getPersistentData().putUUID("mng_owner_uuid", mobShooter.getUUID());
            engine.hitBySnowball(mobShot, threeTarget);
            threeTarget.invulnerableTime = 0;
            engine.hitBySnowball(mobShot, threeTarget);
            boolean survivedTwo = threeTarget.isAlive();
            threeTarget.invulnerableTime = 0;
            engine.hitBySnowball(mobShot, threeTarget);
            threeHitFighterPassed = survivedTwo && !threeTarget.isAlive();
            ViewerFighter playerShooterFighter = engine.join(host, "player-damage-shooter", "PlayerDamageShooter", "");
            LivingEntity playerShooter = (LivingEntity)entity(host, playerShooterFighter);
            playerShooter.setInvulnerable(true);
            playerShooter.teleportTo(host.getX() + 5, host.getY(), host.getZ());
            for (LivingEntity other : host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                    host.getBoundingBox().inflate(120), e -> e != playerShooter && SnowWarEngine.isArenaCombatant(e)))
                other.discard();
            Snowball playerShot = new Snowball(host.level(), playerShooter);
            playerShot.setOwner(playerShooter);
            playerShot.getPersistentData().putUUID("mng_owner_uuid", playerShooter.getUUID());
            host.setHealth(host.getMaxHealth());
            host.invulnerableTime = 0;
            host.getPersistentData().remove("mng_spawn_protected_until");
            host.getAbilities().flying = false;
            host.getAbilities().invulnerable = false;
            host.onUpdateAbilities();
            engine.hitBySnowball(playerShot, host);
            playerDamagePassed |= host.getHealth() < host.getMaxHealth();
            host.setHealth(host.getMaxHealth());
            float before = host.getHealth();
            host.getPersistentData().putLong("mng_spawn_protected_until", host.serverLevel().getGameTime() + 200);
            engine.hitBySnowball(playerShot, host);
            protectedPassed = host.getHealth() == before;
            host.getPersistentData().remove("mng_spawn_protected_until");
            playerShooter.teleportTo(host.getX() + 27, host.getY(), host.getZ());
            engine.hitBySnowball(playerShot, host);
            rangePassed = host.getHealth() == before;
            mobShooter.discard();
            playerShooter.discard();
            host.setItemInHand(net.minecraft.world.InteractionHand.MAIN_HAND,
                new net.minecraft.world.item.ItemStack(net.minecraft.world.item.Items.SNOWBALL, 16));
            for (int i = 0; i < 80; i++) {
                host.getPersistentData().remove("mng_player_throw_at");
                engine.throwPlayerSnowball(host);
            }
            unlimitedPassed = host.getMainHandItem().getCount() == 16;
            engine.applyAction(host, "KAR_ADAMI", "StormOwner", "", 1);
            engine.applyAction(host, "AGIR_KARTOPU", "StormOwner", "", 1);
            stormVictim = engine.join(host, "storm-victim", "StormVictim", "");
            move(host, stormVictim, 2);
            Entity protectedStormTarget = entity(host, stormVictim);
            if (protectedStormTarget != null) protectedStormTarget.setInvulnerable(true);
            engine.applyAction(host, "CIG", "StormOwner", "", 1);
            actionPhase = true;
            return;
        }
        if (elapsed < 1210) return;
        if (!winnerPhase) {
            Entity stormTarget = entity(host, stormVictim);
            stormDamagePassed = stormTarget instanceof LivingEntity living
                && Math.abs(living.getHealth() - 5.0F) < 0.01F;
            bossCountBeforeReset = host.serverLevel().getEntitiesOfClass(SnowBeastEntity.class,
                host.getBoundingBox().inflate(120), e -> e.getPersistentData().getBoolean("mng_snow_boss")).size();
            engine.resetSession(host);
            ViewerFighter champion = engine.join(host, "winner-smoke", "WinnerSmoke", "");
            ViewerFighter rival = engine.join(host, "winner-rival", "WinnerRival", "");
            entity(host, champion).setInvulnerable(true);
            entity(host, rival).setInvulnerable(true);
            engine.start(host);
            engine.setWinnerDelaySeconds(1);
            winnerRoundStarted = server.getTickCount();
            winnerPhase = true;
            return;
        }
        if (server.getTickCount() - winnerRoundStarted < 200) return;
        if (!winnerRivalRemoved) {
            engine.applyAction(host, "HERKESI_DUSUR", "WinnerSmoke", "", 1);
            winnerRivalRemoved = true;
            return;
        }
        if (server.getTickCount() - winnerRoundStarted < 225) return;
        Entity a = entity(host, first);
        Entity b = entity(host, second);
        boolean launched = engine.snowballsThrown() > initialShots;
        boolean playerDamaged = playerDamagePassed;
        Entity attacker = entity(host, hostAttacker);
        boolean winnerReset = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            host.getBoundingBox().inflate(160), SnowWarEngine::isArenaCombatant).isEmpty()
            && !engine.state().running() && engine.state().startCountdownSeconds() == 0;
        SnowWar.LOGGER.info("MNG_COMBAT_SMOKE_RESULT launched={} movingShot={} damaged={} playerDamaged={} hostOneHit={} fighterThreeHit={} preStartThrow={} gunDamage={} range={} protected={} unlimited={} bosses={} stormDamage={} winnerReset={} firstHit={}/{} playerShots={} attackerAlive={} distance={} healthA={} healthB={} playerHealth={} invulnerable={} abilityInvulnerable={} creative={}",
            launched, movingShotPassed, fighterDamagePassed, playerDamaged, threeHitPlayerPassed, threeHitFighterPassed,
            preStartThrowPassed, gunDamagePassed, rangePassed, protectedPassed, unlimitedPassed, bossCountBeforeReset,
            stormDamagePassed, winnerReset,
            firstHitHealth, firstHitMax,
            engine.snowballsThrown() - playerPhaseShots,
            attacker != null && attacker.isAlive(), attacker == null ? -1 : attacker.distanceTo(host),
            health(a), health(b), host.getHealth(), host.isInvulnerable(), host.getAbilities().invulnerable,
            host.isCreative());
        engine.stop(host);
        engine.resetSession(host);
        engine.setWinnerDelaySeconds(10);
        started = -2;
    }

    private static Entity entity(ServerPlayer host, ViewerFighter fighter) {
        return fighter.entityId() == null ? null : host.serverLevel().getEntity(fighter.entityId());
    }

    private static void move(ServerPlayer host, ViewerFighter fighter, int offset) {
        Entity entity = entity(host, fighter);
        var forward = host.getLookAngle().multiply(1, 0, 1).normalize();
        double x = host.getX() + forward.x * 8 - forward.z * offset;
        double z = host.getZ() + forward.z * 8 + forward.x * offset;
        if (entity != null) entity.teleportTo(x,
            host.serverLevel().getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, (int)x, (int)z), z);
    }

    private static float health(Entity entity) {
        return entity instanceof LivingEntity living ? living.getHealth() : 0.0F;
    }
}
