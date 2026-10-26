import com.tikmng.snake.ArenaEngine;

public class BiteCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private record Fixture(ArenaEngine engine,ArenaEngine.Snake hunter,ArenaEngine.Snake prey){}
    private static Fixture fixture(double fraction){
        var e=new ArenaEngine(53);startBattle(e);e.survivorDelaySeconds=0;e.configure(160);e.minimumPlayers=2;
        var prey=e.join("prey","Prey","photo",900);var hunter=e.join("hunter","Hunter","",3000);
        prey.x=0;prey.z=0;prey.angle=0;hunter.x=60;hunter.z=60;e.configure(160);
        var body=prey.body();var hit=body.get((int)((body.size()-1)*fraction));
        hunter.angle=Math.PI/2;hunter.x=hit.x();hunter.z=hit.z()-hunter.radius()*.8;
        e.configure(160);
        hunter.shieldUntil=prey.shieldUntil=0;e.food.clear();return new Fixture(e,hunter,prey);
    }
    public static void main(String[] args){
        for(double fraction:new double[]{.35,.65,.9}){
            var f=fixture(fraction);var e=f.engine;var prey=f.prey;var hunter=f.hunter;
            double mass=prey.mass,length=prey.length(),x=prey.x,z=prey.z,gain=hunter.mass;
            e.tick(.000001);
            check(e.snakes.get("prey")==prey,"tail bite preserves viewer "+fraction);
            check(prey.mass<mass&&prey.mass>=10,"only cut mass lost "+fraction);
            check(prey.length()<length&&Math.abs(prey.length()/length-fraction)<.03,"cut exactly at bite "+fraction);
            check(Math.hypot(prey.x-x,prey.z-z)<.001,"head does not teleport "+fraction);
            check(e.totalEaten==0&&hunter.kills==0&&e.totalTailBites==1&&e.winner.isEmpty(),"no kill or win for tail "+fraction);
            check(Math.abs((hunter.mass-gain)-(mass-prey.mass)*1.2)<.001,"only removed mass transferred "+fraction);
            check(prey.profile.equals("photo"),"viewer profile retained "+fraction);
            check(e.meals.size()==1&&!e.meals.get(0).whole(),"tail fragment has no second head "+fraction);
            var fragment=e.meals.get(0);var frozen=fragment.body().get(0);
            double bittenMass=prey.mass;
            for(int i=0;i<5;i++)e.tick(.05);
            check(e.totalTailBites==1&&prey.mass>=bittenMass,"contact cooldown "+fraction);
            check(fragment.body().get(0).equals(frozen),"fragment does not follow live victim "+fraction);
            check(prey.length()<length*.96,"cut tail does not grow back next tick "+fraction);
            double shortLength=prey.length();e.action("prey","Prey","photo","grow",900,0);
            for(int i=0;i<8;i++)e.tick(.05);
            check(prey.length()>shortLength,"gift growth after cut "+fraction);
        }
        var f=fixture(.65);var e=f.engine;var prey=f.prey;var hunter=f.hunter;
        e.tick(.000001);e.time+=1;
        hunter.x=prey.x-hunter.radius()*.8;hunter.z=prey.z;hunter.angle=0;
        e.tick(.000001);
        check(!e.snakes.containsKey("prey")&&hunter.kills==1&&e.totalEaten==1,"only head bite eliminates");
        check(e.meals.get(e.meals.size()-1).whole(),"whole snake swallowed after head catch");
        check(e.winner.equals("Hunter"),"head elimination awards win");
        f=fixture(.65);e=f.engine;prey=f.prey;hunter=f.hunter;
        prey.shieldUntil=e.time+10;double protectedMass=prey.mass;e.tick(.001);
        check(prey.mass==protectedMass&&e.totalTailBites==0&&e.totalEaten==0,"shield blocks body and head damage");
        e=new ArenaEngine(71);startBattle(e);e.configure(160);e.minimumPlayers=2;
        hunter=e.join("hunter","Hunter","",1500);prey=e.join("prey","Prey","",200);
        hunter.x=0;hunter.z=0;hunter.angle=0;prey.x=30;prey.z=0;prey.angle=Math.PI/2;e.configure(160);
        e.tick(.01);check(hunter.angle>0&&hunter.preyId.equals("prey"),"hunt predicts head rather than trailing tail");
        check(hunter.speed(0)>6&&prey.speed(0)>10,"base pace increased");
        check(prey.speed(0)>hunter.speed(0),"small snakes keep speed advantage");
        e.action("prey","Prey","","boost",5,2);double boosted=prey.speed(e.time);
        check(boosted>50&&prey.speed(e.time+3)<boosted,"boost remains fast and expires");
        for(int i=0;i<300;i++)e.tick(.05);
        for(var s:e.snakes.values()){
            check(Double.isFinite(s.mass)&&s.mass>=10&&s.length()>=2.5,"finite mass and body length");
            for(var p:s.body(.5))check(Double.isFinite(p.x())&&Double.isFinite(p.z()),"finite interpolated shortened body");
        }
        System.out.println("Bite checks passed: "+checks);
    }
}
