using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float damageUntil,damagePauseStarted,damagePausedTotal;bool damageClockPaused;
    CarController damagedCar;
    GameObject damageRoot;ParticleSystem damageSmoke,damageSparks;
    Material damageMaterial;Texture2D damageTexture;
    bool resumeDamageSmoke,resumeDamageSparks;
    readonly List<Transform> damageWheels=new List<Transform>();
    readonly HashSet<Renderer> damageWheelRenderers=new HashSet<Renderer>();

    // Both wheel owners use this clock; gifts received during a menu pause get a full duration.
    float WheelDamageClock {get{
      float now=Time.unscaledTime;
      if(menuOpen&&!damageClockPaused){damageClockPaused=true;damagePauseStarted=now;}
      else if(!menuOpen&&damageClockPaused){damagePausedTotal+=now-damagePauseStarted;damageClockPaused=false;}
      return (damageClockPaused?damagePauseStarted:now)-damagePausedTotal;
    }}
    static float DamageDuration(float duration){return float.IsNaN(duration)||float.IsInfinity(duration)||duration<=0?10:duration;}
    public bool Damaged {get{return damagedCar&&damagedCar==car&&WheelDamageClock<damageUntil;}}
    public float DamageRemaining {get{return Mathf.Max(0,damageUntil-WheelDamageClock);}}

    public void StartTimedDamage(float duration){
      if(!car)throw new System.InvalidOperationException("Vehicle is unavailable.");
      EnsureActionVisuals();UpdateTimedDamage();
      var pivots=Get<Transform[]>(car,"wheelPivots");
      var body=Get<MeshRenderer>(car,"CarColorMeshR");var visual=Get<Transform>(car,"Visual");
      var wheels=new List<Transform>();
      if(pivots!=null)foreach(var pivot in pivots){
        if(!pivot||pivot==car.transform||pivot==visual||body&&(body.transform==pivot||body.transform.IsChildOf(pivot))||wheels.Contains(pivot)||pivot.GetComponentsInChildren<Renderer>(true).Length==0)continue;
        wheels.Add(pivot);
      }
      if(wheels.Count==0)throw new System.InvalidOperationException("Wheel visuals are unavailable.");
      RestoreWheelBankOffset();
      damagedCar=car;damageUntil=Mathf.Max(damageUntil,WheelDamageClock+DamageDuration(duration));
      foreach(var wheel in wheels){if(!damageWheels.Contains(wheel))damageWheels.Add(wheel);HideWheelRenderers(wheel,damageWheelRenderers);}
      Throttle=0;var rb=Get<Rigidbody>(car,"rb");if(rb&&!rb.isKinematic)rb.linearVelocity=rb.angularVelocity=Vector3.zero;
      EnsureDamageParticles();
      // Repeated explosions reuse the same bounded systems and extend the deadline.
      damageSparks.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
      damageSparks.Play();damageSparks.Emit(48);
      if(!damageSmoke.isPlaying)damageSmoke.Play();
      damageSmoke.Emit(12);
      PauseDamageParticles();
    }
    public void UpdateTimedDamage(){
      float now=WheelDamageClock;
      if(missingWheels.Count>0&&now>=wheelUntil)RestoreWheel();
      if(!damagedCar||damagedCar!=car||now>=damageUntil){
        if(damagedCar||damageRoot||damageWheelRenderers.Count>0)ClearTimedDamage();
        return;
      }
      Throttle=0;PauseDamageParticles();
    }
    public void ClearTimedDamage(){
      RestoreWheelBankOffset();damageUntil=0;damagedCar=null;
      damageWheels.Clear();damageWheelRenderers.Clear();RefreshWheelRenderers();
      if(damageRoot){damageRoot.SetActive(false);Destroy(damageRoot);}damageRoot=null;
      damageSmoke=damageSparks=null;resumeDamageSmoke=resumeDamageSparks=false;
      if(damageMaterial)Destroy(damageMaterial);damageMaterial=null;
      if(damageTexture)Destroy(damageTexture);damageTexture=null;
    }
    void PauseDamageParticles(){
      if(menuOpen){
        if(damageSmoke&&damageSmoke.isPlaying){resumeDamageSmoke=true;damageSmoke.Pause();}
        if(damageSparks&&damageSparks.isPlaying){resumeDamageSparks=true;damageSparks.Pause();}
      }else{
        if(damageSmoke&&resumeDamageSmoke)damageSmoke.Play();
        if(damageSparks&&resumeDamageSparks)damageSparks.Play();
        resumeDamageSmoke=resumeDamageSparks=false;
      }
    }
    void EnsureDamageParticles(){
      if(damageRoot)return;
      damageRoot=new GameObject("Timed vehicle damage");damageRoot.transform.SetParent(actionVisualRoot.transform,false);
      damageTexture=new Texture2D(32,32,TextureFormat.RGBA32,false);damageTexture.wrapMode=TextureWrapMode.Clamp;
      for(int y=0;y<32;y++)for(int x=0;x<32;x++){
        float radius=new Vector2((x-15.5f)/15.5f,(y-15.5f)/15.5f).magnitude;
        damageTexture.SetPixel(x,y,new Color(1,1,1,Mathf.Pow(Mathf.Clamp01(1-radius),2)));
      }
      damageTexture.Apply();
      damageMaterial=new Material(Shader.Find("Sprites/Default")??Shader.Find("Universal Render Pipeline/Particles/Unlit"));
      damageMaterial.color=Color.white;damageMaterial.mainTexture=damageTexture;
      if(damageMaterial.HasProperty("_BaseMap"))damageMaterial.SetTexture("_BaseMap",damageTexture);
      if(damageMaterial.HasProperty("_Surface")){
        damageMaterial.SetFloat("_Surface",1);damageMaterial.SetFloat("_Blend",0);
        damageMaterial.SetFloat("_SrcBlend",5);damageMaterial.SetFloat("_DstBlend",10);damageMaterial.SetFloat("_ZWrite",0);
        damageMaterial.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");damageMaterial.renderQueue=3000;
      }
      damageSmoke=CreateDamageParticles("Engine smoke",true,96,new Vector3(0,2f,.8f));
      var main=damageSmoke.main;main.startLifetime=new ParticleSystem.MinMaxCurve(1.1f,2.2f);main.startSpeed=new ParticleSystem.MinMaxCurve(2.5f,3.5f);
      main.startSize=new ParticleSystem.MinMaxCurve(.8f,1.4f);main.startColor=new Color(.22f,.22f,.22f,.85f);
      var emission=damageSmoke.emission;emission.rateOverTime=25;
      var shape=damageSmoke.shape;shape.shapeType=ParticleSystemShapeType.Cone;shape.angle=22;shape.radius=.35f;
      var size=damageSmoke.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,AnimationCurve.Linear(0,.6f,1,2));
      damageSparks=CreateDamageParticles("Explosion sparks",false,64,new Vector3(0,.7f,.3f));
      main=damageSparks.main;main.duration=1;main.startLifetime=new ParticleSystem.MinMaxCurve(.25f,.7f);main.startSpeed=new ParticleSystem.MinMaxCurve(4,9);
      main.startSize=new ParticleSystem.MinMaxCurve(.07f,.16f);main.startColor=new Color(1,.55f,.08f,1);main.gravityModifier=1;
      emission=damageSparks.emission;emission.rateOverTime=0;
      shape=damageSparks.shape;shape.shapeType=ParticleSystemShapeType.Sphere;shape.radius=.45f;
    }
    ParticleSystem CreateDamageParticles(string name,bool loop,int limit,Vector3 position){
      var obj=new GameObject(name);obj.transform.SetParent(damageRoot.transform,false);
      obj.transform.localPosition=position;obj.transform.localRotation=Quaternion.Euler(-90,0,0);
      var particles=obj.AddComponent<ParticleSystem>();particles.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
      var main=particles.main;main.playOnAwake=false;main.loop=loop;main.maxParticles=limit;
      main.simulationSpace=ParticleSystemSimulationSpace.World;main.useUnscaledTime=true;
      var renderer=particles.GetComponent<ParticleSystemRenderer>();renderer.sharedMaterial=damageMaterial;renderer.renderMode=ParticleSystemRenderMode.Billboard;
      var colors=particles.colorOverLifetime;colors.enabled=true;var gradient=new Gradient();
      gradient.SetKeys(new[]{new GradientColorKey(Color.white,0),new GradientColorKey(Color.white,1)},new[]{new GradientAlphaKey(1,0),new GradientAlphaKey(.75f,.55f),new GradientAlphaKey(0,1)});colors.color=gradient;
      return particles;
    }
  }
}
