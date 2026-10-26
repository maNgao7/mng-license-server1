package com.tikmng.snake;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.*;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import org.lwjgl.glfw.GLFW;

@Mod.EventBusSubscriber(modid=SnakeMod.ID,value=Dist.CLIENT)
public final class SnakeClient {
    public static final ArenaEngine ENGINE=new ArenaEngine(20261023);
    public static final SnakeConfig CONFIG=SnakeConfig.load();
    public static double cameraX=.5,cameraZ=.5,cameraHeight=ArenaSpace.topHeight(96);
    public static boolean active;
    private static int ticks,frames,qaTicks;
    private static double previousTime;
    private static long previousFrame;
    private static long savedWinsRevision;
    static double renderMilliseconds;
    private record Draw(ArenaEngine.Snake snake,java.util.List<ArenaEngine.Point> points,double distance){}
    @SubscribeEvent public static void screen(ScreenEvent.Opening event){
        if(event.getNewScreen()!=null&&!(event.getNewScreen() instanceof SnakeScreens.Arena))SnakeCamera.rightZoom(false);
        if(event.getNewScreen()!=null&&event.getNewScreen().getClass()==TitleScreen.class)event.setNewScreen(new SnakeScreens.Start());
        else if(active&&event.getNewScreen() instanceof PauseScreen)event.setNewScreen(new SnakeScreens.Arena());
    }
    public static void fitCamera(){
        var mc=Minecraft.getInstance();cameraX=0;cameraZ=0;
        cameraHeight=ArenaSpace.topHeight(CONFIG.arenaSize,mc.getWindow().getGuiScaledWidth(),mc.getWindow().getGuiScaledHeight(),mc.options.fov().get());
    }
    public static void applyConfig(){
        int oldSize=ENGINE.size;
        CONFIG.save();ENGINE.rules=CONFIG;ENGINE.minimumPlayers=CONFIG.minimumPlayers;
        if(oldSize!=CONFIG.arenaSize){ENGINE.configure(CONFIG.arenaSize);fitCamera();
            var server=Minecraft.getInstance().getSingleplayerServer();if(server!=null)server.execute(()->SnakeMod.requestResize(CONFIG.arenaSize));}
    }
    @SubscribeEvent public static void tick(TickEvent.ClientTickEvent event){
        if(event.phase!=TickEvent.Phase.END)return;
        Minecraft mc=Minecraft.getInstance();
        if(mc.level==null||mc.player==null){if(active){active=false;SnakeVictory.reset();SnakeAudio.stop();SnakeCamera.close();SnakeLive.disconnect();}return;}
        if(mc.getSingleplayerServer()==null||!mc.getSingleplayerServer().getWorldData().getLevelName().equals("TikMnG Snake Arena"))return;
        if(!active){
            active=true;ticks=frames=qaTicks=0;CONFIG.save();ENGINE.rules=CONFIG;ENGINE.configure(CONFIG.arenaSize);ENGINE.minimumPlayers=CONFIG.minimumPlayers;fitCamera();
            ENGINE.restoreWins(CONFIG.leaderboardWins);savedWinsRevision=ENGINE.winsRevision;
            mc.getWindow().setTitle("TikMnG Yilan Arena - Masaustu Prototip 0.15.3");
            mc.options.hideGui=false;mc.options.pauseOnLostFocus=false;
            mc.getTutorial().setStep(net.minecraft.client.tutorial.TutorialSteps.NONE);mc.getToasts().clear();
            if(Boolean.getBoolean("tikmng.snake.smoke")){SnakeSmoke.check();SnakeVisualCheck.start();}
            if(!CONFIG.username.isBlank()&&!Boolean.getBoolean("tikmng.snake.smoke"))SnakeLive.connect(CONFIG.username);
            mc.setScreen(new SnakeScreens.Arena());
        }
        SnakeCamera.tick();SnakePlayer.tick();previousTime=ENGINE.time;
        long tails=ENGINE.totalTailBites,heads=ENGINE.totalEaten,feedings=ENGINE.totalFeedings,food=ENGINE.totalFoodEaten;
        ENGINE.tick(.05);ticks++;SnakeAudio.tick();
        SnakeWidgets.tick();
        if(!ENGINE.demo&&ENGINE.winsRevision!=savedWinsRevision){
            CONFIG.leaderboardWins=new java.util.ArrayList<>(ENGINE.winners().stream().filter(w->!w.id().startsWith("demo-")).toList());
            CONFIG.save();savedWinsRevision=ENGINE.winsRevision;
        }
        if(ENGINE.totalEaten>heads)SnakeAudio.swallow();
        else if(ENGINE.totalTailBites>tails)SnakeAudio.eat();
        else if(ENGINE.totalFoodEaten>food)SnakeAudio.eat();
        if(ENGINE.totalFeedings>feedings)SnakeAudio.grow();
        if(!ENGINE.paused&&ticks%150==0&&ENGINE.snakes.values().stream().anyMatch(s->s.intent.equals("AVLANIYOR")))SnakeAudio.hiss();
        SnakeVictory.tick();
        if(Boolean.getBoolean("tikmng.snake.smoke")&&SnakeMod.ready)SnakeVisualCheck.tick(++qaTicks,frames);
    }
    @SubscribeEvent public static void key(InputEvent.Key event){
        Minecraft mc=Minecraft.getInstance();if(!active||event.getAction()!=GLFW.GLFW_PRESS||mc.screen!=null)return;
        if(SnakeScreens.moderateSelected(event.getKey()))return;
        if(SnakePlayer.keyPressed(event.getKey()))return;
        if(event.getKey()==GLFW.GLFW_KEY_O)ENGINE.requestBattle();
        else if(event.getKey()==GLFW.GLFW_KEY_B)SnakeScreens.togglePanel();
        else if(event.getKey()==GLFW.GLFW_KEY_F)SnakeCamera.top();
    }
    @SubscribeEvent public static void scroll(InputEvent.MouseScrollingEvent event){
        if(active&&Minecraft.getInstance().screen==null){SnakeCamera.scroll(event.getScrollDelta());event.setCanceled(true);}
    }
    @SubscribeEvent public static void mouse(InputEvent.MouseButton.Pre event){
        var mc=Minecraft.getInstance();
        if(active&&event.getButton()==GLFW.GLFW_MOUSE_BUTTON_RIGHT&&(mc.screen==null||mc.screen instanceof SnakeScreens.Arena)){
            if(SnakePlayer.controlling()&&SnakeCamera.followed()!=null&&SnakeCamera.followed().id.equals(SnakePlayer.id())){
                if(event.getAction()==GLFW.GLFW_PRESS)SnakePlayer.rightClick();
                SnakeCamera.rightZoom(false);event.setCanceled(true);return;
            }
            SnakeCamera.rightZoom(event.getAction()!=GLFW.GLFW_RELEASE);event.setCanceled(true);
        }
    }
    @SubscribeEvent public static void fov(ViewportEvent.ComputeFov event){if(active)event.setFOV(event.getFOV()*SnakeCamera.zoom(event.getPartialTick()));}
    @SubscribeEvent public static void camera(ViewportEvent.ComputeCameraAngles event){
        if(!active)return;event.setRoll(0);if(!SnakeCamera.free&&!SnakeCamera.following()){event.setYaw(0);event.setPitch(90);}
    }
    @SubscribeEvent public static void fog(ViewportEvent.RenderFog event){
        if(active&&event.getType()==net.minecraft.world.level.material.FogType.NONE){event.setNearPlaneDistance(ENGINE.size>384?2000:500);event.setFarPlaneDistance(ENGINE.size>384?3000:700);event.setCanceled(true);}
    }
    @SubscribeEvent public static void vanillaHud(RenderGuiOverlayEvent.Pre event){if(active)event.setCanceled(true);}
    @SubscribeEvent public static void hand(RenderHandEvent event){if(active)event.setCanceled(true);}
    @SubscribeEvent public static void hud(RenderGuiEvent.Post event){
        if(active&&Minecraft.getInstance().screen==null)SnakeScreens.drawHud(event.getGuiGraphics());
    }
    @SubscribeEvent public static void render(RenderLevelStageEvent event){
        if(!active||event.getStage()!=RenderLevelStageEvent.Stage.AFTER_ENTITIES)return;
        long started=System.nanoTime();Minecraft mc=Minecraft.getInstance();PoseStack pose=event.getPoseStack();
        MultiBufferSource.BufferSource buffer=mc.renderBuffers().bufferSource();
        var origin=event.getCamera().getPosition();double partial=ENGINE.paused?1:event.getPartialTick();
        double time=previousTime+(ENGINE.time-previousTime)*partial;
        var drawing=new java.util.ArrayList<Draw>(ENGINE.snakes.size());
        for(var snake:ENGINE.renderSnakes()){
            var points=snake.body(partial);if(points.size()<2)continue;
            double minX=Double.MAX_VALUE,minZ=Double.MAX_VALUE,maxX=-Double.MAX_VALUE,maxZ=-Double.MAX_VALUE,nearest=Double.MAX_VALUE;
            for(var point:points){minX=Math.min(minX,point.x());minZ=Math.min(minZ,point.z());maxX=Math.max(maxX,point.x());maxZ=Math.max(maxZ,point.z());nearest=Math.min(nearest,origin.distanceToSqr(point.x(),ArenaSpace.SURFACE_Y+snake.radius(),point.z()));}
            double radius=snake.renderRadius(partial);
            if(!event.getFrustum().isVisible(new net.minecraft.world.phys.AABB(minX-radius*2,ArenaSpace.SURFACE_Y,minZ-radius*2,maxX+radius*2,ArenaSpace.SURFACE_Y+Math.max(34,radius*4),maxZ+radius*2)))continue;
            drawing.add(new Draw(snake,points,Math.sqrt(nearest)));
        }
        pose.pushPose();pose.translate(-origin.x,-origin.y,-origin.z);
        if(ENGINE.size>384)SnakeMesh.distantArena(pose,buffer,ENGINE.size);
        groundBrand(pose,buffer);
        var shadowType=RenderType.entityTranslucent(SnakeSkins.white());var shadows=buffer.getBuffer(shadowType);
        for(var draw:drawing)SnakeMesh.shadow(pose,shadows,draw.snake,partial,draw.points);
        buffer.endBatch(shadowType);
        var food=buffer.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.white()));int index=0;
        int[] foodColors={0xF6D06D,0x7DE3D0,0xEB8C99,0xA2D571};
        for(var point:ENGINE.food)SnakeMesh.pellet(pose,food,point.x(),point.z(),foodColors[index++%foodColors.length]);
        SnakeMesh.bodyQuads=0;SnakeMesh.beginFrame();
        for(var draw:drawing){
            SnakeMesh.render(pose,buffer,draw.snake,partial,time,draw.points,draw.distance);
        }
        if(Boolean.getBoolean("tikmng.snake.smoke"))SnakeFeatureCheck.renderFixture(pose,buffer,time);
        SnakeFeedingVisuals.render(pose,buffer,ENGINE,time,partial,event.getCamera().rotation());
        SnakeBoostVisuals.render(pose,buffer,ENGINE,time,partial,event.getCamera().rotation());
        SnakeCrownVisuals.render(pose,buffer,ENGINE,time,partial);
        for(var meal:ENGINE.meals){
            var eater=ENGINE.snakes.get(meal.eaterId());if(eater==null)continue;
            double progress=Math.max(0,Math.min(1,(time-meal.started())/.85)),ease=progress*progress*(3-2*progress),scale=Math.max(.01,1-ease);
            var anchor=meal.body().get(0);double mouthX=eater.renderX(partial)+Math.cos(eater.renderAngle(partial))*eater.radius(),mouthZ=eater.renderZ(partial)+Math.sin(eater.renderAngle(partial))*eater.radius();
            pose.pushPose();pose.translate(anchor.x()+(mouthX-anchor.x())*ease,ArenaSpace.SURFACE_Y+ease*eater.radius()*.8,anchor.z()+(mouthZ-anchor.z())*ease);
            pose.scale((float)scale,(float)scale,(float)scale);pose.translate(-anchor.x(),-ArenaSpace.SURFACE_Y,-anchor.z());
            SnakeMesh.renderMeal(pose,buffer,meal,time);pose.popPose();
        }
        pose.popPose();buffer.endBatch();SnakeLabels.capture(event,partial);frames++;
        renderMilliseconds=(System.nanoTime()-started)/1_000_000.0;
        if(Boolean.getBoolean("tikmng.snake.smoke"))SnakeVisualCheck.frame(SnakeMesh.bodyQuads,origin,event.getCamera().getXRot(),event.getCamera().getYRot(),previousFrame,event.getProjectionMatrix().m11());
        previousFrame=System.nanoTime();
    }
    private static void groundBrand(PoseStack pose,MultiBufferSource buffers){
        var font=Minecraft.getInstance().font;String name="Tik MNG";
        pose.pushPose();pose.translate(0,ArenaSpace.SURFACE_Y+.025,0);pose.mulPose(com.mojang.math.Axis.XP.rotationDegrees(90));
        pose.mulPose(com.mojang.math.Axis.ZP.rotationDegrees(180));
        float scale=Math.max(.3f,Math.min(2.4f,ENGINE.size/220f));pose.scale(scale,scale,scale);
        font.drawInBatch(name,-font.width(name)/2f+.6f,-3.4f,0x805A316F,false,pose.last().pose(),buffers,net.minecraft.client.gui.Font.DisplayMode.NORMAL,0,net.minecraft.client.renderer.LightTexture.FULL_BRIGHT);
        font.drawInBatch("Tik ",-font.width(name)/2f,-4,0xC06CEAD0,false,pose.last().pose(),buffers,net.minecraft.client.gui.Font.DisplayMode.NORMAL,0,net.minecraft.client.renderer.LightTexture.FULL_BRIGHT);
        int[] colors={0xD059DDF3,0xD0E9F6F0,0xD0F788B2};String[] letters={"M","N","G"};float x=-font.width(name)/2f+font.width("Tik ");
        for(int i=0;i<letters.length;i++){font.drawInBatch(letters[i],x,-4,colors[i],false,pose.last().pose(),buffers,net.minecraft.client.gui.Font.DisplayMode.NORMAL,0,net.minecraft.client.renderer.LightTexture.FULL_BRIGHT);x+=font.width(letters[i]);}
        pose.popPose();
    }
}
