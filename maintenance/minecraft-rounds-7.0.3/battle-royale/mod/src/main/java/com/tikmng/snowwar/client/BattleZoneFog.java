package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.ViewportEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

@Mod.EventBusSubscriber(modid = "mng_battle_royale", value = Dist.CLIENT)
public final class BattleZoneFog {
    private static boolean outside() {
        var mc = Minecraft.getInstance();
        if (mc.level == null) return false;
        var p = mc.gameRenderer.getMainCamera().getPosition();
        double dx = p.x-BattleMinimap.x, dz = p.z-BattleMinimap.z;
        return dx*dx+dz*dz > ClientEvents.visibleZoneRadius*ClientEvents.visibleZoneRadius;
    }
    @SubscribeEvent public static void color(ViewportEvent.ComputeFogColor event) {
        if (!outside()) return;
        event.setRed(0.10F); event.setGreen(0.28F); event.setBlue(0.64F);
    }
    @SubscribeEvent public static void fog(ViewportEvent.RenderFog event) {
        if (!outside()) return;
        event.setNearPlaneDistance(3); event.setFarPlaneDistance(65);
        event.setCanceled(true);
    }
}
