import com.tikmng.snake.ArenaEngine.Point;
import com.tikmng.snake.ArenaWeave;
import java.util.*;

public class WeaveCheck {
    private static int checks;
    private static void check(boolean value,String name){checks++;if(!value)throw new AssertionError(name);}
    public static void main(String[] args){
        var path=new ArrayList<Point>();
        for(int i=0;i<=240;i++){double t=-Math.PI*.5+i*Math.PI*2/240;path.add(new Point(15*Math.sin(t),12*Math.sin(t)*Math.cos(t)));}
        var plan=ArenaWeave.plan(path,1);
        check(plan.crossings()>0,"figure eight forms a bridge");
        double maximum=0;for(int i=0;i<path.size();i++){double h=plan.height(i);check(Double.isFinite(h)&&h>=0&&h<=2.5,"bounded finite lift");maximum=Math.max(maximum,h);}
        check(maximum>2.45,"bridge clears full older body");
        check(plan.height(180)==0,"older crossing remains below");
        check(plan.height(0)==0&&plan.height(path.size()-1)==0,"distant head and tail stay grounded");
        double center=plan.centers()[0],span=plan.spans()[0];
        check(plan.heightAt(center-span-.01)==0&&plan.heightAt(center+span+.01)==0,"smooth arch ends grounded");
        check(Math.abs(plan.heightAt(center-span+.001)-plan.heightAt(center-span))<.00001,"no hard vertical step");
        double[] approaches={-5.001,-5,-4.999,-4,-3,-2,-1,0};double last=0;
        for(double x:approaches){
            var approach=List.of(new Point(x,0),new Point(x-2,0),new Point(-20,0),new Point(-20,-20),new Point(0,-20),new Point(0,20));
            double lift=ArenaWeave.plan(approach,1).height(0);
            check(lift>=last-.00001,"head rises progressively on approach");
            if(x< -4.99)check(lift<.00001,"head bridge starts without pop");last=lift;
        }
        for(var points:List.of(List.of(new Point(0,0),new Point(10,0),new Point(20,0)),List.of(new Point(0,0),new Point(0,0)),List.<Point>of()))
            check(ArenaWeave.plan(points,1).crossings()==0,"degenerate and adjacent path not raised");
        var straight=new ArrayList<Point>();for(int i=0;i<181;i++)straight.add(new Point(i,0));
        long start=System.nanoTime();for(int i=0;i<9600;i++)ArenaWeave.plan(straight,1);
        System.out.println("Weave checks passed: "+checks+", 96-snake plan average ms="+(System.nanoTime()-start)/1000000.0/100);
    }
}
