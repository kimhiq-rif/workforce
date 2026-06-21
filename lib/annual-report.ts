import { createServiceClient } from "@/lib/supabase/server";

export type AnnualReportMode = "half-year" | "annual";

export type AnnualReportPeriod = {
  mode: AnnualReportMode;
  year: number;
  half: 1 | 2 | null;
  start: string;
  end: string;
  label: string;
  isAvailable: boolean;
  isPreview: boolean;
};

export type AnnualReportMetric = {
  key: string;
  label: string;
  value: number;
  unit: "thb" | "count" | "days";
  severityScore: number;
  relatedData: string[];
};

export type AnnualReportMonth = {
  month: string;
  label: string;
  totalCost: number;
  laborCost: number;
  receiptCost: number;
  overtimeCost: number;
  workerDays: number;
  lateCount: number;
  halfDayCount: number;
  missingCount: number;
  receiptCount: number;
  receiptIssueCount: number;
  correctionCount: number;
  gpsIssueCount: number;
};

export type AnnualReportRankedItem = {
  id: string;
  nameTh: string;
  nameEn: string;
  totalCost: number;
  laborCost?: number;
  receiptCost?: number;
  overtimeCost?: number;
  count: number;
  evidencePath: string[];
};

export type AnnualReportData = {
  generatedAt: string;
  period: AnnualReportPeriod;
  totals: {
    totalCost: number;
    laborCost: number;
    receiptCost: number;
    overtimeCost: number;
    tempWorkerCost: number;
    workerDays: number;
    uniqueWorkers: number;
    activeSites: number;
    receiptCount: number;
    receiptIssueCount: number;
    lateCount: number;
    halfDayCount: number;
    missingCount: number;
    correctionCount: number;
    gpsIssueCount: number;
  };
  topCostDrivers: AnnualReportMetric[];
  topTimeDrains: AnnualReportMetric[];
  repeatedExceptions: AnnualReportMetric[];
  peakMonths: AnnualReportMonth[];
  months: AnnualReportMonth[];
  projects: AnnualReportRankedItem[];
  suppliers: AnnualReportRankedItem[];
  workers: AnnualReportRankedItem[];
  sourceNotes: string[];
};

type SupabaseService = ReturnType<typeof createServiceClient>;

type QueryResult<T> = {
  data: T[];
  note?: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function lastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function compareDate(a: string, b: string) {
  return a.localeCompare(b);
}

function periodEndFor(mode: AnnualReportMode, year: number, half: 1 | 2 | null) {
  if (mode === "annual") return `${year}-12-31`;
  return half === 1 ? `${year}-06-30` : `${year}-12-31`;
}

export function getAnnualReportPeriod(params: {
  mode?: string | null;
  year?: string | number | null;
  half?: string | number | null;
  today?: string;
}): AnnualReportPeriod {
  const today = params.today ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  const mode: AnnualReportMode = params.mode === "half-year" ? "half-year" : "annual";
  const year = Number(params.year ?? todayYear);
  const half: 1 | 2 | null =
    mode === "half-year"
      ? Number(params.half ?? (todayMonth <= 6 ? 1 : 2)) === 1
        ? 1
        : 2
      : null;

  const start = mode === "annual" ? `${year}-01-01` : half === 1 ? `${year}-01-01` : `${year}-07-01`;
  const end = periodEndFor(mode, year, half);
  const annualPreviewStart = `${year}-12-25`;
  const isAvailable =
    mode === "half-year"
      ? compareDate(today, end) >= 0
      : year < todayYear || compareDate(today, annualPreviewStart) >= 0;

  return {
    mode,
    year,
    half,
    start,
    end,
    label: mode === "annual" ? `Annual overview ${year}` : `Half-year overview H${half} ${year}`,
    isAvailable,
    isPreview: !isAvailable,
  };
}

async function optionalSelect<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<QueryResult<T>> {
  const { data, error } = await query;
  if (error) return { data: [], note: `${label}: ${error.message}` };
  return { data: data ?? [] };
}

function createMonthSkeleton(period: AnnualReportPeriod) {
  const months = new Map<string, AnnualReportMonth>();
  const startMonth = Number(period.start.slice(5, 7));
  const endMonth = Number(period.end.slice(5, 7));
  for (let month = startMonth; month <= endMonth; month++) {
    const key = `${period.year}-${pad2(month)}`;
    months.set(key, {
      month: key,
      label: monthLabel(key),
      totalCost: 0,
      laborCost: 0,
      receiptCost: 0,
      overtimeCost: 0,
      workerDays: 0,
      lateCount: 0,
      halfDayCount: 0,
      missingCount: 0,
      receiptCount: 0,
      receiptIssueCount: 0,
      correctionCount: 0,
      gpsIssueCount: 0,
    });
  }
  return months;
}

function addMetric(
  list: AnnualReportMetric[],
  key: string,
  label: string,
  value: number,
  unit: AnnualReportMetric["unit"],
  relatedData: string[]
) {
  if (value <= 0) return;
  list.push({ key, label, value, unit, severityScore: value, relatedData });
}

function bumpRanked(
  map: Map<string, AnnualReportRankedItem>,
  id: string | null | undefined,
  fallback: AnnualReportRankedItem,
  patch: Partial<AnnualReportRankedItem>
) {
  if (!id) return;
  const current = map.get(id) ?? fallback;
  map.set(id, {
    ...current,
    ...patch,
    totalCost: (current.totalCost ?? 0) + (patch.totalCost ?? 0),
    laborCost: (current.laborCost ?? 0) + (patch.laborCost ?? 0),
    receiptCost: (current.receiptCost ?? 0) + (patch.receiptCost ?? 0),
    overtimeCost: (current.overtimeCost ?? 0) + (patch.overtimeCost ?? 0),
    count: (current.count ?? 0) + (patch.count ?? 0),
  });
}

export async function buildAnnualReport(
  supabase: SupabaseService,
  ownerId: string,
  params: { mode?: string | null; year?: string | number | null; half?: string | number | null; today?: string }
): Promise<AnnualReportData> {
  const period = getAnnualReportPeriod(params);
  const generatedAt = new Date().toISOString();
  const sourceNotes: string[] = [];

  const periodStartIso = `${period.start}T00:00:00+07:00`;
  const periodEndIso = `${period.end}T23:59:59+07:00`;

  const [sitesRes, attendanceRes, receiptsRes, overtimeRes, correctionsRes] = await Promise.all([
    optionalSelect<any>(
      supabase.from("sites").select("id, name_th, name_en, status, project_type, is_active").eq("owner_id", ownerId),
      "Sites"
    ),
    optionalSelect<any>(
      supabase
        .from("attendance_events")
        .select(
          "id, site_id, worker_id, event_date, status, is_late, wage_reason, wage_amount, photo_lat, photo_lng, site:sites(id,name_th,name_en), worker:workers(id,name_th,name_en,is_temporary)"
        )
        .eq("owner_id", ownerId)
        .gte("event_date", period.start)
        .lte("event_date", period.end),
      "Attendance"
    ),
    optionalSelect<any>(
      supabase
        .from("receipts")
        .select(
          "id, site_id, supplier_id, amount, status, created_at, receipt_number, gps_lat, gps_lng, site:sites(id,name_th,name_en), supplier:suppliers(id,name_th,name_en)"
        )
        .eq("owner_id", ownerId)
        .gte("created_at", periodStartIso)
        .lte("created_at", periodEndIso),
      "Receipts"
    ),
    optionalSelect<any>(
      supabase
        .from("overtime_events")
        .select("id, site_id, worker_id, event_date, overtime_hours, amount, site:sites(id,name_th,name_en), worker:workers(id,name_th,name_en)")
        .eq("owner_id", ownerId)
        .gte("event_date", period.start)
        .lte("event_date", period.end),
      "Overtime"
    ),
    optionalSelect<any>(
      supabase
        .from("corrections")
        .select("id, entity_type, entity_id, field_name, corrected_at, reason")
        .eq("owner_id", ownerId)
        .gte("corrected_at", periodStartIso)
        .lte("corrected_at", periodEndIso),
      "Corrections"
    ),
  ]);

  for (const result of [sitesRes, attendanceRes, receiptsRes, overtimeRes, correctionsRes]) {
    if (result.note) sourceNotes.push(result.note);
  }

  const months = createMonthSkeleton(period);
  const sites = new Map<string, any>((sitesRes.data ?? []).map((site) => [site.id, site]));
  const projectMap = new Map<string, AnnualReportRankedItem>();
  const supplierMap = new Map<string, AnnualReportRankedItem>();
  const workerMap = new Map<string, AnnualReportRankedItem>();
  const uniqueWorkers = new Set<string>();

  let laborCost = 0;
  let receiptCost = 0;
  let overtimeCost = 0;
  let tempWorkerCost = 0;
  let workerDays = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let missingCount = 0;
  let gpsIssueCount = 0;
  let receiptIssueCount = 0;

  for (const row of attendanceRes.data) {
    const amount = Number(row.wage_amount ?? 0);
    const status = String(row.status ?? "");
    const isWorkDay = !["missing", "day_off", "rain"].includes(status);
    const key = monthKey(row.event_date);
    const month = months.get(key);
    const site = row.site ?? sites.get(row.site_id) ?? {};
    const worker = row.worker ?? {};

    laborCost += amount;
    if (isWorkDay) workerDays += 1;
    if (row.worker_id) uniqueWorkers.add(row.worker_id);
    if (row.is_late) lateCount += 1;
    if (status === "half_day_am" || status === "half_day_pm" || String(row.wage_reason ?? "").startsWith("half_day")) halfDayCount += 1;
    if (status === "missing") missingCount += 1;
    if (row.photo_lat == null || row.photo_lng == null) gpsIssueCount += 1;
    if (worker.is_temporary) tempWorkerCost += amount;

    if (month) {
      month.laborCost += amount;
      month.totalCost += amount;
      if (isWorkDay) month.workerDays += 1;
      if (row.is_late) month.lateCount += 1;
      if (status === "half_day_am" || status === "half_day_pm" || String(row.wage_reason ?? "").startsWith("half_day")) month.halfDayCount += 1;
      if (status === "missing") month.missingCount += 1;
      if (row.photo_lat == null || row.photo_lng == null) month.gpsIssueCount += 1;
    }

    bumpRanked(
      projectMap,
      row.site_id,
      {
        id: row.site_id,
        nameTh: site.name_th ?? "Unknown site",
        nameEn: site.name_en ?? "Unknown site",
        totalCost: 0,
        laborCost: 0,
        receiptCost: 0,
        overtimeCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), site.name_en ?? site.name_th ?? "Site", "Attendance"],
      },
      { totalCost: amount, laborCost: amount, count: isWorkDay ? 1 : 0 }
    );

    bumpRanked(
      workerMap,
      row.worker_id,
      {
        id: row.worker_id,
        nameTh: worker.name_th ?? "Unknown worker",
        nameEn: worker.name_en ?? "Unknown worker",
        totalCost: 0,
        laborCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), site.name_en ?? site.name_th ?? "Site", worker.name_en ?? worker.name_th ?? "Worker"],
      },
      { totalCost: amount, laborCost: amount, count: isWorkDay ? 1 : 0 }
    );
  }

  for (const row of receiptsRes.data) {
    const amount = Number(row.amount ?? 0);
    const key = monthKey(String(row.created_at ?? period.start));
    const month = months.get(key);
    const site = row.site ?? sites.get(row.site_id) ?? {};
    const supplier = row.supplier ?? {};
    const status = String(row.status ?? "");
    const isIssue = !["paid", "approved"].includes(status);

    receiptCost += amount;
    if (isIssue) receiptIssueCount += 1;
    if (row.gps_lat == null || row.gps_lng == null) gpsIssueCount += 1;

    if (month) {
      month.receiptCost += amount;
      month.totalCost += amount;
      month.receiptCount += 1;
      if (isIssue) month.receiptIssueCount += 1;
      if (row.gps_lat == null || row.gps_lng == null) month.gpsIssueCount += 1;
    }

    bumpRanked(
      projectMap,
      row.site_id,
      {
        id: row.site_id,
        nameTh: site.name_th ?? "Unknown site",
        nameEn: site.name_en ?? "Unknown site",
        totalCost: 0,
        receiptCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), site.name_en ?? site.name_th ?? "Site", "Receipts"],
      },
      { totalCost: amount, receiptCost: amount, count: 1 }
    );

    bumpRanked(
      supplierMap,
      row.supplier_id,
      {
        id: row.supplier_id,
        nameTh: supplier.name_th ?? "Unknown supplier",
        nameEn: supplier.name_en ?? "Unknown supplier",
        totalCost: 0,
        receiptCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), supplier.name_en ?? supplier.name_th ?? "Supplier", row.receipt_number ?? "Receipt"],
      },
      { totalCost: amount, receiptCost: amount, count: 1 }
    );
  }

  for (const row of overtimeRes.data) {
    const amount = Number(row.amount ?? 0);
    const key = monthKey(row.event_date);
    const month = months.get(key);
    const site = row.site ?? sites.get(row.site_id) ?? {};
    const worker = row.worker ?? {};

    overtimeCost += amount;
    if (month) {
      month.overtimeCost += amount;
      month.totalCost += amount;
    }

    bumpRanked(
      projectMap,
      row.site_id,
      {
        id: row.site_id,
        nameTh: site.name_th ?? "Unknown site",
        nameEn: site.name_en ?? "Unknown site",
        totalCost: 0,
        overtimeCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), site.name_en ?? site.name_th ?? "Site", "Overtime"],
      },
      { totalCost: amount, overtimeCost: amount, count: 1 }
    );

    bumpRanked(
      workerMap,
      row.worker_id,
      {
        id: row.worker_id,
        nameTh: worker.name_th ?? "Unknown worker",
        nameEn: worker.name_en ?? "Unknown worker",
        totalCost: 0,
        overtimeCost: 0,
        count: 0,
        evidencePath: [period.label, monthLabel(key), worker.name_en ?? worker.name_th ?? "Worker", "Overtime"],
      },
      { totalCost: amount, overtimeCost: amount, count: 1 }
    );
  }

  for (const row of correctionsRes.data) {
    const key = monthKey(String(row.corrected_at ?? period.start));
    const month = months.get(key);
    if (month) month.correctionCount += 1;
  }

  const correctionCount = correctionsRes.data.length;
  const totalCost = laborCost + receiptCost + overtimeCost;
  const topCostDrivers: AnnualReportMetric[] = [];
  addMetric(topCostDrivers, "labor", "Labor cost", laborCost, "thb", ["Workers", "Sites", "Monthly report"]);
  addMetric(topCostDrivers, "receipts", "Receipts", receiptCost, "thb", ["Suppliers", "Receipts", "Projects"]);
  addMetric(topCostDrivers, "overtime", "Overtime", overtimeCost, "thb", ["Workers", "Sites", "Attendance"]);
  addMetric(topCostDrivers, "temp_workers", "Temporary workers", tempWorkerCost, "thb", ["Temporary workers", "Attendance"]);

  const topTimeDrains: AnnualReportMetric[] = [];
  addMetric(topTimeDrains, "late", "Late arrivals", lateCount, "count", ["Workers", "Sites", "Dates"]);
  addMetric(topTimeDrains, "half_day", "Half days", halfDayCount, "count", ["Attendance", "Rain", "Owner decisions"]);
  addMetric(topTimeDrains, "missing", "Missing reports", missingCount, "count", ["Workers", "Sites", "Daily reports"]);

  const repeatedExceptions: AnnualReportMetric[] = [];
  addMetric(repeatedExceptions, "receipt_issues", "Receipt issues", receiptIssueCount, "count", ["Receipts", "Suppliers", "Driver flow"]);
  addMetric(repeatedExceptions, "corrections", "Corrections", correctionCount, "count", ["Corrections", "Original records"]);
  addMetric(repeatedExceptions, "gps_issues", "GPS issues", gpsIssueCount, "count", ["Attendance photos", "Receipt photos", "Source evidence"]);

  const sortedMonths = Array.from(months.values());
  const peakMonths = [...sortedMonths]
    .filter((month) => month.totalCost > 0 || month.lateCount > 0 || month.receiptIssueCount > 0 || month.correctionCount > 0)
    .sort((a, b) => {
      const aScore = a.totalCost + a.lateCount * 500 + a.receiptIssueCount * 800 + a.correctionCount * 800 + a.gpsIssueCount * 300;
      const bScore = b.totalCost + b.lateCount * 500 + b.receiptIssueCount * 800 + b.correctionCount * 800 + b.gpsIssueCount * 300;
      return bScore - aScore;
    })
    .slice(0, 4);

  return {
    generatedAt,
    period,
    totals: {
      totalCost,
      laborCost,
      receiptCost,
      overtimeCost,
      tempWorkerCost,
      workerDays,
      uniqueWorkers: uniqueWorkers.size,
      activeSites: sitesRes.data.filter((site) => site.is_active !== false).length,
      receiptCount: receiptsRes.data.length,
      receiptIssueCount,
      lateCount,
      halfDayCount,
      missingCount,
      correctionCount,
      gpsIssueCount,
    },
    topCostDrivers: topCostDrivers.sort((a, b) => b.value - a.value).slice(0, 3),
    topTimeDrains: topTimeDrains.sort((a, b) => b.value - a.value).slice(0, 3),
    repeatedExceptions: repeatedExceptions.sort((a, b) => b.value - a.value).slice(0, 3),
    peakMonths,
    months: sortedMonths,
    projects: Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost).slice(0, 8),
    suppliers: Array.from(supplierMap.values()).sort((a, b) => b.totalCost - a.totalCost).slice(0, 8),
    workers: Array.from(workerMap.values()).sort((a, b) => b.totalCost - a.totalCost).slice(0, 8),
    sourceNotes,
  };
}
