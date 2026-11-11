using TikMnG.Arcade;
void Check(bool condition,string message){if(!condition)throw new Exception(message);}
Check(!RaceEconomy.ValidFinish(false,float.MaxValue,1,1),"Unfinished sentinel cannot win");
Check(!RaceEconomy.ValidFinish(true,float.MaxValue,3,3),"Infinite sentinel cannot win");
Check(!RaceEconomy.ValidFinish(true,float.NaN,3,3),"NaN cannot win");
Check(!RaceEconomy.ValidFinish(true,30,1,3),"Incomplete lap target cannot win");
Check(RaceEconomy.ValidFinish(true,30,3,3),"Real finisher must be accepted");
Check(!RaceEconomy.PodiumComplete(8,2),"Automatic results wait for the third finisher");
Check(!RaceEconomy.PodiumComplete(0,0),"An empty grid cannot finish a race");
Check(RaceEconomy.PodiumComplete(8,3)&&RaceEconomy.PodiumComplete(2,2)&&!RaceEconomy.PodiumComplete(2,1),"Three finishers or all entrants when fewer than three");
Check(RaceEconomy.LevelForSpeed(50)==0,"Base car");
Check(RaceEconomy.TopSpeed(0,5)==50,"Free entry starts at 50");
Check(RaceEconomy.TopSpeed(1,5)==55,"The admission coin counts towards speed");
Check(RaceEconomy.TopSpeed(5,5)==75,"Five coins at five adds exactly 25 km/h");
Check(RaceEconomy.TopSpeed(5,10)==100,"Five coins at ten adds exactly 50 km/h");
Check(RaceEconomy.TopSpeed(20,5)==150,"All coin units use the configured rate");
Check(RaceEconomy.Power(100)>1.1f&&RaceEconomy.Power(1500)<=2.35f,"Gift acceleration is noticeable and capped");
Check(RaceEconomy.TopSpeed(0,5,10)==60,"100 extra likes add 10");
Check(RaceEconomy.TopSpeed(100,5)==550,"One hundred coins add 500");
Check(RaceEconomy.TopSpeed(1000000,5)==1500,"Formula tier reaches the target cap");
Check(RaceEconomy.Add(99999999,int.MaxValue,10)==RaceEconomy.MaxCredits,"Saturating credit arithmetic");
Check(RaceEconomy.Add(20,5,3)==35,"Per-gift multiplier");
Check(RaceEconomy.CreditLikes(0,100,100,10)==(0,1,10f),"The first 100 likes grant entry and the speed bonus");
Check(RaceEconomy.CreditLikes(98,3,100,10)==(1,1,10f),"Likes accumulate across packets");
Check(RaceEconomy.CreditLikes(3,248,100,10)==(51,2,20f),"Multiple thresholds award their full bonus");
Check(RaceEconomy.CreditLikes(0,300,100,10)==(0,3,30f),"300 likes admit once and unlock the 80 km/h car");
Check(RaceEconomy.LevelForSpeed(RaceEconomy.TopSpeed(0,10,30))==2,"Likes unlock the same vehicle tiers as gifts");
var highLikes=RaceEconomy.CreditLikes(0,12000,100,10);
Check(highLikes.Speed==1200f&&RaceEconomy.LevelForSpeed(RaceEconomy.TopSpeed(0,10,highLikes.Speed))==9,"Likes continue beyond the old 750 bonus cap");
Check(RaceEconomy.TopSpeed(0,10,RaceEconomy.AddAudienceSpeed(highLikes.Speed,500))==1500,"Likes respect the global target speed cap");
foreach(var rate in new[]{.01f,.1f,1f,10f}){
 float previous=0;
 for(var coins=0;coins<200000;coins+=17){
  var current=RaceEconomy.TopSpeed(coins,rate);
  Check(current>=previous&&current>=50&&current<=1500,"Monotonic bounded speed");previous=current;
  Check(RaceEconomy.LevelForSpeed(current) is >=0 and <=10,"Bounded model index");
 }
}
for(var i=0;i<RaceEconomy.ModelSpeeds.Length;i++){
 Check(RaceEconomy.LevelForSpeed(RaceEconomy.ModelSpeeds[i])==i,"Exact requested speed threshold");
 if(i>0)Check(RaceEconomy.LevelForSpeed(RaceEconomy.ModelSpeeds[i]-.01f)==i-1,"No premature model upgrade");
}
Console.WriteLine("PASS race economy, entry fee, multipliers, all progression bounds and real finish validation");
Check(ForwardGiftMath.Distance(100,500)==100,"Configured forward distance");
Check(ForwardGiftMath.Distance(300,100)==88,"Do not cross the finish line");
Check(ForwardGiftMath.Distance(100,5)==0,"Near finish waits for the next lap");
Check(ForwardGiftMath.Distance(float.NaN,100)==0,"Invalid distance rejected");
Check(ForwardGiftMath.Distance(100,float.PositiveInfinity)==0,"Invalid track rejected");
Check(ForwardGiftMath.Distance(9999,2000)==300,"Bounded per gift distance");
Check(ForwardGiftMath.Add(9999,int.MaxValue)==10000,"Bounded pending gift queue");
Check(!ForwardGiftMath.Matches("","5655"),"No surprise default special gift");
Check(ForwardGiftMath.Matches("5655","5655"),"Exact configured special gift");
var receipts=new LiveEventReceipts();
Check(receipts.Accept("gift-1")&&!receipts.Accept("gift-1"),"Replay cannot award speed or a second jump");
for(var remaining=0;remaining<2200;remaining++)for(var request=20;request<=300;request+=20)
    Check(ForwardGiftMath.Distance(request,remaining)<=Math.Max(0,remaining-12),"Finish guard for every distance");
Console.WriteLine("PASS forward gift bounds, finish guard, exact gift match and replay receipts");
Check(ForwardRescueTiming.Lift(0)==0&&ForwardRescueTiming.Lift(ForwardRescueTiming.ReleaseAt)==0,"Rescue starts and ends on the native chassis");
Check(ForwardRescueTiming.Flight(ForwardRescueTiming.JumpAt)==0&&ForwardRescueTiming.Flight(ForwardRescueTiming.LandAt)==1,"Full forward transport interpolation");
for(var i=0;i<=10000;i++){
 var age=i*.001f;var lift=ForwardRescueTiming.Lift(age);var flight=ForwardRescueTiming.Flight(age);
 Check(float.IsFinite(lift)&&lift>=0&&lift<=2.801f,"Bounded cosmetic lift");
 Check(flight>=0&&flight<=1,"Bounded rescue trajectory");
}
Check(ForwardRescueTiming.Phase(.2f)=="approach"&&ForwardRescueTiming.Phase(1)=="lifting"&&ForwardRescueTiming.Phase(2)=="transport"&&ForwardRescueTiming.Phase(3)=="landing"&&ForwardRescueTiming.Phase(4)=="departing","Ordered rescue phases");
Console.WriteLine("PASS spaceship lift, transport, landing and departure timing");
