using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float ClearVoiceTestZ(){
      for(float z=20;z<builtLength-100;z+=5){
        bool clear=true;foreach(var obstacle in trackLayout.Obstacles)if(obstacle.Z>z-12&&obstacle.Z<z+95)clear=false;
        foreach(var jump in trackLayout.Jumps)if(jump.Approach-10<z+95&&jump.Landing+12>z)clear=false;
        if(clear)return z;
      }
      throw new Exception("No clear native speed test section found");
    }
    IEnumerator RunRoundAndVoiceSmoke(){
      qaDb=-80;float deadline=Time.unscaledTime+30;while(!serverSettingsLoaded||!BridgeOnline||gifts.Length<680){if(Time.unscaledTime>deadline)throw new Exception("Round test initialization timed out");yield return null;}
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));yield return EnterGame();Require(CustomActive&&Ready,"round_suite_enters_custom_course");
      qaVoice=JsonUtility.FromJson<VoiceSettings>(JsonUtility.ToJson(Settings));qaVoice.automatic=true;qaVoice.enabled=true;qaVoice.automaticMaxSpeed=25;envelope.Reset();
      var rb=Get<Rigidbody>(car,"rb");float z=ClearVoiceTestZ();MoveOnTrack(z-TrackProgress);yield return new WaitForSecondsRealtime(1);
      Require(Throttle==0&&DrivingSpeed()<.2f,"voice_speed_still_stops_in_silence");
      qaDb=-66;yield return new WaitForSecondsRealtime(1.5f);float quiet=DrivingSpeed();float quietFov=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam").fieldOfView;
      qaReport["quiet_voice_speed_kmh"]=quiet*3.6f;qaReport["quiet_voice_throttle"]=Throttle;yield return Snapshot("voice-speed-quiet");
      qaDb=-80;yield return new WaitForSecondsRealtime(1);MoveOnTrack(z-TrackProgress);yield return new WaitForSecondsRealtime(.3f);
      qaDb=-36;yield return new WaitForSecondsRealtime(1.7f);float loud=DrivingSpeed();var camera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");
      qaReport["raised_voice_speed_kmh"]=loud*3.6f;qaReport["raised_voice_throttle"]=Throttle;qaReport["raised_voice_fov"]=camera.fieldOfView;
      Require(quiet>1&&loud>quiet*1.8f&&loud>20,"raised_voice_physically_exceeds_72_kmh_and_quiet_speed");Require(Throttle>.95f,"raised_voice_reaches_full_throttle_without_extreme_input");
      Require(camera.fieldOfView>quietFov+3,"speed_feedback_widens_camera_with_actual_speed");yield return Snapshot("voice-speed-raised");
      qaDb=-80;yield return new WaitForSecondsRealtime(1.7f);Require(Throttle==0&&DrivingSpeed()<.2f,"silence_brakes_after_full_speed");
      MoveOnTrack(z-TrackProgress);autoDrive=true;yield return new WaitForSecondsRealtime(1.2f);float cruise=DrivingSpeed();qaDb=-36;yield return new WaitForSecondsRealtime(1.2f);
      qaReport["automatic_cruise_speed_kmh"]=cruise*3.6f;qaReport["automatic_with_raised_voice_speed_kmh"]=DrivingSpeed()*3.6f;
      Require(cruise>3&&DrivingSpeed()>cruise*1.3f&&Throttle>.95f,"raised_voice_can_accelerate_above_automatic_cruise");
      autoDrive=false;qaDb=-80;yield return new WaitForSecondsRealtime(1.7f);
      int before=roundNumber,rootId=trackRoot.GetInstanceID();var settingsBefore=draft;MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(.4f);
      Require(trackFinished&&!Ready&&rb.isKinematic&&roundRestartAt>Time.unscaledTime,"finish_shows_winner_and_holds_car_for_three_seconds");yield return Snapshot("round-broadcaster-winner");
      using(var request=Post("/mod/test-action","{\"action\":\"forward\",\"distance\":10}")){yield return request.SendWebRequest();Require(request.responseCode==409,"gift_test_is_explicitly_rejected_during_winner_screen");}
      deadline=Time.unscaledTime+5;while(trackFinished){if(Time.unscaledTime>deadline)throw new Exception("Automatic new round timed out");yield return null;}
      yield return new WaitForSecondsRealtime(.5f);
      Require(Ready&&!rb.isKinematic&&rb.detectCollisions&&TrackProgress<2,"new_round_automatically_restores_driving_at_start");Require(roundNumber==before+1&&trackRoot.GetInstanceID()==rootId&&draft==settingsBefore,"new_round_reuses_course_and_preserves_settings");
      var visual=Get<Transform>(car,"Visual");var visiblePoint=camera.WorldToViewportPoint(car.transform.position+Vector3.up);
      Require(visual&&Vector3.Distance(visual.position,car.transform.position)<4&&visiblePoint.z>0&&visiblePoint.x>0&&visiblePoint.x<1&&visiblePoint.y>0&&visiblePoint.y<1,"new_round_keeps_car_model_and_camera_at_start");
      Require(Get<GameManager>(car,"gameManager").roundTimer<1&&finishBursts[0].particleCount==0,"new_round_resets_timer_and_clears_finish_effects");yield return Snapshot("round-auto-restarted");
      autoDrive=true;MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(.3f);Require(trackFinished,"second_finish_is_detected");
      deadline=Time.unscaledTime+5;while(trackFinished){if(Time.unscaledTime>deadline)throw new Exception("Second new round timed out");yield return null;}
      Require(Ready&&roundNumber==before+2&&autoDrive,"repeated_rounds_preserve_automatic_driving_choice");autoDrive=false;
      if(!menuOpen)ToggleMenu();StartRulePreview(new GiftRule{action="forward",distance=10});yield return WaitForPreview();
      Require(previewResult.ok&&Ready&&TrackProgress>=9,"gift_actions_work_again_after_automatic_restart");
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"round_and_speed_tests_never_overwrite_preferences");
    }
  }
}
