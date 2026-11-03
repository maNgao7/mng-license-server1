namespace TikMnG.CanEmAll;

public static class AccountSelection
{
    public static bool TryNormalize(string value, out string username)
    {
        username = (value ?? "").Trim();
        if (username.StartsWith('@')) username = username[1..];
        if (username.Length is < 1 or > 40 || username.Any(c =>
            !(c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '_' or '.')))
        { username = ""; return false; }
        return true;
    }

    public static string StartupUsername(string savedUsername, bool autoConnect) =>
        autoConnect && TryNormalize(savedUsername, out var username) ? username : "";
}
