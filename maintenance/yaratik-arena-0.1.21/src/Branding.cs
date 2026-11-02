using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int brandedPosters, brandedTools;
    private string brandingError = "";
    private sealed class ToolSkin
    {
        public Material Material;
        public byte[] Rgba;
        public int Width, Height;
        public Texture2D Applied;
    }
    private readonly Dictionary<string, ToolSkin> toolSkins = new();
    private StbImageSharp.ImageResult engravingMask;

    private void ConfigureBranding()
    {
        var image = LoadIcon("TikMnG-factory-poster-v1.png");
        foreach (var renderer in Object.FindObjectsOfType<MeshRenderer>())
        {
            if (!renderer.sharedMaterials.Any(m => m != null && m.name.Contains("PosterImage", StringComparison.OrdinalIgnoreCase))) continue;
            bool changed = false;
            foreach (var material in renderer.materials)
            {
                if (material == null || image == null || !material.name.Contains("PosterImage", StringComparison.OrdinalIgnoreCase)) continue;
                material.mainTexture = image; changed = true;
            }
            if (changed) brandedPosters++;
        }
        PrepareToolSkin("bat", weapons[0].gameObject, "Material.008");
        PrepareToolSkin("vacuum", Il2Cpp.Vacuum.Instance.gameObject, "SuckySucky");
        StampTool("bat", new Rect(.50f, .766f, .22f, .02f), mirrorVertical: true);
        StampTool("vacuum", new Rect(.715f, .46f, .01f, .045f), true);
    }

    private StbImageSharp.ImageResult ReadTexture(Texture source)
    {
        var target = new RenderTexture(source.width, source.height, 0, RenderTextureFormat.ARGB32);
        target.Create();
        var previous = RenderTexture.active;
        Texture2D readable = null;
        try
        {
            Graphics.Blit(source, target); RenderTexture.active = target;
            readable = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
            readable.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0); readable.Apply();
            return StbImageSharp.ImageResult.FromMemory(ImageConversion.EncodeToPNG(readable).ToArray(), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        }
        finally
        {
            RenderTexture.active = previous; target.Release(); Object.Destroy(target);
            if (readable != null) Object.Destroy(readable);
        }
    }

    private void PrepareToolSkin(string key, GameObject root, string materialName)
    {
        foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>(true))
            foreach (var material in renderer.materials)
            {
                if (!material.name.StartsWith(materialName, StringComparison.Ordinal) || material.mainTexture == null) continue;
                var source = ReadTexture(material.mainTexture);
                toolSkins[key] = new ToolSkin { Material = material, Width = source.Width, Height = source.Height, Rgba = source.Data };
                brandedTools++; return;
            }
        throw new InvalidOperationException("Tool surface missing: " + key);
    }

    private void StampTool(string key, Rect rect, bool rotate = false, bool mirrorVertical = false)
    {
        if (!toolSkins.TryGetValue(key, out var skin)) return;
        engravingMask ??= StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(Path.Combine(Root, "assets", "TikMnG-color-mark-v2.png")), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        int minX = engravingMask.Width, minY = engravingMask.Height, maxX = 0, maxY = 0;
        for (int y = 0; y < engravingMask.Height; y++) for (int x = 0; x < engravingMask.Width; x++)
            if (engravingMask.Data[(y * engravingMask.Width + x) * 4 + 3] > 0)
            { minX = Math.Min(minX, x); minY = Math.Min(minY, y); maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y); }
        var rgba = (byte[])skin.Rgba.Clone();
        int left = Math.Clamp((int)(rect.x * skin.Width), 0, skin.Width - 1), top = Math.Clamp((int)(rect.y * skin.Height), 0, skin.Height - 1);
        int width = Math.Clamp((int)(rect.width * skin.Width), 1, skin.Width - left), height = Math.Clamp((int)(rect.height * skin.Height), 1, skin.Height - top);
        for (int y = 0; y < height; y++) for (int x = 0; x < width; x++)
        {
            float u = x / (float)width, v = y / (float)height;
            if (mirrorVertical) v = 1 - v;
            int sx = minX + (int)((rotate ? v : u) * (maxX - minX));
            int sy = minY + (int)((rotate ? 1 - u : v) * (maxY - minY));
            int source = (sy * engravingMask.Width + sx) * 4;
            float alpha = engravingMask.Data[source + 3] / 255f;
            if (alpha <= 0) continue;
            int target = ((top + y) * skin.Width + left + x) * 4;
            // Bake letters into a private color-map copy; native UVs, lighting and normal maps stay intact.
            for (int channel = 0; channel < 3; channel++)
                rgba[target + channel] = (byte)Math.Clamp(rgba[target + channel] * (1 - alpha) + engravingMask.Data[source + channel] * alpha * .9f, 0, 255);
        }
        var texture = UploadImage(skin.Width, skin.Height, rgba); texture.anisoLevel = 8; texture.Apply();
        skin.Material.mainTexture = texture;
        if (skin.Applied != null) Object.Destroy(skin.Applied);
        skin.Applied = texture;
    }

    private void ProbeBranding()
    {
        File.WriteAllText(Path.Combine(Root, "qa", "branding-scene.json"), System.Text.Json.JsonSerializer.Serialize(
            Object.FindObjectsOfType<MeshRenderer>().Select(r => new
            {
                path = ScenePath(r.transform), materials = r.sharedMaterials.Select(m => new { m.name, texture = m.mainTexture?.name }).ToArray(),
                center = r.bounds.center.ToString(), size = r.bounds.size.ToString()
            }).ToArray(), new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }
    private void DumpToolTextures()
    {
        foreach (var pair in toolSkins)
            File.WriteAllBytes(Path.Combine(Root, "qa", "tool-branded-" + pair.Key + ".png"), ImageConversion.EncodeToPNG(pair.Value.Applied).ToArray());
    }
}
