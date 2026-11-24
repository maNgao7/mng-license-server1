using Il2CppInterop.Runtime;
using PYWO.Voxel.Rules;
using UnityEngine;

namespace TikMnG.HapistenKac;

internal static class RewardsProbe
{
    private static int stage;
    private static float next;
    private static ushort originalCharge;

    private static void Check(bool ok, string message)
    {
        if (!ok) throw new InvalidOperationException(message);
    }

    internal static void Tick(LivePanel panel)
    {
        if (stage >= 90 || Time.unscaledTime < next) return;
        try
        {
            if (stage == 0)
            {
                var manager = PywoNetworkManager.Instance;
                if (manager == null || manager.Busy || MainMenu.Instance?.main?.gameObject.activeInHierarchy != true) return;
                RunSave.ArchiveForNewRun();
                RunSave.CancelPending();
                manager.PlaySolo();
                stage++;
                next = Time.unscaledTime + 3;
                return;
            }
            var player = PlayerState.Local;
            var voxels = VoxelNet.Instance;
            if (player == null || voxels?.World == null) return;
            var belt = player.GetComponent<PlayerBelt>();
            if (stage == 1)
            {
                var drills = ItemDatabase.Get("jackhammer");
                ItemDefinition? protein = null;
                foreach (var def in ItemDatabase.Items)
                    if (def.behaviour?.TryCast<ProteinShakeBehaviour>() != null) { protein = def; break; }
                Check(protein != null && drills != null, "reward definitions unavailable");
                var naturalPool = LootDirector.Instance.Pool;
                var ids = naturalPool.Select(entry => ItemDatabase.Get(entry.itemId)?.id).ToArray();
                Plugin.Output.LogInfo($"REW QA native reward pool = {string.Join(", ", ids)}");
                Check(ids.Length > 1 && ids.All(id => id == protein!.id || id == "dynamite"), "natural pool should offer protein and rare dynamite");
                var rare = naturalPool.Single(entry => ItemDatabase.Get(entry.itemId)?.id == "dynamite");
                var shakeWeight = naturalPool.Where(entry => ItemDatabase.Get(entry.itemId)?.id == protein!.id).Sum(entry => entry.weightSolo);
                Check(rare.rarity == LootRarity.Rare && Math.Abs(rare.weightSolo / shakeWeight - .02f) < .00001f,
                    "dynamite should use a small fraction of the protein weight");
                var point = player.ViewCamera.transform.position + player.ViewCamera.transform.forward;
                Check(WorldItem.ServerSpawnPop(drills!.NewStack(1, 10), point, point, point) == null, "old tool stash spawned a drill");
                var shake = WorldItem.ServerSpawnPop(protein!.NewStack(1, 10), point, point, point);
                Check(shake != null && shake.Stack.Definition.id == protein.id, "protein pop must still spawn normally");
                var bomb = WorldItem.ServerSpawnPop(ItemDatabase.Get("dynamite").NewStack(1, 10), point, point, point);
                Check(bomb != null && bomb.Stack.Definition.id == "dynamite", "dynamite dig reward must spawn normally");
                Check(WorldActions.AimAtWall(player, voxels, out var wall), "test wall missing");
                Check(!LootDirector.Instance.SpawnStashAt(wall.voxel, drills, Rarity.Common, player.slot), "native tool stash placement accepted");
                var nativeDrop = WorldItem.ServerSpawn(drills.NewStack(1, 10), point, Vector3.zero, false);
                Check(nativeDrop != null && !nativeDrop.ServerTryGive(player, true), "existing natural drill could still be picked up");
                Mirror.NetworkServer.Destroy(nativeDrop!.gameObject);
                Check(panel.ExecuteAction(player, 4, 1, 0, null).StartsWith("1 dinamit"), "explicit gift must still be granted");
                Plugin.Output.LogInfo("REW QA protein and rare natural dynamite allowed, old tool drop and new tool stash blocked, gift dynamite granted.");
                Gift(panel, player, 2, 4, "upgrade");
                var managed = UpgradeDurability.SlotIn(belt);
                Check(managed >= 0 && belt.selected == managed && belt.Get(managed).Definition?.id == "jackhammer",
                    "gift did not equip a protected drill");
                originalCharge = belt.Get(managed).Charge;
                Check(originalCharge > 0, "drill has no charge");
                belt.ServerSetSlot(managed, belt.Get(managed).WithCharge(0));
                belt.ServerSetSlot(managed, ItemStack.Empty);
                belt.ServerConsume(managed, 1);
                Check(belt.ServerTake(managed).IsEmpty && belt.ServerDropAtFeet(managed) == null,
                    "native removal returned a second copy of the earned drill");
                player.GetComponent<ToolController>().ServerBreakTool(managed);
                belt.ServerTick(120f);
                Check(belt.Get(managed).Definition?.id == "jackhammer" && belt.Get(managed).Charge == originalCharge,
                    "wear or break removed an earned drill");
                panel.ExecuteAction(player, 1, 1, 4, null);
                Check(PunchEffects.HandTool(player) == 4, "temporary swap did not equip hammer");
                Check(UpgradeDurability.SlotIn(belt) == managed, "temporary hammer released the earned drill slot");
                stage++;
                next = Time.unscaledTime + 2;
                return;
            }
            if (stage == 2)
            {
                var managed = UpgradeDurability.SlotIn(belt);
                Check(managed >= 0 && belt.selected == managed && belt.Get(managed).Charge == originalCharge,
                    "timed swap did not restore the permanent upgrade");
                var target = Enumerable.Range(0, PlayerBelt.BeltSlots).First(index => index != managed && belt.Get(index).IsEmpty);
                belt.ServerSwapSlots(managed, target);
                Check(UpgradeDurability.SlotIn(belt) == target, "gear protection did not follow the slot");
                var ordinary = ItemDatabase.Get("jackhammer").NewStack(1, 10);
                belt.ServerSetSlot(managed, ordinary);
                belt.ServerConsume(managed, 1);
                Check(belt.Get(managed).IsEmpty, "a second drill should still be consumed normally");
                Gift(panel, player, 3, 1, "downgrade");
                Gift(panel, player, 3, 1, "downgrade");
                Gift(panel, player, 2, 4, "upgrade");
                belt.ServerTick(120f);
                Check(UpgradeDurability.SlotIn(belt) < 0 && PunchEffects.HandTool(player) == 4 && belt.Get(target).IsEmpty,
                    "only the new downgrade event should remove the drill and equip the hammer");
                Gift(panel, player, 2, 1, "new-upgrade");
                Check(UpgradeDurability.SlotIn(belt) >= 0, "fresh upgrade should restore the earned drill");
                Gift(panel, player, BindingFile.RestartRun, 1, "restart");
                stage++;
                next = Time.unscaledTime + 2;
                return;
            }
            if (stage == 3)
            {
                var flags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic;
                if ((bool)typeof(LivePanel).GetField("restartAfterEscape", flags)!.GetValue(panel)!) return;
                Check(UpgradeDurability.SlotIn(belt) < 0 && PunchEffects.HandTool(player) == 0 &&
                    !Enumerable.Range(0, PlayerBelt.BeltSlots).Any(i => belt.Get(i).Definition?.id == "jackhammer"),
                    "new run inherited the previous upgrade");
                Plugin.Output.LogInfo("REW QA PASS: rewards, earned drill wear/use, swap, downgrade, replay and fresh run.");
                stage = 90;
            }
        }
        catch (Exception error)
        {
            Plugin.Output.LogError("REW QA FAIL " + error);
            stage = 90;
        }
    }

    private static void Gift(LivePanel panel, PlayerState player, int action, int amount, string eventId)
    {
        const System.Reflection.BindingFlags flags =
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic;
        var bindings = (List<Binding>)typeof(LivePanel).GetField("bindings", flags)!.GetValue(panel)!;
        var row = new Binding(action, "qa-owned-tool-" + action, amount);
        bindings.Add(row);
        try
        {
            var packet = new LiveBridge.Packet("gift", null, null, null, null, null, row.GiftId,
                "qa-owned-tool-" + eventId, 1, null, "qa-solo", "qa", 0);
            typeof(LivePanel).GetMethod("ApplyGift", flags)!.Invoke(panel, new object[] { packet, player });
        }
        finally { bindings.Remove(row); }
    }
}
