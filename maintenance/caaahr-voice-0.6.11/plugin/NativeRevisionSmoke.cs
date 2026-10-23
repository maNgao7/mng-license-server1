using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator GuardRevision(){
      qaActive=true;qaDb=-80;string scorePath=Path.Combine(dataDir,"wins.txt"),oldScore=File.Exists(scorePath)?File.ReadAllText(scorePath):null;
      var stack=new Stack<IEnumerator>();bool visualOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-traffic-visual")>=0,guideOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-guide-smoke")>=0;stack.Push(guideOnly?CheckGuideBindings():visualOnly?CheckTrafficVisuals():CheckRevision());Exception failure=null;
      while(stack.Count>0){var current=stack.Peek();bool more=false;try{more=current.MoveNext();}catch(Exception error){failure=error;}if(failure!=null)break;if(!more){stack.Pop();continue;}var nested=current.Current as IEnumerator;if(nested!=null)stack.Push(nested);else yield return current.Current;}
      qaReport["passed"]=failure==null;if(failure!=null){qaReport["error"]=failure.ToString();Logger.LogError(failure);}
      if(oldScore==null){if(File.Exists(scorePath))File.Delete(scorePath);}else File.WriteAllText(scorePath,oldScore);
      winsLoaded=false;finishPending=false;qaDb=null;qaVoice=null;qaManualAxis=null;ResetEffects();qaActive=false;autoDrive=false;
      Directory.CreateDirectory(QaDirectory);File.WriteAllText(Path.Combine(QaDirectory,guideOnly?"revision-guide.json":visualOnly?"revision-traffic-visual.json":"revision-smoke.json"),JsonUtility.ToJson(qaReport));
      if(enteredGame&&!menuOpen)ToggleMenu();
    }
    IEnumerator CheckTrafficVisuals(){
      float deadline=Time.unscaledTime+40;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Visual bridge timeout");yield return null;}
      int oldLength=draft.track.length;string oldText=lengthText;
      try{
        draft.track.length=2000;lengthText="2000";selectedMap=CustomMap;yield return EnterGame();yield return new WaitForSecondsRealtime(1);
        TrackCrossing junction=null;foreach(var candidate in trackRoot.GetComponentsInChildren<TrackCrossing>())if(!(candidate is TrackRoundabout)){junction=candidate;break;}
        Require(junction&&junction.Vehicles.Length==6,"native_six_crossing_vehicles");MoveOnTrack(junction.TrackZ-32-TrackProgress);yield return new WaitForSecondsRealtime(.4f);
        var crossingBefore=junction.Vehicles[0].transform.position;yield return new WaitForSecondsRealtime(.25f);Require(Vector3.Distance(crossingBefore,junction.Vehicles[0].transform.position)>1,"native_crossing_vehicles_move_without_parking");yield return Snapshot("revision-dense-junction");
        var roundabouts=trackRoot.GetComponentsInChildren<TrackRoundabout>();Require(roundabouts.Length>0,"native_roundabout_exists");var orbit=roundabouts[0];Require(orbit.Vehicles.Length==4,"native_roundabout_four_cars");
        MoveOnTrack(orbit.TrackZ-34-TrackProgress);yield return new WaitForSecondsRealtime(.4f);var before=orbit.Vehicles[0].transform.position;yield return new WaitForSecondsRealtime(.5f);Require(Vector3.Distance(before,orbit.Vehicles[0].transform.position)>1,"native_orbit_moves");yield return Snapshot("revision-roundabout");
        ToggleMenu();before=orbit.Vehicles[0].transform.position;yield return new WaitForSecondsRealtime(.3f);Require(Vector3.Distance(before,orbit.Vehicles[0].transform.position)<.01f,"native_orbit_pauses_with_b_menu");ToggleMenu();
        MoveOnTrack(orbit.TrackZ-TrackProgress);float progressBefore=TrackProgress;HitRoadHazard(false,true,orbit.TrackZ);Require(!trafficCrash&&TrackProgress>100&&TrackProgress<progressBefore,"roundabout_collision_is_local_setback_not_restart");yield return new WaitForSecondsRealtime(1.1f);Require(Ready&&!trafficCrash,"roundabout_collision_recovers_control");
      }finally{draft.track.length=oldLength;lengthText=oldText;}
    }
    IEnumerator CheckRevision(){
      float deadline=Time.unscaledTime+40;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Revision bridge initialization timeout");yield return null;}
      Require(actions.Length==14,"curated_14_actions");Require(!IsCustomMap(-3),"lava_map_removed");selectedMap=CustomMap;yield return EnterGame();yield return new WaitForSecondsRealtime(1);
      Require(CustomActive&&Ready&&!menuOpen,"straight_track_ready");yield return Snapshot("revision-straight-hud");
      qaReport["screen_mode"]=Screen.fullScreenMode.ToString();qaReport["screen_width"]=Screen.width;qaReport["screen_height"]=Screen.height;
      if(draft.graphics!=null&&draft.graphics.configured&&draft.graphics.mode=="windowed"){
        Require(Screen.fullScreenMode==FullScreenMode.Windowed,"saved_windowed_mode_is_applied");
        Require(Screen.width<Screen.currentResolution.width&&Screen.height<Screen.currentResolution.height,"windowed_mode_leaves_room_for_window_borders");
      }
      RemoveWheel(20);Require(MissingWheelCount==1,"first_wheel_removed");RemoveWheel(20);Require(MissingWheelCount==2,"second_wheel_removed");yield return new WaitForSecondsRealtime(.3f);yield return Snapshot("revision-two-wheels");
      var visible=Get<Transform>(car,"Visual");qaReport["wheel_visual_distance"]=Vector3.Distance(visible.position,car.transform.position);Require(Vector3.Distance(visible.position,car.transform.position)<5,"missing_wheels_keep_car_model_near_body");
      var mainCamera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");bool visibleRenderer=false;foreach(var renderer in visible.GetComponentsInChildren<Renderer>())if(renderer.enabled&&GeometryUtility.TestPlanesAABB(GeometryUtility.CalculateFrustumPlanes(mainCamera),renderer.bounds))visibleRenderer=true;Require(visibleRenderer,"car_renderers_stay_in_camera_after_wheel_gifts");
      RemoveWheel(20);RemoveWheel(20);RemoveWheel(20);Require(MissingWheelCount==4,"four_wheel_cap");RestoreWheel();Require(MissingWheelCount==0&&!WheelMissing,"all_wheels_repaired");
      Require(ParseNumber("500",1,5000,out qaNumber)&&qaNumber==500&&ParseNumber("23",1,120,out qaNumber)&&qaNumber==23,"distance_and_duration_accept_keyboard_text");
      qaVoice=new VoiceSettings();qaVoice.enabled=true;qaVoice.automatic=true;qaVoice.sensitivity=.25f;qaVoice.automaticMaxSpeed=139/3.6f;envelope.Reset();
      qaDb=-80;MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(1.5f);Require(Throttle==0,"silence_does_not_drive");
      qaReport["silent_speed"]=DrivingSpeed();qaReport["silent_demand"]=voiceDemand;qaReport["prompt_ready"]=Ready;
      Require(VoicePromptVisible,"voice_prompt_shows_when_stopped");
      autoDrive=true;qaManualAxis=0;qaDb=-25;yield return new WaitForSecondsRealtime(.8f);Require(Throttle==0&&DrivingSpeed()<.15f,"keyboard_mode_never_drives_without_keys_even_with_voice");
      qaManualAxis=1;float manualStart=TrackProgress;yield return new WaitForSecondsRealtime(.9f);Require(Throttle>.8f&&TrackProgress>manualStart+.5f,"w_key_moves_forward");Require(!VoicePromptVisible,"moving_hides_voice_prompt");yield return Snapshot("revision-manual-driving");
      qaManualAxis=0;yield return new WaitForSecondsRealtime(.8f);Require(Throttle==0&&DrivingSpeed()<.15f,"key_release_stops_car");
      qaManualAxis=-1;manualStart=TrackProgress;yield return new WaitForSecondsRealtime(.7f);Require(TrackProgress<manualStart-.3f,"s_key_reverses");qaManualAxis=0;autoDrive=false;qaDb=-80;envelope.Reset();MoveOnTrack(20-TrackProgress);yield return new WaitForSecondsRealtime(.9f);
      Execute(new Command{action="jail",duration=10});float jailBefore=CageSeconds;Execute(new Command{action="release",duration=3});Require(Jailed&&CageSeconds>6&&CageSeconds<jailBefore-2.9f,"release_gift_subtracts_only_configured_seconds");yield return Snapshot("revision-cage-countdown");
      ToggleMenu();jailBefore=CageSeconds;yield return new WaitForSecondsRealtime(.5f);Require(Mathf.Abs(CageSeconds-jailBefore)<.1f,"cage_countdown_pauses_in_menu");ToggleMenu();Execute(new Command{action="release",duration=120});Require(!Jailed&&!cage,"release_gift_opens_cage_at_zero");
      StartTimedDamage(1);yield return new WaitForSecondsRealtime(.3f);Require(Damaged&&MissingWheelCount==4,"explosion_removes_wheels_temporarily");Require(damageSmoke&&damageSmoke.particleCount>0,"explosion_smoke_particles_visible");yield return Snapshot("revision-timed-explosion");
      ToggleMenu();yield return new WaitForSecondsRealtime(.9f);Require(Damaged,"damage_timer_pauses_with_menu");ToggleMenu();yield return new WaitForSecondsRealtime(1.2f);Require(!Damaged&&MissingWheelCount==0,"explosion_recovers_automatically");
      int old=wins;MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(.4f);Require(FinishHold&&Ready,"ten_second_finish_accepts_gifts");
      float remaining=roundRestartAt-Time.unscaledTime;Require(remaining>8&&remaining<=10,"finish_hold_is_ten_seconds");yield return Snapshot("revision-finish-countdown");
      ToggleMenu();float before=roundRestartAt-Time.unscaledTime;yield return new WaitForSecondsRealtime(.5f);Require(Mathf.Abs(roundRestartAt-Time.unscaledTime-before)<.15f,"menu_pauses_finish_countdown");ToggleMenu();
      CancelFinish();Require(!trackFinished&&wins==old-1&&TrackProgress<2,"gift_denies_win_and_restarts_with_minus_one");
      MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(10.5f);Require(trackFinished&&!finishPending&&wins==old,"hold_awards_exactly_one_win");yield return Snapshot("revision-win-awarded");
      yield return new WaitForSecondsRealtime(3.4f);Require(!trackFinished&&Ready&&TrackProgress<2,"new_round_after_win");
      MoveOnTrack(550-TrackProgress);var startPosition=car.transform.position;float progressStart=TrackProgress;
      StartCoroutine(RunCommand(new Command{id="revision-250m",action="backward",distance=250,source="test"}));float largestVisualGap=0;int motionFrames=0;
      while(!applied.ContainsKey("revision-250m")){var model=Get<Transform>(car,"Visual");if(model)largestVisualGap=Mathf.Max(largestVisualGap,Vector3.Distance(model.position,car.transform.position));motionFrames++;if(motionFrames==30)yield return Snapshot("revision-real-distance-motion");yield return null;}
      qaReport["max_motion_visual_gap"]=largestVisualGap;Require(largestVisualGap<5,"car_visual_tracks_body_during_long_push");
      float actualMetres=Mathf.Abs(car.transform.position.z-startPosition.z);Require(applied["revision-250m"].ok&&actualMetres>220&&actualMetres<290&&Mathf.Abs(actualMetres-(progressStart-TrackProgress))<.05f,"backward_250_moves_real_world_metres");
      yield return RunCommand(new Command{id="revision-restart-instant",action="restart",source="test"});Require(applied["revision-restart-instant"].ok&&TrackProgress<1&&!giftMotion&&!meteor,"restart_is_instant_without_meteor");
      foreach(var spec in LocalActions()){
        if(spec.id=="finish")continue;
        float readyDeadline=Time.unscaledTime+10;while(!Ready||trafficCrash){if(Time.unscaledTime>readyDeadline)throw new Exception("Action race recovery timeout: "+spec.id);yield return null;}
        ResetEffects();MoveOnTrack(20-TrackProgress);yield return new WaitForSecondsRealtime(.3f);
        var command=new Command{id="revision-"+spec.id,action=spec.id,duration=1,strength=2,distance=10,source="test"};
        if(spec.id=="backward"){
          float previousProgress=TrackProgress;StartCoroutine(RunCommand(command));yield return new WaitForSecondsRealtime(.35f);Require(giftMotion&&reverseRocket&&TrackProgress>previousProgress-9,"reverse_rocket_is_visible_before_landing");yield return Snapshot("revision-reverse-rocket");while(runningCommands.Contains(command.id))yield return null;Require(TrackProgress<previousProgress-7&&!reverseRocket,"backward_push_moves_and_cleans_up_rocket");
        }else yield return RunCommand(command);
        Require(applied.ContainsKey(command.id)&&applied[command.id].ok,"action_applies_"+spec.id);
        if(spec.id=="traffic"){yield return Snapshot("revision-oncoming-truck");}
        yield return new WaitForSecondsRealtime(spec.id=="explode"?3:.2f);
      }
      ResetEffects();MoveOnTrack(20-TrackProgress);yield return RunCommand(new Command{id="revision-finish",action="finish",source="test"});yield return new WaitForSecondsRealtime(.3f);Require(applied["revision-finish"].ok&&FinishHold&&TrackRemaining==0,"finish_action_teleports_to_finish");CancelFinish();
      ResetEffects();MoveOnTrack(0-TrackProgress);yield return Snapshot("revision-final-hud");
      qaReport["live_gift_tested"]=false;
    }
    float qaNumber;
    IEnumerator CheckGuideBindings(){
      float deadline=Time.unscaledTime+40;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Guide bridge timeout");yield return null;}
      Require(draft.rules.Length==13,"guide_has_13_saved_rules");selectedMap=CustomMap;yield return EnterGame();yield return new WaitForSecondsRealtime(1);
      foreach(var rule in draft.rules){
        Require(rule.enabled&&!string.IsNullOrEmpty(rule.giftId),"guide_binding_enabled_"+rule.giftId);
        if(trackFinished){finishPending=false;roundRestartAt=Time.unscaledTime;UpdateRoundEnd();}
        ResetEffects();MoveOnTrack((rule.action=="forward"?200:600)-TrackProgress);yield return new WaitForSecondsRealtime(.3f);
        if(rule.action=="release")Execute(new Command{action="jail",duration=30});
        float releaseBefore=CageSeconds,releaseAt=Time.unscaledTime;
        yield return SmokeCommand("/mod/test-gift","{\"giftId\":\""+rule.giftId+"\"}","guide_gift_applied_"+rule.giftId);
        if(rule.action=="release")Require(Jailed&&Mathf.Abs(CageSeconds-Mathf.Max(0,releaseBefore-rule.duration-(Time.unscaledTime-releaseAt)))<.4f,"guide_release_subtracts_configured_seconds");
      }
      qaReport["real_live_gifts_used"]=false;qaReport["test_endpoint_uses_saved_gift_bindings"]=true;
    }
  }
}
