package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;

/** Isolated native rendering/audio acceptance, disabled in normal game launches. */
final class WinnerSmoke {
    private static boolean shown;
    private static boolean captured;
    private static long started;
    private static String screen = "";
    private static boolean hudInjected;
    private static boolean hudChecked;

    static void tick() {
        if (!Boolean.getBoolean("mng.winner.smoke")) return;
        Minecraft mc = Minecraft.getInstance();
        mc.options.pauseOnLostFocus = false;
        if (mc.screen != null && !mc.screen.getClass().getName().equals(screen)) {
            screen = mc.screen.getClass().getName();
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_WINNER_QA_SCREEN {}", screen);
            if (screen.contains("Accessibility")) mc.setScreen(new SnowWarTitleScreen());
        }
        if (mc.player == null || mc.level == null || mc.player.tickCount < 60) return;
        if (!hudInjected) {
            hudInjected = true;
            mc.getTutorial().setStep(net.minecraft.client.tutorial.TutorialSteps.FIND_TREE);
            mc.getToasts().addToast(new net.minecraft.client.gui.components.toasts.TutorialToast(
                net.minecraft.client.gui.components.toasts.TutorialToast.Icons.TREE,
                net.minecraft.network.chat.Component.literal("Find a tree"),
                net.minecraft.network.chat.Component.literal("Punch it to collect wood"), true));
        }
        if (!hudChecked && mc.player.tickCount >= 65) {
            hudChecked = true;
            boolean clean = mc.options.tutorialStep == net.minecraft.client.tutorial.TutorialSteps.NONE
                && mc.getToasts().getToast(net.minecraft.client.gui.components.toasts.TutorialToast.class,
                    net.minecraft.client.gui.components.toasts.Toast.NO_TOKEN) == null;
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_CLEAN_HUD_SMOKE tutorialAndToastRemoved={}", clean);
            if (!clean) throw new IllegalStateException("Vanilla tutorial/toast survived clean HUD");
            Screenshot.grab(mc.gameDirectory, "clean-hud-game-update.png", mc.getMainRenderTarget(),
                message -> com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_CLEAN_HUD_CAPTURE {}", message.getString()));
        }
        if (mc.player.tickCount < 100) return;
        if (!shown) {
            shown = true;
            mc.getTutorial().setStep(net.minecraft.client.tutorial.TutorialSteps.NONE);
            started = System.nanoTime();
            ClientEvents.showWinner("TikMnG_Test", "");
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_WINNER_SMOKE soundRegistered={}",
                mc.getSoundManager().getSoundEvent(com.tikmng.snowwar.game.SnowWarSounds.WINNER.get().getLocation()) != null);
        }
        if (!captured && System.nanoTime() - started > 1_500_000_000L) {
            captured = true;
            Screenshot.grab(mc.gameDirectory, "winner-game-update.png", mc.getMainRenderTarget(),
                message -> com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_WINNER_CAPTURE {}", message.getString()));
        }
        if (System.nanoTime() - started > 4_000_000_000L) mc.stop();
    }
}
