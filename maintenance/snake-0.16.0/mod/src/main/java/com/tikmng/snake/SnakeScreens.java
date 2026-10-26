package com.tikmng.snake;

import com.google.gson.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.presets.WorldPresets;
import java.nio.file.Files;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;
import org.lwjgl.glfw.GLFW;

public final class SnakeScreens {
    private static final int WHITE=0xFFF4F6F7,MUTED=0xFFADC0C4,CYAN=0xFF51E1D0,GOLD=0xFFFFD66B;
    private static final String BRAND="Minecraft Yilan Oyunu";
    private static Component text(String value){return Component.literal(value);}
    private static Button button(Screen screen,String title,int x,int y,int w,java.util.function.Consumer<Button> click){
        var control=Button.builder(text(title),click::accept).bounds(x,y,w,20).build();
        control.setTooltip(Tooltip.create(text(title)));return control;
    }
    private static final int HUD_LEFT=9,HUD_WIDTH=120,HUD_ROW=24,COPY_WIDTH=20;
    private static int countdownNumber=-1;
    private static boolean countdownDrawn;
    private static float countdownScale=1;
    private static int battleCountdownNumber=-1;
    private static boolean battleCountdownDrawn,battleAnnouncementDrawn;
    private static float battleCountdownScale=1;
    private static boolean widgetLinkReady(boolean wins){return SnakeWidgets.secure&&!(wins?SnakeWidgets.winsURL:SnakeWidgets.sizeURL).isBlank();}
    private static Button copyLinkButton(int x,int y,int width,boolean wins){
        var control=new Button(x,y,width,20,Component.empty(),b->{
            if(widgetLinkReady(wins))Minecraft.getInstance().keyboardHandler.setClipboard(wins?SnakeWidgets.winsURL:SnakeWidgets.sizeURL);
        },supplier->Component.literal("Copy link")){
            protected net.minecraft.network.chat.MutableComponent createNarrationMessage(){return Component.literal("Copy link");}
            public void renderWidget(GuiGraphics g,int mouseX,int mouseY,float partial){
                super.renderWidget(g,mouseX,mouseY,partial);
                int xx=getX()+(getWidth()-10)/2,yy=getY()+5,color=active?WHITE:0xFF687477;
                // Two overlapping sheets remain legible in Minecraft's smallest GUI scale.
                g.renderOutline(xx,yy,7,8,color);g.fill(xx+3,yy+3,xx+10,yy+11,0xFF30383A);g.renderOutline(xx+3,yy+3,7,8,color);
            }
        };
        control.setTooltip(Tooltip.create(text("Copy link")));control.active=widgetLinkReady(wins);return control;
    }
    private static String hudHeader(boolean wins){
        String value=(wins?(SnakeClient.CONFIG.showWins?"- ":"+ "):(SnakeClient.CONFIG.showSnakes?"- ":"+ "))+(wins?"Kazananlar":"Yilanlar "+SnakeClient.ENGINE.snakes.size());
        return Minecraft.getInstance().font.plainSubstrByWidth(value,HUD_WIDTH-COPY_WIDTH-8);
    }
    private record HudLayout(int headerBottom,int snakesY,int snakeRows,int winsY,int winRows,int bottom){}
    private static HudLayout hudLayout(int width,int height){
        int headerBottom=34,snakesY=44,bottom=height-42;
        int slots=Math.max(0,(bottom-snakesY-48)/HUD_ROW);
        int availableWins=(int)SnakeClient.ENGINE.winners().stream().filter(w->w.wins()>0).count();
        int winRows=SnakeClient.CONFIG.showWins?Math.min(availableWins,Math.min(3,Math.max(0,slots-(SnakeClient.CONFIG.showSnakes&&!SnakeClient.ENGINE.snakes.isEmpty()&&slots>=2?1:0)))):0;
        int snakeRows=SnakeClient.CONFIG.showSnakes?Math.min(SnakeClient.ENGINE.snakes.size(),Math.min(6,slots-winRows)):0;
        int winsY=snakesY+24+snakeRows*HUD_ROW+(snakeRows>0?4:0);
        return new HudLayout(headerBottom,snakesY,snakeRows,winsY,winRows,bottom);
    }
    private static List<ArenaLabels.Rect> hudControlsReserved(int width,int height){
        var layout=hudLayout(width,height);
        var font=Minecraft.getInstance().font;
        int brandWidth=Math.max(font.width(BRAND),font.width(cameraMode()));
        List<ArenaLabels.Rect> reserved=new ArrayList<>();
        reserved.add(new ArenaLabels.Rect(HUD_LEFT,8,Math.min(width-18,brandWidth+8),26));
        reserved.add(new ArenaLabels.Rect(HUD_LEFT,layout.snakesY,HUD_WIDTH,layout.winsY+24+layout.winRows*HUD_ROW-layout.snakesY));
        reserved.add(new ArenaLabels.Rect(width/2-139,height-28,278,20));
        reserved.add(new ArenaLabels.Rect(9,statusY(width,height)-2,statusWidth(width),13));
        return reserved;
    }
    static List<ArenaLabels.Rect> hudReserved(int width,int height){
        var layout=hudLayout(width,height);var reserved=hudControlsReserved(width,height);
        int centerX=(HUD_LEFT+HUD_WIDTH+8+width)/2,centerWidth=Math.min(240,Math.max(1,width-HUD_LEFT-HUD_WIDTH-24));
        if(SnakeCamera.followed()!=null||SnakeClient.ENGINE.galaxyActive())
            reserved.add(new ArenaLabels.Rect(centerX-centerWidth/2,layout.headerBottom+6,centerWidth,48));
        reserved.add(crosshairBounds(width,height));
        if(SnakeClient.ENGINE.survivorRemaining()>=0||SnakeClient.ENGINE.battleCountdownRemaining()>=0||SnakeClient.ENGINE.battleAnnouncementRemaining()>0)
            reserved.add(new ArenaLabels.Rect(width/2-48,height/2-51,96,99));
        return reserved;
    }
    private static ArenaLabels.Rect crosshairBounds(int width,int height){return new ArenaLabels.Rect(width/2-5,height/2-5,11,11);}
    private static String cameraMode(){return SnakeCamera.free?"SERBEST UCUS":SnakeCamera.following()?"YAKIN TAKIP":"USTTEN BAKIS";}
    private static int statusWidth(int width){int available=(width-278)/2-20;return available<80?width-24:available;}
    private static int statusY(int width,int height){return (width-278)/2-20<80?height-41:height-17;}
    /** Open the B panel, or return from it to the screen/cursor state that opened it. */
    public static void togglePanel(){
        var mc=Minecraft.getInstance();
        if(mc.screen instanceof Panel panel)panel.onClose();
        else if(mc.screen instanceof Arena||mc.screen==null)mc.setScreen(new Panel(mc.screen));
    }
    private static List<ArenaEngine.Snake> hudSnakes(HudLayout layout){
        return SnakeClient.ENGINE.snakes.values().stream().sorted(Comparator.comparingDouble((ArenaEngine.Snake s)->s.mass).reversed().thenComparing(s->s.id)).limit(layout.snakeRows).toList();
    }
    private static List<ArenaEngine.Winner> hudWinners(HudLayout layout){
        return SnakeClient.ENGINE.winners().stream().filter(w->w.wins()>0).limit(layout.winRows).toList();
    }
    private static ArenaLabels.Rect winnerBounds(HudLayout layout,int row){return new ArenaLabels.Rect(HUD_LEFT,layout.winsY+24+row*HUD_ROW,HUD_WIDTH,HUD_ROW-2);}
    private static Button winnerButton(Screen screen,ArenaEngine.Winner winner,boolean remove,int x,int y,int width,Runnable refresh){
        var control=button(screen,remove?"-":"+",x,y,width,b->{if(editWinner(winner.id(),remove))refresh.run();});
        control.setTooltip(Tooltip.create(text(remove?"1 galibiyet azalt: "+winner.name():"1 galibiyet ekle: "+winner.name())));
        return control;
    }
    private static boolean editWinner(String id,boolean remove){
        var engine=SnakeClient.ENGINE;long revision=engine.winsRevision;
        engine.adjustWin(id,remove?-1:1);
        if(engine.winsRevision==revision)return false;
        SnakeClient.CONFIG.leaderboardWins=new ArrayList<>(engine.winners().stream().filter(w->!w.id().startsWith("demo-")).toList());
        SnakeClient.CONFIG.save();return true;
    }
    public static boolean moderateSelected(int key){
        if(key!=org.lwjgl.glfw.GLFW.GLFW_KEY_P)return false;
        var selected=SnakeCamera.followed();if(selected==null||!SnakeClient.ENGINE.removeSnake(selected.id))return false;
        SnakeCamera.removed(selected.id);SnakeCamera.tick();return true;
    }
    public static final class Start extends Screen {
        private static boolean opened;
        public Start(){super(text(BRAND));}
        protected void init(){
            addRenderableWidget(button(this,"Arenayi ac",width/2-100,height/2,200,b->open()));
            addRenderableWidget(button(this,"Cikis",width/2-100,height/2+26,200,b->minecraft.stop()));
            if(!opened){opened=true;minecraft.execute(this::open);}
        }
        private void open(){
            if(Files.isRegularFile(minecraft.gameDirectory.toPath().resolve("saves").resolve(SnakeMod.WORLD).resolve("level.dat"))){minecraft.createWorldOpenFlows().loadLevel(this,SnakeMod.WORLD);return;}
            LevelSettings settings=new LevelSettings("TikMnG Snake Arena",GameType.SPECTATOR,false,Difficulty.PEACEFUL,true,new GameRules(),WorldDataConfiguration.DEFAULT);
            minecraft.createWorldOpenFlows().createFreshLevel(SnakeMod.WORLD,settings,WorldOptions.defaultWithRandomSeed().withStructures(false),
                r->r.registryOrThrow(Registries.WORLD_PRESET).getHolderOrThrow(WorldPresets.FLAT).value().createWorldDimensions());
        }
        public void render(GuiGraphics g,int x,int y,float partial){g.fill(0,0,width,height,0xFF111719);g.drawCenteredString(font,"TikMnG",width/2,height/2-58,CYAN);g.drawCenteredString(font,BRAND,width/2,height/2-38,WHITE);super.render(g,x,y,partial);}
    }
    public static final class Arena extends Screen {
        private boolean draggingArena;
        private Button snakesToggle,winsToggle,followButton,sizeCopy,winsCopy;
        private List<ArenaEngine.Winner> winnerRows=List.of();
        private List<String> snakeRows=List.of();
        public Arena(){super(text(BRAND));}
        protected void init(){
            var layout=hudLayout(width,height);
            int cameraLeft=width/2-139;
            var fly=button(this,SnakeCamera.free?"Ucusa devam":"Serbest ucus",cameraLeft+94,height-28,90,b->SnakeCamera.fly());
            fly.setTooltip(Tooltip.create(text("Fare ile bakis; WASD hareket; B panel; F ustten bakis")));addRenderableWidget(fly);
            var top=button(this,"Ortala",cameraLeft+188,height-28,90,b->SnakeCamera.top());
            top.setTooltip(Tooltip.create(text("Arenayi ustten ortala (F)")));addRenderableWidget(top);
            followButton=button(this,SnakeCamera.following()?"Sonraki yilan":"Yakindan izle",cameraLeft,height-28,90,b->SnakeCamera.watchNext());
            followButton.active=!SnakeClient.ENGINE.snakes.isEmpty();followButton.setTooltip(Tooltip.create(text("Yilani yakindan takip et; listedeki bir yilani da secebilirsin")));addRenderableWidget(followButton);
            snakesToggle=button(this,hudHeader(false),HUD_LEFT,layout.snakesY,HUD_WIDTH-COPY_WIDTH-2,b->{SnakeClient.CONFIG.showSnakes=!SnakeClient.CONFIG.showSnakes;SnakeClient.CONFIG.save();rebuildWidgets();});
            snakesToggle.setTooltip(Tooltip.create(text("Yilan listesini ac / kapat")));addRenderableWidget(snakesToggle);
            sizeCopy=copyLinkButton(HUD_LEFT+HUD_WIDTH-COPY_WIDTH,layout.snakesY,COPY_WIDTH,false);addRenderableWidget(sizeCopy);
            winsToggle=button(this,hudHeader(true),HUD_LEFT,layout.winsY,HUD_WIDTH-COPY_WIDTH-2,b->{SnakeClient.CONFIG.showWins=!SnakeClient.CONFIG.showWins;SnakeClient.CONFIG.save();rebuildWidgets();});
            winsToggle.setTooltip(Tooltip.create(text("Galibiyet listesini ac / kapat")));addRenderableWidget(winsToggle);
            winsCopy=copyLinkButton(HUD_LEFT+HUD_WIDTH-COPY_WIDTH,layout.winsY,COPY_WIDTH,true);addRenderableWidget(winsCopy);
            snakeRows=hudSnakes(layout).stream().map(s->s.id).toList();
            winnerRows=hudWinners(layout);
            for(int i=0;i<winnerRows.size();i++){
                var winner=winnerRows.get(i);var bounds=winnerBounds(layout,i);
                addRenderableWidget(winnerButton(this,winner,false,HUD_LEFT+HUD_WIDTH-42,bounds.y()+2,20,this::rebuildWidgets));
                addRenderableWidget(winnerButton(this,winner,true,HUD_LEFT+HUD_WIDTH-20,bounds.y()+2,20,this::rebuildWidgets));
            }
        }
        private void refreshRows(){
            var layout=hudLayout(width,height);
            if(!winnerRows.equals(hudWinners(layout))||!snakeRows.equals(hudSnakes(layout).stream().map(s->s.id).toList()))rebuildWidgets();
            followButton.active=!SnakeClient.ENGINE.snakes.isEmpty();
            followButton.setMessage(text(SnakeCamera.following()?"Sonraki yilan":"Yakindan izle"));
            sizeCopy.active=widgetLinkReady(false);winsCopy.active=widgetLinkReady(true);
        }
        public void tick(){refreshRows();}
        public void render(GuiGraphics g,int x,int y,float partial){
            refreshRows();
            snakesToggle.setMessage(text(hudHeader(false)));
            winsToggle.setMessage(text(hudHeader(true)));
            drawHud(g,x,y);
            super.render(g,x,y,partial);
        }
        public boolean mouseDragged(double x,double y,int button,double dx,double dy){
            if(draggingArena&&!SnakeCamera.free&&button==0){SnakeCamera.pan(dx,dy,height);return true;}return super.mouseDragged(x,y,button,dx,dy);
        }
        public boolean mouseClicked(double x,double y,int button){
            draggingArena=false;
            if(super.mouseClicked(x,y,button))return true;
            if(button==GLFW.GLFW_MOUSE_BUTTON_RIGHT){
                if(!gameViewAt(x,y))return false;
                if(SnakePlayer.rightClick(x,y))return true;
                SnakeCamera.rightZoom(true);return true;
            }
            var layout=hudLayout(width,height);
            if(button==0&&x>=HUD_LEFT&&x<HUD_LEFT+HUD_WIDTH){
                var leaders=hudSnakes(layout);
                for(int i=0;i<leaders.size();i++)if(y>=layout.snakesY+24+i*HUD_ROW&&y<layout.snakesY+24+(i+1)*HUD_ROW){SnakeCamera.watch(leaders.get(i).id);return true;}
                for(int i=0;i<winnerRows.size();i++)if(winnerBounds(layout,i).contains(x,y)){SnakeCamera.watch(winnerRows.get(i).id());return true;}
            }
            if(button==0&&hudControlsReserved(width,height).stream().anyMatch(r->r.contains(x,y)))return true;
            String selected=button==0?SnakeLabels.pick(x,y):"";
            if(button==0&&!selected.isEmpty()){SnakeCamera.watch(selected);return true;}
            draggingArena=button==0&&y>layout.headerBottom&&y<height-40;
            return draggingArena;
        }
        boolean gameViewAt(double x,double y){return x>=0&&y>=0&&x<width&&y<height&&hudControlsReserved(width,height).stream().noneMatch(r->r.contains(x,y))&&children().stream().noneMatch(c->c instanceof AbstractWidget w&&w.visible&&bounds(w).contains(x,y));}
        public boolean mouseReleased(double x,double y,int button){if(button==0)draggingArena=false;if(button==GLFW.GLFW_MOUSE_BUTTON_RIGHT){SnakeCamera.rightZoom(false);return true;}return super.mouseReleased(x,y,button);}
        public boolean keyPressed(int key,int scan,int modifiers){
            if(key==GLFW.GLFW_KEY_B){togglePanel();return true;}
            if(SnakePlayer.keyPressed(key)||moderateSelected(key))return true;
            if(key==GLFW.GLFW_KEY_F){SnakeCamera.top();return true;}
            return super.keyPressed(key,scan,modifiers);
        }
        public boolean mouseScrolled(double x,double y,double delta){SnakeCamera.scroll(delta);return true;}
        public boolean isPauseScreen(){return false;}
        public void onClose(){togglePanel();}
    }
    static void drawHud(GuiGraphics g){
        drawHud(g,-1,-1);
    }
    private static void drawHud(GuiGraphics g,int mouseX,int mouseY){
        var mc=Minecraft.getInstance();var font=mc.font;int width=mc.getWindow().getGuiScaledWidth(),height=mc.getWindow().getGuiScaledHeight();
        if(mc.screen!=null&&!(mc.screen instanceof Arena))return;
        var layout=hudLayout(width,height);
        SnakeLabels.draw(g);
        g.drawString(font,BRAND,12,11,WHITE);
        g.drawString(font,cameraMode(),12,24,CYAN);
        var engine=SnakeClient.ENGINE;
        if(!engine.started&&engine.battleCountdownRemaining()<0&&engine.winner.isEmpty())
            g.drawCenteredString(font,"SAVAS BEKLIYOR  [O]",width/2,9,GOLD);
        var leaders=hudSnakes(layout);
        for(int i=0;i<leaders.size();i++){var s=leaders.get(i);int yy=layout.snakesY+24+i*HUD_ROW;
            g.fill(HUD_LEFT,yy,HUD_LEFT+HUD_WIDTH,yy+HUD_ROW-2,s==SnakeCamera.followed()?0xC0285146:0x9A111719);
            g.drawString(font,font.plainSubstrByWidth((i+1)+". "+s.name,HUD_WIDTH-14),16,yy+2,i==0?GOLD:WHITE);
            g.drawString(font,font.plainSubstrByWidth(ArenaLabels.mass(s.mass)+" - "+s.intent,HUD_WIDTH-24),26,yy+13,s.intent.equals("AVLANIYOR")?CYAN:MUTED);
        }
        if(mc.screen==null){g.drawString(font,hudHeader(false),15,layout.snakesY+6,WHITE);g.drawString(font,hudHeader(true),15,layout.winsY+6,GOLD);}
        var winners=hudWinners(layout);
        for(int i=0;i<winners.size();i++){
            var w=winners.get(i);var row=winnerBounds(layout,i);boolean selected=SnakeCamera.followed()!=null&&SnakeCamera.followed().id.equals(w.id());
            g.fill(row.x(),row.y(),row.x()+row.width(),row.y()+row.height(),selected?0xC0285146:row.contains(mouseX,mouseY)?0xC02A3536:0xAA111719);
            g.drawString(font,font.plainSubstrByWidth(w.name(),HUD_WIDTH-56),15,row.y()+2,WHITE);
            g.drawString(font,font.plainSubstrByWidth(w.wins()+"x",HUD_WIDTH-56),15,row.y()+13,GOLD);
        }
        int centerX=(HUD_LEFT+HUD_WIDTH+8+width)/2,centerWidth=Math.min(240,Math.max(1,width-HUD_LEFT-HUD_WIDTH-24)),centerY=layout.headerBottom+12;
        var following=SnakeCamera.followed();if(following!=null){var prey=engine.snakes.get(following.preyId);g.drawCenteredString(font,font.plainSubstrByWidth(following.name+(prey==null?"":"  >  "+prey.name),centerWidth),centerX,centerY,WHITE);}
        if(engine.galaxyActive())g.drawCenteredString(font,"GALAKSI  "+(int)Math.ceil(engine.galaxyRemaining())+" sn",centerX,centerY+14,0xFFFFA9D1);
        g.drawString(font,font.plainSubstrByWidth(SnakeMod.ready?SnakeLive.status:"Arena hazirlaniyor %"+(int)(SnakeMod.buildProgress*100),statusWidth(width)),12,statusY(width,height),MUTED);
        drawCountdown(g,width,height);
        drawCrosshair(g,width,height);
        SnakeVictory.draw(g);
    }
    private static void drawCrosshair(GuiGraphics g,int width,int height){
        int x=width/2,y=height/2;
        g.fill(x-5,y-1,x+6,y+2,0xB0000000);g.fill(x-1,y-5,x+2,y+6,0xB0000000);
        g.fill(x-4,y,x+5,y+1,WHITE);g.fill(x,y-4,x+1,y+5,WHITE);
    }
    private static void drawCountdown(GuiGraphics g,int width,int height){
        var engine=SnakeClient.ENGINE;
        double battle=engine.battleCountdownRemaining(),remaining=engine.survivorRemaining();
        battleCountdownDrawn=battle>=0;battleCountdownNumber=battleCountdownDrawn?Math.max(1,(int)Math.ceil(battle)):-1;
        battleAnnouncementDrawn=!battleCountdownDrawn&&engine.battleAnnouncementRemaining()>0;
        countdownDrawn=remaining>=0;countdownNumber=countdownDrawn?(int)Math.ceil(remaining):-1;countdownScale=1;
        battleCountdownScale=battleCountdownDrawn?drawTimerNumber(g,battleCountdownNumber,width,height/2-26,WHITE,3.6f):1;
        if(battleAnnouncementDrawn){
            int maxWidth=Math.max(1,width-2*(HUD_LEFT+HUD_WIDTH+4));
            float scale=Math.min(1,maxWidth/(float)Minecraft.getInstance().font.width("BATTLE START"));
            var pose=g.pose();pose.pushPose();pose.translate(width/2.0,height/2.0-28,0);pose.scale(scale,scale,1);
            g.drawCenteredString(Minecraft.getInstance().font,"BATTLE START",0,0,CYAN);pose.popPose();
        }
        if(countdownDrawn)countdownScale=drawTimerNumber(g,countdownNumber,width,height/2+(battleCountdownDrawn||battleAnnouncementDrawn?27:-26),GOLD,battleCountdownDrawn||battleAnnouncementDrawn?2.4f:3.6f);
    }
    private static float drawTimerNumber(GuiGraphics g,int number,int width,int centerY,int color,float baseScale){
        double pulse=SnakeClient.ENGINE.paused?0:(System.nanoTime()/1_000_000_000.0)%1;
        float scale=baseScale+(float)(.3*Math.cos(pulse*Math.PI*2));
        int numberWidth=Minecraft.getInstance().font.width(Integer.toString(number));
        float availableWidth=Math.max(numberWidth,(width/2f-HUD_LEFT-HUD_WIDTH-4)*2);
        scale=Math.min(scale,availableWidth/Math.max(1,numberWidth));
        var pose=g.pose();pose.pushPose();pose.translate(width/2.0,centerY,0);pose.scale(scale,scale,1);
        g.drawCenteredString(Minecraft.getInstance().font,Integer.toString(number),0,-Minecraft.getInstance().font.lineHeight/2,color);pose.popPose();return scale;
    }
    private static ArenaLabels.Rect bounds(AbstractWidget widget){return new ArenaLabels.Rect(widget.getX(),widget.getY(),widget.getWidth(),widget.getHeight());}
    private static ArenaLabels.Rect timerBounds(int number,float scale,int width,int y){
        var font=Minecraft.getInstance().font;int w=(int)Math.ceil((font.width(Integer.toString(number))+1)*scale);
        return new ArenaLabels.Rect(width/2-w/2,(int)Math.floor(y-(font.lineHeight/2)*scale),w,(int)Math.ceil(font.lineHeight*scale));
    }
    private static ArenaLabels.Rect survivorBounds(int width,int height){return timerBounds(countdownNumber,countdownScale,width,height/2+(battleCountdownDrawn||battleAnnouncementDrawn?27:-26));}
    private static ArenaLabels.Rect battleBounds(int width,int height){return timerBounds(battleCountdownNumber,battleCountdownScale,width,height/2-26);}
    private static ArenaLabels.Rect announcementBounds(int width,int height){
        int w=Math.min(Minecraft.getInstance().font.width("BATTLE START")+1,Math.max(1,width-2*(HUD_LEFT+HUD_WIDTH+4)));
        return new ArenaLabels.Rect(width/2-w/2,height/2-28,w,Minecraft.getInstance().font.lineHeight);
    }
    private static boolean intersects(ArenaLabels.Rect a,ArenaLabels.Rect b){return a.x()<b.x()+b.width()&&a.x()+a.width()>b.x()&&a.y()<b.y()+b.height()&&a.y()+a.height()>b.y();}
    /** Read-only live QA: inspect after a rendered frame; run click helpers only in the isolated QA instance. */
    public static Map<String,Object> moderationQaState(){
        var mc=Minecraft.getInstance();var engine=SnakeClient.ENGINE;int width=mc.getWindow().getGuiScaledWidth(),height=mc.getWindow().getGuiScaledHeight();
        var layout=hudLayout(width,height);var selected=SnakeCamera.followed();Map<String,Object> state=new LinkedHashMap<>();
        state.put("screen",mc.screen==null?"free":mc.screen.getClass().getSimpleName());state.put("width",width);state.put("height",height);state.put("hudBottom",layout.bottom);
        boolean hudVisible=mc.screen==null||mc.screen instanceof Arena;
        var panel=mc.screen instanceof Panel p?p:mc.screen instanceof Menu menu?menu.panel:null;
        state.put("menuOpen",mc.screen instanceof Menu);state.put("panelOpen",mc.screen instanceof Panel);
        state.put("panelReturn",panel==null?"":panel.previous==null?"free":panel.previous.getClass().getSimpleName());
        state.put("topBand",false);state.put("demoStatusBox",false);
        state.put("hudTopCommands",mc.screen instanceof Arena arena?arena.children().stream().filter(c->c instanceof AbstractWidget w&&w.visible&&w.getY()<layout.snakesY).count():0L);
        state.put("hudCameraButtons",mc.screen instanceof Arena arena?arena.children().stream().filter(c->c instanceof Button b&&b.visible&&b.getY()==height-28).count():0L);
        state.put("survivorRemaining",engine.survivorRemaining());state.put("countdownDrawn",hudVisible&&countdownDrawn);
        state.put("countdownNumber",hudVisible?countdownNumber:-1);state.put("countdownScale",countdownScale);state.put("countdownBlocksControls",false);
        state.put("brand",BRAND);state.put("hudWidth",HUD_WIDTH);state.put("crosshairDrawn",hudVisible);state.put("crosshairBounds",crosshairBounds(width,height));
        state.put("battleCountdownRemaining",engine.battleCountdownRemaining());state.put("battleCountdownDrawn",hudVisible&&battleCountdownDrawn);
        state.put("battleCountdownNumber",hudVisible?battleCountdownNumber:-1);state.put("battleAnnouncementRemaining",engine.battleAnnouncementRemaining());
        state.put("battleAnnouncementDrawn",hudVisible&&battleAnnouncementDrawn);state.put("battleAnnouncement","BATTLE START");state.put("battleKey","O");
        state.put("battleCountdownBounds",battleBounds(width,height));state.put("battleAnnouncementBounds",announcementBounds(width,height));state.put("countdownBounds",survivorBounds(width,height));
        state.put("watchingSelf",SnakePlayer.watchingSelf());state.put("rightClickMass",10);state.put("rightClickReady",hudVisible&&SnakePlayer.watchingSelf());
        state.put("rightZooming",SnakeCamera.rightZooming());state.put("sizeLinkReady",widgetLinkReady(false));state.put("winsLinkReady",widgetLinkReady(true));
        state.put("giftDownloadVisible",mc.screen instanceof Panel);state.put("copyTooltip","Copy link");
        if(mc.screen instanceof Arena arena){state.put("sizeCopy",Map.of("bounds",bounds(arena.sizeCopy),"active",arena.sizeCopy.active));state.put("winsCopy",Map.of("bounds",bounds(arena.winsCopy),"active",arena.winsCopy.active));}
        state.put("shieldBadges",hudVisible?SnakeLabels.shieldBadges:List.of());state.put("shieldTextFits",SnakeLabels.shieldTextFits);
        state.put("selectedId",selected==null?"":selected.id);state.put("free",SnakeCamera.free);state.put("following",SnakeCamera.following());
        state.put("snakes",new ArrayList<>(engine.snakes.keySet()));state.put("winners",winnerQaRows(engine.winners()));state.put("savedWinners",winnerQaRows(SnakeClient.CONFIG.leaderboardWins));
        state.put("winsRevision",engine.winsRevision);state.put("winTotal",engine.winners().stream().mapToLong(ArenaEngine.Winner::wins).sum());
        state.put("round",engine.round);state.put("winner",engine.winner);state.put("started",engine.started);state.put("totalEaten",engine.totalEaten);state.put("totalTailBites",engine.totalTailBites);
        state.put("broadcasterJoined",SnakePlayer.joined());state.put("broadcasterControlling",SnakePlayer.controlling());state.put("broadcasterId",SnakePlayer.id());
        List<Map<String,Object>> snakes=new ArrayList<>(),winners=new ArrayList<>(),controls=new ArrayList<>();List<ArenaLabels.Rect> occupied=new ArrayList<>();boolean textFits=true;
        if(mc.screen instanceof Arena||mc.screen==null){
            var leaders=hudSnakes(layout);
            for(int i=0;i<leaders.size();i++){
                var snake=leaders.get(i);int y=layout.snakesY+24+i*HUD_ROW;String name=mc.font.plainSubstrByWidth((i+1)+". "+snake.name,HUD_WIDTH-14),detail=mc.font.plainSubstrByWidth(ArenaLabels.mass(snake.mass)+" - "+snake.intent,HUD_WIDTH-24);
                var nameBox=new ArenaLabels.Rect(16,y+2,mc.font.width(name),mc.font.lineHeight);var detailBox=new ArenaLabels.Rect(26,y+13,mc.font.width(detail),mc.font.lineHeight);
                occupied.add(nameBox);occupied.add(detailBox);snakes.add(Map.of("id",snake.id,"name",snake.name,"displayName",name,"row",new ArenaLabels.Rect(HUD_LEFT,y,HUD_WIDTH,HUD_ROW-2),"nameBounds",nameBox,"detailBounds",detailBox));
                textFits&=nameBox.x()+nameBox.width()<=HUD_LEFT+HUD_WIDTH-7&&detailBox.x()+detailBox.width()<=HUD_LEFT+HUD_WIDTH-7;
            }
            var winnerRows=hudWinners(layout);
            for(int i=0;i<winnerRows.size();i++){
                var w=winnerRows.get(i);var row=winnerBounds(layout,i);String name=mc.font.plainSubstrByWidth(w.name(),HUD_WIDTH-56),count=mc.font.plainSubstrByWidth(w.wins()+"x",HUD_WIDTH-56);
                var nameBox=new ArenaLabels.Rect(15,row.y()+2,mc.font.width(name),mc.font.lineHeight);var countBox=new ArenaLabels.Rect(15,row.y()+13,mc.font.width(count),mc.font.lineHeight);
                var plus=new ArenaLabels.Rect(HUD_LEFT+HUD_WIDTH-42,row.y()+2,20,20);var minus=new ArenaLabels.Rect(HUD_LEFT+HUD_WIDTH-20,row.y()+2,20,20);
                occupied.add(nameBox);occupied.add(countBox);winners.add(Map.of("id",w.id(),"name",w.name(),"displayName",name,"wins",w.wins(),"alive",engine.snakes.containsKey(w.id()),"row",row,"nameBounds",nameBox,"countBounds",countBox,"plus",plus,"minus",minus));
                textFits&=nameBox.x()+nameBox.width()<plus.x()&&countBox.x()+countBox.width()<plus.x();
            }
        }else if(mc.screen instanceof Scores scores){
            for(int i=0;i<scores.visible();i++){
                int index=scores.page*scores.visible()+i;if(index>=scores.rows.size())break;var w=scores.rows.get(index);int y=73+i*32,countX=scores.left+scores.contentWidth-78-mc.font.width(w.wins()+"x");
                String name=mc.font.plainSubstrByWidth(w.name(),Math.max(1,countX-scores.left-8));
                var nameBox=new ArenaLabels.Rect(scores.left,y+6,mc.font.width(name),mc.font.lineHeight);var countBox=new ArenaLabels.Rect(countX,y+6,mc.font.width(w.wins()+"x"),mc.font.lineHeight);
                occupied.add(nameBox);occupied.add(countBox);winners.add(Map.of("id",w.id(),"name",w.name(),"displayName",name,"wins",w.wins(),"alive",engine.snakes.containsKey(w.id()),"row",new ArenaLabels.Rect(scores.left,y,scores.contentWidth,20),"nameBounds",nameBox,"countBounds",countBox,"plus",new ArenaLabels.Rect(scores.left+scores.contentWidth-34,y,30,20),"minus",new ArenaLabels.Rect(scores.left+scores.contentWidth-70,y,30,20)));
                textFits&=nameBox.x()+nameBox.width()<countBox.x();
            }
        }
        if(hudVisible){
            occupied.add(crosshairBounds(width,height));
            if(countdownDrawn)occupied.add(survivorBounds(width,height));
            if(battleCountdownDrawn)occupied.add(battleBounds(width,height));
            if(battleAnnouncementDrawn)occupied.add(announcementBounds(width,height));
        }
        if(mc.screen!=null)for(var child:mc.screen.children())if(child instanceof AbstractWidget widget&&widget.visible){
            var box=bounds(widget);occupied.add(box);controls.add(Map.of("label",widget.getMessage().getString(),"bounds",box,"active",widget.active));
            textFits&=mc.font.width(widget.getMessage())<=widget.getWidth()-6;
        }
        boolean nonOverlapping=true,insideViewport=true;
        for(int i=0;i<occupied.size();i++){
            var box=occupied.get(i);insideViewport&=box.x()>=0&&box.y()>=0&&box.x()+box.width()<=width&&box.y()+box.height()<=height;
            for(int j=0;j<i;j++)nonOverlapping&=!intersects(box,occupied.get(j));
        }
        state.put("hudSnakes",snakes);state.put("winnerRows",winners);state.put("controls",controls);state.put("textFits",textFits);state.put("nonOverlapping",nonOverlapping);state.put("insideViewport",insideViewport);
        state.put("labelsNonOverlapping",SnakeLabels.nonOverlapping);state.put("labelsInsideViewport",SnakeLabels.insideViewport);state.put("bodyTargets",SnakeLabels.qaBodyTargets());return state;
    }
    private static List<Map<String,Object>> winnerQaRows(List<ArenaEngine.Winner> rows){
        return rows.stream().<Map<String,Object>>map(w->Map.of("id",w.id(),"name",w.name(),"wins",w.wins())).toList();
    }
    /** Read-only assertions for the live QA driver; never copy or report widget URLs. */
    public static Map<String,Boolean> inputHudSelfChecks(){
        var mc=Minecraft.getInstance();var state=moderationQaState();Map<String,Boolean> checks=new LinkedHashMap<>();
        int width=mc.getWindow().getGuiScaledWidth(),height=mc.getWindow().getGuiScaledHeight();
        boolean hud=mc.screen==null||mc.screen instanceof Arena;
        checks.put("compactHud",HUD_WIDTH<=120);
        checks.put("textFits",Boolean.TRUE.equals(state.get("textFits")));
        checks.put("nonOverlapping",Boolean.TRUE.equals(state.get("nonOverlapping")));
        checks.put("insideViewport",Boolean.TRUE.equals(state.get("insideViewport")));
        checks.put("crosshairOnlyInGame",Boolean.valueOf(hud).equals(state.get("crosshairDrawn")));
        checks.put("crosshairClearOfControls",!hud||hudControlsReserved(width,height).stream().noneMatch(r->intersects(r,crosshairBounds(width,height))));
        checks.put("selfClickNeverZooms",!SnakePlayer.watchingSelf()||!SnakeCamera.rightZooming());
        checks.put("independentCountdowns",!hud||!countdownDrawn||(!battleCountdownDrawn||!intersects(battleBounds(width,height),survivorBounds(width,height)))&&(!battleAnnouncementDrawn||!intersects(announcementBounds(width,height),survivorBounds(width,height))));
        if(mc.screen instanceof Arena arena){
            var size=bounds(arena.sizeCopy);var wins=bounds(arena.winsCopy);
            checks.put("secureSizeCopy",arena.sizeCopy.active==widgetLinkReady(false));checks.put("secureWinsCopy",arena.winsCopy.active==widgetLinkReady(true));
            checks.put("headerControlsSeparate",!intersects(bounds(arena.snakesToggle),size)&&!intersects(bounds(arena.winsToggle),wins));
            checks.put("rightClickBlockedOnCopy",!arena.gameViewAt(size.x()+size.width()/2.0,size.y()+size.height()/2.0)&&!arena.gameViewAt(wins.x()+wins.width()/2.0,wins.y()+wins.height()/2.0));
            checks.put("rightClickAllowedAtCenter",arena.gameViewAt(width/2.0,height/2.0));
        }
        return checks;
    }
    /** Actions: +, -, follow, body, P. Uses real screen coordinates/key handlers, including saves. */
    public static boolean moderationQaAction(String id,String action){
        var mc=Minecraft.getInstance();var screen=mc.screen;
        if("P".equals(action))return screen instanceof Arena?screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_P,0,0):screen==null&&moderateSelected(org.lwjgl.glfw.GLFW.GLFW_KEY_P);
        if(!(screen instanceof Arena)&&!(screen instanceof Scores))return false;
        screen.tick();double x=-1,y=-1;
        if("body".equals(action)&&screen instanceof Arena){
            var target=SnakeLabels.qaBodyTargets().stream().filter(t->id.equals(t.get("id"))).findFirst().orElse(null);if(target==null)return false;
            x=((Number)target.get("x")).doubleValue();y=((Number)target.get("y")).doubleValue();
        }else if("+".equals(action)||"-".equals(action)||"follow".equals(action)){
            @SuppressWarnings("unchecked") var rows=(List<Map<String,Object>>)moderationQaState().get("winnerRows");
            var target=rows.stream().filter(t->id.equals(t.get("id"))).findFirst().orElse(null);if(target==null)return false;
            var box=(ArenaLabels.Rect)target.get("+".equals(action)?"plus":"-".equals(action)?"minus":"nameBounds");x=box.x()+Math.max(1,box.width()/2.0);y=box.y()+box.height()/2.0;
        }else return false;
        boolean clicked=screen.mouseClicked(x,y,0);screen.mouseReleased(x,y,0);return clicked;
    }
    private abstract static class Menu extends Screen {
        protected int left,contentWidth;
        private final Panel panel;
        Menu(String title){
            super(text(title));var current=Minecraft.getInstance().screen;
            panel=current instanceof Panel p?p:current instanceof Menu menu?menu.panel:null;
        }
        protected void init(){contentWidth=Math.min(530,width-32);left=(width-contentWidth)/2;}
        protected void back(){minecraft.setScreen(panel==null?new Arena():panel);}
        public boolean isPauseScreen(){return false;}
        public void onClose(){back();}
        public void render(GuiGraphics g,int x,int y,float partial){
            g.fill(0,0,width,height,0xF0111719);g.drawString(font,BRAND,left,16,CYAN);g.drawString(font,title,left,37,WHITE);super.render(g,x,y,partial);
        }
        protected EditBox input(String label,String value,int y,int w){EditBox box=new EditBox(font,left+contentWidth-w,y,w,20,text(label));box.setValue(value);box.setMaxLength(40);addRenderableWidget(box);return box;}
    }
    private static final class Panel extends Menu {
        private final Screen previous;
        private Button pause;
        Panel(Screen previous){super("Arena menusu");this.previous=previous;}
        protected void init(){
            super.init();contentWidth=Math.min(500,width-32);left=(width-contentWidth)/2;
            int top=80,col=(contentWidth-12)/2;
            var live=button(this,"Yayin",left,top,col,b->minecraft.setScreen(new Live()));
            live.setTooltip(Tooltip.create(text("Yayin hesabi, baglanti ve widgetlar")));addRenderableWidget(live);
            var broadcaster=button(this,"Yayinci",left+col+12,top,col,b->minecraft.setScreen(new Broadcaster()));
            broadcaster.setTooltip(Tooltip.create(text("Yayinci olarak katil, izle ve kutle ekle")));addRenderableWidget(broadcaster);
            var actions=button(this,"Eylemler",left,top+30,col,b->minecraft.setScreen(new Actions()));
            actions.setTooltip(Tooltip.create(text("Hediye, begeni ve takip eylemleri")));addRenderableWidget(actions);
            var settings=button(this,"Ayarlar",left+col+12,top+30,col,b->minecraft.setScreen(new Settings()));
            settings.setTooltip(Tooltip.create(text("Kutle, katilim, goruntu ve ses ayarlari")));addRenderableWidget(settings);
            pause=button(this,SnakeClient.ENGINE.paused?"Devam":"Duraklat",left,top+90,col,b->{SnakeClient.ENGINE.paused=!SnakeClient.ENGINE.paused;updatePause();});
            pause.setTooltip(Tooltip.create(text("Arena simulasyonunu duraklat / devam ettir")));addRenderableWidget(pause);
            var demo=button(this,"Demo",left+col+12,top+90,col,b->{if(!SnakeLive.activeUser.isEmpty())SnakeLive.disconnect();SnakeClient.ENGINE.seedDemo();updatePause();});
            demo.setTooltip(Tooltip.create(text("Ornek yilanlarla yeni demo baslat")));addRenderableWidget(demo);
            var download=button(this,"Hediye gorselini indir",left,top+120,contentWidth,b->SnakeDownloads.saveGiftImage());
            download.setTooltip(Tooltip.create(text("Hazir hediye gorselini indir")));addRenderableWidget(download);
            addRenderableWidget(button(this,"Eylem laboratuvari",left,top+60,col,b->minecraft.setScreen(new SnakeDiagnostics(this))));
            addRenderableWidget(button(this,"Savasi baslat [O]",left+col+12,top+60,col,b->{SnakeClient.ENGINE.requestBattle();onClose();}));
            var resume=button(this,"Geri",left,height-30,contentWidth,b->onClose());
            resume.setTooltip(Tooltip.create(text("Onceki gorunume don (B / Escape)")));addRenderableWidget(resume);
            setInitialFocus(live);
        }
        private void updatePause(){pause.setMessage(text(SnakeClient.ENGINE.paused?"Devam":"Duraklat"));}
        public void tick(){updatePause();}
        public void render(GuiGraphics g,int x,int y,float partial){
            super.render(g,x,y,partial);
            var e=SnakeClient.ENGINE;
            String state=e.paused?"DURAKLATILDI":e.started?"SAVAS AKTIF":e.battleCountdownRemaining()>=0?"BASLIYOR / "+(int)Math.ceil(e.battleCountdownRemaining()):"KATILIM ACIK / SAVAS BEKLIYOR";
            g.drawString(font,state,left,59,e.started?CYAN:GOLD);
            int yy=height-69;g.fill(left,yy-7,left+contentWidth,yy-6,0xFF344A4B);
            g.drawString(font,e.snakes.size()+" yilan / "+e.totalEaten+" yutma / "+e.totalTailBites+" isirma",left,yy,WHITE);
            g.drawString(font,font.plainSubstrByWidth(SnakeLive.status,contentWidth),left,yy+14,MUTED);
        }
        public boolean keyPressed(int key,int scan,int modifiers){if(key==GLFW.GLFW_KEY_B){onClose();return true;}return super.keyPressed(key,scan,modifiers);}
        public void onClose(){
            minecraft.setScreen(previous);
            if(previous==null)minecraft.mouseHandler.grabMouse();
        }
    }
    private static final class Broadcaster extends Menu {
        private EditBox amount;
        private Button joinWatch,grow;
        private String error="";
        private int top;
        Broadcaster(){super("Yayinci");}
        protected void init(){
            super.init();contentWidth=Math.min(300,width-32);left=(width-contentWidth)/2;
            top=Math.max(64,Math.min(96,(height-142)/2));
            joinWatch=button(this,"",left,top,contentWidth,b->{
                if(!SnakePlayer.joined())SnakePlayer.join();
                SnakeCamera.watch(SnakePlayer.id());
            });addRenderableWidget(joinWatch);
            amount=new EditBox(font,left,top+50,contentWidth-100,20,text("Ek kutle"));
            amount.setMaxLength(14);amount.setValue("100");amount.setFilter(v->v.matches("[0-9]*([.,][0-9]*)?"));
            amount.setTooltip(Tooltip.create(text("1 - 1000000 kutle")));addRenderableWidget(amount);
            grow=button(this,"Kutle ekle",left+contentWidth-94,top+50,94,b->addMass());
            grow.setTooltip(Tooltip.create(text("Yayinciya profil yemi ile kutle ekle")));addRenderableWidget(grow);
            addRenderableWidget(button(this,"Geri",left,top+108,contentWidth,b->back()));
            updateControls();setInitialFocus(joinWatch);
        }
        private void updateControls(){
            boolean joined=SnakePlayer.joined();joinWatch.setMessage(text(joined?"Yayinciyi izle":"Katil ve izle"));
            joinWatch.setTooltip(Tooltip.create(text(joined?"Tab: yayinci yilanini yakindan izle":"Tab: 300 kutle ile katil ve yakindan izle")));
            grow.active=joined;
        }
        private void addMass(){
            try{
                double value=Double.parseDouble(amount.getValue().replace(',','.'));
                if(!Double.isFinite(value)||value<1||value>1000000)throw new IllegalArgumentException();
                error=SnakePlayer.grow(value)?"":"Yayinciya kutle eklenemedi";updateControls();
            }catch(IllegalArgumentException ex){error="Kutle: 1 - 1000000";setFocused(amount);}
        }
        public void tick(){updateControls();}
        public void render(GuiGraphics g,int x,int y,float partial){
            super.render(g,x,y,partial);
            g.drawString(font,"Tab: katil | O: savasi baslat",left,top+25,MUTED);
            g.drawString(font,"Ek kutle",left,top+36,MUTED);
            if(!error.isEmpty())g.drawString(font,error,left,top+78,0xFFFF7777);
        }
    }
    public static final class Settings extends Menu {
        private record NumberField(String label,double min,double max,boolean integer,java.util.function.ToDoubleFunction<ArenaRules> get,java.util.function.ObjDoubleConsumer<ArenaRules> set){}
        private static final NumberField[][] FIELDS={
            {new NumberField("1 coin basina kutle",0,1000,false,r->r.coinsToMass,(r,v)->r.coinsToMass=v),
             new NumberField("1 coin carpani",0,20,false,r->r.multiplier1,(r,v)->r.multiplier1=v),
             new NumberField("50 coin carpani",0,20,false,r->r.multiplier50,(r,v)->r.multiplier50=v),
             new NumberField("100 coin carpani",0,20,false,r->r.multiplier100,(r,v)->r.multiplier100=v),
             new NumberField("500 coin carpani",0,20,false,r->r.multiplier500,(r,v)->r.multiplier500=v),
             new NumberField("1000 coin carpani",0,20,false,r->r.multiplier1000,(r,v)->r.multiplier1000=v)},
            {new NumberField("Takiple baslangic kutlesi",10,1000000,false,r->r.followMass,(r,v)->r.followMass=v),
             new NumberField("Katilim icin begeni",1,100000,true,r->r.likesPerJoin,(r,v)->r.likesPerJoin=(int)v),
             new NumberField("Begeniyle baslangic kutlesi",10,1000000,false,r->r.likeEntryMass,(r,v)->r.likeEntryMass=v),
             new NumberField("Buyumek icin begeni",1,100000,true,r->r.likesPerGrowth,(r,v)->r.likesPerGrowth=(int)v),
             new NumberField("Her begeni adiminda eklenen kutle",0,1000000,false,r->r.likeGrowthMass,(r,v)->r.likeGrowthMass=v),
             new NumberField("Yeni katilan korumasi (sn)",0,60,false,r->r.protectionSeconds,(r,v)->r.protectionSeconds=v),
             new NumberField("Hediyeyle baslangic kutlesi",10,1000000,false,r->r.giftEntryMass,(r,v)->r.giftEntryMass=v)},
            {new NumberField("Arena capi (blok)",32,1000,true,r->r.arenaSize,(r,v)->r.arenaSize=(int)v),
             new NumberField("Profil boyutu carpani",.75,2.5,false,r->r.profileScale,(r,v)->r.profileScale=v)},{}
        };
        private final ArenaRules draft=new Gson().fromJson(new Gson().toJson(SnakeClient.CONFIG),ArenaRules.class);
        private final Map<NumberField,EditBox> boxes=new LinkedHashMap<>();
        private int tab;private String error="";private final boolean fromActions;
        Settings(){this(false);}
        Settings(boolean fromActions){super(fromActions?"Begeni ve takip eylemleri":"Kutle ve katilim kurallari");this.fromActions=fromActions;if(fromActions)tab=1;}
        protected void back(){if(fromActions)minecraft.setScreen(new Actions());else super.back();}
        protected void init(){
            super.init();contentWidth=Math.min(680,width-32);left=(width-contentWidth)/2;boxes.clear();
            String[] tabs={"Kutle","Katilim","Goruntu","Ses"};int cell=(contentWidth-12)/4;
            if(!fromActions)for(int i=0;i<tabs.length;i++){int selected=i;var control=button(this,tabs[i],left+i*(cell+4),57,cell,b->{if(capture()){tab=selected;error="";rebuildWidgets();}});control.active=i!=tab;addRenderableWidget(control);}
            int fieldWidth=(contentWidth-16)/2;
            for(int i=0;i<FIELDS[tab].length;i++){
                NumberField field=FIELDS[tab][i];int x=left+(i%2)*(fieldWidth+16),y=99+(i/2)*48;
                EditBox box=new EditBox(font,x,y,fieldWidth,22,text(field.label));double value=field.get.applyAsDouble(draft);
                box.setMaxLength(12);box.setValue(field.integer?Integer.toString((int)value):Double.toString(value));
                box.setFilter(v->v.matches("[0-9]*([.,][0-9]*)?"));box.setTooltip(Tooltip.create(text(field.min+" - "+field.max)));boxes.put(field,box);addRenderableWidget(box);
            }
            if(tab==0){
                addRenderableWidget(button(this,"1 coin dene",left,260,fieldWidth,b->testGift(1)));
                addRenderableWidget(button(this,"1000 coin dene",left+fieldWidth+16,260,fieldWidth,b->testGift(1000)));
            }else if(tab==2){
                addRenderableWidget(new AbstractSliderButton(left,151,contentWidth,20,text(""),(draft.arenaSize-32)/968.0){
                    protected void updateMessage(){setMessage(text("Arena capi: "+(32+(int)Math.round(value*968))+" blok"));}
                    protected void applyValue(){boxes.get(FIELDS[2][0]).setValue(Integer.toString(32+(int)Math.round(value*968)));} {updateMessage();}
                });
            }else if(tab==3){
                addRenderableWidget(volume("Muzik",left,105,draft.musicVolume,v->draft.musicVolume=v));
                addRenderableWidget(volume("Efektler",left,165,draft.effectsVolume,v->draft.effectsVolume=v));
                addRenderableWidget(button(this,"Muzigi dinle",left,214,fieldWidth,b->{previewVolumes();SnakeAudio.testMusic();}));
                addRenderableWidget(button(this,"Tis / yeme sesi dene",left+fieldWidth+16,214,fieldWidth,b->{previewVolumes();SnakeAudio.testEffects();}));
            }
            addRenderableWidget(button(this,"Kaydet",left+contentWidth-110,height-30,110,b->{if(capture()){copy(draft,SnakeClient.CONFIG);SnakeClient.CONFIG.joinOnFollow=true;SnakeClient.applyConfig();back();}}));
            addRenderableWidget(button(this,"Iptal",left,height-30,90,b->{SnakeAudio.stop();SnakeClient.CONFIG.musicVolume=originalMusic;SnakeClient.CONFIG.effectsVolume=originalEffects;back();}));
        }
        private final double originalMusic=SnakeClient.CONFIG.musicVolume,originalEffects=SnakeClient.CONFIG.effectsVolume;
        private AbstractSliderButton volume(String label,int x,int y,double initial,java.util.function.DoubleConsumer change){
            return new AbstractSliderButton(x,y,contentWidth,22,text(""),initial){
                protected void updateMessage(){setMessage(text(label+": %"+(int)Math.round(value*100)));}
                protected void applyValue(){change.accept(value);previewVolumes();} {updateMessage();}
            };
        }
        private void previewVolumes(){SnakeClient.CONFIG.musicVolume=draft.musicVolume;SnakeClient.CONFIG.effectsVolume=draft.effectsVolume;}
        private boolean capture(){
            for(var entry:boxes.entrySet()){
                var field=entry.getKey();try{double value=Double.parseDouble(entry.getValue().getValue().replace(',','.'));
                    if(!Double.isFinite(value)||value<field.min||value>field.max||(field.integer&&value!=Math.floor(value)))throw new IllegalArgumentException();
                    field.set.accept(draft,value);
                }catch(Exception ex){error=field.label+": "+field.min+" - "+field.max;entry.getValue().setFocused(true);return false;}
            }
            return true;
        }
        private static void copy(ArenaRules from,ArenaRules to){for(var fields:FIELDS)for(var f:fields)f.set.accept(to,f.get.applyAsDouble(from));to.musicVolume=from.musicVolume;to.effectsVolume=from.effectsVolume;}
        private void testGift(int coins){if(!capture()||!SnakeLive.activeUser.isEmpty())return;var engine=SnakeClient.ENGINE;ArenaRules old=engine.rules;engine.rules=draft;engine.gift("ayar-test","Hediye testi","",coins,1);engine.rules=old;}
        public void onClose(){SnakeClient.CONFIG.musicVolume=originalMusic;SnakeClient.CONFIG.effectsVolume=originalEffects;super.onClose();}
        public void render(GuiGraphics g,int x,int y,float p){
            super.render(g,x,y,p);int fieldWidth=(contentWidth-16)/2;
            if(fromActions)g.drawString(font,"Takip ile katilim: ACIK",left,62,CYAN);
            for(int i=0;i<FIELDS[tab].length;i++)g.drawString(font,FIELDS[tab][i].label,left+(i%2)*(fieldWidth+16),86+(i/2)*48,MUTED);
            if(tab==0)g.drawString(font,"Coin x temel kutle x carpan",left,245,GOLD);
            if(tab==1)g.drawString(font,"Takip ile katilim",left,294,CYAN);
            if(!error.isEmpty())g.drawString(font,font.plainSubstrByWidth(error,contentWidth),left,height-45,0xFFFF7777);
        }
    }
    static void smokeSettings(int tab){var s=new Settings();s.tab=tab;Minecraft.getInstance().setScreen(s);}
    static boolean smokeSettingsSave(){
        var mc=Minecraft.getInstance();var config=SnakeClient.CONFIG;double base=config.coinsToMass;int step=config.likesPerGrowth;
        try{
            var screen=new Settings();mc.setScreen(screen);screen.boxes.get(Settings.FIELDS[0][0]).setValue("21,5");
            screen.children().stream().filter(w->w instanceof Button b&&b.getMessage().getString().equals("Katilim")).map(w->(Button)w).findFirst().orElseThrow().onPress();
            screen.boxes.get(Settings.FIELDS[1][3]).setValue("125");
            screen.children().stream().filter(w->w instanceof Button b&&b.getMessage().getString().equals("Kaydet")).map(w->(Button)w).findFirst().orElseThrow().onPress();
            var loaded=SnakeConfig.load();return loaded.coinsToMass==21.5&&loaded.likesPerGrowth==125&&config.coinsToMass==21.5;
        }finally{config.coinsToMass=base;config.likesPerGrowth=step;SnakeClient.applyConfig();}
    }
    static boolean smokeParticipationSave(){
        var mc=Minecraft.getInstance();var config=SnakeClient.CONFIG;int step=config.likesPerGrowth;double reward=config.likeGrowthMass,follow=config.followMass;
        try{
            mc.setScreen(new Actions());
            ((Button)mc.screen.children().stream().filter(w->w instanceof Button b&&b.getMessage().getString().equals("Begeni / Takip")).findFirst().orElseThrow()).onPress();
            if(!(mc.screen instanceof Settings screen)||!screen.fromActions)return false;
            screen.boxes.get(Settings.FIELDS[1][0]).setValue("325");screen.boxes.get(Settings.FIELDS[1][3]).setValue("100");screen.boxes.get(Settings.FIELDS[1][4]).setValue("175");
            ((Button)screen.children().stream().filter(w->w instanceof Button b&&b.getMessage().getString().equals("Kaydet")).findFirst().orElseThrow()).onPress();
            var saved=SnakeConfig.load();var test=new ArenaEngine(100);test.rules=saved;test.followed("qa-follow","Test","photo");
            test.liked("qa-follow","Test","photo",100);for(int i=0;i<22;i++){test.food.clear();test.tick(.05);}
            return mc.screen instanceof Actions&&saved.likesPerGrowth==100&&saved.likeGrowthMass==175&&saved.followMass==325&&saved.joinOnFollow&&test.snakes.get("qa-follow").mass==500;
        }finally{config.likesPerGrowth=step;config.likeGrowthMass=reward;config.followMass=follow;SnakeClient.applyConfig();}
    }
    public static final class Live extends Menu {
        private EditBox username;
        Live(){super("Yayin hesabi");}
        protected void init(){super.init();username=new EditBox(font,left,83,contentWidth,24,text("TikTok kullanici adi"));username.setHint(text("@kullanici_adi"));username.setValue(SnakeClient.CONFIG.username);username.setMaxLength(33);addRenderableWidget(username);
            addRenderableWidget(button(this,"Baglan",left,122,contentWidth/2-4,b->SnakeLive.connect(username.getValue())));
            addRenderableWidget(button(this,"Baglantiyi kes",left+contentWidth/2+4,122,contentWidth/2-4,b->SnakeLive.disconnect()));
            addRenderableWidget(button(this,"Widget baglantilari",left,200,contentWidth/2-4,b->minecraft.setScreen(new Widgets())));
            addRenderableWidget(button(this,"Galibiyetleri duzenle",left+contentWidth/2+4,200,contentWidth/2-4,b->minecraft.setScreen(new Scores())));
            addRenderableWidget(button(this,"Geri",left,height-32,90,b->back()));}
        public void render(GuiGraphics g,int x,int y,float p){super.render(g,x,y,p);g.drawString(font,"TikTok kullanici adi",left,68,MUTED);g.drawWordWrap(font,text(SnakeLive.status),left,162,contentWidth,CYAN);g.drawString(font,SnakeLive.eventCount+" olay / "+SnakeLive.giftCount+" hediye",left,196,MUTED);}
    }
    public static final class Widgets extends Menu {
        private EditBox sizes,wins;
        private Button sizeCopy,winsCopy;
        Widgets(){super("Yayin widgetlari");}
        private EditBox link(int y){EditBox box=new EditBox(font,left,y,contentWidth-100,22,text("Widget URL"));box.setMaxLength(2048);box.setEditable(false);addRenderableWidget(box);return box;}
        protected void init(){super.init();sizes=link(96);wins=link(168);
            sizeCopy=copyLinkButton(left+contentWidth-92,96,92,false);addRenderableWidget(sizeCopy);
            winsCopy=copyLinkButton(left+contentWidth-92,168,92,true);addRenderableWidget(winsCopy);
            addRenderableWidget(button(this,"Galibiyetleri duzenle",left,245,contentWidth,b->minecraft.setScreen(new Scores())));
            addRenderableWidget(button(this,"Geri",left,height-30,90,b->minecraft.setScreen(new Live())));
        }
        public void render(GuiGraphics g,int x,int y,float p){
            sizeCopy.active=widgetLinkReady(false);winsCopy.active=widgetLinkReady(true);
            super.render(g,x,y,p);if(!sizes.getValue().equals(SnakeWidgets.sizeURL))sizes.setValue(SnakeWidgets.sizeURL);if(!wins.getValue().equals(SnakeWidgets.winsURL))wins.setValue(SnakeWidgets.winsURL);
            g.drawString(font,"En buyuk yilanlar",left,80,CYAN);g.drawString(font,"Kazananlar",left,152,GOLD);
            g.drawWordWrap(font,text(SnakeWidgets.status),left,207,contentWidth,SnakeWidgets.secure?CYAN:MUTED);
        }
    }
    public static final class Scores extends Menu {
        private int page;private List<ArenaEngine.Winner> rows;
        Scores(){super("Galibiyetler");}
        private int visible(){return Math.max(1,(height-135)/32);}
        protected void init(){super.init();
            rows=SnakeClient.ENGINE.winners();page=Math.max(0,Math.min(page,Math.max(0,(rows.size()-1)/visible())));
            for(int i=0;i<visible();i++){int index=page*visible()+i;if(index>=rows.size())break;var w=rows.get(index);int yy=73+i*32;
                addRenderableWidget(winnerButton(this,w,true,left+contentWidth-70,yy,30,this::rebuildWidgets));
                addRenderableWidget(winnerButton(this,w,false,left+contentWidth-34,yy,30,this::rebuildWidgets));
            }
            var previous=button(this,"<",left+contentWidth-70,height-55,30,b->{page--;rebuildWidgets();});previous.active=page>0;addRenderableWidget(previous);
            var next=button(this,">",left+contentWidth-34,height-55,30,b->{page++;rebuildWidgets();});next.active=(page+1)*visible()<rows.size();addRenderableWidget(next);
            addRenderableWidget(button(this,"Geri",left,height-30,90,b->minecraft.setScreen(new Widgets())));
        }
        public void tick(){if(!rows.equals(SnakeClient.ENGINE.winners()))rebuildWidgets();}
        public boolean mouseClicked(double x,double y,int button){
            if(super.mouseClicked(x,y,button))return true;
            if(button==0&&x>=left&&x<left+contentWidth-78)for(int i=0;i<visible();i++){
                int index=page*visible()+i;if(index>=rows.size())break;
                if(y>=73+i*32&&y<93+i*32){SnakeCamera.watch(rows.get(index).id());return true;}
            }
            return false;
        }
        public void render(GuiGraphics g,int x,int y,float p){
            if(!rows.equals(SnakeClient.ENGINE.winners()))rebuildWidgets();
            super.render(g,x,y,p);for(int i=0;i<visible();i++){int index=page*visible()+i;if(index>=rows.size())break;var w=rows.get(index);int yy=79+i*32,countX=left+contentWidth-78-font.width(w.wins()+"x");
                g.drawString(font,font.plainSubstrByWidth(w.name(),Math.max(1,countX-left-8)),left,yy,WHITE);g.drawString(font,w.wins()+"x",countX,yy,GOLD);
            }if(rows.isEmpty())g.drawString(font,"Henuz galibiyet yok",left,90,MUTED);
        }
    }
    public static final class SpeedTest extends Menu {
        private final SnakeConfig.Rule rule;private ArenaEngine test;private ArenaEngine.Snake runner;private double base;
        SpeedTest(SnakeConfig.Rule rule){super("Hiz testi / "+rule.name);this.rule=rule;}
        protected void init(){super.init();restart();addRenderableWidget(button(this,"Tekrar dene",left,245,120,b->restart()));addRenderableWidget(button(this,"Geri",left,height-30,90,b->minecraft.setScreen(new Actions())));}
        private void restart(){test=new ArenaEngine(42);test.configure(1000);runner=test.join("speed-test","Test Yilani","",1000);base=runner.speed(test.time);test.action(runner.id,runner.name,"","boost",rule.amount,rule.seconds);}
        public void tick(){test.food.clear();test.tick(.05);}
        public void render(GuiGraphics g,int x,int y,float p){super.render(g,x,y,p);double boost=runner.speed(test.time),remaining=Math.max(0,runner.boostUntil-test.time);
            g.drawString(font,"Temel hiz",left,80,MUTED);g.drawString(font,String.format(Locale.ROOT,"%.2f blok/sn",base),left+contentWidth-120,80,WHITE);
            g.fill(left,103,left+contentWidth,113,0xFF283A35);g.fill(left,103,left+(int)(contentWidth*.1),113,0xFF91ACA1);
            g.drawString(font,"Hediye sonrasi",left,140,CYAN);g.drawString(font,String.format(Locale.ROOT,"%.2f blok/sn",boost),left+contentWidth-120,140,WHITE);
            g.fill(left,163,left+contentWidth,173,0xFF283A35);g.fill(left,163,left+(int)(contentWidth*Math.min(1,boost/base/10)),173,CYAN);
            g.drawString(font,String.format(Locale.ROOT,"%.1fx   |   %.1f sn kaldi",boost/base,remaining),left,194,GOLD);
        }
    }
    static double smokeSpeedRatio(){return Minecraft.getInstance().screen instanceof SpeedTest s?s.runner.speed(s.test.time)/s.base:0;}
    public static final class Actions extends Menu {
        private int page;
        Actions(){super("Eylemler");}
        private int visible(){return Math.max(1,(height-186)/44);}
        protected void init(){super.init();int visible=visible();var rules=SnakeClient.CONFIG.gifts;
            addRenderableWidget(button(this,"Begeni / Takip",left+contentWidth-128,77,128,b->minecraft.setScreen(new Settings(true))));
            page=Math.min(page,Math.max(0,(rules.size()-1)/visible));
            for(int row=0;row<visible;row++){int index=page*visible+row;if(index>=rules.size())break;int yy=129+row*44;var rule=rules.get(index);
                addRenderableWidget(button(this,"Duzenle",left+contentWidth-128,yy+3,62,b->minecraft.setScreen(new RuleEditor(index))));
                addRenderableWidget(button(this,"Test",left+contentWidth-62,yy+3,62,b->minecraft.setScreen(new SnakeDiagnostics(this))));
            }
            addRenderableWidget(button(this,"+ Eylem ekle",left,height-57,120,b->minecraft.setScreen(new RuleEditor(-1))));
            addRenderableWidget(button(this,"<",left+contentWidth-74,height-57,32,b->{page=Math.max(0,page-1);rebuildWidgets();}));
            addRenderableWidget(button(this,">",left+contentWidth-36,height-57,32,b->{page++;rebuildWidgets();}));
            addRenderableWidget(button(this,"Geri",left,height-30,90,b->back()));
        }
        public void render(GuiGraphics g,int x,int y,float p){super.render(g,x,y,p);int visible=visible();var rules=SnakeClient.CONFIG.gifts;var config=SnakeClient.CONFIG;
            g.drawString(font,font.plainSubstrByWidth("Takip: katilim acik / "+ArenaLabels.mass(config.followMass)+" kutle",contentWidth-142),left,72,CYAN);
            g.drawString(font,font.plainSubstrByWidth("Her "+config.likesPerGrowth+" begenide +"+ArenaLabels.mass(config.likeGrowthMass)+" kutle",contentWidth-142),left,91,WHITE);
            g.fill(left,115,left+contentWidth,116,0xFF344A4B);
            g.drawString(font,(page+1)+" / "+Math.max(1,(rules.size()+visible-1)/visible),left+contentWidth-119,height-50,MUTED);
            for(int row=0;row<visible;row++){int index=page*visible+row;if(index>=rules.size())break;var r=rules.get(index);int yy=129+row*44;
                Gift gift=CATALOG.stream().filter(a->a.id.equals(r.giftId)).findFirst().orElse(null);if(gift!=null)icon(g,gift,left,yy,30);
                g.drawString(font,font.plainSubstrByWidth(r.name,contentWidth-175),left+37,yy+3,WHITE);g.drawString(font,label(r.action)+" | "+r.amount+" | "+r.seconds+" sn",left+37,yy+16,MUTED);
            }
        }
    }
    private static String label(String action){return switch(action){case "boost"->"Hizlandir";case "galaxy"->"Parcala / birlestir";case "shield"->"Kalkan";case "shrink"->"Kucult";default->"Buyut";};}
    private static final class RuleEditor extends Menu {
        private final int index;private EditBox amount,seconds;private String error="";private SnakeConfig.Rule draft;
        RuleEditor(int index){super(index>=0&&SnakeClient.CONFIG.gifts.get(index).action.equals("galaxy")?"Galaksi: parcala ve birlestir":"Hediye ile hizlandir");this.index=index;var r=index<0?new SnakeConfig.Rule("","Hediye sec","boost",2,15):SnakeClient.CONFIG.gifts.get(index);draft=new SnakeConfig.Rule(r.giftId,r.name,r.action.equals("galaxy")?"galaxy":"boost",r.action.equals("galaxy")?Math.max(3,Math.min(5,r.amount)):r.action.equals("boost")?r.amount:2,r.seconds);}
        protected void init(){super.init();
            addRenderableWidget(button(this,draft.name+"  #"+draft.giftId,left,70,contentWidth,b->{try{draft.amount=Double.parseDouble(amount.getValue());draft.seconds=Double.parseDouble(seconds.getValue());}catch(Exception ignored){}minecraft.setScreen(new Catalog(gift->{draft.giftId=gift.id;draft.name=gift.name;minecraft.setScreen(this);} ));}));
            amount=input("Hiz carpani",Double.toString(draft.amount),126,90);seconds=input("Sure (saniye)",Double.toString(draft.seconds),161,90);
            addRenderableWidget(button(this,"Kaydet",left+contentWidth-110,height-32,110,b->{try{double a=Double.parseDouble(amount.getValue().replace(',','.')),s=Double.parseDouble(seconds.getValue().replace(',','.'));boolean galaxy=draft.action.equals("galaxy");if(draft.giftId.isBlank()||!Double.isFinite(a)||!Double.isFinite(s)||a<(galaxy?3:1)||a>(galaxy?5:10)||(galaxy&&a!=Math.rint(a))||s<1||s>60)throw new IllegalArgumentException();for(int i=0;i<SnakeClient.CONFIG.gifts.size();i++)if(i!=index&&draft.giftId.equals(SnakeClient.CONFIG.gifts.get(i).giftId))throw new IllegalArgumentException();draft.amount=a;draft.seconds=s;if(index<0)SnakeClient.CONFIG.gifts.add(draft);else SnakeClient.CONFIG.gifts.set(index,draft);SnakeClient.CONFIG.save();minecraft.setScreen(new Actions());}catch(Exception ex){error=(draft.action.equals("galaxy")?"Parca: 3-5":"Hiz: 1-10")+" | Sure: 1-60 sn | Ayni hediye tekrarlanamaz";}}));
            if(index>=0)addRenderableWidget(button(this,"Sil",left+99,height-32,90,b->{SnakeClient.CONFIG.gifts.remove(index);SnakeClient.CONFIG.save();minecraft.setScreen(new Actions());}));
            addRenderableWidget(button(this,"Iptal",left,height-32,90,b->minecraft.setScreen(new Actions())));
        }
        public void render(GuiGraphics g,int x,int y,float p){super.render(g,x,y,p);g.drawString(font,draft.action.equals("galaxy")?"Yilan basina parca":"Hiz carpani",left,132,WHITE);g.drawString(font,"Sure (saniye)",left,167,WHITE);if(!error.isEmpty())g.drawString(font,error,left,height-51,0xFFFF7777);}
    }
    private record Gift(String id,String name,int coins,String file){}
    static int giftCoins(String id){return CATALOG.stream().filter(g->g.id.equals(id)).mapToInt(Gift::coins).findFirst().orElse(id.equals("5303")?50:0);}
    private static final List<Gift> CATALOG=loadCatalog();
    private static final java.util.Map<String,String> VISUAL_GROUPS=loadVisualGroups();
    private static java.util.Map<String,String> loadVisualGroups(){
        var out=new java.util.HashMap<String,String>();
        try(var in=SnakeScreens.class.getResourceAsStream("/assets/tikmng_snake_arena/gifts/visual-groups.json")){
            for(var element:JsonParser.parseReader(new InputStreamReader(in,StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("groups")){
                var group=element.getAsJsonObject();for(var id:group.getAsJsonArray("ids"))out.put(id.getAsString(),group.get("id").getAsString());
            }
        }catch(Exception ignored){}return out;
    }
    private static String visualGroup(Gift gift){return VISUAL_GROUPS.getOrDefault(gift.id,gift.id);}
    private static List<Gift> loadCatalog(){
        try(var in=SnakeScreens.class.getResourceAsStream("/assets/tikmng_snake_arena/gifts/catalog.json")){
            List<Gift> out=new ArrayList<>();JsonParser.parseReader(new InputStreamReader(in,StandardCharsets.UTF_8)).getAsJsonArray().forEach(e->{var o=e.getAsJsonObject();out.add(new Gift(o.get("id").getAsString(),o.get("trName").getAsString(),o.get("coins").getAsInt(),o.get("file").getAsString()));});out.sort(Comparator.comparingInt(Gift::coins).thenComparing(Gift::name));return List.copyOf(out);
        }catch(Exception ex){return List.of();}
    }
    private static void icon(GuiGraphics g,Gift gift,int x,int y,int size){ResourceLocation location=ResourceLocation.fromNamespaceAndPath(SnakeMod.ID,"gifts/"+gift.file);g.blit(location,x,y,0,0,size,size,size,size);}
    static void smokeCatalog(){Minecraft.getInstance().setScreen(new Catalog(g->{}));}
    private static final class Catalog extends Menu {
        private final Consumer<Gift> selected;private final List<Gift> variants;private EditBox search;private int firstRow;
        Catalog(Consumer<Gift> selected){this(selected,null);}
        Catalog(Consumer<Gift> selected,List<Gift> variants){super("Hediye katalogu");this.selected=selected;this.variants=variants;}
        protected void init(){super.init();contentWidth=Math.min(760,width-24);left=(width-contentWidth)/2;search=new EditBox(font,left,58,contentWidth,20,text("Hediye ara"));search.setHint(text("Hediye adi, kimligi veya coin"));search.setResponder(s->firstRow=0);addRenderableWidget(search);addRenderableWidget(button(this,variants==null?"Iptal":"Geri",left,height-29,90,b->minecraft.setScreen(variants==null?new Actions():new Catalog(selected))));}
        private List<Gift> filtered(){String q=search.getValue().toLowerCase(Locale.ROOT);var matching=(variants==null?CATALOG:variants).stream().filter(g->g.name.toLowerCase(Locale.ROOT).contains(q)||g.id.contains(q)||Integer.toString(g.coins).equals(q)).toList();if(variants!=null)return matching;var groups=new java.util.LinkedHashMap<String,Gift>();for(var gift:matching)groups.putIfAbsent(visualGroup(gift),gift);return List.copyOf(groups.values());}
        private int rows(){return Math.max(1,(height-127)/66);}
        public void render(GuiGraphics g,int mx,int my,float p){super.render(g,mx,my,p);var gifts=filtered();int w=contentWidth/6;firstRow=Math.max(0,Math.min(firstRow,Math.max(0,(gifts.size()+5)/6-rows())));
            for(int row=0;row<rows();row++)for(int col=0;col<6;col++){int index=(firstRow+row)*6+col;if(index>=gifts.size())continue;Gift gift=gifts.get(index);int x=left+col*w,y=87+row*66;g.fill(x,y,x+w-4,y+62,mx>=x&&mx<x+w&&my>=y&&my<y+62?0xFF344A4B:0xFF202A2C);if(variants==null)icon(g,gift,x+(w-32)/2,y+3,32);else g.drawCenteredString(font,"#"+gift.id,x+w/2,y+15,CYAN);g.drawCenteredString(font,font.plainSubstrByWidth(gift.name,w-8),x+w/2,y+39,WHITE);g.drawCenteredString(font,gift.coins+" coin",x+w/2,y+51,GOLD);}
            if(variants!=null)icon(g,variants.get(0),left+contentWidth-28,height-29,24);
            g.drawString(font,gifts.size()+" hediye",left+105,height-23,MUTED);
        }
        public boolean mouseScrolled(double x,double y,double delta){firstRow+=delta<0?1:-1;return true;}
        public boolean mouseClicked(double x,double y,int button){if(button==0&&y>=87&&y<87+rows()*66&&x>=left&&x<left+contentWidth){int col=(int)(x-left)/(contentWidth/6),row=(int)(y-87)/66,index=(firstRow+row)*6+col;var list=filtered();if(col<6&&index>=0&&index<list.size()){var gift=list.get(index);var choices=CATALOG.stream().filter(g->visualGroup(g).equals(visualGroup(gift))).toList();if(variants==null&&choices.size()>1)minecraft.setScreen(new Catalog(selected,choices));else selected.accept(gift);return true;}}return super.mouseClicked(x,y,button);}
    }
}
