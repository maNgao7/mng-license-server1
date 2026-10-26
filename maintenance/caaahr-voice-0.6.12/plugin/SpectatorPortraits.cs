using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Rendering;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    class PortraitAsset {public Texture2D texture;public Material material;}
    readonly Dictionary<string,PortraitAsset> portraits=new Dictionary<string,PortraitAsset>();
    readonly Dictionary<string,float> portraitRetry=new Dictionary<string,float>();
    readonly HashSet<string> portraitLoading=new HashSet<string>();
    readonly Queue<string> portraitOrder=new Queue<string>();
    PortraitAsset fallbackPortrait;
    Material PortraitMaterial(Texture2D texture){var material=new Material(Shader.Find("Universal Render Pipeline/Unlit")??Shader.Find("Sprites/Default"));material.mainTexture=texture;material.SetTexture("_BaseMap",texture);material.color=Color.white;if(material.HasProperty("_Surface")){material.SetFloat("_Surface",1);material.SetFloat("_SrcBlend",5);material.SetFloat("_DstBlend",10);material.SetFloat("_ZWrite",0);material.SetFloat("_Cull",0);material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");material.renderQueue=3000;}return material;}
    void CreatePortrait(TrackSpectator person){
      if(fallbackPortrait==null){var texture=new Texture2D(64,64,TextureFormat.RGBA32,false);for(int y=0;y<64;y++)for(int x=0;x<64;x++){float u=(x-31.5f)/31.5f,v=(y-31.5f)/31.5f;bool face=new Vector2(u,v-.25f).magnitude<.26f,body=Mathf.Pow(u/.53f,2)+Mathf.Pow((v+.48f)/.42f,2)<1;var color=face||body?new Color(.7f,.79f,.83f):new Color(.13f,.21f,.25f);color.a=Mathf.Clamp01((1-new Vector2(u,v).magnitude)*50);texture.SetPixel(x,y,color);}texture.Apply();fallbackPortrait=new PortraitAsset{texture=texture,material=PortraitMaterial(texture)};}
      var portrait=GameObject.CreatePrimitive(PrimitiveType.Quad);Destroy(portrait.GetComponent<Collider>());portrait.name="Circular live profile portrait";portrait.transform.SetParent(person.transform,false);portrait.transform.localPosition=new Vector3(0,2.7f,0);portrait.transform.localScale=new Vector3(1.15f,1.15f,1);person.Portrait=portrait.GetComponent<MeshRenderer>();person.Portrait.sharedMaterial=fallbackPortrait.material;person.Portrait.shadowCastingMode=ShadowCastingMode.Off;
    }
    void ApplyPortrait(TrackSpectator person){
      if(!person||!person.Portrait)return;string path=person.AvatarPath??"";PortraitAsset asset;
      if(portraits.TryGetValue(path,out asset)){person.Portrait.sharedMaterial=asset.material;person.HasPortrait=true;return;}
      person.HasPortrait=false;person.Portrait.sharedMaterial=fallbackPortrait.material;
      float retry;var manager=car?Get<GameManager>(car,"gameManager"):null;var camera=manager&&manager.camControl?Get<Camera>(manager.camControl,"cam"):null;if(camera&&Vector3.Distance(camera.transform.position,person.transform.position)>140)return;
      if(path.StartsWith("/avatars/",System.StringComparison.Ordinal)&&path.EndsWith(".png",System.StringComparison.Ordinal)&&path.Length==45&&portraitLoading.Count<2&&!portraitLoading.Contains(path)&&(!portraitRetry.TryGetValue(path,out retry)||Time.unscaledTime>=retry))StartCoroutine(LoadPortrait(path));
    }
    IEnumerator LoadPortrait(string path){
      portraitLoading.Add(path);portraitRetry[path]=Time.unscaledTime+15;if(portraitRetry.Count>192){var remove=new List<string>();foreach(var key in portraitRetry.Keys)if(!portraitLoading.Contains(key)&&!portraits.ContainsKey(key)){remove.Add(key);if(portraitRetry.Count-remove.Count<=160)break;}foreach(string key in remove)portraitRetry.Remove(key);}
      using(var request=UnityWebRequestTexture.GetTexture("http://127.0.0.1:4051"+path,true)){
        request.timeout=9;yield return request.SendWebRequest();
        if(request.result==UnityWebRequest.Result.Success){var texture=DownloadHandlerTexture.GetContent(request);texture.filterMode=FilterMode.Bilinear;texture.wrapMode=TextureWrapMode.Clamp;texture.anisoLevel=4;portraits[path]=new PortraitAsset{texture=texture,material=PortraitMaterial(texture)};portraitOrder.Enqueue(path);while(portraitOrder.Count>96){string oldest=portraitOrder.Dequeue();PortraitAsset old;if(portraits.TryGetValue(oldest,out old)){Destroy(old.texture);Destroy(old.material);portraits.Remove(oldest);portraitRetry.Remove(oldest);}}}
      }
      portraitLoading.Remove(path);nextAudienceUpdate=0;
    }
    int BoundPortraitCount(){int count=0;foreach(var person in audiencePeople.Values)if(person&&person.HasPortrait)count++;return count;}
    void AudienceBeforeCamera(ScriptableRenderContext context,Camera camera){
      if(!camera)return;
      if(shieldVisual&&shieldVisual.activeSelf){var badge=shieldVisual.transform.Find("Floating protection badge");if(badge)badge.rotation=camera.transform.rotation;}
      if(!CustomActive)return;
      foreach(var person in audiencePeople.Values)if(person){
        if(person.Label){person.Label.rotation=camera.transform.rotation;float width=person.Label.GetComponent<MeshRenderer>().localBounds.size.x;if(width>.001f)person.Label.localScale=Vector3.one*Mathf.Min(1,1.7f/width);}
        if(person.Portrait)person.Portrait.transform.rotation=camera.transform.rotation;
      }
    }
    void ReleasePortraits(){foreach(var asset in portraits.Values){Destroy(asset.texture);Destroy(asset.material);}portraits.Clear();portraitLoading.Clear();portraitRetry.Clear();portraitOrder.Clear();if(fallbackPortrait!=null){Destroy(fallbackPortrait.texture);Destroy(fallbackPortrait.material);fallbackPortrait=null;}}
  }
}
