import com.tikmng.snake.*;
import java.util.*;
public class GalaxyCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    public static void main(String[] args){
        for(int size:new int[]{32,320,1000}){
            var e=new ArenaEngine(19);e.configure(size);e.minimumPlayers=2;
            for(int i=0;i<12;i++)e.join("v"+i,"V"+i,"",200+i*2000);
            var masses=new HashMap<String,Double>();e.snakes.values().forEach(s->masses.put(s.id,s.mass));
            e.galaxy(7);check(e.galaxyActive()&&e.renderSnakes().size()==36,"all owners split into3");
            e.galaxy(7);check(e.renderSnakes().size()==36,"repeated galaxy never duplicates fragments");
            var owner=e.snakes.get("v0");e.gift(owner.id,owner.name,"",1,3);
            for(int tick=0;tick<141;tick++){
                e.tick(.05);
                check(e.snakes.size()==12&&e.totalEaten==0&&e.totalTailBites==0,"identity protected during global split");
                for(var child:e.renderSnakes())check(Double.isFinite(child.x)&&Double.isFinite(child.z)&&Math.hypot(child.x,child.z)+child.radius()+1<=size/2.0+.01,"bounded fragment");
            }
            check(!e.galaxyActive()&&e.renderSnakes().size()==12,"all recombined");
            for(var s:e.snakes.values())check(s.mass>=masses.get(s.id)+(s.id.equals("v0")?48:0),"mass and gifts retained");
            e.galaxy(3);e.reset();check(!e.galaxyActive()&&e.renderSnakes().isEmpty(),"reset clears all fragments");
        }
        var e=new ArenaEngine(22);e.configure(1000);for(int i=0;i<96;i++)e.join("m"+i,"M"+i,"",1000000);
        e.galaxy(3);check(e.renderSnakes().size()==288,"96 owners bounded288 fragments");for(int i=0;i<61;i++)e.tick(.05);check(e.renderSnakes().size()==96,"max population recombines");
        System.out.println("Galaxy checks passed: "+checks);
    }
}
