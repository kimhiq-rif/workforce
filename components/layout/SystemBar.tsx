"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useRef, useState } from "react";
import { Bell, Calendar, ChevronDown, LogIn, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatEnDate, nowBangkok } from "@/lib/format";

interface SystemBarProps {
  userInitials?: string;
  userName?: string;
  notificationCount?: number;
}


// ── Weather panel ─────────────────────────────────────────────────────────────
interface WeatherState {
  currentTemp: number;
  maxTemp: number;
  // Rain forecast: null = no rain, otherwise first hour ≥40% precip
  rainFromHour: string | null;
  rainPeak: number;         // peak precipitation % today
  rainHours: string[];      // all hours with ≥40% precip (for range display)
}

function WeatherPanel() {
  const [wx, setWx] = useState<WeatherState | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hourly || !data.daily) return;
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
        const allIdxs: number[] = data.hourly.time
          .map((t: string, i: number) => ({ t, i }))
          .filter(({ t }: { t: string }) => t.startsWith(todayStr))
          .map(({ i }: { i: number }) => i as number);

        const nowHour = parseInt(
          new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date()),
          10,
        );
        const currentIdx = allIdxs[Math.max(0, Math.min(allIdxs.length - 1, nowHour))];

        // Build hourly precip list for whole day (00–23)
        const hourlyPrecip: Array<{ hour: string; prob: number }> = allIdxs.map((i) => ({
          hour: (data.hourly.time[i] as string).split("T")[1].slice(0, 5),
          prob: data.hourly.precipitation_probability[i] as number,
        }));

        const rainEntries = hourlyPrecip.filter((h) => h.prob >= 40);
        const peakProb = rainEntries.length > 0 ? Math.max(...rainEntries.map((h) => h.prob)) : 0;

        setWx({
          currentTemp: Math.round(data.hourly.temperature_2m[currentIdx] ?? data.daily.temperature_2m_max[0]),
          maxTemp: Math.round(data.daily.temperature_2m_max[0]),
          rainFromHour: rainEntries.length > 0 ? rainEntries[0].hour : null,
          rainPeak: peakProb,
          rainHours: rainEntries.map((h) => h.hour),
        });
      })
      .catch(() => {});
  }, []);

  if (!wx) {
    return (
      <div className="system-card" style={{ minWidth: 160, gap: 8 }}>
        <span style={{ fontSize: 18 }}>🌤️</span>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Koh Phangan…</div>
      </div>
    );
  }

  const hasRain = wx.rainFromHour !== null;
  // Determine rain severity colour
  const rainColor = wx.rainPeak >= 70 ? "#1D4ED8" : wx.rainPeak >= 50 ? "#3B82F6" : "#60A5FA";
  // Last rain hour for range display
  const lastRainHour = wx.rainHours.length > 1 ? wx.rainHours[wx.rainHours.length - 1] : null;

  return (
    <div
      className="system-card"
      style={{ gap: 10, minWidth: 190, padding: "0 14px" }}
    >
      {/* Temp */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{wx.currentTemp}°C</div>
        <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>↑{wx.maxTemp}° · Koh Phangan</div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: "var(--border)", flexShrink: 0 }} />

      {/* Rain forecast */}
      {hasRain ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>🌧️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: rainColor }}>
              {wx.rainFromHour?.slice(0, 5)}
              {lastRainHour ? `–${lastRainHour.slice(0, 5)}` : ""}
            </span>
          </div>
          <div style={{ fontSize: 9.5, color: rainColor, fontWeight: 600 }}>
            גשם צפוי · {wx.rainPeak}% peak
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>☀️</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#15803D" }}>לא צפוי גשם</span>
          </div>
          <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>No rain today</div>
        </div>
      )}
    </div>
  );
}

// ── Elegant chime synthesizer ─────────────────────────────────────────────────
function playChime(type: "task" | "meeting") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = type === "meeting" ? [523.25, 659.25, 783.99] : [783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (type === "meeting" ? 1.8 : 1.2));
      osc.start(start);
      osc.stop(start + (type === "meeting" ? 2.0 : 1.4));
    });
  } catch {}
}

// Repeating chime: plays every 8 seconds, 4 times (≈30s). Returns a cancel fn.
function startRepeatingChime(type: "task" | "meeting"): () => void {
  playChime(type);
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 1; i <= 3; i++) {
    timers.push(setTimeout(() => playChime(type), i * 8_000));
  }
  return () => timers.forEach(clearTimeout);
}

// ── Calendar panel ────────────────────────────────────────────────────────────
interface CalendarItem {
  siteNameTh: string;
  status: string;
}

interface CalEvent {
  id: string;
  title: string;
  event_type: "task" | "meeting";
  event_time: string | null;
  reminder_minutes: number;
  is_done: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  live: "#06B6D4",
  finished: "#22C55E",
  rain: "#3B82F6",
  day_off: "#3B82F6",
  review: "#F59E0B",
  waiting: "#F97316",
  critical: "#EF4444",
  half_day: "#F59E0B",
};

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const THAI_DAYS = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];

const BLINK_COLORS = ["var(--surface)", "#FF6A00", "#7C3AED", "white"];

function CalendarPanel() {
  const supabase = createClient();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set());
  // Alert state: events whose reminder fired but not snoozed
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());
  const [toastNotif, setToastNotif] = useState<{ title: string; body: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snoozed: id → snooze-until timestamp
  const [snoozedUntil, setSnoozedUntil] = useState<Map<string, number>>(new Map());
  // Blink phase for animation (0-3)
  const [blinkPhase, setBlinkPhase] = useState(0);
  // Cancel fn for repeating chime
  const cancelChimeRef = useRef<(() => void) | null>(null);

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const d = new Date(todayStr + "T12:00:00");
  const dayLabel = `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("id, role, owner_id")
        .eq("auth_id", user.id)
        .single();
      if (!profile) return;
      const ownerId = profile.role === "owner" ? profile.id : profile.owner_id;

      const [{ data: statusData }, { data: evData }] = await Promise.all([
        supabase
          .from("site_day_status_events")
          .select("status, site:site_id(name_th)")
          .eq("owner_id", ownerId)
          .eq("event_date", todayStr)
          .order("set_at", { ascending: true })
          .limit(3),
        supabase
          .from("calendar_events")
          .select("id, title, event_type, event_time, reminder_minutes, is_done")
          .eq("owner_id", ownerId)
          .eq("event_date", todayStr)
          .eq("is_done", false)
          .order("event_time", { ascending: true, nullsFirst: false })
          .limit(5),
      ]);

      if (statusData) {
        setItems(statusData.map((row) => ({
          siteNameTh: (row.site as unknown as { name_th: string } | null)?.name_th ?? "–",
          status: row.status,
        })));
      }
      if (evData) setCalEvents(evData as CalEvent[]);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  // Blink animation when there are active alerts
  useEffect(() => {
    if (alertIds.size === 0) return;
    const timer = setInterval(() => {
      setBlinkPhase((p) => (p + 1) % BLINK_COLORS.length);
    }, 500);
    return () => clearInterval(timer);
  }, [alertIds.size]);

  // Check every 30 seconds if any reminder is due
  useEffect(() => {
    function checkReminders() {
      const nowMs = Date.now();
      calEvents.forEach((ev) => {
        if (!ev.event_time || firedIds.has(ev.id)) return;
        // Check if snooze is still active
        const snoozeExp = snoozedUntil.get(ev.id);
        if (snoozeExp && nowMs < snoozeExp) return;

        const [h, m] = ev.event_time.split(":").map(Number);
        // Reminder fires at event_time - reminder_minutes
        const eventMs = new Date(todayStr + "T00:00:00").getTime() + (h * 60 + m - ev.reminder_minutes) * 60_000;

        // 5-minute window to catch the reminder even if polling misses the exact second
        if (nowMs >= eventMs && nowMs < eventMs + 5 * 60_000) {
          // Mark as fired
          setFiredIds((prev) => { const s = new Set(prev); s.add(ev.id); return s; });
          // Add to alert set (triggers blink)
          setAlertIds((prev) => { const s = new Set(prev); s.add(ev.id); return s; });
          // Cancel any previous repeating chime
          cancelChimeRef.current?.();
          // Start repeating chime
          cancelChimeRef.current = startRepeatingChime(ev.event_type);
          // Notification: in-app toast when visible, native when backgrounded
          const notifTitle = ev.event_type === "meeting" ? "📅 Meeting" : "✅ Task";
          const notifBody = `${ev.title}${ev.reminder_minutes > 0 ? ` · in ${ev.reminder_minutes}m` : ""}`;
          if (document.hidden) {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(notifTitle, { body: notifBody, silent: true });
            }
          } else {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setToastNotif({ title: notifTitle, body: notifBody });
            toastTimerRef.current = setTimeout(() => setToastNotif(null), 5000);
          }
        }
      });
    }

    // Run immediately once, then every 30 seconds
    checkReminders();
    const timer = setInterval(checkReminders, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calEvents, todayStr]);

  function handleSnooze(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Cancel chime
    cancelChimeRef.current?.();
    cancelChimeRef.current = null;
    // Clear alert state — snooze all active alerts for 10 minutes
    const snoozeUntil = Date.now() + 10 * 60_000;
    setSnoozedUntil((prev) => {
      const m = new Map(prev);
      alertIds.forEach((id) => m.set(id, snoozeUntil));
      return m;
    });
    // Un-fire them so they can re-trigger after snooze expires
    setFiredIds((prev) => {
      const s = new Set(prev);
      alertIds.forEach((id) => s.delete(id));
      return s;
    });
    setAlertIds(new Set());
  }

  const upcomingEvents = calEvents.slice(0, 3);
  const hasAlert = alertIds.size > 0;
  const alertBg = hasAlert ? BLINK_COLORS[blinkPhase] : undefined;

  return (
    <>
    <div
      className="system-card"
      style={{
        flexDirection: "column",
        gap: 4,
        minWidth: 220,
        maxWidth: 270,
        padding: "7px 14px",
        alignItems: "stretch",
        cursor: "pointer",
        transition: "background 0.2s",
        background: alertBg,
        position: "relative",
      }}
    >
      {/* Date header — clicking navigates to calendar */}
      <Link
        href="/calendar"
        style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 6 }}
      >
        <Calendar size={13} color={hasAlert ? "#FF6A00" : "var(--brand-primary)"} />
        <span style={{ fontSize: 12, fontWeight: 700, color: hasAlert ? "#FF6A00" : "var(--text-primary)" }}>
          {dayLabel}
        </span>
        {hasAlert && (
          <span style={{
            marginLeft: "auto",
            fontSize: 9,
            fontWeight: 700,
            color: "white",
            background: "#EF4444",
            borderRadius: 8,
            padding: "1px 5px",
          }}>
            {alertIds.size}
          </span>
        )}
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {upcomingEvents.length === 0 && items.length === 0 && (
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>No events today</span>
        )}

        {/* Calendar tasks/meetings */}
        {upcomingEvents.map((ev) => (
          <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block",
              background: alertIds.has(ev.id)
                ? "#EF4444"
                : ev.event_type === "meeting" ? "#EA580C" : "#1D4ED8",
            }} />
            <span style={{
              color: alertIds.has(ev.id) ? "#EF4444" : "var(--text-primary)",
              fontWeight: alertIds.has(ev.id) ? 700 : 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
            }}>
              {ev.event_time ? ev.event_time.slice(0, 5) + " " : ""}{ev.title}
            </span>
          </div>
        ))}

        {/* Site statuses (if no calendar events) */}
        {upcomingEvents.length === 0 && items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0, display: "inline-block",
              background: STATUS_COLORS[item.status] ?? "#6B7280",
            }} />
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.siteNameTh}</span>
          </div>
        ))}
      </div>

      {/* Snooze button — appears when alerts are active */}
      {hasAlert && (
        <button
          onClick={handleSnooze}
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 700,
            background: "#7C3AED",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "2px 7px",
            cursor: "pointer",
            letterSpacing: 0.3,
          }}
          title="Snooze 10 minutes"
        >
          เลื่อน 10′ · Snooze
        </button>
      )}
    </div>
    {toastNotif && (
      <div className="toast">
        <span>{toastNotif.title}</span>
        <span style={{ fontWeight: 400, marginLeft: 8, opacity: 0.85 }}>{toastNotif.body}</span>
      </div>
    )}
    </>
  );
}

// ── Main SystemBar ────────────────────────────────────────────────────────────
export function SystemBar({
  userInitials = "SK",
  userName = "เจ้าของ",
  notificationCount = 0,
}: SystemBarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [time, setTime] = useState(nowBangkok());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => {
    const timer = setInterval(() => setTime(nowBangkok()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    supabase.auth.getUser().then(({ data }) => {
      setConnectedEmail(data.user?.email ?? null);
    });
  }, [drawerOpen, supabase.auth]);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthLoading(false);
      setAuthError(error.message);
      return;
    }
    const bootstrapResponse = await fetch("/api/auth/bootstrap", { method: "POST" });
    if (!bootstrapResponse.ok) {
      const result = await bootstrapResponse.json();
      setAuthLoading(false);
      setAuthError(result.error ?? "Could not connect owner profile");
      return;
    }
    setAuthLoading(false);
    setConnectedEmail(email);
    setPassword("");
    setAuthSuccess("Owner connected successfully");
    router.refresh();
    setTimeout(() => setDrawerOpen(false), 900);
  }

  async function handleSignOut() {
    setAuthLoading(true);
    await supabase.auth.signOut();
    setAuthLoading(false);
    setConnectedEmail(null);
    setEmail("");
    setPassword("");
    setDrawerOpen(false);
    router.push("/login");
  }

  return (
    <header className="system-bar desktop-only">
      {/* Clock — leftmost */}
      <div className="system-card">
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{time}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{formatEnDate(now)}</div>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Calendar panel */}
      <CalendarPanel />

      {/* Weather panel */}
      <WeatherPanel />

      {/* Bell + User — rightmost */}
      <div className="profile-area" style={{ position: "relative" }}>
        <button
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            color: "var(--text-primary)",
          }}
          aria-label="Notifications"
        >
          <Bell size={22} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#EF4444",
                color: "white",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setDrawerOpen((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
          aria-expanded={drawerOpen}
          aria-label="Owner account menu"
          title={userName}
        >
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{userInitials}</div>
          <ChevronDown size={13} color="var(--text-muted)" />
        </button>

        {drawerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 320,
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              zIndex: 60,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong style={{ display: "block", fontSize: 15 }}>Owner account</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Connect or disconnect the owner session.
                </small>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{userInitials}</div>
              <div>
                <strong style={{ display: "block", fontSize: 14 }}>{userName}</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {connectedEmail ? `Connected: ${connectedEmail}` : "No owner email loaded"}
                </small>
              </div>
            </div>

            {connectedEmail && (
              <div style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginTop: 12, fontWeight: 600 }}>
                Connected owner session
              </div>
            )}

            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Owner email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="owner@example.com"
                  autoComplete="email"
                  style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                />
              </label>
              {authError && (
                <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  {authSuccess}
                </div>
              )}
              <button
                className="btn-primary"
                disabled={authLoading || !email || !password}
                type="submit"
                style={{ justifyContent: "center" }}
              >
                <LogIn size={16} />
                {authLoading ? "Connecting..." : "Connect owner"}
              </button>
            </form>

            <button
              onClick={handleSignOut}
              disabled={authLoading}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                color: "#B91C1C",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <LogOut size={16} />
              Disconnect owner
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
