"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Monthly report — M5 detail sections (advances, temp workers, corrections, GPS
// issues) each with a drill-down evidence drawer.
import { useState } from "react";
import { Wallet, UserCog, Pencil, MapPinOff, X, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export interface MonthlyAdvance {
  id: string;
  workerName: string;
  siteName: string;
  amount: number;
  notes: string;
  by: string;
  date: string;
}
export interface MonthlyCorrection {
  id: string;
  entityType: string;
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  by: string;
  date: string;
}
export interface MonthlyTempWorker {
  id: string;
  name: string;
  days: number;
  cost: number;
}
export interface MonthlyGpsIssue {
  id: string;
  workerName: string;
  siteName: string;
  date: string;
}

type DrawerKey = "advances" | "temp" | "corrections" | "gps" | null;

function shortDate(iso: string): string {
  return String(iso ?? "").slice(0, 10);
}

export function MonthlyM5({
  advances,
  corrections,
  tempWorkers,
  gpsIssues,
}: {
  advances: MonthlyAdvance[];
  corrections: MonthlyCorrection[];
  tempWorkers: MonthlyTempWorker[];
  gpsIssues: MonthlyGpsIssue[];
}) {
  const [open, setOpen] = useState<DrawerKey>(null);

  const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
  const tempTotal = tempWorkers.reduce((s, w) => s + w.cost, 0);

  const cards: { key: Exclude<DrawerKey, null>; icon: React.ReactNode; titleTh: string; titleEn: string; value: string; sub: string; count: number; color: string }[] = [
    {
      key: "advances",
      icon: <Wallet size={18} color="#6C5CE7" />,
      titleTh: "เบิกล่วงหน้า", titleEn: "Advances",
      value: `฿${formatCurrency(advancesTotal)}`,
      sub: `${advances.length} รายการ`,
      count: advances.length,
      color: "#6C5CE7",
    },
    {
      key: "temp",
      icon: <UserCog size={18} color="#06B6D4" />,
      titleTh: "คนงานชั่วคราว", titleEn: "Temp workers",
      value: `฿${formatCurrency(tempTotal)}`,
      sub: `${tempWorkers.length} คน`,
      count: tempWorkers.length,
      color: "#06B6D4",
    },
    {
      key: "corrections",
      icon: <Pencil size={18} color="#F59E0B" />,
      titleTh: "การแก้ไข", titleEn: "Corrections",
      value: String(corrections.length),
      sub: "แก้ไขย้อนหลัง",
      count: corrections.length,
      color: "#F59E0B",
    },
    {
      key: "gps",
      icon: <MapPinOff size={18} color="#EF4444" />,
      titleTh: "ปัญหา GPS", titleEn: "GPS issues",
      value: String(gpsIssues.length),
      sub: "ไม่มีพิกัดรูป",
      count: gpsIssues.length,
      color: "#EF4444",
    },
  ];

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1E3A8A", marginBottom: 10 }}>
        รายละเอียดเพิ่มเติม <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Details · M5</small>
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => c.count > 0 && setOpen(c.key)}
            style={{
              textAlign: "right", background: "white", border: "1px solid var(--border)",
              borderLeft: `4px solid ${c.color}`, borderRadius: 10, padding: "12px 14px",
              cursor: c.count > 0 ? "pointer" : "default", opacity: c.count > 0 ? 1 : 0.55,
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {c.icon} {c.titleTh}
              </span>
              {c.count > 0 && <ChevronRight size={15} color="var(--text-muted)" />}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.titleEn}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.sub}</div>
          </button>
        ))}
      </div>

      {open && (
        <Drawer onClose={() => setOpen(null)} title={`${cards.find((c) => c.key === open)!.titleTh} · ${cards.find((c) => c.key === open)!.titleEn}`}>
          {open === "advances" && advances.map((a) => (
            <Row key={a.id} title={`${a.workerName} — ฿${formatCurrency(a.amount)}`} detail={`${a.siteName} · ${shortDate(a.date)} · ${a.by}${a.notes ? ` · ${a.notes}` : ""}`} />
          ))}
          {open === "temp" && tempWorkers.map((w) => (
            <Row key={w.id} title={`${w.name} — ฿${formatCurrency(w.cost)}`} detail={`${w.days} วันทำงาน · work days`} />
          ))}
          {open === "corrections" && corrections.map((c) => (
            <Row
              key={c.id}
              title={`${c.entityType} · ${c.fieldName}`}
              detail={`${c.originalValue || "—"} → ${c.correctedValue || "—"} · ${shortDate(c.date)} · ${c.by}${c.reason ? ` · ${c.reason}` : ""}`}
            />
          ))}
          {open === "gps" && gpsIssues.map((g) => (
            <Row key={g.id} title={`${g.workerName}`} detail={`${g.siteName} · ${shortDate(g.date)} · ไม่มีพิกัด GPS`} />
          ))}
        </Drawer>
      )}
    </section>
  );
}

function Row({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{detail}</div>
    </div>
  );
}

function Drawer({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100, display: "flex", justifyContent: "flex-end" }}
    >
      <div style={{ width: "min(440px, 100%)", height: "100%", background: "white", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} color="var(--text-muted)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>{children}</div>
      </div>
    </div>
  );
}
