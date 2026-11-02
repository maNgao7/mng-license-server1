using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private bool flashIntroQueued;
    private float flashBlastAt = -100;
    private int flashBlasts;
    private AudioClip flashClip;
    private Texture2D flashBurst;
    private GUIStyle effectNumberStyle;
    private const float FlashIntroSeconds = .42f;

    private void TriggerFlash(int seconds, int repeats)
    {
        effects.Flash(seconds, repeats);
        if (Time.time - flashBlastAt > .45f) flashIntroQueued = true;
    }

    private void PrepareFlashPresentation()
    {
        const int rate = 24000;
        var samples = new float[rate * 2];
        var noise = new System.Random(144);
        double phase = 0;
        for (int i = 0; i < samples.Length; i++)
        {
            double t = i / (double)rate;
            phase += 2 * Math.PI * (2100 - 300 * Math.Min(t, 1)) / rate;
            double impact = (noise.NextDouble() * 2 - 1) * .28 * Math.Exp(-t * 32);
            double low = Math.Sin(2 * Math.PI * 95 * t) * .16 * Math.Exp(-t * 18);
            double ring = Math.Sin(phase) * .055 * Math.Min(1, t * 28) * Math.Exp(-t * 2.5);
            samples[i] = (float)(impact + low + ring);
        }
        flashClip = CreateFlashClip(samples, rate);
        const int size = 256;
        var pixels = new byte[size * size * 4];
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
        {
            float dx = (x - 127.5f) / 127.5f, dy = (y - 127.5f) / 127.5f;
            float radius = MathF.Sqrt(dx * dx + dy * dy);
            float ring = Math.Clamp(1 - Math.Abs(radius - .7f) / .055f, 0, 1);
            float rays = MathF.Pow(Math.Max(0, MathF.Cos(MathF.Atan2(dy, dx) * 12)), 8) * Math.Clamp(1 - radius, 0, 1);
            int p = (y * size + x) * 4;
            pixels[p] = 255; pixels[p + 1] = 225; pixels[p + 2] = 158;
            pixels[p + 3] = (byte)(Math.Clamp(ring * .9f + rays * .7f, 0, 1) * 255);
        }
        flashBurst = UploadImage(size, size, pixels); flashBurst.Apply();
    }

    private static unsafe AudioClip CreateFlashClip(float[] samples, int rate)
    {
        const string name = "TikMnG_Flash_Impact_Ring";
        var clip = AudioClip.Construct_Internal();
        var native = UnityEngine.Object.MarshalledUnityObject.MarshalNotNull(clip);
        // Unity 6's reconstructed generic Span wrappers are missing in this IL2CPP build.
        fixed (char* label = name)
        fixed (float* pcm = samples)
        {
            var labelSpan = new UnityEngine.Bindings.ManagedSpanWrapper(label, name.Length);
            AudioClip.CreateUserSound_Injected(native, ref labelSpan, samples.Length, 1, rate, false);
            var dataSpan = new UnityEngine.Bindings.ManagedSpanWrapper(pcm, samples.Length);
            if (!AudioClip.SetData_Injected(native, ref dataSpan, 0)) throw new InvalidOperationException("Flash PCM upload failed.");
        }
        return clip;
    }

    private void StartFlashBlast()
    {
        flashIntroQueued = false; flashBlastAt = Time.time; flashBlasts++;
        Player.Instance.audioSource.PlayOneShot(flashClip, .65f);
    }

    private float FlashOpacity => Math.Clamp((Time.time - flashBlastAt) / FlashIntroSeconds, 0, 1) * (float)Math.Min(1, effects.FlashSeconds / .35);

    private void DrawFlashPresentation()
    {
        float elapsed = Time.time - flashBlastAt;
        Paint(new Rect(0, 0, Screen.width, Screen.height), new Color(1, 1, 1, FlashOpacity));
        if (elapsed >= 0 && elapsed < FlashIntroSeconds)
        {
            float progress = elapsed / FlashIntroSeconds;
            float size = Math.Max(Screen.width, Screen.height) * (.15f + 1.35f * progress);
            var previous = GUI.color;
            GUI.color = new Color(1, 1, 1, 1 - progress);
            GUI.DrawTexture(new Rect((Screen.width - size) / 2, (Screen.height - size) / 2, size, size), flashBurst);
            GUI.color = previous;
        }
        DrawEffectCountdown("FLASH", "Zap", effects.FlashSeconds, 0, true);
    }

    private void DrawEffectCountdown(string title, string icon, double seconds, float offset, bool onWhite)
    {
        if (effectNumberStyle == null) { effectNumberStyle = LabelStyle(46, Ink, true); effectNumberStyle.alignment = TextAnchor.MiddleCenter; }
        float width = Screen.width < 1000 ? 240 : 300, x = (Screen.width - width) / 2, y = Screen.height / 2f - 51 + offset;
        Color color = onWhite ? HudNavy : Ink;
        if (!onWhite)
        {
            Paint(new Rect(x, y - 8, width, 110), new Color(.03f, .04f, .045f, .88f));
            Paint(new Rect(x, y - 8, 3, 110), Amber);
        }
        DrawHudIcon(new Rect(x + 18, y + 2, 20, 20), LoadIcon("ui-" + icon + ".png"), onWhite ? HudNavy : Amber);
        Label(new Rect(x + 48, y, width - 60, 24), title, sectionStyle, onWhite ? HudNavy : Amber);
        Label(new Rect(x + 18, y + 27, width - 36, 62), Math.Ceiling(seconds) + " sn", effectNumberStyle, color);
    }
}
