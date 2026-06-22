"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Owner accountability soft-block (spec): if a long-project site's current stage
// has had no target_end_date for > 7 days, the dashboard grays out daily between
// 08:00–08:10 Bangkok with a red demand to set the target. Owner dashboard only —
// it does NOT block attendance / field work / receipts (those live elsewhere).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, AlertTriangle } from "lucide-react";

export interface SoftBlockSite {
  siteId: string;
  siteNameTh: string;
  siteNameEn: string | null;
  days: number;
}

// Minutes past midnight, Bangkok local time.
function bangkokMinutes(): number {
  const hhmm = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const WINDOW_START = 8 * 60;       // 08:00
const WINDOW_END = 8 * 60 + 10;    // 08:10

export function StageTargetSoftBlock({ sites }: { sites: SoftBlockSite[] }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (sites.length === 0) return;
    const check = () => {
      const mins = bangkokMinutes();
      setActive(mins >= WINDOW_START && mins < WINDOW_END);
    };
    check();
    const id = setInterval(check, 20_000); // re-check so it opens/closes on time
    return () => clearInterval(id);
  }, [sites.length]);

  if (!active || sites.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(127, 29, 29, 0.92)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          maxWidth: 440,
          width: "100%",
          padding: "24px 22px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 8 }}>
            <AlertTriangle size={22} color="#DC2626" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#991B1B" }}>
              ต้องกำหนดเป้าหมายขั้นตอน
            </div>
            <div style={{ fontSize: 13, color: "#B91C1C" }}>Set a stage target to continue</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#7F1D1D", lineHeight: 1.5, marginBottom: 16 }}>
          ไซต์ต่อไปนี้ยังไม่มีเป้าหมายขั้นปัจจุบันมากกว่า 7 วัน · The following sites have had no
          target for the current stage for over a week:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sites.map((s) => (
            <Link
              key={s.siteId}
              href={`/sites/${s.siteId}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: "10px 12px",
                textDecoration: "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#7F1D1D" }}>{s.siteNameTh}</div>
                {s.siteNameEn && (
                  <div style={{ fontSize: 12, color: "#B91C1C" }}>{s.siteNameEn}</div>
                )}
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#DC2626",
                  color: "white",
                  borderRadius: 8,
                  padding: "6px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <Flag size={12} /> {s.days}d · ตั้งเป้าหมาย
              </span>
            </Link>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 16, textAlign: "center" }}>
          หน้าต่างนี้จะปิดอัตโนมัติเวลา 08:10 · This window closes automatically at 08:10
        </p>
      </div>
    </div>
  );
}
