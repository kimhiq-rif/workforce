// Copyright © 2026 Workforce. All rights reserved.
// Core wage computation logic — matches spec exactly.

import type { WageReason, WageDecision, SiteStatus } from "@/types/database";

export const HALF_DAY_CUTOFF = "12:00";
export const AFTERNOON_GRACE = "12:30";
export const RAIN_BLOCK_AFTER = "13:00";
export const DEFAULT_WORKDAY_START = "08:00";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isLate(arrivalTime: string, workdayStart = DEFAULT_WORKDAY_START): boolean {
  return timeToMinutes(arrivalTime) > timeToMinutes(workdayStart);
}

export function isAfternoonArrival(arrivalTime: string): boolean {
  const mins = timeToMinutes(arrivalTime);
  return mins >= timeToMinutes(HALF_DAY_CUTOFF) && mins <= timeToMinutes(AFTERNOON_GRACE);
}

export function isLateAfternoon(arrivalTime: string): boolean {
  return timeToMinutes(arrivalTime) > timeToMinutes(AFTERNOON_GRACE);
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

export function computeWageAmount(
  dailyWage: number,
  wageReason: WageReason | null
): number {
  if (!wageReason) return 0;
  switch (wageReason) {
    case "full_day":
      return dailyWage;
    case "half_day_morning_departure":
    case "half_day_afternoon_arrival":
    case "half_day_rain":
    case "half_day_owner_decision":
      return dailyWage / 2;
    case "no_pay_rain_before_attendance":
    case "no_pay_day_off":
    case "pending_owner_decision":
      return 0;
    default:
      return dailyWage;
  }
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
