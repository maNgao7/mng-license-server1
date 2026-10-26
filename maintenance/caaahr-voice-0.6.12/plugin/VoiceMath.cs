using System;
using System.Collections.Generic;

namespace TikMnG.Caaahr {
  internal static class VoiceMath {
    public static float Level(float[] samples){
      if(samples==null||samples.Length==0)return -80;
      double energy=0;
      foreach(float sample in samples){if(float.IsNaN(sample)||float.IsInfinity(sample))return -80;energy+=(double)sample*sample;}
      return (float)Math.Max(-80,Math.Min(0,20*Math.Log10(Math.Max(.0001,Math.Sqrt(energy/samples.Length)))));
    }
    public static float Target(float db,float noise,float full){
      if(float.IsNaN(db)||float.IsInfinity(db)||db<=noise)return 0;
      return Math.Max(0,Math.Min(1,(db-noise)/Math.Max(6,full-noise)));
    }
    public static float Smooth(float previous,float target,float seconds,float dt){
      if(target<=0)return 0;
      return previous+(target-previous)*(1-(float)Math.Exp(-Math.Max(0,dt)/Math.Max(.05,Math.Min(2,seconds))));
    }
    public static float DriveTarget(float voice,bool keyboard,bool enabled,float keyboardAxis=0){
      float demand=enabled&&!float.IsNaN(voice)&&!float.IsInfinity(voice)?Math.Max(0,Math.Min(1,voice)):0;
      return keyboard?float.IsNaN(keyboardAxis)||float.IsInfinity(keyboardAxis)?0:Math.Min(1,Math.Abs(keyboardAxis)):demand;
    }
    public static float EasyTarget(float db,float floor,float sensitivity){
      float margin=12-9*Math.Max(0,Math.Min(1,sensitivity));
      float gate=floor+margin;
      if(float.IsNaN(db)||float.IsInfinity(db)||db<=gate)return 0;
      float full=Math.Max(gate+12,Math.Min(-32,gate+27));
      float amount=Math.Max(0,Math.Min(1,(db-gate)/(full-gate)));
      return .18f+.82f*(float)Math.Pow(amount,1.05);
    }
  }
  internal sealed class VoiceEnvelope {
    public float Floor=-72,Demand;public bool Ready;
    float elapsed,silentFor;readonly List<float> ambient=new List<float>();
    public void Reset(){Floor=-72;Demand=0;Ready=false;elapsed=0;silentFor=0;ambient.Clear();}
    public float Process(float db,float dt,float sensitivity,bool valid){
      if(!valid||float.IsNaN(db)||float.IsInfinity(db)){Demand=0;silentFor=1;return 0;}
      dt=Math.Max(0,Math.Min(.1f,dt));
      if(!Ready){ambient.Add(db);elapsed+=dt;if(elapsed<.65f)return 0;ambient.Sort();Floor=Math.Max(-78,Math.Min(0,ambient[ambient.Count/2]));ambient.Clear();Ready=true;}
      if(db<Floor)Floor+=(db-Floor)*(1-(float)Math.Exp(-dt/.12f));
      else if(db<Floor+2)Floor=Math.Min(db,Floor+dt*.3f);
      Floor=Math.Max(-78,Math.Min(0,Floor));
      float target=VoiceMath.EasyTarget(db,Floor,sensitivity);
      if(target>0){silentFor=0;Demand=target;}
      else{silentFor+=dt;if(silentFor>=.14f)Demand=0;}
      return Demand;
    }
  }
}
