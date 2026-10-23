using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject actionVisualRoot,shieldVisual;CarController visualCar;
    readonly List<ParticleSystem> rocketFlames=new List<ParticleSystem>();readonly List<Material> actionMaterials=new List<Material>();
    Texture2D flameTexture;float wheelUntil;
    readonly List<Transform> missingWheels=new List<Transform>();
    sealed class WheelBankPose {
      public Transform part,parent;public Vector3 position,appliedPosition;public Quaternion rotation,appliedRotation;
    }
    readonly List<WheelBankPose> wheelBankPoses=new List<WheelBankPose>();bool wheelBankReported;
    readonly List<Transform> flameCores=new List<Transform>();
    readonly Dictionary<Renderer,bool> wheelRenderers=new Dictionary<Renderer,bool>();
    readonly HashSet<Renderer> giftWheelRenderers=new HashSet<Renderer>();
    public bool WheelMissing {get{return MissingWheelCount>0;}}
    public float WheelRemaining {get{return Mathf.Max(0,wheelUntil-WheelDamageClock);}}
    public int MissingWheelCount {get{return Damaged?damageWheels.Count:WheelDamageClock<wheelUntil?missingWheels.Count:0;}}
    public float MissingWheelPull {get{if(!WheelMissing||!car)return 0;float sum=0;foreach(var wheel in missingWheels)if(wheel)sum+=Mathf.Sign(car.transform.InverseTransformPoint(wheel.position).x);return Mathf.Clamp(sum*.045f,-.12f,.12f);}}
    Material ActionMaterial(Color color){var material=new Material(Shader.Find("Universal Render Pipeline/Unlit")??Shader.Find("Sprites/Default"));material.color=color;actionMaterials.Add(material);return material;}
    void EnsureActionVisuals(){
      if(!car)return;if(actionVisualRoot&&visualCar==car)return;ReleaseActionVisuals();visualCar=car;
      actionVisualRoot=new GameObject("TikMnG gift effects");actionVisualRoot.transform.SetParent(car.transform,false);
      actionVisualRoot.AddComponent<WheelBankRestore>().owner=this;actionVisualRoot.AddComponent<WheelBankApply>().owner=this;
      flameTexture=new Texture2D(32,32,TextureFormat.RGBA32,false);flameTexture.wrapMode=TextureWrapMode.Clamp;
      for(int y=0;y<32;y++)for(int x=0;x<32;x++){float radius=new Vector2((x-15.5f)/15.5f,(y-15.5f)/15.5f).magnitude;flameTexture.SetPixel(x,y,new Color(1,1,1,Mathf.Pow(Mathf.Clamp01(1-radius),1.4f)));}flameTexture.Apply();
      foreach(float side in new[]{-1f,1f}){
        var core=new GameObject("Rocket flame core");core.transform.SetParent(actionVisualRoot.transform,false);core.transform.localPosition=new Vector3(side*.75f,.25f,-1.7f);core.transform.localRotation=Quaternion.FromToRotation(Vector3.up,Vector3.back);core.AddComponent<MeshFilter>().sharedMesh=Cone();core.AddComponent<MeshRenderer>().sharedMaterial=ActionMaterial(new Color(1,.5f,.025f));flameCores.Add(core.transform);
        var inner=new GameObject("Hot flame center");inner.transform.SetParent(core.transform,false);inner.transform.localScale=new Vector3(.55f,.72f,.55f);inner.transform.localPosition=new Vector3(0,-.015f,0);inner.AddComponent<MeshFilter>().sharedMesh=Cone();inner.AddComponent<MeshRenderer>().sharedMaterial=ActionMaterial(new Color(1,.96f,.55f));
        core.SetActive(false);
        var jet=new GameObject("Rocket exhaust");jet.transform.SetParent(actionVisualRoot.transform,false);jet.transform.localPosition=new Vector3(side*.75f,.25f,-1.7f);jet.transform.localRotation=Quaternion.LookRotation(Vector3.back);
        var flame=jet.AddComponent<ParticleSystem>();var main=flame.main;main.playOnAwake=false;main.loop=true;main.startLifetime=new ParticleSystem.MinMaxCurve(.12f,.24f);main.startSpeed=new ParticleSystem.MinMaxCurve(11,17);main.startSize=new ParticleSystem.MinMaxCurve(.32f,.55f);main.maxParticles=90;main.simulationSpace=ParticleSystemSimulationSpace.World;
        main.startColor=new Color(1,.74f,.13f);var emission=flame.emission;emission.rateOverTime=100;var shape=flame.shape;shape.shapeType=ParticleSystemShapeType.Cone;shape.angle=7;shape.radius=.07f;
        var colors=flame.colorOverLifetime;colors.enabled=true;var gradient=new Gradient();gradient.SetKeys(new[]{new GradientColorKey(new Color(1,.98f,.8f),0),new GradientColorKey(new Color(1,.48f,.03f),.45f),new GradientColorKey(new Color(.85f,.09f,.01f),1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(.8f,.5f),new GradientAlphaKey(0,1)});colors.color=gradient;
        var size=flame.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,AnimationCurve.Linear(0,1,1,0));
        var renderer=flame.GetComponent<ParticleSystemRenderer>();var material=new Material(Shader.Find("Universal Render Pipeline/Particles/Unlit")??Shader.Find("Sprites/Default"));material.SetTexture("_BaseMap",flameTexture);material.mainTexture=flameTexture;
        if(material.HasProperty("_Surface")){material.SetFloat("_Surface",1);material.SetFloat("_Blend",0);material.SetFloat("_SrcBlend",5);material.SetFloat("_DstBlend",10);material.SetFloat("_ZWrite",0);material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");material.renderQueue=3000;}
        actionMaterials.Add(material);renderer.sharedMaterial=material;renderer.renderMode=ParticleSystemRenderMode.Stretch;renderer.lengthScale=1.4f;renderer.velocityScale=.035f;flame.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);rocketFlames.Add(flame);
      }
      BuildShieldVisual();
      shieldVisual.SetActive(false);
    }
    void UpdateActionVisuals(){
      UpdateTimedDamage();
      if(!car||visualCar&&visualCar!=car){ReleaseActionVisuals();return;}if(giftMotion||Time.unscaledTime<boostUntil||Time.unscaledTime<shieldUntil)EnsureActionVisuals();
      bool flames=!Damaged&&(giftMotion&&motionForward||Ready&&Focused&&!menuOpen&&!Jailed&&Time.unscaledTime<boostUntil);
      foreach(var flame in rocketFlames)if(flame){if(flames&&!flame.isPlaying)flame.Play();else if(!flames&&flame.isPlaying)flame.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);}
      foreach(var core in flameCores)if(core){core.gameObject.SetActive(flames);core.localScale=new Vector3(.28f,2+Mathf.Sin(Time.unscaledTime*33)*.4f,.28f);}
      if(shieldVisual)shieldVisual.SetActive(Ready&&Time.unscaledTime<shieldUntil);
      if(missingWheels.Count>0&&WheelDamageClock>=wheelUntil)RestoreWheel();
    }
    void RemoveWheel(float duration){
      EnsureActionVisuals();
      if(!car)throw new System.InvalidOperationException("Vehicle is unavailable.");
      if(WheelDamageClock>=wheelUntil)RestoreWheel();
      var pivots=Get<Transform[]>(car,"wheelPivots");
      if(pivots==null||pivots.Length==0)throw new System.InvalidOperationException("Aracın tekerleği bulunamadı.");
      if(missingWheels.Count<4){
        Transform next=null;float best=float.MaxValue;
        var body=Get<MeshRenderer>(car,"CarColorMeshR");var visual=Get<Transform>(car,"Visual");
        RestoreWheelBankOffset();
        float firstSide=missingWheels.Count>0&&missingWheels[0]?car.transform.InverseTransformPoint(missingWheels[0].position).x:0;
        foreach(var pivot in pivots){
          if(!pivot||pivot==car.transform||pivot==visual||body&&(body.transform==pivot||body.transform.IsChildOf(pivot))||missingWheels.Contains(pivot)||pivot.GetComponentsInChildren<Renderer>(true).Length==0)continue;
          var position=car.transform.InverseTransformPoint(pivot.position);
          float score=missingWheels.Count==0?0:(position.x*firstSide>0?0:10000)+Mathf.Abs(position.z-car.transform.InverseTransformPoint(missingWheels[0].position).z);
          if(score<best){best=score;next=pivot;}
        }
        if(!next){if(missingWheels.Count==0)throw new System.InvalidOperationException("Tekerlek görüntüsü hazır değil.");}
        else{
          HideWheelRenderers(next,giftWheelRenderers);
          missingWheels.Add(next);
          Logger.LogInfo("Wheel removed: "+next.name+"; missing="+missingWheels.Count+"; hidden renderers="+wheelRenderers.Count+"; body enabled="+(body&&body.enabled));
        }
      }
      wheelUntil=Mathf.Max(wheelUntil,WheelDamageClock+DamageDuration(duration));
    }
    void HideWheelRenderers(Transform wheel,HashSet<Renderer> owners){
      var body=Get<MeshRenderer>(car,"CarColorMeshR");
      foreach(var renderer in wheel.GetComponentsInChildren<Renderer>(true)){
        if(renderer==body)continue;
        if(!wheelRenderers.ContainsKey(renderer))wheelRenderers.Add(renderer,renderer.enabled);
        owners.Add(renderer);renderer.enabled=false;
      }
    }
    void RefreshWheelRenderers(){
      var restored=new List<Renderer>();
      foreach(var item in wheelRenderers){
        bool hidden=giftWheelRenderers.Contains(item.Key)||damageWheelRenderers.Contains(item.Key);
        if(item.Key)item.Key.enabled=hidden?false:item.Value;
        if(!hidden)restored.Add(item.Key);
      }
      foreach(var renderer in restored)wheelRenderers.Remove(renderer);
    }
    public void RestoreWheelBankOffset(){
      foreach(var pose in wheelBankPoses)if(pose.part&&pose.part.parent==pose.parent){
        // Restore only our last write; native animation may have replaced either channel.
        if((pose.part.localPosition-pose.appliedPosition).sqrMagnitude<.0000001f)pose.part.localPosition=pose.position;
        if(Quaternion.Angle(pose.part.localRotation,pose.appliedRotation)<.001f)pose.part.localRotation=pose.rotation;
      }
      wheelBankPoses.Clear();
    }
    public void ApplyWheelBankOffset(){
      RestoreWheelBankOffset();if(!WheelMissing||Damaged||!car||visualCar!=car)return;
      var visual=Get<Transform>(car,"Visual");
      if(!visual||visual==car.transform||car.transform.IsChildOf(visual))return;
      float side=0,front=0;
      foreach(var wheel in missingWheels)if(wheel){var position=car.transform.InverseTransformPoint(wheel.position);side+=Mathf.Sign(position.x);front+=Mathf.Sign(position.z);}
      float roll=Mathf.Clamp(-side*8,-16,16),pitch=Mathf.Clamp(front*2.5f,-5,5);
      var body=Get<MeshRenderer>(car,"CarColorMeshR");
      Vector3 center=body?body.bounds.center:visual.position;
      Quaternion bank=visual.rotation*Quaternion.Euler(pitch,0,roll)*Quaternion.Inverse(visual.rotation);
      // Never offset the Fusion Visual: native Render reads it back for interpolation.
      foreach(var renderer in visual.GetComponentsInChildren<MeshRenderer>(true)){
        var part=renderer.transform;
        if(part==visual||part==car.transform||!part.parent||part.GetComponent<Fusion.NetworkTransform>()||part.GetComponentsInChildren<Rigidbody>(true).Length>0||part.GetComponentsInChildren<Collider>(true).Length>0)continue;
        // Only independent mesh leaves, so no transform receives a parent's bank twice.
        if(part.GetComponentsInChildren<Renderer>(true).Length!=1)continue;
        var pose=new WheelBankPose{part=part,parent=part.parent,position=part.localPosition,rotation=part.localRotation};
        Vector3 worldPosition=center+bank*(part.position-center);
        pose.appliedPosition=part.parent.InverseTransformPoint(worldPosition);
        pose.appliedRotation=Quaternion.Inverse(part.parent.rotation)*bank*part.rotation;
        wheelBankPoses.Add(pose);part.localPosition=pose.appliedPosition;part.localRotation=pose.appliedRotation;
      }
      if(!wheelBankReported){Logger.LogInfo("Wheel bank: mesh leaves="+wheelBankPoses.Count+"; Visual untouched="+visual.name+"; body="+(body?body.name:"none")+"; center="+center);wheelBankReported=true;}
    }
    void RestoreWheel(){RestoreWheelBankOffset();wheelBankReported=false;giftWheelRenderers.Clear();missingWheels.Clear();wheelUntil=0;RefreshWheelRenderers();}
    void ReleaseActionVisuals(){ClearTimedDamage();RestoreWheel();ReleaseExtraVisuals();if(leafMesh)Destroy(leafMesh);leafMesh=null;windLeafTravel=0;if(actionVisualRoot)Destroy(actionVisualRoot);actionVisualRoot=null;shieldVisual=null;visualCar=null;rocketFlames.Clear();flameCores.Clear();foreach(var mesh in shieldMeshes)Destroy(mesh);shieldMeshes.Clear();foreach(var material in actionMaterials)Destroy(material);actionMaterials.Clear();if(flameTexture)Destroy(flameTexture);flameTexture=null;}
  }
  [DefaultExecutionOrder(-10000)] public sealed class WheelBankRestore:MonoBehaviour {
    public VoiceDrive owner;
    void Update(){if(owner)owner.RestoreWheelBankOffset();}
    void OnDisable(){if(owner)owner.RestoreWheelBankOffset();}
  }
  [DefaultExecutionOrder(10000)] public sealed class WheelBankApply:MonoBehaviour {
    public VoiceDrive owner;
    void LateUpdate(){if(owner)owner.ApplyWheelBankOffset();}
    void OnDisable(){if(owner)owner.RestoreWheelBankOffset();}
  }
}
