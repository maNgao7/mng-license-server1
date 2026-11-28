// Test executable only. Creates silent, nonpersistent WASAPI sessions and
// reports their own volume. Never starts playback or loads any game assets.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

class AudioFixture {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Devices {}
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Enumerator {
        void EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
        void GetDefaultAudioEndpoint(int flow, int role, out Device device);
    }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Device {
        void Activate(ref Guid iid, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }
    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Client {
        void Initialize(int mode, uint flags, long duration, long period, IntPtr format, ref Guid session);
        void GetBufferSize(out uint frames);
        void GetStreamLatency(out long latency);
        void GetCurrentPadding(out uint frames);
        void IsFormatSupported(int mode, IntPtr format, out IntPtr closest);
        void GetMixFormat(out IntPtr format);
        void GetDevicePeriod(out long normal, out long minimum);
        void Start();
        void Stop();
        void Reset();
        void SetEventHandle(IntPtr handle);
        void GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }
    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Volume {
        void SetMasterVolume(float level, IntPtr context);
        void GetMasterVolume(out float level);
    }

    [STAThread]
    static void Main() {
        var clients = new List<Client>();
        var volumes = new List<Volume>();
        var enumerator = (Enumerator)new Devices();
        Device device;
        try { enumerator.GetDefaultAudioEndpoint(0, 0, out device); }
        catch (COMException e) {
            if ((uint)e.ErrorCode != 0x80070490) throw;
            Console.WriteLine("no-endpoint");
            return;
        }
        Console.WriteLine("ready");
        string line;
        while ((line = Console.ReadLine()) != null) {
            if (line == "open") {
                Guid iid = typeof(Client).GUID;
                object service;
                device.Activate(ref iid, 23, IntPtr.Zero, out service);
                var client = (Client)service;
                IntPtr format;
                client.GetMixFormat(out format);
                Guid session = Guid.NewGuid();
                try { client.Initialize(0, 0x80000, 1000000, 0, format, ref session); } // NOPERSIST
                finally { Marshal.FreeCoTaskMem(format); }
                iid = typeof(Volume).GUID;
                client.GetService(ref iid, out service);
                var volume = (Volume)service;
                volume.SetMasterVolume(0.88f, IntPtr.Zero);
                clients.Add(client);
                volumes.Add(volume);
                Console.WriteLine("opened");
            } else if (line == "levels") {
                var levels = new List<int>();
                foreach (var volume in volumes) {
                    float level;
                    volume.GetMasterVolume(out level);
                    levels.Add((int)Math.Round(level * 100));
                }
                Console.WriteLine(string.Join(",", levels));
            }
        }
        GC.KeepAlive(clients);
    }
}
