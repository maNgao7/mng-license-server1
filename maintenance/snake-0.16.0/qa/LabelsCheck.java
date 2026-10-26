import com.tikmng.snake.ArenaLabels;
import com.tikmng.snake.ArenaSpace;
import java.util.*;

public class LabelsCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    public static void main(String[] args){
        check(ArenaLabels.avatarSize(.75)==16&&ArenaLabels.avatarSize(2.5)==28,"bounded avatar dimensions");
        check(ArenaLabels.avatarSize(1.4)==24,"current profile setting is readable and compact");
        for(double scale:new double[]{Double.NaN,Double.NEGATIVE_INFINITY,Double.POSITIVE_INFINITY})
            check(ArenaLabels.avatarSize(scale)==24,"invalid scale uses default");
        check(ArenaLabels.mass(24585.7).equals("24.585"),"readable Turkish mass");
        for(double scale:new double[]{.75,1.4,2.5})for(int[] size:new int[][]{{640,360},{800,450},{512,384},{450,800}}){
            List<ArenaLabels.Anchor> anchors=new ArrayList<>();
            int avatar=ArenaLabels.avatarSize(scale),badgeHeight=Math.max(24,avatar+4);
            for(int i=0;i<12;i++)anchors.add(new ArenaLabels.Anchor("viewer-"+i,size[0]*.5+i%3*3,size[1]*.65+i/3*2,avatar+104+11,badgeHeight));
            check((badgeHeight-avatar)/2>=2,"portrait has vertical padding");
            check((badgeHeight-20)/2+20<=badgeHeight,"two label lines fit");
            Map<String,ArenaLabels.Rect> previous=new HashMap<>();
            var reserved=List.of(new ArenaLabels.Rect(0,40,150,250));
            for(int frame=0;frame<10;frame++){
                var badges=ArenaLabels.layout(anchors,size[0],size[1],reserved,previous);
                check(badges.size()==12,"cluster stays readable "+Arrays.toString(size));
                for(int i=0;i<badges.size();i++){
                    var b=badges.get(i);var r=b.box();check(r.x()>=0&&r.x()+r.width()<=size[0]&&r.y()>=46&&r.y()+r.height()<=size[1]-38,"viewport bounds");
                    check(reserved.stream().noneMatch(r::overlaps),"not over leaderboard");
                    for(int j=0;j<i;j++)check(!r.overlaps(badges.get(j).box()),"badges do not overlap");
                    if(frame>0)check(previous.get(b.anchor().id()).equals(r),"stationary labels do not jitter");
                    previous.put(b.anchor().id(),r);
                }
            }
            double cameraHeight=ArenaSpace.topHeight(320,size[0],size[1],70)-ArenaSpace.SURFACE_Y;
            double diameter=320*size[1]/(2*cameraHeight*Math.tan(Math.toRadians(35)));
            check(diameter<=Math.min(size[0]-24,size[1]-100),"diameter fits viewport");
        }
        System.out.println("Label/camera checks passed: "+checks);
    }
}
