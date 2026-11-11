using System.Globalization;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private bool giftCatalogOpen;
    private bool selectingForwardGift;
    private bool selectingRocketGift;
    private void MenuBack()
    {
        GUIUtility.keyboardControl=0;
        if(giftCatalogOpen)
        {giftCatalogOpen=false;selectingForwardGift=false;selectingRocketGift=false;return;}
        TogglePanel();
    }
    private string giftSpeedInput="5",likeGainInput="10",followGainInput="10",forwardMetresInput="100";
    private string rocketMetresInput="70";
    private void RefreshActionInputs()
    {
        giftSpeedInput=settings.GiftSpeedPerCoin.ToString("0.##",CultureInfo.InvariantCulture);
        likeGainInput=settings.LikeSpeedGain.ToString("0.##",CultureInfo.InvariantCulture);
        followGainInput=settings.FollowSpeedGain.ToString("0.##",CultureInfo.InvariantCulture);
        forwardMetresInput=settings.ForwardGiftMetres.ToString("0",CultureInfo.InvariantCulture);
        rocketMetresInput=settings.RocketGiftMetres.ToString("0",CultureInfo.InvariantCulture);
    }
    private float ActionNumber(Rect rect,ref string text,float current,float min,float max)
    {
        text=Input(rect,text,7);
        return float.TryParse(text.Replace(',','.'),NumberStyles.Float,CultureInfo.InvariantCulture,out var n)&&float.IsFinite(n)?Math.Clamp(n,min,max):current;
    }
    private void DrawActionsTab()
    {
        Label(48,302,720,34,"Yayın eylemleri",heading);
        if(Button(new Rect(978,298,254,38),"Hediye listesi")){selectingForwardGift=false;selectingRocketGift=false;giftCatalogOpen=true;giftPage=0;}
        Fill(new Rect(48,350,566,222),Surface);
        Fill(new Rect(638,350,594,222),Surface);
        Fill(new Rect(48,350,566,3),Accent);
        Fill(new Rect(638,350,594,3),new Color(1,.74f,.18f));
        GUI.enabled=!startRequested&&!Running&&!RoundTransitioning;
        Label(72,360,460,30,"Katılım",new GUIStyle(body){fontStyle=FontStyle.Bold,fontSize=18});
        Label(72,403,300,25,"Hediye giriş bedeli",body);
        entryFeeInput=Input(new Rect(420,396,110,34),entryFeeInput,6);
        if(int.TryParse(entryFeeInput,out var fee))settings.EntryFeeCoins=Math.Clamp(fee,0,100000);
        Label(542,403,60,25,"coin",small);
        if(Button(new Rect(72,444,30,30),settings.LikesEnter?"✓":"",settings.LikesEnter))settings.LikesEnter=!settings.LikesEnter;
        Label(114,447,275,25,"Beğeniyle katılım",body);
        likeInput=Input(new Rect(420,442,110,34),likeInput,6);
        if(int.TryParse(likeInput,out var likes))settings.LikeThreshold=Math.Clamp(likes,1,100000);
        Label(542,447,60,25,"adet",small);
        if(Button(new Rect(72,490,30,30),settings.FollowsEnter?"✓":"",settings.FollowsEnter))settings.FollowsEnter=!settings.FollowsEnter;
        Label(114,493,350,25,"Takiple katılım",body);
        Label(72,540,500,24,"Başlangıç aracı  Murat 131  /  50 km/sa",small);

        Label(662,360,460,30,"Hız artışı",new GUIStyle(body){fontStyle=FontStyle.Bold,fontSize=18});
        Label(662,403,290,25,"Hediye gücü",body);
        settings.GiftSpeedPerCoin=ActionNumber(new Rect(1036,396,110,34),ref giftSpeedInput,settings.GiftSpeedPerCoin,.01f,10);
        Label(1158,403,60,25,"x",small);
        Label(662,447,350,25,"Her "+settings.LikeThreshold+" beğeni",body);
        settings.LikeSpeedGain=ActionNumber(new Rect(1036,442,110,34),ref likeGainInput,settings.LikeSpeedGain,0,750);
        Label(1158,447,65,25,"km/sa",small);
        Label(662,493,290,25,"İlk takip",body);
        settings.FollowSpeedGain=ActionNumber(new Rect(1036,488,110,34),ref followGainInput,settings.FollowSpeedGain,0,750);
        Label(1158,493,65,25,"km/sa",small);
        Label(662,540,540,24,"Azalan getiri · hedef üst sınır 1500 km/sa",small);
        GUI.enabled=true;
        Fill(new Rect(48,590,1184,114),Surface);
        Fill(new Rect(48,590,3,114),Accent);
        Label(72,595,600,26,"İleri ışınlan · Uzay gemisi ve roket",new GUIStyle(body){fontStyle=FontStyle.Bold,fontSize=17});
        var selected=gifts.FirstOrDefault(g=>g.Id==settings.ForwardGiftId);
        if(selected!=null)Picture(new Rect(72,626,32,32),"gifts/"+selected.Id+".png");
        Label(115,628,330,28,"Uzay gemisi · "+(selected?.TrName??"Seçilmedi"));
        if(Button(new Rect(465,624,160,32),"Hediye seç")){selectingForwardGift=true;selectingRocketGift=false;giftCatalogOpen=true;giftPage=0;giftSearch="";}
        GUI.enabled=settings.ForwardGiftId.Length>0;
        if(Button(new Rect(637,624,75,32),"Sil"))settings.ForwardGiftId="";
        GUI.enabled=true;
        Label(750,628,180,28,"İleri mesafe",body);
        settings.ForwardGiftMetres=ActionNumber(new Rect(925,624,112,32),ref forwardMetresInput,settings.ForwardGiftMetres,20,300);
        Label(1050,628,150,28,"metre / hediye",small);
        var rocket=gifts.FirstOrDefault(g=>g.Id==settings.RocketGiftId);
        if(rocket!=null)Picture(new Rect(72,666,32,32),"gifts/"+rocket.Id+".png");
        Label(115,668,330,28,"Roket · "+(rocket?.TrName??"Seçilmedi"));
        if(Button(new Rect(465,664,160,32),"Hediye seç")){selectingForwardGift=false;selectingRocketGift=true;giftCatalogOpen=true;giftPage=0;giftSearch="";}
        GUI.enabled=settings.RocketGiftId.Length>0;
        if(Button(new Rect(637,664,75,32),"Sil"))settings.RocketGiftId="";
        GUI.enabled=true;
        Label(750,668,180,28,"İleri mesafe",body);
        settings.RocketGiftMetres=ActionNumber(new Rect(925,664,112,32),ref rocketMetresInput,settings.RocketGiftMetres,20,300);
        Label(1050,668,150,28,"metre / hediye",small);
    }
    private void DrawGiftMath(float x,float y,GiftItem gift,string fallback)
    {
        Fill(new Rect(x,y,251,90),Surface);
        if(gift!=null)Picture(new Rect(x+12,y+14,45,45),"gifts/"+gift.Id+".png");
        Label(x+69,y+11,172,25,gift?.TrName??fallback);
        Label(x+69,y+43,172,30,(gift?.Coins??1)+" coin · +"+RaceEconomy.GiftSpeedGain(gift?.Coins??1,settings.GiftSpeedPerCoin).ToString("0.#")+" km/sa",new GUIStyle(body){fontStyle=FontStyle.Bold});
    }
    private void DrawGiftCatalog()
    {
        Fill(new Rect(24,20,1232,760),Back);
        Label(54,40,820,38,selectingRocketGift?"Roket · hediye seç":selectingForwardGift?"İleri ışınlan · hediye seç":"Hediye listesi",heading);
        if(Button(new Rect(1050,38,170,42),"← Geri",true)){MenuBack();return;}
        var search=Input(new Rect(54,94,1166,40),giftSearch,80,"Hediye adı veya coin değeri");
        if(search!=giftSearch){giftSearch=search;giftPage=0;}
        var matches=gifts.Where(g=>string.IsNullOrWhiteSpace(giftSearch)||(g.TrName+" "+g.Name+" "+g.Coins).Contains(giftSearch,StringComparison.OrdinalIgnoreCase)).OrderBy(g=>g.Coins).ThenBy(g=>g.Name).ToArray();
        var pages=Math.Max(1,(matches.Length+7)/8);giftPage=Math.Clamp(giftPage,0,pages-1);
        Label(115,151,470,25,"HEDİYE",small);Label(672,151,210,25,"COIN",small);Label(900,151,290,25,"HIZ DEĞERİ",small);
        for(var j=0;j<8&&giftPage*8+j<matches.Length;j++)
        {
            var gift=matches[giftPage*8+j];var y=187+j*59;
            Fill(new Rect(54,y,1166,54),gift.Id==chosenGift?new Color(.06f,.25f,.24f):Surface);
            Picture(new Rect(65,y+6,40,40),"gifts/"+gift.Id+".png");
            Label(120,y+13,490,30,string.IsNullOrEmpty(gift.TrName)?gift.Name:gift.TrName);
            Label(672,y+13,180,30,gift.Coins.ToString("N0"));
            Label(900,y+13,210,30,"+"+RaceEconomy.GiftSpeedGain(gift.Coins,settings.GiftSpeedPerCoin).ToString("0.#")+" km/sa");
            if(Button(new Rect(1124,y+9,83,36),"Seç"))
            {
                if(selectingForwardGift){settings.ForwardGiftId=gift.Id;selectingForwardGift=false;}
                if(selectingRocketGift){settings.RocketGiftId=gift.Id;selectingRocketGift=false;}
                chosenGift=gift.Id;
                giftCatalogOpen=false;
            }
        }
        Label(54,679,500,27,matches.Length+" hediye · "+(giftPage+1)+" / "+pages,small);
        if(Button(new Rect(1028,676,86,36),"←"))giftPage=Math.Max(0,giftPage-1);
        if(Button(new Rect(1130,676,86,36),"→"))giftPage=Math.Min(pages-1,giftPage+1);
        Label(54,735,1140,25,"Katılmış araç için katkı · Hedef hız 1500 km/sa üst sınırına kadar birikir.",small);
    }
}
