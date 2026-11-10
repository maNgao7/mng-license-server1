using CircuitSuperstars;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private readonly Dictionary<IntPtr,float> passingOffsets=new();
    public void ApplyPassingTargets(RacerAiManager manager)
    {
        if(!Running||manager==null)return;
        var range=manager.updatingIndexRange;
        for(var i=range.start;i<Math.Min(range.end,manager.allIds.Count);i++)
        {
            var car=manager.GetAutomobile(i);
            if(car==null)continue;
            var entry=entries.FirstOrDefault(e=>IsCarAlive(e)&&e.Car.Pointer==car.Pointer);
            if(entry==null)continue;
            var target=manager.allDriveTargets[i];
            if(target.isStop)continue;
            var forward=target.targetSteerForward.normalized;
            var right=new Vector2(forward.y,-forward.x);
            var origin=new Vector2(car.transform.position.x,car.transform.position.z);
            var requested=0f;
            foreach(var other in entries)
            {
                if(other==entry||!IsCarAlive(other)||entry.TopSpeedKph<=other.TopSpeedKph+2)continue;
                var delta=new Vector2(other.Car.transform.position.x,other.Car.transform.position.z)-origin;
                var ahead=Vector2.Dot(delta,forward);
                if(ahead< -4||ahead>Mathf.Clamp(car.Speed*1.8f,18,65)||Mathf.Abs(Vector2.Dot(delta,right))>3.2f)continue;
                var leftRoom=Mathf.Max(0,target.maxOffsetLeft-1.1f);
                var rightRoom=Mathf.Max(0,target.maxOffsetRight-1.1f);
                requested=rightRoom>=leftRoom?Mathf.Min(3.2f,rightRoom):-Mathf.Min(3.2f,leftRoom);
                break;
            }
            var offset=Mathf.MoveTowards(passingOffsets.GetValueOrDefault(car.Pointer),requested,Time.fixedDeltaTime*3.5f);
            // Native AI owns steering and speed. Adjust only its bounded lane target.
            offset=Mathf.Clamp(offset,-Mathf.Max(0,target.maxOffsetLeft-1.1f),Mathf.Max(0,target.maxOffsetRight-1.1f));
            passingOffsets[car.Pointer]=offset;
            target.targetSteerPosition+=right*offset;
            var direction=target.targetSteerPosition-origin;
            target.directionToSteerTarget=direction.normalized;
            target.distanceToSteerTarget=direction.magnitude;
            manager.allDriveTargets[i]=target;
        }
    }
}
