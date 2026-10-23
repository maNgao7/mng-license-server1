using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    readonly Dictionary<string,string> numberText=new Dictionary<string,string>();
    readonly HashSet<string> invalidNumbers=new HashSet<string>();
    bool NumbersValid(bool includeTests=true){foreach(string key in invalidNumbers)if(includeTests||!key.StartsWith("@test:",StringComparison.Ordinal)){menuNotice="Sayı kutusundaki değeri kontrol edin; boş veya sınır dışında değer var.";return false;}return true;}
    void ClearRuleNumbers(string key){foreach(string parameter in new[]{"distance","duration","strength"}){invalidNumbers.Remove(key+":"+parameter);numberText.Remove(key+":"+parameter);}GUI.FocusControl(null);}
    bool ParseNumber(string text,float min,float max,out float value){return float.TryParse(text.Replace(',','.'),NumberStyles.AllowDecimalPoint|NumberStyles.AllowLeadingSign,CultureInfo.InvariantCulture,out value)&&!float.IsNaN(value)&&!float.IsInfinity(value)&&value>=min&&value<=max;}
    float StepValue(float x,float y,float width,float value,float step,float min,float max,string key=null){
      key=key??tab+":"+x+":"+y;string control="number:"+key,text;
      if(!numberText.TryGetValue(key,out text)||GUI.GetNameOfFocusedControl()!=control&&!invalidNumbers.Contains(key))text=value.ToString("0.##",CultureInfo.InvariantCulture);
      if(Button(new Rect(x,y,25,30),"−")){value=Mathf.Max(min,value-step);text=value.ToString("0.##",CultureInfo.InvariantCulture);invalidNumbers.Remove(key);GUI.FocusControl(null);}
      GUI.SetNextControlName(control);Color before=GUI.backgroundColor;if(invalidNumbers.Contains(key))GUI.backgroundColor=new Color(1,.62f,.57f);
      string next=GUI.TextField(new Rect(x+28,y,width-56,30),text,8,fieldStyle);GUI.backgroundColor=before;
      if(next!=text){text=next;float parsed;if(ParseNumber(text,min,max,out parsed)){value=parsed;invalidNumbers.Remove(key);}else invalidNumbers.Add(key);}
      if(Button(new Rect(x+width-25,y,25,30),"+")){value=Mathf.Min(max,value+step);text=value.ToString("0.##",CultureInfo.InvariantCulture);invalidNumbers.Remove(key);GUI.FocusControl(null);}
      numberText[key]=text;return value;
    }
  }
}
