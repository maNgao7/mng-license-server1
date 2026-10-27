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

@Mod.EventBusSubscriber(modid = "mng_snow_war", value = Dist.CLIENT)
public final class ClientEvents {
    private static net.minecraft.client.player.LocalPlayer liveConfiguredPlayer;
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
    private static boolean battlePaused;
    private static long pauseStarted;
    private static final SnowWarFollowCamera followCamera = new SnowWarFollowCamera();
    private static final Deque<KillNotice> killFeed = new ArrayDeque<>();
    private static final Map<String, TimedEffect> timedEffects = new LinkedHashMap<>();
    private record KillNotice(String killer, String victim, long createdAt) {}
    private record TimedEffect(String label, long expiresAt) {}
    private ClientEvents() {}

    @SubscribeEvent
    public static void key(InputEvent.Key event) {
        Minecraft minecraft = Minecraft.getInstance();
        if (event.getAction() != GLFW.GLFW_RELEASE && minecraft.player != null && minecraft.screen == null) {
            if (event.getKey() == GLFW.GLFW_KEY_P) {
                if (minecraft.options.keySocialInteractions.matches(event.getKey(), event.getScanCode())) {
                    while (minecraft.options.keySocialInteractions.consumeClick()) { }
                    minecraft.options.keySocialInteractions.setDown(false);
                }
                if (event.getAction() == GLFW.GLFW_PRESS) minecraft.player.connection.sendCommand("snowwar toggle");
            }
            if (event.getKey() == GLFW.GLFW_KEY_E) {
                // E is the vanilla inventory key. Consume its click before vanilla handles it.
                if (minecraft.options.keyInventory.matches(event.getKey(), event.getScanCode())) {
                    while (minecraft.options.keyInventory.consumeClick()) { }
                    minecraft.options.keyInventory.setDown(false);
                }
                if (event.getAction() == GLFW.GLFW_PRESS) followCamera.toggle(minecraft);
            }
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_B
                && minecraft.player != null && minecraft.screen == null) {
            applyStableGuiScale(minecraft);
            minecraft.setScreen(new SnowWarSettingsScreen());
        }
        if (event.getAction() == GLFW.GLFW_PRESS && event.getKey() == GLFW.GLFW_KEY_TAB
                && minecraft.player != null && minecraft.screen == null) {
            CameraType camera = minecraft.options.getCameraType().isFirstPerson()
                ? CameraType.THIRD_PERSON_BACK : CameraType.FIRST_PERSON;
            minecraft.options.setCameraType(camera);
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
        if (zooming) event.setNewFovModifier(event.getNewFovModifier() * zoomFactor);
    }

    @SubscribeEvent
    public static void snow(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) return;
        Minecraft minecraft = Minecraft.getInstance();
        followCamera.tick(minecraft);
        if (minecraft.player != null && liveConfiguredPlayer != minecraft.player) {
            liveConfiguredPlayer = minecraft.player;
            battlePaused = false;
            countdownValue = 0;
            winnerNoticeStarted = 0;
            timedEffects.clear();
            minecraft.player.connection.sendCommand("snowwar winnerdelay " + SnowWarClientConfig.get().winnerDelaySeconds);
            minecraft.player.connection.sendCommand("snowwar effectvolume " + SnowWarClientConfig.get().effectVolume);
            String account = System.getenv("MNG_TIKTOK_USER");
            if (account != null && account.matches("[A-Za-z0-9_.]{2,32}")) {
                SnowWarClientConfig.get().streamer = account;
                SnowWarLiveClient.connect(account);
            }
        }
        if (minecraft.player != null) applyStableGuiScale(minecraft);
        SnowWarAudio.update();
        CleanGameHud.tick();
        GiftActionSmoke.clientTick();
        WinnerSmoke.tick();
        hasDeathNotice();
        boolean rawAttack = minecraft.getWindow() != null && GLFW.glfwGetMouseButton(
            minecraft.getWindow().getWindow(), GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        if (minecraft.player != null && minecraft.screen == null && rawAttack) {
            var held = minecraft.player.getMainHandItem();
            if (held.hasTag() && held.getTag().getBoolean("mng_snow_gun")
                    && minecraft.player.tickCount % 2 == 0) {
                minecraft.player.connection.sendCommand("snowwar throw");
                minecraft.player.swing(net.minecraft.world.InteractionHand.MAIN_HAND);
            }
        }
        if (minecraft.player == null || minecraft.level == null || minecraft.player.tickCount % 2 != 0) return;
        SnowWarClientConfig config = SnowWarClientConfig.get();
        var random = minecraft.player.getRandom();
        double wave = (Math.sin(minecraft.player.tickCount / 85.0) + 1.0) * 0.5;
        int flakes = 7 + (int)Math.round(wave * wave * 34.0);
        for (int i = 0; i < flakes; i++) {
            double x = minecraft.player.getX() + random.nextDouble() * 34.0 - 17.0;
            double y = minecraft.player.getY() + 3.0 + random.nextDouble() * 8.0;
            double z = minecraft.player.getZ() + random.nextDouble() * 34.0 - 17.0;
            minecraft.level.addParticle(net.minecraft.core.particles.ParticleTypes.SNOWFLAKE,
                x, y, z, 0.012 + wave * 0.018, -0.045 - wave * 0.09 - random.nextDouble() * 0.04, 0.0);
        }
    }

    private static void applyStableGuiScale(Minecraft minecraft) {
        if (minecraft.getWindow() == null
                || Math.abs(minecraft.getWindow().getGuiScale() - FIXED_GUI_SCALE) < 0.01D) return;
        minecraft.getWindow().setGuiScale(FIXED_GUI_SCALE);
        if (minecraft.screen != null) minecraft.screen.resize(minecraft,
            minecraft.getWindow().getGuiScaledWidth(), minecraft.getWindow().getGuiScaledHeight());
    }

    private static boolean canThrow(net.minecraft.world.item.ItemStack held) {
        return held.is(net.minecraft.world.item.Items.SNOWBALL)
            || (held.hasTag() && held.getTag().getBoolean("mng_snow_gun"));
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
        if (message.startsWith("MNG_SNOW_STATE|")) {
            boolean paused = message.endsWith("|PAUSED");
            long now = System.nanoTime();
            if (paused && !battlePaused) pauseStarted = now;
            if (!paused && battlePaused) {
                long elapsed = now - pauseStarted;
                timedEffects.replaceAll((id, effect) -> new TimedEffect(effect.label(), effect.expiresAt() + elapsed));
            }
            battlePaused = paused;
            if (message.endsWith("|WAITING")) { countdownValue = 0; timedEffects.clear(); }
            event.setMessage(net.minecraft.network.chat.Component.empty());
            return;
        }
        if (message.startsWith("MNG_SNOW_WINNER|")) {
            String[] parts = message.split("\\|", 3);
            winnerName = parts.length > 1 ? parts[1] : "Kazanan";
            try {
                winnerProfile = parts.length > 2 ? new String(java.util.Base64.getUrlDecoder().decode(parts[2]),
                    java.nio.charset.StandardCharsets.UTF_8) : "";
            } catch (Exception ignored) { winnerProfile = ""; }
            showWinner(winnerName, winnerProfile);
            countdownValue = 0;
            event.setMessage(net.minecraft.network.chat.Component.empty());
            return;
        }
        if (message.startsWith("MNG_SNOW_COUNTDOWN|")) {
            try { countdownValue = Math.max(0, Integer.parseInt(message.substring(message.indexOf('|') + 1))); }
            catch (NumberFormatException ignored) { countdownValue = 0; }
            countdownChangedAt = System.nanoTime();
            event.setMessage(net.minecraft.network.chat.Component.empty());
            return;
        }
        if (message.startsWith("MNG_SNOW_KILL|")) {
            String[] parts = message.split("\\|", 3);
            killFeed.addFirst(new KillNotice(parts.length > 1 ? parts[1] : "Bilinmeyen",
                parts.length > 2 ? parts[2] : "Bilinmeyen", System.nanoTime()));
            while (killFeed.size() > 5) killFeed.removeLast();
            event.setMessage(net.minecraft.network.chat.Component.empty());
            return;
        }
        if (message.startsWith("MNG_SNOW_EFFECT|")) {
            String[] parts = message.split("\\|", 4);
            try {
                String id = parts.length > 1 ? parts[1] : "effect";
                String label = parts.length > 2 ? new String(java.util.Base64.getUrlDecoder().decode(parts[2]),
                    java.nio.charset.StandardCharsets.UTF_8) : "Etki";
                int seconds = parts.length > 3 ? Math.max(1, Integer.parseInt(parts[3])) : 10;
                timedEffects.put(id, new TimedEffect(label,
                    (battlePaused ? pauseStarted : System.nanoTime()) + seconds * 1_000_000_000L));
            } catch (Exception ignored) { }
            event.setMessage(net.minecraft.network.chat.Component.empty());
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
        event.setMessage(net.minecraft.network.chat.Component.empty());
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
    public static void deathOverlay(RenderGuiOverlayEvent.Post event) {
        if (!event.getOverlay().id().equals(VanillaGuiOverlay.HOTBAR.id())) return;
        if (winnerVisible()) return;
        renderBattleHud(event.getGuiGraphics());
        if (hasDeathNotice() && !(Minecraft.getInstance().screen instanceof net.minecraft.client.gui.screens.DeathScreen))
            renderDeath(event.getGuiGraphics());
    }

    private static boolean winnerVisible() {
        return winnerNoticeStarted > 0 && System.nanoTime() - winnerNoticeStarted < 5_000_000_000L;
    }

    @SubscribeEvent
    public static void hideWinnerHud(RenderGuiOverlayEvent.Pre event) {
        if (winnerVisible()) event.setCanceled(true);
    }

    @SubscribeEvent
    public static void winnerOverlay(net.minecraftforge.client.event.RenderGuiEvent.Post event) {
        if (winnerVisible()) WinnerOverlay.render(event.getGuiGraphics(), winnerName, winnerProfile, winnerNoticeStarted);
    }

    private static void renderBattleHud(GuiGraphics graphics) {
        Minecraft minecraft = Minecraft.getInstance();
        if (minecraft.player == null || minecraft.level == null) return;
        int remaining = 0;
        for (var entity : minecraft.level.entitiesForRendering()) {
            if (entity instanceof com.tikmng.snowwar.game.SnowFighterEntity fighter && !fighter.isAudience()) remaining++;
            else if (entity instanceof com.tikmng.snowwar.game.SnowBeastEntity) remaining++;
        }
        int center = graphics.guiWidth() / 2;
        if (!minecraft.options.getCameraType().isFirstPerson() && !minecraft.options.hideGui
                && minecraft.screen == null) {
            int middle = graphics.guiHeight() / 2;
            graphics.fill(center - 4, middle, center + 5, middle + 1, 0xFFFFFFFF);
            graphics.fill(center, middle - 4, center + 1, middle + 5, 0xFFFFFFFF);
        }
        String count = "KALAN: " + remaining;
        int countWidth = minecraft.font.width(count) + 18;
        graphics.fill(8, 7, 8 + countWidth, 25, 0xD50A1725);
        graphics.fill(8, 7, 11, 25, 0xFF73E4FF);
        graphics.drawString(minecraft.font, count, 15, 12, 0xFFFFFFFF, true);

        String title = "KARTOPU SAVAŞI";
        int titleWidth = minecraft.font.width(title) + 24;
        graphics.fill(center - titleWidth / 2, 7, center + titleWidth / 2, 25, 0xD50A1725);
        graphics.drawCenteredString(minecraft.font, title, center, 12, 0xFFFFFFFF);

        long now = battlePaused ? pauseStarted : System.nanoTime();
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

        if (battlePaused) {
            graphics.drawCenteredString(minecraft.font, "SAVAŞ DURAKLATILDI", center,
                Math.max(38, graphics.guiHeight() / 2 - 24), 0xFFFFE681);
            graphics.drawCenteredString(minecraft.font, "Devam etmek için P", center,
                Math.max(52, graphics.guiHeight() / 2 - 10), 0xFFFFFFFF);
        } else if (countdownValue > 0) {
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
        int scaledHeight = Math.round(graphics.guiHeight() / 0.72F);
        int y = scaledHeight - 62;
        for (KillNotice notice : killFeed) {
            String line = "@" + notice.killer() + "  öldürdü  @" + notice.victim();
            int width = minecraft.font.width(line) + 12;
            int x = scaledWidth - width - 10;
            graphics.fill(x, y - 2, x + width, y + 10, 0xB80A1725);
            graphics.fill(x, y - 2, x + 2, y + 10, 0xFFFF4F78);
            graphics.drawString(minecraft.font, line, x + 6, y, 0xFFFFFFFF);
            y -= 18;
        }
        graphics.pose().popPose();
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
