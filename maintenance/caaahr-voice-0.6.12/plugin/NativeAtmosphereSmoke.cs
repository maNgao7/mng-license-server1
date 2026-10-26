using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator CheckAtmosphereChanges(){
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));if(menuOpen)ToggleMenu();ResetEffects();autoDrive=false;qaDb=-80;MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(.5f);
      StartRulePreview(new GiftRule{action="wind",duration=2,strength=3});yield return WaitForPreview();yield return new WaitForSecondsRealtime(.2f);Require(windVisual&&windVisual.activeSelf&&windVisual.transform.childCount==34,"wind_uses_thirty_four_colored_mesh_leaves");Vector3 leaf=windVisual.transform.GetChild(0).position;yield return new WaitForSecondsRealtime(.15f);Require(Vector3.Distance(leaf,windVisual.transform.GetChild(0).position)>.1f,"wind_leaves_visibly_travel_across_the_car");yield return Snapshot("wind-leaves-final");yield return new WaitForSecondsRealtime(2);ResetEffects();
      MoveOnTrack(135-TrackProgress);yield return new WaitForSecondsRealtime(.5f);float from=TrackProgress,expected=trackLayout.GiftZ(Mathf.Max(0,from-25),false,builtLength);
      StartRulePreview(new GiftRule{action="tornado",distance=25});float deadline=Time.unscaledTime+8;while(!giftMotion){if(Time.unscaledTime>deadline)throw new Exception("Tornado never captures car");yield return null;}
      Require(tornado&&motionTornado&&tornadoMesh&&tornadoAudio&&tornadoAudio.isPlaying,"tornado_creates_tall_funnel_and_wind_audio");yield return new WaitForSecondsRealtime(.65f);
      Require(car.transform.position.y>trackOrigin.y+3,"tornado_lifts_the_actual_car_off_the_road");yield return Snapshot("tornado-car-in-flight");yield return WaitForPreview();
      var rb=Get<Rigidbody>(car,"rb");Require(TrackProgress<from-10&&Mathf.Abs(TrackProgress-expected)<1&&!rb.isKinematic&&rb.detectCollisions,"tornado_returns_car_backwards_and_restores_physics");yield return new WaitForSecondsRealtime(1);Require(!tornado&&!tornadoAudio,"tornado_visual_and_audio_both_stop");
      ResetEffects();if(!menuOpen)ToggleMenu();StartRulePreview(new GiftRule{action="shield",duration=5});yield return WaitForPreview();StartRulePreview(new GiftRule{action="tornado",distance=20});yield return WaitForPreview();Require(!tornado&&!giftMotion&&shieldUntil==0,"single_use_shield_blocks_a_tornado_once");
      string avatar="";foreach(string arg in Environment.GetCommandLineArgs())if(arg.StartsWith("--tikmng-avatar=",StringComparison.Ordinal))avatar=arg.Substring(16);
      qaReport["live_avatar_fixture"]=avatar.Length==45?"supplied":"optional live photo test not requested";
      if(avatar.Length==45){
        if(menuOpen)ToggleMenu();MoveOnTrack(44-TrackProgress);yield return new WaitForSecondsRealtime(.5f);var oldAudience=audience;qaAudienceOverride=true;audience=new[]{new SpectatorInfo{username="Profil fotograf testi",avatar=avatar,cheering=true}};nextAudienceUpdate=0;UpdateAudience();deadline=Time.unscaledTime+15;
        while(BoundPortraitCount()<1){if(Time.unscaledTime>deadline)throw new Exception("Live profile texture did not download: "+avatar);yield return null;}
        Require(BoundPortraitCount()==1,"real_live_avatar_downloads_into_a_round_in_game_portrait");
        if(!menuOpen)ToggleMenu();var camera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");var position=camera.transform.position;var rotation=camera.transform.rotation;camera.transform.position=trackOrigin+new Vector3(-10,4,50);camera.transform.LookAt(trackOrigin+new Vector3(-20,2.4f,61));qaHideMenu=true;yield return Snapshot("live-profile-portrait-final");qaHideMenu=false;
        bool faces=true;foreach(var person in audiencePeople.Values){Vector3 left=camera.WorldToViewportPoint(person.Label.position),right=camera.WorldToViewportPoint(person.Label.position+person.Label.right*.3f);faces&=right.x>left.x;qaReport["portrait_texture_width"]=person.Portrait.sharedMaterial.mainTexture.width;}
        camera.transform.position=position;camera.transform.rotation=rotation;audience=oldAudience;qaAudienceOverride=false;nextAudienceUpdate=0;UpdateAudience();Require(faces,"viewer_name_faces_the_rendering_camera_without_mirroring");
      }
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"profile_and_weather_tests_preserve_all_saved_settings");
    }
  }
}
