// Copyright © 2026 Workforce. All rights reserved.
// Core wage computation logic — matches spec exactly.

import type { WageReason, WageDecision, SiteStatus } from "@/types/database";

export const HALF_DAY_CUTOFF       = "12:00";
export const AFTERNOON_LATE_START  = "13:00";  // late deduction for afternoon half-day starts here
export const RAIN_BLOCK_AFTER      = "13:00";
export const DEFAULT_WORKDAY_START = "08:00";
export const ATTENDANCE_OPENS      = "07:00";
export const ATTENDANCE_CLOSES     = "17:00";
export const MISSING_THRESHOLD_HRS = 72;       // hours without report → RED missing

export function isAttendanceWindowOpen(currentTime: string): boolean {
  const mins = timeToMinutes(currentTime);
  return mins >= timeToMinutes(ATTENDANCE_OPENS) && mins < timeToMinutes(ATTENDANCE_CLOSES);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isLate(arrivalTime: string, workdayStart = DEFAULT_WORKDAY_START): boolean {
  return timeToMinutes(arrivalTime) > timeToMinutes(workdayStart);
}

export function isAfternoonArrival(arrivalTime: string): boolean {
  return timeToMinutes(arrivalTime) >= timeToMinutes(HALF_DAY_CUTOFF);
}

export function canSetRainStatus(currentTime: string): "ok" | "half_day" | "blocked" {
  const mins = timeToMinutes(currentTime);
  if (mins > timeToMinutes(RAIN_BLOCK_AFTER)) return "blocked";
  if (mins >= timeToMinutes("11:00")) return "half_day";
  return "ok";
}

export function computeAttendanceWageReason(
  arrivalTime: string | null,
  siteStatus: SiteStatus
): WageReason | null {
  // If site had rain/day_off declared before attendance, no pay
  if (siteStatus === "day_off") return "no_pay_day_off";

  if (!arrivalTime) return null; // missing

  if (isAfternoonArrival(arrivalTime)) return "half_day_afternoon_arrival";
  return "full_day";
}

// ── Late deduction — 1 THB per minute ────────────────────────────────────────
// Full day:            late after 08:00
// Afternoon half-day:  late after 13:00
// Temporary workers:   no deduction (isTemporary = true)
// Morning half-day / rain / day-off: no late deduction applies
export function computeLateDeduction(
  arrivalTime: string,
  wageReason: WageReason | null,
  isTemporary: boolean
): number {
  if (isTemporary) return 0;
  if (!wageReason) return 0;

  if (wageReason === "full_day") {
    const lateMinutes = timeToMinutes(arrivalTime) - timeToMinutes(DEFAULT_WORKDAY_START);
    return Math.max(0, lateMinutes); // 1 THB per minute
  }

  if (wageReason === "half_day_afternoon_arrival") {
    const lateMinutes = timeToMinutes(arrivalTime) - timeToMinutes(AFTERNOON_LATE_START);
    return Math.max(0, lateMinutes); // 1 THB per minute from 13:00
  }

  return 0; // half_day_morning_departure, rain, day_off — no late deduction
}

export function computeWageAmount(
  dailyWage: number,
  wageReason: WageReason | null,
  lateDeductionBaht = 0
): number {
  if (!wageReason) return 0;
  let base: number;
  switch (wageReason) {
    case "full_day":
      base = dailyWage; break;
    case "half_day_morning_departure":
    case "half_day_afternoon_arrival":
    case "half_day_rain":
    case "half_day_owner_decision":
      base = dailyWage / 2; break;
    case "no_pay_rain_before_attendance":
    case "no_pay_day_off":
    case "pending_owner_decision":
      return 0;
    default:
      base = dailyWage;
  }
  return Math.max(0, base - lateDeductionBaht);
}

export function getRainWageOptions(
  currentTime: string,
  hasAttendance: boolean
): {
  options: Array<{ value: WageDecision; labelTh: string; labelEn: string }>;
  canChange: boolean;
  defaultOption: WageDecision;
} {
  const status = canSetRainStatus(currentTime);

  if (status === "blocked") {
    return { options: [], canChange: false, defaultOption: "pending" };
  }

  if (!hasAttendance) {
    return {
      options: [{ value: "none", labelTh: "ไม่จ่าย", labelEn: "No pay" }],
      canChange: true,
      defaultOption: "none",
    };
  }

  const isBeforeNoon = timeToMinutes(currentTime) < timeToMinutes(HALF_DAY_CUTOFF);

  if (isBeforeNoon) {
    return {
      options: [
        { value: "half_day", labelTh: "ครึ่งวัน", labelEn: "Half day" },
        { value: "none", labelTh: "ไม่จ่าย", labelEn: "No pay" },
        { value: "pending", labelTh: "ถามอีกครั้งตอน 17:00", labelEn: "Ask at 17:00" },
      ],
      canChange: true,
      defaultOption: "half_day",
    };
  }

  return {
    options: [
      { value: "full_day", labelTh: "จ่ายเต็มวัน", labelEn: "Full day" },
      { value: "half_day", labelTh: "ครึ่งวัน", labelEn: "Half day" },
      { value: "pending", labelTh: "ถามอีกครั้งตอน 17:00", labelEn: "Ask at 17:00" },
    ],
    canChange: true,
    defaultOption: "full_day",
  };
}

// ── Transfer cost split ────────────────────────────────────────────────────────
// Wage = 1 full day (worker always paid full).
// COST is split proportionally between sites based on hours in 08:00–17:00 window.

const WORKDAY_START_MINS = 8 * 60;   // 08:00
const WORKDAY_END_MINS   = 17 * 60;  // 17:00
const WORKDAY_TOTAL_MINS = 9 * 60;   // 9 hours

export interface TransferCostSplit {
  siteACostBaht: number;   // cost charged to the first site (where worker arrived)
  siteBCostBaht: number;   // cost charged to the second site (where worker transferred to)
  hoursAtSiteA: number;
  hoursAtSiteB: number;
}

export function computeTransferCostSplit(
  arrivalTimeSiteA: string,  // actual arrival time (e.g. "07:30" or "09:00")
  transferTime: string,       // when worker moved to site B (e.g. "12:00")
  dailyWage: number
): TransferCostSplit {
  const arrivalMins   = Math.max(timeToMinutes(arrivalTimeSiteA), WORKDAY_START_MINS);
  const transferMins  = Math.min(timeToMinutes(transferTime), WORKDAY_END_MINS);
  const clampedArrival = Math.min(arrivalMins, WORKDAY_END_MINS);

  const minsAtA = Math.max(0, transferMins - clampedArrival);
  const minsAtB = Math.max(0, WORKDAY_END_MINS - transferMins);

  const total = minsAtA + minsAtB || WORKDAY_TOTAL_MINS;

  const siteACostBaht = Math.round((minsAtA / total) * dailyWage);
  const siteBCostBaht = dailyWage - siteACostBaht; // remainder avoids rounding gap

  return {
    siteACostBaht,
    siteBCostBaht,
    hoursAtSiteA: parseFloat((minsAtA / 60).toFixed(2)),
    hoursAtSiteB: parseFloat((minsAtB / 60).toFixed(2)),
  };
}

// ── Daily site cost aggregation ────────────────────────────────────────────────
// Used by daily report to aggregate all wage + overtime costs per site.

export interface AttendanceRecord {
  workerId: string;
  workerName: string;
  dailyWage: number;
  wageAmount: number;      // already stored on attendance_event
  wageReason: WageReason | null;
  isTransfer: boolean;
  transferFromSiteId?: string;
  transferTime?: string;
  arrivalTime?: string;
}

export interface OvertimeRecord {
  workerId: string;
  amount: number;
  overtimeHours: number;
}

export interface SiteDailyCost {
  siteId: string;
  laborCost: number;         // wages (including transfer cost share)
  overtimeCost: number;
  transferCostInbound: number;  // cost of workers who transferred IN to this site
  totalLaborCost: number;       // laborCost + overtimeCost
}

export function computeSiteDailyCosts(
  siteId: string,
  attendance: AttendanceRecord[],
  overtime: OvertimeRecord[],
  transferEvents: Array<{
    workerId: string;
    fromSiteId: string;
    toSiteId: string;
    transferTime: string;
    workerDailyWage: number;
    workerArrivalTime: string;
  }>
): SiteDailyCost {
  let laborCost = 0;
  let transferCostInbound = 0;

  for (const rec of attendance) {
    if (!rec.isTransfer) {
      // Regular worker: full wage cost to this site
      laborCost += rec.wageAmount;
    } else {
      // Worker transferred FROM this site to another:
      // Find the transfer event to compute the split
      const xfer = transferEvents.find(
        (t) => t.workerId === rec.workerId && t.fromSiteId === siteId
      );
      if (xfer) {
        const split = computeTransferCostSplit(
          xfer.workerArrivalTime,
          xfer.transferTime,
          xfer.workerDailyWage
        );
        laborCost += split.siteACostBaht;
      } else {
        laborCost += rec.wageAmount; // fallback: full cost
      }
    }
  }

  // Workers transferred IN to this site from elsewhere
  const inboundTransfers = transferEvents.filter((t) => t.toSiteId === siteId);
  for (const xfer of inboundTransfers) {
    const split = computeTransferCostSplit(
      xfer.workerArrivalTime,
      xfer.transferTime,
      xfer.workerDailyWage
    );
    transferCostInbound += split.siteBCostBaht;
  }

  const overtimeCost = overtime.reduce((s, o) => s + o.amount, 0);

  return {
    siteId,
    laborCost,
    overtimeCost,
    transferCostInbound,
    totalLaborCost: laborCost + transferCostInbound + overtimeCost,
  };
}

// ── Missing worker status ──────────────────────────────────────────────────────
export type MissingStatus = "late_today" | "missing_72h" | "absent_marked";

export function getMissingStatus(
  lastAttendanceDate: string | null, // YYYY-MM-DD
  todayDate: string
): MissingStatus {
  if (!lastAttendanceDate) return "missing_72h";
  const diffMs = new Date(todayDate).getTime() - new Date(lastAttendanceDate).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > MISSING_THRESHOLD_HRS ? "missing_72h" : "late_today";
}

// ── Severity score ─────────────────────────────────────────────────────────────
// Used in reports to rank expense categories.
// severity = (category_amount / total_expenses * 70) + (category_count / total_events * 30)

export function computeSeverityScore(
  categoryAmount: number,
  totalExpenses: number,
  categoryCount: number,
  totalEvents: number
): number {
  if (totalExpenses === 0 || totalEvents === 0) return 0;
  return (categoryAmount / totalExpenses) * 70 + (categoryCount / totalEvents) * 30;
}

export function rankByseverity<T extends { amount: number; count: number }>(
  categories: T[],
  totalExpenses: number,
  totalEvents: number
): (T & { severityScore: number })[] {
  return categories
    .map((c) => ({
      ...c,
      severityScore: computeSeverityScore(c.amount, totalExpenses, c.count, totalEvents),
    }))
    .sort((a, b) => b.severityScore - a.severityScore);
}

export function wageReasonLabel(reason: WageReason | string | null): { th: string; en: string } {
  switch (reason) {
    case "full_day": return { th: "เต็มวัน", en: "Full day" };
    case "half_day_morning_departure": return { th: "ครึ่งวันเช้า (ออกก่อน 12:00)", en: "Half day AM (left before 12:00)" };
    case "half_day_afternoon_arrival": return { th: "ครึ่งวันบ่าย (เข้าหลัง 12:00)", en: "Half day PM (arrived after 12:00)" };
    case "half_day_rain": return { th: "ครึ่งวัน (ฝน)", en: "Half day (rain)" };
    case "half_day_owner_decision": return { th: "ครึ่งวัน (เจ้าของตัดสิน)", en: "Half day (owner decision)" };
    case "no_pay_rain_before_attendance": return { th: "ไม่จ่าย (ฝนก่อนรายงาน)", en: "No pay (rain before attendance)" };
    case "no_pay_day_off": return { th: "ไม่จ่าย (หยุดงาน)", en: "No pay (day off)" };
    case "pending_owner_decision": return { th: "รอเจ้าของตัดสินใจ", en: "Pending owner decision" };
    default: return { th: "-", en: "-" };
  }
}
