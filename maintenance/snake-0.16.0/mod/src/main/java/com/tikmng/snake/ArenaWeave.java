package com.tikmng.snake;

import java.util.List;

/** Visual bridges at self-crossings; the newer part passes over the older trail. */
public final class ArenaWeave {
    private ArenaWeave(){}
    public record Plan(double[] distance,double[] centers,double[] spans,double[] heights,int crossings){
        public double heightAt(double along){
            double lift=0;
            for(int i=0;i<crossings;i++){
                double t=Math.abs(along-centers[i])/spans[i];
                if(t<1)lift=Math.max(lift,heights[i]*(1+Math.cos(t*Math.PI))*.5);
            }
            return lift;
        }
        public double height(int index){return heightAt(distance[index]);}
    }
    public static Plan plan(List<ArenaEngine.Point> points,double radius){
        int n=points.size();double[] arc=new double[n],centers=new double[32],spans=new double[32],heights=new double[32];int count=0;
        for(int i=1;i<n;i++)arc[i]=arc[i-1]+Math.hypot(points.get(i).x()-points.get(i-1).x(),points.get(i).z()-points.get(i-1).z());
        double span=radius*4+1,clearance=radius*2.35+.15;
        for(int i=0;i<n-1&&count<32;i++){
            var a=points.get(i);var b=points.get(i+1);double ax=b.x()-a.x(),az=b.z()-a.z(),alen=arc[i+1]-arc[i];
            if(alen<1e-8)continue;
            for(int j=i+2;j<n-1&&count<32;j++){
                if(arc[j]-arc[i+1]<span*2)continue;
                var c=points.get(j);var d=points.get(j+1);double bx=d.x()-c.x(),bz=d.z()-c.z(),blen=arc[j+1]-arc[j];
                double cross=ax*bz-az*bx;
                if(blen<1e-8||Math.abs(cross)<alen*blen*.3)continue;
                double dx=c.x()-a.x(),dz=c.z()-a.z();
                double t=(dx*bz-dz*bx)/cross,u=(dx*az-dz*ax)/cross;
                // Extend only the leading segment so the head rises before reaching the crossing.
                double approach=i==0?span/alen:0;
                if(t< -approach||t>1||u<0||u>1)continue;
                double center=arc[i]+t*alen;boolean duplicate=false;
                for(int k=0;k<count;k++)if(Math.abs(center-centers[k])<span*.35){duplicate=true;break;}
                if(duplicate)continue;
                centers[count]=center;spans[count]=span;heights[count]=clearance;count++;
            }
        }
        return new Plan(arc,centers,spans,heights,count);
    }
}
