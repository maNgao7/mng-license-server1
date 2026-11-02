namespace TikMnG.CanEmAll;

public sealed class AudienceTriggers
{
    private readonly Dictionary<string, int> likes = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> followers = new(StringComparer.OrdinalIgnoreCase);
    private int threshold = 100;
    public void Configure(int value)
    {
        value = Math.Clamp(value, 1, 1000000);
        if (threshold == value) return;
        threshold = value; likes.Clear();
    }
    public int Like(string user, int count)
    {
        if (string.IsNullOrWhiteSpace(user) || count <= 0) return 0;
        likes.TryGetValue(user, out int previous);
        long total = (long)previous + count;
        likes[user] = (int)(total % threshold);
        return (int)(total / threshold);
    }
    public int Remainder(string user) => likes.TryGetValue(user, out int value) ? value : 0;
    public bool Follow(string user) => !string.IsNullOrWhiteSpace(user) && followers.Add(user);
    public void Clear() { likes.Clear(); followers.Clear(); }
}
