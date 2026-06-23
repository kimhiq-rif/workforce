// Copyright © 2026 Workforce. All rights reserved.
// Project Final Report (short version) — generated when an owner closes a site.
// Scope: one site over its entire lifetime (no profit / no client data).
// Surfaces real project cost: labor, receipts, overtime, plus workforce summary,
// stage breakdown (long projects) and exception counts.
import { createServiceClient } from "@/lib/supabase/server";

type SupabaseService = ReturnType<typeof createServiceClient>;

export type ProjectFinalRankedItem = {
  id: string;
  nameTh: string;
  nameEn: string;
  totalCost: number;
  laborCost: number;
  overtimeCost: number;
  receiptCost: number;
  days: number;
  count: number;
};

export type ProjectFinalStage = {
  id: string;
  nameTh: string;
  nameEn: string;
  color: string;
  periodFrom: string;
  periodTo: string;
  durationDays: number;
  workDays: number;
  totalCost: number;
};

export type ProjectFinalReportData = {
  generatedAt: string;
  hostCompany: {
    name: string | null;
    logoUrl: string | null;
  };
  site: {
    id: string;
    nameTh: string;
    nameEn: string;
    locationTh: string;
    locationEn: string;
    projectType: "short" | "long";
    description: string;
    status: string;
    closeReason: string | null;
    isClosed: boolean;
  };
  period: {
    start: string;
    end: string;
    durationDays: number;
  };
  totals: {
    totalCost: number;
    laborCost: number;
    receiptCost: number;
    overtimeCost: number;
    tempWorkerCost: number;
    workerDays: number;
    uniqueWorkers: number;
    receiptCount: number;
    overtimeCount: number;
  };
  exceptions: {
    lateCount: number;
    halfDayCount: number;
    missingCount: number;
    correctionCount: number;
    receiptIssueCount: number;
    gpsIssueCount: number;
  };
  stages: ProjectFinalStage[];
  workers: ProjectFinalRankedItem[];
  suppliers: ProjectFinalRankedItem[];
  sourceNotes: string[];
};

type QueryResult<T> = { data: T[]; note?: string };

async function optionalSelect<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<QueryResult<T>> {
  const { data, error } = await query;
  if (error) return { data: [], note: `${label}: ${error.message}` };
  return { data: data ?? [] };
}

function diffDays(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000)) + 1;
}

export async function buildProjectFinalReport(
  supabase: SupabaseService,
  ownerId: string,
  siteId: string,
  today: string
): Promise<ProjectFinalReportData | null> {
  const sourceNotes: string[] = [];

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select(
      "id, name_th, name_en, location_th, location_en, status, project_type, project_description, created_at, closed_at, close_reason"
    )
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .single();

  if (siteError || !site) return null;

  const { data: reportSettings } = await supabase
    .from("workday_settings")
    .select("hosted_company_name, hosted_company_logo_url")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const [attendanceRes, receiptsRes, overtimeRes, stagesRes] = await Promise.all([
    optionalSelect<any>(
      supabase
        .from("attendance_events")
        .select(
          "id, worker_id, event_date, status, is_late, wage_reason, wage_amount, photo_lat, photo_lng, worker:workers(id, name_th, name_en, is_temporary)"
        )
        .eq("owner_id", ownerId)
        .eq("site_id", siteId),
      "Attendance"
    ),
    optionalSelect<any>(
      supabase
        .from("receipts")
        .select("id, supplier_id, amount, status, gps_lat, gps_lng, supplier:suppliers(id, name_th, name_en)")
        .eq("owner_id", ownerId)
        .eq("site_id", siteId),
      "Receipts"
    ),
    optionalSelect<any>(
      supabase
        .from("overtime_events")
        .select("id, worker_id, amount, worker:workers(id, name_th, name_en)")
        .eq("owner_id", ownerId)
        .eq("site_id", siteId),
      "Overtime"
    ),
    optionalSelect<any>(
      supabase
        .from("stage_reports")
        .select(
          "id, stage_name_th, stage_name_en, stage_color, period_from, period_to, duration_days, work_days, total_cost_thb"
        )
        .eq("owner_id", ownerId)
        .eq("site_id", siteId)
        .order("period_from", { ascending: true }),
      "Stages"
    ),
  ]);

  for (const r of [attendanceRes, receiptsRes, overtimeRes, stagesRes]) {
    if (r.note) sourceNotes.push(r.note);
  }

  const workerMap = new Map<string, ProjectFinalRankedItem>();
  const supplierMap = new Map<string, ProjectFinalRankedItem>();
  const uniqueWorkers = new Set<string>();
  const attendanceIds = new Set<string>();

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
  let earliestDate = today;
  let latestDate = site.created_at ? String(site.created_at).slice(0, 10) : today;

  const ensureWorker = (id: string, w: any): ProjectFinalRankedItem => {
    let item = workerMap.get(id);
    if (!item) {
      item = {
        id,
        nameTh: w?.name_th ?? "Unknown",
        nameEn: w?.name_en ?? "Unknown",
        totalCost: 0,
        laborCost: 0,
        overtimeCost: 0,
        receiptCost: 0,
        days: 0,
        count: 0,
      };
      workerMap.set(id, item);
    }
    return item;
  };

  for (const row of attendanceRes.data) {
    const amount = Number(row.wage_amount ?? 0);
    const status = String(row.status ?? "");
    const worker = row.worker ?? {};
    const isWorkDay = !["missing", "day_off", "rain"].includes(status);

    attendanceIds.add(row.id);
    laborCost += amount;
    if (isWorkDay) workerDays += 1;
    if (row.worker_id) uniqueWorkers.add(row.worker_id);
    if (row.is_late) lateCount += 1;
    if (String(row.wage_reason ?? "").startsWith("half_day")) halfDayCount += 1;
    if (status === "missing") missingCount += 1;
    if (row.photo_lat == null || row.photo_lng == null) gpsIssueCount += 1;
    if (worker.is_temporary) tempWorkerCost += amount;

    const d = String(row.event_date);
    if (d < earliestDate) earliestDate = d;
    if (d > latestDate) latestDate = d;

    if (row.worker_id) {
      const item = ensureWorker(row.worker_id, worker);
      item.laborCost += amount;
      item.totalCost += amount;
      if (isWorkDay) item.days += 1;
    }
  }

  for (const row of overtimeRes.data) {
    const amount = Number(row.amount ?? 0);
    overtimeCost += amount;
    if (row.worker_id) {
      const item = ensureWorker(row.worker_id, row.worker ?? {});
      item.overtimeCost += amount;
      item.totalCost += amount;
    }
  }

  for (const row of receiptsRes.data) {
    const amount = Number(row.amount ?? 0);
    const supplier = row.supplier ?? {};
    const status = String(row.status ?? "");
    const isIssue = !["paid", "approved"].includes(status);

    receiptCost += amount;
    if (isIssue) receiptIssueCount += 1;
    if (row.gps_lat == null || row.gps_lng == null) gpsIssueCount += 1;

    const id = row.supplier_id ?? "unknown";
    let item = supplierMap.get(id);
    if (!item) {
      item = {
        id,
        nameTh: supplier.name_th ?? "ไม่ทราบผู้ขาย",
        nameEn: supplier.name_en ?? "Unknown supplier",
        totalCost: 0,
        laborCost: 0,
        overtimeCost: 0,
        receiptCost: 0,
        days: 0,
        count: 0,
      };
      supplierMap.set(id, item);
    }
    item.receiptCost += amount;
    item.totalCost += amount;
    item.count += 1;
  }

  // Corrections that target this site's records (attendance only — receipts vary).
  let correctionCount = 0;
  if (attendanceIds.size > 0) {
    const corrRes = await optionalSelect<any>(
      supabase
        .from("corrections")
        .select("id, entity_id")
        .eq("owner_id", ownerId)
        .in("entity_id", Array.from(attendanceIds)),
      "Corrections"
    );
    if (corrRes.note) sourceNotes.push(corrRes.note);
    correctionCount = corrRes.data.length;
  }

  const start = earliestDate;
  const end = site.closed_at ? String(site.closed_at).slice(0, 10) : today;

  const stages: ProjectFinalStage[] = stagesRes.data.map((s: any) => ({
    id: s.id,
    nameTh: s.stage_name_th ?? "",
    nameEn: s.stage_name_en ?? "",
    color: s.stage_color ?? "#6C5CE7",
    periodFrom: String(s.period_from ?? ""),
    periodTo: String(s.period_to ?? ""),
    durationDays: Number(s.duration_days ?? 0),
    workDays: Number(s.work_days ?? 0),
    totalCost: Number(s.total_cost_thb ?? 0),
  }));

  return {
    generatedAt: new Date().toISOString(),
    hostCompany: {
      name: reportSettings?.hosted_company_name ?? null,
      logoUrl: reportSettings?.hosted_company_logo_url ?? null,
    },
    site: {
      id: site.id,
      nameTh: site.name_th,
      nameEn: site.name_en,
      locationTh: site.location_th ?? "",
      locationEn: site.location_en ?? "",
      projectType: site.project_type === "long" ? "long" : "short",
      description: site.project_description ?? "",
      status: site.status,
      closeReason: site.close_reason ?? null,
      isClosed: Boolean(site.closed_at),
    },
    period: {
      start,
      end,
      durationDays: diffDays(start, end),
    },
    totals: {
      totalCost: laborCost + receiptCost + overtimeCost,
      laborCost,
      receiptCost,
      overtimeCost,
      tempWorkerCost,
      workerDays,
      uniqueWorkers: uniqueWorkers.size,
      receiptCount: receiptsRes.data.length,
      overtimeCount: overtimeRes.data.length,
    },
    exceptions: {
      lateCount,
      halfDayCount,
      missingCount,
      correctionCount,
      receiptIssueCount,
      gpsIssueCount,
    },
    stages,
    workers: Array.from(workerMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    suppliers: Array.from(supplierMap.values()).sort((a, b) => b.totalCost - a.totalCost),
    sourceNotes,
  };
}
