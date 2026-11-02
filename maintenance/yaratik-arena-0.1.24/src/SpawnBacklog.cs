namespace TikMnG.CanEmAll;

public sealed class SpawnBacklog
{
    private sealed class Batch
    {
        public string User = "";
        public int Remaining;
        public string Kind = "spawn";
    }
    private readonly Queue<Batch> batches = new();
    public int Count { get; private set; }
    public int BatchCount => batches.Count;
    public void Enqueue(string user, int count, string kind = "spawn")
    {
        if (count <= 0) return;
        count = Math.Min(count, 1_000_000 - Count);
        if (count <= 0) return;
        batches.Enqueue(new Batch { User = user, Remaining = count, Kind = kind }); Count += count;
    }
    public string Peek() => batches.Peek().User;
    public string PeekKind() => batches.Peek().Kind;
    public int CountKind(string kind) => batches.Where(b => b.Kind == kind).Sum(b => b.Remaining);
    public void RemoveOne()
    {
        if (Count == 0) return;
        if (--batches.Peek().Remaining == 0) batches.Dequeue();
        Count--;
    }
    public void Clear() { batches.Clear(); Count = 0; }
}
