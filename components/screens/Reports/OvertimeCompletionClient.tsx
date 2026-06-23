"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Save } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/format";

export interface OvertimeMissingRow {
  id: string;
  event_date: string;
  overtime_end_time: string;
  overtime_hours: number;
  siteName: string;
  workerNameTh: string;
  workerNameEn: string;
  dailyWage: number;
}

function suggestedAmount(row: OvertimeMissingRow): number {
  const hourlyRate = row.dailyWage / 9;
  return Math.round(hourlyRate * row.overtime_hours * 2);
}

export function OvertimeCompletionClient({
  rows,
  targetMonth,
}: {
  rows: OvertimeMissingRow[];
  targetMonth: string;
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of rows) initial[row.id] = String(suggestedAmount(row));
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(amounts[row.id]) || 0), 0),
    [rows, amounts]
  );

  async function saveAll() {
    setError("");
    const entries = rows.map((row) => ({
      id: row.id,
      amount: Number(amounts[row.id]),
    }));

    if (entries.some((entry) => !Number.isFinite(entry.amount) || entry.amount < 0)) {
      setError("กรอกจำนวนเงินที่ถูกต้องทุกรายการ · Enter a valid amount for every entry.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/overtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "บันทึกไม่สำเร็จ · Could not save overtime amounts.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <div className="desktop-only" style={{ maxWidth: 980 }}>
        <Header targetMonth={targetMonth} />
        <Content
          rows={rows}
          amounts={amounts}
          setAmounts={setAmounts}
          total={total}
          saving={saving}
          error={error}
          onSave={saveAll}
        />
      </div>
      <div className="mobile-only">
        <div className="mobile-topbar">
          <Link href={`/reports/monthly?month=${targetMonth}`} className="mobile-topbar-back">
            <ChevronLeft size={24} />
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "white", fontSize: 18 }}>กรอกค่าล่วงเวลา</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{targetMonth}</p>
          </div>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <Content
            rows={rows}
            amounts={amounts}
            setAmounts={setAmounts}
            total={total}
            saving={saving}
            error={error}
            onSave={saveAll}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function Header({ targetMonth }: { targetMonth: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Link
        href={`/reports/monthly?month=${targetMonth}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 6 }}
      >
        <ChevronLeft size={16} /> กลับสู่รายงานเดือน · Back
      </Link>
      <h1 style={{ fontSize: 31, fontWeight: 700, marginBottom: 4 }}>กรอกค่าล่วงเวลา</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Overtime amounts · กรอกรายการที่บันทึกไว้ว่า "เตือนภายหลัง" สำหรับ {targetMonth}
      </p>
    </div>
  );
}

function Content({
  rows,
  amounts,
  setAmounts,
  total,
  saving,
  error,
  onSave,
}: {
  rows: OvertimeMissingRow[];
  amounts: Record<string, string>;
  setAmounts: (next: Record<string, string>) => void;
  total: number;
  saving: boolean;
  error: string;
  onSave: () => void;
}) {
  if (rows.length === 0) {
    return (
      <section style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: 18 }}>
        <strong style={{ color: "#166534" }}>ไม่มีรายการค้าง · Nothing pending</strong>
        <div style={{ marginTop: 4, fontSize: 13, color: "#166534" }}>
          รายการล่วงเวลาทั้งหมดของเดือนนี้มีจำนวนเงินแล้ว · All overtime this month has amounts.
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Clock size={22} color="#C2410C" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#9A3412" }}>
            {rows.length} รายการต้องกรอกจำนวนเงิน · entries need an amount
          </div>
          <div style={{ fontSize: 12, color: "#9A3412" }}>
            ค่าแนะนำ = ค่าแรงรายวัน / 9 ชม. × ชม. ล่วงเวลา × 2
          </div>
        </div>
        <strong style={{ color: "#9A3412" }}>THB {formatCurrency(total)}</strong>
      </section>

      <div className="table-card">
        <div className="table-header" style={{ gridTemplateColumns: "120px 1.4fr 1.4fr 110px 120px" }}>
          <span>วันที่ · Date</span>
          <span>ไซต์ · Site</span>
          <span>คนงาน · Worker</span>
          <span>ชม. · Hours</span>
          <span>จำนวน · Amount</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="table-row"
            style={{ gridTemplateColumns: "120px 1.4fr 1.4fr 110px 120px", display: "grid", padding: "12px 20px", gap: 12, alignItems: "center" }}
          >
            <span>
              <span className="cell-th">{row.event_date}</span>
              <span className="cell-en">until {row.overtime_end_time?.slice(0, 5)}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{row.siteName}</span>
            <span>
              <span className="cell-th">{row.workerNameTh}</span>
              <span className="cell-en">{row.workerNameEn}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{Number(row.overtime_hours).toFixed(2)}</span>
            <input
              type="number"
              min="0"
              value={amounts[row.id] ?? ""}
              onChange={(event) => setAmounts({ ...amounts, [row.id]: event.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                textAlign: "right",
              }}
            />
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", color: "#B91C1C", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        className="btn-primary"
        style={{ alignSelf: "flex-end", minWidth: 180, justifyContent: "center", opacity: saving ? 0.7 : 1 }}
      >
        <Save size={18} />
        {saving ? "กำลังบันทึก…" : "บันทึก · Save"}
      </button>
    </div>
  );
}
