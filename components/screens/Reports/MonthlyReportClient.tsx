"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ChevronLeft, ChevronRight, TrendingUp, Users, FileText, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { MonthlySuppliersSection } from "@/components/screens/Reports/MonthlySuppliersSection";
import { MonthlyNeedsAttention, type OverdueProject, type CashDifference } from "@/components/screens/Reports/MonthlyNeedsAttention";
import { MonthlyDriverCash } from "@/components/screens/Reports/MonthlyDriverCash";
import { MonthlyStageTransitions } from "@/components/screens/Reports/MonthlyStageTransitions";

interface Props {
  sites: { id: string; name_th: string; name_en: string; status: string }[];
  attendance: { site_id: string; worker_id: string; event_date: string; wage_amount: number | null; status: string; is_late: boolean }[];
  receipts: { site_id: string | null; supplier_id: string | null; amount: number | null; status: string; supplier: { name_th: string; name_en: string } | null }[];
  overdueProjects: OverdueProject[];
  driverCash: { driverId: string; amount: number | null; driver: { name_th: string; name_en: string } | null }[];
  stageTransitions: { siteName: string; stageName: string; color: string; date: string }[];
  cashDifferences: CashDifference[];
  editedCount: number;
  overtimeMissingCost: number;
  workers: { id: string; name_th: string; name_en: string; assigned_site_id: string | null; daily_wage: number }[];
  targetMonth: string;
  monthStart: string;
  monthEnd: string;
  today: string;
}

// Format "2026-06" → "มิถุนายน 2026 · June 2026"
function formatMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  const th = d.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const en = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  return `${th} · ${en}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).slice(0, 7);
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).slice(0, 7);
}

export function MonthlyReportClient({
  sites, attendance, receipts, overdueProjects, driverCash, stageTransitions,
  cashDifferences, editedCount, overtimeMissingCost, workers, targetMonth, monthStart, monthEnd, today,
}: Props) {
  const router = useRouter();
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const isCurrentMonth = targetMonth === today.slice(0, 7);
  const isFutureMonth = targetMonth > today.slice(0, 7);

  // Per-site aggregation
  const siteData = useMemo(() => {
    return sites.map((site) => {
      const siteAtt = attendance.filter((a) => a.site_id === site.id);
      const siteRec = receipts.filter((r) => r.site_id === site.id);

      const workerIds = new Set(siteAtt.map((a) => a.worker_id));
      const workDays = siteAtt.filter((a) => !["missing", "day_off"].includes(a.status));
      const fullDays = workDays.filter((a) => a.status !== "half_day_am" && a.status !== "half_day_pm").length;
      const halfDays = workDays.filter((a) => a.status === "half_day_am" || a.status === "half_day_pm").length;
      const lateDays = siteAtt.filter((a) => a.is_late).length;
      const totalWage = siteAtt.reduce((s, a) => s + (a.wage_amount ?? 0), 0);
      const totalReceipts = siteRec.reduce((s, r) => s + (r.amount ?? 0), 0);

      // Unique dates with any attendance
      const workingDates = new Set(siteAtt.map((a) => a.event_date));

      return {
        ...site,
        workerCount: workerIds.size,
        workingDays: workingDates.size,
        fullDays,
        halfDays,
        lateDays,
        totalWage,
        totalReceipts,
        totalCost: totalWage + totalReceipts,
      };
    }).sort((a, b) => b.totalCost - a.totalCost); // severity-first: highest cost first
  }, [sites, attendance, receipts]);

  // Business totals
  const totals = useMemo(() => ({
    totalWage: siteData.reduce((s, d) => s + d.totalWage, 0),
    totalReceipts: siteData.reduce((s, d) => s + d.totalReceipts, 0),
    totalCost: siteData.reduce((s, d) => s + d.totalCost, 0),
    totalWorkers: new Set(attendance.map((a) => a.worker_id)).size,
    totalFullDays: siteData.reduce((s, d) => s + d.fullDays, 0),
    totalHalfDays: siteData.reduce((s, d) => s + d.halfDays, 0),
    totalLate: siteData.reduce((s, d) => s + d.lateDays, 0),
  }), [siteData, attendance]);

  const selected = selectedSite ? siteData.find((s) => s.id === selectedSite) : null;

  // Workers at selected site
  const siteWorkers = useMemo(() => {
    if (!selectedSite) return [];
    const siteAtt = attendance.filter((a) => a.site_id === selectedSite);
    const workerMap = new Map<string, { nameTh: string; nameEn: string; workDays: number; halfDays: number; lateDays: number; totalWage: number }>();
    siteAtt.forEach((a) => {
      const w = workers.find((wk) => wk.id === a.worker_id);
      if (!w) return;
      const existing = workerMap.get(a.worker_id) ?? {
        nameTh: w.name_th, nameEn: w.name_en, workDays: 0, halfDays: 0, lateDays: 0, totalWage: 0,
      };
      const isWork = !["missing", "day_off"].includes(a.status);
      if (isWork) existing.workDays++;
      if (a.status === "half_day_am" || a.status === "half_day_pm") existing.halfDays++;
      if (a.is_late) existing.lateDays++;
      existing.totalWage += a.wage_amount ?? 0;
      workerMap.set(a.worker_id, existing);
    });
    return Array.from(workerMap.values()).sort((a, b) => b.totalWage - a.totalWage);
  }, [selectedSite, attendance, workers]);

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section style={{ background: "#1E3A8A", borderRadius: 14, padding: "18px 16px" }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 2 }}>ค่าใช้จ่ายรวมเดือน</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 14 }}>
          Total monthly cost · {monthStart} → {monthEnd}
        </div>
        <div style={{ color: "#22C55E", fontSize: 32, fontWeight: 700, marginBottom: 14 }}>
          ฿{formatCurrency(totals.totalCost)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { l: "ค่าแรง", v: `฿${formatCurrency(totals.totalWage)}`, c: "rgba(255,255,255,0.9)" },
            { l: "ใบเสร็จ", v: `฿${formatCurrency(totals.totalReceipts)}`, c: "#FCD34D" },
            { l: "พนักงาน", v: String(totals.totalWorkers), c: "rgba(255,255,255,0.9)" },
            { l: "สาย", v: String(totals.totalLate), c: "#FCA5A5" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="attention-card">
        <h2>รายงานอื่น <span>Other reports</span></h2>
        <Link href="/reports" className="attention-row">
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{ flex: 1 }}>
            <strong style={{ fontSize: 14 }}>รายงานประจำวัน</strong>
            <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>Daily reports</small>
          </span>
          <ChevronRight size={16} color="var(--text-muted)" />
        </Link>
        <Link href="/reports/halfmonth" className="attention-row">
          <span style={{ fontSize: 20 }}>💰</span>
          <span style={{ flex: 1 }}>
            <strong style={{ fontSize: 14 }}>เงินเดือนครึ่งเดือน</strong>
            <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>Half-month payroll</small>
          </span>
          <ChevronRight size={16} color="var(--text-muted)" />
        </Link>
      </section>
    </>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      {/* Desktop */}
      <div className="desktop-only">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <Link
              href="/reports"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 6 }}
            >
              <ChevronLeft size={16} /> กลับ · Back to Reports
            </Link>
            <h1 style={{ fontSize: 31, fontWeight: 700, marginBottom: 4 }}>รายงานประจำเดือน</h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 600 }}>
              {formatMonth(targetMonth)}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Monthly report · {monthStart} → {monthEnd}
              {isCurrentMonth && (
                <span style={{ marginLeft: 8, background: "#ECFEFF", color: "#06B6D4", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                  เดือนนี้ · Current
                </span>
              )}
            </p>
          </div>

          {/* Month navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => router.push(`/reports/monthly?month=${prevMonth(targetMonth)}`)}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 90, textAlign: "center" }}>
              {targetMonth}
            </span>
            <button
              onClick={() => router.push(`/reports/monthly?month=${nextMonth(targetMonth)}`)}
              disabled={isFutureMonth}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "white", cursor: isFutureMonth ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isFutureMonth ? 0.4 : 1 }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Needs attention */}
        <MonthlyNeedsAttention overdueProjects={overdueProjects} receipts={receipts} cashDifferences={cashDifferences} editedCount={editedCount} overtimeMissingCost={overtimeMissingCost} />

        {/* Summary metrics */}
        <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
          <div className="metric-card blue">
            <div className="metric-icon blue"><TrendingUp size={28} strokeWidth={1.8} /></div>
            <div className="metric-label"><strong>ค่าใช้จ่ายรวม</strong><small>Total cost</small></div>
            <div className="metric-value" style={{ fontSize: 17 }}>฿{formatCurrency(totals.totalCost)}</div>
          </div>
          <div className="metric-card green">
            <div className="metric-icon green"><Users size={28} strokeWidth={1.8} /></div>
            <div className="metric-label"><strong>ค่าแรงรวม</strong><small>Total wages</small></div>
            <div className="metric-value" style={{ fontSize: 17 }}>฿{formatCurrency(totals.totalWage)}</div>
          </div>
          <div className="metric-card orange">
            <div className="metric-icon orange"><FileText size={28} strokeWidth={1.8} /></div>
            <div className="metric-label"><strong>ใบเสร็จรวม</strong><small>Total receipts</small></div>
            <div className="metric-value" style={{ fontSize: 17 }}>฿{formatCurrency(totals.totalReceipts)}</div>
          </div>
          <div className="metric-card teal">
            <div className="metric-icon teal"><AlertTriangle size={28} strokeWidth={1.8} /></div>
            <div className="metric-label"><strong>สายรวม</strong><small>Total late</small></div>
            <div className="metric-value" style={{ color: "#F97316" }}>{totals.totalLate}</div>
          </div>
        </div>

        {/* Site breakdown table */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 14 }}>
            สรุปรายไซต์
            <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>
              Site breakdown · เรียงตามค่าใช้จ่ายมากสุดก่อน (Severity-first)
            </span>
          </h2>
          <div className="table-card">
            <div className="table-header" style={{ gridTemplateColumns: "2fr 80px 110px 110px 110px 110px" }}>
              <span>ไซต์ <small>Site</small></span>
              <span>คน <small>Workers</small></span>
              <span>วันทำงาน <small>Work days</small></span>
              <span>ค่าแรง <small>Wages</small></span>
              <span>ใบเสร็จ <small>Receipts</small></span>
              <span>รวม <small>Total</small></span>
            </div>

            {siteData.length === 0 ? (
              <div style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                ไม่มีข้อมูลในเดือนนี้ · No data for this month
              </div>
            ) : (
              siteData.map((site) => (
                <div
                  key={site.id}
                  onClick={() => setSelectedSite(site.id === selectedSite ? null : site.id)}
                  className="table-row"
                  style={{
                    gridTemplateColumns: "2fr 80px 110px 110px 110px 110px",
                    display: "grid",
                    padding: "13px 20px",
                    gap: 12,
                    cursor: "pointer",
                    background: selectedSite === site.id ? "#F0F9FF" : undefined,
                    borderLeft: selectedSite === site.id ? "3px solid var(--brand-primary)" : "3px solid transparent",
                  }}
                >
                  <span>
                    <span className="cell-th">{site.name_th}</span>
                    <span className="cell-en">{site.name_en}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{site.workerCount}</span>
                  <span>
                    <strong style={{ fontSize: 15 }}>{site.workingDays}</strong>
                    <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                      เต็ม {site.fullDays} · ½ {site.halfDays}
                    </small>
                  </span>
                  <span>
                    <strong style={{ fontSize: 15 }}>฿{formatCurrency(site.totalWage)}</strong>
                  </span>
                  <span>
                    <strong style={{ fontSize: 15 }}>฿{formatCurrency(site.totalReceipts)}</strong>
                  </span>
                  <span>
                    <strong style={{ fontSize: 16, color: "var(--brand-primary)" }}>
                      ฿{formatCurrency(site.totalCost)}
                    </strong>
                  </span>
                </div>
              ))
            )}

            {/* Totals row */}
            {siteData.length > 0 && (
              <div
                style={{
                  gridTemplateColumns: "2fr 80px 110px 110px 110px 110px",
                  display: "grid",
                  padding: "13px 20px",
                  gap: 12,
                  background: "#F8FAFF",
                  borderTop: "2px solid var(--brand-primary)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>รวมทั้งหมด · Total</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{totals.totalWorkers}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {totals.totalFullDays + totals.totalHalfDays}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>฿{formatCurrency(totals.totalWage)}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>฿{formatCurrency(totals.totalReceipts)}</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: "var(--brand-primary)" }}>
                  ฿{formatCurrency(totals.totalCost)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Worker breakdown for selected site */}
        {selected && siteWorkers.length > 0 && (
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 14 }}>
              พนักงานไซต์ {selected.name_th}
              <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>
                Worker breakdown · {selected.name_en}
              </span>
            </h2>
            <div className="table-card">
              <div className="table-header" style={{ gridTemplateColumns: "2fr 80px 80px 80px 120px" }}>
                <span>พนักงาน <small>Worker</small></span>
                <span>วันทำงาน <small>Work days</small></span>
                <span>ครึ่งวัน <small>Half days</small></span>
                <span>สาย <small>Late</small></span>
                <span>ค่าแรงรวม <small>Total wage</small></span>
              </div>
              {siteWorkers.map((w) => (
                <div
                  key={w.nameTh}
                  className="table-row"
                  style={{ gridTemplateColumns: "2fr 80px 80px 80px 120px", display: "grid", padding: "12px 20px", gap: 12 }}
                >
                  <span>
                    <span className="cell-th">{w.nameTh}</span>
                    <span className="cell-en">{w.nameEn}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{w.workDays}</span>
                  <span style={{ fontSize: 15, color: w.halfDays > 0 ? "#F59E0B" : "var(--text-muted)" }}>{w.halfDays}</span>
                  <span style={{ fontSize: 15, color: w.lateDays > 0 ? "#F97316" : "var(--text-muted)" }}>{w.lateDays}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>฿{formatCurrency(w.totalWage)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suppliers section */}
        <MonthlySuppliersSection receipts={receipts} sites={sites} />

        {/* Driver cash */}
        <MonthlyDriverCash entries={driverCash} />

        {/* Stage transitions */}
        <MonthlyStageTransitions transitions={stageTransitions} />
      </div>

      {/* Mobile */}
      <div className="mobile-only">
        <MobileMonthly
          targetMonth={targetMonth}
          siteData={siteData}
          totals={totals}
          monthStart={monthStart}
          monthEnd={monthEnd}
          isCurrentMonth={isCurrentMonth}
          isFutureMonth={isFutureMonth}
          receipts={receipts}
          sites={sites}
          overdueProjects={overdueProjects}
          driverCash={driverCash}
          stageTransitions={stageTransitions}
          cashDifferences={cashDifferences}
          editedCount={editedCount}
          overtimeMissingCost={overtimeMissingCost}
          onPrev={() => router.push(`/reports/monthly?month=${prevMonth(targetMonth)}`)}
          onNext={() => router.push(`/reports/monthly?month=${nextMonth(targetMonth)}`)}
        />
      </div>
    </DashboardShell>
  );
}

function MobileMonthly({ targetMonth, siteData, totals, monthStart, monthEnd, isCurrentMonth, isFutureMonth, receipts, sites, overdueProjects, driverCash, stageTransitions, cashDifferences, editedCount, overtimeMissingCost, onPrev, onNext }: any) {
  return (
    <div>
      <div className="mobile-topbar">
        <Link href="/reports" className="mobile-topbar-back">
          <ChevronLeft size={24} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white", fontSize: 18 }}>รายงานประจำเดือน</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Monthly report · {targetMonth}</p>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Month navigator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
          <button onClick={onPrev} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{targetMonth}</div>
            {isCurrentMonth && (
              <div style={{ fontSize: 11, color: "#06B6D4", fontWeight: 600 }}>เดือนนี้ · Current</div>
            )}
          </div>
          <button onClick={onNext} disabled={isFutureMonth} style={{ background: "none", border: "none", cursor: isFutureMonth ? "not-allowed" : "pointer", padding: 4, opacity: isFutureMonth ? 0.4 : 1 }}>
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Needs attention */}
        <MonthlyNeedsAttention overdueProjects={overdueProjects} receipts={receipts} cashDifferences={cashDifferences} editedCount={editedCount} overtimeMissingCost={overtimeMissingCost} />

        {/* Summary card */}
        <div style={{ background: "#1E3A8A", borderRadius: 14, padding: "16px" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 6 }}>
            ค่าใช้จ่ายรวมเดือน · Total monthly cost
          </div>
          <div style={{ color: "#22C55E", fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            ฿{formatCurrency(totals.totalCost)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "ค่าแรง", v: `฿${formatCurrency(totals.totalWage)}` },
              { l: "ใบเสร็จ", v: `฿${formatCurrency(totals.totalReceipts)}` },
              { l: "พนักงาน", v: `${totals.totalWorkers} คน` },
              { l: "สาย", v: `${totals.totalLate} ครั้ง` },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Site cards */}
        {siteData.map((site: any) => (
          <div key={site.id} style={{ background: "white", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "14px 14px 12px" }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{site.name_th}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{site.name_en}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div><span style={{ color: "var(--text-muted)" }}>พนักงาน · </span><strong>{site.workerCount} คน</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>วันทำงาน · </span><strong>{site.workingDays} วัน</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>ค่าแรง · </span><strong>฿{formatCurrency(site.totalWage)}</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>ใบเสร็จ · </span><strong>฿{formatCurrency(site.totalReceipts)}</strong></div>
              </div>
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "#F8FAFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>รวม · Total</span>
              <strong style={{ fontSize: 18, color: "var(--brand-primary)" }}>฿{formatCurrency(site.totalCost)}</strong>
            </div>
          </div>
        ))}

        {siteData.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            ไม่มีข้อมูลในเดือนนี้ · No data for this month
          </div>
        )}

        <MonthlySuppliersSection receipts={receipts} sites={sites} />

        <MonthlyDriverCash entries={driverCash} />

        <MonthlyStageTransitions transitions={stageTransitions} />
      </div>
    </div>
  );
}
