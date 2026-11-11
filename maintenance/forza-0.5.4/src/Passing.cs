using CircuitSuperstars;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private sealed class PassingState
    {
        public float Offset,FlashStarted,FlashUntil,NextFlash;
        public Vector2 LastTarget,LastShift;
        public bool HasTarget;
        public Light Lamp;
    }
    private readonly Dictionary<IntPtr,PassingState> passingOffsets=new();
    private readonly List<(ViewerCar Entry,Vector2 Position)> passingTraffic=new();

    public void ApplyPassingTargets(RacerAiManager manager)
    {
        if(!Running||manager==null)return;
        passingTraffic.Clear();
        var race=RaceManager.Instance?.RacerData;
        foreach(var entry in entries)
        {
            if(!IsCarAlive(entry)||race?.IsFinished(entry.Id)==true)continue;
            var position=entry.Car.transform.position;
            passingTraffic.Add((entry,new Vector2(position.x,position.z)));
        }
        var range=manager.updatingIndexRange;
        for(var i=range.start;i<Math.Min(range.end,manager.allIds.Count);i++)
        {
            var car=manager.GetAutomobile(i);
            if(car==null)continue;
            var entry=passingTraffic.Find(v=>v.Entry.Car.Pointer==car.Pointer).Entry;
            if(entry==null)continue;
            var target=manager.allDriveTargets[i];
            if(target.isStop||target.targetSteerForward.sqrMagnitude<.01f)continue;
            if(!passingOffsets.TryGetValue(car.Pointer,out var state))
                passingOffsets[car.Pointer]=state=new PassingState();
            var forward=target.targetSteerForward.normalized;
            var right=new Vector2(forward.y,-forward.x);
            var origin=new Vector2(car.transform.position.x,car.transform.position.z);
            if(state.HasTarget&&(target.targetSteerPosition-state.LastTarget).sqrMagnitude<.000001f)
                target.targetSteerPosition-=state.LastShift;
            var left=Mathf.Min(3.3f,Mathf.Max(0,target.maxOffsetLeft-.95f));
            var rightRoom=Mathf.Min(3.3f,Mathf.Max(0,target.maxOffsetRight-.95f));
            var intended=Vector2.Dot(target.targetSteerPosition-origin,right);
            var leftClearance=left;var rightClearance=rightRoom;
            var hasSlowerCar=false;
            var lookAhead=Mathf.Clamp(Mathf.Abs(car.Speed)*1.65f,17,55);
            foreach(var traffic in passingTraffic)
            {
                var other=traffic.Entry;
                if(other==entry)continue;
                var delta=traffic.Position-origin;
                var ahead=Vector2.Dot(delta,forward);
                if(ahead< -7||ahead>lookAhead)continue;
                var lateral=Vector2.Dot(delta,right)-intended;
                if(Mathf.Abs(lateral)<2.6f&&entry.TopSpeedKph>other.TopSpeedKph+4)hasSlowerCar=true;
                if(ahead>lookAhead*.8f)continue;
                leftClearance=Mathf.Min(leftClearance,Mathf.Abs(lateral+left));
                rightClearance=Mathf.Min(rightClearance,Mathf.Abs(lateral-rightRoom));
            }
            var requested=0f;
            if(hasSlowerCar)
            {
                var preference=state.Offset*.25f;
                if(left>=1.8f||rightRoom>=1.8f)
                    requested=rightRoom>=1.8f&&(left<1.8f||rightClearance+preference>=leftClearance)?rightRoom:-left;
                StartPassingFlash(entry,state);
            }
            state.Offset=Mathf.Clamp(Mathf.MoveTowards(state.Offset,requested,Time.fixedDeltaTime*4.2f),-left,rightRoom);
            state.LastShift=right*state.Offset;
            target.targetSteerPosition+=state.LastShift;
            state.LastTarget=target.targetSteerPosition;state.HasTarget=true;
            var direction=target.targetSteerPosition-origin;
            target.directionToSteerTarget=direction.normalized;
            target.distanceToSteerTarget=direction.magnitude;
            manager.allDriveTargets[i]=target;
        }
    }

    private void StartPassingFlash(ViewerCar entry,PassingState state)
    {
        var now=Time.unscaledTime;
        if(now<state.NextFlash||now>entry.SpeedGiftFlashUntil)return;
        state.FlashStarted=now;state.FlashUntil=now+1.8f;state.NextFlash=now+4f;
    }

    private void UpdatePassingLights()
    {
        var now=Time.unscaledTime;
        var active=0;
        foreach(var entry in entries)
        {
            if(!IsCarAlive(entry)||!passingOffsets.TryGetValue(entry.Car.Pointer,out var state))continue;
            var on=Running&&now<state.FlashUntil&&(now-state.FlashStarted)%.6f<.24f&&active<3;
            if(on&&state.Lamp==null)
            {
                var lamp=new GameObject("TikMnG passing headlights");
                lamp.transform.SetParent(entry.Car.transform,false);
                lamp.transform.localPosition=new Vector3(0,.65f,2.1f);
                lamp.transform.localRotation=Quaternion.Euler(5,0,0);
                state.Lamp=lamp.AddComponent<Light>();
                state.Lamp.type=LightType.Spot;state.Lamp.shadows=LightShadows.None;
                state.Lamp.range=27;state.Lamp.spotAngle=58;state.Lamp.intensity=14;
                state.Lamp.color=new Color(1,.96f,.84f);
            }
            if(state.Lamp!=null)state.Lamp.enabled=on;
            if(on)active++;
        }
    }
}
