package com.tikmng.snake;

import java.util.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Local tests use the same arena methods as live gifts; no events are sent to TikTok. */
final class SnakeDiagnostics extends Screen {
    private static String selected="",lastAction="";
    private static double beforeMass,beforeSpeed,beforeDistance,started,afterMass,elapsed,distance;
    private final Screen previous;
    private int left,span;
    private EditBox amount;
    private SnakeConfig.Rule selectedGift;
    SnakeDiagnostics(Screen previous){super(Component.literal("Eylem laboratuvari"));this.previous=previous;}
    private static ArenaEngine.Snake target(){return SnakeClient.ENGINE.snakes.get(selected);}
    private void button(String text,int x,int y,int w,Runnable action){
        var b=Button.builder(Component.literal(text),ignored->action.run()).bounds(x,y,w,20).build();
        b.setTooltip(Tooltip.create(Component.literal(text)));addRenderableWidget(b);
    }
    protected void init(){
        span=Math.min(600,width-32);left=(width-span)/2;
        var e=SnakeClient.ENGINE;
        if(target()==null){var watched=SnakeCamera.followed();selected=watched!=null?watched.id:e.snakes.keySet().stream().findFirst().orElse("");}
        var gifts=SnakeClient.CONFIG.gifts;
        if(!gifts.isEmpty()){
            if(!gifts.contains(selectedGift))selectedGift=gifts.get(0);
            addRenderableWidget(CycleButton.<SnakeConfig.Rule>builder(rule->Component.literal(rule.name+" #"+rule.giftId))
                .withValues(gifts).withInitialValue(selectedGift).create(left,37,span,20,Component.literal("Hediye"),(button,value)->selectedGift=value));
        }
        button("<",left,64,24,()->cycle(-1));button(">",left+span-24,64,24,()->cycle(1));
        int cell=(span-12)/4;
        for(int i=0;i<3;i++){int tier=new int[]{3,5,10}[i];button(tier+"x / 7 sn",left+i*(cell+4),99,cell,()->boost(tier));}
        button("Hediye dene",left+3*(cell+4),99,cell,this::savedGift);
        amount=new EditBox(font,left,137,92,20,Component.literal("Test coin"));amount.setValue("100");amount.setMaxLength(6);addRenderableWidget(amount);
        button("Coin ile buyut",left+100,137,Math.max(84,(span-108)/2),this::grow);
        button("Arenada izle",left+span-Math.max(84,(span-108)/2),137,Math.max(84,(span-108)/2),()->{
            var s=target();if(s!=null){SnakeCamera.watch(s.id);minecraft.setScreen(new SnakeScreens.Arena());}
        });
        button("Test yilani ekle",left,height-31,142,()->{var s=e.join("local-effect-test","Yerel Test","",300);if(s!=null)selected=s.id;});
        button("Geri",left+span-90,height-31,90,()->onClose());
    }
    private void cycle(int direction){
        var ids=new ArrayList<>(SnakeClient.ENGINE.snakes.keySet());if(ids.isEmpty()){selected="";return;}
        selected=ids.get(Math.floorMod(ids.indexOf(selected)+direction,ids.size()));
    }
    private static void begin(String action){
        var s=target();if(s==null)return;var e=SnakeClient.ENGINE;
        beforeMass=afterMass=s.mass;beforeSpeed=s.speed(e.time);beforeDistance=s.travelled();started=e.time;elapsed=distance=0;lastAction=action;
    }
    private void boost(int tier){var s=target();if(s==null)return;begin(tier+"x hiz");SnakeClient.ENGINE.action(s.id,s.name,s.profile,"boost",tier,7);}
    private void grow(){
        var s=target();if(s==null)return;
        try{double coins=Double.parseDouble(amount.getValue().replace(',','.'));if(!Double.isFinite(coins)||coins<1||coins>100000)return;
            begin((int)coins+" coin");SnakeClient.ENGINE.gift(s.id,s.name,s.profile,coins,1);
        }catch(NumberFormatException ignored){}
    }
    private void savedGift(){
        var s=target();if(s==null)return;
        var rule=selectedGift;if(rule==null)return;begin(rule.name+" #"+rule.giftId);
        SnakeClient.ENGINE.gift(s.id,s.name,s.profile,SnakeScreens.giftCoins(rule.giftId),1);
        SnakeClient.ENGINE.action(s.id,s.name,s.profile,rule.action,rule.amount,rule.seconds);
    }
    static void measure(){var s=target();if(s==null||lastAction.isEmpty())return;afterMass=s.mass;elapsed=Math.max(0,SnakeClient.ENGINE.time-started);distance=Math.max(0,s.travelled()-beforeDistance);}
    public boolean isPauseScreen(){return false;}
    public void onClose(){minecraft.setScreen(previous);}
    private void row(GuiGraphics g,String label,String value,int y,int color){g.drawString(font,label,left,y,0xFFADC0C4);g.drawString(font,value,left+span-font.width(value),y,color);}
    public void render(GuiGraphics g,int mx,int my,float partial){
        g.fill(0,0,width,height,0xF2111719);g.drawString(font,"TikMnG / EYLEM LABORATUVARI",left,18,0xFF51E1D0);
        var s=target();String name=s==null?"Yilan secilmedi":s.name;
        g.drawCenteredString(font,font.plainSubstrByWidth(name,span-64),width/2,70,0xFFFFD66B);
        g.drawString(font,"Coin",left,125,0xFFADC0C4);
        int y=170,step=Math.max(12,Math.min(20,(height-212)/7));
        row(g,"Durum",s==null?"-":s.intent,y,0xFF51E1D0);
        row(g,"Hiz (olculen / hedef)",s==null?"-":String.format(Locale.ROOT,"%.2f / %.2f blok/sn",s.measuredSpeed(),s.speed(SnakeClient.ENGINE.time)),y+=step,0xFFF4F6F7);
        row(g,"Hizlanma / kalan",s==null?"-":String.format(Locale.ROOT,"%.1fx / %.1f sn",s.boostUntil>SnakeClient.ENGINE.time?s.boostMultiplier:1,Math.max(0,s.boostUntil-SnakeClient.ENGINE.time)),y+=step,0xFFFFD66B);
        row(g,"Kutle once / sonra",String.format(Locale.ROOT,"%.0f > %.0f (+%.0f)",beforeMass,afterMass,afterMass-beforeMass),y+=step,0xFF9EE7B8);
        row(g,"Test mesafesi / sure",String.format(Locale.ROOT,"%.2f blok / %.1f sn",distance,elapsed),y+=step,0xFFF4F6F7);
        row(g,"Onceki hiz",String.format(Locale.ROOT,"%.2f blok/sn",beforeSpeed),y+=step,0xFFADC0C4);
        row(g,"Son yerel eylem",font.plainSubstrByWidth(lastAction.isEmpty()?"-":lastAction,Math.max(80,span-130)),y+=step,0xFF51E1D0);
        super.render(g,mx,my,partial);
    }
    static Map<String,Object> diagnostics(){var s=target();return Map.of("target",selected,"beforeMass",beforeMass,"afterMass",afterMass,"distance",distance,"seconds",elapsed,"action",lastAction,"speed",s==null?0:s.measuredSpeed());}
    void qaRun(String action,int value){if(!Boolean.getBoolean("tikmng.snake.hotfixQa"))throw new IllegalStateException();if(action.equals("boost"))boost(value);else{amount.setValue(Integer.toString(value));grow();}}
}
