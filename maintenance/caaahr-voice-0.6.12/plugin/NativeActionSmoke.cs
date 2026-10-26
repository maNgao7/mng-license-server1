using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator WaitForPreview(){float deadline=Time.unscaledTime+12;while(menuBusy){if(Time.unscaledTime>deadline)throw new Exception("Action preview timed out");yield return null;}Require(previewResult!=null&&previewResult.ok,"action_preview_acknowledged_"+qaActionIndex++);}
    int qaActionIndex;
    IEnumerator RunActionSmoke(){
      qaDb=-80;float deadline=Time.unscaledTime+30;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Action test initialization timed out");yield return null;}
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));
      if(!Ready)yield return CheckRulePreviewWorkflow();
      if(!menuOpen)ToggleMenu();
      float parsed;Require(ParseNumber("37",1,100,out parsed)&&parsed==37,"keyboard_distance_integer_parses");Require(ParseNumber("2,5",.2f,8,out parsed)&&parsed==2.5f,"keyboard_decimal_comma_parses");Require(!ParseNumber("",1,100,out parsed)&&!ParseNumber("999",1,100,out parsed)&&!ParseNumber("NaN",1,100,out parsed),"empty_and_invalid_numbers_rejected");
      focusedControl="number:qa:distance";Require(EditingText(),"numeric_field_blocks_game_shortcuts");focusedControl="";
      Require(Array.Find(actions,a=>a.id=="backward")==null&&Array.Find(actions,a=>a.id=="wheel")!=null&&Array.Find(actions,a=>a.id=="restart").name=="Baştan başlat","action_list_consolidates_back_and_adds_wheel");
      var rb=Get<Rigidbody>(car,"rb");MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(.5f);
      StartRulePreview(new GiftRule{action="forward",distance=100});deadline=Time.unscaledTime+8;while(!giftMotion){if(Time.unscaledTime>deadline)throw new Exception("Motion never starts");yield return null;}
      Require(rb.isKinematic&&!rb.detectCollisions,"push_temporarily_bypasses_obstacle_collisions");
      Vector3 before=rb.position;yield return new WaitForSecondsRealtime(.3f);Require(TrackProgress<motionTo.z-trackOrigin.z-1&&Vector3.Distance(before,rb.position)>1,"push_has_visible_intermediate_positions_not_teleport");
      HitTrackBumper(false);Require(trackImpactUntil<=Time.unscaledTime,"push_ignores_obstacle_penalty");yield return Snapshot("gift-forward-in-motion");
      var gameCamera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");var screenPoint=gameCamera.WorldToViewportPoint(car.transform.position+Vector3.up);Require(screenPoint.z>0&&screenPoint.x>.1f&&screenPoint.x<.9f&&screenPoint.y>.1f&&screenPoint.y<.9f,"animated_push_keeps_car_center_in_view");
      yield return WaitForPreview();Require(!giftMotion&&!rb.isKinematic&&rb.detectCollisions,"push_restores_native_physics_and_collisions");
      Require(BridgeOnline,"heartbeats_continue_during_animated_push");
      Require(Mathf.Abs(TrackProgress-trackLayout.GiftZ(100,true,builtLength))<1,"push_lands_at_safe_destination");
      foreach(var obstacle in trackLayout.Obstacles)if(obstacle.Kind!=2)Require(Mathf.Abs(TrackProgress-obstacle.Z)>=11,"push_does_not_land_on_obstacle_"+obstacle.Z);
      yield return new WaitForSecondsRealtime(.8f);Require(car.isGrounded,"push_finishes_on_driveable_ground");
      MoveOnTrack(-TrackProgress);if(menuOpen)ToggleMenu();yield return new WaitForSecondsRealtime(.4f);
      string firstId=null,secondId=null;
      using(var request=Post("/mod/test-action","{\"action\":\"forward\",\"distance\":10}")){yield return request.SendWebRequest();firstId=JsonUtility.FromJson<Command>(request.downloadHandler.text).id;}
      using(var request=Post("/mod/test-action","{\"action\":\"forward\",\"distance\":10}")){yield return request.SendWebRequest();secondId=JsonUtility.FromJson<Command>(request.downloadHandler.text).id;}
      deadline=Time.unscaledTime+10;while(!applied.ContainsKey(firstId)||!applied.ContainsKey(secondId)){if(Time.unscaledTime>deadline)throw new Exception("Queued motion timed out");yield return null;}
      Require(applied[firstId].ok&&applied[secondId].ok&&TrackProgress>19&&TrackProgress<21,"two_queued_pushes_execute_once_each_without_losing_distance");
      StartRulePreview(new GiftRule{action="restart"});deadline=Time.unscaledTime+8;while(!giftMotion){if(Time.unscaledTime>deadline)throw new Exception("Return never starts");yield return null;}
      float start=TrackProgress;yield return new WaitForSecondsRealtime(1.25f);Require(TrackProgress>1&&TrackProgress<start-1,"restart_returns_smoothly_not_instantly");yield return Snapshot("gift-restart-in-motion");yield return WaitForPreview();Require(TrackProgress<1,"restart_returns_to_start");
      if(menuOpen)ToggleMenu();MoveOnTrack(10-TrackProgress);yield return new WaitForSecondsRealtime(.6f);if(!menuOpen)ToggleMenu();
      StartRulePreview(new GiftRule{action="boost",duration=3,strength=2});yield return WaitForPreview();Require(!menuOpen,"turbo_preview_exposes_game_instead_of_braking_in_menu");
      yield return new WaitForSecondsRealtime(.7f);Require(rb.linearVelocity.magnitude>8&&Throttle==0,"turbo_really_accelerates_even_without_voice");Require(rocketFlames.Count==2&&rocketFlames[0].particleCount>0,"turbo_really_emits_rocket_flames");yield return Snapshot("gift-turbo-flames");
      if(!menuOpen)ToggleMenu();yield return new WaitForSecondsRealtime(3);Require(Time.unscaledTime>=boostUntil&&rocketFlames[0].particleCount==0,"turbo_expires_and_clears_flames");
      ResetEffects();MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(.5f);
      StartRulePreview(new GiftRule{action="wheel",duration=3});yield return WaitForPreview();Require(WheelMissing&&wheelRenderers.Count>0,"wheel_action_finds_actual_native_wheel");foreach(var pair in wheelRenderers)Require(!pair.Key.enabled,"wheel_visual_hidden_"+pair.Key.GetInstanceID());
      qaDb=-32;yield return new WaitForSecondsRealtime(.7f);Require(Mathf.Abs(rb.linearVelocity.x)>.1f,"missing_wheel_really_causes_side_drift");yield return Snapshot("gift-missing-wheel");qaDb=-80;
      if(!menuOpen)ToggleMenu();yield return new WaitForSecondsRealtime(3);Require(!WheelMissing&&wheelRenderers.Count==0,"missing_wheel_expires_and_restores_renderers");
      StartRulePreview(new GiftRule{action="wheel",duration=10});yield return WaitForPreview();if(!menuOpen)ToggleMenu();StartRulePreview(new GiftRule{action="repair"});yield return WaitForPreview();Require(!WheelMissing&&wheelRenderers.Count==0&&Vector3.Dot(car.transform.up,Vector3.up)>.9f,"repair_restores_wheel_and_upright_car");
      StartRulePreview(new GiftRule{action="shield",duration=10});yield return WaitForPreview();Require(shieldVisual&&shieldVisual.activeSelf,"one_hit_shield_is_visible");yield return Snapshot("gift-shield");
      StartRulePreview(new GiftRule{action="wheel",duration=10});yield return WaitForPreview();Require(!WheelMissing&&shieldUntil==0&&!shieldVisual.activeSelf,"shield_blocks_one_wheel_action_and_breaks");
      StartRulePreview(new GiftRule{action="wheel",duration=1});yield return WaitForPreview();Require(WheelMissing,"second_harmful_action_is_not_blocked_by_spent_shield");
      if(!menuOpen)ToggleMenu();yield return new WaitForSecondsRealtime(1.5f);ResetEffects();MoveOnTrack(-TrackProgress);tab=1;
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"action_suite_never_overwrites_saved_settings");
    }
  }
}
