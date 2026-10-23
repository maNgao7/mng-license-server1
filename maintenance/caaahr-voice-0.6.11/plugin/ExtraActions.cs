using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float brakeUntil,windUntil,iceUntil,bounceUntil,nextBounce,windStrength=2,bounceStrength=2,windSide=1,nextWindShift;
    Vector3 iceDirection;
    GameObject extraRoot,brakeVisual,windVisual,iceVisual,bounceVisual;
    Rigidbody menuBody;RigidbodyConstraints menuConstraints;
    bool Braking {get{return Time.unscaledTime<brakeUntil;}}
    bool Icy {get{return Time.unscaledTime<iceUntil;}}
    void ResetExtraEffects(){brakeUntil=windUntil=iceUntil=bounceUntil=nextBounce=eggUntil=0;iceDirection=Vector3.zero;}
    void UpdateMenuPause(){
      if(!menuOpen||!Ready||startingGame||giftMotion){ReleaseMenuPause();return;}
      var rb=Get<Rigidbody>(car,"rb");if(!rb||rb.isKinematic)return;
      if(menuBody!=rb){ReleaseMenuPause();menuBody=rb;menuConstraints=rb.constraints;}
      rb.linearVelocity=rb.angularVelocity=Vector3.zero;rb.constraints=RigidbodyConstraints.FreezeAll;
    }
    void ReleaseMenuPause(){if(menuBody)menuBody.constraints=menuConstraints;menuBody=null;}
    public bool PauseCamera {get{return menuOpen&&!startingGame&&enteredGame;}}
    public void WidenDrivingCamera(CamControl controller){
      if(!Ready||menuOpen||controller!=Get<GameManager>(car,"gameManager").camControl)return;
      var camera=Get<Camera>(controller,"cam");if(!camera)return;
      var position=camera.transform.localPosition;position.z*=1.28f;position.y+=1.2f;camera.transform.localPosition=position;
    }
    void UpdateExtraPhysics(){
      if(!Ready||menuOpen||!Focused||Jailed||giftMotion)return;
      var rb=Get<Rigidbody>(car,"rb");if(!rb||rb.isKinematic)return;
      if(Braking){rb.linearVelocity=new Vector3(0,rb.linearVelocity.y,0);return;}
      if(Time.unscaledTime<windUntil){
        if(Time.unscaledTime>=nextWindShift){windSide=-windSide;nextWindShift=Time.unscaledTime+UnityEngine.Random.Range(.85f,1.8f);windShifts++;}
        float side=windSide*(.7f+.3f*Mathf.Sin(Time.unscaledTime*4));
        float lateral=Vector3.Dot(rb.linearVelocity,car.transform.right),wanted=side*Mathf.Clamp(3+windStrength*1.3f,3,13);
        rb.AddForce(car.transform.right*(wanted-lateral)*Mathf.Clamp01(Time.fixedDeltaTime*4),ForceMode.VelocityChange);
      }
      if(Time.unscaledTime<bounceUntil&&car.isGrounded&&Time.unscaledTime>=nextBounce){
        nextBounce=Time.unscaledTime+1.25f;var velocity=rb.linearVelocity;velocity.y=Mathf.Max(velocity.y,Mathf.Clamp(8+bounceStrength*2,9,22));rb.linearVelocity=velocity;
      }
    }
    GameObject EffectNode(string name){var node=new GameObject(name);node.transform.SetParent(extraRoot.transform,false);return node;}
    LineRenderer EffectLine(GameObject parent,string name,Color color,int count,bool loop,float width){
      var node=new GameObject(name);node.transform.SetParent(parent.transform,false);var line=node.AddComponent<LineRenderer>();line.useWorldSpace=false;line.loop=loop;line.positionCount=count;line.widthMultiplier=width;line.sharedMaterial=ActionMaterial(color);return line;
    }
    void EnsureExtraVisuals(){
      EnsureActionVisuals();if(extraRoot)return;
      extraRoot=new GameObject("Extra gift effects");extraRoot.transform.SetParent(actionVisualRoot.transform,false);
      brakeVisual=EffectNode("Red handbrake lamps");
      foreach(float side in new[]{-1f,1f}){var light=GameObject.CreatePrimitive(PrimitiveType.Sphere);Destroy(light.GetComponent<Collider>());light.transform.SetParent(brakeVisual.transform,false);light.transform.localPosition=new Vector3(side*.8f,.55f,-1.7f);light.transform.localScale=new Vector3(.4f,.22f,.12f);light.GetComponent<Renderer>().sharedMaterial=ActionMaterial(new Color(1,.08f,.12f));}
      windVisual=EffectNode("Moving crosswind streaks");
      BuildWindLeaves();
      iceVisual=EffectNode("Icy wheel rings");var wheels=Get<Transform[]>(car,"wheelPivots");
      if(wheels!=null)foreach(var wheel in wheels)if(wheel){var line=EffectLine(iceVisual,"Frozen tyre",new Color(.3f,.85f,1),24,true,.1f);var center=car.transform.InverseTransformPoint(wheel.position);for(int i=0;i<24;i++){float angle=i*Mathf.PI*2/24;line.SetPosition(i,center+new Vector3(0,Mathf.Cos(angle)*.6f,Mathf.Sin(angle)*.6f));}}
      bounceVisual=EffectNode("Spring suspension coils");
      foreach(float side in new[]{-1f,1f})foreach(float end in new[]{-1f,1f}){var line=EffectLine(bounceVisual,"Spring coil",new Color(1,.83f,.13f),45,false,.06f);for(int i=0;i<45;i++){float a=i*Mathf.PI/4;line.SetPosition(i,new Vector3(side*1.2f+Mathf.Cos(a)*.18f,-.55f+i*.028f,end*1.15f+Mathf.Sin(a)*.18f));}}
    }
    void UpdateExtraVisuals(){
      UpdateMeteor();UpdateTornado();UpdateBirdEgg();if(!extraRoot)return;
      brakeVisual.SetActive(Ready&&Braking);windVisual.SetActive(Ready&&Time.unscaledTime<windUntil);iceVisual.SetActive(Ready&&Icy);bounceVisual.SetActive(Ready&&Time.unscaledTime<bounceUntil);
      if(menuOpen)return;
      UpdateWindLeaves();
      bounceVisual.transform.localScale=new Vector3(1,.8f+Mathf.Sin(Time.unscaledTime*8)*.2f,1);
    }
    void DrawExtraTimers(ref float y){
      foreach(var effect in new[]{new KeyValuePair<string,float>("El freni",brakeUntil),new KeyValuePair<string,float>("Yan rüzgâr",windUntil),new KeyValuePair<string,float>("Hortum",tornadoUntil),new KeyValuePair<string,float>("Buzlu lastikler",iceUntil),new KeyValuePair<string,float>("Yumurta izi",eggUntil),new KeyValuePair<string,float>("Zıplayan süspansiyon",bounceUntil)})if(effect.Value>Time.unscaledTime){GUI.Label(new Rect(16,y,500,24),effect.Key+": "+Mathf.CeilToInt(effect.Value-Time.unscaledTime)+" sn");y+=25;}
    }
    int windShifts;
    void ReleaseExtraVisuals(){ReleaseMeteor();ReleaseTornado();ReleaseBirdEgg();ReleaseRoadGifts();if(extraRoot)Destroy(extraRoot);extraRoot=brakeVisual=windVisual=iceVisual=bounceVisual=null;}
  }
  [HarmonyLib.HarmonyPatch(typeof(CamControl),"Update")]class MenuCameraUpdatePatch{static bool Prefix(){return VoiceDrive.Instance==null||!VoiceDrive.Instance.PauseCamera;}}
  [HarmonyLib.HarmonyPatch(typeof(CamControl),"LateUpdate")]class MenuCameraInputPatch{
    static bool Prefix(){return VoiceDrive.Instance==null||!VoiceDrive.Instance.PauseCamera;}
    static void Postfix(CamControl __instance){if(VoiceDrive.Instance!=null)VoiceDrive.Instance.WidenDrivingCamera(__instance);}
  }
}
