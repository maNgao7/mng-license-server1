package com.tikmng.snake;

import java.util.*;

/** Simulation is independent of Minecraft so gift routing and arena rules can be tested. */
public final class ArenaEngine {
    public static final double FEED_SECONDS=.85,FIGHT_MARGIN=50;
    public static final double FOOD_MASS=5;
    public static boolean canEatMass(double attacker,double target){return Double.isFinite(attacker)&&Double.isFinite(target)&&attacker>0&&target>0&&target-attacker<=FIGHT_MARGIN;}
    public record Point(double x, double z) {}
    private record TrailPoint(double x,double z,double distance) {}
    public static final class Snake {
        public final String id,ownerId;
        public String name, profile;
        public String intent="BEKLIYOR",preyId="";
        private double nextHuntAt;
        private double hurtUntil;
        private double separationBudget;
        private double radiusScale=1,previousRadiusScale=1;
        public double lastBite=-100;
        public double x, z, angle, mass, boostUntil, shieldUntil, boostMultiplier=1;
        public int kills, wins;
        public final int color,skin;
        private double previousX,previousZ,previousAngle,travel,previousTravel,visualMass,previousVisualMass;
        private double targetLength,visualLength,previousVisualLength;
        private final Deque<TrailPoint> trail = new ArrayDeque<>();
        private List<TrailPoint> bodyPath;
        private List<Point> cachedBody,cachedRenderBody;
        private boolean rigidBody;
        private Snake formationOwner;
        private double lane,previousLane;
        private double cachedStart,cachedLength,renderStart,renderBodyLength;
        private int cachedCount,renderCount;
        private Point foodTarget;
        Snake(String id, String name, String profile, double x, double z, double mass, int skin) {
            this(id,id,name,profile,x,z,mass,skin);
        }
        Snake(String id,String ownerId,String name,String profile,double x,double z,double mass,int skin) {
            this.id=id;this.ownerId=ownerId; this.name=name; this.profile=profile; this.x=x; this.z=z; this.mass=mass;
            this.angle=Math.atan2(-z,-x); this.skin=skin;this.color=skin%12;
            visualMass=previousVisualMass=mass;previousX=x;previousZ=z;previousAngle=angle;
            targetLength=visualLength=previousVisualLength=lengthFor(mass);
        }
        private static double radiusFor(double mass){return Math.min(14,.48+Math.sqrt(Math.max(10,mass))*.022);}
        public double radius() { return radiusFor(mass)*radiusScale; }
        public double renderRadius(double partial){
            double t=unit(partial),before=radiusFor(previousVisualMass)*previousRadiusScale;
            return rigidBody?before+(radiusFor(visualMass)*radiusScale-before)*t:radiusFor(previousVisualMass+(visualMass-previousVisualMass)*t)*radiusScale;
        }
        public double renderX(double partial){return formationOwner==null?previousX+(x-previousX)*unit(partial):formationOwner.renderX(partial)-Math.sin(formationOwner.renderAngle(partial))*(previousLane+(lane-previousLane)*unit(partial));}
        public double renderZ(double partial){return formationOwner==null?previousZ+(z-previousZ)*unit(partial):formationOwner.renderZ(partial)+Math.cos(formationOwner.renderAngle(partial))*(previousLane+(lane-previousLane)*unit(partial));}
        public double renderAngle(double partial){return previousAngle+Math.atan2(Math.sin(angle-previousAngle),Math.cos(angle-previousAngle))*unit(partial);}
        private static double lengthFor(double mass){return Math.min(360,10+Math.sqrt(mass)*.46);}
        public double length(){return visualLength;}
        public double renderLength(double partial){return previousVisualLength+(visualLength-previousVisualLength)*unit(partial);}
        private void changeMass(double next){
            next=Math.max(Double.MIN_NORMAL,Math.min(1000000,next));
            targetLength=Math.max(2.5,Math.min(360,targetLength*lengthFor(next)/lengthFor(mass)));mass=next;
        }
        private double sever(double keptLength){
            keptLength=Math.max(2.5,Math.min(visualLength,keptLength));
            double next=Math.max(Math.min(10,mass),mass*keptLength/Math.max(2.5,visualLength)),lost=mass-next;
            if(lost<.01)return 0;
            mass=next;targetLength=visualLength=previousVisualLength=keptLength;return lost;
        }
        private static double unit(double n){return Math.max(0,Math.min(1,n));}
        public double speed(double time) { return Math.max(5.5,18/(1+Math.sqrt(mass)/22))*(boostUntil>time?boostMultiplier:1); }
        public int segments() { return Math.min(180,Math.max(24,(int)Math.ceil(length()/Math.max(.24,radius()*.3)))); }
        public List<Point> body(){return body(1);}
        public List<Point> body(double partial) {
            if(rigidBody){
                double sample=unit(partial);boolean full=sample==1;
                if(full&&cachedBody!=null)return cachedBody;
                if(!full&&cachedRenderBody!=null&&renderStart==sample)return cachedRenderBody;
                double x=renderX(sample),z=renderZ(sample),angle=renderAngle(sample),length=renderLength(sample);
                int count=segments();List<Point> points=new ArrayList<>(count+1);
                for(int i=0;i<=count;i++){double d=length*i/count;points.add(new Point(x-Math.cos(angle)*d,z-Math.sin(angle)*d));}
                List<Point> result=Collections.unmodifiableList(points);
                if(full)cachedBody=result;else{cachedRenderBody=result;renderStart=sample;}return result;
            }
            if(bodyPath==null)bodyPath=new ArrayList<>(trail);
            List<TrailPoint> path=bodyPath;
            if(path.isEmpty())return List.of();
            double start=previousTravel+(travel-previousTravel)*unit(partial);
            double bodyLength=renderLength(partial);
            int count=segments(),cursor=0;
            boolean full=unit(partial)==1;
            if(full&&cachedBody!=null&&cachedStart==start&&cachedLength==bodyLength&&cachedCount==count)return cachedBody;
            if(!full&&cachedRenderBody!=null&&renderStart==start&&renderBodyLength==bodyLength&&renderCount==count)return cachedRenderBody;
            List<Point> result=new ArrayList<>(count+1);
            for(int i=0;i<=count;i++){
                double target=start-bodyLength*i/count;
                while(cursor+1<path.size()&&path.get(cursor+1).distance>target)cursor++;
                TrailPoint a=path.get(cursor),b=path.get(Math.min(cursor+1,path.size()-1));
                double t=a.distance==b.distance?0:unit((a.distance-target)/(a.distance-b.distance));
                result.add(new Point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));
            }
            List<Point> points=Collections.unmodifiableList(result);
            if(full){cachedBody=points;cachedStart=start;cachedLength=bodyLength;cachedCount=count;}
            else{cachedRenderBody=points;renderStart=start;renderBodyLength=bodyLength;renderCount=count;}
            return points;
        }
        private void invalidateBody(){bodyPath=null;cachedBody=null;cachedRenderBody=null;}
        private void snapshot(){previousX=x;previousZ=z;previousAngle=angle;previousTravel=travel;previousVisualMass=visualMass;previousVisualLength=visualLength;previousRadiusScale=radiusScale;previousLane=lane;cachedRenderBody=null;}
        private void resetTrail(int size){
            invalidateBody();
            trail.clear();travel=previousTravel=0;previousX=x;previousZ=z;previousAngle=angle;
            trail.add(new TrailPoint(x,z,0));
            double px=x,pz=z,heading=angle+Math.PI,distance=0,limit=playableRadius(size,radius());
            for(int i=1;i<=Math.ceil((length()+12)/.25);i++){
                if(Math.hypot(px,pz)>limit-Math.min(4,limit*.5)){
                    double desired=Math.atan2(-pz,-px),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
                    heading+=Math.max(-.15,Math.min(.15,delta));
                }else heading+=.008;
                Point next=clamp(px+Math.cos(heading)*.25,pz+Math.sin(heading)*.25,limit);
                double nx=next.x,nz=next.z;
                distance+=Math.hypot(nx-px,nz-pz);px=nx;pz=nz;
                trail.addLast(new TrailPoint(px,pz,-distance));
            }
            foodTarget=null;
        }
    }
    public final LinkedHashMap<String,Snake> snakes=new LinkedHashMap<>();
    public final List<Point> food=new ArrayList<>();
    public final Deque<String> notices=new ArrayDeque<>();
    public record Meal(List<Point> body,double radius,double angle,int skin,String eaterId,double started,double startFraction,boolean whole){
        public Meal{body=List.copyOf(body);}
    }
    public final List<Meal> meals=new ArrayList<>();
    public record Feeding(String snakeId,double amount,double coins,double started,Point origin){}
    public final List<Feeding> feedings=new ArrayList<>();
    public ArenaRules rules=new ArenaRules();
    public long totalEaten,totalTailBites,totalFeedings,totalFoodEaten;
    private final LinkedHashSet<String> dispatches=new LinkedHashSet<>();
    private final Map<String,Integer> likes=new HashMap<>();
    private final Map<String,Integer> entryLikes=new HashMap<>();
    private record Entrant(String id,String name,String profile){}
    private final Map<String,Entrant> entrants=new LinkedHashMap<>();
    private final Random random;
    public double time;
    public int size=96, round=1,minimumPlayers=2;
    public boolean started;
    public double battleStartedAt=-1;
    private double battleAt=-1;
    public boolean requestBattle(){
        if(started||battleAt>=0||!winner.isEmpty())return false;
        battleAt=time+10;notice("Savas 10 saniye sonra basliyor");return true;
    }
    public double battleCountdownRemaining(){return battleAt<0?-1:Math.max(0,battleAt-time);}
    public double battleAnnouncementRemaining(){return battleStartedAt<0?0:Math.max(0,2-(time-battleStartedAt));}
    public boolean paused, demo;
    public String winner="";
    private double restartAt;
    public double survivorDelaySeconds=10;
    private String pendingSurvivor="",controlledId="";
    private double survivorAt,controlX,controlZ;
    public double survivorRemaining(){return pendingSurvivor.isEmpty()?-1:Math.max(0,survivorAt-time);}
    public String controlledId(){return controlledId;}
    public Snake joinPublisher(String id,String name,String profile){
        Snake s=join(id,name,profile,300);if(s!=null){controlledId=s.id;controlX=controlZ=0;}return s;
    }
    public void publisherDirection(double x,double z){
        if(!Double.isFinite(x)||!Double.isFinite(z)){controlX=controlZ=0;return;}
        double length=Math.hypot(x,z),scale=Math.max(1,length);controlX=x/scale;controlZ=z/scale;
    }
    private void cancelSurvivor(){pendingSurvivor="";survivorAt=0;}
    private void finishSurvivor(){
        Snake s=snakes.get(pendingSurvivor);
        if(s==null||snakes.size()!=1){cancelSurvivor();return;}
        if(time<survivorAt)return;
        adjustWin(s.id,1);winner=s.name;restartAt=time+8;cancelSurvivor();notice("Kazanan: "+winner);
    }
    private final Map<String,Integer> wins=new HashMap<>();
    public record Winner(String id,String name,String profile,int wins){}
    private final Map<String,Winner> winners=new LinkedHashMap<>();
    public long winsRevision;
    public List<Winner> winners(){return winners.values().stream().sorted(Comparator.comparingInt(Winner::wins).reversed().thenComparing(Winner::id)).toList();}
    public void restoreWins(List<Winner> saved){
        wins.clear();winners.clear();
        if(saved!=null)for(Winner w:saved){if(w==null||w.id==null||w.id.isBlank()||winners.size()>=512)continue;
            String id=w.id.trim().toLowerCase(Locale.ROOT);int count=Math.max(0,Math.min(1000000,w.wins));
            if(count>0){wins.put(id,count);winners.put(id,new Winner(id,w.name==null?id:w.name,w.profile==null?"":w.profile,count));}}
        for(Snake s:snakes.values())s.wins=wins.getOrDefault(s.id,0);for(Fragment f:fragments)syncPart(f.snake,snakes.get(f.owner));winsRevision++;
    }
    public void adjustWin(String id,int delta){
        String key=id==null?"":id.trim().toLowerCase(Locale.ROOT);if(key.isBlank())return;
        Winner old=winners.get(key);Snake s=snakes.get(key);
        if(old==null&&s==null)return;
        int count=(int)Math.max(0,Math.min(1000000,(long)wins.getOrDefault(key,0)+delta));
        if(count==0){removeWinner(key);return;}
        if(old!=null&&old.wins==count)return;
        wins.put(key,count);winners.put(key,new Winner(key,s!=null?s.name:old.name,s!=null?s.profile:old.profile,count));
        if(s!=null){s.wins=count;Group group=groups.get(s.id);if(group!=null)for(Fragment f:group.parts)syncPart(f.snake,s);}winsRevision++;
    }
    public boolean removeWinner(String id){
        String key=id==null?"":id.trim().toLowerCase(Locale.ROOT);
        boolean removed=winners.remove(key)!=null;removed|=wins.remove(key)!=null;
        var snake=snakes.get(key);if(snake!=null){snake.wins=0;Group group=groups.get(key);if(group!=null)for(Fragment f:group.parts)syncPart(f.snake,snake);}
        if(removed)winsRevision++;return removed;
    }
    public boolean removeSnake(String id){
        String key=id==null?"":id.trim().toLowerCase(Locale.ROOT);Snake removed=snakes.remove(key);if(removed==null)return false;
        entrants.remove(key);likes.remove(key);entryLikes.remove(key);feedings.removeIf(f->f.snakeId.equals(key));
        fragments.removeIf(f->f.owner.equals(key));groups.remove(key);
        if(controlledId.equals(key)){controlledId="";controlX=controlZ=0;}
        if(pendingSurvivor.equals(key)||snakes.size()<2)cancelSurvivor();
        for(Snake other:snakes.values())if(other.preyId.equals(key)){other.preyId="";other.nextHuntAt=0;}
        if(winner.equals(removed.name)){winner="";restartAt=0;}
        if(snakes.isEmpty()){winner="";restartAt=0;}
        notice("Yilan kaldirildi: "+removed.name);return true;
    }
    private final Map<String,Integer> skins=new LinkedHashMap<>();
    private final BodyIndex bodyIndex=new BodyIndex();
    private record Fragment(String owner,Snake snake,int part){}
    private final List<Fragment> fragments=new ArrayList<>();
    private static final class Group {
        final Snake owner;
        final List<Fragment> parts=new ArrayList<>(5);
        Group(Snake owner){this.owner=owner;}
    }
    private final Map<String,Group> groups=new LinkedHashMap<>();
    private double galaxyUntil;
    private int galaxyParts=3;
    public boolean galaxyActive(){return galaxyUntil>time;}
    public double galaxyRemaining(){return Math.max(0,galaxyUntil-time);}
    public Collection<Snake> renderSnakes(){return fragments.isEmpty()?snakes.values():fragments.stream().map(Fragment::snake).toList();}
    public Snake displayHead(Snake owner){Group group=groups.get(owner.ownerId);return group==null||group.parts.isEmpty()?owner:group.parts.get(0).snake;}
    public void galaxy(double seconds){galaxy(seconds,3);}
    public void galaxy(double seconds,int parts){
        if(!Double.isFinite(seconds)||galaxyActive()||snakes.isEmpty()||!winner.isEmpty())return;
        if(!groups.isEmpty())mergeGalaxy();
        galaxyParts=Math.max(3,Math.min(5,parts));
        galaxyUntil=time+Math.max(3,Math.min(15,seconds));fragments.clear();groups.clear();
        for(var owner:snakes.values())addFragments(owner);
        notice("Galaksi: yilanlar parcalandi");
    }
    private void addFragments(Snake owner){
        Group group=new Group(owner);groups.put(owner.id,group);
        double assigned=0,weight=galaxyParts*(galaxyParts+1)/2.0;
        for(int part=0;part<galaxyParts;part++){
            double mass=part==galaxyParts-1?owner.mass-assigned:owner.mass*(galaxyParts-part)/weight;assigned+=mass;
            Snake child=new Snake(owner.id+"~galaxy-"+part,owner.id,owner.name,owner.profile,owner.x,owner.z,mass,owner.skin);
            child.angle=owner.angle;child.lastBite=owner.lastBite;child.hurtUntil=owner.hurtUntil;child.rigidBody=true;child.formationOwner=owner;
            Fragment fragment=new Fragment(owner.id,child,part);fragments.add(fragment);group.parts.add(fragment);
        }
        placeGroup(group,true);
    }
    private void mergeGalaxy(){
        for(Group group:groups.values()){
            Snake owner=group.owner,head=displayHead(owner);
            owner.mass=group.parts.stream().mapToDouble(f->f.snake.mass).sum();owner.radiusScale=1;
            owner.x=head.x;owner.z=head.z;owner.angle=head.angle;
            owner.targetLength=owner.visualLength=owner.previousVisualLength=Snake.lengthFor(owner.mass);
            owner.visualMass=owner.previousVisualMass=owner.mass;constrain(owner);owner.resetTrail(size);
        }
        fragments.clear();groups.clear();galaxyUntil=0;notice("Galaksi: yilanlar birlesti");
    }
    private void syncPart(Snake child,Snake owner){
        child.name=owner.name;child.profile=owner.profile;child.wins=owner.wins;child.kills=owner.kills;
        child.boostUntil=owner.boostUntil;child.boostMultiplier=owner.boostMultiplier;child.shieldUntil=owner.shieldUntil;
    }
    private void placeGroup(Group group,boolean initial){
        Snake owner=group.owner;double diameters=0,maxLength=0,gap=.4;
        for(Fragment f:group.parts)diameters+=2*Snake.radiusFor(f.snake.mass);
        double scale=Math.min(1,(size*.4-1-gap*(group.parts.size()-1))/diameters);
        double width=diameters*scale+gap*(group.parts.size()-1),lane=-width/2;
        for(Fragment f:group.parts){
            Snake child=f.snake;child.radiusScale=scale;
            child.targetLength=Math.min(child.targetLength,size*.22);
            child.visualLength=Math.min(child.visualLength,size*.22);
            maxLength=Math.max(maxLength,child.length());
        }
        // A rigid parallel formation keeps both heads and complete bodies in separate lanes.
        double envelope=Math.hypot(width/2,maxLength)+group.parts.stream().mapToDouble(f->f.snake.radius()).max().orElse(0);
        owner.radiusScale=envelope/Snake.radiusFor(owner.mass);constrain(owner);
        if(initial){owner.previousX=owner.x;owner.previousZ=owner.z;owner.previousAngle=owner.angle;owner.previousRadiusScale=owner.radiusScale;}
        double nx=-Math.sin(owner.angle),nz=Math.cos(owner.angle);
        for(Fragment f:group.parts){
            Snake child=f.snake;syncPart(child,owner);double offset=lane+child.radius();lane+=2*child.radius()+gap;
            child.lane=offset;child.x=owner.x+nx*offset;child.z=owner.z+nz*offset;child.angle=owner.angle;
            child.visualMass=child.mass;
            child.invalidateBody();
            if(initial)child.snapshot();
        }
    }
    private void changeOwnerMass(Snake owner,double next){
        double before=owner.mass;next=Math.max(Math.min(10,before),Math.min(1000000,next));
        Group group=groups.get(owner.id);
        if(group==null){owner.changeMass(next);return;}
        double remaining=next;
        for(int i=0;i<group.parts.size();i++){
            Snake part=group.parts.get(i).snake;
            double mass=i==group.parts.size()-1?remaining:next*part.mass/before;
            part.changeMass(mass);remaining-=mass;
        }
        owner.changeMass(next);
    }
    private void tickGalaxy(double dt){
        var owners=new ArrayList<>(snakes.values());
        var actors=new ArrayList<Snake>(fragments.size());for(Fragment f:fragments){
            syncPart(f.snake,snakes.get(f.owner));
            f.snake.visualLength+=(f.snake.targetLength-f.snake.visualLength)*(1-Math.exp(-dt*5));actors.add(f.snake);
        }
        bodyIndex.build(actors,size);
        for(Snake owner:owners){owner.separationBudget=owner.speed(time)*dt*.25;move(owner,actors,dt);}
        for(int pass=0;pass<3;pass++){
            for(Snake owner:owners)separateBody(owner,pass==0);
            separateHeads(owners,pass==0);
        }
        for(Group group:groups.values())placeGroup(group,false);
        for(Snake actor:actors)consumeFood(actor,snakes.get(actor.ownerId));
        for(Group group:groups.values())placeGroup(group,false);
        if(started){combat(actors,true);for(Group group:groups.values())placeGroup(group,false);}
        refillFood();
    }
    public ArenaEngine(long seed) { random=new Random(seed); refillFood(); }
    public void configure(int requestedSize) {
        size=Math.max(32,Math.min(1000,requestedSize));
        for(Snake s:snakes.values()){constrain(s);s.resetTrail(size);}
        for(Group group:groups.values())placeGroup(group,true);
        food.clear();refillFood();
    }
    public Snake join(String id,String name,String profile,double mass) {
        if(id==null||id.isBlank()||!Double.isFinite(mass))return null;
        String key=id.trim().toLowerCase(Locale.ROOT);
        Snake existing=snakes.get(key);
        if(existing!=null){if(profile!=null&&!profile.isBlank())existing.profile=profile;Group group=groups.get(key);if(group!=null)for(Fragment f:group.parts)syncPart(f.snake,existing);return existing;}
        if(snakes.size()>=96)return null;
        cancelSurvivor();
        double spawnMass=Math.max(10,Math.min(1000000,mass)),limit=playableRadius(size,Snake.radiusFor(spawnMass));
        double x=0,z=0;
        for(int i=0;i<50;i++){
            Point spawn=randomPoint(limit);x=spawn.x;z=spawn.z;
            boolean safe=true;
            for(Snake s:snakes.values())if(Math.hypot(x-s.x,z-s.z)<s.radius()+5){safe=false;break;}
            if(safe)break;
        }
        Snake snake=new Snake(key,name==null?key:name,profile==null?"":profile,x,z,
            spawnMass,skins.computeIfAbsent(key,k->skins.size()));
        constrain(snake);snake.resetTrail(size);
        snake.shieldUntil=time+rules.protectionSeconds;snake.wins=wins.getOrDefault(key,0);snakes.put(key,snake);
        entrants.put(key,new Entrant(key,snake.name,snake.profile));if(galaxyActive())addFragments(snake);return snake;
    }
    public void action(String id,String name,String profile,String action,double amount,double seconds) {
        if(!Double.isFinite(amount)||!Double.isFinite(seconds))return;
        Snake s=join(id,name,profile,200); if(s==null)return;
        switch(action){
            case "grow" -> changeOwnerMass(s,s.mass+Math.max(0,Math.min(1000000,amount)));
            case "boost" -> {s.boostUntil=time+Math.max(1,Math.min(60,seconds));s.boostMultiplier=Math.max(1,Math.min(10,amount));}
            case "shield" -> s.shieldUntil=Math.max(s.shieldUntil,time)+Math.max(1,Math.min(60,seconds));
            case "shrink" -> changeOwnerMass(s,s.mass-Math.max(0,amount));
            case "galaxy" -> galaxy(seconds,(int)Math.round(amount));
            default -> { }
        }
    }
    public boolean accept(String dispatch) {
        if(dispatch==null||dispatch.isBlank())return false;
        if(!dispatches.add(dispatch))return false;
        if(dispatches.size()>16384)dispatches.remove(dispatches.iterator().next());return true;
    }
    public void feed(String id,String name,String profile,double amount,double coins){
        if(!Double.isFinite(amount)||amount<=0)return;
        Snake s=join(id,name,profile,rules.giftEntryMass);if(s==null)return;
        double room=Math.max(0,1000000-s.mass);
        for(Feeding f:feedings)if(f.snakeId.equals(s.id))room-=f.amount;
        double accepted=Math.min(room,amount);if(accepted<=0)return;
        for(int i=0;i<feedings.size();i++){
            Feeding f=feedings.get(i);
            if(f.snakeId.equals(s.id)){feedings.set(i,new Feeding(s.id,f.amount+accepted,f.coins+Math.max(0,coins),f.started,f.origin));return;}
        }
        feedings.add(new Feeding(s.id,accepted,Math.max(0,coins),time,new Point(s.x+(Math.cos(s.angle)*2-Math.sin(s.angle)*4)*s.radius(),s.z+(Math.sin(s.angle)*2+Math.cos(s.angle)*4)*s.radius())));
    }
    public void gift(String id,String name,String profile,double coins,int count){
        join(id,name,profile,rules.giftEntryMass);feed(id,name,profile,rules.giftMass(coins,count),coins*count);
    }
    public void followed(String id,String name,String profile){
        if(id==null||id.isBlank())return;
        boolean exists=snakes.containsKey(id.trim().toLowerCase(Locale.ROOT));
        join(id,name,profile,rules.followMass);if(exists)feed(id,name,profile,rules.followMass,0);
    }
    public void liked(String id,String name,String profile,int count){
        if(id==null||count<=0)return;String key=id.toLowerCase(Locale.ROOT);int remaining=Math.min(10000,count);
        if(!snakes.containsKey(key)){
            int total=entryLikes.getOrDefault(key,0)+remaining;
            if(total<rules.likesPerJoin){entryLikes.put(key,total);return;}
            if(join(id,name,profile,rules.likeEntryMass)==null)return;
            remaining=total-rules.likesPerJoin;entryLikes.remove(key);likes.remove(key);
        }
        int batches=addLikes(key,remaining,rules.likesPerGrowth);
        if(batches>0)feed(key,name,profile,rules.likeGrowthMass*batches,0);
    }
    public int addLikes(String id,int count,int threshold) {
        if(count<=0)return 0;
        String key=id.toLowerCase(Locale.ROOT);
        int total=likes.getOrDefault(key,0)+Math.min(10000,count), step=Math.max(1,threshold);
        likes.put(key,total%step);return total/step;
    }
    public void reset() {snakes.clear();fragments.clear();groups.clear();galaxyUntil=0;entrants.clear();likes.clear();entryLikes.clear();food.clear();notices.clear();meals.clear();feedings.clear();started=false;battleAt=battleStartedAt=-1;winner="";restartAt=0;controlledId="";controlX=controlZ=0;cancelSurvivor();round++;refillFood();}
    public void seedDemo() {
        reset();demo=true;
        String[] names={"MaviYilan","Kaptan","Limon","Sakura","Deniz","Kivilcim","Bulut","Nehir","Atlas","Yildiz","Gece","Mercan"};
        for(int i=0;i<names.length;i++)join("demo-"+i,names[i],"",i==0?22000:200+i*i*20);
    }
    public void clearDemo() {if(demo)reset();demo=false;}
    public void tick(double dt) {
        snakes.values().forEach(Snake::snapshot);
        for(Fragment f:fragments)f.snake.snapshot();
        if(paused||!Double.isFinite(dt)||dt<=0)return;
        dt=Math.min(.1,dt);time+=dt;
        if(battleAt>=0&&time+1e-9>=battleAt){started=true;battleStartedAt=battleAt;battleAt=-1;notice("Savas basladi");}
        meals.removeIf(m->time-m.started>.85);
        for(Iterator<Feeding> it=feedings.iterator();it.hasNext();){
            Feeding f=it.next();Snake s=snakes.get(f.snakeId);
            if(s==null){it.remove();continue;}
            if(time-f.started>=FEED_SECONDS){double before=s.mass;changeOwnerMass(s,s.mass+f.amount);if(s.mass>before)totalFeedings++;s.lastBite=time;Group group=groups.get(s.id);if(group!=null)for(Fragment part:group.parts)part.snake.lastBite=time;it.remove();}
        }
        if(!winner.isEmpty()) {
            if(!groups.isEmpty()&&time+1e-9>=galaxyUntil)mergeGalaxy();
            if(time>=restartAt){List<Entrant> old=new ArrayList<>(entrants.values());String player=controlledId;reset();for(Entrant s:old)join(s.id,s.name,s.profile,s.id.equals(player)?300:rules.giftEntryMass);if(snakes.containsKey(player))controlledId=player;}
            return;
        }
        if(!pendingSurvivor.isEmpty()){
            finishSurvivor();if(!winner.isEmpty()){if(!groups.isEmpty()&&time+1e-9>=galaxyUntil)mergeGalaxy();return;}
        }
        if(!groups.isEmpty()){
            tickGalaxy(dt);if(time+1e-9>=galaxyUntil)mergeGalaxy();return;
        }
        if(snakes.isEmpty())return;
        List<Snake> actors=new ArrayList<>(snakes.values());
        for(Snake s:actors){
            double blend=1-Math.exp(-dt*5);
            s.visualMass+=(s.mass-s.visualMass)*blend;s.visualLength+=(s.targetLength-s.visualLength)*blend;
            s.separationBudget=s.speed(time)*dt*.25;
        }
        bodyIndex.build(actors,size);
        for(Snake s:actors)move(s,actors,dt);
        // Fixed solver passes bound work; only corrected movement is added to the trail.
        for(int pass=0;pass<3;pass++){
            for(Snake s:actors)separateBody(s,pass==0);
            separateHeads(actors,pass==0);
        }
        for(Snake s:actors)recordMovement(s);
        for(Snake s:actors)consumeFood(s,s);
        if(!started){refillFood();return;}
        combat(actors,false);
        refillFood();
    }
    private void combat(List<Snake> actors,boolean split){
        int ownersBefore=snakes.size();
        Set<Snake> eaten=Collections.newSetFromMap(new IdentityHashMap<>());
        Map<Snake,List<Point>> bodies=new IdentityHashMap<>();
        Map<Snake,Bounds> bounds=new IdentityHashMap<>();
        double maxMovement=0;
        for(Snake s:actors){var body=s.body();bodies.put(s,body);bounds.put(s,Bounds.of(body));maxMovement=Math.max(maxMovement,Math.hypot(s.x-s.previousX,s.z-s.previousZ));}
        Set<Snake> nearbyTargets=Collections.newSetFromMap(new IdentityHashMap<>());
        if(split)bodyIndex.build(actors,size);
        actors.sort(Comparator.comparingDouble((Snake s)->s.mass).reversed());
        for(Snake big:actors){
            if(eaten.contains(big)||time-big.lastBite<.35)continue;
            double mouthX=big.x+Math.cos(big.angle)*big.radius()*.8,mouthZ=big.z+Math.sin(big.angle)*big.radius()*.8;
            double previousMouthX=big.previousX+Math.cos(big.previousAngle)*big.radius()*.8,previousMouthZ=big.previousZ+Math.sin(big.previousAngle)*big.radius()*.8;
            if(split){
                nearbyTargets.clear();int count=bodyIndex.query(previousMouthX,previousMouthZ,mouthX,mouthZ,big.radius()+maxMovement);
                for(int k=0;k<count;k++)nearbyTargets.add(bodyIndex.owners[bodyIndex.candidates[k]]);
            }
            for(Snake small:actors){
                if((split&&!nearbyTargets.contains(small))||big.ownerId.equals(small.ownerId)||eaten.contains(small)||!canBite(big,small))continue;
                Point head=project(0,0,previousMouthX-small.previousX,previousMouthZ-small.previousZ,mouthX-small.x,mouthZ-small.z);
                List<Point> body=bodies.get(small);double oldRadius=small.renderRadius(1);
                if(Math.hypot(head.x,head.z)<big.radius()*.95+small.radius()*.65){
                    if(split){capturePart(big,small);creditPart(big,small.mass);}else{big.changeMass(big.mass+small.mass*1.2);big.kills++;}
                    eaten.add(small);
                    big.lastBite=time;totalEaten++;meal(new Meal(body,oldRadius,small.angle,small.skin,big.ownerId,time,0,true));
                    notice(big.name+" yedi: "+small.name);
                    break;
                }
                if(!bounds.get(small).intersects(previousMouthX,previousMouthZ,mouthX,mouthZ,big.radius()+small.radius()))continue;
                Contact hit=contact(body,previousMouthX,previousMouthZ,mouthX,mouthZ);
                double fraction=hit.along/Math.max(.01,small.length());
                double tailRadius=small.radius()*(fraction<.64?1:Math.max(.06,Math.pow((1-fraction)/.36,.8)));
                if(hit.distance<big.radius()*.95+tailRadius*.55){
                    double oldLength=small.length(),lost=small.sever(hit.along);
                    if(lost<=0)continue;
                    if(split){snakes.get(small.ownerId).changeMass(snakes.get(small.ownerId).mass-lost);creditPart(big,lost);}
                    else big.changeMass(big.mass+lost*1.2);
                    big.lastBite=time;small.hurtUntil=time+.8;totalTailBites++;
                    List<Point> severed=new ArrayList<>();severed.add(hit.point);severed.addAll(body.subList(hit.segment+1,body.size()));
                    meal(new Meal(severed,oldRadius,small.angle,small.skin,big.ownerId,time,Math.min(1,hit.along/oldLength),false));
                    notice(big.name+" kuyrugunu isirdi: "+small.name);
                    break;
                }
            }
        }
        if(!split)for(Snake victim:eaten)snakes.remove(victim.id);
        feedings.removeIf(f->!snakes.containsKey(f.snakeId));
        if(!snakes.containsKey(controlledId)){controlledId="";controlX=controlZ=0;}
        if(!eaten.isEmpty()&&snakes.size()==1&&ownersBefore>1){
            Snake s=snakes.values().iterator().next();pendingSurvivor=s.id;survivorAt=time+Math.max(0,survivorDelaySeconds);finishSurvivor();
        }
    }
    private void capturePart(Snake hunter,Snake victim){
        Group group=groups.get(victim.ownerId);Snake owner=group.owner;
        group.parts.removeIf(f->f.snake==victim);fragments.removeIf(f->f.snake==victim);
        owner.mass=group.parts.stream().mapToDouble(f->f.snake.mass).sum();
        if(group.parts.isEmpty()){
            snakes.remove(owner.id);groups.remove(owner.id);Snake eater=snakes.get(hunter.ownerId);if(eater!=null)eater.kills++;
        }
    }
    private void creditPart(Snake part,double amount){
        Snake owner=snakes.get(part.ownerId);double accepted=Math.min(amount,Math.max(0,1000000-owner.mass));
        owner.changeMass(owner.mass+accepted);part.changeMass(part.mass+accepted);
    }
    private void move(Snake s,List<Snake> actors,double dt){
        if(s.id.equals(controlledId)){
            s.intent="YAYINCI";s.preyId="";double length=Math.hypot(controlX,controlZ);if(length<.001){constrain(s);return;}
            double desired=Math.atan2(controlZ,controlX),difference=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));
            s.angle+=Math.max(-dt*8,Math.min(dt*8,difference));advance(s,s.speed(time)*dt,playableRadius(size,s.radius()));return;
        }
        double tx=Math.cos(s.angle+Math.sin(time*.7+s.color)*.3),tz=Math.sin(s.angle+Math.sin(time*.7+s.color)*.3);
        Snake prey=null,threat=null;double preyDistance=Double.MAX_VALUE,threatDistance=Double.MAX_VALUE;
        for(Snake other:actors){
            if(other.ownerId.equals(s.ownerId)||!started)continue;double d=Math.hypot(s.x-other.previousX,s.z-other.previousZ);
            if(combatMass(other)-combatMass(s)>FIGHT_MARGIN&&d<threatDistance){threat=other;threatDistance=d;}
            if(canEatMass(combatMass(s),combatMass(other))){
                if(other.id.equals(s.preyId)&&time<s.nextHuntAt){prey=other;preyDistance=-1;}
                else if(preyDistance>=0&&d<preyDistance){prey=other;preyDistance=d;}
            }
        }
        if(prey!=null){
            if(!prey.id.equals(s.preyId)||time>=s.nextHuntAt){s.preyId=prey.id;s.nextHuntAt=time+3;}
            // Predict the head's escape route; body bites no longer eliminate prey.
            double distance=Math.hypot(prey.previousX-s.x,prey.previousZ-s.z);
            // A long lead at close range aims past the prey and creates a stable orbit.
            double reach=s.radius()*1.8+prey.radius()*1.2+2;
            double lead=Math.min(2.5,Math.max(0,distance-reach)/Math.max(1,s.speed(time))*.65);
            Point target=clamp(prey.previousX+Math.cos(prey.previousAngle)*prey.speed(time)*lead,
                prey.previousZ+Math.sin(prey.previousAngle)*prey.speed(time)*lead,playableRadius(size,s.radius()));
            tx=target.x-s.x;tz=target.z-s.z;
            s.intent="AVLANIYOR";
        }
        else if(threat!=null&&threatDistance<12+threat.radius()*3){
            tx=(s.x-threat.previousX)/Math.max(.1,threatDistance);tz=(s.z-threat.previousZ)/Math.max(.1,threatDistance);s.intent="KACIYOR";s.preyId="";
        }
        else {
            s.intent="YEM ARIYOR";s.preyId="";
            if(s.foodTarget==null||!food.contains(s.foodTarget)||Math.hypot(s.x-s.foodTarget.x,s.z-s.foodTarget.z)<s.radius()+1){
                Point closest=null;double distance=24;for(Point f:food){double d=Math.hypot(f.x-s.x,f.z-s.z);if(d<distance){closest=f;distance=d;}}s.foodTarget=closest;
            }
            if(s.foodTarget!=null){tx=s.foodTarget.x-s.x;tz=s.foodTarget.z-s.z;}
        }
        double norm=Math.max(.001,Math.hypot(tx,tz));tx/=norm;tz/=norm;
        double look=Math.min(20,s.speed(time)*.35+s.radius()),fx=Math.cos(s.angle),fz=Math.sin(s.angle);
        int nearby=bodyIndex.query(s.x,s.z,s.x+fx*look,s.z+fz*look,s.radius()+.6);
        double earliest=2,nx=0,nz=0;
        for(int k=0;k<nearby;k++){
            int i=bodyIndex.candidates[k];Snake other=bodyIndex.owners[i];
            if(other.ownerId.equals(s.ownerId)||canBite(s,other))continue;
            Point a=bodyIndex.from[i],b=bodyIndex.to[i];
            double hit=sweep(s.x,s.z,fx*look,fz*look,a.x,a.z,b.x,b.z,s.radius()+bodyIndex.radii[i]+.6);
            if(hit<0||hit>=earliest)continue;
            double hx=s.x+fx*look*hit,hz=s.z+fz*look*hit;
            Point near=project(hx,hz,a.x,a.z,b.x,b.z);
            double dx=hx-near.x,dz=hz-near.z,d=Math.hypot(dx,dz);
            if(d<1e-8){dx=-fz;dz=fx;d=1;}
            earliest=hit;nx=dx/d;nz=dz/d;
        }
        if(earliest<=1){
            double side=fx*(-nz)+fz*nx>=0?1:-1;
            double weight=1-earliest;
            tx+=weight*(nx*1.8-nz*side*1.4);tz+=weight*(nz*1.8+nx*side*1.4);
        }
        double turnRate=Math.max(.65,Math.min(2.6,s.speed(time)/(s.radius()*2)));
        if(prey!=null){
            double captureDistance=Math.hypot(prey.previousX-s.x,prey.previousZ-s.z);
            turnRate=Math.max(turnRate,Math.min(8,s.speed(time)*2.4/Math.max(1,captureDistance)));
        }
        double boundary=playableRadius(size,s.radius()),margin=Math.min(boundary,Math.max(5,Math.max(s.radius()*2.3,s.speed(time)/turnRate)));
        double distance=Math.hypot(s.x,s.z),push=Math.max(0,1-(boundary-distance)/margin);
        if(prey!=null)push*=.15;
        if(distance>1e-9){tx-=s.x/distance*push*push*2.6;tz-=s.z/distance*push*push*2.6;}
        double desired=Math.atan2(tz,tx),difference=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));
        s.angle+=Math.max(-dt*turnRate,Math.min(dt*turnRate,difference));
        advance(s,s.speed(time)*dt,boundary);
    }
    private static void advance(Snake s,double distance,double boundary){
        double fx=Math.cos(s.angle),fz=Math.sin(s.angle),x=s.x+fx*distance,z=s.z+fz*distance;
        if(x*x+z*z<=boundary*boundary){s.x=x;s.z=z;return;}
        // Spend the remaining step along the wall's arc instead of losing speed against it.
        double outward=s.x*fx+s.z*fz;
        double hit=Math.max(0,Math.min(distance,-outward+Math.sqrt(Math.max(0,outward*outward+boundary*boundary-s.x*s.x-s.z*s.z))));
        double wallX=s.x+fx*hit,wallZ=s.z+fz*hit,side=wallX*fz-wallZ*fx>=0?1:-1;
        double angle=Math.atan2(wallZ,wallX)+side*(distance-hit)/boundary;
        s.x=Math.cos(angle)*boundary;s.z=Math.sin(angle)*boundary;s.angle=angle+side*Math.PI/2;
    }
    private boolean canBite(Snake hunter,Snake prey){
        if(!started||hunter.ownerId.equals(prey.ownerId))return false;
        Snake head=hunter.id.equals(hunter.ownerId)?displayHead(hunter):hunter;
        return canEatMass(head.mass,combatMass(prey))&&prey.shieldUntil<=time&&prey.hurtUntil<=time&&time-head.lastBite>=.35;
    }
    private double combatMass(Snake snake){return snake.id.equals(snake.ownerId)?displayHead(snake).mass:snake.mass;}
    private void consumeFood(Snake head,Snake owner){
        for(Iterator<Point> it=food.iterator();it.hasNext();){Point f=it.next();if(Math.hypot(head.x-f.x,head.z-f.z)<head.radius()+.35){if(head==owner)changeOwnerMass(owner,owner.mass+FOOD_MASS);else creditPart(head,FOOD_MASS);totalFoodEaten++;it.remove();}}
    }
    private void recordMovement(Snake s){
        double distance=Math.hypot(s.x-s.previousX,s.z-s.previousZ);
        if(distance>1e-9){s.travel+=distance;s.trail.addFirst(new TrailPoint(s.x,s.z,s.travel));s.invalidateBody();}
        while(s.trail.size()>2&&s.travel-s.trail.getLast().distance>Math.max(s.length()+16,380))s.trail.removeLast();
    }
    private void separateBody(Snake s,boolean depenetrate){
        double x=s.previousX,z=s.previousZ,dx=s.x-x,dz=s.z-z;
        for(int slide=0;slide<2;slide++){
            int nearby=bodyIndex.query(x,z,x+dx,z+dz,s.radius()+.01);
            double earliest=2,nx=0,nz=0,depth=0;
            for(int k=0;k<nearby;k++){
                int i=bodyIndex.candidates[k];Snake other=bodyIndex.owners[i];
                if(other.ownerId.equals(s.ownerId)||canBite(s,other))continue;
                Point a=bodyIndex.from[i],b=bodyIndex.to[i];double radius=s.radius()+bodyIndex.radii[i]+.01;
                double hit=sweep(x,z,dx,dz,a.x,a.z,b.x,b.z,radius);
                if(hit<0||hit>earliest)continue;
                double hx=x+dx*hit,hz=z+dz*hit;Point near=project(hx,hz,a.x,a.z,b.x,b.z);
                double normalX=hx-near.x,normalZ=hz-near.z,d=Math.hypot(normalX,normalZ);
                if(d<1e-8){
                    normalX=-(b.z-a.z);normalZ=b.x-a.x;double n=Math.hypot(normalX,normalZ);
                    if(n<1e-8){normalX=-Math.cos(s.angle);normalZ=-Math.sin(s.angle);}
                    else{normalX/=n;normalZ/=n;}
                    if(normalX*dx+normalZ*dz>0){normalX=-normalX;normalZ=-normalZ;}
                }else{normalX/=d;normalZ/=d;}
                double penetration=hit==0?Math.max(0,radius-d):0;
                if(hit==0&&normalX*dx+normalZ*dz>=-1e-10&&(!depenetrate||penetration<1e-6))continue;
                if(hit==earliest&&penetration<=depth)continue;
                earliest=hit;nx=normalX;nz=normalZ;depth=penetration;
            }
            if(earliest>1){x+=dx;z+=dz;break;}
            double t=Math.max(0,earliest-1e-6);
            x+=dx*t;z+=dz*t;dx*=1-t;dz*=1-t;
            double inward=Math.min(0,dx*nx+dz*nz);dx-=inward*nx;dz-=inward*nz;
            if(depenetrate&&depth>0){
                double push=Math.min(depth,Math.min(s.radius()*.1,s.separationBudget));
                x+=nx*push;z+=nz*push;s.separationBudget-=push;depenetrate=false;
            }
            if(slide==1){
                // At a corner, retain only the already swept portion this tick.
                dx=dz=0;
            }
        }
        s.x=x;s.z=z;constrain(s);
    }
    private void separateHeads(List<Snake> actors,boolean depenetrate){
        for(int i=0;i<actors.size();i++)for(int j=i+1;j<actors.size();j++){
            Snake a=actors.get(i),b=actors.get(j);
            if(a.ownerId.equals(b.ownerId))continue;
            if(canBite(a,b)||canBite(b,a))continue;
            double ax=a.x-a.previousX,az=a.z-a.previousZ,bx=b.x-b.previousX,bz=b.z-b.previousZ;
            double rx=a.previousX-b.previousX,rz=a.previousZ-b.previousZ,radius=a.radius()+b.radius()+.01;
            double hit=sweep(rx,rz,ax-bx,az-bz,0,0,0,0,radius);
            if(hit<0)continue;
            double nx=rx+(ax-bx)*hit,nz=rz+(az-bz)*hit,n=Math.hypot(nx,nz);
            if(n<1e-8){nx=a.id.compareTo(b.id)<0?-1:1;nz=0;n=1;}
            nx/=n;nz/=n;
            double inward=Math.min(0,((ax-bx)*nx+(az-bz)*nz)*(1-hit));
            double approachA=Math.max(0,-ax*nx-az*nz),approachB=Math.max(0,bx*nx+bz*nz);
            double share=approachA+approachB<1e-8?.5:approachA/(approachA+approachB);
            a.x-=nx*inward*share;a.z-=nz*inward*share;
            b.x+=nx*inward*(1-share);b.z+=nz*inward*(1-share);
            if(depenetrate&&hit==0){
                double push=Math.min(Math.max(0,radius-Math.hypot(rx,rz))*.5,Math.min(a.separationBudget,b.separationBudget));
                a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;
                a.separationBudget-=push;b.separationBudget-=push;
            }
            constrain(a);constrain(b);
        }
    }
    /** Reused uniform grid of tapered body capsules; bounds the narrow phase to nearby segments. */
    private static final class BodyIndex {
        private static final int CAPACITY=480*180;
        private final Snake[] owners=new Snake[CAPACITY];
        private final Point[] from=new Point[CAPACITY],to=new Point[CAPACITY];
        private final double[] radii=new double[CAPACITY];
        private final int[] visited=new int[CAPACITY],candidates=new int[CAPACITY];
        private int[] cells=new int[0],links=new int[32768],entries=new int[32768];
        private int width,nodes,stamp,count;
        private double origin;
        void build(List<Snake> actors,int size){
            int nextWidth=(int)Math.ceil(size/8.0)+4;
            if(width!=nextWidth){width=nextWidth;cells=new int[width*width];}
            Arrays.fill(cells,-1);Arrays.fill(owners,0,count,null);Arrays.fill(from,0,count,null);Arrays.fill(to,0,count,null);
            nodes=0;count=0;origin=-size/2.0-16;
            for(Snake s:actors){
                List<Point> body=s.body();
                int stride=s.rigidBody?Math.max(1,(body.size()-1)/8):1;
                for(int j=0;j<body.size()-1;j+=stride){
                    Point a=body.get(j),b=body.get(Math.min(body.size()-1,j+stride));int i=count++;
                    double fraction=(double)j/(body.size()-1);
                    double taper=fraction<.64?1:Math.max(.06,Math.pow((1-fraction)/.36,.8));
                    double radius=s.radius()*taper;
                    owners[i]=s;from[i]=a;to[i]=b;radii[i]=radius;
                    int minX=cell(Math.min(a.x,b.x)-radius),maxX=cell(Math.max(a.x,b.x)+radius);
                    int minZ=cell(Math.min(a.z,b.z)-radius),maxZ=cell(Math.max(a.z,b.z)+radius);
                    for(int z=minZ;z<=maxZ;z++)for(int x=minX;x<=maxX;x++){
                        if(nodes==links.length){links=Arrays.copyOf(links,nodes*2);entries=Arrays.copyOf(entries,nodes*2);}
                        int bucket=z*width+x;entries[nodes]=i;links[nodes]=cells[bucket];cells[bucket]=nodes++;
                    }
                }
            }
        }
        int query(double ax,double az,double bx,double bz,double padding){
            if(++stamp==0){Arrays.fill(visited,0);stamp=1;}
            int found=0,minX=cell(Math.min(ax,bx)-padding),maxX=cell(Math.max(ax,bx)+padding);
            int minZ=cell(Math.min(az,bz)-padding),maxZ=cell(Math.max(az,bz)+padding);
            // Wide formation queries avoid repeatedly visiting the same capsule's cell links.
            if((maxX-minX+1)*(maxZ-minZ+1)>64){
                for(int i=0;i<count;i++)candidates[i]=i;return count;
            }
            for(int z=minZ;z<=maxZ;z++)for(int x=minX;x<=maxX;x++){
                for(int node=cells[z*width+x];node>=0;node=links[node]){
                    int i=entries[node];if(visited[i]==stamp)continue;
                    visited[i]=stamp;candidates[found++]=i;
                }
            }
            return found;
        }
        private int cell(double value){return Math.max(0,Math.min(width-1,(int)Math.floor((value-origin)/8)));}
    }
    private static double circleHit(double x,double z,double dx,double dz,double cx,double cz,double radius){
        double ox=x-cx,oz=z-cz,a=dx*dx+dz*dz,c=ox*ox+oz*oz-radius*radius;
        if(c<=0)return 0;
        double b=ox*dx+oz*dz;if(a<1e-16||b>=0)return -1;
        double disc=b*b-a*c;if(disc<0)return -1;
        double t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:-1;
    }
    // Earliest time a moving circle reaches a stationary capsule, including initial overlap.
    private static double sweep(double x,double z,double dx,double dz,double ax,double az,double bx,double bz,double radius){
        if(Math.max(x,x+dx)+radius<Math.min(ax,bx)||Math.min(x,x+dx)-radius>Math.max(ax,bx)
            ||Math.max(z,z+dz)+radius<Math.min(az,bz)||Math.min(z,z+dz)-radius>Math.max(az,bz))return -1;
        double sx=bx-ax,sz=bz-az,lengthSq=sx*sx+sz*sz;
        if(lengthSq<1e-16)return circleHit(x,z,dx,dz,ax,az,radius);
        double u=Math.max(0,Math.min(1,((x-ax)*sx+(z-az)*sz)/lengthSq));
        double ox=x-ax-sx*u,oz=z-az-sz*u;if(ox*ox+oz*oz<=radius*radius)return 0;
        double first=circleHit(x,z,dx,dz,ax,az,radius),last=circleHit(x,z,dx,dz,bx,bz,radius);
        double best=first<0?last:last<0?first:Math.min(first,last);
        double length=Math.sqrt(lengthSq),normal=(sx*(z-az)-sz*(x-ax))/length,velocity=(sx*dz-sz*dx)/length;
        if(Math.abs(velocity)>1e-12)for(int side=-1;side<=1;side+=2){
            double t=(side*radius-normal)/velocity;if(t<0||t>1)continue;
            double along=((x+dx*t-ax)*sx+(z+dz*t-az)*sz)/lengthSq;
            if(along>=0&&along<=1&&(best<0||t<best))best=t;
        }
        return best;
    }
    private void meal(Meal meal){meals.add(meal);if(meals.size()>24)meals.remove(0);}
    private record Bounds(double minX,double minZ,double maxX,double maxZ){
        static Bounds of(List<Point> body){
            double minX=Double.MAX_VALUE,minZ=Double.MAX_VALUE,maxX=-Double.MAX_VALUE,maxZ=-Double.MAX_VALUE;
            for(Point p:body){minX=Math.min(minX,p.x);minZ=Math.min(minZ,p.z);maxX=Math.max(maxX,p.x);maxZ=Math.max(maxZ,p.z);}
            return new Bounds(minX,minZ,maxX,maxZ);
        }
        boolean intersects(double ax,double az,double bx,double bz,double padding){
            return Math.max(ax,bx)+padding>=minX&&Math.min(ax,bx)-padding<=maxX&&Math.max(az,bz)+padding>=minZ&&Math.min(az,bz)-padding<=maxZ;
        }
    }
    private record Contact(Point point,double along,int segment,double distance){}
    private static double projectionFraction(double x,double z,double ax,double az,double bx,double bz){
        double dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
        return length<1e-8?0:Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length));
    }
    private static Point project(double x,double z,double ax,double az,double bx,double bz){
        double t=projectionFraction(x,z,ax,az,bx,bz);
        return new Point(ax+(bx-ax)*t,az+(bz-az)*t);
    }
    private static Contact contact(List<Point> body,double ax,double az,double bx,double bz){
        double bestDistance=Double.MAX_VALUE,bestX=body.get(0).x,bestZ=body.get(0).z,bestAlong=0,along=0;
        int bestSegment=0;double vx=bx-ax,vz=bz-az;
        for(int i=0;i<body.size()-1;i++){
            Point a=body.get(i),b=body.get(i+1);double dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
            double cross=dx*vz-dz*vx;
            if(Math.abs(cross)>1e-8){
                double t=((ax-a.x)*vz-(az-a.z)*vx)/cross,u=((ax-a.x)*dz-(az-a.z)*dx)/cross;
                if(t>=0&&t<=1&&u>=0&&u<=1)return new Contact(new Point(a.x+dx*t,a.z+dz*t),along+length*t,i,0);
            }
            for(int k=0;k<4;k++){
                double t=k==0?projectionFraction(ax,az,a.x,a.z,b.x,b.z):k==1?projectionFraction(bx,bz,a.x,a.z,b.x,b.z):k==2?0:1;
                double px=a.x+dx*t,pz=a.z+dz*t;
                double u=k==0?0:k==1?1:projectionFraction(px,pz,ax,az,bx,bz);
                double ex=px-ax-vx*u,ez=pz-az-vz*u,distance=ex*ex+ez*ez;
                if(distance<bestDistance){bestDistance=distance;bestX=px;bestZ=pz;bestAlong=along+length*t;bestSegment=i;}
            }
            along+=length;
        }
        return new Contact(new Point(bestX,bestZ),bestAlong,bestSegment,Math.sqrt(bestDistance));
    }
    private static double playableRadius(int size,double radius){return Math.max(1,size/2.0-radius-1);}
    private static Point clamp(double x,double z,double limit){
        double distance=Math.hypot(x,z),scale=distance>limit?limit/distance:1;
        return new Point(x*scale,z*scale);
    }
    private void constrain(Snake s){Point p=clamp(s.x,s.z,playableRadius(size,s.radius()));s.x=p.x;s.z=p.z;}
    private Point randomPoint(double limit){
        double angle=random.nextDouble()*Math.PI*2,radius=Math.sqrt(random.nextDouble())*limit;
        return new Point(Math.cos(angle)*radius,Math.sin(angle)*radius);
    }
    private void refillFood(){int count=Math.min(240,Math.max(40,size*2));while(food.size()<count)food.add(randomPoint(size/2.0-4));}
    private void notice(String n){notices.addFirst(n);while(notices.size()>4)notices.removeLast();}
}
