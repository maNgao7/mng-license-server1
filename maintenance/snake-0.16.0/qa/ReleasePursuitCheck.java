import com.tikmng.snake.ArenaEngine;

public class ReleasePursuitCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    public static void main(String[] args){
        for(int tier:new int[]{1,3,5,10})for(int size:new int[]{150,320})for(int seed=1;seed<=12;seed++){
            var e=new ArenaEngine(seed);e.configure(size);e.started=true;
            var hunter=e.join("hunter","Hunter","",1000);var prey=e.joinPublisher("prey","Prey","");
            hunter.shieldUntil=prey.shieldUntil=0;
            if(tier>1)e.action(hunter.id,hunter.name,"","boost",tier,30);
            for(int tick=0;tick<1200&&e.snakes.containsKey(prey.id);tick++){e.food.clear();e.tick(.05);}
            check(hunter.kills==1,"Stationary publisher must not be orbited: tier="+tier+" size="+size+" seed="+seed+" distance="+Math.hypot(hunter.x-prey.x,hunter.z-prey.z));
        }
        for(int seed=1;seed<=10;seed++){
            var e=new ArenaEngine(seed);e.configure(150);e.requestBattle();
            for(int i=0;i<12;i++)e.join("viewer"+i,"Viewer"+i,"",i%2==0?300:250);
            for(int tick=0;tick<1000;tick++){e.tick(.05);}
            check(e.totalEaten>=3,"Natural follow/like entrants must actually capture opponents: seed="+seed);
        }
        System.out.println("Release pursuit checks passed: "+checks);
    }
}
