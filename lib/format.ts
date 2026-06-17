// Copyright © 2026 Workforce. All rights reserved.

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatTime(isoTime: string): string {
  if (!isoTime) return "-";
  const parts = isoTime.split(":");
  return `${parts[0]}:${parts[1]}`;
}

// Bangkok date from ISO string
export function bangkokDate(iso: string): Date {
  const d = new Date(iso);
  const offset = 7 * 60; // Bangkok is UTC+7
  return new Date(d.getTime() + offset * 60 * 1000);
}

// Format date as Thai Buddhist calendar short form, e.g. "18 พ.ค. 2568"
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function formatThaiDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const yearBE = d.getFullYear() + 543;
  return `${day} ${month} ${yearBE}`;
}

export function formatEnDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function nowBangkok(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}
