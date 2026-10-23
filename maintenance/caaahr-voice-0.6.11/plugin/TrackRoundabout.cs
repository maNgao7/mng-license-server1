using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float roundaboutStunRemaining;
    public static float RoundaboutSetbackZ(float progress,float sourceZ){return Mathf.Max(0,Mathf.Min(progress-10,sourceZ-20));}
    void HitRoundaboutTraffic(float sourceZ){
      var rb=TrackBody;if(!rb)return;
      Vector3 landing;bool clear=TrySafeTrackLanding(RoundaboutSetbackZ(TrackProgress,sourceZ),false,out landing);
      // Keep native physics and the camera intact; only the player is stunned.
      if(clear){car.SetPosAndRot(landing,Quaternion.identity);rb.position=landing;rb.rotation=Quaternion.identity;}
      rb.linearVelocity=rb.angularVelocity=Vector3.zero;trackRunupUntil=0;Throttle=0;
      roundaboutStunRemaining=.9f;trackImpactUntil=Time.unscaledTime+.9f;motionClearUntil=Time.unscaledTime+1.3f;
      notice=clear?"Kavşak kazası: güvenli noktaya geri çekildi.":"Kavşak kazası: araç kısa süre durduruldu.";noticeUntil=Time.unscaledTime+3;PlayActionSound("crash");
    }
    void UpdateRoundaboutStun(){
      if(roundaboutStunRemaining<=0)return;
      if(!CustomActive||!Ready||startingGame||giftMotion){roundaboutStunRemaining=0;return;}
      if(menuOpen)return;
      roundaboutStunRemaining=Mathf.Max(0,roundaboutStunRemaining-Time.fixedDeltaTime);
      var rb=Get<Rigidbody>(car,"rb");if(rb&&!rb.isKinematic){rb.linearVelocity=new Vector3(0,rb.linearVelocity.y,0);rb.angularVelocity=Vector3.zero;}
      trackImpactUntil=Time.unscaledTime+roundaboutStunRemaining;motionClearUntil=trackImpactUntil+.4f;
    }
    bool SuitableRoundabout(float z){
      if(trackLayout==null)return false;
      int index=trackLayout.Crossings.IndexOf(z);
      if(index<0||index%2!=1||z<32||z>builtLength-32)return false;
      foreach(var jump in trackLayout.Jumps)if(z>jump.Approach-35&&z<jump.Landing+40)return false;
      foreach(var obstacle in trackLayout.Obstacles)if(Mathf.Abs(z-obstacle.Z)<32)return false;
      foreach(float hurdle in trackLayout.Hurdles)if(Mathf.Abs(z-hurdle)<32)return false;
      return true;
    }
    void BuildRoundabout(float z,Material steel,Material white,Material red,Material yellow){
      var root=new GameObject("Four car rotating roundabout");root.transform.SetParent(trackRoot.transform,false);root.transform.localPosition=new Vector3(0,0,z);
      // Flush island markings leave the existing four-lane road drivable.
      ObstaclePart(root.transform,"Roundabout island",PrimitiveType.Cylinder,new Vector3(0,.04f,0),new Vector3(8,.035f,8),steel);
      for(int i=0;i<32;i++){
        float angle=i*Mathf.PI*2/32;
        var curb=ObstaclePart(root.transform,"Roundabout painted curb",PrimitiveType.Cube,new Vector3(Mathf.Sin(angle)*4,.085f,Mathf.Cos(angle)*4),new Vector3(.7f,.04f,.2f),i%2==0?red:white);
        curb.transform.localRotation=Quaternion.Euler(0,angle*Mathf.Rad2Deg,0);
      }
      for(int i=0;i<16;i++){
        float angle=i*Mathf.PI*2/16;
        var stripe=ObstaclePart(root.transform,"Roundabout outer lane dash",PrimitiveType.Cube,new Vector3(Mathf.Sin(angle)*11,.045f,Mathf.Cos(angle)*11),new Vector3(1,.035f,.15f),white);
        stripe.transform.localRotation=Quaternion.Euler(0,angle*Mathf.Rad2Deg,0);
      }
      var glass=TrackMaterial(new Color(.16f,.3f,.37f));var dark=TrackMaterial(new Color(.07f,.09f,.11f));var blue=TrackMaterial(new Color(.19f,.28f,.36f));
      var orbit=root.AddComponent<TrackRoundabout>();orbit.Owner=this;orbit.TrackZ=z;orbit.Cycle=16;orbit.Vehicles=new RoadHazard[4];
      var paints=new[]{steel,blue,red,white};
      for(int i=0;i<orbit.Vehicles.Length;i++){
        var vehicle=TrafficCar(root.transform,paints[i],dark,glass,white);
        var hazard=AttachTrafficHazard(vehicle,z,false);hazard.ExternalMotion=true;hazard.Roundabout=true;hazard.RoundaboutZ=z;orbit.Vehicles[i]=hazard;
      }
      orbit.ResetForRound();
      foreach(float side in new[]{-1f,1f}){
        TrackBox("Roundabout warning pole",new Vector3(side*16,2,z-20),new Vector3(.2f,4,.2f),steel,false);
        TrackBox("Roundabout warning board",new Vector3(side*16,4,z-20),new Vector3(3.6f,1.2f,.2f),blue,false);
        TrackText("DONEL KAVSAK",new Vector3(side*16,4,z-20.13f),3.3f,.8f);
      }
    }
  }
  // Inheritance keeps the existing GetComponentsInChildren<TrackCrossing> reset path.
  public class TrackRoundabout:TrackCrossing {
    public const float OrbitRadius=8;
    public override bool RoadClear {get{return false;}}
    protected override void PlaceCars(bool reset){
      if(Vehicles==null||Vehicles.Length==0)return;
      for(int i=0;i<Vehicles.Length;i++)if(Vehicles[i]){
        float angle=Mathf.Repeat(Clock,Cycle)/Cycle*Mathf.PI*2+i*Mathf.PI*2/Vehicles.Length;
        Vector3 next=transform.TransformPoint(new Vector3(Mathf.Sin(angle)*OrbitRadius,0,Mathf.Cos(angle)*OrbitRadius));
        Quaternion heading=transform.rotation*Quaternion.Euler(0,angle*Mathf.Rad2Deg+90,0);
        if(reset)Vehicles[i].ResetPose(next,heading);
        else{Vehicles[i].transform.rotation=heading;Vehicles[i].MoveTo(next);}
      }
    }
  }
}
