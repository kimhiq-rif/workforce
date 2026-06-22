"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Monthly report — stage transitions shown as full-width colored divider lines
// (per spec). One per Move Stage that happened during the month.

interface Transition {
  siteName: string;
  stageName: string;
  color: string;
  date: string;
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function MonthlyStageTransitions({ transitions }: { transitions: Transition[] }) {
  if (!transitions || transitions.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
        เปลี่ยนขั้นตอน <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Stage transitions · {transitions.length}</small>
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {transitions.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                height: 0,
                borderTop: `3px solid ${t.color}`,
                borderRadius: 2,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.color }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t.siteName}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→ {t.stageName}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {shortDate(t.date)}</span>
            </div>
            <div
              style={{
                flex: 1,
                height: 0,
                borderTop: `3px solid ${t.color}`,
                borderRadius: 2,
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
