using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject appearanceRoot;CarController appearanceCar;
    MeshRenderer paintRenderer;MaterialPropertyBlock paintBlock;
    string appliedAppearance="";
    readonly List<Material> appearanceMaterials=new List<Material>();
    readonly Color[] paintColors={new Color(.2f,.67f,.14f),new Color(.94f,.18f,.21f),new Color(.05f,.58f,.92f),new Color(1,.74f,.05f),new Color(.9f,.26f,.55f),new Color(.1f,.75f,.67f),new Color(.94f,.95f,.96f),new Color(.12f,.15f,.18f)};
    Material VehicleMaterial(Color color){var material=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));material.color=color;if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",.5f);appearanceMaterials.Add(material);return material;}
    void VehiclePart(string name,Vector3 position,Vector3 scale,Material material){var part=GameObject.CreatePrimitive(PrimitiveType.Cube);Destroy(part.GetComponent<Collider>());part.name=name;part.transform.SetParent(appearanceRoot.transform,false);part.transform.localPosition=position;part.transform.localScale=scale;part.GetComponent<Renderer>().sharedMaterial=material;}
    void UpdateAppearance(){
      if(!car||!Ready||draft==null)return;
      var value=draft.appearance;if(value==null||!value.configured)return;
      string key=value.style+":"+value.red+":"+value.green+":"+value.blue;
      if(appearanceCar==car&&appliedAppearance==key)return;
      ReleaseAppearance();appearanceCar=car;appliedAppearance=key;
      paintRenderer=Get<MeshRenderer>(car,"CarColorMeshR");
      if(paintRenderer){paintBlock=new MaterialPropertyBlock();paintRenderer.GetPropertyBlock(paintBlock,0);paintBlock.SetColor("_BaseColor",new Color(value.red,value.green,value.blue));paintRenderer.SetPropertyBlock(paintBlock,0);}
      appearanceRoot=new GameObject("TikMnG vehicle styling");appearanceRoot.transform.SetParent(Get<Transform>(car,"Visual")??car.transform,false);
      var dark=VehicleMaterial(new Color(.09f,.13f,.16f));var chrome=VehicleMaterial(new Color(.74f,.8f,.82f));var accent=VehicleMaterial(new Color(value.red,value.green,value.blue));
      if(value.style=="sport"){
        foreach(float x in new[]{-.75f,.75f})VehiclePart("Spoiler mount",new Vector3(x,1.93f,-1.15f),new Vector3(.12f,.6f,.18f),dark);
        VehiclePart("Rear sport wing",new Vector3(0,2.25f,-1.15f),new Vector3(2.25f,.12f,.48f),accent);
        foreach(float x in new[]{-1.14f,1.14f})VehiclePart("Sport side skirt",new Vector3(x,-.05f,0),new Vector3(.18f,.2f,2.4f),dark);
      }else if(value.style=="rally"){
        foreach(float x in new[]{-.8f,.8f}){VehiclePart("Roof rack rail",new Vector3(x,1.62f,-.1f),new Vector3(.12f,.12f,1.8f),dark);foreach(float z in new[]{-.7f,.6f})VehiclePart("Roof rack foot",new Vector3(x,1.42f,z),new Vector3(.1f,.3f,.12f),chrome);}
        foreach(float z in new[]{-.7f,-.1f,.6f})VehiclePart("Roof rack crossbar",new Vector3(0,1.64f,z),new Vector3(1.7f,.08f,.12f),chrome);
        VehiclePart("Rally rear bumper",new Vector3(0,.05f,-1.72f),new Vector3(2.25f,.25f,.18f),dark);
      }
    }
    void ReleaseAppearance(){if(paintRenderer)paintRenderer.SetPropertyBlock(null,0);paintRenderer=null;paintBlock=null;if(appearanceRoot)Destroy(appearanceRoot);appearanceRoot=null;appearanceCar=null;appliedAppearance="";foreach(var material in appearanceMaterials)Destroy(material);appearanceMaterials.Clear();}
    void DrawAppearance(){
      if(draft.appearance==null)draft.appearance=new AppearanceSettings();var value=draft.appearance;
      GUI.Label(new Rect(24,216,700,30),"Araç görünümü",headingStyle);
      string[] ids={"classic","sport","rally"},names={"Klasik","Spor","Ralli"};
      for(int i=0;i<3;i++)if(Button(new Rect(35+i*350,272,330,52),names[i],value.style==ids[i])){value.style=ids[i];value.configured=true;}
      Label(35,356,300,"Gövde rengi");
      for(int i=0;i<paintColors.Length;i++){
        Rect swatch=new Rect(35+i*130,399,110,56);bool selected=Vector3.Distance(new Vector3(value.red,value.green,value.blue),new Vector3(paintColors[i].r,paintColors[i].g,paintColors[i].b))<.02f;
        if(selected)Fill(new Rect(swatch.x-3,swatch.y-3,swatch.width+6,swatch.height+6),new Color(.1f,.56f,.48f));
        if(Button(swatch,"")){value.red=paintColors[i].r;value.green=paintColors[i].g;value.blue=paintColors[i].b;value.configured=true;}
        Fill(new Rect(swatch.x+5,swatch.y+5,swatch.width-10,swatch.height-10),paintColors[i]);
      }
      Label(35,505,1000,value.style=="sport"?"Spor gövde · arka kanat ve yan etekler":value.style=="rally"?"Ralli gövde · tavan taşıyıcısı ve tampon":"Klasik gövde");
      GUI.enabled=MenuInputAllowed&&!menuBusy&&BridgeOnline;
      if(Button(new Rect(755,580,320,48),"Görünümü kaydet",true))StartCoroutine(SaveAppearance());GUI.enabled=MenuInputAllowed;
    }
    IEnumerator SaveAppearance(){
      if(menuBusy)yield break;menuBusy=true;draft.appearance.configured=true;
      using(var request=Post("/mod/appearance",JsonUtility.ToJson(draft.appearance))){request.timeout=8;yield return request.SendWebRequest();menuNotice=request.result==UnityWebRequest.Result.Success?"Araç görünümü kalıcı olarak kaydedildi.":"Araç görünümü kaydedilemedi. Tekrar deneyin.";}
      menuBusy=false;
    }
  }
}
