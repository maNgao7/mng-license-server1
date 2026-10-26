package com.tikmng.snake;

import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.world.phys.Vec3;
import java.nio.file.*;
import java.util.*;

final class SnakeVisualCheck {
    private static int rendered,quads,freeFrames,topFrames;
    private static double maximumRadius,averageMs,maximumFrameDelta;
    private static Vec3 oldCamera,freeStart,inputStart;
    private static double freeTravel,firstYaw,turnDifference,inputTravel;
    private static int topSettled;
    private static double stationaryCameraDelta;
    private static boolean firstFree,secondFree,closeFollow,dragCorrect;
    private static int followFrames;
    private static double followAimDot=1;
    private static String topView="";
    private static ArenaEngine.Snake hero;
    private static ArenaEngine.Snake bittenPrey,biteHunter;
    private static double originalMass,originalLength;
    private static long previousTailBites,previousHeadBites;
    private static boolean tailBite,headBite;
    private static boolean feedingVisible,feedingCredited;
    private static boolean musicPlayed,effectPlayed,audioMuted;
    private static boolean settingsSaved;
    private static double massBeforeFeeding;
    private static double feedingReward;
    private static boolean profileFoodRendered,growthCuePlayed;
    private static boolean rightZoomWorks,zoomCameraStable,swallowPlayed;
    private static double zoomHeight,zoomRenderMs;
    private static int zoomFrames;
    private static boolean readableLabels,centered,resizedCentered,roundArena;
    private static boolean chunkAnchorCentered;
    private static int topLabels,topAvatarSize;
    private static double topCenterError;
    private static boolean reportWritten;
    private record PendingGift(String id,double started,double before,double amount){}
    private static final java.util.Map<String,PendingGift> livePending=new java.util.HashMap<>();
    private static final java.util.Set<String> liveGifts=new java.util.HashSet<>(),liveBoosts=new java.util.HashSet<>();
    private static int liveCredits,liveMaximumPlayers;
    private static long liveAvatarCount;
    private static int livePhotoSourcePixels,livePhotoTexturePixels;
    static void start(){
        SnakeClient.CONFIG.arenaSize=320;SnakeClient.applyConfig();
        var engine=SnakeClient.ENGINE;engine.seedDemo();engine.started=true;
        hero=engine.join("giant-fixture","Dev Yilan","",65000);hero.shieldUntil=100000;
        hero.x=0;hero.z=0;engine.configure(engine.size);
        engine.paused=true;
        var server=Minecraft.getInstance().getSingleplayerServer();
        server.execute(()->{
            server.overworld().setBlock(new net.minecraft.core.BlockPos(0,64,0),net.minecraft.world.level.block.Blocks.STONE.defaultBlockState(),2);
            SnakeMod.requestResize(SnakeClient.CONFIG.arenaSize);
        });
    }
    static void frame(int bodyQuads,Vec3 camera,float pitch,float yaw,long previous,double projectionY){
        rendered++;quads=Math.max(quads,bodyQuads);averageMs+=(SnakeClient.renderMilliseconds-averageMs)/rendered;
        if(SnakeCamera.zoom()<.7){zoomFrames++;zoomRenderMs+=(SnakeClient.renderMilliseconds-zoomRenderMs)/zoomFrames;}
        if(previous>0&&rendered>40)maximumFrameDelta=Math.max(maximumFrameDelta,(System.nanoTime()-previous)/1_000_000.0);
        if(SnakeCamera.following()){
            followFrames++;oldCamera=null;topSettled=0;
            var followed=SnakeCamera.followed();
            if(followed!=null&&followFrames>25){
                var target=new Vec3(followed.x,ArenaSpace.SURFACE_Y+followed.radius()*.9,followed.z).subtract(camera).normalize();
                double yr=Math.toRadians(yaw),pr=Math.toRadians(pitch);
                var look=new Vec3(-Math.sin(yr)*Math.cos(pr),-Math.sin(pr),Math.cos(yr)*Math.cos(pr));
                followAimDot=Math.min(followAimDot,target.dot(look));
            }
        }
        else if(!SnakeCamera.free){
            if(topFrames==100)topView=camera+" vfov="+Math.toDegrees(2*Math.atan(1/projectionY));
            if(oldCamera!=null&&topSettled++>35)stationaryCameraDelta=Math.max(stationaryCameraDelta,camera.distanceTo(oldCamera));
            oldCamera=camera;topFrames++;
        }else {
            freeFrames++;oldCamera=null;topSettled=0;
            if(freeStart==null){freeStart=camera;firstYaw=yaw;}
            freeTravel=Math.max(freeTravel,camera.distanceTo(freeStart));
            turnDifference=Math.max(turnDifference,Math.abs(yaw-firstYaw));
        }
        for(var snake:SnakeClient.ENGINE.snakes.values())maximumRadius=Math.max(maximumRadius,snake.renderRadius(1));
    }
    static void tick(int tick,int frames){
        Minecraft mc=Minecraft.getInstance();
        if(reportWritten){if(System.getProperty("tikmng.snake.liveQaUser","").isEmpty())SnakeFeatureCheck.tick();else liveTick(tick);return;}
        if(tick>=300&&tick<320)SnakeClient.ENGINE.food.clear();
        if(tick==1)SnakeClient.ENGINE.paused=false;
        if(tick==105){zoomHeight=SnakeClient.cameraHeight;SnakeClient.mouse(new net.minecraftforge.client.event.InputEvent.MouseButton.Pre(1,org.lwjgl.glfw.GLFW.GLFW_PRESS,0));}
        if(tick==120){rightZoomWorks=SnakeCamera.zoom()<.5;zoomCameraStable=SnakeClient.cameraHeight==zoomHeight;grab("v015-zoom.png");}
        if(tick==125)SnakeClient.mouse(new net.minecraftforge.client.event.InputEvent.MouseButton.Pre(1,org.lwjgl.glfw.GLFW.GLFW_RELEASE,0));
        if(tick==150)SnakeCamera.top();
        if(tick==160){
            topLabels=SnakeLabels.visible;topAvatarSize=SnakeLabels.avatarPixels;topCenterError=SnakeLabels.centerError;
            readableLabels=topLabels>=4&&topAvatarSize>=16&&topAvatarSize<=28&&SnakeLabels.nonOverlapping&&SnakeLabels.insideViewport;
            centered=topCenterError<1;
            grab("v015-top.png");
        }
        if(tick==170){
            SnakeCamera.watch(hero.id);
        }
        if(tick==195){
            closeFollow=SnakeCamera.followed()==hero&&followFrames>25&&followAimDot>.98&&mc.gameRenderer.getMainCamera().getPosition().y<ArenaSpace.SURFACE_Y+60;
            grab("v015-close.png");
        }
        if(tick==200){SnakeCamera.fly();firstFree=mc.getCameraEntity()==mc.player&&mc.screen==null;SnakeCamera.position(14,ArenaSpace.SURFACE_Y+7,18,138,9);secondFree=true;}
        if(tick==205){inputStart=mc.player.position();mc.options.keyUp.setDown(true);}
        if(tick==215){mc.options.keyUp.setDown(false);inputTravel=mc.player.position().distanceTo(inputStart);}
        if(tick==216)SnakeCamera.position(mc.player.getX(),mc.player.getY(),mc.player.getZ(),mc.player.getYRot()+45,mc.player.getXRot());
        if(tick==220){
            double x=hero.x+Math.cos(hero.angle)*hero.radius()*7,z=hero.z+Math.sin(hero.angle)*hero.radius()*7;
            var view=ArenaSpace.lookAt(x,ArenaSpace.SURFACE_Y+hero.radius()*2.5,z,hero.x,ArenaSpace.SURFACE_Y+hero.radius(),hero.z);
            SnakeCamera.position(view.x(),view.y(),view.z(),view.yaw(),view.pitch());
        }
        if(tick==225)grab("v015-between.png");
        if(tick==230)SnakeCamera.top();
        if(tick==232){
            double x=SnakeClient.cameraX,z=SnakeClient.cameraZ;
            var arena=(SnakeScreens.Arena)mc.screen;
            arena.mouseDragged(200,80,0,36,24);
            boolean unarmed=SnakeClient.cameraX==x&&SnakeClient.cameraZ==z;
            arena.mouseClicked(200,80,0);arena.mouseDragged(236,104,0,36,24);arena.mouseReleased(236,104,0);
            dragCorrect=unarmed&&SnakeClient.cameraX>x&&SnakeClient.cameraZ>z;
        }
        if(tick==237)grab("v015-drag.png");
        if(tick==240){SnakeCamera.top();mc.setScreen(new SnakeScreens.Settings());}
        if(tick==245)grab("v015-settings.png");
        if(tick==250)mc.setScreen(new SnakeScreens.Actions());
        if(tick==260)grab("v015-actions.png");
        if(tick==270)SnakeScreens.smokeCatalog();
        if(tick==272)mc.getWindow().setWindowed(1280,720);
        if(tick==280)grab("v015-gifts.png");
        if(tick==285)mc.setScreen(new SnakeScreens.Arena());
        if(tick==295){resizedCentered=SnakeLabels.centerError<1;chunkAnchorCentered=Math.hypot(mc.player.getX(),mc.player.getZ())<.1;grab("v015-1280.png");}
        if(tick==300){mc.getWindow().setWindowed(1600,900);massBeforeFeeding=hero.mass;feedingReward=SnakeClient.ENGINE.rules.giftMass(100,1);SnakeClient.ENGINE.started=false;SnakeClient.ENGINE.minimumPlayers=96;SnakeAudio.resetGrowDiagnostics();SnakeFeedingVisuals.resetDiagnostics();SnakeClient.ENGINE.gift(hero.id,hero.name,hero.profile,100,1);SnakeCamera.watch(hero.id);}
        if(tick==304){feedingVisible=!SnakeClient.ENGINE.feedings.isEmpty()&&hero.mass<massBeforeFeeding+feedingReward;profileFoodRendered=SnakeFeedingVisuals.diagnostics().totalPortraitDraws()>0;grab("v015-feeding.png");}
        if(tick==319){feedingCredited=hero.mass==massBeforeFeeding+feedingReward&&SnakeClient.ENGINE.feedings.isEmpty();growthCuePlayed=SnakeAudio.growDiagnostics().submissions()>0&&SnakeAudio.growDiagnostics().active();}
        if(tick==320){
            var engine=SnakeClient.ENGINE;engine.reset();engine.demo=true;engine.minimumPlayers=2;engine.started=true;
            bittenPrey=engine.join("bite-prey","Kuyrugu isirilan","",900);biteHunter=engine.join("bite-hunter","Avci","",3000);
            bittenPrey.x=0;bittenPrey.z=0;bittenPrey.angle=0;biteHunter.x=60;biteHunter.z=60;engine.configure(320);
            var body=bittenPrey.body();var hit=body.get((int)((body.size()-1)*.65));
            biteHunter.angle=Math.PI/2;biteHunter.x=hit.x();biteHunter.z=hit.z()-biteHunter.radius()*.8;
            engine.configure(320);
            bittenPrey.shieldUntil=biteHunter.shieldUntil=0;engine.food.clear();
            originalMass=bittenPrey.mass;originalLength=bittenPrey.length();previousTailBites=engine.totalTailBites;previousHeadBites=engine.totalEaten;
            SnakeCamera.top();SnakeClient.cameraHeight=ArenaSpace.SURFACE_Y+36;SnakeClient.cameraX=-10;SnakeClient.cameraZ=-4;
        }
        if(tick==322){
            var engine=SnakeClient.ENGINE;
            tailBite=engine.snakes.get(bittenPrey.id)==bittenPrey&&bittenPrey.mass<originalMass&&bittenPrey.length()<originalLength&&biteHunter.kills==0&&engine.totalTailBites==previousTailBites+1;
            engine.paused=true;
        }
        if(tick==330)grab("v015-tail-bite.png");
        if(tick==340){
            var engine=SnakeClient.ENGINE;engine.time+=1;engine.paused=false;
            biteHunter.x=bittenPrey.x-biteHunter.radius()*.8;biteHunter.z=bittenPrey.z;biteHunter.angle=0;
            SnakeAudio.resetPlaybackDiagnostics();
        }
        if(tick==342){
            var engine=SnakeClient.ENGINE;
            headBite=!engine.snakes.containsKey(bittenPrey.id)&&biteHunter.kills==1&&engine.totalEaten==previousHeadBites+1;
            swallowPlayed=SnakeAudio.playbackDiagnostics().submissions()>0;
            engine.paused=true;
        }
        if(tick==350)grab("v015-head-bite.png");
        if(tick==354){mc.getWindow().setWindowed(1280,720);SnakeScreens.smokeSettings(1);}
        if(tick==359)grab("v015-participation.png");
        if(tick==361)SnakeScreens.smokeSettings(2);
        if(tick==366)grab("v015-display.png");
        if(tick==368){SnakeScreens.smokeSettings(3);SnakeAudio.testMusic();SnakeAudio.testEffects();}
        if(tick==373)grab("v015-audio.png");
        if(tick==375){musicPlayed=SnakeAudio.musicPlaying();effectPlayed=SnakeAudio.activeEffects()>0;}
        if(tick==380){SnakeClient.CONFIG.musicVolume=0;SnakeClient.CONFIG.effectsVolume=0;}
        if(tick==385){audioMuted=!SnakeAudio.musicPlaying()&&SnakeAudio.activeEffects()==0;SnakeClient.CONFIG.musicVolume=.22;SnakeClient.CONFIG.effectsVolume=.65;}
        if(tick==386){
            var engine=SnakeClient.ENGINE;engine.reset();engine.paused=true;engine.minimumPlayers=5;
            var waiting=engine.join("waiting-fixture","Bekleyen Yilan","",200);SnakeCamera.watch(waiting.id);
        }
        if(tick==387)grab("v015-waiting.png");
        if(tick==388)settingsSaved=SnakeScreens.smokeSettingsSave();
        if(tick>390){
            boolean bodies=quads>1000&&maximumRadius>5,free=firstFree&&secondFree&&freeFrames>20&&freeTravel>5&&turnDifference>10&&inputTravel>5;
            int half=SnakeClient.CONFIG.arenaSize/2;
            boolean fence=mc.level.getBlockState(new net.minecraft.core.BlockPos(half-1,ArenaSpace.SURFACE_Y+3,2)).is(net.minecraft.world.level.block.Blocks.OAK_FENCE);
            boolean corner=mc.level.getBlockState(new net.minecraft.core.BlockPos(half,ArenaSpace.SURFACE_Y+7,0)).is(net.minecraft.world.level.block.Blocks.POLISHED_ANDESITE);
            boolean ground=mc.level.getBlockState(new net.minecraft.core.BlockPos(half+8,ArenaSpace.FLOOR_Y,0)).is(net.minecraft.world.level.block.Blocks.GRASS_BLOCK);
            boolean oldRemoved=mc.level.getBlockState(new net.minecraft.core.BlockPos(0,64,0)).isAir();
            boolean cloudsOff=mc.options.getCloudsType()==net.minecraft.client.CloudStatus.OFF;
            roundArena=!mc.level.getBlockState(new net.minecraft.core.BlockPos(half,ArenaSpace.SURFACE_Y+3,half)).is(net.minecraft.world.level.block.Blocks.OAK_FENCE);
            String report="{\"version\":\"0.15.0\",\"frames\":"+rendered+",\"bodyQuads\":"+quads+",\"maxRadius\":"+maximumRadius+",\"freeFlight\":"+free+",\"closeFollow\":"+closeFollow+",\"followAimDot\":"+followAimDot+",\"dragCorrect\":"+dragCorrect+",\"grounded\":"+ground+",\"fence\":"+fence+",\"oldPlatformRemoved\":"+oldRemoved+",\"cloudsOff\":"+cloudsOff+",\"nativeForwardTravel\":"+inputTravel+",\"averageMeshMs\":"+averageMs+",\"tailBite\":"+tailBite+",\"headBite\":"+headBite+",\"feedingVisible\":"+feedingVisible+",\"feedingCredited\":"+feedingCredited+"}";
            report=report.substring(0,report.length()-1)+",\"topView\":\""+topView+"\",\"musicPlayed\":"+musicPlayed+",\"effectPlayed\":"+effectPlayed+",\"audioMuted\":"+audioMuted+",\"settingsSaved\":"+settingsSaved+"}";
            report=report.substring(0,report.length()-1)+",\"rightZoom\":"+rightZoomWorks+",\"zoomCameraStable\":"+zoomCameraStable+",\"zoomRenderMs\":"+zoomRenderMs+",\"tallCorners\":"+corner+",\"swallowPlayed\":"+swallowPlayed+"}";
            report=report.substring(0,report.length()-1)+",\"readableLabels\":"+readableLabels+",\"topLabels\":"+topLabels+",\"avatarGuiPixels\":"+topAvatarSize+",\"topCenterError\":"+topCenterError+",\"resizedCentered\":"+resizedCentered+",\"chunkAnchorCentered\":"+chunkAnchorCentered+",\"roundArena\":"+roundArena+",\"profileFoodRendered\":"+profileFoodRendered+",\"growthCuePlayed\":"+growthCuePlayed+"}";
            try{Files.writeString(mc.gameDirectory.toPath().resolve("visual-check.json"),report);}catch(Exception e){throw new IllegalStateException(e);}
            System.out.println("MNG_SNAKE_SMOKE size="+SnakeClient.ENGINE.size+" frames="+frames+" bodies="+bodies+" freeFlight="+free+" close="+closeFollow+" drag="+dragCorrect+" ground="+(ground&&fence&&corner&&oldRemoved&&cloudsOff)+" bites="+(tailBite&&headBite)+" feeding="+(feedingVisible&&feedingCredited)+" audio="+(musicPlayed&&effectPlayed&&audioMuted&&swallowPlayed)+" settings="+settingsSaved+" zoom="+(rightZoomWorks&&zoomCameraStable)+" labels="+readableLabels+" centered="+(centered&&resizedCentered&&chunkAnchorCentered)+" round="+roundArena+" meshMs="+averageMs);
            reportWritten=true;
            String liveUser=System.getProperty("tikmng.snake.liveQaUser","");
            if(liveUser.isEmpty())SnakeFeatureCheck.start(bodies&&free&&closeFollow&&dragCorrect&&ground&&fence&&corner&&oldRemoved&&cloudsOff&&tailBite&&headBite&&feedingVisible&&feedingCredited&&profileFoodRendered&&growthCuePlayed&&musicPlayed&&effectPlayed&&audioMuted&&swallowPlayed&&settingsSaved&&rightZoomWorks&&zoomCameraStable&&readableLabels&&centered&&resizedCentered&&chunkAnchorCentered&&roundArena);
            else{
                SnakeClient.ENGINE.reset();SnakeClient.ENGINE.restoreWins(List.of());SnakeClient.ENGINE.demo=false;SnakeClient.ENGINE.paused=false;
                SnakeCamera.top();SnakeLive.connect(liveUser);
            }
        }
    }
    private static void liveTick(int tick){
        var engine=SnakeClient.ENGINE;liveMaximumPlayers=Math.max(liveMaximumPlayers,engine.snakes.size());
        liveAvatarCount=Math.max(liveAvatarCount,SnakeAvatars.loadedCount());
        for(var s:engine.snakes.values()){
            if(s.boostUntil>engine.time)liveBoosts.add(s.id);
            var avatar=SnakeAvatars.diagnostics(s.id);
            if(avatar.downloaded()){livePhotoSourcePixels=Math.max(livePhotoSourcePixels,Math.min(avatar.sourceWidth(),avatar.sourceHeight()));livePhotoTexturePixels=Math.max(livePhotoTexturePixels,avatar.texturePixels());}
        }
        for(var feeding:engine.feedings)if(feeding.coins()>0){
            String key=feeding.snakeId()+":"+feeding.started();var s=engine.snakes.get(feeding.snakeId());if(s==null)continue;
            liveGifts.add(key);var pending=livePending.get(key);
            livePending.put(key,new PendingGift(s.id,feeding.started(),pending==null?s.mass:pending.before,feeding.amount()));
        }
        for(var iterator=livePending.entrySet().iterator();iterator.hasNext();){
            var entry=iterator.next();var pending=entry.getValue();
            boolean waiting=engine.feedings.stream().anyMatch(f->f.snakeId().equals(pending.id)&&f.started()==pending.started);
            if(!waiting){var s=engine.snakes.get(pending.id);if(s!=null&&s.mass>=pending.before+pending.amount-.01)liveCredits++;iterator.remove();}
        }
        if(tick==2150){grab("v015-live-overview.png");SnakeCamera.watchNext();}
        if(tick==2180)grab("v015-live.png");
        if(tick>2190){
            var result=new com.google.gson.JsonObject();
            result.addProperty("test","real-public-LIVE-to-native-Minecraft");
            result.addProperty("streamer",System.getProperty("tikmng.snake.liveQaUser",""));
            result.addProperty("syntheticEvents",false);result.addProperty("observationSeconds",90);
            result.addProperty("maximumParticipants",liveMaximumPlayers);result.addProperty("giftFeedingsSeen",liveGifts.size());
            result.addProperty("giftGrowthsCredited",liveCredits);result.addProperty("boostParticipants",liveBoosts.size());
            result.addProperty("downloadedAvatars",liveAvatarCount);result.addProperty("status",SnakeLive.status);
            result.addProperty("largestSourcePhotoPixels",livePhotoSourcePixels);result.addProperty("largestTexturePixels",livePhotoTexturePixels);result.addProperty("avatarGuiPixels",SnakeLabels.avatarPixels);
            try{Files.writeString(Minecraft.getInstance().gameDirectory.toPath().resolve("live-check.json"),result.toString());}catch(Exception e){throw new IllegalStateException(e);}
            System.out.println("MNG_SNAKE_LIVE_QA passed="+(liveMaximumPlayers>0&&liveAvatarCount>0)+" participants="+liveMaximumPlayers+" giftFeedings="+liveGifts.size()+" credited="+liveCredits+" avatars="+liveAvatarCount);
            Minecraft.getInstance().stop();
        }
    }
    private static void grab(String name){var mc=Minecraft.getInstance();Screenshot.grab(mc.gameDirectory,name,mc.getMainRenderTarget(),m->{});}
}
