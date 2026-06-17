// Copyright © 2026 Workforce. All rights reserved.

import type { SiteStatus } from "@/types/database";

const STATUS_CONFIG: Record<SiteStatus, { th: string; en: string; className: string; color: string }> = {
  live:     { th: "กำลังดำเนินการ", en: "Live now",    className: "badge-live",     color: "#06B6D4" },
  finished: { th: "เสร็จแล้ว",      en: "Finished",    className: "badge-finished", color: "#22C55E" },
  rain:     { th: "ฝน",             en: "Rain",        className: "badge-rain",     color: "#3B82F6" },
  day_off:  { th: "วันหยุด",        en: "Day off",     className: "badge-dayoff",   color: "#3B82F6" },
  half_day: { th: "ครึ่งวัน",       en: "Half day",    className: "badge-check",    color: "#F59E0B" },
  waiting:  { th: "รอดำเนินการ",    en: "Waiting",     className: "badge-waiting",  color: "#F97316" },
  review:   { th: "รอตรวจสอบ",      en: "Check",       className: "badge-check",    color: "#F59E0B" },
};

export function siteStatusColor(status: SiteStatus): string {
  return STATUS_CONFIG[status]?.color ?? "#9CA3AF";
}

interface SiteStatusBadgeProps {
  status: SiteStatus;
  small?: boolean;
}

export function SiteStatusBadge({ status, small }: SiteStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.waiting;
  return (
    <span
      className={`badge ${config.className}`}
      style={small ? { padding: "3px 8px", fontSize: 11 } : undefined}
    >
      <span className="status-dot" style={{ background: config.color }} />
      {small ? (
        <span style={{ fontSize: 11, fontWeight: 600 }}>{config.th}</span>
      ) : (
        <span>
          <strong>{config.th}</strong>
          <small>{config.en}</small>
        </span>
      )}
    </span>
  );
}
