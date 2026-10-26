import com.tikmng.snake.ArenaEngine;
import com.tikmng.snake.ArenaRules;

public class RulesCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    private static void near(double a,double b,String name){check(Math.abs(a-b)<.0001,name+" expected="+b+" actual="+a);}
    private static void eat(ArenaEngine e){for(int i=0;i<22;i++){e.food.clear();e.tick(.05);}}
    public static void main(String[] args){
        var r=new ArenaRules();
        for(int coins:new int[]{1,49,50,99,100,499,500,999,1000})near(r.giftMass(coins,1),Math.round(coins*25*r.multiplier(coins)),"screenshot coin tier "+coins);
        near(r.giftMass(1,3),60,"gift combo counts each coin once");
        near(r.giftMass(Double.NaN,1),0,"invalid gift");near(r.giftMass(1,0),0,"zero gift count");
        r.multiplier1=2;r.coinsToMass=10;near(r.giftMass(1,4),80,"custom coin settings");
        var e=new ArenaEngine(9);e.rules=r;e.gift("a","A","",1,4);
        var s=e.snakes.get("a");near(s.mass,200,"gift starts with base mass");check(e.feedings.size()==1,"food visible");
        e.tick(.1);near(s.mass,200,"not awarded before mouth animation");eat(e);near(s.mass,280,"food credited once");check(e.feedings.isEmpty(),"food removed after eating");eat(e);near(s.mass,280,"no duplicate growth");
        e=new ArenaEngine(1);e.liked("a","A","",99);check(e.snakes.isEmpty(),"99 likes wait");e.liked("a","A","",1);s=e.snakes.get("a");near(s.mass,250,"100 likes enter");
        e.liked("a","A","",99);check(e.feedings.isEmpty(),"growth remainder waits");e.liked("a","A","",1);eat(e);near(s.mass,400,"next 100 likes add150");
        e.liked("a","A","",250);eat(e);near(s.mass,700,"two growth steps");e.liked("a","A","",50);eat(e);near(s.mass,850,"growth remainder retained");
        e=new ArenaEngine(2);e.rules.likesPerJoin=50;e.rules.likesPerGrowth=25;e.rules.likeEntryMass=300;e.rules.likeGrowthMass=40;
        e.liked("a","A","",125);eat(e);near(e.snakes.get("a").mass,420,"custom entry and growth thresholds");
        e=new ArenaEngine(3);e.followed("a","A","photo");s=e.snakes.get("a");near(s.mass,300,"follow entry");e.liked("a","A","photo",100);eat(e);near(s.mass,450,"follow entrant grows every100 likes");
        e.rules.joinOnFollow=false;e.followed("b","B","photo");check(e.snakes.containsKey("b"),"follow participation always on");
        e.rules.protectionSeconds=3;near(e.join("c","C","",200).shieldUntil-e.time,3,"custom spawn protection");
        e.gift("a","A","",100,10000);e.gift("a","A","",100,10000);check(e.feedings.size()==1,"burst food coalesces");eat(e);near(s.mass,1000000,"growth capped");
        e.gift("a","A","",100,1);check(e.feedings.isEmpty(),"no food when already capped");
        e.reset();check(e.feedings.isEmpty(),"round reset clears food");
        e=new ArenaEngine(4);e.configure(320);e.seedDemo();for(int i=0;i<400;i++)e.tick(.05);
        check(e.size==320,"320 block arena");for(var snake:e.snakes.values())check(Math.abs(snake.x)+snake.radius()+1<=160.0001&&Math.abs(snake.z)+snake.radius()+1<=160.0001,"320 bounds");
        r=new ArenaRules();r.arenaSize=1001;r.musicVolume=Double.NaN;r.profileScale=100;r.likesPerGrowth=0;r.sanitize();
        check(r.arenaSize==1000&&r.profileScale==2.5&&r.likesPerGrowth==1,"settings limits");near(r.musicVolume,.22,"invalid audio resets safely");
        System.out.println("Rules checks passed: "+checks);
    }
}
