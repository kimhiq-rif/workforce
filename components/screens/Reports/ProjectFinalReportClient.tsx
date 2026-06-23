"use client";
// Copyright © 2026 Workforce. All rights reserved.
// On-screen Project Final Report — summary + PDF download + live presentation.
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Building2, Presentation } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ProjectFinalReportData } from "@/lib/project-final-report";
import { ProjectFinalPresent } from "@/components/screens/Reports/ProjectFinalPresent";

const C = {
  violet: "#6C5CE7",
  primary: "#1E3A8A",
  accent: "#FF6A00",
  live: "#06B6D4",
  success: "#22C55E",
  blue: "#3B82F6",
};

function Kpi({ label, sub, value, color }: { label: string; sub: string; value: string; color: string }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--border)", borderLeft: `4px solid ${color}`, borderRadius: 10, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginTop: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>{title}</h2>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{sub}</div>}
      {children}
    </section>
  );
}

export function ProjectFinalReportClient({ report }: { report: ProjectFinalReportData }) {
  const { site, period, totals, exceptions, stages, workers, suppliers } = report;
  const [presenting, setPresenting] = useState(false);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 16px 60px" }}>
      {presenting && <ProjectFinalPresent report={report} onClose={() => setPresenting(false)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <Link href="/reports" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14, textDecoration: "none" }}>
          <ArrowLeft size={16} /> รายงาน · Reports
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPresenting(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", color: C.violet, border: `1px solid ${C.violet}`, fontSize: 14, fontWeight: 700, padding: "9px 16px", borderRadius: 10, cursor: "pointer" }}
          >
            <Presentation size={16} /> นำเสนอ · Present
          </button>
          <a
            href={`/api/reports/project-final/${site.id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.violet, color: "white", fontSize: 14, fontWeight: 700, padding: "9px 16px", borderRadius: 10, textDecoration: "none" }}
          >
            <Download size={16} /> ดาวน์โหลด PDF
          </a>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ background: "#F2F4FF", borderRadius: 10, padding: 8 }}>
          <Building2 size={22} color={C.violet} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{site.nameTh}</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {site.nameEn} · {period.start} → {period.end} · {period.durationDays} วัน · {site.projectType === "long" ? "Long" : "Short"}
          </div>
        </div>
      </div>
      {site.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0" }}>{site.description}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 16 }}>
        <Kpi label="ต้นทุนรวม" sub="Total cost" value={`฿${formatCurrency(totals.totalCost)}`} color={C.violet} />
        <Kpi label="ค่าแรง" sub="Labor" value={`฿${formatCurrency(totals.laborCost)}`} color={C.primary} />
        <Kpi label="ใบเสร็จ" sub="Receipts" value={`฿${formatCurrency(totals.receiptCost)}`} color={C.accent} />
        <Kpi label="ล่วงเวลา" sub="Overtime" value={`฿${formatCurrency(totals.overtimeCost)}`} color={C.live} />
        <Kpi label="วันทำงาน" sub="Worker-days" value={String(totals.workerDays)} color={C.success} />
        <Kpi label="คนงาน" sub="Workers" value={String(totals.uniqueWorkers)} color={C.blue} />
      </div>

      {stages.length > 0 && (
        <Section title="ขั้นตอน · Stages" sub={`${stages.length} stages`}>
          {stages.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.nameEn || s.nameTh}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.periodFrom} → {s.periodTo} · {s.workDays}d</span>
              <span style={{ fontSize: 14, fontWeight: 700, width: 110, textAlign: "right" }}>฿{formatCurrency(s.totalCost)}</span>
            </div>
          ))}
        </Section>
      )}

      {workers.length > 0 && (
        <Section title="คนงาน · Workers" sub="By total cost">
          {workers.slice(0, 15).map((w) => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{w.nameEn || w.nameTh}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{w.days}d · OT ฿{formatCurrency(w.overtimeCost)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, width: 110, textAlign: "right" }}>฿{formatCurrency(w.totalCost)}</span>
            </div>
          ))}
        </Section>
      )}

      {suppliers.length > 0 && (
        <Section title="ผู้ขาย · Suppliers" sub="By receipt total">
          {suppliers.slice(0, 12).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.nameEn || s.nameTh}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.count} receipts</span>
              <span style={{ fontSize: 14, fontWeight: 700, width: 110, textAlign: "right" }}>฿{formatCurrency(s.receiptCost)}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title="ข้อยกเว้น · Exceptions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
          {[
            { l: "สาย · Late", v: exceptions.lateCount, c: exceptions.lateCount > 0 ? C.accent : undefined },
            { l: "ครึ่งวัน · Half", v: exceptions.halfDayCount },
            { l: "ขาด · Missing", v: exceptions.missingCount, c: exceptions.missingCount > 0 ? "#DC2626" : undefined },
            { l: "แก้ไข · Corrections", v: exceptions.correctionCount },
            { l: "ใบเสร็จ · Receipt", v: exceptions.receiptIssueCount, c: exceptions.receiptIssueCount > 0 ? C.accent : undefined },
            { l: "GPS", v: exceptions.gpsIssueCount },
          ].map((x) => (
            <div key={x.l} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{x.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: x.c ?? "var(--text-primary)" }}>{x.v}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
