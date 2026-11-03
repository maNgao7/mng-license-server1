using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private bool autoPlaying, autoPreviousVacuum, autoCollecting;
    private readonly AutoVacuumBatch autoVacuumBatch = new();
    private Enemy autoTarget;
    private Vector3 autoMove, autoLastPosition;
    private Quaternion autoAim;
    private bool autoHasAim;
    private NavMeshPath autoPath;
    private readonly Vector3[] autoCornerBuffer = new Vector3[64];
    private Vector3[] autoCorners = Array.Empty<Vector3>();
    private int autoCorner, autoAttacks, autoBodyStart, autoKills;
    private float autoNextTarget, autoNextPath, autoNextShot, autoMotionCheck, autoStuckFor;
    private float autoNextJump;
    private float autoCollectionProgressAt;
    private int autoLastCollected;
    private bool autoJumpRequested;
    private int autoJumps;
    private string autoStatus = "KAPALI", autoError = "";
    private string autoRayHit = "";
    private float autoTargetDistance, autoAimError;
    private readonly int[] autoWeaponAttacks = new int[8];
    private readonly Dictionary<int, string> autoAnimationStates = new();
    private float autoCommitUntil, autoNextStrafe, autoSwingUntil;
    private float autoStrafe = 1;
    private int autoTargetChanges;
    private IntPtr autoPreviousTarget;

    private void SetAutoPlay(bool enabled, bool restoreTool = true)
    {
        if (autoPlaying == enabled) return;
        if (enabled) { autoPreviousVacuum = vacuum; autoError = ""; autoBodyStart = vacuumCollected; }
        autoPlaying = enabled;
        autoTarget = null; autoMove = Vector3.zero; autoCorners = Array.Empty<Vector3>();
        autoNextTarget = autoNextPath = autoNextShot = 0; autoStuckFor = 0;
        autoVacuumBatch.Reset(); autoCollecting = false; autoHasAim = false;
        autoCommitUntil = autoSwingUntil = 0; autoNextStrafe = 0;
        autoLastCollected = vacuumCollected; autoCollectionProgressAt = Time.time;
        StopAutoEffects();
        if (!enabled)
        {
            var body = Player.Instance.rb;
            body.linearVelocity = new Vector3(0, body.linearVelocity.y, 0);
            Player.Instance.input = Vector3.zero;
        }
        if (!enabled && restoreTool) { vacuum = autoPreviousVacuum; ApplyWeapon(); }
        autoStatus = enabled ? "HEDEF BEKLENIYOR" : "KAPALI";
        Notice(enabled ? "OTOMATIK OYUN ACIK" : "KONTROL SENDE");
    }

    private static bool BeforePlayerMove() => (!Current.autoPlaying || Current.PrisonActive) && !Current.dashActive && !Current.QaLocked && !Current.roundDied;

    private static bool BeforeAutoFixedUpdate(Player __instance)
    {
        if (Current.dashActive) { __instance.CheckGround(); return false; }
        if (Current.PrisonActive && !Current.QaLocked) return true;
        if (!Current.autoPlaying && !Current.QaLocked) return true;
        if (Current.ready && !Current.menu && !GameManager.Instance.IsPaused)
        {
            __instance.CheckGround();
            __instance.ApplyGravity();
        }
        return false;
    }

    public override void OnFixedUpdate()
    {
        if (!ready || failed) return;
        if (dashActive) { StepAirDash(); return; }
        if (!autoPlaying || menu || GameManager.Instance.IsPaused || PrisonActive || roundDied) return;
        var body = Player.Instance.rb;
        var velocity = body.linearVelocity;
        Vector3 desired = PrisonActive || effects.FlashSeconds > 0 ? Vector3.zero : autoMove;
        Vector3 horizontal = Vector3.MoveTowards(new Vector3(velocity.x, 0, velocity.z), desired, 35 * Time.fixedDeltaTime);
        if (autoJumpRequested && Time.time >= autoNextJump && Player.Instance.IsGrounded)
        {
            velocity.y = Math.Clamp(Player.Instance.jumpForce, 3.5f, 6);
            autoNextJump = Time.time + 1.2f; autoJumpRequested = false; autoJumps++;
        }
        body.linearVelocity = new Vector3(horizontal.x, velocity.y, horizontal.z);
    }

    private void StopAutoEffects()
    {
        if (!ready) return;
        var tool = Vacuum.Instance;
        tool.SetState(Vacuum.VacuumState.Idle);
        tool.vacuumStrength = tool.targetVacuumStrength = 0;
        var flame = weapons[7].Cast<FlameThrower>();
        flame.isFiring = false;
        flame.flameParticle.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        flame.UpdateAudio();
    }

    private void UpdateAutoPlay()
    {
        if (!autoPlaying) return;
        try
        {
            autoMove = Vector3.zero;
            if (menu || GameManager.Instance.IsPaused || PrisonActive || effects.FlashSeconds > 0 || roundDied)
            {
                autoStatus = roundDied ? "YENI TUR" : menu || GameManager.Instance.IsPaused ? "DURAKLATILDI" : PrisonActive ? "HAPIS" : "FLAS";
                StopAutoEffects(); return;
            }
            if (settings.TimedMode && challenge.Phase == ChallengePhase.Waiting && (rules.Alive > 0 || pending.Count > 0)) StartChallenge(true);
            if (settings.TimedMode && challenge.Phase == ChallengePhase.Preparing)
                challenge.SkipPreparation(Time.time);
            bool onlyCollect = rules.Won || roundTimedOut;
            if ((Time.time >= autoNextTarget && Time.time >= autoSwingUntil) || autoTarget == null || !autoTarget.gameObject.activeInHierarchy
                || autoTarget.IsDead != autoCollecting || BehindMissionBoard(autoTarget.rb.position))
            {
                autoNextTarget = Time.time + 2.5f + (float)random.NextDouble() * 1.5f;
                PickAutoTarget(onlyCollect);
            }
            if (autoTarget == null)
            {
                autoStatus = onlyCollect ? "YENI TUR" : "HEDEF BEKLENIYOR";
                StopAutoEffects(); return;
            }

            bool collecting = autoTarget.IsDead;
            if (!collecting || vacuumCollected != autoLastCollected)
            { autoLastCollected = vacuumCollected; autoCollectionProgressAt = Time.time; }
            if (vacuum != collecting) { StopAutoEffects(); vacuum = collecting; ApplyWeapon(); }
            Vector3 target = autoTarget.GrabCenter;
            var camera = Player.Instance.mainCamera.transform;
            Vector3 direction = target - camera.position;
            if (direction.sqrMagnitude < .01f) return;
            autoAim = Quaternion.RotateTowards(camera.rotation, Quaternion.LookRotation(direction, Vector3.up), 220 * Time.deltaTime);
            autoHasAim = true;
            ApplyAutoAim();

            float distance = direction.magnitude;
            autoTargetDistance = distance;
            float stalledCollection = Time.time - autoCollectionProgressAt;
            float range = collecting ? stalledCollection > 4 ? 1.4f : stalledCollection > 1 ? 2.5f : 7 : AutoAttackRange();
            bool visible = Physics.Raycast(camera.position, direction.normalized, out var hit, distance + 1,
                Player.Instance.ignorePlayerLayer, QueryTriggerInteraction.Ignore);
            Enemy aimed = visible ? hit.collider.GetComponentInParent<Enemy>() : null;
            autoRayHit = visible ? ScenePath(hit.collider.transform) : "";
            bool targetVisible = aimed != null && creaturePointers.Contains(aimed.Pointer);
            if (!collecting && targetVisible && aimed.IsDead)
            {
                autoCommitUntil = 0; autoNextTarget = 0; PickAutoTarget(false);
                if (!autoCollecting) RepositionAutoCombat(aimed.rb.position, 2);
                return;
            }
            autoAimError = Vector3.Angle(camera.forward, direction);
            bool aimReady = autoAimError < 6;
            if (distance > range || !targetVisible) MoveAutoToward(autoTarget.rb.position, collecting ? Math.Max(.4f, range * .4f) : Math.Max(.7f, range * .7f));
            else if (!collecting) RepositionAutoCombat(autoTarget.rb.position, range);
            else { autoCorners = Array.Empty<Vector3>(); autoNextPath = 0; autoStuckFor = 0; }

            autoStatus = collecting ? "TOPLANIYOR" : "AVLANIYOR";
            EvadeNearbyCreatures();
            if (collecting)
            {
                if (distance <= VacuumRange && aimReady)
                {
                    var tool = Vacuum.Instance;
                    tool.SetState(Vacuum.VacuumState.Sucking);
                    tool.vacuumStrength = tool.targetVacuumStrength = 1;
                    tool.Suck(); tool.UpdateAudio(); tool.UpdateVisuals();
                }
                return;
            }
            if (distance > range + .4f || !targetVisible || !aimReady || Time.time < autoNextShot) return;
            FireAutoWeapon(aimed, hit);
        }
        catch (Exception error)
        {
            autoError = error.Message;
            SetAutoPlay(false);
            autoStatus = "KONTROL SENDE";
            File.WriteAllText(Path.Combine(Root, "qa", "auto-last-error.txt"), error.ToString());
            MelonLoader.MelonLogger.Warning("Auto play stopped: " + error);
        }
    }

    private void PickAutoTarget(bool onlyCollect)
    {
        Enemy live = null, body = null;
        int bodyCount = 0;
        float liveDistance = float.MaxValue, bodyDistance = float.MaxValue;
        Vector3 position = Player.Instance.rb.position;
        bool keepTarget = autoTarget != null && autoTarget.gameObject.activeInHierarchy && !autoTarget.IsDead
            && !onlyCollect && Time.time < autoCommitUntil && !BehindMissionBoard(autoTarget.rb.position);
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (enemy == null || !enemy.gameObject.activeInHierarchy || enemy.isHeld || BehindMissionBoard(enemy.rb.position)) continue;
            float distance = (enemy.rb.position - position).sqrMagnitude;
            if (enemy.IsDead)
            {
                if (!creature.Friendly) bodyCount++;
                if (distance < bodyDistance) { bodyDistance = distance; body = enemy; }
            }
            else if (!enemy.IsDead && !creature.Friendly && !onlyCollect)
            {
                // Prefer reachable nearby groups without always selecting the single nearest creature.
                float angle = Vector3.Angle(Player.Instance.mainCamera.transform.forward, enemy.GrabCenter - Player.Instance.mainCamera.transform.position);
                float score = MathF.Sqrt(distance) * (.75f + (float)random.NextDouble() * .65f) + angle * .035f;
                if (enemy.Pointer == autoPreviousTarget) score += 3;
                if (score < liveDistance) { liveDistance = score; live = enemy; }
            }
        }
        bool collectBatch = autoVacuumBatch.Observe(bodyCount);
        Enemy next = collectBatch ? body : keepTarget ? autoTarget : live;
        if (next != null && (autoTarget == null || next.Pointer != autoTarget.Pointer))
        {
            autoPreviousTarget = autoTarget?.Pointer ?? IntPtr.Zero;
            autoTargetChanges++; autoCommitUntil = Time.time + 1.8f;
            autoCorners = Array.Empty<Vector3>(); autoNextPath = 0;
        }
        autoTarget = next;
        autoCollecting = autoTarget != null && autoTarget.IsDead;
    }

    private void RepositionAutoCombat(Vector3 target, float range)
    {
        var player = Player.Instance;
        Vector3 position = player.rb.position;
        Vector3 offset = target - position; offset.y = 0;
        if (offset.sqrMagnitude < .01f) return;
        if (Time.time >= autoNextStrafe)
        {
            autoNextStrafe = Time.time + 1.4f + (float)random.NextDouble() * 1.2f;
            autoStrafe = random.Next(2) == 0 ? -1 : 1;
        }
        Vector3 toward = offset.normalized;
        float comfortable = rules.Level < 2 ? range * .65f : Math.Min(7, range * .55f);
        float approach = Math.Clamp((offset.magnitude - comfortable) * .65f, -.8f, 1.2f);
        // Slow sidesteps during a swing keep its native delayed contact on target.
        float sideSpeed = Time.time < autoSwingUntil && rules.Level < 2 ? .35f : rules.Level < 2 ? 1.3f : 1.8f;
        Vector3 motion = toward * approach + Vector3.Cross(Vector3.up, toward) * (autoStrafe * sideSpeed);
        if (BehindMissionBoard(position + motion)
            || Physics.SphereCast(position + Vector3.up * .15f, .38f, motion.normalized, out _, .9f, 1, QueryTriggerInteraction.Ignore))
        { autoStrafe = -autoStrafe; return; }
        autoMove = motion;
    }

    private float AutoAttackRange() => rules.Level switch
    {
        0 => weapons[0].Cast<BaseballBat>().distanceToPunch * .85f,
        1 => weapons[1].Cast<Knife>().distanceToPunch * .85f,
        5 => 9, 6 => 12, 7 => weapons[7].Cast<FlameThrower>().range * .75f, _ => 16
    };

    private void MoveAutoToward(Vector3 target, float stopDistance)
    {
        var player = Player.Instance;
        Vector3 position = player.rb.position;
        Vector3 flat = target - position; flat.y = 0;
        if (flat.magnitude < stopDistance) return;
        Vector3 step = flat;
        // The baked mesh still contains removed factory barriers. Use clear physical corridors directly.
        bool blocked = Physics.SphereCast(position + Vector3.up * .15f, .38f, flat.normalized, out _,
            Math.Min(flat.magnitude, 5), 1, QueryTriggerInteraction.Ignore);
        if (blocked && (Time.time >= autoNextPath || autoCorners.Length == 0))
        {
            autoPath ??= new NavMeshPath();
            autoNextPath = Time.time + .65f;
            if (NavMesh.SamplePosition(position, out var start, 2, -1)
                && NavMesh.SamplePosition(target, out var end, 2, -1) && !BehindMissionBoard(end.position)
                && NavMesh.CalculatePath(start.position, end.position, -1, autoPath) && autoPath.status == NavMeshPathStatus.PathComplete)
            {
                int count = ReadAutoPathCorners();
                autoCorners = new Vector3[count];
                for (int i = 0; i < count; i++) autoCorners[i] = autoCornerBuffer[i];
                autoCorner = Math.Min(1, autoCorners.Length - 1);
            }
            else { autoCorners = Array.Empty<Vector3>(); autoNextTarget = 0; return; }
        }
        if (blocked)
        {
            if (autoCorners.Length == 0) return;
            step = autoCorners[autoCorner] - position; step.y = 0;
            while (step.magnitude < .65f && autoCorner < autoCorners.Length - 1)
            { step = autoCorners[++autoCorner] - position; step.y = 0; }
        }
        else { autoCorners = Array.Empty<Vector3>(); autoNextPath = 0; }
        autoMove = step.normalized * Math.Clamp(player.runSpeed * player.moveSpeedMultiplier, 3, 10);
        if (Time.time >= autoMotionCheck)
        {
            autoMotionCheck = Time.time + .5f;
            autoStuckFor = Vector3.Distance(position, autoLastPosition) < .15f ? autoStuckFor + .5f : 0;
            autoLastPosition = position;
            if (autoStuckFor >= .5f) autoJumpRequested = true;
            if (autoStuckFor > 1.5f) { autoCommitUntil = 0; autoNextTarget = 0; autoNextPath = 0; autoStuckFor = 0; }
        }
    }

    private int ReadAutoPathCorners() => ReadPathCorners(autoPath);

    private unsafe int ReadPathCorners(NavMeshPath path)
    {
        // Both generated array overloads are broken in this Unity 6 IL2CPP build; supply the native buffer header directly.
        fixed (Vector3* buffer = autoCornerBuffer)
        {
            var span = new UnityEngine.Bindings.BlittableArrayWrapper
            {
                data = (IntPtr)buffer, size = autoCornerBuffer.Length,
                updateFlags = UnityEngine.Bindings.BlittableArrayWrapper.UpdateFlags.NoUpdateNeeded
            };
            int count = NavMeshPath.GetCornersNonAlloc_Injected(path.m_Ptr, out span);
            if (count < 0 || count > autoCornerBuffer.Length || span.data != (IntPtr)buffer)
                throw new InvalidOperationException("Native path buffer returned an invalid size or pointer.");
            return count;
        }
    }

    private void ApplyAutoAim()
    {
        if (!autoPlaying || !autoHasAim || menu || GameManager.Instance.IsPaused || PrisonActive || effects.FlashSeconds > 0) return;
        var player = Player.Instance;
        player.mainCameraParent.rotation = autoAim;
        player.mainCamera.transform.rotation = autoAim;
        Vector3 angles = autoAim.eulerAngles;
        player.rotX = angles.y;
        player.rotY = angles.x > 180 ? angles.x - 360 : angles.x;
    }

    private void PlayAutoAnimation(int level)
    {
        var animator = Inventory.Instance.handAnimator;
        string state = level switch
        {
            0 => "BaseballBat",
            1 => autoAttacks % 2 == 0 ? "Knife" : "Knife2",
            2 => "Pistol", 3 => "SMG", 4 => "AssaultRifle", 5 => "Shotgun",
            6 => "RocketLauncher", _ => "FlameThrower"
        };
        if (!animator.HasState(0, Animator.StringToHash(state))) return;
        autoAnimationStates[level] = state;
        // Controller state names are not clip names (rig|...). The latter silently left the hands idle.
        animator.Play(state, 0, 0);
    }

    private void FireAutoWeapon(Enemy enemy, RaycastHit hit)
    {
        int firedLevel = rules.Level;
        if (!SpendAutoAmmo(firedLevel))
        {
            autoStatus = firedLevel == 7 ? "SOGUYOR" : "SARJOR DOLDURULUYOR";
            if (firedLevel == 7) StopFlame();
            return;
        }
        var weapon = weapons[firedLevel];
        var gm = GameManager.Instance;
        float delay = .25f;
        int damage = 0;
        AudioSource audio = null; AudioClip clip = null; ParticleSystem muzzle = null;
        PlayAutoAnimation(firedLevel);
        switch (firedLevel)
        {
            case 0:
                var bat = weapon.Cast<BaseballBat>(); delay = bat.punchDelayTime / Math.Max(.1f, gm.meleeAttackSpeedMultiplier);
                bat.StartCoroutine(bat.DamageDelayed(bat.punchAnimationDelay));
                audio = bat.audioSource; clip = bat.swingClips.Length > 0 ? bat.swingClips[autoAttacks % bat.swingClips.Length] : null; break;
            case 1:
                var knife = weapon.Cast<Knife>(); delay = knife.punchDelayTime / Math.Max(.1f, gm.meleeAttackSpeedMultiplier);
                knife.StartCoroutine(knife.DamageDelayed(knife.punchAnimationDelay));
                audio = knife.audioSource; clip = knife.swingClips.Length > 0 ? knife.swingClips[autoAttacks % knife.swingClips.Length] : null; break;
            case 2:
                var pistol = weapon.Cast<Pistol>(); delay = pistol.delayTime; damage = pistol.enemyDamage;
                muzzle = pistol.muzzleFlash; audio = pistol.audioSource; clip = pistol.shootClip; break;
            case 3:
                var smg = weapon.Cast<SMG>(); delay = smg.delayTime; damage = smg.enemyDamage;
                muzzle = smg.muzzleFlash; audio = smg.audioSource;
                clip = smg.shootClip.Length > 0 ? smg.shootClip[autoAttacks % smg.shootClip.Length] : null; break;
            case 4:
                var ak = weapon.Cast<AK47>(); delay = ak.delayTime; damage = ak.enemyDamage;
                muzzle = ak.muzzleFlash; ak.PlayShootSound(); break;
            case 5:
                var shotgun = weapon.Cast<Shotgun>(); delay = shotgun.delayTime;
                shotgun.pelletHits.Clear();
                for (int i = 0; i < shotgun.pelletCount; i++) shotgun.ShootPellet();
                shotgun.ApplyPelletDamage(); muzzle = shotgun.muzzleFlash; audio = shotgun.audioSource;
                clip = shotgun.shootClip.Length > 0 ? shotgun.shootClip[autoAttacks % shotgun.shootClip.Length] : null; break;
            case 6:
                var rocket = weapon.Cast<RocketLauncher>(); delay = 1.2f;
                muzzle = rocket.muzzleFlash; ParticlePoolManager.Instance.SpawnBigExplosion(hit.point);
                foreach (var creature in creatures)
                {
                    var victim = creature.Enemy;
                    if (victim == null || victim.IsDead || Vector3.Distance(victim.GrabCenter, hit.point) > rocket.explosionRadius) continue;
                    if (Physics.Linecast(hit.point, victim.GrabCenter, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore)) continue;
                    victim.Damage(gm.OnHitEnemy(victim, rocket.enemyDamage, false), (victim.GrabCenter - hit.point).normalized,
                        victim.GrabCenter, 1, true, true, weapon);
                }
                break;
            case 7:
                var flame = weapon.Cast<FlameThrower>(); delay = Math.Max(.05f, flame.damageDuration); damage = flame.enemyDamage;
                flame.fuel = Math.Max(0, flame.fuel - delay); flame.isFiring = true;
                if (!flame.flameParticle.isPlaying) flame.flameParticle.Play();
                flame.UpdateAudio(); enemy.AddBurn(delay); break;
        }
        if (firedLevel >= 2) delay /= Math.Max(.1f, gm.shootSpeedMultiplier);
        if (firedLevel == 7)
        {
            resources.Flame.Burn(delay);
            autoFlameUntil = Time.time + Math.Max(.08f, delay + .06f);
            if (resources.Flame.Overheated) OnFlameOverheated();
        }
        autoNextShot = Time.time + Math.Max(.06f, delay);
        autoSwingUntil = Time.time + (firedLevel < 2 ? Math.Min(.45f, delay * .7f) : .08f);
        autoWeaponAttacks[firedLevel]++; autoAttacks++;
        if (muzzle != null) muzzle.Play();
        if (audio != null && clip != null) audio.PlayOneShot(clip, .65f);
        if (damage > 0)
        {
            enemy.Damage(gm.OnHitEnemy(enemy, damage, false), Player.Instance.mainCamera.transform.forward, hit.point,
                1, true, true, weapon);
            gm.OnBulletImpact(hit.point);
        }
    }

    private void ProbeAutoPlay()
    {
        var animator = Inventory.Instance.handAnimator;
        File.WriteAllText(Path.Combine(Root, "qa", "auto-probe.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            animations = animator.runtimeAnimatorController.animationClips.Select(c => new { c.name, state = animator.HasState(0, Animator.StringToHash(c.name)) }).ToArray(),
            states = autoAnimationStates,
            animationHash = animator.GetCurrentAnimatorStateInfo(0).shortNameHash,
            animationTime = animator.GetCurrentAnimatorStateInfo(0).normalizedTime,
            autoTargetChanges,
            move = autoMove.ToString(), velocity = Player.Instance.rb.linearVelocity.ToString(), autoJumps,
            corners = autoCorners.Select(p => p.ToString()).ToArray(), autoCorner,
            targets = creatures.Take(8).Select(c => new { c.Enemy.IsDead, c.Enemy.isHeld, active = c.Enemy.gameObject.activeInHierarchy,
                position = c.Enemy.rb.position.ToString(), behind = BehindMissionBoard(c.Enemy.rb.position) }).ToArray(),
            camera = Player.Instance.mainCamera.transform.eulerAngles.ToString(), Player.Instance.rotX, Player.Instance.rotY,
            batRange = weapons[0].Cast<BaseballBat>().distanceToPunch, batDamage = weapons[0].Cast<BaseballBat>().enemyDamage,
            batDelay = weapons[0].Cast<BaseballBat>().punchDelayTime,
            flameRange = weapons[7].Cast<FlameThrower>().range, flameDamage = weapons[7].Cast<FlameThrower>().enemyDamage,
            flameDuration = weapons[7].Cast<FlameThrower>().damageDuration,
            autoError
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }
}
