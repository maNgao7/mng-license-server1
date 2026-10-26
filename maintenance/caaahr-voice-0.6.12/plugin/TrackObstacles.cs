using UnityEngine;

namespace TikMnG.Caaahr {
  public enum TrackObstacleKind {Sliding,Rotating,Boost,Gate,Slalom,Swing}
  public partial class VoiceDrive {
    GameObject ObstaclePart(Transform parent,string name,PrimitiveType shape,Vector3 position,Vector3 size,Material material){
      var item=GameObject.CreatePrimitive(shape);item.name=name;item.transform.SetParent(parent,false);item.transform.localPosition=position;item.transform.localScale=size;
      Destroy(item.GetComponent<Collider>());item.GetComponent<Renderer>().sharedMaterial=material;return item;
    }
    BoxCollider ObstacleTrigger(Transform parent,Vector3 center,Vector3 size){
      var item=new GameObject("Obstacle contact");item.transform.SetParent(parent,false);var trigger=item.AddComponent<BoxCollider>();trigger.center=center;trigger.size=size;trigger.isTrigger=true;return trigger;
    }
    void ObstacleChevron(Transform root,float x,float z,Material material){
      foreach(float side in new[]{-1f,1f}){
        var arm=ObstaclePart(root,"Forward arrow",PrimitiveType.Cube,new Vector3(x+side*.6f,.17f,z),new Vector3(.24f,.05f,1.8f),material);
        arm.transform.localRotation=Quaternion.Euler(0,-side*43,0);
      }
    }
    void BuildTrackObstacle(float z,int index,Material asphalt,Material steel,Material white,Material red,Material cyan,Material yellow){
      var kind=(TrackObstacleKind)index;bool forward=kind==TrackObstacleKind.Boost;
      var root=new GameObject("Track obstacle "+kind);root.transform.SetParent(trackRoot.transform,false);root.transform.localPosition=new Vector3(0,kind==TrackObstacleKind.Boost?.15f:kind==TrackObstacleKind.Gate?1.5f:1.1f,z);
      var body=root.AddComponent<Rigidbody>();body.isKinematic=true;body.useGravity=false;
      var movement=root.AddComponent<TrackBumper>();movement.Owner=this;movement.BasePosition=root.transform.position;movement.TrackZ=z;movement.Phase=z*.037f;movement.Forward=forward;movement.Kind=kind;
      var pivot=root.transform;
      TrackBox("Obstacle warning band",new Vector3(0,.035f,z-8),new Vector3(20,.05f,.45f),forward?cyan:yellow,false);
      for(int mark=0;mark<3;mark++)foreach(float side in new[]{-1f,1f}){
        var part=TrackBox("Approach warning stripe",new Vector3(side*9.7f,.04f,z-11-mark*1.3f),new Vector3(.6f,.06f,.5f),white,false);part.transform.localRotation=Quaternion.Euler(0,-side*35,0);
      }
      if(kind==TrackObstacleKind.Sliding){
        TrackBox("Sliding track rail",new Vector3(0,.03f,z),new Vector3(20,.04f,.3f),steel,false);
        ObstaclePart(pivot,"Armoured hydraulic ram",PrimitiveType.Cube,Vector3.zero,new Vector3(3.5f,1.35f,1.35f),steel);
        ObstaclePart(pivot,"Ram impact plate",PrimitiveType.Cube,new Vector3(0,0,-.7f),new Vector3(3.5f,1.35f,.12f),red);
        ObstacleTrigger(pivot,Vector3.zero,new Vector3(3.6f,1.4f,1.4f));
        foreach(float x in new[]{-1f,1f})ObstaclePart(pivot,"Bumper reflective stripe",PrimitiveType.Cube,new Vector3(x,0,-.69f),new Vector3(.3f,.85f,.06f),white);
        ObstaclePart(pivot,"Moving bumper mount",PrimitiveType.Cylinder,new Vector3(0,-.65f,0),new Vector3(1.3f,.3f,1.3f),steel);
      }else if(kind==TrackObstacleKind.Rotating){
        TrackBox("Sweeper base",new Vector3(0,.07f,z),new Vector3(2,.14f,2),steel,false);
        ObstaclePart(pivot,"Industrial rotating steel arm",PrimitiveType.Cube,Vector3.zero,new Vector3(9.5f,.95f,.95f),steel);
        foreach(float end in new[]{-4.1f,4.1f})ObstaclePart(pivot,"Sweeper impact head",PrimitiveType.Cube,new Vector3(end,0,0),new Vector3(1.2f,1,.98f),red);
        ObstacleTrigger(pivot,Vector3.zero,new Vector3(9.6f,1,1));
        ObstaclePart(pivot,"Sweeper motor",PrimitiveType.Cylinder,new Vector3(0,-.25f,0),new Vector3(1.5f,.65f,1.5f),steel);
        ObstaclePart(pivot,"Sweeper beacon",PrimitiveType.Cylinder,new Vector3(0,.6f,0),new Vector3(.9f,.14f,.9f),yellow);
        foreach(float x in new[]{-3.5f,-2,2,3.5f})ObstaclePart(pivot,"Sweeper stripe",PrimitiveType.Cube,new Vector3(x,0,-.5f),new Vector3(.35f,.7f,.06f),white);
      }else if(kind==TrackObstacleKind.Gate){
        foreach(float x in new[]{-13.7f,13.7f}){
          TrackBox("Gate support",new Vector3(x,4.2f,z),new Vector3(.5f,8.4f,1.1f),steel,false);
          TrackBox("Gate support reflector",new Vector3(x,3.6f,z-.6f),new Vector3(.16f,5.5f,.08f),yellow,false);
        }
        TrackBox("Gate crossbeam",new Vector3(0,8.6f,z),new Vector3(28,1,1.2f),steel,false);
        ObstaclePart(pivot,"Rising gate panel",PrimitiveType.Cube,Vector3.zero,new Vector3(26.7f,2.7f,.8f),red);
        ObstacleTrigger(pivot,Vector3.zero,new Vector3(26.7f,2.7f,.8f));
        for(int i=-12;i<=12;i++){
          var stripe=ObstaclePart(pivot,"Gate diagonal stripe",PrimitiveType.Cube,new Vector3(i,0,-.43f),new Vector3(.32f,1.9f,.04f),white);stripe.transform.localRotation=Quaternion.Euler(0,0,-28);
        }
        var light=TrackMaterial(new Color(1,.64f,.06f));movement.Signal=light;
        foreach(float x in new[]{-4.5f,0,4.5f})ObstaclePart(pivot,"Gate warning light",PrimitiveType.Sphere,new Vector3(x,1.65f,-.15f),new Vector3(.45f,.45f,.45f),light);
      }else if(kind==TrackObstacleKind.Slalom){
        for(int i=-1;i<=1;i++){
          float x=i%2==0?-5:5;ObstaclePart(pivot,"Reinforced slalom barricade",PrimitiveType.Cube,new Vector3(x,0,i*5),new Vector3(5.5f,1.3f,1.3f),steel);
          ObstaclePart(pivot,"Barricade impact plate",PrimitiveType.Cube,new Vector3(x,0,i*5-.63f),new Vector3(5.4f,1.2f,.08f),red);
          ObstacleTrigger(pivot,new Vector3(x,0,i*5),new Vector3(5.6f,1.3f,1.3f));
          ObstaclePart(pivot,"Slalom reflective stripe",PrimitiveType.Cube,new Vector3(x,0,i*5-.66f),new Vector3(.4f,.9f,.05f),white);
        }
      }else if(kind==TrackObstacleKind.Swing){
        foreach(float x in new[]{-13.7f,13.7f})TrackBox("Swing frame",new Vector3(x,4.6f,z),new Vector3(.5f,9.2f,.7f),steel,false);
        TrackBox("Swing upper frame",new Vector3(0,9.3f,z),new Vector3(28,.5f,.7f),steel,false);
        ObstaclePart(pivot,"Heavy demolition ball",PrimitiveType.Sphere,Vector3.zero,new Vector3(2.6f,2.6f,2.6f),steel);
        foreach(float side in new[]{-1f,1f})ObstaclePart(pivot,"Demolition ball steel rivet",PrimitiveType.Sphere,new Vector3(side*.82f,.6f,-.65f),Vector3.one*.3f,yellow);
        ObstaclePart(pivot,"Swinging ball band",PrimitiveType.Cube,new Vector3(0,0,-1.39f),new Vector3(.45f,1.9f,.05f),white);
        ObstacleTrigger(pivot,Vector3.zero,new Vector3(2.6f,2.6f,2.6f));
        var cable=TrackBox("Swing cable",new Vector3(0,5,z),new Vector3(.08f,6,.08f),steel,false,false);movement.Cable=cable.transform;movement.Anchor=trackOrigin+new Vector3(0,9.3f,z);
      }else{
        ObstaclePart(pivot,"Forward pad base",PrimitiveType.Cube,new Vector3(0,-.05f,0),new Vector3(10,.22f,6.5f),steel);
        ObstaclePart(pivot,"Forward pad surface",PrimitiveType.Cube,Vector3.zero,new Vector3(9.4f,.22f,6),cyan);
        ObstacleTrigger(pivot,new Vector3(0,.55f,0),new Vector3(9.4f,1.3f,6));
        for(int row=-1;row<=1;row++)for(int lane=-1;lane<=1;lane++)ObstacleChevron(pivot,lane*2.8f,row*1.7f,white);
        foreach(float x in new[]{-4.8f,4.8f})ObstaclePart(pivot,"Pad illuminated edge",PrimitiveType.Cube,new Vector3(x,.13f,0),new Vector3(.15f,.06f,6),trackGlow);
      }
      if(!forward){
        for(int bolt=-1;bolt<=1;bolt+=2)ObstaclePart(pivot,"Impact plate bolt",PrimitiveType.Cylinder,new Vector3(bolt*.7f,.3f,-.73f),new Vector3(.16f,.04f,.16f),yellow).transform.localRotation=Quaternion.Euler(90,0,0);
        foreach(float side in new[]{-1f,1f}){
          TrackBox("Industrial hazard marker",new Vector3(side*14.9f,1.2f,z-5),new Vector3(.35f,2.4f,.35f),steel,false);
          TrackBox("Amber hazard reflector",new Vector3(side*14.9f,2.5f,z-5),new Vector3(.65f,.35f,.4f),yellow,false);
        }
      }
    }
  }
  public class TrackBumper : MonoBehaviour {
    public VoiceDrive Owner;public Vector3 BasePosition,Anchor;public Transform Cable;public float Phase,TrackZ;public bool Forward;public TrackObstacleKind Kind;public Material Signal;
    Rigidbody body;float clock;BoxCollider[] contacts;bool contactHeld;
    public bool GateOpen {get{return Kind==TrackObstacleKind.Gate&&transform.position.y-BasePosition.y>4;}}
    public void ResetForRound(){clock=0;contactHeld=false;transform.position=BasePosition;transform.rotation=Quaternion.identity;if(body){body.position=BasePosition;body.rotation=Quaternion.identity;}}
    void FixedUpdate(){
      if(!body)body=GetComponent<Rigidbody>();if(!Owner||Owner.TrackObstaclePaused(TrackZ))return;
      CheckContact();
      clock+=Time.fixedDeltaTime;
      if(Kind==TrackObstacleKind.Sliding)body.MovePosition(BasePosition+Vector3.right*(Mathf.Sin(clock*.8f+Phase)*8));
      else if(Kind==TrackObstacleKind.Rotating)body.MoveRotation(Quaternion.Euler(0,clock*55+Phase*30,0));
      else if(Kind==TrackObstacleKind.Gate){
        float cycle=Mathf.Repeat(clock+Phase,7),height=cycle<2?0:cycle<3?Mathf.SmoothStep(0,1,cycle-2):cycle<5?1:cycle<6?1-Mathf.SmoothStep(0,1,cycle-5):0;
        body.MovePosition(BasePosition+Vector3.up*(height*5.6f));
        if(Signal)Signal.color=height>.85f?new Color(.1f,.95f,.65f):new Color(1,.55f,.05f);
      }
      else if(Kind==TrackObstacleKind.Swing){
        float angle=Mathf.Sin(clock*.85f+Phase)*.85f;var target=Anchor+new Vector3(Mathf.Sin(angle)*7.5f,-Mathf.Cos(angle)*7.5f,0);body.MovePosition(target);
        if(Cable){var delta=target-Anchor;Cable.position=(target+Anchor)/2;Cable.rotation=Quaternion.FromToRotation(Vector3.up,delta);Cable.localScale=new Vector3(.08f,delta.magnitude,.08f);}
      }
    }
    // Sweep car bounds through a physics step so a thin gate cannot be skipped at turbo speed.
    public void CheckContact(){
      if(!Owner)return;var carBody=Owner.TrackBody;if(!carBody){contactHeld=false;return;}
      if(contacts==null)contacts=GetComponentsInChildren<BoxCollider>();
      var carCollider=VoiceDrive.Get<Collider>(carBody.GetComponent<CarController>(),"coll");if(!carCollider)return;
      Bounds bounds=carCollider.bounds;bool overlaps=false;
      foreach(var box in contacts){
        if(!box||!box.enabled)continue;
        Vector3 a=box.transform.InverseTransformPoint(bounds.center)-box.center;
        Vector3 b=box.transform.InverseTransformPoint(bounds.center+carBody.linearVelocity*Time.fixedDeltaTime)-box.center;
        Vector3 e=bounds.extents,half=box.size*.5f;
        Vector3 right=box.transform.right,up=box.transform.up,forward=box.transform.forward;
        half+=new Vector3(Mathf.Abs(right.x)*e.x+Mathf.Abs(right.y)*e.y+Mathf.Abs(right.z)*e.z,Mathf.Abs(up.x)*e.x+Mathf.Abs(up.y)*e.y+Mathf.Abs(up.z)*e.z,Mathf.Abs(forward.x)*e.x+Mathf.Abs(forward.y)*e.y+Mathf.Abs(forward.z)*e.z);
        if(SegmentBox(a,b,half)){overlaps=true;break;}
      }
      if(overlaps&&!contactHeld){contactHeld=true;Owner.HitTrackBumper(Forward);}else if(!overlaps)contactHeld=false;
    }
    public static bool SegmentBox(Vector3 a,Vector3 b,Vector3 half){float low=0,high=1;Vector3 delta=b-a;for(int axis=0;axis<3;axis++){if(Mathf.Abs(delta[axis])<.00001f){if(Mathf.Abs(a[axis])>half[axis])return false;continue;}float first=(-half[axis]-a[axis])/delta[axis],last=(half[axis]-a[axis])/delta[axis];if(first>last){float swap=first;first=last;last=swap;}low=Mathf.Max(low,first);high=Mathf.Min(high,last);if(low>high)return false;}return true;}
    void OnTriggerEnter(Collider other){if(other.GetComponentInParent<CarController>())CheckContact();}
    void OnTriggerStay(Collider other){if(other.GetComponentInParent<CarController>())CheckContact();}
  }
}
