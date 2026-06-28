"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { formatCurrency } from "@/lib/format";
import { ChevronLeft, ChevronRight, CirclePlus, Check, X, CalendarDays, Users, Bell, Camera, Loader2, MapPin } from "lucide-react";

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

const REMINDER_OPTIONS = [
  { value: 0,   label: "At time of event", labelTh: "ตรงเวลา" },
  { value: 10,  label: "10 minutes before", labelTh: "10 นาทีก่อน" },
  { value: 15,  label: "15 minutes before", labelTh: "15 นาทีก่อน" },
  { value: 30,  label: "30 minutes before", labelTh: "30 นาทีก่อน" },
  { value: 60,  label: "1 hour before", labelTh: "1 ชั่วโมงก่อน" },
  { value: 120, label: "2 hours before", labelTh: "2 ชั่วโมงก่อน" },
  { value: 1440, label: "1 day before", labelTh: "1 วันก่อน" },
];

interface CalendarEvent {
  id: string;
  title: string;
  event_type: "task" | "meeting";
  event_date: string;
  event_time: string | null;
  site_id: string | null;
  notes: string | null;
  reminder_minutes: number;
  is_done: boolean;
  image_url: string | null;
  image_lat: number | null;
  image_lng: number | null;
  image_taken_at: string | null;
}

interface CalendarClientProps {
  dayStatuses: any[];
  wageByDay: any[];
  calendarEvents: CalendarEvent[];
  sites: { id: string; name_th: string; name_en: string }[];
  today: string;
  ownerId: string;
}

export function CalendarClient({ dayStatuses, wageByDay, calendarEvents: initialEvents, sites, today, ownerId }: CalendarClientProps) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const [events, setEvents] = useState(initialEvents);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForDate, setAddForDate] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  // Deep link: /calendar?event=<id> — opened from push notification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    if (eventId) {
      const ev = initialEvents.find((e) => e.id === eventId);
      if (ev) setDetailEvent(ev);
    }
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    });
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return days;
  }, [viewDate]);

  function prevMonth() { setViewDate(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }); }
  function nextMonth() { setViewDate(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }); }

  const selectedData = selectedDay ? dayData.get(selectedDay) : null;
  const selectedStatuses = selectedDay ? dayStatuses.filter((d) => d.event_date === selectedDay) : [];
  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

  async function toggleDone(eventId: string, current: boolean) {
    await fetch("/api/calendar-events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, is_done: !current }),
    });
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, is_done: !current } : e));
  }

  const rightPanel = (
    <section className="attention-card">
      {selectedDay ? (
        <>
          <h2 style={{ marginBottom: 8 }}>
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
          </h2>

          {selectedData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>Total wages</span>
                <strong>฿{formatCurrency(selectedData.wage)}</strong>
              </div>
              {selectedStatuses.map((ds, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>{ds.site?.name_th ?? ds.site_id}</span>
                  <span style={{ background: `${STATUS_COLORS[ds.status]}20`, color: STATUS_COLORS[ds.status], borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{ds.status}</span>
                </div>
              ))}
            </div>
          )}

          {selectedEvents.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setDetailEvent(ev)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: ev.is_done ? "#F0FDF4" : ev.event_type === "meeting" ? "#FFF7ED" : "#EFF6FF", borderRadius: 8, border: `1px solid ${ev.is_done ? "#BBF7D0" : ev.event_type === "meeting" ? "#FED7AA" : "#BFDBFE"}`, cursor: "pointer" }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDone(ev.id, ev.is_done); }}
                    style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", border: `2px solid ${ev.is_done ? "#22C55E" : "#CBD5E1"}`, background: ev.is_done ? "#22C55E" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}
                  >
                    {ev.is_done && <Check size={11} color="white" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13, textDecoration: ev.is_done ? "line-through" : "none", color: ev.is_done ? "var(--text-muted)" : "var(--text-primary)" }}>{ev.title}</strong>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                      {ev.event_time && <small style={{ color: "var(--text-muted)", fontSize: 11 }}>⏰ {ev.event_time.slice(0, 5)}</small>}
                      <small style={{ fontSize: 11, fontWeight: 600, color: ev.event_type === "meeting" ? "#C2410C" : "#1D4ED8" }}>{ev.event_type === "meeting" ? "Meeting" : "Task"}</small>
                      {ev.reminder_minutes > 0 && <small style={{ color: "var(--text-muted)", fontSize: 11 }}>🔔 {ev.reminder_minutes}m</small>}
                      {ev.image_url && <Camera size={11} color="var(--text-muted)" />}
                    </div>
                    {ev.notes && <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{ev.notes}</small>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "8px" }}
            onClick={() => { setAddForDate(selectedDay); setShowAddModal(true); }}
          >
            <CirclePlus size={16} />
            Add event · เพิ่มกิจกรรม
          </button>
        </>
      ) : (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Select a day to view details</p>
      )}
    </section>
  );

  const calendarGrid = (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={prevMonth} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}><ChevronLeft size={22} /></button>
        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: 19 }}>{THAI_MONTHS[viewDate.month]} {viewDate.year + 543}</strong>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{EN_MONTHS[viewDate.month]} {viewDate.year}</div>
        </div>
        <button onClick={nextMonth} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6 }}><ChevronRight size={22} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--surface)" }}>
        {DAYS_TH.map((d, i) => (
          <div key={d} style={{ textAlign: "center", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: i === 0 ? "#EF4444" : "var(--text-muted)" }}>
            {d}<span style={{ display: "block", fontSize: 10, opacity: 0.7 }}>{DAYS_EN[i]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
        {calendarDays.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const data = dayData.get(dateStr);
          const dayEvents = eventsByDay.get(dateStr) ?? [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const day = new Date(dateStr + "T00:00:00").getDay();
          const statusColor = data?.statuses.size ? STATUS_COLORS[Array.from(data.statuses)[0]] ?? null : null;
          const hasMeeting = dayEvents.some((e) => e.event_type === "meeting" && !e.is_done);
          const hasTask = dayEvents.some((e) => e.event_type === "task" && !e.is_done);

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDay(dateStr)}
              style={{
                padding: "6px 4px",
                textAlign: "center",
                cursor: "pointer",
                border: isSelected ? "2px solid var(--brand-primary)" : "1px solid transparent",
                borderRadius: 8,
                margin: 2,
                background: isSelected ? "#EFF6FF" : isToday ? "#F0FDF4" : "transparent",
                minHeight: 60,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: day === 0 ? "#EF4444" : "var(--text-primary)" }}>
                {new Date(dateStr + "T00:00:00").getDate()}
                {isToday && <span style={{ display: "block", width: 4, height: 4, background: "#22C55E", borderRadius: "50%", margin: "2px auto 0" }} />}
              </div>
              <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3, flexWrap: "wrap" }}>
                {statusColor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />}
                {hasMeeting && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F97316", display: "inline-block" }} title="Meeting" />}
                {hasTask && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D4ED8", display: "inline-block" }} title="Task" />}
              </div>
              {data?.wage ? <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>฿{formatCurrency(data.wage)}</div> : null}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, padding: "12px 20px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        {[
          { label: "Live", color: "#06B6D4" },
          { label: "Rain", color: "#3B82F6" },
          { label: "Review", color: "#F59E0B" },
          { label: "Meeting", color: "#F97316" },
          { label: "Task", color: "#1D4ED8" },
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
    <>
      <DashboardShell rightPanel={rightPanel}>
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>ปฏิทิน</h1>
              <p>Calendar · {THAI_MONTHS[viewDate.month]} {viewDate.year + 543}</p>
            </div>
            <button className="btn-primary" onClick={() => { setAddForDate(selectedDay ?? today); setShowAddModal(true); }}>
              <CirclePlus size={20} />
              Add event
              <small>เพิ่มกิจกรรม</small>
            </button>
          </div>
          {calendarGrid}
        </div>

        <div className="mobile-only">
          <div className="mobile-topbar">
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "white" }}>
                <span className="th-text">ปฏิทิน</span>
                <span className="en-text">Calendar</span>
              </h1>
            </div>
            <button onClick={() => { setAddForDate(selectedDay ?? today); setShowAddModal(true); }} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
              <CirclePlus size={24} />
            </button>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {calendarGrid}
            {selectedDay && (selectedData || selectedEvents.length > 0) && (
              <div style={{ marginTop: 12, background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)" }}>
                {selectedData && <strong style={{ fontSize: 15 }}>฿{formatCurrency(selectedData.wage)} <span className="th-text">ค่าแรง</span><span className="en-text">wages</span></strong>}
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setDetailEvent(ev)}
                    style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ev.event_type === "meeting" ? "#F97316" : "#1D4ED8", display: "inline-block", flexShrink: 0 }} />
                    {ev.title} {ev.event_time ? `· ${ev.event_time.slice(0, 5)}` : ""}
                    {ev.image_url && <Camera size={11} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>

      {showAddModal && (
        <AddEventModal
          initialDate={addForDate ?? today}
          sites={sites}
          onClose={() => setShowAddModal(false)}
          onAdded={(ev) => {
            setEvents((prev) => [...prev, ev]);
            setShowAddModal(false);
            showToast(`Added: ${ev.title}`);
          }}
        />
      )}

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </>
  );
}

function EventDetailModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const isMeeting = event.event_type === "meeting";
  const accentColor = isMeeting ? "#EA580C" : "#1D4ED8";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        {event.image_url && (
          <div style={{ position: "relative" }}>
            <img src={event.image_url} alt="Event photo" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: "16px 16px 0 0", display: "block" }} />
            <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={18} color="white" />
            </button>
          </div>
        )}

        <div style={{ padding: "20px 24px 24px" }}>
          {!event.image_url && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
            </div>
          )}

          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1 }}>
            {isMeeting ? "🤝 Meeting" : "📋 Task"}
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4, marginBottom: 14, color: "var(--text-primary)" }}>{event.title}</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-muted)" }}>
              <span>📅 {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}</span>
              {event.event_time && <span>⏰ {event.event_time.slice(0, 5)}</span>}
            </div>

            {event.reminder_minutes > 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                🔔 Reminder {event.reminder_minutes}m before
              </div>
            )}

            {event.notes && (
              <div style={{ background: "var(--surface)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap", marginTop: 4 }}>
                {event.notes}
              </div>
            )}

            {(event.image_lat && event.image_lng) && (
              <a
                href={`https://www.google.com/maps?q=${event.image_lat},${event.image_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--brand-primary)", textDecoration: "none", marginTop: 4 }}
              >
                <MapPin size={14} />
                {event.image_lat.toFixed(5)}, {event.image_lng.toFixed(5)}
              </a>
            )}

            {event.image_taken_at && (
              <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                📷 Photo taken {new Date(event.image_taken_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
              </small>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEventModal({ initialDate, sites, onClose, onAdded }: {
  initialDate: string;
  sites: { id: string; name_th: string; name_en: string }[];
  onClose: () => void;
  onAdded: (ev: CalendarEvent) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    event_type: "task" as "task" | "meeting",
    event_date: initialDate,
    event_time: "",
    site_id: "",
    notes: "",
    reminder_minutes: 15,
    image_url: "",
    image_lat: null as number | null,
    image_lng: null as number | null,
    image_taken_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCameraOCR(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType: file.type }),
        });
        const data = await res.json();
        const text: string = data.text?.trim() ?? "";
        const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const title = lines[0] ?? "";
        const notes = lines.slice(1).join("\n");
        setForm((f) => ({ ...f, title, notes }));
      } catch {
        setError("OCR failed — please type manually · OCR ล้มเหลว");
      } finally {
        setOcrLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required · กรอกชื่อกิจกรรม"); return; }
    setSaving(true);
    const res = await fetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setError(result.error ?? "Error saving"); return; }
    onAdded(result.data);
  }

  const isMeeting = form.event_type === "meeting";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            <span className="th-text">เพิ่มกิจกรรม</span><span className="en-text">Add event</span>
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Type selector */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}><span className="th-text">ประเภทกิจกรรม</span><span className="en-text">Event type</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([
                { value: "task",    icon: <CalendarDays size={18} />, th: "งาน",    en: "Task",    sub: "รายการ · To-do",           color: "#1D4ED8" },
                { value: "meeting", icon: <Users size={18} />,        th: "ประชุม", en: "Meeting", sub: "แจ้งเตือนเสียง · Alert",    color: "#EA580C" },
              ] as const).map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setForm((f) => ({ ...f, event_type: opt.value }))}
                  style={{
                    border: `2px solid ${form.event_type === opt.value ? opt.color : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                    background: form.event_type === opt.value ? `${opt.color}0D` : "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: form.event_type === opt.value ? opt.color : "var(--text-primary)",
                  }}
                >
                  {opt.icon}
                  <div>
                    <strong style={{ fontSize: 14 }}><span className="th-text">{opt.th}</span><span className="en-text">{opt.en}</span></strong>
                    <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>{opt.sub}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Title */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span><span className="th-text">ชื่อกิจกรรม *</span><span className="en-text">Title *</span></span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
              >
                {ocrLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={16} />}
                <span>{ocrLoading ? "Reading..." : "📷 Scan"}</span>
              </button>
            </span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={isMeeting ? "Meeting with contractor" : "Order cement bags"}
              autoFocus
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }}
            />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleCameraOCR}
          />

          {/* Image preview after OCR */}
          {form.image_url && (
            <div style={{ position: "relative" }}>
              <img src={form.image_url} alt="Scanned" style={{ width: "100%", borderRadius: 8, maxHeight: 160, objectFit: "cover" }} />
              {form.image_lat && form.image_lng && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  <MapPin size={11} /> {form.image_lat.toFixed(5)}, {form.image_lng.toFixed(5)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image_url: "", image_lat: null, image_lng: null, image_taken_at: "" }))}
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={14} color="white" />
              </button>
            </div>
          )}

          {/* Date + Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}><span className="th-text">วันที่</span><span className="en-text">Date</span></span>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}><span className="th-text">เวลา (ถ้ามี)</span><span className="en-text">Time (optional)</span></span>
              <input
                type="time"
                value={form.event_time}
                onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
          </div>

          {/* Reminder */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Bell size={14} /> <span className="th-text">การแจ้งเตือน</span><span className="en-text">Push reminder</span>
            </span>
            <select
              value={form.reminder_minutes}
              onChange={(e) => setForm((f) => ({ ...f, reminder_minutes: Number(e.target.value) }))}
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            >
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {isMeeting && (
              <small style={{ color: "#EA580C", fontSize: 12 }}>
                🔔 Meeting alerts use an elegant long-tone sound notification.
              </small>
            )}
          </label>

          {/* Site (optional) */}
          {sites.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}><span className="th-text">ไซต์ที่เกี่ยวข้อง (ถ้ามี)</span><span className="en-text">Related site (optional)</span></span>
              <select
                value={form.site_id}
                onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              >
                <option value="">No specific site</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name_th} · {s.name_en}</option>)}
              </select>
            </label>
          )}

          {/* Notes */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}><span className="th-text">หมายเหตุ (ถ้ามี)</span><span className="en-text">Notes (optional)</span></span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Additional details..."
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, resize: "vertical" }}
            />
          </label>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
              <span className="th-text">ยกเลิก</span><span className="en-text">Cancel</span>
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center", background: isMeeting ? "#EA580C" : "var(--brand-primary)" }}>
              {saving
                ? <><span className="th-text">กำลังบันทึก…</span><span className="en-text">Saving…</span></>
                : isMeeting
                  ? <><span className="th-text">เพิ่มประชุม</span><span className="en-text">Add meeting</span></>
                  : <><span className="th-text">เพิ่มงาน</span><span className="en-text">Add task</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
