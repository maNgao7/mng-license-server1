using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    bool qaActive;float? qaDb;VoiceSettings qaVoice;
    bool Focused {get{return Application.isFocused||qaActive;}}
    readonly Dictionary<string,object> qaReport=new Dictionary<string,object>();
    string QaDirectory {get{return Path.Combine(BepInEx.Paths.ConfigPath,"TikMnG-Diagnostics");}}
    bool qaTrafficOnly,qaOfflineStartup,qaPreviewOnly,qaActionsOnly,qaRoundsOnly,qaControlOnly,qaLatestOnly;
    void InitializeQA(){qaTrafficOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-traffic-smoke")>=0;qaLatestOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-latest-smoke")>=0;qaOfflineStartup=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-offline-smoke")>=0;qaPreviewOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-preview-smoke")>=0;qaActionsOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-actions-smoke")>=0;qaRoundsOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-rounds-smoke")>=0;qaControlOnly=Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-control-smoke")>=0;if(qaTrafficOnly||qaLatestOnly||qaOfflineStartup||qaPreviewOnly||qaActionsOnly||qaRoundsOnly||qaControlOnly||Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-smoke")>=0)StartCoroutine(GuardSmoke());}
    IEnumerator GuardSmoke(){
      qaActive=true;Application.runInBackground=true;var tests=new Stack<IEnumerator>();tests.Push(qaTrafficOnly?RunTrafficSmoke():qaLatestOnly?RunLatestSmoke():qaOfflineStartup?RunOfflineStartup():qaPreviewOnly?RunPreviewAndVenueSmoke():qaActionsOnly?RunActionSmoke():qaRoundsOnly?RunRoundAndVoiceSmoke():qaControlOnly?RunControlSmoke():RunSmoke());Exception failure=null;
      // Flatten nested test routines so a rejected HTTP command cannot be reported as a pass.
      while(tests.Count>0){var test=tests.Peek();bool more=false;try{more=test.MoveNext();}catch(Exception error){failure=error;}if(failure!=null)break;if(!more){tests.Pop();continue;}var nested=test.Current as IEnumerator;if(nested!=null)tests.Push(nested);else yield return test.Current;}
      qaReport["passed"]=failure==null;if(failure!=null){qaReport["error"]=failure.ToString();Logger.LogError("Native smoke: "+failure);}
      qaDb=null;qaVoice=null;qaAudienceOverride=qaHideMenu=false;qaButtonText=null;qaActive=false;autoDrive=false;Throttle=0;ReleaseCage();ResetEffects();StopOwnedMic();envelope.Reset();
      if(enteredGame&&!menuOpen)ToggleMenu();
      Directory.CreateDirectory(QaDirectory);File.WriteAllText(Path.Combine(QaDirectory,qaTrafficOnly?"traffic-smoke.json":qaLatestOnly?"latest-smoke.json":qaOfflineStartup?"offline-startup-smoke.json":qaPreviewOnly?"preview-venue-smoke.json":qaActionsOnly?"action-smoke.json":qaRoundsOnly?"rounds-smoke.json":qaControlOnly?"control-smoke.json":"native-smoke.json"),JsonUtility.ToJson(qaReport));
      Logger.LogInfo("Native smoke completed: "+(failure==null?"PASS":"FAIL"));
    }
    void Require(bool condition,string name){qaReport[name]=condition;if(!condition)throw new InvalidOperationException(name);}
    IEnumerator Snapshot(string name){yield return new WaitForEndOfFrame();Directory.CreateDirectory(QaDirectory);ScreenCapture.CaptureScreenshot(Path.Combine(QaDirectory,name+".png"));yield return new WaitForSecondsRealtime(.3f);}
    IEnumerator RunSmoke(){
      qaDb=-80;
      Require(draft!=null&&draft.voice!=null&&actions.Length==20,"local_menu_exists_before_network_initialization");
      float limit=Time.realtimeSinceStartup+30;while(!serverSettingsLoaded||gifts.Length==0){if(Time.realtimeSinceStartup>limit)throw new Exception("Menu initialization timed out");yield return null;}
      Require(actions.Length==20&&gifts.Length>=680,"catalog_and_actions_loaded");
      Require(selectedMap==CustomMap,"custom_map_is_default_first_launch_selection");yield return CheckRulePreviewWorkflow();yield return EnterGame();Require(CustomActive&&Ready,"first_oyuna_gir_opens_default_custom_map");ToggleMenu();
      var initialManager=Get<GameManager>(Home(),"gameManager");qaReport["installed_map_count"]=initialManager.mapsObjs.Length;
      var mapNames=new List<string>();foreach(var map in initialManager.mapsObjs)if(map)mapNames.Add(map.name);qaReport["installed_map_names"]=mapNames;
      yield return new WaitForSecondsRealtime(2);
      qaReport["real_microphone_db"]=measuredMicDb;qaReport["real_microphone_status"]=micStatus;qaReport["windows_default_microphone"]=DefaultMicrophone.Read().Name;
      Require(ownedClip&&Microphone.IsRecording(ownedDevice),"microphone_records_in_menu");
      tab=0;yield return Snapshot("smoke-map");tab=2;yield return Snapshot("smoke-microphone");
      Require(Cursor.visible&&Cursor.lockState==CursorLockMode.None,"menu_cursor_not_warped");
      tab=3;yield return Snapshot("smoke-tests");tab=0;
      selectedMap=0;
      yield return EnterGame();
      Require(enteredGame&&Ready&&!menuOpen,"offline_direct_map_entry");
      qaVoice=JsonUtility.FromJson<VoiceSettings>(JsonUtility.ToJson(Settings));qaVoice.enabled=true;qaVoice.automatic=true;qaVoice.sensitivity=.65f;qaVoice.automaticMaxSpeed=16;envelope.Reset();
      qaDb=-80;yield return new WaitForSecondsRealtime(1);
      Require(Throttle==0,"silence_zero_throttle");
      var rb=Get<Rigidbody>(car,"rb");var home=Home();var spawn=Get<GameManager>(home,"gameManager").mapsObjs[activeMap].SpawnPoint;
      qaReport["motor_power"]=Get<float>(car,"motorPower");qaReport["car_mass"]=rb.mass;
      car.SetPosAndRot(spawn.position,spawn.rotation);yield return new WaitForSecondsRealtime(.5f);
      qaDb=-66;yield return new WaitForSecondsRealtime(1.2f);float quiet=new Vector3(rb.linearVelocity.x,0,rb.linearVelocity.z).magnitude;
      qaReport["quiet_speed_ms"]=quiet;qaReport["quiet_throttle"]=Throttle;qaReport["quiet_grounded"]=car.isGrounded;
      qaDb=-80;yield return new WaitForSecondsRealtime(1);car.SetPosAndRot(spawn.position,spawn.rotation);yield return new WaitForSecondsRealtime(.5f);
      qaDb=-32;yield return new WaitForSecondsRealtime(1.2f);float loud=new Vector3(rb.linearVelocity.x,0,rb.linearVelocity.z).magnitude;
      qaReport["loud_speed_ms"]=loud;qaReport["loud_throttle"]=Throttle;qaReport["loud_grounded"]=car.isGrounded;
      Require(quiet>.1f&&loud>quiet,"louder_voice_drives_faster");
      qaDb=-80;yield return new WaitForSecondsRealtime(1.5f);
      qaReport["silence_speed_ms"]=new Vector3(rb.linearVelocity.x,0,rb.linearVelocity.z).magnitude;
      Require(Throttle==0,"silence_cuts_driving_after_speech");
      yield return Snapshot("smoke-race");
      qaReport["native_jump_ready"]=car.canJump&&car.jumpPossible&&car.isGrounded;
      float startHeight=rb.position.y;TriggerKeyboardAction();
      yield return new WaitForFixedUpdate();yield return new WaitForFixedUpdate();
      qaReport["jump_vertical_speed"]=rb.linearVelocity.y;
      Require(rb.linearVelocity.y>.5f||rb.position.y>startHeight+.05f,"keyboard_jump_raises_car");
      Require(!car.jumpPossible,"native_jump_cooldown_preserved");
      yield return Snapshot("smoke-jump");yield return new WaitForSecondsRealtime(1.5f);
      ToggleMenu();yield return new WaitForSecondsRealtime(.3f);
      Require(menuOpen&&Cursor.visible,"b_menu_open_state");
      int lastActionFrame=lastKeyboardActionFrame;TriggerKeyboardAction();Require(lastKeyboardActionFrame==lastActionFrame,"jump_blocked_while_editing_menu");
      yield return Snapshot("smoke-menu-in-race");ToggleMenu();yield return new WaitForSecondsRealtime(.3f);
      Require(!menuOpen,"b_menu_close_state");
      home.PauseGame();home.OpenSettings();home.OpenSettingsInHome();
      Require(!home.gamePaused&&!home.PauseUI.activeSelf&&!home.SettingsUI.activeSelf&&Ready,"original_pause_and_settings_shortcuts_disabled");
      foreach(var canvas in originalCanvases.Keys)Require(!canvas||!canvas.enabled,"original_ui_hidden");
      var custom=RunTrackSmoke();while(custom.MoveNext())yield return custom.Current;
      yield return RunActionSmoke();
      yield return CheckExtraControls();
      yield return CheckLatestChanges();
      yield return CheckTrafficFeatures();
      yield return RunRoundAndVoiceSmoke();
    }
    IEnumerator RunOfflineStartup(){
      nextBridgeBootstrap=float.PositiveInfinity;qaDb=-80;
      Require(draft!=null&&draft.voice!=null&&actions.Length==20,"offline_menu_has_settings_and_actions");
      Require(!serverSettingsLoaded&&!BridgeOnline,"offline_scenario_starts_without_background_service");
      yield return EnterGame();yield return new WaitForSecondsRealtime(.5f);
      Require(CustomActive&&Ready&&!menuOpen&&!serverSettingsLoaded,"custom_map_runs_even_when_service_is_offline");
      yield return Snapshot("startup-without-service");
      nextBridgeBootstrap=0;RecoverBridge(true);float limit=Time.realtimeSinceStartup+45;
      while(!serverSettingsLoaded||!BridgeOnline||gifts.Length<680){if(Time.realtimeSinceStartup>limit)throw new Exception("Automatic background service recovery timed out");yield return null;}
      Require(CustomActive&&Ready,"background_service_recovers_without_interrupting_race");
      Require(File.ReadAllText(ConfigFile("TikMnG.LocalConnection.token")).Trim()==File.ReadAllText(Path.Combine(dataDir,"token")).Trim(),"recovered_connection_file_matches_canonical_key");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"repair\"}","gift_action_works_after_cold_service_recovery");
      ToggleMenu();tab=1;yield return Snapshot("startup-recovered-menu");
    }
    IEnumerator SmokeCommand(string path,string json,string report){
      Command command=null;
      using(var request=Post(path,json)){yield return request.SendWebRequest();if(request.result!=UnityEngine.Networking.UnityWebRequest.Result.Success)throw new Exception("Command rejected: "+report+" / "+request.downloadHandler.text);command=JsonUtility.FromJson<Command>(request.downloadHandler.text);}
      float limit=Time.realtimeSinceStartup+Mathf.Max(8,GiftTravelDuration(GiftDistance(command.distance),command.action=="backward",command.action=="tornado")+6);while(!applied.ContainsKey(command.id)){if(Time.realtimeSinceStartup>limit)throw new Exception("Game action timed out: "+report);yield return null;}
      Require(applied[command.id].ok,report);yield return new WaitForSecondsRealtime(.25f);
    }
    void TouchTrackBumper(bool forward){
      var bumper=Array.Find(trackRoot.GetComponentsInChildren<TrackBumper>(),item=>item.Forward==forward&&item.BasePosition.y>=trackOrigin.y&&(forward?item.Kind==TrackObstacleKind.Boost:item.Kind==TrackObstacleKind.Sliding));
      if(!bumper)throw new Exception("Missing moving obstacle");
      car.SetPosAndRot(bumper.transform.position+Vector3.up*.45f,Quaternion.identity);
      var body=Get<Rigidbody>(car,"rb");body.linearVelocity=Vector3.zero;body.angularVelocity=Vector3.zero;Physics.SyncTransforms();
    }
    IEnumerator CheckNewObstacles(){
      var rotor=Array.Find(trackRoot.GetComponentsInChildren<TrackBumper>(),item=>item.Kind==TrackObstacleKind.Rotating&&item.BasePosition.y>=trackOrigin.y);
      var gate=Array.Find(trackRoot.GetComponentsInChildren<TrackBumper>(),item=>item.Kind==TrackObstacleKind.Gate);
      Require(rotor&&gate,"rotating_sweeper_and_timed_gate_exist");
      var rb=Get<Rigidbody>(car,"rb");
      MoveOnTrack(rotor.TrackZ-15-TrackProgress);yield return new WaitForSecondsRealtime(1.5f);
      Quaternion angle=rotor.transform.rotation;yield return new WaitForSecondsRealtime(.3f);Require(Quaternion.Angle(angle,rotor.transform.rotation)>8,"sweeper_really_rotates");
      car.SetPosAndRot(rotor.transform.position+Vector3.up*.45f,Quaternion.identity);rb.linearVelocity=Vector3.zero;Physics.SyncTransforms();
      yield return new WaitForSecondsRealtime(.2f);Require(trackImpactUntil>Time.unscaledTime&&rb.linearVelocity.z<0,"rotating_sweeper_contact_launches_backwards");
      MoveOnTrack(gate.TrackZ-12-TrackProgress);yield return new WaitForSecondsRealtime(1.5f);
      float limit=Time.realtimeSinceStartup+9;
      while(gate.transform.position.y-gate.BasePosition.y>.1f){if(Time.realtimeSinceStartup>limit)throw new Exception("Gate never closes");yield return null;}
      car.SetPosAndRot(gate.BasePosition+Vector3.up*.45f,Quaternion.identity);rb.linearVelocity=Vector3.zero;Physics.SyncTransforms();
      yield return new WaitForSecondsRealtime(.2f);Require(trackImpactUntil>Time.unscaledTime&&rb.linearVelocity.z<0,"closed_gate_contact_launches_backwards");
      MoveOnTrack(gate.TrackZ-12-TrackProgress);yield return new WaitForSecondsRealtime(1.5f);
      limit=Time.realtimeSinceStartup+9;
      while(gate.transform.position.y-gate.BasePosition.y<5.5f){if(Time.realtimeSinceStartup>limit)throw new Exception("Gate never opens");yield return null;}
      car.SetPosAndRot(gate.BasePosition,Quaternion.identity);rb.linearVelocity=Vector3.zero;Physics.SyncTransforms();
      yield return new WaitForSecondsRealtime(.3f);Require(gate.GateOpen&&TrackProgress>gate.TrackZ-1&&trackImpactUntil<Time.unscaledTime,"raised_gate_leaves_a_real_drive_through_gap");
      MoveOnTrack(gate.TrackZ-16-TrackProgress);yield return new WaitForSecondsRealtime(.5f);yield return Snapshot("track-gate");
    }
    void CheckTrackClearance(){
      // Static batches may also contain the wide side road; inspect the original terrain meshes.
      foreach(var mesh in landscapeMeshes){
        var bounds=mesh.bounds;if(bounds.min.x<18&&bounds.max.x>-18)throw new Exception("Mountain geometry overlaps road: "+mesh.name);
        foreach(var vertex in mesh.vertices)if(trackLayout.SideRoadAt(vertex.z,13)&&vertex.y>-.9f)throw new Exception("Mountain closes side-road valley");
      }
      foreach(var label in trackRoot.GetComponentsInChildren<TrackLabelFit>()){
        var size=label.GetComponent<MeshRenderer>().bounds.size;
        if(size.x>label.Width+.05f||size.y>label.Height+.05f||size.x<.01f)throw new Exception("Track label does not fit its sign: "+label.name);
      }
    }
    IEnumerator RunTrackSmoke(){
      if(!menuOpen)ToggleMenu();selectedMap=CustomMap;lengthText="2000";draft.track.length=2000;tab=0;
      yield return Snapshot("track-map-settings");yield return EnterGame();yield return new WaitForSecondsRealtime(1);
      Require(CustomActive&&builtLength==2000&&Ready,"custom_2000m_track_opens");
      CheckTrackClearance();Require(true,"scenic_hills_leave_full_road_clearance");
      qaReport["custom_ground_mask"]=Get<LayerMask>(car,"groundLayerM").value;
      Require(car.isGrounded,"custom_track_native_wheels_grounded");
      var rb=Get<Rigidbody>(car,"rb");qaDb=-80;float z=car.transform.position.z;ToggleAutoDrive();
      yield return new WaitForSecondsRealtime(1.2f);Require(autoDrive&&car.transform.position.z>z+.5f,"o_automatic_drive_moves_without_voice");
      ToggleAutoDrive();yield return new WaitForSecondsRealtime(1);Require(!autoDrive&&Throttle==0,"o_automatic_drive_switches_back_to_voice");
      MoveOnTrack(10);yield return new WaitForSecondsRealtime(.3f);float progress=TrackProgress;
      yield return SmokeCommand("/mod/test-action","{\"action\":\"forward\",\"distance\":10}","track_action_forward");
      Require(TrackProgress>progress+8,"gift_forward_really_changes_metres");
      progress=TrackProgress;yield return SmokeCommand("/mod/test-action","{\"action\":\"backward\",\"distance\":5}","track_action_backward");Require(TrackProgress<progress-3,"gift_backward_really_changes_metres");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"boost\",\"duration\":10,\"strength\":2}","track_action_boost");Require(boostUntil>Time.unscaledTime,"gift_boost_active");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"slow\",\"duration\":10,\"strength\":2}","track_action_slow");Require(slowUntil>Time.unscaledTime,"gift_slow_active");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"invert\",\"duration\":10}","track_action_invert");Require(Inverted,"gift_invert_active");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"jail\",\"duration\":1}","track_action_jail");Require(cage&&rb.constraints==RigidbodyConstraints.FreezeAll,"gift_cage_really_freezes_car");
      yield return new WaitForSecondsRealtime(1.2f);Require(!cage,"gift_cage_expires");
      ResetEffects();MoveOnTrack(-TrackProgress);if(!menuOpen)ToggleMenu();
      yield return SmokeCommand("/mod/test-action","{\"action\":\"shield\",\"duration\":10}","track_action_shield");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"jail\",\"duration\":2}","track_shield_blocks_harmful_gift");Require(!cage&&shieldUntil==0,"shield_is_consumed_once");
      if(menuOpen)ToggleMenu();
      yield return SmokeCommand("/mod/test-action","{\"action\":\"jump\",\"strength\":2}","track_action_jump");
      yield return SmokeCommand("/mod/test-action","{\"action\":\"repair\"}","track_action_repair");yield return new WaitForSecondsRealtime(1.2f);
      GiftRule mapped=null;foreach(var rule in menuState.settings.rules)if(rule.enabled&&rule.action=="forward"&&!string.IsNullOrEmpty(rule.giftId)){mapped=rule;break;}
      if(mapped!=null)yield return SmokeCommand("/mod/test-gift",JsonUtility.ToJson(new GiftTestBody{giftId=mapped.giftId}),"saved_gift_routes_into_custom_map");
      MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(1.6f);TouchTrackBumper(false);yield return new WaitForSecondsRealtime(.2f);qaReport["bumper_contact_velocity"]=rb.linearVelocity.ToString();qaReport["bumper_contact_cooldown"]=nextTrackImpact-Time.unscaledTime;Require(trackImpactUntil>Time.unscaledTime&&rb.linearVelocity.z<0,"backward_obstacle_collision_really_launches_car");
      yield return new WaitForSecondsRealtime(1.5f);autoDrive=true;yield return new WaitForSecondsRealtime(.2f);TouchTrackBumper(true);yield return new WaitForSecondsRealtime(.2f);qaReport["boost_pad_speed_ms"]=rb.linearVelocity.z;Require(trackRunupUntil>Time.unscaledTime+7&&rb.linearVelocity.z>24,"forward_pad_boosts_for_eight_seconds_when_driving_is_requested");
      ToggleMenu();yield return new WaitForSecondsRealtime(8.1f);Require(trackRunupUntil<Time.unscaledTime,"speed_pad_boost_expires_without_sticking");autoDrive=false;ToggleMenu();
      trackRunupUntil=0;yield return new WaitForSecondsRealtime(1.5f);yield return CheckNewObstacles();
      yield return CheckPhysicalJump();
      yield return CheckRemainingJumpArcs();yield return CheckSlalomAndSwingContacts();
      yield return new WaitForSecondsRealtime(1.5f);ResetEffects();MoveOnTrack(15-TrackProgress);yield return new WaitForSecondsRealtime(.5f);
      yield return Snapshot("track-gameplay");
      MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(.5f);yield return Snapshot("race-start-venue");
      var camera=Get<GameManager>(car,"gameManager").camControl;camera.ResetPosAndRot(0,42);yield return new WaitForSecondsRealtime(.4f);yield return Snapshot("track-scenery");camera.ResetPosAndRot(0,0);
      yield return SmokeCommand("/mod/test-action","{\"action\":\"explode\"}","track_action_explode");
      float limit=Time.realtimeSinceStartup+12;while(!Ready){if(Time.realtimeSinceStartup>limit)throw new Exception("Explosion did not respawn on custom track");yield return null;}
      Require(CustomActive&&TrackProgress<4,"custom_explosion_respawns_at_start");yield return new WaitForSecondsRealtime(.6f);
      yield return SmokeCommand("/mod/test-action","{\"action\":\"restart\"}","track_action_restart");
      limit=Time.realtimeSinceStartup+15;while(!Ready){if(Time.realtimeSinceStartup>limit)throw new Exception("Restart did not return to custom track");yield return null;}
      Require(CustomActive&&TrackProgress<4,"custom_restart_preserves_map");yield return new WaitForSecondsRealtime(.6f);
      if(!menuOpen)ToggleMenu();tab=1;giftPicker="@test";giftScroll=Vector2.zero;
      limit=Time.realtimeSinceStartup+10;while(giftTextures.Count<24){if(Time.realtimeSinceStartup>limit)throw new Exception("Gift images did not render in Unity");yield return null;}
      Require(giftTextures.Count>=24,"visible_gift_images_decode_in_native_game");yield return Snapshot("track-gift-catalog");giftPicker=null;ToggleMenu();
      MoveOnTrack(builtLength-24-TrackProgress);yield return new WaitForSecondsRealtime(.3f);yield return Snapshot("race-finish-approach");
      MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(.2f);Require(trackFinished&&TrackRemaining==0&&!autoDrive,"finish_line_stops_round_at_zero_metres");
      Require(finishBursts.Count==2&&finishBursts[0].isPlaying&&finishBursts[1].isPlaying,"finish_fires_two_bounded_confetti_bursts");yield return Snapshot("track-finish");
      ToggleMenu();lengthText="5000";draft.track.length=5000;StartCoroutine(EnterGame());yield return null;int frames=0;float began=Time.realtimeSinceStartup,maxFrame=0,previousFrame=began;bool captured=false;
      while(startingGame){frames++;float now=Time.realtimeSinceStartup;maxFrame=Mathf.Max(maxFrame,now-previousFrame);previousFrame=now;if(!captured&&loadingProgress>=.25f){captured=true;yield return Snapshot("track-loading-progress");}yield return null;}
      qaReport["maximum_track_loading_seconds"]=Time.realtimeSinceStartup-began;qaReport["maximum_track_loading_frames"]=frames;qaReport["maximum_track_loading_largest_frame_seconds"]=maxFrame;
      Require(frames>20&&captured,"maximum_track_loading_yields_to_animated_screen");yield return new WaitForSecondsRealtime(.7f);Require(CustomActive&&builtLength==5000&&Ready,"maximum_5000m_track_opens");
      CheckTrackClearance();Require(true,"scenery_clearance_preserved_for_entire_5000m_track");
      MoveOnTrack(1000);yield return new WaitForSecondsRealtime(.3f);yield return Snapshot("track-long-distance");
      ToggleMenu();lengthText="100";draft.track.length=100;yield return EnterGame();yield return new WaitForSecondsRealtime(.7f);Require(CustomActive&&builtLength==100&&Ready,"minimum_100m_track_opens");
      ToggleMenu();selectedMap=0;yield return EnterGame();yield return new WaitForSecondsRealtime(.6f);Require(!CustomActive&&Ready&&Get<GameManager>(car,"gameManager").mapsObjs[0]==originalMaps[0],"original_map_restores_after_custom_track");
      ToggleMenu();selectedMap=CustomMap;draft.track.length=menuState.settings.track.length;lengthText=draft.track.length.ToString();yield return EnterGame();yield return new WaitForSecondsRealtime(.5f);
    }
  }
}
