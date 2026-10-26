import com.tikmng.snake.ArenaEngine;
import com.tikmng.snake.ArenaSpace;

public class HuntCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    public static void main(String[] args){
        var view=ArenaSpace.closeView(10,20,0,6,0,1);
        check(view.x()<10&&view.y()>ArenaSpace.SURFACE_Y+12,"close camera above and behind");
        check(view.pitch()>10&&view.pitch()<70,"close camera sees arena");
        check(ArenaSpace.topHeight(160)<140,"largest arena below clouds");
        var offset=ArenaSpace.pan(30,20,ArenaSpace.topHeight(160),450,70);
        check(offset.x()>0&&offset.z()>0,"grab right/down translates map right/down");
        var e=new ArenaEngine(23);startBattle(e);e.configure(160);e.minimumPlayers=2;
        var big=e.join("hunter","Hunter","",1500);var small=e.join("prey","Prey","",200);
        big.x=-60;big.z=0;small.x=60;small.z=0;big.angle=0;small.angle=0;
        e.tick(.05);check(big.preyId.equals("prey")&&big.intent.equals("AVLANIYOR"),"prey acquired beyond old 28-block radius");
        check(big.speed(e.time)<small.speed(e.time),"smaller remains faster");
        e=new ArenaEngine(19);startBattle(e);e.configure(160);e.minimumPlayers=2;
        small=e.join("prey","Prey","",100);big=e.join("hunter","Hunter","",1500);
        var tail=small.body().get(small.body().size()*3/4);
        big.x=tail.x()-big.radius()*.8;big.z=tail.z();big.angle=0;big.shieldUntil=small.shieldUntil=0;
        check(Math.hypot(big.x-small.x,big.z-small.z)>big.radius()+small.radius(),"bite fixture head is far away");
        double oldMass=small.mass,oldLength=small.length();
        e.tick(.001);check(big.kills==0&&e.snakes.containsKey("prey"),"body bite leaves prey alive");
        check(small.mass<oldMass&&small.length()<oldLength,"body bite removes tail and mass");
        check(e.meals.size()==1&&e.totalTailBites==1&&!e.meals.get(0).whole(),"visible tail swallow event");
        for(int i=0;i<20;i++)e.tick(.05);check(e.meals.isEmpty(),"swallow animation released");
        for(int size:new int[]{32,96,160}){
            e=new ArenaEngine(20261023);e.configure(size);e.seedDemo();startBattle(e);
            for(int i=0;i<1200;i++)e.tick(.05);
            System.out.println("Arena "+size+": consumed="+e.totalEaten+", tailBites="+e.totalTailBites+", alive="+e.snakes.size()+", round="+e.round);
            check(e.totalEaten>=1&&e.totalTailBites>=2,"head catches and partial bites in 60 seconds at size "+size);
        }
        System.out.println("Hunt/camera checks passed: "+checks);
    }
}
