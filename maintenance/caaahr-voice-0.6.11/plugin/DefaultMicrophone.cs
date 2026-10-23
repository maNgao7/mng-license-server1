using System;
using System.Runtime.InteropServices;

namespace TikMnG.Caaahr {
  internal sealed class CaptureEndpoint {
    public string Id="",Name="Windows varsayılan mikrofonu";
  }
  internal static class DefaultMicrophone {
    // Read the default capture endpoint; do not change Windows device settings.
    public static CaptureEndpoint Read(){
      var result=new CaptureEndpoint();IMMDeviceEnumerator enumerator=null;IMMDevice device=null;IPropertyStore properties=null;
      try{
        enumerator=(IMMDeviceEnumerator)new MMDeviceEnumerator();
        if(enumerator.GetDefaultAudioEndpoint(1,0,out device)!=0||device==null)return result;
        string id;if(device.GetId(out id)==0)result.Id=id;
        if(device.OpenPropertyStore(0,out properties)!=0||properties==null)return result;
        var key=new PropertyKey{Format=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),Id=14};PropVariant value;
        if(properties.GetValue(ref key,out value)==0){try{if(value.Type==31&&value.Pointer!=IntPtr.Zero)result.Name=Marshal.PtrToStringUni(value.Pointer);}finally{PropVariantClear(ref value);}}
      }catch(Exception){ /* Unity's default-input API remains the fallback on unsupported runtimes. */ }
      finally{if(properties!=null)Marshal.ReleaseComObject(properties);if(device!=null)Marshal.ReleaseComObject(device);if(enumerator!=null)Marshal.ReleaseComObject(enumerator);}
      return result;
    }
    public static string Resolve(string name,string[] devices){foreach(string device in devices)if(string.Equals(device,name,StringComparison.OrdinalIgnoreCase))return device;return null;}
    [DllImport("ole32.dll")]static extern int PropVariantClear(ref PropVariant value);
    [StructLayout(LayoutKind.Sequential)]struct PropertyKey{public Guid Format;public uint Id;}
    [StructLayout(LayoutKind.Explicit,Size=24)]struct PropVariant{[FieldOffset(0)]public ushort Type;[FieldOffset(8)]public IntPtr Pointer;}
    [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator{}
    [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDeviceEnumerator{
      [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IntPtr devices);
      [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
      [PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IMMDevice device);
      [PreserveSig]int RegisterEndpointNotificationCallback(IntPtr callback);
      [PreserveSig]int UnregisterEndpointNotificationCallback(IntPtr callback);
    }
    [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDevice{
      [PreserveSig]int Activate(ref Guid id,uint context,IntPtr parameters,out IntPtr instance);
      [PreserveSig]int OpenPropertyStore(uint access,out IPropertyStore properties);
      [PreserveSig]int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);
      [PreserveSig]int GetState(out uint state);
    }
    [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IPropertyStore{
      [PreserveSig]int GetCount(out uint count);
      [PreserveSig]int GetAt(uint index,out PropertyKey key);
      [PreserveSig]int GetValue(ref PropertyKey key,out PropVariant value);
      [PreserveSig]int SetValue(ref PropertyKey key,ref PropVariant value);
      [PreserveSig]int Commit();
    }
  }
}
