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
        if (mc.screen instanceof net.minecraft.client.gui.screens.PauseScreen) mc.setScreen(null);
        if (mc.screen != null && mc.screen.getClass().getName().contains("Accessibility"))
            mc.setScreen(new SnowWarTitleScreen());
    }

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!ENABLED || done || server.getTickCount() < 400) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        try {
            if (!initialized) {
                GiftRulesSmoke.verify();
                rules = SnowWarClientConfig.GiftRule.defaults();
                initialized = true;
            }
            if (index >= rules.length) {

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
                engine.state().start();
                for (int t = 0; t < 200; t++) engine.state().tickStartCountdown();
                sender.setHealth(30); rival.setHealth(30);
                dispatch(server, host, rule);
                switch (rule.action) {
                    case "OYUNCU", "TAKIM_KALKANI" -> {
                        GiftRulesSmoke.require(participants(host).size() == before + rule.amount, "fighter count mismatch");
                        if (rule.action.equals("TAKIM_KALKANI"))
                            GiftRulesSmoke.require(participants(host).stream().filter(e -> name(e).equals("GiftSender")
                                && e.getPersistentData().getInt("mng_bonus_hits") > 0).count() == rule.amount, "shield count mismatch");
                    }
                    case "KAR_ADAMI", "AGIR_KARTOPU" -> GiftRulesSmoke.require(participants(host).stream()
                        .filter(e -> e instanceof SnowBeastEntity).count() == rule.amount, "snow boss count mismatch");
                    case "EKSTRA_CAN" -> GiftRulesSmoke.require(sender.getMaxHealth() == 40 && sender.getHealth() == 40, "extra heart missing");
                    case "IYILESTIR" -> GiftRulesSmoke.require(sender.getPersistentData().getInt("mng_stone_shots") == 1, "stone shot missing");
                    case "KARTOPU_SILAHI" -> GiftRulesSmoke.require(sender.getPersistentData().getLong("mng_snow_gun_until")
                        > host.serverLevel().getGameTime(), "snow gun not armed");
                    case "KAR_HORTUMU", "BUZ_TUZAGI" -> GiftRulesSmoke.require(engine.powers().zoneCount() == 1, "power zone missing");
                    case "HERKESI_DUSUR" -> GiftRulesSmoke.require(!rival.isAlive() && sender.isAlive(), "galaxy target mismatch");
                    case "CIG" -> { }
                    default -> throw new IllegalStateException("untested guide action " + rule.action);
                }
                since = server.getTickCount();
                applied = true;
                return;
            }
            if (server.getTickCount() - since < 44) return;
            if ("CIG".equals(rule.action)) GiftRulesSmoke.require(rival.getHealth() < 30 && sender.getHealth() == 30,
                "lightning gift did not damage only the rival");
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
            e -> e.isAlive() && SnowWarEngine.isArenaCombatant(e));
    }
}
