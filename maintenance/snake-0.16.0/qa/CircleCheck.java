import com.tikmng.snake.ArenaEngine;

public class CircleCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private static double limit(ArenaEngine e,ArenaEngine.Snake s){return e.size/2.0-s.radius()-1;}
    private static void bounds(ArenaEngine e,ArenaEngine.Snake s,boolean body){
        double limit=limit(e,s);
        check(Double.isFinite(s.x)&&Double.isFinite(s.z)&&Double.isFinite(s.angle),"finite head");
        check(Math.hypot(s.x,s.z)<=limit+1e-7,"radial head clearance: diameter="+e.size+" mass="+s.mass);
        if(body)for(double partial:new double[]{0,.37,1}){
            check(Math.hypot(s.renderX(partial),s.renderZ(partial))<=limit+1e-7,"interpolated head clearance");
            for(var p:s.body(partial)){
                check(Double.isFinite(p.x())&&Double.isFinite(p.z()),"finite trail");
                check(Math.hypot(p.x(),p.z())<=limit+1e-7,"radial trail clearance");
            }
        }
    }
    private static void foodBounds(ArenaEngine e){
        check(e.food.size()==Math.min(240,Math.max(40,e.size*2)),"food count preserved");
        for(var p:e.food)check(Math.hypot(p.x(),p.z())<=e.size/2.0-4+1e-7,"food inside circular inset");
    }
    private static void spawns(){
        for(int diameter:new int[]{32,96,319,320})for(double mass:new double[]{10,200,22000,1000000}){
            var e=new ArenaEngine(71);e.configure(diameter);
            for(int i=0;i<96;i++)bounds(e,e.join("s"+i,"S"+i,"",mass),true);
            check(e.join("overflow","Overflow","",200)==null,"96-player cap preserved");
            foodBounds(e);
        }
    }
    private static void distribution(){
        for(int diameter:new int[]{32,320}){
            var e=new ArenaEngine(192);e.configure(diameter);
            double spawnSquared=0,foodSquared=0,spawnX=0,spawnZ=0;int foodCount=0,outerSpawns=0;
            int[] quadrants=new int[4];
            for(int i=0;i<512;i++){
                e.reset();var s=e.join("single","Single","",200);double limit=limit(e,s);
                double fraction=(s.x*s.x+s.z*s.z)/(limit*limit);
                spawnSquared+=fraction;spawnX+=s.x/limit;spawnZ+=s.z/limit;
                if(fraction>.75)outerSpawns++;
                quadrants[(s.x<0?1:0)+(s.z<0?2:0)]++;
                foodBounds(e);
                double foodLimit=e.size/2.0-4;
                for(var p:e.food){foodSquared+=(p.x()*p.x()+p.z()*p.z())/(foodLimit*foodLimit);foodCount++;}
            }
            check(Math.abs(spawnSquared/512-.5)<.05,"spawns uniform by area");
            check(Math.abs(spawnX/512)<.08&&Math.abs(spawnZ/512)<.08,"spawns centered at origin");
            check(outerSpawns>85&&outerSpawns<175,"spawn outer annulus populated without edge pileup");
            for(int count:quadrants)check(count>90&&count<170,"spawn quadrants balanced");
            check(Math.abs(foodSquared/foodCount-.5)<.01,"food uniform by area");
        }
    }
    private static void movement(){
        for(int diameter:new int[]{32,96,320})for(double mass:new double[]{10,900,1000000}){
            for(double boost:new double[]{1,10})for(double heading:new double[]{0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.25}){
                var e=new ArenaEngine(51);e.configure(diameter);e.minimumPlayers=1;
                var s=e.join("wall","Wall","",mass);double limit=limit(e,s);
                s.x=Math.cos(heading)*(limit-.001);s.z=Math.sin(heading)*(limit-.001);s.angle=heading;
                e.configure(diameter);e.action(s.id,s.name,"","boost",boost,60);
                double travelled=0;
                for(int i=0;i<100;i++){
                    double x=s.x,z=s.z,dt=i%2==0?.1:.05;e.food.clear();e.tick(dt);
                    double moved=Math.hypot(s.x-x,s.z-z);travelled+=moved;
                    check(moved<=s.speed(e.time)*dt+1e-7,"wall movement respects speed budget");
                    check(moved>1e-5,"outward or boosted head keeps moving at wall");
                    bounds(e,s,i%10==0);foodBounds(e);
                }
                check(travelled>s.speed(e.time)*.5,"sustained movement without wall sticking");
                check(s.mass==mass&&e.totalEaten==0&&e.totalTailBites==0,"wall contact preserves mass and bite rules");
            }
        }
    }
    private static void separation(){
        for(int diameter:new int[]{32,320})for(double mass:new double[]{900,1000000}){
            var e=new ArenaEngine(63);e.configure(diameter);e.minimumPlayers=2;
            for(int i=0;i<12;i++){
                var s=e.join("s"+i,"S"+i,"",mass);double heading=Math.PI/4,limit=limit(e,s);
                s.x=Math.cos(heading)*(limit-.01-i*.03);s.z=Math.sin(heading)*(limit-.01-i*.03);
                s.angle=heading+Math.PI/2;s.shieldUntil=1000;e.action(s.id,s.name,"","boost",10,60);
            }
            e.configure(diameter);
            for(int i=0;i<60;i++){
                double[] before=new double[e.snakes.size()*2];int j=0;
                for(var s:e.snakes.values()){before[j++]=s.x;before[j++]=s.z;}
                e.food.clear();e.tick(.05);j=0;
                for(var s:e.snakes.values()){
                    check(Math.hypot(s.x-before[j++],s.z-before[j++])<=s.speed(e.time)*.0625+1e-6,"radial separation shares correction budget");
                    bounds(e,s,i%15==0);
                }
            }
            check(e.snakes.size()==12&&e.totalEaten==0&&e.totalTailBites==0,"protected separation preserves participants");
        }
    }
    private static void preyPrediction(){
        var e=new ArenaEngine(74);startBattle(e);e.configure(320);e.minimumPlayers=2;
        var hunter=e.join("hunter","Hunter","",900);var prey=e.join("prey","Prey","",100);
        hunter.x=hunter.z=0;prey.x=120;prey.z=30;prey.angle=Math.PI/2;
        e.action(prey.id,prey.name,"","boost",10,60);
        double lead=Math.min(2.5,Math.hypot(prey.x,prey.z)/hunter.speed(e.time)*.65);
        double x=prey.x+Math.cos(prey.angle)*prey.speed(e.time)*lead;
        double z=prey.z+Math.sin(prey.angle)*prey.speed(e.time)*lead;
        double expected=Math.atan2(z,x);hunter.angle=expected;
        e.configure(320);e.food.clear();e.tick(.001);
        check(hunter.preyId.equals(prey.id)&&hunter.intent.equals("AVLANIYOR"),"hunt intent preserved");
        check(Math.abs(hunter.angle-expected)<1e-7,"predicted prey stays on radial bearing beyond wall");
    }
    private static void resize(){
        var e=new ArenaEngine(83);e.configure(320);
        var small=e.join("small","Small","profile",200);var giant=e.join("giant","Giant","",1000000);
        small.x=small.z=140;giant.x=-140;giant.z=140;small.kills=3;small.wins=2;
        e.action(small.id,small.name,"profile","boost",10,30);
        double shield=small.shieldUntil,boost=small.boostUntil;
        for(int request:new int[]{320,96,32,1,999,319,32,320}){
            e.configure(request);check(e.size==Math.max(32,Math.min(1000,request)),"size remains clamped diameter");
            bounds(e,small,true);bounds(e,giant,true);foodBounds(e);
            check(Math.abs(small.x-small.z)<1e-7&&Math.abs(giant.x+giant.z)<1e-7,"resize clamp preserves bearing");
            for(var s:e.snakes.values()){
                check(s.body().get(0).equals(new ArenaEngine.Point(s.x,s.z)),"resize rebuilds trail at constrained head");
                check(s.body()==s.body()&&s.body(.5)==s.body(.5),"body caches retained after resize");
            }
            check(small.mass==200&&giant.mass==1000000&&small.kills==3&&small.wins==2,"resize preserves identity and scores");
            check(small.shieldUntil==shield&&small.boostUntil==boost&&small.profile.equals("profile"),"resize preserves gifts and protection");
        }
        check(Math.hypot(giant.x,giant.z)<=1+1e-7,"diameter expansion does not scale positions");
        e.paused=true;double x=small.x,z=small.z,time=e.time;e.tick(.1);
        check(small.x==x&&small.z==z&&e.time==time,"pause preserved");
    }
    public static void main(String[] args){
        spawns();distribution();movement();separation();preyPrediction();resize();
        System.out.println("Circle checks passed: "+checks);
    }
}
