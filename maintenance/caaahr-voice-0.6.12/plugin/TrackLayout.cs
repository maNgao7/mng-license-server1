using System;
using System.Collections.Generic;

namespace TikMnG.Caaahr {
  public class TrackJump {
    public float Approach,RampStart,Lip,Landing,Height;
    public float BoostStart {get{return Approach;}}
    public bool ContainsGap(float z){return z>Lip&&z<Landing;}
  }
  public class TrackPlacement {public float Z;public int Kind;}
  public class TrackLayout {
    public const float HalfWidth=14;
    public static readonly float[] LaneCenters={-10.5f,-3.5f,3.5f,10.5f};
    public readonly List<TrackJump> Jumps=new List<TrackJump>();
    public readonly List<TrackPlacement> Obstacles=new List<TrackPlacement>();
    public readonly List<float> Crossings=new List<float>(),Hurdles=new List<float>();
    public TrackLayout(int length){
      var random=new Random(length*13+47);
      for(float start=72;start+118<length;start+=330+random.Next(0,180)){
        int n=Jumps.Count;float gap=22+n%3*4;
        Jumps.Add(new TrackJump{Approach=start,RampStart=start+16,Lip=start+34,Landing=start+34+gap,Height=3.5f+n%2*.5f});
      }
      int previous=-1;
      for(float z=35;z<length-22;z+=ObstacleSpacing(random)){
        bool reserved=false;foreach(var jump in Jumps)if(z>jump.Approach-18&&z<jump.Landing+35){reserved=true;break;}if(reserved)continue;
        int kind=Obstacles.Count==0?0:random.Next(0,6);if(kind==previous)kind=(kind+1)%6;
        Obstacles.Add(new TrackPlacement{Z=z,Kind=kind});previous=kind;
      }
      Obstacles.Sort((a,b)=>a.Z.CompareTo(b.Z));
      if(length>=600&&Obstacles.Count>=6)for(int i=0;i<6;i++)Obstacles[i].Kind=i;
      for(int i=1;i<Obstacles.Count;i++)if(Obstacles[i].Kind==Obstacles[i-1].Kind)Obstacles[i].Kind=(Obstacles[i].Kind+1)%6;
      for(float candidate=220;candidate<length-85;){
        float z=candidate;while(z<length-85&&!ClearSection(z,32))z+=14;
        if(z>=length-85)break;Crossings.Add(z);
        candidate=z+Math.Max(235,370-z*.022f)+random.Next(0,85);
      }
      for(float candidate=64;candidate<length-30;){
        float z=candidate;while(z<length-30&&(!ClearSection(z,23)||Near(Crossings,z,58)))z+=12;
        if(z>=length-30)break;Hurdles.Add(z);candidate=z+190+random.Next(0,130);
      }
    }
    bool ClearSection(float z,float clearance){foreach(var jump in Jumps)if(z>jump.Approach-35&&z<jump.Landing+40)return false;foreach(var obstacle in Obstacles)if(Math.Abs(z-obstacle.Z)<clearance)return false;return true;}
    static bool Near(List<float> points,float z,float clearance){foreach(float point in points)if(Math.Abs(point-z)<clearance)return true;return false;}
    public bool SideRoadAt(float z,float clearance){return Near(Crossings,z,clearance);}
    static int ObstacleSpacing(Random random){int type=random.Next(0,100);return type<45?random.Next(45,81):type<80?random.Next(95,151):random.Next(170,241);}
    public float SafeZ(float z,bool forward){foreach(var jump in Jumps)if(jump.ContainsGap(z))return forward?jump.Landing+5:jump.RampStart-6;return z;}
    public float GiftZ(float z,bool forward,int length){
      z=Math.Max(0,Math.Min(length,z));
      for(int pass=0;pass<4;pass++){
        float before=z;z=SafeZ(z,forward);
        foreach(var obstacle in Obstacles)if(obstacle.Kind!=2&&Math.Abs(z-obstacle.Z)<12)z=obstacle.Z+(forward?13:-13);
        foreach(float hurdle in Hurdles)if(Math.Abs(z-hurdle)<12)z=hurdle+(forward?13:-13);
        foreach(float crossing in Crossings)if(Math.Abs(z-crossing)<18)z=crossing+(forward?19:-19);
        z=Math.Max(0,Math.Min(length,z));if(Math.Abs(z-before)<.01f)break;
      }
      return z;
    }
    public float SurfaceY(float z,float x){foreach(var jump in Jumps)if(Math.Abs(x)<12&&z>=jump.RampStart&&z<=jump.Lip)return (z-jump.RampStart)/(jump.Lip-jump.RampStart)*jump.Height;return 0;}
    public float RecoveryZ(float z){foreach(var jump in Jumps)if(z>=jump.RampStart-5&&z<jump.Landing+18)return jump.Approach-6;return Math.Max(0,z-15);}
  }
}
