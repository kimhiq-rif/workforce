// Daily report aggregation — pure data, no side effects.
// Called by the API endpoint and the 17:00 cron.

import { createServiceClient } from "@/lib/supabase/server";
import { computeTransferCostSplit, computeSeverityScore, rankByseverity } from "@/lib/wage-logic";

export interface WorkerReportRow {
  attendanceId: string;
  workerId: string;
  nameTh: string;
  nameEn: string;
  dailyWage: number;
  arrivalTime: string | null;
  isLate: boolean;
  wageReason: string | null;
  wageAmount: number;
  status: string;
  isTransfer: boolean;
  transferToSiteId: string | null;
  transferToSiteName: string | null;
  transferFromSiteId: string | null;
  transferFromSiteName: string | null;
  transferTime: string | null;
  siteACost: number | null;  // cost to this site (if transfer out)
  siteBCost: number | null;  // cost to this site (if transfer in)
  photoUrl: string | null;
}

export interface OvertimeRow {
  workerId: string;
  workerNameTh: string;
  overtimeHours: number;
  amount: number;
}

export interface ReceiptReportRow {
  receiptId: string;
  supplierNameTh: string | null;
  amount: number;
  status: string;
  paidFromDriverCash: boolean;
  siteId: string | null;
  siteNameTh: string | null;
}

export interface SiteReportData {
  siteId: string;
  siteNameTh: string;
  siteNameEn: string;
  status: string;
  wageDecision: string | null;
  workers: WorkerReportRow[];
  presentCount: number;
  lateCount: number;
  missingCount: number;
  transferOutCount: number;
  transferInCount: number;
  overtimeRows: OvertimeRow[];
  laborCost: number;           // wages of workers stationed at this site
  transferCostOut: number;     // share of cost for workers who left
  transferCostIn: number;      // share of cost for workers who arrived
  overtimeCost: number;
  totalLaborCost: number;
  receipts: ReceiptReportRow[];
  receiptTotal: number;
  totalSiteCost: number;       // totalLaborCost + receiptTotal
}

export interface DailyReportTotals {
  totalPresent: number;
  totalLate: number;
  totalMissing: number;
  totalTransfers: number;
  totalLaborCost: number;
  totalOvertimeCost: number;
  totalReceiptAmount: number;
  totalExpenses: number;         // labor + receipts
}

export interface ExpenseCategory {
  category: string;
  nameTh: string;
  amount: number;
  count: number;
  severityScore: number;
}

export interface BlockReason {
  type: "pending_receipt" | "pending_wage_decision" | "pending_qr";
  messageTh: string;
  messageEn: string;
  siteId?: string;
  receiptId?: string;
}

export interface DailyReportData {
  date: string;
  generatedAt: string;
  isBlocked: boolean;
  blockReasons: BlockReason[];
  sites: SiteReportData[];
  totals: DailyReportTotals;
  expenseCategories: ExpenseCategory[];  // sorted by severity
  corrections: Array<{
    id: string;
    entityType: string;
    fieldName: string;
    originalValue: string | null;
    correctedValue: string | null;
    reason: string;
    correctedAt: string;
  }>;
}

export async function buildDailyReport(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  date: string
): Promise<DailyReportData> {
  const generatedAt = new Date().toISOString();
  const blockReasons: BlockReason[] = [];

  // ── 1. Fetch all active sites ───────────────────────────────────────────────
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status, color")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // ── 2. Fetch attendance events for this date ────────────────────────────────
  const { data: attendanceEvents } = await supabase
    .from("attendance_events")
    .select(`
      id, site_id, worker_id, arrival_time, status, is_late,
      wage_reason, wage_amount, photo_url,
      worker:workers(id, name_th, name_en, daily_wage)
    `)
    .eq("owner_id", ownerId)
    .eq("event_date", date);

  // ── 3. Fetch transfer events ────────────────────────────────────────────────
  const { data: transferEvents } = await supabase
    .from("site_transfer_events")
    .select(`
      id, worker_id, from_site_id, to_site_id, transfer_time,
      worker:workers(id, name_th, name_en, daily_wage),
      from_site:sites!from_site_id(id, name_th),
      to_site:sites!to_site_id(id, name_th)
    `)
    .eq("owner_id", ownerId)
    .eq("event_date", date);

  // ── 4. Fetch overtime events ────────────────────────────────────────────────
  const { data: overtimeEvents } = await supabase
    .from("overtime_events")
    .select("id, site_id, worker_id, overtime_hours, amount, worker:workers(name_th)")
    .eq("owner_id", ownerId)
    .eq("event_date", date);

  // ── 5. Fetch site day statuses ──────────────────────────────────────────────
  const { data: dayStatuses } = await supabase
    .from("site_day_status_events")
    .select("site_id, status, wage_decision")
    .eq("owner_id", ownerId)
    .eq("event_date", date);

  // ── 6. Fetch receipts ───────────────────────────────────────────────────────
  const { data: receipts } = await supabase
    .from("receipts")
    .select(`
      id, site_id, amount, status, paid_from_driver_cash,
      receipt_category, receipt_date,
      supplier:suppliers(name_th)
    `)
    .eq("owner_id", ownerId)
    .eq("receipt_date", date);

  // ── 7. Fetch corrections made today ─────────────────────────────────────────
  const { data: corrections } = await supabase
    .from("corrections")
    .select("id, entity_type, field_name, original_value, corrected_value, reason, corrected_at")
    .eq("owner_id", ownerId)
    .gte("corrected_at", `${date}T00:00:00+07:00`)
    .lte("corrected_at", `${date}T23:59:59+07:00`)
    .order("corrected_at", { ascending: true });

  // ── 8. Check blocking conditions ────────────────────────────────────────────
  const pendingReceipts = (receipts ?? []).filter((r) =>
    ["pending_sorting", "paid_pending_sorting", "pending_qr", "waiting_owner_payment"].includes(r.status)
  );
  for (const r of pendingReceipts) {
    const type = r.status.includes("qr") || r.status === "waiting_owner_payment"
      ? "pending_qr" as const
      : "pending_receipt" as const;
    blockReasons.push({
      type,
      messageTh: `ใบเสร็จรอการจัดการ (${r.status})`,
      messageEn: `Receipt pending action: ${r.status}`,
      receiptId: r.id,
    });
  }

  const pendingWage = (dayStatuses ?? []).filter((d) => d.wage_decision === "pending");
  for (const d of pendingWage) {
    const site = (sites ?? []).find((s) => s.id === d.site_id);
    blockReasons.push({
      type: "pending_wage_decision",
      messageTh: `รอตัดสินค่าแรง · ${site?.name_th ?? d.site_id}`,
      messageEn: `Wage decision pending: ${site?.name_en ?? d.site_id}`,
      siteId: d.site_id,
    });
  }

  // ── 9. Build per-site data ───────────────────────────────────────────────────
  const siteReports: SiteReportData[] = [];
  const allAttendance = attendanceEvents ?? [];
  const allTransfers = transferEvents ?? [];
  const allOvertime = overtimeEvents ?? [];
  const allReceipts = receipts ?? [];
  const allDayStatuses = dayStatuses ?? [];

  for (const site of sites ?? []) {
    const siteAttendance = allAttendance.filter((e) => e.site_id === site.id);
    const dayStatus = allDayStatuses.find((d) => d.site_id === site.id) ?? null;

    // Transfers OUT from this site
    const transfersOut = allTransfers.filter((t) => t.from_site_id === site.id);
    // Transfers IN to this site
    const transfersIn  = allTransfers.filter((t) => t.to_site_id === site.id);

    // Build worker rows
    const workerRows: WorkerReportRow[] = siteAttendance.map((evt) => {
      const xferOut = transfersOut.find((t) => t.worker_id === evt.worker_id);
      const xferIn  = transfersIn.find((t)  => t.worker_id === evt.worker_id);

      let siteACost: number | null = null;
      let siteBCost: number | null = null;

      if (xferOut && evt.worker) {
        const arrivalTime = evt.arrival_time ?? "07:00";
        const split = computeTransferCostSplit(arrivalTime, xferOut.transfer_time, (evt.worker as any).daily_wage);
        siteACost = split.siteACostBaht;
        siteBCost = split.siteBCostBaht;
      }

      return {
        attendanceId: evt.id,
        workerId: evt.worker_id,
        nameTh: (evt.worker as any)?.name_th ?? "",
        nameEn: (evt.worker as any)?.name_en ?? "",
        dailyWage: (evt.worker as any)?.daily_wage ?? 0,
        arrivalTime: evt.arrival_time,
        isLate: evt.is_late ?? false,
        wageReason: evt.wage_reason,
        wageAmount: evt.wage_amount ?? 0,
        status: evt.status,
        isTransfer: !!xferOut || !!xferIn,
        transferToSiteId: xferOut ? xferOut.to_site_id : null,
        transferToSiteName: xferOut ? (xferOut.to_site as any)?.name_th ?? null : null,
        transferFromSiteId: xferIn ? xferIn.from_site_id : null,
        transferFromSiteName: xferIn ? (xferIn.from_site as any)?.name_th ?? null : null,
        transferTime: xferOut?.transfer_time ?? xferIn?.transfer_time ?? null,
        siteACost,
        siteBCost,
        photoUrl: evt.photo_url ?? null,
      };
    });

    // Compute labor cost
    let laborCost = 0;
    let transferCostOut = 0;
    let transferCostIn = 0;

    for (const row of workerRows) {
      const xferOut = transfersOut.find((t) => t.worker_id === row.workerId);
      if (xferOut) {
        laborCost += row.siteACost ?? 0;
        transferCostOut += row.wageAmount - (row.siteACost ?? 0);
      } else {
        laborCost += row.wageAmount;
      }
    }

    // Inbound transfer costs
    for (const xfer of transfersIn) {
      const origAttendance = allAttendance.find(
        (e) => e.worker_id === xfer.worker_id && e.site_id === xfer.from_site_id
      );
      if (origAttendance && xfer.worker) {
        const arrivalTime = origAttendance.arrival_time ?? "07:00";
        const split = computeTransferCostSplit(arrivalTime, xfer.transfer_time, (xfer.worker as any).daily_wage);
        transferCostIn += split.siteBCostBaht;
      }
    }

    // Overtime for this site
    const siteOvertime = allOvertime.filter((o) => o.site_id === site.id);
    const overtimeCost = siteOvertime.reduce((s, o) => s + Number(o.amount), 0);
    const overtimeRows: OvertimeRow[] = siteOvertime.map((o) => ({
      workerId: o.worker_id,
      workerNameTh: (o.worker as any)?.name_th ?? "",
      overtimeHours: o.overtime_hours,
      amount: o.amount,
    }));

    // Receipts for this site
    const siteReceipts = allReceipts.filter((r) => r.site_id === site.id);
    const receiptTotal = siteReceipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const receiptRows: ReceiptReportRow[] = siteReceipts.map((r) => ({
      receiptId: r.id,
      supplierNameTh: (r.supplier as any)?.name_th ?? null,
      amount: Number(r.amount ?? 0),
      status: r.status,
      paidFromDriverCash: r.paid_from_driver_cash ?? false,
      siteId: r.site_id,
      siteNameTh: site.name_th,
    }));

    const totalLaborCost = laborCost + transferCostIn + overtimeCost;

    siteReports.push({
      siteId: site.id,
      siteNameTh: site.name_th,
      siteNameEn: site.name_en ?? "",
      status: site.status ?? "waiting",
      wageDecision: dayStatus?.wage_decision ?? null,
      workers: workerRows,
      presentCount: workerRows.filter((w) => w.status !== "missing").length,
      lateCount: workerRows.filter((w) => w.isLate).length,
      missingCount: workerRows.filter((w) => w.status === "missing" || w.status === "day_off").length,
      transferOutCount: transfersOut.length,
      transferInCount: transfersIn.length,
      overtimeRows,
      laborCost,
      transferCostOut,
      transferCostIn,
      overtimeCost,
      totalLaborCost,
      receipts: receiptRows,
      receiptTotal,
      totalSiteCost: totalLaborCost + receiptTotal,
    });
  }

  // ── 10. Totals ───────────────────────────────────────────────────────────────
  const totals: DailyReportTotals = {
    totalPresent:       siteReports.reduce((s, r) => s + r.presentCount, 0),
    totalLate:          siteReports.reduce((s, r) => s + r.lateCount, 0),
    totalMissing:       siteReports.reduce((s, r) => s + r.missingCount, 0),
    totalTransfers:     allTransfers.length,
    totalLaborCost:     siteReports.reduce((s, r) => s + r.totalLaborCost, 0),
    totalOvertimeCost:  siteReports.reduce((s, r) => s + r.overtimeCost, 0),
    totalReceiptAmount: siteReports.reduce((s, r) => s + r.receiptTotal, 0),
    totalExpenses:      siteReports.reduce((s, r) => s + r.totalSiteCost, 0),
  };

  // ── 11. Expense categories by severity ──────────────────────────────────────
  const categoryMap = new Map<string, { amount: number; count: number; nameTh: string }>();

  // Labor as a category
  categoryMap.set("labor", { amount: totals.totalLaborCost, count: totals.totalPresent, nameTh: "ค่าแรง · Labor" });

  // Receipt categories
  for (const r of allReceipts) {
    const cat = r.receipt_category ?? "other";
    const existing = categoryMap.get(cat) ?? { amount: 0, count: 0, nameTh: cat };
    categoryMap.set(cat, {
      amount: existing.amount + Number(r.amount ?? 0),
      count: existing.count + 1,
      nameTh: existing.nameTh,
    });
  }

  const categoryList = Array.from(categoryMap.entries()).map(([category, { amount, count, nameTh }]) => ({
    category,
    nameTh,
    amount,
    count,
  }));

  const expenseCategories = rankByseverity(categoryList, totals.totalExpenses, totals.totalPresent + allReceipts.length);

  return {
    date,
    generatedAt,
    isBlocked: blockReasons.length > 0,
    blockReasons,
    sites: siteReports,
    totals,
    expenseCategories,
    corrections: (corrections ?? []).map((c) => ({
      id: c.id,
      entityType: c.entity_type,
      fieldName: c.field_name,
      originalValue: c.original_value,
      correctedValue: c.corrected_value,
      reason: c.reason,
      correctedAt: c.corrected_at,
    })),
  };
}
