"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PendingRainDecision {
  siteId: string;
  siteNameTh: string;
  siteNameEn: string;
  workerCount: number;
}

interface Props {
  decisions: PendingRainDecision[];
}

export function RainWageDecisionPanel({ decisions }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const remaining = decisions.filter((d) => !resolved.has(d.siteId));
  if (remaining.length === 0) return null;

  const current = remaining[currentIndex] ?? remaining[0];

  async function handleDecision(decision: "half_day" | "full_day" | "no_wage" | "ask_17") {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/rain-wage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: current.siteId, decision }),
      });
      if (!res.ok) throw new Error("Failed");

      const next = new Set(resolved);
      next.add(current.siteId);
      setResolved(next);

      const stillRemaining = decisions.filter((d) => !next.has(d.siteId));
      if (stillRemaining.length > 0) {
        setCurrentIndex(0);
      } else {
        router.refresh();
      }
    } catch {
      // silent — panel stays open so owner can retry
    } finally {
      setLoading(false);
    }
  }

  const opts = [
    { value: "half_day" as const, th: "ครึ่งวัน", en: "Half day", color: "#F59E0B", bg: "#FFFBEB", border: "#FCD34D" },
    { value: "full_day" as const, th: "เต็มวัน", en: "Full day", color: "#15803D", bg: "#F0FDF4", border: "#86EFAC" },
    { value: "no_wage" as const, th: "ไม่จ่าย", en: "No wage", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
    { value: "ask_17" as const, th: "ถามอีกครั้งตอน 17:00", en: "Ask me at 17:00", color: "#4B5563", bg: "#F9FAFB", border: "#D1D5DB" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: "32px 28px",
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🌧️</div>
          <h2 style={{ fontSize: 23, fontWeight: 700, marginBottom: 2 }}>
            ตัดสินค่าแรงวันฝน
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Rain wage decision</p>

          <div
            style={{
              marginTop: 14,
              padding: "12px 16px",
              background: "#EFF6FF",
              borderRadius: 12,
              border: "1px solid #BFDBFE",
            }}
          >
            <strong style={{ fontSize: 18, display: "block" }}>{current.siteNameTh}</strong>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{current.siteNameEn}</span>
            <div style={{ marginTop: 6, fontSize: 14, color: "#1D4ED8", fontWeight: 600 }}>
              {current.workerCount} คน รายงานแล้ว · {current.workerCount} workers reported
            </div>
          </div>
        </div>

        {/* Decision buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opts.map((opt) => (
            <button
              key={opt.value}
              disabled={loading}
              onClick={() => handleDecision(opt.value)}
              style={{
                width: "100%",
                padding: "14px 20px",
                border: `2px solid ${opt.border}`,
                borderRadius: 12,
                background: opt.bg,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <strong style={{ fontSize: 17, color: opt.color }}>{opt.th}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{opt.en}</span>
            </button>
          ))}
        </div>

        {remaining.length > 1 && (
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
            ไซต์ {1} / {remaining.length} · site {1} of {remaining.length}
          </p>
        )}
      </div>
    </div>
  );
}
