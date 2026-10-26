using System;
using TikMnG.Caaahr;

class TrackLayoutTests {
  static int assertions;
  static void Check(bool condition,string name){assertions++;if(!condition)throw new Exception(name);}
  static int Main(){
    for(int length=100;length<=5000;length++){
      var layout=new TrackLayout(length);int previous=-1;float last=0;
      Check(TrackLayout.HalfWidth==14&&TrackLayout.LaneCenters.Length==4,"four seven metre lanes");
      foreach(float z in layout.Crossings){Check(z>=220&&z<length-85,"junction before finish");foreach(var jump in layout.Jumps)Check(z<=jump.Approach-35||z>=jump.Landing+40,"traffic never in ramp flight corridor");foreach(var obstacle in layout.Obstacles)Check(Math.Abs(z-obstacle.Z)>=32,"junction approach free of old hazards");}
      foreach(float z in layout.Hurdles){Check(z>=64&&z<length-30,"small hurdle bounded");foreach(float crossing in layout.Crossings)Check(Math.Abs(z-crossing)>=58,"no compulsory jump in traffic junction");foreach(var jump in layout.Jumps)Check(z<=jump.Approach-35||z>=jump.Landing+40,"manual jump separate from auto ramp");}
      foreach(float z in layout.Hurdles)foreach(bool forward in new[]{true,false})Check(Math.Abs(layout.GiftZ(z,forward,length)-z)>=12,"gift clears manual hurdle");
      foreach(float z in layout.Crossings)foreach(bool forward in new[]{true,false})Check(Math.Abs(layout.GiftZ(z,forward,length)-z)>=18,"gift avoids live traffic crossing");
      var hazards=new System.Collections.Generic.List<float>(layout.Hurdles);hazards.AddRange(layout.Crossings);foreach(var old in layout.Obstacles)hazards.Add(old.Z);
      foreach(float z in hazards)foreach(bool forward in new[]{true,false}){
        float safe=layout.GiftZ(z,forward,length);
        foreach(float hurdle in layout.Hurdles)Check(Math.Abs(safe-hurdle)>=12,"safe landing never overlaps another hurdle");
        foreach(float junction in layout.Crossings)Check(Math.Abs(safe-junction)>=18,"safe landing never overlaps another junction");
        foreach(var obstacle in layout.Obstacles)if(obstacle.Kind!=2)Check(Math.Abs(safe-obstacle.Z)>=12,"safe landing never overlaps another padded obstacle");
        foreach(var jump in layout.Jumps)Check(!jump.ContainsGap(safe),"safe landing never falls in another pit");
      }
      foreach(var obstacle in layout.Obstacles){
        Check(obstacle.Z>last&&obstacle.Z<length-20,"placement bounds");last=obstacle.Z;
        Check(obstacle.Kind>=0&&obstacle.Kind<6&&obstacle.Kind!=previous,"variety");previous=obstacle.Kind;
        foreach(var jump in layout.Jumps)Check(obstacle.Z<=jump.Approach-18||obstacle.Z>=jump.Landing+35,"jump corridor clear");
      }
      foreach(var jump in layout.Jumps){
        Check(jump.Landing<length-40&&jump.Landing>jump.Lip,"jump before finish");
        float middle=(jump.Lip+jump.Landing)/2;
        Check(layout.SafeZ(middle,true)>jump.Landing&&layout.SafeZ(middle,false)<jump.RampStart,"gift safe destination");
        Check(layout.RecoveryZ(middle)<jump.RampStart,"recovery before ramp");
        Check(Math.Abs(layout.SurfaceY(jump.Lip,0)-jump.Height)<.001,"ramp height");
      }
      foreach(var obstacle in layout.Obstacles)foreach(bool forward in new[]{true,false}){
        float safe=layout.GiftZ(obstacle.Z,forward,length);Check(safe>=0&&safe<=length,"gift landing bounded");
        foreach(var other in layout.Obstacles)if(other.Kind!=2)Check(Math.Abs(safe-other.Z)>=12,"gift never lands on obstacle");
        foreach(var jump in layout.Jumps)Check(!jump.ContainsGap(safe),"gift never lands in jump pit");
      }
      if(length>=2000)for(int kind=0;kind<6;kind++){int wanted=kind;Check(layout.Obstacles.Exists(o=>o.Kind==wanted),"all six types: "+length);}
    }
    Console.WriteLine(assertions+" track layout checks passed.");return 0;
  }
}
