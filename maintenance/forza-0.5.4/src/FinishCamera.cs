using CircuitSuperstars;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private Camera finishCamera;
    private RenderTexture finishFeed;
    private GUIStyle finishCaption;
    private bool finishFeedActive,finishCameraFaulted;
    private float nextFinishProbe,nextFinishFrame,finishCameraOpenedMetres;

    private void UpdateFinishCamera()
    {
        if(!Running||view==null||finishCameraFaulted)return;
        var now=Time.unscaledTime;
        try
        {
            if(!finishFeedActive&&now>=nextFinishProbe)
            {
                nextFinishProbe=now+.25f;
                var progress=RacerProgressManager.Instance;
                var data=RaceManager.Instance?.RacerData;
                if(progress==null||data==null)return;
                var leaderDistance=float.PositiveInfinity;
                foreach(var entry in entries)
                {
                    if(!IsCarAlive(entry)||CurrentLap(entry)!=settings.Laps||
                        !progress.HasStartedLap(entry.Id)||data.IsFinished(entry.Id))continue;
                    PrepareForwardPath();
                    var racerIndex=progress.participantIds.IndexOf(entry.Id);
                    if(racerIndex<0||racerIndex>=progress.lastCheckpoints.Count||progress.lastCheckpoints[racerIndex]<1)continue;
                    leaderDistance=Mathf.Min(leaderDistance,
                        ForwardDelta(ForwardDistanceOf(entry.Car.transform.position),forwardFinish));
                }
                if(leaderDistance<=200)
                {
                    var go=new GameObject("TikMnG finish line camera");
                    finishCamera=go.AddComponent<Camera>();
                    finishCamera.CopyFrom(view);
                    finishCamera.enabled=false;
                    finishCamera.allowHDR=false;finishCamera.allowMSAA=false;
                    finishCamera.nearClipPlane=.25f;finishCamera.fieldOfView=73;
                    // Fixed Tsukuba grandstand viewpoint, across the finish line toward the pits.
                    finishCamera.transform.position=new Vector3(236.15f,19.56f,307.38f);
                    finishCamera.transform.rotation=Quaternion.LookRotation(new Vector3(-.5002f,-.2083f,-.8405f));
                    finishFeed=new RenderTexture(640,360,24){name="TikMnG finish line"};
                    finishCamera.targetTexture=finishFeed;
                    finishCamera.aspect=16f/9;
                    finishFeedActive=true;
                    finishCameraOpenedMetres=leaderDistance;
                }
            }
            if(!finishFeedActive||showPanel||trackMapOpen||now<nextFinishFrame)return;
            nextFinishFrame=now+.067f;
            finishCamera.Render();
        }
        catch(Exception ex)
        {
            ClearFinishCamera();
            finishCameraFaulted=true;
            Plugin.Output.LogWarning("Finish camera: "+ex.Message);
        }
    }

    private bool DrawFinishCamera(float scale)
    {
        if(!finishFeedActive||finishFeed==null)return false;
        const float width=430,height=width*9/16;
        var right=1280+(Screen.width/scale-1280)*.5f;
        var bottom=800+(Screen.height/scale-800)*.5f;
        var frame=new Rect(right-width-11,bottom-height-11,width,height);
        GUI.DrawTexture(frame,finishFeed,ScaleMode.StretchToFill,false);
        finishCaption??=new GUIStyle(hudCaption){fontSize=12,wordWrap=false,alignment=TextAnchor.MiddleLeft};
        HudText(new Rect(frame.x,frame.y-22,frame.width,20),"Bitiş kamerası",finishCaption);
        return true;
    }

    private void ClearFinishCamera()
    {
        finishFeedActive=false;finishCameraFaulted=false;
        nextFinishProbe=0;nextFinishFrame=0;finishCameraOpenedMetres=0;
        if(finishCamera!=null){finishCamera.targetTexture=null;UObj.Destroy(finishCamera.gameObject);}
        if(finishFeed!=null){finishFeed.Release();UObj.Destroy(finishFeed);}
        finishCamera=null;finishFeed=null;
    }
}
