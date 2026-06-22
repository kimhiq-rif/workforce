import { createServiceClient } from "@/lib/supabase/server";

export function getHalfMonthPeriod(date: string): { start: string; end: string; label: string } {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const paddedMonth = String(month).padStart(2, "0");

  if (day <= 15) {
    return {
      start: `${year}-${paddedMonth}-01`,
      end: `${year}-${paddedMonth}-15`,
      label: `1-15 ${getMonthTh(month)} ${year + 543}`,
    };
  }

  return {
    start: `${year}-${paddedMonth}-16`,
    end: `${year}-${paddedMonth}-${lastDay}`,
    label: `16-${lastDay} ${getMonthTh(month)} ${year + 543}`,
  };
}

function getMonthTh(month: number): string {
  return [
    "",
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ][month];
}

export interface WorkerPayrollRow {
  workerId: string;
  nameTh: string;
  nameEn: string;
  photoUrl: string | null;
  isTemporary: boolean;
  dailyWage: number;
  siteNameTh: string;
  totalDays: number;
  fullDays: number;
  halfDays: number;
  lateDays: number;
  missingDays: number;
  sickDays: number;
  dayOffDays: number;
  familyEventDays: number;
  otherAbsenceDays: number;
  grossWage: number;
  overtimePay: number;
  grossTotal: number;
  advances: number;
  netPay: number;
  transferCostSplit: Array<{ siteNameTh: string; amount: number }>;
}

export interface HalfMonthReportData {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  generatedAt: string;
  hostCompany: {
    name: string | null;
    logoUrl: string | null;
  };
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
    temporaryWorkers: number;
    unresolvedMissingDays: number;
  };
}

export async function buildHalfMonthReport(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  date: string
): Promise<HalfMonthReportData> {
  const { start, end, label } = getHalfMonthPeriod(date);
  const generatedAt = new Date().toISOString();

  const { data: reportSettings } = await supabase
    .from("workday_settings")
    .select("hosted_company_name, hosted_company_logo_url")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { data: workers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, daily_wage, assigned_site_id, photo_url, is_temporary, site:sites(name_th)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const { data: attendance } = await supabase
    .from("attendance_events")
    .select("worker_id, site_id, event_date, status, is_late, wage_reason, wage_amount, absence_reason")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  const { data: overtime } = await supabase
    .from("overtime_events")
    .select("worker_id, amount, event_date")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  const { data: advances } = await supabase
    .from("advance_payments")
    .select("worker_id, amount, payment_date")
    .eq("owner_id", ownerId)
    .gte("payment_date", start)
    .lte("payment_date", end);

  const { data: transfers } = await supabase
    .from("site_transfer_events")
    .select("worker_id, from_site_id, to_site_id, event_date, from_site:sites!from_site_id(name_th), to_site:sites!to_site_id(name_th)")
    .eq("owner_id", ownerId)
    .gte("event_date", start)
    .lte("event_date", end);

  const payrollRows: WorkerPayrollRow[] = [];

  for (const worker of workers ?? []) {
    const workerAttendance = (attendance ?? []).filter((entry) => entry.worker_id === worker.id);
    const workerOvertime = (overtime ?? []).filter((entry) => entry.worker_id === worker.id);
    const workerAdvances = (advances ?? []).filter((entry) => entry.worker_id === worker.id);
    const workerTransfers = (transfers ?? []).filter((entry) => entry.worker_id === worker.id);

    const presentDays = workerAttendance.filter((entry) => entry.status !== "missing" && entry.status !== "day_off");
    const halfDays = presentDays.filter((entry) =>
      entry.wage_reason === "half_day_afternoon_arrival" ||
      entry.wage_reason === "half_day_morning_departure" ||
      entry.wage_reason === "half_day_rain" ||
      entry.wage_reason === "half_day_owner_decision"
    );
    const fullDays = presentDays.filter((entry) => entry.wage_reason === "full_day");
    const lateDays = presentDays.filter((entry) => entry.is_late).length;
    const missingDays = workerAttendance.filter((entry) => entry.status === "missing").length;
    const absenceEvents = workerAttendance.filter((entry) => entry.status === "missing" || entry.status === "day_off");
    const sickDays = absenceEvents.filter((entry) => entry.absence_reason === "sick").length;
    const dayOffDays = absenceEvents.filter((entry) => entry.absence_reason === "day_off" || entry.status === "day_off").length;
    const familyEventDays = absenceEvents.filter((entry) => entry.absence_reason === "family_event").length;
    const otherAbsenceDays = absenceEvents.filter((entry) => entry.absence_reason === "other").length;

    const grossWage = presentDays.reduce((sum, entry) => sum + Number(entry.wage_amount ?? 0), 0);
    const overtimePay = workerOvertime.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const grossTotal = grossWage + overtimePay;
    const totalAdvances = workerAdvances.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const netPay = Math.max(0, grossTotal - totalAdvances);

    const transferCostSplit = workerTransfers.map((transfer) => ({
      siteNameTh: (transfer.to_site as any)?.name_th ?? "Unknown",
      amount: 0,
    }));

    payrollRows.push({
      workerId: worker.id,
      nameTh: worker.name_th,
      nameEn: worker.name_en ?? "",
      photoUrl: worker.photo_url ?? null,
      isTemporary: worker.is_temporary ?? false,
      dailyWage: worker.daily_wage,
      siteNameTh: (worker.site as any)?.name_th ?? "-",
      totalDays: presentDays.length,
      fullDays: fullDays.length,
      halfDays: halfDays.length,
      lateDays,
      missingDays,
      sickDays,
      dayOffDays,
      familyEventDays,
      otherAbsenceDays,
      grossWage,
      overtimePay,
      grossTotal,
      advances: totalAdvances,
      netPay,
      transferCostSplit,
    });
  }

  payrollRows.sort((a, b) => b.netPay - a.netPay);

  const totals = {
    totalWorkers: payrollRows.length,
    totalFullDays: payrollRows.reduce((sum, row) => sum + row.fullDays, 0),
    totalHalfDays: payrollRows.reduce((sum, row) => sum + row.halfDays, 0),
    totalGrossWage: payrollRows.reduce((sum, row) => sum + row.grossWage, 0),
    totalOvertimePay: payrollRows.reduce((sum, row) => sum + row.overtimePay, 0),
    totalGross: payrollRows.reduce((sum, row) => sum + row.grossTotal, 0),
    totalAdvances: payrollRows.reduce((sum, row) => sum + row.advances, 0),
    totalNetPay: payrollRows.reduce((sum, row) => sum + row.netPay, 0),
    temporaryWorkers: payrollRows.filter((row) => row.isTemporary).length,
    unresolvedMissingDays: payrollRows.reduce((sum, row) => sum + row.missingDays, 0),
  };

  return {
    periodStart: start,
    periodEnd: end,
    periodLabel: label,
    generatedAt,
    hostCompany: {
      name: reportSettings?.hosted_company_name ?? null,
      logoUrl: reportSettings?.hosted_company_logo_url ?? null,
    },
    workers: payrollRows,
    totals,
  };
}
