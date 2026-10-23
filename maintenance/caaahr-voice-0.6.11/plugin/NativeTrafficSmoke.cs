using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator RunTrafficSmoke(){
      qaDb=-80;float deadline=Time.unscaledTime+30;while(!serverSettingsLoaded||!BridgeOnline){if(Time.unscaledTime>deadline)throw new Exception("Traffic test initialization timed out");yield return null;}
      selectedMap=CustomMap;yield return EnterGame();yield return new WaitForSecondsRealtime(1);yield return CheckTrafficFeatures();
    }
    IEnumerator CheckTrafficFeatures(){
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));if(menuOpen)ToggleMenu();ResetEffects();autoDrive=false;qaDb=-80;
      Require(TrackLayout.HalfWidth==14&&TrackLayout.LaneCenters.Length==4,"four_lane_28m_road_is_active");
      Require(actions.Length==20&&Array.Find(actions,a=>a.id=="logs")!=null&&Array.Find(actions,a=>a.id=="traffic")!=null,"both_new_road_gifts_are_available");
      var hurdle=Array.Find(trackRoot.GetComponentsInChildren<RoadHazard>(),h=>h.Hurdle);Require(hurdle&&hurdle.Contact.size.x>27,"low_hurdle_spans_all_four_lanes");
      var rb=Get<Rigidbody>(car,"rb");MoveOnTrack(hurdle.TrackZ-8-TrackProgress);yield return new WaitForSecondsRealtime(.8f);trackImpactUntil=Time.unscaledTime+2;rb.linearVelocity=Vector3.forward*22;float limit=Time.unscaledTime+2;
      while(rb.linearVelocity.z>=0&&Time.unscaledTime<limit)yield return null;
      Require(TrackProgress<hurdle.TrackZ-8&&rb.linearVelocity.z<0,"driving_into_small_hurdle_without_jumping_pushes_back");
      ResetEffects();MoveOnTrack(hurdle.TrackZ-9-TrackProgress);yield return new WaitForSecondsRealtime(1.5f);Require(car.isGrounded&&car.jumpPossible,"manual_hurdle_jump_starts_on_ground");
      qaReport["hurdle_z"]=hurdle.TrackZ;qaReport["hurdle_ground_height"]=rb.position.y-trackOrigin.y;qaReport["car_collider_bounds"]=Get<Collider>(car,"coll").bounds.ToString();
      trackImpactUntil=Time.unscaledTime+3;rb.linearVelocity=Vector3.forward*18;TriggerKeyboardAction();bool airborne=false;limit=Time.unscaledTime+3;
      while(TrackProgress<hurdle.TrackZ+5){if(Time.unscaledTime>limit){yield return Snapshot("manual-jump-failure");throw new Exception("Space jump never clears low hurdle at "+TrackProgress+" / hurdle="+hurdle.TrackZ+" / height="+(rb.position.y-trackOrigin.y)+" / velocity="+rb.linearVelocity);}airborne|=!car.isGrounded&&rb.position.y>trackOrigin.y+2.5f;yield return null;}
      Require(airborne&&TrackProgress>hurdle.TrackZ+5,"space_jump_physically_clears_manual_hurdle");yield return Snapshot("four-lane-manual-hurdle-jump");ResetEffects();MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(.8f);
      var crossing=trackRoot.GetComponentInChildren<TrackCrossing>();Require(crossing&&trackLayout.Crossings.Count>=1,"occasional_mountain_side_roads_have_traffic");
      MoveOnTrack(crossing.TrackZ-25-TrackProgress);yield return new WaitForSecondsRealtime(.5f);Vector3 before=crossing.Vehicles[0].transform.position;yield return new WaitForSecondsRealtime(1);Require(Vector3.Distance(before,crossing.Vehicles[0].transform.position)>1,"cross_traffic_really_moves_through_junction");yield return Snapshot("mountain-side-road-traffic");
      if(!menuOpen)ToggleMenu();float clock=crossing.Clock;before=crossing.Vehicles[0].transform.position;yield return new WaitForSecondsRealtime(.4f);Require(crossing.Clock==clock&&Vector3.Distance(before,crossing.Vehicles[0].transform.position)<.001f,"b_menu_freezes_cross_traffic_too");ToggleMenu();
      int crashes=trafficCrashCount;crossing.Clock=3.5f;crossing.enabled=false;crossing.ResetForRound();crossing.Clock=3.5f;
      var vehicle=crossing.Vehicles[0];vehicle.MoveTo(trackOrigin+new Vector3(0,0,crossing.TrackZ-3.6f));car.SetPosAndRot(trackOrigin+new Vector3(0,1.5f,crossing.TrackZ-3.6f),Quaternion.identity);Physics.SyncTransforms();vehicle.CheckContact(Vector3.zero);
      yield return new WaitForSecondsRealtime(.8f);Require(trafficCrashCount==crashes+1&&!trafficCrash&&TrackProgress<2&&!rb.isKinematic,"traffic_collision_returns_real_car_to_start_and_restores_physics");crossing.enabled=true;
      crossing.Clock=8;Require(crossing.RoadClear,"junction_has_a_clear_crossing_window");
      crashes=trafficCrashCount;MoveOnTrack(crossing.TrackZ-TrackProgress);yield return new WaitForSecondsRealtime(.3f);crossing.enabled=false;crossing.Clock=9;crossing.Vehicles[0].MoveTo(trackOrigin+new Vector3(70,0,crossing.TrackZ-3.6f));crossing.ResetForRound();Require(trafficCrashCount==crashes,"traffic_cycle_wrap_never_sweeps_a_teleport_through_player");crossing.enabled=true;
      MoveOnTrack(5-TrackProgress);yield return new WaitForSecondsRealtime(1.2f);StartRulePreview(new GiftRule{action="logs"});yield return WaitForPreview();Require(roadGifts.Count==1&&roadGifts[0].transform.childCount==4,"rolling_log_gift_sends_one_log_for_each_lane");
      var logs=roadGifts[0].GetComponentsInChildren<RoadHazard>();before=logs[0].transform.position;Quaternion rotation=logs[0].Roll.rotation;yield return new WaitForSecondsRealtime(.4f);Require(logs[0].transform.position.z<before.z-3&&Quaternion.Angle(rotation,logs[0].Roll.rotation)>10,"gift_logs_approach_and_visibly_roll");yield return Snapshot("four-lane-rolling-logs");ResetEffects();
      var position=car.transform.position;position.x=trackOrigin.x-3.5f;car.SetPosAndRot(position,Quaternion.identity);yield return new WaitForSecondsRealtime(.3f);
      StartRulePreview(new GiftRule{action="traffic",strength=2});yield return WaitForPreview();Require(roadGifts.Count==1&&roadGifts[0].transform.childCount==1,"oncoming_car_gift_creates_a_visible_vehicle");yield return Snapshot("oncoming-gift-car");
      if(!menuOpen)ToggleMenu();var approaching=roadGifts[0].GetComponentInChildren<RoadHazard>();before=approaching.transform.position;float remaining=approaching.Remaining;yield return new WaitForSecondsRealtime(.4f);Require(Vector3.Distance(before,approaching.transform.position)<.001f&&approaching.Remaining==remaining,"b_menu_freezes_gift_car_and_its_lifetime");ToggleMenu();
      crashes=trafficCrashCount;limit=Time.unscaledTime+6;while(trafficCrashCount==crashes){if(Time.unscaledTime>limit)throw new Exception("Oncoming gift car never reaches player");yield return null;}yield return new WaitForSecondsRealtime(.8f);Require(!trafficCrash&&TrackProgress<2,"oncoming_gift_collision_restarts_at_beginning");
      yield return new WaitForSecondsRealtime(1.2f);Execute(new Command{action="shield",duration=5});crashes=trafficCrashCount;HitRoadHazard(false);Require(!trafficCrash&&trafficCrashCount==crashes&&shieldUntil==0,"shield_blocks_one_traffic_crash");
      ResetEffects();StartRulePreview(new GiftRule{action="egg",duration=2});yield return WaitForPreview();Require(eggBird&&eggWings.Length==2,"egg_gift_first_sends_a_feathered_bird");yield return new WaitForSecondsRealtime(.62f);Require(fallingEgg&&fallingEgg.activeSelf,"egg_visibly_drops_from_bird_toward_camera");yield return Snapshot("bird-dropping-egg");yield return new WaitForSecondsRealtime(.7f);Require(Time.unscaledTime>eggStart+1.1f&&Time.unscaledTime<eggUntil,"bird_egg_then_becomes_center_screen_splatter");yield return Snapshot("bird-egg-screen-splatter");yield return new WaitForSecondsRealtime(2.2f);Require(!eggBird&&!fallingEgg&&Time.unscaledTime>eggUntil,"bird_egg_and_splatter_cleanup_after_effect");
      Require(birdWingMesh&&birdWingMesh.vertexCount>10,"scenery_birds_use_tapered_feather_geometry");ResetEffects();MoveOnTrack(-TrackProgress);if(!menuOpen)ToggleMenu();Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"traffic_course_preserves_all_user_settings");
    }
  }
}
