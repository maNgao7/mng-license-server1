package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.SnowFighterEntity;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

final class ParticipantFollowCamera {
    private static final ParticipantCameraTarget selection = new ParticipantCameraTarget();
    private static CameraType previousType;
    private static LocalPlayer owner;

    private ParticipantFollowCamera() {}

    static boolean following() { return selection.following(); }

    static void toggle(Minecraft minecraft) {
        if (following()) { stop(minecraft); return; }
        if (minecraft.player == null || minecraft.level == null) return;
        var camera = minecraft.gameRenderer.getMainCamera();
        Vec3 origin = camera.getPosition();
        Vec3 direction = new Vec3(camera.getLookVector());
        Vec3 end = origin.add(direction.scale(ParticipantCameraTarget.REACH));
        var wall = minecraft.level.clip(new ClipContext(origin, end, ClipContext.Block.COLLIDER,
            ClipContext.Fluid.NONE, minecraft.player));
        var candidates = minecraft.level.getEntitiesOfClass(SnowFighterEntity.class,
            new AABB(origin, end).inflate(1.0), ParticipantCameraTarget::valid);
        var picked = ParticipantCameraTarget.pick(origin, direction, origin.distanceTo(wall.getLocation()), candidates);
        if (!selection.toggle(picked)) return;
        owner = minecraft.player;
        previousType = minecraft.options.getCameraType();
        minecraft.options.setCameraType(CameraType.THIRD_PERSON_BACK);
        minecraft.setCameraEntity(selection.target());
    }

    static void tick(Minecraft minecraft) {
        if (previousType == null) return;
        if (minecraft.player != owner || !selection.validate(minecraft.level)
                || minecraft.player == null || !minecraft.player.isAlive()
                || minecraft.getCameraEntity() != selection.target()) stop(minecraft);
    }

    static void stop(Minecraft minecraft) {
        selection.clear();
        if (previousType == null) return;
        minecraft.setCameraEntity(minecraft.player);
        minecraft.options.setCameraType(previousType);
        previousType = null;
        owner = null;
    }

    static void renderReticle(GuiGraphics graphics) {
        var minecraft = Minecraft.getInstance();
        // Vanilla only draws a crosshair in first person; selection also works with TAB/F5 cameras.
        if (minecraft.player == null || minecraft.screen != null || minecraft.options.hideGui
                || following() || minecraft.options.getCameraType().isFirstPerson()) return;
        int x = graphics.guiWidth() / 2;
        int y = graphics.guiHeight() / 2;
        graphics.fill(x - 4, y - 1, x + 5, y + 2, 0xB0000000);
        graphics.fill(x - 1, y - 4, x + 2, y + 5, 0xB0000000);
        graphics.fill(x - 3, y, x + 4, y + 1, 0xFFFFFFFF);
        graphics.fill(x, y - 3, x + 1, y + 4, 0xFFFFFFFF);
    }
}
