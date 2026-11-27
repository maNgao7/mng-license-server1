param([Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$GameProcessId)
$ErrorActionPreference = 'Stop'

# One hidden MTA helper per native game. Keep a handle so the PID cannot be
# recycled under our session scan. Exit 3 tells main to wait for another PID.
try { $game = [Diagnostics.Process]::GetProcessById($GameProcessId) }
catch [ArgumentException] { exit 3 }
try {
    $null = $game.Handle
    if ($game.ProcessName -ine 'boxing' -or $game.HasExited) { exit 3 }

    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

// Windows SDK mmdeviceapi.h, audiopolicy.h and audioclient.h. Methods are
// in SDK vtable order, through the last method used on each interface.
namespace HediyeBoxAudio {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class DeviceEnumerator {}

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        void EnumAudioEndpoints(int flow, uint stateMask, out IMMDeviceCollection devices);
    }
    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection {
        void GetCount(out uint count);
        void Item(uint index, out IMMDevice device);
    }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        void Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2 {
        void GetAudioSessionControl(IntPtr guid, uint flags, out IntPtr control);
        void GetSimpleAudioVolume(IntPtr guid, uint flags, out IntPtr volume);
        void GetSessionEnumerator(out IAudioSessionEnumerator sessions);
    }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator {
        void GetCount(out int count);
        void GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
    }
    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2 {
        void GetState(out int state);
        void GetDisplayName(out IntPtr name);
        void SetDisplayName(IntPtr name, IntPtr context);
        void GetIconPath(out IntPtr path);
        void SetIconPath(IntPtr path, IntPtr context);
        void GetGroupingParam(out Guid grouping);
        void SetGroupingParam(ref Guid grouping, IntPtr context);
        void RegisterAudioSessionNotification(IntPtr events);
        void UnregisterAudioSessionNotification(IntPtr events);
        void GetSessionIdentifier(out IntPtr id);
        void GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetProcessId(out uint pid);
    }
    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume {
        void SetMasterVolume(float level, IntPtr context);
    }

    public sealed class SessionMixer {
        Dictionary<string, int> applied = new Dictionary<string, int>();

        static void Release(object value) {
            if (value != null) Marshal.ReleaseComObject(value);
        }

        void ApplyEndpoint(IMMDevice device, uint pid, int percent, Dictionary<string, int> current) {
            Guid iid = typeof(IAudioSessionManager2).GUID;
            object manager = null;
            IAudioSessionEnumerator sessions = null;
            try {
                device.Activate(ref iid, 23, IntPtr.Zero, out manager); // CLSCTX_ALL
                ((IAudioSessionManager2)manager).GetSessionEnumerator(out sessions);
                int count;
                sessions.GetCount(out count);
                for (int i = 0; i < count; i++) {
                    object raw = null;
                    try {
                        sessions.GetSession(i, out raw);
                        var session = (IAudioSessionControl2)raw;
                        uint owner;
                        // Only S_OK identifies a single owner. A shared session
                        // can return the creator PID with AUDCLNT_S_NO_SINGLE_PROCESS.
                        if (session.GetProcessId(out owner) != 0 || owner != pid) continue;
                        int state;
                        session.GetState(out state);
                        if (state == 2) continue; // AudioSessionStateExpired
                        string id;
                        session.GetSessionInstanceIdentifier(out id);
                        int previous;
                        if (!applied.TryGetValue(id, out previous) || previous != percent)
                            ((ISimpleAudioVolume)raw).SetMasterVolume(percent / 100f, IntPtr.Zero);
                        current[id] = percent;
                    } catch (COMException) {
                        // Stream disconnected mid-scan; continue with its peers.
                    } finally { Release(raw); }
                }
            } finally { Release(sessions); Release(manager); }
        }

        public bool Apply(uint pid, int percent) {
            var current = new Dictionary<string, int>();
            var enumerator = (IMMDeviceEnumerator)new DeviceEnumerator();
            IMMDeviceCollection devices = null;
            try {
                enumerator.EnumAudioEndpoints(0, 1, out devices); // eRender, DEVICE_STATE_ACTIVE
                uint count;
                devices.GetCount(out count);
                for (uint i = 0; i < count; i++) {
                    IMMDevice device = null;
                    try {
                        devices.Item(i, out device);
                        ApplyEndpoint(device, pid, percent, current);
                    } catch (COMException) {
                        // A device can disappear while other outputs are still usable.
                    } finally { Release(device); }
                }
            } finally { Release(devices); Release(enumerator); }
            applied = current;
            return current.Count > 0;
        }
    }
}
'@
    $mixer = New-Object HediyeBoxAudio.SessionMixer
    $reader = [IO.StreamReader]::new([Console]::OpenStandardInput())
    try {
        $nextLine = $reader.ReadLineAsync()
        $waitMs = -1
        $retryMs = 250
        $warned = $false
        while (-not $game.HasExited) {
            if ($nextLine.Wait($waitMs)) {
                # Drain queued slider updates before querying any endpoints.
                do {
                    $line = $nextLine.GetAwaiter().GetResult()
                    if ($null -eq $line) { return }
                    $percent = [int]::Parse($line, [Globalization.CultureInfo]::InvariantCulture)
                    if ($percent -lt 0 -or $percent -gt 100) { throw 'Invalid game volume' }
                    $nextLine = $reader.ReadLineAsync()
                } while ($nextLine.IsCompleted)
                $retryMs = 250
            }
            if ($game.HasExited) { break }
            try {
                $matched = $mixer.Apply($GameProcessId, $percent)
                $warned = $false
            } catch {
                if (-not $warned) { [Console]::Error.WriteLine($_.Exception.Message) }
                $warned = $true
                $matched = $false
            }
            if ($matched) {
                # Discover replacement sessions and output-device changes. The
                # instance cache prevents repeated writes to existing sessions.
                $waitMs = 12000
                $retryMs = 250
            } else {
                $waitMs = $retryMs
                $retryMs = [Math]::Min(8000, $retryMs * 2)
            }
        }
        exit 3
    } finally { $reader.Dispose() }
} finally { $game.Dispose() }
