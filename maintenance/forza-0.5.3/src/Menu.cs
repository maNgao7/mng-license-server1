using System.Text.Json;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed class GiftItem
{
    public string Id {get;set;}="";
    public string Name {get;set;}="";
    public string TrName {get;set;}="";
    public int Coins {get;set;}
}

public sealed partial class ArcadeDirector
{
    private List<GiftItem> gifts=new();
    private readonly Dictionary<string,Texture2D> textures=new();
    private readonly Dictionary<string,Texture2D> tintedTiles=new();
    private string giftSearch="",likeInput="100",entryFeeInput="1";
    private int tab;
    private int giftPage;
    private string chosenGift;
    private GUIStyle heading,body,small,big,button,field,muted,center;
    private static readonly Color Back=new(0.055f,0.063f,0.075f),Surface=new(0.09f,0.102f,0.118f),Line=new(0.18f,0.2f,0.23f);
    private static readonly Color Ink=new(0.94f,0.96f,0.98f),Subtle=new(0.58f,0.65f,0.71f),Accent=new(0.08f,0.82f,0.76f),Red=new(0.98f,0.24f,0.36f);

    private void LoadCatalog()
    {
        gifts=JsonSerializer.Deserialize<List<GiftItem>>(File.ReadAllText(Path.Combine(PathsRoot,"assets","gifts.json")),jsonOptions)??new();
        likeInput=settings.LikeThreshold.ToString();RefreshActionInputs();
        entryFeeInput=settings.EntryFeeCoins.ToString();
    }
    private void PrepareStyles()
    {
        if(heading!=null)return;
        heading=new GUIStyle(GUI.skin.label){fontSize=25,fontStyle=FontStyle.Bold};heading.normal.textColor=Ink;
        body=new GUIStyle(GUI.skin.label){fontSize=15};body.normal.textColor=Ink;
        small=new GUIStyle(body){fontSize=12};small.normal.textColor=Subtle;
        muted=new GUIStyle(body);muted.normal.textColor=Subtle;
        big=new GUIStyle(heading){fontSize=64};
        center=new GUIStyle(body){alignment=TextAnchor.MiddleCenter};
        button=new GUIStyle(GUI.skin.button){fontSize=14,fontStyle=FontStyle.Bold,border=new RectOffset(4,4,4,4)};
        button.normal.background=Tile(Surface);button.hover.background=Tile(new Color(0.17f,0.2f,0.23f));button.active.background=Tile(new Color(0.12f,0.4f,0.39f));button.normal.textColor=Ink;
        field=new GUIStyle(GUI.skin.textField){fontSize=15,padding=new RectOffset(12,12,9,9)};
        field.normal.background=Tile(new Color(.12f,.24f,.32f));field.focused.background=Tile(new Color(.17f,.34f,.44f));field.normal.textColor=Ink;field.focused.textColor=Color.white;
    }
    private Texture2D Tile(Color color)
    {
        var key=$"{color.r:R},{color.g:R},{color.b:R},{color.a:R}";
        if(tintedTiles.TryGetValue(key,out var texture)&&texture!=null)return texture;
        texture=new Texture2D(1,1){hideFlags=HideFlags.DontUnloadUnusedAsset};texture.SetPixel(0,0,color);texture.Apply();tintedTiles[key]=texture;return texture;
    }
    private void Fill(Rect rect,Color color)
    {
        var old=GUI.color;GUI.color=color;
        GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=old;
    }
    private void Label(float x,float y,float w,float h,string text,GUIStyle style=null)=>GUI.Label(new Rect(x,y,w,h),text,style??body);
    private bool Button(Rect rect,string text,bool primary=false)
    {
        var hovered=GUI.enabled&&rect.Contains(Event.current.mousePosition);
        var danger=text=="Sil"||text=="×";
        var border=primary?Accent:danger?Red:new Color(.38f,.64f,.78f);
        var surface=primary?Accent:danger?new Color(.35f,.12f,.17f):new Color(.15f,.30f,.39f);
        if(!GUI.enabled){border=Line;surface=Surface;}
        else if(hovered)surface=Color.Lerp(surface,Color.white,.14f);
        Fill(rect,border);Fill(new Rect(rect.x+1,rect.y+1,rect.width-2,rect.height-2),surface);
        var style=new GUIStyle(center){fontStyle=FontStyle.Bold};
        style.normal.textColor=!GUI.enabled?Subtle:primary?Back:Ink;
        return GUI.Button(rect,text,style);
    }
    private string Input(Rect rect,string value,int limit,string placeholder="")
    {
        Fill(rect,GUI.enabled?new Color(.95f,.70f,.30f):Line);
        var result=GUI.TextField(new Rect(rect.x+2,rect.y+2,rect.width-4,rect.height-4),value,limit,field);
        if(result.Length==0 && placeholder.Length>0)GUI.Label(new Rect(rect.x+12,rect.y+9,rect.width-24,rect.height-12),placeholder,muted);
        return result;
    }
    private Texture2D Asset(string file)
    {
        if(textures.TryGetValue(file,out var texture)&&texture!=null)return texture;
        var path=Path.Combine(PathsRoot,"assets",file);
        if(!File.Exists(path))return null;
        byte[] bytes;
        try {bytes=File.ReadAllBytes(path);}
        catch(IOException){return null;}
        texture=new Texture2D(2,2){hideFlags=HideFlags.DontUnloadUnusedAsset,filterMode=FilterMode.Trilinear};
        if(!ImageConversion.LoadImage(texture,bytes)) {Plugin.Output.LogWarning("Image failed: "+file);UObj.Destroy(texture);return null;}
        textures[file]=texture;return texture;
    }
    private void Picture(Rect rect,string file)
    {
        var texture=Asset(file);if(texture!=null)GUI.DrawTexture(rect,texture,ScaleMode.ScaleToFit,true);
    }
    private GUIStyle countdownStyle,greenFlagStyle;
    private void DrawCountdown()
    {
        var now=Time.realtimeSinceStartup;
        var waiting=phase=="countdown"&&countdownEnd>0;
        var justStarted=phase=="racing"&&now-greenFlagAt<.75f;
        if(!waiting&&!justStarted)return;
        countdownStyle??=new GUIStyle(big){fontSize=110,alignment=TextAnchor.MiddleCenter,clipping=TextClipping.Overflow};
        greenFlagStyle??=new GUIStyle(countdownStyle){fontSize=72};
        var cue=waiting?RaceAudioPolicy.CountdownLabel(now-countdownStartedAt,countdownEnd-countdownStartedAt):"BAŞLA";
        Label(240,300,800,200,cue,cue=="BAŞLA"?greenFlagStyle:countdownStyle);
    }
    public void OnGUI()
    {
        PrepareStyles();GUI.depth=-10000;
        var oldMatrix=GUI.matrix;var oldColor=GUI.color;var oldEnabled=GUI.enabled;GUI.enabled=true;
        var scale=Mathf.Min(Screen.width/1280f,Screen.height/800f);
        GUI.matrix=Matrix4x4.TRS(new Vector3((Screen.width-1280*scale)/2,(Screen.height-800*scale)/2,0),Quaternion.identity,new Vector3(scale,scale,1));
        GUI.color=Color.white;GUI.backgroundColor=Color.white;GUI.contentColor=Color.white;
        try
        {
        if(phase=="podium")DrawRoundPodium();
        else if(phase=="resetting")DrawRoundReset();
        else if(!cameraReady)DrawLoading();
        else
        {
            // ESC settings are modeless: keep the race HUD, identities and live speeds
            // rendering behind the settings overlay while cars and audio continue.
            if(!showPanel&&!trackMapOpen&&!IntroActive)
            {
                Fill(new Rect(633,399,14,2),Color.white);Fill(new Rect(639,393,2,14),Color.white);
                DrawRacingHud(scale);
            }
            DrawCountdown();
            if(showPanel&&!quickSettingsOpen)
            {
                if(giftCatalogOpen)DrawGiftCatalog();
                else DrawFullMenu();
            }
            if(trackMapOpen&&!quickSettingsOpen)DrawTrackMap();
            DrawPresentationFade();
            if(quickSettingsOpen)DrawQuickSettings();
        }
        }
        finally { GUI.matrix=oldMatrix;GUI.color=oldColor;GUI.enabled=oldEnabled; }
    }

    private void DrawLoading()
    {
        // Use the same Turkish classics artwork in both launcher and in-game loading stages.
        var art=Asset("loading-turkish-classics-v2.png");
        if(art!=null)GUI.DrawTexture(new Rect(0,0,1280,800),art,ScaleMode.ScaleAndCrop);
        else Fill(new Rect(0,0,1280,800),Back);
        Fill(new Rect(0,0,1280,800),new Color(0.015f,0.025f,0.04f,0.32f));
        Picture(new Rect(586,174,108,108),"logo.png");
        Label(240,315,800,100,"Turkish Forza 0.5",new GUIStyle(big){fontSize=66,alignment=TextAnchor.MiddleCenter});
        Label(240,424,800,55,"TikMnG",new GUIStyle(heading){fontSize=28,alignment=TextAnchor.MiddleCenter});
        Fill(new Rect(566,496,70,5),Red);Fill(new Rect(640,496,70,5),Accent);
        Label(240,661,800,40,error==null?"Pist hazırlanıyor":"Pist açılamadı",new GUIStyle(body){fontSize=20,alignment=TextAnchor.MiddleCenter});
        Fill(new Rect(415,718,450,4),new Color(1,1,1,0.2f));
        var offset=(Mathf.Sin(Time.realtimeSinceStartup*2.5f)+1)*145;
        Fill(new Rect(415+offset,718,160,4),Accent);
        if(error!=null){Label(88,756,1000,30,error,small);if(Button(new Rect(1070,700,120,40),"Çıkış"))Application.Quit();}
    }

    private void DrawFullMenu()
    {
        Fill(new Rect(-2000,-2000,6000,6000),new Color(0.01f,0.015f,0.02f,0.8f));
        Fill(new Rect(24,20,1232,760),Back);
        Fill(new Rect(24,20,1232,3),Accent);
        Picture(new Rect(44,38,60,40),"logo.png");
        Label(120,39,570,36,"Turkish Forza 0.5 · TikMnG",heading);
        Label(120,77,570,25,"TSUKUBA  /  "+entries.Count+" araç  /  "+(Running?"Yarışta":"Başlangıç çizgisi"),small);
        Fill(new Rect(967,52,8,8),liveStatus=="connected"?Accent:Red);
        Label(985,44,180,32,liveStatus=="connected"?"Yayına bağlı":"Bağlı değil",small);
        if(Button(new Rect(1194,39,40,40),"×"))TogglePanel();
        Fill(new Rect(44,115,1192,1),Line);

        Label(48,136,88,34,"Yayıncı",muted);
        settings.Username=Input(new Rect(140,133,355,42),settings.Username,64,"@kullanıcıadı");
        GUI.enabled=liveStatus is not ("connecting" or "connected");
        if(Button(new Rect(506,133,130,42),"Bağlan",true))SendLive("connect");
        GUI.enabled=liveStatus!="disconnected";
        if(Button(new Rect(646,133,155,42),"Bağlantıyı kes"))SendLive("disconnect");
        GUI.enabled=true;
        Label(48,184,1160,27,liveMessage,small);
        var titles=new[]{"Hediye ve eylemler","Araçlar","Yarış ayarları","Test alanı","Kürsü"};
        for(var i=0;i<titles.Length;i++)
        {
            var x=48+i*239;
            if(Button(new Rect(x,225,228,42),titles[i]))tab=i;
            if(tab==i)Fill(new Rect(x,267,228,3),Accent);
        }
        Fill(new Rect(48,284,1184,1),Line);
        if(tab==0)DrawActionsTab();else if(tab==1)DrawCarTab();else if(tab==2)DrawCameraTab();else if(tab==3)DrawTestTab();else DrawPodiumTab();
        Fill(new Rect(48,722,1184,1),Line);
        Label(48,737,650,30,string.IsNullOrEmpty(error)?"TikMnG · Yerel test sürümü":error,small);
        if(Button(new Rect(918,733,130,34),"Kaydet")) {SaveSettings();liveMessage="Ayarlar kaydedildi.";}
        if(Button(new Rect(690,733,210,34),"Ses ayarları"))ToggleQuickSettings();
        if(Button(new Rect(1060,733,172,34),"Piste dön",true))TogglePanel();
        GUI.enabled=true;
    }


    private int garagePage;
    private void DrawCarTab()
    {
        Label(48,302,650,35,"Araç garajı",heading);
        Label(680,309,350,27,"Görünüş · hedef hıza göre değişir",small);
        var types=new[]{"Klasik sedan","Şahin sedan","Hatchback","Sedan","Sportif sedan","Spor coupé","Spor coupé","G Kasa SUV","Orta motor spor","Hibrit süper","Açık teker"};
        const int pageSize=8;
        var pageCount=(ModelIds.Length+pageSize-1)/pageSize;
        garagePage=Math.Clamp(garagePage,0,pageCount-1);
        Label(1050,309,95,27,(garagePage+1)+" / "+pageCount,small);
        if(Button(new Rect(1150,302,34,30),"‹"))garagePage=Math.Max(0,garagePage-1);
        if(Button(new Rect(1190,302,34,30),"›"))garagePage=Math.Min(pageCount-1,garagePage+1);
        var start=garagePage*pageSize;
        var end=Math.Min(ModelIds.Length,start+pageSize);
        for(var i=start;i<end;i++)
        {
            var local=i-start;var x=48+(local%4)*298;var y=352+(local/4)*163;
            Fill(new Rect(x,y,282,150),Surface);
            Picture(new Rect(x+2,y+2,278,98),"vehicles/"+ModelIds[i]+".png");
            Fill(new Rect(x+10,y+10,26,25),i<4?Accent:Red);
            Label(x+10,y+10,26,25,(i+1).ToString(),new GUIStyle(center){normal={textColor=Back},fontStyle=FontStyle.Bold});
            Label(x+12,y+101,196,25,ModelNames[i],new GUIStyle(body){fontSize=15,fontStyle=FontStyle.Bold});
            Label(x+205,y+102,67,25,(i+1)+" / "+ModelIds.Length,small);
            Label(x+12,y+125,258,22,RaceEconomy.ModelSpeeds[i]+(i<ModelIds.Length-1?"–"+(RaceEconomy.ModelSpeeds[i+1]-1):"+")+" km/sa · "+types[i],small);
        }
        GUI.enabled=!Running;
        if(Button(new Rect(954,677,263,34),"11 aracı göster")) {try{SpawnModelFleet();error=null;}catch(Exception ex){error=ex.Message;}}
        GUI.enabled=true;
        if(Button(new Rect(676,677,263,34),"Test aracı ekle")) {try{SpawnTest();error=null;}catch(Exception ex){error=ex.Message;}}
    }

    private void DrawCameraTab()
    {
        Label(48,305,570,36,"Kamera",heading);
        Label(48,360,270,32,"Görüş açısı",muted);
        if(Button(new Rect(330,354,50,42),"−"))settings.FieldOfView=Math.Max(60,settings.FieldOfView-2);
        Label(398,358,100,36,settings.FieldOfView+"°",heading);
        if(Button(new Rect(510,354,50,42),"+"))settings.FieldOfView=Math.Min(110,settings.FieldOfView+2);
        Label(48,432,270,32,"Viraj temposu",muted);
        if(Button(new Rect(330,426,50,42),"−"))settings.CornerPacePercent=Math.Max(50,settings.CornerPacePercent-2);
        Label(398,430,100,36,settings.CornerPacePercent.ToString("0")+"%",heading);
        if(Button(new Rect(510,426,50,42),"+"))settings.CornerPacePercent=Math.Min(100,settings.CornerPacePercent+2);
        Label(48,482,512,48,"Yüksek değer virajlarda daha az fren yapar.",small);
        Fill(new Rect(609,305,1,350),Line);
        Label(48,624,550,30,"Pistte "+entries.Count+" / 12 araç"+(pendingJoins.Count>0?" · "+pendingJoins.Count+" kişi sırada":""),muted);
        if(awaitingQueueAdmission&&Button(new Rect(48,665,280,36),"Bekleyen katılımları al",true))AdmitWaitingParticipants();
        Label(665,305,555,36,"Yarış ve göstergeler",heading);
        Label(665,361,170,32,"Tur hedefi",muted);
        GUI.enabled=!Running && !startRequested && !RoundTransitioning;
        if(Button(new Rect(856,354,44,42),"−"))settings.Laps=Math.Max(1,settings.Laps-1);
        Label(918,358,65,36,settings.Laps.ToString(),heading);
        if(Button(new Rect(995,354,44,42),"+"))settings.Laps=Math.Min(99,settings.Laps+1);
        GUI.enabled=true;
        if(Button(new Rect(665,432,32,32),settings.ShowMinimap?"✓":"",settings.ShowMinimap))settings.ShowMinimap=!settings.ShowMinimap;
        Label(712,433,410,32,"Küçük harita");
        if(Button(new Rect(665,488,32,32),settings.ShowLapCounter?"✓":"",settings.ShowLapCounter))settings.ShowLapCounter=!settings.ShowLapCounter;
        Label(712,489,410,32,"Tur sayacı");
        if(Button(new Rect(665,544,32,32),settings.ShowSpeedometer?"✓":"",settings.ShowSpeedometer))settings.ShowSpeedometer=!settings.ShowSpeedometer;
        Label(712,545,410,32,"Hız göstergesi");
        Label(665,601,550,32,"Araç üstü profil, kullanıcı adı ve hız açık",small);
    }
    private string testViewer="test_izleyici";
    private void Simulate(string type,int likes=0)
    {
        var gift=gifts.FirstOrDefault(g=>g.Id==(chosenGift??"5655"));
        var json=JsonSerializer.Serialize(new{type,username=testViewer,nickname="Test izleyicisi",likeCount=likes,eventId="local-test:"+Guid.NewGuid().ToString("N"),
            giftId=gift?.Id??"5655",coins=gift?.Coins??1,repeatCount=1});
        using var doc=JsonDocument.Parse(json);HandleLiveEvent(doc.RootElement);
    }
    private void DrawTestTab()
    {
        Label(48,305,900,36,"Test alanı",heading);
        Label(48,361,220,32,"Test izleyicisi",muted);
        testViewer=Input(new Rect(280,354,350,42),testViewer,40);
        if(Button(new Rect(48,435,210,44),"100 beğeni"))Simulate("like",100);
        if(Button(new Rect(274,435,210,44),"1 coin hediye"))
        {
            using var gift=JsonDocument.Parse(JsonSerializer.Serialize(new{type="gift",username=testViewer,nickname="Test izleyicisi",coins=1,repeatCount=1,eventId="local-test:"+Guid.NewGuid().ToString("N")}));
            HandleLiveEvent(gift.RootElement);
        }
        if(Button(new Rect(500,435,210,44),"Takip"))Simulate("follow");
        if(Button(new Rect(726,435,210,44),"Seçili hediyeyi test et"))Simulate("gift");
        Label(48,510,1000,32,"Birikmiş beğeni: "+likeTotals.GetValueOrDefault(testViewer)+" / "+settings.LikeThreshold,body);
        var viewer=entries.FirstOrDefault(e=>e.Username==testViewer);
        Label(48,552,1000,32,viewer==null?"Yayın: @"+settings.Username+" · "+liveStatus:ModelNames[viewer.Level]+" · Hedef "+viewer.TopSpeedKph.ToString("0.#")+" km/sa · "+viewer.Slot+". sıra",body);
        Label(48,594,1000,32,"Pistte "+entries.Count+" araç · "+(Running?"Yarışta":"Başlangıç çizgisinde"),body);
        if(Button(new Rect(48,638,260,42),"İleri ışınlanmayı test et",true))RunForwardGiftTest(testViewer,true);
        if(Button(new Rect(48,690,260,34),"Roketi test et",true))RunForwardGiftTest(testViewer,true,true);
        Label(328,644,880,30,viewer==null?liveMessage:viewer.PendingForwardJumps+" bekleyen · "+viewer.ForwardJumpsUsed+" kullanılan · "+settings.ForwardGiftMetres.ToString("0")+" metre",small);
    }

    private void RunForwardGiftTest(string username,bool present,bool rocket=false)
    {
        var key=(username??"").Trim().TrimStart('@').ToLowerInvariant();
        if(!System.Text.RegularExpressions.Regex.IsMatch(key,"^[a-z0-9_.]{1,64}$"))
        {liveMessage="Geçerli bir test kullanıcısı seçin.";return;}
        testViewer=key;
        if(RoundTransitioning||!AddViewerCar(key,"Test izleyicisi",testPortrait:true))
        {liveMessage="Test aracı için pist bekleniyor.";return;}
        var entry=entries.First(e=>e.Username==key);
        if(present&&!Running&&!startRequested)
        {
            if(showPanel)TogglePanel();Follow(entry);BeginForwardRescue(entry,rocket,true);
            liveMessage=rocket?"Roket ön izlemesi":"Uzay gemisi ön izlemesi";return;
        }
        if(rocket)entry.PendingRocketJumps=ForwardGiftMath.Add(entry.PendingRocketJumps,1);
        else entry.PendingForwardJumps=ForwardGiftMath.Add(entry.PendingForwardJumps,1);
        liveMessage=Running?"İleri ışınlanma testi sıraya alındı.":"İleri ışınlanma testi · Start bekliyor";
        if(present){if(showPanel)TogglePanel();Follow(entry);}
    }
}
