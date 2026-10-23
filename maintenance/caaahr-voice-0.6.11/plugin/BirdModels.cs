using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    Mesh birdWingMesh;GameObject eggBird,fallingEgg;Transform[] eggWings;
    readonly List<Material> eggBirdMaterials=new List<Material>();
    Material EggBirdMaterial(Color color){var material=ActionMaterial(color);eggBirdMaterials.Add(material);return material;}
    Mesh BirdWing(){
      if(birdWingMesh)return birdWingMesh;
      Vector3[] outline={new Vector3(0,0,.22f),new Vector3(.55f,.08f,.31f),new Vector3(1.25f,.03f,.12f),new Vector3(1.6f,-.02f,-.2f),new Vector3(1.22f,-.01f,-.08f),new Vector3(1.43f,-.035f,-.4f),new Vector3(1.05f,0,-.22f),new Vector3(1.13f,-.03f,-.49f),new Vector3(.76f,.02f,-.33f),new Vector3(.65f,.02f,-.52f),new Vector3(.25f,0,-.29f),new Vector3(0,0,-.22f)};
      var vertices=new List<Vector3>{new Vector3(.55f,.1f,-.04f)};vertices.AddRange(outline);var triangles=new List<int>();for(int i=0;i<outline.Length;i++){int next=(i+1)%outline.Length+1;triangles.AddRange(new[]{0,i+1,next,0,next,i+1});}
      // Opposite windings must not cancel the lighting normals on these two-sided feathers.
      birdWingMesh=new Mesh{name="Tapered feathered bird wing"};birdWingMesh.vertices=vertices.ToArray();birdWingMesh.triangles=triangles.ToArray();var normals=new Vector3[vertices.Count];for(int i=0;i<normals.Length;i++)normals[i]=Vector3.up;birdWingMesh.normals=normals;birdWingMesh.RecalculateBounds();return birdWingMesh;
    }
    Transform[] BirdModel(Transform root,Material plumage,Material dark,Material gold){
      HumanPart(root,"Streamlined bird body",PrimitiveType.Sphere,new Vector3(0,0,0),new Vector3(.43f,.39f,.88f),plumage);
      HumanPart(root,"Bird head",PrimitiveType.Sphere,new Vector3(0,.18f,.39f),new Vector3(.32f,.32f,.36f),plumage);
      var beak=HumanPart(root,"Pointed yellow beak",PrimitiveType.Capsule,new Vector3(0,.15f,.63f),new Vector3(.105f,.18f,.085f),gold);beak.transform.localRotation=Quaternion.Euler(90,0,0);
      foreach(float side in new[]{-1f,1f})HumanPart(root,"Bird eye",PrimitiveType.Sphere,new Vector3(side*.146f,.24f,.48f),Vector3.one*.05f,dark);
      HumanPart(root,"Soft breast plumage",PrimitiveType.Sphere,new Vector3(0,-.09f,.16f),new Vector3(.37f,.3f,.55f),plumage);
      foreach(float side in new[]{-1f,1f}){HumanPart(root,"Bright eye surround",PrimitiveType.Sphere,new Vector3(side*.149f,.24f,.48f),Vector3.one*.072f,gold);HumanPart(root,"Eye pupil",PrimitiveType.Sphere,new Vector3(side*.175f,.245f,.49f),Vector3.one*.043f,dark);}
      var wings=new Transform[2];
      for(int i=0;i<2;i++){float side=i==0?-1:1;var pivot=new GameObject("Feathered wing joint");pivot.transform.SetParent(root,false);pivot.transform.localPosition=new Vector3(side*.13f,.04f,0);wings[i]=pivot.transform;
        var wing=new GameObject("Sculpted flight feathers");wing.transform.SetParent(pivot.transform,false);wing.transform.localScale=new Vector3(side,1,1);wing.AddComponent<MeshFilter>().sharedMesh=BirdWing();wing.AddComponent<MeshRenderer>().sharedMaterial=plumage;
        var tip=new GameObject("Dark wingtip feathers");tip.transform.SetParent(pivot.transform,false);tip.transform.localPosition=new Vector3(side*.95f,-.025f,-.12f);tip.transform.localScale=new Vector3(side*.35f,.8f,.65f);tip.AddComponent<MeshFilter>().sharedMesh=BirdWing();tip.AddComponent<MeshRenderer>().sharedMaterial=dark;
        for(int feather=0;feather<5;feather++){var detail=HumanPart(pivot.transform,"Layered flight feather",PrimitiveType.Capsule,new Vector3(side*(.45f+feather*.21f),.015f,-.13f-feather*.045f),new Vector3(.1f,.3f,.055f),feather>2?dark:plumage);detail.transform.localRotation=Quaternion.Euler(82,side*18,side*-24);}
      }
      for(int i=-1;i<=1;i++){var tail=HumanPart(root,"Tail flight feather",PrimitiveType.Capsule,new Vector3(i*.09f,-.02f,-.59f),new Vector3(.13f,.24f,.05f),dark);tail.transform.localRotation=Quaternion.Euler(90,i*15,0);}
      return wings;
    }
    void StartBirdEgg(float duration){
      ReleaseBirdEgg();EnsureEggTexture();EnsureActionVisuals();eggStart=Time.unscaledTime;eggUntil=eggStart+1.1f+duration;
      var camera=Get<Camera>(Get<GameManager>(car,"gameManager").camControl,"cam");if(!camera)return;
      eggBird=new GameObject("Gift egg delivery bird");eggBird.transform.SetParent(camera.transform,false);eggBird.transform.localScale=Vector3.one*.48f;eggBird.transform.localRotation=Quaternion.Euler(0,90,0);
      eggWings=BirdModel(eggBird.transform,EggBirdMaterial(new Color(.96f,.96f,.91f)),EggBirdMaterial(new Color(.12f,.17f,.2f)),EggBirdMaterial(new Color(1,.69f,.06f)));
      fallingEgg=HumanPart(camera.transform,"Falling gift egg",PrimitiveType.Sphere,new Vector3(0,1,4),new Vector3(.17f,.24f,.17f),EggBirdMaterial(new Color(1,.96f,.84f)));fallingEgg.SetActive(false);UpdateBirdEgg();
    }
    void UpdateBirdEgg(){
      if(menuOpen||!eggBird)return;float age=Time.unscaledTime-eggStart;eggBird.transform.localPosition=new Vector3(Mathf.Lerp(-3.6f,3.6f,age/1.3f),1.35f,4);
      for(int i=0;i<eggWings.Length;i++)eggWings[i].localRotation=Quaternion.Euler(0,0,(i==0?1:-1)*Mathf.Sin(age*12)*32);
      if(fallingEgg){float t=Mathf.Clamp01((age-.55f)/.55f);fallingEgg.SetActive(age>=.55f&&age<1.1f);fallingEgg.transform.localPosition=new Vector3(Mathf.Lerp(-.55f,0,t),Mathf.Lerp(1.1f,0,t*t),Mathf.Lerp(3.8f,.35f,t*t));fallingEgg.transform.Rotate(90*Time.unscaledDeltaTime,0,100*Time.unscaledDeltaTime);}
      if(age>1.35f)ReleaseBirdEgg();
    }
    void ReleaseBirdEgg(){if(eggBird)Destroy(eggBird);if(fallingEgg)Destroy(fallingEgg);eggBird=fallingEgg=null;eggWings=null;foreach(var material in eggBirdMaterials){actionMaterials.Remove(material);Destroy(material);}eggBirdMaterials.Clear();}
  }
}
