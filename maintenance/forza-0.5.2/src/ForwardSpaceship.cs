using Il2CppInterop.Runtime.InteropTypes.Arrays;
using System.Text.Json;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private sealed class ForwardRescue
    {
        public ViewerCar Entry;
        public GameObject Ship;
        public Transform[] Rotors;
        public LineRenderer[] Beams;
        public Material BeamMaterial;
        public float Age,Wait,NextAttempt,FlightFrom,FlightHeight;
        public bool Jumped;
        public bool Rocket,Preview;
        public Vector3 DisplayPosition,ShipPosition;
        public Quaternion DisplayRotation;
        public FMOD.Channel Audio;
    }
    private readonly Dictionary<ViewerCar,ForwardRescue> forwardRescues=new();
    private readonly List<Material> rescueMaterials=new();
    private VehicleModelData rescueModel,rocketModel;
    private FMOD.Sound rescueSound,rocketSound;
    private int completedRescues,completedRockets;
    private string rescueError;

    private Transform IdentityTransform(ViewerCar entry)
    {
        if(forwardRescues.TryGetValue(entry,out var rescue)&&rescue.Age>=ForwardRescueTiming.LiftAt&&entry.Visual?.Root!=null)
            return entry.Visual.Root.transform;
        return entry.Car.visualsRoot!=null?entry.Car.visualsRoot:entry.Car.transform;
    }
    private bool RescueControlsVisual(ViewerCar entry)=>forwardRescues.TryGetValue(entry,out var rescue)&&rescue.Age>=ForwardRescueTiming.LiftAt&&rescue.Age<ForwardRescueTiming.ReleaseAt;

    private GameObject CreateRescueShip(out Transform[] rotors,bool rocket=false)
    {
        if(rocket)rocketModel??=JsonSerializer.Deserialize<VehicleModelData>(File.ReadAllText(Path.Combine(PathsRoot,"assets","effects","forward-rocket.json")),jsonOptions);
        else rescueModel??=JsonSerializer.Deserialize<VehicleModelData>(File.ReadAllText(Path.Combine(PathsRoot,"assets","effects","forward-rescue.json")),jsonOptions)
            ??throw new InvalidOperationException("Uzay gemisi modeli okunamadi.");
        var data=rocket?rocketModel:rescueModel;
        var root=new GameObject(rocket?"TikMnG Twin Rocket":"TikMnG Rescue Manta");
        var pivots=new Dictionary<string,Transform>();
        try
        {
            foreach(var part in data.Parts)
            {
                if(!pivots.TryGetValue(part.Parent,out var pivot))
                {
                    var group=new GameObject(part.Parent);pivot=group.transform;pivot.SetParent(root.transform,false);
                    pivot.localPosition=new Vector3(part.Pivot[0],part.Pivot[1],part.Pivot[2]);pivots[part.Parent]=pivot;
                }
                // Nozzle pivots come from the model. Use the native game's transparent
                // flame rendering setup for the animated plume rather than solid hull faces.
                if(rocket&&part.Parent.StartsWith("flame",StringComparison.Ordinal))continue;
                var go=new GameObject(part.Name);go.transform.SetParent(pivot,false);
                go.AddComponent<MeshFilter>().sharedMesh=PartMesh(rocket?-101:-100,part);
                var material=new Material(VehicleShader()){name="TikMnG rescue "+part.Name};rescueMaterials.Add(material);
                var color=new Color(part.Color[0],part.Color[1],part.Color[2],1);
                foreach(var property in new[]{"_BaseColor","_Color"})if(material.HasProperty(property))material.SetColor(property,color);
                foreach(var property in new[]{"_BaseMap","_MainTex"})if(material.HasProperty(property))material.SetTexture(property,Texture2D.whiteTexture);
                if(material.HasProperty("_Metallic"))material.SetFloat("_Metallic",part.Name.EndsWith(":hull")?.8f:.35f);
                if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",.83f);
                if(material.HasProperty("_Cull"))material.SetFloat("_Cull",0);
                if(part.Name.EndsWith(":glow")||part.Name.EndsWith(":red")||part.Name.EndsWith(":flame")||part.Name.EndsWith(":core"))
                {
                    material.EnableKeyword("_EMISSION");
                    if(material.HasProperty("_EmissionColor"))material.SetColor("_EmissionColor",color*3);
                }
                go.AddComponent<MeshRenderer>().sharedMaterial=material;
            }
            rotors=pivots.Where(p=>p.Key.StartsWith(rocket?"flame":"rotor",StringComparison.Ordinal)).Select(p=>p.Value).ToArray();
            if(rocket)
            {
                PrepareFlameAssets();
                foreach(var nozzle in rotors)
                {
                    AddRocketPlume(nozzle,"Exhaust plume",new Vector3(1.18f,1.18f,3.55f),0);
                    AddRocketPlume(nozzle,"Exhaust core",new Vector3(.67f,.67f,2.4f),30);
                }
            }
            return root;
        }
        catch {UObj.Destroy(root);throw;}
    }
    private void AddRocketPlume(Transform nozzle,string name,Vector3 size,float roll)
    {
        var jet=new GameObject(name);jet.transform.SetParent(nozzle,false);
        jet.transform.localScale=size;jet.transform.localRotation=Quaternion.Euler(0,0,roll);
        jet.AddComponent<MeshFilter>().sharedMesh=flameMesh;
        var renderer=jet.AddComponent<MeshRenderer>();renderer.sharedMaterial=flameMaterial;
        renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;renderer.receiveShadows=false;
    }
    private void BeginForwardRescue(ViewerCar entry,bool rocket=false,bool preview=false)
    {
        if(forwardRescues.ContainsKey(entry)||forwardRescues.Count>=3)return;
        var ship=CreateRescueShip(out var rotors,rocket);
        var material=new Material(Shader.Find("Sprites/Default")??Shader.Find("Universal Render Pipeline/Unlit")??VehicleShader());
        var beams=new List<LineRenderer>();
        for(var i=0;i<(rocket?0:9);i++)
        {
            var go=new GameObject("Rescue tractor beam "+i);go.transform.SetParent(ship.transform,false);
            var line=go.AddComponent<LineRenderer>();line.sharedMaterial=material;line.useWorldSpace=true;
            line.positionCount=2;line.widthMultiplier=i==0?.22f:.045f;line.numCapVertices=3;
            line.startColor=new Color(.3f,1,1,.85f);line.endColor=new Color(.3f,.8f,1,.20f);
            line.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;line.receiveShadows=false;line.enabled=false;beams.Add(line);
        }
        var anchor=entry.Car.visualsRoot!=null?entry.Car.visualsRoot:entry.Car.transform;
        var rescue=new ForwardRescue{Entry=entry,Ship=ship,Rotors=rotors,Beams=beams.ToArray(),BeamMaterial=material,Rocket=rocket,Preview=preview,
            DisplayPosition=anchor.position,DisplayRotation=anchor.rotation};
        if(preview){PrepareForwardPath();rescue.FlightFrom=ForwardDistanceOf(entry.Car.transform.position);rescue.FlightHeight=entry.Car.transform.position.y;}
        forwardRescues.Add(entry,rescue);rescueError=null;
        PlayForwardEffect(rescue);
        forwardGiftMessage="@"+entry.Username+(rocket?" · Roketler geliyor":" · Uzay gemisi geliyor");
    }
    private void TickForwardRescues()
    {
        foreach(var rescue in forwardRescues.Values.ToArray())
        {
            var entry=rescue.Entry;
            if((!Running&&!rescue.Preview)||RoundTransitioning||!IsCarAlive(entry)||rescue.Ship==null||(rescue.Preview&&startRequested))
            {EndForwardRescue(rescue);continue;}
            UpdatePresentationChannel(ref rescue.Audio,"forward-effect",rescue.Rocket?.34f:.24f);
            rescue.Age+=Time.unscaledDeltaTime;
            if(rescue.Preview&&rescue.Age>=ForwardRescueTiming.JumpAt)rescue.Jumped=true;
            if(rescue.Age>=ForwardRescueTiming.JumpAt&&!rescue.Jumped)
            {
                rescue.Wait+=Time.unscaledDeltaTime;
                if(rescue.Wait>4){EndForwardRescue(rescue);nextForwardGift=Time.unscaledTime+1;continue;}
                if(Time.unscaledTime<rescue.NextAttempt){rescue.Age=ForwardRescueTiming.JumpAt-.001f;continue;}
                rescue.NextAttempt=Time.unscaledTime+.15f;
                var progress=CircuitSuperstars.RacerProgressManager.Instance;
                if(CircuitSuperstars.RaceManager.Instance?.RacerData?.IsFinished(entry.Id)??true)
                {EndForwardRescue(rescue);continue;}
                try
                {
                    PrepareForwardPath();
                    rescue.FlightFrom=ForwardDistanceOf(entry.Car.transform.position);
                    rescue.FlightHeight=entry.Car.transform.position.y;
                    rescue.Jumped=progress!=null&&TryForwardGift(entry,progress,rescue.Rocket);
                }
                catch(Exception ex){rescueError=ex.Message;forwardGiftMessage="Işınlanma bekliyor: "+ex.Message;}
                if(!rescue.Jumped)
                {
                    rescue.Age=ForwardRescueTiming.JumpAt-.001f;
                }
            }
            if(rescue.Age>=ForwardRescueTiming.EndAt){if(!rescue.Preview){if(rescue.Rocket)completedRockets++;else completedRescues++;}EndForwardRescue(rescue);}
        }
    }
    private void CaptureRescueModel(bool rocket=false)
    {
        if(view==null)return;
        var ship=CreateRescueShip(out _,rocket);var go=new GameObject("TikMnG transport model camera");
        var camera=go.AddComponent<Camera>();camera.CopyFrom(view);camera.enabled=false;camera.fieldOfView=38;
        ship.transform.position=view.transform.position+view.transform.forward*35+Vector3.up*7;
        ship.transform.rotation=Quaternion.Euler(0,view.transform.eulerAngles.y+145,0);
        camera.transform.position=ship.transform.position+ship.transform.forward*10+ship.transform.right*9+Vector3.up*8;
        camera.transform.LookAt(ship.transform.position);
        try {CaptureCameraImage(camera,1400,900,Path.Combine(PathsRoot,"assets","effects",rocket?"forward-rocket.png":"forward-rescue.png"));}
        finally
        {
            foreach(var renderer in ship.GetComponentsInChildren<MeshRenderer>())
            {var material=renderer.sharedMaterial;if(material!=null&&rescueMaterials.Remove(material))UObj.Destroy(material);}
            UObj.Destroy(ship);UObj.Destroy(go);
        }
    }
    private void UpdateForwardRescueVisuals()
    {
        foreach(var rescue in forwardRescues.Values)
        {
            var entry=rescue.Entry;if(!IsCarAlive(entry)||entry.Visual?.Root==null||rescue.Ship==null)continue;
            var native=entry.Car.visualsRoot!=null?entry.Car.visualsRoot:entry.Car.transform;
            var position=native.position;var rotation=native.rotation;var age=rescue.Age;
            if(rescue.Preview)
            {
                var requested=rescue.Rocket?settings.RocketGiftMetres:settings.ForwardGiftMetres;
                var progress=ForwardRescueTiming.Flight(age)*(1-ForwardRescueTiming.Smooth((age-ForwardRescueTiming.ReleaseAt)/(ForwardRescueTiming.EndAt-ForwardRescueTiming.ReleaseAt)));
                position=ForwardPoint(rescue.FlightFrom+requested*progress,rescue.FlightHeight,out rotation);
            }
            else if(rescue.Jumped&&age<ForwardRescueTiming.LandAt)
            {
                var flight=ForwardRescueTiming.Flight(age);
                var targetDistance=ForwardDistanceOf(native.position);
                position=ForwardPoint(rescue.FlightFrom+ForwardDelta(rescue.FlightFrom,targetDistance)*flight,
                    Mathf.Lerp(rescue.FlightHeight,native.position.y,flight),out rotation);
                rotation=Quaternion.Slerp(rescue.DisplayRotation,rotation,.22f);
            }
            position+=Vector3.up*ForwardRescueTiming.Lift(age)*(rescue.Rocket?.55f:1);
            rescue.DisplayPosition=position;rescue.DisplayRotation=rotation;
            if(age>=ForwardRescueTiming.LiftAt&&(age<ForwardRescueTiming.ReleaseAt||rescue.Preview))
                entry.Visual.Root.transform.SetPositionAndRotation(position,rotation);
            var approach=1-ForwardRescueTiming.Smooth(age/ForwardRescueTiming.LiftAt);
            var departure=ForwardRescueTiming.Smooth((age-ForwardRescueTiming.ReleaseAt)/(ForwardRescueTiming.EndAt-ForwardRescueTiming.ReleaseAt));
            rescue.ShipPosition=rescue.Rocket?position:position+Vector3.up*(5.8f+approach*16+departure*20)-rotation*Vector3.forward*(approach*11-departure*12);
            rescue.Ship.transform.SetPositionAndRotation(rescue.ShipPosition,rescue.Rocket?rotation:rotation*Quaternion.Euler(-approach*13+departure*18,0,Mathf.Sin(age*3)*2));
            foreach(var rotor in rescue.Rotors)
                if(rescue.Rocket)
                {
                    var ignition=.42f+.58f*ForwardRescueTiming.Smooth((age-.25f)/.60f);
                    var throttle=age<ForwardRescueTiming.ReleaseAt?ignition:ignition*(1-departure);
                    var flicker=Mathf.Sin(age*61+rotor.localPosition.x)*.15f+Mathf.Sin(age*37)*.08f;
                    rotor.localScale=new Vector3(.83f+.17f*throttle,.83f+.17f*throttle,Mathf.Max(.02f,throttle*(1+flicker)));
                }
                else rotor.localRotation=Quaternion.Euler(0,age*(rotor.name=="rotorL"?430:-430),0);
            for(var i=0;i<rescue.Beams.Length;i++)
            {
                var beam=rescue.Beams[i];beam.enabled=age>.35f&&age<ForwardRescueTiming.ReleaseAt;
                var angle=i*Mathf.PI/4+age*.8f;
                var rim=i==0?Vector3.zero:new Vector3(Mathf.Cos(angle)*1.25f,.1f,Mathf.Sin(angle)*2);
                beam.SetPosition(0,rescue.ShipPosition-Vector3.up*.65f);
                beam.SetPosition(1,position+rotation*rim+Vector3.up*.6f);
            }
        }
    }
    private void EndForwardRescue(ForwardRescue rescue)
    {
        StopPresentationChannel(ref rescue.Audio,"forward-effect");
        if(rescue.Entry.Visual?.Root!=null)
        {
            rescue.Entry.Visual.Root.transform.localPosition=Vector3.zero;
            rescue.Entry.Visual.Root.transform.localRotation=Quaternion.identity;
        }
        if(rescue.Ship!=null)
        {
            foreach(var renderer in rescue.Ship.GetComponentsInChildren<MeshRenderer>())
            {var material=renderer.sharedMaterial;if(material!=null&&rescueMaterials.Remove(material))UObj.Destroy(material);}
            UObj.Destroy(rescue.Ship);
        }
        if(rescue.BeamMaterial!=null)UObj.Destroy(rescue.BeamMaterial);
        forwardRescues.Remove(rescue.Entry);
    }
    private void ClearForwardRescues()
    {
        foreach(var rescue in forwardRescues.Values.ToArray())EndForwardRescue(rescue);
        foreach(var material in rescueMaterials)if(material!=null)UObj.Destroy(material);
        rescueMaterials.Clear();
    }
    private void PlayForwardEffect(ForwardRescue rescue)
    {
    }
    private void DisposeForwardEffectAudio()
    {
        if(rescueSound.hasHandle()){rescueSound.release();rescueSound.clearHandle();}
        if(rocketSound.hasHandle()){rocketSound.release();rocketSound.clearHandle();}
    }
    private object ForwardRescueStatus()=>new{model="TikMnG Rescue Manta",active=forwardRescues.Count,completed=completedRescues,completedRockets,error=rescueError,
        rescues=forwardRescues.Values.Select(r=>new{username=r.Entry.Username,kind=r.Rocket?"rocket":"spaceship",preview=r.Preview,age=r.Age,phase=ForwardRescueTiming.Phase(r.Age),jumped=r.Jumped,
            audioPlaying=r.Audio.hasHandle()&&r.Audio.isPlaying(out var playing)==FMOD.RESULT.OK&&playing,
            lift=ForwardRescueTiming.Lift(r.Age),position=new{x=r.DisplayPosition.x,y=r.DisplayPosition.y,z=r.DisplayPosition.z},
            ship=new{x=r.ShipPosition.x,y=r.ShipPosition.y,z=r.ShipPosition.z},rotors=r.Rotors.Length,beams=r.Beams.Count(b=>b.enabled)}).ToArray()};
}
