package com.tikmng.snowwar.game;

import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.entity.projectile.Snowball;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.animal.SnowGolem;
import net.minecraft.world.entity.EntityType;
import net.minecraft.util.Mth;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.GameRules;

import java.util.Comparator;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.LinkedHashSet;
import java.util.Set;

public final class SnowWarEngine {
    private static final double APPROACH_DISTANCE_SQR = 10.0 * 10.0;
    private static final double FIGHTER_THROW_RANGE_SQR = 35.0 * 35.0;
    private static final double HOST_THROW_RANGE_SQR = 25.0 * 25.0;
    private final SnowWarState state = new SnowWarState();
    private final SnowWarPowers powers = new SnowWarPowers();
    private long tick;
    private long snowstormUntil;
    private long snowstormImpactAt;
    private int snowstormWavesLeft;
    private String snowstormOwner = "";
    private String snowstormProfile = "";
    private long winnerDeadline;
    private int lastCountdownSecond = -1;
    private String winnerName = "";
    private String winnerProfile = "";
    private int winnerDelaySeconds = 10;
    private long fixedDayTime = 12750L;
    private long snowballsThrown;
    private long movingSnowballsThrown;
    private final Map<String, Integer> groupSlots = new HashMap<>();
    private final Map<String, BlockPos> groupAnchors = new HashMap<>();
    private final java.util.Deque<PendingAction> pendingActions = new java.util.ArrayDeque<>();
    private record PendingAction(String action, String name, String profile, int count, int seconds) { }
    private static final String[] WORLD_DEADLINES = {
        "mng_frozen_until", "mng_power_damage_until", "mng_snow_gun_until", "mng_spawn_protected_until"
    };

    public SnowWarState state() { return state; }
    public long snowballsThrown() { return snowballsThrown; }
    public long movingSnowballsThrown() { return movingSnowballsThrown; }
    public int winnerCountdownSeconds() {
        return winnerDeadline <= 0 ? 0 : Math.max(0, (int)Math.ceil((winnerDeadline - tick) / 20.0));
    }
    public SnowWarPowers powers() { return powers; }
    public void setWinnerDelaySeconds(int seconds) { winnerDelaySeconds = Math.max(1, Math.min(120, seconds)); }

    public void setTimeMode(MinecraftServer server, String mode) {
        fixedDayTime = switch (mode == null ? "sunset" : mode) {
            case "day" -> 1000L;
            case "night" -> 18000L;
            default -> 12750L;
        };
        applyFixedTime(server);
    }

    public void audience(ServerPlayer host, String username, String profile, boolean liked) {
        String name = username == null || username.isBlank() ? "Izleyici" : username.replaceFirst("^@", "");
        ServerLevel level = host.serverLevel();
        SnowFighterEntity spectator = level.getEntitiesOfClass(SnowFighterEntity.class,
            new net.minecraft.world.phys.AABB(-125, level.getMinBuildHeight(), -125, 125,
                level.getMaxBuildHeight(), 125), e -> e.isAudience()
                && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name))
            .stream().findFirst().orElse(null);
        if (spectator == null) {
            spectator = com.tikmng.snowwar.SnowWar.FIGHTER.get().create(level);
            if (spectator == null) return;
            int hash = name.toLowerCase(Locale.ROOT).hashCode();
            int side = Math.floorMod(hash, 4);
            int along = Math.floorMod(hash / 7, 171) - 85;
            int x = side < 2 ? (side == 0 ? -103 : 103) : along;
            int z = side >= 2 ? (side == 2 ? -103 : 103) : along;
            int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z);
            spectator.moveTo(x + 0.5, y, z + 0.5, side == 0 ? -90 : side == 1 ? 90 : side == 2 ? 0 : 180, 0);
            spectator.setAudience(true);
            spectator.setNoAi(true);
            spectator.setInvulnerable(true);
            spectator.setPersistenceRequired();
            spectator.setCustomName(Component.literal("@" + name));
            spectator.setCustomNameVisible(true);
            spectator.setProfileUrl(profile == null ? "" : profile);
            spectator.getPersistentData().putBoolean("mng_snow_audience", true);
            spectator.getPersistentData().putString("mng_viewer_name", name);
            spectator.getPersistentData().putString("mng_profile", profile == null ? "" : profile);
            level.addFreshEntity(spectator);
        } else if (profile != null && !profile.isBlank()) {
            spectator.setProfileUrl(profile);
            spectator.getPersistentData().putString("mng_profile", profile);
        }
        if (liked) {
            spectator.beginLike();
            spectator.setDeltaMovement(0, 0.38, 0);
            spectator.hurtMarked = true;
            level.sendParticles(net.minecraft.core.particles.ParticleTypes.HEART,
                spectator.getX(), spectator.getY() + 2.3, spectator.getZ(), 6, 0.35, 0.25, 0.35, 0.03);
        }
    }

    public ViewerFighter join(ServerPlayer host, String viewerId, String name, String profile) {
        ViewerFighter fighter = state.fighter(viewerId, name, profile);
        Entity old = fighter.entityId() == null ? null : host.serverLevel().getEntity(fighter.entityId());
        if (old == null || !old.isAlive()) {
            spawn(host, fighter);
        }
        if (winnerDeadline > 0 && !winnerName.equalsIgnoreCase(fighter.displayName())) clearWinnerCountdown(host);
        return fighter;
    }

    public void toggle(ServerPlayer host) {
        if (state.started() && !state.paused()) stop(host);
        else start(host);
    }

    public void start(ServerPlayer host) {
        if (!state.start()) return;
        long frozenUntil = host.getPersistentData().getLong("mng_frozen_until");
        if (state.running() && frozenUntil > host.serverLevel().getGameTime())
            host.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.MOVEMENT_SLOWDOWN,
                (int)Math.min(2400, frozenUntil - host.serverLevel().getGameTime()), 10, false, true));
        syncBattleState(host);
        int seconds = winnerDeadline > 0 ? Math.max(0, (int)Math.ceil((winnerDeadline - tick) / 20.0))
            : state.startCountdownSeconds();
        host.sendSystemMessage(Component.literal("MNG_SNOW_COUNTDOWN|" + seconds));
        host.displayClientMessage(Component.literal(state.running()
            ? "Kartopu savaşı devam ediyor." : "Kartopu savaşı 10 saniyelik geri sayımdan sonra başlayacak."), false);
    }

    public void stop(ServerPlayer host) {
        state.stop();
        syncBattleState(host);
        host.removeEffect(net.minecraft.world.effect.MobEffects.MOVEMENT_SLOWDOWN);
        for (Mob mob : host.serverLevel().getEntitiesOfClass(Mob.class, host.getBoundingBox().inflate(240),
                SnowWarEngine::isCombatant)) {
            mob.getNavigation().stop();
            mob.setTarget(null);
            mob.setDeltaMovement(net.minecraft.world.phys.Vec3.ZERO);
        }
        for (Entity entity : entitySnapshot(host.serverLevel())) {
            if (entity instanceof Snowball snowball
                    && snowball.getPersistentData().getBoolean("mng_snow_projectile")) snowball.discard();
        }
        host.displayClientMessage(Component.literal("Savaş duraklatıldı. Devam etmek için P."), false);
    }

    private void syncBattleState(ServerPlayer host) {
        host.sendSystemMessage(Component.literal("MNG_SNOW_STATE|" + (state.paused() ? "PAUSED"
            : state.running() ? "RUNNING" : state.started() ? "COUNTDOWN" : "WAITING")));
    }

    public boolean freezeLiving(LivingEntity entity) {
        return !state.running() && (isCombatant(entity)
            || entity.getPersistentData().getBoolean("mng_snow_audience"));
    }

    public void applyAction(ServerPlayer host, String action, String username, String profile, int count) {
        applyAction(host, action, username, profile, count, 10);
    }

    public void applyAction(ServerPlayer host, String action, String username, String profile, int count, int durationSeconds) {
        int quantity = Math.max(1, Math.min(100, count));
        int seconds = Math.max(1, Math.min(120, durationSeconds));
        String name = username == null || username.isBlank() ? "Izleyici" : username.replaceFirst("^@", "");
        // Keep offensive gifts received while waiting/paused, without advancing combat.
        if (!state.running() && Set.of("BUZ_TUZAGI", "KAR_HORTUMU", "CIG", "HERKESI_DUSUR").contains(action)) {
            pendingActions.addLast(new PendingAction(action, name, profile, quantity, seconds));
            return;
        }
        switch (action) {
            case "BUZ_TUZAGI" -> {
                powers.cast(host, this, action, name, profile, quantity, seconds);
                notifyTimedEffect(host, action, "Herkesi dondur", seconds);
            }
            case "KAR_HORTUMU" -> {
                powers.cast(host, this, action, name, profile, quantity, seconds);
                notifyTimedEffect(host, action, "Kar hortumu", seconds);
            }
            case "KARTOPU_SILAHI", "INTIKAM" -> {
                grantSnowGun(host, name, profile, quantity, seconds);
                notifyTimedEffect(host, "KARTOPU_SILAHI", "Kartopu silahı", seconds);
            }
            case "OYUNCU", "OYUNCU_1" -> addFighters(host, name, profile, quantity, 10.0);
            case "OYUNCU_5" -> addFighters(host, name, profile, quantity * 5, 10.0);
            case "OYUNCU_10" -> addFighters(host, name, profile, quantity * 10, 10.0);
            case "OYUNCU_20" -> addFighters(host, name, profile, quantity * 20, 10.0);
            case "OYUNCU_30" -> addFighters(host, name, profile, quantity * 30, 10.0);
            case "OYUNCU_40" -> addFighters(host, name, profile, quantity * 40, 10.0);
            case "OYUNCU_AZALT" -> removeFighters(host, name, quantity);
            case "KAR_ADAMI" -> spawnSnowBoss(host, name, profile, quantity, 20.0, 40.0, 1.0F, "Normal Kardan Adam");
            case "AGIR_KARTOPU" -> spawnSnowBoss(host, name, profile, quantity, 20.0, 50.0, 1.43F, "Dev Kardan Adam");
            case "EKSTRA_CAN" -> addBonusHits(host, name, profile, 1);
            case "IYILESTIR" -> stoneSnowballs(host, name, profile);
            case "TAKIM_KALKANI", "TAKIM_GUCU" -> addShieldedFighters(host, name, profile, quantity);
            case "CIG" -> snowstorm(host, name, profile, quantity);
            case "HERKESI_DUSUR" -> killEveryoneExcept(host, name, profile, durationSeconds);
            case "BUYU" -> {
                addBonusHits(host, name, profile, quantity);
                strengthenTeam(host, name, profile, quantity, seconds, true);
                notifyTimedEffect(host, action, "Can ve güç artır", seconds);
            }
            default -> addFighters(host, name, profile, quantity, 3.0);
        }
    }

    public void tick(MinecraftServer server) {
        if (server.getTickCount() % 10 == 0) applyFixedTime(server);
        tickProjectiles(server);
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        ServerLevel level = host.serverLevel();
        if (!state.running()) {
            preserveEffectDeadlines(server);
            powers.pauseTick();
        }
        if (state.paused()) return;
        int previousCountdown = state.startCountdownSeconds();
        state.tickStartCountdown();
        if (previousCountdown != state.startCountdownSeconds()) {
            host.sendSystemMessage(Component.literal("MNG_SNOW_COUNTDOWN|" + state.startCountdownSeconds()));
            if (state.running()) {
                syncBattleState(host);
                host.displayClientMessage(Component.literal("Kartopu savaşı başladı!"), false);
            }
        }
        if (!state.running()) return;
        tick++;
        while (!pendingActions.isEmpty()) {
            PendingAction action = pendingActions.removeFirst();
            applyAction(host, action.action(), action.name(), action.profile(), action.count(), action.seconds());
        }
        updateWinnerCandidate(host);
        powers.tick(host, this);
        if (state.running()) {
            for (Mob mob : level.getEntitiesOfClass(Mob.class, host.getBoundingBox().inflate(180),
                    e -> e.isAlive() && isCombatant(e))) tickBattleMob(mob);
            updateWinnerCandidate(host);
        }
        if (tick < snowstormUntil && tick % 5 == 0) {
            for (int i = 0; i < 18; i++) {
                double x = host.getX() + host.getRandom().nextDouble() * 90.0 - 45.0;
                double z = host.getZ() + host.getRandom().nextDouble() * 90.0 - 45.0;
                level.sendParticles(net.minecraft.core.particles.ParticleTypes.SNOWFLAKE,
                    x, host.getY() + 12 + host.getRandom().nextDouble() * 14.0, z, 28, 2.5, 6.0, 2.5, 0.09);
            }
        }
        if (snowstormImpactAt > 0 && tick >= snowstormImpactAt) {
            impactSnowstorm(host);
            snowstormWavesLeft = 0;
            snowstormImpactAt = 0;
        }
        tickWinner(host);
    }

    private static void preserveEffectDeadlines(MinecraftServer server) {
        for (ServerLevel level : server.getAllLevels()) {
            for (Entity entity : level.getAllEntities()) {
                if (!(entity instanceof Player) && !isCombatant(entity)) continue;
                for (String key : WORLD_DEADLINES) {
                    long deadline = entity.getPersistentData().getLong(key);
                    if (deadline >= level.getGameTime() && deadline > 0)
                        entity.getPersistentData().putLong(key, deadline + 1);
                }
            }
        }
    }

    private void applyFixedTime(MinecraftServer server) {
        for (ServerLevel level : server.getAllLevels()) {
            level.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, server);
            level.setDayTime(fixedDayTime);
        }
    }

    private static void notifyTimedEffect(ServerPlayer host, String id, String label, int seconds) {
        String encoded = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            label.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        host.sendSystemMessage(Component.literal("MNG_SNOW_EFFECT|" + id + "|" + encoded + "|" + seconds));
    }

    private static boolean isCombatant(Entity entity) {
        return entity.getPersistentData().getBoolean("mng_snow_fighter")
            || entity.getPersistentData().getBoolean("mng_snow_boss");
    }

    public static boolean isArenaCombatant(Entity entity) { return isCombatant(entity); }

    private static boolean sameTeam(Entity a, Entity b) {
        return isCombatant(a) && isCombatant(b) && a.getPersistentData().getString("mng_viewer_name")
            .equalsIgnoreCase(b.getPersistentData().getString("mng_viewer_name"));
    }

    private void tickBattleMob(Mob mob) {
        long powerUntil = mob.getPersistentData().getLong("mng_power_damage_until");
        if (powerUntil > 0 && mob.level().getGameTime() >= powerUntil) {
            mob.getPersistentData().putDouble("mng_snow_damage",
                Math.max(10.0, mob.getPersistentData().getDouble("mng_base_snow_damage")));
            mob.getPersistentData().remove("mng_power_damage_until");
        }
        double safeX = Mth.clamp(mob.getX(), -91.0, 91.0);
        double safeZ = Mth.clamp(mob.getZ(), -91.0, 91.0);
        if (safeX != mob.getX() || safeZ != mob.getZ()) {
            mob.teleportTo(safeX, mob.getY(), safeZ);
            mob.getNavigation().stop();
        }
        if (mob.level().getGameTime() < mob.getPersistentData().getLong("mng_frozen_until")) {
            mob.getNavigation().stop();
            mob.setTarget(null);
            mob.getPersistentData().remove("mng_throw_at");
            return;
        }
        if (tick % 10 == 0 || mob.getTarget() == null || !mob.getTarget().isAlive()) {
            // Viewer armies fight rival viewer armies first. Only the final surviving side may target the host.
            LivingEntity nearest = mob.level().getEntitiesOfClass(LivingEntity.class,
                mob.getBoundingBox().inflate(220), other -> other != mob && other.isAlive()
                    && isCombatant(other) && !sameTeam(mob, other))
                .stream().min(Comparator.comparingDouble(mob::distanceToSqr)).orElse(null);
            if (nearest == null && (mob instanceof SnowBeastEntity
                    || hasSingleRemainingTeam((ServerLevel)mob.level()))) {
                nearest = mob.level().getEntitiesOfClass(Player.class, mob.getBoundingBox().inflate(220),
                    other -> other.isAlive()).stream().min(Comparator.comparingDouble(mob::distanceToSqr)).orElse(null);
            }
            if (nearest != mob.getTarget()) mob.getPersistentData().remove("mng_throw_at");
            mob.setTarget(nearest);
        }
        LivingEntity target = mob.getTarget();
        if (target == null) { mob.getNavigation().stop(); return; }
        double dx = target.getX() - mob.getX(), dz = target.getZ() - mob.getZ();
        float desiredYaw = (float)(Math.toDegrees(Math.atan2(dz, dx)) - 90.0);
        float yaw = Mth.approachDegrees(mob.getYRot(), desiredYaw, 22.0F);
        mob.setYRot(yaw);
        mob.setYBodyRot(yaw);
        mob.setYHeadRot(yaw);
        mob.getLookControl().setLookAt(target, 30, 30);
        double distanceSq = mob.distanceToSqr(target);
        if (tick % 10 == 0) {
            if (distanceSq > APPROACH_DISTANCE_SQR) mob.getNavigation().moveTo(target, 0.96);
            else mob.getNavigation().stop();
        }
        double throwRange = target instanceof Player ? HOST_THROW_RANGE_SQR : FIGHTER_THROW_RANGE_SQR;
        boolean canThrow = distanceSq <= throwRange
            && mob.hasLineOfSight(target)
            && Math.abs(Mth.wrapDegrees(yaw - desiredYaw)) < 28;
        long throwAt = mob.getPersistentData().getLong("mng_throw_at");
        if (!canThrow) { mob.getPersistentData().remove("mng_throw_at"); return; }
        if (throwAt > 0 && tick >= throwAt) {
            mob.getPersistentData().remove("mng_throw_at");
            throwSnowball(mob, target);
        } else if (throwAt == 0 && tick >= mob.getPersistentData().getLong("mng_snow_cooldown")) {
            mob.getPersistentData().putLong("mng_throw_at", tick + 10);
            if (mob instanceof SnowFighterEntity fighter) fighter.beginThrow();
            if (mob instanceof SnowBeastEntity beast) beast.beginThrow();
            mob.swing(InteractionHand.MAIN_HAND, true);
        }
    }

    public void hitBySnowball(Snowball snowball, LivingEntity target) {
        if (!(target.getPersistentData().getBoolean("mng_snow_fighter")
                || target.getPersistentData().getBoolean("mng_snow_boss") || target instanceof Player)) return;
        Entity owner = snowball.getOwner();
        if (owner == null && snowball.getPersistentData().hasUUID("mng_owner_uuid")) {
            if (snowball.level() instanceof ServerLevel serverLevel) {
                UUID ownerId = snowball.getPersistentData().getUUID("mng_owner_uuid");
                owner = serverLevel.getServer().getPlayerList().getPlayer(ownerId);
                if (owner == null) owner = serverLevel.getEntity(ownerId);
            }
        }
        if (owner == null || owner == target) return;
        if (!state.running()) return;
        if (sameTeam(owner, target)) return;
        if (target instanceof Player playerTarget && playerTarget.getAbilities().flying) return;
        if (target instanceof Player && !(owner instanceof Player)
                && owner.distanceToSqr(target) > HOST_THROW_RANGE_SQR) return;
        if (target instanceof Player && !(owner instanceof Player)
                && !(owner instanceof SnowBeastEntity)
                && !hasSingleRemainingTeam((ServerLevel)target.level())) return;
        if (!(owner instanceof Player) && !owner.getPersistentData().getBoolean("mng_snow_fighter")
                && !owner.getPersistentData().getBoolean("mng_snow_boss")) return;
        if (target instanceof Player player && player.level().getGameTime()
                < player.getPersistentData().getLong("mng_spawn_protected_until")) return;
        int bonusHits = target.getPersistentData().getInt("mng_bonus_hits");
        if (bonusHits > 0) {
            int remaining = bonusHits - 1;
            target.getPersistentData().putInt("mng_bonus_hits", remaining);
            if (remaining == 0) target.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
            target.level().playSound(null, target.blockPosition(), remaining == 0
                    ? SoundEvents.SHIELD_BREAK : SoundEvents.SHIELD_BLOCK,
                SoundSource.PLAYERS, effectVolume((ServerLevel)target.level(), 1.2F), 1.1F);
            return;
        }
        boolean playerGun = owner instanceof Player && snowball.getPersistentData().getBoolean("mng_snow_gun");
        double damage = owner instanceof Player ? (playerGun ? 15.0 : Math.max(1000.0, target.getMaxHealth()))
            : Math.max(10.0, snowball.getPersistentData().getDouble("mng_snow_damage"));
        if (target instanceof Player && !(owner instanceof Player))
            damage = owner instanceof SnowBeastEntity ? 1.0 : 10.0;
        if (!(owner instanceof LivingEntity)) return;
        boolean died = false;
        if (target instanceof ServerPlayer player) {
            if (player.getHealth() <= damage) notifyDeath(player, owner);
            player.setHealth(Math.max(0.0F, player.getHealth() - (float)damage));
            died = player.getHealth() <= 0;
        }
        else {
            float next = Math.max(0.0F, target.getHealth() - (float)damage);
            target.setHealth(next);
            died = next <= 0.0F;
        }
        ServerLevel hitLevel = (ServerLevel)target.level();
        hitLevel.broadcastEntityEvent(target, (byte)2);
        hitLevel.sendParticles(net.minecraft.core.particles.ParticleTypes.SNOWFLAKE,
            target.getX(), target.getY() + target.getBbHeight() * 0.6, target.getZ(),
            22, 0.42, 0.55, 0.42, 0.12);
        hitLevel.sendParticles(new net.minecraft.core.particles.DustParticleOptions(
                new org.joml.Vector3f(1.0F, 0.04F, 0.08F), 1.15F),
            target.getX(), target.getY() + target.getBbHeight() * 0.65, target.getZ(),
            10, 0.32, 0.42, 0.32, 0.04);
        hitLevel.sendParticles(new net.minecraft.core.particles.ItemParticleOption(
                net.minecraft.core.particles.ParticleTypes.ITEM, new ItemStack(Items.SNOWBALL)),
            target.getX(), target.getY() + target.getBbHeight() * 0.55, target.getZ(),
            14, 0.38, 0.38, 0.38, 0.15);
        target.level().playSound(null, target.blockPosition(), SoundEvents.SNOW_BREAK, SoundSource.PLAYERS,
            effectVolume((ServerLevel)target.level(), 0.7F), 1.15F);
        if (died || !target.isAlive()) {
            owner.getPersistentData().putInt("mng_snow_kills", owner.getPersistentData().getInt("mng_snow_kills") + 1);
            notifyKill(target.level(), displayName(owner), displayName(target));
            if (isCombatant(target)) target.discard();
        }
    }

    private void tickProjectiles(MinecraftServer server) {
        for (ServerLevel level : server.getAllLevels()) {
            for (Entity raw : entitySnapshot(level)) {
                if (!(raw instanceof Snowball snowball) || !snowball.isAlive()
                        || !snowball.getPersistentData().getBoolean("mng_snow_projectile")) continue;
                Entity owner = snowball.getOwner();
                if (!state.running()) {
                    snowball.discard();
                    continue;
                }
                if (owner == null) continue;
                if (snowball.tickCount > 180 || snowball.position().distanceToSqr(new net.minecraft.world.phys.Vec3(
                        snowball.getPersistentData().getDouble("mng_origin_x"),
                        snowball.getPersistentData().getDouble("mng_origin_y"),
                        snowball.getPersistentData().getDouble("mng_origin_z"))) > 48400) {
                    snowball.discard();
                    continue;
                }
                if (snowball.getDeltaMovement().lengthSqr() > 0.01)
                    snowball.setDeltaMovement(snowball.getDeltaMovement().normalize().scale(1.58));
                net.minecraft.world.phys.AABB flightPath = snowball.getBoundingBox()
                    .expandTowards(snowball.getDeltaMovement().scale(-1.0)).inflate(0.18);
                LivingEntity target = level.getEntitiesOfClass(LivingEntity.class,
                    flightPath, other -> other.isAlive() && other != owner
                        && (other instanceof Player || other.getPersistentData().getBoolean("mng_snow_fighter")
                            || other.getPersistentData().getBoolean("mng_snow_boss"))
                        && !sameTeam(owner, other)
                        && other.getBoundingBox().inflate(0.18).clip(snowball.position().subtract(
                            snowball.getDeltaMovement()), snowball.position()).isPresent())
                    .stream().min(Comparator.comparingDouble(snowball::distanceToSqr)).orElse(null);
                if (target != null) {
                    hitBySnowball(snowball, target);
                    snowball.discard();
                }
            }
        }
    }

    private java.util.List<LivingEntity> addFighters(ServerPlayer host, String name, String profile, int count, double damage) {
        if (winnerDeadline > 0 && !winnerName.equalsIgnoreCase(name)) clearWinnerCountdown(host);
        int available = Math.max(0, 2000 - currentCombatantCount(host.serverLevel()));
        int safeCount = Math.max(0, Math.min(Math.min(100, count), available));
        java.util.List<LivingEntity> spawned = new java.util.ArrayList<>();
        for (int i = 0; i < safeCount; i++) {
            String id = name.toLowerCase(java.util.Locale.ROOT) + ":" + UUID.randomUUID();
            ViewerFighter fighter = state.fighter(id, name, profile);
            spawn(host, fighter);
            Entity entity = fighter.entityId() == null ? null : host.serverLevel().getEntity(fighter.entityId());
            if (entity instanceof LivingEntity living) {
                living.getPersistentData().putDouble("mng_snow_damage", Math.max(10.0, damage));
                spawned.add(living);
            }
        }
        host.displayClientMessage(Component.literal("@" + name + " savaşa " + safeCount + " kartopu savaşçısıyla katıldı."), false);
        return spawned;
    }

    private void removeFighters(ServerPlayer host, String name, int count) {
        int removed = 0;
        for (ViewerFighter fighter : java.util.List.copyOf(state.fighters())) {
            if (!fighter.displayName().equalsIgnoreCase(name) || removed >= count) continue;
            Entity entity = fighter.entityId() == null ? null : host.serverLevel().getEntity(fighter.entityId());
            if (entity == null || !entity.isAlive()) { state.remove(fighter.viewerId()); continue; }
            entity.discard();
            state.remove(fighter.viewerId());
            removed++;
        }
        host.displayClientMessage(Component.literal("@" + name + " savaşçılarından " + removed + " kişi ayrıldı."), false);
    }

    private void spawnSnowBoss(ServerPlayer host, String name, String profile, int count,
                               double damage, double health, float scale, String title) {
        ServerLevel level = host.serverLevel();
        int safeCount = Math.max(0, Math.min(Math.min(count, 50), 2000 - currentCombatantCount(level)));
        for (int i = 0; i < safeCount; i++) {
            SnowBeastEntity boss = com.tikmng.snowwar.SnowWar.BEAST.get().create(level);
            if (boss == null) continue;
            double angle = Math.floorMod((name + i).hashCode(), 360) * Math.PI / 180.0;
            int x = (int)Math.round(Math.cos(angle) * (48 + i % 4 * 3));
            int z = (int)Math.round(Math.sin(angle) * (48 + i % 4 * 3));
            int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z);
            boss.moveTo(x + 0.5, y, z + 0.5, 0, 0);
            boss.setPersistenceRequired();
            boss.setCustomName(Component.literal(title + " · @" + name));
            boss.setCustomNameVisible(true);
            boss.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.SNOWBALL));
            boss.setDropChance(EquipmentSlot.MAINHAND, 0);
            boss.getPersistentData().putBoolean("mng_snow_boss", true);
            boss.getPersistentData().putString("mng_viewer_name", name);
            boss.getPersistentData().putString("mng_profile", profile == null ? "" : profile);
            boss.getPersistentData().putDouble("mng_snow_damage", damage);
            boss.getPersistentData().putDouble("mng_base_snow_damage", damage);
            boss.getPersistentData().putFloat("mng_render_scale", scale);
            boss.setProfileUrl(profile == null ? "" : profile);
            boss.setRenderScale(scale);
            if (boss.getAttribute(Attributes.MAX_HEALTH) != null) {
                boss.getAttribute(Attributes.MAX_HEALTH).setBaseValue(health);
                boss.setHealth((float)health);
            }
            level.addFreshEntity(boss);
        }
        level.playSound(null, host.blockPosition(), scale > 1.1F ? SoundEvents.RAVAGER_ROAR
                : SoundEvents.SNOW_GOLEM_SHOOT, SoundSource.HOSTILE,
            effectVolume(level, scale > 1.1F ? 2.8F : 1.8F), scale > 1.1F ? 0.62F : 0.85F);
    }

    public void resetSession(ServerPlayer host) {
        state.reset();
        pendingActions.clear();
        syncBattleState(host);
        host.sendSystemMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"));
        powers.reset();
        snowstormUntil = 0;
        snowstormImpactAt = 0;
        snowstormWavesLeft = 0;
        snowstormProfile = "";
        clearWinnerCountdown(host);
        groupSlots.clear();
        groupAnchors.clear();
        for (LivingEntity entity : host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                host.getBoundingBox().inflate(240), e -> e.getPersistentData().getBoolean("mng_snow_fighter")
                    || e.getPersistentData().getBoolean("mng_snow_boss")
                    || e.getPersistentData().getBoolean("mng_snow_audience")))
            entity.discard();
    }

    private void addBonusHits(ServerPlayer host, String name, String profile, int amount) {
        boolean found = false;
        for (LivingEntity living : host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                host.getBoundingBox().inflate(240), e -> isCombatant(e)
                    && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name))) {
            if (living.getAttribute(Attributes.MAX_HEALTH) != null) {
                double added = Math.min(1000.0, amount * 10.0);
                living.getAttribute(Attributes.MAX_HEALTH).setBaseValue(
                    Math.min(1000.0, living.getMaxHealth() + added));
                living.setHealth(Math.min(living.getMaxHealth(), living.getHealth() + (float)added));
            }
            found = true;
        }
        if (!found) {
            addFighters(host, name, profile, 1, 10.0);
            addBonusHits(host, name, profile, amount);
            return;
        }
        host.displayClientMessage(Component.literal("@" + name + " takımına " + amount
            + " ek darbe hakkı eklendi."), false);
    }

    private void strengthenTeam(ServerPlayer host, String name, String profile, int amount,
                                int durationSeconds, boolean combined) {
        java.util.List<LivingEntity> team = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-96, host.serverLevel().getMinBuildHeight(), -96, 96,
                host.serverLevel().getMaxBuildHeight(), 96), e -> isCombatant(e)
                && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name));
        if (team.isEmpty()) {
            addFighters(host, name, profile, 1, 10.0);
            team = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                new net.minecraft.world.phys.AABB(-96, host.serverLevel().getMinBuildHeight(), -96, 96,
                    host.serverLevel().getMaxBuildHeight(), 96), e -> isCombatant(e)
                    && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name));
        }
        for (LivingEntity living : team) {
            double current = Math.max(10, living.getPersistentData().getDouble("mng_snow_damage"));
            if (!living.getPersistentData().contains("mng_base_snow_damage"))
                living.getPersistentData().putDouble("mng_base_snow_damage", current);
            living.getPersistentData().putDouble("mng_snow_damage", Math.max(15, current));
            living.getPersistentData().putLong("mng_power_damage_until", Math.max(
                host.serverLevel().getGameTime() + Math.max(1, durationSeconds) * 20L,
                living.getPersistentData().getLong("mng_power_damage_until")));
            if (living instanceof SnowFighterEntity fighter) {
                fighter.setVisualScale(fighter.visualScale() + Math.min(0.30F, amount * 0.06F));
            }
        }
        host.displayClientMessage(Component.literal("@" + name + " takımı güçlendi"
            + (combined ? ": +1 kalp, 1,5 kalp hasar ve boyut" : ": 1,5 kalp hasar ve boyut")
            + " · " + durationSeconds + " saniye."), false);
    }

    private void addShieldedFighters(ServerPlayer host, String name, String profile, int amount) {
        java.util.List<LivingEntity> fighters = addFighters(host, name, profile, amount, 10.0);
        for (LivingEntity living : fighters) {
            living.getPersistentData().putInt("mng_bonus_hits", 1);
            living.setItemSlot(EquipmentSlot.OFFHAND, new ItemStack(Items.SHIELD));
        }
        host.serverLevel().playSound(null, host.blockPosition(), SoundEvents.ARMOR_EQUIP_IRON,
            SoundSource.PLAYERS, effectVolume(host.serverLevel(), 1.4F), 1.1F);
        host.displayClientMessage(Component.literal("@" + name + " için " + fighters.size()
            + " kalkanlı kartopu savaşçısı geldi."), false);
    }

    private void grantSnowGun(ServerPlayer host, String name, String profile, int amount, int seconds) {
        long until = host.serverLevel().getGameTime() + seconds * 20L;
        java.util.List<LivingEntity> team = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-96, host.serverLevel().getMinBuildHeight(), -96, 96,
                host.serverLevel().getMaxBuildHeight(), 96), e -> isCombatant(e)
                && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name));
        if (team.isEmpty()) {
            addFighters(host, name, profile, 1, 10.0);
            team = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                new net.minecraft.world.phys.AABB(-96, host.serverLevel().getMinBuildHeight(), -96, 96,
                    host.serverLevel().getMaxBuildHeight(), 96), e -> isCombatant(e)
                    && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name));
        }
        int armed = 0;
        for (LivingEntity living : team) {
            living.getPersistentData().putLong("mng_snow_gun_until",
                Math.max(until, living.getPersistentData().getLong("mng_snow_gun_until")));
            armed++;
        }
        host.getPersistentData().putLong("mng_snow_gun_until",
            Math.max(until, host.getPersistentData().getLong("mng_snow_gun_until")));
        host.setItemInHand(InteractionHand.MAIN_HAND, snowballStack(true));
        host.displayClientMessage(Component.literal("@" + name + " kartopu silahını " + seconds
            + " saniye etkinleştirdi: " + armed + " savaşçı + yayıncı."), false);
    }

    private static ItemStack snowballStack(boolean gun) {
        ItemStack stack = new ItemStack(gun ? Items.CROSSBOW : Items.SNOWBALL, gun ? 1 : 16);
        if (gun) {
            stack.getOrCreateTag().putBoolean("mng_snow_gun", true);
            stack.setHoverName(Component.literal("Sınırsız Kartopu Silahı"));
        }
        return stack;
    }

    private void snowstorm(ServerPlayer host, String name, String profile, int waves) {
        ServerLevel level = host.serverLevel();
        snowstormOwner = name;
        snowstormProfile = profile == null ? "" : profile;
        snowstormImpactAt = tick + 35;
        snowstormWavesLeft = 1;
        snowstormUntil = Math.max(snowstormUntil, tick + 45);
        for (LivingEntity entity : arenaCombatants(level, host)) {
            if (belongsTo(entity, name)) continue;
            level.sendParticles(net.minecraft.core.particles.ParticleTypes.CLOUD, entity.getX(), entity.getY() + 10,
                entity.getZ(), 90, 2.8, 1.5, 2.8, 0.08);
        }
        level.playSound(null, host.blockPosition(), SoundEvents.LIGHTNING_BOLT_THUNDER, SoundSource.WEATHER,
            effectVolume(level, 5.0F), 0.55F);
        host.displayClientMessage(Component.literal("@" + name + " Kar Fırtınası (Yıldırım) çağırdı!"), false);
    }

    private void impactSnowstorm(ServerPlayer host) {
        ServerLevel level = host.serverLevel();
        for (LivingEntity entity : arenaCombatants(level, host)) {
            if (belongsTo(entity, snowstormOwner)) continue;
            if (entity instanceof Player player && player.getAbilities().flying) continue;
            for (int strike = 0; strike < 3; strike++) {
                var bolt = EntityType.LIGHTNING_BOLT.create(level);
                if (bolt != null) {
                    double offsetX = (strike - 1) * 0.45;
                    double offsetZ = (1 - strike) * 0.35;
                    bolt.moveTo(entity.getX() + offsetX, entity.getY(), entity.getZ() + offsetZ);
                    bolt.setVisualOnly(true);
                    level.addFreshEntity(bolt);
                }
            }
            level.sendParticles(net.minecraft.core.particles.ParticleTypes.SNOWFLAKE,
                entity.getX(), entity.getY() + 6, entity.getZ(), 260, 4.0, 10.0, 4.0, 0.15);
            float remaining = entity instanceof Player ? 1.0F : entity instanceof SnowBeastEntity beast
                ? (beast.renderScale() > 1.1F ? 20.0F : 10.0F) : 5.0F;
            entity.setHealth(Math.min(entity.getHealth(), remaining));
        }
        level.playSound(null, host.blockPosition(), SoundEvents.GENERIC_EXPLODE, SoundSource.WEATHER,
            effectVolume(level, 3.0F), 0.65F);
    }

    private void notifyDeath(ServerPlayer player, Entity owner) {
        String name = owner.getPersistentData().getString("mng_viewer_name");
        String profile = owner.getPersistentData().getString("mng_profile");
        if (name.isBlank()) name = owner.getName().getString().replaceFirst("^@", "");
        notifyDeath(player, name, profile);
    }

    private void notifyDeath(ServerPlayer player, String name, String profile) {
        String encodedProfile = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString(profile.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        player.sendSystemMessage(Component.literal("MNG_SNOW_DEATH|" + name + "|" + encodedProfile));
    }

    public void damageFromPower(LivingEntity target, String owner, String profile, float damage) {
        if (!state.running()) return;
        if (target instanceof ServerPlayer player) {
            if (player.getAbilities().flying) return;
            if (player.level().getGameTime() < player.getPersistentData().getLong("mng_spawn_protected_until")) return;
            if (player.getHealth() <= damage) notifyDeath(player, owner, profile);
            player.setHealth(Math.max(0.0F, player.getHealth() - damage));
            return;
        }
        target.hurt(target.level().damageSources().magic(), damage);
    }

    private void killEveryoneExcept(ServerPlayer host, String name, String profile, int countdownSeconds) {
        ServerLevel level = host.serverLevel();
        ensureTeam(host, name, profile);
        updateWinnerCandidate(host);
        for (LivingEntity living : arenaCombatants(level, host)) {
            if (living == host || belongsTo(living, name)) continue;
            living.setHealth(0.0F);
            living.discard();
        }
        host.displayClientMessage(Component.literal("@" + name
            + " rakip savaşçıları düşürdü."), false);
        updateWinnerCandidate(host);
    }

    private void stoneSnowballs(ServerPlayer host, String name, String profile) {
        ensureTeam(host, name, profile);
        applyToName(host, name, living -> living.getPersistentData().putInt("mng_stone_shots", 1));
        host.displayClientMessage(Component.literal("@" + name
            + " takımının her savaşçısına tek kullanımlık taşlı kartopu verildi."), false);
    }

    private void ensureTeam(ServerPlayer host, String name, String profile) {
        boolean found = host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-96, host.serverLevel().getMinBuildHeight(), -96, 96,
                host.serverLevel().getMaxBuildHeight(), 96), e -> isCombatant(e) && belongsTo(e, name)).size() > 0;
        if (!found) addFighters(host, name, profile, 1, 10.0);
    }

    private static boolean belongsTo(LivingEntity entity, String name) {
        return isCombatant(entity) && entity.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name);
    }

    private static java.util.List<LivingEntity> arenaCombatants(ServerLevel level, ServerPlayer host) {
        return level.getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-110, level.getMinBuildHeight(), -110, 110, level.getMaxBuildHeight(), 110),
            e -> e.isAlive() && (e == host || isCombatant(e)));
    }

    private void tickWinner(ServerPlayer host) {
        if (!state.running() || winnerDeadline <= 0) return;
        long remainingTicks = winnerDeadline - tick;
        int seconds = Math.max(0, (int)Math.ceil(remainingTicks / 20.0));
        if (seconds != lastCountdownSecond) {
            lastCountdownSecond = seconds;
            host.sendSystemMessage(Component.literal("MNG_SNOW_COUNTDOWN|" + seconds));
        }
        if (remainingTicks > 0) return;
        boolean winnerAlive = arenaCombatants(host.serverLevel(), host).stream().anyMatch(e -> belongsTo(e, winnerName));
        boolean rivalAlive = arenaCombatants(host.serverLevel(), host).stream().anyMatch(e -> e != host && !belongsTo(e, winnerName));
        if (winnerAlive && !rivalAlive) {
            String encoded = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                winnerProfile.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            host.sendSystemMessage(Component.literal("MNG_SNOW_WINNER|" + winnerName + "|" + encoded));
            clearArenaForNextRound(host);
            return;
        }
        clearWinnerCountdown(host);
    }

    private void clearArenaForNextRound(ServerPlayer host) {
        for (LivingEntity living : java.util.List.copyOf(arenaCombatants(host.serverLevel(), host))) {
            if (living != host && isCombatant(living)) living.discard();
        }
        for (Entity entity : entitySnapshot(host.serverLevel())) {
            if (entity instanceof Snowball snowball
                    && snowball.getPersistentData().getBoolean("mng_snow_projectile")) snowball.discard();
        }
        state.reset();
        pendingActions.clear();
        syncBattleState(host);
        powers.reset();
        snowstormUntil = 0;
        snowstormImpactAt = 0;
        snowstormWavesLeft = 0;
        snowstormOwner = "";
        snowstormProfile = "";
        groupSlots.clear();
        groupAnchors.clear();
        clearWinnerCountdown(host);
        host.displayClientMessage(Component.literal("Yeni kartopu turu hazır. Başlatmak için P tuşuna basın."), false);
    }

    private void updateWinnerCandidate(ServerPlayer host) {
        if (!state.running()) return;
        java.util.List<LivingEntity> alive = arenaCombatants(host.serverLevel(), host).stream()
            .filter(SnowWarEngine::isCombatant).toList();
        Set<String> teams = new LinkedHashSet<>();
        for (LivingEntity entity : alive) {
            String name = entity.getPersistentData().getString("mng_viewer_name");
            if (!name.isBlank()) teams.add(name.toLowerCase(Locale.ROOT));
        }
        if (!state.observeTeams(teams.size())) {
            if (teams.size() > 1 || alive.isEmpty()) clearWinnerCountdown(host);
            return;
        }
        LivingEntity sole = alive.get(0);
        String name = sole.getPersistentData().getString("mng_viewer_name");
        if (winnerDeadline > 0 && winnerName.equalsIgnoreCase(name)) return;
        winnerName = name;
        winnerProfile = sole.getPersistentData().getString("mng_profile");
        host.sendSystemMessage(Component.literal("MNG_SNOW_FINALIST|" + java.util.Base64.getUrlEncoder()
            .withoutPadding().encodeToString(winnerProfile.getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        winnerDeadline = tick + winnerDelaySeconds * 20L;
        lastCountdownSecond = -1;
    }

    private boolean hasSingleRemainingTeam(ServerLevel level) {
        Set<String> teams = new LinkedHashSet<>();
        for (LivingEntity entity : level.getEntitiesOfClass(LivingEntity.class,
                new net.minecraft.world.phys.AABB(-110, level.getMinBuildHeight(), -110, 110,
                    level.getMaxBuildHeight(), 110), e -> e.isAlive() && isCombatant(e))) {
            String name = entity.getPersistentData().getString("mng_viewer_name");
            if (!name.isBlank()) teams.add(name.toLowerCase(Locale.ROOT));
            if (teams.size() > 1) return false;
        }
        return teams.size() == 1;
    }

    private static String displayName(Entity entity) {
        String name = entity.getPersistentData().getString("mng_viewer_name");
        if (name.isBlank()) name = entity instanceof Player ? "Yayıncı" : entity.getName().getString();
        return name.replaceFirst("^@", "");
    }

    private static void notifyKill(net.minecraft.world.level.Level level, String killer, String victim) {
        if (!(level instanceof ServerLevel serverLevel)) return;
        for (ServerPlayer player : serverLevel.players())
            player.sendSystemMessage(Component.literal("MNG_SNOW_KILL|" + killer + "|" + victim));
    }

    private void clearWinnerCountdown(ServerPlayer host) {
        if (winnerDeadline > 0) host.sendSystemMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"));
        winnerDeadline = 0;
        winnerName = "";
        winnerProfile = "";
        lastCountdownSecond = -1;
    }

    private void throwSnowball(Mob shooter, LivingEntity target) {
        if (!shooter.getNavigation().isDone()) movingSnowballsThrown++;
        Snowball snowball = new Snowball(shooter.level(), shooter);
        snowball.setOwner(shooter);
        snowball.setNoGravity(true);
        double handX = -Math.cos(Math.toRadians(shooter.getYRot())) * 0.46;
        double handZ = -Math.sin(Math.toRadians(shooter.getYRot())) * 0.46;
        snowball.setPos(shooter.getX() + handX, shooter.getEyeY() - 0.42, shooter.getZ() + handZ);
        double lead = shooter.distanceTo(target) / 1.58;
        snowball.shoot(target.getX() + target.getDeltaMovement().x * lead - shooter.getX(),
            target.getY() + target.getBbHeight() * 0.65 - snowball.getY(),
            target.getZ() + target.getDeltaMovement().z * lead - shooter.getZ(), 1.58F, 0.28F);
        snowball.getPersistentData().putDouble("mng_snow_damage", shooter.getPersistentData().getDouble("mng_snow_damage"));
        int stoneShots = shooter.getPersistentData().getInt("mng_stone_shots");
        if (stoneShots > 0) {
            snowball.getPersistentData().putDouble("mng_snow_damage", 1000.0);
            shooter.getPersistentData().putInt("mng_stone_shots", stoneShots - 1);
        }
        markProjectile(snowball, shooter);
        shooter.level().addFreshEntity(snowball);
        shooter.level().playSound(null, shooter.blockPosition(), SoundEvents.SNOWBALL_THROW,
            SoundSource.PLAYERS, effectVolume((ServerLevel)shooter.level(), 1.7F),
            0.9F + shooter.getRandom().nextFloat() * 0.2F);
        shooter.swing(InteractionHand.MAIN_HAND);
        snowballsThrown++;
        boolean rapid = shooter.level().getGameTime() < shooter.getPersistentData().getLong("mng_snow_gun_until");
        shooter.getPersistentData().putLong("mng_snow_cooldown", tick + (rapid ? 2 : 24 + shooter.getRandom().nextInt(18)));
    }

    private static float effectVolume(ServerLevel level, float base) {
        ServerPlayer player = level.players().stream().findFirst().orElse(null);
        int percent = player == null ? 55 : player.getPersistentData().getInt("mng_effect_volume");
        if (percent <= 0 && (player == null || !player.getPersistentData().contains("mng_effect_volume"))) percent = 55;
        return base * Mth.clamp(percent / 55.0F, 0.0F, 2.0F);
    }

    private static int currentCombatantCount(ServerLevel level) {
        return level.getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-110, level.getMinBuildHeight(), -110, 110,
                level.getMaxBuildHeight(), 110), SnowWarEngine::isCombatant).size();
    }

    private static java.util.List<Entity> entitySnapshot(ServerLevel level) {
        java.util.List<Entity> entities = new java.util.ArrayList<>();
        level.getAllEntities().forEach(entities::add);
        return entities;
    }

    private void markProjectile(Snowball shot, Entity owner) {
        shot.getPersistentData().putBoolean("mng_snow_projectile", true);
        shot.getPersistentData().putUUID("mng_owner_uuid", owner.getUUID());
        shot.getPersistentData().putDouble("mng_origin_x", shot.getX());
        shot.getPersistentData().putDouble("mng_origin_y", shot.getY());
        shot.getPersistentData().putDouble("mng_origin_z", shot.getZ());
    }

    public void throwPlayerSnowball(ServerPlayer player) {
        if (!state.running()) return;
        long now = player.serverLevel().getGameTime();
        if (!player.isAlive() || now < player.getPersistentData().getLong("mng_player_throw_at")) return;
        boolean rapid = now < player.getPersistentData().getLong("mng_snow_gun_until");
        player.getPersistentData().putLong("mng_player_throw_at", now + (rapid ? 2 : 6));
        Snowball shot = new Snowball(player.level(), player);
        shot.setOwner(player);
        shot.setNoGravity(true);
        shot.getPersistentData().putBoolean("mng_snow_gun", rapid);
        shot.getPersistentData().putDouble("mng_snow_damage", rapid ? 15.0 : 1000.0);
        shot.shootFromRotation(player, player.getXRot(), player.getYRot(), 0, 1.58F, 0.15F);
        markProjectile(shot, player);
        player.level().addFreshEntity(shot);
        snowballsThrown++;
        player.level().playSound(null, player.blockPosition(), SoundEvents.SNOWBALL_THROW, SoundSource.PLAYERS,
            effectVolume(player.serverLevel(), 1.35F), 1.0F);
        ItemStack held = player.getMainHandItem();
        boolean holdingGun = held.hasTag() && held.getTag().getBoolean("mng_snow_gun");
        if ((!rapid && !held.is(Items.SNOWBALL)) || (rapid && !holdingGun))
            player.setItemInHand(InteractionHand.MAIN_HAND, snowballStack(rapid));
    }

    private void spawn(ServerPlayer host, ViewerFighter fighter) {
        ServerLevel level = host.serverLevel();
        String team = fighter.displayName().toLowerCase(Locale.ROOT);
        BlockPos anchor = groupAnchors.computeIfAbsent(team, ignored -> {
            double angle = Math.floorMod(team.hashCode(), 360) * Math.PI / 180.0;
            double radius = 56.0 + Math.floorMod(team.hashCode(), 4) * 4.0;
            return new BlockPos((int)Math.round(Math.cos(angle) * radius), 0,
                (int)Math.round(Math.sin(angle) * radius));
        });
        int slot = groupSlots.getOrDefault(team, 0);
        groupSlots.put(team, slot + 1);
        int columns = 6;
        double spacing = 3.2;
        int scatter = fighter.viewerId().hashCode();
        double jitterX = (Math.floorMod(scatter, 17) - 8) / 10.0;
        double jitterZ = (Math.floorMod(scatter / 17, 17) - 8) / 10.0;
        int x = (int)Math.round(anchor.getX() + (slot % columns - 3.0) * spacing + jitterX);
        int z = (int)Math.round(anchor.getZ() + (slot / columns) * spacing + jitterZ);
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z);
        SnowFighterEntity fighterEntity = com.tikmng.snowwar.SnowWar.FIGHTER.get().create(level);
        if (fighterEntity == null) return;
        fighterEntity.moveTo(new BlockPos(x, y, z), host.getYRot(), 0.0F);
        fighterEntity.setCustomName(Component.literal("@" + fighter.displayName()));
        fighterEntity.setCustomNameVisible(true);
        fighterEntity.setProfileUrl(fighter.profileUrl());
        fighterEntity.setPersistenceRequired();
        fighterEntity.setCanPickUpLoot(false);
        fighterEntity.setItemSlot(EquipmentSlot.MAINHAND, new ItemStack(Items.SNOWBALL));
        fighterEntity.getPersistentData().putBoolean("mng_snow_fighter", true);
        fighterEntity.getPersistentData().putString("mng_viewer_id", fighter.viewerId());
        fighterEntity.getPersistentData().putString("mng_viewer_name", fighter.displayName());
        fighterEntity.getPersistentData().putString("mng_profile", fighter.profileUrl());
        fighterEntity.getPersistentData().putDouble("mng_snow_damage", 10.0);
        fighterEntity.getPersistentData().putDouble("mng_base_snow_damage", 10.0);
        equipFighter(fighterEntity);
        if (fighterEntity.getAttribute(Attributes.MAX_HEALTH) != null) {
            fighterEntity.getAttribute(Attributes.MAX_HEALTH).setBaseValue(fighter.maxHealth());
            fighterEntity.setHealth((float)fighter.maxHealth());
        }
        level.addFreshEntity(fighterEntity);
        fighter.bind(fighterEntity.getUUID());
    }

    private void equipFighter(SnowFighterEntity fighter) {
        fighter.setItemSlot(EquipmentSlot.HEAD, ItemStack.EMPTY);
        fighter.setItemSlot(EquipmentSlot.CHEST, ItemStack.EMPTY);
        fighter.setItemSlot(EquipmentSlot.LEGS, ItemStack.EMPTY);
        fighter.setItemSlot(EquipmentSlot.FEET, ItemStack.EMPTY);
        fighter.setDropChance(EquipmentSlot.HEAD, 0.0F);
        fighter.setDropChance(EquipmentSlot.CHEST, 0.0F);
        fighter.setDropChance(EquipmentSlot.LEGS, 0.0F);
        fighter.setDropChance(EquipmentSlot.FEET, 0.0F);
        fighter.setDropChance(EquipmentSlot.MAINHAND, 0.0F);
    }

    private void applyToName(ServerPlayer host, String name, java.util.function.Consumer<LivingEntity> action) {
        for (LivingEntity fighter : host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                new net.minecraft.world.phys.AABB(-256, host.serverLevel().getMinBuildHeight(), -256, 256,
                    host.serverLevel().getMaxBuildHeight(), 256),
                e -> isCombatant(e)
                    && e.getPersistentData().getString("mng_viewer_name").equalsIgnoreCase(name))) action.accept(fighter);
    }

    private void healAll(ServerPlayer host) {
        for (LivingEntity fighter : host.serverLevel().getEntitiesOfClass(LivingEntity.class,
                host.getBoundingBox().inflate(220), e -> e.getPersistentData().getBoolean("mng_snow_fighter")))
            fighter.setHealth(fighter.getMaxHealth());
    }
}
