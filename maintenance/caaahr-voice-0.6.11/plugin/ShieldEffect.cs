using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly List<Mesh> shieldMeshes=new List<Mesh>();
    Material ShieldGlass(Color color){var material=ActionMaterial(color);if(material.HasProperty("_Surface")){material.SetFloat("_Surface",1);material.SetFloat("_SrcBlend",5);material.SetFloat("_DstBlend",10);material.SetFloat("_ZWrite",0);material.SetFloat("_Cull",0);material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");material.renderQueue=3000;}return material;}
    void BuildShieldVisual(){
      shieldVisual=new GameObject("Single hit vehicle protection");shieldVisual.transform.SetParent(actionVisualRoot.transform,false);
      var dome=new GameObject("Subtle protective shell");dome.transform.SetParent(shieldVisual.transform,false);
      const int sides=40,rings=12;var vertices=new Vector3[(rings+1)*(sides+1)];var indices=new List<int>();
      for(int ring=0;ring<=rings;ring++)for(int side=0;side<=sides;side++){float a=side*Mathf.PI*2/sides,h=ring*Mathf.PI*.5f/rings;vertices[ring*(sides+1)+side]=new Vector3(Mathf.Cos(a)*Mathf.Cos(h)*2.05f,.05f+Mathf.Sin(h)*2.5f,Mathf.Sin(a)*Mathf.Cos(h)*2.75f);if(ring<rings&&side<sides){int n=ring*(sides+1)+side;indices.AddRange(new[]{n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2});}}
      var mesh=new Mesh{name="Smooth protection dome"};mesh.vertices=vertices;mesh.triangles=indices.ToArray();mesh.RecalculateNormals();shieldMeshes.Add(mesh);dome.AddComponent<MeshFilter>().sharedMesh=mesh;dome.AddComponent<MeshRenderer>().sharedMaterial=ShieldGlass(new Color(.42f,.83f,1,.035f));
      var badge=new GameObject("Floating protection badge");badge.transform.SetParent(shieldVisual.transform,false);badge.transform.localPosition=new Vector3(-1.4f,2.65f,0);badge.transform.localRotation=Quaternion.Euler(0,180,0);
      Vector3[] outline={new Vector3(-.44f,.5f,0),new Vector3(0,.63f,0),new Vector3(.44f,.5f,0),new Vector3(.4f,-.1f,0),new Vector3(.25f,-.39f,0),new Vector3(0,-.59f,0),new Vector3(-.25f,-.39f,0),new Vector3(-.4f,-.1f,0)};
      ShieldBadgeLayer(badge.transform,"Silver shield edge",outline,1,0,ActionMaterial(new Color(.92f,.98f,1)));
      ShieldBadgeLayer(badge.transform,"Blue shield enamel",outline,.84f,-.025f,ActionMaterial(new Color(.04f,.39f,.77f)));
      var check=new GameObject("Protection check");check.transform.SetParent(badge.transform,false);var line=check.AddComponent<LineRenderer>();line.useWorldSpace=false;line.positionCount=3;line.widthMultiplier=.085f;line.sharedMaterial=ActionMaterial(Color.white);line.SetPositions(new[]{new Vector3(-.22f,.04f,-.06f),new Vector3(-.04f,-.14f,-.06f),new Vector3(.24f,.22f,-.06f)});
    }
    void ShieldBadgeLayer(Transform root,string name,Vector3[] outline,float scale,float z,Material material){var node=new GameObject(name);node.transform.SetParent(root,false);var vertices=new Vector3[outline.Length+1];vertices[0]=new Vector3(0,0,z);var indices=new List<int>();for(int i=0;i<outline.Length;i++){vertices[i+1]=outline[i]*scale+Vector3.forward*z;indices.AddRange(new[]{0,(i+1)%outline.Length+1,i+1,0,i+1,(i+1)%outline.Length+1});}var mesh=new Mesh{name=name};mesh.vertices=vertices;mesh.triangles=indices.ToArray();mesh.RecalculateNormals();shieldMeshes.Add(mesh);node.AddComponent<MeshFilter>().sharedMesh=mesh;node.AddComponent<MeshRenderer>().sharedMaterial=material;}
  }
}
