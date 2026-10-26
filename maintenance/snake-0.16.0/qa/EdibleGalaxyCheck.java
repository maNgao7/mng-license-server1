import com.tikmng.snake.ArenaEngine;
import java.util.*;

public class EdibleGalaxyCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    private static void close(double actual,double expected,String label){check(Math.abs(actual-expected)<1e-6,label+": "+actual+" expected="+expected);}
    private static void step(ArenaEngine e,int count){for(int i=0;i<count;i++){e.food.clear();e.tick(.05);}}
    private static ArenaEngine active(){var e=new ArenaEngine(53);e.configure(1000);e.requestBattle();for(int i=0;i<100;i++)e.tick(.1);return e;}
    private static List<ArenaEngine.Snake> parts(ArenaEngine e,String owner){return e.renderSnakes().stream().filter(s->s.ownerId.equals(owner)).toList();}
    private static double mass(ArenaEngine e,String owner){return parts(e,owner).stream().mapToDouble(s->s.mass).sum();}
    private static void aggregate(ArenaEngine e){for(var owner:e.snakes.values())close(mass(e,owner.id),owner.mass,"widget aggregate "+owner.id);}
    private static void formation(ArenaEngine e,ArenaEngine.Snake owner,int count){
        var parts=parts(e,owner.id);check(parts.size()==count,"part count");aggregate(e);
        for(var part:parts){
            check(part.mass>0&&part.mass<=1000000,"positive real part mass");
            check(part.name.equals(owner.name)&&part.profile.equals(owner.profile)&&part.skin==owner.skin&&part.wins==owner.wins,"shared identity");
            close(part.angle,owner.angle,"common heading");
            for(var p:part.body())check(Math.hypot(p.x(),p.z())+part.radius()+1<=e.size/2.0+1e-6,"whole formation inside arena");
        }
        for(int i=0;i<parts.size();i++)for(int j=i+1;j<parts.size();j++){
            var a=parts.get(i);var b=parts.get(j);
            check(Math.abs(a.mass-b.mass)>1e-8,"unequal small medium big masses");
            double nx=-Math.sin(owner.angle),nz=Math.cos(owner.angle);
            double gap=Math.abs((a.x-b.x)*nx+(a.z-b.z)*nz)-a.radius()-b.radius();
            check(gap>=.399999,"parallel bodies do not touch: "+gap);
        }
    }
    private static void formations(){
        for(int size:new int[]{32,150,1000})for(int count:new int[]{3,4,5})for(double initial:new double[]{10,300,1000000}){
            var e=active();e.configure(size);var owner=e.join("owner","Owner","portrait",initial);
            owner.x=owner.z=0;owner.angle=0;e.configure(size);e.galaxy(3,count);
            formation(e,owner,count);check(e.renderSnakes().size()==count,"no hidden duplicate owner");
            for(int i=0;i<5;i++){step(e,1);formation(e,owner,count);}
            check(e.totalEaten==0&&e.totalTailBites==0,"same owner cannot bite");
            step(e,56);check(!e.galaxyActive()&&e.renderSnakes().size()==1,"expiry merges surviving parts");close(owner.mass,initial,"merge conserves even mass10");
        }
        var e=new ArenaEngine(22);e.configure(1000);var owner=e.joinPublisher("host","Host","");owner.x=owner.z=0;owner.angle=0;e.configure(1000);e.galaxy(3,5);e.publisherDirection(1,0);
        var before=parts(e,owner.id).stream().map(s->new ArenaEngine.Point(s.x,s.z)).toList();step(e,1);
        var after=parts(e,owner.id);double dx=after.get(0).x-before.get(0).x(),dz=after.get(0).z-before.get(0).z();check(dx>0,"group moves");
        for(int i=0;i<5;i++){close(after.get(i).x-before.get(i).x(),dx,"common movement x");close(after.get(i).z-before.get(i).z(),dz,"common movement z");}
        e.action(owner.id,owner.name,"","grow",999700,0);e.publisherDirection(0,1);step(e,1);
        for(double partial:new double[]{0,.25,.5,.75,1}){
            var children=parts(e,owner.id);double angle=owner.renderAngle(partial),nx=-Math.sin(angle),nz=Math.cos(angle);
            for(int i=1;i<children.size();i++){
                var a=children.get(i-1);var b=children.get(i);
                double separation=Math.abs((a.renderX(partial)-b.renderX(partial))*nx+(a.renderZ(partial)-b.renderZ(partial))*nz);
                check(separation>a.renderRadius(partial)+b.renderRadius(partial),"rendered turning and growing parts remain apart");
                close(a.body(partial).get(0).x(),a.renderX(partial),"rendered body follows interpolated formation head");
            }
        }
        e.paused=true;e.tick(.1);
        for(var child:e.renderSnakes())for(double partial:new double[]{0,.5,1}){
            close(child.renderX(partial),child.x,"pause freezes group x interpolation");close(child.renderZ(partial),child.z,"pause freezes group z interpolation");close(child.renderAngle(partial),child.angle,"pause freezes group heading");
        }
    }
    private static ArenaEngine pair(double hunterMass,double victimMass){
        var e=active();var hunter=e.joinPublisher("hunter","Hunter","h");e.action(hunter.id,hunter.name,hunter.profile,"grow",hunterMass-300,0);
        if(hunterMass<300)e.action(hunter.id,hunter.name,hunter.profile,"shrink",300-hunterMass,0);
        var victim=e.join("victim","Victim","v",victimMass);hunter.x=-100;hunter.z=0;hunter.angle=0;victim.x=100;victim.z=0;victim.angle=0;
        hunter.shieldUntil=victim.shieldUntil=0;e.configure(1000);e.galaxy(15,3);return e;
    }
    private static void align(ArenaEngine e,ArenaEngine.Snake hunter,ArenaEngine.Snake victim,double fraction){
        var h=e.snakes.get(hunter.ownerId);var v=e.snakes.get(victim.ownerId);
        double laneH=hunter.z-h.z,laneV=victim.z-v.z;
        h.angle=v.angle=0;v.x=30;v.z=0;h.x=v.x-victim.length()*fraction-hunter.radius()*.8;h.z=laneV-laneH;
        for(var part:e.renderSnakes())part.lastBite=e.time;
        hunter.lastBite=-100;e.configure(1000);e.food.clear();
    }
    private static void consumption(){
        var e=pair(3000,900);var hunter=parts(e,"hunter").get(0);var victim=parts(e,"victim").get(0);
        double taken=victim.mass,beforeH=e.snakes.get("hunter").mass,beforeV=e.snakes.get("victim").mass;
        align(e,hunter,victim,0);e.tick(.000001);
        check(!e.renderSnakes().contains(victim)&&parts(e,"victim").size()==2,"captured part permanently removed");
        close(e.snakes.get("hunter").mass,beforeH+taken,"exact part mass credited once without1.2");
        close(e.snakes.get("victim").mass,beforeV-taken,"victim remaining mass reduced");aggregate(e);
        check(e.snakes.get("hunter").kills==0&&e.winner.isEmpty(),"one part is not owner elimination");
        check(e.meals.get(0).eaterId().equals("hunter"),"feeding visual resolves owner identity");
        e.galaxy(15,5);check(parts(e,"victim").size()==2,"repeat galaxy does not resurrect");
        e.snakes.values().forEach(s->s.shieldUntil=e.time+100);step(e,8);aggregate(e);check(parts(e,"victim").size()==2,"next ticks do not respawn eaten part");
        var owner=e.snakes.get("victim");e.feed(owner.id,owner.name,"updated-profile",120,2);step(e,18);
        close(owner.mass,beforeV-taken+120,"pending portrait feed grows remaining parts");check(parts(e,"victim").size()==2,"profile feed cannot resurrect");aggregate(e);
        e.action(owner.id,owner.name,owner.profile,"grow",80,0);aggregate(e);close(owner.mass,beforeV-taken+200,"direct growth conserved");
        var live=parts(e,"victim").get(0);e.food.clear();e.food.add(new ArenaEngine.Point(live.x,live.z));e.tick(.000001);
        close(owner.mass,beforeV-taken+205,"split food credits exactly5");aggregate(e);
        for(var s:e.renderSnakes())if(s.ownerId.equals(owner.id))check(s.profile.equals("updated-profile"),"profile update propagates");
        double expectedV=owner.mass,expectedH=e.snakes.get("hunter").mass;step(e,310);
        check(!e.galaxyActive()&&e.renderSnakes().size()==2,"expiry only returns surviving owners");close(owner.mass,expectedV,"merge preserves remaining plus growth");close(e.snakes.get("hunter").mass,expectedH,"merge preserves stolen credit");
    }
    private static void fragmentBoundary(){
        for(double difference:new double[]{0,50,51}){
            var e=pair((450-difference)*2,900);var hunter=parts(e,"hunter").get(0);var victim=parts(e,"victim").get(0);
            align(e,hunter,victim,0);e.tick(.000001);
            check(e.renderSnakes().contains(victim)==(difference>50),"50difference uses fragment mass: "+difference);aggregate(e);
        }
    }
    private static void expiryContact(){
        var e=pair(3000,900);var hunter=parts(e,"hunter").get(0);var victim=parts(e,"victim").get(0);
        double taken=victim.mass,beforeH=e.snakes.get("hunter").mass,beforeV=e.snakes.get("victim").mass;
        e.time+=e.galaxyRemaining()-.0000005;align(e,hunter,victim,0);e.tick(.000001);
        check(!e.galaxyActive()&&e.renderSnakes().size()==2,"expiry tick merges after fragment contact");
        close(e.snakes.get("hunter").mass,beforeH+taken,"expiry capture uses exact part mass");
        close(e.snakes.get("victim").mass,beforeV-taken,"expiry merge cannot restore captured part");
    }
    private static void tail(){
        var e=pair(3000,900);var hunter=parts(e,"hunter").get(0);var victim=parts(e,"victim").get(0);
        double before= victim.mass,beforeH=e.snakes.get("hunter").mass,total=e.snakes.values().stream().mapToDouble(s->s.mass).sum();
        align(e,hunter,victim,.65);e.tick(.000001);
        check(e.totalTailBites==1&&e.renderSnakes().contains(victim)&&victim.mass<before,"fragment tail removes only severed mass");
        close(e.snakes.get("hunter").mass-beforeH,before-victim.mass,"tail transfer exact1x");aggregate(e);
        close(e.snakes.values().stream().mapToDouble(s->s.mass).sum(),total,"tail conservation");
        double length=victim.length(),remaining=victim.mass;e.snakes.values().forEach(s->s.shieldUntil=e.time+100);step(e,20);
        close(victim.mass,remaining,"tail mass not restored");close(victim.length(),length,"tail does not regrow without growth");
    }
    private static void naturalBattle(){
        var e=active();e.configure(150);e.rules.protectionSeconds=0;
        double initial=0;for(int i=0;i<8;i++){double amount=300+i*100;e.join("v"+i,"V"+i,"",amount);initial+=amount;}
        e.galaxy(15,5);
        for(int i=0;i<290;i++){
            step(e,1);aggregate(e);
            close(e.snakes.values().stream().mapToDouble(s->s.mass).sum(),initial,"natural split combat conserves all mass");
        }
        check(e.totalEaten>0&&e.totalTailBites>0,"AI makes real fragment head and tail captures during battle");
        System.out.println("Natural Galaxy battle: captured="+e.totalEaten+" tails="+e.totalTailBites+" owners="+e.snakes.size());
    }
    private static void eliminationAndModeration(){
        var e=pair(3000,10);e.survivorDelaySeconds=0;e.feed("victim","Victim","v",100,1);
        double total=3010;
        for(int i=0;i<3;i++){
            var hunter=parts(e,"hunter").get(0);var victim=parts(e,"victim").get(0);align(e,hunter,victim,0);e.tick(.000001);aggregate(e);
            if(i<2)check(e.snakes.containsKey("victim")&&e.winner.isEmpty(),"owner survives with remaining tiny parts");
        }
        check(!e.snakes.containsKey("victim")&&parts(e,"victim").isEmpty()&&e.feedings.isEmpty(),"last part eliminates owner and pending feed");
        close(e.snakes.get("hunter").mass,total,"tiny captures never fabricate mass10");
        check(e.snakes.get("hunter").kills==1&&e.winner.equals("Hunter")&&e.winners().get(0).wins()==1,"one owner kill and winner");
        step(e,161);check(!e.started&&e.battleCountdownRemaining()==-1&&e.snakes.size()==2,"automatic new round waits for O");
        e=pair(3000,900);e.removeSnake("victim");step(e,220);check(e.winner.isEmpty()&&e.winners().isEmpty(),"P removes all parts without artificial winner");aggregate(e);
        var p=parts(e,"hunter").get(0);e.food.clear();e.food.add(new ArenaEngine.Point(p.x,p.z));e.tick(.000001);
        close(e.snakes.get("hunter").mass,3005,"manual removal does not transfer mass");
    }
    private static void tinySurvivorAndWinnerExpiry(){
        var e=pair(3000,10);
        for(int i=0;i<2;i++){align(e,parts(e,"hunter").get(0),parts(e,"victim").get(0),0);e.tick(.000001);}
        double remaining=e.snakes.get("victim").mass;check(remaining>0&&remaining<10,"remaining owner can be below10");
        for(var s:e.snakes.values())s.shieldUntil=e.time+100;step(e,301);
        close(e.snakes.get("victim").mass,remaining,"tiny surviving part merges without mass floor");
        e.feed("victim","Victim","v",4,1);step(e,18);close(e.snakes.get("victim").mass,remaining+4,"feeding merged tiny owner does not fabricate10");
        e.galaxy(3,5);aggregate(e);check(parts(e,"victim").size()==5,"later Galaxy splits only current surviving mass");
        e=pair(3000,10);e.survivorDelaySeconds=0;e.time+=e.galaxyRemaining()-1;
        for(int i=0;i<3;i++){align(e,parts(e,"hunter").get(0),parts(e,"victim").get(0),0);e.tick(.000001);}
        check(!e.winner.isEmpty()&&e.galaxyActive(),"winner before split expiry");step(e,21);
        check(!e.galaxyActive()&&e.renderSnakes().size()==1&&!e.winner.isEmpty(),"winner freeze still merges at expiry");close(e.snakes.get("hunter").mass,3010,"winning merge conserves credited mass");
    }
    private static void capsAndPopulation(){
        var e=pair(999900,900);var h=parts(e,"hunter").get(0);var v=parts(e,"victim").get(0);double taken=v.mass;
        align(e,h,v,0);e.tick(.000001);close(e.snakes.get("hunter").mass,1000000,"owner mass cap after capture");close(e.snakes.get("victim").mass,900-taken,"cap cannot retain victim mass");aggregate(e);
        e.feed("hunter","Hunter","h",1000,1);check(e.feedings.isEmpty(),"capped gifts rejected");
        e=new ArenaEngine(22);e.configure(1000);for(int i=0;i<96;i++)e.join("v"+i,"V"+i,"",1000000);
        check(e.join("overflow","Overflow","",300)==null,"96 owner cap");e.galaxy(3,5);check(e.renderSnakes().size()==480,"480 actual parts cap");
        step(e,16);long start=System.nanoTime();step(e,16);long elapsed=System.nanoTime()-start;aggregate(e);
        check(e.renderSnakes().size()==480,"maximum bodies survive waiting updates");System.out.printf(Locale.ROOT,"480-part waiting mean after warmup: %.3fms%n",elapsed/16e6);
        e.reset();check(e.renderSnakes().isEmpty()&&!e.galaxyActive(),"reset clears every part");
    }
    public static void main(String[] args){formations();consumption();fragmentBoundary();expiryContact();tail();naturalBattle();eliminationAndModeration();tinySurvivorAndWinnerExpiry();capsAndPopulation();System.out.println("Edible Galaxy checks passed: "+checks);}
}
