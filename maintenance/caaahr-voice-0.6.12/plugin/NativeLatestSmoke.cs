using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    string qaButtonText;bool qaAudienceOverride,qaHideMenu;
    // Exercise the same guarded button callbacks without OS-level input automation.
    IEnumerator QaMenuButton(string text){
      qaButtonText=text;float deadline=Time.unscaledTime+3;while(qaButtonText!=null){if(Time.unscaledTime>deadline)throw new Exception("QA menu control was not rendered: "+text);yield return null;}
      yield return null;
    }
    IEnumerator RunLatestSmoke(){
      qaDb=-80;float deadline=Time.unscaledTime+30;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Latest tests initialization timed out");yield return null;}
      yield return EnterGame();yield return new WaitForSecondsRealtime(1);yield return CheckLatestChanges();
    }
    IEnumerator CheckLatestChanges(){
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));qaDb=-80;autoDrive=false;ResetEffects();if(!menuOpen)ToggleMenu();
      tab=3;actionPicker="@test";testRule.action="jail";actionScroll=Vector2.zero;yield return null;
      yield return QaMenuButton("Oyuna dön");Require(menuOpen&&actionPicker!=null&&tab==3,"action_catalog_blocks_background_return_to_game");
      yield return QaMenuButton("Araç ve renk");Require(tab==3&&menuOpen,"action_catalog_blocks_background_tabs");
      actionPicker="@test";actionScroll=Vector2.zero;yield return QaMenuButton(actions[0].name);Require(actionPicker==null&&testRule.action==actions[0].id,"modal_action_selection_still_receives_clicks");
      giftPicker="@test";yield return null;yield return QaMenuButton("Oyuna dön");Require(menuOpen&&giftPicker!=null,"gift_catalog_blocks_background_return_to_game");yield return Snapshot("catalog-input-isolated");giftPicker=null;
      testRule.action="egg";tab=3;yield return Snapshot("expanded-test-area");
      Require(Array.Find(actions,a=>a.id=="gravity")==null&&Array.Find(actions,a=>a.id=="release")!=null&&Array.Find(actions,a=>a.id=="egg")!=null,"removed_gravity_and_added_egg_and_release");
      ToggleMenu();yield return new WaitForSecondsRealtime(.5f);
      Execute(new Command{action="jail",duration=30});Require(cage&&Jailed,"cage_gift_locks_car");yield return SmokeCommand("/mod/test-action","{\"action\":\"release\"}","release_gift_receives_real_game_ack");Require(!cage&&!Jailed&&Get<Rigidbody>(car,"rb").constraints!=RigidbodyConstraints.FreezeAll,"release_gift_unlocks_car_without_healing_or_restart");
      Execute(new Command{action="egg",duration=2});yield return new WaitForSecondsRealtime(1.3f);Require(eggTexture&&Time.unscaledTime<eggUntil,"new_egg_gift_is_visible");yield return Snapshot("gift-egg-final");yield return new WaitForSecondsRealtime(2.2f);Require(Time.unscaledTime>eggUntil,"new_egg_gift_removes_itself");
      Execute(new Command{action="shield",duration=5});Require(shieldVisual&&shieldVisual.transform.Find("Floating protection badge")&&shieldMeshes.Count==3,"shield_uses_small_badge_and_subtle_protective_shell");yield return Snapshot("shield-redesigned-final");Require(ConsumeShield("egg")&&!ConsumeShield("egg"),"shield_blocks_egg_once_only");
      MoveOnTrack(5-TrackProgress);int shifts=windShifts;Execute(new Command{action="wind",duration=3,strength=2});yield return new WaitForSecondsRealtime(2.2f);Require(windShifts>shifts,"wind_changes_direction_during_the_effect");ResetEffects();
      MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(.6f);
      var old=draft.appearance;draft.appearance=new AppearanceSettings{configured=true,style="sport",red=.9f,green=.12f,blue=.2f};UpdateAppearance();Require(paintRenderer&&appearanceRoot.transform.childCount==5,"sport_style_and_body_color_apply_to_real_car");
      Color paint=paintBlock.GetColor("_BaseColor");Require(Mathf.Abs(paint.r-.9f)<.01f,"body_color_changes_without_replacing_wheels_or_face");
      ToggleMenu();tab=4;yield return Snapshot("vehicle-color-menu");ToggleMenu();yield return Snapshot("sport-vehicle-in-game");
      draft.appearance=new AppearanceSettings{configured=true,style="rally",red=.05f,green=.6f,blue=.9f};UpdateAppearance();Require(appearanceRoot.transform.childCount==10,"rally_style_has_roof_rack_and_bumper");yield return Snapshot("rally-vehicle-in-game");draft.appearance=old;ReleaseAppearance();UpdateAppearance();
      var rb=Get<Rigidbody>(car,"rb");var root=new GameObject("QA thin turbo obstacle");root.transform.position=trackOrigin+new Vector3(0,1.6f,18);var contact=root.AddComponent<BoxCollider>();contact.isTrigger=true;contact.size=new Vector3(18,4,.2f);var bumper=root.AddComponent<TrackBumper>();bumper.Owner=this;bumper.BasePosition=root.transform.position;bumper.TrackZ=18;bumper.Kind=TrackObstacleKind.Gate;bumper.enabled=false;
      Execute(new Command{action="boost",duration=8,strength=8});
      for(int attempt=0;attempt<3;attempt++){
        car.SetPosAndRot(trackOrigin+new Vector3(0,1.5f,5),Quaternion.identity);Physics.SyncTransforms();bumper.CheckContact();
        car.SetPosAndRot(trackOrigin+new Vector3(0,1.5f,15),Quaternion.identity);rb.linearVelocity=Vector3.forward*100;Physics.SyncTransforms();bumper.CheckContact();
        Require(TrackProgress<12&&rb.linearVelocity.z<0,"turbo_repeat_collision_knocks_back_"+attempt);
      }
      Destroy(root);ResetEffects();MoveOnTrack(44-TrackProgress);yield return new WaitForSecondsRealtime(.5f);
      var previous=audience;qaAudienceOverride=true;audience=new[]{new SpectatorInfo{username="Test izleyici 1",cheering=true},new SpectatorInfo{username="Test izleyici 2"},new SpectatorInfo{username="Test izleyici 3",cheering=true},new SpectatorInfo{username="Test izleyici 4"}};nextAudienceUpdate=0;UpdateAudience();
      Require(audiencePeople.Count==4&&audienceSeats.Count>=33,"live_viewer_roster_populates_seated_human_figures");foreach(var person in audiencePeople.Values)Require(Mathf.Abs(person.transform.localPosition.x)>19&&person.Arms.Length==2,"audience_stays_off_the_road_"+person.Slot);yield return new WaitForSecondsRealtime(.2f);
      ToggleMenu();var camera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");Vector3 pos=camera.transform.position;Quaternion rot=camera.transform.rotation;camera.transform.position=trackOrigin+new Vector3(-10,4,50);camera.transform.LookAt(trackOrigin+new Vector3(-20,2.5f,62));
      qaHideMenu=true;yield return Snapshot("live-audience-stands");qaHideMenu=false;camera.transform.position=pos;camera.transform.rotation=rot;audience=previous;qaAudienceOverride=false;nextAudienceUpdate=0;UpdateAudience();
      Require(landscapeMeshes.Count>0&&trackRoot.GetComponentsInChildren<TrackBird>().Length==9,"layered_mountain_meshes_and_animated_birds_exist");
      yield return CheckAtmosphereChanges();
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"latest_changes_preserve_saved_gifts_microphone_and_graphics");tab=0;
    }
  }
}
