"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ChevronRight, Check, AlertTriangle, Clock, FileText, Send } from "lucide-react";
import { formatCurrency, formatThaiDate } from "@/lib/format";

interface ReportsClientProps {
  sites: any[];
  attendance: any[];
  receipts: any[];
  dayStatuses: any[];
  today: string;
  ownerId: string;
}

export function ReportsClient({ sites, attendance, receipts, dayStatuses, today, ownerId }: ReportsClientProps) {
  const supabase = createClient();
  const [toast, setToast] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const siteReports = useMemo(() => {
    return sites.map((site) => {
      const siteAtt = attendance.filter((a) => a.site_id === site.id);
      const siteRec = receipts.filter((r) => r.site_id === site.id);
      const dayStatus = dayStatuses.find((d) => d.site_id === site.id);

      const totalWage = siteAtt.reduce((s: number, a: any) => s + (a.wage_amount ?? 0), 0);
      const totalReceipts = siteRec.reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
      const workerCount = siteAtt.length;
      const pendingWageDecision = dayStatus?.wage_decision === "pending";

      let reportStatus: "blocked" | "ready" | "sent" = "ready";
      if (pendingWageDecision) reportStatus = "blocked";

      return { ...site, siteAtt, siteRec, dayStatus, totalWage, totalReceipts, workerCount, pendingWageDecision, reportStatus };
    });
  }, [sites, attendance, receipts, dayStatuses]);

  const blocked = siteReports.filter((r) => r.reportStatus === "blocked");
  const ready = siteReports.filter((r) => r.reportStatus === "ready");

  async function handleSendReport(siteId: string, siteName: string) {
    setSendingId(siteId);
    // In production this would POST to /api/reports to send LINE/email/WhatsApp
    // For now we just mark the site status as "review"
    const { error } = await supabase
      .from("sites")
      .update({ status: "review" })
      .eq("id", siteId);

    setSendingId(null);

    if (!error) {
      showToast(`ส่งรายงาน ${siteName} แล้ว · Report sent`);
    } else {
      showToast("เกิดข้อผิดพลาด · Error sending report");
    }
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>สรุปรายงาน <span>Report summary · {formatThaiDate(today)}</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>ทั้งหมด · Total sites</span>
            <strong>{sites.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>บล็อค · Blocked</span>
            <strong style={{ color: "#EF4444" }}>{blocked.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>พร้อมส่ง · Ready</span>
            <strong style={{ color: "#22C55E" }}>{ready.length}</strong>
          </div>
        </div>
      </section>

      {blocked.length > 0 && (
        <section className="attention-card">
          <h2 style={{ color: "#B91C1C" }}>รายงานบล็อค <span>Blocked reports</span></h2>
          {blocked.map((r) => (
            <Link key={r.id} href={`/sites/${r.id}`} className="attention-row" style={{ color: "#B91C1C" }}>
              <span className="attention-icon red"><AlertTriangle size={18} /></span>
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{r.name_th}</strong>
                <small style={{ fontSize: 11, color: "var(--text-muted)" }}>รอตัดสินค่าแรง · Wage pending</small>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
      )}
    </>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>รายงานประจำวัน</h1>
              <p>Daily reports · {formatThaiDate(today)}</p>
            </div>
          </div>

          {/* Blocked section */}
          {blocked.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, color: "#B91C1C" }}>
                <AlertTriangle size={20} />
                รายงานที่ถูกบล็อค · Blocked
                <span style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 20, padding: "2px 10px", fontSize: 13 }}>{blocked.length}</span>
              </h2>
              <div className="table-card">
                {blocked.map((r) => (
                  <ReportRow key={r.id} report={r} onSend={() => {}} sendingId={sendingId} blocked />
                ))}
              </div>
            </div>
          )}

          {/* Ready section */}
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={20} color="#22C55E" />
              พร้อมส่งรายงาน · Ready to send
              <span style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 20, padding: "2px 10px", fontSize: 13 }}>{ready.length}</span>
            </h2>
            <div className="table-card">
              {ready.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  ไม่มีรายงานพร้อมส่ง · No reports ready
                </div>
              ) : (
                ready.map((r) => (
                  <ReportRow key={r.id} report={r} onSend={handleSendReport} sendingId={sendingId} blocked={false} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileReports
            siteReports={siteReports}
            blocked={blocked}
            ready={ready}
            today={today}
            onSend={handleSendReport}
            sendingId={sendingId}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>
    </>
  );
}

function ReportRow({ report, onSend, sendingId, blocked }: { report: any; onSend: (id: string, name: string) => void; sendingId: string | null; blocked: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 80px 100px 100px 100px 140px",
        padding: "14px 20px",
        gap: 12,
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <strong style={{ fontSize: 15 }}>{report.name_th}</strong>
        <small style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{report.name_en}</small>
        {report.dayStatus?.wage_decision === "pending" && (
          <span style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600 }}>
            รอตัดสินค่าแรง
          </span>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <strong style={{ fontSize: 15 }}>{report.workerCount}</strong>
        <small style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>คน</small>
      </div>

      <div>
        <strong style={{ fontSize: 15 }}>฿{formatCurrency(report.totalWage)}</strong>
        <small style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>ค่าแรง</small>
      </div>

      <div>
        <strong style={{ fontSize: 15 }}>฿{formatCurrency(report.totalReceipts)}</strong>
        <small style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>ใบเสร็จ</small>
      </div>

      <div>
        <strong style={{ fontSize: 16, color: "#111827" }}>
          ฿{formatCurrency(report.totalWage + report.totalReceipts)}
        </strong>
        <small style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>รวม</small>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {blocked ? (
          <Link href={`/sites/${report.id}`} className="btn-primary" style={{ background: "#EF4444", padding: "8px 14px", fontSize: 13, textDecoration: "none" }}>
            <AlertTriangle size={16} />
            แก้ไข
          </Link>
        ) : (
          <button
            onClick={() => onSend(report.id, report.name_th)}
            disabled={sendingId === report.id}
            className="btn-primary"
            style={{ padding: "8px 14px", fontSize: 13 }}
          >
            <Send size={16} />
            {sendingId === report.id ? "กำลังส่ง…" : "ส่งรายงาน"}
          </button>
        )}
      </div>
    </div>
  );
}

function MobileReports({ siteReports, blocked, ready, today, onSend, sendingId }: any) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>รายงาน</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Daily reports · {formatThaiDate(today)}</p>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {blocked.length > 0 && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, color: "#B91C1C" }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{blocked.length} รายงานถูกบล็อค · Blocked</span>
          </div>
        )}

        {siteReports.map((r: any) => (
          <div key={r.id} style={{ background: "white", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "14px 14px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 16 }}>{r.name_th}</strong>
                {r.blocked && <span style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>บล็อค</span>}
              </div>
              <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.name_en}</small>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13 }}>
                <span><strong>{r.workerCount}</strong> คน</span>
                <span>ค่าแรง <strong>฿{formatCurrency(r.totalWage)}</strong></span>
                <span>ใบเสร็จ <strong>฿{formatCurrency(r.totalReceipts)}</strong></span>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              {r.reportStatus === "blocked" ? (
                <Link href={`/sites/${r.id}`} className="btn-primary" style={{ flex: 1, justifyContent: "center", background: "#EF4444", textDecoration: "none", padding: "8px" }}>
                  <AlertTriangle size={16} /> แก้ไขก่อน
                </Link>
              ) : (
                <button
                  onClick={() => onSend(r.id, r.name_th)}
                  disabled={sendingId === r.id}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center", padding: "8px" }}
                >
                  <Send size={16} />
                  {sendingId === r.id ? "กำลังส่ง…" : "ส่งรายงาน"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
