using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator RunControlSmoke(){
      yield return RunActionSmoke();
      yield return CheckExtraControls();
    }
    IEnumerator CheckExtraControls(){
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));
      qaVoice=JsonUtility.FromJson<VoiceSettings>(JsonUtility.ToJson(Settings));qaVoice.automatic=true;qaVoice.enabled=true;qaVoice.sensitivity=.19f;qaVoice.automaticMaxSpeed=25;
      if(menuOpen)ToggleMenu();ResetEffects();autoDrive=false;MoveOnTrack(-TrackProgress);qaDb=-35;envelope.Reset();yield return new WaitForSecondsRealtime(1.8f);
      Require(Throttle==0&&DrivingSpeed()<.1f,"loud_ambient_noise_does_not_drive_the_real_car");
      qaDb=-23;yield return new WaitForSecondsRealtime(.7f);Require(Throttle>0&&DrivingSpeed()>.4f,"quiet_speech_above_ambient_still_drives");
      qaDb=-35;yield return new WaitForSecondsRealtime(.8f);Require(Throttle==0&&DrivingSpeed()<.1f,"return_to_ambient_stops_real_car");qaDb=-80;envelope.Reset();
      trackRunupUntil=Time.unscaledTime+8;yield return new WaitForSecondsRealtime(1);Require(DrivingSpeed()<.1f&&Throttle==0,"speed_pad_never_drives_when_voice_and_automatic_drive_are_off");trackRunupUntil=0;
      autoDrive=true;yield return new WaitForSecondsRealtime(.6f);ToggleMenu();yield return null;
      var rb=Get<Rigidbody>(car,"rb");var cameraController=Get<GameManager>(car,"gameManager").camControl;var camera=Get<Camera>(cameraController,"cam");
      Vector3 position=rb.position,view=camera.transform.position;Quaternion rotation=camera.transform.rotation;float fov=camera.fieldOfView;
      Execute(new Command{action="wind",duration=2,strength=4});cameraController.SendMessage("Update");cameraController.SendMessage("LateUpdate");yield return new WaitForSecondsRealtime(.7f);
      Require(Vector3.Distance(rb.position,position)<.001f&&DrivingSpeed()<.01f,"b_menu_freezes_car_even_when_auto_drive_and_gift_are_active");
      Require(Vector3.Distance(camera.transform.position,view)<.001f&&Quaternion.Angle(camera.transform.rotation,rotation)<.001f&&Mathf.Abs(camera.fieldOfView-fov)<.001f,"b_menu_freezes_camera_position_rotation_and_zoom");
      Require(rb.constraints==RigidbodyConstraints.FreezeAll,"b_menu_freezes_native_physics");yield return Snapshot("menu-stable-game-background");autoDrive=false;ResetEffects();ToggleMenu();yield return new WaitForSecondsRealtime(.4f);
      Require(rb.constraints!=RigidbodyConstraints.FreezeAll,"closing_b_restores_original_physics");
      Require(camera.transform.localPosition.z<0&&Mathf.Abs(camera.transform.localPosition.z+Get<int>(Get<SettingsManager>(cameraController,"settingsManager"),"camDistance_Value")*1.28f)<.1f,"camera_is_twenty_eight_percent_further_away");
      MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(.6f);autoDrive=true;yield return new WaitForSecondsRealtime(.5f);
      StartRulePreview(new GiftRule{action="brake",duration=2});yield return WaitForPreview();yield return new WaitForSecondsRealtime(.4f);Require(DrivingSpeed()<.1f&&Throttle==0,"handbrake_stops_automatic_motor");yield return Snapshot("gift-handbrake");autoDrive=false;yield return new WaitForSecondsRealtime(2);Require(!Braking,"handbrake_expires");
      MoveOnTrack(5-TrackProgress);var centred=car.transform.position;centred.x=trackOrigin.x;car.SetPosAndRot(centred,Quaternion.identity);yield return new WaitForSecondsRealtime(.5f);float x=rb.position.x;
      StartRulePreview(new GiftRule{action="wind",duration=2,strength=3});yield return WaitForPreview();yield return new WaitForSecondsRealtime(.6f);qaReport["wind_origin_x"]=x;qaReport["wind_displacement_metres"]=Mathf.Abs(rb.position.x-x);qaReport["wind_velocity"]=rb.linearVelocity.ToString();Require(Mathf.Abs(rb.position.x-x)>.1f,"wind_physically_pushes_car_sideways");yield return Snapshot("gift-crosswind");yield return new WaitForSecondsRealtime(2);Require(Time.unscaledTime>=windUntil&&DrivingSpeed()<.2f,"wind_expires_and_car_stops");
      MoveOnTrack(5-TrackProgress);StartRulePreview(new GiftRule{action="ice",duration=2});yield return WaitForPreview();float steering=1;AdjustSteering(Get<MicroHolder>(car,"currentSteerObj"),ref steering);Require(Mathf.Abs(steering-.6f)<.01f&&iceVisual.activeSelf,"icy_tyres_reduce_grip_and_show_frozen_rings");yield return Snapshot("gift-icy-tyres");yield return new WaitForSecondsRealtime(2);steering=1;AdjustSteering(Get<MicroHolder>(car,"currentSteerObj"),ref steering);Require(Mathf.Abs(steering-1)<.01f&&!iceVisual.activeSelf,"ice_expires_without_permanent_steering_changes");
      MoveOnTrack(5-TrackProgress);StartRulePreview(new GiftRule{action="egg",duration=2});yield return WaitForPreview();yield return new WaitForSecondsRealtime(1.3f);Require(eggTexture&&Time.unscaledTime<eggUntil,"egg_gift_creates_screen_splatter");yield return Snapshot("gift-egg-splatter");yield return new WaitForSecondsRealtime(2.4f);Require(Time.unscaledTime>=eggUntil,"egg_splatter_expires");
      MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(.7f);float y=rb.position.y;StartRulePreview(new GiftRule{action="bounce",duration=2,strength=2});yield return WaitForPreview();yield return new WaitForSecondsRealtime(.2f);Require(rb.position.y>y+.2f||rb.linearVelocity.y>2,"spring_suspension_really_launches_car");yield return Snapshot("gift-spring-suspension");yield return new WaitForSecondsRealtime(2.4f);Require(Time.unscaledTime>=bounceUntil&&!bounceVisual.activeSelf,"suspension_effect_expires");
      ResetEffects();MoveOnTrack(17-TrackProgress);yield return new WaitForSecondsRealtime(.7f);StartRulePreview(new GiftRule{action="restart"});float deadline=Time.unscaledTime+8;while(!meteor){if(Time.unscaledTime>deadline)throw new Exception("Meteor never appears");yield return null;}
      float before=TrackProgress;yield return new WaitForSecondsRealtime(.25f);Require(meteorRock&&meteorRock.activeSelf&&Mathf.Abs(TrackProgress-before)<.1f,"meteor_approaches_before_backward_push");
      Vector3 meteorScreen=camera.WorldToViewportPoint(meteorRock.transform.position);Require(meteorScreen.z>0&&meteorScreen.x>0&&meteorScreen.x<1&&meteorScreen.y>0&&meteorScreen.y<1,"meteor_approach_is_inside_the_game_view");yield return Snapshot("gift-meteor-incoming");
      yield return new WaitForSecondsRealtime(.55f);Require(meteorHit||TrackProgress<before-.1f,"meteor_impact_precedes_backward_launch");yield return Snapshot("gift-meteor-impact");yield return WaitForPreview();Require(TrackProgress<1,"meteor_return_reaches_start");yield return new WaitForSecondsRealtime(1);Require(!meteor,"meteor_visuals_clean_up_after_impact");
      ResetEffects();if(!menuOpen)ToggleMenu();StartRulePreview(new GiftRule{action="shield",duration=5});yield return WaitForPreview();StartRulePreview(new GiftRule{action="wind",duration=1});yield return WaitForPreview();Require(Time.unscaledTime>=windUntil&&shieldUntil==0,"shield_blocks_new_harmful_gift_once");
      if(!menuOpen)ToggleMenu();tab=3;actionPicker="@test";actionScroll=new Vector2(0,200);yield return Snapshot("sixteen-gift-actions-scroll");actionPicker=null;
      ResetEffects();autoDrive=false;qaDb=-80;MoveOnTrack(-TrackProgress);Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"new_actions_and_menu_checks_preserve_user_settings");
    }
  }
}
