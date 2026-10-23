using UnityEngine;
using System.Collections;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GameObject TrackCone(string name,Vector3 position,Vector3 scale,Material material){
      var item=new GameObject(name);item.transform.SetParent(StaticParent(),false);item.transform.localPosition=position;item.transform.localScale=scale;
      item.AddComponent<MeshFilter>().sharedMesh=Cone();item.AddComponent<MeshRenderer>().sharedMaterial=material;return item;
    }
    void TrackTree(float x,float z,float height,Material bark,Material leaves,Material top){
      TrackBox("Pine trunk",new Vector3(x,height*.2f,z),new Vector3(.65f,height*.5f,.65f),bark,false);
      for(int i=0;i<3;i++){float radius=height*(.28f-i*.055f);TrackCone("Layered pine canopy",new Vector3(x,height*(.18f+i*.2f),z),new Vector3(radius,height*.48f,radius),i==2?top:leaves);}
    }
    void TrackLamp(float side,float z,Material steel){
      TrackBox("Track lamp pole",new Vector3(side*16.4f,4.3f,z),new Vector3(.24f,8.6f,.24f),steel,false);
      TrackBox("Track lamp arm",new Vector3(side*15.7f,8.5f,z),new Vector3(1.6f,.2f,.24f),steel,false);
      TrackBox("Track lamp housing",new Vector3(side*15,8.45f,z),new Vector3(1.2f,.28f,.8f),steel,false);
      TrackBox("Track lamp luminous panel",new Vector3(side*15,8.28f,z),new Vector3(1,.06f,.65f),trackGlow,false);
    }
    void TrackFlag(float x,float z,Material steel,Material cloth){
      TrackBox("Flag pole",new Vector3(x,4,z),new Vector3(.1f,8,.1f),steel,false);
      TrackBox("Race banner",new Vector3(x+1.1f,6.4f,z),new Vector3(2.2f,2.6f,.08f),cloth,false);
      TrackBox("Race banner stripe",new Vector3(x+1.1f,6.1f,z-.05f),new Vector3(2.2f,.3f,.03f),trackGlow,false);
    }
    void TrackStand(float side,float z,Material concrete,Material steel,Material white,Material red,Material cyan){
      for(int tier=0;tier<3;tier++){
        float x=side*(23+tier*2.2f),y=.65f+tier*1.1f;
        TrackBox("Grandstand tier",new Vector3(x,y,z),new Vector3(2.5f,.8f,22),concrete,false);
        for(int seat=0;seat<11;seat++){
          var color=(seat+tier)%3==0?red:cyan;
          TrackBox("Grandstand seat",new Vector3(x,y+.65f,z-10+seat*2),new Vector3(1.1f,.22f,1.4f),color,false);
          TrackBox("Grandstand backrest",new Vector3(x+side*.45f,y+1,z-10+seat*2),new Vector3(.2f,.65f,1.4f),color,false);
        }
      }
      foreach(float end in new[]{-1f,1f})TrackBox("Grandstand roof support",new Vector3(side*29,3.8f,z+end*11),new Vector3(.32f,8,.32f),steel,false);
      var roof=TrackBox("Grandstand canopy",new Vector3(side*25.3f,7.8f,z),new Vector3(10,.28f,25),white,false);roof.transform.localRotation=Quaternion.Euler(0,0,side*7);
      TrackBox("Grandstand fascia",new Vector3(side*20.4f,7.1f,z),new Vector3(.2f,.8f,25),cyan,false);
      TrackFlag(side*19,z-16,steel,red);TrackFlag(side*19,z+16,steel,cyan);
      RegisterStandSeats(side,z);
    }
    void TrackPit(float z,Material concrete,Material steel,Material white,Material cyan){
      TrackBox("Pit forecourt",new Vector3(28,-.35f,z),new Vector3(23,.25f,22),concrete,false);
      TrackBox("Pit building",new Vector3(31,2.2f,z),new Vector3(10,5.4f,17),white,false);
      TrackBox("Pit roof",new Vector3(30.5f,5,z),new Vector3(12,.4f,19),steel,false);
      TrackBox("Pit roof accent",new Vector3(24.4f,4.6f,z),new Vector3(.22f,.7f,19),cyan,false);
      for(int i=-1;i<=1;i++){
        TrackBox("Pit garage door",new Vector3(25.94f,1.7f,z+i*5.2f),new Vector3(.08f,3.5f,4.2f),steel,false);
        for(int line=0;line<4;line++)TrackBox("Garage door slat",new Vector3(25.86f,.6f+line*.7f,z+i*5.2f),new Vector3(.06f,.06f,4),concrete,false);
      }
      TrackFlag(20,z-12,steel,cyan);
    }
    void TrackBalloons(float side,float z,Material[] colors,Material stringMaterial){
      for(int i=0;i<5;i++){
        Vector3 bottom=new Vector3(side*18,.4f,z),top=new Vector3(side*18+(i%3-1)*1.1f,6+(i%2)*1.3f,z+(i/3)*1.2f);
        VenueBeam("Balloon ribbon",bottom,top,.035f,stringMaterial);
        var balloon=GameObject.CreatePrimitive(PrimitiveType.Sphere);Destroy(balloon.GetComponent<Collider>());balloon.name="Festival balloon";balloon.transform.SetParent(StaticParent(),false);balloon.transform.localPosition=top;balloon.transform.localScale=new Vector3(1.25f,1.6f,1.25f);balloon.GetComponent<Renderer>().sharedMaterial=colors[i%colors.Length];
      }
    }
    IEnumerator BuildTrackScenery(int length,Material bark,Material leaves,Material top,Material rock,Material steel,Material concrete,Material white,Material red,Material cyan,Material yellow){
      var hill=TrackMaterial(new Color(.3f,.46f,.29f));var distant=TrackMaterial(new Color(.38f,.5f,.53f));var snow=TrackMaterial(new Color(.84f,.9f,.94f));
      var pink=TrackMaterial(new Color(.95f,.22f,.49f));var balloonColors=new[]{cyan,yellow,red,pink,white};
      foreach(float side in new[]{-1f,1f}){
        for(int z=-50,index=0;z<length+180;z+=90,index++){
          LandscapeMountain(side,z,index+7,hill,distant,snow);
          if(index%10==0)yield return null;
        }
        for(int z=-5,index=0;z<length+65;z+=28,index++){
          if(trackLayout.SideRoadAt(z,28))continue;
          float x=side*(34+(index%4)*6);TrackTree(x,z,7+(index%3)*1.4f,bark,leaves,top);
          if(index%2==0)TrackTree(x+side*8,z+9,6,bark,leaves,top);
          if(index%3==0){var stone=TrackCone("Roadside rock",new Vector3(side*19,-.3f,z+7),new Vector3(2.4f,2.3f,3.6f),rock);stone.transform.localRotation=Quaternion.Euler(0,index*23,0);}
          if(index%10==0)yield return null;
        }
        for(int z=10,index=0;z<length+20;z+=56,index++){if(!trackLayout.SideRoadAt(z,18))TrackLamp(side,z,steel);if(index%12==0)yield return null;}
        for(int z=30;z<length;z+=84){
          if(trackLayout.SideRoadAt(z,20))continue;
          TrackBox("Trackside advertising board",new Vector3(side*16.8f,1.9f,z),new Vector3(.2f,2.1f,7),side<0?cyan:red,false);
          for(int line=0;line<3;line++)TrackBox("Board speed mark",new Vector3(side*16.65f,1.9f,z-2+line*2),new Vector3(.06f,1.1f,.4f),white,false);
          if(z%336==30)yield return null;
        }
      }
      TrackPit(8,concrete,steel,white,cyan);
      BuildBirds(length,steel);
      for(int z=64,index=0;z<length;z+=180,index++){if(trackLayout.SideRoadAt(z,48))continue;float side=index%2==0?-1:1;TrackStand(side,z,concrete,steel,white,red,cyan);TrackBalloons(side,z-24,balloonColors,white);yield return null;}
      for(int z=28;z<length;z+=84){
        if(trackLayout.SideRoadAt(z,16))continue;
        foreach(float x in new[]{-13.1f,13.1f}){
          TrackBox("Cone foot",new Vector3(x,.08f,z),new Vector3(.7f,.16f,.7f),steel,false);
          TrackCone("Traffic cone",new Vector3(x,.16f,z),new Vector3(.3f,1.05f,.3f),yellow);
          TrackCone("Traffic cone reflector",new Vector3(x,.65f,z),new Vector3(.17f,.22f,.17f),white);
        }
        if(z%336==28)yield return null;
      }
    }
  }
}
