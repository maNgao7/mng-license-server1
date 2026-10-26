using System;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    struct AudienceSeat {public Vector3 position;public float yaw;}
    SpectatorInfo[] audience=new SpectatorInfo[0];
    readonly List<AudienceSeat> audienceSeats=new List<AudienceSeat>();
    readonly Dictionary<string,TrackSpectator> audiencePeople=new Dictionary<string,TrackSpectator>(StringComparer.OrdinalIgnoreCase);
    Material[] audienceClothes;Material audienceSkin,audienceHair,audiencePants;float nextAudienceUpdate;
    void RegisterStandSeats(float side,float z){for(int tier=0;tier<3;tier++)for(int seat=0;seat<11;seat++)audienceSeats.Add(new AudienceSeat{position=new Vector3(side*(23+tier*2.2f),1.55f+tier*1.1f,z-10+seat*2),yaw=side<0?90:-90});}
    GameObject HumanPart(Transform root,string name,PrimitiveType type,Vector3 position,Vector3 size,Material material){var item=GameObject.CreatePrimitive(type);Destroy(item.GetComponent<Collider>());item.name=name;item.transform.SetParent(root,false);item.transform.localPosition=position;item.transform.localScale=size;item.GetComponent<Renderer>().sharedMaterial=material;return item;}
    TrackSpectator BuildSpectator(SpectatorInfo person,int slot){
      if(audienceClothes==null){audienceClothes=new[]{TrackMaterial(new Color(.9f,.18f,.22f)),TrackMaterial(new Color(.08f,.62f,.79f)),TrackMaterial(new Color(.96f,.7f,.12f)),TrackMaterial(new Color(.9f,.88f,.8f))};audienceSkin=TrackMaterial(new Color(.78f,.53f,.37f));audienceHair=TrackMaterial(new Color(.12f,.09f,.08f));audiencePants=TrackMaterial(new Color(.16f,.23f,.3f));}
      var seat=audienceSeats[slot];var node=new GameObject("Live spectator "+person.username);node.transform.SetParent(trackRoot.transform,false);node.transform.localPosition=seat.position;node.transform.localRotation=Quaternion.Euler(0,seat.yaw,0);
      var shirt=audienceClothes[slot%audienceClothes.Length];
      HumanPart(node.transform,"Jacket",PrimitiveType.Capsule,new Vector3(0,.65f,0),new Vector3(.6f,.6f,.38f),shirt);
      HumanPart(node.transform,"Head",PrimitiveType.Sphere,new Vector3(0,1.25f,0),new Vector3(.42f,.5f,.4f),audienceSkin);
      HumanPart(node.transform,"Hair",PrimitiveType.Sphere,new Vector3(0,1.41f,-.035f),new Vector3(.44f,.22f,.4f),audienceHair);
      foreach(float x in new[]{-.09f,.09f})HumanPart(node.transform,"Eye",PrimitiveType.Sphere,new Vector3(x,1.28f,.191f),new Vector3(.045f,.045f,.025f),audienceHair);
      var arms=new Transform[2];int index=0;
      foreach(float side in new[]{-1f,1f}){
        var arm=new GameObject("Waving arm");arm.transform.SetParent(node.transform,false);arm.transform.localPosition=new Vector3(side*.35f,.98f,0);arm.transform.localRotation=Quaternion.Euler(-20,0,side*15);arms[index++]=arm.transform;
        HumanPart(arm.transform,"Sleeve",PrimitiveType.Capsule,new Vector3(0,-.2f,0),new Vector3(.18f,.25f,.18f),shirt);HumanPart(arm.transform,"Hand",PrimitiveType.Sphere,new Vector3(0,-.47f,0),Vector3.one*.17f,audienceSkin);
        HumanPart(node.transform,"Seated thigh",PrimitiveType.Capsule,new Vector3(side*.17f,.22f,.22f),new Vector3(.23f,.29f,.23f),audiencePants).transform.localRotation=Quaternion.Euler(90,0,0);
        HumanPart(node.transform,"Lower leg",PrimitiveType.Capsule,new Vector3(side*.17f,-.05f,.47f),new Vector3(.2f,.26f,.2f),audiencePants);
        HumanPart(node.transform,"Shoe",PrimitiveType.Cube,new Vector3(side*.17f,-.31f,.55f),new Vector3(.23f,.17f,.36f),audienceHair);
      }
      var label=new GameObject("Viewer username");label.transform.SetParent(node.transform,false);label.transform.localPosition=new Vector3(0,1.85f,0);var text=label.AddComponent<TextMesh>();text.font=trackFont;text.fontSize=48;text.characterSize=.045f;text.anchor=TextAnchor.MiddleCenter;text.color=Color.white;text.richText=false;text.text=person.username;label.GetComponent<MeshRenderer>().sharedMaterial=trackFont.material;
      var spectator=node.AddComponent<TrackSpectator>();spectator.Owner=this;spectator.Arms=arms;spectator.Label=label.transform;spectator.Slot=slot;CreatePortrait(spectator);return spectator;
    }
    void UpdateAudience(){
      if(!CustomActive||!Ready||Time.unscaledTime<nextAudienceUpdate)return;nextAudienceUpdate=Time.unscaledTime+.6f;
      var wanted=new Dictionary<string,SpectatorInfo>(StringComparer.OrdinalIgnoreCase);foreach(var person in audience)if(!string.IsNullOrEmpty(person.username))wanted[person.username]=person;
      var remove=new List<string>();foreach(var item in audiencePeople)if(!wanted.ContainsKey(item.Key)){if(item.Value)Destroy(item.Value.gameObject);remove.Add(item.Key);}foreach(string key in remove)audiencePeople.Remove(key);
      var used=new HashSet<int>();foreach(var person in audiencePeople.Values)if(person)used.Add(person.Slot);
      foreach(var item in wanted){TrackSpectator spectator;if(!audiencePeople.TryGetValue(item.Key,out spectator)||!spectator){int slot=0;while(used.Contains(slot)&&slot<audienceSeats.Count)slot++;if(slot>=audienceSeats.Count||used.Count>=132)break;spectator=BuildSpectator(item.Value,slot);audiencePeople[item.Key]=spectator;used.Add(slot);}spectator.Cheering=item.Value.cheering;spectator.AvatarPath=item.Value.avatar;ApplyPortrait(spectator);}
    }
    void ReleaseAudience(){audienceSeats.Clear();audiencePeople.Clear();audienceClothes=null;audienceSkin=audienceHair=audiencePants=null;nextAudienceUpdate=0;}
  }
  public class TrackSpectator:MonoBehaviour {
    public VoiceDrive Owner;public Transform[] Arms;public Transform Label;public MeshRenderer Portrait;public string AvatarPath;public bool HasPortrait;public int Slot;public bool Cheering;
    void Update(){if(!Owner||Owner.MenuOpen)return;var camera=Camera.main;if(camera&&Vector3.Distance(camera.transform.position,transform.position)>140)return;
      for(int i=0;i<Arms.Length;i++)Arms[i].localRotation=Quaternion.Euler(Cheering?-155+Mathf.Sin(Time.unscaledTime*8+Slot+i)*18:-20,0,(i==0?-1:1)*15);
    }
  }
}
