using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private string publishingStatus = "";
    private static readonly string[] PublishingFiles = { "yaratik-arena-gifts.png", "yaratik-arena-cover-v1.png" };
    private static readonly string[] PublishingNames = { "TikMnG-Yaratik-Arena-Hediyeler.png", "TikMnG-Yaratik-Arena-Kapak.png" };

    private void DrawPublishingPage(Rect area)
    {
        PageTitle(area, "Yayin dosyalari", "YARATIK ARENA");
        float gap = 20, width = (area.width - gap) / 2;
        for (int i = 0; i < PublishingFiles.Length; i++)
        {
            float x = area.x + i * (width + gap);
            Label(new Rect(x, area.y + 42, width, 26), i == 0 ? "Hediye gorseli" : "Oyun kapagi", sectionStyle);
            var preview = new Rect(x, area.y + 78, width, Math.Max(80, area.height - 166));
            Paint(preview, new Color(.015f, .02f, .025f));
            var image = LoadIcon("publishing/" + PublishingFiles[i]);
            if (image != null) GUI.DrawTexture(preview, image, ScaleMode.ScaleToFit, true);
            if (CommandButton(new Rect(x, area.yMax - 74, width, 36), "Save", i == 0 ? "Hediye gorselini indir" : "Kapagi indir", true)) ExportPublishingFile(i);
        }
        Label(new Rect(area.x, area.yMax - 30, area.width, 28), publishingStatus, captionStyle, Accent);
    }

    private void ExportPublishingFile(int index, bool testing = false)
    {
        if (index < 0 || index >= PublishingFiles.Length) return;
        try
        {
            string directory = testing ? Path.Combine(Root, "qa", "exports")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            Directory.CreateDirectory(directory);
            string destination = Path.Combine(directory, PublishingNames[index]);
            for (int suffix = 2; File.Exists(destination); suffix++)
                destination = Path.Combine(directory, Path.GetFileNameWithoutExtension(PublishingNames[index]) + "-" + suffix + ".png");
            File.Copy(Path.Combine(Root, "assets", "publishing", PublishingFiles[index]), destination, false);
            publishingStatus = testing ? destination : "Indirilenler / " + Path.GetFileName(destination);
        }
        catch (Exception error)
        {
            publishingStatus = "Dosya kaydedilemedi.";
            MelonLoader.MelonLogger.Warning("Publishing export: " + error.Message);
        }
    }
}
