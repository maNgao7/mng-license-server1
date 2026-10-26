import com.tikmng.snake.ArenaEngine;
import com.tikmng.snake.ArenaRules;
import java.util.*;

public class NearMassCombatCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private static void boundary(){
        for(double difference:new double[]{0,1,9,49,50}){
            check(ArenaEngine.canEatMass(200,200+difference),"smaller may fight at delta "+difference);
            check(ArenaEngine.canEatMass(200+difference,200),"larger may fight at delta "+difference);
        }
        for(double difference:new double[]{50.01,51,100,100000}){
            check(!ArenaEngine.canEatMass(200,200+difference),"smaller cannot eat above 50");
            check(ArenaEngine.canEatMass(200+difference,200),"larger can hunt above 50");
        }
        check(!ArenaEngine.canEatMass(Double.NaN,200)&&!ArenaEngine.canEatMass(200,Double.POSITIVE_INFINITY),"nonfinite mass denied");
        for(double difference:new double[]{0,1,50,51}){
            var e=new ArenaEngine(71);startBattle(e);e.configure(150);e.minimumPlayers=2;
            var small=e.join("small","Small","",200);var large=e.join("large","Large","",200+difference);
            small.x=-1.8;small.z=0;small.angle=0;large.x=large.z=0;large.angle=0;e.configure(150);
            small.shieldUntil=large.shieldUntil=0;e.food.clear();e.tick(.001);
            if(difference<=50)check(small.kills==1&&!e.snakes.containsKey("large"),"smaller's head attack works at delta "+difference);
            else check(e.snakes.containsKey("large")&&small.intent.equals("KACIYOR"),"delta51 small escapes and cannot consume");
        }
    }
    private static void equalRounds(){
        for(int seed=1;seed<=5;seed++){
            var e=new ArenaEngine(seed);startBattle(e);e.survivorDelaySeconds=0;e.configure(150);e.minimumPlayers=2;e.rules.protectionSeconds=0;
            for(int i=0;i<12;i++)e.join("p"+i,"P"+i,"",200+i*.7);
            int hunting=0;
            for(int tick=0;tick<1200;tick++){
                e.tick(.05);
                if(tick==0)for(var s:e.snakes.values())if(s.intent.equals("AVLANIYOR"))hunting++;
                for(var s:e.snakes.values())check(Double.isFinite(s.x)&&Math.hypot(s.x,s.z)+s.radius()+1<=75.000001,"150 circle stays bounded");
            }
            System.out.println("Equal-mass seed="+seed+" initiallyHunting="+hunting+" eaten="+e.totalEaten+" wins="+e.winners().stream().mapToInt(ArenaEngine.Winner::wins).sum());
            check(hunting>=10,"200..209 mass participants actually select opponents");
            check(e.totalEaten>=3,"near equal participants make real head captures, not just intent text");
            if(e.winners().stream().noneMatch(w->w.wins()>0)){
                var leader=e.snakes.values().stream().max(Comparator.comparingDouble(s->s.mass)).orElseThrow();e.action(leader.id,leader.name,"","boost",10,30);
                for(int tick=0;tick<600&&e.winners().stream().noneMatch(w->w.wins()>0);tick++)e.tick(.05);
            }
            check(e.winners().stream().anyMatch(w->w.wins()>0),"speed gift lets remaining hunter finish the round");
        }
    }
    private static void moderation(){
        var e=new ArenaEngine(11);var a=e.join("a","A","",300);e.join("b","B","",250);e.join("c","C","",250);
        e.adjustWin(a.id,3);e.adjustWin(a.id,-1);check(a.wins==2,"minus reduces 3x to 2x");e.adjustWin(a.id,-1);check(a.wins==1,"minus reduces 2x to 1x");e.adjustWin(a.id,-1);check(a.wins==0&&e.winners().isEmpty(),"minus removes entry only at zero");
        e.adjustWin(a.id,1);check(a.wins==1,"plus recreates removed winner at 1x");e.adjustWin(a.id,1);check(a.wins==2,"plus increments to2x");
        e.gift(a.id,a.name,"",1,1);long feeds=e.totalFeedings;
        check(e.removeSnake(" A ")&&!e.snakes.containsKey("a")&&e.feedings.isEmpty(),"P removal clears participant and pending profile food");
        check(e.winner.isEmpty()&&e.winners().get(0).wins()==2,"moderation neither awards nor deletes earned wins");
        for(int i=0;i<22;i++)e.tick(.05);check(e.totalFeedings==feeds,"deleted feeding does not trigger growth credit");
        check(!e.removeSnake("missing"),"unknown deletion safe");
    }
    private static void defaults(){
        var r=new ArenaRules();check(r.arenaSize==150&&r.followMass==300&&r.likeEntryMass==250&&r.likesPerJoin==100,"requested entry defaults");
        for(int coins:new int[]{1,5,49,50,99,100,499,500,999,1000})check(r.giftMass(coins,3)==Math.round(coins*25*r.multiplier(coins))*3,"25 per coin with configured multiplier and combo");
    }
    public static void main(String[] args){boundary();equalRounds();moderation();defaults();System.out.println("Near-mass combat checks passed: "+checks);}
}
