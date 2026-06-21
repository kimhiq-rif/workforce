"use client";
// Small client component — just to provide window.print() on the server-rendered report page.
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        background: "linear-gradient(135deg, #6C5CE7, #4F46E5)",
        color: "white",
        border: "none",
        borderRadius: 8,
        padding: "10px 20px",
        fontSize: 14,
        cursor: "pointer",
        fontWeight: 600,
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      🖨️ พิมพ์ · Print
    </button>
  );
}
