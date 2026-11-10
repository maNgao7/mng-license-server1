using Il2CppInterop.Runtime.InteropTypes.Arrays;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private readonly Dictionary<string,Texture2D> portraits=new();
    private readonly List<string> renderedCarIdentities=new();
    private GUIStyle hudName,hudSpeed,hudUnit,hudNumber,hudCaption,hudDriverName;
    private void PrepareHudStyles()
    {
        if(hudName!=null)return;
        hudName=new GUIStyle(body){fontSize=14,fontStyle=FontStyle.Bold,alignment=TextAnchor.MiddleCenter,clipping=TextClipping.Clip};
        hudName.normal.textColor=Ink;
        hudSpeed=new GUIStyle(hudName){fontSize=17};
        hudUnit=new GUIStyle(hudName){fontSize=10,fontStyle=FontStyle.Normal};
        hudNumber=new GUIStyle(hudName){fontSize=37};
        hudCaption=new GUIStyle(hudName){fontSize=11};
        hudDriverName=new GUIStyle(hudName){fontSize=17,alignment=TextAnchor.MiddleLeft};
    }
    private Texture2D Portrait(ViewerCar entry)
        =>Portrait(entry?.Avatar);
    private Texture2D Portrait(string avatar)
    {
        if(string.IsNullOrWhiteSpace(avatar))return null;
        var file=ResultsBoardStore.AvatarFile(avatar);
        if(file.Length==0)return null;
        if(portraits.TryGetValue(file,out var image)&&image!=null)return image;
        var path=Path.Combine(control,"live","portraits",file);
        if(!File.Exists(path))return null;
        try
        {
            image=new Texture2D(2,2,TextureFormat.RGBA32,false);
            if(!ImageConversion.LoadImage(image,File.ReadAllBytes(path)))return null;
            var portrait=CirclePortrait(image);
            portraits[file]=portrait;return portrait;
        }
        catch(IOException){return null;}
        catch(UnauthorizedAccessException){return null;}
        finally {if(image!=null)UnityEngine.Object.Destroy(image);}
    }
    private static Texture2D CirclePortrait(Texture2D image)
    {
        var source=image.GetPixels32().ToArray();
        var crop=Math.Min(image.width,image.height);
        var size=Math.Min(512,crop);
        var insetX=(image.width-crop)/2;
        var insetY=(image.height-crop)/2;
        var pixels=new Color32[size*size];
        var radius=size*.5f;
        for(var y=0;y<size;y++)
        for(var x=0;x<size;x++)
        {
            var dx=x+.5f-radius;var dy=y+.5f-radius;
            var coverage=Math.Clamp(radius-MathF.Sqrt(dx*dx+dy*dy),0,1);
            if(coverage==0)continue;
            var color=source[(insetY+y*crop/size)*image.width+insetX+x*crop/size];
            color.a=(byte)Mathf.RoundToInt(color.a*coverage);
            pixels[y*size+x]=color;
        }
        var portrait=new Texture2D(size,size,TextureFormat.RGBA32,false){filterMode=FilterMode.Bilinear,wrapMode=TextureWrapMode.Clamp};
        portrait.SetPixels32(new Il2CppStructArray<Color32>(pixels));
        portrait.Apply(false,false);
        return portrait;
    }
    private bool HasRoundPortrait(string avatar)
    {
        var texture=Portrait(avatar);
        if(texture==null||texture.width!=texture.height)return false;
        var last=texture.width-1;
        return texture.GetPixel(0,0).a==0&&texture.GetPixel(last,0).a==0&&texture.GetPixel(0,last).a==0&&
            texture.GetPixel(last,last).a==0&&texture.GetPixel(last/2,last/2).a>0;
    }
    private void DrawPortrait(ViewerCar entry,Rect rect)
    {
        var rim=Mathf.Min(3f,rect.width*.08f);
        Picture(new Rect(rect.x-rim,rect.y-rim,rect.width+rim*2,rect.height+rim*2),"portrait-ring.png");
        var image=Portrait(entry);
        if(image!=null)GUI.DrawTexture(rect,image,ScaleMode.ScaleToFit,true);
        else GUI.Label(rect,entry.Username.Length>0?entry.Username[..1].ToUpperInvariant():"?",new GUIStyle(hudName){fontSize=Mathf.Clamp(Mathf.RoundToInt(rect.width*.34f),12,44)});
    }
    private void HudText(Rect rect,string text,GUIStyle style,Color? color=null)
    {
        var old=GUI.color;
        GUI.color=new Color(0.015f,0.025f,0.035f,0.85f);
        GUI.Label(new Rect(rect.x+1,rect.y+1,rect.width,rect.height),text,style);
        GUI.color=color??Color.white;GUI.Label(rect,text,style);GUI.color=old;
    }
    private void HudLine(Vector2 start,Vector2 end,float width,Color color)
    {
        var delta=end-start;if(delta.sqrMagnitude<0.001f)return;
        var matrix=GUI.matrix;
        try
        {
            GUI.matrix=matrix*Matrix4x4.TRS(new Vector3(start.x,start.y,0),Quaternion.Euler(0,0,Mathf.Atan2(delta.y,delta.x)*Mathf.Rad2Deg),Vector3.one);
            Fill(new Rect(0,-width/2,delta.magnitude,width),color);
        }
        finally {GUI.matrix=matrix;}
    }
    private void DrawRacingHud(float scale)
    {
        if(view==null)return;
        if(Event.current.type==EventType.Repaint)renderedCarIdentities.Clear();
        PrepareHudStyles();DrawMinimapAndLaps();DrawLiveStandings();
        var offsetX=(Screen.width-1280*scale)/2;
        var offsetY=(Screen.height-800*scale)/2;
        foreach(var entry in entries.Where(IsCarAlive)
            .OrderBy(e=>e==followed?0:1)
            .ThenBy(e=>Vector3.SqrMagnitude(e.Car.transform.position-view.transform.position))
            .ThenBy(e=>e.Slot).ThenBy(e=>e.Username,StringComparer.Ordinal))
        {
            if(!IsCarAlive(entry))continue;
            var target=IdentityTransform(entry).position+Vector3.up*2.0f;
            var point=view.WorldToScreenPoint(target);
            if(point.z<=0)continue;
            var x=(point.x-offsetX)/scale;var y=(Screen.height-point.y-offsetY)/scale;
            if(x<0||x>1280||y<0||y>800)continue;
            var distance=Vector3.Distance(view.transform.position,target);
            // Keep every identity centered on its own projected car position.
            // Distant cards contract early enough to remain distinct in a pack.
            var identityScale=Mathf.Lerp(1f,.30f,Mathf.InverseLerp(18f,100f,distance));
            const float size=34,labelWidth=164,nameHeight=22,speedHeight=23;
            var badgeY=y-(size+44)*identityScale;
            var labelX=Mathf.Clamp(x,labelWidth*identityScale/2+4,1276-labelWidth*identityScale/2);
            if(Event.current.type==EventType.Repaint)renderedCarIdentities.Add(entry.Username);
            var displayName=entry.Username.TrimStart('@');
            hudName.fontSize=16;
            while(hudName.fontSize>8&&hudName.CalcSize(new GUIContent(displayName)).x>labelWidth)hudName.fontSize--;
            hudSpeed.fontSize=18;
            var displaySpeed=!Running?entry.TopSpeedKph:Mathf.Abs(entry.Car.Speed)*3.6f;
            var identityMatrix=GUI.matrix;
            try
            {
                // Scale the entire identity together, including text and shadows.
                // Minimum font sizes in screen space made distant names pile up.
                GUI.matrix=identityMatrix*Matrix4x4.TRS(new Vector3(labelX,badgeY,0),Quaternion.identity,new Vector3(identityScale,identityScale,1));
                DrawPortrait(entry,new Rect(-size/2,0,size,size));
                HudText(new Rect(-labelWidth/2,size+2,labelWidth,nameHeight),displayName,hudName);
                HudText(new Rect(-labelWidth/2,size+nameHeight+1,labelWidth,speedHeight),Mathf.RoundToInt(displaySpeed)+" km/sa",hudSpeed,new Color(0.56f,1,0.94f));
            }
            finally {GUI.matrix=identityMatrix;}
        }
        hudName.fontSize=14;hudSpeed.fontSize=17;
        if(!settings.ShowSpeedometer || !IsCarAlive(followed))return;
        const float x0=1050,y0=555,size0=196;
        var speed=!Running?followed.TopSpeedKph:Mathf.Abs(followed.Car.Speed)*3.6f;
        Picture(new Rect(x0,y0,size0,size0),"speed-dial.png");
        var centerPoint=new Vector2(x0+size0/2,y0+size0/2);
        var angle=(135+Mathf.Clamp01(speed/RaceEconomy.MaximumKph)*270)*Mathf.Deg2Rad;
        var direction=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle));
        HudLine(centerPoint-direction*13,centerPoint+direction*70,2,new Color(1,0.25f,0.32f));
        HudText(new Rect(x0+48,y0+103,100,46),Mathf.RoundToInt(speed).ToString(),hudNumber);
        HudText(new Rect(x0+65,y0+143,65,20),"km/sa",hudUnit);
        DrawPortrait(followed,new Rect(x0-2,y0-49,36,36));
        var driverName=followed.Username.TrimStart('@');
        hudDriverName.fontSize=17;
        while(hudDriverName.fontSize>11&&hudDriverName.CalcSize(new GUIContent(driverName)).x>160)hudDriverName.fontSize--;
        HudText(new Rect(x0+44,y0-56,160,29),driverName,hudDriverName);
        var captionAlignment=hudCaption.alignment;hudCaption.alignment=TextAnchor.MiddleLeft;
        HudText(new Rect(x0+44,y0-28,160,18),"HEDEF "+followed.TopSpeedKph.ToString("0")+" KM/SA",hudCaption,new Color(.75f,.84f,.88f));
        hudCaption.alignment=captionAlignment;
    }
}
