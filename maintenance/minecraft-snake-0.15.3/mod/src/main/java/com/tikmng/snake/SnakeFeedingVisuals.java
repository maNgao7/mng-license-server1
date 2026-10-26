package com.tikmng.snake;

import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.texture.OverlayTexture;
import org.joml.Quaternionf;

/** Render-thread presentation only; feeding credit and timing belong to the engine. */
public final class SnakeFeedingVisuals {
    public static final int MAX_PORTRAITS = 64;
    private static final int MAX_INSPECTED = 128;
    private static long frames, totalPortraitDraws;
    private static int queued, portraitDraws, realPhotoDraws, fallbackDraws, shrinkingDraws, skipped, quads;
    private static int feedingsDrawn, inspected, maxParticlesPerFeed, swallowedDraws;
    private static String lastOwnerId = "";
    private static double lastProgress, lastScale, lastMouthDistance, lastParticleProgress, lastHalfSize;

    private SnakeFeedingVisuals() {}

    /**
     * Call after SnakeMesh.render, inside the pose already translated by -camera position.
     * Pass the camera's rotation (not its inverse). The caller owns buffer flushing.
     */
    public static void render(PoseStack pose, MultiBufferSource buffers, ArenaEngine engine,
            double time, double partial, Quaternionf cameraRotation) {
        RenderSystem.assertOnRenderThread();
        frames++;
        clearFrame();
        if (engine == null) return;
        queued = engine.feedings.size();
        if (!Double.isFinite(time) || !Double.isFinite(partial) || cameraRotation == null) {
            skipped = queued;
            return;
        }
        partial = engine.paused ? 1 : SnakeEffectMath.unit(partial);
        time = engine.paused ? engine.time : Math.min(time, engine.time);
        // Inspect the newest bounded batch without copying the queue or caching more avatars.
        for (int i = queued - 1; i >= 0 && inspected < MAX_INSPECTED && portraitDraws < MAX_PORTRAITS; i--) {
            inspected++;
            var feeding = engine.feedings.get(i);
            var owner = engine.snakes.get(feeding.snakeId());
            double progress = (time - feeding.started()) / ArenaEngine.FEED_SECONDS;
            if (owner == null || !Double.isFinite(progress) || progress < 0 || progress >= 1) continue;
            var head = engine.displayHead(owner);
            double radius = head.renderRadius(partial), angle = head.renderAngle(partial);
            double headX = head.renderX(partial), headZ = head.renderZ(partial);
            double lift = SnakeMesh.headLift(head.id);
            if (!Double.isFinite(radius) || radius < .04 || !Double.isFinite(angle)
                    || !Double.isFinite(headX) || !Double.isFinite(headZ) || !Double.isFinite(lift)) continue;

            double fx = Math.cos(angle), fz = Math.sin(angle);
            double mouthX = headX + fx * radius * 1.92, mouthZ = headZ + fz * radius * 1.92;
            double mouthY = ArenaSpace.SURFACE_Y + .24 + radius * .43 + lift;
            double halfSize = SnakeEffectMath.feedHalfSize(radius);
            net.minecraft.resources.ResourceLocation texture = null;
            boolean realPhoto = false;
            int drawn = 0;
            for (int particle = 0; particle < SnakeEffectMath.FEED_PARTICLES && portraitDraws < MAX_PORTRAITS; particle++) {
                double age = SnakeEffectMath.feedAge(progress, particle);
                if (age < 0) continue;
                double scale = SnakeEffectMath.feedScale(age);
                int alpha = SnakeEffectMath.feedAlpha(age);
                // Never submit a singular transform or retain a particle after its feeding ends.
                if (scale <= .001 || alpha == 0) continue;
                double approach = SnakeEffectMath.feedApproach(age), remaining = 1 - approach;
                double arc = Math.sin(approach * Math.PI);
                double ahead = SnakeEffectMath.feedAhead(radius, age);
                double lane = (particle % 3 - 1) * ((owner.id.hashCode() & 1) == 0 ? 1 : -1);
                double side = Math.min(1.1, radius * .35) * lane * remaining
                    + arc * Math.min(.4, radius * .18) * (particle % 2 == 0 ? 1 : -1);
                double x = mouthX + fx * ahead - fz * side, z = mouthZ + fz * ahead + fx * side;
                double y = mouthY + Math.min(2.4, radius * .95) * remaining + arc * Math.min(.65, radius * .3);
                if (texture == null) {
                    // One HUD owner key/URL for the entire stream, including Galaxy's display head.
                    texture = SnakeAvatars.texture(owner.id, owner.profile);
                    realPhoto = SnakeAvatars.diagnostics(owner.id).downloaded();
                }
                pose.pushPose();
                try {
                    pose.translate(x, y, z);
                    pose.mulPose(cameraRotation);
                    float size = (float)(halfSize * scale);
                    pose.scale(size, size, size);
                    var frame = buffers.getBuffer(RenderType.entityTranslucentEmissive(SnakeSkins.white()));
                    int color = feeding.coins() > 0 ? 0xFFD76E : 0x8EEC9A;
                    rectangle(pose, frame, -1.10f, -1.10f, 1.10f, -1, color, alpha);
                    rectangle(pose, frame, -1.10f, 1, 1.10f, 1.10f, color, alpha);
                    rectangle(pose, frame, -1.10f, -1, -1, 1, color, alpha);
                    rectangle(pose, frame, 1, -1, 1.10f, 1, color, alpha);
                    quad(pose, buffers.getBuffer(RenderType.entityTranslucentEmissive(texture)), 1, 0, 0xFFFFFF, alpha);
                } finally {
                    pose.popPose();
                }
                drawn++;
                portraitDraws++;
                totalPortraitDraws++;
                quads += 5;
                if (realPhoto) realPhotoDraws++;
                else fallbackDraws++;
                if (age >= SnakeEffectMath.FEED_SHRINK) { shrinkingDraws++; swallowedDraws++; }
                lastOwnerId = owner.id;
                lastProgress = progress;
                lastParticleProgress = age;
                lastScale = scale;
                lastHalfSize = halfSize * scale;
                lastMouthDistance = Math.sqrt(ahead * ahead + side * side + (y - mouthY) * (y - mouthY));
            }
            if (drawn > 0) feedingsDrawn++;
            maxParticlesPerFeed = Math.max(maxParticlesPerFeed, drawn);
        }
        skipped = queued - feedingsDrawn;
    }

    private static void quad(PoseStack pose, VertexConsumer out, float halfSize, float depth, int color, int alpha) {
        vertex(pose, out, -halfSize, -halfSize, depth, 0, 1, color, alpha);
        vertex(pose, out, halfSize, -halfSize, depth, 1, 1, color, alpha);
        vertex(pose, out, halfSize, halfSize, depth, 1, 0, color, alpha);
        vertex(pose, out, -halfSize, halfSize, depth, 0, 0, color, alpha);
    }
    private static void rectangle(PoseStack pose, VertexConsumer out, float left, float bottom, float right, float top, int color, int alpha) {
        vertex(pose,out,left,bottom,0,0,1,color,alpha);vertex(pose,out,right,bottom,0,1,1,color,alpha);
        vertex(pose,out,right,top,0,1,0,color,alpha);vertex(pose,out,left,top,0,0,0,color,alpha);
    }

    private static void vertex(PoseStack pose, VertexConsumer out, float x, float y, float z,
            float u, float v, int color, int alpha) {
        out.vertex(pose.last().pose(), x, y, z)
            .color((color >>> 16) & 255, (color >>> 8) & 255, color & 255, alpha).uv(u, v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(LightTexture.FULL_BRIGHT)
            .normal(pose.last().normal(), 0, 0, 1).endVertex();
    }

    /** Counts describe submitted geometry, not visibility after world depth testing. */
    public record Diagnostics(long frames, long totalPortraitDraws, int portraitDraws,
            int realPhotoDraws, int fallbackDraws, int shrinkingDraws, int queued, int skipped,
            int quads, String lastOwnerId, double lastProgress, double lastScale, double lastMouthDistance) {}

    public static Diagnostics diagnostics() {
        RenderSystem.assertOnRenderThread();
        return new Diagnostics(frames, totalPortraitDraws, portraitDraws, realPhotoDraws,
            fallbackDraws, shrinkingDraws, queued, skipped, quads, lastOwnerId,
            lastProgress, lastScale, lastMouthDistance);
    }

    public record StreamDiagnostics(int feedingsDrawn, int inspected, int maxParticlesPerFeed,
            int swallowedDraws, boolean capped, double lastParticleProgress, double lastHalfSize) {}

    public static StreamDiagnostics streamDiagnostics() {
        RenderSystem.assertOnRenderThread();
        return new StreamDiagnostics(feedingsDrawn, inspected, maxParticlesPerFeed, swallowedDraws,
            portraitDraws == MAX_PORTRAITS, lastParticleProgress, lastHalfSize);
    }

    public static void resetDiagnostics() {
        RenderSystem.assertOnRenderThread();
        frames = totalPortraitDraws = 0;
        clearFrame();
    }

    private static void clearFrame() {
        queued = portraitDraws = realPhotoDraws = fallbackDraws = shrinkingDraws = skipped = quads = 0;
        feedingsDrawn = inspected = maxParticlesPerFeed = swallowedDraws = 0;
        lastOwnerId = "";
        lastProgress = lastScale = lastMouthDistance = lastParticleProgress = lastHalfSize = 0;
    }
}
