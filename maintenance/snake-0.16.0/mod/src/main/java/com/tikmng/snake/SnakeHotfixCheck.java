package com.tikmng.snake;

import java.util.*;
import java.nio.file.*;
import com.google.gson.GsonBuilder;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;

/** Runs only in a separate explicitly selected QA game instance. */
final class SnakeHotfixCheck {
    private static final Map<String,Object> checks=new LinkedHashMap<>();
    private static final List<Object> tiers=new ArrayList<>();
    private static ArenaEngine.Snake runner;
    private static double before;
    private static long captures;
    private static long foodBefore,feedBefore;
    private static SnakeDiagnostics lab;
    private static void grab(String name){var mc=Minecraft.getInstance();Screenshot.grab(mc.gameDirectory,"v016-"+name+".png",mc.getMainRenderTarget(),m->{});}
    static void start(){SnakeClient.CONFIG.arenaSize=150;SnakeClient.applyConfig();}
    static void tick(int age){
        var mc=Minecraft.getInstance();var e=SnakeClient.ENGINE;
        if(age==1){e.reset();e.demo=true;e.paused=false;e.configure(150);runner=e.join("qa-runner","Hiz Testi","",1000);runner.shieldUntil=100000;SnakeCamera.watch(runner.id);}
        if(age==8||age==48||age==88){int tier=age==8?3:age==48?5:10;e.action(runner.id,runner.name,"","boost",tier,7);}
        if(age==28||age==68||age==108){
            int tier=age==28?3:age==68?5:10;var d=SnakeBoostVisuals.diagnostics();
            checks.put("trail"+tier,d.quads()>0&&d.renderedSnakes()>0&&runner.measuredSpeed()>0);
            tiers.add(Map.of("tier",tier,"speed",runner.measuredSpeed(),"target",runner.speed(e.time),"quads",d.quads()));grab("trail-"+tier);
        }
        if(age==125){e.reset();runner=e.join("qa-growth","Buyume Testi","",300);runner.shieldUntil=100000;SnakeCamera.watch(runner.id);before=runner.mass;foodBefore=e.totalFoodEaten;feedBefore=e.totalFeedings;e.gift(runner.id,runner.name,"",100,1);}
        if(age==135){checks.put("portraitFeed",SnakeFeedingVisuals.diagnostics().portraitDraws()>0);grab("feeding");}
        if(age==146){checks.put("growthCredit",runner.mass==before+e.rules.giftMass(100,1)+(e.totalFoodEaten-foodBefore)*5&&e.totalFeedings==feedBefore+1&&runner.growthAmount==e.rules.giftMass(100,1));grab("growth");}
        if(age==154)SnakeScreens.togglePanel();
        if(age==156){checks.put("bPanel",mc.screen!=null&&mc.screen.getTitle().getString().equals("Arena menusu"));grab("b-panel");}
        if(age==158){lab=new SnakeDiagnostics(mc.screen);mc.setScreen(lab);lab.qaRun("boost",5);}
        if(age==178){var d=SnakeDiagnostics.diagnostics();checks.put("realTargetMeasured",((Number)d.get("speed")).doubleValue()>0&&((Number)d.get("distance")).doubleValue()>0);grab("laboratory");lab.qaRun("grow",100);before=runner.mass;foodBefore=e.totalFoodEaten;}
        if(age==201){checks.put("labGrowth",runner.mass==before+e.rules.giftMass(100,1)+(e.totalFoodEaten-foodBefore)*5);grab("lab-growth");}
        if(age==205){mc.getWindow().setWindowed(1000,600);}
        if(age==212){grab("laboratory-small");}
        if(age==218){mc.getWindow().setWindowed(1600,900);mc.setScreen(new SnakeScreens.Arena());e.reset();e.started=true;e.demo=true;e.rules.protectionSeconds=0;
            for(int i=0;i<12;i++)e.join("qa-player-"+i,"Oyuncu "+(i+1),"",i%2==0?300:250);captures=e.totalEaten;SnakeCamera.top();}
        if(age==223)checks.put("eligiblePursue",e.snakes.values().stream().allMatch(s->{boolean hasPrey=e.snakes.values().stream().anyMatch(other->other!=s&&ArenaEngine.canEatMass(s.mass,other.mass));return !hasPrey||s.intent.equals("AVLANIYOR");}));
        if(age==320)grab("real-pursuit");
        if(age==645){checks.put("naturalHeadCaptures",e.totalEaten-captures>=3);checks.put("headCaptureCount",e.totalEaten-captures>=3);}
        if(age==650)SnakeLive.connect("siilaaoo");
        if(age==1260)grab("live-profiles");
        if(age==1300){
            checks.put("rendered",SnakeBoostVisuals.diagnostics().frames()>0);
            boolean passed=checks.values().stream().allMatch(Boolean.TRUE::equals);
            var result=new LinkedHashMap<String,Object>();result.put("passed",passed);result.put("checks",checks);result.put("speedTiers",tiers);result.put("headCaptures",e.totalEaten-captures);result.put("liveEvents",SnakeLive.eventCount);result.put("liveGifts",SnakeLive.giftCount);result.put("liveStatus",SnakeLive.status);result.put("avatars",e.snakes.values().stream().limit(96).map(s->SnakeAvatars.diagnostics(s.id)).toList());
            try{Files.writeString(mc.gameDirectory.toPath().resolve("hotfix-check.json"),new GsonBuilder().setPrettyPrinting().create().toJson(result));}catch(Exception ex){throw new RuntimeException(ex);}
            System.out.println("MNG_SNAKE_FEATURES passed="+passed+" hotfix016=true");mc.stop();
        }
    }
}
