import com.tikmng.snake.*;
import java.util.*;

public class PlayRulesCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    private static void step(ArenaEngine e,int count){for(int i=0;i<count;i++){e.food.clear();e.tick(.05);}}
    private static void headContact(ArenaEngine e,ArenaEngine.Snake a,ArenaEngine.Snake b){
        a.x=a.z=b.x=b.z=0;a.shieldUntil=b.shieldUntil=0;e.configure(e.size);e.food.clear();e.tick(.001);
    }
    private static void countdown(){
        var e=new ArenaEngine(14);startBattle(e);e.configure(150);var a=e.join("a","A","",300);var b=e.join("b","B","",250);
        check(e.started,"explicit battle fixture started");headContact(e,a,b);
        check(e.totalEaten==1&&e.winner.isEmpty()&&e.winners().isEmpty(),"last survivor does not instantly win");
        check(Math.abs(e.survivorRemaining()-10)<.001,"ten second countdown starts");
        step(e,190);check(e.winner.isEmpty()&&e.survivorRemaining()>.4,"no early win at9.5sec");
        var c=e.join("c","C","",300);check(e.survivorRemaining()<0,"new entrant cancels countdown");
        check(Math.abs(c.shieldUntil-e.time-8)<.001,"new entrant protected eight seconds");
        headContact(e,a,c);check(e.survivorRemaining()>9.9,"next real last survivor rearms countdown");
        step(e,201);check(!e.winner.isEmpty()&&e.winners().get(0).wins()==1,"one winner after full delay");
        step(e,20);check(e.winners().get(0).wins()==1,"countdown award exactly once");
        e=new ArenaEngine(19);startBattle(e);e.join("a","A","",300);e.join("b","B","",250);e.tick(.01);e.removeSnake("b");step(e,220);
        check(e.winner.isEmpty()&&e.winners().isEmpty()&&e.survivorRemaining()<0,"moderation removal never manufactures a win");
    }
    private static void foodAndPublisher(){
        var e=new ArenaEngine(33);e.configure(150);var player=e.joinPublisher("host","Yayinci","photo");
        check(player.mass==300&&e.controlledId().equals("host"),"Space contract:300 broadcaster mass");
        player.x=player.z=0;player.angle=0;e.configure(150);e.food.clear();e.food.add(new ArenaEngine.Point(0,0));e.tick(.001);
        check(player.mass==305&&e.totalFoodEaten==1,"one food is exactly5 mass even alone");
        double x=player.x,z=player.z;step(e,15);check(Math.hypot(player.x-x,player.z-z)<1e-8,"released WASD does not engage AI");
        e.publisherDirection(1,0);step(e,20);check(player.x>x+5,"held direction moves broadcaster");
        e.publisherDirection(0,0);x=player.x;z=player.z;step(e,20);check(Math.hypot(player.x-x,player.z-z)<1e-8,"release stops movement");
        e.joinPublisher("host","Yayinci","");check(e.snakes.size()==1&&player.mass==305,"Space is idempotent without resetting growth");
        e.feed(player.id,player.name,player.profile,250,0);step(e,18);check(player.mass==555&&e.totalFeedings==1,"self-growth uses real feeding credit");
        e.action(player.id,player.name,player.profile,"boost",3,2);check(player.boostMultiplier==3,"standard donut3x possible");
        e.removeSnake(player.id);check(e.controlledId().isEmpty(),"P removes control safely");
        var rules=new ArenaRules();rules.minimumPlayers=96;rules.sanitize();check(rules.minimumPlayers==2,"obsolete start-count setting cannot return");
    }
    private static void formations(){
        for(int size:new int[]{32,150,1000})for(int parts:new int[]{3,4,5})for(double mass:new double[]{300,22000,1000000}){
            var e=new ArenaEngine(44);e.configure(size);var owner=e.joinPublisher("host","Yayinci","profile");
            e.action(owner.id,owner.name,owner.profile,"grow",mass-owner.mass,0);e.galaxy(3,parts);
            check(e.renderSnakes().size()==parts,"three to five real render fragments");
            for(int tick=0;tick<59;tick++){
                e.food.clear();e.tick(.05);double sum=0,min=1e9,max=-1e9;
                double fx=Math.cos(owner.angle),fz=Math.sin(owner.angle),nx=-fz,nz=fx;
                for(var child:e.renderSnakes()){
                    check(Math.abs(Math.sin(child.angle-owner.angle))<1e-8,"children face same direction");
                    double dx=child.x-owner.x,dz=child.z-owner.z;
                    check(Math.abs(dx*fx+dz*fz)<1e-5,"children stay alongside, no radial scatter: "+size+"/"+parts+"/"+mass+" tick="+tick+" offset="+(dx*fx+dz*fz));
                    check(Math.hypot(child.x,child.z)+child.radius()+1<=size/2.0+.0001,"formation stays inside circle");
                    double lane=dx*nx+dz*nz;min=Math.min(min,lane);max=Math.max(max,lane);sum+=child.mass;
                }
                check(max-min<=owner.radius()*2.35*(parts-1)/Math.sqrt(parts)+.001,"bounded group width");
                check(Math.abs(sum-owner.mass)<.01,"real part masses conserve owner mass");
                check(e.snakes.size()==1&&owner.wins==0,"parts never become artificial participants");
            }
            step(e,2);check(!e.galaxyActive()&&e.renderSnakes().size()==1,"recombine at end preserving owner");
        }
    }
    public static void main(String[] args){countdown();foodAndPublisher();formations();System.out.println("Play rules checks passed: "+checks);}
}
