import com.tikmng.snake.ArenaEngine;
import java.util.Arrays;

public class SeparationCheck {
    private static int checks;
    private static volatile double renderChecksum;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private static double distance(double x,double z,double ax,double az,double bx,double bz){
        double dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz;
        double t=den==0?0:Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/den));
        return Math.hypot(x-ax-dx*t,z-az-dz*t);
    }
    private static ArenaEngine population(long seed,double mass){
        var e=new ArenaEngine(seed);e.configure(320);e.minimumPlayers=2;
        for(int i=0;i<96;i++)e.join("s"+i,"S"+i,"",mass<0?200+(i%12)*850:mass).shieldUntil=1e9;
        return e;
    }
    private static void benchmark(String label,double mass,int samples){
        var e=population(901,mass);
        for(int i=0;i<160;i++)e.tick(.05);
        long[] times=new long[samples];long sum=0;
        for(int i=0;i<samples;i++){
            long start=System.nanoTime();e.tick(.05);long elapsed=System.nanoTime()-start;
            times[i]=elapsed;sum+=elapsed;
        }
        Arrays.sort(times);
        System.out.printf(java.util.Locale.ROOT,"%s: snakes=%d samples=%d mean=%.3fms p50=%.3fms p95=%.3fms max=%.3fms%n",
            label,e.snakes.size(),samples,sum/1e6/samples,times[samples/2]/1e6,times[(int)(samples*.95)]/1e6,times[samples-1]/1e6);
    }
    private static void renderBenchmark(){
        var e=population(901,-1);long sum=0;long[] times=new long[360];
        for(int i=-120;i<times.length;i++){
            if(i%6==0)e.tick(.05);
            double partial=(Math.floorMod(i,6)+1)/6.0,checksum=0;
            long start=System.nanoTime();
            for(var s:e.snakes.values()){
                var first=s.body(partial);var second=s.body(partial);
                checksum+=first.get(0).x()+second.get(second.size()-1).z();
            }
            long elapsed=System.nanoTime()-start;renderChecksum=checksum;
            if(i>=0){sum+=elapsed;times[i]=elapsed;}
        }
        Arrays.sort(times);
        System.out.printf(java.util.Locale.ROOT,"96 mixed body(partial) pair / frame: samples=%d mean=%.3fms p95=%.3fms max=%.3fms%n",
            times.length,sum/1e6/times.length,times[(int)(times.length*.95)]/1e6,times[times.length-1]/1e6);
    }
    private static void heads(double boost,double otherBoost){
        var e=new ArenaEngine(41);e.configure(320);e.minimumPlayers=2;
        var a=e.join("a","A","",900);var b=e.join("b","B","",900);
        a.x=-4;a.z=0;a.angle=0;b.x=4;b.z=0;b.angle=Math.PI;e.configure(320);
        a.shieldUntil=b.shieldUntil=100;
        e.action("a","A","","boost",boost,5);e.action("b","B","","boost",otherBoost,5);
        for(int i=0;i<30;i++){
            e.food.clear();double ax=a.x,az=a.z,bx=b.x,bz=b.z;e.tick(.05);
            check(distance(0,0,ax-bx,az-bz,a.x-b.x,a.z-b.z)>=a.radius()+b.radius()-.015,"swept equal heads boost="+boost+" step="+i);
            check(e.totalEaten==0&&e.totalTailBites==0,"protected equal heads never eaten");
            check(Math.hypot(a.x-ax,a.z-az)<=a.speed(e.time)*.05+.02,"bounded head displacement");
            check(Math.hypot(b.x-bx,b.z-bz)<=b.speed(e.time)*.05+.02,"fast head cannot shove slow head");
        }
    }
    private static void bodyBarrier(double moverMass,double wallMass,boolean shield,boolean cooldown){
        var e=new ArenaEngine(53);e.configure(320);e.minimumPlayers=2;
        var wall=e.join("wall","Wall","",wallMass);var mover=e.join("mover","Mover","",moverMass);
        wall.x=0;wall.z=0;wall.angle=0;mover.x=60;mover.z=60;e.configure(320);
        var body=wall.body();var hit=body.get(body.size()/2);
        mover.x=hit.x();mover.z=hit.z()-4;mover.angle=Math.PI/2;e.configure(320);
        mover.shieldUntil=shield?100:0;wall.shieldUntil=shield?100:0;
        if(cooldown)mover.lastBite=e.time;
        e.action("mover","Mover","","boost",10,5);e.food.clear();
        double oldX=mover.x,oldZ=mover.z;e.tick(.1);
        double nearest=Double.MAX_VALUE;
        for(int i=1;i<body.size();i++){
            var a=body.get(i-1);var b=body.get(i);
            nearest=Math.min(nearest,distance(mover.x,mover.z,a.x(),a.z(),b.x(),b.z()));
        }
        check(nearest>=mover.radius()+wall.radius()-.08,"body barrier masses="+moverMass+"/"+wallMass+" shield="+shield+" gap="+nearest);
        check(mover.z<hit.z()+.1,"boost cannot tunnel through blocked body");
        check(Math.hypot(mover.x-oldX,mover.z-oldZ)<=mover.speed(e.time)*.1+.02,"contact does not teleport");
        check(e.totalEaten==0&&e.totalTailBites==0,"blocked contact deals no damage");
        check(mover.body(0).get(0).equals(new ArenaEngine.Point(oldX,oldZ)),"trail starts at previous position");
        var mid=mover.body(.5).get(0);
        check(Math.hypot(mid.x()-(oldX+mover.x)/2,mid.z()-(oldZ+mover.z)/2)<1e-6,"contact interpolation remains smooth");
    }
    private static void overlap(){
        var e=new ArenaEngine(73);e.configure(320);e.minimumPlayers=2;
        var a=e.join("a","A","",900);var b=e.join("b","B","",900);
        a.x=0;a.z=0;a.angle=0;b.x=.5;b.z=0;b.angle=Math.PI;e.configure(320);
        double initial=Math.hypot(a.x-b.x,a.z-b.z);e.food.clear();e.tick(.01);
        check(Math.hypot(a.x-b.x,a.z-b.z)>initial,"existing head overlap separates gently");
        check(Math.hypot(a.x,a.z)<a.speed(e.time)*.015+.001,"overlap correction is bounded by elapsed time");
        e=new ArenaEngine(74);e.configure(320);e.minimumPlayers=2;
        for(int i=0;i<24;i++){
            var s=e.join("o"+i,"O"+i,"",900);s.x=0;s.z=0;s.angle=i*Math.PI/12;
        }
        e.configure(320);e.food.clear();e.tick(.01);
        for(var s:e.snakes.values())check(Math.hypot(s.x,s.z)<=s.speed(e.time)*.0125+.00001,"crowded overlap has a shared correction budget");
        e=new ArenaEngine(75);e.configure(320);e.minimumPlayers=2;
        a=e.join("a","A","",900);b=e.join("b","B","",900);
        b.x=b.z=0;b.angle=0;a.x=a.z=60;e.configure(320);
        var hit=b.body().get(b.body().size()/2);a.x=hit.x();a.z=hit.z()-.1;a.angle=Math.PI/2;e.configure(320);
        double x=a.x,z=a.z;e.food.clear();e.tick(.01);
        check(a.z<z,"existing body penetration moves outward");
        check(Math.hypot(a.x-x,a.z-z)<=a.speed(e.time)*.0125+.00001,"body penetration correction is gentle");
    }
    private static void edible(){
        for(boolean head:new boolean[]{false,true}){
            var e=new ArenaEngine(53);startBattle(e);e.configure(320);e.minimumPlayers=2;
            var prey=e.join("prey","Prey","",900);var hunter=e.join("hunter","Hunter","",head?1080:3000);
            prey.x=0;prey.z=0;prey.angle=0;hunter.x=60;hunter.z=60;e.configure(320);
            var hit=prey.body().get(head?0:prey.body().size()/2);
            hunter.x=hit.x();hunter.z=hit.z()-4;hunter.angle=Math.PI/2;e.configure(320);
            double length=prey.length();
            hunter.shieldUntil=prey.shieldUntil=0;e.action("hunter","Hunter","","boost",10,5);e.food.clear();e.tick(.1);
            check(head?e.totalEaten==1:e.totalTailBites==1,"10x edible "+(head?"head at exact 1.2 ratio":"tail"));
            check(head?!e.snakes.containsKey("prey"):e.snakes.containsKey("prey")&&prey.length()<length,"head-only elimination at 10x");
        }
    }
    private static void contracts() throws Exception {
        var e=new ArenaEngine(91);e.configure(1001);check(e.size==1000,"1000 map cap");
        // Also works after the parent removes the obsolete rules field.
        try{e.rules.getClass().getField("joinOnFollow").setBoolean(e.rules,false);}catch(NoSuchFieldException ignored){}
        e.followed(" A ","A","photo");var s=e.snakes.get("a");
        check(s!=null&&s.mass==e.rules.followMass,"follow always enters, normalized identity");
        e.followed(" A ","A","photo");check(e.feedings.size()==1,"repeat follow feeds existing entrant");
        double mass=s.mass;for(int i=0;i<6;i++){e.food.clear();e.tick(.1);}
        check(s.mass==mass,"gift remains pending before portrait is swallowed");for(int i=0;i<6;i++){e.food.clear();e.tick(.05);}
        check(s.mass==mass+e.rules.followMass&&e.feedings.isEmpty(),"gift credited after portrait is swallowed");
        double base=s.speed(e.time);e.action("a","A","","boost",10,2);
        check(Math.abs(s.speed(e.time)/base-10)<1e-9,"10x boost");
        e.action("a","A","","boost",100,2);check(s.boostMultiplier==10,"boost capped at 10");
        check(s.speed(e.time+3)==base,"boost expires");
        check(s.body()==s.body(),"full simulation body reused");
        check(s.body(.5)==s.body(.5),"same render sample reused");
        var a=population(15,-1);var b=population(15,-1);
        for(int i=0;i<80;i++){a.tick(.05);b.tick(.05);}
        for(var first:a.snakes.values()){
            var second=b.snakes.get(first.id);
            check(first.x==second.x&&first.z==second.z&&first.mass==second.mass,"deterministic "+first.id);
            for(var p:first.body(.37))check(Double.isFinite(p.x())&&Double.isFinite(p.z()),"finite rendered body");
        }
        var dense=population(35,1000000);
        for(var actor:dense.snakes.values())dense.action(actor.id,actor.name,"","boost",10,5);
        for(int i=0;i<20;i++){
            double[] before=new double[192];int j=0;
            for(var actor:dense.snakes.values()){before[j++]=actor.x;before[j++]=actor.z;}
            dense.food.clear();dense.tick(.1);j=0;
            for(var actor:dense.snakes.values()){
                double dx=actor.x-before[j++],dz=actor.z-before[j++];
                check(Math.hypot(dx,dz)<=actor.speed(dense.time)*.125+1e-6,"96 giant boosted displacement budget");
                check(Double.isFinite(actor.x)&&Double.isFinite(actor.z)&&Math.abs(actor.x)+actor.radius()+1<=160.0001&&Math.abs(actor.z)+actor.radius()+1<=160.0001,"96 giant boosted bounds");
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if(args.length==0||!args[0].equals("--benchmark")){
            heads(1,1);heads(10,10);heads(10,1);
            bodyBarrier(900,900,true,false);bodyBarrier(100,3000,false,false);bodyBarrier(3000,900,true,false);
            bodyBarrier(3000,900,false,true);bodyBarrier(849,900,false,false);
            overlap();edible();contracts();System.out.println("Separation checks passed: "+checks);
        }
        benchmark("96 mixed protected / 320",-1,400);
        benchmark("96 maximum-mass protected / 320",1000000,120);
        renderBenchmark();
    }
}
