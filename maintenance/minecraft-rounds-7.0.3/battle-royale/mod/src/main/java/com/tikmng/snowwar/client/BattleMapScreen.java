package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class BattleMapScreen extends Screen {
    public BattleMapScreen() { super(Component.literal("TikMnG Battle Royale")); }

    @Override protected void init() {
        addRenderableWidget(Button.builder(Component.literal("X"),b->onClose())
            .bounds(width-28,8,20,20).tooltip(Tooltip.create(Component.literal("Kapat"))).build());
    }

    @Override public void render(GuiGraphics g,int mouseX,int mouseY,float partialTick) {
        g.fill(0,0,width,height,0xEA09121B);
        g.drawCenteredString(font,title,width/2,10,0xFFFFFFFF);
        int size=Math.max(32,Math.min(width-48,height-88));
        int left=(width-size)/2;
        BattleMinimap.renderMap(g,left,32,size,true,mouseX,mouseY);
        int legendY=height-29;
        legend(g, left, legendY, 0xFF45B8FF, "Elektrik alanı");
        legend(g, left+size/2, legendY, 0xFFFFFFFF, "Hedef çember");
        legend(g, left, legendY+13, 0xFFFFCA50, "Oyuncular");
        legend(g, left+size/2, legendY+13, 0xFFFFFFFF, "Yayıncı");
        super.render(g,mouseX,mouseY,partialTick);
    }

    private void legend(GuiGraphics g, int x, int y, int color, String label) {
        g.fill(x,y+2,x+5,y+7,color);
        g.drawString(font,label,x+9,y,0xFFE4EEFF);
    }

    @Override public boolean isPauseScreen() {return false;}
}
