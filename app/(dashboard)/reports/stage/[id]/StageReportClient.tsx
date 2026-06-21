"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StageReport {
  id: string;
  stage_name_en: string;
  stage_name_th: string;
  stage_color: string;
  period_from: string;
  period_to: string;
  duration_days: number;
  work_days: number;
  labor_cost_thb: number;
  receipts_cost_thb: number;
  temp_workers_cost_thb: number;
  overtime_cost_thb: number;
  total_cost_thb: number;
  worker_count: number;
  gps_issue_count: number;
  correction_count: number;
  receipt_problem_count: number;
  overtime_count: number;
  temp_worker_count: number;
  snapshot_json: Record<string, unknown> | null;
  generated_at: string;
  sites: { name_th: string; name_en: string; project_type: string };
}

function formatTHB(amount: number) {
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

type AccordionKey =
  | "workforce"
  | "receipts"
  | "suppliers"
  | "temp"
  | "overtime"
  | "corrections"
  | "gps"
  | "receipt_problems";

const ACCORDION_ITEMS: { key: AccordionKey; label_th: string; label_en: string; countKey?: keyof StageReport }[] = [
  { key: "workforce",        label_th: "รายละเอียดแรงงาน",  label_en: "Workforce details",      countKey: "worker_count" },
  { key: "receipts",         label_th: "รายละเอียดใบเสร็จ", label_en: "Receipts details" },
  { key: "suppliers",        label_th: "รายละเอียดซัพพลายเออร์", label_en: "Suppliers details" },
  { key: "temp",             label_th: "พนักงานชั่วคราว",   label_en: "Temporary workers",      countKey: "temp_worker_count" },
  { key: "overtime",         label_th: "โอที",               label_en: "Overtime",               countKey: "overtime_count" },
  { key: "corrections",      label_th: "การแก้ไข",           label_en: "Corrections",            countKey: "correction_count" },
  { key: "gps",              label_th: "ปัญหา GPS",          label_en: "GPS issues",             countKey: "gps_issue_count" },
  { key: "receipt_problems", label_th: "ปัญหาใบเสร็จ",      label_en: "Receipt problems",       countKey: "receipt_problem_count" },
];

export default function StageReportClient({
  report,
  nextStageId,
  nextStageHasTarget,
}: {
  report: StageReport;
  nextStageId?: string | null;
  nextStageHasTarget?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<AccordionKey>>(new Set());
  const [targetDate, setTargetDate] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetSaved, setTargetSaved] = useState(nextStageHasTarget ?? false);

  async function saveTargetDate() {
    if (!targetDate || !nextStageId) return;
    setSavingTarget(true);
    try {
      const siteId = (report as any).site_id;
      const res = await fetch(`/api/sites/${siteId}/stage-target`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_end_date: targetDate }),
      });
      if (res.ok) setTargetSaved(true);
    } finally {
      setSavingTarget(false);
    }
  }

  function toggleAccordion(key: AccordionKey) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const nonZeroSections = ACCORDION_ITEMS.filter((item) => {
    if (!item.countKey) return true;
    return (report[item.countKey] as number) > 0;
  });

  return (
    <div className="min-h-screen bg-[#F2F4FF]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <p className="text-sm text-gray-500">{report.sites.name_th} · {report.sites.name_en}</p>
          <h1 className="text-2xl font-bold text-[#1E3A8A]">
            דוח שלב / Stage Report
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Set target date banner — shown when next stage has no target yet */}
        {nextStageId && !targetSaved && (
          <div style={{
            background: "linear-gradient(135deg, #6C5CE7, #5B4BD0)",
            borderRadius: 16, padding: "16px 20px", color: "white",
          }}>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>⚡ Next step required</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
              กำหนดวันที่เป้าหมายขั้นตอนถัดไป
            </p>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Set target end date for current stage</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{ flex: 1, border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "#1E3A8A", background: "white" }}
              />
              <button
                onClick={saveTargetDate}
                disabled={!targetDate || savingTarget}
                style={{
                  background: "#FF6A00", color: "white", border: "none",
                  borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700,
                  cursor: !targetDate || savingTarget ? "not-allowed" : "pointer",
                  opacity: !targetDate || savingTarget ? 0.7 : 1,
                }}
              >
                {savingTarget ? "…" : "บันทึก · Save"}
              </button>
            </div>
          </div>
        )}
        {targetSaved && nextStageId && (
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, color: "#166534", fontSize: 14 }}>
            ✅ บันทึกวันที่เป้าหมายแล้ว · Target date saved
          </div>
        )}

        {/* Stage identity badge */}
        <div
          className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-sm border-l-4"
          style={{ borderLeftColor: report.stage_color }}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: report.stage_color }}
          />
          <div>
            <p className="text-lg font-bold text-gray-900">{report.stage_name_th}</p>
            <p className="text-sm text-gray-500">{report.stage_name_en}</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">จาก / From</p>
              <p className="text-base font-semibold text-gray-800">{formatDate(report.period_from)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">ถึง / To</p>
              <p className="text-base font-semibold text-gray-800">{formatDate(report.period_to)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">ระยะเวลา / Duration</p>
              <p className="text-base font-semibold text-gray-800">{report.duration_days} วัน / days</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">วันทำงาน / Work days</p>
              <p className="text-base font-semibold text-gray-800">{report.work_days} วัน / days</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">ค่าแรง / Labor cost</p>
              <p className="text-base font-semibold text-gray-800">{formatTHB(report.labor_cost_thb)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">ใบเสร็จ / Receipts</p>
              <p className="text-base font-semibold text-gray-800">{formatTHB(report.receipts_cost_thb)}</p>
            </div>
          </div>
        </div>

        {/* Accordion sections */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {nonZeroSections.map((item) => {
            const isOpen = open.has(item.key);
            const count = item.countKey ? (report[item.countKey] as number) : null;
            return (
              <button
                key={item.key}
                onClick={() => toggleAccordion(item.key)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="text-base font-medium text-gray-900">{item.label_th}</span>
                  <span className="ml-2 text-sm text-gray-400">{item.label_en}</span>
                  {count !== null && count > 0 && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{count}</span>
                  )}
                </div>
                <span className="text-gray-400 text-lg">{isOpen ? "▲" : "▼"}</span>
              </button>
            );
          })}
        </div>

        {/* Total cost */}
        <div className="bg-[#1E3A8A] rounded-2xl px-5 py-5 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm">รวมค่าใช้จ่ายทั้งหมด</p>
            <p className="text-white text-sm">Total stage cost</p>
          </div>
          <p className="text-white text-3xl font-bold">{formatTHB(report.total_cost_thb)}</p>
        </div>

        {/* Generated timestamp */}
        <p className="text-center text-xs text-gray-400">
          Generated {new Date(report.generated_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
        </p>
      </div>
    </div>
  );
}
