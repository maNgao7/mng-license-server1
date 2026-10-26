import com.tikmng.snake.ArenaEngine;

public class ArenaCheck {
    private static int checks;
    private static void check(boolean condition,String label){checks++;if(!condition)throw new AssertionError(label);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    public static void main(String[] args){
        ArenaEngine e=new ArenaEngine(7);e.configure(48);check(e.size==48,"adjustable size");e.configure(1);check(e.size==32,"lower bound");e.configure(1001);check(e.size==1000,"upper bound");
        var small=e.join("A","A","",100);var large=e.join("B","B","",800);
        check(small.speed(0)>large.speed(0),"small faster");check(large.radius()>small.radius(),"large physically larger");
        check(e.join("a","again","",999)==small,"stable viewer identity");
        e.action("A","A","","boost",2,10);check(small.speed(0)>large.speed(0)*2,"boost");check(small.speed(11)<small.speed(0),"boost expiry");
        check(e.accept("dispatch-1")&&!e.accept("dispatch-1"),"dispatch dedup");check(!e.accept(""),"missing dispatch rejected");
        check(e.addLikes("Viewer",99,100)==0&&e.addLikes("Viewer",1,100)==1,"likes remainder");check(e.addLikes("Viewer",250,100)==2,"multiple like batches");
        e.configure(32);e.minimumPlayers=2;
        for(int i=0;i<400;i++)e.tick(.05);
        for(var snake:e.snakes.values()){
            check(Math.abs(snake.x)<=16-snake.radius()-1+1e-6&&Math.abs(snake.z)<=16-snake.radius()-1+1e-6,"bounded snake");check(snake.body().size()>5,"segmented body");
            var before=snake.body(0).get(0);var after=snake.body(1).get(0);var mid=snake.body(.5).get(0);
            check(Math.abs(mid.x()-(before.x()+after.x())/2)<.01&&Math.abs(mid.z()-(before.z()+after.z())/2)<.01,"continuous render interpolation");
            for(var p:snake.body(.7))check(Double.isFinite(p.x())&&Double.isFinite(p.z()),"finite body samples");
        }
        e.reset();startBattle(e);e.survivorDelaySeconds=0;e.minimumPlayers=2;small=e.join("small","Small","",100);large=e.join("large","Large","",500);
        small.x=large.x=0;small.z=large.z=0;small.shieldUntil=large.shieldUntil=0;e.tick(.001);
        check(e.snakes.size()==1,"predation");check(large.kills==1,"kill counted");check(large.mass>=620,"victim mass transferred");check(e.winner.equals("Large"),"winner");
        for(int i=0;i<162;i++)e.tick(.05);check(e.snakes.size()==2&&e.winner.isBlank(),"round restores both players");
        e.seedDemo();check(e.snakes.size()==12&&e.demo,"demo entrants");e.clearDemo();check(e.snakes.isEmpty()&&!e.demo,"demo removed for live");
        e.join("a","A","",100);double before=e.time;e.paused=true;e.tick(.05);check(e.time==before,"pause");
        ArenaEngine skins=new ArenaEngine(21);java.util.Set<Integer> assigned=new java.util.HashSet<>();
        for(int i=0;i<96;i++)check(assigned.add(skins.join("viewer-"+i,"V"+i,"",200).skin),"unique skin");
        var huge=new ArenaEngine(8);huge.minimumPlayers=2;var giant=huge.join("giant","Giant","",1000000);var tiny=huge.join("tiny","Tiny","",200);
        check(giant.radius()>=12&&giant.length()>300,"giant physical scale");check(giant.speed(0)<tiny.speed(0),"giant slower");
        check(giant.body().size()>20,"giant full length at spawn");
        double largestFrame=0;
        for(int i=0;i<50;i++){
            huge.tick(.05);var p0=giant.body(0).get(0);
            for(int frame=1;frame<=6;frame++){var p1=giant.body(frame/6.0).get(0);largestFrame=Math.max(largestFrame,Math.hypot(p1.x()-p0.x(),p1.z()-p0.z()));p0=p1;}
        }
        check(largestFrame<.15,"no tick-sized render jumps");
        System.out.println("Arena checks passed: "+checks);
    }
}
