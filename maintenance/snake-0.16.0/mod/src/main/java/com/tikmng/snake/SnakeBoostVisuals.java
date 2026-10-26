package com.tikmng.snake;

import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.texture.OverlayTexture;
import org.joml.Quaternionf;

/** Render-thread-only speed ribbons and block sparkles; no simulation state or retained trails. */
public final class SnakeBoostVisuals {
    public static final int MAX_QUADS = SnakeEffectMath.MAX_BOOST_QUADS;
    public static final int MAX_STREAKS = SnakeEffectMath.MAX_STREAKS;
    public static final int MAX_SPARKLES = SnakeEffectMath.MAX_SPARKLES;
    private static final int MAX_INSPECTED = 512;
    private static final SnakeEffectMath.BoostBudget BUDGET = new SnakeEffectMath.BoostBudget();
    private static long frames, totalQuads, pausedFrames;
    private static int inspected, activeSnakes, renderedSnakes, distanceCulled;
    private static int tier3Snakes, tier5Snakes, tier10Snakes, tier3Quads, tier5Quads, tier10Quads;
    private static double maxParticleAge;

    private SnakeBoostVisuals() {}

    /** Call after SnakeMesh in the camera-translated pose. The parent owns buffer flushing. */
    public static void render(PoseStack pose, MultiBufferSource buffers, ArenaEngine engine,
            double time, double partial, Quaternionf cameraRotation) {
        RenderSystem.assertOnRenderThread();
        frames++;
        clearFrame();
        if (engine == null) return;
        if (engine.paused) { pausedFrames++; return; }
        if (!Double.isFinite(time) || !Double.isFinite(engine.time) || !Double.isFinite(partial)
                || cameraRotation == null) return;
        partial = SnakeEffectMath.unit(partial);
        time = Math.min(time, engine.time);
        var camera = Minecraft.getInstance().gameRenderer.getMainCamera().getPosition();
        if (!Double.isFinite(camera.x) || !Double.isFinite(camera.y) || !Double.isFinite(camera.z)) return;
        // renderSnakes includes Galaxy fragments. body(partial) reuses the mesh's cached path.
        for (var snake : engine.renderSnakes()) {
            if (inspected >= MAX_INSPECTED || BUDGET.streaks >= MAX_STREAKS) { BUDGET.capped = true; break; }
            inspected++;
            double dx = snake.x - snake.renderX(0), dz = snake.z - snake.renderZ(0);
            var style = SnakeEffectMath.boostStyle(snake.boostMultiplier, snake.boostUntil,
                engine.time, false, dx * dx + dz * dz);
            if (style.tier() == 0) continue;
            activeSnakes++;
            double radius = snake.renderRadius(partial);
            if (!Double.isFinite(radius) || radius < .04) continue;
            var points = snake.body(partial);
            if (points.size() < 2) continue;
            double nearest = Double.POSITIVE_INFINITY;
            for (var point : points) nearest = Math.min(nearest,
                camera.distanceToSqr(point.x(), ArenaSpace.SURFACE_Y + radius, point.z()));
            int count = SnakeEffectMath.boostSamples(style, Math.sqrt(nearest), radius);
            if (count == 0) { distanceCulled++; continue; }
            int before = BUDGET.quads;
            double headLift = SnakeMesh.headLift(snake.id);
            if (!Double.isFinite(headLift)) continue;
            var out = buffers.getBuffer(RenderType.entityTranslucentEmissive(SnakeSkins.white()));
            for (int i = 0; i < count; i++) {
                double age = SnakeEffectMath.boostAge(style, time, snake.id.hashCode(), i);
                double fade = SnakeEffectMath.boostFade(style, age), life = age / style.lifetime();
                if (fade < .025) continue;
                double along = .08 + .86 * (i + life) / count;
                double sample = along * (points.size() - 1);
                int at = Math.min(points.size() - 2, (int)sample);
                double fraction = sample - at;
                var a = points.get(at); var b = points.get(at + 1);
                var front = points.get(Math.max(0, at - 1));
                var back = points.get(Math.min(points.size() - 1, at + 2));
                double fx = front.x() - back.x(), fz = front.z() - back.z(), length = Math.hypot(fx, fz);
                if (!Double.isFinite(length) || length < 1e-7) continue;
                fx /= length; fz /= length;
                double bodyRadius = radius * (along < .64 ? 1 : Math.max(.04, Math.pow((1 - along) / .36, .8)));
                double sign = i % 2 == 0 ? 1 : -1;
                double offset = (bodyRadius * 1.18 + radius * .38 * life) * sign;
                double halfLength = Math.min(3.6, (.35 + radius * .6) * style.length()) * (.65 + life * .35);
                double width = Math.min(.45, .12 + radius * .14) * (.55 + fade * .45);
                double x = a.x() + (b.x() - a.x()) * fraction - fz * offset - fx * halfLength * life;
                double z = a.z() + (b.z() - a.z()) * fraction + fx * offset - fz * halfLength * life;
                double y = ArenaSpace.SURFACE_Y + .3 + bodyRadius * 2.1 + headLift * (1 - along);
                if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) continue;
                if (!BUDGET.streak()) break;
                int alpha = (int)(210 * fade);
                ribbon(pose, out, x, y, z, fx, fz, halfLength, width, style.color(), alpha);
                ribbon(pose, out, x - fz * .006, y + .006, z + fx * .006,
                    fx, fz, halfLength * .82, width * .28, style.core(), alpha);
                maxParticleAge = Math.max(maxParticleAge, age);
                if (i % 2 == 0 && life < .78 && BUDGET.sparkle()) {
                    double size = Math.min(.19, radius * .11) * fade;
                    sparkle(pose, out, cameraRotation, x - fx * halfLength, y + radius * .22 * life,
                        z - fz * halfLength, size, style.color(), style.core(), alpha);
                }
            }
            int submitted = BUDGET.quads - before;
            if (submitted > 0) {
                renderedSnakes++;
                switch (style.tier()) {
                    case 3 -> { tier3Snakes++; tier3Quads += submitted; }
                    case 5 -> { tier5Snakes++; tier5Quads += submitted; }
                    case 10 -> { tier10Snakes++; tier10Quads += submitted; }
                    default -> { }
                }
            }
        }
        totalQuads += BUDGET.quads;
    }

    private static void ribbon(PoseStack p, VertexConsumer out, double x, double y, double z,
            double fx, double fz, double length, double width, int color, int alpha) {
        double lx = fx * length, lz = fz * length, sx = -fz * width, sz = fx * width;
        vertex(p,out,x-lx-sx,y,z-lz-sz,0,1,0,1,0,color,alpha);
        vertex(p,out,x+lx-sx,y,z+lz-sz,1,1,0,1,0,color,alpha);
        vertex(p,out,x+lx+sx,y,z+lz+sz,1,0,0,1,0,color,alpha);
        vertex(p,out,x-lx+sx,y,z-lz+sz,0,0,0,1,0,color,alpha);
        vertex(p,out,x-lx,y-width,z-lz,0,1,-fz,0,fx,color,alpha);
        vertex(p,out,x+lx,y-width,z+lz,1,1,-fz,0,fx,color,alpha);
        vertex(p,out,x+lx,y+width,z+lz,1,0,-fz,0,fx,color,alpha);
        vertex(p,out,x-lx,y+width,z-lz,0,0,-fz,0,fx,color,alpha);
    }

    private static void sparkle(PoseStack p, VertexConsumer out, Quaternionf cameraRotation,
            double x, double y, double z, double size, int color, int core, int alpha) {
        SnakeMesh.feedPellet(p, out, x, y, z, size, color);
        p.pushPose();
        try {
            p.translate(x, y, z);
            p.mulPose(cameraRotation);
            double reach = size * 2.3, thin = size * .25;
            glint(p, out, -reach, -thin, reach, thin, core, alpha);
            glint(p, out, -thin, -reach, thin, reach, core, alpha);
        } finally { p.popPose(); }
    }

    private static void glint(PoseStack p, VertexConsumer out, double left, double bottom,
            double right, double top, int color, int alpha) {
        vertex(p,out,left,bottom,0,0,1,0,0,1,color,alpha);
        vertex(p,out,right,bottom,0,1,1,0,0,1,color,alpha);
        vertex(p,out,right,top,0,1,0,0,0,1,color,alpha);
        vertex(p,out,left,top,0,0,0,0,0,1,color,alpha);
    }

    private static void vertex(PoseStack p, VertexConsumer out, double x, double y, double z,
            float u, float v, double nx, double ny, double nz, int color, int alpha) {
        out.vertex(p.last().pose(), (float)x, (float)y, (float)z)
            .color((color >>> 16) & 255, (color >>> 8) & 255, color & 255, alpha).uv(u, v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(LightTexture.FULL_BRIGHT)
            .normal(p.last().normal(), (float)nx, (float)ny, (float)nz).endVertex();
    }

    /** Frame counts describe submitted geometry, with separate totals for all three speed tiers. */
    public record Diagnostics(long frames, long totalQuads, long pausedFrames, int inspected,
            int activeSnakes, int renderedSnakes, int streaks, int sparkles, int quads,
            int tier3Snakes, int tier5Snakes, int tier10Snakes,
            int tier3Quads, int tier5Quads, int tier10Quads, int distanceCulled,
            boolean capped, double maxParticleAge) {}

    public static Diagnostics diagnostics() {
        RenderSystem.assertOnRenderThread();
        return new Diagnostics(frames, totalQuads, pausedFrames, inspected, activeSnakes, renderedSnakes,
            BUDGET.streaks, BUDGET.sparkles, BUDGET.quads, tier3Snakes, tier5Snakes, tier10Snakes,
            tier3Quads, tier5Quads, tier10Quads, distanceCulled, BUDGET.capped, maxParticleAge);
    }

    public static void resetDiagnostics() {
        RenderSystem.assertOnRenderThread();
        frames = totalQuads = pausedFrames = 0;
        clearFrame();
    }

    private static void clearFrame() {
        inspected = activeSnakes = renderedSnakes = distanceCulled = 0;
        tier3Snakes = tier5Snakes = tier10Snakes = tier3Quads = tier5Quads = tier10Quads = 0;
        BUDGET.clear();
        maxParticleAge = 0;
    }
}
