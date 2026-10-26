package com.tikmng.snake;

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;

/** Client-thread presentation only; the engine owns win credit and round restarts. */
public final class SnakeVictory {
    private static final int GOLD = 0xFFFFD66B, CYAN = 0xFF51E1D0;
    private static final int WHITE = 0xFFF4F6F7, MUTED = 0xFFADC0C4;
    private static final long ENTER_NANOS = 320_000_000L;
    private static final long PREVIEW_NANOS = 8_000_000_000L;
    private static final long BREATHE_NANOS = 3_600_000_000L;
    private static final int CONTENT_WIDTH = 288, CONTENT_HEIGHT = 280, FRAME_TEXTURE_SIZE = 256;
    private static ResourceLocation portraitFrame;
    private static ArenaEngine observedEngine;
    private static int observedRound = Integer.MIN_VALUE;
    private static boolean announced;
    private static WinnerSnapshot current;
    private static long shownAt, previewUntil, announcements, draws,winnerAudioAt;
    private static boolean audioPending;
    private static int drawX, drawY, drawWidth, drawHeight, avatarPixels;
    private static boolean insideViewport;

    private SnakeVictory() {}

    public record WinnerSnapshot(int round, String id, String name, String profile,
            double mass, int wins) {}

    public record Diagnostics(int round, boolean visible, boolean preview, boolean announced,
            String winnerId, long announcements, long draws, int x, int y, int width,
            int height, int avatarPixels, boolean insideViewport) {}

    /** Call once per client END tick, after ENGINE.tick, including inactive ticks. */
    public static void tick() {
        Minecraft mc = Minecraft.getInstance();
        boolean enabled = SnakeClient.active && mc.level != null && mc.player != null;
        WinnerSnapshot before = current;
        long now=System.nanoTime();
        if (observe(SnakeClient.ENGINE, enabled, now)) {
            SnakeAudio.stopWinner();
            winnerAudioAt=now+SnakeAudio.remainingSwallowNanos();audioPending=true;
        } else if (before != null && current == null) SnakeAudio.stopWinner();
        if(audioPending&&current!=null&&now>=winnerAudioAt){audioPending=false;SnakeAudio.winner();}
    }

    /**
     * Headless observation: no Minecraft calls, audio, score edits, or engine ticks.
     * Returns true only for the first authoritative winner in an engine/round pair.
     * Supply a monotonic clock so parent checks can drive transitions deterministically.
     */
    public static boolean observe(ArenaEngine engine, boolean enabled, long nowNanos) {
        if (engine != observedEngine || engine != null && engine.round != observedRound) {
            observedEngine = engine;
            observedRound = engine == null ? Integer.MIN_VALUE : engine.round;
            announced = false;
            clearPresentation();
        }
        if (!enabled || engine == null) {
            clearPresentation();
            return false;
        }
        if (previewUntil != 0) {
            if (nowNanos >= previewUntil) clearPresentation();
            else if (engine.winner.isEmpty()) return false;
        }
        if (engine.winner.isEmpty()) {
            clearPresentation();
            return false;
        }
        if (announced || !engine.started || engine.snakes.size() != 1) return false;
        ArenaEngine.Snake survivor = engine.snakes.values().iterator().next();
        current = snapshot(engine.round, survivor);
        shownAt = nowNanos;
        previewUntil = 0;
        announced = true;
        announcements++;
        return true;
    }

    private static WinnerSnapshot snapshot(int round, ArenaEngine.Snake snake) {
        String name = cleanName(snake.name);
        return new WinnerSnapshot(round, snake.id, name.isEmpty() ? snake.id : name,
            snake.profile == null ? "" : snake.profile,
            Double.isFinite(snake.mass) ? Math.max(0, snake.mass) : 0, Math.max(0, snake.wins));
    }

    private static String cleanName(String name) {
        if (name == null) return "";
        StringBuilder text = new StringBuilder();
        name.codePoints().filter(c -> !Character.isISOControl(c) && c != 0xA7)
            .limit(128).forEach(text::appendCodePoint);
        return text.toString().strip();
    }

    /** Call last in the native arena HUD. Rendering never announces or starts audio. */
    public static void draw(GuiGraphics g) {
        if (current == null) return;
        Minecraft mc = Minecraft.getInstance();
        int width = mc.getWindow().getGuiScaledWidth(), height = mc.getWindow().getGuiScaledHeight();
        if (width < 32 || height < 40) {
            drawX = drawY = drawWidth = drawHeight = avatarPixels = 0;
            insideViewport = false;
            return;
        }
        long elapsed = Math.max(0, System.nanoTime() - shownAt);
        double progress = Math.min(1, elapsed / (double) ENTER_NANOS);
        double eased = 1 - Math.pow(1 - progress, 3);
        // Reserve the largest portrait/frame footprint; only that portrait breathes.
        float fit = Math.min(1, Math.min((width - 24f) / CONTENT_WIDTH, (height - 32f) / CONTENT_HEIGHT));
        float scale = fit * (float) (.96 + .04 * eased);
        float lift = (float) (5 * (1 - eased));
        int portraitSize = 96 + 2 * Math.round(Math.max(0, Math.min(1, (height - 360) / 90f)) * 6);
        long breathingAge = Math.max(0, elapsed - ENTER_NANOS);
        float breath = 1 + .025f * (float) ((1 - Math.cos(2 * Math.PI * (breathingAge % BREATHE_NANOS) / BREATHE_NANOS)) * .5);
        drawX = (int) Math.floor(width / 2f - CONTENT_WIDTH * scale / 2);
        drawY = (int) Math.floor(height / 2f + lift - CONTENT_HEIGHT * scale / 2);
        drawWidth = (int) Math.ceil(width / 2f + CONTENT_WIDTH * scale / 2) - drawX;
        drawHeight = (int) Math.ceil(height / 2f + lift + CONTENT_HEIGHT * scale / 2) - drawY;
        avatarPixels = Math.round(portraitSize * breath * scale);
        insideViewport = drawX >= 0 && drawY >= 0 && drawX + drawWidth <= width
            && drawY + drawHeight <= height;
        draws++;
        g.pose().pushPose();
        try {
            g.pose().translate(0, 0, 200);
            g.fill(0, 0, width, height, alpha(0xD9111719, eased));
            g.pose().translate(width / 2f, height / 2f + lift, 0);
            g.pose().scale(scale, scale, 1);
            centered(g, mc.font, "TUR " + current.round() + " / SAMPIYON", -126, 1, CYAN, eased);
            centered(g, mc.font, "WINNER", -105, 3, GOLD, eased);
            g.pose().pushPose();
            g.setColor(1, 1, 1, (float) eased);
            try {
                g.pose().translate(0, -6, 0);
                g.pose().scale(breath, breath, 1);
                int frameSize = portraitSize + 10;
                ResourceLocation frame = portraitFrame();
                RenderSystem.enableBlend();
                RenderSystem.defaultBlendFunc();
                g.blit(frame,-frameSize/2,-frameSize/2,0,0,frameSize,frameSize,frameSize,frameSize);
                var survivor=SnakeClient.ENGINE.snakes.get(current.id());
                String profile=survivor!=null&&survivor.profile!=null&&!survivor.profile.isBlank()?survivor.profile:current.profile();
                SnakeAvatars.blit(g,current.id(),profile,-portraitSize/2,-portraitSize/2,portraitSize);
            } finally {
                RenderSystem.disableBlend();
                g.setColor(1, 1, 1, 1);
                g.pose().popPose();
            }
            centered(g, mc.font, fitName(mc.font, current.name(), 176), 65, 1.5f, WHITE, eased);
            g.fill(-120, 89, 120, 90, alpha(0x606D868A, eased));
            column(g, mc.font, -65, "KUTLE", ArenaLabels.mass(current.mass()), CYAN, eased);
            column(g, mc.font, 65, "GALIBIYET", Integer.toString(current.wins()), GOLD, eased);
        } finally {
            g.pose().popPose();
        }
    }

    private static ResourceLocation portraitFrame() {
        if (portraitFrame != null) return portraitFrame;
        NativeImage image = new NativeImage(FRAME_TEXTURE_SIZE, FRAME_TEXTURE_SIZE, false);
        DynamicTexture texture = null;
        ResourceLocation location = null;
        try {
            for (int y = 0; y < FRAME_TEXTURE_SIZE; y++) for (int x = 0; x < FRAME_TEXTURE_SIZE; x++) {
                double radius = Math.hypot(x + .5 - FRAME_TEXTURE_SIZE / 2.0, y + .5 - FRAME_TEXTURE_SIZE / 2.0);
                int argb = radius >= 124 ? GOLD : radius >= 119 ? CYAN : 0xFF111719;
                int abgr = argb & 0xFF00FF00 | (argb >>> 16 & 255) | (argb & 255) << 16;
                image.setPixelRGBA(x, y, AvatarMask.apply(abgr, x, y, FRAME_TEXTURE_SIZE));
            }
            texture = new DynamicTexture(image);
            location = Minecraft.getInstance().getTextureManager().register("snake_winner_frame", texture);
            texture.setFilter(true, false);
            portraitFrame = location;
            return location;
        } catch (RuntimeException ex) {
            if (location != null) Minecraft.getInstance().getTextureManager().release(location);
            else if (texture != null) texture.close();
            else image.close();
            throw ex;
        }
    }

    private static void column(GuiGraphics g, Font font, int x, String label, String value,
            int color, double opacity) {
        g.pose().pushPose();
        try {
            g.pose().translate(x, 0, 0);
            centered(g, font, label, 99, 1, MUTED, opacity);
            centered(g, font, value, 113, 1.4f, color, opacity);
        } finally {
            g.pose().popPose();
        }
    }

    private static void centered(GuiGraphics g, Font font, String text, int y, float scale,
            int color, double opacity) {
        g.pose().pushPose();
        try {
            g.pose().translate(0, y, 0);
            g.pose().scale(scale, scale, 1);
            g.drawCenteredString(font, text, 0, 0, alpha(color, opacity));
        } finally {
            g.pose().popPose();
        }
    }

    private static String fitName(Font font, String name, int width) {
        if (font.width(name) <= width) return name;
        return font.plainSubstrByWidth(name, Math.max(1, width - font.width("..."))) + "...";
    }

    private static int alpha(int color, double opacity) {
        // Minecraft treats nearly zero text alpha as opaque; keep the entrance translucent.
        int a = Math.max(4, (int) Math.round((color >>> 24) * opacity));
        return color & 0xFFFFFF | a << 24;
    }

    /** Explicit settings/QA preview. It never credits a win or consumes the round latch. */
    public static void test() {
        Minecraft mc = Minecraft.getInstance();
        if (!SnakeClient.active || mc.level == null || mc.player == null) return;
        ArenaEngine engine = SnakeClient.ENGINE;
        if (!engine.winner.isEmpty()) {
            SnakeAudio.testWinner();
            return;
        }
        observe(engine, true, System.nanoTime());
        ArenaEngine.Snake leader = engine.snakes.values().stream()
            .max(java.util.Comparator.comparingDouble(s -> s.mass)).orElse(null);
        current = leader == null
            ? new WinnerSnapshot(engine.round, "victory-preview", "TikMnG", "", 25000, 1)
            : snapshot(engine.round, leader);
        shownAt = System.nanoTime();
        previewUntil = shownAt + PREVIEW_NANOS;
        SnakeAudio.testWinner();
    }

    public static WinnerSnapshot snapshot() { return current; }

    public static Diagnostics diagnostics() {
        return new Diagnostics(observedRound, current != null, previewUntil != 0, announced,
            current == null ? "" : current.id(), announcements, draws,
            drawX, drawY, drawWidth, drawHeight, avatarPixels, insideViewport);
    }

    /** Clear presentation on leave/manual reset; the round latch survives repeated calls. */
    public static void reset() {
        clearPresentation();
        SnakeAudio.stopWinner();
    }

    /** Clears counters only; it cannot re-arm or replay an already announced round. */
    public static void resetDiagnostics() { announcements = draws = 0; }

    private static void clearPresentation() {
        current = null;
        audioPending=false;winnerAudioAt=0;
        shownAt = previewUntil = 0;
        drawX = drawY = drawWidth = drawHeight = avatarPixels = 0;
        insideViewport = false;
    }
}
