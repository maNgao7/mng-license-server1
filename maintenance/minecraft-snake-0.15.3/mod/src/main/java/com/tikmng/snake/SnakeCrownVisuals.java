package com.tikmng.snake;

import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.texture.OverlayTexture;

/** One head-mounted voxel crown for the largest owner, including during Galaxy. */
public final class SnakeCrownVisuals {
    public static final int MAX_QUADS = 144;
    public static final double MAX_RADIUS = 2;
    private static final int GOLD = 0xF6C542, EDGE = 0xCC8E16, TIP = 0xFFE78B;
    private static final int[][][] FACES = {
        {{1,-1,-1},{1,1,-1},{1,1,1},{1,-1,1}},
        {{-1,-1,1},{-1,1,1},{-1,1,-1},{-1,-1,-1}},
        {{-1,1,-1},{-1,1,1},{1,1,1},{1,1,-1}},
        {{1,-1,-1},{1,-1,1},{-1,-1,1},{-1,-1,-1}},
        {{1,-1,1},{1,1,1},{-1,1,1},{-1,-1,1}},
        {{-1,-1,-1},{-1,1,-1},{1,1,-1},{1,-1,-1}}
    };
    private static final int[][] NORMALS = {{1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}};
    private static long frames, totalCrownsDrawn;
    private static String ownerId = "", headId = "";
    private static int crownsDrawn, quads;
    private static double headRadius, radius, baseY;

    private SnakeCrownVisuals() {}

    /** Call after SnakeMesh in the camera-translated pose; the parent owns buffer flushing. */
    public static void render(PoseStack pose, MultiBufferSource buffers, ArenaEngine engine,
            double time, double partial) {
        RenderSystem.assertOnRenderThread();
        frames++;
        clearFrame();
        if (engine == null || !Double.isFinite(time) || !Double.isFinite(partial)) return;
        var owner = selectOwner(engine);
        if (owner == null) return;
        ownerId = owner.id;
        var head = engine.displayHead(owner);
        if (head == null) return;
        headId = head.id;
        partial = engine.paused ? 1 : Math.max(0, Math.min(1, partial));
        headRadius = head.renderRadius(partial);
        radius = crownRadius(headRadius);
        double x = head.renderX(partial), z = head.renderZ(partial), angle = head.renderAngle(partial);
        double lift = SnakeMesh.headLift(head.id);
        if (radius == 0 || !Double.isFinite(x) || !Double.isFinite(z)
                || !Double.isFinite(angle) || !Double.isFinite(lift)) return;
        // Match the main head ellipsoid's roof (.12 + .16 + .82r + .82r).
        // Embed the band's lower edge slightly, including when the crown's size is capped.
        baseY = ArenaSpace.SURFACE_Y + .28 + headRadius * 1.64 + lift
            - Math.min(radius * .28, radius * radius / headRadius * .5 + headRadius * .015);
        double fx = Math.cos(angle), fz = Math.sin(angle);
        var out = buffers.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.white()));
        pose.pushPose();
        try {
            pose.translate(x + fx * headRadius * .25, baseY, z + fz * headRadius * .25);
            float scale = (float)radius;
            pose.scale(scale, scale, scale);
            for (int sign = -1; sign <= 1; sign += 2) {
                cube(pose,out,fx,fz,sign*.90,.17,0,.10,.17,1,GOLD);
                cube(pose,out,fx,fz,0,.17,sign*.90,.80,.17,.10,GOLD);
                cube(pose,out,fx,fz,sign*.90,.04,0,.105,.04,1.005,EDGE);
                cube(pose,out,fx,fz,0,.04,sign*.90,.80,.04,.105,EDGE);
                for (int side = -1; side <= 1; side += 2)
                    cube(pose,out,fx,fz,sign*.88,.54,side*.88,.12,.21,.12,TIP);
                cube(pose,out,fx,fz,sign*.90,.53,0,.10,.19,.19,GOLD);
                cube(pose,out,fx,fz,sign*.90,.86,0,.10,.14,.09,TIP);
                cube(pose,out,fx,fz,0,.53,sign*.90,.19,.19,.10,GOLD);
                cube(pose,out,fx,fz,0,.86,sign*.90,.09,.14,.10,TIP);
                cube(pose,out,fx,fz,sign*1.025,.21,0,.045,.105,.12,0xEA3546);
                cube(pose,out,fx,fz,0,.21,sign*1.025,.12,.105,.045,0x3DE2E5);
            }
        } finally { pose.popPose(); }
        crownsDrawn = 1;
        totalCrownsDrawn++;
    }

    /** Pure selection: owner mass wins; the lexicographically first ID wins exact ties. */
    static ArenaEngine.Snake selectOwner(ArenaEngine engine) {
        if (engine == null) return null;
        ArenaEngine.Snake best = null;
        for (var candidate : engine.snakes.values()) {
            if (candidate == null || candidate.id == null || candidate.id.isBlank()
                    || !Double.isFinite(candidate.mass) || candidate.mass <= 0) continue;
            if (best == null || candidate.mass > best.mass
                    || candidate.mass == best.mass && candidate.id.compareTo(best.id) < 0) best = candidate;
        }
        return best;
    }

    static double crownRadius(double headRadius) {
        return Double.isFinite(headRadius) && headRadius > 0 ? Math.min(2, headRadius * .58) : 0;
    }

    private static void cube(PoseStack p, VertexConsumer out, double fx, double fz,
            double x, double y, double z, double rx, double ry, double rz, int color) {
        if (quads + 6 > MAX_QUADS) return;
        for (int face = 0; face < 6; face++) {
            var n = NORMALS[face];
            double nx = fx*n[0]-fz*n[2], nz = fz*n[0]+fx*n[2];
            double light = .76 + .20*Math.max(0,n[1]) + .04*Math.max(0,-nx);
            int red = (int)(((color >>> 16)&255)*light), green = (int)(((color >>> 8)&255)*light);
            int blue = (int)((color&255)*light);
            for (int i = 0; i < 4; i++) {
                var corner = FACES[face][i];
                double lx = x + corner[0]*rx, lz = z + corner[2]*rz;
                out.vertex(p.last().pose(), (float)(fx*lx-fz*lz), (float)(y+corner[1]*ry), (float)(fz*lx+fx*lz))
                    .color(red,green,blue,255).uv(i==1||i==2 ? 1 : 0, i>=2 ? 1 : 0)
                    .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(LightTexture.FULL_BRIGHT)
                    .normal(p.last().normal(), (float)nx, n[1], (float)nz).endVertex();
            }
            quads++;
        }
    }

    public record Diagnostics(long frames, long totalCrownsDrawn, String ownerId, String headId,
            int crownsDrawn, int quads, double headRadius, double radius, double baseY) {}

    public static Diagnostics diagnostics() {
        RenderSystem.assertOnRenderThread();
        return new Diagnostics(frames,totalCrownsDrawn,ownerId,headId,crownsDrawn,quads,headRadius,radius,baseY);
    }

    public static void resetDiagnostics() {
        RenderSystem.assertOnRenderThread();
        frames = totalCrownsDrawn = 0;
        clearFrame();
    }

    private static void clearFrame() {
        ownerId = headId = "";
        crownsDrawn = quads = 0;
        headRadius = radius = baseY = 0;
    }
}
