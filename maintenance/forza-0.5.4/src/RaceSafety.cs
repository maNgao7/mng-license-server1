using CircuitSuperstars;
using CircuitSuperstars.TrackData;
using System.Text.Json;
using UnityEngine;
using System.Runtime.InteropServices;
using Il2CppInterop.Runtime;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed class PendingViewer
{
    public string Username,Nickname,Avatar="";
    public int Coins;
    public bool FreeEntry;
    public float AudienceSpeed;
    public int ForwardJumps;
    public int RocketJumps;
}

public sealed partial class ArcadeDirector
{
    private const int MaximumRaceCars=30;
    private readonly Dictionary<string,PendingViewer> pendingJoins=new();
    private float nextJoinCheck;
    private bool nativeChassisTest;
    private bool nativeGridTest;
    private bool originalBodyTest;
    private int gridLineAnchorId;
    private int gridLinePathId;
    private Vector3[] cachedGridRacingLine=Array.Empty<Vector3>();
    private string gridLineCoordinateMode="unresolved";
    private readonly List<string> expandedGridAiStarted=new();
    private readonly Dictionary<string,string> expandedGridAiErrors=new(StringComparer.Ordinal);
    public bool NativeGridTest=>nativeGridTest;
    private bool recordDrivingTelemetry;
    public bool UseNativeChassisTest=>nativeChassisTest;
    private static RacerAIDescriptor RacingDriver()=>RacerAIDescriptors.All.First(a=>a.name=="racerai-generic-pro");
    private static AIPath RacingPath()
    {
        return UObj.FindObjectsOfType<AIPath>().FirstOrDefault(p=>!p.isOpeningLane&&p.OnlyForVehicleClasses==VehicleClassFlag.None)
            ??throw new InvalidOperationException("Pistin yerel yaris hatti bulunamadi.");
    }
    private static CCRSpline2D RacingLine()=>RacingPath().Spline;
    private Vector3[] WorldRacingLine()
    {
        var track=UObj.FindObjectOfType<TrackSceneData>();
        var markers=track?.vehicleSpawnMarkerList?.markers;
        if(markers==null||markers.Length==0)throw new InvalidOperationException("Baslangic sirasi bulunamadi.");
        var anchor=markers[0];var anchorId=anchor.GetInstanceID();var path=RacingPath();var pathId=path.GetInstanceID();
        if(anchorId!=gridLineAnchorId||pathId!=gridLinePathId||cachedGridRacingLine.Length<8)
        {
            const int samples=4096;
            var direct=new Vector3[samples];var transformed=new Vector3[samples];
            for(var i=0;i<samples;i++)
            {
                CCRSpline2DUtil.EvaluatePositionAndDerivativeAt(path.Spline,i/(float)(samples-1),out var point,out _);
                direct[i]=new Vector3(point.x,anchor.position.y,point.y);
                var world=path.transform.TransformPoint(new Vector3(point.x,0,point.y));
                world.y=anchor.position.y;transformed[i]=world;
            }
            cachedGridRacingLine=StartingGridGeometry.ResolveWorldCoordinates(direct,transformed,anchor.position,out gridLineCoordinateMode);
            gridLineAnchorId=anchorId;gridLinePathId=pathId;
        }
        return cachedGridRacingLine;
    }
    private Vector2[] SampleWorldRacingLine(int count)
    {
        var world=WorldRacingLine();var sampled=new Vector2[count];
        for(var i=0;i<count;i++)
        {
            var point=world[(int)((long)i*world.Length/count)];
            sampled[i]=new Vector2(point.x,point.z);
        }
        return sampled;
    }
    private void StartExpandedGridAi()
    {
        expandedGridAiStarted.Clear();expandedGridAiErrors.Clear();
        var nativeCount=UObj.FindObjectOfType<TrackSceneData>()?.vehicleSpawnMarkerList?.markers?.Length??12;
        var extras=entries.Where(entry=>entry.Slot>nativeCount&&IsCarAlive(entry)).ToArray();
        if(extras.Length==0)return;
        var spline=RacingLine();
        // The AI patches expand the per-tick range. Never write the engine's static
        // scheduling constants through the generated interop setters.
        foreach(var entry in extras)
        {
            try
            {
                var car=entry.Car;
                car.EnableAutomobilePhysics();if(!car.wheelsEnabled)car.EnableWheels();
                car.aiInput.StartAi(car,RacingDriver(),spline,false);
                if(car.Respawner!=null)car.Respawner.enabled=false;
                expandedGridAiStarted.Add(entry.Username);
            }
            catch(Exception ex){expandedGridAiErrors[entry.Username]=ex.Message;Plugin.Output.LogWarning("Expanded grid AI start failed for "+entry.Username+": "+ex.Message);}
        }
        RaceOpener.StartRacingAiForAiVehicles(RaceManager.Instance.RacerData);
        foreach(var entry in extras.Where(entry=>expandedGridAiStarted.Contains(entry.Username)))
        {
            if(InitializeLateJoinRaceControls(entry))continue;
            expandedGridAiErrors[entry.Username]="Native clutch release did not engage.";
            Plugin.Output.LogWarning("Expanded grid clutch release unavailable: "+entry.Username);
        }
        Plugin.Output.LogInfo($"Expanded grid AI released: {expandedGridAiStarted.Count}/{extras.Length}; clutch errors: {expandedGridAiErrors.Count}.");
    }
    private PositionAndRotation[] BuildExpandedStartingGrid(Transform[] markers,int count)
    {
        if(markers==null||markers.Length==0||count<=0)return Array.Empty<PositionAndRotation>();
        count=Math.Min(count,MaximumRaceCars);
        if(count<=markers.Length)return StartingGridGeometry.Build(markers,count,Array.Empty<Vector3>());
        return StartingGridGeometry.Build(markers,count,WorldRacingLine());
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    [return:MarshalAs(UnmanagedType.I1)]
    private delegate bool GetIgnoredPair(IntPtr a,IntPtr b);
    private static GetIgnoredPair getIgnoredPair;
    private static bool PairIgnored(Collider a,Collider b)
    {
        getIgnoredPair??=IL2CPP.ResolveICall<GetIgnoredPair>("UnityEngine.Physics::GetIgnoreCollision_Injected");
        return getIgnoredPair(UnityEngine.Object.MarshalledUnityObject.MarshalNotNull(a),UnityEngine.Object.MarshalledUnityObject.MarshalNotNull(b));
    }
    private void AccumulatePending(PendingViewer pending,int coins,bool freeEntry,float bonus,string avatar)
    {
        pending.Coins=RaceEconomy.Add(pending.Coins,coins);
        pending.FreeEntry|=freeEntry;
        pending.AudienceSpeed=Math.Min(750,pending.AudienceSpeed+bonus);
        if(avatar.Length>0)pending.Avatar=avatar;
    }
    private void DrainPendingJoins()
    {
        if(RoundTransitioning||awaitingQueueAdmission||pendingJoins.Count==0 || Time.unscaledTime<nextJoinCheck)return;
        nextJoinCheck=Time.unscaledTime+.25f;
        if(startRequested&&!Running)return;
        var eligible=pendingJoins.Where(p=>p.Value.FreeEntry||p.Value.Coins>=settings.EntryFeeCoins).Take(1).ToArray();
        if(eligible.Length==0)return;
        var pair=eligible[0];var pending=pair.Value;
        if(!AddViewerCar(pending.Username,pending.Nickname))return;
        var entry=entries.First(e=>e.Username==pending.Username);
        entry.Avatar=pending.Avatar;entry.Coins=pending.Coins;entry.AudienceSpeed=pending.AudienceSpeed;
        entry.PendingForwardJumps=pending.ForwardJumps;
        entry.PendingRocketJumps=pending.RocketJumps;
        ApplyEconomy(entry);
        pendingJoins.Remove(pair.Key);
    }
    private bool TryNearLinePose(TrackSceneData track,out PositionAndRotation pose)
    {
        pose=default;
        var markers=track?.vehicleSpawnMarkerList?.markers;
        if(markers==null||markers.Length==0)return false;
        var grid=markers[0];
        foreach(var lane in new[]{0f,3.25f})
        {
            var candidate=grid.position+grid.right*lane;
            var clear=true;
            foreach(var entry in entries)
            {
                if(!IsCarAlive(entry))continue;
                var velocity=entry.Car.CachedRigidbody==null?Vector3.zero:entry.Car.CachedRigidbody.linearVelocity;
                var delta=entry.Car.transform.position-candidate;
                if(StartLaneTrafficIntersects(Vector3.Dot(delta,grid.forward),Vector3.Dot(delta,grid.right),
                    Vector3.Dot(velocity,grid.forward),Vector3.Dot(velocity,grid.right)))clear=false;
                if(!clear)break;
            }
            if(clear){pose=new PositionAndRotation{position=candidate,rotation=grid.rotation};return true;}
        }
        pose=default;return false;
    }
    private static bool StartLaneTrafficIntersects(float forward,float right,float forwardSpeed,float rightSpeed)
    {
        if(!float.IsFinite(forward)||!float.IsFinite(right)||!float.IsFinite(forwardSpeed)||!float.IsFinite(rightSpeed))return true;
        // Intersect both swept slabs over the same interval; endpoint samples miss fast traffic.
        var from=0f;var until=.4f;
        return StartLaneSlab(forward,forwardSpeed,5.2f,ref from,ref until)
            &&StartLaneSlab(right,rightSpeed,2.55f,ref from,ref until);
    }
    private static bool StartLaneSlab(float position,float speed,float clearance,ref float from,ref float until)
    {
        if(Mathf.Abs(speed)<.0001f)return Mathf.Abs(position)<=clearance;
        var a=(-clearance-position)/speed;var b=(clearance-position)/speed;
        from=Math.Max(from,Math.Min(a,b));until=Math.Min(until,Math.Max(a,b));
        return from<=until;
    }
    private void ConfigureModelCollision(ViewerCar entry,VehicleModelData data)
    {
        // Body upgrades are visual only; retain the game's calibrated chassis.
        var body=entry.Car.GetComponentsInChildren<Collider>().FirstOrDefault(c=>c.name=="Vehicle Collider");
        if(body==null)throw new InvalidOperationException("Yerel arac carpismasi bulunamadi.");
        entry.CollisionHull=body;entry.Visual.CollisionBody=body;
        // Viewer cars may pass through one another, but still collide with the track.
        foreach(var other in entries)
            if(other!=entry&&IsCarAlive(other)&&other.CollisionHull!=null)
                Physics.IgnoreCollision(body,other.CollisionHull,true);
    }
    private void VerifyNearLineJoin()
    {
        if(Running)throw new InvalidOperationException("Katilim noktasi testi yaris baslamadan yapilir.");
        while(entries.Count<2)SpawnTest();
        var track=UObj.FindObjectOfType<TrackSceneData>();var grid=track.vehicleSpawnMarkerList.markers[0];
        var a=entries[0].Car;var b=entries[1].Car;
        var p0=a.transform.position;var p1=b.transform.position;var r0=a.transform.rotation;var r1=b.transform.rotation;
        try
        {
            a.ServerTeleport(grid.position,grid.rotation);b.ServerTeleport(grid.position+grid.right*3.25f,grid.rotation);
            Physics.SyncTransforms();
            var blocked=!TryNearLinePose(track,out _);
            b.ServerTeleport(grid.position-grid.forward*20,grid.rotation);Physics.SyncTransforms();
            var available=TryNearLinePose(track,out var candidate);
            var distance=available?Vector3.Distance(candidate.position,grid.position):999;
            File.WriteAllText(Path.Combine(control,"join-test.json"),JsonSerializer.Serialize(new{utc=DateTime.UtcNow,passed=blocked&&available&&distance<4,
                bothLanesBlocked=blocked,freeLaneFound=available,distanceFromFirstGrid=distance,raceStarted=Running},jsonOptions));
        }
        finally {a.ServerTeleport(p0,r0);b.ServerTeleport(p1,r1);}
    }
    private float nextRecoveryCheck;
    private int outOfWorldRecoveries;
    private void RecoverLostVehicles()
    {
        if(!Running||Time.unscaledTime<nextRecoveryCheck)return;
        nextRecoveryCheck=Time.unscaledTime+1;
        foreach(var entry in entries)
        {
            if(!IsCarAlive(entry))continue;
            var y=entry.Car.transform.position.y;
            if(y>-5&&y<80)continue;
            entry.Car.Respawner.ServerForceRespawn(entry.Car);
            outOfWorldRecoveries++;
            Plugin.Output.LogWarning("Recovered out-of-world viewer vehicle: "+entry.Username);
        }
    }
    private System.Collections.IEnumerator VerifyVehicleContact()
    {
        if(Running)throw new InvalidOperationException("Carpisma testi yaris baslamadan yapilir.");
        while(entries.Count<2)SpawnTest();
        var a=entries[0].Car;var b=entries[1].Car;
        var p0=a.transform.position;var p1=b.transform.position;
        var r0=a.transform.rotation;var r1=b.transform.rotation;
        var k0=a.CachedRigidbody.isKinematic;var k1=b.CachedRigidbody.isKinematic;
        var c0=entries[0].CollisionHull;
        var c1=entries[1].CollisionHull;
        var overlapBefore=0f;var overlapAfter=0f;var overlapping=false;
        try
        {
            a.EnableAutomobilePhysics();b.EnableAutomobilePhysics();
            a.CachedRigidbody.isKinematic=false;b.CachedRigidbody.isKinematic=false;
            b.ServerTeleport(p0+a.transform.right*.9f,r0);
            a.CachedRigidbody.linearVelocity=Vector3.zero;b.CachedRigidbody.linearVelocity=Vector3.zero;
            Physics.SyncTransforms();
            Physics.ComputePenetration(c0,c0.transform.position,c0.transform.rotation,c1,c1.transform.position,c1.transform.rotation,out _,out overlapBefore);
            yield return new WaitForSecondsRealtime(1.2f);
            overlapping=Physics.ComputePenetration(c0,c0.transform.position,c0.transform.rotation,c1,c1.transform.position,c1.transform.rotation,out _,out overlapAfter);
            if(!overlapping)overlapAfter=0;
            var pairIgnored=PairIgnored(c0,c1);var layerIgnored=Physics.GetIgnoreLayerCollision(c0.gameObject.layer,c1.gameObject.layer);
            // Cars may overlap without pushing; the native collision layer stays active for the track.
            var passed=overlapBefore>.2f && pairIgnored && !layerIgnored && c0.enabled && c1.enabled && a.wheelsEnabled && b.wheelsEnabled;
            File.WriteAllText(Path.Combine(control,"contact-test.json"),JsonSerializer.Serialize(new{utc=DateTime.UtcNow,passed,overlapBefore,overlapAfter,
                overlapping,pairIgnored,layerIgnored,layers=new[]{c0.gameObject.layer,c1.gameObject.layer},
                rigidbodies=new[]{c0.attachedRigidbody.GetInstanceID(),c1.attachedRigidbody.GetInstanceID()},
                distance=Vector3.Distance(a.transform.position,b.transform.position),raceStarted=Running},jsonOptions));
            Plugin.Output.LogInfo("Native collision test: "+passed+" (penetration "+overlapBefore+" -> "+overlapAfter+")");
        }
        finally
        {
            a.CachedRigidbody.linearVelocity=Vector3.zero;b.CachedRigidbody.linearVelocity=Vector3.zero;
            a.CachedRigidbody.angularVelocity=Vector3.zero;b.CachedRigidbody.angularVelocity=Vector3.zero;
            a.ServerTeleport(p0,r0);b.ServerTeleport(p1,r1);
            a.DisableAutomobilePhysics();b.DisableAutomobilePhysics();
            a.EnableWheels();b.EnableWheels();
            a.CachedRigidbody.isKinematic=k0;b.CachedRigidbody.isKinematic=k1;
        }
    }
    private void WriteVehicleDiagnostics()
    {
        var track=UObj.FindObjectOfType<TrackSceneData>();
        var manager=UObj.FindObjectOfType<RacerAiManager>();
        var data=new {
            utc=DateTime.UtcNow,pid=Environment.ProcessId,phase,nativeChassisTest,
            registeredWheelCount=WheelSystem.allWheelIDs.Length,
            raceLineCoordinateMode=gridLineCoordinateMode,
            drivingPaths=UObj.FindObjectsOfType<AIPath>().Select(p=>new{p.name,p.isOpeningLane,classes=p.OnlyForVehicleClasses.ToString(),points=p.Spline.NumPoints,channels=p.Spline.NumFloatChannels,pointer=p.Spline.Pointer.ToInt64(),world=new{x=p.transform.position.x,y=p.transform.position.y,z=p.transform.position.z,rx=p.transform.eulerAngles.x,ry=p.transform.eulerAngles.y,rz=p.transform.eulerAngles.z}}).ToArray(),
            descriptors=RacerAIDescriptors.All.Select(a=>new{a.name,a.displayName,target=a.targetModuleDescriptor?.name,control=a.controlModuleDescriptor?.name,a.difficultyValueHigh,a.difficultyValueLow}).ToArray(),
            paths=track?.progressPath?.progressPath.Select(t=>new{t.name,x=t.position.x,y=t.position.y,z=t.position.z,forwardX=t.forward.x,forwardY=t.forward.y,forwardZ=t.forward.z}).ToArray(),
            progressPathTransform=track?.progressPath==null?null:new{x=track.progressPath.transform.position.x,y=track.progressPath.transform.position.y,z=track.progressPath.transform.position.z,
                rx=track.progressPath.transform.eulerAngles.x,ry=track.progressPath.transform.eulerAngles.y,rz=track.progressPath.transform.eulerAngles.z},
            checkpoints=UObj.FindObjectsOfType<ProgressCheckpoint>().Select(c=>new{c.name,position=c.transform.position.ToString(),forward=c.transform.forward.ToString()}).ToArray(),
            ai=manager==null?null:Enumerable.Range(0,manager.allIds.Count).Select(i=>new{id=manager.allIds[i].ToString(),mode=manager.allAiModes[i].ToString(),position=manager.allAutomobiles[i].transform.position.ToString(),
                difficulty=manager.allDifficulties[i].difficultyValue,target=manager.allDriveTargets[i].targetSteerPosition.ToString(),
                targetForward=manager.allDriveTargets[i].targetSteerForward.ToString(),leftRoom=manager.allDriveTargets[i].maxOffsetLeft,rightRoom=manager.allDriveTargets[i].maxOffsetRight,
                controlSteer=manager.allControlValues[i].steer,controlThrottle=manager.allControlValues[i].throttle,
                pid=manager.allControlModules[i].TryCast<PidAiControlModule>()?.debugSteerAngle.ToString()}).ToArray(),
            cars=entries.Where(IsCarAlive).Select(e=>new {
                e.Username,participantId=e.Id.ToString(),position=e.Car.transform.position.ToString(),localSize=e.Car.localSize2d.ToString(),
                mass=e.Car.CachedRigidbody.mass,inertia=e.Car.CachedRigidbody.inertiaTensor.ToString(),centerOfMass=e.Car.CachedRigidbody.centerOfMass.ToString(),
                fuel=e.Car.condition.fuel.AmountRatio,bodyHealth=e.Car.condition.bodyHealth.AmountRatio,tireHealth=e.Car.condition.tireHealth.AmountRatio,
                rpm=e.Car.motor.Rpm,motorThrottle=e.Car.motorController.MotorThrottle,clutch=e.Car.motorController.MotorClutch,
                motorTorque=e.Car.motor.motorTorque,motorInertia=e.Car.motor.rotationalInertia,steerForce=e.Car.steering.steerForce,forceDivision=e.Car.steering.forceDivision,
                torqueScale=e.Car.wheelsSetup.torqueScale,springLength=e.Car.wheelsSetup.frontSpringLength,frontBalance=e.Car.wheelsSetup.sidewaysFrictionFrontBalanceGain,
                numWheelsFactor=e.Car.loadStabilizer.numberOfWheelsFactor,invNumWheels=e.Car.motor.invNumWheels,
                grip=e.Car.wheelsSetup.gripBoostFactor,aiWheelSetup=e.Car.wheelsSetup.isAiPlayer,forceMultiplier=e.Car.aiInput.ForceMultiplier,
                wheelData=e.Car.wheelsSetup.allWheels.Select(w=>new{w.name,w.wheelID,w.wheelIndex,radius=w.Radius,load=w.WheelLoad,grounded=w.IsGrounded,slip=w.SlipAngle,position=w.transform.position.ToString()}).ToArray(),
                x=e.Car.transform.position.x,y=e.Car.transform.position.y,z=e.Car.transform.position.z,yaw=e.Car.transform.eulerAngles.y,speed=e.Car.Speed,
                pathPointer=e.Car.aiInput.Path?.Pointer.ToInt64(),pathPoints=e.Car.aiInput.Path?.NumPoints,pathChannels=e.Car.aiInput.Path?.NumFloatChannels,
                visualLocal=e.Car.visualsRoot.localPosition.ToString(),visualScale=e.Car.visualsRoot.localScale.ToString(),visualPosition=e.Car.visualsRoot.position.ToString(),
                e.GridHeld,gridY=e.GridPosition.y,mode=e.Car.aiInput.mode.Value.ToString(),path=e.Car.aiInput.Path!=null,physics=e.Car.hasPhysicsTicked,wheels=e.Car.wheelsEnabled,
                localAuthority=e.Car.CheckIsLocallyResponsible(),kinematic=e.Car.CachedRigidbody.isKinematic,gravity=e.Car.CachedRigidbody.useGravity,
                detection=e.Car.CachedRigidbody.collisionDetectionMode.ToString(),constraints=e.Car.CachedRigidbody.constraints.ToString(),targetSpeed=e.Car.aiSettings.targetSpeed,
                aiDescriptor=e.Car.aiInput.AiDescriptor?.name,steering=e.Car.LastSimulatedInputs.steer.AsFloat,
                throttle=e.Car.LastSimulatedInputs.throttle.AsFloat,brake=e.Car.LastSimulatedInputs.brake.AsFloat,
                finalLap=RaceManager.Instance.RacerData.FinalLapNumbers.ContainsKey(e.Id)?RaceManager.Instance.RacerData.FinalLapNumbers[e.Id]:-1,
                ghost=GhostingManager.Instance?.FindGhostable(e.Car.gameObject)?.isGhosted,
                colliders=e.Car.GetComponentsInChildren<Collider>().Select(c=>new{name=c.name,type=c.GetIl2CppType().Name,layer=c.gameObject.layer,trigger=c.isTrigger,c.enabled,bounds=c.bounds.ToString(),localPosition=c.transform.localPosition.ToString(),localRotation=c.transform.localEulerAngles.ToString(),localScale=c.transform.localScale.ToString(),selfIgnored=Physics.GetIgnoreLayerCollision(c.gameObject.layer,c.gameObject.layer)}).ToArray()
            }).ToArray()
        };
        File.WriteAllText(Path.Combine(control,"vehicle-diagnostics.json"),JsonSerializer.Serialize(data,jsonOptions));
    }
}
