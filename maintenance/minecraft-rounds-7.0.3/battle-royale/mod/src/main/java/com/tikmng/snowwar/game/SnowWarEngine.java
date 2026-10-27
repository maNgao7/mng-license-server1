package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Arrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import org.joml.Vector3f;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class SnowWarEngine {
    private int participantCapacity = ParticipantCapacity.DEFAULT;
    private long lastCapacityNotice = Long.MIN_VALUE;
    private static final double START_ZONE_RADIUS = SnowWarArenaBuilder.RADIUS - 2.0;
    private final SnowWarState state = new SnowWarState();
    private final SnowWarArenaBuilder arena;
    private long tick;
    private double zoneRadius = START_ZONE_RADIUS;
    private int zonePhase;
    private String winnerCandidate = "";
    private long winnerDeadline;
    private long winnerResetAt;
    private boolean battleHadRivals;
    private int winnerDelaySeconds = 10;
    private int zoneIntervalSeconds = 20;
    private final BattleZone zone = new BattleZone();
    private int lobbyWaitSeconds = 10;
    private long launchAt;
    private boolean aircraftLobby = true;
    private final Map<String, PendingLoadout> waitingGear = new HashMap<>();
    private final Map<String, String> viewerProfiles = new HashMap<>();
    private final List<ActiveGrenade> grenades = new ArrayList<>();
    private record ActiveGrenade(net.minecraft.world.entity.item.ItemEntity visual, Vec3 origin,
                                  SnowFighterEntity target, long launched, Entity owner, String ownerName) {}

    private static final class PendingLoadout {
        int weapon, helmet, vest, armor;
        boolean shield;
    }

    public void setLobbyWaitSeconds(int seconds) { lobbyWaitSeconds = Math.max(0, Math.min(120, seconds)); }

    public int participantCapacity() { return participantCapacity; }
    public void setParticipantCapacity(int value) { participantCapacity = ParticipantCapacity.validate(value); }

    public SnowWarEngine(SnowWarArenaBuilder arena) { this.arena = arena; }

    double zoneRadiusForTesting() { return zoneRadius; }
    void forceZonePhaseForTesting(long now) { zone.force(now); }

    public void resetSession(ServerPlayer host) {
        setAircraftLobby(host, true);
        waitingGear.clear();
        viewerProfiles.clear();
        clearGrenades();
        state.reset();
        zoneRadius = START_ZONE_RADIUS;
        zonePhase = 0;
        winnerCandidate = "";
        winnerDeadline = 0;
        winnerResetAt = 0;
        battleHadRivals = false;
        launchAt = 0;
        zone.reset(host.serverLevel().getGameTime(), zoneIntervalSeconds);
        for (SnowFighterEntity fighter : fighters(host.serverLevel())) fighter.discard();
        if (arena.ready()) arena.movePlayerToLobby(host);
        host.displayClientMessage(Component.literal("Uçak lobisi hazır. B ile bağlan, P ile savaşı başlat."), true);
    }

    public void start(ServerPlayer host) {
        if (state.running() || launchAt > 0) {
            host.displayClientMessage(Component.literal("Savaş zaten devam ediyor."), true);
            return;
        }
        launchAt = host.serverLevel().getGameTime() + lobbyWaitSeconds * 20L;
    }

    private void launch(ServerPlayer host) {
        setAircraftLobby(host, false);
        launchAt = 0;
        zone.reset(host.serverLevel().getGameTime(), zoneIntervalSeconds);
        state.start();
        deployLobbyFighters(host);
        arena.movePlayerToBattleView(host);
        arena.hideLobbyAircraft();
        host.serverLevel().playSound(null, host.blockPosition(), SoundEvents.ARMOR_EQUIP_ELYTRA,
            SoundSource.PLAYERS, 2.0F, 0.75F);
        host.serverLevel().playSound(null, host.blockPosition(), SoundEvents.ELYTRA_FLYING,
            SoundSource.PLAYERS, 1.3F, 0.9F);
        host.getAbilities().mayfly = true;
        host.getAbilities().flying = true;
        host.onUpdateAbilities();
        host.displayClientMessage(Component.literal("Uçuş başladı. Oyuncular paraşütle haritaya dağılıyor."), true);
    }

    public void stop(ServerPlayer host) {
        launchAt = 0;
        host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"), false);
        state.stop();
        for (SnowFighterEntity fighter : fighters(host.serverLevel())) fighter.getNavigation().stop();
        host.displayClientMessage(Component.literal("Savaş durduruldu; yeni katılımcılar paraşütle inmeye devam edebilir."), true);
    }

    public void resetRoundNow(ServerPlayer host) {
        resetRound(host, fighters(host.serverLevel()));
    }

    public void shrinkZoneNow(ServerPlayer host) {
        if (zone.radius <= BattleZone.MIN_RADIUS) {
            host.displayClientMessage(Component.literal("Elektrikli alan zaten son aşamada."), true);
            return;
        }
        if (!state.running()) return;
        if (!zone.moving) zone.force(host.serverLevel().getGameTime());
        host.displayClientMessage(Component.literal("Elektrikli alan hedefi: " + String.format(Locale.ROOT, "%.2f", zone.targetRadius) + " metre"), true);
    }

    public void setWinnerDelaySeconds(int seconds) { winnerDelaySeconds = Math.max(3, Math.min(120, seconds)); }
    public void setZoneIntervalSeconds(int seconds) { zoneIntervalSeconds = Math.max(10, Math.min(120, seconds)); }

    public void setTimeMode(MinecraftServer server, String ignored) {
        if (server == null) return;
        for (ServerLevel level : server.getAllLevels()) {
            level.setDayTime(6000);
            level.setWeatherParameters(1000000, 0, false, false);
        }
    }

    public void audience(ServerPlayer host, String username, String profile, boolean liked) {
        String key = cleanName(username).toLowerCase(Locale.ROOT);
        if (profile != null && !profile.isBlank() && !viewerProfiles.containsKey(key))
            updateProfile(host, username, profile);
    }

    public void updateProfile(ServerPlayer host, String username, String profile) {
        if (profile == null || profile.isBlank()) return;
        String key = cleanName(username).toLowerCase(Locale.ROOT);
        viewerProfiles.put(key, profile);
        if (viewerProfiles.size() > 4000) viewerProfiles.remove(viewerProfiles.keySet().iterator().next());
        applyToTeam(host, username, fighter -> {
            fighter.setProfileUrl(profile);
            fighter.getPersistentData().putString("mng_profile", profile);
        });
    }

    public void join(ServerPlayer host, String viewerId, String name, String profile) {
        spawnParticipants(host, name == null || name.isBlank() ? viewerId : name, profile, 1);
    }

    public void applyAction(ServerPlayer host, String action, String username, String profile, int count) {
        applyAction(host, action, username, profile, count, 10);
    }

    public void applyAction(ServerPlayer host, String action, String username, String profile, int count, int durationSeconds) {
        int amount = Math.max(1, Math.min(100, count));
        String name = cleanName(username);
        audience(host, name, profile, false);
        if ("__test_all__".equals(name) && fighters(host.serverLevel()).isEmpty())
            spawnParticipants(host, "DenemeIzleyicisi", "", 1);
        switch (action) {
            case "OYUNCU", "PARASUT", "OYUNCU_1" -> spawnParticipants(host, name, profile, Math.max(1, count));
            case "SILAH_YUKSELT" -> upgradeWeapon(host, name, amount);
            case "MP5", "MP5K" -> setWeapon(host, name, 1);
            case "P90" -> setWeapon(host, name, 2);
            case "M4", "M4A1" -> setWeapon(host, name, 3);
            case "AK", "AK47" -> setWeapon(host, name, 4);
            case "AWM" -> setWeapon(host, name, 5);
            case "KASK", "YELEK" -> setArmor(host, name, Math.min(4, amount));
            case "ZIRH_1" -> setArmor(host, name, 1);
            case "ZIRH_2" -> setArmor(host, name, 2);
            case "ZIRH_3" -> setArmor(host, name, 3);
            case "ZIRH_4" -> setArmor(host, name, 4);
            case "KALKAN" -> setArmor(host, name, 1);
            case "ZIRH_CIKAR", "KASK_CIKAR", "YELEK_CIKAR" -> { }
            case "CAN_BAS", "EKSTRA_CAN", "KIT_BAS" -> heal(host, name);
            case "TAM_TECHIZAT" -> fullGear(host, name);
            case "EL_BOMBASI" -> throwGrenades(host, name, amount);
            default -> { }
        }
    }

    public void tick(MinecraftServer server) {
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null || !arena.ready()) return;
        tick++;
        ServerLevel level = host.serverLevel();
        List<SnowFighterEntity> fighters = fighters(level);
        if (launchAt > 0) {
            if (tick % 20 == 0) host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|"
                + Math.max(0, (int)Math.ceil((launchAt-level.getGameTime())/20.0))), false);
            if (level.getGameTime() >= launchAt) launch(host);
        }
        if (state.running()) tickZone(level, fighters);
        for (SnowFighterEntity fighter : fighters) tickFighter(level, fighter, fighters);
        if (tick % 10 == 0) drawElectricRing(level);
        if (tick % 20 == 0) {
            updateWinner(host, fighters);
            sendHud(host, fighters.size());
        }
        if (winnerResetAt > 0 && level.getGameTime() >= winnerResetAt) resetRound(host, fighters);
        tickBullets(level);
        tickGrenades(level);
    }

    private void tickZone(ServerLevel level, List<SnowFighterEntity> fighters) {
        long now = level.getGameTime();
        zone.tick(now, zoneIntervalSeconds);
        zoneRadius = zone.radius;
        zonePhase = zone.phase;
        for (SnowFighterEntity fighter : fighters) {
            if (!zone.outside(fighter.getX(), fighter.getZ())) continue;
            if (fighter.parachuting()) continue;
            if (tick % 4 == 0) level.sendParticles(ParticleTypes.ELECTRIC_SPARK,
                fighter.getX(), fighter.getY() + 1.0, fighter.getZ(), 7, 0.28, 0.55, 0.28, 0.08);
        }
        if (tick % 20 != 0) return;
        Map<String, Integer> survivors = new HashMap<>();
        for (SnowFighterEntity fighter : fighters) if (fighter.isAlive() && !fighter.parachuting()) survivors.merge(team(fighter), 1, Integer::sum);
        var exposed = fighters.stream().filter(f -> f.isAlive() && !f.parachuting() && zone.outside(f.getX(), f.getZ()))
            .sorted(Comparator.comparingDouble((SnowFighterEntity f) -> f.distanceToSqr(zone.x, f.getY(), zone.z)).reversed()).toList();
        for (SnowFighterEntity fighter : exposed) {
            // Resolve farthest first and keep the final team alive for the winner countdown.
            if (battleHadRivals && survivors.size() <= 1) break;
            damageDirect(fighter, 8.0F + zonePhase * 1.5F, null, "Elektrikli Alan");
            if (!fighter.isAlive()) survivors.computeIfPresent(team(fighter), (key, count) -> count <= 1 ? null : count - 1);
        }
    }

    private void tickFighter(ServerLevel level, SnowFighterEntity fighter, List<SnowFighterEntity> fighters) {
        if (!fighter.isAlive()) return;
        if (fighter.getPersistentData().getBoolean("mng_in_lobby")) {
            fighter.setNoAi(false);
            if (fighter.getY() < arena.floorY() + 69.0 || fighter.getY() > arena.floorY() + 76.0
                    || Math.abs(fighter.getX()) > 12.5 || Math.abs(fighter.getZ()) > 44.5) {
                Vec3 point = arena.randomLobbyPoint(level.random);
                fighter.teleportTo(point.x, point.y, point.z);
            }
            if ((tick + fighter.getId() * 17L) % 70L == 0L) {
                Vec3 point = arena.randomLobbyPoint(level.random);
                fighter.getNavigation().moveTo(point.x, point.y, point.z, 0.72);
            }
            return;
        }
        if (fighter.parachuting()) {
            fighter.setNoAi(true);
            double landingY = fighter.getPersistentData().getDouble("mng_landing_y");
            if (landingY == 0.0) landingY = arena.floorY() + 1.05;
            long started = fighter.getPersistentData().getLong("mng_parachute_started");
            double nextY = Math.max(landingY, fighter.getY() - 0.23);
            if (started > 0 && level.getGameTime() - started > 300L) nextY = landingY;
            double targetX = fighter.getPersistentData().getDouble("mng_landing_x");
            double targetZ = fighter.getPersistentData().getDouble("mng_landing_z");
            fighter.teleportTo(fighter.getX() + (targetX - fighter.getX()) * 0.025,
                nextY, fighter.getZ() + (targetZ - fighter.getZ()) * 0.025);
            fighter.setDeltaMovement(0, 0, 0);
            level.sendParticles(ParticleTypes.CLOUD, fighter.getX(), fighter.getY() + 3.0, fighter.getZ(), 2, 0.7, 0.1, 0.7, 0.01);
            if (nextY <= landingY + 0.01) {
                fighter.teleportTo(targetX, landingY, targetZ);
                fighter.setParachuting(false);
                fighter.setNoAi(false);
                fighter.getPersistentData().remove("mng_parachute_started");
                equipWeapon(fighter);
                level.playSound(null, fighter.blockPosition(), SoundEvents.ARMOR_EQUIP_LEATHER, SoundSource.PLAYERS, 1.2F, 0.8F);
            }
            return;
        }
        if (!state.running()) { fighter.getNavigation().stop(); return; }
        if (fighter.getY() > arena.groundY(Mth.floor(fighter.getX()),Mth.floor(fighter.getZ())) + 2.5 && fighter.onGround()) {
            Vec3 ground = arena.roofExit(level, fighter.getX(), fighter.getZ());
            fighter.teleportTo(ground.x, ground.y + 3, ground.z);
            fighter.setDeltaMovement(0, -0.2, 0);
        }
        boolean retreating = zone.needsRetreat(fighter.getX(), fighter.getZ());
        fighter.getPersistentData().putBoolean("mng_retreating", retreating);
        if (retreating) {
            seekSafeZone(level, fighter);
        }
        if (zone.outside(fighter.getX(), fighter.getZ())) {
            pushTowardSafeZone(fighter, 0.20);
            return;
        }
        SnowFighterEntity target = nearestEnemy(fighter, fighters);
        if (target == null) { seekSafeZone(level, fighter); return; }
        double distanceSq = fighter.distanceToSqr(target);
        boolean visible = fighter.hasLineOfSight(target);
        if (!retreating && (distanceSq > 10.0 * 10.0 || !visible)) {
            fighter.getNavigation().moveTo(target, 1.12 + fighter.weaponTier() * 0.025);
            if (distanceSq > 38.0 * 38.0 && fighter.onGround() && visible) {
                Vec3 pursuit = target.position().subtract(fighter.position()).normalize().scale(0.055);
                Vec3 current = fighter.getDeltaMovement();
                fighter.setDeltaMovement(current.x * 0.82 + pursuit.x, current.y, current.z * 0.82 + pursuit.z);
            }
        }
        else if (!retreating && distanceSq < 6.0 * 6.0) {
            Vec3 away = fighter.position().subtract(target.position()).normalize().scale(4.0);
            fighter.getNavigation().moveTo(fighter.getX() + away.x, fighter.getY(), fighter.getZ() + away.z, 1.05);
        }
        lookAt(fighter, target);
        fighter.setShiftKeyDown(distanceSq < 18.0 * 18.0 && ((tick + fighter.getId()) % 53) < 17);
        long stanceCycle = (tick + fighter.getId() * 13L) % 260L;
        if (fighter.onGround() && distanceSq < 30.0 * 30.0 && stanceCycle < 24L)
            fighter.setPose(net.minecraft.world.entity.Pose.SWIMMING);
        else fighter.setPose(fighter.isShiftKeyDown() ? net.minecraft.world.entity.Pose.CROUCHING : net.minecraft.world.entity.Pose.STANDING);
        if (fighter.onGround() && ((tick + fighter.getId() * 7L) % 181L) == 0L) fighter.getJumpControl().jump();
        int cooldown = switch (fighter.weaponTier()) { case 1 -> 6; case 2 -> 5; case 3 -> 7; case 4 -> 8; case 5 -> 34; default -> 18; };
        double range = switch (fighter.weaponTier()) { case 1 -> 42.0; case 2 -> 48.0; case 3 -> 62.0; case 4 -> 67.0; case 5 -> 92.0; default -> 35.0; };
        long last = fighter.getPersistentData().getLong("mng_last_shot");
        long reloadUntil = fighter.getPersistentData().getLong("mng_reload_until");
        if (reloadUntil > level.getGameTime()) return;
        if (reloadUntil > 0) {
            fighter.getPersistentData().remove("mng_reload_until");
            fighter.getPersistentData().putInt("mng_magazine", BattleRoyaleWeapons.magazineSize(fighter.weaponTier()));
        }
        if (distanceSq <= range * range && level.getGameTime() - last >= cooldown && visible) {
            int ammo = fighter.getPersistentData().getInt("mng_magazine");
            if (ammo <= 0) {
                fighter.getPersistentData().putLong("mng_reload_until", level.getGameTime() + (fighter.weaponTier() == 5 ? 60 : 40));
                fighter.swing(InteractionHand.MAIN_HAND, true);
                level.playSound(null, fighter.blockPosition(), SoundEvents.ARMOR_EQUIP_IRON, SoundSource.PLAYERS, 0.8F, 0.9F);
                return;
            }
            fireBullet(level, fighter, target, fighter.weaponTier());
            fighter.getPersistentData().putInt("mng_magazine", ammo - 1);
            fighter.getPersistentData().putLong("mng_last_shot", level.getGameTime());
        }
    }

    private SnowFighterEntity nearestEnemy(SnowFighterEntity source, List<SnowFighterEntity> fighters) {
        SnowFighterEntity best = null;
        double bestDistance = Double.MAX_VALUE;
        String team = team(source);
        for (SnowFighterEntity candidate : fighters) {
            if (candidate == source || !candidate.isAlive() || candidate.parachuting() || team.equals(team(candidate))) continue;
            double distance = source.distanceToSqr(candidate);
            if (distance < bestDistance) { bestDistance = distance; best = candidate; }
        }
        return best;
    }

    private void fireBullet(ServerLevel level, LivingEntity shooter, LivingEntity target, int tier) {
        Arrow bullet = new Arrow(level, shooter);
        bullet.setNoGravity(true);
        bullet.setPos(shooter.getX(), shooter.getEyeY() - 0.18, shooter.getZ());
        Vec3 aim = target.position().add(0, target.getBbHeight() * 0.58, 0).subtract(bullet.position());
        float velocity = tier == 0 ? 4.2F : 4.5F + tier * 0.25F;
        float spread = tier == 0 ? 2.7F : tier <= 2 ? 3.0F : tier == 5 ? 0.35F : 1.25F;
        bullet.shoot(aim.x, aim.y, aim.z, velocity, spread);
        bullet.pickup = net.minecraft.world.entity.projectile.AbstractArrow.Pickup.DISALLOWED;
        bullet.getPersistentData().putBoolean("mng_royale_bullet", true);
        bullet.getPersistentData().putFloat("mng_bullet_damage", weaponDamage(tier));
        bullet.getPersistentData().putInt("mng_weapon_tier", tier);
        bullet.getPersistentData().putString("mng_bullet_owner", displayName(shooter));
        bullet.getPersistentData().putString("mng_bullet_team", team(shooter));
        level.addFreshEntity(bullet);
        if (shooter instanceof SnowFighterEntity fighter) fighter.beginThrow();
        shooter.swing(InteractionHand.MAIN_HAND, true);
        BattleRoyaleWeapons.playShot(shooter, tier);
        level.sendParticles(ParticleTypes.FLAME, shooter.getX(), shooter.getEyeY() - 0.22, shooter.getZ(), 3, 0.08, 0.08, 0.08, 0.02);
    }

    public void firePlayerWeapon(ServerPlayer player) {
        int tier = 0;
        Vec3 look = player.getLookAngle();
        Arrow bullet = new Arrow(player.serverLevel(), player);
        bullet.setNoGravity(true);
        bullet.setPos(player.getX(), player.getEyeY() - 0.18, player.getZ());
        bullet.shoot(look.x, look.y, look.z, 5.0F, 0.35F);
        bullet.pickup = net.minecraft.world.entity.projectile.AbstractArrow.Pickup.DISALLOWED;
        bullet.getPersistentData().putBoolean("mng_royale_bullet", true);
        bullet.getPersistentData().putFloat("mng_bullet_damage", weaponDamage(tier));
        bullet.getPersistentData().putString("mng_bullet_owner", player.getName().getString());
        bullet.getPersistentData().putString("mng_bullet_team", "__host__");
        player.serverLevel().addFreshEntity(bullet);
        BattleRoyaleWeapons.playShot(player, tier);
    }

    public void hitByBullet(Arrow bullet, LivingEntity target) {
        if (!bullet.getPersistentData().getBoolean("mng_royale_bullet") || !isFighter(target)) return;
        Entity owner = bullet.getOwner();
        if (owner == target || (!team(owner).isBlank() && team(owner).equals(team(target)))) return;
        if (bullet.getPersistentData().getInt("mng_weapon_tier") == 5) {
            damageDirect(target, target.getHealth(), owner, bullet.getPersistentData().getString("mng_bullet_owner"));
            return;
        }
        if (target instanceof SnowFighterEntity fighter && absorbShot(fighter)) return;
        float damage = bullet.getPersistentData().getFloat("mng_bullet_damage");
        damageDirect(target, Math.max(1.0F, damage), owner, bullet.getPersistentData().getString("mng_bullet_owner"));
    }

    public boolean absorbShot(SnowFighterEntity fighter) {
        if (fighter.shielded()) {
            fighter.setShielded(false);
            fighter.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
            fighter.level().playSound(null, fighter.blockPosition(), SoundEvents.SHIELD_BREAK, SoundSource.PLAYERS, 1.0F, 1.0F);
            return true;
        }
        if (fighter.armorHits() <= 0) return false;
        fighter.setArmorHits(fighter.armorHits() - 1);
        boolean broken = fighter.armorHits() == 0;
        if (broken) {
            fighter.setHelmetTier(0);
            fighter.setVestTier(0);
            equipArmor(fighter);
        }
        fighter.level().playSound(null, fighter.blockPosition(), broken ? SoundEvents.ITEM_BREAK : SoundEvents.ANVIL_HIT,
            SoundSource.PLAYERS, 0.8F, broken ? 0.85F : 1.5F);
        if (fighter.level() instanceof ServerLevel level) level.sendParticles(ParticleTypes.ELECTRIC_SPARK,
            fighter.getX(), fighter.getY() + 1.1, fighter.getZ(), 12, 0.25, 0.3, 0.25, 0.07);
        return true;
    }

    private void damageDirect(LivingEntity target, float damage, Entity owner, String ownerName) {
        if (!target.isAlive()) return;
        float next = Math.max(0.0F, target.getHealth() - damage);
        target.setHealth(next);
        if (target.level() instanceof ServerLevel level) {
            level.broadcastEntityEvent(target, (byte)2);
            level.sendParticles(new DustParticleOptions(new Vector3f(0.95F, 0.08F, 0.03F), 1.1F),
                target.getX(), target.getY() + 1.0, target.getZ(), 13, 0.3, 0.5, 0.3, 0.05);
            level.sendParticles(ParticleTypes.CRIT, target.getX(), target.getY() + 1.0, target.getZ(), 9, 0.3, 0.4, 0.3, 0.1);
        }
        if (next > 0) return;
        String victim = displayName(target);
        String killer = ownerName == null || ownerName.isBlank() ? "Elektrikli Alan" : ownerName;
        target.getPersistentData().putBoolean("mng_kill_announced", true);
        String killerProfile = encodeProfile(profileOf(owner));
        String victimProfile = encodeProfile(profileOf(target));
        for (ServerPlayer player : ((ServerLevel)target.level()).players())
            player.displayClientMessage(Component.literal("MNG_SNOW_KILL|" + killer + "|" + victim
                + "|" + killerProfile + "|" + victimProfile), false);
        if (owner != null) owner.getPersistentData().putInt("mng_kills", owner.getPersistentData().getInt("mng_kills") + 1);
        target.discard();
    }

    private void tickBullets(ServerLevel level) {
        List<Entity> snapshot = new ArrayList<>();
        for (Entity entity : level.getAllEntities()) snapshot.add(entity);
        for (Entity entity : snapshot) {
            if (!(entity instanceof Arrow bullet) || !bullet.getPersistentData().getBoolean("mng_royale_bullet")) continue;
            Vec3 motion = bullet.getDeltaMovement();
            for (int i = 1; i <= 3; i++) level.sendParticles(new DustParticleOptions(new Vector3f(1.0F,0.82F,0.32F),0.35F),
                bullet.getX() - motion.x * i * 0.22, bullet.getY() - motion.y * i * 0.22,
                bullet.getZ() - motion.z * i * 0.22, 1, 0.01, 0.01, 0.01, 0.001);
            if (bullet.tickCount > 55 || bullet.onGround()) bullet.discard();
        }
    }

    private void spawnParticipants(ServerPlayer host, String username, String profile, int requested) {
        ServerLevel level = host.serverLevel();
        String key = cleanName(username).toLowerCase(Locale.ROOT);
        String bestProfile = viewerProfiles.getOrDefault(key, profile == null ? "" : profile);
        PendingLoadout gear = waitingGear.get(key);
        int existing = fighters(level).size();
        int available = Math.max(0, participantCapacity - existing);
        int quantity = Math.min(requested, available);
        long now = level.getGameTime();
        if (requested > available && (lastCapacityNotice == Long.MIN_VALUE || now - lastCapacityNotice >= 40)) {
            host.displayClientMessage(Component.literal("Katilimci kapasitesi dolu (" + existing + "/"
                + participantCapacity + "). Yer acilinca yeni katilim alinabilir."), true);
            lastCapacityNotice = now;
        }
        int added = 0;
        for (int i = 0; i < quantity; i++) {
            SnowFighterEntity fighter = SnowWar.FIGHTER.get().create(level);
            if (fighter == null) continue;
            fighter.setCustomName(Component.literal(cleanName(username)));
            fighter.setCustomNameVisible(true);
            fighter.setProfileUrl(bestProfile);
            fighter.setPersistenceRequired();
            fighter.setParticipant(true);
            fighter.getPersistentData().putBoolean("mng_royale_fighter", true);
            fighter.getPersistentData().putString("mng_viewer_name", cleanName(username));
            fighter.getPersistentData().putString("mng_profile", bestProfile);
            fighter.getPersistentData().putString("mng_team", cleanName(username).toLowerCase(Locale.ROOT));
            fighter.setWeaponTier(0);
            fighter.setHealth(fighter.getMaxHealth());
            if (state.running()) prepareParachute(level, fighter);
            else {
                Vec3 seat = arena.randomLobbyPoint(level.random);
                fighter.moveTo(seat.x, seat.y, seat.z, 180.0F, 0.0F);
                fighter.setParachuting(false);
                fighter.setNoAi(false);
                fighter.getPersistentData().putBoolean("mng_in_lobby", true);
            }
            if (!level.addFreshEntity(fighter)) continue;
            added++;
            if (gear != null) {
                fighter.setWeaponTier(gear.weapon);
                fighter.setHelmetTier(gear.helmet);
                fighter.setVestTier(gear.vest);
                fighter.setArmorHits(gear.armor);
                fighter.setShielded(gear.shield);
                if (gear.shield) fighter.setItemSlot(EquipmentSlot.OFFHAND, new ItemStack(Items.SHIELD));
                equipArmor(fighter);
            }
            equipWeapon(fighter);
        }
        if (added > 0) waitingGear.remove(key);
        if (added > 0) level.playSound(null, BlockPosUtil.at(host),
            state.running() ? SoundEvents.ELYTRA_FLYING : SoundEvents.NOTE_BLOCK_BELL.value(),
            SoundSource.PLAYERS, 1.5F, 1.1F);
    }

    private void deployLobbyFighters(ServerPlayer host) {
        ServerLevel level = host.serverLevel();
        for (SnowFighterEntity fighter : fighters(level)) {
            if (!fighter.getPersistentData().getBoolean("mng_in_lobby")) continue;
            prepareParachute(level, fighter);
        }
    }

    private void prepareParachute(ServerLevel level, SnowFighterEntity fighter) {
        Vec3 landing = arena.randomLandingPoint(level, zoneRadius, zone.x, zone.z);
        double landingY = landing.y;
        fighter.moveTo(landing.x, landingY + 24.0 + level.random.nextDouble() * 8.0, landing.z,
            level.random.nextFloat() * 360.0F, 0.0F);
        fighter.getPersistentData().putDouble("mng_landing_y", landingY);
        fighter.getPersistentData().putDouble("mng_landing_x", landing.x);
        fighter.getPersistentData().putDouble("mng_landing_z", landing.z);
        double offset = level.random.nextDouble() * Math.PI * 2;
        double startX = landing.x + Math.cos(offset) * 12;
        double startZ = landing.z + Math.sin(offset) * 12;
        if (!zone.outside(startX,startZ))
            fighter.teleportTo(startX, fighter.getY(), startZ);
        fighter.getPersistentData().putBoolean("mng_in_lobby", false);
        fighter.getPersistentData().putLong("mng_parachute_started", level.getGameTime());
        fighter.setParachuting(true);
        fighter.setNoAi(true);
        level.playSound(null, fighter.blockPosition(), SoundEvents.ARMOR_EQUIP_ELYTRA,
            SoundSource.PLAYERS, 0.6F, 0.85F);
    }

    private void upgradeWeapon(ServerPlayer host, String name, int levels) {
        rememberGear(host, name, gear -> gear.weapon = Math.min(5, gear.weapon + levels));
        applyToTeam(host, name, fighter -> { fighter.setWeaponTier(fighter.weaponTier() + levels); equipWeapon(fighter); });
    }
    private void setWeapon(ServerPlayer host, String name, int tier) {
        rememberGear(host, name, gear -> gear.weapon = Math.max(gear.weapon, tier));
        applyToTeam(host, name, fighter -> { fighter.setWeaponTier(Math.max(fighter.weaponTier(), tier)); equipWeapon(fighter); });
    }
    private void setArmor(ServerPlayer host, String name, int tier) {
        rememberGear(host, name, gear -> { gear.helmet = tier; gear.vest = tier; gear.armor = tier; });
        applyToTeam(host, name, fighter -> {
            fighter.setHelmetTier(tier);
            fighter.setVestTier(tier);
            fighter.setArmorHits(tier);
            fighter.setShielded(false);
            fighter.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
            equipArmor(fighter);
        });
    }
    private void heal(ServerPlayer host, String name) {
        applyToTeam(host, name, fighter -> {
            fighter.setHealth(fighter.getMaxHealth());
            fighter.beginHeal();
            fighter.level().playSound(null, fighter.blockPosition(), SoundEvents.BREWING_STAND_BREW,
                SoundSource.PLAYERS, 0.4F, 1.4F);
        });
    }
    private void fullGear(ServerPlayer host, String name) {
        rememberGear(host, name, gear -> {
            gear.weapon = 5; gear.helmet = 4; gear.vest = 4; gear.armor = 4; gear.shield = false;
        });
        applyToTeam(host, name, fighter -> {
            fighter.setWeaponTier(5); fighter.setHelmetTier(4); fighter.setVestTier(4); fighter.setShielded(false);
            fighter.setArmorHits(4); equipWeapon(fighter); equipArmor(fighter);
            fighter.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
        });
    }

    private void applyToTeam(ServerPlayer host, String name, java.util.function.Consumer<SnowFighterEntity> action) {
        String key = cleanName(name).toLowerCase(Locale.ROOT);
        boolean testAll = "__test_all__".equals(key);
        for (SnowFighterEntity fighter : fighters(host.serverLevel()))
            if (testAll || team(fighter).equals(key)) action.accept(fighter);
    }

    private void rememberGear(ServerPlayer host, String name, java.util.function.Consumer<PendingLoadout> update) {
        String key = cleanName(name).toLowerCase(Locale.ROOT);
        if ("__test_all__".equals(key) || fighters(host.serverLevel()).stream().anyMatch(f -> team(f).equals(key))) return;
        // Equipment sent before joining is applied to the next incoming batch instead of disappearing.
        update.accept(waitingGear.computeIfAbsent(key, ignored -> new PendingLoadout()));
        if (waitingGear.size() > 4000) waitingGear.remove(waitingGear.keySet().iterator().next());
    }

    private void equipWeapon(SnowFighterEntity fighter) {
        fighter.setItemSlot(EquipmentSlot.MAINHAND, BattleRoyaleWeapons.create(fighter.weaponTier(), false));
        fighter.getPersistentData().putInt("mng_magazine", BattleRoyaleWeapons.magazineSize(fighter.weaponTier()));
        fighter.getPersistentData().remove("mng_reload_until");
    }

    private void equipArmor(SnowFighterEntity fighter) {
        fighter.setItemSlot(EquipmentSlot.HEAD, ItemStack.EMPTY);
        fighter.setItemSlot(EquipmentSlot.CHEST, ItemStack.EMPTY);
        if (fighter.helmetTier() > 0) fighter.setItemSlot(EquipmentSlot.HEAD, new ItemStack(switch (fighter.helmetTier()) {
            case 1 -> Items.LEATHER_HELMET; case 2 -> Items.IRON_HELMET; case 3 -> Items.DIAMOND_HELMET; default -> Items.NETHERITE_HELMET;
        }));
        if (fighter.vestTier() > 0) fighter.setItemSlot(EquipmentSlot.CHEST, new ItemStack(switch (fighter.vestTier()) {
            case 1 -> Items.LEATHER_CHESTPLATE; case 2 -> Items.IRON_CHESTPLATE; case 3 -> Items.DIAMOND_CHESTPLATE; default -> Items.NETHERITE_CHESTPLATE;
        }));
        if (fighter.helmetTier() == 1)
            fighter.getItemBySlot(EquipmentSlot.HEAD).getOrCreateTagElement("display").putInt("color", 0x71864A);
        if (fighter.vestTier() == 1)
            fighter.getItemBySlot(EquipmentSlot.CHEST).getOrCreateTagElement("display").putInt("color", 0xA18C55);
        for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD,EquipmentSlot.CHEST}) {
            if ((slot == EquipmentSlot.HEAD ? fighter.helmetTier() : fighter.vestTier()) != 4) continue;
            var trim = fighter.getItemBySlot(slot).getOrCreateTagElement("Trim");
            trim.putString("material","minecraft:gold"); trim.putString("pattern","minecraft:sentry");
        }
    }

    private float weaponDamage(int tier) { return switch (tier) { case 1 -> 13.0F; case 2 -> 15.0F; case 3 -> 21.0F; case 4 -> 26.0F; case 5 -> 49.0F; default -> 23.0F; }; }
    public static String weaponName(int tier) { return BattleRoyaleWeapons.name(tier); }

    private void updateWinner(ServerPlayer host, List<SnowFighterEntity> fighters) {
        if (winnerResetAt > 0) return;
        Set<String> teams = new HashSet<>();
        for (SnowFighterEntity fighter : fighters) if (fighter.isAlive()) teams.add(team(fighter));
        if (teams.size() >= 2) battleHadRivals = true;
        if (!state.running() || !battleHadRivals || teams.size() != 1 || fighters.stream().anyMatch(SnowFighterEntity::parachuting)) {
            if (winnerDeadline != 0) host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"), false);
            winnerCandidate = ""; winnerDeadline = 0; return;
        }
        String only = teams.iterator().next();
        long now = host.serverLevel().getGameTime();
        if (!only.equals(winnerCandidate)) {
            winnerCandidate = only;
            winnerDeadline = now + winnerDelaySeconds * 20L;
            fighters.stream().filter(f -> team(f).equals(only)).findFirst().ifPresent(candidate ->
                host.displayClientMessage(Component.literal("MNG_SNOW_FINALIST|" + Base64.getUrlEncoder()
                    .withoutPadding().encodeToString(candidate.profileUrl().getBytes(StandardCharsets.UTF_8))), false));
            return;
        }
        int seconds = Math.max(0, (int)Math.ceil((winnerDeadline - now) / 20.0));
        host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|" + seconds), false);
        if (now < winnerDeadline) return;
        SnowFighterEntity winner = fighters.stream().filter(f -> team(f).equals(only)).findFirst().orElse(null);
        if (winner == null) return;
        String profile = winner.profileUrl();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(profile.getBytes(StandardCharsets.UTF_8));
        host.displayClientMessage(Component.literal("MNG_SNOW_WINNER|" + displayName(winner) + "|" + encoded), false);
        host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"), false);
        winnerResetAt = now + 100L;
        winnerDeadline = 0;
    }

    private void resetRound(ServerPlayer host, List<SnowFighterEntity> fighters) {
        clearGrenades();
        waitingGear.clear();
        host.displayClientMessage(Component.literal("MNG_SNOW_COUNTDOWN|0"), false);
        for (SnowFighterEntity fighter : fighters) fighter.discard();
        state.stop();
        launchAt = 0;
        zone.reset(host.serverLevel().getGameTime(), zoneIntervalSeconds);
        zoneRadius = START_ZONE_RADIUS; zonePhase = 0;
        winnerCandidate = ""; winnerDeadline = 0; winnerResetAt = 0; battleHadRivals = false;
        arena.showLobbyAircraft();
        arena.movePlayerToLobby(host);
        setAircraftLobby(host, true);
        host.displayClientMessage(Component.literal("Yeni uçak lobisi hazır. Oyuncular gelsin; P ile dağıt."), true);
    }

    private void sendHud(ServerPlayer host, int alive) {
        host.displayClientMessage(Component.literal("MNG_ROYALE_HUD|" + alive + "|" + zoneRadius + "|" + arena.floorY() + "|" + state.running() + "|" + aircraftLobby), false);
        StringBuilder payload = new StringBuilder("MNG_ZONE|").append(zone.x).append('|').append(zone.z)
            .append('|').append(zone.targetX).append('|').append(zone.targetZ).append('|').append(zone.targetRadius)
            .append('|').append(zone.moving).append('|').append(zone.secondsLeft(host.serverLevel().getGameTime()))
            .append('|').append(zone.progress(host.serverLevel().getGameTime()));
        for (SnowFighterEntity fighter : fighters(host.serverLevel())) payload.append('|')
            .append(fighter.getX()).append(',').append(fighter.getZ()).append(',').append(team(fighter));
        host.displayClientMessage(Component.literal(payload.toString()), false);
    }

    private void setAircraftLobby(ServerPlayer host, boolean value) {
        aircraftLobby = value;
        host.displayClientMessage(Component.literal("MNG_ROYALE_LOBBY|" + value), false);
    }

    private void drawElectricRing(ServerLevel level) {
        for (int i = 0; i < 120; i++) {
            double angle = i * Math.PI * 2.0 / 120.0;
            double x = zone.x + Math.cos(angle) * zoneRadius;
            double z = zone.z + Math.sin(angle) * zoneRadius;
            for (int height = 1; height <= 20; height += 3)
                level.sendParticles(new DustParticleOptions(new Vector3f(0.15F, 0.55F, 1.0F), 1.55F),
                    x, arena.floorY() + height, z, 1, 0.04, 0.12, 0.04, 0.005);
            if (i % 6 == 0) {
                level.sendParticles(ParticleTypes.ELECTRIC_SPARK,
                    x, arena.floorY() + 9.0, z, 12, 0.35, 7.0, 0.35, 0.10);
                level.sendParticles(new DustParticleOptions(new Vector3f(1.0F, 0.82F, 0.18F), 1.15F),
                    x, arena.floorY() + 7.0, z, 4, 0.22, 5.0, 0.22, 0.025);
            }
        }
    }

    private void pushTowardSafeZone(SnowFighterEntity fighter, double force) {
        Vec3 inward = new Vec3(zone.x-fighter.getX(), 0, zone.z-fighter.getZ());
        if (inward.lengthSqr() < 0.0001) return;
        inward = inward.normalize().scale(force);
        Vec3 motion = fighter.getDeltaMovement();
        fighter.setDeltaMovement(motion.x * 0.45 + inward.x, motion.y, motion.z * 0.45 + inward.z);
        fighter.setYRot((float)(Mth.atan2(inward.z, inward.x) * 180.0 / Math.PI) - 90.0F);
    }

    private void seekSafeZone(ServerLevel level, SnowFighterEntity fighter) {
        int hash = fighter.getUUID().hashCode();
        double angle = Math.floorMod(hash,360) * Math.PI / 180.0;
        double spread = zone.targetRadius * (0.12 + Math.floorMod(hash / 360,20) / 100.0);
        Vec3 goal = arena.roofExit(level, zone.targetX + Math.cos(angle)*spread, zone.targetZ + Math.sin(angle)*spread);
        fighter.getNavigation().moveTo(goal.x,goal.y,goal.z,1.4);
    }

    private void throwGrenades(ServerPlayer host, String name, int amount) {
        var participants = fighters(host.serverLevel());
        String sender = cleanName(name).toLowerCase(Locale.ROOT);
        if ("__test_all__".equals(sender) && !participants.isEmpty()) sender = team(participants.get(0));
        final String safeTeam = sender;
        var targets = participants.stream().filter(f -> !team(f).equals(safeTeam) && !f.parachuting()).toList();
        Entity owner = participants.stream().filter(f -> team(f).equals(safeTeam)).findFirst().orElse(null);
        Vec3 origin = owner == null ? host.getEyePosition() : owner.getEyePosition();
        for (int i=0;i<amount && !targets.isEmpty();i++) {
            var victim = targets.get(host.serverLevel().random.nextInt(targets.size()));
            var visual = new net.minecraft.world.entity.item.ItemEntity(host.serverLevel(),origin.x,origin.y,origin.z,
                new ItemStack(Items.FIRE_CHARGE));
            visual.setNoGravity(true); visual.setNeverPickUp(); visual.setDeltaMovement(Vec3.ZERO);
            host.serverLevel().addFreshEntity(visual);
            grenades.add(new ActiveGrenade(visual,origin,victim,host.serverLevel().getGameTime(),owner,name));
        }
        if (!targets.isEmpty()) host.serverLevel().playSound(null,host.blockPosition(),SoundEvents.SNOWBALL_THROW,
            SoundSource.PLAYERS,0.7F,0.65F);
    }

    private void tickGrenades(ServerLevel level) {
        var iterator = grenades.iterator();
        while (iterator.hasNext()) {
            var grenade = iterator.next();
            if (!grenade.target.isAlive() || !grenade.visual.isAlive()) {
                grenade.visual.discard(); iterator.remove(); continue;
            }
            double t = Math.min(1,(level.getGameTime()-grenade.launched)/12.0);
            Vec3 end = grenade.target.position().add(0,0.7,0);
            Vec3 pos = grenade.origin.lerp(end,t).add(0,Math.sin(Math.PI*t)*3.5,0);
            grenade.visual.teleportTo(pos.x,pos.y,pos.z);
            grenade.visual.setDeltaMovement(Vec3.ZERO);
            if (t < 1) continue;
            level.sendParticles(ParticleTypes.EXPLOSION_EMITTER,pos.x,pos.y,pos.z,1,0,0,0,0);
            level.playSound(null,grenade.target.blockPosition(),SoundEvents.GENERIC_EXPLODE,SoundSource.PLAYERS,1.7F,1.0F);
            damageDirect(grenade.target,60.0F,grenade.owner,grenade.ownerName);
            grenade.visual.discard(); iterator.remove();
        }
    }

    private void clearGrenades() {
        for (var grenade : grenades) grenade.visual.discard();
        grenades.clear();
    }

    private static void lookAt(Mob source, LivingEntity target) {
        double dx = target.getX() - source.getX();
        double dz = target.getZ() - source.getZ();
        double dy = target.getEyeY() - source.getEyeY();
        float yaw = (float)(Mth.atan2(dz, dx) * 180.0 / Math.PI) - 90.0F;
        float pitch = (float)(-(Mth.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180.0 / Math.PI));
        source.setYRot(yaw); source.setYHeadRot(yaw); source.setXRot(pitch);
    }

    private List<SnowFighterEntity> fighters(ServerLevel level) {
        return level.getEntitiesOfClass(SnowFighterEntity.class,
            new AABB(-SnowWarArenaBuilder.RADIUS - 30, arena.floorY() - 20, -SnowWarArenaBuilder.RADIUS - 30,
                SnowWarArenaBuilder.RADIUS + 30, arena.floorY() + 120, SnowWarArenaBuilder.RADIUS + 30), Entity::isAlive);
    }
    private static boolean isFighter(LivingEntity entity) { return entity.getPersistentData().getBoolean("mng_royale_fighter"); }
    private static String team(Entity entity) { return entity == null ? "" : entity.getPersistentData().getString("mng_team"); }
    private static String displayName(Entity entity) {
        if (entity == null) return "Bilinmeyen";
        String name = entity.getPersistentData().getString("mng_viewer_name");
        return name.isBlank() ? entity.getName().getString() : name;
    }
    private static String profileOf(Entity entity) {
        if (entity instanceof SnowFighterEntity fighter) return fighter.profileUrl();
        return entity == null ? "" : entity.getPersistentData().getString("mng_profile");
    }
    private static String encodeProfile(String profile) {
        String value = profile == null ? "" : profile;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
    private static String cleanName(String value) {
        String result = value == null ? "Izleyici" : value.trim().replaceFirst("^@", "");
        return result.isBlank() ? "Izleyici" : result.substring(0, Math.min(48, result.length()));
    }

    private static final class BlockPosUtil {
        private static net.minecraft.core.BlockPos at(Entity entity) { return entity.blockPosition(); }
    }
}
