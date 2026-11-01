package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.tutorial.TutorialSteps;

/** Keep vanilla onboarding and recipe/advancement popups off the broadcast. */
final class CleanGameHud {
    private CleanGameHud() { }

    static void tick() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null || mc.player == null) return;
        if (mc.options.tutorialStep != TutorialSteps.NONE) mc.getTutorial().setStep(TutorialSteps.NONE);
        mc.getToasts().clear();
    }
}
