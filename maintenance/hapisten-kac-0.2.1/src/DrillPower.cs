using HarmonyLib;
using PYWO.Voxel;
using PYWO.Voxel.Rules;
using Unity.Mathematics;

namespace TikMnG.HapistenKac;

internal static class DrillPower
{
    private static ushort sequence;

    [HarmonyPatch(typeof(VoxelNet), nameof(VoxelNet.ServerApplyToolCells))]
    private static class StrongerLocalDrill
    {
        private static bool Prefix(VoxelNet __instance, ref DamageEvent __0, ref DamageResult __result)
        {
            if (PywoNetworkManager.Instance?.SoloLobby != true || PlayerState.Local is not { } player ||
                __0.playerSlot != player.slot || __0.kind != DamageKind.Tool ||
                player.GetComponent<PlayerBelt>()?.SelectedStack.Definition?.id != "jackhammer" ||
                PunchTuning.Current is not { } tuning || __instance.World is not { } world ||
                math.lengthsq(__0.faceNormal) == 0 || !VoxelCoord.InBounds(__0.voxel) || world.IsUnbreakable(__0.voxel))
                return true;

            var power = tuning.baseDamage * ActionTuning.TierDamageMultiplier(ActionTuning.MaxToolTier);
            var radius = ActionTuning.WallRadiusInCells(ActionTuning.MaxToolTier, Kernels.Grid(1).r);
            // Use the closest built-in cutting shape in one authoritative edit.
            int stage = 1;
            while (stage + 1 < Kernels.Stages && Kernels.Grid(stage).r < radius) stage++;
            var op = PunchOp.Make(__0.voxel, __0.faceNormal, stage, 0,
                (ushort)Math.Clamp((int)MathF.Round(power * 16), 1, ushort.MaxValue), unchecked(++sequence), player.slot);
            __result = __instance.ServerApplyPunch(ref op, 1);
            return false;
        }
    }
}