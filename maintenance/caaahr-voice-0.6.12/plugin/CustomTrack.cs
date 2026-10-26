using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    const int CustomMap=-2;
    static bool IsCustomMap(int map){return map==CustomMap;}
    readonly Vector3 trackOrigin=new Vector3(0,1200,0);
    GameObject trackRoot,staticTrack;
    MapManager trackMap;MapManager[] originalMaps;
    Transform originalGoal,trackGoal;
    readonly List<Material> trackMaterials=new List<Material>();
    Font trackFont;Mesh coneMesh;
    Material trackGlow;
    TrackLayout trackLayout;int trackGroundLayer,staticPartCount;Transform staticGroup;
    float loadingProgress;string loadingStage="Oyun hazırlanıyor";
    int builtLength,builtMap=-1;bool trackFinished,autoDrive;
    // The old autoDrive field now selects keyboard mode, never unattended throttle.
    float? qaManualAxis;
    float ManualAxis {get{return qaActive&&qaManualAxis.HasValue?qaManualAxis.Value:(Input.GetKey(KeyCode.W)?1:0)-(Input.GetKey(KeyCode.S)?1:0);}}
    float trackImpactUntil,nextTrackImpact;
    string lengthText="1000";
    GUIStyle hudTitle,hudSmall;
    bool CustomActive {get{return IsCustomMap(activeMap)&&trackRoot&&trackRoot.activeSelf;}}
    float TrackProgress {get{return car?Mathf.Clamp(car.transform.position.z-trackOrigin.z,0,builtLength):0;}}
    int TrackRemaining {get{return Mathf.CeilToInt(Mathf.Max(0,builtLength-TrackProgress));}}
    int WantedLength {get{int length;return int.TryParse(lengthText,out length)&&length>=100&&length<=5000?length:0;}}
    MapManager[] NativeMaps(GameManager gm){return originalMaps??gm.mapsObjs;}
    void RememberNativeMaps(GameManager gm){if(originalMaps==null){originalMaps=(MapManager[])gm.mapsObjs.Clone();originalGoal=gm.Goal;}}
    void RestoreNativeMaps(GameManager gm){if(originalMaps!=null)gm.mapsObjs=(MapManager[])originalMaps.Clone();if(originalGoal)gm.Goal=originalGoal;if(trackRoot)trackRoot.SetActive(false);}
    void BindTrack(GameManager gm,int length){
      RememberNativeMaps(gm);
      gm.mapsObjs=(MapManager[])originalMaps.Clone();gm.mapsObjs[0]=trackMap;gm.Goal=trackGoal;
      trackMap.CheckPoints=originalMaps[0].CheckPoints;
      trackFinished=false;roundRestartAt=0;roundNumber=1;autoDrive=false;trackImpactUntil=nextTrackImpact=trackRunupUntil=0;
      lastTrackLaunch=-100;
      foreach(var burst in finishBursts)if(burst)burst.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
    }
    Material TrackMaterial(Color color){
      Shader shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard")??Shader.Find("Unlit/Color");
      var material=new Material(shader);material.color=color;if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",.12f);trackMaterials.Add(material);return material;
    }
    GameObject TrackBox(string name,Vector3 position,Vector3 size,Material material,bool solid=true,bool batching=true){
      var item=GameObject.CreatePrimitive(PrimitiveType.Cube);item.name=name;item.transform.SetParent(batching?StaticParent():trackRoot.transform,false);
      item.transform.localPosition=position;item.transform.localScale=size;item.GetComponent<Renderer>().sharedMaterial=material;
      if(!solid)Destroy(item.GetComponent<Collider>());
      return item;
    }
    Transform StaticParent(){
      if(!staticGroup||staticPartCount>=160){var group=new GameObject("Static geometry batch");group.transform.SetParent(staticTrack.transform,false);staticGroup=group.transform;staticPartCount=0;}
      staticPartCount++;return staticGroup;
    }
    void TrackText(string text,Vector3 position,float width,float height){
      var item=new GameObject("Track label "+text);item.transform.SetParent(trackRoot.transform,false);item.transform.localPosition=position;
      var label=item.AddComponent<TextMesh>();label.text=text;label.font=trackFont;label.fontSize=64;label.characterSize=.1f;label.anchor=TextAnchor.MiddleCenter;label.alignment=TextAlignment.Center;label.color=Color.white;
      item.GetComponent<MeshRenderer>().sharedMaterial=trackFont.material;
      var fit=item.AddComponent<TrackLabelFit>();fit.Width=width;fit.Height=height;
    }
    Mesh Cone(){
      if(coneMesh)return coneMesh;const int sides=8;var vertices=new Vector3[sides*6];var triangles=new int[vertices.Length];
      for(int i=0;i<sides;i++){
        float a=i*Mathf.PI*2/sides,b=(i+1)*Mathf.PI*2/sides;var first=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));var next=new Vector3(Mathf.Cos(b),0,Mathf.Sin(b));
        int n=i*6;vertices[n]=Vector3.up;vertices[n+1]=next;vertices[n+2]=first;vertices[n+3]=Vector3.zero;vertices[n+4]=first;vertices[n+5]=next;
      }
      for(int i=0;i<triangles.Length;i++)triangles[i]=i;
      coneMesh=new Mesh{name="TikMnG low-poly cone"};coneMesh.vertices=vertices;coneMesh.triangles=triangles;coneMesh.RecalculateNormals();coneMesh.RecalculateBounds();return coneMesh;
    }
    IEnumerator BuildTrack(int length){
      int variant=selectedMap;
      if(trackRoot&&builtLength==length&&builtMap==variant)yield break;
      ReleaseTrackGeometry();builtLength=length;trackLayout=new TrackLayout(length);loadingStage="Yol ve atlama bölümleri hazırlanıyor";loadingProgress=.1f;yield return null;
      int mask=Get<LayerMask>(car,"groundLayerM").value,ground=0;if(mask!=-1)for(int i=0;i<32;i++)if((mask&(1<<i))!=0){ground=i;break;}trackGroundLayer=ground;
      trackRoot=new GameObject("TikMnG Düz Parkur");trackRoot.transform.position=trackOrigin;
      staticTrack=new GameObject("Statik parkur");staticTrack.transform.SetParent(trackRoot.transform,false);
      var asphalt=TrackMaterial(new Color(.17f,.2f,.21f));var grass=TrackMaterial(new Color(.17f,.39f,.24f));
      var white=TrackMaterial(new Color(.96f,.97f,.92f));var yellow=TrackMaterial(new Color(1,.78f,.08f));
      var red=TrackMaterial(new Color(.88f,.12f,.17f));var cyan=TrackMaterial(new Color(.03f,.75f,.76f));
      var concrete=TrackMaterial(new Color(.65f,.7f,.69f));var bark=TrackMaterial(new Color(.31f,.25f,.2f));var leaves=TrackMaterial(new Color(.15f,.4f,.22f));
      var lightLeaves=TrackMaterial(new Color(.32f,.54f,.24f));var steel=TrackMaterial(new Color(.16f,.23f,.27f));var rock=TrackMaterial(new Color(.44f,.51f,.49f));
      trackGlow=TrackMaterial(new Color(.85f,1,1));if(trackGlow.HasProperty("_EmissionColor")){trackGlow.EnableKeyword("_EMISSION");trackGlow.SetColor("_EmissionColor",new Color(.5f,.8f,.85f)*1.5f);}
      yield return BuildTrackRoad(length,asphalt,grass,white,yellow,red,steel,cyan);
      foreach(float side in new[]{-1f,1f}){
        float begin=-32;
        foreach(float crossing in trackLayout.Crossings){BuildTrackBarrier(side,begin,crossing-12,concrete);begin=crossing+12;}
        BuildTrackBarrier(side,begin,length+33,concrete);
        for(int z=-20;z<length+35;z+=12){if(!trackLayout.SideRoadAt(z,15))TrackBox("Bariyer rengi",new Vector3(side*14.35f,1.3f,z),new Vector3(.48f,.14f,6),red,false);if(z%120==4)yield return null;}
      }
      for(int z=100;z<length;z+=100){TrackBox("Mesafe direği",new Vector3(15,1.8f,z),new Vector3(.15f,4,.15f),concrete,false);TrackBox("Mesafe panosu",new Vector3(15,4,z),new Vector3(4,1.5f,.2f),asphalt,false);}
      trackFont=Font.CreateDynamicFontFromOSFont("Segoe UI",64);
      for(int z=100;z<length;z+=100)TrackText(z+" m",new Vector3(15,4,z-.13f),3.5f,1.1f);
      loadingStage="Çevre hazırlanıyor";loadingProgress=.25f;yield return BuildTrackScenery(length,bark,leaves,lightLeaves,rock,steel,concrete,white,red,cyan,yellow);
      loadingStage="Engeller ve rampalar yerleştiriliyor";loadingProgress=.6f;
      foreach(var jump in trackLayout.Jumps){BuildJumpSection(jump,asphalt,steel,white,red,cyan,yellow);yield return null;}
      for(int i=0;i<trackLayout.Obstacles.Count;i++){var placement=trackLayout.Obstacles[i];BuildTrackObstacle(placement.Z,placement.Kind,asphalt,steel,white,red,cyan,yellow);if(i%3==0)yield return null;}
      foreach(float z in trackLayout.Hurdles){BuildLowHurdle(z,steel,white,red,yellow);yield return null;}
      foreach(float z in trackLayout.Crossings){BuildTrafficCrossing(z,asphalt,steel,white,red,yellow);yield return null;}
      BuildRaceVenue(length,asphalt,steel,white,cyan,yellow,red,concrete,grass);
      var spawn=new GameObject("Parkur başlangıcı");spawn.transform.SetParent(trackRoot.transform,false);spawn.transform.localPosition=new Vector3(0,1.5f,0);
      var goal=new GameObject("Parkur hedefi");goal.transform.SetParent(trackRoot.transform,false);goal.transform.localPosition=new Vector3(0,1.5f,length);trackGoal=goal.transform;
      trackMap=trackRoot.AddComponent<MapManager>();trackMap.SpawnPoint=spawn.transform;trackMap.CheckPoints=new CheckPoint[0];
      loadingStage="Parkur son kontrolleri yapılıyor";
      for(int i=0;i<staticTrack.transform.childCount;i++){StaticBatchingUtility.Combine(staticTrack.transform.GetChild(i).gameObject);loadingProgress=.75f+.15f*(i+1)/staticTrack.transform.childCount;yield return null;}trackRoot.SetActive(false);
      Logger.LogInfo("Custom track built: "+length+" metres; ground layer "+ground);
      builtMap=variant;
    }
    void BuildTrackBarrier(float side,float start,float end,Material material){if(end<=start)return;TrackBox("Güvenlik bariyeri",new Vector3(side*14.35f,.6f,(start+end)/2),new Vector3(.45f,1.3f,end-start),material);}
    void ToggleAutoDrive(){if(!Ready||menuOpen||trackFinished)return;autoDrive=!autoDrive;Throttle=0;notice=autoDrive?"WASD sürüş: W ileri, S geri · O: sesle sürüş":"Sesle sürüş açık · O: WASD";noticeUntil=Time.unscaledTime+3;}
    void UpdateTrack(){
      if(trackFinished){UpdateRoundEnd();return;}
      if(!CustomActive||!enteredGame||!car||startingGame||giftMotion||trafficCrash)return;
      if(car.transform.position.y<trackOrigin.y-8&&!menuOpen&&Focused&&Ready&&!Jailed&&!MotionSafe){ReleaseCage();float safe=trackLayout.RecoveryZ(TrackProgress);MoveOnTrack(safe-TrackProgress);notice="Atlama öncesindeki güvenli yere dönüldü.";noticeUntil=Time.unscaledTime+3;}
      if(!menuOpen&&Get<bool>(car,"spawned")&&TrackProgress>=builtLength-.5f)FinishRound();
    }
    public bool TrackObstaclePaused(float z){return menuOpen||!Ready||startingGame||trackFinished||!CustomActive||Mathf.Abs(TrackProgress-z)>180;}
    public void HitTrackBumper(bool forward){
      if(!CustomActive||!Ready||menuOpen||Jailed||MotionSafe)return;
      if(forward&&Time.unscaledTime<nextTrackImpact)return;
      if(forward)nextTrackImpact=Time.unscaledTime+.8f;
      if(!forward&&Time.unscaledTime<shieldUntil){shieldUntil=0;notice="Kalkan engeli durdurdu ve kırıldı.";noticeUntil=Time.unscaledTime+3;return;}
      var rb=Get<Rigidbody>(car,"rb");
      if(forward){EnterTrackRunup();rb.linearVelocity=new Vector3(rb.linearVelocity.x,Mathf.Max(0,rb.linearVelocity.y),30);notice="Hızlanma pedi: 8 saniye";}
      else{MoveOnTrack(-10);rb.linearVelocity=new Vector3(0,5,-8);trackImpactUntil=Time.unscaledTime+.65f;notice="Engel: 10 m geri";}
      noticeUntil=Time.unscaledTime+3;
    }
    public Rigidbody TrackBody {get{return CustomActive&&Ready&&!menuOpen&&!Jailed&&!MotionSafe&&!trafficCrash?Get<Rigidbody>(car,"rb"):null;}}
    void MoveOnTrack(float distance){
      if(Jailed)throw new InvalidOperationException("Araba kafeste.");
      ReleaseMenuPause();
      var position=car.transform.position;position.x=Mathf.Clamp(position.x,-12,12);float z=trackLayout.SafeZ(Mathf.Clamp(TrackProgress+distance,0,builtLength),distance>=0);position.z=trackOrigin.z+z;position.y=trackOrigin.y+trackLayout.SurfaceY(z,position.x)+1.5f;
      car.SetPosAndRot(position,Quaternion.identity);var rb=Get<Rigidbody>(car,"rb");rb.linearVelocity=Vector3.zero;rb.angularVelocity=Vector3.zero;
    }
    void DrawTrackHud(){
      if(!CustomActive)return;PrepareStyles();LoadWins();
      if(hudTitle==null){hudTitle=new GUIStyle(titleStyle){alignment=TextAnchor.MiddleCenter,fontSize=28};hudTitle.normal.textColor=Color.white;hudSmall=new GUIStyle(smallStyle){alignment=TextAnchor.MiddleCenter};hudSmall.normal.textColor=new Color(.8f,.88f,.9f);}
      float width=Mathf.Min(520,Screen.width-20),left=(Screen.width-width)/2;
      HudShadowLabel(new Rect(left,40,width,38),trackFinished?"HEDEFE ULAŞTIN!":"Hedefe kalan: "+TrackRemaining+" m",hudTitle,Color.white);
      HudShadowLabel(new Rect(left,80,width,24),"TikMnG Düz Parkur  ·  "+builtLength+" m",hudSmall,new Color(.85f,.94f,.96f));
      HudShadowLabel(new Rect(left,109,width,38),"WIN "+wins+" / "+WinTarget,hudTitle,new Color(.35f,1,.62f));
    }
    void HudShadowLabel(Rect rect,string text,GUIStyle style,Color color){var previous=GUI.color;GUI.color=new Color(0,0,0,.95f);if(style.fontSize>=24){for(int x=-1;x<=1;x+=2)for(int y=-1;y<=1;y+=2)GUI.Label(new Rect(rect.x+x,rect.y+y,rect.width,rect.height),text,style);}else GUI.Label(new Rect(rect.x+1,rect.y+1,rect.width,rect.height),text,style);GUI.color=color;GUI.Label(rect,text,style);GUI.color=previous;}
    void ReleaseTrackGeometry(){ReleaseAudience();if(trackRoot){trackRoot.SetActive(false);Destroy(trackRoot);}trackRoot=null;trackMap=null;builtMap=-1;staticGroup=null;staticPartCount=0;foreach(var mesh in landscapeMeshes)Destroy(mesh);landscapeMeshes.Clear();foreach(var mesh in rampMeshes)Destroy(mesh);rampMeshes.Clear();foreach(var material in trackMaterials)Destroy(material);trackMaterials.Clear();if(trackFont)Destroy(trackFont);trackFont=null;}
    void ReleaseTrack(){var gm=car?Get<GameManager>(car,"gameManager"):null;if(gm&&originalMaps!=null)RestoreNativeMaps(gm);ReleaseTrackGeometry();if(coneMesh)Destroy(coneMesh);}
  }
  public class TrackLabelFit : MonoBehaviour {
    public float Width,Height;
    void LateUpdate(){
      var renderer=GetComponent<MeshRenderer>();var size=renderer.localBounds.size;
      if(size.x<.001f||size.y<.001f)return;
      transform.localScale=Vector3.one*Mathf.Min(Width/size.x,Height/size.y);enabled=false;
    }
  }
}
