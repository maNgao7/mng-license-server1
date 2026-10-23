using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly List<Mesh> rampMeshes=new List<Mesh>();
    float trackRunupUntil,lastTrackLaunch=-100;
    IEnumerator BuildTrackRoad(int length,Material asphalt,Material grass,Material white,Material yellow,Material red,Material steel,Material cyan){
      float start=-40;
      foreach(var jump in trackLayout.Jumps){RoadSlab(start,jump.Lip,asphalt);start=jump.Landing;yield return null;}
      RoadSlab(start,length+40,asphalt);
      TrackBox("Lower landscape",new Vector3(0,-13,length/2f),new Vector3(560,1,length+500),grass,false);
      foreach(float side in new[]{-1f,1f}){
        var verge=TrackBox("Safe roadside ground",new Vector3(side*147,-1.5f,length/2f),new Vector3(266,2,length+500),grass);verge.layer=trackGroundLayer;
      }
      for(int z=-20;z<length+20;z+=12){
        bool gap=false;foreach(var jump in trackLayout.Jumps)if(z+3>jump.Lip&&z-3<jump.Landing)gap=true;
        if(!gap){
          if(!trackLayout.SideRoadAt(z,9))foreach(float x in new[]{-7f,0,7f})TrackBox("Lane marking",new Vector3(x,.03f,z),new Vector3(.12f,.04f,4),white,false);
          if(!trackLayout.SideRoadAt(z,9))foreach(float x in new[]{-13.6f,13.6f})TrackBox("Road edge marking",new Vector3(x,.025f,z),new Vector3(.14f,.035f,12),yellow,false);
        }
        if(z%120==4)yield return null;
      }
    }
    void RoadSlab(float start,float end,Material asphalt){
      if(end<=start)return;var road=TrackBox("Driveable road",new Vector3(0,-.3f,(start+end)/2),new Vector3(28,.6f,end-start),asphalt);road.layer=trackGroundLayer;
    }
    void BuildJumpSection(TrackJump jump,Material asphalt,Material steel,Material white,Material red,Material cyan,Material yellow){
      float length=jump.Lip-jump.RampStart,height=jump.Height,half=12;
      var vertices=new[]{new Vector3(-half,-.2f,0),new Vector3(half,-.2f,0),new Vector3(half,-.2f,length),new Vector3(-half,-.2f,length),new Vector3(-half,0,0),new Vector3(half,0,0),new Vector3(half,height,length),new Vector3(-half,height,length)};
      var triangles=new[]{4,7,6,4,6,5,0,1,2,0,2,3,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2};
      var mesh=new Mesh{name="Physical launch ramp"};mesh.vertices=vertices;mesh.triangles=triangles;mesh.RecalculateNormals();mesh.RecalculateBounds();rampMeshes.Add(mesh);
      var ramp=new GameObject("Physical launch ramp");ramp.transform.SetParent(StaticParent(),false);ramp.transform.localPosition=new Vector3(0,0,jump.RampStart);ramp.layer=trackGroundLayer;
      ramp.AddComponent<MeshFilter>().sharedMesh=mesh;ramp.AddComponent<MeshRenderer>().sharedMaterial=asphalt;ramp.AddComponent<MeshCollider>().sharedMesh=mesh;
      foreach(float x in new[]{-11.85f,11.85f}){
        var edge=TrackBox("Ramp reflective edge",new Vector3(x,height/2+.04f,(jump.RampStart+jump.Lip)/2),new Vector3(.18f,.07f,Mathf.Sqrt(length*length+height*height)),yellow,false);
        edge.transform.localRotation=Quaternion.Euler(-Mathf.Atan2(height,length)*Mathf.Rad2Deg,0,0);
      }
      var pad=new GameObject("Run-up speed pad");pad.transform.SetParent(trackRoot.transform,false);pad.transform.localPosition=new Vector3(0,.1f,jump.Approach+5);
      ObstaclePart(pad.transform,"Run-up surface",PrimitiveType.Cube,Vector3.zero,new Vector3(24,.2f,10),cyan);
      for(int row=-2;row<=2;row++)for(int lane=-2;lane<=2;lane++)ObstacleChevron(pad.transform,lane*2.8f,row*1.7f,white);
      var padBody=pad.AddComponent<Rigidbody>();padBody.isKinematic=true;padBody.useGravity=false;
      ObstacleTrigger(pad.transform,new Vector3(0,.7f,0),new Vector3(24,1.8f,10));var runup=pad.AddComponent<TrackJumpContact>();runup.Owner=this;runup.Jump=jump;runup.Runup=true;
      var lip=new GameObject("Jump takeoff zone");lip.transform.SetParent(trackRoot.transform,false);lip.transform.localPosition=new Vector3(0,height+1,jump.Lip-.6f);
      var lipBody=lip.AddComponent<Rigidbody>();lipBody.isKinematic=true;lipBody.useGravity=false;ObstacleTrigger(lip.transform,Vector3.zero,new Vector3(24,2.6f,1.6f));var takeoff=lip.AddComponent<TrackJumpContact>();takeoff.Owner=this;takeoff.Jump=jump;
      float gapLength=jump.Landing-jump.Lip,mid=(jump.Landing+jump.Lip)/2;
      TrackBox("Jump pit dark floor",new Vector3(0,-5.2f,mid),new Vector3(28,.25f,gapLength),steel,false);
      foreach(float z in new[]{jump.Lip,jump.Landing})TrackBox("Jump pit retaining wall",new Vector3(0,-2.8f,z),new Vector3(28,5.5f,.3f),steel,false);
      TrackBox("Landing zone",new Vector3(0,.025f,jump.Landing+7),new Vector3(26,.045f,12),cyan,false);
      for(int i=0;i<8;i++)TrackBox("Landing marker",new Vector3(-9+i*2.5f,.055f,jump.Landing+1),new Vector3(1.2f,.04f,.4f),white,false);
      foreach(float x in new[]{-5f,5f}){
        var hazard=new GameObject("Hazard below jump");hazard.transform.SetParent(trackRoot.transform,false);hazard.transform.localPosition=new Vector3(x,-.5f,mid);
        var arm=ObstaclePart(hazard.transform,"Lower padded rotor",PrimitiveType.Capsule,Vector3.zero,new Vector3(.9f,3.2f,.9f),red);arm.transform.localRotation=Quaternion.Euler(0,0,90);
        var body=hazard.AddComponent<Rigidbody>();body.isKinematic=true;body.useGravity=false;ObstacleTrigger(hazard.transform,Vector3.zero,new Vector3(6.4f,1,1));
        var rotor=hazard.AddComponent<TrackBumper>();rotor.Owner=this;rotor.BasePosition=hazard.transform.position;rotor.TrackZ=mid;rotor.Kind=TrackObstacleKind.Rotating;
      }
      TrackText("HIZLAN  >  ATLA",new Vector3(0,7,jump.Approach-4),14,1.2f);
      foreach(float side in new[]{-1f,1f})TrackBox("Jump sign post",new Vector3(side*10,3.6f,jump.Approach-3.8f),new Vector3(.2f,7.2f,.2f),steel,false);
      TrackBox("Jump sign header",new Vector3(0,7,jump.Approach-3.8f),new Vector3(20.5f,1.7f,.25f),steel,false);
    }
    public void EnterTrackRunup(){
      if(!CustomActive||!Ready||menuOpen||Jailed||MotionSafe)return;trackRunupUntil=Time.unscaledTime+8;
    }
    public void LaunchTrackJump(TrackJump jump){
      if(!CustomActive||!Ready||menuOpen||Jailed||MotionSafe||Time.unscaledTime-lastTrackLaunch<2.5f)return;
      var rb=Get<Rigidbody>(car,"rb");if(rb.linearVelocity.z<3)return;
      float speed=Mathf.Max(30,rb.linearVelocity.z),flight=(jump.Landing+18-(rb.position.z-trackOrigin.z))/speed;
      // Launch into Unity's native gravity, with clearance beyond the landing edge.
      float vertical=Mathf.Clamp(.5f*Mathf.Abs(Physics.gravity.y)*flight-jump.Height/flight+2,12,40);
      lastTrackLaunch=Time.unscaledTime;rb.linearVelocity=new Vector3(Mathf.Clamp(rb.linearVelocity.x,-6,6),vertical,speed);trackImpactUntil=Time.unscaledTime+flight+.3f;
      notice="Atlayış!";noticeUntil=Time.unscaledTime+2;
    }
  }
  public class TrackJumpContact : MonoBehaviour {
    public VoiceDrive Owner;public TrackJump Jump;public bool Runup;
    void OnTriggerEnter(Collider other){if(Owner&&other.GetComponentInParent<CarController>()){if(Runup)Owner.EnterTrackRunup();else Owner.LaunchTrackJump(Jump);}}
    void OnTriggerStay(Collider other){if(Runup&&Owner&&other.GetComponentInParent<CarController>())Owner.EnterTrackRunup();}
  }
}
