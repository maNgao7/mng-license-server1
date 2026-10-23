using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly List<ParticleSystem> finishBursts=new List<ParticleSystem>();
    void VenueBeam(string name,Vector3 from,Vector3 to,float thickness,Material material){
      var beam=TrackBox(name,(from+to)/2,new Vector3(thickness,(to-from).magnitude,thickness),material,false);
      beam.transform.localRotation=Quaternion.FromToRotation(Vector3.up,to-from);
    }
    void RaceGantry(float z,bool finish,Material steel,Material white,Material accent,Material dark){
      foreach(float side in new[]{-1f,1f}){
        TrackBox("Race gantry base",new Vector3(side*15.7f,.25f,z),new Vector3(2.6f,.5f,3.5f),steel,false);
        foreach(float depth in new[]{-1f,1f})TrackBox("Race gantry upright",new Vector3(side*15.7f,6.3f,z+depth*.8f),new Vector3(.3f,12.6f,.3f),steel,false);
        for(int i=0;i<6;i++)VenueBeam("Gantry lattice",new Vector3(side*15.7f,.6f+i*2,z-.8f),new Vector3(side*15.7f,2.3f+i*2,z+.8f),.12f,white);
        TrackBox("Gantry illuminated strip",new Vector3(side*15.7f,6.4f,z-.98f),new Vector3(.18f,11.4f,.08f),trackGlow,false);
        TrackBox("Gantry colored pillar",new Vector3(side*16.9f,5.4f,z),new Vector3(.7f,10.8f,1.2f),accent,false);
        TrackFlag(side*19.5f,z-6,steel,accent);
      }
      foreach(float height in new[]{10.7f,13.2f})TrackBox("Gantry cross truss",new Vector3(0,height,z),new Vector3(32,.24f,1.8f),steel,false);
      TrackBox("Race gantry sign",new Vector3(0,12,z),new Vector3(30.8f,2.1f,.45f),dark,false);
      TrackText(finish?"BİTİŞ":"TikMnG  ·  BAŞLANGIÇ",new Vector3(0,12,z-.3f),finish?12:22,1.4f);
      for(int x=-15;x<=15;x++)for(int row=0;row<2;row++)TrackBox("Gantry checker trim",new Vector3(x,10.75f+row*.28f,z-.95f),new Vector3(.96f,.27f,.06f),(x+row)%2==0?white:dark,false);
      if(!finish){
        var green=TrackMaterial(new Color(.1f,.9f,.5f));if(green.HasProperty("_EmissionColor")){green.EnableKeyword("_EMISSION");green.SetColor("_EmissionColor",new Color(.1f,.8f,.35f)*2);}
        TrackBox("Starting lamps housing",new Vector3(0,9.7f,z),new Vector3(5.8f,.9f,.6f),steel,false);
        foreach(float x in new[]{-1.8f,0,1.8f})TrackBox("Starting green light",new Vector3(x,9.7f,z-.36f),new Vector3(.65f,.65f,.12f),green,false);
      }
    }
    void BuildRaceVenue(int length,Material dark,Material steel,Material white,Material cyan,Material yellow,Material red,Material concrete,Material grass){
      finishBursts.Clear();RaceGantry(20,false,steel,white,cyan,dark);RaceGantry(length,true,steel,white,yellow,dark);
      TrackBox("Finish run-off field",new Vector3(0,-.8f,length+150),new Vector3(28,.5f,260),grass,false);
      TrackBox("Finish end barrier",new Vector3(0,.8f,length+39),new Vector3(28,1.6f,.4f),concrete,false);
      TrackBox("Finish celebration backdrop",new Vector3(0,4,length+40),new Vector3(20,4,.4f),cyan,false);TrackText("TikMnG",new Vector3(0,4,length+39.75f),13,2);
      TrackBox("Finish champions stage",new Vector3(0,.3f,length+31),new Vector3(29,.6f,15),steel,false);
      foreach(float side in new[]{-1f,1f}){
        for(int tier=0;tier<4;tier++)TrackBox("Finish grandstand tier",new Vector3(side*(21+tier*2),.6f+tier*.9f,length+12),new Vector3(2,1+tier*1.8f,35),tier%2==0?cyan:steel,false);
        for(int pillar=0;pillar<3;pillar++){
          float z=length+5+pillar*10;TrackBox("Finish light tower",new Vector3(side*30,7,z),new Vector3(.4f,14,.4f),steel,false);
          TrackBox("Finish floodlight rack",new Vector3(side*30,14,z),new Vector3(5,.7f,.8f),steel,false);
          for(int lamp=-1;lamp<=1;lamp++)TrackBox("Finish floodlight lens",new Vector3(side*30+lamp*1.4f,14,z-.5f),new Vector3(1,.5f,.12f),trackGlow,false);
        }
        for(int ribbon=0;ribbon<6;ribbon++)TrackFlag(side*(20+ribbon*2.5f),length+34,steel,ribbon%2==0?yellow:cyan);
        TrackBox("Finish victory column",new Vector3(side*12,5,length+35),new Vector3(1.5f,10,1.5f),yellow,false);
        TrackBox("Finish victory column inset",new Vector3(side*12,5,length+34.15f),new Vector3(.6f,8,.08f),trackGlow,false);
      }
      TrackBox("Finish crown beam",new Vector3(0,11,length+35),new Vector3(26,1.4f,1),steel,false);
      TrackText("TikMnG  ·  ZAFER ALANI",new Vector3(0,11,length+34.4f),22,1);
      for(int x=-13;x<=13;x++)for(int row=0;row<4;row++){
        var material=(x+row)%2==0?white:dark;
        TrackBox("Start checkerboard",new Vector3(x,.06f,20+row*.75f),new Vector3(.99f,.035f,.74f),material,false);
        TrackBox("Finish checkerboard",new Vector3(x,.06f,length-1.5f+row*.75f),new Vector3(.99f,.035f,.74f),material,false);
      }
      for(int row=0;row<3;row++)foreach(float lane in TrackLayout.LaneCenters){
        float z=-2-row*5;TrackBox("Starting grid front",new Vector3(lane,.045f,z),new Vector3(4,.03f,.18f),white,false);
        foreach(float side in new[]{-1f,1f})TrackBox("Starting grid side",new Vector3(lane+side*2,.045f,z-1.1f),new Vector3(.18f,.03f,2.2f),white,false);
      }
      foreach(float side in new[]{-1f,1f}){
        foreach(float z in new[]{0f,length-4f}){
          TrackBox("Event side apron",new Vector3(side*23,-.4f,z),new Vector3(15,.1f,34),concrete,false);
          for(int i=0;i<4;i++){
            TrackBox("Event barrier panel",new Vector3(side*15.2f,1.45f,z-12+i*7),new Vector3(.25f,2.2f,5.5f),z==0?cyan:yellow,false);
            TrackBox("Event barrier stripe",new Vector3(side*15.04f,1.45f,z-12+i*7),new Vector3(.08f,.3f,4.6f),white,false);
          }
        }
        BuildFinishConfetti(side,length,side<0?red:cyan,white);
      }
      for(int i=-1;i<=1;i++){
        float height=i==0?2.1f:i<0?1.5f:1.1f;float x=i*3.3f;
        TrackBox("Finish podium",new Vector3(x,height/2,length+31),new Vector3(3,height,4),i==0?yellow:steel,false);
        TrackText(i==0?"1":i<0?"2":"3",new Vector3(x,height*.55f,length+28.96f),1, .8f);
      }
    }
    void BuildFinishConfetti(float side,int length,Material accent,Material white){
      var go=new GameObject("Finish confetti cannon");go.transform.SetParent(trackRoot.transform,false);go.transform.localPosition=new Vector3(side*7,2,length+8);
      go.transform.localRotation=Quaternion.LookRotation(new Vector3(-side*.45f,1,.1f),Vector3.forward);
      var particles=go.AddComponent<ParticleSystem>();var main=particles.main;main.playOnAwake=false;main.loop=false;main.duration=2.5f;main.startLifetime=new ParticleSystem.MinMaxCurve(1.7f,2.5f);main.startSpeed=new ParticleSystem.MinMaxCurve(7,10);main.startSize=new ParticleSystem.MinMaxCurve(.12f,.24f);main.gravityModifier=.18f;main.maxParticles=50;main.simulationSpace=ParticleSystemSimulationSpace.World;
      main.startColor=new ParticleSystem.MinMaxGradient(accent.color,new Color(1,.85f,.15f));
      main.startSize3D=true;main.startSizeX=new ParticleSystem.MinMaxCurve(.12f,.24f);main.startSizeY=new ParticleSystem.MinMaxCurve(.25f,.45f);
      var emission=particles.emission;emission.rateOverTime=0;emission.SetBursts(new[]{new ParticleSystem.Burst(0,40)});
      var shape=particles.shape;shape.shapeType=ParticleSystemShapeType.Cone;shape.angle=24;shape.radius=.2f;
      var renderer=particles.GetComponent<ParticleSystemRenderer>();var material=new Material(Shader.Find("Universal Render Pipeline/Particles/Unlit")??Shader.Find("Sprites/Default")??white.shader);trackMaterials.Add(material);renderer.sharedMaterial=material;renderer.renderMode=ParticleSystemRenderMode.Billboard;
      particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);finishBursts.Add(particles);
    }
  }
}
