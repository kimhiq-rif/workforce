export default function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", flexDirection: "column", gap: 16 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "linear-gradient(135deg, #1E3A8A 0%, #6C5CE7 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulse-dot 1.2s ease-in-out infinite",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>กำลังโหลด… Loading</div>
    </div>
  );
}
