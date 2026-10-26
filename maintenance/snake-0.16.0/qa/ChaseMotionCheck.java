import com.tikmng.snake.ArenaEngine;

public class ChaseMotionCheck {
    private static int checks;
    private static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private static ArenaEngine fixture(long seed,int size,double mass,double distance,double heading){
        var e=new ArenaEngine(seed);startBattle(e);e.configure(size);e.minimumPlayers=2;
        var hunter=e.join("hunter","Hunter","",mass);var prey=e.join("prey","Prey","",39);
        hunter.x=distance;hunter.z=0;hunter.angle=heading;prey.x=prey.z=0;
        prey.boostUntil=10000;prey.boostMultiplier=0;hunter.shieldUntil=prey.shieldUntil=0;e.configure(size);
        return e;
    }
    private static void stationary(){
        for(double mass:new double[]{900,22000,38630,1000000})for(int size:new int[]{96,320,1000})for(double angle:new double[]{0,Math.PI/2,Math.PI,Math.PI*1.5}){
            var e=fixture(71,size,mass,Math.max(8,Math.min(24,.48+Math.sqrt(mass)*.044)),angle);
            var hunter=e.snakes.get("hunter");double start=hunter.x;
            double best=start;
            for(int i=0;i<240&&e.winner.isEmpty();i++){
                double x=hunter.x,z=hunter.z;e.food.clear();e.tick(.05);
                best=Math.min(best,Math.hypot(hunter.x,hunter.z));
                check(Math.hypot(hunter.x-x,hunter.z-z)<=hunter.speed(e.time)*.0625+1e-6,"chase respects physical movement budget");
            }
            check(hunter.kills==1,"stationary prey must be caught, not orbited: mass="+mass+" size="+size+" angle="+angle+" best="+best);
        }
    }
    private static void nearWall(){
        var e=new ArenaEngine(20261023);startBattle(e);e.configure(320);e.minimumPlayers=2;
        var hunter=e.join("hunter","MaviYilan","",38630);var prey=e.join("prey","Kaptan","",39);
        hunter.x=-108;hunter.z=0;hunter.angle=Math.PI/2;prey.x=-128;prey.z=8;prey.angle=0;
        hunter.shieldUntil=prey.shieldUntil=0;e.configure(320);
        double best=1000,travel=0,minX=hunter.x,maxX=hunter.x,minZ=hunter.z,maxZ=hunter.z;int running=0;
        for(int i=0;i<1200&&e.winner.isEmpty();i++){
            double x=hunter.x,z=hunter.z;e.food.clear();e.tick(.05);travel+=Math.hypot(hunter.x-x,hunter.z-z);
            minX=Math.min(minX,hunter.x);maxX=Math.max(maxX,hunter.x);minZ=Math.min(minZ,hunter.z);maxZ=Math.max(maxZ,hunter.z);
            if(e.snakes.containsKey(prey.id))best=Math.min(best,Math.hypot(hunter.x-prey.x,hunter.z-prey.z));
            if(hunter.intent.equals("AVLANIYOR"))running++;
        }
        double covered=Math.hypot(maxX-minX,maxZ-minZ);
        System.out.println("Near-wall recording fixture: closest="+best+" travel="+travel+" covered="+covered+" huntTicks="+running+" eaten="+e.totalEaten+" bites="+e.totalTailBites);
        check(travel>10,"near wall hunter actually moves");
        check(covered>60,"near wall hunter follows across the arena, not a small local circle");
    }
    private static void boostedIntercept(){
        for(int size:new int[]{320,1000})for(double mass:new double[]{22000,38630,1000000}){
            var e=new ArenaEngine(91);startBattle(e);e.configure(size);e.minimumPlayers=2;
            var hunter=e.join("hunter","Hunter","",mass);var prey=e.join("prey","Prey","",39);
            hunter.x=-size*.3;hunter.z=0;hunter.angle=Math.PI/2;prey.x=-size*.4;prey.z=8;prey.angle=0;
            hunter.shieldUntil=prey.shieldUntil=0;e.configure(size);e.action(hunter.id,hunter.name,"","boost",5,15);
            for(int i=0;i<240&&e.winner.isEmpty();i++){e.food.clear();e.tick(.05);}
            check(hunter.kills==1,"speed gift catches moving prey near wall: "+size+" / "+mass);
        }
    }
    public static void main(String[] args){if(args.length==0){stationary();boostedIntercept();}nearWall();System.out.println("Chase motion checks passed: "+checks);}
}
