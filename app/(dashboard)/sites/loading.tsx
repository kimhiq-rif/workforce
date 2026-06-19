export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <div style={{ height: 70, background: "linear-gradient(135deg, #1E3A8A 0%, #4C1D95 60%, #6C5CE7 100%)" }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 100, borderRadius: 12, background: "white", border: "1px solid #E8E4F4" }} />
        ))}
      </div>
    </div>
  );
}
