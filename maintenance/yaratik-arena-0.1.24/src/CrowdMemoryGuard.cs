using System.Runtime.InteropServices;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatus
    {
        public uint Length, Load;
        public ulong TotalPhysical, AvailablePhysical, TotalPageFile, AvailablePageFile, TotalVirtual, AvailableVirtual, ExtendedVirtual;
    }
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);

    private bool crowdMemoryHold;
    private ulong freePhysicalMb;
    private float nextMemoryCheck;
    private float qaMemoryHoldUntil;

    private bool CanAllocateNativeCreature()
    {
        if (Time.realtimeSinceStartup < qaMemoryHoldUntil) { crowdMemoryHold = true; return false; }
        if (!OperatingSystem.IsWindows()) return true;
        if (Time.realtimeSinceStartup < nextMemoryCheck) return !crowdMemoryHold;
        nextMemoryCheck = Time.realtimeSinceStartup + .75f;
        var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        if (!GlobalMemoryStatusEx(ref status)) return !crowdMemoryHold;
        freePhysicalMb = status.AvailablePhysical / (1024 * 1024);
        if (freePhysicalMb < 2048) crowdMemoryHold = true;
        else if (freePhysicalMb > 2560) crowdMemoryHold = false;
        return !crowdMemoryHold;
    }
}
