"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Users, Clock, CheckCircle, TrendingUp,
  ArrowRightLeft, Zap, Receipt, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency, formatThaiDate, formatEnDate, formatTime } from "@/lib/format";
import { HalfDayModal } from "@/components/ui/HalfDayModal";
import type { DailyReportData, SiteReportData, WorkerReportRow } from "@/lib/daily-report";

type HalfDayTarget = {
  attendanceId: string;
  workerNameTh: string;
  workerNameEn: string;
  currentWage: number;
  dailyWage: number;
};

interface Props {
  report: DailyReportData;
  today: string;
}

export function DailyReportClient({ report, today }: Props) {
  const router = useRouter();
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [halfDayTarget, setHalfDayTarget] = useState<HalfDayTarget | null>(null);

  function toggleSite(id: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDateChange(d: string) {
    router.push(`/reports/daily?date=${d}`);
  }

  const { totals, sites, expenseCategories, corrections, blockReasons, isBlocked, date } = report;
  const receiptClosing = report.receiptClosing;

  // ── Right panel ──────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>สรุปรวม <span>Totals</span></h2>
        {[
          { labelTh: "ค่าแรงรวม", labelEn: "Total labor", value: `฿${formatCurrency(totals.totalLaborCost)}`, color: "var(--text-primary)" },
          { labelTh: "ค่าใช้จ่ายอื่น", labelEn: "Other expenses", value: `฿${formatCurrency(totals.totalReceiptAmount)}`, color: "var(--text-primary)" },
          { labelTh: "รวมทั้งหมด", labelEn: "Grand total", value: `฿${formatCurrency(totals.totalExpenses)}`, color: "#1E3A8A", bold: true },
        ].map(({ labelTh, labelEn, value, color, bold }) => (
          <div key={labelTh} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>{labelTh}<br /><small>{labelEn}</small></span>
            <strong style={{ color, fontSize: bold ? 17 : 15 }}>{value}</strong>
          </div>
        ))}
      </section>

      {receiptClosing && (
        <section className="attention-card">
          <h2>Receipt closing <span>Cash close</span></h2>
          {[
            { label: "Approved receipts", value: `${receiptClosing.approvedCount} · ฿${formatCurrency(receiptClosing.approvedTotal)}` },
            { label: "Pending with amount", value: `${receiptClosing.pendingWithAmountCount} · ฿${formatCurrency(receiptClosing.pendingWithAmountTotal)}` },
            { label: "Pending without amount", value: receiptClosing.pendingWithoutAmountCount },
            { label: "Driver cash used", value: `฿${formatCurrency(receiptClosing.driverCashUsed)}` },
            { label: "Potential total", value: `฿${formatCurrency(totals.potentialTotalExpenses)}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <strong style={{ color: label === "Potential total" ? "#F97316" : "var(--text-primary)" }}>{value}</strong>
            </div>
          ))}
        </section>
      )}

      {expenseCategories.length > 0 && (
        <section className="attention-card">
          <h2>หมวดค่าใช้จ่าย <span>Expense categories</span></h2>
          {expenseCategories.slice(0, 5).map((cat, i) => (
            <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#EF4444" : i === 1 ? "#F97316" : "#F59E0B",
                color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cat.nameTh}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Score {cat.severityScore.toFixed(1)}</div>
              </div>
              <strong style={{ fontSize: 14 }}>฿{formatCurrency(cat.amount)}</strong>
            </div>
          ))}
        </section>
      )}

      {corrections.length > 0 && (
        <section className="attention-card">
          <h2 style={{ color: "#6C5CE7" }}>🔧 ติดตามการแก้ไข <span>Corrections today</span></h2>
          {corrections.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #EDE9FE", fontSize: 13 }}>
              <div style={{ color: "#6C5CE7", fontWeight: 600 }}>{c.entityType} · {c.fieldName}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                <span style={{ textDecoration: "line-through" }}>{c.originalValue ?? "-"}</span>
                {" → "}
                <span style={{ color: "#6C5CE7", fontWeight: 600 }}>{c.correctedValue ?? "-"}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.reason}</div>
            </div>
          ))}
        </section>
      )}
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
            รายงาน · Report
          </div>
          <h1 style={{ fontSize: 31, fontWeight: 700, color: "#1E3A8A", marginBottom: 4, lineHeight: 1.1 }}>รายงานประจำวัน</h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 600 }}>{formatThaiDate(date)}</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Daily Report · {formatEnDate(date)}</p>
        </div>
        <input
          type="date"
          value={date}
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

      {/* Block warning */}
      {isBlocked && (
        <div style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <AlertTriangle size={22} color="#B91C1C" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#B91C1C" }}>รายงานถูกบล็อก · Report blocked</div>
            <div style={{ fontSize: 13, color: "#DC2626", marginTop: 4 }}>
              {blockReasons.map((r, i) => <div key={i}>• {r.messageTh}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="metric-card blue" style={{ borderTop: "3px solid #1E3A8A" }}>
          <div className="metric-icon blue"><Users size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>มาทำงาน</strong><small>Present</small></div>
          <div className="metric-value" style={{ color: "#1E3A8A" }}>{totals.totalPresent}</div>
        </div>
        <div className="metric-card orange" style={{ borderTop: "3px solid #F97316" }}>
          <div className="metric-icon orange"><Clock size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>มาสาย</strong><small>Late</small></div>
          <div className="metric-value" style={{ color: "#F97316" }}>{totals.totalLate}</div>
        </div>
        <div className="metric-card green" style={{ borderTop: "3px solid #22C55E" }}>
          <div className="metric-icon green"><ArrowRightLeft size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>ย้ายไซต์</strong><small>Transfers</small></div>
          <div className="metric-value">{totals.totalTransfers}</div>
        </div>
        <div className="metric-card teal" style={{ borderTop: "3px solid #06B6D4" }}>
          <div className="metric-icon teal"><TrendingUp size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>ค่าแรงรวม</strong><small>Labor cost</small></div>
          <div className="metric-value" style={{ fontSize: 18 }}>฿{formatCurrency(totals.totalLaborCost)}</div>
        </div>
      </div>

      {/* Per-site sections */}
      {sites.filter((s) => s.presentCount > 0 || s.receipts.length > 0).map((site) => (
        <SiteReportCard
          key={site.siteId}
          site={site}
          expanded={expandedSites.has(site.siteId)}
          onToggle={() => toggleSite(site.siteId)}
          onHalfDay={setHalfDayTarget}
        />
      ))}

      {/* Sites with no activity */}
      {sites.filter((s) => s.presentCount === 0 && s.receipts.length === 0).length > 0 && (
        <div style={{ marginTop: 8, padding: "10px 16px", background: "var(--surface)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>
          ไซต์ที่ไม่มีกิจกรรม · No activity:{" "}
          {sites.filter((s) => s.presentCount === 0 && s.receipts.length === 0).map((s) => s.siteNameTh).join(", ")}
        </div>
      )}

      {/* Half-day modal */}
      {halfDayTarget && (
        <HalfDayModal
          {...halfDayTarget}
          onSuccess={() => { setHalfDayTarget(null); router.refresh(); }}
          onClose={() => setHalfDayTarget(null)}
        />
      )}

      {/* Mobile totals */}
      <div className="mobile-only" style={{ marginTop: 20, padding: 16, background: "white", borderRadius: 14, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>สรุปรวม · Grand Total</div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
          <span style={{ color: "var(--text-muted)" }}>ค่าแรง · Labor</span>
          <strong>฿{formatCurrency(totals.totalLaborCost)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14 }}>
          <span style={{ color: "var(--text-muted)" }}>รวมทั้งหมด · Total</span>
          <strong style={{ fontSize: 18, color: "#1E3A8A" }}>฿{formatCurrency(totals.totalExpenses)}</strong>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Site report card ──────────────────────────────────────────────────────────

function SiteReportCard({
  site, expanded, onToggle, onHalfDay,
}: {
  site: SiteReportData;
  expanded: boolean;
  onToggle: () => void;
  onHalfDay: (target: HalfDayTarget) => void;
}) {
  return (
    <div style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      {/* Site header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          background: "white", cursor: "pointer", userSelect: "none",
        }}
        onClick={onToggle}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{site.siteNameTh}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{site.siteNameEn}</div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Stat icon={<Users size={14} />} value={site.presentCount} color="#3B82F6" />
          {site.lateCount > 0 && <Stat icon={<Clock size={14} />} value={site.lateCount} color="#F97316" />}
          {site.transferOutCount > 0 && <Stat icon={<ArrowRightLeft size={14} />} value={site.transferOutCount} color="#06B6D4" />}
          {site.overtimeCost > 0 && <Stat icon={<Zap size={14} />} value={`฿${formatCurrency(site.overtimeCost)}`} color="#EA580C" />}
        </div>

        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>฿{formatCurrency(site.totalLaborCost)}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>ค่าแรงรวม · Labor</div>
        </div>

        {expanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", background: "#FAFAFA" }}>
          {/* Workers table */}
          {site.workers.length > 0 && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                พนักงาน · Workers
              </div>
              <div className="table-card" style={{ margin: 0 }}>
                <div className="table-header" style={{ gridTemplateColumns: "2fr 80px 90px 90px 90px 70px" }}>
                  <span>ชื่อ <small>Name</small></span>
                  <span>เวลา <small>Time</small></span>
                  <span>สถานะ <small>Status</small></span>
                  <span>ค่าแรง <small>Wage</small></span>
                  <span>หมายเหตุ <small>Note</small></span>
                  <span></span>
                </div>
                {site.workers.map((w) => (
                  <div key={w.workerId} className="table-row" style={{ gridTemplateColumns: "2fr 80px 90px 90px 90px 70px", display: "grid", padding: "10px 16px", gap: 8, alignItems: "center" }}>
                    <span className="cell-th" style={{ fontSize: 14 }}>{w.nameTh}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{w.arrivalTime ? formatTime(w.arrivalTime) : "-"}</span>
                    <span>
                      <WorkerStatusBadge status={w.status} isLate={w.isLate} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      ฿{formatCurrency(w.wageAmount)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {w.isTransfer && w.transferToSiteName && (
                        <span style={{ color: "#06B6D4" }}>→ {w.transferToSiteName}</span>
                      )}
                      {w.isTransfer && w.transferFromSiteName && (
                        <span style={{ color: "#06B6D4" }}>← {w.transferFromSiteName}</span>
                      )}
                    </span>
                    <span>
                      {w.status === "present" && (
                        <button
                          onClick={() => onHalfDay({
                            attendanceId: w.attendanceId,
                            workerNameTh: w.nameTh,
                            workerNameEn: w.nameEn,
                            currentWage: w.wageAmount,
                            dailyWage: w.dailyWage,
                          })}
                          style={{
                            padding: "4px 8px", fontSize: 11, fontWeight: 600,
                            background: "#FFF7ED", border: "1px solid #FED7AA",
                            borderRadius: 6, color: "#D97706", cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ครึ่งวัน
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--border)", margin: "0 16px 12px" }}>
            {[
              { labelTh: "ค่าแรงตรง", labelEn: "Direct labor", value: site.laborCost },
              { labelTh: "เข้าไซต์", labelEn: "Transfer in", value: site.transferCostIn },
              { labelTh: "ล่วงเวลา", labelEn: "Overtime", value: site.overtimeCost },
            ].map(({ labelTh, labelEn, value }) => (
              <div key={labelTh} style={{ background: "white", padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>฿{formatCurrency(value)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{labelTh}<br />{labelEn}</div>
              </div>
            ))}
          </div>

          {/* Receipts */}
          {site.receipts.length > 0 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Receipt size={14} /> ใบเสร็จ · Receipts
              </div>
              {site.receipts.map((r) => (
                <div key={r.receiptId} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span>{r.supplierNameTh ?? "ไม่ระบุ · Unknown"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.paidFromDriverCash && (
                      <span style={{ fontSize: 10, background: "#FFF7ED", color: "#EA580C", borderRadius: 4, padding: "1px 5px" }}>Cash</span>
                    )}
                    <strong>฿{formatCurrency(r.amount)}</strong>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 6 }}>
                <strong style={{ fontSize: 14 }}>รวม ฿{formatCurrency(site.receiptTotal)}</strong>
              </div>
            </div>
          )}

          {/* Overtime rows */}
          {site.overtimeRows.length > 0 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#EA580C", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={14} /> ล่วงเวลา · Overtime
              </div>
              {site.overtimeRows.map((o) => (
                <div key={o.workerId} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span>{o.workerNameTh} · {o.overtimeHours}h</span>
                  <strong>฿{formatCurrency(o.amount)}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Site total */}
          <div style={{ padding: "10px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>รวมทั้งหมดของไซต์ · Site total</span>
            <strong style={{ fontSize: 18, color: "#1E3A8A" }}>฿{formatCurrency(site.totalSiteCost)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, color }: { icon: React.ReactNode; value: string | number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, color }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function WorkerStatusBadge({ status, isLate }: { status: string; isLate: boolean }) {
  if (status === "missing") return <span style={{ fontSize: 11, background: "#FEF2F2", color: "#B91C1C", padding: "2px 6px", borderRadius: 4 }}>ขาด · Missing</span>;
  if (status === "day_off") return <span style={{ fontSize: 11, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 6px", borderRadius: 4 }}>หยุด · Day off</span>;
  if (isLate) return <span style={{ fontSize: 11, background: "#FFF7ED", color: "#C2410C", padding: "2px 6px", borderRadius: 4 }}>สาย · Late</span>;
  return <span style={{ fontSize: 11, background: "#F0FDF4", color: "#15803D", padding: "2px 6px", borderRadius: 4 }}>ปกติ · OK</span>;
}
