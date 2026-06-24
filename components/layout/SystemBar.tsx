"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useState } from "react";
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

// ── WMO weather code → display ────────────────────────────────────────────────
function weatherIcon(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "แดดจัด" };
  if (code <= 2) return { emoji: "⛅", label: "มีเมฆบ้าง" };
  if (code <= 3) return { emoji: "☁️", label: "มีเมฆมาก" };
  if (code <= 48) return { emoji: "🌫️", label: "หมอก" };
  if (code <= 57) return { emoji: "🌦️", label: "ฝนปรอย" };
  if (code <= 67) return { emoji: "🌧️", label: "ฝนตก" };
  if (code <= 82) return { emoji: "🌦️", label: "ฝนปรอย" };
  if (code <= 86) return { emoji: "❄️", label: "หิมะ" };
  return { emoji: "⛈️", label: "พายุฝนฟ้าคะนอง" };
}

// ── Weather panel ─────────────────────────────────────────────────────────────
interface WeatherState {
  maxTemp: number;
  minTemp: number;
  code: number;
  hourlyPrecip: number[];
  hourlyTimes: string[];
}

function WeatherPanel() {
  const [wx, setWx] = useState<WeatherState | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hourly || !data.daily) return;
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
        const idxs: number[] = data.hourly.time
          .map((t: string, i: number) => ({ t, i }))
          .filter(({ t }: { t: string }) => t.startsWith(todayStr))
          .map(({ i }: { i: number }) => i as number);

        setWx({
          maxTemp: Math.round(data.daily.temperature_2m_max[0]),
          minTemp: Math.round(data.daily.temperature_2m_min[0]),
          code: data.daily.weathercode[0],
          hourlyPrecip: idxs.map((i) => data.hourly.precipitation_probability[i] as number),
          hourlyTimes: idxs.map((i) => (data.hourly.time[i] as string).split("T")[1].slice(0, 5)),
        });
      })
      .catch(() => {});
  }, []);

  const bangkokHour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date()),
    10,
  );

  if (!wx) {
    return (
      <div className="system-panel" style={{ minWidth: 190 }}>
        <div className="system-panel-top">
          <span style={{ fontSize: 20 }}>🌤️</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>กำลังโหลด...</span>
        </div>
        <div className="system-panel-bottom" />
      </div>
    );
  }

  const icon = weatherIcon(wx.code);
  const slicePrecip = wx.hourlyPrecip.slice(6, 21);
  const sliceTimes = wx.hourlyTimes.slice(6, 21);
  const currentBar = Math.max(0, Math.min(slicePrecip.length - 1, bangkokHour - 6));

  return (
    <div className="system-panel" style={{ minWidth: 200 }}>
      {/* Top: compact weather summary */}
      <div className="system-panel-top">
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>
            {wx.maxTemp}°C
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
            Koh Phangan · {icon.label}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, lineHeight: 1.7, flexShrink: 0 }}>
          <div style={{ color: "#0E7490", fontWeight: 600 }}>↑{wx.maxTemp}°</div>
          <div style={{ color: "var(--text-muted)" }}>↓{wx.minTemp}°</div>
        </div>
      </div>

      {/* Bottom: rain probability bars */}
      <div className="system-panel-bottom">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 24 }}>
          {slicePrecip.map((p, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(2, (p / 100) * 22),
                borderRadius: 2,
                background:
                  i === currentBar ? "#FF6A00"
                  : p > 60 ? "#3B82F6"
                  : p > 30 ? "#93C5FD"
                  : "#E2E8F0",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 2 }}>
          {sliceTimes.map((h, i) => {
            if (i % 3 !== 0) return <div key={i} style={{ flex: 1 }} />;
            const p = slicePrecip[i];
            const label = p >= 40 ? `${p}%` : h.slice(0, 2);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 8,
                  color: i === currentBar ? "#FF6A00" : p >= 40 ? "#3B82F6" : "var(--text-muted)",
                  fontWeight: i === currentBar || p >= 40 ? 700 : 400,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Calendar panel ────────────────────────────────────────────────────────────
interface CalendarItem {
  siteNameTh: string;
  status: string;
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

function CalendarPanel() {
  const supabase = createClient();
  const [items, setItems] = useState<CalendarItem[]>([]);

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const d = new Date(todayStr + "T12:00:00");
  const dayLabel = `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;

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

      const { data } = await supabase
        .from("site_day_status_events")
        .select("status, site:site_id(name_th)")
        .eq("owner_id", ownerId)
        .eq("event_date", todayStr)
        .order("set_at", { ascending: true })
        .limit(3);

      if (data) {
        setItems(
          data.map((row) => ({
            siteNameTh: (row.site as unknown as { name_th: string } | null)?.name_th ?? "–",
            status: row.status,
          })),
        );
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  return (
    <div className="system-panel" style={{ minWidth: 160 }}>
      {/* Top: date + event count */}
      <Link
        href="/calendar"
        className="system-panel-top"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <Calendar size={14} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>
          {dayLabel}
        </span>
        {items.length > 0 ? (
          <span
            style={{
              background: "#FF6A00",
              color: "white",
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 10,
              padding: "1px 6px",
              flexShrink: 0,
            }}
          >
            {items.length}
          </span>
        ) : (
          <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>ไม่มีกิจกรรม</span>
        )}
      </Link>

      {/* Bottom: site events or placeholder */}
      <div className="system-panel-bottom" style={{ gap: 3 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", opacity: 0.6 }}>
            — ไม่มีกิจกรรม —
          </div>
        ) : (
          items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: STATUS_COLORS[item.status] ?? "#6B7280",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.siteNameTh}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
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

  // Bangkok workday progress (08:00–17:00)
  const bangkokH = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" }).format(now),
    10,
  );
  const bangkokM = parseInt(
    new Intl.DateTimeFormat("en-US", { minute: "numeric", timeZone: "Asia/Bangkok" }).format(now),
    10,
  );
  const minutesSince8 = (bangkokH - 8) * 60 + bangkokM;
  const workdayPct = Math.min(100, Math.max(0, (minutesSince8 / (9 * 60)) * 100));

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
      {/* Spacer — pushes all panels to right */}
      <div style={{ flex: 1 }} />

      {/* ── Calendar (LARGE — integrated panel) ─────────────────────────────── */}
      <CalendarPanel />

      {/* ── Clock (SMALL — compact card, centered) ──────────────────────────── */}
      <div className="system-card" style={{ flexDirection: "column", gap: 4, minWidth: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {time}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatEnDate(now)}</div>
        {/* Workday progress: 08:00 → 17:00 */}
        <div style={{ width: "100%", marginTop: 2 }}>
          <div
            style={{
              height: 3,
              background: "#E5E7EB",
              borderRadius: 2,
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${workdayPct}%`,
                background: workdayPct >= 100 ? "#22C55E" : "var(--brand-primary)",
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
          <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 2, textAlign: "center" }}>
            08:00 – 17:00
          </div>
        </div>
      </div>

      {/* ── Weather (LARGE — integrated panel) ──────────────────────────────── */}
      <WeatherPanel />

      {/* ── Bell + User (SMALL — compact, right side) ───────────────────────── */}
      <div className="profile-area" style={{ position: "relative", alignSelf: "center" }}>
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
            gap: 10,
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
          aria-expanded={drawerOpen}
          aria-label="Owner account menu"
        >
          <div className="avatar">{userInitials}</div>
          <div style={{ textAlign: "left" }}>
            <strong style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{userName}</strong>
            <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Owner</small>
          </div>
          <ChevronDown size={16} color="var(--text-muted)" />
        </button>

        {drawerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 320,
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              zIndex: 60,
              padding: 16,
            }}
          >
            {/* Header */}
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

            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{userInitials}</div>
              <div>
                <strong style={{ display: "block", fontSize: 14 }}>{userName}</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {connectedEmail ? `Connected: ${connectedEmail}` : "No owner email loaded"}
                </small>
              </div>
            </div>

            {/* Sign out — placed BEFORE the connect form so it's always visible */}
            <button
              onClick={handleSignOut}
              disabled={authLoading}
              style={{
                marginTop: 12,
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
              Sign out · ออกจากระบบ
            </button>

            {connectedEmail && (
              <div style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginTop: 12, fontWeight: 600 }}>
                Connected owner session
              </div>
            )}

            {/* Connect form — for switching owner accounts */}
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
          </div>
        )}
      </div>
    </header>
  );
}
