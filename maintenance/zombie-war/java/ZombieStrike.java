package com.tikmng.zombiestrike;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.monster.Zombie;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.level.GameRules;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.entity.living.LivingHurtEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.entity.player.PlayerInteractEvent;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.event.level.ExplosionEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.loading.FMLEnvironment;
import net.minecraftforge.fml.ModList;
import com.mojang.brigadier.arguments.StringArgumentType;

@Mod(ZombieStrike.MOD_ID)
public final class ZombieStrike {
    public static final String MOD_ID = "mng_zombie_strike";
    public ZombieStrike() {
        MinecraftForge.EVENT_BUS.register(this);
    }

    @SubscribeEvent
    public void registerCommands(RegisterCommandsEvent event) {
        event.getDispatcher().register(Commands.literal("mng")
            .then(Commands.literal("health").executes(ctx -> { InteractionEngine.health(ctx.getSource().getPlayerOrException()); return 1; }))
            .then(Commands.literal("event").then(Commands.argument("trigger", StringArgumentType.greedyString()).executes(ctx -> {
                String trigger = StringArgumentType.getString(ctx, "trigger");
                InteractionEngine.event(ctx.getSource().getPlayerOrException(), trigger, GameConfig.get().rule(trigger).threshold(), new GameState.Viewer("Test İzleyicisi", ""));
                return 1;
            })))
            .then(Commands.literal("status").executes(ctx -> {
                ServerPlayer player = ctx.getSource().getPlayerOrException();
                player.sendSystemMessage(Component.literal("§cTikMnG Zombie War §7| §fHarita: §e" + MapManager.currentMap(player.serverLevel()) + " §7| §fÖldürme: §a" + GameState.kills()));
                return 1;
            }))
            .then(Commands.literal("test")
                .then(Commands.literal("zombie")
                    .then(Commands.argument("adet", IntegerArgumentType.integer(1, 100))
                        .executes(ctx -> {
                            ServerPlayer player = ctx.getSource().getPlayerOrException();
                            int count = IntegerArgumentType.getInteger(ctx, "adet");
                            SpawnManager.queueZombies(player, count, "Test İzleyicisi");
                            return count;
                        })))
                .then(Commands.literal("chaos").executes(ctx -> {
                    ServerPlayer player = ctx.getSource().getPlayerOrException();
                    SpawnManager.queueZombies(player, 50, "KAOS");
                    GameState.notify("KAOS BAŞLADI", 160);
                    return 1;
                }))
                .then(Commands.literal("helper")
                    .then(Commands.argument("adet", IntegerArgumentType.integer(1, 5)).executes(ctx -> {
                        ServerPlayer player = ctx.getSource().getPlayerOrException();
                        int count = IntegerArgumentType.getInteger(ctx, "adet");
                        InteractionEngine.perform(player, GameConfig.Action.HELPER, count, "zombie", new GameState.Viewer("Destek Testi", ""));
                        return count;
                    }))))
            .then(Commands.literal("canli")
                .then(Commands.literal("zombie")
                    .then(Commands.argument("adet", IntegerArgumentType.integer(1, 100))
                        .then(Commands.argument("izleyici", StringArgumentType.word()).executes(ctx -> {
                            ServerPlayer player = ctx.getSource().getPlayerOrException();
                            int count = IntegerArgumentType.getInteger(ctx, "adet");
                            SpawnManager.queueZombies(player, count, StringArgumentType.getString(ctx, "izleyici"));
                            return count;
                        })))))
            .then(Commands.literal("map").executes(ctx -> {
                ctx.getSource().sendSuccess(() -> Component.literal("§eHaritalar: §fDust 2, Office, Fighting Arena, Romanya. §eB §file seçebilirsiniz."), false);
                return 1;
            }))
            .then(Commands.literal("silah")
                .then(Commands.argument("tur", StringArgumentType.word()).executes(ctx -> {
                    ServerPlayer player = ctx.getSource().getPlayerOrException();
                    if (!ModList.get().isLoaded("tacz")) {
                        player.sendSystemMessage(Component.literal("§cTaCZ silah modu yüklü değil."));
                        return 0;
                    }
                    WeaponManager.give(player, StringArgumentType.getString(ctx, "tur"));
                    return 1;
                }))));
    }

    @SubscribeEvent
    public void playerLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player)) return;
        SpawnManager.clear(player.server); GameState.resetRound(); InteractionEngine.reset();
        player.serverLevel().getGameRules().getRule(GameRules.RULE_MOBGRIEFING).set(false, player.server);
        player.serverLevel().getGameRules().getRule(GameRules.RULE_DOFIRETICK).set(false, player.server);
        player.serverLevel().getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, player.server);
        player.serverLevel().setDayTime(6000L);
        GameState.setMap(MapManager.currentMap(player.serverLevel()));
        MapManager.returnToArena(player);
        var arena = MapManager.arenaCenter(player.serverLevel());
        player.setRespawnPosition(net.minecraft.world.level.Level.OVERWORLD, arena, 0.0F, true, false);
        player.setGameMode(net.minecraft.world.level.GameType.ADVENTURE);
        player.server.setDifficulty(net.minecraft.world.Difficulty.NORMAL, true);
        GameState.notify("TikMnG Zombie War - " + GameState.map(), 120);
        player.sendSystemMessage(Component.literal("§aHarita koruması etkin. §fTest: §e/mng test zombie 10"));
        player.sendSystemMessage(Component.literal("§eYayın, harita, eylem ve silah ayarları: §fB"));
        InteractionEngine.health(player); player.setHealth(player.getMaxHealth());
        if (ModList.get().isLoaded("tacz")) WeaponManager.give(player, "tabanca");
        for (net.minecraft.world.entity.Entity entity : player.serverLevel().getAllEntities()) {
            if (entity instanceof Zombie && "Geliştirme Testi".equals(entity.getPersistentData().getString("mng_viewer"))) entity.discard();
        }
    }

    @SubscribeEvent
    public void respawn(PlayerEvent.PlayerRespawnEvent event) {
        if (event.getEntity() instanceof ServerPlayer player && ModList.get().isLoaded("tacz")) {
            player.setGameMode(net.minecraft.world.level.GameType.ADVENTURE);
            SpawnManager.clear(player.server); GameState.resetRound(); InteractionEngine.reset();
            player.getPersistentData().remove("mng_infinite_until");
            InteractionEngine.health(player); player.setHealth(player.getMaxHealth());
            MapManager.returnToArena(player);
            WeaponManager.give(player, "tabanca");
        }
    }

    @SubscribeEvent
    public void serverTick(TickEvent.ServerTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        SpawnManager.tick(event.getServer());
        LiveIntegrationChecks.tick(event.getServer());
        if (GameState.flashTicks > 0) GameState.flashTicks--;
        if (GameState.voiceFireTicks > 0) GameState.voiceFireTicks--;
        for (ServerPlayer player : event.getServer().getPlayerList().getPlayers()) {
            long targetTime = GameState.nightTicks > 0 ? 18000L : 6000L;
            if (player.serverLevel().getDayTime() != targetTime) player.serverLevel().setDayTime(targetTime);
            if (player.isAlive() && event.getServer().getTickCount() % 5 == 0) WeaponManager.supplyAmmo(player);
            if (player.isAlive() && player.getPersistentData().getLong("mng_infinite_until") > player.serverLevel().getGameTime()) WeaponManager.refill(player);
            if (player.isAlive() && event.getServer().getTickCount() % 10 == 0 && MapManager.needsRecovery(player)) MapManager.recover(player);
        }
        if (GameState.nightTicks > 0) GameState.nightTicks--;
        for (var level : event.getServer().getAllLevels()) for (var entity : level.getAllEntities()) {
            if ((entity.getTags().contains("mng_enemy") || entity.getTags().contains("mng_helper")) && event.getServer().getTickCount() % 10 == 0 && MapManager.needsRecovery(entity)) MapManager.recover(entity);
            if (entity.getTags().contains("mng_helper") && entity.getPersistentData().getLong("mng_remove_at") > 0
                && entity.getPersistentData().getLong("mng_remove_at") <= level.getGameTime()) entity.discard();
        }
    }

    @SubscribeEvent
    public void death(LivingDeathEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            var killer = event.getSource().getEntity();
            GameState.killer = killer == null ? new GameState.Viewer("Çevre", "") : GameState.viewers.getOrDefault(killer.getUUID(), new GameState.Viewer(killer.getName().getString(), ""));
            GameState.roundEnded = true;
            SpawnManager.clear(player.server); InteractionEngine.reset();
            return;
        }
        if (!(event.getEntity() instanceof Mob mob) || !mob.getTags().contains("mng_enemy")) return;
        if (mob.level() instanceof ServerLevel level) level.sendParticles(net.minecraft.core.particles.ParticleTypes.POOF,
            mob.getX(), mob.getY() + mob.getBbHeight() / 2, mob.getZ(), 28, 0.45, 0.65, 0.45, 0.08);
        if (event.getSource().getEntity() instanceof ServerPlayer player) {
            GameState.addKill();
        }
    }

    @SubscribeEvent
    public void hurt(com.tacz.guns.api.event.common.EntityHurtByGunEvent.Post event) {
        if (!(event.getHurtEntity() instanceof Mob mob) || !mob.getTags().contains("mng_enemy") || event.getLogicalSide() != net.minecraftforge.fml.LogicalSide.SERVER || event.getAmount() <= 0) return;
        if (event.getAttacker() instanceof ServerPlayer player && !GameState.roundEnded) {
            GameState.addWeaponHit();
            if (GameState.weaponHits() >= 100) {
                GameState.resetWeaponHits();
                WeaponManager.advance(player);
            }
        }
    }

    @SubscribeEvent public void breakBlock(BlockEvent.BreakEvent event) { if (MapManager.isProtected(event.getLevel())) event.setCanceled(true); }
    @SubscribeEvent public void placeBlock(BlockEvent.EntityPlaceEvent event) { if (MapManager.isProtected(event.getLevel())) event.setCanceled(true); }
    @SubscribeEvent public void multiPlace(BlockEvent.EntityMultiPlaceEvent event) { if (MapManager.isProtected(event.getLevel())) event.setCanceled(true); }
    @SubscribeEvent public void explode(ExplosionEvent.Detonate event) { if (MapManager.isProtected(event.getLevel())) { event.getAffectedBlocks().clear(); event.getAffectedEntities().removeIf(entity -> !(entity instanceof Zombie)); } }

    @SubscribeEvent
    public void useBlock(PlayerInteractEvent.RightClickBlock event) {
        if (MapManager.isProtected(event.getLevel()) && event.getItemStack().getItem() instanceof BlockItem) event.setCanceled(true);
    }
}
