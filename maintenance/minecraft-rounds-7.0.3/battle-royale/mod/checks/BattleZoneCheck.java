import com.tikmng.snowwar.game.BattleZone;
import java.util.HashSet;

public class BattleZoneCheck {
    public static void main(String[] args) {
        var endings = new HashSet<String>();
        for (int run=0;run<100;run++) {
            BattleZone zone = new BattleZone();
            zone.reset(0,10);
            double lastX=0,lastZ=0,lastRadius=178;
            for (long t=1;t<=20000;t++) {
                zone.tick(t,10);
                if (Math.hypot(zone.x,zone.z)+zone.radius>178.00001)
                    throw new AssertionError("Circle escaped map");
                if (Math.hypot(zone.targetX-zone.x,zone.targetZ-zone.z)+zone.targetRadius>zone.radius+0.00001)
                    throw new AssertionError("Target escaped current circle");
                if (Math.hypot(zone.x-lastX,zone.z-lastZ)>0.5 || zone.radius>lastRadius+0.00001)
                    throw new AssertionError("Circle jumped or expanded");
                if (zone.progress(t)<0 || zone.progress(t)>1 || zone.secondsLeft(t)<0)
                    throw new AssertionError("Invalid timer");
                lastX=zone.x;lastZ=zone.z;lastRadius=zone.radius;
            }
            if (Math.abs(zone.radius-BattleZone.MIN_RADIUS)>1e-9) throw new AssertionError("No final point circle");
            if (!Double.isFinite(zone.x+zone.z+zone.radius) || zone.radius<=0) throw new AssertionError("Invalid final point");
            if (zone.outside(zone.x,zone.z) || !zone.outside(zone.x+.026,zone.z)) throw new AssertionError("Final 5cm diameter boundary");
            endings.add(Math.round(zone.x)+","+Math.round(zone.z));
        }
        if (endings.size()<90) throw new AssertionError("Final positions repeated too often");
        checkFinalPace(10);checkFinalPace(60);checkFinalPace(120);
        System.out.println("PASS: 100 rounds, nested circles, map bounds, smooth movement, 1m/10sec finale, 5cm final diameter, random finals");
    }

    private static void checkFinalPace(int interval) {
        BattleZone zone=new BattleZone();zone.reset(0,interval);
        long time=0;
        while(zone.radius>12 && time<1000000)zone.tick(++time,interval);
        if (zone.radius!=12)throw new AssertionError("Final phase must start exactly at 12m");
        for(int step=1;step<=12;step++) {
            double before=zone.radius;
            for(int tick=1;tick<=200;tick++) {
                zone.force(time);
                zone.tick(++time,interval);
                double expected=before+(Math.max(BattleZone.MIN_RADIUS,before-1)-before)*tick/200.0;
                if(Math.abs(zone.radius-expected)>1e-9)throw new AssertionError("Final pace changed at step "+step+" tick "+tick);
            }
        }
        if(zone.radius!=BattleZone.MIN_RADIUS || zone.moving)throw new AssertionError("Final phase did not stop at positive point");
        double x=zone.x,z=zone.z;int phase=zone.phase;
        for(int tick=0;tick<2000;tick++)zone.tick(++time,interval);
        if(zone.x!=x||zone.z!=z||zone.radius!=BattleZone.MIN_RADIUS||zone.phase!=phase||zone.secondsLeft(time)!=0)
            throw new AssertionError("Final point drifted or timer restarted");
    }
}
