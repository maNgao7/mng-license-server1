using HarmonyLib;
using PYWO.Voxel;
using Unity.Mathematics;
using UnityEngine;
using UObj = UnityEngine.Object;

namespace TikMnG.HapistenKac;

internal static class GameplayPresentation
{
    [HarmonyPatch(typeof(GameSettings), "get_VerticalFov")]
    private static class WideView
    {
        private static void Postfix(ref float __result)
        {
            if (PywoNetworkManager.Instance?.SoloLobby != true || Screen.width <= 0 || Screen.height <= 0) return;
            var halfAngle = Plugin.FieldOfView.Value * Mathf.Deg2Rad * .5f;
            __result = 2 * Mathf.Atan(Mathf.Tan(halfAngle) * Screen.height / Screen.width) * Mathf.Rad2Deg;
        }
    }

}

internal static class CellDecor
{
    private static IntPtr lastHatch;
    private static float lastDecorScan;
    private static float nextInkRefresh;
    private static WallInk? ink;
    private static readonly HashSet<string> Clutter = new(StringComparer.OrdinalIgnoreCase)
    {
        "kit_room_bucket", "kit_room_cable", "kit_room_crate",
        "kit_room_mug", "kit_room_radio", "kit_room_toolbox",
        "room.bucket", "room.cable", "room.crate", "room.mug", "room.radio", "room.toolbox",
        "SR_RoomKit", "SR_RoomKitMirror", "Room Kit", "Room Kit Mirror",
    };

    internal static void Reset()
    {
        ink?.Dispose();
        ink = null;
        lastHatch = IntPtr.Zero;
        lastDecorScan = 0;
    }

    internal static void Update()
    {
        var player = PlayerState.Local;
        if (PywoNetworkManager.Instance?.SoloLobby != true || player == null)
        {
            if (lastHatch != IntPtr.Zero) Reset();
            return;
        }
        var hatch = TradeHatch.Instance;
        var root = hatch?.Dressing?.Machine?.Root;
        var world = VoxelNet.Instance?.World;
        if (root == null || world == null) return;
        // The decor belongs to the starting cell. Scanning every tunnel mesh while drilling
        // far from the hatch makes periodic refreshes grow with the size of the excavation.
        if ((player.transform.position - root.position).sqrMagnitude > 12f * 12f) return;
        if (Time.unscaledTime >= lastDecorScan)
        {
            lastDecorScan = Time.unscaledTime + 12;
            foreach (var filter in UObj.FindObjectsOfType<MeshFilter>())
            {
                var mesh = filter.sharedMesh;
                if (mesh == null || (!Clutter.Contains(mesh.name) && !Clutter.Contains(filter.name))) continue;
                foreach (var collider in filter.GetComponentsInChildren<Collider>(true)) collider.enabled = false;
                var parent = filter.transform.parent;
                if (parent != null && Clutter.Contains(parent.name))
                    parent.gameObject.SetActive(false);
                else
                    filter.gameObject.SetActive(false);
                Plugin.Output.LogInfo($"Hücre dekoru kaldırıldı · {mesh.name}");
            }
        }
        if (hatch!.Pointer != lastHatch)
        {
            var marker = root.Find("Sign Word");
            if (marker == null) return;
            var center = root.TransformPoint(new Vector3(marker.localPosition.x, 1.19f, marker.localPosition.z + .10f));
            var rotation = marker.rotation;
            foreach (var part in hatch.GetComponentsInChildren<Renderer>(true)) part.enabled = false;
            foreach (var collider in hatch.GetComponentsInChildren<Collider>(true)) collider.enabled = false;
            foreach (var canvas in hatch.GetComponentsInChildren<Canvas>(true)) canvas.enabled = false;
            ink?.Dispose();
            ink = new WallInk(root, center, rotation, world);
            lastHatch = hatch.Pointer;
            nextInkRefresh = 0;
        }
        if (Time.unscaledTime >= nextInkRefresh)
        {
            nextInkRefresh = Time.unscaledTime + .08f;
            HideHatch(hatch);
            ink?.Refresh(world);
        }
    }

    private static void HideHatch(TradeHatch hatch)
    {
        // Native dressing can recreate the button and catalogue lettering after Build.
        foreach (var part in hatch.GetComponentsInChildren<Renderer>(true))
            if (ink?.Owns(part.transform) != true) part.enabled = false;
        foreach (var canvas in hatch.GetComponentsInChildren<Canvas>(true)) canvas.enabled = false;
        var button = hatch.Button;
        if (button != null && button.gameObject.Pointer != hatch.gameObject.Pointer)
            button.gameObject.SetActive(false);
    }

    [HarmonyPatch(typeof(TradeHatch), "Update")]
    private static class QuietTradeHatch
    {
        private static bool Prefix() => PywoNetworkManager.Instance?.SoloLobby != true;
    }

    [HarmonyPatch(typeof(CatalogueCue), "Update")]
    private static class NoCatalogueAdvert
    {
        private static bool Prefix()
        {
            if (PywoNetworkManager.Instance?.SoloLobby != true) return true;
            Hud.ClearCue(CueSlot.Afford);
            return false;
        }
    }

    [HarmonyPatch(typeof(RoomMesh))]
    private static class SkipClutterGeometry
    {
        private static IEnumerable<System.Reflection.MethodBase> TargetMethods() =>
            AccessTools.GetDeclaredMethods(typeof(RoomMesh)).Where(method => method.Name == nameof(RoomMesh.Kit));

        private static bool Prefix(object __0)
        {
            if (PywoNetworkManager.Instance?.SoloLobby != true) return true;
            var key = __0 is Mesh mesh ? mesh.name : __0 as string;
            return key == null || !Clutter.Contains(key);
        }
    }

    [HarmonyPatch(typeof(RoomKit), nameof(RoomKit.Part))]
    private static class HideClutterPart
    {
        private static void Postfix(string __0, Mesh __2, GameObject __result)
        {
            if (PywoNetworkManager.Instance?.SoloLobby != true || __result == null) return;
            if (Clutter.Contains(__0) || (__2 != null && Clutter.Contains(__2.name)))
                __result.SetActive(false);
        }
    }

    [HarmonyPatch(typeof(Hopper), nameof(Hopper.NearestMouth))]
    private static class NoTradeMouth
    {
        private static void Postfix(ref Hopper? __result)
        {
            var hopper = TradeHatch.Instance?.Hopper;
            if (PywoNetworkManager.Instance?.SoloLobby == true && hopper != null && __result != null &&
                hopper.Pointer == __result.Pointer) __result = null;
        }
    }
}
