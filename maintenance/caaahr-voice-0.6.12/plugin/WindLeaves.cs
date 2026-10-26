using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    Mesh leafMesh;float windLeafTravel;
    Mesh LeafMesh(){
      if(leafMesh)return leafMesh;
      Vector3[] outline={new Vector3(-.72f,0,0),new Vector3(-.38f,.02f,.12f),new Vector3(-.43f,0,.28f),new Vector3(-.12f,.04f,.22f),new Vector3(.04f,0,.4f),new Vector3(.24f,.03f,.24f),new Vector3(.48f,0,.25f),new Vector3(.41f,.02f,.1f),new Vector3(.76f,0,0),new Vector3(.41f,.02f,-.1f),new Vector3(.48f,0,-.25f),new Vector3(.24f,.03f,-.24f),new Vector3(.04f,0,-.4f),new Vector3(-.12f,.04f,-.22f),new Vector3(-.43f,0,-.28f),new Vector3(-.38f,.02f,-.12f)};
      var vertices=new Vector3[outline.Length+1];var colors=new Color[vertices.Length];var indices=new int[outline.Length*6];
      for(int i=0;i<outline.Length;i++){vertices[i]=outline[i];colors[i]=new Color(.72f,.72f,.72f,1);int n=i*6;indices[n]=outline.Length;indices[n+1]=i;indices[n+2]=(i+1)%outline.Length;indices[n+3]=outline.Length;indices[n+4]=(i+1)%outline.Length;indices[n+5]=i;}
      vertices[outline.Length]=new Vector3(0,.12f,0);colors[outline.Length]=Color.white;
      leafMesh=new Mesh{name="Serrated folded wind leaf"};leafMesh.vertices=vertices;leafMesh.colors=colors;leafMesh.triangles=indices;leafMesh.RecalculateNormals();leafMesh.RecalculateBounds();return leafMesh;
    }
    void BuildWindLeaves(){
      var colors=new[]{ActionMaterial(new Color(.95f,.58f,.08f)),ActionMaterial(new Color(.36f,.65f,.12f)),ActionMaterial(new Color(.8f,.22f,.06f)),ActionMaterial(new Color(.87f,.76f,.16f))};
      var veinMaterial=ActionMaterial(new Color(.32f,.23f,.055f));
      for(int i=0;i<48;i++){
        var node=new GameObject("Windblown leaf");node.transform.SetParent(windVisual.transform,false);node.AddComponent<MeshFilter>().sharedMesh=LeafMesh();node.AddComponent<MeshRenderer>().sharedMaterial=colors[i%colors.Length];float size=.32f+(i%7)*.065f;node.transform.localScale=new Vector3(size,size,size*(.7f+(i%3)*.2f));
        for(int vein=0;vein<5;vein++){
          var detail=new GameObject(vein==0?"Leaf stem and midrib":"Leaf vein");detail.transform.SetParent(node.transform,false);var line=detail.AddComponent<LineRenderer>();line.useWorldSpace=false;line.sharedMaterial=veinMaterial;line.widthMultiplier=vein==0?.025f:.014f;line.positionCount=3;
          float direction=vein%2==0?1:-1;
          line.SetPosition(0,vein==0?new Vector3(-.88f,.025f,0):new Vector3(-.22f+(vein/3)*.35f,.13f,0));
          line.SetPosition(1,new Vector3(0,.135f,vein==0?0:direction*.12f));line.SetPosition(2,vein==0?new Vector3(.69f,.025f,0):new Vector3(.12f+(vein/3)*.25f,.035f,direction*.27f));
        }
      }
    }
    void UpdateWindLeaves(){
      if(!windVisual||!windVisual.activeInHierarchy)return;
      float time=Time.unscaledTime,speed=Mathf.Clamp(.24f+windStrength*.035f,.25f,.65f);
      windLeafTravel=Mathf.Repeat(windLeafTravel+Time.unscaledDeltaTime*speed*windSide,1000);
      for(int i=0;i<windVisual.transform.childCount;i++){
        var leaf=windVisual.transform.GetChild(i);float phase=Mathf.Repeat(windLeafTravel*(1+i%5*.1f)+i*.173f,1),flutter=time*(5+i%4)+i*2.3f;
        float x=Mathf.Lerp(-10,10,phase),y=.35f+(i%8)*.48f+Mathf.Sin(flutter*.7f)*.38f+Mathf.Sin(phase*Mathf.PI)*.65f,z=-5+(i%7)*1.65f+Mathf.Cos(flutter*.45f)*.6f;
        leaf.localPosition=new Vector3(x,y,z);leaf.localRotation=Quaternion.Euler(time*(110+i%5*27)+i*19, time*(75+i%3*31)+i*33,Mathf.Sin(flutter)*65+phase*360);
        float fade=Mathf.Clamp01(Mathf.Min(phase,1-phase)*12),size=(.32f+(i%7)*.065f)*fade;leaf.localScale=new Vector3(size,size,size*(.7f+(i%3)*.2f));
      }
    }
  }
}
