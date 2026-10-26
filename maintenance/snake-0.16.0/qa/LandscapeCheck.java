import com.tikmng.snake.ArenaLandscape;
import com.tikmng.snake.ArenaSpace;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;

public class LandscapeCheck {
    private static int checks;
    private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
    private static long key(int x,int z){return (long)x<<32|(z&0xffffffffL);}
    public static void main(String[] args){
        check(ArenaLandscape.VERSION==13,"landscape cache invalidated");
        check(ArenaLandscape.MARGIN<=64&&ArenaLandscape.BUILD_HEIGHT==19,"bounded existing build volume");
        check(ArenaSpace.FLOOR_Y==-61&&ArenaSpace.SURFACE_Y==-60,"native grass elevation");
        for(int size:new int[]{32,96,150,160,320,1000}){
            int half=size/2,trees=0,hills=0,water=0,rocks=0,details=0,posts=0;
            Set<Long> ring=new HashSet<>(),trunks=new HashSet<>();
            Set<Integer> treeHeights=new HashSet<>(),treeOffsets=new HashSet<>();
            boolean oak=false,birch=false;
            check(ArenaLandscape.height(0,0,half)==0,"play area remains ground level");
            check(ArenaLandscape.inside(half,0,half)&&!ArenaLandscape.inside(half,half,half),"circular playable radius");
            check(ArenaLandscape.surface(half+3,0,half)==ArenaLandscape.Surface.GRAVEL,"wide perimeter promenade");
            check(ArenaLandscape.surface(half+8,0,half)==ArenaLandscape.Surface.GRASS,"native QA grass probe");
            check(ArenaLandscape.surface(half+1,0,half)==ArenaLandscape.Surface.CURB,"stone curb beside fence");
            check(ArenaLandscape.surface(half+5,3,half)==ArenaLandscape.Surface.PAVING,"stone edging outside gravel");
            check(ArenaLandscape.surface(half+6,0,half)==ArenaLandscape.Surface.ACCENT,"cardinal insets match tower colors");
            int garden=(int)Math.round((half+8)/Math.sqrt(2));
            for(int sx:new int[]{-1,1})for(int sz:new int[]{-1,1}){
                check(ArenaLandscape.surface(sx*garden,sz*garden,half)==ArenaLandscape.Surface.GRAVEL,"four diagonal garden spurs");
                check(ArenaLandscape.surface(sx*(garden+2),sz*(garden-1),half)==ArenaLandscape.Surface.CURB,"garden spur stone edging");
            }
            for(int x=-half-ArenaLandscape.MARGIN;x<=half+ArenaLandscape.MARGIN;x++)for(int z=-half-ArenaLandscape.MARGIN;z<=half+ArenaLandscape.MARGIN;z++){
                boolean inside=ArenaLandscape.inside(x,z,half),fence=ArenaLandscape.fence(x,z,half);
                double outside=ArenaLandscape.outside(x,z,half);
                var surface=ArenaLandscape.surface(x,z,half);
                int height=ArenaLandscape.height(x,z,half);if(height>0)hills++;
                int rock=ArenaLandscape.rockHeight(x,z,half);if(rock>0)rocks++;
                var detail=ArenaLandscape.detail(x,z,half);if(detail!=ArenaLandscape.Detail.NONE)details++;
                var t=ArenaLandscape.tree(x,z,half);
                check(height>=0&&height<=6&&rock<=2,"bounded terrain height");
                if(inside){
                    check(height==0&&t==null&&rock==0&&detail==ArenaLandscape.Detail.NONE,"no raised scenery inside arena");
                    check(surface==ArenaLandscape.Surface.GRASS,"flat native grass field");
                }
                if(outside<=10)check(height==0&&t==null&&rock==0&&(outside>6||detail==ArenaLandscape.Detail.NONE),"clear apron and low flowers around fence");
                if(surface==ArenaLandscape.Surface.CURB||surface==ArenaLandscape.Surface.GRAVEL
                    ||surface==ArenaLandscape.Surface.PAVING||surface==ArenaLandscape.Surface.ACCENT){
                    check(outside>0&&outside<=10&&height==0&&t==null&&rock==0&&detail==ArenaLandscape.Detail.NONE,"flat clear paving confined to existing apron");
                }
                if(outside>=ArenaLandscape.MARGIN)check(height==0&&t==null&&rock==0&&detail==ArenaLandscape.Detail.NONE&&surface==ArenaLandscape.Surface.GRASS,"no work beyond radial margin");
                if(fence){ring.add(key(x,z));check(inside&&outside>-1.5,"thin inner fence ring");}
                if(ArenaLandscape.edge(x,z,half))check(fence,"all exposed circle edges fenced");
                if(ArenaLandscape.post(x,z,half)){posts++;check(fence&&!ArenaLandscape.tower(x,z,half),"posts on perimeter between towers");}
                if(surface==ArenaLandscape.Surface.WATER){
                    water++;check(outside>10&&height==0&&t==null&&rock==0,"pond outside arena on fixed water level");
                    for(int[] d:new int[][]{{1,0},{-1,0},{0,1},{0,-1}}){
                        var bank=ArenaLandscape.surface(x+d[0],z+d[1],half);
                        check(bank==ArenaLandscape.Surface.WATER||bank==ArenaLandscape.Surface.SAND,"contained pond with native shoreline");
                    }
                }
                if(t!=null){
                    check(outside>10&&outside<ArenaLandscape.MARGIN,"entire canopy outside clear border");
                    check(t.equals(ArenaLandscape.tree(x,z,half)),"deterministic canopy selection");
                    check(t.ground()+t.height()+3<ArenaLandscape.BUILD_HEIGHT,"tree fits existing vertical build budget");
                    check(t.equals(ArenaLandscape.tree(t.x(),t.z(),half)),"every crown has a matching trunk");
                    if(t.x()==x&&t.z()==z){
                        trees++;trunks.add(key(x,z));treeHeights.add(t.height());treeOffsets.add(Math.floorMod(x,16));
                        oak|=!t.birch();birch|=t.birch();
                        check(ArenaLandscape.outside(x,z,half)>=14,"trunk kept beyond promenade");
                    }
                }
            }
            Set<Long> reached=new HashSet<>();ArrayDeque<Long> queue=new ArrayDeque<>();
            queue.add(key(half,0));reached.add(key(half,0));
            while(!queue.isEmpty()){
                long cell=queue.remove();int x=(int)(cell>>32),z=(int)cell;
                for(int[] d:new int[][]{{1,0},{-1,0},{0,1},{0,-1}}){
                    long neighbor=key(x+d[0],z+d[1]);
                    if(ring.contains(neighbor)&&reached.add(neighbor))queue.add(neighbor);
                }
            }
            check(reached.equals(ring),"continuous four-connected circular fence");
            for(int[] cardinal:new int[][]{{half,0},{-half,0},{0,half},{0,-half}}){
                check(ArenaLandscape.tower(cardinal[0],cardinal[1],half),"four cardinal tower anchors");
                check(ring.contains(key(cardinal[0],cardinal[1])),"tower joins fence");
            }
            check(!ArenaLandscape.tower(half,half,half),"old square corners removed");
            check(ArenaLandscape.fence(half-1,2,half)&&!ArenaLandscape.tower(half-1,2,half)
                &&!ArenaLandscape.post(half-1,2,half),"native QA oak fence probe away from towers and posts");
            check(posts>=4&&posts<=Math.max(48,size/6),"bounded angular perimeter lights");
            check(trunks.size()==trees&&trees>=8&&trees<Math.max(240,size),"bounded varied groves at size "+size);
            check(oak&&birch&&treeHeights.size()>=3&&treeOffsets.size()>=3,"varied tree species, scale and spacing");
            check(hills>100&&water>80&&rocks>10&&details>100,"native terrain, ponds, rocks and meadow detail");
            System.out.println("size="+size+" ring="+ring.size()+" trees="+trees+" pondBlocks="+water+" rockColumns="+rocks+" posts="+posts);
        }
        System.out.println("Landscape checks passed: "+checks);
    }
}
