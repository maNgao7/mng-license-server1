package com.tikmng.snake;

import java.util.*;

/** Screen-space layout shared by the HUD and the headless overlap checks. */
public final class ArenaLabels {
    public record Rect(int x,int y,int width,int height){
        public boolean overlaps(Rect other){return x<other.x+other.width+3&&x+width+3>other.x&&y<other.y+other.height+3&&y+height+3>other.y;}
        public boolean contains(double px,double py){return px>=x&&px<x+width&&py>=y&&py<y+height;}
    }
    public record Anchor(String id,double x,double y,int width,int height){}
    public record Badge(Anchor anchor,Rect box){}
    private ArenaLabels(){}
    public static int avatarSize(double scale){return (int)Math.round(Math.max(16,Math.min(28,24*(Double.isFinite(scale)?scale:1.4)/1.4)));}
    public static String mass(double value){return String.format(Locale.forLanguageTag("tr-TR"),"%,d",(long)Math.max(0,Math.floor(value)));}
    public static List<Badge> layout(List<Anchor> anchors,int width,int height,List<Rect> reserved,Map<String,Rect> previous){
        List<Badge> placed=new ArrayList<>();
        for(Anchor a:anchors){
            Rect best=null,old=previous.get(a.id);double score=Double.POSITIVE_INFINITY;
            int baseX=(int)Math.round(a.x-a.width/2.0),baseY=(int)Math.round(a.y-a.height-10);
            for(int row=-7;row<=7;row++)for(int column=-5;column<=5;column++){
                int x=Math.max(4,Math.min(width-a.width-4,baseX+column*(a.width+5)/2));
                int y=Math.max(46,Math.min(height-a.height-38,baseY+row*(a.height+5)));
                Rect candidate=new Rect(x,y,a.width,a.height);
                if(reserved.stream().anyMatch(candidate::overlaps)||placed.stream().anyMatch(b->candidate.overlaps(b.box)))continue;
                double dx=x-baseX,dy=y-baseY,cost=dx*dx+dy*dy;
                if(old!=null)cost+=.45*((x-old.x)*(double)(x-old.x)+(y-old.y)*(double)(y-old.y));
                if(cost<score){score=cost;best=candidate;}
            }
            if(best!=null)placed.add(new Badge(a,best));
        }
        return List.copyOf(placed);
    }
}
