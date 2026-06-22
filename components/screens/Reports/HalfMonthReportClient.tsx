"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, Download, Minus, TrendingUp, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/format";
import type { HalfMonthReportData, WorkerPayrollRow } from "@/lib/halfmonth-report";

interface Props {
  report: HalfMonthReportData;
  today: string;
}

export function HalfMonthReportClient({ report, today }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { totals, workers, periodLabel, periodStart, periodEnd } = report;

  const filtered = workers.filter(
    (w) => w.nameTh.includes(search) || w.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  function handleDateChange(d: string) {
    router.push(`/reports/halfmonth?date=${d}`);
  }

  // ── Right panel ──────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      {/* Navy summary panel */}
      <section style={{
        background: "#1E3A8A",
        borderRadius: 14,
        padding: "18px 16px",
      }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 2 }}>สุทธิที่ต้องจ่าย</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 14 }}>Net payable · {periodStart} → {periodEnd}</div>
        <div style={{ color: "#22C55E", fontSize: 32, fontWeight: 700, marginBottom: 14 }}>
          ฿{formatCurrency(totals.totalNetPay)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "ค่าแรง Gross", v: `฿${formatCurrency(totals.totalGrossWage)}`, c: "rgba(255,255,255,0.9)" },
            { l: "OT",           v: `฿${formatCurrency(totals.totalOvertimePay)}`, c: "#FCD34D" },
            { l: "มัดจำ",        v: `-฿${formatCurrency(totals.totalAdvances)}`, c: "#FCA5A5" },
            { l: "วันเต็ม",      v: String(totals.totalFullDays), c: "rgba(255,255,255,0.9)" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="attention-card">
        <h2>สถิติ <span>Period stats</span></h2>
        {[
          { labelTh: "พนักงาน",     labelEn: "Workers",    value: String(totals.totalWorkers),  color: "#1E3A8A" },
          { labelTh: "วันเต็ม",     labelEn: "Full days",  value: String(totals.totalFullDays), color: "var(--text-primary)" },
          { labelTh: "ครึ่งวัน",    labelEn: "Half days",  value: String(totals.totalHalfDays), color: "#F59E0B" },
        ].map(({ labelTh, labelEn, value, color }) => (
          <div key={labelTh} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>{labelTh}<br /><small>{labelEn}</small></span>
            <strong style={{ color, fontSize: 18 }}>{value}</strong>
          </div>
        ))}
      </section>
    </>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      {/* Branded header card */}
      <div style={{
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 22px",
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#FF6A00", marginBottom: 8,
          }}>
            <span style={{ display: "inline-block", width: 14, height: 3, background: "#FF6A00", borderRadius: 2 }} />
            เงินเดือน · Payroll
          </div>
          <h1 style={{ fontSize: 31, fontWeight: 700, color: "#1E3A8A", marginBottom: 4, lineHeight: 1.1 }}>เงินเดือนครึ่งเดือน</h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 600 }}>{periodLabel}</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Half-Month Payroll · {periodStart} → {periodEnd}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <a
            href={`/api/reports/halfmonth/pdf?date=${periodEnd}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 14px",
              border: "2px solid #FF6A00",
              borderRadius: 10,
              color: "#1E3A8A",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              background: "white",
            }}
          >
            <Download size={17} strokeWidth={2.2} />
            PDF
          </a>
          <input
            type="date"
            value={today}
            max={today}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{
              padding: "9px 14px",
              border: "2px solid #1E3A8A",
              borderRadius: 10,
              fontSize: 14,
              color: "#1E3A8A",
              fontWeight: 600,
              outline: "none",
              background: "white",
            }}
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="metric-card blue" style={{ borderTop: "3px solid #1E3A8A" }}>
          <div className="metric-icon blue"><Users size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>พนักงาน</strong><small>Workers</small></div>
          <div className="metric-value" style={{ color: "#1E3A8A" }}>{totals.totalWorkers}</div>
        </div>
        <div className="metric-card green" style={{ borderTop: "3px solid #22C55E" }}>
          <div className="metric-icon green"><TrendingUp size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>ค่าแรง Gross</strong><small>Gross wages</small></div>
          <div className="metric-value" style={{ fontSize: 18, color: "#15803D" }}>฿{formatCurrency(totals.totalGross)}</div>
        </div>
        <div className="metric-card orange" style={{ borderTop: "3px solid #EF4444" }}>
          <div className="metric-icon orange"><Minus size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>มัดจำ</strong><small>Advances</small></div>
          <div className="metric-value" style={{ color: "#DC2626", fontSize: 18 }}>฿{formatCurrency(totals.totalAdvances)}</div>
        </div>
        <div className="metric-card teal" style={{ borderTop: "3px solid #10B981" }}>
          <div className="metric-icon teal"><ArrowDownCircle size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>สุทธิ Net</strong><small>Net payable</small></div>
          <div className="metric-value" style={{ color: "#059669", fontSize: 18 }}>฿{formatCurrency(totals.totalNetPay)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="desktop-only" style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="ค้นหาพนักงาน · Search worker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px",
            border: "1px solid var(--border)", borderRadius: 8,
            fontSize: 15, outline: "none",
          }}
        />
      </div>

      {/* Payroll table — desktop only, mobile uses card list below */}
      <div className="table-card desktop-only">
        <div
          className="table-header"
          style={{ gridTemplateColumns: "2fr 80px 80px 80px 100px 100px 110px 110px" }}
        >
          <span>พนักงาน <small>Worker</small></span>
          <span>วันเต็ม <small>Full</small></span>
          <span>ครึ่งวัน <small>Half</small></span>
          <span>สาย <small>Late</small></span>
          <span>ค่าแรง <small>Wages</small></span>
          <span>OT</span>
          <span>มัดจำ <small>Advance</small></span>
          <span>สุทธิ <small>Net pay</small></span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            ไม่พบพนักงาน · No workers found
          </div>
        ) : (
          filtered.map((w) => <PayrollRow key={w.workerId} w={w} periodStart={periodStart} periodEnd={periodEnd} />)
        )}

        {/* Totals row */}
        {filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 80px 80px 80px 100px 100px 110px 110px",
              padding: "12px 20px",
              gap: 12,
              background: "#EFF6FF",
              borderTop: "2px solid var(--brand-primary)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span style={{ color: "var(--brand-primary)" }}>รวมทั้งหมด · Total</span>
            <span>{totals.totalFullDays}</span>
            <span>{totals.totalHalfDays}</span>
            <span>—</span>
            <span>฿{formatCurrency(totals.totalGrossWage)}</span>
            <span style={{ color: "#EA580C" }}>฿{formatCurrency(totals.totalOvertimePay)}</span>
            <span style={{ color: "#DC2626" }}>฿{formatCurrency(totals.totalAdvances)}</span>
            <span style={{ color: "#16A34A", fontSize: 16 }}>฿{formatCurrency(totals.totalNetPay)}</span>
          </div>
        )}
      </div>

      {/* Mobile list */}
      <div className="mobile-only" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((w) => (
          <div key={w.workerId} style={{ background: "white", borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{w.nameTh}</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{w.siteNameTh}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: 18, color: "#16A34A" }}>฿{formatCurrency(w.netPay)}</strong>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>สุทธิ · Net</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 12 }}>
              <Stat label="วันเต็ม" value={String(w.fullDays)} />
              <Stat label="ครึ่งวัน" value={String(w.halfDays)} />
              <Stat label="Gross" value={`฿${formatCurrency(w.grossTotal)}`} />
              {w.advances > 0
                ? <Stat label="มัดจำ" value={`-฿${formatCurrency(w.advances)}`} color="#DC2626" />
                : <Stat label="มัดจำ" value="—" />
              }
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

function PayrollRow({ w, periodStart, periodEnd }: { w: WorkerPayrollRow; periodStart: string; periodEnd: string }) {
  return (
    <Link
      href={`/reports/halfmonth/worker/${w.workerId}?start=${periodStart}&end=${periodEnd}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
    <div
      className="table-row"
      style={{ gridTemplateColumns: "2fr 80px 80px 80px 100px 100px 110px 110px", display: "grid", padding: "11px 20px", gap: 12, alignItems: "center", cursor: "pointer" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0 }}>
          {w.nameTh[0]}
        </div>
        <span>
          <span className="cell-th">{w.nameTh}</span>
          <span className="cell-en">{w.siteNameTh}</span>
        </span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{w.fullDays}</span>
      <span style={{ fontSize: 15 }}>{w.halfDays > 0 ? <span style={{ color: "#B45309" }}>{w.halfDays}</span> : "—"}</span>
      <span style={{ fontSize: 14, color: w.lateDays > 0 ? "#F97316" : "var(--text-muted)" }}>{w.lateDays > 0 ? w.lateDays : "—"}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>฿{formatCurrency(w.grossWage)}</span>
      <span style={{ fontSize: 14, color: w.overtimePay > 0 ? "#EA580C" : "var(--text-muted)", fontWeight: w.overtimePay > 0 ? 600 : 400 }}>
        {w.overtimePay > 0 ? `฿${formatCurrency(w.overtimePay)}` : "—"}
      </span>
      <span style={{ fontSize: 14, color: w.advances > 0 ? "#DC2626" : "var(--text-muted)" }}>
        {w.advances > 0 ? `-฿${formatCurrency(w.advances)}` : "—"}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#16A34A" }}>฿{formatCurrency(w.netPay)}</span>
    </div>
    </Link>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
