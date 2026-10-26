import com.tikmng.snake.ArenaEngine;

public class ManualBattleCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    private static void step(ArenaEngine e,int count){for(int i=0;i<count;i++){e.food.clear();e.tick(.1);}}
    private static void close(double actual,double expected,String label){check(Math.abs(actual-expected)<1e-7,label+": "+actual);}
    private static void lifecycle(int population){
        var e=new ArenaEngine(81);e.configure(1000);
        check(e.snakes.isEmpty()&&!e.started&&e.battleCountdownRemaining()==-1,"empty waiting default");
        for(int i=0;i<population;i++)e.join("v"+i,"V"+i,"",300).shieldUntil=1000;
        step(e,120);check(!e.started&&e.totalEaten==0&&e.totalTailBites==0,"population never auto starts: "+population);
        check(e.requestBattle(),"O arms countdown");close(e.battleCountdownRemaining(),10,"full countdown");
        check(!e.requestBattle(),"repeated O ignored during countdown");
        e.paused=true;step(e,10);close(e.battleCountdownRemaining(),10,"pause freezes countdown");e.paused=false;
        e.tick(Double.NaN);e.tick(-1);close(e.battleCountdownRemaining(),10,"invalid ticks ignored");
        step(e,99);check(!e.started,"waiting at9.9");close(e.battleCountdownRemaining(),.1,"last tenth");
        step(e,1);check(e.started&&e.battleCountdownRemaining()==-1,"starts at10 with population "+population);
        close(e.battleAnnouncementRemaining(),2,"announcement begins");
        double at=e.battleStartedAt;check(!e.requestBattle()&&e.battleStartedAt==at,"active O idempotent");
        check(e.winner.isEmpty()&&e.winners().isEmpty()&&e.survivorRemaining()==-1,"starting never invents a winner");
        step(e,19);check(e.battleAnnouncementRemaining()>.09,"announcement lasts two seconds");
        step(e,2);check(e.battleAnnouncementRemaining()==0,"announcement expires");
        e.reset();check(!e.started&&e.battleStartedAt==-1&&e.battleCountdownRemaining()==-1,"reset returns waiting");
        check(e.requestBattle(),"new round can request");e.reset();check(e.battleCountdownRemaining()==-1,"reset cancels countdown");
    }
    private static void waitingContact(){
        var e=new ArenaEngine(53);e.configure(320);
        var a=e.join("a","A","",900);var b=e.join("b","B","",900);
        a.x=-4;a.z=0;a.angle=0;b.x=4;b.z=0;b.angle=Math.PI;e.configure(320);
        a.shieldUntil=b.shieldUntil=0;e.action("a","A","","boost",10,30);e.action("b","B","","boost",10,30);
        e.requestBattle();
        for(int i=0;i<99;i++){
            e.food.clear();e.tick(.1);
            check(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius()+b.radius()-.03,"waiting head separation");
            check(e.totalEaten==0&&e.totalTailBites==0&&!e.started,"no countdown bites");
            check(!a.intent.equals("AVLANIYOR")&&!b.intent.equals("AVLANIYOR"),"waiting has no hunting intent");
        }
        e=new ArenaEngine(54);e.configure(320);var wall=e.join("wall","Wall","",900);var mover=e.joinPublisher("host","Host","");
        wall.x=wall.z=0;wall.angle=0;e.configure(320);var hit=wall.body().get(wall.body().size()/2);
        mover.x=hit.x();mover.z=hit.z()-4;mover.angle=Math.PI/2;wall.shieldUntil=mover.shieldUntil=0;e.configure(320);
        e.publisherDirection(0,1);e.action(mover.id,mover.name,"","boost",10,30);e.food.clear();e.tick(.1);
        check(mover.z<hit.z()+.1&&e.totalTailBites==0,"waiting unshielded body barrier");
    }
    private static void growthAndGalaxy(){
        var e=new ArenaEngine(51);e.configure(150);var owner=e.joinPublisher("host","Host","portrait");
        e.food.clear();e.food.add(new ArenaEngine.Point(owner.x,owner.z));e.tick(.001);close(owner.mass,305,"waiting food grows");
        e.feed(owner.id,owner.name,owner.profile,95,1);step(e,9);close(owner.mass,400,"waiting profile gift grows");
        e.galaxy(15,5);check(e.requestBattle(),"battle can be requested during galaxy");step(e,100);
        check(e.started&&e.galaxyActive()&&e.renderSnakes().size()==5,"galaxy cannot block battle countdown");
        e.removeSnake(owner.id);step(e,120);check(e.snakes.isEmpty()&&e.winner.isEmpty()&&e.winners().isEmpty(),"P during split never fakes winner");
    }
    public static void main(String[] args){lifecycle(0);lifecycle(1);lifecycle(96);waitingContact();growthAndGalaxy();System.out.println("Manual battle checks passed: "+checks);}
}
