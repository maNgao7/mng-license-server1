using System;
using TikMnG.Caaahr;

class VoiceMathTests {
  static void Check(bool ok,string name){if(!ok)throw new Exception(name);Console.WriteLine("PASS "+name);}
  static void Main(){
    Check(VoiceMath.Level(new float[1024])==-80,"silent microphone has zero level");
    var quiet=new float[1024];var loud=new float[1024];for(int i=0;i<1024;i++){quiet[i]=.01f;loud[i]=.1f;}
    Check(Math.Abs(VoiceMath.Level(quiet)+40)<.01,"quiet voice RMS");
    Check(Math.Abs(VoiceMath.Level(loud)+20)<.01,"loud voice RMS");
    Check(VoiceMath.Target(-80,-48,-18)==0,"silence cuts throttle");
    Check(VoiceMath.Target(-48,-48,-18)==0,"background threshold cuts throttle");
    float low=VoiceMath.Target(-42,-48,-18),high=VoiceMath.Target(-24,-48,-18);
    Check(low>0&&low<high&&high<1,"quiet voice is slower than loud voice");
    Check(25*low<25*high,"volume controls speed limit, not just acceleration");
    Check(VoiceMath.Target(-5,-48,-18)==1,"full throttle is bounded");
    Check(VoiceMath.Smooth(1,0,.18f,.016f)==0,"silence has no lingering throttle");
    Check(VoiceMath.Target(float.NaN,-48,-18)==0,"invalid audio fails closed");
    var voice=new VoiceEnvelope();for(int i=0;i<60;i++)voice.Process(-80,1f/60,.65f,true);
    Check(voice.Ready&&voice.Demand==0,"automatic startup learns silence without moving");
    float whisper=voice.Process(-66,1f/60,.65f,true),normal=voice.Process(-48,1f/60,.65f,true),raised=voice.Process(-30,1f/60,.65f,true);
    Check(whisper>=.18f&&normal>whisper&&raised>normal,"whisper starts driving and raised voice noticeably accelerates");
    for(int i=0;i<3;i++)voice.Process(-80,1f/60,.65f,true);
    Check(voice.Demand>0,"short syllable gaps do not stall the car");
    for(int i=0;i<15;i++)voice.Process(-80,1f/60,.65f,true);
    Check(voice.Demand==0,"silence stops automatic driving after short release");
    voice.Process(-35,.02f,.65f,true);Check(voice.Process(-35,.02f,.65f,false)==0,"missing audio never reuses the last voice throttle");
    voice.Reset();for(int i=0;i<60;i++)voice.Process(-60,1f/60,.65f,true);
    Check(voice.Process(-60,.02f,.65f,true)==0&&voice.Process(-52,.02f,.65f,true)>.18f,"automatic gate adapts to a noisier microphone");
    foreach(float noise in new[]{-43f,-35f,-26f,-18f,-6f}){
      voice.Reset();for(int i=0;i<120;i++)voice.Process(noise+(i%2)*.5f,1f/60,.19f,true);
      Check(voice.Ready&&voice.Demand==0,"loud steady ambient noise never becomes throttle at "+noise+" dB");
      Check(voice.Process(noise+5,.02f,1,true)>0,"high sensitivity detects quiet speech above ambient noise at "+noise+" dB");
      for(int i=0;i<30;i++)voice.Process(noise,.02f,.19f,true);
      Check(voice.Demand==0,"return to ambient stops throttle at "+noise+" dB");
    }
    voice.Reset();for(int i=0;i<60;i++)voice.Process(i<4?-80:-69,1f/60,.19f,true);
    Check(voice.Demand==0&&voice.Floor>-71,"initial USB microphone silence does not set a falsely low noise floor");
    voice.Reset();for(int i=0;i<60;i++)voice.Process(-80,1f/60,.19f,true);
    Check(voice.Process(-69,.02f,.19f,true)==0,"very quiet background noise cannot creep the car with low sensitivity");
    Check(voice.Process(-66,.02f,.19f,true)>0,"quiet speech still starts at low sensitivity after silence");
    Check(VoiceMath.EasyTarget(-36,-78,.19f)>.95f,"normal raised voice reaches full speed with quiet microphone");
    Check(VoiceMath.EasyTarget(-32,-60,.19f)>.95f,"raised voice reaches full speed above a moderate noise floor");
    Check(VoiceMath.EasyTarget(-44,-78,.19f)>.85f,"lower microphone output no longer demands extreme loudness");
    Check(VoiceMath.DriveTarget(1,true,true,0)==0,"keyboard mode ignores voice and never cruises without a key");
    Check(VoiceMath.DriveTarget(0,true,false,1)==1&&VoiceMath.DriveTarget(0,true,false,-1)==1,"keyboard forward and reverse work without microphone");
    Check(VoiceMath.DriveTarget(1,false,false)==0&&VoiceMath.DriveTarget(1,true,false,0)==0,"disabled microphone and released keys produce zero demand");
    Check(VoiceMath.DriveTarget(1,true,true,float.NaN)==0,"invalid keyboard demand fails closed");
    float previous=0;for(int db=-80;db<=0;db++){float next=VoiceMath.EasyTarget(db,-68,.19f);Check(next>=previous&&next<=1,"automatic demand is monotonic and bounded at "+db+" dB");previous=next;}
    Check(DefaultMicrophone.Resolve("headset",new[]{"other","HEADSET"})=="HEADSET","Windows default is matched by name rather than first list item");
    Check(DefaultMicrophone.Resolve("absent",new[]{"other"})==null,"unmatched Windows default uses the native default, not another microphone");
    var endpoint=DefaultMicrophone.Read();Console.WriteLine("Default capture: "+endpoint.Name);
    Console.WriteLine("All voice control checks passed.");
  }
}
