package com.tikmng.snowwar.client;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.ResourceLocation;
import java.util.ArrayList;
import java.util.List;

public final class BattleMinimap {
    public static double x, z, targetX, targetZ, targetRadius = 178, progress;
    public static boolean moving;
    public static int seconds;
    public static boolean active;
    private static final int RESOLUTION = 180;
    private static final List<Marker> markers = new ArrayList<>();
    private static DynamicTexture texture;
    private static ResourceLocation image;
    private static long refreshed = -1000;
    private static net.minecraft.client.multiplayer.ClientLevel terrainLevel;
    private record Marker(double x, double z, String name) {}

    public static void receive(String message) {
        String[] parts = message.split("\\|");
        try {
            x = Double.parseDouble(parts[1]); z = Double.parseDouble(parts[2]);
            targetX = Double.parseDouble(parts[3]); targetZ = Double.parseDouble(parts[4]);
            targetRadius = Double.parseDouble(parts[5]); moving = Boolean.parseBoolean(parts[6]);
            seconds = Integer.parseInt(parts[7]); progress = Double.parseDouble(parts[8]);
            markers.clear();
            for (int i = 9; i < parts.length; i++) {
                String[] marker = parts[i].split(",", 3);
                if (marker.length == 3) markers.add(new Marker(Double.parseDouble(marker[0]), Double.parseDouble(marker[1]), marker[2]));
            }
        } catch (NumberFormatException | IndexOutOfBoundsException ignored) { }
    }

    private static void updateTerrain() {
        var mc = Minecraft.getInstance();
        if (mc.level == null) return;
        if (mc.level != terrainLevel) { terrainLevel = mc.level; refreshed = -1000; }
        if (image != null && mc.level.getGameTime() - refreshed < 200) return;
        refreshed = mc.level.getGameTime();
        NativeImage pixels = new NativeImage(RESOLUTION, RESOLUTION, false);
        for (int row = 0; row < RESOLUTION; row++) for (int col = 0; col < RESOLUTION; col++) {
            int wx = col * 2 - 179, wz = row * 2 - 179;
            int rgb = 0x526A3A;
            for (int y = ClientEvents.zoneFloor + 35; y >= ClientEvents.zoneFloor; y--) {
                BlockPos pos = new BlockPos(wx, y, wz);
                var block = mc.level.getBlockState(pos);
                if (block.isAir()) continue;
                rgb = block.getMapColor(mc.level, pos).col;
                break;
            }
            pixels.setPixelRGBA(col, row, 0xFF000000 | ((rgb & 255) << 16) | (rgb & 0xFF00) | ((rgb >> 16) & 255));
        }
        if (texture == null) {
            texture = new DynamicTexture(pixels);
            image = mc.getTextureManager().register("royale_minimap", texture);
        } else { texture.setPixels(pixels); texture.upload(); }
    }

    public static void render(GuiGraphics g) {
        renderMap(g, 8, 28, Math.min(68, g.guiHeight()/4), false, -1, -1);
    }

    static void renderMap(GuiGraphics g, int left, int top, int size, boolean expanded, int mouseX, int mouseY) {
        updateTerrain();
        double scale = size / 360.0;
        g.fill(left-1, top-1, left+size+1, top+size+1, 0xFFDBE6EB);
        if (image != null) g.blit(image, left, top, 0, 0, size, size, size, size);
        g.enableScissor(left, top, left+size, top+size);
        for (int py = 0; py < size; py++) {
            double wz = (py-size/2.0)/scale;
            double remaining = ClientEvents.visibleZoneRadius*ClientEvents.visibleZoneRadius-(wz-z)*(wz-z);
            if (remaining <= 0) g.fill(left,top+py,left+size,top+py+1,0x982063DD);
            else {
                double half=Math.sqrt(remaining);
                int start=Math.max(0,Math.min(size,(int)Math.floor(size/2.0+(x-half)*scale)));
                int end=Math.max(0,Math.min(size,(int)Math.ceil(size/2.0+(x+half)*scale)));
                g.fill(left,top+py,left+start,top+py+1,0x982063DD);
                g.fill(left+end,top+py,left+size,top+py+1,0x982063DD);
            }
        }
        circle(g, left+size/2.0+x*scale, top+size/2.0+z*scale, ClientEvents.visibleZoneRadius*scale, 0xFF45B8FF);
        circle(g, left+size/2.0+targetX*scale, top+size/2.0+targetZ*scale, targetRadius*scale, 0xFFFFFFFF);
        List<int[]> labels = new ArrayList<>();
        for (Marker marker : markers) {
            int px = left+size/2+(int)(marker.x*scale), py = top+size/2+(int)(marker.z*scale);
            int hash = Integer.rotateLeft(marker.name.hashCode()*0x9E3779B9,13);
            int color = 0xFF000000 | (net.minecraft.util.Mth.hsvToRgb(Math.floorMod(hash,360)/360F, 0.65F, 1F) & 0xFFFFFF);
            g.fill(px-1, py-1, px+2, py+2, color);
            if (expanded && markers.size() <= 20) {
                int labelWidth = (int)Math.ceil(Minecraft.getInstance().font.width("@"+marker.name)*0.65F);
                int[] bounds = {px+3,py-3,px+5+labelWidth,py+5};
                boolean clear = bounds[2] < left+size && bounds[1] >= top && bounds[3] < top+size;
                for (int[] other : labels) if (bounds[0]<other[2] && bounds[2]>other[0]
                    && bounds[1]<other[3] && bounds[3]>other[1]) clear=false;
                if (clear) {
                    labels.add(bounds);
                    g.pose().pushPose();
                    g.pose().translate(px+3,py-3,0);
                    g.pose().scale(0.65F,0.65F,1);
                    g.drawString(Minecraft.getInstance().font,"@"+marker.name,0,0,0xFFFFFFFF,true);
                    g.pose().popPose();
                }
            }
        }
        var mc = Minecraft.getInstance();
        if (mc.player != null) {
            int px=left+size/2+(int)(mc.player.getX()*scale), py=top+size/2+(int)(mc.player.getZ()*scale);
            g.fill(px-2,py-2,px+2,py+2,0xFFFFFFFF);
        }
        g.disableScissor();
        int y=top+size+4;
        g.fill(left,y,left+size,y+3,0xFF203145);
        g.fill(left,y,left+(int)(size*(active?progress:0)),y+3,0xFF36B4FF);
        String phase = active ? (moving ? "Daralıyor " : "Bekleme ")+seconds+" sn" : "Bekleme alanı";
        g.pose().pushPose();
        g.pose().translate(left,y+6,0);
        float textScale = expanded ? 1F : Math.min(0.85F, size/(float)Math.max(1,mc.font.width(phase)));
        g.pose().scale(textScale,textScale,1);
        g.drawString(mc.font,phase,0,0,0xFFFFFFFF,true);
        g.pose().popPose();
        if (expanded) {
            Marker hovered=null;
            double nearest=64;
            for(Marker marker:markers) {
                double px=left+size/2.0+marker.x*scale, py=top+size/2.0+marker.z*scale;
                double d=(px-mouseX)*(px-mouseX)+(py-mouseY)*(py-mouseY);
                if(d<nearest) {nearest=d;hovered=marker;}
            }
            if(hovered!=null) g.renderTooltip(mc.font,net.minecraft.network.chat.Component.literal("@"+hovered.name),mouseX,mouseY);
        }
    }

    private static void circle(GuiGraphics g, double cx, double cy, double radius, int color) {
        for (int i=0;i<360;i++) {
            double a=i*Math.PI/180;
            int px=(int)(cx+Math.cos(a)*radius), py=(int)(cy+Math.sin(a)*radius);
            g.fill(px,py,px+1,py+1,color);
        }
    }
}
