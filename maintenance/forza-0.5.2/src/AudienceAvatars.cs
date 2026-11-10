using CircuitSuperstars;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using UnityEngine;
using UnityEngine.Rendering;
using UObj = UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private sealed class AudienceProfile
    {
        public string Username="",Nickname="",Avatar="";
        public float LastSeen;
        public float FirstSeen;
    }
    private sealed class AudienceBadge
    {
        public GameObject Root;
        public string Username;
    }

    private readonly List<AudienceBadge> audienceBadges = new();
    private readonly Dictionary<string,AudienceProfile> audienceProfiles = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<Material> audienceBadgeMaterials = new();
    private GameObject audienceBadgeRoot;
    private Mesh audienceBadgeQuad;
    private Texture2D audienceRingTexture;
    private string audienceBadgeSignature = "";
    private float audienceBadgeRetry;
    private float nextAudienceRefresh;
    private int audiencePage=-1;
    private readonly List<Vector3> audienceSeats=new();
    private string audienceSeatSignature="";
    private int audienceSeatMatchedVertices,audienceSeatUnknownVertices;

    private void WriteAudienceGeometry()
    {
        var crowds=UObj.FindObjectsOfType<CrowdPlacer>().Select(c=>
        {
            var m=c.crowdMesh;var filter=c.destinationMeshFilter;
            object Points(IEnumerable<Vector2> points)=>points.Take(24).Select(p=>new{x=p.x,y=p.y}).ToArray();
            return new{name=c.name,path=ScenePath(c.transform),readable=m!=null&&m.isReadable,vertices=m?.vertexCount??0,
                position=c.transform.position.ToString(),filter=filter?.transform.position.ToString(),
                samples=m!=null&&m.isReadable?m.vertices.Take(24).Select(p=>new{x=p.x,y=p.y,z=p.z}).ToArray():null,
                uv=m!=null&&m.isReadable?Points(m.uv):null,uv2=m!=null&&m.isReadable?Points(m.uv2):null,
                uv3=m!=null&&m.isReadable?Points(m.uv3):null,uv4=m!=null&&m.isReadable?Points(m.uv4):null};
        }).ToArray();
        File.WriteAllText(Path.Combine(control,"audience-geometry.json"),System.Text.Json.JsonSerializer.Serialize(crowds,jsonOptions));
    }

    private void RememberAudience(string username,string nickname,string avatar)
    {
        if(string.IsNullOrWhiteSpace(username))return;
        if(!audienceProfiles.TryGetValue(username,out var profile))
        {
            profile=new AudienceProfile{Username=username,FirstSeen=Time.unscaledTime};
            audienceProfiles[username]=profile;
        }
        if(!string.IsNullOrWhiteSpace(nickname))profile.Nickname=nickname;
        if(!string.IsNullOrWhiteSpace(avatar))profile.Avatar=avatar;
        profile.LastSeen=Time.unscaledTime;
    }

    public void UpdateAudienceAvatars()
    {
        if (!cameraReady || view == null || GameStateManager.IsTransitioning || phase == "resetting")
        { ClearAudienceAvatarScene();audienceSeats.Clear();audienceSeatSignature="";return; }

        if(Time.unscaledTime>=nextAudienceRefresh)
        {
        nextAudienceRefresh=Time.unscaledTime+.5f;
        foreach(var entry in entries.Where(e=>!string.IsNullOrWhiteSpace(e.Avatar)))
            RememberAudience(entry.Username,entry.Nickname,entry.Avatar);
        var all=audienceProfiles.Values.Where(p=>Portrait(p.Avatar)!=null)
            .OrderBy(p=>p.FirstSeen).ThenBy(p=>p.Username).ToArray();
        var quality=Math.Clamp(settings.GraphicsQuality,0,3);
        var budget=new[]{32,64,96,144}[quality];
        var pageCount=Math.Max(1,(all.Length+budget-1)/budget);
        var page=all.Length<=budget?0:(int)(Time.unscaledTime/12)%pageCount;
        var visible=all.Skip(page*budget).Take(budget).ToArray();
        var signature = page+"|"+string.Join("|", visible.Select(e => e.Username + ":" + e.Avatar));
        if (signature != audienceBadgeSignature && Time.unscaledTime >= audienceBadgeRetry)
        {
            ClearAudienceAvatarScene();
            audienceBadgeSignature = signature;
            audiencePage=page;
            if (visible.Length > 0 && !CreateAudienceBadges(visible))
            { audienceBadgeRetry = Time.unscaledTime + 2; audienceBadgeSignature = ""; }
        }
        }

        foreach (var badge in audienceBadges)
        {
            if (badge.Root == null) continue;
            var direction = badge.Root.transform.position - view.transform.position;
            if (direction.sqrMagnitude > .01f) badge.Root.transform.rotation = Quaternion.LookRotation(direction, Vector3.up);
        }
    }

    private bool CreateAudienceBadges(AudienceProfile[] viewers)
    {
        var crowds = UObj.FindObjectsOfType<MeshRenderer>()
            .Where(r => r.gameObject.activeInHierarchy && r.name == "Crowd Placer" &&
                r.sharedMaterials.Any(m => m != null && m.shader != null && m.shader.name.Contains("Crowd", StringComparison.OrdinalIgnoreCase)))
            .OrderBy(r => resultsBoardGrid == Vector3.zero ? Vector3.SqrMagnitude(r.bounds.center - view.transform.position) :
                Vector3.SqrMagnitude(r.bounds.center - resultsBoardGrid)).ToArray();
        if (crowds.Length == 0) return false;
        FindAudienceSeats();
        if(audienceSeats.Count==0)return false;

        audienceBadgeRoot = new GameObject("TikMnG live audience profile badges");
        audienceBadgeQuad = AudienceQuad();
        audienceRingTexture = LoadAudienceTexture(Path.Combine(PathsRoot, "assets", "portrait-ring.png"));
        var ring = AudienceMaterial("audience profile ring", audienceRingTexture, Color.white);

        for (var i = 0; i < Math.Min(viewers.Length,audienceSeats.Count); i++)
        {
            var entry = viewers[i]; var portrait = Portrait(entry.Avatar); if (portrait == null) continue;
            var position=audienceSeats[i];

            var root = new GameObject("Live spectator @" + entry.Username);
            root.transform.SetParent(audienceBadgeRoot.transform, true); root.transform.position = position;
            AudienceBadgePanel(root.transform, "Ring", ring, Vector3.zero, .68f, .02f);
            var portraitMaterial = AudienceMaterial("audience @" + entry.Username, portrait, Color.white);
            AudienceBadgePanel(root.transform, "Portrait", portraitMaterial, Vector3.zero, .58f, 0);
            audienceBadges.Add(new AudienceBadge { Root = root, Username = entry.Username });
        }
        return audienceBadges.Count > 0;
    }

    private void FindAudienceSeats()
    {
        Plugin.Output.LogInfo("Audience seats: reading native crowd instances.");
        var placers=UObj.FindObjectsOfType<CrowdPlacer>().Where(c=>c.gameObject.activeInHierarchy&&c.crowdMesh!=null&&c.crowdMesh.isReadable&&c.destinationMeshFilter!=null)
            .OrderBy(c=>Vector3.SqrMagnitude(c.transform.position-resultsBoardGrid)).ToArray();
        var key=string.Join(",",placers.Select(c=>c.GetInstanceID()+":"+c.crowdMesh.GetInstanceID()));
        if(key==audienceSeatSignature&&audienceSeats.Count>0)return;
        audienceSeatSignature=key;audienceSeats.Clear();audienceSeatMatchedVertices=0;audienceSeatUnknownVertices=0;
        foreach(var placer in placers)
        {
            // The native crowd is a combined mesh. Its original prefab UV streams
            // identify each person's vertex range without modifying the crowd.
            var templates=new List<Vector2[]>();
            var prefabs=placer.crowdDescriptor?.crowdMemberPrefabs;
            if(prefabs==null)continue;
            Plugin.Output.LogInfo("Audience seats: reading prefab UVs for " + placer.name + ".");
            foreach(var prefab in prefabs)
            {
                if(prefab==null)continue;
                foreach(var filter in prefab.GetComponentsInChildren<MeshFilter>())
                {
                    var template=filter.sharedMesh;
                    if(template!=null&&template.isReadable&&template.vertexCount>20&&template.uv.Length>20)templates.Add(template.uv.ToArray());
                }
            }
            if(templates.Count==0)continue;
            var mesh=placer.crowdMesh;var vertices=mesh.vertices.ToArray();var coordinates=mesh.uv.ToArray();
            Plugin.Output.LogInfo("Audience seats: matching " + vertices.Length + " vertices against " + templates.Count + " templates.");
            for(var offset=0;offset<Math.Min(vertices.Length,coordinates.Length);)
            {
                var matched=0;
                foreach(var template in templates)
                {
                    if(offset+template.Length>coordinates.Length)continue;
                    var same=true;
                    for(var probe=0;probe<12;probe++)
                    {
                        var index=probe*(template.Length-1)/11;
                        if((coordinates[offset+index]-template[index]).sqrMagnitude>.00000001f){same=false;break;}
                    }
                    if(same){matched=template.Length;break;}
                }
                if(matched==0){offset++;audienceSeatUnknownVertices++;continue;}
                var min=new Vector3(float.MaxValue,float.MaxValue,float.MaxValue);var max=-min;
                for(var i=offset;i<offset+matched;i++)
                {
                    var point=placer.destinationMeshFilter.transform.TransformPoint(vertices[i]);
                    min=Vector3.Min(min,point);max=Vector3.Max(max,point);
                }
                if(max.y-min.y>.4f&&max.y-min.y<3.5f&&max.x-min.x<3&&max.z-min.z<3)
                {
                    var seat=new Vector3((min.x+max.x)*.5f,max.y+.36f,(min.z+max.z)*.5f);
                    if(audienceSeats.All(s=>(s-seat).sqrMagnitude>.12f))audienceSeats.Add(seat);
                }
                offset+=matched;audienceSeatMatchedVertices+=matched;
            }
        }
    }

    private object GetAudienceSeatStatus()=>new{method="native-prefab-uv-ranges",seats=audienceSeats.Count,
        matchedVertices=audienceSeatMatchedVertices,unknownVertices=audienceSeatUnknownVertices,page=audiencePage,
        badges=audienceBadges.Take(8).Select(b=>new{b.Username,position=b.Root.transform.position.ToString()}).ToArray()};

    private void AudienceBadgePanel(Transform parent, string name, Material material, Vector3 position, float size, float z)
    {
        var panel = new GameObject(name); panel.transform.SetParent(parent, false);
        panel.transform.localPosition = position + new Vector3(0, 0, z); panel.transform.localScale = new Vector3(size, size, 1);
        panel.AddComponent<MeshFilter>().sharedMesh = audienceBadgeQuad;
        var renderer = panel.AddComponent<MeshRenderer>(); renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false; renderer.sortingOrder = 18;
    }

    private Material AudienceMaterial(string name, Texture texture, Color color)
    {
        var shader = Shader.Find("Unlit/Transparent");
        if (shader == null || !shader.isSupported) shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null || !shader.isSupported) shader = VehicleShader();
        var material = new Material(shader) { name = "TikMnG " + name, renderQueue = 3100 };
        audienceBadgeMaterials.Add(material);
        foreach (var property in new[] { "_MainTex", "_BaseMap" }) if (material.HasProperty(property)) material.SetTexture(property, texture);
        foreach (var property in new[] { "_Color", "_BaseColor" }) if (material.HasProperty(property)) material.SetColor(property, color);
        if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1);
        if (material.HasProperty("_SrcBlend")) material.SetFloat("_SrcBlend", 5);
        if (material.HasProperty("_DstBlend")) material.SetFloat("_DstBlend", 10);
        if (material.HasProperty("_ZWrite")) material.SetFloat("_ZWrite", 0);
        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0);
        material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        return material;
    }

    private static Texture2D LoadAudienceTexture(string file)
    {
        if (!File.Exists(file)) return null;
        var image = new Texture2D(2, 2) { hideFlags = HideFlags.DontUnloadUnusedAsset, filterMode = FilterMode.Trilinear };
        if (ImageConversion.LoadImage(image, File.ReadAllBytes(file))) return image;
        UObj.Destroy(image); return null;
    }

    private static Mesh AudienceQuad()
    {
        var mesh = new Mesh { name = "TikMnG audience avatar quad" };
        mesh.vertices = new Il2CppStructArray<Vector3>(new[] { new Vector3(-.5f,-.5f,0), new Vector3(.5f,-.5f,0), new Vector3(.5f,.5f,0), new Vector3(-.5f,.5f,0) });
        mesh.normals = new Il2CppStructArray<Vector3>(Enumerable.Repeat(Vector3.back, 4).ToArray());
        mesh.uv = new Il2CppStructArray<Vector2>(new[] { new Vector2(0,0), new Vector2(1,0), new Vector2(1,1), new Vector2(0,1) });
        mesh.triangles = new Il2CppStructArray<int>(new[] { 0,2,1,0,3,2 }); mesh.RecalculateBounds(); return mesh;
    }

    public void ClearAudienceAvatarScene()
    {
        if (audienceBadgeRoot != null) { audienceBadgeRoot.SetActive(false); UObj.Destroy(audienceBadgeRoot); }
        foreach (var material in audienceBadgeMaterials) if (material != null) UObj.Destroy(material);
        if (audienceBadgeQuad != null) UObj.Destroy(audienceBadgeQuad);
        if (audienceRingTexture != null) UObj.Destroy(audienceRingTexture);
        audienceBadgeRoot = null; audienceBadgeQuad = null; audienceRingTexture = null;
        audienceBadgeMaterials.Clear(); audienceBadges.Clear(); audienceBadgeSignature = "";audiencePage=-1;
    }
}
