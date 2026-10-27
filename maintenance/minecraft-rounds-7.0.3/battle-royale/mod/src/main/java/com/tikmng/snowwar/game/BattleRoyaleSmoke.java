package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.phys.AABB;

import java.util.List;

/** Opt-in end-to-end verification used by the standalone beta launcher. */
public final class BattleRoyaleSmoke {
    private final boolean enabled = Boolean.getBoolean("mng.royale.smoke");
    private final boolean visual = Boolean.getBoolean("mng.royale.visual");
    private int visualStage = -1;
    private boolean started;
    private boolean reported;
    private long startedAt;
    private boolean spawned;
    private boolean landed;
    private boolean gear;
    private boolean fired;
    private boolean resolved;
    private boolean zoneShrank;
    private boolean arranged;
    private boolean armorRules;
    private boolean hostReloaded;
    private boolean zoneDamage;
    private boolean giftActions;
    private boolean billboard;
    private SnowFighterEntity zoneProbe;
    private SnowFighterEntity grenadeTarget;
    private SnowFighterEntity grenadeOwner;
    private boolean grenadePassed;

    public void tick(MinecraftServer server, SnowWarArenaBuilder arena, SnowWarEngine engine) {
        if ((!enabled && !visual) || reported || !arena.ready()) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        if (host.tickCount < 40) return;
        if (visual) { tickVisual(host, arena, engine); return; }
        long now = host.serverLevel().getGameTime();
        if (!started) {
            host.teleportTo(0, arena.floorY() + 25, 30);
            host.getAbilities().flying = true;
            host.getAbilities().mayfly = true;
            host.onUpdateAbilities();
            host.setYRot(180);
            host.setXRot(40);
            engine.applyAction(host, "ZIRH_3", "Alpha", "", 1);
            engine.applyAction(host, "OYUNCU", "Alpha", "", 1);
            engine.applyAction(host, "OYUNCU", "Bravo", "", 1);
            giftActions = verifyGiftActions(host, arena, engine);
            billboard = true;
            int[][] faces = {{0,7},{0,-7},{-7,0},{7,0}};
            for (int[] face : faces) billboard &= host.serverLevel().getBlockState(
                new net.minecraft.core.BlockPos(face[0], arena.floorY()+24, face[1]))
                .is(net.minecraft.world.level.block.Blocks.BLACK_CONCRETE);
            var signs = host.serverLevel().getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                new AABB(-10,arena.floorY()+20,-10,10,arena.floorY()+30,10));
            billboard &= signs.size() == 4;
            for (var sign : signs) {
                var nbt = new net.minecraft.nbt.CompoundTag();
                sign.saveWithoutId(nbt);
                var transform = com.mojang.math.Transformation.EXTENDED_CODEC
                    .parse(net.minecraft.nbt.NbtOps.INSTANCE,nbt.get("transformation")).result().orElse(null);
                billboard &= nbt.getString("text").contains("TikMnG") && transform != null
                    && Math.abs(transform.getScale().x()-8)<0.01;
            }
            armorRules = verifyArmor(host, arena, engine);
            SnowWar.LOGGER.info("MNG_ROYALE_ARMOR_TEST passed={}", armorRules);
            engine.applyAction(host, "P90", "Alpha", "", 1);
            engine.applyAction(host, "ZIRH_1", "Alpha", "", 1);
            grenadeOwner = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                new AABB(-210,arena.floorY()-20,-210,210,arena.floorY()+120,210)).stream()
                .filter(f->f.getName().getString().equals("Alpha")).findFirst().orElseThrow();
            grenadeTarget = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                new AABB(-210,arena.floorY()-20,-210,210,arena.floorY()+120,210)).stream()
                .filter(f->f.getName().getString().equals("Bravo")).findFirst().orElseThrow();
            grenadeTarget.setHealth(100);
            engine.applyAction(host,"EL_BOMBASI","Alpha","",1);
            engine.setLobbyWaitSeconds(2);
            engine.start(host);
            engine.forceZonePhaseForTesting(now);
            host.getInventory().selected = 0;
            host.connection.send(new net.minecraft.network.protocol.game.ClientboundSetCarriedItemPacket(0));
            host.getMainHandItem().getOrCreateTag().putInt("GunCurrentAmmoCount", 0);
            host.getMainHandItem().getOrCreateTag().putBoolean("HasBulletInBarrel", false);
            startedAt = now;
            started = true;
            return;
        }
        if (now-startedAt == 20) {
            grenadePassed = grenadeTarget.getHealth()==40 && grenadeOwner.getHealth()==100;
            grenadeTarget.setHealth(100);
            SnowWar.LOGGER.info("MNG_ROYALE_GRENADE passed={}",grenadePassed);
        }
        List<SnowFighterEntity> fighters = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
            new AABB(-180, arena.floorY() - 20, -180, 180, arena.floorY() + 100, 180), SnowFighterEntity::isAlive);
        spawned |= fighters.size() == 2;
        if (!arranged && fighters.size() == 2 && fighters.stream().allMatch(SnowFighterEntity::parachuting)) {
            fighters.get(0).teleportTo(-12.0, arena.floorY() + 9.0, 0.0);
            fighters.get(1).teleportTo(12.0, arena.floorY() + 9.0, 0.0);
            fighters.get(0).getPersistentData().putDouble("mng_landing_y", arena.floorY() + 1.05);
            fighters.get(1).getPersistentData().putDouble("mng_landing_y", arena.floorY() + 1.05);
            fighters.get(0).getPersistentData().putDouble("mng_landing_x", -12);
            fighters.get(0).getPersistentData().putDouble("mng_landing_z", 0);
            fighters.get(1).getPersistentData().putDouble("mng_landing_x", 12);
            fighters.get(1).getPersistentData().putDouble("mng_landing_z", 0);
            engine.forceZonePhaseForTesting(now);
            arranged = true;
        }
        landed |= arranged && spawned && fighters.stream().noneMatch(SnowFighterEntity::parachuting);
        gear |= fighters.stream().anyMatch(fighter -> fighter.getName().getString().equals("Alpha")
            && fighter.weaponTier() == 2 && fighter.helmetTier() == 1
            && fighter.vestTier() == 1 && !fighter.shielded());
        fired |= fighters.stream().anyMatch(fighter -> fighter.getPersistentData().getLong("mng_last_shot") > 0);
        resolved |= spawned && landed && fired && fighters.size() < 2;
        zoneShrank |= engine.zoneRadiusForTesting() < SnowWarArenaBuilder.RADIUS - 2.1;
        var hostTag = host.getMainHandItem().getOrCreateTag();
        int loaded = hostTag.getInt("GunCurrentAmmoCount") + (hostTag.getBoolean("HasBulletInBarrel") ? 1 : 0);
        hostReloaded |= now - startedAt > 65 && loaded == 6;
        if (resolved && zoneShrank && zoneProbe == null) {
            zoneProbe = SnowWar.FIGHTER.get().create(host.serverLevel());
            if (zoneProbe != null) {
                zoneProbe.moveTo(-198, arena.floorY() + 1.05, 0);
                zoneProbe.setNoAi(true);
                zoneProbe.setHealth(1);
                zoneProbe.getPersistentData().putBoolean("mng_royale_fighter", true);
                zoneProbe.getPersistentData().putString("mng_team", "zone_probe");
                host.serverLevel().addFreshEntity(zoneProbe);
            }
        }
        zoneDamage |= zoneProbe != null && !zoneProbe.isAlive();
        if ((spawned && landed && gear && fired && resolved && zoneShrank && zoneDamage && hostReloaded) || now - startedAt > 1200) {
            reported = true;
            SnowWar.LOGGER.info("MNG_ROYALE_SMOKE_RESULT spawned={} landed={} gear={} fired={} resolved={} zone={} armor={} reload={} zoneDamage={} gifts={} billboard={}",
                spawned, landed, gear, fired, resolved, zoneShrank, armorRules, hostReloaded, zoneDamage, giftActions && grenadePassed, billboard);
        }
    }

    private void tickVisual(ServerPlayer host, SnowWarArenaBuilder arena, SnowWarEngine engine) {
        if (!started) {
            started = true;
            startedAt = host.serverLevel().getGameTime();
            engine.resetSession(host);
            arena.hideLobbyAircraft();
            host.getAbilities().flying = true;
            host.getAbilities().mayfly = true;
            host.onUpdateAbilities();
        }
        int stage = 4 + (int)((host.serverLevel().getGameTime() - startedAt) / 200);
        if (stage == 4 && host.serverLevel().getGameTime()%30 == 0) {
            for (var fighter : host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                new AABB(-20,arena.floorY(),0,20,arena.floorY()+8,20))) fighter.beginHeal();
        }
        if (stage == 6 && host.serverLevel().getGameTime()%20 == 0) {
            var bullet = new net.minecraft.world.entity.projectile.Arrow(host.serverLevel(),host);
            bullet.setPos(0,arena.floorY()+3.6,20);
            bullet.setNoGravity(true);
            bullet.shoot(1,0,0,0.001F,0);
            bullet.pickup=net.minecraft.world.entity.projectile.AbstractArrow.Pickup.DISALLOWED;
            bullet.getPersistentData().putBoolean("mng_royale_bullet",true);
            host.serverLevel().addFreshEntity(bullet);
        }
        if (stage == visualStage) return;
        visualStage = stage;
        int[][] views = {{0,38,180},{0,-38,0},{38,0,90},{-38,0,-90}};
        if (stage < 4) {
            host.teleportTo(views[stage][0], arena.floorY()+24, views[stage][1]);
            host.setYRot(views[stage][2]); host.setXRot(0);
            host.connection.teleport(host.getX(),host.getY(),host.getZ(),host.getYRot(),0);
            SnowWar.LOGGER.info("MNG_ROYALE_VISUAL face={}", stage);
        } else if (stage == 4) {
            for (int tier=1;tier<=4;tier++) {
                String name = "Zirh_"+tier;
                engine.applyAction(host,"OYUNCU",name,"",1);
                engine.applyAction(host,"ZIRH_"+tier,name,"",1);
            }
            int index = 0;
            for (var fighter : host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                    new AABB(-210,arena.floorY()-20,-210,210,arena.floorY()+120,210))) {
                fighter.getPersistentData().putBoolean("mng_in_lobby",false);
                fighter.setNoAi(true);
                fighter.teleportTo(-4+index*4, arena.floorY()+1.05, 12);
                fighter.setYRot(0); fighter.setYBodyRot(0);
                fighter.setHealth(index == 0 ? 100 : index == 1 ? 50 : 20);
                index++;
            }
            host.connection.teleport(0,arena.floorY()+3,24,180,4);
            SnowWar.LOGGER.info("MNG_ROYALE_VISUAL equipment");
        } else if (stage == 5) {
            host.displayClientMessage(net.minecraft.network.chat.Component.literal("MNG_SNOW_WINNER|NetKullaniciAdi|"),false);
            SnowWar.LOGGER.info("MNG_ROYALE_VISUAL winner");
        } else if (stage == 6) {
            host.connection.teleport(0,arena.floorY()+2,23,180,0);
            var bullet = new net.minecraft.world.entity.projectile.Arrow(host.serverLevel(),host);
            bullet.setPos(0,arena.floorY()+3.6,20);
            bullet.setNoGravity(true);
            bullet.shoot(1,0,0,0.001F,0);
            bullet.pickup=net.minecraft.world.entity.projectile.AbstractArrow.Pickup.DISALLOWED;
            bullet.getPersistentData().putBoolean("mng_royale_bullet",true);
            host.serverLevel().addFreshEntity(bullet);
            SnowWar.LOGGER.info("MNG_ROYALE_VISUAL bullet");
        } else {
            engine.resetRoundNow(host);
            reported = true;
            SnowWar.LOGGER.info("MNG_ROYALE_VISUAL done");
        }
    }

    private boolean verifyGiftActions(ServerPlayer host, SnowWarArenaBuilder arena, SnowWarEngine engine) {
        var fighters = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
            new AABB(-210, arena.floorY()-20, -210, 210, arena.floorY()+120, 210));
        var alpha = fighters.stream().filter(f -> f.getName().getString().equals("Alpha")).findFirst().orElseThrow();
        var bravo = fighters.stream().filter(f -> f.getName().getString().equals("Bravo")).findFirst().orElseThrow();
        boolean passed = alpha.armorHits() == 3 && bravo.armorHits() == 0;
        String[] weapons = {"MP5K", "P90", "M4", "AK", "AWM"};
        for (int i = 0; i < weapons.length; i++) {
            engine.applyAction(host, weapons[i], "Alpha", "", 1);
            passed &= alpha.weaponTier() == i+1 && !alpha.getMainHandItem().isEmpty() && bravo.weaponTier() == 0;
        }
        alpha.setWeaponTier(0);
        engine.applyAction(host, "SILAH_YUKSELT", "Alpha", "", 3);
        passed &= alpha.weaponTier() == 3;
        alpha.setHealth(27);
        for (int tier=1;tier<=4;tier++) {
            engine.applyAction(host,"ZIRH_"+tier,"Alpha","",1);
            passed &= alpha.helmetTier()==tier && alpha.vestTier()==tier && alpha.armorHits()==tier
                && alpha.getHealth()==27 && !alpha.shielded();
        }
        passed &= alpha.getItemBySlot(net.minecraft.world.entity.EquipmentSlot.CHEST)
            .is(net.minecraft.world.item.Items.NETHERITE_CHESTPLATE);
        engine.applyAction(host, "TAM_TECHIZAT", "Alpha", "", 1);
        passed &= alpha.weaponTier() == 5 && alpha.helmetTier() == 4 && alpha.vestTier() == 4
            && alpha.armorHits() == 4 && !alpha.shielded() && alpha.getHealth() == 27;
        engine.applyAction(host, "KIT_BAS", "Alpha", "", 1);
        passed &= alpha.getHealth() == alpha.getMaxHealth() && alpha.healAnimationAge(0)==0;
        SnowWar.LOGGER.info("MNG_ROYALE_GIFT_ACTIONS passed={} pendingArmor={} actions=14", passed, alpha.armorHits() == 4);
        alpha.setShielded(false);
        alpha.setItemSlot(net.minecraft.world.entity.EquipmentSlot.OFFHAND, net.minecraft.world.item.ItemStack.EMPTY);
        return passed;
    }

    private boolean verifyArmor(ServerPlayer host, SnowWarArenaBuilder arena, SnowWarEngine engine) {
        var fighters = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
            new AABB(-210, arena.floorY()-20, -210, 210, arena.floorY()+120, 210));
        var alpha = fighters.stream().filter(f -> f.getName().getString().equals("Alpha")).findFirst().orElse(null);
        if (alpha == null) return false;
        boolean passed = true;
        var arrow = new net.minecraft.world.entity.projectile.Arrow(host.serverLevel(), host);
        var source = host.serverLevel().damageSources().arrow(arrow, host);
        for (int tier = 1; tier <= 4; tier++) {
            alpha.setHealth(37);
            engine.applyAction(host, "ZIRH_" + tier, "Alpha", "", 1);
            passed &= alpha.getHealth() == 37 && alpha.armorHits() == tier;
            for (int hit = 0; hit < tier; hit++) {
                alpha.invulnerableTime = 0;
                alpha.hurt(source, 10);
                passed &= alpha.getHealth() == 37 && alpha.armorHits() == tier-hit-1;
            }
            alpha.invulnerableTime = 0;
            alpha.hurt(source, 10);
            passed &= alpha.getHealth() == 27 && alpha.vestTier() == 0 && alpha.helmetTier() == 0;
        }
        engine.applyAction(host, "ZIRH_3", "Alpha", "", 1);
        passed &= alpha.getHealth() == 27;
        engine.applyAction(host, "TAM_TECHIZAT", "Alpha", "", 1);
        passed &= alpha.getHealth() == 27;
        engine.applyAction(host, "KIT_BAS", "Alpha", "", 1);
        passed &= alpha.getHealth() == alpha.getMaxHealth() && alpha.armorHits() == 4;
        var probe = SnowWar.FIGHTER.get().create(host.serverLevel());
        probe.getPersistentData().putBoolean("mng_royale_fighter",true);
        probe.getPersistentData().putString("mng_team","awm_probe");
        probe.setHealth(100); probe.setArmorHits(4);
        host.serverLevel().addFreshEntity(probe);
        arrow.getPersistentData().putBoolean("mng_royale_bullet",true);
        arrow.getPersistentData().putInt("mng_weapon_tier",5);
        engine.hitByBullet(arrow,probe);
        passed &= !probe.isAlive();
        probe.discard();
        alpha.setHelmetTier(0); alpha.setVestTier(0); alpha.setArmorHits(0);
        alpha.setShielded(false);
        alpha.setWeaponTier(0);
        alpha.setItemSlot(net.minecraft.world.entity.EquipmentSlot.OFFHAND, net.minecraft.world.item.ItemStack.EMPTY);
        return passed;
    }
}
