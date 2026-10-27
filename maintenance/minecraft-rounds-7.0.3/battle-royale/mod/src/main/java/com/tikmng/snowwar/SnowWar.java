package com.tikmng.snowwar;

import com.mojang.logging.LogUtils;
import com.tikmng.snowwar.game.SnowBeastEntity;
import com.tikmng.snowwar.game.SnowFighterEntity;
import com.tikmng.snowwar.game.SnowWarArenaBuilder;
import com.tikmng.snowwar.game.BattleRoyaleSmoke;
import com.tikmng.snowwar.game.SnowWarCommands;
import com.tikmng.snowwar.game.SnowWarEngine;
import com.tikmng.snowwar.game.SnowWarSounds;
import com.tikmng.snowwar.game.BattleRoyaleWeapons;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.projectile.Arrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.GameType;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.entity.ProjectileImpactEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.event.entity.EntityAttributeCreationEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;
import org.slf4j.Logger;

@Mod(SnowWar.MOD_ID)
public final class SnowWar {
    public static final String MOD_ID = "mng_battle_royale";
    public static final Logger LOGGER = LogUtils.getLogger();
    private static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(ForgeRegistries.ENTITY_TYPES, MOD_ID);
    public static final RegistryObject<EntityType<SnowFighterEntity>> FIGHTER = ENTITIES.register("fighter", () ->
        EntityType.Builder.of(SnowFighterEntity::new, MobCategory.CREATURE).sized(0.6F, 1.8F)
            .clientTrackingRange(16).build(MOD_ID + ":fighter"));
    public static final RegistryObject<EntityType<SnowBeastEntity>> BEAST = ENTITIES.register("unused_beast", () ->
        EntityType.Builder.of(SnowBeastEntity::new, MobCategory.CREATURE).sized(1.5F, 2.8F)
            .clientTrackingRange(10).build(MOD_ID + ":unused_beast"));
    private final SnowWarArenaBuilder arenaBuilder = new SnowWarArenaBuilder();
    private final SnowWarEngine engine = new SnowWarEngine(arenaBuilder);
    private final BattleRoyaleSmoke smoke = new BattleRoyaleSmoke();
    private final com.tikmng.snowwar.client.GiftActionSmoke giftSmoke = new com.tikmng.snowwar.client.GiftActionSmoke();

    public SnowWar() {
        ENTITIES.register(FMLJavaModLoadingContext.get().getModEventBus());
        SnowWarSounds.REGISTER.register(FMLJavaModLoadingContext.get().getModEventBus());
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::attributes);
        MinecraftForge.EVENT_BUS.register(this);
        LOGGER.info("TikMnG Battle Royale Beta yüklendi");
    }

    private void attributes(EntityAttributeCreationEvent event) {
        event.put(FIGHTER.get(), SnowFighterEntity.attributes().build());
        event.put(BEAST.get(), net.minecraft.world.entity.animal.IronGolem.createAttributes().build());
    }

    @SubscribeEvent public void registerCommands(RegisterCommandsEvent event) {
        SnowWarCommands.register(event.getDispatcher(), engine);
    }

    @SubscribeEvent public void serverTick(TickEvent.ServerTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        arenaBuilder.tick();
        engine.tick(event.getServer());
        smoke.tick(event.getServer(), arenaBuilder, engine);
        giftSmoke.tick(event.getServer(), engine, arenaBuilder);
        if (event.getServer().getTickCount() % 100 == 0) arenaBuilder.sweep();
    }

    @SubscribeEvent public void playerJoin(PlayerEvent.PlayerLoggedInEvent event) {
        if (!(event.getEntity() instanceof net.minecraft.server.level.ServerPlayer player)) return;
        player.setGameMode(GameType.SURVIVAL);
        player.getAbilities().mayfly = true;
        player.onUpdateAbilities();
        arenaBuilder.startIfNeeded(player);
        engine.resetSession(player);
        if (player.getAttribute(Attributes.MAX_HEALTH) != null) {
            player.getAttribute(Attributes.MAX_HEALTH).setBaseValue(100.0);
            player.setHealth(100.0F);
        }
        giveHostWeapon(player);
    }

    @SubscribeEvent public void playerTick(TickEvent.PlayerTickEvent event) {
        if (event.phase != TickEvent.Phase.END || !(event.player instanceof net.minecraft.server.level.ServerPlayer player)) return;
        if (player.tickCount % 100 == 0) player.addEffect(new net.minecraft.world.effect.MobEffectInstance(
            net.minecraft.world.effect.MobEffects.NIGHT_VISION, 1200, 0, false, false, false));
        BattleRoyaleWeapons.maintainMagazine(player);
    }

    @SubscribeEvent public void fighterHurt(net.minecraftforge.event.entity.living.LivingHurtEvent event) {
        if (event.getEntity() instanceof net.minecraft.server.level.ServerPlayer player) {
            event.setCanceled(true);
            player.setHealth(player.getMaxHealth());
            return;
        }
        if (!(event.getEntity() instanceof SnowFighterEntity fighter) || !(fighter.level() instanceof net.minecraft.server.level.ServerLevel level)) return;
        if (event.getSource().is(net.minecraft.tags.DamageTypeTags.IS_PROJECTILE) && engine.absorbShot(fighter)) {
            event.setCanceled(true);
            return;
        }
        level.sendParticles(new net.minecraft.core.particles.DustParticleOptions(new org.joml.Vector3f(0.8F, 0.015F, 0.02F), 1.3F),
            fighter.getX(), fighter.getY() + 1, fighter.getZ(), 22, 0.3, 0.4, 0.3, 0.07);
    }

    @SubscribeEvent public void fighterDied(net.minecraftforge.event.entity.living.LivingDeathEvent event) {
        if (!(event.getEntity() instanceof SnowFighterEntity fighter) || !(fighter.level() instanceof net.minecraft.server.level.ServerLevel level)) return;
        if (fighter.getPersistentData().getBoolean("mng_kill_announced")) return;
        fighter.getPersistentData().putBoolean("mng_kill_announced", true);
        var attacker = event.getSource().getEntity();
        String killer = attacker == null ? "Savaş alanı" : attacker.getName().getString();
        String killerProfile = attacker == null ? "" : attacker.getPersistentData().getString("mng_profile");
        if (attacker instanceof SnowFighterEntity source) killerProfile = source.profileUrl();
        String encodedKiller = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            killerProfile.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String encodedVictim = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            fighter.profileUrl().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        for (var player : level.players()) player.displayClientMessage(net.minecraft.network.chat.Component.literal(
            "MNG_SNOW_KILL|" + killer + "|" + fighter.getName().getString()
                + "|" + encodedKiller + "|" + encodedVictim), false);
        fighter.discard();
    }

    @SubscribeEvent public void playerRespawn(PlayerEvent.PlayerRespawnEvent event) {
        if (!(event.getEntity() instanceof net.minecraft.server.level.ServerPlayer player)) return;
        player.getAbilities().mayfly = true;
        player.onUpdateAbilities();
        if (player.getAttribute(Attributes.MAX_HEALTH) != null) {
            player.getAttribute(Attributes.MAX_HEALTH).setBaseValue(100.0);
            player.setHealth(100.0F);
        }
        giveHostWeapon(player);
    }

    @SubscribeEvent public void bulletHit(ProjectileImpactEvent event) {
        if (!(event.getProjectile() instanceof Arrow arrow) || arrow.level().isClientSide
                || !arrow.getPersistentData().getBoolean("mng_royale_bullet")) return;
        if (event.getRayTraceResult() instanceof EntityHitResult hit && hit.getEntity() instanceof LivingEntity target) {
            event.setCanceled(true);
            engine.hitByBullet(arrow, target);
            arrow.discard();
        }
    }

    private static void giveHostWeapon(net.minecraft.server.level.ServerPlayer player) {
        ItemStack weapon = BattleRoyaleWeapons.create(0, true);
        for (int slot = 0; slot < 9; slot++) player.getInventory().setItem(slot, ItemStack.EMPTY);
        player.getInventory().setItem(0, weapon);
        player.getInventory().selected = 1;
        player.connection.send(new net.minecraft.network.protocol.game.ClientboundSetCarriedItemPacket(1));
    }
}
