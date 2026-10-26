using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly HashSet<string> runningCommands=new HashSet<string>();
    bool giftMotion,motionFinished,motionForward,motionTornado,motionBackward;int effectGeneration,motionRevision;
    Rigidbody motionBody;bool motionKinematic,motionCollisions,motionGravity;RigidbodyConstraints motionConstraints;
    Vector3 motionFrom,motionTo;Quaternion motionRotation;float motionAge,motionDuration,motionLift,motionClearUntil;
    string motionFailure;float motionMetres;
    CamControl motionCamera;float previousFollowSpeed;
    public bool MotionActive {get{return giftMotion;}}
    bool MotionSafe {get{return giftMotion||roundaboutStunRemaining>0||Time.unscaledTime<motionClearUntil;}}
    public static float GiftDistance(float distance){return float.IsNaN(distance)||float.IsInfinity(distance)?1:Mathf.Clamp(distance,1,5000);}
    public static float GiftTravelDuration(float metres,bool backward,bool tornado){return tornado?2.5f+metres/25:backward?1.3f+metres/30:.65f+metres/40;}
    public const float GiftQueueTimeout=220;
    bool Harmful(string action){return action=="explode"||action=="restart"||action=="backward"||action=="wheel"||action=="jail"||action=="slow"||action=="invert"||action=="brake"||action=="wind"||action=="ice"||action=="egg"||action=="tornado"||action=="logs"||action=="traffic";}
    bool ConsumeShield(string action){if(!Harmful(action)||Time.unscaledTime>=shieldUntil)return false;shieldUntil=0;UpdateActionVisuals();return true;}
    IEnumerator RunCommand(Command command){
      runningCommands.Add(command.id);var result=new Ack{id=command.id};int generation=effectGeneration,revision=0;bool startedMotion=false;float deadline=Time.unscaledTime+GiftQueueTimeout;
      while(command.action!="restart"&&(giftMotion||roundaboutStunRemaining>0)&&generation==effectGeneration&&Time.unscaledTime<deadline&&!CommandExpired(command)){if(menuOpen){deadline+=Time.unscaledDeltaTime;if(command.expiresAt>0)command.expiresAt+=Time.unscaledDeltaTime*1000;}yield return null;}
      try{
        if(generation!=effectGeneration||!Ready)throw new InvalidOperationException("Yarış değişti; eylem iptal edildi.");
        if((command.action!="restart"&&(giftMotion||roundaboutStunRemaining>0))||CommandExpired(command))throw new InvalidOperationException("Eylem sırası zamanında uygulanamadı.");
        ReleaseMenuPause();
        if(ConsumeShield(command.action)){result.ok=true;result.message="Kalkan engeli durdurdu ve kırıldı.";}
        else if(command.action=="restart"){result.message=RestartGiftInstant();generation=effectGeneration;result.ok=true;}
        else {if(FinishHold&&Harmful(command.action)){CancelFinish();generation=effectGeneration;}if(command.action=="forward"||command.action=="backward"||command.action=="tornado"){StartGiftMotion(command);revision=motionRevision;startedMotion=true;}
        else{result.message=Execute(command);result.ok=true;}}
      }catch(Exception error){result.message=error is InvalidOperationException?error.Message:"Eylem uygulanamadı.";Logger.LogWarning(command.action+": "+error);}
      if(startedMotion){
        while(giftMotion&&!motionFinished&&generation==effectGeneration&&revision==motionRevision)yield return null;
        result.ok=generation==effectGeneration&&revision==motionRevision&&string.IsNullOrEmpty(motionFailure);
        result.message=result.ok?(command.action=="forward"?motionMetres.ToString("0.#")+" m ileri itildi.":command.action=="backward"?motionMetres.ToString("0.#")+" m geri itildi.":command.action=="tornado"?"Hortum: "+motionMetres.ToString("0.#")+" m geriye savruldu.":"Başlangıca geri itildi."):motionFailure??"Yarış değişti; eylem iptal edildi.";
        if(result.ok&&Mathf.Abs(motionMetres-command.distance)>.5f)result.message+=" Parkur sınırı veya güvenli iniş nedeniyle mesafe ayarlandı.";
        if(generation==effectGeneration&&revision==motionRevision){giftMotion=false;UpdateActionVisuals();}
      }
      applied[command.id]=result;appliedOrder.Enqueue(command.id);if(appliedOrder.Count>500)applied.Remove(appliedOrder.Dequeue());runningCommands.Remove(command.id);
      notice=result.message;noticeUntil=Time.unscaledTime+4;yield return SendAck(command,result.ok,result.message);
    }
    bool CommandExpired(Command command){return command.expiresAt>0&&(DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds>=command.expiresAt;}
    string RestartGiftInstant(){
      var gm=Get<GameManager>(car,"gameManager");var rb=Get<Rigidbody>(car,"rb");
      var spawn=CustomActive?trackMap.SpawnPoint:gm.mapsObjs[activeMap].SpawnPoint;
      if(!rb||!spawn)throw new InvalidOperationException("Başlangıç noktası hazır değil.");
      bool automatic=trackFinished?roundAutoDrive:autoDrive;
      if(finishPending){LoadWins();wins--;SaveWins();}
      ReleaseCage();CancelGiftMotion("Başlangıca dönüldü; itiş iptal edildi.");giftMotion=false;motionRevision++;
      boostUntil=slowUntil=invertUntil=jailUntil=shieldUntil=0;boost=slow=1;ClearTimedDamage();ResetExtraEffects();ReleaseActionVisuals();ResetActionAudio();
      ReleaseMeteor();ReleaseTornado();roundaboutStunRemaining=0;
      finishPending=trackFinished=false;roundRestartAt=0;trackRunupUntil=trackImpactUntil=nextTrackImpact=0;lastTrackLaunch=-100;
      rb.isKinematic=false;rb.linearVelocity=rb.angularVelocity=Vector3.zero;
      car.SetPosAndRot(spawn.position,spawn.rotation);rb.position=spawn.position;rb.rotation=spawn.rotation;
      gm.savedPos=spawn.position;gm.savedRot=spawn.rotation;gm.roundTimer=0;gm.checkPointIndex=0;gm.deathCount=0;gm.canControl=true;
      if(gm.GameWonUI)gm.GameWonUI.SetActive(false);
      if(CustomActive){foreach(var obstacle in trackRoot.GetComponentsInChildren<TrackBumper>())obstacle.ResetForRound();foreach(var crossing in trackRoot.GetComponentsInChildren<TrackCrossing>())crossing.ResetForRound();foreach(var burst in finishBursts)if(burst)burst.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);}
      if(gm.camControl)gm.camControl.transform.position=spawn.position;
      autoDrive=automatic;Throttle=0;motionClearUntil=Time.unscaledTime+.5f;rb.WakeUp();UpdateMenuPause();PlayActionSound("restart");
      return "Başlangıca ışınlandı.";
    }
    void StartGiftMotion(Command command){
      if(Jailed&&(command.action=="forward"||command.action=="backward"||command.action=="tornado"))throw new InvalidOperationException("Araba kafeste.");if(command.action!="forward"&&command.action!="backward"){ReleaseCage();jailUntil=0;}
      var rb=Get<Rigidbody>(car,"rb");if(!rb||rb.isKinematic)throw new InvalidOperationException("Araba fiziği hazır değil.");
      Vector3 from=rb.position,to;bool forward=command.action=="forward";motionTornado=command.action=="tornado";motionBackward=command.action=="backward";
      motionLift=.65f;motionRotation=Quaternion.Euler(0,car.transform.eulerAngles.y,0);
      if(CustomActive){
        float z=forward?TrackProgress+GiftDistance(command.distance):Mathf.Max(0,TrackProgress-GiftDistance(command.distance));
        if(!TrySafeTrackLanding(z,forward,out to))throw new InvalidOperationException("Hedefte engel var; güvenli iniş yapılamıyor.");
        z=to.z-trackOrigin.z;motionRotation=Quaternion.identity;
        float low=Mathf.Min(TrackProgress,z),high=Mathf.Max(TrackProgress,z);
        foreach(var obstacle in trackLayout.Obstacles)if(obstacle.Kind!=2&&obstacle.Z>=low-6&&obstacle.Z<=high+6)motionLift=Mathf.Max(motionLift,obstacle.Kind==3?11:obstacle.Kind==5?8:4);
        foreach(float hurdle in trackLayout.Hurdles)if(hurdle>=low-6&&hurdle<=high+6)motionLift=Mathf.Max(motionLift,4);
        foreach(float crossing in trackLayout.Crossings)if(crossing>=low-10&&crossing<=high+10)motionLift=Mathf.Max(motionLift,5);
        foreach(var jump in trackLayout.Jumps)if(jump.RampStart<high&&jump.Landing>low)motionLift=Mathf.Max(motionLift,6);
      }else{
        Vector3 direction=Vector3.ProjectOnPlane(car.transform.forward,Vector3.up).normalized;to=from+direction*GiftDistance(command.distance)*(motionTornado||motionBackward?-1:1);
        RaycastHit hit;if(!Physics.Raycast(to+Vector3.up*30,Vector3.down,out hit,60,Get<LayerMask>(car,"groundLayerM"),QueryTriggerInteraction.Ignore)||Vector3.Dot(hit.normal,Vector3.up)<.7f)throw new InvalidOperationException("Hedefte güvenli zemin yok; itiş uygulanmadı.");
        to.y=hit.point.y+1.5f;
        foreach(var collider in Physics.OverlapBox(to,new Vector3(1.4f,.65f,2),motionRotation,~0,QueryTriggerInteraction.Ignore))if(!collider.transform.IsChildOf(car.transform))throw new InvalidOperationException("Hedefte engel var; güvenli iniş yapılamıyor.");
        motionLift=12;
      }
      PrepareReverseLanding(from,to,motionRotation);
      motionFrom=from;motionTo=to;motionMetres=CustomActive?Mathf.Abs(to.z-from.z):Vector3.ProjectOnPlane(to-from,Vector3.up).magnitude;motionAge=0;motionFinished=false;
      motionDuration=GiftTravelDuration(motionMetres,motionBackward,motionTornado);motionFailure=null;
      if(motionTornado)motionLift=Mathf.Max(motionLift,7);
      if(command.expiresAt>0&&command.expiresAt-(DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds<motionDuration*1000+600)throw new InvalidOperationException("İtişi tamamlamak için süre kalmadı; uygulanmadı.");
      EnsureActionVisuals();
      if(motionTornado){ReleaseMeteor();StartTornado(from,motionDuration+.7f);notice="Hortum geliyor!";noticeUntil=Time.unscaledTime+4;}
      else if(motionBackward){ReleaseMeteor();StartReverseRocket();notice="Geri roketi ateşlendi!";noticeUntil=Time.unscaledTime+4;}
      motionCamera=Get<GameManager>(car,"gameManager").camControl;if(motionCamera){previousFollowSpeed=Get<float>(motionCamera,"camFollowSpeed");AccessMap(motionCamera,"camFollowSpeed",Mathf.Clamp(previousFollowSpeed,4,8));}
      motionBody=rb;motionKinematic=rb.isKinematic;motionCollisions=rb.detectCollisions;motionGravity=rb.useGravity;motionConstraints=rb.constraints;
      PlayActionSound(command.action);
      rb.linearVelocity=rb.angularVelocity=Vector3.zero;rb.isKinematic=true;rb.detectCollisions=false;rb.useGravity=false;motionForward=forward;motionRevision++;giftMotion=true;
      trackRunupUntil=trackImpactUntil=0;UpdateActionVisuals();
    }
    void FixedUpdate(){
      UpdateMenuPause();UpdateExtraPhysics();UpdateRoundaboutStun();
      if(!giftMotion||motionFinished||menuOpen)return;
      if(!Ready||!motionBody){CancelGiftMotion("Yarış durdu; itiş iptal edildi.");return;}
      if(meteorDelay>0){meteorDelay-=Time.fixedDeltaTime;return;}
      motionAge+=Time.fixedDeltaTime;float t=Mathf.Clamp01(motionAge/motionDuration),travel=motionLift>2?Mathf.SmoothStep(0,1,Mathf.InverseLerp(.16f,.84f,t)):Mathf.SmoothStep(0,1,t);
      Vector3 point=Vector3.Lerp(motionFrom,motionTo,travel);
      float elevation=motionLift>2?Mathf.Min(Mathf.SmoothStep(0,1,t/.16f),Mathf.SmoothStep(0,1,(1-t)/.16f)):Mathf.Sin(t*Mathf.PI);
      point.y+=motionLift*elevation;if(motionTornado)point.x+=Mathf.Sin(motionAge*7)*Mathf.Sin(t*Mathf.PI)*1.8f;motionBody.MovePosition(point);motionBody.MoveRotation(motionTornado?motionRotation*Quaternion.Euler(0,Mathf.Sin(motionAge*5)*40*elevation,Mathf.Sin(motionAge*7)*16*elevation):motionRotation);
      if(t>=1){motionBody.position=motionTo;motionBody.rotation=motionRotation;RestoreMotionBody();motionClearUntil=Time.unscaledTime+.3f;nextTrackImpact=motionClearUntil;motionFinished=true;}
    }
    void RestoreMotionBody(){ReleaseReverseRocket();if(motionBody){motionBody.isKinematic=motionKinematic;motionBody.detectCollisions=motionCollisions;motionBody.useGravity=motionGravity;motionBody.constraints=motionConstraints;if(!motionBody.isKinematic){motionBody.linearVelocity=motionBody.angularVelocity=Vector3.zero;motionBody.WakeUp();}}motionBody=null;if(motionCamera)AccessMap(motionCamera,"camFollowSpeed",previousFollowSpeed);motionCamera=null;}
    void CancelGiftMotion(string message){ReleaseReverseRocket();if(!giftMotion)return;motionFailure=message;RestoreMotionBody();motionFinished=true;}
  }
}
