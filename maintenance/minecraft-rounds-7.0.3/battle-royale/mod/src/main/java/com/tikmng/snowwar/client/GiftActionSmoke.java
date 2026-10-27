package com.tikmng.snowwar.client;

import com.google.gson.JsonObject;
import com.tikmng.snowwar.game.*;
import net.minecraft.client.Minecraft;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.phys.AABB;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** Runs synthetic gift packets through the real command handler and native entities. */
public final class GiftActionSmoke {
    private static final boolean ENABLED = Boolean.getBoolean("mng.gift.smoke");
    private boolean done;
    private boolean initialized;
    private boolean applied;
    private int index;
    private long since;
    private SnowWarClientConfig.GiftRule[] rules;
    private LivingEntity sender, rival;
    private int before;

    public static void clientTick() {
        if (!ENABLED) return;
        Minecraft mc = Minecraft.getInstance();
        mc.options.pauseOnLostFocus = false;
        if (mc.screen != null && mc.screen.getClass().getName().contains("Accessibility"))
            mc.setScreen(new SnowWarTitleScreen());
    }

    public void tick(MinecraftServer server, SnowWarEngine engine, SnowWarArenaBuilder arena) {
        if (!ENABLED || done || server.getTickCount() < 400 || !arena.ready()) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        try {
            if (!initialized) {
                GiftRulesSmoke.verify();
                rules = SnowWarClientConfig.GiftRule.defaults();
                initialized = true;
            }
            if (index >= rules.length) {
                engine.resetSession(host);
                var perfume = java.util.Arrays.stream(rules).filter(r -> r.giftId.equals("5658")).findFirst().orElseThrow();
                dispatch(server, host, perfume);
                var join = java.util.Arrays.stream(rules).filter(r -> r.giftId.equals("7934")).findFirst().orElseThrow();
                dispatch(server, host, join);
                var entrant = (SnowFighterEntity)participants(host).stream().filter(e -> name(e).equals("GiftSender")).findFirst().orElseThrow();
                GiftRulesSmoke.require(entrant.weaponTier() == 1 && entrant.helmetTier() == 0, "pre-join perfume support lost");
                finish(engine, host, "passed guideActions=" + rules.length + " nativeEntities=true realCommandHandler=true");
                return;
            }
            var rule = rules[index];
            if (!applied) {
                engine.resetSession(host);
                host.getAbilities().mayfly = true; host.getAbilities().flying = true; host.onUpdateAbilities();
                int floor = host.serverLevel().getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, 0, 0);
                host.teleportTo(0, floor + 8, 24);
                engine.join(host, "fixture-sender", "GiftSender", "");
                engine.join(host, "fixture-rival", "GiftRival", "");
                sender = participants(host).stream().filter(e -> name(e).equals("GiftSender")).findFirst().orElseThrow();
                rival = participants(host).stream().filter(e -> name(e).equals("GiftRival")).findFirst().orElseThrow();
                sender.teleportTo(-30, floor, 0); rival.teleportTo(30, floor, 0);
                before = participants(host).size();
                sender.setHealth(50); rival.setHealth(100);
                dispatch(server, host, rule);
                var fighter = (SnowFighterEntity)sender;
                switch (rule.action) {
                    case "OYUNCU" -> GiftRulesSmoke.require(participants(host).size() == before + rule.amount, "join did not add participant");
                    case "SILAH_YUKSELT" -> GiftRulesSmoke.require(fighter.weaponTier() == 1 && fighter.helmetTier() == 0
                        && fighter.vestTier() == 0, "perfume changed armor instead of weapon");
                    case "ZIRH_1", "ZIRH_2", "ZIRH_3", "ZIRH_4" -> {
                        int tier = Integer.parseInt(rule.action.substring(5));
                        GiftRulesSmoke.require(fighter.helmetTier() == tier && fighter.vestTier() == tier
                            && fighter.armorHits() == tier && fighter.weaponTier() == 0, "armor tier mismatch");
                    }
                    case "KIT_BAS" -> GiftRulesSmoke.require(sender.getHealth() == sender.getMaxHealth(), "kit did not heal");
                    case "TAM_TECHIZAT" -> GiftRulesSmoke.require(fighter.weaponTier() == 5 && fighter.helmetTier() == 4
                        && fighter.vestTier() == 4, "full gear mismatch");
                    case "EL_BOMBASI" -> { }
                    default -> throw new IllegalStateException("untested guide action " + rule.action);
                }
                since = server.getTickCount();
                applied = true;
                return;
            }
            if (server.getTickCount() - since < 44) return;
            if ("EL_BOMBASI".equals(rule.action))
                GiftRulesSmoke.require(rival.getHealth() == 40 && sender.getHealth() == 50, "grenade did not damage only the rival");
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_GIFT_ACTION_CASE passed id={} action={} amount={} seconds={}",
                rule.giftId, rule.action, rule.amount, rule.durationSeconds);
            index++; applied = false;
        } catch (Exception failure) {
            finish(engine, host, "failed index=" + index + " reason=" + failure.getMessage());
        }
    }
    private void finish(SnowWarEngine engine, ServerPlayer host, String result) {
        done = true; engine.resetSession(host);
        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_GIFT_ACTION_SMOKE_RESULT {}", result);
        Minecraft.getInstance().execute(() -> Minecraft.getInstance().stop());
    }
    private static void dispatch(MinecraftServer server, ServerPlayer host, SnowWarClientConfig.GiftRule rule) {
        var action = GiftRulesSmoke.resolve(rule);
        GiftRulesSmoke.require(action != null, "unresolved gift " + rule.giftId);
        JsonObject payload = new JsonObject();
        payload.addProperty("action", action.action()); payload.addProperty("username", action.username());
        payload.addProperty("profile", action.profile()); payload.addProperty("count", action.count());
        payload.addProperty("durationSeconds", action.durationSeconds());
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.toString().getBytes(StandardCharsets.UTF_8));
        int result = server.getCommands().performPrefixedCommand(host.createCommandSourceStack(), "snowwar event " + encoded);
        GiftRulesSmoke.require(result > 0, "command rejected " + rule.giftId);
    }
    private static String name(LivingEntity e) { return e.getPersistentData().getString("mng_viewer_name"); }
    private static java.util.List<LivingEntity> participants(ServerPlayer host) {
        return host.serverLevel().getEntitiesOfClass(LivingEntity.class, new AABB(-210, -64, -210, 210, 320, 210),
            e -> e.isAlive() && e.getPersistentData().getBoolean("mng_royale_fighter"));
    }
}
