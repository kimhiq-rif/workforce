"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  FileDown,
  FileText,
  Layers,
  Lock,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/format";
import type { AnnualReportData, AnnualReportMetric, AnnualReportRankedItem } from "@/lib/annual-report";

type Props = {
  report: AnnualReportData;
};

function money(value: number) {
  return `THB ${formatCurrency(value)}`;
}

function metricValue(metric: AnnualReportMetric) {
  if (metric.unit === "thb") return money(metric.value);
  if (metric.unit === "days") return `${metric.value.toLocaleString()} days`;
  return metric.value.toLocaleString();
}

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function AnnualReportClient({ report }: Props) {
  const router = useRouter();
  const { period, totals } = report;

  const periodQuery = `mode=${period.mode}&year=${period.year}${period.mode === "half-year" ? `&half=${period.half}` : ""}`;
  const [freezing, setFreezing] = useState(false);
  const [freezeMsg, setFreezeMsg] = useState("");

  async function freezeReport() {
    setFreezeMsg("");
    setFreezing(true);
    try {
      const res = await fetch(`/api/reports/annual?${periodQuery}`, { method: "POST" });
      const json = await res.json();
      setFreezeMsg(res.ok ? `✓ บันทึกถาวรแล้ว · Frozen: ${json.frozen}` : `⚠ ${json.error || "Error"}`);
    } catch {
      setFreezeMsg("⚠ Network error");
    } finally {
      setFreezing(false);
    }
  }

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  function changePeriod(next: { mode?: string; year?: string; half?: string }) {
    const params = new URLSearchParams({
      mode: next.mode ?? period.mode,
      year: next.year ?? String(period.year),
    });
    const half = next.half ?? (period.half ? String(period.half) : "");
    if ((next.mode ?? period.mode) === "half-year") params.set("half", half || "1");
    router.push(`/reports/annual?${params.toString()}`);
  }

  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>Period status <span>{period.start} to {period.end}</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StatusLine label="Availability" value={period.isPreview ? "Preview" : "Ready"} color={period.isPreview ? "#F59E0B" : "#22C55E"} />
          <StatusLine label="Active sites" value={String(totals.activeSites)} />
          <StatusLine label="Worker days" value={String(totals.workerDays)} />
          <StatusLine label="Receipts" value={String(totals.receiptCount)} />
        </div>
      </section>

      <section className="attention-card">
        <h2>Evidence paths <span>Spec rule</span></h2>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
          Summary first, then month, site, supplier, worker, and original records. This first version exposes the ranked path and keeps raw tables out of the owner view.
        </p>
      </section>

      {report.sourceNotes.length > 0 && (
        <section className="attention-card">
          <h2>Source notes <span>Optional data</span></h2>
          {report.sourceNotes.map((note) => (
            <div key={note} style={{ color: "#B45309", fontSize: 12, lineHeight: 1.4, padding: "5px 0" }}>
              {note}
            </div>
          ))}
        </section>
      )}
    </>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="desktop-only">
          <Link href="/reports" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", textDecoration: "none", fontSize: 13, marginBottom: 10 }}>
            <ChevronLeft size={16} /> Back to Reports
          </Link>
        </div>

        <section style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#FF6A00", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <Layers size={16} />
                Big document overview
              </div>
              <h1 style={{ margin: 0, color: "#1E3A8A", fontSize: 30, lineHeight: 1.1 }}>{period.label}</h1>
              <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                Top cost drivers, peak months, repeated exceptions, and ranked evidence paths.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select value={period.mode} onChange={(e) => changePeriod({ mode: e.target.value })} style={selectStyle}>
                <option value="annual">Annual</option>
                <option value="half-year">Half-year</option>
              </select>
              <select value={String(period.year)} onChange={(e) => changePeriod({ year: e.target.value })} style={selectStyle}>
                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              {period.mode === "half-year" && (
                <select value={String(period.half ?? 1)} onChange={(e) => changePeriod({ half: e.target.value })} style={selectStyle}>
                  <option value="1">H1</option>
                  <option value="2">H2</option>
                </select>
              )}
              <a
                href={`/api/reports/annual/pdf?${periodQuery}`}
                className="btn-secondary"
                style={{ minHeight: 42, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              >
                <FileDown size={16} /> PDF
              </a>
              {!period.isPreview && (
                <button onClick={freezeReport} disabled={freezing} className="btn-primary" style={{ minHeight: 42 }}>
                  <Lock size={16} /> {freezing ? "กำลังบันทึก…" : "บันทึกถาวร · Freeze"}
                </button>
              )}
            </div>
          </div>

          {freezeMsg && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: freezeMsg.startsWith("✓") ? "#166534" : "#B91C1C" }}>
              {freezeMsg}
            </div>
          )}

          {period.isPreview && (
            <div style={{ marginTop: 14, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>This period is still a preview. The spec keeps half-year and annual reports as final views only after enough data has accumulated.</span>
            </div>
          )}
        </section>

        <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Metric icon={TrendingUp} label="Total cost" value={money(totals.totalCost)} color="#1E3A8A" />
          <Metric icon={Users} label="Labor" value={money(totals.laborCost)} detail={pct(totals.laborCost, totals.totalCost)} color="#22C55E" />
          <Metric icon={Receipt} label="Receipts" value={money(totals.receiptCost)} detail={`${totals.receiptCount} records`} color="#FF6A00" />
          <Metric icon={AlertTriangle} label="Exceptions" value={String(totals.receiptIssueCount + totals.correctionCount + totals.gpsIssueCount)} detail="Receipt, GPS, corrections" color="#EF4444" />
        </div>

        <div className="desktop-only" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <MetricList title="Top 3 cost drivers" items={report.topCostDrivers} />
          <MetricList title="Top 3 time drains" items={report.topTimeDrains} />
          <MetricList title="Repeated exceptions" items={report.repeatedExceptions} />
        </div>

        <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MetricList title="Top 3 cost drivers" items={report.topCostDrivers} />
          <MetricList title="Top 3 time drains" items={report.topTimeDrains} />
          <MetricList title="Repeated exceptions" items={report.repeatedExceptions} />
        </div>

        <section style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <SectionTitle icon={CalendarRange} title="Peak months" subtitle="Ranked by cost, repeated issues, corrections, and GPS gaps" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {(report.peakMonths.length ? report.peakMonths : report.months.slice(0, 4)).map((month) => (
              <div key={month.month} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "#F8FAFF" }}>
                <strong style={{ color: "#1E3A8A", fontSize: 15 }}>{month.label}</strong>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <TinyStat label="Total" value={money(month.totalCost)} />
                  <TinyStat label="Labor" value={money(month.laborCost)} />
                  <TinyStat label="Late" value={String(month.lateCount)} />
                  <TinyStat label="Issues" value={String(month.receiptIssueCount + month.correctionCount + month.gpsIssueCount)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <RankedList title="Projects" subtitle="Highest combined cost" items={report.projects} />
          <RankedList title="Suppliers" subtitle="Highest receipt impact" items={report.suppliers} />
          <RankedList title="Workers" subtitle="Highest labor and overtime impact" items={report.workers} />
        </div>
      </div>
    </DashboardShell>
  );
}

const selectStyle: React.CSSProperties = {
  minHeight: 42,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "white",
  color: "#1E3A8A",
  fontWeight: 700,
  padding: "0 10px",
};

function StatusLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <strong style={{ color: color ?? "var(--text-primary)" }}>{value}</strong>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, color }: { icon: any; label: string; value: string; detail?: string; color: string }) {
  return (
    <div className="metric-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="metric-icon blue" style={{ color, background: "#F2F4FF" }}><Icon size={26} strokeWidth={1.8} /></div>
      <div className="metric-label"><strong>{label}</strong><small>{detail ?? "Period total"}</small></div>
      <div className="metric-value" style={{ color, fontSize: value.length > 12 ? 17 : 22 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F2F4FF", color: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} />
      </div>
      <div>
        <h2 style={{ margin: 0, color: "#1E3A8A", fontSize: 18 }}>{title}</h2>
        <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: 12 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function MetricList({ title, items }: { title: string; items: AnnualReportMetric[] }) {
  return (
    <section style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <SectionTitle icon={BarChart3} title={title} subtitle="Severity-first ranking" />
      {items.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No signal in this period.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, index) => (
            <div key={item.key} style={{ borderTop: index === 0 ? "none" : "1px solid var(--border)", paddingTop: index === 0 ? 0 : 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 14 }}>{item.label}</strong>
                <strong style={{ color: "#1E3A8A", fontSize: 14 }}>{metricValue(item)}</strong>
              </div>
              <div style={{ marginTop: 5, color: "var(--text-muted)", fontSize: 12 }}>
                Related data: {item.relatedData.join(" / ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</div>
      <strong style={{ fontSize: 12 }}>{value}</strong>
    </div>
  );
}

function RankedList({ title, subtitle, items }: { title: string; subtitle: string; items: AnnualReportRankedItem[] }) {
  return (
    <section style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <SectionTitle icon={FileText} title={title} subtitle={subtitle} />
      {items.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No data in this period.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 11, background: index === 0 ? "#F8FAFF" : "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{item.nameEn || item.nameTh}</strong>
                  {item.nameTh && item.nameTh !== item.nameEn && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{item.nameTh}</div>}
                </div>
                <strong style={{ color: "#1E3A8A", fontSize: 14 }}>{money(item.totalCost)}</strong>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {item.evidencePath.slice(0, 4).map((part) => (
                  <span key={part} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "3px 7px", color: "var(--text-muted)", fontSize: 11 }}>
                    {part}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
