using System;
using System.Collections;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator CheckPhysicalJump(){
      ResetEffects();qaDb=-80;autoDrive=false;var jump=trackLayout.Jumps[0];
      trackRunupUntil=0;qaReport["native_gravity"]=Physics.gravity.ToString();
      Require(TrackLayout.HalfWidth==14&&trackLayout.Jumps.Count>1,"wide_track_contains_multiple_real_jump_sections");
      var bumpers=trackRoot.GetComponentsInChildren<TrackBumper>();
      Require(Array.Exists(bumpers,b=>b.Kind==TrackObstacleKind.Slalom)&&Array.Exists(bumpers,b=>b.Kind==TrackObstacleKind.Swing),"slalom_and_pendulum_obstacles_exist");
      var rb=Get<Rigidbody>(car,"rb");MoveOnTrack(jump.Approach-8-TrackProgress);yield return new WaitForSecondsRealtime(.8f);
      autoDrive=true;float limit=Time.realtimeSinceStartup+12;bool boosted=false,airborne=false;
      while(TrackProgress<jump.Landing+3){
        if(Time.realtimeSinceStartup>limit)throw new Exception("Ramp traversal timed out at "+TrackProgress+"; y="+(rb.position.y-trackOrigin.y)+"; v="+rb.linearVelocity);
        boosted|=rb.linearVelocity.z>18;
        if(TrackProgress>jump.Lip&&TrackProgress<jump.Landing){airborne|=rb.position.y>trackOrigin.y+2&&!car.isGrounded;if(!qaReport.ContainsKey("jump_airborne_image")){qaReport["jump_airborne_image"]=true;yield return Snapshot("track-ramp-flight");}}
        yield return null;
      }
      autoDrive=false;trackRunupUntil=0;yield return new WaitForSecondsRealtime(1.8f);
      Require(boosted,"runup_pad_really_increases_native_car_speed");Require(airborne,"native_car_flies_across_real_gap");
      Require(Ready&&car.isGrounded&&TrackProgress>jump.Landing,"ramp_jump_lands_on_opposite_road");yield return Snapshot("track-ramp-landing");
      trackRunupUntil=0;MoveOnTrack(jump.Lip-8-TrackProgress);float destination=(jump.Lip+jump.Landing)/2;
      MoveOnTrack(destination-TrackProgress);Require(TrackProgress>=jump.Landing,"gift_teleport_never_places_car_in_jump_pit");
      car.SetPosAndRot(trackOrigin+new Vector3(0,-9,destination),Quaternion.identity);rb.linearVelocity=Vector3.zero;
      yield return new WaitForSecondsRealtime(.5f);Require(Ready&&TrackProgress<jump.RampStart&&rb.position.y>trackOrigin.y,"failed_jump_recovers_before_ramp");
      MoveOnTrack(jump.Approach-10-TrackProgress);yield return new WaitForSecondsRealtime(.5f);yield return Snapshot("track-ramp-approach");
    }
    IEnumerator CheckRemainingJumpArcs(){
      var rb=Get<Rigidbody>(car,"rb");
      for(int i=1;i<trackLayout.Jumps.Count;i++){
        var jump=trackLayout.Jumps[i];autoDrive=false;trackRunupUntil=0;trackImpactUntil=0;ResetEffects();
        MoveOnTrack(jump.Approach-8-TrackProgress);yield return new WaitForSecondsRealtime(.8f);autoDrive=true;
        float limit=Time.realtimeSinceStartup+12;bool airborne=false;
        while(TrackProgress<jump.Landing+3){
          if(Time.realtimeSinceStartup>limit)throw new Exception("Jump "+i+" failed to cross: "+TrackProgress);
          airborne|=TrackProgress>jump.Lip&&TrackProgress<jump.Landing&&!car.isGrounded&&rb.position.y>trackOrigin.y+2;
          yield return null;
        }
        autoDrive=false;trackRunupUntil=0;yield return new WaitForSecondsRealtime(1.8f);
        Require(airborne&&Ready&&car.isGrounded&&TrackProgress>jump.Landing,"additional_native_jump_"+i+"_crosses_and_lands");
      }
      qaReport["physical_jump_sections_tested"]=trackLayout.Jumps.Count;
    }
    IEnumerator CheckSlalomAndSwingContacts(){
      var bumpers=trackRoot.GetComponentsInChildren<TrackBumper>();var rb=Get<Rigidbody>(car,"rb");
      foreach(var kind in new[]{TrackObstacleKind.Slalom,TrackObstacleKind.Swing}){
        var obstacle=Array.Find(bumpers,b=>b.Kind==kind);if(!obstacle)throw new Exception("Missing obstacle "+kind);
        autoDrive=false;trackRunupUntil=0;trackImpactUntil=0;ResetEffects();MoveOnTrack(obstacle.TrackZ-15-TrackProgress);
        yield return new WaitForSecondsRealtime(1.6f);
        var trigger=obstacle.GetComponentInChildren<BoxCollider>();if(!trigger)throw new Exception("Missing trigger "+kind);
        car.SetPosAndRot(trigger.transform.TransformPoint(trigger.center),Quaternion.identity);rb.linearVelocity=Vector3.zero;Physics.SyncTransforms();
        yield return new WaitForSecondsRealtime(.2f);
        Require(trackImpactUntil>Time.unscaledTime&&rb.linearVelocity.z<0,"native_"+kind.ToString().ToLowerInvariant()+"_contact_pushes_back");
      }
    }
  }
}
