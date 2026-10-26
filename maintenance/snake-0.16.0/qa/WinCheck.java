import com.tikmng.snake.*;
import java.util.*;
public class WinCheck {
    private static int count;
    private static void check(boolean value,String name){count++;if(!value)throw new AssertionError(name);}
    private static void startBattle(ArenaEngine e){e.requestBattle();for(int i=0;i<100;i++){e.food.clear();e.tick(.1);}}
    public static void main(String[] args){
        var e=new ArenaEngine(7);startBattle(e);e.minimumPlayers=2;var a=e.join("a","Atlas","",1000);var b=e.join("b","Nehir","",100);
        e.survivorDelaySeconds=0;a.x=a.z=b.x=b.z=0;a.shieldUntil=b.shieldUntil=0;e.tick(.001);
        check(e.winners().size()==1&&e.winners().get(0).wins()==1,"last survivor wins 1x");
        for(int i=0;i<100;i++)e.tick(.05);check(e.winners().get(0).wins()==1,"winner credited once");
        e.adjustWin("a",1);check(a.wins==2&&e.winners().get(0).wins()==2,"manual + win");
        e.adjustWin("a",-1);check(a.wins==1,"manual - win");e.adjustWin("a",-99);check(a.wins==0,"no negative wins");
        e.adjustWin("a",3);e.reset();check(e.winners().get(0).wins()==3,"round reset keeps leaderboard");
        var restored=new ArenaEngine(8);restored.restoreWins(e.winners());var again=restored.join("a","Atlas","",200);check(again.wins==3,"startup restores wins");
        restored.adjustWin("a",1);check(restored.winners().get(0).wins()==4,"next win increments restored total");
        restored.restoreWins(List.of(new ArenaEngine.Winner("b","B","",8),new ArenaEngine.Winner("a","A","",3)));check(restored.winners().get(0).id().equals("b"),"wins sorted independently from mass");
        var rules=new ArenaRules();check(rules.arenaSize==150,"default 150");rules.arenaSize=1001;rules.sanitize();check(rules.arenaSize==1000,"maximum1000");
        var large=new ArenaEngine(9);large.configure(1000);large.minimumPlayers=2;
        for(int i=0;i<96;i++){var s=large.join("v"+i,"V"+i,"",200+i*100);s.shieldUntil=999;large.action(s.id,s.name,"","boost",10,20);}
        for(int i=0;i<100;i++)large.tick(.05);
        for(var s:large.snakes.values()){check(Math.hypot(s.x,s.z)+s.radius()+1<=500.0001,"1000 diameter bounded");for(var p:s.body())check(Math.hypot(p.x(),p.z())+s.radius()+1<=500.01,"1000 trails bounded");}
        System.out.println("Win/1000 checks passed: "+count);
    }
}
