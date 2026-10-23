using Newtonsoft.Json;

namespace TikMnG.Caaahr {
  // Unity's native serializer does not populate these externally loaded mod DTOs.
  internal static class JsonUtility {
    static readonly JsonSerializerSettings Settings=new JsonSerializerSettings {
      TypeNameHandling=TypeNameHandling.None,
      MaxDepth=32,
      ObjectCreationHandling=ObjectCreationHandling.Replace
    };
    public static T FromJson<T>(string json){return JsonConvert.DeserializeObject<T>(json,Settings);}
    public static string ToJson(object value){return JsonConvert.SerializeObject(value,Settings);}
  }
}
