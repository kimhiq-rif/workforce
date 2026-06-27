"use client";

import Link from "next/link";
import { ChevronLeft, Clock, AlertTriangle, CheckCircle, Zap, ArrowDownCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency, formatTime } from "@/lib/format";

interface Worker {
  id: string;
  name_th: string;
  name_en: string;
  daily_wage: number;
  photo_url: string | null;
  role_th: string | null;
  role_en: string | null;
  site: { name_th: string; name_en: string } | null;
}

interface AttendanceDay {
  event_date: string;
  arrival_time: string | null;
  status: string;
  is_late: boolean;
  wage_reason: string | null;
  wage_amount: number | null;
  site: { name_th: string } | null;
  photo_url: string | null;
}

interface OvertimeEntry {
  event_date: string;
  overtime_end_time: string;
  overtime_hours: number;
  amount: number;
  site: { name_th: string } | null;
}

interface AdvanceEntry {
  payment_date: string;
  amount: number;
  notes: string | null;
}

interface Totals {
  presentDays: number;
  missingDays: number;
  lateDays: number;
  grossWage: number;
  overtimePay: number;
  totalAdvances: number;
  netPay: number;
}

interface Props {
  worker: Worker;
  periodStart: string;
  periodEnd: string;
  attendance: AttendanceDay[];
  overtime: OvertimeEntry[];
  advances: AdvanceEntry[];
  totals: Totals;
  backUrl: string;
}

function thaiDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const days = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const dow = new Date(y, m - 1, day).getDay();
  return { full: `${days[dow]} ${day} ${months[m]} ${y + 543}`, short: `${day} ${months[m]}`, dow: days[dow] };
}

function statusInfo(att: AttendanceDay) {
  if (att.status === "missing")  return { labelTh: "ขาด",     labelEn: "Missing",  color: "#EF4444", bg: "#FEF2F2" };
  if (att.status === "day_off")  return { labelTh: "หยุด",    labelEn: "Day off",  color: "#3B82F6", bg: "#EFF6FF" };
  const isHalf = att.wage_reason?.startsWith("half_day");
  if (isHalf)                    return { labelTh: "ครึ่งวัน", labelEn: "Half day", color: "#D97706", bg: "#FFFBEB" };
  if (att.is_late)               return { labelTh: "สาย",     labelEn: "Late",     color: "#F97316", bg: "#FFF7ED" };
  return                                { labelTh: "ปกติ",     labelEn: "On time",  color: "#22C55E", bg: "#F0FDF4" };
}

export function WorkerPeriodDetailClient({ worker, periodStart, periodEnd, attendance, overtime, advances, totals, backUrl }: Props) {
  // Build day-by-day map
  const attMap = new Map(attendance.map((a) => [a.event_date, a]));
  const otMap  = new Map(overtime.map((o) => [o.event_date, o]));

  // Generate all days in period
  const days: string[] = [];
  const cur = new Date(periodStart);
  const last = new Date(periodEnd);
  while (cur <= last) {
    days.push(cur.toLocaleDateString("en-CA"));
    cur.setDate(cur.getDate() + 1);
  }

  const rightPanel = (
    <>
      {/* Net pay summary */}
      <section style={{ background: "#1E3A8A", borderRadius: 14, padding: "18px 16px", marginBottom: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 4 }}>สุทธิที่ต้องจ่าย</div>
        <div style={{ color: "white", fontSize: 13, marginBottom: 12 }}>Net payable · {periodStart} → {periodEnd}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#4ADE80", marginBottom: 8 }}>
          ฿{formatCurrency(totals.netPay)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "ค่าแรง", v: `฿${formatCurrency(totals.grossWage)}`, c: "rgba(255,255,255,0.9)" },
            { l: "OT", v: `฿${formatCurrency(totals.overtimePay)}`, c: "#FCD34D" },
            { l: "มัดจำ", v: `-฿${formatCurrency(totals.totalAdvances)}`, c: "#FCA5A5" },
            { l: "วันที่มา", v: String(totals.presentDays), c: "rgba(255,255,255,0.9)" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="attention-card">
        <h2>สถิติช่วงนี้ <span>Period stats</span></h2>
        {[
          { labelTh: "วันมาทำงาน", labelEn: "Present", value: totals.presentDays, color: "#22C55E" },
          { labelTh: "วันขาด",     labelEn: "Missing",  value: totals.missingDays, color: "#EF4444" },
          { labelTh: "วันมาสาย",   labelEn: "Late",     value: totals.lateDays,    color: "#F97316" },
        ].map(({ labelTh, labelEn, value, color }) => (
          <div key={labelTh} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>{labelTh}<br /><small>{labelEn}</small></span>
            <strong style={{ color, fontSize: 18 }}>{value}</strong>
          </div>
        ))}
      </section>

      {/* Advances */}
      {advances.length > 0 && (
        <section className="attention-card">
          <h2>มัดจำ <span>Advances</span></h2>
          {advances.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>
                {thaiDate(a.payment_date).short}
                {a.notes ? <span style={{ display: "block", fontSize: 11 }}>{a.notes}</span> : null}
              </span>
              <strong style={{ color: "#DC2626" }}>-฿{formatCurrency(a.amount)}</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={backUrl}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 10 }}
        >
          <ChevronLeft size={16} />
          กลับรายงานครึ่งเดือน · Back to Payroll
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: worker.photo_url ? "transparent" : "#DBEAFE", color: "#1E40AF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, flexShrink: 0, overflow: "hidden",
          }}>
            {worker.photo_url ? <img src={worker.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : worker.name_th[0]}
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{worker.name_th}</h1>
            <div style={{ fontSize: 15, color: "var(--text-muted)" }}>{worker.name_en}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {worker.site?.name_th ?? "—"} · ฿{formatCurrency(worker.daily_wage)}/วัน
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-day table */}
      <div style={{ marginBottom: 8, fontSize: 17, fontWeight: 600 }}>
        บันทึกรายวัน <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Day-by-day · {periodStart} → {periodEnd}</span>
      </div>

      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-header" style={{ gridTemplateColumns: "130px 80px 90px 120px 90px 90px" }}>
          <span>วันที่ <small>Date</small></span>
          <span>เวลาเข้า <small>Arrival</small></span>
          <span>สถานะ <small>Status</small></span>
          <span>อัตรา <small>Wage reason</small></span>
          <span>ค่าแรง <small>Amount</small></span>
          <span>ล่วงเวลา <small>Overtime</small></span>
        </div>

        {days.map((d) => {
          const att = attMap.get(d);
          const ot  = otMap.get(d);
          const date = thaiDate(d);
          const st   = att ? statusInfo(att) : null;

          return (
            <div
              key={d}
              className="table-row"
              style={{
                gridTemplateColumns: "130px 80px 90px 120px 90px 90px",
                display: "grid",
                padding: "11px 20px",
                gap: 12,
                alignItems: "center",
                background: !att ? "var(--surface)" : "white",
              }}
            >
              <span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{date.short}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{date.dow}</span>
              </span>

              <span style={{ fontSize: 15, fontWeight: 600, color: att?.arrival_time ? "var(--text-primary)" : "var(--text-muted)" }}>
                {att?.arrival_time ? formatTime(att.arrival_time) : "—"}
              </span>

              <span>
                {st ? (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    background: st.bg, color: st.color,
                    padding: "3px 8px", borderRadius: 6,
                    display: "inline-block",
                  }}>
                    {st.labelTh}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                )}
              </span>

              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {att?.wage_reason
                  ? att.wage_reason === "full_day"                    ? "เต็มวัน"
                  : att.wage_reason === "half_day_afternoon_arrival"  ? "ครึ่งวันบ่าย"
                  : att.wage_reason === "half_day_morning_departure"  ? "ครึ่งวันเช้า"
                  : att.wage_reason === "half_day_rain"               ? "ครึ่งวัน (ฝน)"
                  : att.wage_reason
                  : "—"}
              </span>

              <span style={{ fontSize: 15, fontWeight: 600, color: att?.wage_amount ? "var(--text-primary)" : "var(--text-muted)" }}>
                {att?.wage_amount ? `฿${formatCurrency(att.wage_amount)}` : "—"}
              </span>

              <span style={{ fontSize: 14, color: ot ? "#EA580C" : "var(--text-muted)", fontWeight: ot ? 600 : 400 }}>
                {ot ? `฿${formatCurrency(ot.amount)}` : "—"}
              </span>
            </div>
          );
        })}

        {/* Totals */}
        <div style={{
          display: "grid", gridTemplateColumns: "130px 80px 90px 120px 90px 90px",
          padding: "12px 20px", gap: 12,
          background: "#EFF6FF", borderTop: "2px solid #1E3A8A",
          fontSize: 14, fontWeight: 700, alignItems: "center",
        }}>
          <span style={{ color: "#1E3A8A" }}>รวม · Total</span>
          <span />
          <span style={{ color: "#22C55E", fontSize: 13 }}>{totals.presentDays} วัน</span>
          <span />
          <span style={{ color: "#1E3A8A" }}>฿{formatCurrency(totals.grossWage)}</span>
          <span style={{ color: "#EA580C" }}>฿{formatCurrency(totals.overtimePay)}</span>
        </div>
      </div>

      {/* Net pay summary bar */}
      <div style={{
        background: "#1E3A8A", borderRadius: 14, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
          ค่าแรง ฿{formatCurrency(totals.grossWage)}
          {totals.overtimePay > 0 && <span style={{ color: "#FCD34D" }}> + OT ฿{formatCurrency(totals.overtimePay)}</span>}
          {totals.totalAdvances > 0 && <span style={{ color: "#FCA5A5" }}> − มัดจำ ฿{formatCurrency(totals.totalAdvances)}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>สุทธิ · Net</span>
          <span style={{ color: "#4ADE80", fontSize: 26, fontWeight: 700 }}>฿{formatCurrency(totals.netPay)}</span>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="mobile-only" style={{ marginTop: 16 }}>
        {days.map((d) => {
          const att = attMap.get(d);
          const ot  = otMap.get(d);
          const date = thaiDate(d);
          const st   = att ? statusInfo(att) : null;
          if (!att && !ot) return (
            <div key={d} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-muted)" }}>
              <span>{date.short} {date.dow}</span><span>—</span>
            </div>
          );
          return (
            <div key={d} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 44, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{date.short.split(" ")[0]}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{date.dow}</div>
              </div>
              <div style={{ flex: 1 }}>
                {st && <span style={{ fontSize: 12, background: st.bg, color: st.color, padding: "2px 7px", borderRadius: 5, fontWeight: 600 }}>{st.labelTh}</span>}
                {att?.arrival_time && <span style={{ fontSize: 13, marginLeft: 6, color: "var(--text-muted)" }}>{formatTime(att.arrival_time)}</span>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{att?.wage_amount ? `฿${formatCurrency(att.wage_amount)}` : "—"}</div>
                {ot && <div style={{ fontSize: 12, color: "#EA580C" }}>+OT ฿{formatCurrency(ot.amount)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
