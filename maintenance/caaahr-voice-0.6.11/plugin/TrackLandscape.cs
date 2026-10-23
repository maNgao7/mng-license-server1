using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly List<Mesh> landscapeMeshes=new List<Mesh>();
    void LandscapeMountain(float side,float z,int seed,Material grass,Material rock,Material snow){
      const int steps=22;var vertices=new Vector3[(steps+1)*(steps+1)];var triangles=new[]{new List<int>(),new List<int>(),new List<int>()};
      float center=side*(150+(seed%3)*22),height=42+(seed%5)*8;
      for(int row=0;row<=steps;row++)for(int col=0;col<=steps;col++){
        float u=col/(float)steps*2-1,v=row/(float)steps*2-1;
        float envelope=Mathf.Clamp01(1-Mathf.Pow(Mathf.Abs(u),1.5f))*Mathf.Clamp01(1-Mathf.Pow(Mathf.Abs(v),1.5f));
        float ridge=.45f+.32f*Mathf.PerlinNoise(u*1.8f+seed*3.7f,v*1.6f+seed*.9f)+.23f*Mathf.Abs(Mathf.Sin(u*4+v*3+seed));
        float worldZ=z+v*78,valley=1;foreach(float crossing in trackLayout.Crossings)valley=Mathf.Min(valley,Mathf.SmoothStep(0,1,Mathf.InverseLerp(13,38,Mathf.Abs(worldZ-crossing))));
        vertices[row*(steps+1)+col]=new Vector3(center+u*68,-2+height*envelope*ridge*valley,worldZ);
      }
      for(int row=0;row<steps;row++)for(int col=0;col<steps;col++){
        int a=row*(steps+1)+col,b=a+1,c=a+steps+1,d=c+1;
        float y=(vertices[a].y+vertices[b].y+vertices[c].y)/3,slope=Vector3.Angle(Vector3.Cross(vertices[c]-vertices[a],vertices[b]-vertices[a]),Vector3.up);
        int material=y>height*.59f?2:slope>39?1:0;
        triangles[material].AddRange(new[]{a,c,b,b,c,d});
      }
      var mesh=new Mesh{name="Sculpted mountain ridge"};mesh.vertices=vertices;mesh.subMeshCount=3;for(int i=0;i<3;i++)mesh.SetTriangles(triangles[i].ToArray(),i);mesh.RecalculateNormals();mesh.RecalculateBounds();landscapeMeshes.Add(mesh);
      var node=new GameObject("Layered mountain landscape");node.transform.SetParent(StaticParent(),false);node.AddComponent<MeshFilter>().sharedMesh=mesh;node.AddComponent<MeshRenderer>().sharedMaterials=new[]{grass,rock,snow};
    }
    void BuildBirds(int length,Material feathers){
      var pale=new Material(Shader.Find("Universal Render Pipeline/Unlit")??Shader.Find("Sprites/Default"));pale.color=new Color(.78f,.81f,.8f);trackMaterials.Add(pale);var gold=TrackMaterial(new Color(.85f,.55f,.08f));
      for(int i=0;i<9;i++){
        var root=new GameObject("Circling bird");root.transform.SetParent(trackRoot.transform,false);root.transform.localScale=Vector3.one*1.8f;var bird=root.AddComponent<TrackBird>();bird.Owner=this;bird.Center=trackOrigin+new Vector3((i%2==0?-1:1)*(12+i*2),11+i%3*2,Mathf.Min(length,i<3?25+i*15:45+i*length/10f));bird.Phase=i*1.7f;
        bird.Wings=BirdModel(root.transform,pale,feathers,gold);
      }
    }
  }
  public class TrackBird:MonoBehaviour {
    public VoiceDrive Owner;public Vector3 Center;public float Phase;public Transform[] Wings;float age;
    void Update(){if(!Owner||Owner.MenuOpen)return;age+=Time.deltaTime;float angle=age*.24f+Phase;transform.position=Center+new Vector3(Mathf.Cos(angle)*22,Mathf.Sin(angle*.6f)*2,Mathf.Sin(angle)*27);transform.rotation=Quaternion.LookRotation(new Vector3(-Mathf.Sin(angle)*22,0,Mathf.Cos(angle)*27));for(int i=0;i<2;i++)Wings[i].localRotation=Quaternion.Euler(0,0,(i==0?1:-1)*Mathf.Sin(age*6+Phase)*24);}
  }
}
