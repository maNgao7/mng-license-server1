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

test('wider crossroads align markings, lanes, and truck collision dimensions',()=>{
  assert.match(traffic,/new Vector3\(430,\.5f,24\)/);
  assert.match(traffic,/new\[\]\{-11\.5f,11\.5f\}/);
  assert.match(traffic,/new\[\]\{-14f,14f\}/);
  assert.equal((traffic.match(/i==0\?-6f:6f/g)||[]).length,2);
  assert.match(traffic,/else\{node=TrafficTruck[\s\S]*?AttachTrafficHazard\(node,start,true,true\)/);
  assert.match(traffic,/AttachTrafficHazard\(vehicle,z,false,i==0\)/);
  const truck=block(traffic,'GameObject TrafficTruck(');
  for(const detail of ['Box cargo body','Truck windshield','Truck mirror','Truck tyre','Cargo side rib','Rear door latch','Grille slat'])assert.ok(truck.includes(detail));
  assert.match(traffic,/new Vector3\(4\.1f,3\.83f,9\)/);
  // Mirrors, roof and both bumpers are inside the unrotated trigger envelope.
  assert.ok(1.95+.18/2<=4.1/2);
  assert.ok(3.75+.16/2<=3.83);
  assert.ok(4.35+.25/2<=9/2);
  assert.ok(4.4+.08/2<=9/2);
});

test('roundabout uses existing hazard, lifecycle, and owned material paths',async()=>{
  const rounds=await readFile(path.join(root,'plugin/RaceRounds.cs'),'utf8');
  assert.match(rounds,/GetComponentsInChildren<TrackCrossing>\(\).*ResetForRound\(\)/);
  assert.match(roundabout,/class TrackRoundabout:TrackCrossing/);
  assert.match(roundabout,/new RoadHazard\[4\]/);
  assert.match(roundabout,/hazard.ExternalMotion=true/);
  assert.match(roundabout,/AttachTrafficHazard\(vehicle,z,false\)/);
  assert.match(traffic,/if\(SuitableRoundabout\(z\)\)\{BuildRoundabout\(z,steel,white,red,yellow\);return;\}/);
  assert.doesNotMatch(roundabout,/new Material|new Mesh|ActionMaterial|static .*List/);
  const reset=block(traffic,'public void ResetPose(');
  assert.match(reset,/contactHeld=false/);
  assert.match(reset,/body.position=position;body.rotation=rotation/);
  assert.doesNotMatch(reset,/CheckContact|MoveTo/);
});

test('actual C# orbit and crossing code preserve pause, reset, wrap and safe layout placement',{skip:process.platform!=='win32'},async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'caaahr-roundabout-'));
  try{
    const source=`using System;
using System.Collections.Generic;
using UnityEngine;
namespace UnityEngine {
  public class Object { public static implicit operator bool(Object value){return value!=null;} }
  public class MonoBehaviour:Object {public Transform transform=new Transform();}
  public class Transform {
    public Vector3 position;public Quaternion rotation;
    public Vector3 TransformPoint(Vector3 point){return position+point;}
  }
  public struct Vector3 {
    public float x,y,z;public Vector3(float a,float b,float c){x=a;y=b;z=c;}
    public static Vector3 operator +(Vector3 a,Vector3 b){return new Vector3(a.x+b.x,a.y+b.y,a.z+b.z);}
  }
  public struct Quaternion {
    public float yaw;public static Quaternion Euler(float x,float y,float z){return new Quaternion{yaw=y};}
    public static Quaternion operator *(Quaternion a,Quaternion b){return Euler(0,a.yaw+b.yaw,0);}
  }
  public struct Color {public float r,g,b;public Color(float x,float y,float z){r=x;g=y;b=z;}}
  public class Material:Object {public Color color;}
  public static class Time {public static float fixedDeltaTime=.02f;}
  public static class Mathf {
    public const float PI=(float)Math.PI,Rad2Deg=180/PI;
    public static float Sin(float a){return (float)Math.Sin(a);}
    public static float Cos(float a){return (float)Math.Cos(a);}
    public static float Abs(float a){return Math.Abs(a);}
    public static float Repeat(float a,float b){return a-(float)Math.Floor(a/b)*b;}
    public static float Clamp01(float a){return Math.Max(0,Math.Min(1,a));}
    public static float Lerp(float a,float b,float t){return a+(b-a)*t;}
  }
}
namespace TikMnG.Caaahr {
  public class VoiceDrive:UnityEngine.Object {
    public TrackLayout trackLayout;public int builtLength;public bool TrafficPaused,ObstaclePaused;
    public bool TrackObstaclePaused(float z){return ObstaclePaused;}
    ${block(roundabout,'bool SuitableRoundabout(').replace('bool SuitableRoundabout','public bool SuitableRoundabout')}
  }
  public class RoadHazard:MonoBehaviour {
    public int Moves,Resets;public Vector3 Position;
    public void MoveTo(Vector3 next){Position=next;Moves++;transform.position=next;}
    public void ResetPose(Vector3 next,Quaternion rotation){Position=next;Resets++;transform.position=next;transform.rotation=rotation;}
  }
  ${block(traffic,'public class TrackCrossing:')}
  ${block(roundabout,'public class TrackRoundabout:')}
  public class OrbitProbe:TrackRoundabout {public void Tick(){FixedUpdate();}}
  public class CrossingProbe:TrackCrossing {public void Tick(){FixedUpdate();}}
  public static class Checks {
    static void Require(bool ok,string label){if(!ok)throw new Exception(label);}
    static void Near(float a,float b,string label){Require(Math.Abs(a-b)<.002f,label);}
    public static void Main(){
      var owner=new VoiceDrive();var orbit=new OrbitProbe{Owner=owner,Cycle=16,TrackZ=400};
      orbit.transform.position=new Vector3(100,1200,400);orbit.Vehicles=new RoadHazard[4];
      for(int i=0;i<4;i++)orbit.Vehicles[i]=new RoadHazard();
      TrackCrossing baseReference=orbit;baseReference.ResetForRound();
      Near(orbit.Clock,0,"reset phase");Require(!orbit.RoadClear,"orbit never signals clear");
      for(int i=0;i<4;i++){Require(orbit.Vehicles[i].Resets==1&&orbit.Vehicles[i].Moves==0,"reset does not sweep");}
      Near(orbit.Vehicles[0].Position.x,100,"world origin x");Near(orbit.Vehicles[0].Position.y,1200,"world origin y");Near(orbit.Vehicles[0].Position.z,408,"world origin z");
      owner.TrafficPaused=true;orbit.Tick();Near(orbit.Clock,0,"menu/crash pause");
      owner.TrafficPaused=false;owner.ObstaclePaused=true;orbit.Tick();Near(orbit.Clock,.02f,"distant traffic keeps moving");orbit.ResetForRound();
      owner.ObstaclePaused=false;
      for(int tick=0;tick<1601;tick++){
        orbit.Tick();
        for(int i=0;i<4;i++){
          var p=orbit.Vehicles[i].Position;float x=p.x-100,z=p.z-400;
          Near((float)Math.Sqrt(x*x+z*z),8,"constant orbit radius");
          var q=orbit.Vehicles[(i+1)%4].Position;float dx=p.x-q.x,dz=p.z-q.z;
          Near((float)Math.Sqrt(dx*dx+dz*dz),(float)Math.Sqrt(128),"quarter-turn spacing");
          float heading=orbit.Vehicles[i].transform.rotation.yaw/Mathf.Rad2Deg;
          Near(x*Mathf.Sin(heading)+z*Mathf.Cos(heading),0,"heading is tangent");
          // Rotated car OBB fits both road edges for the entire orbit.
          float extent=Math.Abs(Mathf.Sin(heading))*2.6f+Math.Abs(Mathf.Cos(heading))*1.43f;
          Require(Math.Abs(z)+extent<11.5f,"car stays inside widened road");
        }
      }
      Require(orbit.Clock<.05f,"cycle wraps without accumulating time");
      baseReference.ResetForRound();Near(orbit.Vehicles[0].Position.z,408,"reset restores initial position");
      Require(orbit.Vehicles[0].Resets==3,"base reset reaches derived orbit");
      var crossing=new CrossingProbe{Owner=owner,Vehicles=new[]{new RoadHazard(),new RoadHazard()},Signal=new Material()};
      crossing.Clock=5;crossing.ResetForRound();Near(crossing.Vehicles[0].Position.z,-6,"crossing lane one");Near(crossing.Vehicles[1].Position.z,6,"crossing lane two");
      Require(crossing.Vehicles[0].Moves==0,"crossing reset does not sweep");Near(crossing.Signal.color.r,1,"reset restores warning lamp");
      int selected=0;
      for(int length=100;length<=5000;length+=50){
        owner.trackLayout=new TrackLayout(length);owner.builtLength=length;
        for(int i=0;i<owner.trackLayout.Crossings.Count;i++){
          float z=owner.trackLayout.Crossings[i];bool suitable=owner.SuitableRoundabout(z);
          if(suitable){selected++;Require(i%2==1,"alternating existing crossroads");
            foreach(var obstacle in owner.trackLayout.Obstacles)Require(Math.Abs(z-obstacle.Z)>=32,"obstacle clearance");
            foreach(float hurdle in owner.trackLayout.Hurdles)Require(Math.Abs(z-hurdle)>=32,"hurdle clearance");
            foreach(var jump in owner.trackLayout.Jumps)Require(z<=jump.Approach-35||z>=jump.Landing+40,"jump clearance");
          }
        }
      }
      Require(selected>0,"layout actually includes roundabouts");
      owner.trackLayout=new TrackLayout(5000);owner.builtLength=5000;
      float candidate=owner.trackLayout.Crossings[1];owner.trackLayout.Obstacles.Clear();owner.trackLayout.Jumps.Clear();owner.trackLayout.Hurdles.Clear();
      Require(owner.SuitableRoundabout(candidate),"clear existing crossing accepted");
      owner.trackLayout.Hurdles.Add(candidate+20);Require(!owner.SuitableRoundabout(candidate),"unsafe hurdle rejected");owner.trackLayout.Hurdles.Clear();
      owner.trackLayout.Obstacles.Add(new TrackPlacement{Z=candidate+20});Require(!owner.SuitableRoundabout(candidate),"unsafe obstacle rejected");owner.trackLayout.Obstacles.Clear();
      owner.trackLayout.Jumps.Add(new TrackJump{Approach=candidate-10,Landing=candidate+20});Require(!owner.SuitableRoundabout(candidate),"unsafe jump rejected");
      Require(!owner.SuitableRoundabout(candidate+1),"non-crossing rejected");
      Console.WriteLine("Orbit motion, tangent heading, road bounds, pauses, reset dispatch and layout clearance passed.");
    }
  }
}`;
    const file=path.join(temp,'RoundaboutChecks.cs'),exe=path.join(temp,'RoundaboutChecks.exe');
    await writeFile(file,source);
    const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const compile=spawnSync(compiler,['/nologo','/target:exe',`/out:${exe}`,path.join(root,'plugin/TrackLayout.cs'),file],{encoding:'utf8'});
    assert.equal(compile.status,0,`${compile.error||''}\n${compile.stdout}\n${compile.stderr}`);
    const run=spawnSync(exe,[],{encoding:'utf8'});
    assert.equal(run.status,0,`${run.error||''}\n${run.stdout}\n${run.stderr}`);
  }finally{await rm(temp,{recursive:true,force:true});}
});
