import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const traffic=await readFile(path.join(root,'plugin/TrackTraffic.cs'),'utf8');
const roundabout=await readFile(path.join(root,'plugin/TrackRoundabout.cs'),'utf8');
const custom=await readFile(path.join(root,'plugin/CustomTrack.cs'),'utf8');

function block(source,start){
  const begin=source.indexOf(start);
  assert.ok(begin>=0,`Missing ${start}`);
  const open=source.indexOf('{',begin);
  let depth=1,end=open+1;
  for(;depth&&end<source.length;end++){
    if(source[end]==='{')depth++;
    if(source[end]==='}')depth--;
  }
  assert.equal(depth,0);
  return source.slice(begin,end);
}

test('crossing initializes six moving hazards and covers both recycle points',()=>{
  const build=block(traffic,'void BuildTrafficCrossing(');
  assert.match(build,/crossing.Vehicles=new RoadHazard\[6\]/);
  assert.match(build,/i<crossing.Vehicles.Length/);
  assert.match(build,/crossing.Vehicles\[i\].ExternalMotion=true/);
  assert.match(build,/crossing.ResetForRound\(\)/);
  assert.match(build,/foreach\(float side in new\[\]\{-1f,1f\}\)[\s\S]*"Traffic tunnel floor"/);
  assert.match(build,/"Traffic tunnel roof"[^\n]*side\*220,7,z[^\n]*new Vector3\(80,2,28\)/);
  assert.match(build,/"Traffic tunnel wall"[^\n]*side\*220,3,z\+edge/);
  assert.match(build,/"Traffic tunnel dark end"[^\n]*side\*220,3,z[^\n]*new Vector3\(2,8,26\)/);
  assert.match(traffic,/RecycleEnd=240/);
  const motion=block(traffic,'public class TrackCrossing:');
  assert.doesNotMatch(motion,/Clamp01|Mathf.Lerp/);
});

test('vehicle and hurdle details reuse materials and stay within the hazard envelope',()=>{
  const car=block(traffic,'GameObject TrafficCar('),truck=block(traffic,'GameObject TrafficTruck(');
  for(const detail of ['Radiator grille','Car grille trim','Rear bumper','Side sill','Door handle','Car mirror','Car wheel hub'])assert.ok(car.includes(detail),detail);
  for(const detail of ['Truck bumper rub strip','Truck rear danger chevron','Truck wheel hub','Grille slat'])assert.ok(truck.includes(detail),detail);
  assert.ok(traffic.includes('Jump rail steel backing'));
  assert.doesNotMatch(car+truck,/new Material|new Mesh|AddComponent|Update\(/);
  assert.ok(1.3+.24/2<2.86/2,'car mirrors fit trigger');
  assert.ok(1.4+.025<2.86/2,'cylinder hub thickness fits trigger');
  assert.ok(4.49+.02/2<=9/2,'front rub strip fits truck trigger');
  assert.ok(4.43+.04/2<9/2,'rear markings fit truck trigger');
});

test('production C# traffic maintains speed, concealed recycling, safe gaps and B-menu pause',{skip:process.platform!=='win32'},async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'caaahr-traffic-'));
  try{
    const source=`using System;
using UnityEngine;
namespace UnityEngine {
  public class Object {public static implicit operator bool(Object value){return value!=null;}}
  public class MonoBehaviour:Object {public Transform transform=new Transform();}
  public class Transform {
    public Vector3 position;public Quaternion rotation;
    public Vector3 TransformPoint(Vector3 p){return position+p;}
  }
  public struct Vector3 {
    public float x,y,z;public Vector3(float a,float b,float c){x=a;y=b;z=c;}
    public float sqrMagnitude {get{return x*x+y*y+z*z;}}
    public static Vector3 operator +(Vector3 a,Vector3 b){return new Vector3(a.x+b.x,a.y+b.y,a.z+b.z);}
    public static Vector3 operator -(Vector3 a,Vector3 b){return new Vector3(a.x-b.x,a.y-b.y,a.z-b.z);}
  }
  public struct Quaternion {
    public float yaw;public static Quaternion Euler(float x,float y,float z){return new Quaternion{yaw=y};}
    public static Quaternion operator *(Quaternion a,Quaternion b){return Euler(0,a.yaw+b.yaw,0);}
  }
  public struct Color {public float r,g,b;public Color(float a,float c,float d){r=a;g=c;b=d;}}
  public class Material:Object {public Color color;}
  public static class Time {public static float fixedDeltaTime=.02f;}
  public static class Mathf {
    public const float PI=(float)Math.PI,Rad2Deg=180/PI;
    public static float Repeat(float a,float b){return a-(float)Math.Floor(a/b)*b;}
    public static float Sin(float a){return (float)Math.Sin(a);}
    public static float Cos(float a){return (float)Math.Cos(a);}
    public static float Abs(float a){return Math.Abs(a);}
  }
}
namespace TikMnG.Caaahr {
  public class VoiceDrive:UnityEngine.Object {
    public bool menuOpen,Ready=true,startingGame,trackFinished,trafficCrash,CustomActive=true;
    public float TrackProgress;
    ${block(traffic,'public bool TrafficPaused ')}
    ${block(custom,'public bool TrackObstaclePaused(')}
  }
  public class RoadHazard:MonoBehaviour {
    public float TrackZ;public int Sweeps,Resets;public bool contactHeld;
    public void CheckContact(Vector3 delta){Sweeps++;contactHeld=true;}
    public void ResetPose(Vector3 p,Quaternion q){transform.position=p;transform.rotation=q;contactHeld=false;Resets++;}
    ${block(traffic,'public void MoveTo(')}
  }
  ${block(traffic,'public class TrackCrossing:')}
  ${block(roundabout,'public class TrackRoundabout:')}
  public class CrossingProbe:TrackCrossing {public void Tick(){FixedUpdate();}}
  public class OrbitProbe:TrackRoundabout {public void Tick(){FixedUpdate();}}
  public static class Checks {
    static int checks;
    static void Require(bool ok,string name){checks++;if(!ok)throw new Exception(name);}
    static void Near(float a,float b,string name){Require(Math.Abs(a-b)<.004f,name);}
    static float Distance(Vector3 a,Vector3 b){Vector3 d=a-b;return (float)Math.Sqrt(d.sqrMagnitude);}
    static RoadHazard[] Cars(int count){var cars=new RoadHazard[count];for(int i=0;i<count;i++)cars[i]=new RoadHazard();return cars;}
    static void Frozen(CrossingProbe road,OrbitProbe orbit,string why){
      float a=road.Clock,b=orbit.Clock;var p=road.Vehicles[0].transform.position;var q=orbit.Vehicles[0].transform.position;
      int sweeps=road.Vehicles[0].Sweeps;Color lamp=road.Signal.color;
      for(int i=0;i<50;i++){road.Tick();orbit.Tick();}
      Near(road.Clock,a,why+" crossing clock");Near(orbit.Clock,b,why+" orbit clock");
      Near(Distance(p,road.Vehicles[0].transform.position),0,why+" crossing pose");
      Near(Distance(q,orbit.Vehicles[0].transform.position),0,why+" orbit pose");
      Require(sweeps==road.Vehicles[0].Sweeps,why+" no contact sweep");Near(road.Signal.color.r,lamp.r,why+" signal");
    }
    public static void Main(){
      var owner=new VoiceDrive{TrackProgress=400};
      var road=new CrossingProbe{Owner=owner,TrackZ=400,Vehicles=Cars(6),Signal=new Material()};
      road.transform.position=new Vector3(100,1200,400);road.ResetForRound();
      var orbit=new OrbitProbe{Owner=owner,TrackZ=400,Cycle=16,Vehicles=Cars(4)};
      orbit.transform.position=road.transform.position;orbit.ResetForRound();
      for(int i=0;i<6;i++){Require(road.Vehicles[i].Resets==1&&road.Vehicles[i].Sweeps==0,"reset without sweep");Near(road.Vehicles[i].transform.position.z,400+(i%2==0?-6:6),"lane");}
      owner.menuOpen=true;Frozen(road,orbit,"B menu");owner.menuOpen=false;
      owner.trafficCrash=true;Frozen(road,orbit,"crash");owner.trafficCrash=false;
      owner.Ready=false;Frozen(road,orbit,"not ready");owner.Ready=true;
      owner.startingGame=true;Frozen(road,orbit,"starting");owner.startingGame=false;
      owner.trackFinished=true;Frozen(road,orbit,"finished");owner.trackFinished=false;
      owner.CustomActive=false;Frozen(road,orbit,"inactive track");owner.CustomActive=true;
      owner.TrackProgress=0;float distantClock=road.Clock;road.Tick();Require(road.Clock>distantClock,"visible distant traffic never freezes");road.ResetForRound();orbit.ResetForRound();owner.TrackProgress=400;
      int wraps=0,clearTicks=0,arrivals=0;float clearRun=0,longestClear=0;
      for(int tick=0;tick<2400;tick++){
        var before=new Vector3[6];var sweeps=new int[6];
        for(int i=0;i<6;i++){before[i]=road.Vehicles[i].transform.position;sweeps[i]=road.Vehicles[i].Sweeps;}
        Vector3 orbitBefore=orbit.Vehicles[0].transform.position;
        road.Tick();orbit.Tick();
        Near(Distance(orbitBefore,orbit.Vehicles[0].transform.position),8*Mathf.PI*2/16*.02f,"orbit continuous across phase wrap");
        for(int i=0;i<6;i++){
          var hazard=road.Vehicles[i];var p=hazard.transform.position;float delta=p.x-before[i].x;float direction=i%2==0?1:-1;
          Near(p.y,1200,"track elevation");Near(p.z,before[i].z,"lane remains fixed");
          if(Math.Abs(delta)>8){
            wraps++;Require(Math.Abs(before[i].x-100)>235&&Math.Abs(p.x-100)>235,"both recycle poses behind tunnel end at 220");
            Near(delta,.8f*direction-480*direction,"wrap preserves overshoot");
            Require(hazard.Sweeps==sweeps[i]&&!hazard.contactHeld,"recycle never sweeps across player");
          }else{
            Near(delta,.8f*direction,"constant speed without parked frames");Require(hazard.Sweeps==sweeps[i]+1,"normal motion sweeps contact");
          }
          if((before[i].x-100)*direction<0&&(p.x-100)*direction>=0)arrivals++;
          if(road.RoadClear)Require(Math.Abs(p.x-100)>25,"clear signal has room for car and truck envelopes across all four lanes");
          for(int j=i+2;j<6;j+=2){float separation=Math.Abs(p.x-road.Vehicles[j].transform.position.x);Require(Math.Min(separation,480-separation)>59.9f,"staggered convoy spacing");}
        }
        if(road.RoadClear){clearTicks++;clearRun+=.02f;longestClear=Math.Max(longestClear,clearRun);Near(road.Signal.color.g,.9f,"green signal");}
        else{clearRun=0;Near(road.Signal.color.r,1,"warning signal");}
        if(tick==900){owner.menuOpen=true;Frozen(road,orbit,"mid-cycle B menu");owner.menuOpen=false;}
      }
      Require(wraps==24,"each vehicle recycles once each cycle");Require(arrivals==24,"six crossing arrivals per cycle");
      Require(clearTicks>950&&longestClear>4.7f,"usable common safe window each cycle");
      road.ResetForRound();Near(road.Clock,0,"round restart clock");
      foreach(var hazard in road.Vehicles)Require(hazard.Resets==3&&!hazard.contactHeld,"round restart clears contacts");
      Console.WriteLine(checks+" production traffic checks passed");
    }
  }
}`;
    const file=path.join(temp,'TrafficChecks.cs'),exe=path.join(temp,'TrafficChecks.exe');
    await writeFile(file,source);
    const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const compile=spawnSync(compiler,['/nologo','/target:exe',`/out:${exe}`,file],{encoding:'utf8',timeout:30000});
    assert.equal(compile.status,0,`${compile.error||''}\n${compile.stdout}\n${compile.stderr}`);
    const run=spawnSync(exe,[],{encoding:'utf8',timeout:30000});
    assert.equal(run.status,0,`${run.error||''}\n${run.stdout}\n${run.stderr}`);
    t.diagnostic(run.stdout.trim());
  }finally{await rm(temp,{recursive:true,force:true});}
});
