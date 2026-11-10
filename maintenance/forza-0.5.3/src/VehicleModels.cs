using Il2CppInterop.Runtime.InteropTypes.Arrays;
using System.Text.Json;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed class VehiclePartData
{
    public string Name {get;set;}="";
    public string Parent {get;set;}="body";
    public float[] Pivot {get;set;}=new float[3];
    public float[] Color {get;set;}=new float[3];
    public float[] Vertices {get;set;}=Array.Empty<float>();
    public float[] Normals {get;set;}=Array.Empty<float>();
    public int[] Triangles {get;set;}=Array.Empty<int>();
    public float[] Uv {get;set;}=Array.Empty<float>();
}
public sealed class VehicleModelData
{
    public string Id {get;set;}="";
    public string Name {get;set;}="";
    public float Power {get;set;}
    public float WheelRadius {get;set;}
    public float Length {get;set;}
    public float Width {get;set;}
    public VehiclePartData[] Parts {get;set;}=Array.Empty<VehiclePartData>();
}
public sealed class VehicleModelInstance
{
    public GameObject Root;
    public Renderer[] OriginalRenderers;
    public List<Transform> Wheels=new();
    public int Level;
    public float Angle;
    public List<Transform> Flames=new();
    public float FlameIntensity;
    public Collider CollisionBody;
    public LineRenderer UpgradeOutline;
    public Material OutlineMaterial;
    public Material RearWindowMaterial;
    public List<LineRenderer> SpeedAccents=new();
}

public sealed partial class ArcadeDirector
{
    private static readonly string[] ModelIds={"murat131","sahin","clio4","egea","civic","gtr","bmw","gclass","lotus","ferrari","formula"};
    private static readonly string[] ModelNames={"Murat 131","Tofaş Doğan SLX","Renault Clio 4","Fiat Egea","Honda Civic","Nissan GT-R","BMW M4","Mercedes G Kasa","Lotus Emira","Ferrari SF90","Formula 1 Concept"};
    private static readonly float[] ModelPowers={.65f,.74f,.84f,.94f,1.04f,1.13f,1.22f,1.30f,1.38f,1.47f,1.58f};
    private static readonly float[] ModelTargetSpeeds={50/3.6f,70/3.6f,80/3.6f,110/3.6f,200/3.6f,300/3.6f,400/3.6f,500/3.6f,700/3.6f,1000/3.6f,1500/3.6f};
    private static int MaxVehicleLevel=>ModelIds.Length-1;
    private readonly Dictionary<int,VehicleModelData> modelData=new();
    private readonly Dictionary<string,Mesh> modelMeshes=new();
    private readonly Dictionary<string,Material> modelMaterials=new();
    private readonly Dictionary<string,Texture2D> modelTextures=new();
    private Shader vehicleShader;
    private string vehicleShaderName="pending";
    private void SpawnModelFleet()
    {
        if(!cameraReady||Running||startRequested||RoundTransitioning)return;
        for(var i=0;i<ModelIds.Length;i++)
        {
            var username="model_"+ModelIds[i];
            if(!entries.Any(e=>e.Username==username)&&!AddViewerCar(username,ModelNames[i],testPortrait:true))break;
            var entry=entries.FirstOrDefault(e=>e.Username==username);
            if(entry==null)break;
            entry.AudienceSpeed=RaceEconomy.ModelSpeeds[i]-50;entry.Coins=0;
            ApplyEconomy(entry);
        }
    }
    private System.Collections.IEnumerator CaptureModelPreviews()
    {
        if(Running)yield break;
        var entry=entries.FirstOrDefault();if(entry==null)yield break;
        var previous=entry.Level;
        for(var i=0;i<ModelIds.Length;i++)
        {
            if(Running)break;
            SetLevel(entry,i);
            yield return new WaitForSecondsRealtime(.25f);
            CaptureVehicleThumbnail("vehicles/"+ModelIds[i]+".png");
        }
        SetLevel(entry,previous);
        Plugin.Output.LogInfo(ModelIds.Length+" reference-based model previews captured; race remains user-controlled.");
    }
    private System.Collections.IEnumerator CaptureNativeVehicleGallery()
    {
        if(Running)yield break;
        var entry=entries.FirstOrDefault();if(entry==null)yield break;
        var directory=Path.Combine(control,"native-vehicles");Directory.CreateDirectory(directory);
        var previous=entry.Level;
        try
        {
            for(var i=0;i<ModelIds.Length&&!Running;i++)
            {
                SetLevel(entry,i);yield return new WaitForSecondsRealtime(.2f);
                CaptureVehicleThumbnail("../control/native-vehicles/"+ModelIds[i]+"-front.png");
                CaptureVehicleThumbnail("../control/native-vehicles/"+ModelIds[i]+"-rear.png",true);
            }
        }
        finally {if(IsCarAlive(entry))SetLevel(entry,previous);}
        File.WriteAllText(Path.Combine(directory,"report.json"),JsonSerializer.Serialize(new{
            pid=Environment.ProcessId,utc=DateTime.UtcNow,shader=vehicleShaderName,ids=ModelIds,
            normalStartupStartsRace=false,description="Native camera-rendered body and make decal previews, not offline mesh artwork."
        },jsonOptions));
    }
    private VehicleModelData LoadVehicleModel(int level)
    {
        if(modelData.TryGetValue(level,out var data))return data;
        var file=Path.Combine(PathsRoot,"assets","vehicles",ModelIds[level]+".json");
        data=JsonSerializer.Deserialize<VehicleModelData>(File.ReadAllText(file),jsonOptions)??throw new InvalidOperationException("Arac modeli okunamadi.");
        if(data.Parts.Length==0 || data.Parts.Length>64)throw new InvalidOperationException("Arac geometrisi gecersiz.");
        modelData[level]=data;return data;
    }
    private Shader VehicleShader()
    {
        if(vehicleShader!=null)return vehicleShader;
        foreach(var name in new[]{"Universal Render Pipeline/Lit","Universal Render Pipeline/Simple Lit","Universal Render Pipeline/Unlit","Standard"})
        {
            var candidate=Shader.Find(name);
            if(candidate!=null && candidate.isSupported){vehicleShader=candidate;break;}
        }
        if(vehicleShader==null)
        {
            foreach(var mat in Resources.FindObjectsOfTypeAll<Material>())
            {
                if(mat.shader!=null && mat.shader.isSupported && mat.HasProperty("_BaseColor") && mat.HasProperty("_BaseMap"))
                {vehicleShader=mat.shader;break;}
            }
        }
        if(vehicleShader==null)throw new InvalidOperationException("Araclar icin desteklenen shader bulunamadi.");
        vehicleShaderName=vehicleShader.name;Plugin.Output.LogInfo("Original vehicle shader: "+vehicleShaderName);
        return vehicleShader;
    }
    private Mesh PartMesh(int level,VehiclePartData part)
    {
        var key=level+":"+part.Name;
        if(modelMeshes.TryGetValue(key,out var mesh)&&mesh!=null)return mesh;
        if(part.Vertices.Length%3!=0 || part.Normals.Length!=part.Vertices.Length || part.Vertices.Length>180000)
            throw new InvalidOperationException("Arac mesh verisi gecersiz.");
        var vertices=new Vector3[part.Vertices.Length/3];var normals=new Vector3[vertices.Length];var uv=new Vector2[vertices.Length];
        for(var i=0;i<vertices.Length;i++)
        {
            vertices[i]=new Vector3(part.Vertices[i*3],part.Vertices[i*3+1],part.Vertices[i*3+2]);
            normals[i]=new Vector3(part.Normals[i*3],part.Normals[i*3+1],part.Normals[i*3+2]);
            var p=vertices[i];
            uv[i]=part.Name.EndsWith(":rubber")?new Vector2(Mathf.Atan2(p.z,p.y)/(Mathf.PI*2)*5,p.x*3.5f+.5f):new Vector2(p.x*3,p.z*3+p.y*2);
            if(part.Uv.Length==vertices.Length*2)uv[i]=new Vector2(part.Uv[i*2],part.Uv[i*2+1]);
        }
        mesh=new Mesh{name="TikMnG "+key,hideFlags=HideFlags.DontUnloadUnusedAsset};
        mesh.vertices=new Il2CppStructArray<Vector3>(vertices);
        mesh.normals=new Il2CppStructArray<Vector3>(normals);
        mesh.uv=new Il2CppStructArray<Vector2>(uv);
        mesh.triangles=new Il2CppStructArray<int>(part.Triangles);
        mesh.RecalculateBounds();modelMeshes[key]=mesh;return mesh;
    }
    private Material PartMaterial(int level,VehiclePartData part)
    {
        var key=level+":"+part.Name.Split(':')[1];
        if(modelMaterials.TryGetValue(key,out var material)&&material!=null)return material;
        var kind=part.Name.Split(':')[1];
        var emblem=kind is "emblemfront" or "emblemrear";
        var rearWindow=kind=="rearwindow";
        // Use the game's dedicated alpha shader; unused URP keyword variants can
        // be stripped from a shipped demo and render transparent pixels black.
        var shader=emblem||rearWindow?Shader.Find("OFG/OFG_PBR_Alpha_Clip"):null;
        material=new Material(shader??VehicleShader()){name="TikMnG "+key,hideFlags=HideFlags.DontUnloadUnusedAsset};
        var color=new Color(part.Color[0],part.Color[1],part.Color[2],1);
        foreach(var property in new[]{"_BaseColor","_Color"})if(material.HasProperty(property))material.SetColor(property,color);
        var texture=Texture2D.whiteTexture;
        if(emblem||rearWindow||kind is "paint" or "trim" or "rubber" or "badge")
        {
            var textureKey=emblem?ModelIds[level]+"-"+(kind=="emblemfront"?"front":"rear"):
                rearWindow?ModelIds[level]+"-rear-window":kind=="badge"?kind+"-"+(level+1):kind;
            if(!modelTextures.TryGetValue(textureKey,out texture)||texture==null)
            {
                var file=emblem?Path.Combine(PathsRoot,"assets","branding","vehicles",textureKey+".png"):
                    rearWindow?Path.Combine(PathsRoot,"assets","vehicles","rear-window",ModelIds[level]+"-rear-window.png"):
                    Path.Combine(PathsRoot,"assets","vehicles","materials",textureKey+".png");
                texture=new Texture2D(2,2,TextureFormat.RGBA32,true){hideFlags=HideFlags.DontUnloadUnusedAsset};
                if(!File.Exists(file)||!ImageConversion.LoadImage(texture,File.ReadAllBytes(file)))throw new InvalidOperationException("Arac dokusu okunamadi: "+kind);
                texture.wrapMode=emblem||rearWindow||kind=="badge"?TextureWrapMode.Clamp:TextureWrapMode.Repeat;
                texture.filterMode=emblem||rearWindow?FilterMode.Trilinear:FilterMode.Bilinear;
                texture.anisoLevel=emblem||rearWindow?4:1;texture.Apply(true,true);modelTextures[textureKey]=texture;
            }
        }
        foreach(var property in new[]{"_BaseMap","_MainTex"})if(material.HasProperty(property))material.SetTexture(property,texture);
        if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",kind=="glass"?.96f:kind=="rubber"?.18f:kind=="trim"?.48f:.76f);
        if(material.HasProperty("_Metallic"))material.SetFloat("_Metallic",kind is "metal" or "gold"?.88f:kind=="paint"?.38f:0);
        if(kind=="paint")
        {
            if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",.86f);
            if(material.HasProperty("_Metallic"))material.SetFloat("_Metallic",.20f);
            if(material.HasProperty("_CoatMask"))material.SetFloat("_CoatMask",.72f);
            if(material.HasProperty("_CoatSmoothness"))material.SetFloat("_CoatSmoothness",.94f);
        }
        if(material.HasProperty("_Cull"))material.SetFloat("_Cull",0);
        if(emblem||rearWindow||kind=="badge")
        {
            if(material.HasProperty("_AlphaCutoff"))material.SetFloat("_AlphaCutoff",.12f);
            if(material.HasProperty("_AlphaClip"))material.SetFloat("_AlphaClip",1);
            if(material.HasProperty("_Cutoff"))material.SetFloat("_Cutoff",.12f);
            material.EnableKeyword("_ALPHATEST_ON");material.renderQueue=2450;
        }
        modelMaterials[key]=material;return material;
    }
    private static int RearWindowVariant(string username,int level)
    {
        unchecked
        {
            uint hash=2166136261;
            foreach(var c in (username??"").ToLowerInvariant()){hash^=c;hash*=16777619;}
            hash^=(uint)level;hash*=16777619;
            return (int)(hash%30);
        }
    }
    private Material RearWindowMaterialFor(ViewerCar entry,int level,Material template)
    {
        var variant=RearWindowVariant(entry.Username,level);
        var textureKey=$"{ModelIds[level]}-rear-window-{variant:00}";
        if(!modelTextures.TryGetValue(textureKey,out var texture)||texture==null)
        {
            var file=Path.Combine(PathsRoot,"assets","vehicles","rear-window","variants",textureKey+".png");
            texture=new Texture2D(2,2,TextureFormat.RGBA32,true){hideFlags=HideFlags.DontUnloadUnusedAsset};
            if(!File.Exists(file)||!ImageConversion.LoadImage(texture,File.ReadAllBytes(file)))
                throw new InvalidOperationException("Arka cam varyasyonu okunamadi: "+variant);
            texture.wrapMode=TextureWrapMode.Clamp;texture.filterMode=FilterMode.Trilinear;texture.anisoLevel=4;
            texture.Apply(true,true);modelTextures[textureKey]=texture;
        }
        var material=new Material(template){name=$"TikMnG {textureKey}"};
        foreach(var property in new[]{"_BaseMap","_MainTex"})if(material.HasProperty(property))material.SetTexture(property,texture);
        return material;
    }
    private void ApplyVehicleModel(ViewerCar entry,int level)
    {
        if(entry.Visual!=null && entry.Visual.Level==level)return;
        var data=LoadVehicleModel(level);
        var previousRearWindowMaterial=entry.Visual?.RearWindowMaterial;
        var original=entry.Visual?.OriginalRenderers??entry.Car.GetComponentsInChildren<Renderer>().ToArray();
        var root=new GameObject("TikMnG "+data.Name);
        root.transform.SetParent(entry.Car.visualsRoot!=null?entry.Car.visualsRoot:entry.Car.transform,false);
        var pivots=new Dictionary<string,Transform>();var wheels=new List<Transform>();
        try
        {
            foreach(var part in data.Parts)
            {
                if(!pivots.TryGetValue(part.Parent,out var pivot))
                {
                    var group=new GameObject(part.Parent);group.transform.SetParent(root.transform,false);
                    group.transform.localPosition=new Vector3(part.Pivot[0],part.Pivot[1],part.Pivot[2]);
                    pivot=group.transform;pivots[part.Parent]=pivot;
                    if(part.Parent.StartsWith("wheel"))wheels.Add(pivot);
                }
                var go=new GameObject(part.Name);go.transform.SetParent(pivot,false);
                go.AddComponent<MeshFilter>().sharedMesh=PartMesh(level,part);
                var renderer=go.AddComponent<MeshRenderer>();var material=PartMaterial(level,part);
                if(part.Name.EndsWith(":rearwindow"))
                {
                    material=RearWindowMaterialFor(entry,level,material);
                }
                renderer.sharedMaterial=material;
            }
            if(entry.Visual?.Root!=null)UObj.Destroy(entry.Visual.Root);
            if(entry.Visual?.OutlineMaterial!=null)UObj.Destroy(entry.Visual.OutlineMaterial);
            if(previousRearWindowMaterial!=null)UObj.Destroy(previousRearWindowMaterial);
            foreach(var renderer in original)if(renderer!=null)renderer.enabled=false;
            var rearMaterial=root.GetComponentsInChildren<MeshRenderer>().FirstOrDefault(r=>r.gameObject.name.EndsWith(":rearwindow"))?.sharedMaterial;
            entry.Visual=new VehicleModelInstance{Root=root,OriginalRenderers=original,Wheels=wheels,Level=level,RearWindowMaterial=rearMaterial};
            ConfigureModelCollision(entry,data);
            AddExhaustFlames(entry.Visual,data);
            AddUpgradeOutline(entry.Visual,data);
        }
        catch {UObj.Destroy(root);throw;}
    }
    private void UpdateVehicleModels()
    {
        foreach(var entry in entries)
        {
            if(!IsCarAlive(entry)||entry.Visual==null)continue;
            var desired=nativeChassisTest?1:entry.EconomyManaged?RaceEconomy.Power(entry.TopSpeedKph):ModelPowers[entry.Level];
            if(entry.EconomyManaged)
            {
                var straight=1-Mathf.Clamp01(Mathf.Abs(entry.Car.LastSimulatedInputs.steer.AsFloat)*3);
                var highSpeed=Mathf.InverseLerp(15,45,Mathf.Abs(entry.Car.Speed));
                desired=Mathf.Lerp(Mathf.Min(desired,1.1f),desired,straight*highSpeed);
                entry.Car.SetGripBoostFactor(1.2f);
            }
            if(entry.Car.motor!=null && Mathf.Abs(entry.Car.motor.torqueMultiplier-desired)>.001f)entry.Car.SetEnginePowerBoostFactor(desired);
            foreach(var renderer in entry.Visual.OriginalRenderers)if(renderer!=null && renderer.enabled)renderer.enabled=false;
            var model=entry.Visual;var radius=LoadVehicleModel(model.Level).WheelRadius;
            model.Angle=(model.Angle+entry.Car.Speed/Math.Max(.1f,radius)*Mathf.Rad2Deg*Time.unscaledDeltaTime)%360;
            foreach(var wheel in model.Wheels)if(wheel!=null)wheel.localRotation=Quaternion.Euler(0,wheel.name is "wheelFR" or "wheelFL"?entry.Car.LastSimulatedInputs.steer.AsFloat*25:0,0)*Quaternion.Euler(model.Angle,0,0);
            UpdateExhaustFlames(entry);
            UpdateUpgradeFeedback(entry);
        }
        UpdateSafeRaceSpeed();
    }
}
