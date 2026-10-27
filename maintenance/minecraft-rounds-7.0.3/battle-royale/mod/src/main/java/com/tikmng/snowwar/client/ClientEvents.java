package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.InputEvent;
import net.minecraftforge.client.event.InputEvent.MouseButton.Pre;
import net.minecraftforge.client.event.ScreenEvent;
import net.minecraftforge.client.event.ComputeFovModifierEvent;
import net.minecraftforge.client.event.ClientChatReceivedEvent;
import net.minecraftforge.client.event.RenderGuiOverlayEvent;
import net.minecraftforge.client.event.RenderLivingEvent;
import net.minecraftforge.client.gui.overlay.VanillaGuiOverlay;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.animal.SnowGolem;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import org.lwjgl.glfw.GLFW;
import com.tikmng.snowwar.game.SnowWarSounds;
import net.minecraft.sounds.SoundSource;
import net.minecraft.client.CameraType;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;

@Mod.EventBusSubscriber(modid = "mng_battle_royale", value = Dist.CLIENT)
public final class ClientEvents {
    private static long lastSpacePress;
    private static boolean zooming;
    private static float zoomFactor = 0.38F;
    private static final double FIXED_GUI_SCALE = 3.5D;
    private static String deathName = "";
    private static String deathProfile = "";
    private static long deathNoticeStarted;
    private static boolean deathNoticeActive;
    private static boolean deathObservedDead;
    private static net.minecraft.client.player.LocalPlayer deathNoticePlayer;
    private static String winnerName = "";
    private static String winnerProfile = "";
    private static long winnerNoticeStarted;
    private static int countdownValue;
    private static long countdownChangedAt;
    private static int royaleAlive;
    private static int royaleRadius = 170;
    static double visibleZoneRadius = 178;
    static int zoneFloor = -61;
    private static boolean battleRunning;
    private static boolean inAircraftLobby;
    private static net.minecraft.client.player.LocalPlayer configuredPlayer;
    private static int royalePhase;
    private static final Deque<KillNotice> killFeed = new ArrayDeque<>();
    private static final Map<String, TimedEffect> timedEffects = new LinkedHashMap<>();
    private record KillNotice(String killer, String victim, String killerProfile, String victimProfile, long createdAt) {}
    private record TimedEffect(String label, long expiresAt) {}
    private ClientEvents() {}

    @SubscribeEvent
    public static void key(InputEvent.Key event) {
        Minecraft minecraft = Minecraft.getInstance();
        if (event.getKey() == GLFW.GLFW_KEY_E && minecraft.player != null && minecraft.screen == null) {
            if (minecraft.options.keyInventory.matches(event.getKey(), event.getScanCode())) {
                minecraft.options.keyInventory.setDown(false);
                while (minecraft.options.keyInventory.consumeClick()) { }
            }
            if (event.getAction() == GLFW.GLFW_PRESS) ParticipantFollowCamera.toggle(minecraft);
            return;
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_M
                && minecraft.player != null) {
            if (minecraft.screen == null) minecraft.setScreen(new BattleMapScreen());
            else if (minecraft.screen instanceof BattleMapScreen) minecraft.setScreen(null);
            return;
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_B
                && minecraft.player != null && minecraft.screen == null) {
            applyStableGuiScale(minecraft);
            minecraft.setScreen(new SnowWarSettingsScreen());
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_TAB
                && minecraft.player != null && minecraft.screen == null) {
            ParticipantFollowCamera.stop(minecraft);
            CameraType camera = minecraft.options.getCameraType().isFirstPerson()
                ? CameraType.THIRD_PERSON_BACK : CameraType.FIRST_PERSON;
            minecraft.options.setCameraType(camera);
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_P
                && minecraft.player != null && minecraft.screen == null) {
            minecraft.player.connection.sendCommand("snowwar start");
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_SPACE
                && minecraft.player != null && minecraft.screen == null) {
            long now = System.currentTimeMillis();
            if (now - lastSpacePress < 360) minecraft.player.connection.sendCommand("snowwar fly");
            lastSpacePress = now;
        }
    }

    @SubscribeEvent
    public static void throwOnLeftClick(Pre event) {
        Minecraft minecraft = Minecraft.getInstance();
        if (event.getButton() == GLFW.GLFW_MOUSE_BUTTON_2 && minecraft.player != null
                && minecraft.screen == null) {
            zooming = event.getAction() != GLFW.GLFW_RELEASE;
            event.setCanceled(true);
            return;
        }
        if (event.getAction() != GLFW.GLFW_PRESS || event.getButton() != GLFW.GLFW_MOUSE_BUTTON_LEFT
                || minecraft.player == null || minecraft.gameMode == null || minecraft.screen != null
                || !canThrow(minecraft.player.getMainHandItem())) return;
        event.setCanceled(true);
        minecraft.player.connection.sendCommand("snowwar throw");
        minecraft.player.swing(net.minecraft.world.InteractionHand.MAIN_HAND);
    }

    @SubscribeEvent
    public static void scrollZoom(InputEvent.MouseScrollingEvent event) {
        if (!zooming || Minecraft.getInstance().screen != null) return;
        zoomFactor = (float)Math.max(0.12, Math.min(0.80, zoomFactor - event.getScrollDelta() * 0.055));
        event.setCanceled(true);
    }

    @SubscribeEvent
    public static void zoom(ComputeFovModifierEvent event) {
        // The final camera FOV event also covers TaCZ's camera adjustments.
    }

    @SubscribeEvent(priority = net.minecraftforge.eventbus.api.EventPriority.LOWEST)
    public static void cameraZoom(net.minecraftforge.client.event.ViewportEvent.ComputeFov event) {
        if (zooming && Minecraft.getInstance().screen == null) event.setFOV(event.getFOV() * zoomFactor);
    }

    @SubscribeEvent
    public static void clientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        Minecraft minecraft = Minecraft.getInstance();
        ParticipantFollowCamera.tick(minecraft);
        if (minecraft.player != null) applyStableGuiScale(minecraft);
        if (minecraft.player != null && configuredPlayer != minecraft.player) {
            configuredPlayer = minecraft.player;
            if (Boolean.getBoolean("mng.royale.smoke")) LiveGiftSmoke.verify();
            if (minecraft.options.keySocialInteractions.getKey().getValue() == GLFW.GLFW_KEY_P) {
                minecraft.options.keySocialInteractions.setKey(com.mojang.blaze3d.platform.InputConstants.UNKNOWN);
                net.minecraft.client.KeyMapping.resetMapping();
            }
            var config = SnowWarClientConfig.get();
            String account = System.getenv("MNG_TIKTOK_USER");
            if (account != null && account.matches("[A-Za-z0-9_.]{2,32}")) {
                config.streamer = account;
                SnowWarLiveClient.connect(account);
            }
            minecraft.player.connection.sendCommand("snowwar capacity " + config.participantCapacity);
            minecraft.player.connection.sendCommand("snowwar lobbywait " + Math.max(0,Math.min(120,config.lobbyWaitSeconds)));
            minecraft.player.connection.sendCommand("snowwar zoneinterval " + config.zoneIntervalSeconds);
            minecraft.player.connection.sendCommand("snowwar effectvolume " + config.effectVolume);
            minecraft.player.connection.sendCommand("snowwar winnerdelay " + config.winnerDelaySeconds);
            minecraft.player.connection.sendCommand("snowwar health " + config.playerHealth);
        }
        zooming = minecraft.player != null && minecraft.screen == null
            && GLFW.glfwGetMouseButton(minecraft.getWindow().getWindow(), GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        hasDeathNotice();
        if (minecraft.player == null || minecraft.level == null) inAircraftLobby = false;
        SnowWarAudio.update(inAircraftLobby);
        CleanGameHud.tick();
        GiftActionSmoke.clientTick();
        WinnerSmoke.tick();
    }

    private static void applyStableGuiScale(Minecraft minecraft) {
        if (minecraft.getWindow() == null
                || Math.abs(minecraft.getWindow().getGuiScale() - FIXED_GUI_SCALE) < 0.01D) return;
        minecraft.getWindow().setGuiScale(FIXED_GUI_SCALE);
        if (minecraft.screen != null) minecraft.screen.resize(minecraft,
            minecraft.getWindow().getGuiScaledWidth(), minecraft.getWindow().getGuiScaledHeight());
    }

    private static boolean canThrow(net.minecraft.world.item.ItemStack held) {
        return held.hasTag() && held.getTag().getBoolean("mng_host_weapon")
            && !held.getTag().getBoolean("mng_tacz_weapon");
    }

    @SubscribeEvent
    public static void followMovement(net.minecraftforge.client.event.MovementInputUpdateEvent event) {
        if (!ParticipantFollowCamera.following()) return;
        var input = event.getInput();
        input.forwardImpulse = 0;
        input.leftImpulse = 0;
        input.jumping = false;
        input.shiftKeyDown = false;
    }

    @SubscribeEvent
    public static void deathMessage(ClientChatReceivedEvent.System event) {
        String message = event.getMessage().getString();
        if (message.startsWith("MNG_SNOW_FINALIST|")) {
            try {
                SnowFighterRenderer.avatarTexture(new String(java.util.Base64.getUrlDecoder().decode(
                    message.substring(message.indexOf('|') + 1)), java.nio.charset.StandardCharsets.UTF_8));
            } catch (IllegalArgumentException ignored) { }
            event.setMessage(net.minecraft.network.chat.Component.empty());
            return;
        }
        if (message.startsWith("MNG_ROYALE_LOBBY|")) {
            inAircraftLobby = Boolean.parseBoolean(message.substring(message.indexOf('|')+1));
            SnowWarAudio.update(inAircraftLobby);
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_ZONE|")) {
            BattleMinimap.receive(message);
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_ROYALE_HUD|")) {
            String[] parts = message.split("\\|", 6);
            try {
                royaleAlive = parts.length > 1 ? Integer.parseInt(parts[1]) : royaleAlive;
                visibleZoneRadius = parts.length > 2 ? Double.parseDouble(parts[2]) : visibleZoneRadius;
                royaleRadius = (int)Math.ceil(visibleZoneRadius);
                zoneFloor = parts.length > 3 ? Integer.parseInt(parts[3]) : zoneFloor;
                battleRunning = parts.length > 4 && Boolean.parseBoolean(parts[4]);
                inAircraftLobby = parts.length > 5 && Boolean.parseBoolean(parts[5]);
                BattleMinimap.active = battleRunning;
            } catch (NumberFormatException ignored) { }
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_SNOW_WINNER|")) {
            countdownValue = 0;
            String[] parts = message.split("\\|", 3);
            winnerName = parts.length > 1 ? parts[1] : "Kazanan";
            try {
                winnerProfile = parts.length > 2 ? new String(java.util.Base64.getUrlDecoder().decode(parts[2]),
                    java.nio.charset.StandardCharsets.UTF_8) : "";
            } catch (Exception ignored) { winnerProfile = ""; }
            showWinner(winnerName, winnerProfile);
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_SNOW_COUNTDOWN|")) {
            try { countdownValue = Math.max(0, Integer.parseInt(message.substring(message.indexOf('|') + 1))); }
            catch (NumberFormatException ignored) { countdownValue = 0; }
            countdownChangedAt = System.nanoTime();
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_SNOW_KILL|")) {
            String[] parts = message.split("\\|", 5);
            killFeed.addFirst(new KillNotice(parts.length > 1 ? parts[1] : "Bilinmeyen",
                parts.length > 2 ? parts[2] : "Bilinmeyen",
                decodeProfile(parts.length > 3 ? parts[3] : ""),
                decodeProfile(parts.length > 4 ? parts[4] : ""), System.nanoTime()));
            while (killFeed.size() > 5) killFeed.removeLast();
            event.setCanceled(true);
            return;
        }
        if (message.startsWith("MNG_SNOW_EFFECT|")) {
            String[] parts = message.split("\\|", 4);
            try {
                String id = parts.length > 1 ? parts[1] : "effect";
                String label = parts.length > 2 ? new String(java.util.Base64.getUrlDecoder().decode(parts[2]),
                    java.nio.charset.StandardCharsets.UTF_8) : "Etki";
                int seconds = parts.length > 3 ? Math.max(1, Integer.parseInt(parts[3])) : 10;
                timedEffects.put(id, new TimedEffect(label, System.nanoTime() + seconds * 1_000_000_000L));
            } catch (Exception ignored) { }
            event.setCanceled(true);
            return;
        }
        if (!message.startsWith("MNG_SNOW_DEATH|")) return;
        String[] parts = message.split("\\|", 3);
        deathName = parts.length > 1 ? parts[1] : "Bilinmeyen savaşçı";
        try {
            deathProfile = parts.length > 2 ? new String(java.util.Base64.getUrlDecoder().decode(parts[2]),
                java.nio.charset.StandardCharsets.UTF_8) : "";
        } catch (Exception ignored) { deathProfile = ""; }
        Minecraft minecraft = Minecraft.getInstance();
        deathNoticeStarted = System.nanoTime();
        deathNoticeActive = true;
        deathNoticePlayer = minecraft.player;
        deathObservedDead = minecraft.player != null && minecraft.player.isDeadOrDying();
        event.setCanceled(true);
    }

    static void showWinner(String name, String profile) {
        Minecraft.getInstance().getTutorial().setStep(net.minecraft.client.tutorial.TutorialSteps.NONE);
        winnerName = name;
        winnerProfile = profile;
        winnerNoticeStarted = System.nanoTime();
        countdownValue = 0;
        SnowWarAudio.playWinner();
    }

    public static boolean hasDeathNotice() {
        if (!deathNoticeActive) return false;
        Minecraft minecraft = Minecraft.getInstance();
        if (System.nanoTime() - deathNoticeStarted >= 2_000_000_000L
                || minecraft.player == null || minecraft.level == null
                || minecraft.player != deathNoticePlayer
                || (deathObservedDead && !minecraft.player.isDeadOrDying())) {
            deathNoticeActive = false;
            deathObservedDead = false;
            deathNoticePlayer = null;
            deathName = "";
            deathProfile = "";
            return false;
        }
        // The notice can arrive before the client's health/death update.
        if (minecraft.player.isDeadOrDying()) deathObservedDead = true;
        return true;
    }

    @SubscribeEvent
    public static void hideHostHealth(RenderGuiOverlayEvent.Pre event) {
        if (winnerVisible() || event.getOverlay().id().equals(VanillaGuiOverlay.PLAYER_HEALTH.id())) event.setCanceled(true);
    }

    @SubscribeEvent
    public static void deathOverlay(RenderGuiOverlayEvent.Post event) {
        if (!event.getOverlay().id().equals(VanillaGuiOverlay.HOTBAR.id())) return;
        if (winnerVisible()) return;
        renderBattleHud(event.getGuiGraphics());
        ParticipantFollowCamera.renderReticle(event.getGuiGraphics());
        if (hasDeathNotice() && !(Minecraft.getInstance().screen instanceof net.minecraft.client.gui.screens.DeathScreen))
            renderDeath(event.getGuiGraphics());
    }

    private static boolean winnerVisible() {
        return winnerNoticeStarted > 0 && System.nanoTime() - winnerNoticeStarted < 5_000_000_000L;
    }

    @SubscribeEvent
    public static void winnerOverlay(net.minecraftforge.client.event.RenderGuiEvent.Post event) {
        if (winnerVisible()) WinnerOverlay.render(event.getGuiGraphics(), winnerName, winnerProfile, winnerNoticeStarted);
    }

    private static void renderBattleHud(GuiGraphics graphics) {
        Minecraft minecraft = Minecraft.getInstance();
        if (minecraft.player == null || minecraft.level == null) return;
        int remaining = royaleAlive;
        if (remaining == 0) for (var entity : minecraft.level.entitiesForRendering())
            if (entity instanceof com.tikmng.snowwar.game.SnowFighterEntity fighter && !fighter.isAudience()) remaining++;
        int center = graphics.guiWidth() / 2;
        String zoneLabel = visibleZoneRadius < 1 ? Math.round(visibleZoneRadius * 200) + " cm çap" : royaleRadius + "m";
        String count = "HAYATTA: " + remaining + "   ALAN: " + zoneLabel;
        graphics.drawString(minecraft.font, count, 15, 12, 0xFFFFFFFF, true);
        BattleMinimap.render(graphics);

        String title = battleRunning ? "TikMnG Battle Royale" : "";
        int titleWidth = minecraft.font.width(title) + 24;
        graphics.drawCenteredString(minecraft.font, title, center, 12, 0xFFFFFFFF);

        long now = System.nanoTime();
        timedEffects.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= now);
        int effectY = 36;
        for (TimedEffect effect : timedEffects.values()) {
            int seconds = Math.max(1, (int)Math.ceil((effect.expiresAt() - now) / 1_000_000_000.0));
            String line = effect.label() + "  " + seconds + " sn";
            int width = minecraft.font.width(line) + 18;
            graphics.fill(8, effectY, 8 + width, effectY + 18, 0xD50A1725);
            graphics.fill(8, effectY, 11, effectY + 18, 0xFF73E4FF);
            graphics.drawString(minecraft.font, line, 15, effectY + 5, 0xFFFFFFFF, true);
            effectY += 22;
        }

        if (countdownValue > 0 && countdownValue <= 120 && now - countdownChangedAt < 2_000_000_000L) {
            float age = Math.min(1.0F, (System.nanoTime() - countdownChangedAt) / 350_000_000.0F);
            float pulse = 2.35F - age * 0.55F;
            graphics.pose().pushPose();
            graphics.pose().translate(center, graphics.guiHeight() * 0.38F, 0);
            graphics.pose().scale(pulse, pulse, 1.0F);
            String value = Integer.toString(countdownValue);
            int width = minecraft.font.width(value);
            graphics.drawString(minecraft.font, value, -width / 2, -5, 0xFFFF315B, true);
            graphics.pose().popPose();
        }

        while (!killFeed.isEmpty() && now - killFeed.peekLast().createdAt() > 6_000_000_000L) killFeed.removeLast();
        graphics.pose().pushPose();
        graphics.pose().scale(0.72F, 0.72F, 1.0F);
        int scaledWidth = Math.round(graphics.guiWidth() / 0.72F);
        int y = 58;
        for (KillNotice notice : killFeed) {
            String line = "@" + notice.killer() + "  öldürdü  @" + notice.victim();
            int width = minecraft.font.width(line) + 54;
            int x = scaledWidth - width - 10;
            graphics.fill(x, y - 4, x + width, y + 18, 0xC80A1725);
            graphics.fill(x, y - 4, x + 2, y + 18, 0xFFFFC936);
            drawRoundAvatar(graphics, notice.killerProfile(), x + 5, y - 2, 16);
            graphics.drawString(minecraft.font, line, x + 25, y + 3, 0xFFFFFFFF);
            drawRoundAvatar(graphics, notice.victimProfile(), x + width - 19, y - 2, 16);
            y += 28;
        }
        graphics.pose().popPose();
    }

    private static String decodeProfile(String encoded) {
        if (encoded == null || encoded.isBlank()) return "";
        try {
            return new String(java.util.Base64.getUrlDecoder().decode(encoded), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) { return ""; }
    }

    private static void drawRoundAvatar(GuiGraphics graphics, String profile, int x, int y, int size) {
        ResourceLocation avatar = SnowFighterRenderer.avatarTexture(profile);
        double radius = size / 2.0;
        for (int row = 0; row < size; row++) {
            double dy = row + 0.5 - radius;
            int inset = (int)Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - dy * dy)));
            int strip = size - inset * 2;
            if (strip <= 0) continue;
            if (avatar != null) graphics.blit(avatar, x + inset, y + row,
                (float)inset, (float)row, strip, 1, size, size);
            else graphics.fill(x + inset, y + row, x + size - inset, y + row + 1, 0xFF253A57);
        }
    }

    static void renderDeath(GuiGraphics graphics) {
        if (!hasDeathNotice()) return;
        Minecraft minecraft = Minecraft.getInstance();
        int centerX = graphics.guiWidth() / 2;
        int boxWidth = Math.min(280, graphics.guiWidth() - 24);
        int boxHeight = Math.min(184, graphics.guiHeight() - 88);
        if (boxWidth < 96 || boxHeight < 96) return;
        int top = Math.max(8, (graphics.guiHeight() - 64 - boxHeight) / 2);
        int left = centerX - boxWidth / 2;
        graphics.fill(left, top, left + boxWidth, top + boxHeight, 0xDD0A1324);
        graphics.fill(left, top, left + boxWidth, top + 4, 0xFFFF4F78);
        graphics.drawCenteredString(minecraft.font,
            minecraft.font.plainSubstrByWidth("SİZİ ÖLDÜREN KİŞİ", boxWidth - 16),
            centerX, top + 12, 0xFFFFD8E2);
        int avatarSize = Math.min(88, boxHeight - 80);
        int avatarX = centerX - avatarSize / 2;
        int avatarY = top + 32;
        ResourceLocation avatar = SnowFighterRenderer.avatarTexture(deathProfile);
        double radius = avatarSize / 2.0;
        for (int row = 0; row < avatarSize; row++) {
            double dy = row + 0.5 - radius;
            int inset = (int)Math.ceil(radius - Math.sqrt(radius * radius - dy * dy));
            int stripWidth = avatarSize - inset * 2;
            if (stripWidth <= 0) continue;
            if (avatar != null) {
                // Logical texture dimensions keep UVs normalized for any downloaded image size.
                graphics.blit(avatar, avatarX + inset, avatarY + row,
                    (float)inset, (float)row, stripWidth, 1, avatarSize, avatarSize);
            } else {
                graphics.fill(avatarX + inset, avatarY + row,
                    avatarX + avatarSize - inset, avatarY + row + 1, 0xFF253A57);
            }
        }
        if (avatar == null) graphics.drawCenteredString(minecraft.font, "?", centerX,
            avatarY + (avatarSize - minecraft.font.lineHeight) / 2, 0xFFFFFFFF);
        graphics.drawCenteredString(minecraft.font,
            minecraft.font.plainSubstrByWidth("@" + deathName, boxWidth - 16),
            centerX, avatarY + avatarSize + 10, 0xFFFFFFFF);
        graphics.drawCenteredString(minecraft.font,
            minecraft.font.plainSubstrByWidth("Yeniden doğunca 10 saniye korunacaksın", boxWidth - 16),
            centerX, avatarY + avatarSize + 27, 0xFF9FE9FF);
    }

    @SubscribeEvent
    public static void scaleReindeer(RenderLivingEvent.Pre<?, ?> event) {
        if (!(event.getEntity() instanceof net.minecraft.world.entity.animal.goat.Goat)) return;
        event.getPoseStack().pushPose();
        event.getPoseStack().scale(1.45F, 1.45F, 1.45F);
    }

    @SubscribeEvent
    public static void scaleReindeerEnd(RenderLivingEvent.Post<?, ?> event) {
        if (event.getEntity() instanceof net.minecraft.world.entity.animal.goat.Goat)
            event.getPoseStack().popPose();
    }

    @SubscribeEvent
    public static void title(ScreenEvent.Opening event) {
        if (event.getNewScreen() instanceof net.minecraft.client.gui.screens.DeathScreen
                && !(event.getNewScreen() instanceof SnowWarDeathScreen)) {
            event.setNewScreen(new SnowWarDeathScreen());
            return;
        }
        if (event.getNewScreen() != null && event.getNewScreen().getClass() == net.minecraft.client.gui.screens.TitleScreen.class) {
            event.setNewScreen(new SnowWarTitleScreen());
        }
    }
}
