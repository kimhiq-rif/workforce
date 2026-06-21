// Half-month payroll aggregation.
// Runs on the 15th (period 1–15) and last day of month (period 16–last).

import { createServiceClient } from "@/lib/supabase/server";

// ── Period helpers ────────────────────────────────────────────────────────────

export function getHalfMonthPeriod(date: string): { start: string; end: string; label: string } {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  if (d <= 15) {
    return {
      start: `${y}-${String(m).padStart(2, "0")}-01`,
      end:   `${y}-${String(m).padStart(2, "0")}-15`,
      label: `1–15 ${getMonthTh(m)} ${y + 543}`,
    };
  }
  return {
    start: `${y}-${String(m).padStart(2, "0")}-16`,
    end:   `${y}-${String(m).padStart(2, "0")}-${lastDay}`,
    label: `16–${lastDay} ${getMonthTh(m)} ${y + 543}`,
  };
}

function getMonthTh(m: number): string {
  return ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
          "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][m];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerPayrollRow {
  workerId: string;
  nameTh: string;
  nameEn: string;
  dailyWage: number;
  siteNameTh: string;
  // Attendance
  totalDays: number;         // days present (full + half)
  fullDays: number;
  halfDays: number;
  lateDays: number;
  missingDays: number;
  // Wages
  grossWage: number;         // from attendance_events sum
  overtimePay: number;       // from overtime_events sum
  grossTotal: number;        // grossWage + overtimePay
  // Deductions
  advances: number;          // advance_payments sum
  netPay: number;            // grossTotal - advances
  // Transfer cost breakdown (informational)
  transferCostSplit: Array<{ siteNameTh: string; amount: number }>;
}

export interface HalfMonthReportData {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  generatedAt: string;
  workers: WorkerPayrollRow[];
  totals: {
    totalWorkers: number;
    totalFullDays: number;
    totalHalfDays: number;
    totalGrossWage: number;
    totalOvertimePay: number;
    totalGross: number;
    totalAdvances: number;
    totalNetPay: number;
  };
}

// ── Main aggregation ──────────────────────────────────────────────────────────

export async function buildHalfMonthReport(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  date: string
): Promise<HalfMonthReportData> {
  const { start, end, label } = getHalfMonthPeriod(date);
  const generatedAt = new Date().toISOString();

  // ── Active workers ──────────────────────────────────────────────────────────
  const { data: workers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, daily_wage, assigned_site_id, site:sites(name_th)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // ── Attendance events for the period ───────────────────────────────────────
  const { data: attendance } = await supabase
    .from("attendance_events")
    .select("worker_id, site_id, event_date, status, is_late, wage_reason, wage_amount")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  // ── Overtime events for the period ─────────────────────────────────────────
  const { data: overtime } = await supabase
    .from("overtime_events")
    .select("worker_id, amount, event_date")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  // ── Advance payments for the period ────────────────────────────────────────
  const { data: advances } = await supabase
    .from("advance_payments")
    .select("worker_id, amount, payment_date")
    .eq("owner_id", ownerId)
    .gte("payment_date", start)
    .lte("payment_date", end);

  // ── Transfer events for cost split info ────────────────────────────────────
  const { data: transfers } = await supabase
    .from("site_transfer_events")
    .select("worker_id, from_site_id, to_site_id, event_date, from_site:sites!from_site_id(name_th), to_site:sites!to_site_id(name_th)")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  // ── Aggregate per worker ────────────────────────────────────────────────────
  const payrollRows: WorkerPayrollRow[] = [];

  for (const w of workers ?? []) {
    const wAttendance = (attendance ?? []).filter((a) => a.worker_id === w.id);
    const wOvertime   = (overtime ?? []).filter((o) => o.worker_id === w.id);
    const wAdvances   = (advances ?? []).filter((a) => a.worker_id === w.id);
    const wTransfers  = (transfers ?? []).filter((t) => t.worker_id === w.id);

    const presentDays = wAttendance.filter((a) => a.status !== "missing" && a.status !== "day_off");
    const halfDays    = presentDays.filter((a) =>
      a.wage_reason === "half_day_afternoon_arrival" ||
      a.wage_reason === "half_day_morning_departure" ||
      a.wage_reason === "half_day_rain" ||
      a.wage_reason === "half_day_owner_decision"
    );
    const fullDays    = presentDays.filter((a) => a.wage_reason === "full_day");
    const lateDays    = presentDays.filter((a) => a.is_late).length;
    const missingDays = wAttendance.filter((a) => a.status === "missing").length;

    const grossWage    = presentDays.reduce((s, a) => s + Number(a.wage_amount ?? 0), 0);
    const overtimePay  = wOvertime.reduce((s, o) => s + Number(o.amount), 0);
    const grossTotal   = grossWage + overtimePay;
    const totalAdvances = wAdvances.reduce((s, a) => s + Number(a.amount), 0);
    const netPay       = Math.max(0, grossTotal - totalAdvances);

    // Transfer cost breakdown (informational — how cost was split between sites)
    const transferCostSplit: Array<{ siteNameTh: string; amount: number }> = wTransfers.map((t) => ({
      siteNameTh: (t.to_site as any)?.name_th ?? "Unknown",
      amount: 0, // cost split computed at report time — stored in daily snapshots
    }));

    payrollRows.push({
      workerId:   w.id,
      nameTh:     w.name_th,
      nameEn:     w.name_en ?? "",
      dailyWage:  w.daily_wage,
      siteNameTh: (w.site as any)?.name_th ?? "—",
      totalDays:  presentDays.length,
      fullDays:   fullDays.length,
      halfDays:   halfDays.length,
      lateDays,
      missingDays,
      grossWage,
      overtimePay,
      grossTotal,
      advances:   totalAdvances,
      netPay,
      transferCostSplit,
    });
  }

  // Sort: highest net pay first
  payrollRows.sort((a, b) => b.netPay - a.netPay);

  const totals = {
    totalWorkers:    payrollRows.length,
    totalFullDays:   payrollRows.reduce((s, r) => s + r.fullDays, 0),
    totalHalfDays:   payrollRows.reduce((s, r) => s + r.halfDays, 0),
    totalGrossWage:  payrollRows.reduce((s, r) => s + r.grossWage, 0),
    totalOvertimePay:payrollRows.reduce((s, r) => s + r.overtimePay, 0),
    totalGross:      payrollRows.reduce((s, r) => s + r.grossTotal, 0),
    totalAdvances:   payrollRows.reduce((s, r) => s + r.advances, 0),
    totalNetPay:     payrollRows.reduce((s, r) => s + r.netPay, 0),
  };

  return {
    periodStart: start,
    periodEnd:   end,
    periodLabel: label,
    generatedAt,
    workers: payrollRows,
    totals,
  };
}
