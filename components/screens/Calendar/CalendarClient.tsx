"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  live: "#06B6D4",
  rain: "#3B82F6",
  day_off: "#3B82F6",
  half_day: "#F59E0B",
  review: "#F59E0B",
  finished: "#22C55E",
  waiting: "#F97316",
};

interface CalendarClientProps {
  dayStatuses: any[];
  wageByDay: any[];
  today: string;
  ownerId: string;
}

export function CalendarClient({ dayStatuses, wageByDay, today, ownerId }: CalendarClientProps) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 }; // month 0-indexed
  });

  const [selectedDay, setSelectedDay] = useState<string | null>(today);

  // Aggregate status colors and wage per day
  const dayData = useMemo(() => {
    const map = new Map<string, { statuses: Set<string>; wage: number }>();

    dayStatuses.forEach((ds) => {
      const entry = map.get(ds.event_date) ?? { statuses: new Set(), wage: 0 };
      entry.statuses.add(ds.status);
      map.set(ds.event_date, entry);
    });

    wageByDay.forEach((w) => {
      const entry = map.get(w.event_date) ?? { statuses: new Set(), wage: 0 };
      entry.wage += w.wage_amount ?? 0;
      map.set(w.event_date, entry);
    });

    return map;
  }, [dayStatuses, wageByDay]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [viewDate]);

  function prevMonth() {
    setViewDate(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }
  function nextMonth() {
    setViewDate(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }

  const selectedData = selectedDay ? dayData.get(selectedDay) : null;
  const selectedStatuses = selectedDay ? dayStatuses.filter((d) => d.event_date === selectedDay) : [];

  const rightPanel = (
    <section className="attention-card">
      {selectedDay ? (
        <>
          <h2>
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
            <span>{new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </h2>
          {selectedData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-muted)" }}>ค่าแรงรวม · Total wages</span>
                <strong>฿{formatCurrency(selectedData.wage)}</strong>
              </div>
              {selectedStatuses.map((ds, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>{ds.site?.name_th ?? ds.site_id}</span>
                  <span style={{ background: `${STATUS_COLORS[ds.status]}20`, color: STATUS_COLORS[ds.status], borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                    {ds.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>ไม่มีข้อมูล · No data for this day</p>
          )}
        </>
      ) : (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>เลือกวัน · Select a day</p>
      )}
    </section>
  );

  const calendarGrid = (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {/* Month header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={prevMonth} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: 19 }}>{THAI_MONTHS[viewDate.month]} {viewDate.year + 543}</strong>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{EN_MONTHS[viewDate.month]} {viewDate.year}</div>
        </div>
        <button onClick={nextMonth} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--surface)" }}>
        {DAYS_TH.map((d, i) => (
          <div key={d} style={{ textAlign: "center", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: i === 0 ? "#EF4444" : "var(--text-muted)" }}>
            {d}
            <span style={{ display: "block", fontSize: 10, opacity: 0.7 }}>{DAYS_EN[i]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
        {calendarDays.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;

          const data = dayData.get(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const isPast = dateStr < today;
          const day = new Date(dateStr + "T00:00:00").getDay();
          const isSunday = day === 0;

          const statusColor = data?.statuses.size
            ? STATUS_COLORS[Array.from(data.statuses)[0]] ?? "var(--text-muted)"
            : null;

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDay(dateStr)}
              style={{
                padding: "8px 4px",
                textAlign: "center",
                cursor: "pointer",
                border: isSelected ? `2px solid var(--brand-primary)` : "1px solid transparent",
                borderRadius: 8,
                margin: 2,
                background: isSelected ? "#EFF6FF" : isToday ? "#F0FDF4" : "transparent",
                position: "relative",
                minHeight: 56,
              }}
            >
              <div style={{
                fontSize: 15,
                fontWeight: isToday ? 700 : 500,
                color: isSunday ? "#EF4444" : isPast ? "var(--text-muted)" : "var(--text-primary)",
              }}>
                {new Date(dateStr + "T00:00:00").getDate()}
                {isToday && <span style={{ display: "block", width: 4, height: 4, background: "#22C55E", borderRadius: "50%", margin: "2px auto 0" }} />}
              </div>
              {statusColor && (
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, margin: "3px auto 0" }} />
              )}
              {data?.wage ? (
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                  ฿{formatCurrency(data.wage)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, padding: "12px 20px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        {[
          { label: "ทำงาน · Live", color: "#06B6D4" },
          { label: "ฝน · Rain", color: "#3B82F6" },
          { label: "ตรวจ · Review", color: "#F59E0B" },
          { label: "เสร็จ · Finished", color: "#22C55E" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      {/* Desktop */}
      <div className="desktop-only">
        <div className="content-header">
          <div>
            <h1>ปฏิทิน</h1>
            <p>Calendar · {THAI_MONTHS[viewDate.month]} {viewDate.year + 543}</p>
          </div>
        </div>
        {calendarGrid}
      </div>

      {/* Mobile */}
      <div className="mobile-only">
        <div className="mobile-topbar">
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "white" }}>ปฏิทิน</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Calendar</p>
          </div>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {calendarGrid}
          {selectedDay && selectedData && (
            <div style={{ marginTop: 12, background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 15 }}>ค่าแรงรวม ฿{formatCurrency(selectedData.wage)}</strong>
              {selectedStatuses.map((ds, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{ds.site?.name_th} · {ds.status}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
