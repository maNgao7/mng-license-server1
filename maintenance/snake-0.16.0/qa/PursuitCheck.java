import com.tikmng.snake.ArenaEngine;

public class PursuitCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    public static void main(String[] args){
        var e=new ArenaEngine(101);startBattle(e);e.configure(1000);e.minimumPlayers=2;
        var big=e.join("big","Big","",5000);var middle=e.join("middle","Middle","",1000);var tiny=e.join("tiny","Tiny","",10);
        big.x=-10;big.z=0;middle.x=0;middle.z=0;tiny.x=180;tiny.z=0;
        middle.angle=0;big.shieldUntil=middle.shieldUntil=tiny.shieldUntil=1000;
        e.tick(.01);
        check(middle.intent.equals("AVLANIYOR")&&middle.preyId.equals("tiny"),"nearby predator does not cancel pursuit of smaller prey");
        check(big.intent.equals("AVLANIYOR"),"largest hunts");
        e=new ArenaEngine(102);startBattle(e);e.configure(1000);e.minimumPlayers=2;
        big=e.join("giant","Giant","",1000000);tiny=e.join("tiny","Tiny","",10);big.x=-400;big.z=0;big.angle=0;tiny.x=400;tiny.z=0;
        e.tick(.01);check(big.preyId.equals("tiny")&&big.intent.equals("AVLANIYOR"),"no minimum prey mass or hunt distance");
        check(tiny.speed(e.time)>big.speed(e.time),"small snake retains speed advantage");
        for(int i=0;i<30;i++){e.tick(.01);check(big.preyId.equals("tiny"),"pursuit target retained");}
        e=new ArenaEngine(103);startBattle(e);e.configure(1000);e.minimumPlayers=2;
        big=e.join("big","Big","",1500);tiny=e.join("tiny","Tiny","",100);big.x=-8;big.z=0;tiny.x=0;tiny.z=0;
        e.tick(.01);check(tiny.intent.equals("KACIYOR")&&tiny.preyId.isEmpty(),"snake with no smaller prey can escape");
        e=new ArenaEngine(104);e.configure(320);e.seedDemo();startBattle(e);
        final var arena=e;
        for(int i=0;i<1200;i++){
            var eligible=e.snakes.values().stream().filter(s->arena.snakes.values().stream().anyMatch(other->other!=s&&ArenaEngine.canEatMass(s.mass,other.mass))).toList();
            int round=e.round;
            e.tick(.05);
            for(var s:eligible)if(e.round==round&&e.started&&e.snakes.containsKey(s.id))
                check(s.intent.equals("AVLANIYOR"),"all eligible hunters pursue during simulation");
        }
        System.out.println("Pursuit checks passed: "+checks);
    }
}
