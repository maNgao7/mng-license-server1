using CircuitSuperstars;
using CircuitSuperstars.TrackData;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private Vector2[] speedPath=Array.Empty<Vector2>();
    private float nextSpeedUpdate;
    private float DistanceFromRacingLine(ViewerCar entry)
    {
        if(!IsCarAlive(entry)||speedPath.Length==0)return 0;
        var p=entry.Car.transform.position;var point=new Vector2(p.x,p.z);
        var best=float.MaxValue;
        foreach(var marker in speedPath)best=Mathf.Min(best,(point-marker).sqrMagnitude);
        return Mathf.Sqrt(best);
    }
    private void AddUpgradeOutline(VehicleModelInstance model,VehicleModelData data)
    {
        model.OutlineMaterial=new Material(Shader.Find("Universal Render Pipeline/Unlit")??VehicleShader());
        foreach(var side in new[]{-1,1})
        {
            var go=new GameObject("TikMnG rear speed accent");go.transform.SetParent(model.Root.transform,false);
            var line=go.AddComponent<LineRenderer>();
            model.UpgradeOutline??=line;model.SpeedAccents.Add(line);
            line.sharedMaterial=model.OutlineMaterial;line.useWorldSpace=false;line.loop=false;
            line.widthMultiplier=.04f;line.numCornerVertices=2;line.numCapVertices=3;
            line.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;line.receiveShadows=false;
            line.positionCount=3;
            line.SetPosition(0,new Vector3(side*data.Width*.37f,.24f,-data.Length/2+.2f));
            line.SetPosition(1,new Vector3(side*data.Width*.40f,.24f,-data.Length/2-.12f));
            line.SetPosition(2,new Vector3(side*data.Width*.46f,.20f,-data.Length/2-.55f));
            line.enabled=false;
        }
    }
    private void UpdateUpgradeFeedback(ViewerCar entry)
    {
        var model=entry.Visual;if(model?.Root==null)return;
        var intensity=Mathf.InverseLerp(50,RaceEconomy.MaximumKph,entry.TopSpeedKph);
        var color=Color.Lerp(new Color(1,.85f,.12f),new Color(1,.08f,.04f),intensity);
        foreach(var line in model.SpeedAccents)
        {
            line.enabled=entry.UpgradePulseUntil>Time.unscaledTime||(Running&&entry.Acceleration>.5f&&entry.TopSpeedKph>80);
            line.startColor=color;line.endColor=new Color(color.r,color.g,color.b,.15f);
            foreach(var name in new[]{"_BaseColor","_Color"})if(model.OutlineMaterial.HasProperty(name))model.OutlineMaterial.SetColor(name,color);
        }
        // Upgrade pulse affects only the cosmetic mesh, never the chassis or camera.
        if(RescueControlsVisual(entry))return;
        var pulse=Mathf.Clamp01((entry.UpgradePulseUntil-Time.unscaledTime)/.65f);
        var idle=!Running&&!RoundTransitioning?Mathf.Lerp(.12f,.65f,intensity):0;
        var vibration=Mathf.Max(pulse,idle);
        var t=Time.unscaledTime+entry.Slot*.37f;
        model.Root.transform.localPosition=new Vector3(Mathf.Sin(t*55)*.012f*vibration,Mathf.Sin(t*43)*.006f*vibration,0);
        model.Root.transform.localRotation=Quaternion.Euler(0,0,Mathf.Sin(t*45)*.3f*vibration);
        var scale=1+.035f*Mathf.Sin((1-pulse)*Mathf.PI)*pulse;
        model.Root.transform.localScale=Vector3.one*scale;
    }
    private void UpdateSafeRaceSpeed()
    {
        if(!Running||nativeChassisTest||Time.unscaledTime<nextSpeedUpdate)return;
        nextSpeedUpdate=Time.unscaledTime+.1f;
        if(speedPath.Length==0)
        {
            speedPath=SampleWorldRacingLine(512);
        }
        foreach(var entry in entries.Where(e=>e.EconomyManaged&&IsCarAlive(e)))
        {
            var car=entry.Car;var position=new Vector2(car.transform.position.x,car.transform.position.z);
            var nearest=0;var distance=float.MaxValue;
            for(var i=0;i<speedPath.Length;i++)
            {var d=(speedPath[i]-position).sqrMagnitude;if(d<distance){distance=d;nearest=i;}}
            var pace=Mathf.InverseLerp(50,100,settings.CornerPacePercent);
            var lateralAcceleration=Mathf.Lerp(12,37,pace);
            var brakingAcceleration=Mathf.Lerp(10,20,pace);
            var topSpeed=entry.TopSpeedKph/3.6f;
            var minimumCornerSpeed=Mathf.Min(topSpeed,Mathf.Lerp(10.5f,17,pace));
            var target=topSpeed;
            var travelled=0f;
            var horizon=Mathf.Max(36,car.Speed*car.Speed/(2*brakingAcceleration)+car.Speed*.45f);
            for(var step=0;step<speedPath.Length/2&&travelled<horizon;step++)
            {
                var i=(nearest+step)%speedPath.Length;
                var a=speedPath[i];var b=speedPath[(i+4)%speedPath.Length];var c=speedPath[(i+8)%speedPath.Length];
                var ab=b-a;var bc=c-b;var ac=c-a;
                var denominator=ab.magnitude*bc.magnitude*ac.magnitude;
                var curvature=denominator>.001f?Mathf.Abs(ab.x*ac.y-ab.y*ac.x)*2/denominator:0;
                var cornerSpeed=Mathf.Sqrt(lateralAcceleration/Mathf.Max(.00001f,curvature));
                target=Mathf.Min(target,Mathf.Sqrt(cornerSpeed*cornerSpeed+2*brakingAcceleration*travelled));
                travelled+=(speedPath[(i+1)%speedPath.Length]-a).magnitude;
            }
            // Let the native AI brake/steer. Never force velocity or teleport around curves.
            car.aiSettings.targetSpeed=Mathf.Clamp(target,minimumCornerSpeed,RaceEconomy.MaximumPhysicalKph/3.6f);
        }
    }
}
