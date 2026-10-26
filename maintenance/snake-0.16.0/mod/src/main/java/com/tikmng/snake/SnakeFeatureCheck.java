package com.tikmng.snake;

import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.components.Button;
import java.nio.file.*;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import com.google.gson.*;

final class SnakeFeatureCheck {
    private static int age,largeAge;private static boolean previousPassed,hidden,speed,persisted,widgetState,large,galaxySplit,galaxyMerged;
    private static boolean participationSaved,weaveRendered,showWeave;
    private static boolean chaseCaught,winnerVisible,winnerAudio,winnerOnce,winnerTwice,lastGulpBeforeWinner;
    private static boolean hudPlus,winnerFollow,bodyFollow,moderationP,freeModerationP,minusReduces,minusRemoves,hudFits,nearMassHunting,nearMassCapture;
    private static boolean cleanHud,shieldVisible,bPanel,bReturns,freePanel,tabJoin,spaceIgnored,tabDoesNotStart,tabReusesSnake,wasd,releaseStops,selfGrowth,nativeFood,parallelFour,mergedFour,countdownVisible,countdownCanceled,noEarlyWinner,delayedWinner;
    private static boolean emptyReset,selfCamera,rightClickTen,waitingNoCombat,oCountdown,oNoEarlyBattle,oBattleStarted,inputHud,trails,crown,unequalParts,smallPortraitStream;
    private static long waitingEaten;
    private static ArenaEngine.Snake broadcaster;
    private static double playerX,playerZ;
    private static long foodBefore;
    private static final JsonArray moderationStates=new JsonArray();
    private static void state(String phase){JsonObject entry=new JsonObject();entry.addProperty("phase",phase);entry.add("state",new Gson().toJsonTree(SnakeScreens.moderationQaState()));moderationStates.add(entry);}
    private static int victoryAge;
    private static ArenaEngine.Snake chaseHunter;
    private static final List<ArenaEngine.Point> weavePath=new ArrayList<>();
    static void renderFixture(com.mojang.blaze3d.vertex.PoseStack pose,net.minecraft.client.renderer.MultiBufferSource.BufferSource buffers,double time){
        if(!showWeave)return;SnakeMesh.renderWeaveFixture(pose,buffers,weavePath,1.6,time);weaveRendered=true;
    }
    static void start(boolean passed){previousPassed=passed;SnakeClient.ENGINE.survivorDelaySeconds=0;}
    private static void grab(String name){var mc=Minecraft.getInstance();Screenshot.grab(mc.gameDirectory,"v015-"+name+".png",mc.getMainRenderTarget(),m->{});}
    static void tick(){
        age++;var mc=Minecraft.getInstance();var engine=SnakeClient.ENGINE;
        if(age>=640&&age<695||age>=845&&age<=1080)engine.food.clear();
        if(age==1){
            engine.reset();engine.restoreWins(List.of());engine.demo=true;engine.paused=true;engine.join("qa-atlas","Atlas","",5000);engine.join("qa-nehir","Nehir","",900);
            SnakeClient.CONFIG.showSnakes=SnakeClient.CONFIG.showWins=true;
            engine.adjustWin("qa-atlas",2);engine.adjustWin("qa-nehir",1);SnakeCamera.top();
            for(var s:engine.snakes.values())s.shieldUntil=engine.time+1000;
            SnakeClient.CONFIG.leaderboardWins=new ArrayList<>(engine.winners());SnakeClient.CONFIG.save();
            persisted=SnakeConfig.load().leaderboardWins.stream().anyMatch(w->w.id().equals("qa-atlas")&&w.wins()==2);
        }
        if(age==6)mc.setScreen(new SnakeScreens.Scores());
        if(age==8)grab("wins");
        if(age==10)mc.setScreen(new SnakeScreens.SpeedTest(new SnakeConfig.Rule("7168","Para Tabancasi","boost",10,15)));
        if(age==22){speed=Math.abs(SnakeScreens.smokeSpeedRatio()-10)<.001;grab("speed-test");}
        if(age==25){mc.setScreen(new SnakeScreens.Arena());press("Yilanlar");press("Kazananlar");}
        if(age==30){hidden=!SnakeClient.CONFIG.showSnakes&&!SnakeClient.CONFIG.showWins&&!SnakeConfig.load().showSnakes&&!SnakeConfig.load().showWins;grab("collapsed");}
        if(age==35){press("Yilanlar");press("Kazananlar");}
        if(age==40){mc.setScreen(new SnakeScreens.Widgets());}
        if(age==55){grab("widgets");probeWidget();}
        if(age==62){engine.paused=false;engine.galaxy(7);SnakeCamera.top();}
        if(age==82){galaxySplit=engine.renderSnakes().size()==6&&engine.snakes.size()==2;grab("galaxy-split");}
        if(age==207){galaxyMerged=!engine.galaxyActive()&&engine.renderSnakes().size()==2;grab("galaxy-merged");}
        if(age==210)participationSaved=SnakeScreens.smokeParticipationSave();
        if(age==215)grab("actions-participation");
        if(age==217)press("Begeni / Takip");
        if(age==220)grab("actions-editor");
        if(age==225){
            engine.paused=true;showWeave=true;
            for(int i=0;i<=240;i++){double t=-Math.PI*.5+i*Math.PI*2/240;weavePath.add(new ArenaEngine.Point(80+15*Math.sin(t),80+12*Math.sin(t)*Math.cos(t)));}
            SnakeCamera.top();SnakeCamera.fly();
            var view=ArenaSpace.lookAt(105,ArenaSpace.SURFACE_Y+24,52,80,ArenaSpace.SURFACE_Y+2,80);
            SnakeCamera.position(view.x(),view.y(),view.z(),view.yaw(),view.pitch());
        }
        if(age==235)grab("self-overpass");
        if(age==240){showWeave=false;SnakeCamera.top();}
        if(age==245){
            engine.reset();engine.restoreWins(List.of());engine.demo=true;engine.minimumPlayers=2;engine.paused=false;engine.started=true;
            chaseHunter=engine.join("qa-chase","MaviYilan","",38630);var prey=engine.join("qa-prey","Kaptan","",39);
            chaseHunter.x=8;chaseHunter.z=0;chaseHunter.angle=Math.PI/2;prey.x=prey.z=0;
            prey.boostUntil=10000;prey.boostMultiplier=0;chaseHunter.shieldUntil=prey.shieldUntil=0;engine.configure(320);
            SnakeVictory.resetDiagnostics();SnakeAudio.resetWinnerDiagnostics();SnakeCamera.watch(chaseHunter.id);
        }
        if(age>245&&age<400&&victoryAge==0&&!engine.winner.isEmpty()){
            victoryAge=age;chaseCaught=chaseHunter.kills==1&&engine.snakes.size()==1;engine.paused=true;
        }
        if(victoryAge>0&&age==victoryAge+2)lastGulpBeforeWinner=SnakeAudio.playbackDiagnostics().swallowActive()&&SnakeAudio.winnerDiagnostics().submissions()==0;
        if(victoryAge>0&&age==victoryAge+12){
            var d=SnakeVictory.diagnostics();winnerVisible=d.visible()&&d.draws()>0&&d.insideViewport()&&d.winnerId().equals(chaseHunter.id);
            winnerAudio=SnakeAudio.winnerDiagnostics().submissions()==1&&SnakeAudio.winnerDiagnostics().active()&&SnakeAudio.winnerDiagnostics().musicDucked();grab("winner");
        }
        if(victoryAge>0&&age==victoryAge+30)winnerOnce=SnakeVictory.diagnostics().announcements()==1&&SnakeAudio.winnerDiagnostics().submissions()==1&&chaseHunter.wins==1;
        if(age==400){
            engine.reset();engine.started=true;engine.paused=false;var next=engine.join("qa-chase","MaviYilan","",38630);var prey=engine.join("qa-prey","Kaptan","",39);
            next.x=next.z=prey.x=prey.z=0;next.shieldUntil=prey.shieldUntil=0;
        }
        if(age==420){winnerTwice=SnakeVictory.diagnostics().announcements()==2&&SnakeAudio.winnerDiagnostics().submissions()==2&&engine.snakes.size()==1&&engine.snakes.get("qa-chase").wins==2;grab("winner-2x");}
        if(age==440){engine.reset();engine.minimumPlayers=SnakeClient.CONFIG.minimumPlayers;SnakeVictory.reset();SnakeCamera.top();}
        if(age==445){
            SnakeClient.CONFIG.arenaSize=150;SnakeClient.applyConfig();engine.reset();engine.restoreWins(List.of());engine.demo=true;engine.paused=true;
            engine.join("qa-hud","Uzun Isimli Yilan","",5000);engine.join("qa-body","Nehir","",900);engine.join("qa-free","Atlas","",800);
            engine.adjustWin("qa-hud",1);engine.adjustWin("qa-body",2);engine.adjustWin("qa-free",1);SnakeCamera.top();mc.setScreen(new SnakeScreens.Arena());
            state("created");
        }
        if(age==450){
            var state=SnakeScreens.moderationQaState();hudFits=Boolean.TRUE.equals(state.get("textFits"))&&Boolean.TRUE.equals(state.get("nonOverlapping"))&&Boolean.TRUE.equals(state.get("insideViewport"));
            grab("150-controls");state("hud");
        }
        if(age==453){hudPlus=SnakeScreens.moderationQaAction("qa-hud","+")&&engine.snakes.get("qa-hud").wins==2&&SnakeConfig.load().leaderboardWins.stream().anyMatch(w->w.id().equals("qa-hud")&&w.wins()==2);state("plus");}
        if(age==456)winnerFollow=SnakeScreens.moderationQaAction("qa-hud","follow")&&SnakeCamera.followed()!=null&&SnakeCamera.followed().id.equals("qa-hud");
        if(age==459)SnakeCamera.top();
        if(age==464)bodyFollow=SnakeScreens.moderationQaAction("qa-body","body")&&SnakeCamera.followed()!=null&&SnakeCamera.followed().id.equals("qa-body");
        if(age==468){
            long eaten=engine.totalEaten;moderationP=SnakeScreens.moderationQaAction("qa-body","P")&&!engine.snakes.containsKey("qa-body")&&engine.totalEaten==eaten&&engine.winner.isEmpty()&&engine.winners().stream().anyMatch(w->w.id().equals("qa-body")&&w.wins()==2);
        }
        if(age==472){
            SnakeCamera.watch("qa-free");SnakeCamera.fly();long eaten=engine.totalEaten;
            freeModerationP=SnakeScreens.moderationQaAction("qa-free","P")&&!engine.snakes.containsKey("qa-free")&&engine.totalEaten==eaten&&engine.winner.isEmpty();
            mc.setScreen(new SnakeScreens.Scores());
        }
        if(age==480){minusReduces=SnakeScreens.moderationQaAction("qa-hud","-")&&engine.winners().stream().anyMatch(w->w.id().equals("qa-hud")&&w.wins()==1)&&SnakeConfig.load().leaderboardWins.stream().anyMatch(w->w.id().equals("qa-hud")&&w.wins()==1);state("minus-once");}
        if(age==484){minusRemoves=SnakeScreens.moderationQaAction("qa-hud","-")&&engine.winners().stream().noneMatch(w->w.id().equals("qa-hud"))&&SnakeConfig.load().leaderboardWins.stream().noneMatch(w->w.id().equals("qa-hud"));state("minus-zero");}
        if(age==490){engine.reset();engine.started=true;engine.restoreWins(List.of());engine.minimumPlayers=5;engine.paused=false;for(int i=0;i<12;i++)engine.join("demo-"+i,"Yilan "+(i+1),"",200+i*.7).shieldUntil=0;engine.food.clear();SnakeCamera.top();}
        if(age==492)nearMassHunting=engine.snakes.size()==12&&engine.snakes.values().stream().allMatch(s->s.intent.equals("AVLANIYOR")&&!s.preyId.isEmpty());
        if(age==590)grab("near-mass-hunt");
        if(age==600){
            engine.reset();engine.started=true;engine.minimumPlayers=2;engine.paused=false;var smaller=engine.join("qa-small","Kucuk","",200);var bigger=engine.join("qa-large","Buyuk","",209);
            smaller.x=smaller.z=bigger.x=bigger.z=0;smaller.shieldUntil=bigger.shieldUntil=0;
        }
        if(age==602)nearMassCapture=engine.totalEaten>0&&engine.snakes.size()==1;
        if(age==620){
            engine.reset();engine.restoreWins(List.of());engine.paused=true;SnakeClient.CONFIG.arenaSize=150;SnakeClient.applyConfig();mc.getWindow().setWindowed(1600,900);
            engine.join("qa-shield","Korunan Yilan","",300);engine.join("qa-other","Rakip","",250);SnakeCamera.top();
        }
        if(age==625){
            var state=SnakeScreens.moderationQaState();cleanHud=Boolean.FALSE.equals(state.get("topBand"))&&Boolean.FALSE.equals(state.get("demoStatusBox"))&&((Number)state.get("hudTopCommands")).intValue()==0&&((Number)state.get("hudCameraButtons")).intValue()==3;
            shieldVisible=!SnakeLabels.shieldBadges.isEmpty()&&SnakeLabels.shieldTextFits;grab("clean-shield");
        }
        if(age==628)mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_B,0,0);
        if(age==630){bPanel=Boolean.TRUE.equals(SnakeScreens.moderationQaState().get("panelOpen"));grab("b-panel");}
        if(age==632){mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_B,0,0);bReturns=mc.screen instanceof SnakeScreens.Arena;}
        if(age==634){SnakeCamera.fly();SnakeScreens.togglePanel();freePanel="free".equals(SnakeScreens.moderationQaState().get("panelReturn"));}
        if(age==636){mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_B,0,0);freePanel&=mc.screen==null&&SnakeCamera.free;SnakeCamera.top();}
        if(age==640){
            engine.reset();engine.restoreWins(List.of());engine.paused=false;engine.minimumPlayers=2;
            mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_SPACE,0,0);spaceIgnored=engine.snakes.isEmpty();
            mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_TAB,0,0);
            broadcaster=engine.snakes.get(SnakePlayer.id());tabJoin=broadcaster!=null&&broadcaster.mass==300&&engine.snakes.size()==1;
            tabDoesNotStart=!engine.started&&engine.battleCountdownRemaining()<=0;
            mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_TAB,0,0);tabReusesSnake=engine.snakes.size()==1&&engine.snakes.get(SnakePlayer.id())==broadcaster;
            SnakeCamera.top();broadcaster.x=broadcaster.z=0;broadcaster.angle=Math.PI/2;engine.configure(150);engine.food.clear();playerX=broadcaster.x;playerZ=broadcaster.z;SnakePlayer.qaInput(1,0);
        }
        if(age==660){wasd=broadcaster.z>playerZ+4&&Math.abs(broadcaster.x-playerX)<.2;SnakePlayer.qaInput(0,0);playerX=broadcaster.x;playerZ=broadcaster.z;}
        if(age==665){releaseStops=Math.hypot(broadcaster.x-playerX,broadcaster.z-playerZ)<1e-8;SnakePlayer.grow(100);}
        if(age==686){selfGrowth=broadcaster.mass==400;foodBefore=engine.totalFoodEaten;engine.food.add(new ArenaEngine.Point(broadcaster.x,broadcaster.z));}
        if(age==690){nativeFood=broadcaster.mass==405&&engine.totalFoodEaten==foodBefore+1;SnakePlayer.clearQaInput();grab("publisher");}
        if(age==695){
            engine.reset();engine.paused=false;engine.minimumPlayers=2;engine.join("qa-group","Paralel Yilan","",5000).shieldUntil=engine.time+1000;engine.join("qa-group2","Paralel Iki","",300).shieldUntil=engine.time+1000;
            engine.galaxy(7,4);SnakeCamera.top();
        }
        if(age==715){parallelFour=engine.snakes.size()==2&&engine.renderSnakes().size()==8;grab("galaxy-parallel-four");}
        if(age==840){mergedFour=!engine.galaxyActive()&&engine.renderSnakes().size()==2;state("four-parts-merged");}
        if(age==845||age==870){
            engine.reset();engine.started=true;engine.restoreWins(List.of());engine.paused=false;engine.minimumPlayers=2;engine.survivorDelaySeconds=10;
            var a=engine.join("qa-last","Son Yilan","",300);var b=engine.join("qa-last-prey","Rakip","",250);a.x=a.z=b.x=b.z=0;a.shieldUntil=b.shieldUntil=0;engine.configure(150);engine.food.clear();
            SnakeVictory.resetDiagnostics();SnakeAudio.resetWinnerDiagnostics();SnakeCamera.top();
        }
        if(age==850){countdownVisible=engine.winner.isEmpty()&&engine.survivorRemaining()>9&&Boolean.TRUE.equals(SnakeScreens.moderationQaState().get("countdownDrawn"));grab("survivor-countdown");}
        if(age==865){engine.paused=true;engine.join("qa-arrival","Yeni Katilan","",300);}
        if(age==868)countdownCanceled=engine.survivorRemaining()<0&&engine.winner.isEmpty()&&Boolean.FALSE.equals(SnakeScreens.moderationQaState().get("countdownDrawn"));
        if(age==1055){noEarlyWinner=engine.winner.isEmpty()&&engine.winners().isEmpty()&&engine.survivorRemaining()>0;state("before-delayed-winner");}
        if(age==1080){var d=SnakeVictory.diagnostics();delayedWinner=!engine.winner.isEmpty()&&engine.winners().size()==1&&d.visible()&&d.insideViewport()&&d.avatarPixels()>=96&&d.announcements()==1&&SnakeAudio.winnerDiagnostics().submissions()==1;state("delayed-winner");grab("round-winner");}
        if(age==1105){
            engine.reset();engine.restoreWins(List.of());engine.demo=true;engine.paused=false;SnakeCamera.top();
            emptyReset=engine.snakes.isEmpty()&&!engine.started;
            mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_TAB,0,0);broadcaster=engine.snakes.get(SnakePlayer.id());
            selfCamera=SnakePlayer.watchingSelf()&&SnakeCamera.followed()==broadcaster&&broadcaster.mass==300;
        }
        if(age>=1105&&age<1130)engine.food.clear();
        if(age==1108){
            var arena=(SnakeScreens.Arena)mc.screen;double x=arena.width/2.0,y=arena.height/2.0;
            for(int i=0;i<3;i++){arena.mouseClicked(x,y,org.lwjgl.glfw.GLFW.GLFW_MOUSE_BUTTON_RIGHT);arena.mouseReleased(x,y,org.lwjgl.glfw.GLFW.GLFW_MOUSE_BUTTON_RIGHT);}
            SnakeFeedingVisuals.resetDiagnostics();
        }
        if(age==1115){smallPortraitStream=SnakeFeedingVisuals.streamDiagnostics().maxParticlesPerFeed()>1&&SnakeFeedingVisuals.streamDiagnostics().lastHalfSize()<=.42;grab("small-portrait-stream");}
        if(age==1128){rightClickTen=broadcaster.mass==330&&!SnakeCamera.rightZooming();inputHud=SnakeScreens.inputHudSelfChecks().values().stream().allMatch(Boolean::booleanValue);state("self-camera-and-right-click");grab("publisher-self-camera");}
        if(age==1130){
            engine.reset();engine.demo=true;engine.paused=false;SnakeCamera.top();waitingEaten=engine.totalEaten;
            engine.join("qa-manual-a","Bekleyen Bir","",300).shieldUntil=engine.time+1000;
            engine.join("qa-manual-b","Bekleyen Iki","",250).shieldUntil=engine.time+1000;
        }
        if(age==1134){waitingNoCombat=!engine.started&&engine.totalEaten==waitingEaten;mc.screen.keyPressed(org.lwjgl.glfw.GLFW.GLFW_KEY_O,0,0);}
        if(age==1140){oCountdown=engine.battleCountdownRemaining()>9&&Boolean.TRUE.equals(SnakeScreens.moderationQaState().get("battleCountdownDrawn"));grab("o-start-countdown");}
        if(age==1332)oNoEarlyBattle=!engine.started&&engine.battleCountdownRemaining()>0;
        if(age==1336){oBattleStarted=engine.started&&engine.battleAnnouncementRemaining()>0&&Boolean.TRUE.equals(SnakeScreens.moderationQaState().get("battleAnnouncementDrawn"));grab("battle-start");}
        if(age==1340){
            engine.reset();engine.demo=true;engine.paused=false;
            for(int i=0;i<3;i++){var s=engine.join("qa-trail-"+i,(i==0?"3x":i==1?"5x":"10x"),"",1000+i*1000);s.x=(i-1)*25;s.z=0;s.shieldUntil=engine.time+1000;engine.action(s.id,s.name,"","boost",i==0?3:i==1?5:10,10);}
            engine.configure(150);SnakeCamera.top();SnakeBoostVisuals.resetDiagnostics();SnakeCrownVisuals.resetDiagnostics();
        }
        if(age==1350){var d=SnakeBoostVisuals.diagnostics();trails=d.tier3Quads()>0&&d.tier5Quads()>0&&d.tier10Quads()>0&&d.quads()<=SnakeBoostVisuals.MAX_QUADS;var c=SnakeCrownVisuals.diagnostics();crown=c.crownsDrawn()==1&&c.ownerId().equals("qa-trail-2");grab("boost-trails-and-crown");}
        if(age==1360){engine.galaxy(7,4);SnakeCamera.top();}
        if(age==1365){var owner=engine.snakes.get("qa-trail-2");var pieces=engine.renderSnakes().stream().filter(s->s.ownerId.equals(owner.id)).toList();unequalParts=pieces.size()==4&&pieces.stream().map(s->s.mass).distinct().count()==4;var c=SnakeCrownVisuals.diagnostics();crown&=c.crownsDrawn()==1&&c.ownerId().equals(owner.id)&&!c.headId().equals(owner.id);grab("unequal-galaxy-crown");}
        if(age==1390){
            if(Boolean.getBoolean("tikmng.snake.largeQa")){SnakeClient.CONFIG.arenaSize=1000;SnakeClient.applyConfig();engine.seedDemo();engine.paused=true;SnakeCamera.top();}
            else finish();
        }
        if(age>1390&&Boolean.getBoolean("tikmng.snake.largeQa")&&SnakeMod.ready){
            if(++largeAge==1){engine.seedDemo();engine.paused=true;SnakeCamera.top();}
            if(largeAge==100){large=engine.size==1000&&!SnakeCamera.free&&!SnakeCamera.following()&&SnakeLabels.centerError<1&&SnakeLabels.visible>0;grab("1000");}
            if(largeAge>110)finish();
        }
    }
    private static void press(String needle){var screen=Minecraft.getInstance().screen;screen.children().stream().filter(w->w instanceof Button b&&b.getMessage().getString().contains(needle)).map(w->(Button)w).findFirst().orElseThrow().onPress();}
    private static void probeWidget(){
        String url="http://127.0.0.1:"+Integer.getInteger("mng.snake.widget.port",0)+"/api/widget/state?key="+System.getProperty("mng.snake.widget.key","");
        HttpClient.newHttpClient().sendAsync(HttpRequest.newBuilder(URI.create(url)).GET().build(),HttpResponse.BodyHandlers.ofString()).whenComplete((r,e)->Minecraft.getInstance().execute(()->{
            if(e==null)try{var json=JsonParser.parseString(r.body()).getAsJsonObject();widgetState=json.getAsJsonArray("snakes").size()==2&&json.getAsJsonArray("winners").get(0).getAsJsonObject().get("wins").getAsInt()==2;}catch(Exception ignored){}
        }));
    }
    private static void finish(){
        boolean passed=previousPassed&&hidden&&speed&&persisted&&widgetState&&galaxySplit&&galaxyMerged&&participationSaved&&weaveRendered&&chaseCaught&&winnerVisible&&winnerAudio&&winnerOnce&&winnerTwice&&lastGulpBeforeWinner&&hudPlus&&winnerFollow&&bodyFollow&&moderationP&&freeModerationP&&minusReduces&&minusRemoves&&hudFits&&nearMassHunting&&nearMassCapture&&cleanHud&&shieldVisible&&bPanel&&bReturns&&freePanel&&tabJoin&&spaceIgnored&&tabDoesNotStart&&tabReusesSnake&&wasd&&releaseStops&&selfGrowth&&nativeFood&&parallelFour&&mergedFour&&countdownVisible&&countdownCanceled&&noEarlyWinner&&delayedWinner&&(!Boolean.getBoolean("tikmng.snake.largeQa")||large);
        passed&=emptyReset&&selfCamera&&rightClickTen&&waitingNoCombat&&oCountdown&&oNoEarlyBattle&&oBattleStarted&&inputHud&&trails&&crown&&unequalParts&&smallPortraitStream;
        JsonObject report=new JsonObject();report.addProperty("passed",passed);report.addProperty("collapsedLists",hidden);report.addProperty("speed10x",speed);report.addProperty("winsPersisted",persisted);report.addProperty("nativeWidgetState",widgetState);report.addProperty("large1000Tested",Boolean.getBoolean("tikmng.snake.largeQa"));report.addProperty("large1000Visible",large);
        report.addProperty("galaxySplit",galaxySplit);report.addProperty("galaxyMerged",galaxyMerged);
        report.addProperty("emptyRoundReset",emptyReset);report.addProperty("tabWatchesSelf",selfCamera);report.addProperty("spaceIgnored",spaceIgnored);report.addProperty("tabDoesNotStartBattle",tabDoesNotStart);report.addProperty("tabReusesSnake",tabReusesSnake);report.addProperty("rightClickTenEach",rightClickTen);report.addProperty("waitingNoCombat",waitingNoCombat);report.addProperty("oCountdown",oCountdown);report.addProperty("oNoEarlyBattle",oNoEarlyBattle);report.addProperty("oBattleStarted",oBattleStarted);report.addProperty("inputHud",inputHud);report.addProperty("threeSpeedTrails",trails);report.addProperty("oneLeaderCrown",crown);report.addProperty("unequalGalaxyParts",unequalParts);report.addProperty("smallPortraitStream",smallPortraitStream);
        report.addProperty("actionsParticipationSavedAndApplied",participationSaved);report.addProperty("selfOverpassRendered",weaveRendered);
        report.addProperty("chaseCaughtActualPrey",chaseCaught);report.addProperty("winnerVisible",winnerVisible);report.addProperty("winnerAudioActive",winnerAudio);report.addProperty("winnerAnnouncedOnce",winnerOnce);report.addProperty("winnerRearmedNextRound",winnerTwice);
        report.addProperty("lastGulpBeforeWinner",lastGulpBeforeWinner);
        report.addProperty("cleanHud",cleanHud);report.addProperty("shieldIconAndSeconds",shieldVisible);report.addProperty("bPanelOpens",bPanel);report.addProperty("bPanelReturns",bReturns);report.addProperty("freeFlightPanelReturns",freePanel);report.addProperty("tabJoinsAt300",tabJoin);report.addProperty("wasdMoves",wasd);report.addProperty("releasedWasdStops",releaseStops);report.addProperty("selfGrowthCredit",selfGrowth);report.addProperty("foodExactly5",nativeFood);report.addProperty("parallelFourParts",parallelFour);report.addProperty("fourPartsMerge",mergedFour);report.addProperty("countdownVisible",countdownVisible);report.addProperty("arrivalCancelsCountdown",countdownCanceled);report.addProperty("noEarlyWinner",noEarlyWinner);report.addProperty("delayedLargeRoundWinner",delayedWinner);
        report.addProperty("minusDecrementsOne",minusReduces);
        report.addProperty("hudPlusSaves",hudPlus);report.addProperty("winnerNameFollows",winnerFollow);report.addProperty("bodyClickFollows",bodyFollow);report.addProperty("selectedPRemovesWithoutWin",moderationP);report.addProperty("freeFlightPRemovesWithoutWin",freeModerationP);report.addProperty("minusRemovesEntireEntry",minusRemoves);report.addProperty("hudFits",hudFits);report.addProperty("nearMassAllHunt",nearMassHunting);report.addProperty("nearMassActualCapture",nearMassCapture);
        try{Files.writeString(Minecraft.getInstance().gameDirectory.toPath().resolve("feature-check.json"),report.toString());Files.writeString(Minecraft.getInstance().gameDirectory.toPath().resolve("moderation-check.json"),moderationStates.toString());}catch(Exception e){throw new IllegalStateException(e);}
        SnakeClient.CONFIG.arenaSize=150;SnakeClient.CONFIG.leaderboardWins=new ArrayList<>();SnakeClient.CONFIG.save();
        System.out.println("MNG_SNAKE_FEATURES passed="+passed+" collapsed="+hidden+" speed="+speed+" wins="+persisted+" widget="+widgetState+" large="+large);
        Minecraft.getInstance().stop();
    }
}
