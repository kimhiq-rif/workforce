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
  absenceReason: string | null;
  absenceNote: string | null;
}

export interface NotReportedWorkerRow {
  workerId: string;
  nameTh: string;
  nameEn: string;
  dailyWage: number;
  isTemporary: boolean;
  assignedSiteId: string | null;
  assignedSiteNameTh: string | null;
  photoUrl: string | null;
}

export interface MarkedAbsenceRow {
  attendanceId: string;
  workerId: string;
  nameTh: string;
  nameEn: string;
  siteId: string | null;
  siteNameTh: string | null;
  reason: string | null;
  note: string | null;
  status: string;
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

export type ReceiptClosingIssueType =
  | "missing_supplier"
  | "missing_amount"
  | "missing_site"
  | "pending_action"
  | "problem_status";

export interface ReceiptClosingIssue {
  receiptId: string;
  receiptNumber: string | null;
  issueType: ReceiptClosingIssueType;
  messageTh: string;
  messageEn: string;
  status: string;
  amount: number | null;
  supplierNameTh: string | null;
  siteNameTh: string | null;
}

export interface ReceiptClosingSummary {
  approvedCount: number;
  approvedTotal: number;
  pendingWithAmountCount: number;
  pendingWithAmountTotal: number;
  pendingWithoutAmountCount: number;
  problematicCount: number;
  confirmedExpensesTotal: number;
  potentialTotalWithPendingReceipts: number;
  driverCashUsed: number;
  driverCashReceiptCount: number;
  issues: ReceiptClosingIssue[];
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
  potentialReceiptAmount: number;
  totalExpenses: number;         // labor + receipts
  potentialTotalExpenses: number;
  originalTotalExpenses: number | null;
  correctedTotalExpenses: number | null;
  correctionDelta: number;
}

export interface ExpenseCategory {
  category: string;
  nameTh: string;
  amount: number;
  count: number;
  severityScore: number;
}

export interface BlockReason {
  type: "pending_receipt" | "pending_wage_decision" | "pending_qr" | "receipt_closing";
  messageTh: string;
  messageEn: string;
  siteId?: string;
  receiptId?: string;
}

export interface DailyReportData {
  date: string;
  generatedAt: string;
  hostCompany: {
    name: string | null;
    logoUrl: string | null;
  };
  isBlocked: boolean;
  blockReasons: BlockReason[];
  sites: SiteReportData[];
  totals: DailyReportTotals;
  receiptClosing: ReceiptClosingSummary;
  notReportedWorkers: NotReportedWorkerRow[];
  markedAbsences: MarkedAbsenceRow[];
  expenseCategories: ExpenseCategory[];  // sorted by severity
  correctionSummary: {
    totalCorrections: number;
    financialCorrections: number;
    originalAmountSum: number;
    correctedAmountSum: number;
    delta: number;
  };
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

const CONFIRMED_RECEIPT_STATUSES = new Set(["paid", "approved"]);
const PENDING_RECEIPT_STATUSES = new Set([
  "pending",
  "pending_qr",
  "pending_payment",
  "pending_sorting",
  "paid_pending_sorting",
  "waiting_owner_payment",
]);
const PROBLEM_RECEIPT_STATUSES = new Set(["needs_review", "disputed"]);

function amountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function receiptLabel(receipt: any): string {
  return receipt.receipt_number ?? receipt.id;
}

function numericCorrectionValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function isFinancialCorrection(correction: any): boolean {
  const field = String(correction.field_name ?? "").toLowerCase();
  return field.includes("amount") || field.includes("wage") || field.includes("cost") || field.includes("total");
}

function buildCorrectionSummary(corrections: any[]) {
  let financialCorrections = 0;
  let originalAmountSum = 0;
  let correctedAmountSum = 0;

  for (const correction of corrections) {
    if (!isFinancialCorrection(correction)) continue;
    const original = numericCorrectionValue(correction.original_value);
    const corrected = numericCorrectionValue(correction.corrected_value);
    if (original === null || corrected === null) continue;
    financialCorrections += 1;
    originalAmountSum += original;
    correctedAmountSum += corrected;
  }

  return {
    totalCorrections: corrections.length,
    financialCorrections,
    originalAmountSum,
    correctedAmountSum,
    delta: correctedAmountSum - originalAmountSum,
  };
}

function buildReceiptClosingSummary(receipts: any[]): ReceiptClosingSummary {
  const issues: ReceiptClosingIssue[] = [];
  let approvedCount = 0;
  let approvedTotal = 0;
  let pendingWithAmountCount = 0;
  let pendingWithAmountTotal = 0;
  let pendingWithoutAmountCount = 0;
  let driverCashUsed = 0;
  let driverCashReceiptCount = 0;

  for (const receipt of receipts) {
    const amount = amountOrNull(receipt.amount);
    const status = String(receipt.status ?? "unknown");
    const supplierNameTh = (receipt.supplier as any)?.name_th ?? null;
    const siteNameTh = (receipt.site as any)?.name_th ?? null;
    const baseIssue = {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number ?? null,
      status,
      amount,
      supplierNameTh,
      siteNameTh,
    };

    if (CONFIRMED_RECEIPT_STATUSES.has(status)) {
      approvedCount += 1;
      approvedTotal += amount ?? 0;
    }

    if (PENDING_RECEIPT_STATUSES.has(status)) {
      if (amount === null) {
        pendingWithoutAmountCount += 1;
      } else {
        pendingWithAmountCount += 1;
        pendingWithAmountTotal += amount;
      }
    }

    if (receipt.paid_from_driver_cash && amount !== null) {
      driverCashReceiptCount += 1;
      driverCashUsed += amount;
    }

    if (!receipt.supplier_id) {
      issues.push({
        ...baseIssue,
        issueType: "missing_supplier",
        messageTh: `Receipt ${receiptLabel(receipt)} missing supplier`,
        messageEn: `Receipt ${receiptLabel(receipt)} is missing supplier`,
      });
    }

    if (amount === null) {
      issues.push({
        ...baseIssue,
        issueType: "missing_amount",
        messageTh: `Receipt ${receiptLabel(receipt)} missing amount`,
        messageEn: `Receipt ${receiptLabel(receipt)} is missing amount`,
      });
    }

    if (!receipt.site_id) {
      issues.push({
        ...baseIssue,
        issueType: "missing_site",
        messageTh: `Receipt ${receiptLabel(receipt)} missing site`,
        messageEn: `Receipt ${receiptLabel(receipt)} is missing site`,
      });
    }

    if (PENDING_RECEIPT_STATUSES.has(status)) {
      issues.push({
        ...baseIssue,
        issueType: "pending_action",
        messageTh: `Receipt ${receiptLabel(receipt)} pending action (${status})`,
        messageEn: `Receipt ${receiptLabel(receipt)} pending action (${status})`,
      });
    }

    if (PROBLEM_RECEIPT_STATUSES.has(status)) {
      issues.push({
        ...baseIssue,
        issueType: "problem_status",
        messageTh: `Receipt ${receiptLabel(receipt)} has problem status (${status})`,
        messageEn: `Receipt ${receiptLabel(receipt)} has problem status (${status})`,
      });
    }
  }

  return {
    approvedCount,
    approvedTotal,
    pendingWithAmountCount,
    pendingWithAmountTotal,
    pendingWithoutAmountCount,
    problematicCount: receipts.filter((r) => PROBLEM_RECEIPT_STATUSES.has(String(r.status))).length,
    confirmedExpensesTotal: approvedTotal,
    potentialTotalWithPendingReceipts: approvedTotal + pendingWithAmountTotal,
    driverCashUsed,
    driverCashReceiptCount,
    issues,
  };
}

export async function buildDailyReport(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  date: string
): Promise<DailyReportData> {
  const generatedAt = new Date().toISOString();
  const blockReasons: BlockReason[] = [];

  const { data: reportSettings } = await supabase
    .from("workday_settings")
    .select("hosted_company_name, hosted_company_logo_url")
    .eq("owner_id", ownerId)
    .maybeSingle();

  // ── 1. Fetch all active sites ───────────────────────────────────────────────
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status, color")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const { data: workers } = await supabase
    .from("workers")
    .select(`
      id, name_th, name_en, daily_wage, is_temporary, assigned_site_id, photo_url,
      assigned_site:sites!assigned_site_id(id, name_th)
    `)
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // ── 2. Fetch attendance events for this date ────────────────────────────────
  const { data: attendanceEvents } = await supabase
    .from("attendance_events")
    .select(`
      id, site_id, worker_id, arrival_time, status, is_late,
      wage_reason, wage_amount, photo_url, absence_reason, absence_note,
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
      id, site_id, supplier_id, receipt_number, amount, status, paid_from_driver_cash,
      receipt_category, receipt_date,
      supplier:suppliers(name_th),
      site:sites(name_th)
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

  const allReceipts = receipts ?? [];
  const receiptClosing = buildReceiptClosingSummary(allReceipts);

  // Only truly-pending receipts block report generation. Data-quality issues
  // (missing supplier / amount / site, disputed status) are surfaced in the
  // receiptClosing summary but do NOT prevent the report from being produced.
  for (const issue of receiptClosing.issues) {
    if (issue.issueType !== "pending_action") continue;
    const type = issue.status.includes("qr") || issue.status === "waiting_owner_payment"
      ? "pending_qr" as const
      : "pending_receipt" as const;
    blockReasons.push({
      type,
      messageTh: issue.messageTh,
      messageEn: issue.messageEn,
      receiptId: issue.receiptId,
    });
  }

  // ── 8. Check blocking conditions ────────────────────────────────────────────
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
  const allDayStatuses = dayStatuses ?? [];
  const allWorkers = workers ?? [];
  const attendanceWorkerIds = new Set(allAttendance.map((event) => event.worker_id));

  const notReportedWorkers: NotReportedWorkerRow[] = allWorkers
    .filter((worker) => !attendanceWorkerIds.has(worker.id))
    .map((worker) => ({
      workerId: worker.id,
      nameTh: worker.name_th,
      nameEn: worker.name_en,
      dailyWage: Number(worker.daily_wage ?? 0),
      isTemporary: worker.is_temporary ?? false,
      assignedSiteId: worker.assigned_site_id ?? null,
      assignedSiteNameTh: (worker.assigned_site as any)?.name_th ?? null,
      photoUrl: worker.photo_url ?? null,
    }));

  const markedAbsences: MarkedAbsenceRow[] = allAttendance
    .filter((event) => event.status === "missing" || event.status === "day_off")
    .map((event) => {
      const site = (sites ?? []).find((s) => s.id === event.site_id);
      return {
        attendanceId: event.id,
        workerId: event.worker_id,
        nameTh: (event.worker as any)?.name_th ?? "",
        nameEn: (event.worker as any)?.name_en ?? "",
        siteId: event.site_id ?? null,
        siteNameTh: site?.name_th ?? null,
        reason: event.absence_reason ?? event.status,
        note: event.absence_note ?? null,
        status: event.status,
      };
    });

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
        absenceReason: evt.absence_reason ?? null,
        absenceNote: evt.absence_note ?? null,
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
    const receiptTotal = siteReceipts
      .filter((r) => CONFIRMED_RECEIPT_STATUSES.has(String(r.status)))
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
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
  const correctionSummary = buildCorrectionSummary(corrections ?? []);
  const currentTotalExpenses = siteReports.reduce((s, r) => s + r.totalLaborCost, 0) + receiptClosing.approvedTotal;
  const currentPotentialExpenses = siteReports.reduce((s, r) => s + r.totalLaborCost, 0) + receiptClosing.potentialTotalWithPendingReceipts;

  const totals: DailyReportTotals = {
    totalPresent:       siteReports.reduce((s, r) => s + r.presentCount, 0),
    totalLate:          siteReports.reduce((s, r) => s + r.lateCount, 0),
    totalMissing:       siteReports.reduce((s, r) => s + r.missingCount, 0),
    totalTransfers:     allTransfers.length,
    totalLaborCost:     siteReports.reduce((s, r) => s + r.totalLaborCost, 0),
    totalOvertimeCost:  siteReports.reduce((s, r) => s + r.overtimeCost, 0),
    totalReceiptAmount: receiptClosing.approvedTotal,
    potentialReceiptAmount: receiptClosing.potentialTotalWithPendingReceipts,
    totalExpenses:      currentTotalExpenses,
    potentialTotalExpenses: currentPotentialExpenses,
    originalTotalExpenses: correctionSummary.financialCorrections > 0 ? currentTotalExpenses - correctionSummary.delta : null,
    correctedTotalExpenses: correctionSummary.financialCorrections > 0 ? currentTotalExpenses : null,
    correctionDelta: correctionSummary.delta,
  };

  // ── 11. Expense categories by severity ──────────────────────────────────────
  const categoryMap = new Map<string, { amount: number; count: number; nameTh: string }>();

  // Labor as a category
  categoryMap.set("labor", { amount: totals.totalLaborCost, count: totals.totalPresent, nameTh: "ค่าแรง · Labor" });

  // Receipt categories
  for (const r of allReceipts) {
    if (!CONFIRMED_RECEIPT_STATUSES.has(String(r.status))) continue;
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
    hostCompany: {
      name: reportSettings?.hosted_company_name ?? null,
      logoUrl: reportSettings?.hosted_company_logo_url ?? null,
    },
    isBlocked: blockReasons.length > 0,
    blockReasons,
    sites: siteReports,
    totals,
    receiptClosing,
    notReportedWorkers,
    markedAbsences,
    expenseCategories,
    correctionSummary,
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
