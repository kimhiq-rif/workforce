export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <div style={{ height: 70, background: "linear-gradient(135deg, #1E3A8A 0%, #4C1D95 60%, #6C5CE7 100%)" }} />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 64, borderRadius: 8, background: "#E8E4F4" }} />)}
        </div>
        <div style={{ height: 44, borderRadius: 8, background: "#E8E4F4" }} />
        <div style={{ height: 36, borderRadius: 20, background: "#E8E4F4", width: "90%" }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, borderRadius: 10, background: "white", border: "1px solid #E8E4F4" }} />
        ))}
      </div>
    </div>
  );
}
