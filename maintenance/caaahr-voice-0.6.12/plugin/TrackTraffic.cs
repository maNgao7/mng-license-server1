using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly List<GameObject> roadGifts=new List<GameObject>();
    readonly List<Material> roadGiftMaterials=new List<Material>();
    bool trafficCrash;int trafficCrashCount;
    public bool TrafficPaused {get{return menuOpen||!Ready||startingGame||trackFinished||trafficCrash||!CustomActive;}}
    Material RoadGiftMaterial(Color color){var material=ActionMaterial(color);roadGiftMaterials.Add(material);return material;}
    void BuildLowHurdle(float z,Material steel,Material white,Material red,Material yellow){
      var root=new GameObject("Manual jump hurdle");root.transform.SetParent(trackRoot.transform,false);root.transform.localPosition=new Vector3(0,0,z);
      ObstaclePart(root.transform,"Low padded jump rail",PrimitiveType.Cube,new Vector3(0,.62f,0),new Vector3(27.4f,.9f,.65f),red);
      ObstaclePart(root.transform,"Jump rail steel backing",PrimitiveType.Cube,new Vector3(0,.42f,.38f),new Vector3(27.4f,.5f,.2f),steel);
      for(int i=-13;i<=13;i+=2){var stripe=ObstaclePart(root.transform,"Jump rail reflective stripe",PrimitiveType.Cube,new Vector3(i,.62f,-.34f),new Vector3(.6f,.86f,.03f),white);stripe.transform.localRotation=Quaternion.Euler(0,0,-25);}
      foreach(float x in new[]{-13.2f,13.2f})ObstaclePart(root.transform,"Jump rail foot",PrimitiveType.Cube,new Vector3(x,.15f,0),new Vector3(.7f,.3f,1.6f),steel);
      for(int i=0;i<3;i++)TrackBox("Manual jump approach stripe",new Vector3(0,.045f,z-12-i*2),new Vector3(26,.04f,.25f),yellow,false);
      var contact=ObstacleTrigger(root.transform,new Vector3(0,.65f,0),new Vector3(27.6f,1.1f,.7f));
      var hazard=root.AddComponent<RoadHazard>();hazard.Owner=this;hazard.Contact=contact;hazard.TrackZ=z;hazard.Hurdle=true;
      var body=root.AddComponent<Rigidbody>();body.isKinematic=true;body.useGravity=false;
      TrackBox("Jump warning post",new Vector3(-16,1.5f,z-15),new Vector3(.15f,3,.15f),steel,false);TrackBox("Jump warning sign",new Vector3(-16,3,z-15),new Vector3(3.5f,1.4f,.15f),steel,false);TrackText("ATLA",new Vector3(-16,3,z-15.1f),3,1);
    }
    GameObject TrafficCar(Transform parent,Material paint,Material dark,Material glass,Material lamps){
      var root=new GameObject("Crossing road car");root.transform.SetParent(parent,false);
      ObstaclePart(root.transform,"Car chassis",PrimitiveType.Cube,new Vector3(0,.65f,0),new Vector3(2.5f,.6f,4.9f),paint);
      ObstaclePart(root.transform,"Car bonnet",PrimitiveType.Cube,new Vector3(0,1.02f,1.35f),new Vector3(2.38f,.28f,1.9f),paint);
      ObstaclePart(root.transform,"Car cabin",PrimitiveType.Cube,new Vector3(0,1.38f,-.35f),new Vector3(2.1f,.95f,2.4f),glass);
      ObstaclePart(root.transform,"Car roof",PrimitiveType.Cube,new Vector3(0,1.9f,-.4f),new Vector3(2.2f,.14f,2.5f),paint);
      foreach(float side in new[]{-1f,1f}){
        foreach(float z in new[]{-.95f,.55f})ObstaclePart(root.transform,"Window pillar",PrimitiveType.Cube,new Vector3(side*1.08f,1.42f,z),new Vector3(.1f,.85f,.13f),paint);
        foreach(float z in new[]{-1.5f,1.5f}){var wheel=ObstaclePart(root.transform,"Tyre",PrimitiveType.Cylinder,new Vector3(side*1.27f,.44f,z),new Vector3(.86f,.16f,.86f),dark);wheel.transform.localRotation=Quaternion.Euler(0,0,90);}
        ObstaclePart(root.transform,"Headlight",PrimitiveType.Cube,new Vector3(side*.8f,.85f,2.47f),new Vector3(.54f,.25f,.06f),lamps);
        ObstaclePart(root.transform,"Rear lamp",PrimitiveType.Cube,new Vector3(side*.85f,.78f,-2.47f),new Vector3(.4f,.22f,.06f),paint);
      }
      ObstaclePart(root.transform,"Front bumper",PrimitiveType.Cube,new Vector3(0,.48f,2.5f),new Vector3(2.55f,.17f,.18f),dark);
      ObstaclePart(root.transform,"Radiator grille",PrimitiveType.Cube,new Vector3(0,.85f,2.48f),new Vector3(1,.34f,.08f),dark);
      foreach(float height in new[]{.74f,.86f,.98f})ObstaclePart(root.transform,"Car grille trim",PrimitiveType.Cube,new Vector3(0,height,2.54f),new Vector3(.94f,.035f,.04f),lamps);
      ObstaclePart(root.transform,"Rear bumper",PrimitiveType.Cube,new Vector3(0,.48f,-2.5f),new Vector3(2.55f,.17f,.18f),dark);
      foreach(float side in new[]{-1f,1f}){
        ObstaclePart(root.transform,"Side sill",PrimitiveType.Cube,new Vector3(side*1.24f,.55f,0),new Vector3(.1f,.16f,3.8f),dark);
        ObstaclePart(root.transform,"Door handle",PrimitiveType.Cube,new Vector3(side*1.14f,1.12f,-.6f),new Vector3(.07f,.07f,.3f),lamps);
        ObstaclePart(root.transform,"Car mirror",PrimitiveType.Cube,new Vector3(side*1.3f,1.45f,.65f),new Vector3(.24f,.18f,.32f),dark);
        foreach(float z in new[]{-1.5f,1.5f}){var hub=ObstaclePart(root.transform,"Car wheel hub",PrimitiveType.Cylinder,new Vector3(side*1.4f,.44f,z),new Vector3(.43f,.025f,.43f),lamps);hub.transform.localRotation=Quaternion.Euler(0,0,90);}
      }
      return root;
    }
    GameObject TrafficTruck(Transform parent,Material paint,Material dark,Material glass,Material lamps){
      var root=new GameObject("Oncoming delivery truck");root.transform.SetParent(parent,false);
      ObstaclePart(root.transform,"Truck frame",PrimitiveType.Cube,new Vector3(0,.65f,0),new Vector3(3.1f,.45f,8.6f),dark);
      ObstaclePart(root.transform,"Box cargo body",PrimitiveType.Cube,new Vector3(0,2.25f,-1.15f),new Vector3(3.35f,2.9f,6.2f),paint);
      ObstaclePart(root.transform,"Cargo roof",PrimitiveType.Cube,new Vector3(0,3.75f,-1.15f),new Vector3(3.45f,.16f,6.3f),lamps);
      ObstaclePart(root.transform,"Truck cab",PrimitiveType.Cube,new Vector3(0,1.6f,3),new Vector3(3.15f,2.1f,2.3f),paint);
      ObstaclePart(root.transform,"Truck windshield",PrimitiveType.Cube,new Vector3(0,2.13f,4.17f),new Vector3(2.8f,.85f,.06f),glass);
      ObstaclePart(root.transform,"Cab roof",PrimitiveType.Cube,new Vector3(0,2.72f,3),new Vector3(3.25f,.18f,2.4f),lamps);
      ObstaclePart(root.transform,"Truck grille",PrimitiveType.Cube,new Vector3(0,1.15f,4.18f),new Vector3(1.7f,.55f,.08f),dark);
      foreach(float height in new[]{1f,1.16f,1.32f})ObstaclePart(root.transform,"Grille slat",PrimitiveType.Cube,new Vector3(0,height,4.24f),new Vector3(1.6f,.04f,.04f),lamps);
      foreach(float side in new[]{-1f,1f}){
        ObstaclePart(root.transform,"Cab side window",PrimitiveType.Cube,new Vector3(side*1.59f,2.12f,3.05f),new Vector3(.04f,.85f,1.5f),glass);
        ObstaclePart(root.transform,"Door handle",PrimitiveType.Cube,new Vector3(side*1.61f,1.55f,2.5f),new Vector3(.08f,.09f,.35f),dark);
        ObstaclePart(root.transform,"Mirror arm",PrimitiveType.Cube,new Vector3(side*1.76f,2.08f,3.9f),new Vector3(.4f,.08f,.08f),dark);
        ObstaclePart(root.transform,"Truck mirror",PrimitiveType.Cube,new Vector3(side*1.95f,2.08f,3.9f),new Vector3(.18f,.5f,.3f),glass);
        ObstaclePart(root.transform,"Cargo reflective stripe",PrimitiveType.Cube,new Vector3(side*1.69f,1.2f,-1.15f),new Vector3(.04f,.16f,6),lamps);
        for(int rib=0;rib<6;rib++)ObstaclePart(root.transform,"Cargo side rib",PrimitiveType.Cube,new Vector3(side*1.69f,2.45f,-3.7f+rib),new Vector3(.05f,2.3f,.06f),lamps);
        foreach(float axle in new[]{-3f,-1.6f,3.15f}){
          var wheel=ObstaclePart(root.transform,"Truck tyre",PrimitiveType.Cylinder,new Vector3(side*1.58f,.63f,axle),new Vector3(1.25f,.2f,1.25f),dark);wheel.transform.localRotation=Quaternion.Euler(0,0,90);
          var hub=ObstaclePart(root.transform,"Truck wheel hub",PrimitiveType.Cylinder,new Vector3(side*1.8f,.63f,axle),new Vector3(.64f,.025f,.64f),lamps);hub.transform.localRotation=Quaternion.Euler(0,0,90);
        }
        ObstaclePart(root.transform,"Truck headlight",PrimitiveType.Cube,new Vector3(side*1.16f,1.2f,4.2f),new Vector3(.5f,.38f,.1f),lamps);
        ObstaclePart(root.transform,"Rear door",PrimitiveType.Cube,new Vector3(side*.81f,2.25f,-4.29f),new Vector3(1.56f,2.7f,.07f),lamps);
        ObstaclePart(root.transform,"Rear door latch",PrimitiveType.Cube,new Vector3(side*.63f,2.2f,-4.35f),new Vector3(.07f,2.4f,.06f),dark);
        ObstaclePart(root.transform,"Truck tail lamp",PrimitiveType.Cube,new Vector3(side*1.35f,.79f,-4.4f),new Vector3(.4f,.22f,.08f),paint);
      }
      ObstaclePart(root.transform,"Truck front bumper",PrimitiveType.Cube,new Vector3(0,.6f,4.35f),new Vector3(3.4f,.3f,.25f),lamps);
      ObstaclePart(root.transform,"Truck bumper rub strip",PrimitiveType.Cube,new Vector3(0,.61f,4.49f),new Vector3(3.3f,.1f,.02f),dark);
      for(int i=-2;i<=2;i++){
        var stripe=ObstaclePart(root.transform,"Truck rear danger chevron",PrimitiveType.Cube,new Vector3(i*.57f,.61f,-4.43f),new Vector3(.25f,.38f,.04f),dark);stripe.transform.localRotation=Quaternion.Euler(0,0,i<0?-35:35);
      }
      return root;
    }
    RoadHazard AttachTrafficHazard(GameObject root,float z,bool gift,bool truck=false){
      var hazard=root.AddComponent<RoadHazard>();hazard.Owner=this;hazard.TrackZ=z;hazard.Contact=ObstacleTrigger(root.transform,truck?new Vector3(0,1.915f,0):new Vector3(0,1,0),truck?new Vector3(4.1f,3.83f,9):new Vector3(2.86f,2,5.2f));hazard.Gift=gift;
      var body=root.AddComponent<Rigidbody>();body.isKinematic=true;body.useGravity=false;return hazard;
    }
    void BuildTrafficCrossing(float z,Material asphalt,Material steel,Material white,Material red,Material yellow){
      var road=TrackBox("Mountain side road",new Vector3(0,-.28f,z),new Vector3(430,.5f,24),asphalt);road.layer=trackGroundLayer;
      foreach(float side in new[]{-1f,1f}){
        for(int x=20;x<215;x+=12)TrackBox("Side road center marking",new Vector3(side*x,.018f,z),new Vector3(5,.035f,.15f),white,false);
        foreach(float edge in new[]{-11.5f,11.5f})TrackBox("Side road edge",new Vector3(side*114,.018f,z+edge),new Vector3(200,.035f,.15f),yellow,false);
      }
      foreach(float dz in new[]{-14f,14f})TrackBox("Crossing give way line",new Vector3(0,.04f,z+dz),new Vector3(27,.04f,.45f),white,false);
      // Covered exits occlude the recycle plane at +/-240, beyond the visible road.
      foreach(float side in new[]{-1f,1f}){
        TrackBox("Traffic tunnel floor",new Vector3(side*220,-.28f,z),new Vector3(80,.5f,24),asphalt);
        TrackBox("Traffic tunnel roof",new Vector3(side*220,7,z),new Vector3(80,2,28),steel,false);
        foreach(float edge in new[]{-13f,13f})TrackBox("Traffic tunnel wall",new Vector3(side*220,3,z+edge),new Vector3(80,8,2),steel,false);
        TrackBox("Traffic tunnel dark end",new Vector3(side*220,3,z),new Vector3(2,8,26),asphalt,false);
      }
      if(SuitableRoundabout(z)){BuildRoundabout(z,steel,white,red,yellow);return;}
      var root=new GameObject("Timed cross traffic junction");root.transform.SetParent(trackRoot.transform,false);root.transform.localPosition=new Vector3(0,0,z);
      var crossing=root.AddComponent<TrackCrossing>();crossing.Owner=this;crossing.TrackZ=z;crossing.Cycle=12;
      var glass=TrackMaterial(new Color(.16f,.3f,.37f));var dark=TrackMaterial(new Color(.07f,.09f,.11f));var blue=TrackMaterial(new Color(.19f,.28f,.36f));
      crossing.Vehicles=new RoadHazard[6];for(int i=0;i<crossing.Vehicles.Length;i++){var vehicle=i==0?TrafficTruck(root.transform,yellow,dark,glass,white):TrafficCar(root.transform,i%3==0?red:blue,dark,glass,white);vehicle.transform.localPosition=new Vector3(0,0,i==0?-6f:6f);vehicle.transform.localRotation=Quaternion.Euler(0,i%2==0?90:-90,0);crossing.Vehicles[i]=AttachTrafficHazard(vehicle,z,false,i==0);crossing.Vehicles[i].ExternalMotion=true;}
      crossing.ResetForRound();
      crossing.Signal=TrackMaterial(new Color(1,.55f,.05f));
      foreach(float side in new[]{-1f,1f}){
        TrackBox("Traffic warning pole",new Vector3(side*16,3,z-19),new Vector3(.2f,6,.2f),steel,false);
        TrackBox("Traffic warning sign",new Vector3(side*16,4.8f,z-19),new Vector3(3,1.2f,.2f),steel,false);
        TrackText("TRAFİK",new Vector3(side*16,4.8f,z-19.13f),2.7f,.8f);
        var lamp=ObstaclePart(root.transform,"Crossing warning lamp",PrimitiveType.Sphere,new Vector3(side*16,6.1f,-19),Vector3.one*.65f,crossing.Signal);
      }
    }
    void StartRoadGift(bool logs,float strength){
      if(!CustomActive)throw new InvalidOperationException("Bu eylem TikMnG düz parkurunda kullanılabilir.");
      if(roadGifts.Count>=12)throw new InvalidOperationException("Yoldaki hediye engellerinin geçmesi bekleniyor.");
      var root=new GameObject(logs?"Gift rolling timber convoy":"Gift oncoming truck");roadGifts.Add(root);
      var dark=RoadGiftMaterial(new Color(.09f,.1f,.11f));var paint=RoadGiftMaterial(logs?new Color(.35f,.17f,.065f):new Color(.84f,.13f,.14f));
      var trim=RoadGiftMaterial(logs?new Color(.7f,.45f,.22f):new Color(.2f,.35f,.43f));var light=RoadGiftMaterial(new Color(.98f,.94f,.78f));
      float start=TrackProgress+48;
      foreach(float lane in new[]{ClosestLane(car.transform.position.x-trackOrigin.x)}){
        GameObject node;RoadHazard hazard;
        if(logs){
          node=new GameObject("Lane rolling log");node.transform.SetParent(root.transform,false);var visual=new GameObject("Rotating timber");visual.transform.SetParent(node.transform,false);
          var trunk=ObstaclePart(visual.transform,"Bark cylinder",PrimitiveType.Cylinder,Vector3.zero,new Vector3(1.25f,2.7f,1.25f),paint);trunk.transform.localRotation=Quaternion.Euler(0,0,90);
          foreach(float side in new[]{-1f,1f}){var end=ObstaclePart(visual.transform,"Timber end grain",PrimitiveType.Cylinder,new Vector3(side*2.71f,0,0),new Vector3(1.17f,.014f,1.17f),trim);end.transform.localRotation=Quaternion.Euler(0,0,90);}
          for(int i=0;i<7;i++){float a=i*Mathf.PI*2/7;ObstaclePart(visual.transform,"Bark ridge",PrimitiveType.Cube,new Vector3(0,Mathf.Cos(a)*.61f,Mathf.Sin(a)*.61f),new Vector3(5.2f,.06f,.08f),dark);}
          hazard=node.AddComponent<RoadHazard>();hazard.Owner=this;hazard.Contact=ObstacleTrigger(node.transform,Vector3.zero,new Vector3(5.4f,1.25f,1.25f));hazard.Log=true;hazard.Roll=visual.transform;hazard.Gift=true;
          var body=node.AddComponent<Rigidbody>();body.isKinematic=true;body.useGravity=false;
        }else{node=TrafficTruck(root.transform,paint,dark,trim,light);node.transform.localRotation=Quaternion.Euler(0,180,0);hazard=AttachTrafficHazard(node,start,true,true);}
        node.transform.position=trackOrigin+new Vector3(lane,logs?.67f:0,start);hazard.TrackZ=start;hazard.Velocity=Vector3.back*(logs?13:18+Mathf.Clamp(strength,.2f,8)*2);hazard.Remaining=10;
      }
    }
    static float ClosestLane(float x){float nearest=TrackLayout.LaneCenters[0];foreach(float lane in TrackLayout.LaneCenters)if(Mathf.Abs(x-lane)<Mathf.Abs(x-nearest))nearest=lane;return nearest;}
    void UpdateRoadGifts(){for(int i=roadGifts.Count-1;i>=0;i--)if(!roadGifts[i]||roadGifts[i].transform.childCount==0){if(roadGifts[i])Destroy(roadGifts[i]);roadGifts.RemoveAt(i);}if(roadGifts.Count==0)ReleaseRoadGiftMaterials();}
    void ReleaseRoadGiftMaterials(){foreach(var material in roadGiftMaterials){actionMaterials.Remove(material);Destroy(material);}roadGiftMaterials.Clear();}
    void ReleaseRoadGifts(){foreach(var root in roadGifts)if(root)Destroy(root);roadGifts.Clear();ReleaseRoadGiftMaterials();}
    public void HitRoadHazard(bool hurdle,bool roundabout=false,float sourceZ=0){
      if(!TrackBody||trafficCrash)return;
      if(Time.unscaledTime<shieldUntil){shieldUntil=0;notice="Kalkan çarpışmayı durdurdu.";noticeUntil=Time.unscaledTime+3;return;}
      if(hurdle){HitTrackBumper(false);return;}
      if(roundabout){HitRoundaboutTraffic(sourceZ);return;}
      StartCoroutine(ReturnAfterTrafficCrash());
    }
    IEnumerator ReturnAfterTrafficCrash(){
      trafficCrash=true;trafficCrashCount++;var target=car;var rb=Get<Rigidbody>(target,"rb");bool automatic=autoDrive;ResetEffects();autoDrive=false;Throttle=0;
      bool kinematic=rb.isKinematic;rb.linearVelocity=rb.angularVelocity=Vector3.zero;rb.isKinematic=true;notice="KAZA! Başlangıca dönülüyor";noticeUntil=Time.unscaledTime+2;
      try{yield return new WaitForSecondsRealtime(.55f);while(menuOpen&&target&&target==car)yield return null;if(target&&target==car&&CustomActive){rb.isKinematic=false;target.SetPosAndRot(trackMap.SpawnPoint.position,trackMap.SpawnPoint.rotation);rb.linearVelocity=rb.angularVelocity=Vector3.zero;var gm=Get<GameManager>(car,"gameManager");gm.savedPos=trackMap.SpawnPoint.position;gm.savedRot=trackMap.SpawnPoint.rotation;gm.roundTimer=0;gm.checkPointIndex=0;gm.deathCount++;if(gm.camControl)gm.camControl.transform.position=target.transform.position;autoDrive=automatic;motionClearUntil=Time.unscaledTime+1;trackImpactUntil=Time.unscaledTime+.2f;}}
      finally{if(rb)rb.isKinematic=kinematic;trafficCrash=false;}
    }
  }
  public class TrackCrossing:MonoBehaviour {
    public VoiceDrive Owner;public float TrackZ,Cycle=12,Clock;public RoadHazard[] Vehicles;public Material Signal;
    public virtual bool RoadClear {get{return Mathf.Repeat(Clock,Cycle)>=7.2f;}}
    public void ResetForRound(){Clock=0;PlaceCars(true);UpdateSignal();}
    protected void FixedUpdate(){if(!Owner||Owner.TrafficPaused)return;Clock=Mathf.Repeat(Clock+Time.fixedDeltaTime,Cycle);PlaceCars(false);UpdateSignal();}
    void UpdateSignal(){if(Signal)Signal.color=RoadClear?new Color(.12f,.9f,.42f):new Color(1,.33f,.04f);}
    public const float RecycleEnd=240;
    protected virtual void PlaceCars(bool reset){
      if(Vehicles==null)return;
      float speed=RecycleEnd*2/Cycle;
      for(int vehicle=0;vehicle<Vehicles.Length;vehicle++)if(Vehicles[vehicle]){
        int i=vehicle%2;float direction=i==0?1:-1;
        // Three arrivals per lane, then a shared gap; every vehicle keeps rolling.
        float arrival=2+i*.7f+(vehicle/2)*1.5f;
        float x=(Mathf.Repeat(Clock-arrival+Cycle*.5f,Cycle)*speed-RecycleEnd)*direction;
        Vector3 next=transform.TransformPoint(new Vector3(x,0,i==0?-6f:6f));
        if(reset)Vehicles[vehicle].ResetPose(next,Vehicles[vehicle].transform.rotation);else Vehicles[vehicle].MoveTo(next);
      }
    }
  }
  public class RoadHazard:MonoBehaviour {
    public VoiceDrive Owner;public BoxCollider Contact;public float TrackZ,Remaining,RoundaboutZ;public bool Hurdle,Log,Gift,ExternalMotion,Roundabout;public Vector3 Velocity;public Transform Roll;bool contactHeld;
    public void ResetPose(Vector3 position,Quaternion rotation){contactHeld=false;transform.SetPositionAndRotation(position,rotation);var body=GetComponent<Rigidbody>();if(body){body.position=position;body.rotation=rotation;}TrackZ=position.z;}
    public void MoveTo(Vector3 next){Vector3 delta=next-transform.position;if(delta.sqrMagnitude<64)CheckContact(delta);else contactHeld=false;transform.position=next;TrackZ=next.z;}
    void FixedUpdate(){
      if(!Owner)return;if(Owner.TrafficPaused)return;
      if(ExternalMotion)return;if(Gift){Remaining-=Time.fixedDeltaTime;if(Remaining<=0){Destroy(gameObject);return;}Vector3 delta=Velocity*Time.fixedDeltaTime;CheckContact(delta);transform.position+=delta;TrackZ=transform.position.z;if(Roll)Roll.Rotate(Vector3.right,Time.fixedDeltaTime*Velocity.magnitude*100,Space.Self);}
      else if(!Owner.TrackObstaclePaused(TrackZ))CheckContact(Vector3.zero);
    }
    public void CheckContact(Vector3 delta){
      var body=Owner?Owner.TrackBody:null;if(!body||!Contact){contactHeld=false;return;}var controller=body.GetComponent<CarController>();var collider=VoiceDrive.Get<Collider>(controller,"coll");if(!collider)return;
      Bounds bounds=collider.bounds;Vector3 a=Contact.transform.InverseTransformPoint(bounds.center)-Contact.center,b=Contact.transform.InverseTransformPoint(bounds.center+body.linearVelocity*Time.fixedDeltaTime-delta)-Contact.center,e=bounds.extents;
      Vector3 right=Contact.transform.right,up=Contact.transform.up,forward=Contact.transform.forward;
      Vector3 half=Contact.size*.5f+new Vector3(Mathf.Abs(right.x)*e.x+Mathf.Abs(right.y)*e.y+Mathf.Abs(right.z)*e.z,Mathf.Abs(up.x)*e.x+Mathf.Abs(up.y)*e.y+Mathf.Abs(up.z)*e.z,Mathf.Abs(forward.x)*e.x+Mathf.Abs(forward.y)*e.y+Mathf.Abs(forward.z)*e.z);
      bool hit=TrackBumper.SegmentBox(a,b,half);if(hit&&!contactHeld){contactHeld=true;Owner.HitRoadHazard(Hurdle,Roundabout,RoundaboutZ);}else if(!hit)contactHeld=false;
    }
    void OnTriggerEnter(Collider other){if(Owner&&!Owner.TrafficPaused&&other.GetComponentInParent<CarController>())CheckContact(Vector3.zero);}
  }
}
