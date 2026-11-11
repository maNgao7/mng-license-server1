using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private ViewerCar joinShowcase,pendingJoinShowcase,celebrationWinner;
    private float joinShowcaseAt,winnerOrbitAt,winnerOrbitAngle;
    private Vector3 showcaseReturnPosition;
    private Quaternion showcaseReturnRotation;
    private Vector3 winnerApproachStart;
    private Quaternion winnerApproachRotation;
    private float winnerApproachFov,winnerApproachSeconds,winnerApproachLift,winnerCameraBlend;
    private const float WinnerOrbitFov=48;
    private GameObject winnerCrown;
    private Mesh winnerCrownMesh;
    private Material crownGold,crownRuby;
    private bool JoinCameraAllowed=>CameraPresentationPolicy.AllowJoin(phase,startRequested,followed!=null,showPanel||quickSettingsOpen||trackMapOpen,IntroActive);

    private void QueueJoinShowcase(ViewerCar entry)
    {
        if(JoinCameraAllowed)pendingJoinShowcase=entry;
    }
    private void CancelJoinShowcase(bool restore)
    {
        if(restore&&joinShowcase!=null&&view!=null)
        {
            view.transform.SetPositionAndRotation(showcaseReturnPosition,showcaseReturnRotation);
            yaw=view.transform.eulerAngles.y;pitch=view.transform.eulerAngles.x;
        }
        joinShowcase=null;pendingJoinShowcase=null;
    }
    private void UpdateCinematicCamera()
    {
        if(view==null)return;
        if(phase=="podium"&&IsCarAlive(celebrationWinner))
        {
            var car=IdentityTransform(celebrationWinner);
            var elapsed=Time.realtimeSinceStartup-winnerOrbitAt;
            var orbitTime=Mathf.Max(0,elapsed-winnerApproachSeconds);
            const float spinUp=.45f;
            var travel=orbitTime<spinUp?orbitTime*orbitTime/(2*spinUp):orbitTime-spinUp*.5f;
            var angle=winnerOrbitAngle+travel*.34f;
            var target=car.position+Vector3.up*2.1f;
            var orbit=car.position+new Vector3(Mathf.Sin(angle)*8.2f,3.8f,Mathf.Cos(angle)*8.2f);
            var rotation=Quaternion.LookRotation(target-orbit);
            winnerCameraBlend=Mathf.SmoothStep(0,1,Mathf.Clamp01(elapsed/winnerApproachSeconds));
            var lift=Vector3.up*(4*winnerCameraBlend*(1-winnerCameraBlend)*winnerApproachLift);
            view.fieldOfView=Mathf.Lerp(winnerApproachFov,WinnerOrbitFov,winnerCameraBlend);
            view.transform.SetPositionAndRotation(Vector3.Lerp(winnerApproachStart,orbit,winnerCameraBlend)+lift,
                Quaternion.Slerp(winnerApproachRotation,rotation,winnerCameraBlend));
            if(winnerCrown!=null)
            {
                winnerCrown.transform.position=car.position+Vector3.up*(2.8f+Mathf.Sin(elapsed*2)*.09f);
                winnerCrown.transform.rotation=Quaternion.Euler(0,elapsed*28,0);
            }
            return;
        }
        if(!JoinCameraAllowed){CancelJoinShowcase(false);return;}
        if(joinShowcase==null&&IsCarAlive(pendingJoinShowcase))
        {
            joinShowcase=pendingJoinShowcase;pendingJoinShowcase=null;
            joinShowcaseAt=Time.realtimeSinceStartup;
            showcaseReturnPosition=view.transform.position;showcaseReturnRotation=view.transform.rotation;
        }
        if(!IsCarAlive(joinShowcase)){joinShowcase=null;return;}
        var t=Time.realtimeSinceStartup-joinShowcaseAt;
        if(t>=CameraPresentationPolicy.JoinSeconds){CancelJoinShowcase(true);return;}
        var model=IdentityTransform(joinShowcase);
        var approach=model.position-model.forward*6.8f+model.right*4.5f+Vector3.up*2.9f;
        var angleToCar=Quaternion.LookRotation(model.position+Vector3.up*.9f-approach);
        var blend=t<.55f?Mathf.SmoothStep(0,1,t/.55f):t>1.65f?1-Mathf.SmoothStep(0,1,(t-1.65f)/.75f):1;
        view.transform.SetPositionAndRotation(Vector3.Lerp(showcaseReturnPosition,approach,blend),Quaternion.Slerp(showcaseReturnRotation,angleToCar,blend));
    }
    private void BeginWinnerCelebration(ViewerCar winner)
    {
        CancelJoinShowcase(false);
        celebrationWinner=winner;winnerOrbitAt=Time.realtimeSinceStartup;
        var car=IdentityTransform(winner);
        winnerApproachStart=view.transform.position;
        winnerApproachRotation=view.transform.rotation;
        winnerApproachFov=view.fieldOfView;
        var offset=winnerApproachStart-car.position;
        winnerOrbitAngle=Mathf.Atan2(offset.x,offset.z);
        winnerApproachSeconds=Mathf.Lerp(1.1f,2.2f,Mathf.InverseLerp(12,160,offset.magnitude));
        winnerApproachLift=Mathf.Clamp(offset.magnitude*.13f,0,28);
        winnerCameraBlend=0;
        CreateWinnerCrown();
    }
    private void DrawWinnerIdentity(float scale)
    {
        if(view==null||winnerCrown==null||!IsCarAlive(celebrationWinner)||winnerCameraBlend<.65f)return;
        var point=view.WorldToScreenPoint(winnerCrown.transform.position+Vector3.up*1.35f);
        if(point.z<=0)return;
        var x=(point.x-(Screen.width-1280*scale)/2)/scale;
        var y=(Screen.height-point.y-(Screen.height-800*scale)/2)/scale;
        if(x<0||x>1280||y<0||y>800)return;
        DrawPortrait(celebrationWinner,new Rect(x-22,y-71,44,44));
        HudText(new Rect(x-130,y-26,260,23),celebrationWinner.Username.TrimStart('@'),hudName);
    }
    private void CreateWinnerCrown()
    {
        winnerCrown=new GameObject("TikMnG winner crown (visual only)");
        var vertices=new List<Vector3>();var gold=new List<int>();var ruby=new List<int>();
        void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d)
        {
            var i=vertices.Count;
            // Use separate vertices on either side so RecalculateNormals does not cancel them.
            vertices.AddRange(new[]{a,b,c,d,a,b,c,d});
            gold.AddRange(new[]{i,i+1,i+2,i,i+2,i+3,i+6,i+5,i+4,i+7,i+6,i+4});
        }
        const int segments=48;
        for(var i=0;i<segments;i++)
        {
            var a=i*Mathf.PI*2/segments;var b=(i+1)*Mathf.PI*2/segments;
            Vector3 Ring(float angle,float y)=>new(Mathf.Cos(angle)*1.2f,y,Mathf.Sin(angle)*1.2f);
            Quad(Ring(a,0),Ring(b,0),Ring(b,.34f),Ring(a,.34f));
            // Eight sharp, broad points rising from a rounded gold headband.
            var topA=.50f+(i%6==3?.72f:0);var topB=.50f+((i+1)%6==3?.72f:0);
            Quad(Ring(a,.29f),Ring(b,.29f),Ring(b,topB),Ring(a,topA));
        }
        for(var gem=0;gem<8;gem++)
        {
            var a=(gem+.5f)*Mathf.PI/4;var center=new Vector3(Mathf.Cos(a)*1.23f,.22f,Mathf.Sin(a)*1.23f);
            var tangent=new Vector3(-Mathf.Sin(a),0,Mathf.Cos(a))*.13f;
            var normal=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*.12f;
            var i=vertices.Count;
            vertices.AddRange(new[]{center+Vector3.up*.18f,center+tangent,center-Vector3.up*.18f,center-tangent,center+normal});
            ruby.AddRange(new[]{i,i+1,i+4,i+1,i+2,i+4,i+2,i+3,i+4,i+3,i,i+4});
        }
        winnerCrownMesh=new Mesh{name="Winner gold crown and ruby jewels"};
        winnerCrownMesh.vertices=vertices.ToArray();winnerCrownMesh.subMeshCount=2;
        winnerCrownMesh.SetTriangles(gold.ToArray(),0);winnerCrownMesh.SetTriangles(ruby.ToArray(),1);winnerCrownMesh.RecalculateNormals();winnerCrownMesh.RecalculateBounds();
        var shader=VehicleShader();
        crownGold=new Material(shader){name="Winner warm gold",color=new Color(1,.64f,.09f)};
        crownGold.SetFloat("_Metallic",.22f);crownGold.SetFloat("_Smoothness",.40f);
        crownRuby=new Material(shader){name="Winner ruby",color=new Color(.76f,.012f,.055f)};
        crownRuby.SetFloat("_Metallic",.25f);crownRuby.SetFloat("_Smoothness",.9f);
        winnerCrown.AddComponent<MeshFilter>().sharedMesh=winnerCrownMesh;
        winnerCrown.AddComponent<MeshRenderer>().sharedMaterials=new[]{crownGold,crownRuby};
        winnerCrown.transform.position=IdentityTransform(celebrationWinner).position+Vector3.up*2.8f;
    }
    private void ClearCinematicCamera()
    {
        CancelJoinShowcase(false);celebrationWinner=null;
        if(winnerCrown!=null){winnerCrown.SetActive(false);UObj.Destroy(winnerCrown);}winnerCrown=null;
        if(winnerCrownMesh!=null)UObj.Destroy(winnerCrownMesh);winnerCrownMesh=null;
        if(crownGold!=null)UObj.Destroy(crownGold);crownGold=null;
        if(crownRuby!=null)UObj.Destroy(crownRuby);crownRuby=null;
    }
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private object CameraPresentationStatus()=>new{mode=phase=="podium"&&celebrationWinner!=null?"winner-orbit":joinShowcase!=null?"join-showcase":"manual",showcaseUser=joinShowcase?.Username,winner=celebrationWinner?.Username,
        transitionBlend=winnerCameraBlend,transitionSeconds=winnerApproachSeconds,
        winnerHasPortrait=celebrationWinner!=null&&Portrait(celebrationWinner)!=null,
        crownVisible=winnerCrown!=null,crownColliders=winnerCrown==null?0:winnerCrown.GetComponentsInChildren<Collider>().Length};
}
