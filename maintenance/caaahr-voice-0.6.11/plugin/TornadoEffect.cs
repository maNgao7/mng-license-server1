using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject tornado;Mesh tornadoMesh;float tornadoAge,tornadoDuration,tornadoUntil;Vector3 tornadoGround;AudioSource tornadoAudio;AudioClip tornadoWindClip;
    readonly List<Material> tornadoMaterials=new List<Material>();
    readonly List<Transform> tornadoLeaves=new List<Transform>(),tornadoPuffs=new List<Transform>();
    Material TornadoMaterial(Color color){var material=ShieldGlass(color);tornadoMaterials.Add(material);return material;}
    void StartTornado(Vector3 origin,float duration){
      ReleaseTornado();tornadoDuration=duration;tornadoAge=0;tornadoUntil=Time.unscaledTime+duration;tornadoGround=origin-Vector3.up*1.5f;
      tornado=new GameObject("Spiralling gift tornado");tornado.transform.position=tornadoGround;
      const int rings=28,sides=48;var vertices=new Vector3[(rings+1)*(sides+1)];var indices=new List<int>();
      for(int ring=0;ring<=rings;ring++)for(int side=0;side<=sides;side++){
        float h=ring/(float)rings,a=side*Mathf.PI*2/sides,r=.55f+Mathf.Pow(h,1.5f)*5.2f;vertices[ring*(sides+1)+side]=new Vector3(Mathf.Cos(a)*r+Mathf.Sin(h*4)*.7f,h*18,Mathf.Sin(a)*r);
        if(ring<rings&&side<sides){int n=ring*(sides+1)+side;indices.AddRange(new[]{n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1});}
      }
      tornadoMesh=new Mesh{name="Curved whirlwind funnel"};tornadoMesh.vertices=vertices;tornadoMesh.triangles=indices.ToArray();tornadoMesh.RecalculateNormals();tornado.AddComponent<MeshFilter>().sharedMesh=tornadoMesh;tornado.AddComponent<MeshRenderer>().sharedMaterial=TornadoMaterial(new Color(.32f,.39f,.38f,.32f));
      var swirl=TornadoMaterial(new Color(.72f,.79f,.72f,.23f));
      for(int ribbon=0;ribbon<3;ribbon++){
        var node=new GameObject("Rotating dust ribbon");node.transform.SetParent(tornado.transform,false);var line=node.AddComponent<LineRenderer>();line.useWorldSpace=false;line.positionCount=100;line.widthMultiplier=.18f;line.sharedMaterial=swirl;line.widthCurve=new AnimationCurve(new Keyframe(0,0),new Keyframe(.25f,.8f),new Keyframe(.65f,1),new Keyframe(1,0));
        for(int i=0;i<100;i++){float h=i/99f,a=h*Mathf.PI*3+ribbon*Mathf.PI*2/3,r=.65f+Mathf.Pow(h,1.5f)*5.2f+Mathf.Sin(h*19+ribbon)*.15f;line.SetPosition(i,new Vector3(Mathf.Cos(a)*r+Mathf.Sin(h*4)*.7f,h*18,Mathf.Sin(a)*r));}
      }
      var dust=TornadoMaterial(new Color(.48f,.53f,.46f,.22f));dust.mainTexture=flameTexture;dust.SetTexture("_BaseMap",flameTexture);
      for(int i=0;i<28;i++){var puff=GameObject.CreatePrimitive(PrimitiveType.Quad);Destroy(puff.GetComponent<Collider>());puff.name="Soft swirling dust";puff.transform.SetParent(tornado.transform,false);puff.GetComponent<MeshRenderer>().sharedMaterial=dust;tornadoPuffs.Add(puff.transform);}
      Material amber=TornadoMaterial(new Color(.8f,.48f,.1f)),green=TornadoMaterial(new Color(.38f,.51f,.18f));
      for(int i=0;i<32;i++){var leaf=new GameObject("Spinning tornado leaf");leaf.transform.SetParent(tornado.transform,false);leaf.transform.localScale=Vector3.one*.55f;leaf.AddComponent<MeshFilter>().sharedMesh=LeafMesh();leaf.AddComponent<MeshRenderer>().sharedMaterial=i%2==0?amber:green;tornadoLeaves.Add(leaf.transform);}
      if(!tornadoWindClip){const int rate=22050;var samples=new float[rate*2];var random=new System.Random(73);float low=0;for(int i=0;i<samples.Length;i++){low=low*.93f+((float)random.NextDouble()*2-1)*.07f;samples[i]=low*(.75f+.2f*Mathf.Sin(i/(float)rate*9));}tornadoWindClip=AudioClip.Create("Whirlwind rush",samples.Length,1,rate,false);tornadoWindClip.SetData(samples,0);}
      tornadoAudio=tornado.AddComponent<AudioSource>();tornadoAudio.clip=tornadoWindClip;tornadoAudio.loop=true;tornadoAudio.volume=.55f;tornadoAudio.spatialBlend=0;tornadoAudio.Play();
    }
    void UpdateTornado(){
      if(!tornado)return;tornadoUntil=Time.unscaledTime+Mathf.Max(0,tornadoDuration-tornadoAge);if(menuOpen)return;
      tornadoAge+=Time.unscaledDeltaTime;float fade=Mathf.Min(Mathf.Clamp01(tornadoAge/.3f),Mathf.Clamp01((tornadoDuration-tornadoAge)/.6f));
      if(motionTornado&&giftMotion&&car){Vector3 point=car.transform.position;point.y=CustomActive?trackOrigin.y:tornadoGround.y;tornado.transform.position=point;}
      tornado.transform.localScale=Vector3.one*(.5f+fade*.5f);tornado.transform.Rotate(0,Time.unscaledDeltaTime*170,0);
      for(int i=0;i<tornadoLeaves.Count;i++){var leaf=tornadoLeaves[i];float h=Mathf.Repeat(tornadoAge*.32f+i*.061f,1),a=tornadoAge*7+i*2.4f,r=.8f+h*h*5;leaf.localPosition=new Vector3(Mathf.Cos(a)*r,h*17,Mathf.Sin(a)*r);leaf.localRotation=Quaternion.Euler(tornadoAge*120+i*19,tornadoAge*240+i*31,tornadoAge*180);}
      var manager=car?Get<GameManager>(car,"gameManager"):null;var camera=manager&&manager.camControl?Get<Camera>(manager.camControl,"cam"):null;
      for(int i=0;i<tornadoPuffs.Count;i++){var puff=tornadoPuffs[i];float h=Mathf.Repeat(i/28f+tornadoAge*.13f,1),a=i*2.4f+tornadoAge*3,r=.6f+h*h*5;puff.localPosition=new Vector3(Mathf.Cos(a)*r,h*18,Mathf.Sin(a)*r);puff.localScale=Vector3.one*(1.5f+h*4);if(camera)puff.rotation=camera.transform.rotation;}
      if(tornadoAudio)tornadoAudio.volume=.55f*fade;
      if(tornadoAge>=tornadoDuration)ReleaseTornado();
    }
    void ReleaseTornado(){if(tornadoAudio)tornadoAudio.Stop();tornadoAudio=null;if(tornado)Destroy(tornado);tornado=null;if(tornadoMesh)Destroy(tornadoMesh);tornadoMesh=null;tornadoUntil=0;tornadoLeaves.Clear();tornadoPuffs.Clear();foreach(var material in tornadoMaterials){actionMaterials.Remove(material);Destroy(material);}tornadoMaterials.Clear();}
  }
}
