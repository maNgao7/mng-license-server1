using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject meteor,meteorRock,meteorFire,meteorImpact;Mesh meteorMesh;Vector3 meteorFrom,meteorTarget;float meteorAge,meteorDelay;bool meteorHit;
    readonly System.Collections.Generic.List<Material> meteorMaterials=new System.Collections.Generic.List<Material>();
    Material MeteorMaterial(Color color){var material=ActionMaterial(color);meteorMaterials.Add(material);return material;}
    void StartMeteor(Vector3 target){
      ReleaseMeteor();EnsureActionVisuals();meteorTarget=target+Vector3.up*.7f;meteorFrom=target+Vector3.up*10+car.transform.forward*24+car.transform.right*7;
      meteor=new GameObject("Incoming gift meteor");meteorRock=GameObject.CreatePrimitive(PrimitiveType.Sphere);Destroy(meteorRock.GetComponent<Collider>());meteorRock.name="Glowing meteor";meteorRock.transform.SetParent(meteor.transform,false);meteorRock.transform.position=meteorFrom;meteorRock.transform.localScale=Vector3.one*2;
      var rock=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));rock.color=new Color(.19f,.16f,.18f);if(rock.HasProperty("_Smoothness"))rock.SetFloat("_Smoothness",.12f);actionMaterials.Add(rock);meteorMaterials.Add(rock);meteorRock.GetComponent<Renderer>().sharedMaterial=rock;
      meteorMesh=meteorRock.GetComponent<MeshFilter>().mesh;var vertices=meteorMesh.vertices;for(int i=0;i<vertices.Length;i++){var v=vertices[i];vertices[i]=v*(1+.17f*Mathf.Sin(v.x*23+v.y*11)*Mathf.Cos(v.z*17));}meteorMesh.vertices=vertices;meteorMesh.RecalculateNormals();meteorMesh.RecalculateBounds();
      var hot=MeteorMaterial(new Color(1,.52f,.035f));
      for(int i=0;i<12;i++){var normal=Random.onUnitSphere;var fragment=GameObject.CreatePrimitive(PrimitiveType.Cube);Destroy(fragment.GetComponent<Collider>());fragment.transform.SetParent(meteorRock.transform,false);fragment.transform.localPosition=normal*.46f;fragment.transform.localRotation=Quaternion.FromToRotation(Vector3.up,normal);fragment.transform.localScale=new Vector3(.055f,.045f,.38f);fragment.GetComponent<Renderer>().sharedMaterial=hot;}
      meteorFire=new GameObject("Meteor fire tail");meteorFire.transform.SetParent(meteor.transform,false);meteorFire.transform.position=meteorFrom;meteorFire.transform.rotation=Quaternion.FromToRotation(Vector3.up,(meteorFrom-meteorTarget).normalized);meteorFire.transform.localScale=new Vector3(.9f,6,.9f);meteorFire.AddComponent<MeshFilter>().sharedMesh=Cone();meteorFire.AddComponent<MeshRenderer>().sharedMaterial=hot;
      var fireCore=new GameObject("White hot meteor core");fireCore.transform.SetParent(meteorFire.transform,false);fireCore.transform.localScale=new Vector3(.65f,.8f,.65f);fireCore.AddComponent<MeshFilter>().sharedMesh=Cone();fireCore.AddComponent<MeshRenderer>().sharedMaterial=MeteorMaterial(new Color(1,.93f,.5f));
      var trail=meteorRock.AddComponent<TrailRenderer>();trail.time=.4f;trail.startWidth=1.9f;trail.endWidth=.05f;trail.minVertexDistance=.12f;trail.sharedMaterial=MeteorMaterial(new Color(1,.45f,.08f));trail.startColor=new Color(1,.9f,.3f);trail.endColor=new Color(1,.08f,.02f,0);
      meteorImpact=new GameObject("Meteor shock wave");meteorImpact.transform.SetParent(meteor.transform,false);meteorImpact.transform.position=meteorTarget;
      var ring=meteorImpact.AddComponent<LineRenderer>();ring.loop=true;ring.useWorldSpace=false;ring.positionCount=64;ring.widthMultiplier=.18f;ring.sharedMaterial=MeteorMaterial(new Color(1,.8f,.15f));
      for(int i=0;i<64;i++){float a=i*Mathf.PI*2/64;ring.SetPosition(i,new Vector3(Mathf.Cos(a),.05f,Mathf.Sin(a)));}meteorImpact.SetActive(false);
      meteorAge=0;meteorDelay=.8f;meteorHit=false;
    }
    void UpdateMeteor(){
      if(!meteor||menuOpen)return;meteorAge+=Time.unscaledDeltaTime;
      if(meteorAge<.75f){float t=Mathf.SmoothStep(0,1,meteorAge/.75f);meteorRock.transform.position=Vector3.Lerp(meteorFrom,meteorTarget,t);meteorFire.transform.position=meteorRock.transform.position;meteorFire.transform.localScale=new Vector3(.9f,5+Mathf.Sin(meteorAge*45)*.8f,.9f);meteorRock.transform.Rotate(new Vector3(170,90,120)*Time.unscaledDeltaTime,Space.Self);}
      else{
        if(!meteorHit){meteorHit=true;meteorRock.SetActive(false);meteorFire.SetActive(false);meteorImpact.SetActive(true);}
        float t=(meteorAge-.75f)/.65f;meteorImpact.transform.localScale=Vector3.one*(1+t*7);var ring=meteorImpact.GetComponent<LineRenderer>();ring.widthMultiplier=Mathf.Max(0,.25f*(1-t));
        if(t>=1)ReleaseMeteor();
      }
    }
    void ReleaseMeteor(){if(meteor)Destroy(meteor);meteor=meteorRock=meteorFire=meteorImpact=null;if(meteorMesh)Destroy(meteorMesh);meteorMesh=null;meteorAge=meteorDelay=0;meteorHit=false;foreach(var material in meteorMaterials){actionMaterials.Remove(material);if(material)Destroy(material);}meteorMaterials.Clear();}
  }
}
