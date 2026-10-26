using System;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject reverseRocket;CarController reverseRocketCar;int reverseRocketGeneration;
    readonly List<Transform> reverseRocketFlames=new List<Transform>();

    bool GiftLandingClear(Vector3 to,Quaternion rotation){
      var own=Get<Collider>(car,"coll");
      Vector3 half=own?own.bounds.extents:new Vector3(1.4f,.65f,2);
      Vector3 offset=own?own.bounds.center-car.transform.position:Vector3.zero;
      foreach(var collider in Physics.OverlapBox(to+offset,half+Vector3.one*.15f,Quaternion.identity,~0,QueryTriggerInteraction.Collide)){
        if(collider.transform.IsChildOf(car.transform))continue;
        if(collider.isTrigger&&!collider.GetComponentInParent<RoadHazard>())continue;
        if(collider.bounds.max.y<=to.y+offset.y-half.y+.05f)continue;
        return false;
      }
      return true;
    }

    bool TrySafeTrackLanding(float requested,bool forward,out Vector3 to){
      float currentX=Mathf.Clamp(car.transform.position.x-trackOrigin.x,-12,12);
      for(int step=0;step<25;step++){
        float offset=step==0?0:Mathf.Ceil(step/2f)*(step%2==1?1:-1)*(forward?1:-1);
        float z=trackLayout.SafeZ(Mathf.Clamp(requested+offset,0,builtLength),forward);
        foreach(float x in new[]{currentX,-10.5f,-3.5f,3.5f,10.5f}){
          to=trackOrigin+new Vector3(x,trackLayout.SurfaceY(z,x)+1.5f,z);
          if(GiftLandingClear(to,Quaternion.identity))return true;
        }
      }
      to=Vector3.zero;return false;
    }

    void PrepareReverseLanding(Vector3 from,Vector3 to,Quaternion rotation){
      if(!GiftLandingClear(to,rotation))throw new InvalidOperationException("Hedefte engel var; güvenli iniş yapılamıyor.");
      // Clear the entire corridor before descending, including moving road gifts.
      var corridor=new Bounds(from,Vector3.zero);corridor.Encapsulate(to);corridor.Expand(new Vector3(3.2f,26,4.4f));
      foreach(var collider in Physics.OverlapBox(corridor.center,corridor.extents,Quaternion.identity,~0,QueryTriggerInteraction.Ignore)){
        if(collider.transform.IsChildOf(car.transform))continue;
        motionLift=Mathf.Max(motionLift,collider.bounds.max.y-Mathf.Min(from.y,to.y)+2.5f);
      }
    }

    GameObject ReverseRocketPart(Transform parent,string name,PrimitiveType shape,Vector3 position,Vector3 scale,Material material){
      var part=GameObject.CreatePrimitive(shape);part.name=name;var collider=part.GetComponent<Collider>();collider.enabled=false;Destroy(collider);
      part.transform.SetParent(parent,false);part.transform.localPosition=position;part.transform.localScale=scale;part.GetComponent<Renderer>().sharedMaterial=material;return part;
    }

    void StartReverseRocket(){
      ReleaseReverseRocket();
      reverseRocket=new GameObject("Front mounted reverse rocket");reverseRocket.transform.SetParent(actionVisualRoot.transform,false);
      reverseRocket.transform.localPosition=Vector3.up*1.1f;
      reverseRocketCar=car;reverseRocketGeneration=effectGeneration;
      var assets=reverseRocket.AddComponent<ReverseRocketAssets>();assets.Cone=Instantiate(Cone());assets.Cone.name="Reverse rocket cone";
      var steel=assets.Material(new Color(.7f,.77f,.81f));var dark=assets.Material(new Color(.1f,.13f,.15f));
      var red=assets.Material(new Color(.9f,.12f,.16f));var fire=assets.Material(new Color(1,.45f,.03f));var hot=assets.Material(new Color(1,.96f,.68f));
      ReverseRocketPart(reverseRocket.transform,"Front rocket mounting bar",PrimitiveType.Cube,new Vector3(0,.4f,1.75f),new Vector3(2,.16f,.2f),dark);
      foreach(float flank in new[]{-1f,1f}){
        float side=flank*2;
        var pod=ReverseRocketPart(reverseRocket.transform,"Reverse thrust motor",PrimitiveType.Cylinder,new Vector3(side*.8f,.45f,2.1f),new Vector3(.5f,.45f,.5f),steel);
        pod.transform.localRotation=Quaternion.FromToRotation(Vector3.up,Vector3.forward);
        var nozzle=ReverseRocketPart(reverseRocket.transform,"Forward facing exhaust nozzle",PrimitiveType.Cylinder,new Vector3(side*.8f,.45f,2.58f),new Vector3(.62f,.12f,.62f),dark);
        nozzle.transform.localRotation=pod.transform.localRotation;
        var nose=new GameObject("Reverse rocket nose");nose.transform.SetParent(reverseRocket.transform,false);nose.transform.localPosition=new Vector3(side*.8f,.45f,1.65f);
        nose.transform.localRotation=Quaternion.FromToRotation(Vector3.up,Vector3.back);nose.transform.localScale=new Vector3(.25f,.4f,.25f);
        nose.AddComponent<MeshFilter>().sharedMesh=assets.Cone;nose.AddComponent<MeshRenderer>().sharedMaterial=red;
        ReverseRocketPart(reverseRocket.transform,"Rocket stabilizer",PrimitiveType.Cube,new Vector3(side*.8f,.45f,1.95f),new Vector3(.82f,.07f,.38f),red);
        var flame=new GameObject("Forward exhaust pushes car backward");flame.transform.SetParent(reverseRocket.transform,false);flame.transform.localPosition=new Vector3(side*.8f,.45f,2.7f);
        flame.transform.localRotation=Quaternion.FromToRotation(Vector3.up,Vector3.forward);flame.transform.localScale=new Vector3(.32f,2.3f,.32f);
        flame.AddComponent<MeshFilter>().sharedMesh=assets.Cone;flame.AddComponent<MeshRenderer>().sharedMaterial=fire;reverseRocketFlames.Add(flame.transform);
        var core=new GameObject("Reverse exhaust hot core");core.transform.SetParent(flame.transform,false);core.transform.localScale=new Vector3(.55f,.75f,.55f);
        core.AddComponent<MeshFilter>().sharedMesh=assets.Cone;core.AddComponent<MeshRenderer>().sharedMaterial=hot;
      }
    }

    void UpdateReverseRocket(){
      if(!reverseRocket){reverseRocketFlames.Clear();reverseRocketCar=null;return;}
      if(!Ready||car!=reverseRocketCar||!giftMotion||motionFinished||!motionBackward||effectGeneration!=reverseRocketGeneration){ReleaseReverseRocket();return;}
      if(menuOpen)return;
      foreach(var flame in reverseRocketFlames)if(flame)flame.localScale=new Vector3(.32f,2.3f+Mathf.Sin(motionAge*39)*.35f,.32f);
    }

    void ReleaseReverseRocket(){
      if(reverseRocket){reverseRocket.SetActive(false);reverseRocket.GetComponent<ReverseRocketAssets>().Release();Destroy(reverseRocket);}
      reverseRocket=null;reverseRocketCar=null;reverseRocketFlames.Clear();
    }
  }

  public sealed class ReverseRocketAssets:MonoBehaviour {
    public Mesh Cone;
    readonly List<Material> materials=new List<Material>();
    public Material Material(Color color){var material=new Material(Shader.Find("Universal Render Pipeline/Unlit")??Shader.Find("Sprites/Default"));material.color=color;materials.Add(material);return material;}
    public void Release(){foreach(var material in materials)if(material)Destroy(material);materials.Clear();if(Cone)Destroy(Cone);Cone=null;}
    void OnDestroy(){Release();}
  }
}
