using HarmonyLib;

namespace TikMnG.HapistenKac;

internal static class UpgradeDurability
{
    private static PlayerBelt? owner;
    private static int slot = -1;
    private static ItemStack granted;

    internal static void Track(PlayerBelt belt, int managedSlot, ItemStack stack)
    {
        owner = belt;
        slot = managedSlot;
        granted = stack;
    }

    internal static void Reset()
    {
        owner = null;
        slot = -1;
        granted = default;
    }

    private static bool Owns(PlayerBelt? belt) => owner != null && belt != null &&
        owner.Pointer == belt.Pointer && PywoNetworkManager.Instance?.SoloLobby == true;

    internal static int SlotIn(PlayerBelt belt) =>
        Owns(belt) && slot >= 0 && belt.Get(slot).ItemId == granted.ItemId ? slot : -1;

    private static bool IsProtectedSlot(PlayerBelt belt, int index) =>
        index >= 0 && index == slot && SlotIn(belt) == index;

    private static void Refill(PlayerBelt belt)
    {
        var stack = belt.Get(slot);
        if (stack.IsEmpty) belt.ServerSetSlot(slot, granted);
        else if (stack.ItemId == granted.ItemId && stack.Charge < granted.Charge)
            belt.ServerSetSlot(slot, stack.WithCharge(granted.Charge));
    }

    [HarmonyPatch(typeof(ToolController), "ServerHit")]
    private static class KeepChargeAfterDigging
    {
        private static void Postfix(ToolController __instance)
        {
            var belt = __instance.Belt;
            if (belt == null || slot < 0 || belt.selected != slot || !Owns(belt)) return;
            Refill(belt);
            __instance.sWearCarry = 0;
        }
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerSetSlot))]
    private static class KeepChargeOnWearWrite
    {
        private static bool Prefix(PlayerBelt __instance, int __0, ref ItemStack __1)
        {
            if (slot < 0 || __0 != slot || !Owns(__instance)) return true;
            if (__1.IsEmpty || __1.ItemId != granted.ItemId) return false;
            if (__1.Charge < granted.Charge) __1 = __1.WithCharge(granted.Charge);
            return true;
        }
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerTick))]
    private static class KeepChargeAfterTick
    {
        private static void Postfix(PlayerBelt __instance)
        {
            if (slot >= 0 && Owns(__instance)) Refill(__instance);
        }
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerConsume))]
    private static class SkipConsumption
    {
        private static bool Prefix(PlayerBelt __instance, int __0) =>
            !IsProtectedSlot(__instance, __0);
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerTake))]
    private static class KeepOwnedStack
    {
        private static bool Prefix(PlayerBelt __instance, int __0, ref ItemStack __result)
        {
            if (!IsProtectedSlot(__instance, __0)) return true;
            __result = ItemStack.Empty;
            return false;
        }
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerDrop))]
    private static class SkipDrop
    {
        private static bool Prefix(PlayerBelt __instance, int __0) =>
            !IsProtectedSlot(__instance, __0);
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerDropAtFeet))]
    private static class SkipDropAtFeet
    {
        private static bool Prefix(PlayerBelt __instance, int __0) =>
            !IsProtectedSlot(__instance, __0);
    }

    [HarmonyPatch(typeof(ToolController), "ServerBreakTool")]
    private static class SkipBreak
    {
        private static bool Prefix(ToolController __instance, int __0)
        {
            var belt = __instance.Belt;
            if (belt == null || SlotIn(belt) < 0 || __0 != slot) return true;
            Refill(belt);
            __instance.sWearCarry = 0;
            return false;
        }
    }

    [HarmonyPatch(typeof(PlayerBelt), nameof(PlayerBelt.ServerSwapSlots))]
    private static class FollowSlotMoves
    {
        private static void Prefix(PlayerBelt __instance, int __0, int __1, out int __state)
        {
            __state = SlotIn(__instance);
            if (__state < 0 || (__state != __0 && __state != __1)) { __state = -1; return; }
            // A native swap may take or clear the source before writing the destination.
            slot = -1;
        }

        private static void Finalizer(PlayerBelt __instance, int __0, int __1, int __state)
        {
            if (__state < 0 || slot >= 0 || !Owns(__instance)) return;
            var target = __state == __0 ? __1 : __0;
            slot = target >= 0 && target < __instance.slots.Count && __instance.Get(target).ItemId == granted.ItemId
                ? target : __state;
        }
    }
}
